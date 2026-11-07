import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import BottomNav from '../components/layout/BottomNav';
import FragmentShape from '../components/play/FragmentShape';
import SubmitConfirmModal from '../components/play/SubmitConfirmModal';
import ResultsModal from '../components/play/ResultsModal';
import { buildFragmentCellMatrix } from '../utils/fragments';

import ShareButton from '../components/share/ShareButton';

import {
  getWinShareText,
  getFailShareText,
} from '../utils/share';

import { getDailyPuzzle, getLocalDateKey } from '../data/puzzles';

import { GRID_SIZE, TOTAL_CELLS } from '../utils/grid';

import {
  shuffleRuntime,
  clampNumber,
  formatElapsedTime,
  boardsMatch,
} from '../utils/playHelpers';

import {
  clearPlaySession,
  loadPlaySession,
  savePlaySession,
} from '../utils/playStorage';

import {
  loadStats,
  saveStats,
  updateStatsAfterGame,
  getComputedStats,
} from '../utils/statsStorage';
import {
  getContrastingIconColor,
  getTestFragmentRotations,
  getTestLandmarks,
} from '../utils/testLandmarks';
import {
  ACTIVE_DAILY_SESSION_VERSION,
  ACTIVE_DAILY_RULESET,
  GAMEPLAY_RULESETS,
  getGameplayRules,
} from '../config/gameplayRules';
import { ENABLE_TEST_FEATURES } from '../config/environment';

const SELECTED_PUZZLE_STORAGE_KEY = 'topo:selected-puzzle';
const SELECTED_GAME_MODE_STORAGE_KEY = 'topo:selected-game-mode';

function loadSelectedPuzzle(gameMode, dateKey) {
  if (gameMode === 'daily') {
    return getDailyPuzzle(dateKey);
  }

  try {
    const raw = localStorage.getItem(SELECTED_PUZZLE_STORAGE_KEY);

    if (!raw) {
      return getDailyPuzzle(dateKey);
    }

    return JSON.parse(raw);
  } catch {
    return getDailyPuzzle(dateKey);
  }
}

function getGridMetrics(gridElement) {
  const cells = gridElement?.querySelectorAll('[data-cell-index]');

  if (!cells || cells.length < TOTAL_CELLS) return null;

  const first = cells[0].getBoundingClientRect();
  const last = cells[TOTAL_CELLS - 1].getBoundingClientRect();

  return {
    left: first.left,
    top: first.top,
    stepX: (last.left - first.left) / (GRID_SIZE - 1),
    stepY: (last.top - first.top) / (GRID_SIZE - 1),
  };
}

function paintPlacements(placements, fragmentItems, answer) {
  const next = Array(TOTAL_CELLS).fill(null);

  placements.forEach((entry) => {
    const item = fragmentItems.find((fragment) => fragment.id === entry.id);

    if (!item) return;

    buildFragmentCellMatrix(item, answer, [], entry.rotation).forEach(
      (row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (!cell.color) return;

          next[(entry.row + rowIndex) * GRID_SIZE + entry.col + colIndex] =
            cell.color;
        });
      }
    );
  });

  return next;
}

// Topmost (most recently placed) fragment covering a map square.
function findPlacementAt(placements, index, fragmentItems, answer) {
  for (let i = placements.length - 1; i >= 0; i -= 1) {
    const entry = placements[i];
    const item = fragmentItems.find((fragment) => fragment.id === entry.id);

    if (!item) continue;

    const matrix = buildFragmentCellMatrix(item, answer, [], entry.rotation);
    const row = Math.floor(index / GRID_SIZE) - entry.row;
    const col = (index % GRID_SIZE) - entry.col;

    if (matrix[row]?.[col]?.color) return entry;
  }

  return null;
}

function swapItems(array, fromIndex, toIndex) {
  const next = [...array];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];

  return next;
}

function animateRotationOverlay(
  elements,
  targetCenter = null,
  { showMapPlaceholders = false } = {}
) {
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !elements.length
  ) {
    return Promise.resolve(() => {});
  }

  const rects = elements.map((element) => element.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const sourceCenter = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const destination = targetCenter || sourceCenter;
  const overlay = document.createElement('div');

  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
    zIndex: '1000',
    pointerEvents: 'none',
    transformOrigin: 'center',
  });
  const fragmentCellSize = getComputedStyle(elements[0]).getPropertyValue(
    '--fragment-cell-size'
  );

  if (fragmentCellSize) {
    overlay.style.setProperty('--fragment-cell-size', fragmentCellSize);
  }

  elements.forEach((element, index) => {
    const rect = rects[index];
    const clone = element.cloneNode(true);
    const computedStyle = getComputedStyle(element);
    const layoutWidth = element.offsetWidth || rect.width;
    const layoutHeight = element.offsetHeight || rect.height;

    clone.removeAttribute('id');
    Object.assign(clone.style, {
      position: 'absolute',
      left: `${rect.left - left + (rect.width - layoutWidth) / 2}px`,
      top: `${rect.top - top + (rect.height - layoutHeight) / 2}px`,
      width: `${layoutWidth}px`,
      height: `${layoutHeight}px`,
      margin: '0',
      transform: computedStyle.transform,
      transformOrigin: computedStyle.transformOrigin,
      visibility: 'visible',
    });
    overlay.appendChild(clone);
    if (showMapPlaceholders) {
      element.classList.add('is-rotation-placeholder');
    } else {
      element.style.visibility = 'hidden';
    }
  });

  document.body.appendChild(overlay);
  const animation = overlay.animate(
    [
      { transform: 'translate(0, 0) rotate(0deg)' },
      {
        transform: `translate(${destination.x - sourceCenter.x}px, ${destination.y - sourceCenter.y}px) rotate(90deg)`,
      },
    ],
    {
      duration: 180,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards',
    }
  );

  return animation.finished
    .catch(() => {})
    .then(() => () => {
      overlay.remove();
      elements.forEach((element) => {
        element.classList.remove('is-rotation-placeholder');
        element.style.visibility = '';
      });
    });
}

