<script>
    import loadingGif from './assets/loading.gif';
    import TriangularGrid from './TriangularGrid.svelte';
    import {
        getHexagonCoordinates,
        hexiamonds,
        isTriangleCoordinate,
        MAX_HEXAGON_SIDE_LENGTH,
        Polyiamond,
    } from './js/Polyiamond.js';
    import SatSolverWorker from 'worker-loader!./js/SatSolverWorker.js';

    const STORAGE_KEY = 'polyiamond-solver-state';
    const coordinateKey = coordinate => coordinate.join(',');
    const isShape = value => {
        if (!Array.isArray(value) || !value.every(isTriangleCoordinate)) {
            return false;
        }
        return new Set(value.map(coordinateKey)).size === value.length;
    };
    const isStoredPolyiamond = value => isShape(value) &&
        value.length > 0 &&
        value.every(([x, y]) =>
            x >= 0 && x < 2 * MAX_HEXAGON_SIDE_LENGTH &&
            y >= 0 && y < 2 * MAX_HEXAGON_SIDE_LENGTH);

    function loadLocalState() {
        const fallback = {
            savedPolyiamonds: [],
            sideLength: 5,
            regionCoords: [],
        };

        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (stored === null || typeof stored !== 'object') return fallback;

            return {
                savedPolyiamonds: Array.isArray(stored.savedPolyiamonds)
                    ? stored.savedPolyiamonds.filter(isStoredPolyiamond)
                    : [],
                sideLength: Number.isSafeInteger(stored.sideLength) &&
                    stored.sideLength > 0 &&
                    stored.sideLength <= MAX_HEXAGON_SIDE_LENGTH
                    ? stored.sideLength
                    : fallback.sideLength,
                regionCoords: isShape(stored.regionCoords)
                    ? stored.regionCoords
                    : [],
            };
        } catch (_) {
            return fallback;
        }
    }

    function fitsInHexagon(coordinates, sideLength) {
        const available = new Set(
            getHexagonCoordinates(sideLength).map(coordinateKey),
        );
        return coordinates.every(coordinate =>
            available.has(coordinateKey(coordinate)));
    }

    const localState = loadLocalState();

    // UI state
    let polyiamonds = localState.savedPolyiamonds;
    let draftPieceCoords = [];
    let regionCoords = fitsInHexagon(
        localState.regionCoords,
        localState.sideLength,
    ) ? localState.regionCoords : [];
    let settings = {
        method: 'method-dlx',
        allowRotation: true,
        allowReflection: false,
    };
    let pieceEditorSideLength = 3;
    let regionSideLength = localState.sideLength;
    let selectedTab = 'polyiamond';

    $: canDecrementPieceEditorSize = pieceEditorSideLength > 1 &&
        fitsInHexagon(draftPieceCoords, pieceEditorSideLength - 1);
    $: canIncrementPieceEditorSize =
        pieceEditorSideLength < MAX_HEXAGON_SIDE_LENGTH;
    $: canDecrementRegionSize = regionSideLength > 1 &&
        fitsInHexagon(regionCoords, regionSideLength - 1);
    $: canIncrementRegionSize =
        regionSideLength < MAX_HEXAGON_SIDE_LENGTH;
    $: canSolve = polyiamonds.length > 0 &&
        polyiamonds.every(coords => coords.length > 0) &&
        regionCoords.length > 0;

    let persistTimeout;
    function persistStateDebounced() {
        if (persistTimeout !== undefined) clearTimeout(persistTimeout);
        persistTimeout = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                savedPolyiamonds: polyiamonds,
                sideLength: regionSideLength,
                regionCoords,
            }));
        }, 1500);
    }

    $: polyiamonds, regionSideLength, regionCoords, persistStateDebounced();

    // Solver state
    let currentProblem = {
        time: null,
        solutionCoords: null,
        regionOffset: [0, 0],
    };

    $: workComplete = currentProblem.time != null;
    $: foundSolution = currentProblem.solutionCoords != null;

    function resetIfWorkComplete() {
        if (workComplete) currentProblem = {};
    }

    // Changing a piece or solver setting invalidates a displayed solution.
    $: settings, resetIfWorkComplete();
    $: polyiamonds, resetIfWorkComplete();

    let worker = new SatSolverWorker();
    let workerBusy = false;
    worker.onmessage = handleWorkerMessage;

    $: if (settings.method === 'method-z3') {
        worker.postMessage('loadZ3');
        workerBusy = true;
    }

    function addCustomPolyiamond() {
        if (draftPieceCoords.length === 0) return;
        const polyiamond = new Polyiamond(draftPieceCoords).normalize();
        polyiamonds = [...polyiamonds, polyiamond.coords];
    }

    function handleWorkerMessage(event) {
        if (event.data === 'z3Loaded') {
            workerBusy = false;
            return;
        }

        const { solution, time } = event.data;
        let solutionCoords = null;

        if (solution !== null) {
            const [dx, dy] = currentProblem.regionOffset;
            solutionCoords = solution.map(polyiamond =>
                new Polyiamond(polyiamond.coords).translate(dx, dy).coords);
        }

        currentProblem = {
            ...currentProblem,
            time,
            solutionCoords,
        };
        workerBusy = false;
    }

    function solve() {
        if (!canSolve) return;

        const xs = regionCoords.map(([x]) => x);
        const ys = regionCoords.map(([_, y]) => y);
        const regionOffset = [Math.min(...xs), Math.min(...ys)];
        const problemData = {
            pieces: polyiamonds,
            region: regionCoords,
            allowRotation: settings.allowRotation,
            allowReflection: settings.allowReflection,
        };
        const solveMethod = settings.method.split('-')[1];

        currentProblem = { regionOffset };
        worker.postMessage({ type: solveMethod, problem: problemData });
        workerBusy = true;
    }
