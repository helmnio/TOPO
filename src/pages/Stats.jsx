import BottomNav from '../components/layout/BottomNav';
import { formatElapsedTime } from '../utils/playHelpers';
import { getComputedStats, loadStats } from '../utils/statsStorage';
import { loadPlaySession } from '../utils/playStorage';
import { getDailyPuzzle, getLocalDateKey } from '../data/puzzles';

import ShareButton from '../components/share/ShareButton';

import {
  getStatsShareText,
} from '../utils/share';

function Stats() {
  const stats = getComputedStats(loadStats());
  const todayDateKey = getLocalDateKey();
  const dailySession = loadPlaySession('daily');
  const isTodaySession = Boolean(
    dailySession &&
      dailySession.gameMode === 'daily' &&
      dailySession.dateKey === todayDateKey
  );
  const todayPuzzle = getDailyPuzzle(todayDateKey);
  const todaySubmittedMap = isTodaySession && Array.isArray(dailySession.submittedMap)
    ? dailySession.submittedMap
    : null;
  const todayCorrectTiles = todaySubmittedMap
    ? todaySubmittedMap.filter(
        (cell, index) => cell === todayPuzzle.answer[index]
      ).length
    : null;
  const todayAccuracy = todayCorrectTiles === null
    ? null
    : Math.round((todayCorrectTiles / todayPuzzle.answer.length) * 100);
  const todayElapsedSeconds = !isTodaySession
    ? 0
    : dailySession.isTimerRunning && dailySession.startedAt
      ? Math.max(0, Math.floor((Date.now() - dailySession.startedAt) / 1000))
      : dailySession.elapsedSeconds || 0;
  const isTodayFinished = Boolean(
    isTodaySession && (dailySession.isSolved || dailySession.isSubmitted)
  );
  const todayHintsUsed = isTodayFinished &&
    Array.isArray(dailySession.revealedHintLandmarkIds)
    ? dailySession.revealedHintLandmarkIds.length
    : null;

  const averageTimeLabel =
    stats.gamesWithTime > 0
      ? formatElapsedTime(stats.averageGameTimeSeconds)
      : '--:--';

  const bestTimeLabel =
    stats.bestTimeSeconds
      ? formatElapsedTime(stats.bestTimeSeconds)
      : '--:--';

  const currentStreakAverageTimeLabel =
    stats.currentStreakGames > 0
      ? formatElapsedTime(stats.currentStreakAverageTimeSeconds)
      : '--:--';

  const currentStreakBestTimeLabel =
    stats.currentStreakBestTimeSeconds
      ? formatElapsedTime(stats.currentStreakBestTimeSeconds)
      : '--:--';

  const todayTimeVsAverageLabel = (() => {
    if (!isTodayFinished || stats.gamesWithTime === 0) {
      return '--:--';
    }

    if (dailySession.resultHighlights?.timeVsAverageLabel) {
      return dailySession.resultHighlights.timeVsAverageLabel;
    }

    const difference = todayElapsedSeconds - stats.averageGameTimeSeconds;

    if (difference === 0) {
      return '0:00';
    }

    return `${difference < 0 ? '−' : '+'}${formatElapsedTime(
      Math.abs(difference)
    )}`;
  })();

  const statsShareText = getStatsShareText({
  mapsBuilt: stats.played,
  winRate: stats.winPercentage,
  totalCorrectTiles: stats.totalCorrectTiles,
  totalTiles: stats.totalTiles,
  bestStreak: stats.maxStreak,
  averageTime: averageTimeLabel,
});

  return (
    <div className="page page--stats">
      <div className="page__inner">
        <main className="page__content">
          <section className="hero-card">
            <p className="eyebrow">Progress</p>
            <h1 className="hero-title">Stats</h1>
            <p className="hero-text">
              Today’s Daily result and your complete lifetime performance.
            </p>
            <div className="stats-hero-actions">
              <ShareButton shareText={statsShareText}>
                Share Full Stats
              </ShareButton>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Today’s</h2>
              <p>{todayDateKey}</p>
            </div>

            <div className="stats-preview">
              <div className="stat-card">
                <span className="stat-card__label">Today’s accuracy</span>
                <strong className="stat-card__value">
                  {todayAccuracy === null ? '--' : `${todayAccuracy}%`}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Today’s tiles</span>
                <strong className="stat-card__value">
                  {todayCorrectTiles === null
                    ? '--'
                    : `${todayCorrectTiles}/${todayPuzzle.answer.length}`}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Today’s time</span>
                <strong className="stat-card__value">
                  {isTodaySession
                    ? formatElapsedTime(todayElapsedSeconds)
                    : '--:--'}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Time vs avg</span>
                <strong className="stat-card__value">
                  {todayTimeVsAverageLabel}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Today’s hints</span>
                <strong className="stat-card__value">
                  {todayHintsUsed === null ? '--' : `${todayHintsUsed}/3`}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Streak</h2>
            </div>

            <div className="stats-preview">
              <div className="stat-card">
                <span className="stat-card__label">Current streak</span>
                <strong className="stat-card__value">{stats.currentStreak}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Streak avg time</span>
                <strong className="stat-card__value">
                  {currentStreakAverageTimeLabel}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Best streak</span>
                <strong className="stat-card__value">{stats.maxStreak}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Streak best time</span>
                <strong className="stat-card__value">
                  {currentStreakBestTimeLabel}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Streak hints</span>
                <strong className="stat-card__value">
                  {stats.currentStreakHintsUsed}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Lifetime Performance</h2>
            </div>

            <div className="stats-preview">
              <div className="stat-card">
                <span className="stat-card__label">Played</span>
                <strong className="stat-card__value">{stats.played}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Wins</span>
                <strong className="stat-card__value">{stats.wins}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Losses</span>
                <strong className="stat-card__value">
                  {stats.played - stats.wins}
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Win %</span>
                <strong className="stat-card__value">{stats.winPercentage}%</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Avg accuracy</span>
                <strong className="stat-card__value">
                  {stats.averageTilePercentage}%
                </strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Total correct tiles</span>
                <strong className="stat-card__value">{stats.totalCorrectTiles} / {stats.totalTiles}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Avg time</span>
                <strong className="stat-card__value">{averageTimeLabel}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Best time</span>
                <strong className="stat-card__value">{bestTimeLabel}</strong>
              </div>

              <div className="stat-card">
                <span className="stat-card__label">Lifetime hints</span>
                <strong className="stat-card__value">
                  {stats.totalHintsUsed}
                </strong>
              </div>
            </div>
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

export default Stats;
