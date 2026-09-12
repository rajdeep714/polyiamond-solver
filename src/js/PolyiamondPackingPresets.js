import {
    DOWN,
    getHexagonCoordinates,
    Polyiamond,
    polyiamondsUpToSizeSix,
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

const transformCoordinates = (coordinates, transformPoint) => coordinates.map(
    coordinate => coordinateFromVertices(
        vertices(coordinate).map(transformPoint),
    ),
);

function withoutCoordinates(coordinates, excludedCoordinates) {
    const excluded = new Set(excludedCoordinates.map(coordinateKey));
    return coordinates.filter(coordinate =>
        !excluded.has(coordinateKey(coordinate)));
}

function getPolygonCoordinates(polygonVertices) {
    const edges = polygonVertices.map((start, index) => [
        start,
        polygonVertices[(index + 1) % polygonVertices.length],
    ]);
    const pointIsInside = ([x, y]) => {
        const sides = edges.map(([[ax, ay], [bx, by]]) =>
            (bx - ax) * (y - ay) - (by - ay) * (x - ax));
        return sides.every(side => side >= 0) ||
            sides.every(side => side <= 0);
    };
    const xs = polygonVertices.map(([x]) => x);
    const ys = polygonVertices.map(([_, y]) => y);
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

function getHexagramCoordinates(sideLength) {
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
        return getPolygonCoordinates([start, end, tip]);
    });

    return uniqueCoordinates(
        getHexagonCoordinates(sideLength),
        ...arms,
    );
}

function getTriangleWindowCoordinates() {
    const triangle = getPolygonCoordinates([[0, 0], [11, 0], [0, 11]]);
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

function getButterflyCoordinates() {
    const wing = getPolygonCoordinates([[0, 0], [8, 0], [3, 5], [0, 5]]);
    const opposite = transformCoordinates(wing, ([x, y]) =>
        [x + y - 5, 10 - y]);
    return translate(uniqueCoordinates(wing, opposite), 6, 2);
}

function getThreefoldTriangleCoordinates(cutoutVertices) {
    const triangle = getPolygonCoordinates([[0, 0], [11, 0], [0, 11]]);
    const firstCutout = getPolygonCoordinates(cutoutVertices);
    // A 120-degree turn about the side-11 triangle's fractional center.
    const rotateCutout = coordinates => transformCoordinates(
        coordinates,
        ([x, y]) => [11 - x - y, x],
    );
    const secondCutout = rotateCutout(firstCutout);
    return withoutCoordinates(triangle, uniqueCoordinates(
        firstCutout,
        secondCutout,
        rotateCutout(secondCutout),
    ));
}

function getRadialHexagonCoordinates(armCoordinates) {
    const arm = new Polyiamond(armCoordinates).translate(-4, -4);
    const arms = Array.from({ length: 6 }, (_, rotation) =>
        arm.rotate(rotation).translate(4, 4).coords);
    return translate(uniqueCoordinates(getHexagonCoordinates(4), ...arms),
        1, 1);
}

function getSnowflakeWindowCoordinates() {
    const corners = new Set([
        [0, 3], [0, 6], [3, 6], [6, 3], [6, 0], [3, 0],
    ].map(coordinateKey));
    const window = getHexagonCoordinates(3).filter(coordinate =>
        !vertices(coordinate).some(vertex => corners.has(coordinateKey(vertex))));
    return withoutCoordinates(getHexagonCoordinates(5),
        translate(window, 2, 2));
}

export function getPackingPresetPieces(preset) {
    // Orders 1 and 2 each contain a single piece. Omission never cuts a piece
    // or changes the shared catalog, including when switching back to all 22.
    return polyiamondsUpToSizeSix
        .filter(piece => piece.coords.length !== preset.omitPieceSize)
        .map(piece => piece.clone());
}

export function getPackingPresetPieceLabel(preset) {
    if (preset.omitPieceSize === 1) return '21 pieces · omit the moniamond';
    if (preset.omitPieceSize === 2) return '21 pieces · omit the diamond';
    return 'All 22 pieces';
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
    {
        id: 'perfect-hexagram',
        name: 'Perfect hexagram',
        description: 'Six-point star with six mirror axes',
        sideLength: 6,
        omitPieceSize: 2,
        regionCoords: translate(getHexagramCoordinates(3), 3, 3),
    },
    {
        id: 'diamond-window-hexagon',
        name: 'Diamond-window hexagon',
        description: 'Near-regular hexagon with a tiny central window',
        sideLength: 5,
        regionCoords: withoutCoordinates(
            getElongatedHexagonCoordinates(4, 4, 5),
            [[4, 4, UP], [4, 4, DOWN]],
        ),
    },
    {
        id: 'butterfly',
        name: 'Butterfly',
        description: 'Two broad wings with a narrow waist',
        sideLength: 7,
        regionCoords: getButterflyCoordinates(),
    },
    {
        id: 'truncated-triangle',
        name: 'Truncated triangle',
        description: 'Three evenly clipped corners',
        sideLength: 6,
        omitPieceSize: 1,
        regionCoords: translate(getThreefoldTriangleCoordinates(
            [[0, 0], [2, 0], [0, 2]],
        ), 2, 2),
    },
    {
        id: 'three-window-triangle',
        name: 'Three-window triangle',
        description: 'Three small windows with threefold symmetry',
        sideLength: 8,
        omitPieceSize: 1,
        regionCoords: translate(getThreefoldTriangleCoordinates(
            [[2, 2], [4, 2], [2, 4]],
        ), 3, 5),
    },
    {
        id: 'twelve-tooth-sunburst',
        name: 'Twelve-tooth sunburst',
        description: 'Sixfold symmetry with twelve triangular teeth',
        sideLength: 5,
        omitPieceSize: 2,
        regionCoords: getRadialHexagonCoordinates(
            [[5, -1, DOWN], [6, -1, DOWN]],
        ),
    },
    {
        id: 'six-arm-pinwheel',
        name: 'Six-arm pinwheel',
        description: 'Six rotating vanes without mirror symmetry',
        sideLength: 5,
        omitPieceSize: 2,
        regionCoords: getRadialHexagonCoordinates(
            [[5, -1, DOWN], [5, -1, UP]],
        ),
    },
    {
        id: 'snowflake-window',
        name: 'Snowflake window',
        description: 'Regular hexagon with a scalloped central window',
        sideLength: 5,
        omitPieceSize: 2,
        regionCoords: getSnowflakeWindowCoordinates(),
    },
];
