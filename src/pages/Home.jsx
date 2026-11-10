import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from '../components/layout/BottomNav';
import {
  CompactNextPuzzleCountdown,
} from '../components/play/NextPuzzleCountdown';
import {
  getDailyPuzzle,
  getLocalDateKey,
  getRandomPuzzle,
} from '../data/puzzles';
import { formatElapsedTime } from '../utils/playHelpers';
import {
  clearPlaySession,
  loadPlaySession,
} from '../utils/playStorage';
import { getComputedStats, loadStats } from '../utils/statsStorage';

import ShareButton from '../components/share/ShareButton';

import {
  getWinShareText,
  getFailShareText,
} from '../utils/share';
import { ENABLE_TEST_FEATURES } from '../config/environment';

const SELECTED_PUZZLE_STORAGE_KEY = 'topo:selected-puzzle';
const SELECTED_GAME_MODE_STORAGE_KEY = 'topo:selected-game-mode';

function Home() {
  const navigate = useNavigate();

  const [todayDateKey, setTodayDateKey] = useState(() => getLocalDateKey());
  const currentPuzzle = useMemo(
    () => getDailyPuzzle(todayDateKey),
    [todayDateKey]
  );

  const currentSession = loadPlaySession('daily');
  const overviewStats = getComputedStats(loadStats());

  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(
    currentSession?.elapsedSeconds || 0
  );

  const formattedDate = useMemo(() => {
    const date = new Date(todayDateKey);

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [todayDateKey]);

  const isCurrentDailySession =
    currentSession &&
    currentSession.gameMode === 'daily' &&
    currentSession.dateKey === todayDateKey;

  useEffect(() => {
    const checkDate = () => setTodayDateKey(getLocalDateKey());
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkDate();
    };
    const interval = window.setInterval(checkDate, 1000);

    window.addEventListener('focus', checkDate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkDate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (
      !isCurrentDailySession ||
      !currentSession?.startedAt ||
      currentSession?.isSolved ||
      currentSession?.isSubmitted
    ) {
      return undefined;
    }

    const update = () => {
      setLiveElapsedSeconds(
        Math.floor((Date.now() - currentSession.startedAt) / 1000)
      );
    };

    update();

    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [currentSession, isCurrentDailySession]);

  const isCurrentPuzzleComplete = Boolean(
    isCurrentDailySession &&
      (currentSession.isSolved || currentSession.isSubmitted)
  );

  const todayStatus = (() => {
    if (!isCurrentDailySession) {
      return 'Ready to play';
    }

    if (currentSession.isSolved) {
      return 'Solved';
    }

    if (currentSession.isSubmitted) {
      return 'Submitted';
    }

    const hasProgress =
      Array.isArray(currentSession.mapCells) &&
      currentSession.mapCells.some((cell) => cell !== null);

    return hasProgress ? 'In progress' : 'Ready to play';
  })();

  const todayTime = (() => {
    if (!isCurrentDailySession) {
      return '00:00';
    }

    if (
      currentSession.isSolved ||
      currentSession.isSubmitted
    ) {
      return formatElapsedTime(currentSession.elapsedSeconds || 0);
    }

    return formatElapsedTime(liveElapsedSeconds);
  })();

  const todayResultPercent = (() => {
    if (
      !isCurrentDailySession ||
      !Array.isArray(currentSession.submittedMap) ||
      !Array.isArray(currentPuzzle?.answer)
    ) {
      return null;
    }

    const correctTiles = currentSession.submittedMap.filter(
      (cell, index) => cell === currentPuzzle.answer[index]
    ).length;

    return Math.round(
      (correctTiles / currentPuzzle.answer.length) * 100
    );
  })();

  const handlePlayDaily = () => {
    localStorage.setItem(
      SELECTED_GAME_MODE_STORAGE_KEY,
      'daily'
    );

    localStorage.setItem(
      SELECTED_PUZZLE_STORAGE_KEY,
      JSON.stringify(currentPuzzle)
    );

    navigate('/play');
  };

  const handlePlayRandom = () => {
    clearPlaySession('random');

    const randomPuzzle = getRandomPuzzle();

    localStorage.setItem(
      SELECTED_GAME_MODE_STORAGE_KEY,
      'random'
    );

    localStorage.setItem(
      SELECTED_PUZZLE_STORAGE_KEY,
      JSON.stringify(randomPuzzle)
    );

    navigate('/play');
  };

  const todayCorrectTiles = (() => {
  if (
    !isCurrentDailySession ||
    !Array.isArray(currentSession.submittedMap) ||
    !Array.isArray(currentPuzzle?.answer)
  ) {
    return 0;
  }

  return currentSession.submittedMap.filter(
    (cell, index) => cell === currentPuzzle.answer[index]
  ).length;
})();

const streakAverageTime =
  overviewStats.currentStreakGames > 0
    ? formatElapsedTime(overviewStats.currentStreakAverageTimeSeconds)
    : '--:--';

const todayShareText =
  currentSession?.isSolved
    ? getWinShareText({
        time: todayTime,
        streak: overviewStats.currentStreak,
        averageTime: streakAverageTime,
      })
    : getFailShareText({
        correctTiles: todayCorrectTiles,
        totalTiles: currentPuzzle.answer.length,
        streakLost: currentSession?.streakLost ?? overviewStats.currentStreak,
        averageTime: streakAverageTime,
      });

  return (
    <div className="page page--home">
      <div className="page__inner">
      <main className="page__content app-shell">
      <div className="paper">
        <section className="hero-card">
          <p className="eyebrow">Daily map puzzle</p>

          <h1 className="hero-title">TOPO</h1>

          <p className="hero-text">
            Compare fragments. Build the map.
            <br />
            Solve today’s mosaic puzzle.
          </p>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Today’s game</h2>
            <p>Date · {formattedDate}</p>
          </div>

          <div className="today-card">
            <div className="today-card__meta">
              <span>
                {isCurrentPuzzleComplete
                  ? 'Status · Completed'
                  : `Status · ${todayStatus}`}
              </span>

              <span>Time · {todayTime}</span>

              <CompactNextPuzzleCountdown />
            </div>

            <button
              type="button"
              className="button button--primary"
              onClick={handlePlayDaily}
            >
              {isCurrentPuzzleComplete
                ? 'View Game'
                : 'Play Game'}
            </button>

            {isCurrentPuzzleComplete && (
              <ShareButton
                shareText={todayShareText}
                className="home-share-button"
              >
                Share Today’s Result
              </ShareButton>
            )}

            {ENABLE_TEST_FEATURES && (
              <button
                type="button"
                className="button button--secondary"
                onClick={handlePlayRandom}
                style={{ marginTop: '10px' }}
              >
                Play Random Test Puzzle
              </button>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Stats Overview</h2>
          </div>

          <div className="stats-preview">
            <div className="stat-card">
              <span className="stat-card__label">
                Today’s result
              </span>

              <strong className="stat-card__value">
                {todayResultPercent !== null
                  ? `${todayResultPercent}%`
                  : '--'}
              </strong>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">
                Today’s time
              </span>

              <strong className="stat-card__value">
                {todayTime}
              </strong>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">
                Current streak
              </span>

              <strong className="stat-card__value">
                {overviewStats.currentStreak}
              </strong>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">
                Best streak
              </span>

              <strong className="stat-card__value">
                {overviewStats.maxStreak}
              </strong>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">
                Streak avg time
              </span>

              <strong className="stat-card__value">
                {overviewStats.currentStreakGames > 0
                  ? formatElapsedTime(
                      overviewStats.currentStreakAverageTimeSeconds
                    )
                  : '--:--'}
              </strong>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">
                Streak best time
              </span>

              <strong className="stat-card__value">
                {overviewStats.currentStreakBestTimeSeconds
                  ? formatElapsedTime(
                      overviewStats.currentStreakBestTimeSeconds
                    )
                  : '--:--'}
              </strong>
            </div>
          </div>

          <Link to="/stats" className="text-link">
            View all stats
          </Link>
        </section>
      </div>
      </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default Home;
