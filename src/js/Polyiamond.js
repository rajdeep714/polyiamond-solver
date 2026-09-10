export const UP = 0;
export const DOWN = 1;
export const MAX_HEXAGON_SIDE_LENGTH = 20;

const coordinateKey = ([x, y, orientation]) =>
    `${x},${y},${orientation}`;

const compareCoordinates = (
    [x1, y1, orientation1],
    [x2, y2, orientation2],
) => (x1 - x2) || (y1 - y2) || (orientation1 - orientation2);

export const isTriangleCoordinate = coordinate =>
    Array.isArray(coordinate) &&
    coordinate.length === 3 &&
    Number.isSafeInteger(coordinate[0]) &&
    Number.isSafeInteger(coordinate[1]) &&
    (coordinate[2] === UP || coordinate[2] === DOWN);

/*
 * Coordinates identify one of the two unit triangles in a triangular-lattice
 * parallelogram. (x, y) locates the parallelogram and orientation selects its
 * upward- or downward-pointing half. Keeping orientation explicit makes every
 * integer lattice translation valid.
 */
const getVertices = ([x, y, orientation]) => orientation === UP
    ? [ [x, y], [x + 1, y], [x, y + 1] ]
    : [ [x + 1, y], [x, y + 1], [x + 1, y + 1] ];

const pointKey = ([x, y]) => `${x},${y}`;

const coordinateFromVertices = vertices => {
    const smallestX = Math.min(...vertices.map(([x]) => x));
    const smallestY = Math.min(...vertices.map(([_, y]) => y));
    const vertexKeys = new Set(vertices.map(pointKey));
    const orientation = vertexKeys.has(pointKey([smallestX, smallestY]))
        ? UP
        : DOWN;

    return [smallestX, smallestY, orientation];
};

// In axial lattice coordinates, a 60-degree counter-clockwise rotation maps
// the two basis vectors to (0, 1) and (-1, 1), respectively.
const rotatePoint = ([x, y]) => [-y, x + y];
const reflectPoint = ([x, y]) => [x + y, -y];

const transformCoordinate = (coordinate, transformPoint) =>
    coordinateFromVertices(getVertices(coordinate).map(transformPoint));

const adjacentCoordinates = ([x, y, orientation]) => orientation === UP
    ? [ [x, y, DOWN], [x, y - 1, DOWN], [x - 1, y, DOWN] ]
    : [ [x, y, UP], [x, y + 1, UP], [x + 1, y, UP] ];

const isPointInHexagon = ([x, y], sideLength) =>
    x >= 0 && x <= 2 * sideLength &&
    y >= 0 && y <= 2 * sideLength &&
    x + y >= sideLength && x + y <= 3 * sideLength;

export function getHexagonCoordinates(sideLength) {
    if (!Number.isSafeInteger(sideLength) ||
        sideLength < 1 ||
        sideLength > MAX_HEXAGON_SIDE_LENGTH) {
        throw new TypeError(
            `Hexagon side length must be between 1 and ` +
            `${MAX_HEXAGON_SIDE_LENGTH}`,
        );
    }

    const coordinates = [];
    for (let x = 0; x < 2 * sideLength; x++) {
        for (let y = 0; y < 2 * sideLength; y++) {
            for (const orientation of [UP, DOWN]) {
                const coordinate = [x, y, orientation];
                if (getVertices(coordinate).every(point =>
                    isPointInHexagon(point, sideLength))) {
                    coordinates.push(coordinate);
                }
            }
        }
    }

    return coordinates;
}

const normalizedKey = polyiamond => polyiamond.normalize().coords
    .map(coordinateKey)
    .join(';');

const freeSymmetryKey = polyiamond => {
    const keys = [];

    for (let rotation = 0; rotation < 6; rotation++) {
        const rotated = polyiamond.rotate(rotation);
        keys.push(normalizedKey(rotated));
        keys.push(normalizedKey(rotated.reflect()));
    }

    return keys.sort()[0];
};

export class Polyiamond {

