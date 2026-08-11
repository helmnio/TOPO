import { GRID_SIZE, TOTAL_CELLS, rowColToIndex } from './grid';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbDistance(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  return Math.sqrt(
    (a.r - b.r) ** 2 +
      (a.g - b.g) ** 2 +
      (a.b - b.b) ** 2
  );
}

function scoreDistance(distance) {
  if (distance >= 65) return 10;
  if (distance >= 55) return 9;
  if (distance >= 48) return 8;
  if (distance >= 42) return 7;
  if (distance >= 36) return 6;
  if (distance >= 30) return 5;
  if (distance >= 24) return 4;
  if (distance >= 18) return 3;
  if (distance >= 10) return 2;

  return 1;
}

function scoreAttempt(attempt) {
  if (attempt <= 5) return 10;
  if (attempt <= 10) return 9;
  if (attempt <= 20) return 8;
  if (attempt <= 35) return 7;
  if (attempt <= 50) return 6;
  if (attempt <= 75) return 5;
  if (attempt <= 100) return 4;
  if (attempt <= 150) return 3;
  if (attempt <= 200) return 2;

  return 1;
}

function getColourAnalysis(puzzle) {
  const pairDistances = [];

  for (let i = 0; i < puzzle.palette.length; i += 1) {
    for (let j = i + 1; j < puzzle.palette.length; j += 1) {
      pairDistances.push({
        pair: [puzzle.palette[i], puzzle.palette[j]],
        indexes: [i, j],
        distance: Number(
          rgbDistance(puzzle.palette[i], puzzle.palette[j]).toFixed(2)
        ),
      });
    }
  }

  const sortedDistances = [...pairDistances].sort(
    (a, b) => a.distance - b.distance
  );

  return {
    closestColourPair: sortedDistances[0] || null,
    averagePairDistance: Number(
      (
        pairDistances.reduce((total, row) => total + row.distance, 0) /
        Math.max(pairDistances.length, 1)
      ).toFixed(2)
    ),
  };
}

function getFragmentIndexSet(fragment) {
  return new Set(
    fragment.cells.map((cell) => rowColToIndex(cell.row, cell.col))
  );
}

function getSharedIndices(fragmentA, fragmentB) {
  const aSet = getFragmentIndexSet(fragmentA);
  const bSet = getFragmentIndexSet(fragmentB);

  return [...aSet]
    .filter((index) => bSet.has(index))
    .sort((a, b) => a - b);
}

function getFragmentStats(puzzle) {
  return puzzle.fragments.map((fragment) => {
    let overlapPartnerCount = 0;
    let totalSharedCellsAcrossPartners = 0;
    let hasTripleOverlap = false;

    puzzle.fragments.forEach((otherFragment) => {
      if (otherFragment.id === fragment.id) {
        return;
      }

      const shared = getSharedIndices(fragment, otherFragment);

      if (!shared.length) {
        return;
      }

      overlapPartnerCount += 1;
      totalSharedCellsAcrossPartners += shared.length;

      if (shared.length === 3) {
        hasTripleOverlap = true;
      }
    });

    return {
      id: fragment.id,
      label: fragment.label,
      cellCount: fragment.cells.length,
      overlapPartnerCount,
      totalSharedCellsAcrossPartners,
      hasTripleOverlap,
    };
  });
}

function getCoverageStats(puzzle) {
  const coverage = Array(TOTAL_CELLS).fill(0);

  puzzle.fragments.forEach((fragment) => {
    fragment.cells.forEach((cell) => {
      coverage[rowColToIndex(cell.row, cell.col)] += 1;
    });
  });

  return {
    uncoveredCount: coverage.filter((count) => count === 0).length,
    overusedCount: coverage.filter((count) => count > 3).length,
    singleUseCount: coverage.filter((count) => count === 1).length,
    doubleUseCount: coverage.filter((count) => count === 2).length,
    tripleUseCount: coverage.filter((count) => count === 3).length,
  };
}

export function getPuzzleHealth(puzzle) {
  const warnings = [];

  if (!puzzle) {
    return {
      score: 1,
      label: 'Error',
      warnings: ['Missing puzzle'],
    };
  }

  const colour = getColourAnalysis(puzzle);
  const fragmentStats = getFragmentStats(puzzle);
  const coverage = getCoverageStats(puzzle);

  const closestDistance = colour.closestColourPair?.distance ?? 0;
  const colourScore = scoreDistance(closestDistance);
  const attemptScore = scoreAttempt(puzzle.meta?.attempt ?? 0);

  if (closestDistance < 35) {
    warnings.push(`Close colours: distance ${closestDistance}`);
  }

  if (coverage.uncoveredCount > 0) {
    warnings.push(`${coverage.uncoveredCount} cells uncovered`);
  }

  if (coverage.overusedCount > 0) {
    warnings.push(`${coverage.overusedCount} cells overused`);
  }

  const poorFragments = fragmentStats.filter(
    (fragment) => fragment.overlapPartnerCount === 0
  );

  if (poorFragments.length) {
    warnings.push(`${poorFragments.length} fragments have no overlap`);
  }

  const score = Math.max(
    1,
    Math.round((colourScore * 0.65 + attemptScore * 0.35) * 10) / 10
  );

  return {
    score,
    label:
      warnings.length > 0
        ? 'Warning'
        : score >= 8
        ? 'Good'
        : 'Okay',
    warnings,
    colour,
    fragmentStats,
    coverage,
  };
}

export function getFragmentPositionCells(fragment, answer) {
  const lookup = new Map();

  fragment.cells.forEach((cell) => {
    const index = rowColToIndex(cell.row, cell.col);
    lookup.set(`${cell.row}-${cell.col}`, answer[index]);
  });

  const cells = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const key = `${row}-${col}`;

      cells.push({
        key,
        row,
        col,
        color: lookup.get(key) || null,
      });
    }
  }

  return cells;
}