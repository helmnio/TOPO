# TOPO

TOPO is a daily map puzzle built with React and Vite. Players reconstruct a
5×5 map from overlapping, rotated fragments, place map symbols, and use the
north marker to complete the map in its correct orientation.

## Production

Production builds contain the Daily game, Learn page, statistics, symbols,
rotations, and hints. Random puzzle controls, autofill tools, and developer
routes are disabled unless test features are explicitly enabled.

```bash
npm install
npm run build
```

The production output is written to `dist`.

## Local development

```bash
npm install
npm run dev
```

Vite development mode enables the internal testing tools. To enable them in a
non-development environment, set `VITE_ENABLE_TEST_FEATURES=true` deliberately.

## Verification

```bash
npm test
npm run build
```
