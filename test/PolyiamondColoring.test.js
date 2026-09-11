import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DOWN,
    getAdjacentCoordinates,
    getHexagonCoordinates,
    UP,
} from '../src/js/Polyiamond.js';
import { computeColoring } from '../src/js/PolyiamondColoring.js';

const key = coordinate => coordinate.join(',');

test('polyiamonds sharing a triangle edge receive different colors', () => {
    const polyiamonds = getHexagonCoordinates(1)
        .map(coordinate => [coordinate]);
    const ownerByCoordinate = new Map(
        polyiamonds.map((coordinates, index) => [key(coordinates[0]), index]),
    );
    const coloring = computeColoring(polyiamonds);

    polyiamonds.forEach((coordinates, index) => {
        getAdjacentCoordinates(coordinates[0]).forEach(neighbor => {
            const neighborIndex = ownerByCoordinate.get(key(neighbor));
            if (neighborIndex === undefined) return;
            assert.notEqual(
                coloring.get(index),
                coloring.get(neighborIndex),
            );
        });
    });
});

test('polyiamonds that only meet at a point may reuse a color', () => {
    const coloring = computeColoring([
        [[0, 0, UP]],
        [[0, 0, DOWN]],
        [[1, 0, UP]],
    ]);

    assert.equal(coloring.get(0), coloring.get(2));
    assert.notEqual(coloring.get(0), coloring.get(1));
});

test('an empty solution has an empty coloring', () => {
    assert.deepEqual([...computeColoring([])], []);
});
