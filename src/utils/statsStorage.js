const DAILY_STATS_KEY = 'topo:daily-stats';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateDifferenceInDays(fromDateKey, toDateKey) {
  const from = new Date(`${fromDateKey}T00:00:00`);
  const to = new Date(`${toDateKey}T00:00:00`);

  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function getDefaultStats() {
  return {
    played: 0,
    wins: 0,

    currentStreak: 0,
    maxStreak: 0,
    lastWinDate: null,
    lastPlayedDate: null,

    totalCorrectTiles: 0,
    totalTiles: 0,

    totalTimeSeconds: 0,
    gamesWithTime: 0,

    bestTimeSeconds: null,

    totalHintsUsed: 0,

    currentStreakTimeSeconds: 0,
    currentStreakGames: 0,
    currentStreakBestTimeSeconds: null,
    currentStreakHintsUsed: 0,
  };
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(DAILY_STATS_KEY);

    if (!raw) {
      return getDefaultStats();
    }

    const parsed = JSON.parse(raw);

    return {
      ...getDefaultStats(),
      ...parsed,
    };
  } catch {
    return getDefaultStats();
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(
      DAILY_STATS_KEY,
      JSON.stringify(stats)
    );
  } catch {
    // fail silently
  }
}

export function clearStats() {
  try {
    localStorage.removeItem(DAILY_STATS_KEY);
  } catch {
    // fail silently
  }
}

export function updateStatsAfterGame(stats, result) {
  const next = {
    ...getDefaultStats(),
    ...stats,
  };

  const resultDateKey = result.dateKey || getLocalDateKey();

  // A daily result is immutable: reopening or rapidly resubmitting the same
  // puzzle must never count as another play.
  if (next.lastPlayedDate === resultDateKey) {
    return next;
  }

  next.played += 1;
  next.lastPlayedDate = resultDateKey;
  const hintsUsed = Number.isFinite(result.hintsUsed)
    ? Math.max(0, Math.floor(result.hintsUsed))
    : 0;

  next.totalHintsUsed += hintsUsed;

  if (result.isWin) {
    next.wins += 1;

    if (next.lastWinDate) {
      const daysSinceLastWin = getDateDifferenceInDays(
        next.lastWinDate,
        resultDateKey
      );

      if (daysSinceLastWin === 1) {
        next.currentStreak += 1;
      } else {
        next.currentStreak = 1;

        next.currentStreakTimeSeconds = 0;
        next.currentStreakGames = 0;
        next.currentStreakBestTimeSeconds = null;
        next.currentStreakHintsUsed = 0;
      }
    } else {
      next.currentStreak = 1;
    }

    next.lastWinDate = resultDateKey;
    next.currentStreakHintsUsed += hintsUsed;

    next.maxStreak = Math.max(
      next.maxStreak,
      next.currentStreak
    );

    if (typeof result.timeSeconds === 'number') {
      next.currentStreakTimeSeconds += result.timeSeconds;
      next.currentStreakGames += 1;

      if (
        next.bestTimeSeconds === null ||
        result.timeSeconds < next.bestTimeSeconds
      ) {
        next.bestTimeSeconds = result.timeSeconds;
      }

      if (
        next.currentStreakBestTimeSeconds === null ||
        result.timeSeconds < next.currentStreakBestTimeSeconds
      ) {
        next.currentStreakBestTimeSeconds = result.timeSeconds;
      }
    }
  } else {
    next.currentStreak = 0;

    next.currentStreakTimeSeconds = 0;
    next.currentStreakGames = 0;
    next.currentStreakBestTimeSeconds = null;
    next.currentStreakHintsUsed = 0;
  }

  next.totalCorrectTiles += result.correctTiles;
  next.totalTiles += result.totalTiles;

  if (typeof result.timeSeconds === 'number') {
    next.totalTimeSeconds += result.timeSeconds;
    next.gamesWithTime += 1;
  }

  return next;
}

export function getComputedStats(stats) {
  const todayKey = getLocalDateKey();

  let computedCurrentStreak = stats.currentStreak;
  let computedStreakTimeSeconds = stats.currentStreakTimeSeconds;
  let computedStreakGames = stats.currentStreakGames;
  let computedStreakBestTimeSeconds = stats.currentStreakBestTimeSeconds;
  let computedStreakHintsUsed = stats.currentStreakHintsUsed;

  if (stats.lastWinDate) {
    const daysSinceLastWin = getDateDifferenceInDays(
      stats.lastWinDate,
      todayKey
    );

    if (daysSinceLastWin >= 2) {
      computedCurrentStreak = 0;
      computedStreakTimeSeconds = 0;
      computedStreakGames = 0;
      computedStreakBestTimeSeconds = null;
      computedStreakHintsUsed = 0;
    }
  }

  const winPercentage = stats.played
    ? Math.round((stats.wins / stats.played) * 100)
    : 0;

  const averageTilePercentage = stats.totalTiles
    ? Math.round((stats.totalCorrectTiles / stats.totalTiles) * 100)
    : 0;

  const averageGameTimeSeconds = stats.gamesWithTime
    ? Math.round(stats.totalTimeSeconds / stats.gamesWithTime)
    : 0;

  const currentStreakAverageTimeSeconds =
    computedStreakGames
      ? Math.round(
          computedStreakTimeSeconds /
          computedStreakGames
        )
      : 0;

  return {
    ...stats,

    currentStreak: computedCurrentStreak,
    streak: computedCurrentStreak,
    currentStreakTimeSeconds: computedStreakTimeSeconds,
    currentStreakGames: computedStreakGames,
    currentStreakBestTimeSeconds: computedStreakBestTimeSeconds,
    currentStreakHintsUsed: computedStreakHintsUsed,

    winPercentage,
    averageTilePercentage,
    averageGameTimeSeconds,
    currentStreakAverageTimeSeconds,
  };
}
