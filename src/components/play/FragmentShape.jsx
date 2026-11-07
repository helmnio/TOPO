import { buildFragmentCellMatrix } from '../../utils/fragments';
import { getContrastingIconColor } from '../../utils/testLandmarks';

function FragmentShape({
  fragment,
  answer,
  className,
  landmarks = [],
  rotation = 0,
}) {
  const matrix = buildFragmentCellMatrix(
    fragment,
    answer,
    landmarks,
    rotation
  );

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