function Play() {
  const navigate = useNavigate();
  const mapGridRef = useRef(null);
  const submissionInProgressRef = useRef(false);

  const gameMode = useMemo(() => {
    if (!ENABLE_TEST_FEATURES) return 'daily';

    return localStorage.getItem(SELECTED_GAME_MODE_STORAGE_KEY) || 'daily';
  }, []);

  const isDailyMode = gameMode === 'daily';
  const gameplayRules = getGameplayRules(
    isDailyMode ? ACTIVE_DAILY_RULESET : GAMEPLAY_RULESETS.ICON_ROTATE
  );
  const usesMapFeatures = gameplayRules.symbols;
  const todayDateKey = useMemo(() => getLocalDateKey(), []);
  const puzzle = useMemo(
    () => loadSelectedPuzzle(gameMode, todayDateKey),
    [gameMode, todayDateKey]
  );

  const fragmentItems = useMemo(() => puzzle.fragments, [puzzle]);
  const palette = puzzle.palette;
  const answer = puzzle.answer;
  const testLandmarks = useMemo(
    () => (usesMapFeatures ? getTestLandmarks(puzzle) : []),
    [puzzle, usesMapFeatures]
  );
  const northFragmentId = gameplayRules.northMarker
    ? fragmentItems[0]?.id
    : null;

  const initialSession = useMemo(() => {
    const session = loadPlaySession(gameMode);

    if (!session) return null;
    if (session.gameMode !== gameMode) return null;
    if (isDailyMode && session.dateKey !== todayDateKey) return null;
    if (
      isDailyMode &&
      session.dailySessionVersion !== ACTIVE_DAILY_SESSION_VERSION
    ) return null;

    return session;
  }, [gameMode, isDailyMode, todayDateKey]);

  const defaultFragmentOrder = useMemo(() => {
    return fragmentItems.map((item) => item.id);
  }, [fragmentItems]);
  const defaultFragmentRotations = useMemo(
    () =>
      gameplayRules.fragmentRotation ? getTestFragmentRotations(puzzle) : {},
    [gameplayRules.fragmentRotation, puzzle]
  );

  const [fragmentOrder, setFragmentOrder] = useState(() => {
    const savedOrder = initialSession?.fragmentOrder;

    if (!Array.isArray(savedOrder)) {
      return defaultFragmentOrder;
    }

    const validSavedIds = savedOrder.filter((id) =>
      defaultFragmentOrder.includes(id)
    );

    const missingIds = defaultFragmentOrder.filter(
      (id) => !validSavedIds.includes(id)
    );

    return [...validSavedIds, ...missingIds];
  });
  const [fragmentRotations, setFragmentRotations] = useState(() => {
    const saved = initialSession?.fragmentRotations;

    if (!saved) return defaultFragmentRotations;

    return Object.fromEntries(
      defaultFragmentOrder.map((id) => [
        id,
        id === northFragmentId
          ? 0
          : Number.isInteger(saved[id])
            ? saved[id] % 4
            : defaultFragmentRotations[id],
      ])
    );
  });

  const [usedFragments, setUsedFragments] = useState(() => {
    const savedUsedFragments = initialSession?.usedFragments;

    if (!Array.isArray(savedUsedFragments)) {
      return [];
    }

    return savedUsedFragments.filter((id) => defaultFragmentOrder.includes(id));
  });

  const [fragmentDrag, setFragmentDrag] = useState(null);
  const [activeFragmentId, setActiveFragmentId] = useState(null);
  const [placement, setPlacement] = useState({ row: 0, col: 0 });
  const [isPlacementDragging, setIsPlacementDragging] = useState(false);
  const placementDragRef = useRef(null);

  const [mapCells, setMapCells] = useState(() => {
    const savedMap = initialSession?.mapCells;

    return Array.isArray(savedMap) && savedMap.length === TOTAL_CELLS
      ? savedMap
      : Array(TOTAL_CELLS).fill(null);
  });

  const mapCellsRef = useRef(mapCells);
  const [mapLandmarks, setMapLandmarks] = useState(() => {
    const saved = initialSession?.mapLandmarks;

    return Array.isArray(saved) && saved.length === TOTAL_CELLS
      ? saved.map((landmarkId) =>
          testLandmarks.some((landmark) => landmark.id === landmarkId)
            ? landmarkId
            : null
        )
      : Array(TOTAL_CELLS).fill(null);
  });
  const mapLandmarksRef = useRef(mapLandmarks);
  const fragmentRotationAnimatingRef = useRef(new Set());

  const [placements, setPlacements] = useState(() => {
    const saved = initialSession?.placements;

    return Array.isArray(saved)
      ? saved.filter(
          (entry) =>
            defaultFragmentOrder.includes(entry?.id) &&
            Number.isInteger(entry.row) &&
            Number.isInteger(entry.col) &&
            Number.isInteger(entry.rotation)
        )
      : [];
  });
  const placementsRef = useRef(placements);
  const [armedLandmarkId, setArmedLandmarkId] = useState(null);
  const [history, setHistory] = useState(initialSession?.history || []);
  const [isSolved, setIsSolved] = useState(initialSession?.isSolved || false);

  const [isSubmitted, setIsSubmitted] = useState(
    initialSession?.isSubmitted || false
  );

  const [checkMessage, setCheckMessage] = useState(
    initialSession?.checkMessage || ''
  );

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDailyExpired, setIsDailyExpired] = useState(false);

  const [showResults, setShowResults] = useState(
    initialSession?.showResults || false
  );

  const [hasClosedResults, setHasClosedResults] = useState(
    initialSession?.hasClosedResults || false
  );

  const [submittedMap, setSubmittedMap] = useState(
    initialSession?.submittedMap || null
  );
  const [submittedLandmarks, setSubmittedLandmarks] = useState(
    initialSession?.submittedLandmarks || null
  );

  const [autoFillCorrectCount, setAutoFillCorrectCount] = useState(
    initialSession?.autoFillCorrectCount ?? 25
  );

  const [hasSavedResult, setHasSavedResult] = useState(
    initialSession?.hasSavedResult || false
  );

  const [streakLost, setStreakLost] = useState(
    initialSession?.streakLost || 0
  );
  const [resultHighlights, setResultHighlights] = useState(
    initialSession?.resultHighlights || null
  );
  const hintLandmarks = useMemo(
    () => testLandmarks.filter((landmark) => landmark.hintFragmentId).slice(0, 3),
    [testLandmarks]
  );
  const [revealedHintLandmarkIds, setRevealedHintLandmarkIds] = useState(() => {
    const saved = initialSession?.revealedHintLandmarkIds;

    return Array.isArray(saved)
      ? saved.filter((id) => hintLandmarks.some((landmark) => landmark.id === id))
      : [];
  });
  const visibleTestLandmarks = useMemo(
    () => testLandmarks.flatMap((landmark) => {
      if (
        !landmark.hintFragmentId ||
        !revealedHintLandmarkIds.includes(landmark.id)
      ) {
        return [landmark];
      }

      return [
        landmark,
        {
          ...landmark,
          fragmentId: landmark.hintFragmentId,
        },
      ];
    }),
    [revealedHintLandmarkIds, testLandmarks]
  );

  const [startedAt] = useState(() => initialSession?.startedAt || Date.now());

  const [elapsedSeconds, setElapsedSeconds] = useState(
    initialSession?.elapsedSeconds || 0
  );

  const [isTimerRunning, setIsTimerRunning] = useState(
    initialSession?.isTimerRunning ?? true
  );

  const isLocked = isSolved || isSubmitted;

  useEffect(() => {
    if (isLocked) setActiveFragmentId(null);
  }, [isLocked]);

  useEffect(() => {
    if (!isPlacementDragging) return undefined;

    const handleMove = (event) => {
      const drag = placementDragRef.current;
      const metrics = getGridMetrics(mapGridRef.current);

      if (!drag || drag.pointerId !== event.pointerId || !metrics) return;

      setPlacement({
        row: Math.round(
          (event.clientY - metrics.top) / metrics.stepY - drag.grabRow
        ),
        col: Math.round(
          (event.clientX - metrics.left) / metrics.stepX - drag.grabCol
        ),
      });
    };

    const handleEnd = (event) => {
      if (placementDragRef.current?.pointerId !== event.pointerId) return;

      placementDragRef.current = null;
      setIsPlacementDragging(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [isPlacementDragging]);

  const orderedFragmentItems = useMemo(() => {
    const fragmentMap = new Map(fragmentItems.map((item) => [item.id, item]));

    return fragmentOrder
      .map((id) => fragmentMap.get(id))
      .filter(Boolean);
  }, [fragmentItems, fragmentOrder]);

  const draggedFragment = useMemo(() => {
    if (!fragmentDrag) {
      return null;
    }

    return fragmentItems.find((item) => item.id === fragmentDrag.id) || null;
  }, [fragmentDrag, fragmentItems]);

  const activeFragment = useMemo(
    () => fragmentItems.find((item) => item.id === activeFragmentId) || null,
    [activeFragmentId, fragmentItems]
  );
  const activeRotation = activeFragment
    ? fragmentRotations[activeFragment.id] || 0
    : 0;
  const activeMatrix = useMemo(
    () =>
      activeFragment
        ? buildFragmentCellMatrix(
            activeFragment,
            answer,
            visibleTestLandmarks,
            activeRotation
          )
        : null,
    [activeFragment, answer, visibleTestLandmarks, activeRotation]
  );
  const activePlacedEntry =
    placements.find((entry) => entry.id === activeFragmentId) || null;
  const displayCells = useMemo(
    () =>
      activePlacedEntry
        ? paintPlacements(
            placements.filter((entry) => entry.id !== activeFragmentId),
            fragmentItems,
            answer
          )
        : mapCells,
    [
      activePlacedEntry,
      activeFragmentId,
      placements,
      fragmentItems,
      answer,
      mapCells,
    ]
  );
  const activePlacement = useMemo(
    () =>
      activeMatrix
    ? {
        row: Math.max(
          0,
          Math.min(placement.row, GRID_SIZE - activeMatrix.length)
        ),
        col: Math.max(
          0,
          Math.min(placement.col, GRID_SIZE - activeMatrix[0].length)
        ),
      }
    : null,
    [activeMatrix, placement]
  );

  const conflictCells = useMemo(() => {
    const colorsByCell = Array.from({ length: TOTAL_CELLS }, () => new Set());

    placements
      .filter((entry) => entry.id !== activeFragmentId)
      .forEach((entry) => {
        const item = fragmentItems.find((fragment) => fragment.id === entry.id);

        if (!item) return;

        buildFragmentCellMatrix(item, answer, [], entry.rotation).forEach(
          (row, rowIndex) => {
            row.forEach((cell, colIndex) => {
              if (!cell.color) return;

              colorsByCell[
                (entry.row + rowIndex) * GRID_SIZE + entry.col + colIndex
              ].add(cell.color);
            });
          }
        );
      });

    return new Set(
      colorsByCell.flatMap((colors, index) => (colors.size > 1 ? [index] : []))
    );
  }, [placements, activeFragmentId, fragmentItems, answer]);

  // Squares of the active fragment that sit on a different colour.
  const overlayConflicts = useMemo(() => {
    const conflicts = new Set();

    if (!activeMatrix || !activePlacement) return conflicts;

    activeMatrix.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell.color) return;

        const index =
          (activePlacement.row + rowIndex) * GRID_SIZE +
          activePlacement.col +
          colIndex;

        if (displayCells[index] && displayCells[index] !== cell.color) {
          conflicts.add(index);
        }
      });
    });

    return conflicts;
  }, [activeMatrix, activePlacement, displayCells]);

  useEffect(() => {
    mapCellsRef.current = mapCells;
  }, [mapCells]);

  useEffect(() => {
    mapLandmarksRef.current = mapLandmarks;
  }, [mapLandmarks]);

  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  useEffect(() => {
    if (!isTimerRunning || !startedAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isTimerRunning, startedAt]);

  useEffect(() => {
    if (!isDailyMode) {
      return undefined;
    }

    const checkDate = () => {
      if (getLocalDateKey() !== todayDateKey) {
        setIsDailyExpired(true);
        setIsTimerRunning(false);
        setShowSubmitConfirm(false);
        setShowClearConfirm(false);
      }
    };

    const interval = window.setInterval(checkDate, 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkDate();
    };

    window.addEventListener('focus', checkDate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkDate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isDailyMode, todayDateKey]);

  useEffect(() => {
    savePlaySession({
      gameMode,
      gameplayRuleset: gameplayRules.id,
      dailySessionVersion: isDailyMode
        ? ACTIVE_DAILY_SESSION_VERSION
        : null,
      dateKey: isDailyMode ? todayDateKey : null,
      puzzle,
      fragmentOrder,
      fragmentRotations,
      usedFragments,
      mapCells,
      placements,
      mapLandmarks,
      history,
      isSolved,
      isSubmitted,
      checkMessage,
      showResults,
      hasClosedResults,
      submittedMap,
      submittedLandmarks,
      autoFillCorrectCount,
      hasSavedResult,
      streakLost,
      resultHighlights,
      revealedHintLandmarkIds,
      startedAt,
      elapsedSeconds,
      isTimerRunning,
    });
  }, [
    gameMode,
    gameplayRules.id,
    isDailyMode,
    todayDateKey,
    puzzle,
    fragmentOrder,
    fragmentRotations,
    usedFragments,
    mapCells,
    placements,
    mapLandmarks,
    history,
    isSolved,
    isSubmitted,
    checkMessage,
    showResults,
    hasClosedResults,
    submittedMap,
    submittedLandmarks,
    autoFillCorrectCount,
    hasSavedResult,
    streakLost,
    resultHighlights,
    revealedHintLandmarkIds,
    startedAt,
    elapsedSeconds,
    isTimerRunning,
  ]);

  const toggleUsedFragment = (fragmentId) => {
    if (isLocked) {
      return;
    }

    setUsedFragments((current) => {
      if (current.includes(fragmentId)) {
        return current.filter((id) => id !== fragmentId);
      }

      return [...current, fragmentId];
    });
  };

  const rotateFragmentClockwise = async (fragmentId) => {
    if (
      !gameplayRules.fragmentRotation ||
      isLocked ||
      fragmentRotationAnimatingRef.current.has(fragmentId)
    ) return;

    fragmentRotationAnimatingRef.current.add(fragmentId);
    const fragmentCard = [...document.querySelectorAll('[data-fragment-id]')]
      .find((element) => element.dataset.fragmentId === String(fragmentId));
    const fragmentShape = fragmentCard?.querySelector('.fragment-shape');
    const northMarker = fragmentCard?.querySelector(
      '.fragment-card__north-marker'
    );

    const [removeFragmentOverlay, removeNorthOverlay] = await Promise.all([
      animateRotationOverlay(fragmentShape ? [fragmentShape] : []),
      animateRotationOverlay(northMarker ? [northMarker] : []),
    ]);
    flushSync(() => {
      setFragmentRotations((current) => ({
        ...current,
        [fragmentId]: ((current[fragmentId] || 0) + 1) % 4,
      }));
    });
    removeFragmentOverlay();
    removeNorthOverlay();
    fragmentRotationAnimatingRef.current.delete(fragmentId);
  };

  const handleRevealHint = () => {
    if (!gameplayRules.hints || isLocked) return;

    const nextHint = hintLandmarks.find(
      (landmark) => !revealedHintLandmarkIds.includes(landmark.id)
    );

    if (!nextHint) return;

    setRevealedHintLandmarkIds((current) => [...current, nextHint.id]);
    setCheckMessage('');
  };

  const pushHistory = () => {
    const snapshot = {
      mapCells: [...mapCellsRef.current],
      mapLandmarks: [...mapLandmarksRef.current],
      placements: placementsRef.current.map((entry) => ({ ...entry })),
    };

    setHistory((prev) => {
      const last = prev[prev.length - 1];

      const lastMap = Array.isArray(last) ? last : last?.mapCells;
      const lastLandmarks = Array.isArray(last)
        ? Array(TOTAL_CELLS).fill(null)
        : last?.mapLandmarks;

      if (
        last &&
        boardsMatch(lastMap, snapshot.mapCells) &&
        boardsMatch(lastLandmarks, snapshot.mapLandmarks)
      ) {
        return prev;
      }

      return [...prev.slice(-19), snapshot];
    });
  };

  const handleUndo = () => {
    if (isLocked || history.length === 0) {
      return;
    }

    const previous = history[history.length - 1];
    const previousMap = Array.isArray(previous)
      ? previous
      : previous.mapCells;
    const previousLandmarks = Array.isArray(previous)
      ? Array(TOTAL_CELLS).fill(null)
      : previous.mapLandmarks;

    setMapCells(previousMap);
    setPlacements(Array.isArray(previous) ? [] : previous.placements || []);
    setActiveFragmentId(null);
    setMapLandmarks(previousLandmarks || Array(TOTAL_CELLS).fill(null));
    setHistory((prev) => prev.slice(0, -1));
    setCheckMessage('');
    setSubmittedMap(null);
    setSubmittedLandmarks(null);
    setShowResults(false);
    setHasClosedResults(false);
  };

  const handleFragmentDragStart = (event, item) => {
    if (isLocked) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    setFragmentDrag({
      id: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    });

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleFragmentDragMove = (event) => {
    setFragmentDrag((current) => {
      if (!current || current.pointerId !== event.pointerId) {
        return current;
      }

      return {
        ...current,
        x: event.clientX,
        y: event.clientY,
      };
    });
  };

  const handleFragmentDragEnd = (event) => {
    if (!fragmentDrag || fragmentDrag.pointerId !== event.pointerId) {
      return;
    }

    const isClick =
      Math.hypot(
        event.clientX - fragmentDrag.startX,
        event.clientY - fragmentDrag.startY
      ) < 8;

    if (isClick) {
      handleActivateFragment(fragmentDrag.id);
      setFragmentDrag(null);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-fragment-id]');

    if (target) {
      const targetId = target.getAttribute('data-fragment-id');

      if (targetId && targetId !== fragmentDrag.id) {
        setFragmentOrder((current) => {
          const fromIndex = current.indexOf(fragmentDrag.id);
          const toIndex = current.indexOf(targetId);

          if (fromIndex === -1 || toIndex === -1) {
            return current;
          }

          return swapItems(current, fromIndex, toIndex);
        });
      }
    }

    setFragmentDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCellClick = (index) => {
    if (isLocked) return;

    if (activeFragmentId) {
      const owner = findPlacementAt(placements, index, fragmentItems, answer);

      if (owner && owner.id !== activeFragmentId) {
        handleActivateFragment(owner.id);
      } else {
        handlePlaceActiveFragment();
      }

      return;
    }

    if (armedLandmarkId) {
      pushHistory();
      setMapLandmarks((current) =>
        current.map((value, cellIndex) => {
          if (cellIndex === index) return armedLandmarkId;
          return value === armedLandmarkId ? null : value;
        })
      );
      setArmedLandmarkId(null);
      setCheckMessage('');
      return;
    }

    const owner = findPlacementAt(placements, index, fragmentItems, answer);

    if (owner) handleActivateFragment(owner.id);
  };

  const handleActivateFragment = (fragmentId) => {
    if (isLocked) return;

    if (activeFragmentId === fragmentId) {
      handlePlaceActiveFragment();
      return;
    }

    const item = fragmentItems.find((entry) => entry.id === fragmentId);

    if (!item) return;

    if (activeFragmentId) handlePlaceActiveFragment();
    setArmedLandmarkId(null);

    const existing = placements.find((entry) => entry.id === fragmentId);

    if (existing) {
      setFragmentRotations((current) => ({
        ...current,
        [fragmentId]: existing.rotation,
      }));
      setPlacement({ row: existing.row, col: existing.col });
    } else {
      const matrix = buildFragmentCellMatrix(
        item,
        answer,
        [],
        fragmentRotations[fragmentId] || 0
      );

      setPlacement({
        row: Math.floor((GRID_SIZE - matrix.length) / 2),
        col: Math.floor((GRID_SIZE - matrix[0].length) / 2),
      });
    }

    setActiveFragmentId(fragmentId);
  };

  const rotateActiveFragment = (steps = 1) => {
    if (!activeFragmentId || isLocked) return;

    setFragmentRotations((current) => ({
      ...current,
      [activeFragmentId]: ((current[activeFragmentId] || 0) + steps) % 4,
    }));
  };

  const rotateActiveRef = useRef(rotateActiveFragment);

  useEffect(() => {
    rotateActiveRef.current = rotateActiveFragment;
  });

  // Two-finger twist on the map rotates the active fragment in 90° steps.
  useEffect(() => {
    if (!activeFragmentId) return undefined;

    const touches = new Map();
    let lastAngle = null;

    const currentAngle = () => {
      const [first, second] = [...touches.values()];

      return (
        (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI
      );
    };

    const handleDown = (event) => {
      if (
        event.pointerType !== 'touch' ||
        !(event.target instanceof Element) ||
        !event.target.closest('.map-board')
      ) {
        return;
      }

      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (touches.size === 2) {
        lastAngle = currentAngle();
        placementDragRef.current = null;
        setIsPlacementDragging(false);
      }
    };

    const handleMove = (event) => {
      if (!touches.has(event.pointerId)) return;

      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (touches.size !== 2 || lastAngle === null) return;

      const angle = currentAngle();
      const delta = ((angle - lastAngle + 540) % 360) - 180;

      if (Math.abs(delta) >= 45) {
        rotateActiveRef.current(delta > 0 ? 1 : 3);
        lastAngle = angle;
      }
    };

    const handleUp = (event) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) lastAngle = null;
    };

    window.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [activeFragmentId]);

  const handlePlacementPointerDown = (event) => {
    const metrics = getGridMetrics(mapGridRef.current);

    if (!activePlacement || !metrics || isLocked) return;

    event.preventDefault();
    placementDragRef.current = {
      pointerId: event.pointerId,
      grabRow:
        (event.clientY - metrics.top) / metrics.stepY - activePlacement.row,
      grabCol:
        (event.clientX - metrics.left) / metrics.stepX - activePlacement.col,
    };
    setIsPlacementDragging(true);
  };

  const handlePlaceActiveFragment = () => {
    if (!activeFragment || !activePlacement || isLocked) return;

    if (
      activePlacedEntry &&
      activePlacedEntry.row === activePlacement.row &&
      activePlacedEntry.col === activePlacement.col &&
      activePlacedEntry.rotation === activeRotation
    ) {
      setActiveFragmentId(null);
      return;
    }

    const next = [
      ...placements.filter((entry) => entry.id !== activeFragment.id),
      {
        id: activeFragment.id,
        row: activePlacement.row,
        col: activePlacement.col,
        rotation: activeRotation,
      },
    ];

    pushHistory();
    setPlacements(next);
    setMapCells(paintPlacements(next, fragmentItems, answer));
    setUsedFragments((current) =>
      current.includes(activeFragment.id)
        ? current
        : [...current, activeFragment.id]
    );
    setActiveFragmentId(null);
    setCheckMessage('');
  };

  const handleRemoveActive = () => {
    if (!activeFragment || isLocked) return;

    if (!activePlacedEntry) {
      setActiveFragmentId(null);
      return;
    }

    const next = placements.filter((entry) => entry.id !== activeFragmentId);

    pushHistory();
    setPlacements(next);
    setMapCells(paintPlacements(next, fragmentItems, answer));
    setUsedFragments((current) =>
      current.filter((id) => id !== activeFragmentId)
    );
    setActiveFragmentId(null);
    setCheckMessage('');
  };

  const clearMap = () => {
    if (isLocked) {
      return;
    }

    pushHistory();

    setMapCells(Array(TOTAL_CELLS).fill(null));
    setPlacements([]);
    setActiveFragmentId(null);
    setMapLandmarks(Array(TOTAL_CELLS).fill(null));
    setUsedFragments([]);
    setCheckMessage('');
    setSubmittedMap(null);
    setSubmittedLandmarks(null);
    setShowResults(false);
    setHasClosedResults(false);
    setShowClearConfirm(false);
  };

  const handleClearRequest = () => {
    if (filledTiles > 0) {
      setShowClearConfirm(true);
      return;
    }

    clearMap();
  };

  const handleAutoFill = () => {
    if (isLocked) {
      return;
    }

    const targetCorrect = clampNumber(
      Number(autoFillCorrectCount) || 0,
      0,
      TOTAL_CELLS
    );

    const allIndices = Array.from({ length: TOTAL_CELLS }, (_, index) => index);
    const shuffledIndices = shuffleRuntime(allIndices);
    const correctIndexSet = new Set(shuffledIndices.slice(0, targetCorrect));

    const filledMap = answer.map((correctColor, index) => {
      if (correctIndexSet.has(index)) {
        return correctColor;
      }

      const wrongOptions = palette.filter((color) => color !== correctColor);

      return wrongOptions.length ? wrongOptions[0] : correctColor;
    });

    pushHistory();

    setMapCells(filledMap);
    setPlacements([]);
    setActiveFragmentId(null);
    setMapLandmarks(Array(TOTAL_CELLS).fill(null));
    setUsedFragments([]);
    setCheckMessage(`Autofilled ${targetCorrect}/${TOTAL_CELLS} correct.`);
    setSubmittedMap(null);
    setShowResults(false);
    setHasClosedResults(false);
  };

  const commitActiveRef = useRef(handlePlaceActiveFragment);

  useEffect(() => {
    commitActiveRef.current = handlePlaceActiveFragment;
  });

  useEffect(() => {
    if (!activeFragmentId) return undefined;

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element)) return;

      if (
        event.target.closest(
          '.map-placement, .map-grid, .fragment-card, .landmark-picker__rotate, .landmark-picker__remove'
        )
      ) {
        return;
      }

      commitActiveRef.current();
    };

    document.addEventListener('click', handleOutsideClick);

    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeFragmentId]);

  const handleOpenSubmit = () => {
    if (isLocked) {
      return;
    }

    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirm(false);

    const isComplete = mapCells.every((cell) => cell !== null);

    if (!isComplete) {
      setCheckMessage('Complete all 25 squares before submitting.');
      return;
    }

    const areTestLandmarksPlaced = testLandmarks.every((landmark) =>
      mapLandmarks.includes(landmark.id)
    );

    if (usesMapFeatures && !areTestLandmarksPlaced) {
      setCheckMessage('Place all map symbols before submitting.');
      return;
    }

    if (isDailyMode && getLocalDateKey() !== todayDateKey) {
      setIsDailyExpired(true);
      setIsTimerRunning(false);
      return;
    }

    if (submissionInProgressRef.current || isLocked) {
      return;
    }

    submissionInProgressRef.current = true;

    const finalTimeSeconds = Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000)
    );
    const areTilesCorrect = mapCells.every(
      (cell, index) => cell === answer[index]
    );
    const areLandmarksCorrect = testLandmarks.every(
      (landmark) => mapLandmarks[landmark.answerIndex] === landmark.id
    );
    const isCorrect = areTilesCorrect &&
      (!usesMapFeatures || areLandmarksCorrect);
    const correctTilesForSubmit = mapCells.filter(
      (cell, index) => cell === answer[index]
    ).length;

    const frozenSubmittedMap = [...mapCells];
    const frozenSubmittedLandmarks = [...mapLandmarks];

    if (isDailyMode && !hasSavedResult) {
      const existingStats = loadStats();
      const computedExistingStats = getComputedStats(existingStats);
      const previousStreak = computedExistingStats.currentStreak;

      const updatedStats = updateStatsAfterGame(existingStats, {
        isWin: isCorrect,
        correctTiles: correctTilesForSubmit,
        totalTiles: TOTAL_CELLS,
        timeSeconds: finalTimeSeconds,
        hintsUsed: revealedHintLandmarkIds.length,
        dateKey: todayDateKey,
      });

      saveStats(updatedStats);
      setHasSavedResult(true);
      setStreakLost(isCorrect ? 0 : previousStreak);

      const timeVsAverageSeconds = computedExistingStats.gamesWithTime > 0
        ? finalTimeSeconds - computedExistingStats.averageGameTimeSeconds
        : null;
      const timeVsAverageLabel = timeVsAverageSeconds === null
        ? '--:--'
        : timeVsAverageSeconds === 0
          ? '0:00'
          : `${timeVsAverageSeconds < 0 ? '−' : '+'}${formatElapsedTime(
              Math.abs(timeVsAverageSeconds)
            )}`;

      setResultHighlights({
        streakBefore: previousStreak,
        streakAfter: updatedStats.currentStreak,
        timeVsAverageSeconds,
        timeVsAverageLabel,
        isNewBestTime:
          isCorrect &&
          (computedExistingStats.bestTimeSeconds === null ||
            finalTimeSeconds < computedExistingStats.bestTimeSeconds),
        isNewBestStreak: updatedStats.maxStreak > computedExistingStats.maxStreak,
      });
    }

    setSubmittedMap(frozenSubmittedMap);
    setSubmittedLandmarks(frozenSubmittedLandmarks);
    setShowResults(true);
    setHasClosedResults(false);
    setElapsedSeconds(finalTimeSeconds);
    setIsTimerRunning(false);

    if (isCorrect) {
      setIsSolved(true);
      setCheckMessage('Map completed.');
    } else {
      setIsSubmitted(true);
      setCheckMessage('Map incorrect.');
    }
  };

  const handleStartNewDaily = () => {
    clearPlaySession('daily');
    localStorage.setItem(SELECTED_GAME_MODE_STORAGE_KEY, 'daily');
    localStorage.setItem(
      SELECTED_PUZZLE_STORAGE_KEY,
      JSON.stringify(getDailyPuzzle())
    );
    window.location.reload();
  };

  const handleCloseResults = () => {
    setShowResults(false);

    if (isSolved || isSubmitted) {
      setHasClosedResults(true);
      setCheckMessage('');
    }
  };

  const resultMap = submittedMap || mapCells;
  const resultLandmarks = submittedLandmarks || mapLandmarks;
  const correctTiles = resultMap.filter(
    (cell, index) => cell === answer[index]
  ).length;

  const correctPercent = Math.round((correctTiles / TOTAL_CELLS) * 100);
  const correctLandmarks = testLandmarks.filter(
    (landmark) => resultLandmarks[landmark.answerIndex] === landmark.id
  ).length;
  const remainingHints = Math.max(
    0,
    hintLandmarks.length - revealedHintLandmarkIds.length
  );
  const lastRevealedHint = hintLandmarks.find(
    (landmark) =>
      landmark.id ===
      revealedHintLandmarkIds[revealedHintLandmarkIds.length - 1]
  );
  const timerLabel = formatElapsedTime(elapsedSeconds);
  const filledTiles = mapCells.filter((cell) => cell !== null).length;
  const storedStats = getComputedStats(loadStats());

  const overviewStats = {
  played: storedStats.played,
  streak: storedStats.streak,
  currentStreak: storedStats.currentStreak,
  winPercentage: storedStats.winPercentage,
  averageTilePercentage: storedStats.averageTilePercentage,
  maxStreak: storedStats.maxStreak,
  averageGameTimeSeconds: storedStats.averageGameTimeSeconds,
  averageGameTimeFormatted:
    storedStats.gamesWithTime > 0
      ? formatElapsedTime(storedStats.averageGameTimeSeconds)
      : '--:--',

  currentStreakGames: storedStats.currentStreakGames,
  currentStreakAverageTimeSeconds:
    storedStats.currentStreakAverageTimeSeconds,
  currentStreakAverageTimeFormatted:
    storedStats.currentStreakGames > 0
      ? formatElapsedTime(storedStats.currentStreakAverageTimeSeconds)
      : '--:--',
  currentStreakBestTimeSeconds:
    storedStats.currentStreakBestTimeSeconds,
  currentStreakBestTimeFormatted:
    storedStats.currentStreakBestTimeSeconds
      ? formatElapsedTime(storedStats.currentStreakBestTimeSeconds)
      : '--:--',
};

  const currentStreak =
  overviewStats.currentStreak ?? overviewStats.streak ?? 0;

