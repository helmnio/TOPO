import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultStats,
  updateStatsAfterGame,
} from './statsStorage.js';

function result(dateKey, isWin = true, hintsUsed = 0) {
  return {
    dateKey,
    isWin,
    correctTiles: isWin ? 25 : 17,
    totalTiles: 25,
    timeSeconds: 120,
    hintsUsed,
  };
}

test('consecutive daily wins extend the streak', () => {
  const first = updateStatsAfterGame(
    getDefaultStats(),
    result('2026-08-09')
  );
  const second = updateStatsAfterGame(first, result('2026-08-10'));

  assert.equal(second.played, 2);
  assert.equal(second.wins, 2);
  assert.equal(second.currentStreak, 2);
  assert.equal(second.maxStreak, 2);
});

test('a failed daily game resets the current streak but not the best streak', () => {
  const stats = {
    ...getDefaultStats(),
    played: 4,
    wins: 4,
    currentStreak: 4,
    maxStreak: 4,
    lastWinDate: '2026-08-09',
    lastPlayedDate: '2026-08-09',
  };
  const next = updateStatsAfterGame(stats, result('2026-08-10', false));

  assert.equal(next.currentStreak, 0);
  assert.equal(next.maxStreak, 4);
  assert.equal(next.played, 5);
});

test('the same daily result cannot be counted twice', () => {
  const once = updateStatsAfterGame(
    getDefaultStats(),
    result('2026-08-10')
  );
  const twice = updateStatsAfterGame(once, result('2026-08-10'));

  assert.deepEqual(twice, once);
});

test('a win after a missed day starts a new streak', () => {
  const first = updateStatsAfterGame(
    getDefaultStats(),
    result('2026-08-08')
  );
  const afterMiss = updateStatsAfterGame(first, result('2026-08-10'));

  assert.equal(afterMiss.currentStreak, 1);
  assert.equal(afterMiss.played, 2);
});

test('hint use is preserved across lifetime totals and the current streak', () => {
  const first = updateStatsAfterGame(
    getDefaultStats(),
    result('2026-08-09', true, 2)
  );
  const second = updateStatsAfterGame(
    first,
    result('2026-08-10', true, 1)
  );

  assert.equal(second.totalHintsUsed, 3);
  assert.equal(second.currentStreakHintsUsed, 3);

  const failed = updateStatsAfterGame(
    second,
    result('2026-08-11', false, 2)
  );

  assert.equal(failed.totalHintsUsed, 5);
  assert.equal(failed.currentStreakHintsUsed, 0);
});
