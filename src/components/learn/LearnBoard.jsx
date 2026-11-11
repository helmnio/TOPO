import { useEffect, useMemo, useRef, useState } from 'react';

import FragmentShape from '../play/FragmentShape';

import { getExamplePuzzle } from '../../data/puzzles';
import { buildFragmentCellMatrix } from '../../utils/fragments';
import { GRID_SIZE, TOTAL_CELLS } from '../../utils/grid';
import {
  clampPlacement,
  findPlacementAt,
  getCentredPlacement,
  getConflictCells,
  getRotatedPlacement,
  paintPlacements,
} from '../../utils/placements';
import {
  getContrastingIconColor,
  getTestFragmentRotations,
  getTestLandmarks,
} from '../../utils/testLandmarks';

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

// Where a fragment sits in the finished map.
function getCorrectEntry(fragment) {
  return {
    id: fragment.id,
    row: Math.min(...fragment.cells.map((cell) => cell.row)),
    col: Math.min(...fragment.cells.map((cell) => cell.col)),
    rotation: 0,
  };
}

// A playable copy of the real game on the example puzzle, with no timer,
// scoring or saved progress.
function LearnBoard() {
  const puzzle = useMemo(() => getExamplePuzzle(), []);
  const { answer, fragments } = puzzle;
  const mapGridRef = useRef(null);
  const dragRef = useRef(null);
  const lastTapRef = useRef(null);
  const removeZoneRef = useRef(false);

  const landmarks = useMemo(() => getTestLandmarks(puzzle), [puzzle]);
  const hintLandmarks = useMemo(
    () => landmarks.filter((landmark) => landmark.hintFragmentId).slice(0, 3),
    [landmarks]
  );
  const northFragmentId = fragments[0]?.id;

  const [rotations, setRotations] = useState(() =>
    getTestFragmentRotations(puzzle)
  );
  const [placements, setPlacements] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [position, setPosition] = useState({ row: 0, col: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoveZone, setIsRemoveZone] = useState(false);
  const [twistAngle, setTwistAngle] = useState(null);
  const [spin, setSpin] = useState({ id: null, from: 0, n: 0 });
  const [armedId, setArmedId] = useState(null);
  const [mapLandmarks, setMapLandmarks] = useState(() =>
    Array(TOTAL_CELLS).fill(null)
  );
  const [revealedHintIds, setRevealedHintIds] = useState([]);
  const [order, setOrder] = useState(() => fragments.map((item) => item.id));
  const placedIdsRef = useRef(new Set());

  useEffect(() => {
    const placedIds = new Set(placements.map((entry) => entry.id));
    const before = placedIdsRef.current;
    const newlyPlaced = [...placedIds].filter((id) => !before.has(id));
    const newlyRemoved = [...before].filter((id) => !placedIds.has(id));

    placedIdsRef.current = placedIds;

    if (!newlyPlaced.length && !newlyRemoved.length) return;

    setOrder((current) => [
      ...newlyRemoved.filter((id) => current.includes(id)),
      ...current.filter(
        (id) => !newlyPlaced.includes(id) && !newlyRemoved.includes(id)
      ),
      ...newlyPlaced.filter((id) => current.includes(id)),
    ]);
  }, [placements]);

  const visibleLandmarks = useMemo(
    () =>
      landmarks.flatMap((landmark) =>
        landmark.hintFragmentId && revealedHintIds.includes(landmark.id)
          ? [landmark, { ...landmark, fragmentId: landmark.hintFragmentId }]
          : [landmark]
      ),
    [landmarks, revealedHintIds]
  );

  const activeFragment = fragments.find((item) => item.id === activeId) || null;
  const activeRotation = activeFragment ? rotations[activeFragment.id] || 0 : 0;
  const activeMatrix = useMemo(
    () =>
      activeFragment
        ? buildFragmentCellMatrix(activeFragment, answer, [], activeRotation)
        : null,
    [activeFragment, answer, activeRotation]
  );
  const activePlaced = placements.find((entry) => entry.id === activeId) || null;
  const activePosition = useMemo(
    () => (activeMatrix ? clampPlacement(position, activeMatrix) : null),
    [activeMatrix, position]
  );

  const displayCells = useMemo(
    () =>
      paintPlacements(
        placements.filter((entry) => entry.id !== activeId),
        fragments,
        answer
      ),
    [placements, activeId, fragments, answer]
  );
  const conflictCells = useMemo(
    () =>
      getConflictCells(
        placements.filter((entry) => entry.id !== activeId),
        fragments,
        answer
      ),
    [placements, activeId, fragments, answer]
  );
  const overlayConflicts = useMemo(() => {
    const conflicts = new Set();

    activeMatrix?.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell.color) return;

        const index =
          (activePosition.row + rowIndex) * GRID_SIZE +
          activePosition.col +
          colIndex;

        if (displayCells[index] && displayCells[index] !== cell.color) {
          conflicts.add(index);
        }
      });
    });

    return conflicts;
  }, [activeMatrix, activePosition, displayCells]);

  const commit = (keepSelected = false) => {
    if (!activeFragment || !activePosition) return;

    if (
      activePlaced &&
      activePlaced.row === activePosition.row &&
      activePlaced.col === activePosition.col &&
      activePlaced.rotation === activeRotation
    ) {
      if (keepSelected !== true) setActiveId(null);
      return;
    }

    setPlacements([
      ...placements.filter((entry) => entry.id !== activeFragment.id),
      {
        id: activeFragment.id,
        row: activePosition.row,
        col: activePosition.col,
        rotation: activeRotation,
      },
    ]);
    if (keepSelected !== true) setActiveId(null);
  };

  // Moving or turning the selected fragment places it right away and leaves
  // it selected.
  const [commitTick, setCommitTick] = useState(0);

  useEffect(() => {
    if (commitTick > 0) commit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitTick]);

  const removeActive = () => {
    if (!activeFragment) return;

    setPlacements((current) =>
      current.filter((entry) => entry.id !== activeFragment.id)
    );
    setActiveId(null);
  };

  const activate = (fragmentId, at = null) => {
    if (activeId === fragmentId && !at) {
      commit();
      return;
    }

    const item = fragments.find((entry) => entry.id === fragmentId);

    if (!item) return;

    if (activeId && activeId !== fragmentId) commit();

    setArmedId(null);

    const existing = placements.find((entry) => entry.id === fragmentId);
    const rotation = existing ? existing.rotation : rotations[fragmentId] || 0;
    const matrix = buildFragmentCellMatrix(item, answer, [], rotation);

    if (existing) {
      setRotations((current) => ({ ...current, [fragmentId]: existing.rotation }));
    }

    if (at) {
      setPosition(
        clampPlacement(
          {
            row: Math.round(at.row - matrix.length / 2),
            col: Math.round(at.col - matrix[0].length / 2),
          },
          matrix
        )
      );
    } else if (existing) {
      setPosition({ row: existing.row, col: existing.col });
    } else {
      setPosition(getCentredPlacement(matrix));
    }

    setActiveId(fragmentId);
  };

  const rotateBy = (fragmentId, steps, fromDeg = null) => {
    const item = fragments.find((entry) => entry.id === fragmentId);

    if (!item) return;

    const turn = ((steps % 4) + 4) % 4;
    const signed = turn === 3 ? -1 : turn;
    const from = rotations[fragmentId] || 0;
    const to = (from + turn) % 4;
    const fromMatrix = buildFragmentCellMatrix(item, answer, [], from);
    const toMatrix = buildFragmentCellMatrix(item, answer, [], to);
    const existing = placements.find((entry) => entry.id === fragmentId);
    const base =
      fragmentId === activeId
        ? activePosition
        : existing
          ? { row: existing.row, col: existing.col }
          : getCentredPlacement(fromMatrix);

    if (fragmentId !== activeId) {
      if (activeId) commit();
      setArmedId(null);
      setActiveId(fragmentId);
    }

    setRotations((current) => ({ ...current, [fragmentId]: to }));
    setPosition(getRotatedPlacement(base, fromMatrix, toMatrix));
    setSpin((current) => ({
      id: fragmentId,
      from: fromDeg ?? -90 * signed,
      n: current.n + 1,
    }));
    setCommitTick((tick) => tick + 1);
  };

  const rotateActive = (steps = 1, fromDeg = null) => {
    if (activeId) rotateBy(activeId, steps, fromDeg);
  };

  useEffect(() => {
    if (!activeId) {
      setSpin({ id: null, from: 0, n: 0 });
      setTwistAngle(null);
    }
  }, [activeId]);

  const handleCellClick = (index) => {
    if (activeId) {
      const owner = findPlacementAt(placements, index, fragments, answer);

      if (owner && owner.id !== activeId) activate(owner.id);
      else commit();

      return;
    }

    if (armedId) {
      setMapLandmarks((current) =>
        current.map((value, cellIndex) => {
          if (cellIndex === index) return armedId;
          return value === armedId ? null : value;
        })
      );
      setArmedId(null);
      return;
    }

    const owner = findPlacementAt(placements, index, fragments, answer);

    if (owner) activate(owner.id);
  };

  const handleOverlayPointerDown = (event) => {
    const metrics = getGridMetrics(mapGridRef.current);

    if (!activePosition || !metrics) return;

    event.preventDefault();

    const now = Date.now();
    const lastTap = lastTapRef.current;

    if (
      lastTap &&
      now - lastTap.time < 320 &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24
    ) {
      lastTapRef.current = null;
      rotateActive(1);
      return;
    }

    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
    dragRef.current = {
      pointerId: event.pointerId,
      grabRow:
        (event.clientY - metrics.top) / metrics.stepY - activePosition.row,
      grabCol:
        (event.clientX - metrics.left) / metrics.stepX - activePosition.col,
    };
    setIsDragging(true);
  };

  // Handlers used from window listeners always see the latest render.
  const latest = useRef(null);

  useEffect(() => {
    latest.current = {
      commit,
      removeActive,
      rotateActive,
      move: (rowStep, colStep) => {
        if (!activePosition) return;

        setPosition({
          row: activePosition.row + rowStep,
          col: activePosition.col + colStep,
        });
        setCommitTick((tick) => tick + 1);
      },
    };
  });

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMove = (event) => {
      const drag = dragRef.current;
      const metrics = getGridMetrics(mapGridRef.current);

      if (!drag || drag.pointerId !== event.pointerId || !metrics) return;

      const grid = mapGridRef.current.getBoundingClientRect();
      const margin = 28;
      const isOutside =
        event.clientX < grid.left - margin ||
        event.clientX > grid.right + margin ||
        event.clientY < grid.top - margin ||
        event.clientY > grid.bottom + margin;

      removeZoneRef.current = isOutside;
      setIsRemoveZone(isOutside);
      setPosition({
        row: Math.round(
          (event.clientY - metrics.top) / metrics.stepY - drag.grabRow
        ),
        col: Math.round(
          (event.clientX - metrics.left) / metrics.stepX - drag.grabCol
        ),
      });
    };

    const handleEnd = (event) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;

      dragRef.current = null;
      setIsDragging(false);

      if (removeZoneRef.current) latest.current.removeActive();
      else setCommitTick((tick) => tick + 1);

      removeZoneRef.current = false;
      setIsRemoveZone(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [isDragging]);

  // Click away drops the piece, two-finger twist and keys control it.
  useEffect(() => {
    if (!activeId) return undefined;

    const touches = new Map();
    let lastAngle = null;
    let total = 0;

    const currentAngle = () => {
      const [first, second] = [...touches.values()];

      return (
        (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI
      );
    };

    // A tap anywhere else puts the piece down; a swipe or scroll does not.
    const handleClick = (event) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(
          '.map-placement, .map-grid, .fragment-card, .learn-board__tool'
        )
      ) {
        latest.current.commit();
      }
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
        total = 0;
        dragRef.current = null;
        setIsDragging(false);
        setTwistAngle(0);
      }
    };

    const handleMove = (event) => {
      if (!touches.has(event.pointerId)) return;

      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (touches.size !== 2 || lastAngle === null) return;

      const angle = currentAngle();

      total += ((angle - lastAngle + 540) % 360) - 180;
      lastAngle = angle;
      setTwistAngle(total);
    };

    const handleUp = (event) => {
      if (!touches.has(event.pointerId)) return;

      touches.delete(event.pointerId);

      if (touches.size < 2 && lastAngle !== null) {
        const steps = Math.round(total / 90);
        const remaining = total - steps * 90;

        lastAngle = null;
        total = 0;
        setTwistAngle(null);
        latest.current.rotateActive(steps, remaining);
      }
    };

    const handleKeyDown = (event) => {
      const moves = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };

      if (moves[event.key]) {
        event.preventDefault();
        latest.current.move(...moves[event.key]);
      } else if (event.key === 'r' || event.key === 'R') {
        latest.current.rotateActive(1);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        latest.current.removeActive();
      } else if (event.key === 'Escape' || event.key === 'Enter') {
        latest.current.commit();
      }
    };

    const blockScroll = (event) => {
      if (
        event.touches.length >= 2 &&
        event.target instanceof Element &&
        event.target.closest('.map-board')
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('click', handleClick);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeId]);

  const completeMap = () => {
    setActiveId(null);
    setArmedId(null);
    setRotations(Object.fromEntries(fragments.map((item) => [item.id, 0])));
    setPlacements(fragments.map(getCorrectEntry));
    setRevealedHintIds(hintLandmarks.map((landmark) => landmark.id));
    setMapLandmarks(
      landmarks.reduce((next, landmark) => {
        next[landmark.answerIndex] = landmark.id;
        return next;
      }, Array(TOTAL_CELLS).fill(null))
    );
  };

  const resetMap = () => {
    setActiveId(null);
    setArmedId(null);
    setPlacements([]);
    setRotations(getTestFragmentRotations(puzzle));
    setMapLandmarks(Array(TOTAL_CELLS).fill(null));
    setRevealedHintIds([]);
  };

  const cycleHints = () => {
    const next = hintLandmarks.find(
      (landmark) => !revealedHintIds.includes(landmark.id)
    );

    setRevealedHintIds(next ? [...revealedHintIds, next.id] : []);
  };

  const coach = activeFragment
    ? 'Drag it into place. Rotate it, then tap empty space to drop it.'
    : armedId
      ? 'Now tap the map square this symbol belongs on.'
      : placements.length
        ? 'Tap a placed piece to pick it up again, or tap another fragment.'
        : 'Tap a fragment to load it onto the map.';

  return (
    <div
      className={`play-surface play-surface--game learn-board ${
        activeFragment ? 'play-surface--placing' : ''
      }`}
    >
      <p className="learn-board__coach" aria-live="polite">
        {coach}
      </p>

      <div className="landmark-picker">
        <span className="landmark-picker__label">Map symbols</span>

        <div className="landmark-picker__controls">
          <div className="landmark-palette" aria-label="Map symbols">
            {landmarks.map((landmark) => (
              <button
                key={landmark.id}
                type="button"
                className={`landmark-palette__item ${
                  mapLandmarks.includes(landmark.id) ? 'is-placed' : ''
                } ${armedId === landmark.id ? 'is-armed' : ''}`}
                disabled={Boolean(activeFragment)}
                aria-label={landmark.label}
                onClick={() =>
                  setArmedId((current) =>
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
            ))}
          </div>
        </div>

        <div className="landmark-picker__tools">
          <button
            type="button"
            className="landmark-picker__tool learn-board__tool"
            disabled={!activeFragment}
            onClick={() => rotateActive(1)}
            aria-label="Rotate active fragment 90 degrees clockwise"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              rotate_right
            </span>
            Rotate
          </button>

          <button
            type="button"
            className="landmark-picker__tool learn-board__tool"
            disabled={!activeFragment}
            onClick={removeActive}
            aria-label="Remove active fragment from grid"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
            Remove
          </button>
        </div>
      </div>

      <div className="board-layout board-layout--test">
        <div className="map-board">
          <div ref={mapGridRef} className="map-grid">
            {displayCells.map((cellColor, index) => {
              const landmark = landmarks.find(
                (item) => item.id === mapLandmarks[index]
              );

              return (
                <button
                  key={index}
                  data-cell-index={index}
                  type="button"
                  className={`map-grid__cell ${
                    conflictCells.has(index) ? 'is-conflict' : ''
                  } ${cellColor ? '' : 'is-empty'}`}
                  style={{ backgroundColor: cellColor || 'rgb(142, 142, 128)' }}
                  onClick={() => handleCellClick(index)}
                  aria-label={`Map cell ${index + 1}`}
                >
                  {landmark && (
                    <span
                      className="material-symbols-outlined topo-landmark-icon topo-landmark-icon--map"
                      style={{ color: getContrastingIconColor(cellColor) }}
                      aria-hidden="true"
                    >
                      {landmark.icon}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeMatrix && activePosition && (
            <div
              className={`map-placement ${
                isDragging && isRemoveZone ? 'is-removing' : ''
              } ${
                spin.id === activeId && spin.n > 0 && twistAngle === null
                  ? spin.n % 2
                    ? 'is-spin-a'
                    : 'is-spin-b'
                  : ''
              }`}
              style={{
                transformOrigin: `${
                  ((activePosition.col + activeMatrix[0].length / 2) /
                    GRID_SIZE) *
                  100
                }% ${
                  ((activePosition.row + activeMatrix.length / 2) / GRID_SIZE) *
                  100
                }%`,
                '--spin-from': `${spin.from}deg`,
                ...(twistAngle !== null
                  ? { transform: `rotate(${twistAngle}deg)` }
                  : {}),
              }}
              aria-label="Active fragment"
            >
              {Array.from({ length: TOTAL_CELLS }).map((_, index) => {
                const cell =
                  activeMatrix[
                    Math.floor(index / GRID_SIZE) - activePosition.row
                  ]?.[(index % GRID_SIZE) - activePosition.col];
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
                    onPointerDown={isFilled ? handleOverlayPointerDown : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeFragment && (
        <div className="placement-bar">
          <span className="placement-bar__hint">
            Drag to move, drag off the map to remove. Tap anywhere else to put it down.
          </span>
        </div>
      )}

      <div className="game-fragments">
        <div className="fragment-panel">
          <div className="fragment-grid">
            {order
              .map((id) => fragments.find((item) => item.id === id))
              .filter(Boolean)
              .map((item) => {
              const isUsed = placements.some((entry) => entry.id === item.id);
              const rotation = rotations[item.id] || 0;

              return (
                <div
                  key={item.id}
                  className={`fragment-card ${isUsed ? 'is-used' : ''} ${
                    activeId === item.id ? 'is-active' : ''
                  }`}
                  data-fragment-id={item.id}
                  data-number={
                    fragments.findIndex((entry) => entry.id === item.id) + 1
                  }
                  onClick={() => activate(item.id)}
                >
                  {item.id === northFragmentId && (
                    <span
                      className="fragment-card__north-marker"
                      style={{ transform: `rotate(${rotation * 90}deg)` }}
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

                  <span
                    className={`fragment-card__used-toggle ${
                      isUsed ? 'is-active' : ''
                    }`}
                    role="img"
                    aria-label={isUsed ? 'On the map' : 'Not on the map'}
                  >
                    ✓
                  </span>

                  <button
                    type="button"
                    className="fragment-card__rotate-toggle"
                    onClick={(event) => {
                      event.stopPropagation();

                      if (isUsed || activeId === item.id) {
                        rotateBy(item.id, 1);
                      } else {
                        setRotations((current) => ({
                          ...current,
                          [item.id]: (rotation + 1) % 4,
                        }));
                      }
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

                  <div className="fragment-card__preview">
                    <FragmentShape
                      fragment={item}
                      answer={answer}
                      className="fragment-shape"
                      landmarks={visibleLandmarks}
                      rotation={rotation}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fragment-hint-actions">
        <button
          type="button"
          className="button button--secondary button--small"
          onClick={cycleHints}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {revealedHintIds.length > 0 ? 'lightbulb' : 'lightbulb_outline'}
          </span>
          Hint {revealedHintIds.length}/{hintLandmarks.length}
        </button>
        <span className="fragment-hint-actions__text">
          Shows a symbol again where two fragments overlap.
        </span>
      </div>

      <div className="dev-tools-inline learn-board__helpers">
        <button
          type="button"
          className="button button--primary button--small"
          onClick={completeMap}
        >
          Show answer
        </button>

        <button
          type="button"
          className="button button--secondary button--small"
          onClick={resetMap}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default LearnBoard;
