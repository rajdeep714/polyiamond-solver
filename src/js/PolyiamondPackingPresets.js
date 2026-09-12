import {
    DOWN,
    getAdjacentCoordinates,
    getHexagonCoordinates,
    UP,
} from './Polyiamond.js';

const coordinateKey = coordinate => coordinate.join(',');

const vertices = ([x, y, orientation]) => orientation === UP
    ? [[x, y], [x + 1, y], [x, y + 1]]
    : [[x + 1, y], [x, y + 1], [x + 1, y + 1]];

function coordinateFromVertices(coordinateVertices) {
    const smallestX = Math.min(...coordinateVertices.map(([x]) => x));
    const smallestY = Math.min(...coordinateVertices.map(([_, y]) => y));
    const vertexKeys = new Set(
        coordinateVertices.map(point => point.join(',')),
    );
    const orientation = vertexKeys.has(`${smallestX},${smallestY}`)
        ? UP
        : DOWN;

    return [smallestX, smallestY, orientation];
}

const translate = (coordinates, dx, dy) => coordinates.map(
    ([x, y, orientation]) => [x + dx, y + dy, orientation],
);

const uniqueCoordinates = (...coordinateGroups) => [...new Map(
    coordinateGroups.flat().map(coordinate => [
        coordinateKey(coordinate),
        coordinate,
    ]),
).values()];

function getTriangleCoordinates(triangleVertices) {
    const [[ax, ay], [bx, by], [cx, cy]] = triangleVertices;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const pointIsInside = ([x, y]) => {
        const sides = [
            (bx - ax) * (y - ay) - (by - ay) * (x - ax),
            (cx - bx) * (y - by) - (cy - by) * (x - bx),
            (ax - cx) * (y - cy) - (ay - cy) * (x - cx),
        ];
        return sides.every(side => side * area >= 0);
    };
    const xs = triangleVertices.map(([x]) => x);
    const ys = triangleVertices.map(([_, y]) => y);
    const coordinates = [];

    for (let x = Math.min(...xs) - 1; x <= Math.max(...xs); x++) {
        for (let y = Math.min(...ys) - 1; y <= Math.max(...ys); y++) {
            for (const orientation of [UP, DOWN]) {
                const coordinate = [x, y, orientation];
                if (vertices(coordinate).every(pointIsInside)) {
                    coordinates.push(coordinate);
                }
            }
        }
    }

    return coordinates;
}

function getElongatedHexagonCoordinates(a, b, c) {
    const pointIsInside = ([x, y]) =>
        x >= 0 && x <= b + c &&
        y >= 0 && y <= a + c &&
        x + y >= c && x + y <= a + b + c;
    const coordinates = [];

    for (let x = 0; x < b + c; x++) {
        for (let y = 0; y < a + c; y++) {
            for (const orientation of [UP, DOWN]) {
                const coordinate = [x, y, orientation];
                if (vertices(coordinate).every(pointIsInside)) {
                    coordinates.push(coordinate);
                }
            }
        }
    }

    return coordinates;
}

function getRhombusCoordinates(width, height) {
    const coordinates = [];

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            coordinates.push([x, y, UP], [x, y, DOWN]);
        }
    }

    return coordinates;
}

function getHexagonalRingCoordinates() {
    const hole = new Set(
        translate(getElongatedHexagonCoordinates(2, 2, 4), 2, 2)
            .map(coordinateKey),
    );
    return getHexagonCoordinates(5).filter(coordinate =>
        !hole.has(coordinateKey(coordinate)));
}

function getExtendedHexagramCoordinates() {
    const sideLength = 3;
    const hexagonVertices = [
        [0, sideLength],
        [0, 2 * sideLength],
        [sideLength, 2 * sideLength],
        [2 * sideLength, sideLength],
        [2 * sideLength, 0],
        [sideLength, 0],
    ];
    const rotate60 = ([x, y]) => [-y, x + y];
    const arms = hexagonVertices.map((start, index) => {
        const end = hexagonVertices[(index + 1) % hexagonVertices.length];
        const edge = [end[0] - start[0], end[1] - start[1]];
        const outward = rotate60(edge);
        const tip = [start[0] + outward[0], start[1] + outward[1]];
        return getTriangleCoordinates([start, end, tip]);
    });

    const star = uniqueCoordinates(
        getHexagonCoordinates(sideLength),
        ...arms,
    );
    const occupied = new Set(star.map(coordinateKey));
    const frontier = uniqueCoordinates(...star.map(coordinate =>
        getAdjacentCoordinates(coordinate).filter(neighbor =>
            !occupied.has(coordinateKey(neighbor)))));
    const centroidX = coordinate => vertices(coordinate)
        .reduce((sum, [x, y]) => sum + x + y / 2, 0) / 3;
    const first = frontier.reduce((leftmost, candidate) =>
        centroidX(candidate) < centroidX(leftmost) ? candidate : leftmost);
    const opposite = coordinateFromVertices(vertices(first).map(([x, y]) =>
        [2 * sideLength - x, 2 * sideLength - y]));

    return uniqueCoordinates(star, [first, opposite]);
}

function getTriangleWindowCoordinates() {
    const triangle = getTriangleCoordinates([[0, 0], [11, 0], [0, 11]]);
    const ribbon = Array.from({ length: 5 }, (_, index) => [
        [index + 1, 3, UP],
        [index + 1, 3, DOWN],
    ]).flat();
    ribbon.push([6, 3, UP]);
    const hole = new Set(ribbon.map(coordinateKey));

    return translate(
        triangle.filter(coordinate => !hole.has(coordinateKey(coordinate))),
        3,
        5,
    );
}

export const packingPresets = [
    {
        id: 'elongated-hexagon',
        name: 'Elongated hexagon',
        description: 'Compact and convex',
        sideLength: 5,
        regionCoords: getElongatedHexagonCoordinates(3, 5, 5),
    },
    {
        id: 'hexagonal-ring',
        name: 'Hexagonal ring',
        description: 'Regular outline with a centered window',
        sideLength: 5,
        regionCoords: getHexagonalRingCoordinates(),
    },
    {
        id: 'extended-hexagram',
        name: 'Extended hexagram',
        description: 'Six-point star with elongated tips',
        sideLength: 6,
        regionCoords: translate(getExtendedHexagramCoordinates(), 3, 3),
    },
    {
        id: 'triangle-window',
        name: 'Triangle window',
        description: 'Large triangle with a narrow cutout',
        sideLength: 8,
        regionCoords: getTriangleWindowCoordinates(),
    },
    {
        id: 'parallelogram-5-by-11',
        name: '5 × 11 parallelogram',
        description: 'Straight-edged and orderly',
        sideLength: 8,
        regionCoords: translate(getRhombusCoordinates(5, 11), 3, 5),
    },
];
