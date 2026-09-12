# Polyiamond Solver

Build polyiamonds and an arbitrary destination region on a hexagon-shaped
triangular grid, then find a non-overlapping packing of all the pieces.

Try it online at
[rajdeep714.github.io/polyiamond-solver](https://rajdeep714.github.io/polyiamond-solver/).

The editor includes the twelve free hexiamonds as individual presets. Open the
Patterns tab, select a destination, then press **Solve**. Each pattern loads its
piece set automatically, selects Algorithm X, and enables rotations and
reflections.

Twelve verified packing presets are available:

- **All 22 pieces, 110 triangles:** elongated hexagon, hexagonal ring,
  triangle window, 5 × 11 parallelogram, diamond-window hexagon, and
  butterfly.
- **Omit the moniamond, 109 triangles:** truncated triangle and three-window
  triangle.
- **Omit the diamond, 108 triangles:** perfect hexagram, twelve-tooth sunburst,
  six-arm pinwheel, and snowflake window.

Omitted pieces are left out whole, never cut. Every preset exactly covers its
destination; windows are intentional holes. Symmetry describes the outline and
holes, not the individual piece arrangement. The butterfly shape is also
documented in [Polyform Puzzler's catalogue](https://puzzler.sourceforge.net/docs/polyiamonds.html#polyiamonds-of-order-1-through-6).

For custom problems, pieces may be rotated in 60-degree increments and, when
enabled, reflected. The destination region does not have to be completely
covered: unused triangles are allowed.

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