    constructor(coords) {
        if (!Array.isArray(coords) || !coords.every(isTriangleCoordinate)) {
            throw new TypeError(
                'Polyiamond coordinates must be [x, y, orientation] triples',
            );
        }

        const copiedCoords = coords.map(coordinate => [...coordinate]);
        const uniqueCoordinateCount = new Set(
            copiedCoords.map(coordinateKey),
        ).size;
        if (uniqueCoordinateCount !== copiedCoords.length) {
            throw new TypeError('Polyiamond coordinates must be unique');
        }

        this.coords = copiedCoords;
    }

    clone() {
        return new Polyiamond(this.coords);
    }

    // Shift to the smallest non-negative coordinates and sort consistently.
    normalize() {
        if (this.isEmpty()) return this.clone();

        const smallestX = Math.min(...this.coords.map(([x]) => x));
        const smallestY = Math.min(...this.coords.map(([_, y]) => y));
        const coords = this.translate(-smallestX, -smallestY)
            .coords
            .sort(compareCoordinates);

        return new Polyiamond(coords);
    }

    // Strict comparison; normalized shapes can be compared independent of
    // their original translation.
    equals(polyiamond) {
        return this.coords.length === polyiamond.coords.length &&
            this.coords.every((coordinate, index) =>
                coordinateKey(coordinate) ===
                coordinateKey(polyiamond.coords[index]));
    }

    isEmpty() {
        return this.coords.length === 0;
    }

    // Rotate in 60-degree counter-clockwise turns.
    rotate(turns) {
        const normalizedTurns = ((turns % 6) + 6) % 6;
        let coords = this.coords.map(coordinate => [...coordinate]);

        for (let turn = 0; turn < normalizedTurns; turn++) {
            coords = coords.map(coordinate =>
                transformCoordinate(coordinate, rotatePoint));
        }

        return new Polyiamond(coords);
    }

    reflect() {
        return new Polyiamond(this.coords.map(coordinate =>
            transformCoordinate(coordinate, reflectPoint)));
    }

    translate(dx, dy) {
        return new Polyiamond(this.coords.map(([x, y, orientation]) =>
            [x + dx, y + dy, orientation]));
    }

    isDisjointFrom(other) {
        const otherCoordinates = new Set(other.coords.map(coordinateKey));
        return this.coords.every(coordinate =>
            !otherCoordinates.has(coordinateKey(coordinate)));
    }

    getWidth() {
        if (this.isEmpty()) return 0;
        const xs = this.coords.map(([x]) => x);
        return Math.max(...xs) - Math.min(...xs) + 1;
    }

    getHeight() {
        if (this.isEmpty()) return 0;
        const ys = this.coords.map(([_, y]) => y);
        return Math.max(...ys) - Math.min(...ys) + 1;
    }

    getSize() {
        return Math.max(this.getWidth(), this.getHeight());
    }

    getLargestX() {
        return this.isEmpty() ? -1 : Math.max(...this.coords.map(([x]) => x));
    }

    getLargestY() {
        return this.isEmpty()
            ? -1
            : Math.max(...this.coords.map(([_, y]) => y));
    }

    containsCoordinate(coordinate) {
        const key = coordinateKey(coordinate);
        return this.coords.some(candidate => coordinateKey(candidate) === key);
    }
}

function generateFreePolyiamonds(size) {
    let shapes = [new Polyiamond([[0, 0, UP]])];

    for (let currentSize = 1; currentSize < size; currentSize++) {
        const nextShapes = new Map();

        for (const shape of shapes) {
            const occupied = new Set(shape.coords.map(coordinateKey));

            for (const coordinate of shape.coords) {
                for (const adjacent of adjacentCoordinates(coordinate)) {
                    if (occupied.has(coordinateKey(adjacent))) continue;

                    const candidate = new Polyiamond([
                        ...shape.coords,
                        adjacent,
                    ]).normalize();
                    const key = freeSymmetryKey(candidate);
                    if (!nextShapes.has(key)) nextShapes.set(key, candidate);
                }
            }
        }

        shapes = [...nextShapes.values()];
    }

    return shapes.sort((first, second) =>
        normalizedKey(first).localeCompare(normalizedKey(second)));
}

// There are twelve free hexiamonds. Generate them from lattice adjacency so
// the presets use exactly the same geometry and symmetry rules as the solver.
export const hexiamonds = generateFreePolyiamonds(6);
