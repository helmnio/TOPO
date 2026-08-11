import { TOTAL_CELLS } from '../../utils/grid';
import { getContrastingIconColor } from '../../utils/testLandmarks';

function MiniMap({
  cells,
  answer = null,
  showDiff = false,
  title,
  landmarks = [],
  landmarkPlacements = null,
}) {
  const correctCount = answer
    ? cells.filter((cell, index) => cell === answer[index]).length
    : 0;

  return (
    <div className="result-map-card">
      <h4>{title}</h4>

      <div className="result-map-grid">
        {cells.map((cellColor, index) => {
          const isCorrect = answer ? cellColor === answer[index] : false;
          const showMismatch = showDiff && answer && !isCorrect;

          const landmarkId = landmarkPlacements?.[index];
          const landmark = landmarks.find((item) => item.id === landmarkId);

          return (
            <div
              key={index}
              className={`result-map-grid__cell ${showMismatch ? 'is-mismatch' : ''}`}
              style={{ backgroundColor: cellColor || '#242424' }}
            >
              {landmark && (
                <span
                  className="material-symbols-outlined topo-landmark-icon topo-landmark-icon--mini"
                  style={{ color: getContrastingIconColor(cellColor) }}
                  aria-hidden="true"
                >
                  {landmark.icon}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {answer && (
        <p className="result-map-meta">
          {correctCount}/{TOTAL_CELLS} correct
        </p>
      )}
    </div>
  );
}

export default MiniMap;
