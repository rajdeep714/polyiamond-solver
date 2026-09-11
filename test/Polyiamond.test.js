import assert from 'node:assert/strict';
import test from 'node:test';
import { solve as solveExactCover } from 'dlxlib';

import {
    DOWN,
    getAdjacentCoordinates,
    getHexagonCoordinates,
    hexiamonds,
    isTriangleCoordinate,
    MAX_HEXAGON_SIDE_LENGTH,
    Polyiamond,
    UP,
} from '../src/js/Polyiamond.js';
import PolyiamondProblem from '../src/js/PolyiamondProblem.js';

const key = coordinate => coordinate.join(',');

function isConnected(polyiamond) {
    const remaining = new Set(polyiamond.coords.map(key));
    const pending = [polyiamond.coords[0]];
    remaining.delete(key(pending[0]));

    while (pending.length > 0) {
        for (const adjacent of getAdjacentCoordinates(pending.pop())) {
            if (remaining.delete(key(adjacent))) pending.push(adjacent);
        }
    }

    return remaining.size === 0;
}

test('a side-n hexagon contains 6n squared unit triangles', () => {
    for (const sideLength of [1, 2, 3, 5]) {
        const coordinates = getHexagonCoordinates(sideLength);
        assert.equal(coordinates.length, 6 * sideLength ** 2);
        assert.equal(new Set(coordinates.map(key)).size, coordinates.length);
        assert.ok(coordinates.every(isTriangleCoordinate));
    }

    assert.throws(() => getHexagonCoordinates(0), TypeError);
    assert.throws(
        () => getHexagonCoordinates(MAX_HEXAGON_SIDE_LENGTH + 1),
        TypeError,
    );
});

test('rotations and reflections preserve triangular lattice cells', () => {
    const shape = new Polyiamond([
        [0, 0, UP],
        [0, 0, DOWN],
        [0, 1, UP],
    ]);

    let rotated = shape;
    for (let turn = 0; turn < 6; turn++) rotated = rotated.rotate(1);

    assert.ok(rotated.equals(shape));
    assert.ok(shape.rotate(6).equals(shape));
    assert.ok(shape.rotate(-6).equals(shape));
    assert.ok(shape.reflect().reflect().equals(shape));
    assert.equal(shape.rotate(1).coords[0][2], DOWN);

    for (let rotation = 0; rotation < 6; rotation++) {
        assert.ok(shape.rotate(rotation).coords.every(isTriangleCoordinate));
        assert.ok(shape.rotate(rotation).reflect().coords
            .every(isTriangleCoordinate));
    }
});

test('normalization removes translation and is idempotent', () => {
    const original = new Polyiamond([
        [3, -2, DOWN],
        [3, -1, UP],
    ]);
    const normalized = original.normalize();

    assert.deepEqual(normalized.coords, [
        [0, 0, DOWN],
        [0, 1, UP],
    ]);
    assert.ok(normalized.normalize().equals(normalized));
    assert.equal(new Polyiamond([]).getSize(), 0);
});

test('the preset catalog contains the twelve connected free hexiamonds', () => {
    assert.equal(hexiamonds.length, 12);
    assert.ok(hexiamonds.every(shape => shape.coords.length === 6));
    assert.ok(hexiamonds.every(isConnected));
});

test('a rotatable moniamond reaches every cell of a unit hexagon', () => {
    const region = new Polyiamond(getHexagonCoordinates(1));
    const moniamond = new Polyiamond([[0, 0, UP]]);
    const fixedProblem = new PolyiamondProblem(
        [moniamond],
        region,
        false,
        false,
    );
    const rotatingProblem = new PolyiamondProblem(
        [moniamond],
        region,
        true,
        false,
    );

    assert.equal(
        Array.from(
            fixedProblem._generateAllPossibleConfigurations(moniamond),
        ).length,
        3,
    );
    assert.equal(
        Array.from(
            rotatingProblem._generateAllPossibleConfigurations(moniamond),
        ).length,
        6,
    );
});

test('Algorithm X fillers cover both orientations without rotation', () => {
    const piece = new Polyiamond([[0, 0, UP]]);
    const region = new Polyiamond([
        [0, 0, UP],
        [0, 0, DOWN],
    ]);
    const problem = new PolyiamondProblem([piece], region, false, false);
    const { convertedProblem } = problem.convertToDlx();

    assert.ok(convertedProblem.matrix.some(row =>
        row.join(',') === [0, 1, 0, 1].join(',')));

    const solutions = solveExactCover(
        convertedProblem.matrix,
        null,
        null,
        1,
    );
    assert.equal(solutions.length, 1);
});
