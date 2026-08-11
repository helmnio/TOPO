export const GRID_SIZE = 5;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

export function getAnswerColor(answer, row, col) {
  return answer[row * GRID_SIZE + col];
}

export function indexToRowCol(index) {
  return {
    row: Math.floor(index / GRID_SIZE),
    col: index % GRID_SIZE,
  };
}

export function rowColToIndex(row, col) {
  return row * GRID_SIZE + col;
}