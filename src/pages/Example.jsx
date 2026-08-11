import { useMemo, useRef, useState } from 'react';

import BottomNav from '../components/layout/BottomNav';
import FragmentShape from '../components/play/FragmentShape';

import { getExamplePuzzle } from '../data/puzzles';

import {
  GRID_SIZE,
  TOTAL_CELLS,
  indexToRowCol,
  rowColToIndex,
} from '../utils/grid';

import { boardsMatch } from '../utils/playHelpers';
import {
  getContrastingIconColor,
  getTestFragmentRotations,
  getTestLandmarks,
} from '../utils/testLandmarks';

function moveItem(array, fromIndex, toIndex) {
  const next = [...array];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];

  return next;
}

function getFragmentEntries(fragment, answer) {
  const rawCells =
    fragment.cells ||
    fragment.indexes ||
    fragment.indices ||
    fragment.cellIndexes ||
    fragment.cellIndices ||
    [];

  return rawCells
    .map((cell) => {
      if (typeof cell === 'number') {
        return {
          index: cell,
          color: answer[cell],
        };
      }

      const index =
        cell.index ??
        cell.cellIndex ??
        cell.answerIndex ??
        (
          typeof cell.row === 'number' &&
          typeof cell.col === 'number'
            ? rowColToIndex(cell.row, cell.col)
            : null
        );

      if (index === null || index === undefined) {
        return null;
      }

      return {
        index,
        color: cell.color || answer[index],
      };
    })
    .filter(Boolean);
}

