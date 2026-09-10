# Polyiamond Solver

Build polyiamonds and an arbitrary destination region on a hexagon-shaped
triangular grid, then find a non-overlapping packing of all the pieces.

Try it online at
[rajdeep714.github.io/polyiamond-solver](https://rajdeep714.github.io/polyiamond-solver/).

The editor includes the twelve free hexiamonds as presets. Pieces may be
rotated in 60-degree increments and, when enabled, reflected. The destination
region does not have to be completely covered: unused triangles are allowed.

## Develop locally

```sh
npm install
npm run serve
```

Run the automated geometry tests and production build with:

```sh
npm test
npm run build
```

## Coordinate model

Each unit triangle is stored as `[x, y, orientation]`. The first two values are
integer coordinates on the triangular lattice; `orientation` is `0` for an
upward triangle and `1` for a downward triangle. Keeping the orientation
explicit makes all integer lattice translations valid and lets rotations and
reflections stay exact without floating-point geometry.

A hexagonal editor with side length `n` contains `6n²` unit triangles. The UI
caps the side length at 20 to keep the number of interactive SVG cells bounded.

## How it works

The default solver reduces the packing problem to
[exact cover](https://en.wikipedia.org/wiki/Exact_cover) and uses Knuth's
[Algorithm X](https://arxiv.org/abs/cs/0011047), implemented by
[dlxlib](https://github.com/taylorjg/dlxlibjs). Single-triangle filler pieces
represent unused cells when the selected pieces cover less area than the
destination region.

Two legacy backends also reduce the same generated placements to Boolean
satisfiability problems. One uses
[boolean-sat](https://www.npmjs.com/package/boolean-sat); the other uses a
WebAssembly build of [Z3](https://github.com/Z3Prover/z3).