</script>

<div class="top-bar">
    <div class="top-bar-left">
        <ul class="dropdown menu" data-dropdown-menu>
            <li class="menu-text">Polyiamond Solver</li>
        </ul>
    </div>
    <div class="top-bar-right">
        <ul class="menu">
            <li>
                <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://github.com/rajdeep714/polyiamond-solver"
                >View on GitHub</a>
            </li>
        </ul>
    </div>
</div>

<div class="grid-x grid-padding-x grid-padding-y">
    <div class="cell xlarge-3 medium-6 small-12">
        <ul class="tabs flex-container" data-tabs id="create-tabs">
            <li
                class="tabs-title flex-child-auto"
                class:is-active={selectedTab === 'polyiamond'}
            >
                <a
                    href="#tab-polyiamond"
                    role="tab"
                    aria-selected={selectedTab === 'polyiamond'}
                    on:click|preventDefault={() => selectedTab = 'polyiamond'}
                >Polyiamond</a>
            </li>
            <li
                class="tabs-title flex-child-auto"
                class:is-active={selectedTab === 'hexiamond'}
            >
                <a
                    href="#tab-hexiamond"
                    role="tab"
                    aria-selected={selectedTab === 'hexiamond'}
                    on:click|preventDefault={() => selectedTab = 'hexiamond'}
                >Hexiamonds</a>
            </li>
        </ul>

        <div class="tabs-content">
            <div
                class="tabs-panel"
                class:is-active={selectedTab === 'polyiamond'}
            >
                <div class="editor piece-editor">
                    <TriangularGrid
                        bind:value={draftPieceCoords}
                        sideLength={pieceEditorSideLength}
                        ariaLabel="Create a polyiamond"
                    />
                </div>
                <div class="grid-x grid-padding-x align-middle">
                    <div class="cell shrink">
                        <button
                            class="button hollow size-button"
                            class:disabled={!canDecrementPieceEditorSize}
                            disabled={!canDecrementPieceEditorSize}
                            title="hexagon side length down"
                            on:click={() => pieceEditorSideLength =
                                Math.max(1, pieceEditorSideLength - 1)}
                        >⇲</button>
                        <button
                            class="button hollow size-button"
                            class:disabled={!canIncrementPieceEditorSize}
                            disabled={!canIncrementPieceEditorSize}
                            title="hexagon side length up"
                            on:click={() => pieceEditorSideLength++}
                        >⇱</button>
                        <button
                            class="button hollow size-button"
                            title="clear"
                            on:click={() => draftPieceCoords = []}
                        >⎚</button>
                    </div>
                    <div class="cell auto">
                        <button
                            class="button expanded"
                            disabled={draftPieceCoords.length === 0}
                            class:disabled={draftPieceCoords.length === 0}
                            on:click={addCustomPolyiamond}
                        >Add</button>
                    </div>
                </div>
            </div>
            <div
                class="tabs-panel"
                class:is-active={selectedTab === 'hexiamond'}
            >
                {#each hexiamonds as hexiamond, index}
                    <button
                        class="preset-button"
                        title={`Add hexiamond ${index + 1}`}
                        on:click={() => polyiamonds = [
                            ...polyiamonds,
                            hexiamond.clone().coords,
                        ]}
                    >
                        <TriangularGrid
                            mode="display"
                            value={hexiamond.coords}
                            ariaLabel={`Hexiamond ${index + 1}`}
                        />
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <div class="cell xlarge-3 medium-6 small-12">
        <p><strong>Polyiamonds to be fit</strong> <small>(click to remove)</small></p>
        <div class="callout piece-list">
            {#each polyiamonds as coords, index (coords)}
                <button
                    class="piece-button"
                    title={`Remove polyiamond ${index + 1}`}
                    on:click={() => polyiamonds =
                        polyiamonds.toSpliced(index, 1)}
                >
                    <TriangularGrid
                        mode="display"
                        value={coords}
                        ariaLabel={`Polyiamond ${index + 1}`}
                    />
                </button>
            {/each}
        </div>
    </div>

    <div class="cell xlarge-3 medium-6 small-12">
        {#if workComplete && foundSolution}
            <p><strong>Solution</strong></p>
            <div class="editor">
                <TriangularGrid
                    mode="display-multiple"
                    variant="solution"
                    sideLength={regionSideLength}
                    value={currentProblem.solutionCoords || []}
                    ariaLabel="Packing solution"
                />
            </div>
        {:else}
            <p><strong>Destination region</strong></p>
            <div class="editor">
                <TriangularGrid
                    bind:value={regionCoords}
                    mode="edit-region"
                    variant="region"
                    sideLength={regionSideLength}
                    ariaLabel="Create the destination region"
                />
            </div>
        {/if}

        <button
            class="button hollow size-button"
            class:disabled={workComplete || !canDecrementRegionSize}
            disabled={workComplete || !canDecrementRegionSize}
            title="hexagon side length down"
            on:click={() => regionSideLength =
                Math.max(1, regionSideLength - 1)}
        >⇲</button>
        <button
            class="button hollow size-button"
            class:disabled={workComplete || !canIncrementRegionSize}
            disabled={workComplete || !canIncrementRegionSize}
            title="hexagon side length up"
            on:click={() => regionSideLength++}
        >⇱</button>
        <button
            class="button hollow size-button"
            class:disabled={workComplete}
            disabled={workComplete}
            title="clear"
            on:click={() => regionCoords = []}
        >⎚</button>
    </div>

    <div class="cell xlarge-3 medium-6 small-12">
        <p><strong>Settings</strong></p>
        <div>
            <input type="checkbox" bind:checked={settings.allowRotation}>
            Allow rotations
        </div>
        <div>
            <input type="checkbox" bind:checked={settings.allowReflection}>
            Allow reflections
        </div>
        <hr>
        <div>
            <input
                type="radio"
                value="method-dlx"
                bind:group={settings.method}
            >
            Algorithm X (Dancing Links)
            <p><small>
                Reduces to an
                <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://en.wikipedia.org/wiki/Exact_cover"
                >exact cover problem</a>
                (but will find inexact solutions as well).
            </small></p>
        </div>
        <details>
            <summary>Legacy algorithms</summary>
            <div class="legacy-method">
                <input
                    type="radio"
                    value="method-sat"
                    bind:group={settings.method}
                >
                SAT (JavaScript)
                <p><small>
                    Reduces to
                    <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://en.wikipedia.org/wiki/Boolean_satisfiability_problem"
                    >SAT</a>.
                    Finds partial (inexact) solutions and is nondeterministic.
                </small></p>
            </div>
            <div>
                <input
                    type="radio"
                    value="method-z3"
                    bind:group={settings.method}
                >
                SAT (Z3)
                <p><small>
                    Solves SAT via a WebAssembly build of the
                    <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://github.com/Z3Prover/z3"
                    >Z3 Theorem Prover</a>.
                </small></p>
            </div>
        </details>
        <hr>
        <button
            class="button expanded"
            class:success={!workComplete}
            class:hollow={workComplete}
            disabled={workerBusy || (!workComplete && !canSolve)}
            class:disabled={workerBusy || (!workComplete && !canSolve)}
            on:click={() => workComplete ? resetIfWorkComplete() : solve()}
        >{workComplete ? 'Reset' : 'Solve'}</button>
        {#if workerBusy}
            <div id="loading" class="grid-x loading">
                <div class="cell auto">
                    <img src={loadingGif} alt="loading">
                </div>
            </div>
        {/if}
        {#if workComplete}
            <div
                id="solution-info"
                class="callout"
                class:alert={!foundSolution}
                class:primary={foundSolution}
            >
                {#if foundSolution}
                    Found solution
                {:else}
                    <strong>No solution</strong>
                {/if}
                in {(currentProblem.time / 1000).toFixed(3)} seconds.
            </div>
        {/if}
    </div>
</div>

<style>
    .editor {
        margin-bottom: 10px;
        width: 100%;
        max-width: 34rem;
    }

    .piece-editor {
        --cell-color: cyan;
    }

    .size-button {
        font-size: 2em !important;
        padding: 0.4em 0.2em 0.1em;
        transform: scaleX(-1);
        color: black !important;
    }

    .preset-button,
    .piece-button {
        width: 64px;
        height: 64px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0 8px 12px;
        padding: 4px;
        border: 0;
        background: transparent;
        cursor: pointer;
        --cell-color: lightgreen;
    }

    .preset-button:hover,
    .preset-button:focus,
    .piece-button:hover,
    .piece-button:focus {
        background: #edf8ff;
        --cell-color: lightblue;
    }

    .piece-list {
        min-height: 90px;
    }

    .legacy-method {
        padding-top: 0.6em;
    }

    .loading {
        margin: 15px 0;
    }

    .loading img {
        display: block;
        margin: auto;
    }
</style>
