import { useEffect, useMemo, useState } from 'react';

import { getLocalDateKey } from '../data/puzzles';
import { DAILY_PUZZLE_VERSIONS } from '../data/puzzleVersions';
import { generatePuzzle } from '../utils/generator';

import {
  getPuzzleHealth,
  getFragmentPositionCells,
} from '../utils/puzzleHealth';

const CONTROL_PASSCODE = 'topo-control';
const CONTROL_AUTH_KEY = 'topo:control-auth';
const STORAGE_KEY = 'topo:control-puzzles';
const VERSION_STORAGE_KEY = 'topo:control-puzzle-versions';

function addDays(date, days) {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
}

function getStartOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);

  return next;
}

function formatDate(date) {
  return getLocalDateKey(date);
}

function loadStoredControlPuzzles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStoredControlPuzzles(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadStoredVersions() {
  try {
    return JSON.parse(localStorage.getItem(VERSION_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStoredVersions(data) {
  localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(data));
}

function getMergedVersions(storedVersions) {
  return {
    ...DAILY_PUZZLE_VERSIONS,
    ...storedVersions,
  };
}

function getSeedForDateWithVersions(dateKey, versions) {
  const version = versions[dateKey];

  if (!version) {
    return `daily-${dateKey}`;
  }

  return `daily-${dateKey}-v${version}`;
}

function generateControlPuzzle(dateKey, versions = {}) {
  return generatePuzzle(getSeedForDateWithVersions(dateKey, versions));
}

function AnswerPreview({ answer }) {
  return (
    <div className="control-answer-grid">
      {answer.map((color, index) => (
        <span
          key={index}
          className="control-answer-grid__cell"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function FragmentPreview({ fragment, answer }) {
  const cells = getFragmentPositionCells(fragment, answer);

  return (
    <div className="control-fragment-grid">
      {cells.map((cell) => (
        <span
          key={cell.key}
          className={`control-fragment-grid__cell ${
            cell.color ? 'is-filled' : ''
          }`}
          style={{
            backgroundColor: cell.color || 'transparent',
          }}
        />
      ))}
    </div>
  );
}

function Control() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(CONTROL_AUTH_KEY) === 'true';
  });

  const [passcode, setPasscode] = useState('');

  const [storedPuzzles, setStoredPuzzles] = useState(() =>
    loadStoredControlPuzzles()
  );

  const [storedVersions, setStoredVersions] = useState(() =>
    loadStoredVersions()
  );

  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [regenConfirmDateKey, setRegenConfirmDateKey] = useState(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => getLocalDateKey(today), [today]);

  const mergedVersions = useMemo(() => {
    return getMergedVersions(storedVersions);
  }, [storedVersions]);

  const startOfThisWeek = useMemo(() => getStartOfWeek(today), [today]);

  const dates = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) =>
      addDays(startOfThisWeek, index)
    );
  }, [startOfThisWeek]);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    const next = { ...storedPuzzles };
    let changed = false;

    dates.forEach((date) => {
      const dateKey = formatDate(date);

      if (!next[dateKey]) {
        next[dateKey] = generateControlPuzzle(dateKey, mergedVersions);
        changed = true;
      }
    });

    if (changed) {
      setStoredPuzzles(next);
      saveStoredControlPuzzles(next);
    }
  }, [dates, isUnlocked, mergedVersions, storedPuzzles]);

  const handleUnlock = (event) => {
    event.preventDefault();

    if (passcode !== CONTROL_PASSCODE) {
      return;
    }

    sessionStorage.setItem(CONTROL_AUTH_KEY, 'true');

    setIsUnlocked(true);
    setPasscode('');
  };

  const handleSelectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
    setRegenConfirmDateKey(null);
  };

  const handleCloseDetails = () => {
    setSelectedDateKey(null);
    setRegenConfirmDateKey(null);
  };

  const handleRegenRequest = (dateKey) => {
    if (dateKey <= todayKey) {
      return;
    }

    setRegenConfirmDateKey(dateKey);
  };

  const handleRegenConfirm = (dateKey) => {
    if (dateKey <= todayKey) {
      return;
    }

    const currentVersion = mergedVersions[dateKey] || 1;
    const nextVersion = currentVersion + 1;

    const nextVersions = {
      ...storedVersions,
      [dateKey]: nextVersion,
    };

    const nextMergedVersions = {
      ...mergedVersions,
      [dateKey]: nextVersion,
    };

    const nextPuzzles = {
      ...storedPuzzles,
      [dateKey]: generateControlPuzzle(dateKey, nextMergedVersions),
    };

    setStoredVersions(nextVersions);
    saveStoredVersions(nextVersions);

    setStoredPuzzles(nextPuzzles);
    saveStoredControlPuzzles(nextPuzzles);

    setRegenConfirmDateKey(null);
  };

  if (!isUnlocked) {
    return (
      <div className="control-lock">
        <form className="control-lock__card" onSubmit={handleUnlock}>
          <h1>Control</h1>

          <input
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="Passcode"
            aria-label="Control passcode"
          />

          <button type="submit">Unlock</button>
        </form>
      </div>
    );
  }

  const selectedPuzzle = selectedDateKey
    ? storedPuzzles[selectedDateKey]
    : null;

  const selectedHealth = selectedPuzzle
    ? getPuzzleHealth(selectedPuzzle)
    : null;

  const canRegenSelected = selectedDateKey && selectedDateKey > todayKey;

  return (
    <div className="control-page">
      <div className="control-page__inner">
        <header className="control-header">
          <h1>Topo Control</h1>
          <p>Current week and next week generation overview.</p>
        </header>

        <div className="control-export">
          <strong>Version export</strong>

          <pre>{`export const DAILY_PUZZLE_VERSIONS = ${JSON.stringify(
            mergedVersions,
            null,
            2
          )};`}</pre>
        </div>

        <div className="control-weeks">
          {[0, 1].map((weekIndex) => {
            const weekDates = dates.slice(weekIndex * 7, weekIndex * 7 + 7);

            return (
              <section key={weekIndex} className="control-week">
                <h2>{weekIndex === 0 ? 'This Week' : 'Next Week'}</h2>

                <div className="control-week__grid">
                  {weekDates.map((date) => {
                    const dateKey = formatDate(date);
                    const puzzle = storedPuzzles[dateKey];

                    if (!puzzle) {
                      return null;
                    }

                    const health = getPuzzleHealth(puzzle);
                    const isPast = dateKey < todayKey;
                    const isToday = dateKey === todayKey;
                    const isSelected = selectedDateKey === dateKey;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className={`control-tile ${
                          isPast ? 'is-past' : ''
                        } ${isToday ? 'is-today' : ''} ${
                          isSelected ? 'is-selected' : ''
                        }`}
                        onClick={() => handleSelectDate(dateKey)}
                      >
                        <div className="control-tile__top">
                          <span>{dateKey.slice(5)}</span>
                          <strong>{health.score}/10</strong>
                        </div>

                        <AnswerPreview answer={puzzle.answer} />

                        <div className="control-tile__meta">
                          <span>V{mergedVersions[dateKey] || 1}</span>
                          <span>Attempt {puzzle.meta?.attempt ?? 0}</span>

                          {!!health.warnings.length && (
                            <span className="control-tile__warning">
                              Warning
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {selectedPuzzle && selectedHealth && (
          <section className="control-details">
            <div className="control-details__header">
              <div>
                <p className="eyebrow">Puzzle Details</p>
                <h2>{selectedDateKey}</h2>
                <p>Seed: {selectedPuzzle.meta?.seed}</p>
                <p>Version: {mergedVersions[selectedDateKey] || 1}</p>
                <p>Attempt: {selectedPuzzle.meta?.attempt}</p>
              </div>

              <button
                type="button"
                className="button button--secondary button--small"
                onClick={handleCloseDetails}
              >
                Close
              </button>
            </div>

            <div className="control-details__score">
              <strong>{selectedHealth.score}/10</strong>
              <span>{selectedHealth.label}</span>
            </div>

            <AnswerPreview answer={selectedPuzzle.answer} />

            <div className="control-palette">
              {selectedPuzzle.palette.map((color) => (
                <span
                  key={color}
                  className="control-palette__swatch"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="control-fragments">
              {selectedPuzzle.fragments.map((fragment) => {
                const stats = selectedHealth.fragmentStats.find(
                  (item) => item.id === fragment.id
                );

                return (
                  <div key={fragment.id} className="control-fragment">
                    <FragmentPreview
                      fragment={fragment}
                      answer={selectedPuzzle.answer}
                    />

                    {stats && (
                      <div className="control-fragment__meta">
                        <span>Cells: {stats.cellCount}</span>
                        <span>Partners: {stats.overlapPartnerCount}</span>
                        <span>Shared: {stats.totalSharedCellsAcrossPartners}</span>
                        <span>
                          Triple: {stats.hasTripleOverlap ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!!selectedHealth.warnings.length && (
              <div className="control-warnings">
                {selectedHealth.warnings.map((warning) => (
                  <div key={warning} className="control-warning">
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <div className="control-actions">
              {!canRegenSelected ? (
                <button type="button" disabled>
                  Regen unavailable
                </button>
              ) : regenConfirmDateKey !== selectedDateKey ? (
                <button
                  type="button"
                  onClick={() => handleRegenRequest(selectedDateKey)}
                >
                  Regen
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => handleRegenConfirm(selectedDateKey)}
                  >
                    Confirm Regen
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegenConfirmDateKey(null)}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Control;