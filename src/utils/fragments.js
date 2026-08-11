import { getAnswerColor } from './grid';

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