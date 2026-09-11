import { getAdjacentCoordinates } from './Polyiamond.js';

const coordinateKey = coordinate => coordinate.join(',');

function computeAdjacency(polyiamonds) {
    const adjacency = new Map(
        polyiamonds.map((_, index) => [index, new Set()]),
    );
    const ownerByCoordinate = new Map();

    polyiamonds.forEach((coordinates, pieceIndex) => {
        coordinates.forEach(coordinate => {
            ownerByCoordinate.set(coordinateKey(coordinate), pieceIndex);
        });
    });

    polyiamonds.forEach((coordinates, pieceIndex) => {
        coordinates.forEach(coordinate => {
            getAdjacentCoordinates(coordinate).forEach(neighbor => {
                const neighborIndex = ownerByCoordinate.get(
                    coordinateKey(neighbor),
                );
                if (neighborIndex === undefined ||
                    neighborIndex === pieceIndex) return;

                adjacency.get(pieceIndex).add(neighborIndex);
                adjacency.get(neighborIndex).add(pieceIndex);
            });
        });
    });

    return adjacency;
}

/*
 * Piece adjacency is a planar map, so repeatedly removing a vertex with at
 * most five neighbors lets us assign at most six colors when rebuilding it.
 * This is the same strategy as the original square-grid component, with
 * triangle edge-neighbors replacing Manhattan-distance neighbors.
 */
export function computeColoring(polyiamonds) {
    const adjacency = computeAdjacency(polyiamonds);
    const remaining = new Set(adjacency.keys());
    const removed = [];

    while (remaining.size > 0) {
        let vertex = [...remaining].find(candidate =>
            [...adjacency.get(candidate)]
                .filter(neighbor => remaining.has(neighbor)).length <= 5);

        // This fallback also handles unusual disconnected user pieces whose
        // adjacency graph is not planar.
        if (vertex === undefined) {
            vertex = [...remaining].reduce((leastConnected, candidate) => {
                const degree = [...adjacency.get(candidate)]
                    .filter(neighbor => remaining.has(neighbor)).length;
                const leastDegree = [...adjacency.get(leastConnected)]
                    .filter(neighbor => remaining.has(neighbor)).length;
                return degree < leastDegree ? candidate : leastConnected;
            });
        }

        remaining.delete(vertex);
        removed.push(vertex);
    }

    const coloring = new Map();
    while (removed.length > 0) {
        const vertex = removed.pop();
        const neighborColors = new Set(
            [...adjacency.get(vertex)]
                .map(neighbor => coloring.get(neighbor))
                .filter(color => color !== undefined),
        );
        let color = 0;
        while (neighborColors.has(color)) color++;
        coloring.set(vertex, color);
    }

    return coloring;
}