function Example() {
  const mapGridRef = useRef(null);

  const puzzle = useMemo(() => getExamplePuzzle(), []);
  const fragmentItems = useMemo(() => puzzle.fragments, [puzzle]);

  const palette = puzzle.palette;
  const answer = puzzle.answer;
  const landmarks = useMemo(() => getTestLandmarks(puzzle), [puzzle]);
  const northFragmentId = fragmentItems[0]?.id;
  const defaultFragmentRotations = useMemo(
    () => getTestFragmentRotations(puzzle),
    [puzzle]
  );

  const defaultFragmentOrder = useMemo(() => {
    return fragmentItems.map((item) => item.id);
  }, [fragmentItems]);

  const [fragmentOrder, setFragmentOrder] = useState(defaultFragmentOrder);
  const [fragmentRotations, setFragmentRotations] = useState(
    defaultFragmentRotations
  );
  const [fragmentDrag, setFragmentDrag] = useState(null);

  const [mapCells, setMapCells] = useState(Array(TOTAL_CELLS).fill(null));
  const [mapLandmarks, setMapLandmarks] = useState(
    Array(TOTAL_CELLS).fill(null)
  );
  const mapCellsRef = useRef(mapCells);

  const [selectedCells, setSelectedCells] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [, setHistory] = useState([]);
  const [revealedFragmentIds, setRevealedFragmentIds] = useState([]);
  const [revealedHintLandmarkIds, setRevealedHintLandmarkIds] = useState([]);
  const [hintDirection, setHintDirection] = useState('up');

  const hintLandmarks = useMemo(
    () => landmarks.filter((landmark) => landmark.hintFragmentId).slice(0, 3),
    [landmarks]
  );
  const visibleLandmarks = useMemo(
    () => landmarks.flatMap((landmark) => {
      if (!revealedHintLandmarkIds.includes(landmark.id)) return [landmark];

      return [
        landmark,
        { ...landmark, fragmentId: landmark.hintFragmentId },
      ];
    }),
    [landmarks, revealedHintLandmarkIds]
  );

  mapCellsRef.current = mapCells;

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

  const buildMapFromRevealedIds = (ids) => {
    const next = Array(TOTAL_CELLS).fill(null);

    ids.forEach((id) => {
      const fragment = fragmentItems.find((item) => item.id === id);

      if (!fragment) {
        return;
      }

      getFragmentEntries(fragment, answer).forEach((entry) => {
        next[entry.index] = entry.color;
      });
    });

    return next;
  };

  const pushHistory = () => {
    const snapshot = [...mapCellsRef.current];

    setHistory((prev) => {
      const last = prev[prev.length - 1];

      if (last && boardsMatch(last, snapshot)) {
        return prev;
      }

      return [...prev.slice(-19), snapshot];
    });
  };

  const handleToggleFragmentReveal = (fragment) => {
    pushHistory();

    setRevealedFragmentIds((current) => {
      const isRevealed = current.includes(fragment.id);

      const nextIds = isRevealed
        ? current.filter((id) => id !== fragment.id)
        : [...current, fragment.id];

      setMapCells(buildMapFromRevealedIds(nextIds));
      setSelectedCells([]);
      setDragState(null);

      return nextIds;
    });
  };

  const completeMap = () => {
    pushHistory();

    setMapCells([...answer]);
    setMapLandmarks(
      landmarks.reduce((placements, landmark) => {
        placements[landmark.answerIndex] = landmark.id;
        return placements;
      }, Array(TOTAL_CELLS).fill(null))
    );
    setRevealedFragmentIds(fragmentItems.map((item) => item.id));
    setSelectedCells([]);
    setDragState(null);
  };

  const resetMap = () => {
    pushHistory();

    setMapCells(Array(TOTAL_CELLS).fill(null));
    setMapLandmarks(Array(TOTAL_CELLS).fill(null));
    setRevealedFragmentIds([]);
    setFragmentRotations(defaultFragmentRotations);
    setRevealedHintLandmarkIds([]);
    setHintDirection('up');
    setSelectedCells([]);
    setDragState(null);
  };

  const rotateFragmentClockwise = (fragmentId) => {
    setFragmentRotations((current) => ({
      ...current,
      [fragmentId]: ((current[fragmentId] || 0) + 1) % 4,
    }));
  };

  const cycleHints = () => {
    setRevealedHintLandmarkIds((current) => {
      if (hintDirection === 'up' && current.length < hintLandmarks.length) {
        return [...current, hintLandmarks[current.length].id];
      }

      if (hintDirection === 'up') {
        setHintDirection('down');
        return current.slice(0, -1);
      }

      if (current.length > 0) {
        const next = current.slice(0, -1);

        if (next.length === 0) setHintDirection('up');
        return next;
      }

      setHintDirection('up');
      return hintLandmarks.length ? [hintLandmarks[0].id] : [];
    });
  };

  const applyColorToSelectedCells = (color) => {
    if (!selectedCells.length) {
      return;
    }

    pushHistory();

    setMapCells((current) =>
      current.map((cell, index) =>
        selectedCells.includes(index) ? color : cell
      )
    );

    setSelectedCells([]);
  };

  const applyLandmarkToSelectedCell = (landmark) => {
    if (selectedCells.length !== 1) return;

    const targetIndex = selectedCells[0];
    setMapLandmarks((current) =>
      current.map((value, index) => {
        if (index === targetIndex) return landmark.id;
        return value === landmark.id ? null : value;
      })
    );
    setSelectedCells([]);
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

  const handleCellClick = (index) => {
    if (dragState) {
      return;
    }

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

  const canDragSelection =
    selectedCells.length >= 2 &&
    selectedCells.every((index) => mapCells[index] !== null);

  const startGroupDrag = (event, anchorIndex) => {
    if (!canDragSelection || !selectedCells.includes(anchorIndex)) {
      return;
    }

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
      };
    });

    const ghostCells = selectedCoords.map((cell) => ({
      row: cell.row - minRow,
      col: cell.col - minCol,
      color: cell.color,
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
      if (!current || current.pointerId !== event.pointerId) {
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

      if (!current.isValidDrop) {
        return null;
      }

      pushHistory();

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

      setSelectedCells(current.previewTargetIndices);

      return null;
    });

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleFragmentDragStart = (event, item) => {
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

          return moveItem(current, fromIndex, toIndex);
        });
      }
    }

    setFragmentDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const previewSelectedSet = dragState
    ? new Set(dragState.previewTargetIndices)
    : new Set(selectedCells);

  return (
    <div className="page page--example">
      <div className="page__inner">
        <main className="play-shell play-shell--game">
          <header className="play-header">
            <p className="eyebrow">Example</p>

            <h1 className="play-title">Learn TOPO</h1>

            <p className="panel-copy">
              Rebuild today’s map from overlapping, rotated fragments. Match
              every colour and symbol with north pointing upward.
            </p>
          </header>

          <section className="learn-rules">
            <h2>How to play</h2>

            <div className="learn-rules__grid">
              <div>
                <strong>1 · Read fragments</strong>
                <p>Use repeated colours and overlaps to work out how the pieces connect.</p>
              </div>
              <div>
                <strong>2 · Rotate pieces</strong>
                <p>Turn fragments clockwise. The navigation marker identifies north and must finish pointing up.</p>
              </div>
              <div>
                <strong>3 · Build the map</strong>
                <p>Select map squares, apply colours, then drag or rotate selected groups into position.</p>
              </div>
              <div>
                <strong>4 · Place symbols</strong>
                <p>Each symbol appears once in the fragments and must be placed once on the matching map square.</p>
              </div>
              <div>
                <strong>5 · Use hints</strong>
                <p>You have three hints. Each reveals a symbol again where two fragments overlap.</p>
              </div>
              <div>
                <strong>6 · Submit once</strong>
                <p>The north-up colours and all symbol positions must be correct. A failed Daily ends the streak.</p>
              </div>
            </div>
          </section>

          <div className="play-surface play-surface--game">
            

            <div className="dev-tools-inline">
              {fragmentItems.map((fragment, index) => {
                const isRevealed = revealedFragmentIds.includes(fragment.id);

                return (
                  <button
                    key={fragment.id}
                    type="button"
                    className={`button button--secondary button--small ${
                      isRevealed ? 'is-active' : ''
                    }`}
                    onClick={() => handleToggleFragmentReveal(fragment)}
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      {isRevealed ? 'visibility' : 'visibility_off'}
                    </span>
                    Frag {index + 1}
                  </button>
                );
              })}

              <button
                type="button"
                className="button button--primary button--small"
                onClick={completeMap}
              >
                Complete
              </button>

              <button
                type="button"
                className="button button--secondary button--small"
                onClick={resetMap}
              >
                Reset
              </button>
            </div>

            <div ref={mapGridRef} className="map-grid">
              {mapCells.map((cellColor, index) => {
                const isSelected = previewSelectedSet.has(index);

                const isDragOrigin =
                  dragState?.originSelected?.includes(index) || false;

                return (
                  <button
                    key={index}
                    type="button"
                    className={`map-grid__cell ${
                      isSelected ? 'is-selected' : ''
                    } ${isDragOrigin ? 'is-drag-origin' : ''}`}
                    style={{
                      backgroundColor: cellColor || 'rgb(142, 142, 128)',
                    }}
                    onClick={() => handleCellClick(index)}
                    onPointerDown={(event) => startGroupDrag(event, index)}
                    onPointerMove={updateGroupDrag}
                    onPointerUp={endGroupDrag}
                    onPointerCancel={endGroupDrag}
                    aria-pressed={isSelected}
                    aria-label={`Example map cell ${index + 1}`}
                  >
                    {mapLandmarks[index] && (() => {
                      const landmark = landmarks.find(
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
                    />
                  );
                })}
              </div>
            )}

            <div className="palette-row">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="palette__swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => applyColorToSelectedCells(color)}
                  aria-label={`Fill selected cells with ${color}`}
                />
              ))}
            </div>

            <div className="landmark-picker">
              <span className="landmark-picker__label landmark-picker__label--full">
                Map symbols
              </span>
              <div className="landmark-palette" aria-label="Map symbols">
                {landmarks.map((landmark) => (
                  <button
                    key={landmark.id}
                    type="button"
                    className={`landmark-palette__item ${
                      mapLandmarks.includes(landmark.id) ? 'is-placed' : ''
                    }`}
                    onClick={() => applyLandmarkToSelectedCell(landmark)}
                    aria-label={landmark.label}
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


            <div className="game-fragments">
              <div className="fragment-panel">
                <div className="fragment-grid">
                  {orderedFragmentItems.map((item) => {
                    const isDragging = fragmentDrag?.id === item.id;
                    const isRevealed = revealedFragmentIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`fragment-card ${
                          isDragging ? 'is-dragging' : ''
                        } ${isRevealed ? 'is-selected' : ''}`}
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
                          className="fragment-card__rotate-toggle"
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

                        <div className="fragment-card__preview">
                          <FragmentShape
                            fragment={item}
                            answer={answer}
                            className="fragment-shape"
                            landmarks={visibleLandmarks}
                            rotation={fragmentRotations[item.id] || 0}
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
              <span className="fragment-hint-actions__text">
                Cycle through symbol overlaps.
              </span>
            </div>

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
                    landmarks={visibleLandmarks}
                    rotation={fragmentRotations[draggedFragment.id] || 0}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

export default Example;
