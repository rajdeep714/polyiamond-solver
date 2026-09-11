<script>
    import {
        getHexagonCoordinates,
        MAX_HEXAGON_SIDE_LENGTH,
        UP,
    } from './js/Polyiamond.js';

    export let value = [];
    export let sideLength = 3;
    export let mode = 'edit';
    export let variant = 'piece';
    export let ariaLabel = 'Triangular grid';

    const TRIANGLE_SIDE = 100;
    const TRIANGLE_HEIGHT = Math.sqrt(3) * TRIANGLE_SIDE / 2;
    const PADDING = 5;
    const solutionColors = [
        '#67c5ba',
        '#ff9f80',
        '#f5ce62',
        '#8eb7ef',
        '#ca9ee6',
        '#8fd16f',
        '#ef83ad',
        '#5fc9df',
    ];

    const coordinateKey = ([x, y, orientation]) =>
        `${x},${y},${orientation}`;

    const vertices = ([x, y, orientation]) => orientation === UP
        ? [ [x, y], [x + 1, y], [x, y + 1] ]
        : [ [x + 1, y], [x, y + 1], [x + 1, y + 1] ];

    const latticePoint = ([x, y]) => [
        (x + y / 2) * TRIANGLE_SIDE,
        y * TRIANGLE_HEIGHT,
    ];

    const polygonPoints = coordinate => vertices(coordinate)
        .map(latticePoint)
        .map(([x, y]) => `${x},${y}`)
        .join(' ');

    const getHexagonViewBox = length => [
        length * TRIANGLE_SIDE / 2 - PADDING,
        -PADDING,
        2 * length * TRIANGLE_SIDE + 2 * PADDING,
        2 * length * TRIANGLE_HEIGHT + 2 * PADDING,
    ].join(' ');

    const getTightViewBox = coordinates => {
        if (coordinates.length === 0) return `0 0 100 100`;

        const points = coordinates.flatMap(vertices).map(latticePoint);
        const xs = points.map(([x]) => x);
        const ys = points.map(([_, y]) => y);
        const smallestX = Math.min(...xs);
        const smallestY = Math.min(...ys);

        return [
            smallestX - PADDING,
            smallestY - PADDING,
            Math.max(...xs) - smallestX + 2 * PADDING,
            Math.max(...ys) - smallestY + 2 * PADDING,
        ].join(' ');
    };

    const buildFillMap = (currentValue, currentMode) => {
        const fills = new Map();

        if (currentMode === 'display-multiple') {
            currentValue.forEach((coordinates, index) => {
                coordinates.forEach(coordinate => fills.set(
                    coordinateKey(coordinate),
                    index === 0
                        ? '#ffffff'
                        : solutionColors[
                            (index - 1) % solutionColors.length
                        ],
                ));
            });
        } else {
            currentValue.forEach(coordinate => fills.set(
                coordinateKey(coordinate),
                'var(--cell-color, #58c7d9)',
            ));
        }

        return fills;
    };

    $: safeSideLength = Math.min(
        MAX_HEXAGON_SIDE_LENGTH,
        Math.max(1, Math.floor(Number(sideLength) || 1)),
    );
    $: isEditable = mode === 'edit' || mode === 'edit-region';
    $: isCompact = mode === 'display';
    $: gridCoordinates = isCompact
        ? value
        : getHexagonCoordinates(safeSideLength);
    $: fillMap = buildFillMap(value, mode);
    $: viewBox = isCompact
        ? getTightViewBox(value)
        : getHexagonViewBox(safeSideLength);

    let paintValue = null;
    let activePointerId = null;

    function isSelected(coordinate) {
        const key = coordinateKey(coordinate);
        return value.some(candidate => coordinateKey(candidate) === key);
    }

    function setCoordinate(coordinate, selected) {
        const alreadySelected = isSelected(coordinate);
        if (selected === alreadySelected) return;

        const key = coordinateKey(coordinate);
        value = selected
            ? [...value, [...coordinate]]
            : value.filter(candidate => coordinateKey(candidate) !== key);
    }

    function startPainting(event, coordinate) {
        if (!isEditable || activePointerId !== null) return;
        event.preventDefault();

        activePointerId = event.pointerId;
        paintValue = !isSelected(coordinate);
        setCoordinate(coordinate, paintValue);

        // Touch pointers are implicitly captured by the first cell on Android.
        // Releasing capture lets pointerenter follow the finger across cells.
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }

    function continuePainting(event, coordinate) {
        if (!isEditable || paintValue === null ||
            event.pointerId !== activePointerId) return;
        event.preventDefault();
        setCoordinate(coordinate, paintValue);
    }

    function stopPainting(event) {
        if (activePointerId === null ||
            event.pointerId !== activePointerId) return;
        paintValue = null;
        activePointerId = null;
    }

    function handleKeydown(event, coordinate) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setCoordinate(coordinate, !isSelected(coordinate));
    }

    function fillFor(coordinate) {
        return fillMap.get(coordinateKey(coordinate)) ??
            'var(--grid-background, #f2f2f2)';
    }
</script>

<svelte:window
    on:pointerup={stopPainting}
    on:pointercancel={stopPainting}
/>

<svg
    class="triangle-grid"
    class:editable={isEditable}
    class:compact={isCompact}
    class:region={variant === 'region'}
    class:solution={variant === 'solution'}
    {viewBox}
    preserveAspectRatio="xMidYMid meet"
    role={isEditable ? undefined : 'img'}
    aria-label={ariaLabel}
>
    {#each gridCoordinates as coordinate (coordinateKey(coordinate))}
        {#if isEditable}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <polygon
                class="cell"
                points={polygonPoints(coordinate)}
                fill={fillFor(coordinate)}
                role="button"
                tabindex="0"
                aria-label={`Triangle ${coordinateKey(coordinate)}`}
                aria-pressed={fillMap.has(coordinateKey(coordinate))}
                on:pointerdown={event => startPainting(event, coordinate)}
                on:pointerenter={event => continuePainting(event, coordinate)}
                on:keydown={event => handleKeydown(event, coordinate)}
            />
        {:else}
            <polygon
                class="cell"
                points={polygonPoints(coordinate)}
                fill={fillFor(coordinate)}
            />
        {/if}
    {/each}
</svg>

<style>
    .triangle-grid {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
        touch-action: none;
    }

    .cell {
        stroke: var(--grid-line-color, #707070);
        stroke-width: 1.5;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }

    .editable .cell {
        cursor: pointer;
    }

    .editable .cell:focus {
        outline: none;
        stroke: #1261a0;
        stroke-width: 4;
    }

    .region {
        --cell-color: #ffffff;
        --grid-background: #d3d3d3;
    }

    .solution {
        --grid-background: #d3d3d3;
    }

    .compact {
        --grid-line-color: #555555;
    }
</style>