const streakAverageTime =
  overviewStats.currentStreakGames > 0
    ? overviewStats.currentStreakAverageTimeFormatted
    : '--:--';

  const todayShareText = isSolved
  ? getWinShareText({
      time: timerLabel,
      streak: currentStreak,
      averageTime: streakAverageTime,
    })
  : getFailShareText({
      correctTiles,
      totalTiles: TOTAL_CELLS,
      streakLost,
      averageTime: streakAverageTime,
    });

  return (
    <div className="page page--play">
      <div className="page__inner">
        <main className="play-shell play-shell--game">
          <header className="play-header">
            <p className="eyebrow">
              {isDailyMode ? 'Daily Puzzle' : 'Random Puzzle'}
            </p>

            <h1 className="play-title">
              {isDailyMode ? 'Today’s TOPO' : 'Test Topo'}
            </h1>
          </header>

          <div
            className={`play-surface play-surface--game ${
              activeFragment ? 'play-surface--placing' : ''
            }`}
          >
            {isDailyExpired && (
              <div className="confirm-overlay">
                <div className="confirm-modal">
                  <h3>Time’s up</h3>
                  <p>A new daily TOPO is available.</p>
                  <div className="confirm-actions">
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={handleStartNewDaily}
                    >
                      Play today’s TOPO
                    </button>
                  </div>
                </div>
              </div>
            )}
            {hasClosedResults && (isSolved || isSubmitted) && (
              <div className="completed-card">
                <p className="completed-card__eyebrow">
                  {isDailyMode ? 'Daily Topo' : 'Random Test Topo'}
                </p>

                <h3 className="completed-card__title">
                  {isDailyMode
                    ? 'You finished today’s map'
                    : 'You finished this test map'}
                </h3>

                <p className="completed-card__text">
                  Completed in {timerLabel}
                </p>

                <div className="completed-card__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => navigate('/')}
                  >
                    Home
                  </button>

                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setShowResults(true)}
                  >
                    Results
                  </button>

                  <ShareButton shareText={todayShareText}>
                    Share
                  </ShareButton>
                </div>

              </div>
            )}

            {!hasClosedResults && !(isSolved || isSubmitted) && (
              <div className="game-status-row">
                <div className="game-status-pill game-status-pill--time">
                  <span className="game-status-pill__label">Time</span>

                  <strong className="game-status-pill__value">
                    {timerLabel}
                  </strong>
                </div>

                <div className="game-status-pill">
                  <span className="game-status-pill__label">Filled</span>

                  <strong className="game-status-pill__value">
                    {filledTiles}/{TOTAL_CELLS}
                  </strong>
                </div>

              </div>
            )}

            <div className="game-actions">
              <button
                type="button"
                className={`button button--secondary button--small ${
                  history.length === 0 || isLocked ? 'is-disabled' : ''
                }`}
                disabled={history.length === 0 || isLocked}
                onClick={handleUndo}
              >
                Undo
              </button>

              <button
                type="button"
                className={`button button--secondary button--small ${
                  !activeFragment || isLocked ? 'is-disabled' : ''
                }`}
                disabled={!activeFragment || isLocked}
                onClick={handleRemoveActive}
              >
                Erase
              </button>

              <button
                type="button"
                className={`button button--secondary button--small ${
                  isLocked ? 'is-disabled' : ''
                }`}
                disabled={isLocked}
                onClick={handleClearRequest}
              >
                Clear
              </button>

              {!isLocked && (
                <button
                  type="button"
                  className="button button--primary button--small"
                  onClick={handleOpenSubmit}
                >
                  Submit
                </button>
              )}
            </div>

            {ENABLE_TEST_FEATURES && !isLocked && !isDailyMode && (
              <div className="dev-tools-inline">
                <input
                  type="number"
                  min="0"
                  max={TOTAL_CELLS}
                  value={autoFillCorrectCount}
                  onChange={(event) =>
                    setAutoFillCorrectCount(event.target.value)
                  }
                  aria-label="Autofill correct tile count"
                />

                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={handleAutoFill}
                >
                  Auto fill
                </button>
              </div>
            )}

            {usesMapFeatures && testLandmarks.length > 0 && (
              <div className="landmark-picker">
                <span className="landmark-picker__label">Map symbols</span>
                <div className="landmark-picker__controls">
                  <div className="landmark-palette" aria-label="Map symbols">
                    {testLandmarks.map((landmark) => {
                      const isPlaced = mapLandmarks.includes(landmark.id);

                      return (
                        <button
                          key={landmark.id}
                          type="button"
                          className={`landmark-palette__item ${
                            isPlaced ? 'is-placed' : ''
                          } ${armedLandmarkId === landmark.id ? 'is-armed' : ''}`}
                          disabled={isLocked || Boolean(activeFragment)}
                          aria-label={`${landmark.label}${
                            isPlaced ? ', placed' : ''
                          }`}
                          onClick={() =>
                            setArmedLandmarkId((current) =>
                              current === landmark.id ? null : landmark.id
                            )
                          }
                        >
                          <span
                            className="material-symbols-outlined topo-landmark-icon"
                            aria-hidden="true"
                          >
                            {landmark.icon}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <span className="landmark-picker__divider" aria-hidden="true" />

                  <button
                    type="button"
                    className="landmark-palette__item landmark-picker__rotate"
                    disabled={isLocked || !activeFragment}
                    onClick={() => rotateActiveFragment(1)}
                    aria-label="Rotate active fragment 90 degrees clockwise"
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      rotate_right
                    </span>
                  </button>

                  <button
                    type="button"
                    className="landmark-palette__item landmark-picker__remove"
                    disabled={isLocked || !activeFragment}
                    onClick={handleRemoveActive}
                    aria-label="Remove active fragment from grid"
                    title="Remove from grid"
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      delete
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className={`board-layout ${
              usesMapFeatures ? 'board-layout--test' : ''
            }`}>
            <div className="map-board">
            <div ref={mapGridRef} className="map-grid">
              {displayCells.map((cellColor, index) => (
                <button
                  key={index}
                  data-cell-index={index}
                  type="button"
                  className={`map-grid__cell ${isLocked ? 'is-solved' : ''} ${
                    conflictCells.has(index) ? 'is-conflict' : ''
                  }`}
                  style={{
                    backgroundColor: cellColor || 'rgb(142, 142, 128)',
                  }}
                  onClick={() => handleCellClick(index)}
                  aria-label={`Map cell ${index + 1}`}
                >
                  {usesMapFeatures && mapLandmarks[index] && (() => {
                    const landmark = testLandmarks.find(
                      (item) => item.id === mapLandmarks[index]
                    );

                    return landmark ? (
                      <span
                        className="material-symbols-outlined topo-landmark-icon topo-landmark-icon--map"
                        style={{
                          color: getContrastingIconColor(cellColor),
                        }}
                        aria-hidden="true"
                      >
                        {landmark.icon}
                      </span>
                    ) : null;
                  })()}
                </button>
              ))}
            </div>

            {activeMatrix && activePlacement && (
              <div className="map-placement" aria-label="Active fragment">
                {Array.from({ length: TOTAL_CELLS }).map((_, index) => {
                  const cell =
                    activeMatrix[
                      Math.floor(index / GRID_SIZE) - activePlacement.row
                    ]?.[(index % GRID_SIZE) - activePlacement.col];
                  const isFilled = Boolean(cell?.color);

                  return (
                    <span
                      key={index}
                      className={`map-placement__cell ${
                        isFilled ? 'is-filled' : ''
                      } ${overlayConflicts.has(index) ? 'is-conflict' : ''}`}
                      style={
                        isFilled ? { backgroundColor: cell.color } : undefined
                      }
                      onPointerDown={
                        isFilled ? handlePlacementPointerDown : undefined
                      }
                    >
                    </span>
                  );
                })}
              </div>
            )}
            </div>

            </div>

            {activeFragment && (
              <div className="placement-bar">
                <span className="placement-bar__hint">
                  Drag to move. Click elsewhere to deselect.
                </span>

              </div>
            )}

            <div className="game-fragments">
              <div className="fragment-panel">
                <div className="fragment-grid">
                  {orderedFragmentItems.map((item) => {
                    const isDragging = fragmentDrag?.id === item.id;
                    const isUsed = usedFragments.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`fragment-card ${
                          isDragging ? 'is-dragging' : ''
                        } ${isUsed ? 'is-used' : ''} ${
                          activeFragmentId === item.id ? 'is-active' : ''
                        }`}
                        data-fragment-id={item.id}
                        onPointerDown={(event) =>
                          handleFragmentDragStart(event, item)
                        }
                        onPointerMove={handleFragmentDragMove}
                        onPointerUp={handleFragmentDragEnd}
                        onPointerCancel={handleFragmentDragEnd}
                      >
                        {item.id === northFragmentId && (
                          <span
                            className="fragment-card__north-marker"
                            style={{
                              transform: `rotate(${(fragmentRotations[item.id] || 0) * 90}deg)`,
                            }}
                            aria-label="North orientation"
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              navigation
                            </span>
                          </span>
                        )}

                        <button
                          type="button"
                          className={`fragment-card__used-toggle ${
                            isUsed ? 'is-active' : ''
                          }`}
                          disabled={isLocked}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onPointerMove={(event) => {
                            event.stopPropagation();
                          }}
                          onPointerUp={(event) => {
                            event.stopPropagation();
                          }}
                          onPointerCancel={(event) => {
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleUsedFragment(item.id);
                          }}
                          aria-pressed={isUsed}
                          aria-label={
                            isUsed
                              ? 'Mark fragment as unused'
                              : 'Mark fragment as used'
                          }
                        >
                          ✓
                        </button>

                        {gameplayRules.fragmentRotation && (
                          <button
                            type="button"
                            className="fragment-card__rotate-toggle"
                            disabled={isLocked}
                            onPointerDown={(event) => event.stopPropagation()}
                            onPointerMove={(event) => event.stopPropagation()}
                            onPointerUp={(event) => event.stopPropagation()}
                            onPointerCancel={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              rotateFragmentClockwise(item.id);
                            }}
                            aria-label="Rotate fragment 90 degrees clockwise"
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              rotate_right
                            </span>
                          </button>
                        )}

                        <div className="fragment-card__preview">
                          <FragmentShape
                            fragment={item}
                            answer={answer}
                            className="fragment-shape"
                            landmarks={visibleTestLandmarks}
                            rotation={fragmentRotations[item.id] || 0}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {gameplayRules.hints && (
              <div className="fragment-hint-actions">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  disabled={isLocked || remainingHints === 0}
                onClick={handleRevealHint}
              >
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                  >
                    {revealedHintLandmarkIds.length > 0
                      ? 'lightbulb'
                      : 'lightbulb_outline'}
                  </span>
                  Hint {revealedHintLandmarkIds.length}/3
                </button>
                {lastRevealedHint && (
                  <span className="fragment-hint-actions__text">
                    {lastRevealedHint.label} overlap revealed
                  </span>
                )}
              </div>
            )}

            {fragmentDrag && draggedFragment && (
              <div
                className="fragment-drag-ghost"
                style={{
                  width: fragmentDrag.width,
                  height: fragmentDrag.height,
                  transform: `translate3d(${
                    fragmentDrag.x - fragmentDrag.offsetX
                  }px, ${fragmentDrag.y - fragmentDrag.offsetY}px, 0)`,
                }}
              >
                <div className="fragment-card__preview">
                  <FragmentShape
                    fragment={draggedFragment}
                    answer={answer}
                    className="fragment-shape"
                    landmarks={visibleTestLandmarks}
                    rotation={fragmentRotations[draggedFragment.id] || 0}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

      <SubmitConfirmModal
          isOpen={showSubmitConfirm}
          message={
            usesMapFeatures
              ? 'Check all colours and map symbols. You only get one attempt.'
              : 'You only get one attempt.'
          }
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={handleConfirmSubmit}
      />

      <SubmitConfirmModal
        isOpen={showClearConfirm}
        title="Clear your map?"
        message="This removes all placements from the board. The timer will keep running."
        confirmLabel="Clear map"
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={clearMap}
      />

        <ResultsModal
          isOpen={showResults}
          isDailyMode={isDailyMode}
          isSolved={isSolved}
          submittedMap={submittedMap}
          answer={answer}
          correctPercent={correctPercent}
          correctTiles={correctTiles}
          overviewStats={overviewStats}
          elapsedTimeLabel={timerLabel}
          resultHighlights={resultHighlights}
          landmarks={testLandmarks}
          submittedLandmarks={submittedLandmarks}
          correctLandmarks={correctLandmarks}
          hintsUsed={revealedHintLandmarkIds.length}
          onClose={handleCloseResults}
        />

        <BottomNav />
      </div>
    </div>
  );
}

export default Play;
