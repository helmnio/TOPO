import { getAnswerColor, rowColToIndex } from './grid';

export function buildFragmentMatrix(cells, answer) {
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);

  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;

  const matrix = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  cells.forEach((cell) => {
    matrix[cell.row - minRow][cell.col - minCol] = getAnswerColor(
      answer,
      cell.row,
      cell.col
    );
  });

  return matrix;
}

function rotateMatrixClockwise(matrix) {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex]).reverse()
  );
}

// Rotated matrix of { color, landmark } cells for a fragment. Empty cells
// have a null colour.
export function buildFragmentCellMatrix(
  fragment,
  answer,
  landmarks = [],
  rotation = 0
) {
  const colorMatrix = buildFragmentMatrix(fragment.cells, answer);
  const minRow = Math.min(...fragment.cells.map((entry) => entry.row));
  const minCol = Math.min(...fragment.cells.map((entry) => entry.col));
  let matrix = colorMatrix.map((row, rowIndex) =>
    row.map((color, colIndex) => {
      const fragmentCell = fragment.cells.find(
        (item) =>
          item.row === rowIndex + minRow && item.col === colIndex + minCol
      );
      const answerIndex = fragmentCell
        ? rowColToIndex(fragmentCell.row, fragmentCell.col)
        : null;
      const landmark = landmarks.find(
        (item) =>
          item.fragmentId === fragment.id && item.answerIndex === answerIndex
      );

      return { color, landmark };
    })
  );

  for (let turn = 0; turn < rotation % 4; turn += 1) {
    matrix = rotateMatrixClockwise(matrix);
  }

  return matrix;
}
