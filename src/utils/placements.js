import { GRID_SIZE, TOTAL_CELLS } from './grid.js';
import { buildFragmentCellMatrix } from './fragments.js';

function getMatrix(entry, fragmentItems, answer) {
  const item = fragmentItems.find((fragment) => fragment.id === entry.id);

  return item
    ? buildFragmentCellMatrix(item, answer, [], entry.rotation || 0)
    : null;
}

function forEachPlacedCell(placements, fragmentItems, answer, callback) {
  placements.forEach((entry) => {
    const matrix = getMatrix(entry, fragmentItems, answer);

    matrix?.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell.color) return;

        callback(
          (entry.row + rowIndex) * GRID_SIZE + entry.col + colIndex,
          cell.color,
          entry
        );
      });
    });
  });
}

// Colours of the map with every placement painted in order, later on top.
export function paintPlacements(placements, fragmentItems, answer) {
  const next = Array(TOTAL_CELLS).fill(null);

  forEachPlacedCell(placements, fragmentItems, answer, (index, color) => {
    next[index] = color;
  });

  return next;
}

// Topmost (most recently placed) fragment covering a map square.
export function findPlacementAt(placements, index, fragmentItems, answer) {
  for (let i = placements.length - 1; i >= 0; i -= 1) {
    const entry = placements[i];
    const matrix = getMatrix(entry, fragmentItems, answer);
    const row = Math.floor(index / GRID_SIZE) - entry.row;
    const col = (index % GRID_SIZE) - entry.col;

    if (matrix?.[row]?.[col]?.color) return entry;
  }

  return null;
}

// Map squares where placed fragments disagree on the colour.
export function getConflictCells(placements, fragmentItems, answer) {
  const colorsByCell = Array.from({ length: TOTAL_CELLS }, () => new Set());

  forEachPlacedCell(placements, fragmentItems, answer, (index, color) => {
    colorsByCell[index].add(color);
  });

  return new Set(
    colorsByCell.flatMap((colors, index) => (colors.size > 1 ? [index] : []))
  );
}

export function clampPlacement(position, matrix) {
  return {
    row: Math.max(0, Math.min(position.row, GRID_SIZE - matrix.length)),
    col: Math.max(0, Math.min(position.col, GRID_SIZE - matrix[0].length)),
  };
}

export function getCentredPlacement(matrix) {
  return {
    row: Math.floor((GRID_SIZE - matrix.length) / 2),
    col: Math.floor((GRID_SIZE - matrix[0].length) / 2),
  };
}

// Where a fragment's top-left lands after a turn so its centre stays put.
export function getRotatedPlacement(position, fromMatrix, toMatrix) {
  return clampPlacement(
    {
      row: Math.round(position.row + (fromMatrix.length - toMatrix.length) / 2),
      col: Math.round(
        position.col + (fromMatrix[0].length - toMatrix[0].length) / 2
      ),
    },
    toMatrix
  );
}
