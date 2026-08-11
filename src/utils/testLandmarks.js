import { rowColToIndex } from './grid.js';

export const TEST_LANDMARK_ICONS = {
  'dark-green': ['forest', 'park'],
  'mid-green': ['nature', 'eco'],
  'light-green': ['grass', 'local_florist'],
  'pale-green': ['agriculture', 'yard'],
  'dark-blue': ['waves', 'sailing'],
  'mid-blue': ['kayaking', 'directions_boat'],
  'light-blue': ['water', 'pool'],
  'pale-blue': ['water_drop', 'flood'],
  'dark-brown': ['landscape', 'hiking'],
  'mid-brown': ['terrain', 'nordic_walking'],
  'light-brown': ['directions_walk', 'signpost'],
  'pale-brown': ['explore', 'near_me'],
  'dark-grey': ['castle', 'fort'],
  'mid-grey': ['apartment', 'factory'],
  'light-grey': ['home', 'cottage'],
  'pale-grey': ['church', 'warehouse'],
  'dark-sand': ['volcano', 'landslide'],
  'mid-sand': ['beach_access', 'deck'],
  'light-sand': ['wb_sunny', 'clear_day'],
  'pale-sand': ['camping', 'cabin'],
};

const ICON_LABELS = {
  wb_sunny: 'Sun',
  local_florist: 'Flowers',
  directions_boat: 'Boat',
  directions_walk: 'Footpath',
  nordic_walking: 'Walking trail',
  water_drop: 'Water source',
  beach_access: 'Beach',
  near_me: 'Marker',
};

function hashValue(value) {
  const text = String(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getFragmentIndices(fragment) {
  return fragment.cells.map((cell) => rowColToIndex(cell.row, cell.col));
}

function areAdjacent(indexA, indexB) {
  const rowA = Math.floor(indexA / 5);
  const colA = indexA % 5;
  const rowB = Math.floor(indexB / 5);
  const colB = indexB % 5;

  return Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1;
}

export function getLandmarkIconLabel(icon) {
  if (ICON_LABELS[icon]) return ICON_LABELS[icon];

  return icon
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getContrastingIconColor(backgroundColor) {
  const hex = backgroundColor?.replace('#', '');

  if (!hex || hex.length !== 6) return '#111111';

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance < 0.52 ? '#ffffff' : '#111111';
}

export function getTestLandmarks(puzzle, count = 6) {
  const paletteMeta = puzzle?.meta?.palette;

  if (!Array.isArray(paletteMeta) || !Array.isArray(puzzle?.answer)) {
    return [];
  }

  const seed = puzzle.meta?.attemptSeed || puzzle.meta?.seed || puzzle.id;
  const fragmentIndexRows = puzzle.fragments.map((fragment) => ({
    id: fragment.id,
    indices: getFragmentIndices(fragment),
  }));

  const candidates = paletteMeta
    .map((meta) => {
      const icons = TEST_LANDMARK_ICONS[meta.group];
      const answerIndices = puzzle.answer
        .map((color, index) => ({ color, index }))
        .filter((entry) => entry.color === meta.finalColour)
        .map((entry) => entry.index);

      if (!icons || !answerIndices.length) return null;

      return {
        meta,
        icons,
        answerIndices,
        hintableIndices: answerIndices.filter((index) =>
          fragmentIndexRows.filter((fragment) => fragment.indices.includes(index))
            .length >= 2
        ),
        sort: hashValue(`${seed}:${meta.group}`),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const hintableDifference = Number(Boolean(b.hintableIndices.length)) -
        Number(Boolean(a.hintableIndices.length));

      return hintableDifference || a.sort - b.sort;
    });

  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= count) break;

    const preferredIndices = selected.length < 3 && candidate.hintableIndices.length
      ? candidate.hintableIndices
      : candidate.answerIndices;
    const orderedIndices = [...preferredIndices].sort(
      (a, b) => hashValue(`${seed}:${candidate.meta.group}:${a}`) -
        hashValue(`${seed}:${candidate.meta.group}:${b}`)
    );
    const answerIndex = orderedIndices.find(
      (index) => selected.every((item) => !areAdjacent(item.answerIndex, index))
    ) ?? orderedIndices[0];
    const containingFragments = fragmentIndexRows.filter((fragment) =>
      fragment.indices.includes(answerIndex)
    );

    if (!containingFragments.length) continue;

    const icon = candidate.icons[
      hashValue(`${seed}:${candidate.meta.group}:icon`) % candidate.icons.length
    ];
    const fragment = containingFragments[
      hashValue(`${seed}:${candidate.meta.group}:fragment`) %
        containingFragments.length
    ];
    const hintFragments = containingFragments.filter(
      (item) => item.id !== fragment.id
    );
    const hintFragment = hintFragments.length
      ? hintFragments[
          hashValue(`${seed}:${candidate.meta.group}:hint-fragment`) %
            hintFragments.length
        ]
      : null;

    selected.push({
      id: `${icon}-${answerIndex}`,
      icon,
      label: getLandmarkIconLabel(icon),
      answerIndex,
      color: candidate.meta.finalColour,
      group: candidate.meta.group,
      fragmentId: fragment.id,
      hintFragmentId: hintFragment?.id || null,
    });
  }

  return selected;
}

export function getTestFragmentRotations(puzzle) {
  const seed = puzzle?.meta?.attemptSeed || puzzle?.meta?.seed || puzzle?.id;
  const northFragmentId = puzzle?.fragments?.[0]?.id;

  return Object.fromEntries(
    (puzzle?.fragments || []).map((fragment) => [
      fragment.id,
      fragment.id === northFragmentId
        ? 0
        : hashValue(`${seed}:${fragment.id}:rotation`) % 4,
    ])
  );
}
