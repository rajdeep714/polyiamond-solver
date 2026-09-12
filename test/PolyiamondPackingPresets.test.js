import assert from 'node:assert/strict';
import test from 'node:test';
import { solve as solveExactCover } from 'dlxlib';

import {
    getAdjacentCoordinates,
    getHexagonCoordinates,
    Polyiamond,
    polyiamondsUpToSizeSix,
} from '../src/js/Polyiamond.js';
import {
    getPackingPresetPieceLabel,
    getPackingPresetPieces,
    packingPresets,
} from '../src/js/PolyiamondPackingPresets.js';
import PolyiamondProblem from '../src/js/PolyiamondProblem.js';

// Identity counts as one rotation; mirror counts are separate.
const expectedPresets = [
    ['elongated-hexagon', 0, 2, 2],
    ['hexagonal-ring', 0, 2, 2],
    ['extended-hexagram', 0, 2, 0],
    ['triangle-window', 0, 1, 1],
    ['parallelogram-5-by-11', 0, 2, 0],
    ['perfect-hexagram', 2, 6, 6],
    ['diamond-window-hexagon', 0, 2, 2],
    ['butterfly', 0, 2, 2],
    ['truncated-triangle', 1, 3, 3],
    ['three-window-triangle', 1, 3, 3],
    ['twelve-tooth-sunburst', 2, 6, 6],
    ['six-arm-pinwheel', 2, 6, 0],
    ['snowflake-window', 2, 6, 6],
];
const key = coordinate => coordinate.join(',');
const normalizedKey = shape => shape.normalize().coords.map(key).join(';');

function freeShapeKey(shape) {
    return Array.from({ length: 6 }, (_, rotation) => [
        normalizedKey(shape.rotate(rotation)),
        normalizedKey(shape.rotate(rotation).reflect()),
    ]).flat().sort()[0];
}

function assertConnected(shape) {
    const remaining = new Set(shape.coords.map(key));
    const pending = [shape.coords[0]];
    remaining.delete(key(pending[0]));

    while (pending.length > 0) {
        for (const adjacent of getAdjacentCoordinates(pending.pop())) {
            if (remaining.delete(key(adjacent))) pending.push(adjacent);
        }
    }
    assert.equal(remaining.size, 0);
}

test('the preset catalog preserves the five originals and adds eight designs', () => {
    assert.deepEqual(packingPresets.map(preset => preset.id),
        expectedPresets.map(([id]) => id));
    assert.equal(new Set(packingPresets.map(preset => preset.id)).size, 13);
});

for (const [id, omittedSize, rotations, mirrors] of expectedPresets) {
    test(`${id}: correct pieces, editor fit, symmetry, and exact packing`, () => {
        const preset = packingPresets.find(candidate => candidate.id === id);
        const region = new Polyiamond(preset.regionCoords);
        const pieces = getPackingPresetPieces(preset);
        const available = new Set(
            getHexagonCoordinates(preset.sideLength).map(key),
        );

        assert.equal(preset.omitPieceSize ?? 0, omittedSize);
        assert.equal(pieces.length, omittedSize ? 21 : 22);
        assert.equal(region.coords.length, 110 - omittedSize);
        assert.deepEqual(pieces.map(piece => piece.coords),
            polyiamondsUpToSizeSix
                .filter(piece => piece.coords.length !== omittedSize)
                .map(piece => piece.coords));
        assert.equal(pieces.reduce((area, piece) => area + piece.coords.length,
            0), region.coords.length);
        assertConnected(region);
        assert.ok(region.coords.every(coordinate =>
            available.has(key(coordinate))));

        const shapeKey = normalizedKey(region);
        const transformed = Array.from({ length: 6 }, (_, rotation) =>
            region.rotate(rotation));
        assert.equal(transformed.filter(shape =>
            normalizedKey(shape) === shapeKey).length, rotations);
        assert.equal(transformed.filter(shape =>
            normalizedKey(shape.reflect()) === shapeKey).length, mirrors);
        const expectedLabel = omittedSize === 1
            ? '21 pieces · omit the moniamond'
            : omittedSize === 2
                ? '21 pieces · omit the diamond'
                : 'All 22 pieces';
        assert.equal(getPackingPresetPieceLabel(preset), expectedLabel);

        const problem = new PolyiamondProblem(pieces, region, true, true);
        const { convertedProblem } = problem.convertToDlx();
        const solutions = solveExactCover(convertedProblem.matrix, null,
            null, 1);
        assert.equal(solutions.length, 1);
        assert.equal(solutions[0].length, pieces.length);
        const usedPieces = new Set();
        const covered = [];
        for (const rowIndex of solutions[0]) {
            const row = convertedProblem.matrix[rowIndex];
            const pieceIndex = row.slice(0, pieces.length).indexOf(1);
            assert.ok(pieceIndex >= 0);
            assert.ok(!usedPieces.has(pieceIndex));
            usedPieces.add(pieceIndex);
            const placed = new Polyiamond(row.slice(pieces.length)
                .flatMap((value, index) => value
                    ? [problem.region.coords[index]] : []));
            assert.equal(freeShapeKey(placed), freeShapeKey(pieces[pieceIndex]));
            assertConnected(placed);
            covered.push(...placed.coords.map(key));
        }
        assert.equal(new Set(covered).size, covered.length);
        assert.deepEqual(covered.sort(), problem.region.coords.map(key).sort());
    });
}

test('loading reduced sets never mutates the catalog or later full sets', () => {
    const original = polyiamondsUpToSizeSix.map(piece => piece.clone().coords);
    for (const preset of packingPresets) {
        const pieces = getPackingPresetPieces(preset);
        pieces[0].coords[0][0] = 999;
        pieces.pop();
        assert.deepEqual(polyiamondsUpToSizeSix.map(piece => piece.coords),
            original);
    }
    assert.deepEqual(getPackingPresetPieces(packingPresets[0])
        .map(piece => piece.coords), original);
});
