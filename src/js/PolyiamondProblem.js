import { Polyiamond, UP } from './Polyiamond.js';

import CNFBuilder from './CNFBuilder.js';

export default class PolyiamondProblem {

    constructor(pieces, region, allowRotation=true, allowReflection=false) {
        this.pieces = pieces.map(piece => piece.normalize());
        this.region = region.normalize();
        this.allowRotation = allowRotation;
        this.allowReflection = allowReflection;

        this.width = this.region.getWidth();
        this.height = this.region.getHeight();
    }

    _fits(piece) {
        if (piece.getLargestX() >= this.width ||
            piece.getLargestY() >= this.height) {
            return false;
        }

        return piece.coords.every(coordinate =>
            this.region.containsCoordinate(coordinate));
    }

    *_generateAllPossibleConfigurations(piece) {
        const uniqueConfigs = [];
        const rotations = this.allowRotation ? [0, 1, 2, 3, 4, 5] : [0];
        const reflections = this.allowReflection ? [false, true] : [false];

        for (const rotation of rotations) {
            for (const reflected of reflections) {
                let config = piece.rotate(rotation);
                if (reflected) config = config.reflect();
                config = config.normalize();

                if (uniqueConfigs.some(candidate => candidate.equals(config))) {
                    continue;
                }
                uniqueConfigs.push(config);

                for (let dx = 0; dx < this.width; dx++) {
                    for (let dy = 0; dy < this.height; dy++) {
                        const placement = config.translate(dx, dy);
                        if (this._fits(placement)) yield placement;
                    }
                }
            }
        }
    }

    convertToSAT() {
        const pieceData = [];
        let currentVariableOffset = 1;

        for (const piece of this.pieces) {
            const configurations = Array.from(
                this._generateAllPossibleConfigurations(piece),
            );
            const offset = currentVariableOffset;

            pieceData.push({
                varsOffset: offset,
                varsLength: configurations.length,
                varsEnd: offset + configurations.length,
                getConfiguration: variableIndex => {
                    const index = variableIndex - offset;
                    return index >= 0 && index < configurations.length
                        ? configurations[index]
                        : null;
                },
            });

            currentVariableOffset += configurations.length;
        }

        const cnf = new CNFBuilder();

        // Each piece is placed in exactly one of its possible configurations.
        for (const data of pieceData) {
            for (let variable = data.varsOffset;
                variable < data.varsEnd;
                variable++) {
                for (let other = variable + 1;
                    other < data.varsEnd;
                    other++) {
                    cnf.beginClause();
                    cnf.addNot(variable);
                    cnf.addNot(other);
                    cnf.endClause();
                }
            }

            cnf.beginClause();
            for (let variable = data.varsOffset;
                variable < data.varsEnd;
                variable++) {
                cnf.add(variable);
            }
            cnf.endClause();
        }

        // Placements belonging to different pieces cannot share a triangle.
        for (let firstIndex = 0; firstIndex < pieceData.length; firstIndex++) {
            for (let secondIndex = firstIndex + 1;
                secondIndex < pieceData.length;
                secondIndex++) {
                const first = pieceData[firstIndex];
                const second = pieceData[secondIndex];

                for (let firstVariable = first.varsOffset;
                    firstVariable < first.varsEnd;
                    firstVariable++) {
                    for (let secondVariable = second.varsOffset;
                        secondVariable < second.varsEnd;
                        secondVariable++) {
                        if (first.getConfiguration(firstVariable)
                            .isDisjointFrom(
                                second.getConfiguration(secondVariable),
                            )) {
                            continue;
                        }

                        cnf.beginClause();
                        cnf.addNot(firstVariable);
                        cnf.addNot(secondVariable);
                        cnf.endClause();
                    }
                }
            }
        }

        const interpreter = solution => solution
            .map((value, index) => {
                if (index === 0 || !value) return null;
                const data = pieceData.find(candidate =>
                    candidate.getConfiguration(index) !== null);
                return data?.getConfiguration(index) ?? null;
            })
            .filter(configuration => configuration !== null);

        return {
            convertedProblem: cnf.getCNFProblem(),
            interpreter,
        };
    }

