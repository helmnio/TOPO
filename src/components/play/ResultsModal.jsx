import MiniMap from './MiniMap';
import ShareButton from '../share/ShareButton';

import {
  getWinShareText,
  getFailShareText,
} from '../../utils/share';

function ResultsModal({
  isOpen,
  isDailyMode,
  isSolved,
  submittedMap,
  answer,
  correctPercent,
  correctTiles,
  overviewStats,
  elapsedTimeLabel,
  resultHighlights,
  landmarks = [],
  submittedLandmarks = null,
  correctLandmarks = 0,
  hintsUsed = 0,
  onClose,
}) {
  if (!isOpen || !submittedMap) {
    return null;
  }

  const finalScore = `${correctPercent}%`;

  const currentStreak =
    overviewStats.currentStreak ?? overviewStats.streak ?? 0;

  const streakAverageTime =
    overviewStats.currentStreakAverageTimeFormatted ?? '--:--';

  const todayShareText = isSolved
    ? getWinShareText({
        time: elapsedTimeLabel,
        streak: currentStreak,
        averageTime: streakAverageTime,
      })
    : getFailShareText({
        correctTiles,
        totalTiles: 25,
        streakLost: currentStreak,
        averageTime: streakAverageTime,
      });

  return (
    <div className="results-overlay">
      <div className="results-modal">
        <div className="results-header">
          <div>
            <p className="eyebrow">
              {isDailyMode ? 'Daily result' : 'Test result'}
            </p>
            <h3>{isSolved ? 'Solved' : 'Submitted'}</h3>
          </div>

          <button
            type="button"
            className="button button--secondary button--small"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className={`results-score ${isSolved ? 'is-win' : ''}`}>
          <div className="results-score__main">{finalScore}</div>

          <div className="results-score__sub">
            {isSolved
              ? 'Complete'
                : landmarks.length > 0
                  ? `${correctTiles}/25 tiles · ${correctLandmarks}/${landmarks.length} symbols`
                  : `${correctTiles}/25 correct`}
          </div>
        </div>

        {isDailyMode && (
          <div className="results-actions">
            <ShareButton shareText={todayShareText}>
              Share
            </ShareButton>
          </div>
        )}

        {isDailyMode && <section className="results-section">
          <h4 className="results-section__title">Overview</h4>

          <div className="results-stats results-stats--current">
            <div className="result-stat">
              <span className="result-stat__label">Played</span>
              <strong className="result-stat__value">
                {overviewStats.played}
              </strong>
            </div>

            <div className="result-stat">
              <span className="result-stat__label">Streak</span>
              <strong className="result-stat__value">
                {currentStreak}
              </strong>
            </div>

            <div className="result-stat">
              <span className="result-stat__label">Streak time</span>
              <strong className="result-stat__value">
                {streakAverageTime}
              </strong>
            </div>

            {resultHighlights?.timeVsAverageLabel && (
              <div className="result-stat">
                <span className="result-stat__label">Time vs avg</span>
                <strong className="result-stat__value">
                  {resultHighlights.timeVsAverageLabel}
                </strong>
              </div>
            )}

          </div>
        </section>}

        <section className="results-section">
          <h4 className="results-section__title">Current game</h4>

          <div className="results-stats results-stats--current">
            <div className="result-stat">
              <span className="result-stat__label">Correct %</span>
              <strong className="result-stat__value">
                {correctPercent}%
              </strong>
            </div>

            {landmarks.length > 0 && (
              <div className="result-stat">
                <span className="result-stat__label">Symbols</span>
                <strong className="result-stat__value">
                  {correctLandmarks}/{landmarks.length}
                </strong>
              </div>
            )}

            {landmarks.length > 0 && (
              <div className="result-stat">
                <span className="result-stat__label">Hints used</span>
                <strong className="result-stat__value">{hintsUsed}/3</strong>
              </div>
            )}

            <div className="result-stat">
              <span className="result-stat__label">Correct tiles</span>
              <strong className="result-stat__value">
                {correctTiles}/25
              </strong>
            </div>

            <div className="result-stat">
              <span className="result-stat__label">Time</span>
              <strong className="result-stat__value">
                {elapsedTimeLabel}
              </strong>
            </div>
          </div>
        </section>

        <div className="results-maps">
          <MiniMap
            title="Your map"
            cells={submittedMap}
            answer={answer}
            showDiff={!isSolved}
            landmarks={landmarks}
            landmarkPlacements={submittedLandmarks}
          />

          {!isSolved && (
            <MiniMap
              title="Correct map"
              cells={answer}
              landmarks={landmarks}
              landmarkPlacements={landmarks.reduce((placements, landmark) => {
                placements[landmark.answerIndex] = landmark.id;
                return placements;
              }, Array(25).fill(null))}
            />
          )}
        </div>


      </div>
    </div>
  );
}

export default ResultsModal;
