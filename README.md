# TOPO

TOPO is a daily map puzzle built with React and Vite. Players reconstruct a
5×5 map from overlapping, rotated fragments, place map symbols, and use the
north marker to complete the map in its correct orientation.

## Play

**[Play TOPO on GitHub Pages](https://helmnio.github.io/TOPO/)**

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

## Theme

Each look is its own stylesheet in `src/theme/`, scoped to its own id, so no theme
overrides another. Switch with `?theme=<id>` in the address (it lasts for that
browser tab only; the plain address always gives the default), or change
`DEFAULT_THEME` in `src/theme/index.js`.

| id | what it is |
| --- | --- |
| `adventure-v1` | The adventure map look as it was, frozen. Also tagged `adventure-v1` in git. |
| `adventure-v2` | The adventure look being developed (default). |
| `gts`, `survey` | Earlier redesign experiments. |
| `classic` | The original design. |

To add another version, copy `adventure-v2.css`, rename its scope, and register it
in `src/theme/index.js`.