    convertToZ3() {
        const program = [];
        const expression = (...parts) => `( ${parts.join(' ')} )`;
        const assert = value => expression('assert', value);
        const variableName = (pieceIndex, configIndex) =>
            `p_${pieceIndex}_${configIndex}`;
        const pieceData = this.pieces.map(piece =>
            Array.from(this._generateAllPossibleConfigurations(piece)));

        pieceData.forEach((configs, pieceIndex) => {
            configs.forEach((configuration, configIndex) => {
                program.push(expression(
                    'declare-const',
                    variableName(pieceIndex, configIndex),
                    'Bool',
                ));
            });
        });

        pieceData.forEach((configs, pieceIndex) => {
            const variables = configs.map((configuration, configIndex) =>
                variableName(pieceIndex, configIndex));

            program.push(assert(expression(
                expression('_', 'at-most', '1'),
                ...variables,
            )));
            program.push(assert(expression('or', ...variables)));
        });

        pieceData.forEach((configs, pieceIndex) => {
            configs.forEach((configuration, configIndex) => {
                const disallowedVariables = [];

                pieceData.forEach((otherConfigs, otherPieceIndex) => {
                    if (pieceIndex === otherPieceIndex) return;

                    otherConfigs.forEach((otherConfiguration, otherConfigIndex) => {
                        if (!configuration.isDisjointFrom(otherConfiguration)) {
                            disallowedVariables.push(variableName(
                                otherPieceIndex,
                                otherConfigIndex,
                            ));
                        }
                    });
                });

                if (disallowedVariables.length > 0) {
                    program.push(assert(expression(
                        '=>',
                        variableName(pieceIndex, configIndex),
                        expression(
                            'not',
                            expression('or', ...disallowedVariables),
                        ),
                    )));
                }
            });
        });

        program.push(expression('check-sat'));
        program.push(expression('get-model'));
        program.push(expression('exit'));

        const interpreter = solution => {
            const polyiamonds = [];

            for (const assignment of solution.slice(1)) {
                const variable = assignment[1];
                const value = assignment[4] === 'true';

                if (value) {
                    const [_, pieceIndex, configIndex] = variable.split('_');
                    polyiamonds.push(pieceData[pieceIndex][configIndex]);
                }
            }

            return polyiamonds;
        };

        return {
            convertedProblem: { inputFile: program.join('\n') },
            interpreter,
        };
    }

    convertToDlx() {
        const matrix = [];
        const totalPieceCoords = this.pieces.reduce(
            (sum, piece) => sum + piece.coords.length,
            0,
        );
        const numberOfPlaceholders = Math.max(
            this.region.coords.length - totalPieceCoords,
            0,
        );
        const placeholders = Array.from(
            { length: numberOfPlaceholders },
            () => new Polyiamond([[0, 0, UP]]),
        );
        const paddedPieces = [...this.pieces, ...placeholders];
        const rowSize = paddedPieces.length + this.region.coords.length;

        paddedPieces.forEach((piece, pieceIndex) => {
            const isPlaceholder = pieceIndex >= this.pieces.length;

            // Filler cells are solver machinery, not user pieces. They must be
            // able to occupy either orientation even if rotation is disabled.
            const configs = isPlaceholder
                ? this.region.coords.map(coordinate =>
                    new Polyiamond([coordinate]))
                : Array.from(this._generateAllPossibleConfigurations(piece));

            for (const config of configs) {
                const row = new Array(rowSize).fill(0);
                row[pieceIndex] = 1;

                for (const coordinate of config.coords) {
                    const index = this.region.coords.findIndex(candidate =>
                        candidate[0] === coordinate[0] &&
                        candidate[1] === coordinate[1] &&
                        candidate[2] === coordinate[2]);
                    row[paddedPieces.length + index] = 1;
                }

                matrix.push(row);
            }
        });

        const findOneIndices = values => {
            const next = values.indexOf(1);
            if (next < 0) return [];
            return [
                next,
                ...findOneIndices(values.slice(next + 1))
                    .map(index => next + 1 + index),
            ];
        };

        const interpreter = solution => {
            const pieces = [];

            for (const row of solution) {
                const pieceIndex = row.indexOf(1);
                const coordinateIndices = findOneIndices(
                    row.slice(paddedPieces.length),
                );

                if (pieceIndex < this.pieces.length) {
                    pieces.push(new Polyiamond(coordinateIndices.map(index =>
                        this.region.coords[index])));
                }
            }

            return pieces;
        };

        return { convertedProblem: { matrix }, interpreter };
    }
}
