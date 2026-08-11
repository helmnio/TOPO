// src/utils/palette.js

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sample(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

function shuffle(array, rng) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) =>
      clamp(Math.round(value), 0, 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`;
}

function nudgeHex(hex, rng, amount = 1) {
  const { r, g, b } = hexToRgb(hex);

  return rgbToHex(
    r + randomInt(rng, -amount, amount),
    g + randomInt(rng, -amount, amount),
    b + randomInt(rng, -amount, amount)
  );
}

function getColourDistance(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);

  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  );
}

function getMinimumPaletteDistance(palette) {
  let lowest = Infinity;

  for (let i = 0; i < palette.length; i += 1) {
    for (let j = i + 1; j < palette.length; j += 1) {
      const distance = getColourDistance(palette[i], palette[j]);

      if (distance < lowest) {
        lowest = distance;
      }
    }
  }

  return lowest;
}

const MIN_DISTANCE = 35;
const MAX_ATTEMPTS = 250;

const LEVEL_ORDER = ['dark', 'mid', 'light', 'pale'];

const PALETTE_GROUPS = [
  // DARK

  {
    name: 'dark-green',
    level: 'dark',
    family: 'green',
    colours: ['#1D3D27', '#275134', '#12652B'],
  },
  {
    name: 'dark-blue',
    level: 'dark',
    family: 'blue',
    colours: ['#1F5068', '#255A72', '#2D667E'],
  },
  {
    name: 'dark-brown',
    level: 'dark',
    family: 'brown',
    colours: ['#4B2F1F', '#563824', '#62402A'],
  },
  {
    name: 'dark-grey',
    level: 'dark',
    family: 'grey',
    colours: ['#3D4346', '#474D50', '#52585B'],
  },
  {
    name: 'dark-sand',
    level: 'dark',
    family: 'sand',
    colours: ['#9a7c04', '#8d7411', '#806805'],
  },

  // MID

  {
    name: 'mid-green',
    level: 'mid',
    family: 'green',
    colours: ['#5F7F55', '#6B8B60', '#55754D'],
  },
  {
    name: 'mid-blue',
    level: 'mid',
    family: 'blue',
    colours: ['#3E748A', '#477F95', '#356A80'],
  },
  {
    name: 'mid-brown',
    level: 'mid',
    family: 'brown',
    colours: ['#7A4D2F', '#875839', '#70462B'],
  },
  {
    name: 'mid-grey',
    level: 'mid',
    family: 'grey',
    colours: ['#6B7275', '#767D80', '#81888B'],
  },
  {
    name: 'mid-sand',
    level: 'mid',
    family: 'sand',
    colours: ['#e9e263', '#e2d268', '#dcd869'],
  },

  // LIGHT

  {
    name: 'light-green',
    level: 'light',
    family: 'green',
    colours: ['#91A967', '#9DB573', '#849D5E'],
  },
  {
    name: 'light-blue',
    level: 'light',
    family: 'blue',
    colours: ['#7FAEB8', '#8BBAC4', '#73A2AD'],
  },
  {
    name: 'light-brown',
    level: 'light',
    family: 'brown',
    colours: ['#A66F45', '#B77D50', '#98643E'],
  },
  {
    name: 'light-grey',
    level: 'light',
    family: 'grey',
    colours: ['#A4A8AA', '#B0B4B6', '#9AA0A2'],
  },
  {
    name: 'light-sand',
    level: 'light',
    family: 'sand',
    colours: ['#e8db54', '#e0d770', '#e4d86f'],
  },

  // PALE

  {
    name: 'pale-green',
    level: 'pale',
    family: 'green',
    colours: ['#b9caa6', '#b6d6a3', '#b1dab0'],
  },
  {
    name: 'pale-blue',
    level: 'pale',
    family: 'blue',
    colours: ['#A7D1D4', '#B4DADC', '#9CC7CA'],
  },
  {
    name: 'pale-brown',
    level: 'pale',
    family: 'brown',
    colours: ['#cdab8f', '#c09e7f', '#cea888'],
  },
  {
    name: 'pale-grey',
    level: 'pale',
    family: 'grey',
    colours: ['#D7DBDD', '#E2E5E7', '#C9CED1'],
  },
  {
    name: 'pale-sand',
    level: 'pale',
    family: 'sand',
    colours: ['#EEE096', '#F7E9A5', '#E2D488'],
  },
];

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
}

function getLevelIndex(level) {
  return LEVEL_ORDER.indexOf(level);
}

function canSelectGroup(selected, group) {
  const alreadySelected = selected.some((item) => item.name === group.name);

  if (alreadySelected) {
    return false;
  }

  const sameFamily = selected.filter((item) => item.family === group.family);

  if (sameFamily.length >= 2) {
    return false;
  }

  return sameFamily.every((item) => {
    const levelDistance = Math.abs(getLevelIndex(item.level) - getLevelIndex(group.level));

    return levelDistance >= 2;
  });
}

function isBalancedSelection(groups) {
  const familyCounts = countBy(groups, 'family');
  const levelCounts = countBy(groups, 'level');

  const hasTooManyFromFamily = Object.values(familyCounts).some((count) => count > 2);
  const hasTooManyFromLevel = Object.values(levelCounts).some((count) => count > 3);

  const hasCloseFamilyLevels = groups.some((group) => {
    const sameFamily = groups.filter(
      (item) => item.family === group.family && item.name !== group.name
    );

    return sameFamily.some((item) => {
      const levelDistance = Math.abs(getLevelIndex(item.level) - getLevelIndex(group.level));

      return levelDistance < 2;
    });
  });

  return !hasTooManyFromFamily && !hasTooManyFromLevel && !hasCloseFamilyLevels;
}

function selectGroups(rng) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const selected = [];
    const shuffledGroups = shuffle(PALETTE_GROUPS, rng);

    shuffledGroups.forEach((group) => {
      if (selected.length >= 8) {
        return;
      }

      if (canSelectGroup(selected, group)) {
        selected.push(group);
      }
    });

    if (selected.length === 8 && isBalancedSelection(selected)) {
      return shuffle(selected, rng);
    }
  }

  return [
    PALETTE_GROUPS.find((group) => group.name === 'dark-blue'),
    PALETTE_GROUPS.find((group) => group.name === 'light-blue'),
    PALETTE_GROUPS.find((group) => group.name === 'dark-green'),
    PALETTE_GROUPS.find((group) => group.name === 'light-green'),
    PALETTE_GROUPS.find((group) => group.name === 'dark-brown'),
    PALETTE_GROUPS.find((group) => group.name === 'sand-brown'),
    PALETTE_GROUPS.find((group) => group.name === 'dark-grey'),
    PALETTE_GROUPS.find((group) => group.name === 'off-white'),
  ];
}

function buildMetaFromGroups(groups, rng) {
  return groups.map((group) => {
    const baseColour = sample(group.colours, rng);
    const finalColour = nudgeHex(baseColour, rng, 1);

    return {
      group: group.name,
      family: group.family,
      level: group.level,
      baseColour,
      finalColour,
    };
  });
}

function buildCandidatePalette(rng) {
  const selectedGroups = selectGroups(rng);
  const meta = buildMetaFromGroups(selectedGroups, rng);

  return meta.map((item) => item.finalColour);
}

export function generatePaletteWithMeta(rng = Math.random) {
  let bestMeta = null;
  let bestMinimumDistance = -Infinity;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const selectedGroups = selectGroups(rng);
    const meta = buildMetaFromGroups(selectedGroups, rng);
    const palette = meta.map((item) => item.finalColour);
    const minimumDistance = getMinimumPaletteDistance(palette);

    if (minimumDistance > bestMinimumDistance) {
      bestMeta = meta;
      bestMinimumDistance = minimumDistance;
    }

    if (minimumDistance >= MIN_DISTANCE) {
      return {
        palette,
        meta,
        minimumDistance,
      };
    }
  }

  return {
    palette: bestMeta.map((item) => item.finalColour),
    meta: bestMeta,
    minimumDistance: bestMinimumDistance,
  };
}

export function generatePalette(rng = Math.random) {
  return generatePaletteWithMeta(rng).palette;
}