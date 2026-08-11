import { buildFragmentMatrix } from '../../utils/fragments';
import { rowColToIndex } from '../../utils/grid';
import { getContrastingIconColor } from '../../utils/testLandmarks';

function rotateMatrixClockwise(matrix) {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex]).reverse()
  );
}

function FragmentShape({
  fragment,
  answer,
  className,
  landmarks = [],
  rotation = 0,
}) {
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

  const rowCount = matrix.length;
  const columnCount = matrix[0]?.length || 1;

  return (
    <div
      className={className}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rowCount}, 1fr)`,
      }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isEmpty = cell.color === null;

          return (
            <span
              key={`${rowIndex}-${colIndex}`}
              className={`${className}__cell ${isEmpty ? 'is-empty' : ''}`}
              style={{
                backgroundColor: cell.color || 'transparent',
              }}
            >
              {cell.landmark && (
                <span
                  className="material-symbols-outlined topo-landmark-icon"
                  style={{ color: getContrastingIconColor(cell.color) }}
                  aria-label={cell.landmark.label}
                >
                  {cell.landmark.icon}
                </span>
              )}
            </span>
          );
        })
      )}
    </div>
  );
}

export default FragmentShape;
