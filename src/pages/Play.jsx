import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import BottomNav from '../components/layout/BottomNav';
import FragmentShape from '../components/play/FragmentShape';
import SubmitConfirmModal from '../components/play/SubmitConfirmModal';
import ResultsModal from '../components/play/ResultsModal';

import ShareButton from '../components/share/ShareButton';

import {
  getWinShareText,
  getFailShareText,
} from '../utils/share';

import { getDailyPuzzle, getLocalDateKey } from '../data/puzzles';

import {
  GRID_SIZE,
  TOTAL_CELLS,
  indexToRowCol,
  rowColToIndex,
} from '../utils/grid';

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
  const mapRotationSessionRef = useRef(null);
  const mapRotationAnimatingRef = useRef(false);
  const fragmentRotationAnimatingRef = useRef(new Set());

  const [selectedCells, setSelectedCells] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [history, setHistory] = useState(initialSession?.history || []);
  const [isSolved, setIsSolved] = useState(initialSession?.isSolved || false);

  const [isSubmitted, setIsSubmitted] = useState(
    initialSession?.isSubmitted || false
  );

  useEffect(() => {
    const handleOutsideMapClick = (event) => {
      if (!(event.target instanceof Element)) return;

      const keepsSelection = event.target.closest(
        '.map-grid, .palette-row, .landmark-picker'
      );

      if (keepsSelection) return;

      mapRotationSessionRef.current = null;
      setSelectedCells([]);
    };

    document.addEventListener('click', handleOutsideMapClick);

    return () => document.removeEventListener('click', handleOutsideMapClick);
  }, []);

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

  useEffect(() => {
    mapCellsRef.current = mapCells;
  }, [mapCells]);

  useEffect(() => {
    mapLandmarksRef.current = mapLandmarks;
  }, [mapLandmarks]);

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

  const getCellFromPointer = (clientX, clientY) => {
    if (!mapGridRef.current) {
      return null;
    }

    const rect = mapGridRef.current.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return null;
    }

    return {
      row,
      col,
      index: rowColToIndex(row, col),
    };
  };

  const pushHistory = () => {
    const snapshot = {
      mapCells: [...mapCellsRef.current],
      mapLandmarks: [...mapLandmarksRef.current],
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

    mapRotationSessionRef.current = null;
    const previous = history[history.length - 1];
    const previousMap = Array.isArray(previous)
      ? previous
      : previous.mapCells;
    const previousLandmarks = Array.isArray(previous)
      ? Array(TOTAL_CELLS).fill(null)
      : previous.mapLandmarks;

    setMapCells(previousMap);
    setMapLandmarks(previousLandmarks || Array(TOTAL_CELLS).fill(null));
    setHistory((prev) => prev.slice(0, -1));
    setSelectedCells([]);
    setDragState(null);
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
    if (dragState || isLocked) {
      return;
    }

    mapRotationSessionRef.current = null;

    const clickedColor = mapCells[index];
    const isSelected = selectedCells.includes(index);

    setSelectedCells((current) => {
      if (clickedColor === null) return [index];
      if (current.length === 0) return [index];

      if (current.length === 1) {
        const currentIndex = current[0];
        const currentColor = mapCells[currentIndex];

        if (currentIndex === index) return [index];
        if (currentColor === null) return [index];

        return [...current, index];
      }

      if (isSelected) return [index];

      return [...current, index];
    });
  };

  const applyColorToSelectedCells = (color) => {
    if (!selectedCells.length || isLocked) {
      return;
    }

    mapRotationSessionRef.current = null;
    pushHistory();

    setMapCells((current) =>
      current.map((cell, index) =>
        selectedCells.includes(index) ? color : cell
      )
    );
    setSelectedCells([]);
    setCheckMessage('');
  };

  const applyLandmarkToSelectedCell = (landmark) => {
    if (isLocked) return;

    if (selectedCells.length !== 1) {
      setCheckMessage('Select one map square before choosing a symbol.');
      return;
    }

    const targetIndex = selectedCells[0];

    mapRotationSessionRef.current = null;
    pushHistory();
    setMapLandmarks((current) =>
      current.map((value, index) => {
        if (index === targetIndex) return landmark.id;
        return value === landmark.id ? null : value;
      })
    );
    setSelectedCells([]);
    setCheckMessage('');
  };

  const rotateSelectedMapTilesClockwise = async () => {
    if (
      isLocked ||
      selectedCells.length < 2 ||
      mapRotationAnimatingRef.current
    ) return;

    mapRotationAnimatingRef.current = true;

    let session = mapRotationSessionRef.current;

    if (!session) {
      const selected = selectedCells.map((index) => ({
        ...indexToRowCol(index),
        color: mapCells[index],
        landmarkId: mapLandmarks[index],
      }));
      const baseMap = [...mapCells];
      const baseLandmarks = [...mapLandmarks];

      selectedCells.forEach((index) => {
        baseMap[index] = null;
        baseLandmarks[index] = null;
      });

      session = {
        selected,
        originalSelected: selected.map((cell) => ({ ...cell })),
        baseMap,
        baseLandmarks,
        quarterTurns: 0,
      };
      mapRotationSessionRef.current = session;
      pushHistory();
    }

    const selected = session.selected;
    const minRow = Math.min(...selected.map((cell) => cell.row));
    const maxRow = Math.max(...selected.map((cell) => cell.row));
    const minCol = Math.min(...selected.map((cell) => cell.col));
    const maxCol = Math.max(...selected.map((cell) => cell.col));
    const height = maxRow - minRow + 1;
    const width = maxCol - minCol + 1;
    const rotatedMinRow = Math.min(minRow, GRID_SIZE - width);
    const rotatedMinCol = Math.min(minCol, GRID_SIZE - height);
    const nextQuarterTurns = (session.quarterTurns + 1) % 4;
    const rotated =
      nextQuarterTurns === 0
        ? session.originalSelected.map((cell) => ({
            ...cell,
            targetIndex: rowColToIndex(cell.row, cell.col),
          }))
        : selected.map((cell) => ({
            ...cell,
            targetIndex: rowColToIndex(
              rotatedMinRow + (cell.col - minCol),
              rotatedMinCol + (height - 1 - (cell.row - minRow))
            ),
          }));

    session.selected = rotated.map((cell) => ({
      row: indexToRowCol(cell.targetIndex).row,
      col: indexToRowCol(cell.targetIndex).col,
      color: cell.color,
      landmarkId: cell.landmarkId,
    }));
    session.quarterTurns = nextQuarterTurns;

    const selectedElements = selectedCells
      .map((index) =>
        mapGridRef.current?.querySelector(`[data-cell-index="${index}"]`)
      )
      .filter(Boolean);
    const targetRects = rotated
      .map((cell) =>
        mapGridRef.current
          ?.querySelector(`[data-cell-index="${cell.targetIndex}"]`)
          ?.getBoundingClientRect()
      )
      .filter(Boolean);
    const targetCenter = targetRects.length
      ? {
          x:
            (Math.min(...targetRects.map((rect) => rect.left)) +
              Math.max(...targetRects.map((rect) => rect.right))) /
            2,
          y:
            (Math.min(...targetRects.map((rect) => rect.top)) +
              Math.max(...targetRects.map((rect) => rect.bottom))) /
            2,
        }
      : null;
    const removeRotationOverlay = await animateRotationOverlay(
      selectedElements,
      targetCenter,
      { showMapPlaceholders: true }
    );

    flushSync(() => {
      setMapCells(() => {
        const next = [...session.baseMap];

        rotated.forEach((cell) => {
          next[cell.targetIndex] = cell.color;
        });

        return next;
      });
      setMapLandmarks(() => {
        const next = [...session.baseLandmarks];

        rotated.forEach((cell) => {
          next[cell.targetIndex] = cell.landmarkId;
        });

        return next;
      });
      setSelectedCells(rotated.map((cell) => cell.targetIndex));
      setCheckMessage('');
    });
    removeRotationOverlay();
    mapRotationAnimatingRef.current = false;
  };

  const eraseSelectedCells = () => {
    if (!selectedCells.length || isLocked) {
      return;
    }

    mapRotationSessionRef.current = null;
    pushHistory();

    setMapCells((current) =>
      current.map((cell, index) =>
        selectedCells.includes(index) ? null : cell
      )
    );
    setMapLandmarks((current) =>
      current.map((landmark, index) =>
        selectedCells.includes(index) ? null : landmark
      )
    );

    setSelectedCells([]);
    setCheckMessage('');
  };

  const clearMap = () => {
    if (isLocked) {
      return;
    }

    mapRotationSessionRef.current = null;
    pushHistory();

    setMapCells(Array(TOTAL_CELLS).fill(null));
    setMapLandmarks(Array(TOTAL_CELLS).fill(null));
    setSelectedCells([]);
    setUsedFragments([]);
    setDragState(null);
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
    setMapLandmarks(Array(TOTAL_CELLS).fill(null));
    setSelectedCells([]);
    setUsedFragments([]);
    setDragState(null);
    setCheckMessage(`Autofilled ${targetCorrect}/${TOTAL_CELLS} correct.`);
    setSubmittedMap(null);
    setShowResults(false);
    setHasClosedResults(false);
  };

  const canDragSelection =
    !isLocked &&
    selectedCells.length >= 2 &&
    selectedCells.every((index) => mapCells[index] !== null);

  const startGroupDrag = (event, anchorIndex) => {
    if (!canDragSelection || !selectedCells.includes(anchorIndex)) {
      return;
    }

    mapRotationSessionRef.current = null;
    const anchorCell = indexToRowCol(anchorIndex);
    const mapRect = mapGridRef.current.getBoundingClientRect();
    const cellSize = mapRect.width / GRID_SIZE;

    const selectedCoords = selectedCells.map((index) => {
      const cell = indexToRowCol(index);

      return {
        index,
        row: cell.row,
        col: cell.col,
        color: mapCells[index],
        landmarkId: mapLandmarks[index],
      };
    });

    const minRow = Math.min(...selectedCoords.map((cell) => cell.row));
    const minCol = Math.min(...selectedCoords.map((cell) => cell.col));
    const maxRow = Math.max(...selectedCoords.map((cell) => cell.row));
    const maxCol = Math.max(...selectedCoords.map((cell) => cell.col));

    const offsets = selectedCells.map((index) => {
      const cell = indexToRowCol(index);

      return {
        index,
        rowOffset: cell.row - anchorCell.row,
        colOffset: cell.col - anchorCell.col,
        color: mapCells[index],
        landmarkId: mapLandmarks[index],
      };
    });

    const ghostCells = selectedCoords.map((cell) => ({
      row: cell.row - minRow,
      col: cell.col - minCol,
      color: cell.color,
      landmarkId: cell.landmarkId,
    }));

    const anchorGhostRow = anchorCell.row - minRow;
    const anchorGhostCol = anchorCell.col - minCol;

    const ghostOffsetX =
      anchorGhostCol * cellSize + ((event.clientX - mapRect.left) % cellSize);

    const ghostOffsetY =
      anchorGhostRow * cellSize + ((event.clientY - mapRect.top) % cellSize);

    setDragState({
      anchorIndex,
      pointerId: event.pointerId,
      originSelected: [...selectedCells],
      offsets,
      previewTargetIndices: selectedCells,
      isValidDrop: true,
      x: event.clientX,
      y: event.clientY,
      cellSize,
      ghostCells,
      ghostRows: maxRow - minRow + 1,
      ghostCols: maxCol - minCol + 1,
      ghostOffsetX,
      ghostOffsetY,
    });

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateGroupDrag = (event) => {
    setDragState((current) => {
      if (!current || current.pointerId !== event.pointerId || isLocked) {
        return current;
      }

      const pointerCell = getCellFromPointer(event.clientX, event.clientY);

      if (!pointerCell) {
        return {
          ...current,
          x: event.clientX,
          y: event.clientY,
          previewTargetIndices: current.originSelected,
          isValidDrop: false,
        };
      }

      const targetIndices = [];
      let isValid = true;

      for (const offset of current.offsets) {
        const row = pointerCell.row + offset.rowOffset;
        const col = pointerCell.col + offset.colOffset;

        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
          isValid = false;
          break;
        }

        targetIndices.push(rowColToIndex(row, col));
      }

      return {
        ...current,
        x: event.clientX,
        y: event.clientY,
        previewTargetIndices: isValid ? targetIndices : current.originSelected,
        isValidDrop: isValid,
      };
    });
  };

  const endGroupDrag = (event) => {
    setDragState((current) => {
      if (!current || current.pointerId !== event.pointerId) {
        return current;
      }

      if (!current.isValidDrop || isLocked) {
        return null;
      }

      const snapshot = {
        mapCells: [...mapCellsRef.current],
        mapLandmarks: [...mapLandmarksRef.current],
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

      setMapCells((existing) => {
        const next = [...existing];

        current.originSelected.forEach((index) => {
          next[index] = null;
        });

        current.offsets.forEach((offset, offsetIndex) => {
          const targetIndex = current.previewTargetIndices[offsetIndex];
          next[targetIndex] = offset.color;
        });

        return next;
      });
      setMapLandmarks((existing) => {
        const next = [...existing];

        current.originSelected.forEach((index) => {
          next[index] = null;
        });

        current.offsets.forEach((offset, offsetIndex) => {
          const targetIndex = current.previewTargetIndices[offsetIndex];
          next[targetIndex] = offset.landmarkId || null;
        });

        return next;
      });

      setSelectedCells(current.previewTargetIndices);
      setCheckMessage('');

      return null;
    });

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

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
    setSelectedCells([]);
    setDragState(null);
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

  const previewSelectedSet = dragState
    ? new Set(dragState.previewTargetIndices)
    : new Set(selectedCells);

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

  const paletteItems = Array.from({ length: 4 }, (_, index) => [
    palette[index * 2],
    palette[index * 2 + 1],
  ]).flat();

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

          <div className="play-surface play-surface--game">
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

                {canDragSelection && (
                  <div className="game-status-pill game-status-pill--active">
                    <span className="game-status-pill__label">Mode</span>

                    <strong className="game-status-pill__value">Drag</strong>
                  </div>
                )}
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
                  !selectedCells.length || isLocked ? 'is-disabled' : ''
                }`}
                disabled={!selectedCells.length || isLocked}
                onClick={eraseSelectedCells}
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
                          }`}
                          disabled={isLocked}
                          aria-label={`${landmark.label}${
                            isPlaced ? ', placed' : ''
                          }`}
                          onClick={() => applyLandmarkToSelectedCell(landmark)}
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
                    disabled={isLocked || selectedCells.length < 2}
                    onClick={rotateSelectedMapTilesClockwise}
                    aria-label="Rotate selected map tiles 90 degrees clockwise"
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      rotate_right
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className={`board-layout ${
              usesMapFeatures ? 'board-layout--test' : ''
            }`}>
            <div ref={mapGridRef} className="map-grid">
              {mapCells.map((cellColor, index) => {
                const isSelected = !isLocked && previewSelectedSet.has(index);

                const isDragOrigin =
                  dragState?.originSelected?.includes(index) || false;

                return (
                  <button
                    key={index}
                    data-cell-index={index}
                    type="button"
                    className={`map-grid__cell ${
                      isSelected ? 'is-selected' : ''
                    } ${isDragOrigin ? 'is-drag-origin' : ''} ${
                      isLocked ? 'is-solved' : ''
                    }`}
                    style={{
                      backgroundColor: cellColor || 'rgb(142, 142, 128)',
                    }}
                    onClick={() => handleCellClick(index)}
                    onPointerDown={(event) => startGroupDrag(event, index)}
                    onPointerMove={updateGroupDrag}
                    onPointerUp={endGroupDrag}
                    onPointerCancel={endGroupDrag}
                    aria-pressed={isSelected}
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
                );
              })}
            </div>

            {dragState?.ghostCells && (
              <div
                className={`map-drag-ghost ${
                  dragState.isValidDrop ? 'is-valid' : 'is-invalid'
                }`}
                style={{
                  width: dragState.ghostCols * dragState.cellSize,
                  height: dragState.ghostRows * dragState.cellSize,
                  gridTemplateColumns: `repeat(${dragState.ghostCols}, 1fr)`,
                  transform: `translate3d(${
                    dragState.x - dragState.ghostOffsetX
                  }px, ${dragState.y - dragState.ghostOffsetY}px, 0)`,
                }}
              >
                {Array.from({
                  length: dragState.ghostRows * dragState.ghostCols,
                }).map((_, index) => {
                  const row = Math.floor(index / dragState.ghostCols);
                  const col = index % dragState.ghostCols;

                  const ghostCell = dragState.ghostCells.find(
                    (cell) => cell.row === row && cell.col === col
                  );

                  return (
                    <span
                      key={index}
                      className={`map-drag-ghost__cell ${
                        ghostCell ? 'is-filled' : 'is-empty'
                      }`}
                      style={{
                        backgroundColor: ghostCell?.color || 'transparent',
                      }}
                    >
                      {ghostCell?.landmarkId && (() => {
                        const landmark = testLandmarks.find(
                          (item) => item.id === ghostCell.landmarkId
                        );

                        return landmark ? (
                          <span
                            className="material-symbols-outlined topo-landmark-icon topo-landmark-icon--map"
                            style={{
                              color: getContrastingIconColor(ghostCell.color),
                            }}
                            aria-hidden="true"
                          >
                            {landmark.icon}
                          </span>
                        ) : null;
                      })()}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="palette-row">
              {paletteItems.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`palette__swatch ${isLocked ? 'is-disabled' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => applyColorToSelectedCells(color)}
                  disabled={isLocked}
                  aria-label={`Fill selected cells with ${color}`}
                />
              ))}
            </div>
            </div>

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
                        } ${isUsed ? 'is-used' : ''}`}
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
