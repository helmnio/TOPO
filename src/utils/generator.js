import { GRID_SIZE, TOTAL_CELLS, rowColToIndex, indexToRowCol } from './grid';
import { generatePaletteWithMeta } from './palette';

function mulberry32(seed) {
  let t = seed >>> 0;

  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | t);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  const stringValue = String(value);
  let hash = 1779033703 ^ stringValue.length;

  for (let i = 0; i < stringValue.length; i += 1) {
    hash = Math.imul(hash ^ stringValue.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}

function createRng(seed) {
  return mulberry32(hashSeed(seed));
}

function shuffle(array, rng) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function sample(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

function getOrthogonalNeighbours(index) {
  const { row, col } = indexToRowCol(index);
  const neighbours = [];

  if (row > 0) neighbours.push(rowColToIndex(row - 1, col));
  if (row < GRID_SIZE - 1) neighbours.push(rowColToIndex(row + 1, col));
  if (col > 0) neighbours.push(rowColToIndex(row, col - 1));
  if (col < GRID_SIZE - 1) neighbours.push(rowColToIndex(row, col + 1));

  return neighbours;
}

function getTouchingOrDiagonalNeighbours(index) {
  const { row, col } = indexToRowCol(index);
  const neighbours = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (
        nextRow >= 0 &&
        nextRow < GRID_SIZE &&
        nextCol >= 0 &&
        nextCol < GRID_SIZE
      ) {
        neighbours.push(rowColToIndex(nextRow, nextCol));
      }
    }
  }

  return neighbours;
}

function getAdjacentPairs() {
  const pairs = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const current = rowColToIndex(row, col);

      if (col < GRID_SIZE - 1) {
        pairs.push([current, rowColToIndex(row, col + 1)]);
      }

      if (row < GRID_SIZE - 1) {
        pairs.push([current, rowColToIndex(row + 1, col)]);
      }

      if (row < GRID_SIZE - 1 && col < GRID_SIZE - 1) {
        pairs.push([current, rowColToIndex(row + 1, col + 1)]);
      }

      if (row < GRID_SIZE - 1 && col > 0) {
        pairs.push([current, rowColToIndex(row + 1, col - 1)]);
      }
    }
  }

  return pairs;
}

function areTouchingOrDiagonal(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);

  const rowDiff = Math.abs(a.row - b.row);
  const colDiff = Math.abs(a.col - b.col);

  return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
}

function getConnectedTriples() {
  const triples = [];
  const seen = new Set();

  for (let start = 0; start < TOTAL_CELLS; start += 1) {
    const firstNeighbours = getTouchingOrDiagonalNeighbours(start);

    firstNeighbours.forEach((mid) => {
      const secondNeighbours = getTouchingOrDiagonalNeighbours(mid);

      secondNeighbours.forEach((end) => {
        const unique = new Set([start, mid, end]);

        if (unique.size !== 3) return;

        const triple = [...unique].sort((a, b) => a - b);
        const key = triple.join('-');

        if (seen.has(key)) return;

        let connectedEdges = 0;

        for (let i = 0; i < triple.length; i += 1) {
          for (let j = i + 1; j < triple.length; j += 1) {
            if (areTouchingOrDiagonal(triple[i], triple[j])) {
              connectedEdges += 1;
            }
          }
        }

        if (connectedEdges >= 2) {
          seen.add(key);
          triples.push(triple);
        }
      });
    });
  }

  return triples;
}

function isConnected(cellIndices) {
  if (!cellIndices.length) return false;

  const allowed = new Set(cellIndices);
  const visited = new Set();
  const stack = [cellIndices[0]];

  while (stack.length) {
    const current = stack.pop();

    if (visited.has(current)) continue;

    visited.add(current);

    getOrthogonalNeighbours(current).forEach((neighbour) => {
      if (allowed.has(neighbour) && !visited.has(neighbour)) {
        stack.push(neighbour);
      }
    });
  }

  return visited.size === allowed.size;
}

function generateRegionTargets(regionCount, totalCells, rng, maxPerRegion = 5) {
  const targets = Array(regionCount).fill(1);
  let remaining = totalCells - regionCount;

  while (remaining > 0) {
    const validIndices = targets
      .map((count, index) => ({ count, index }))
      .filter((entry) => entry.count < maxPerRegion)
      .map((entry) => entry.index);

    if (!validIndices.length) break;

    const chosenIndex = sample(validIndices, rng);
    targets[chosenIndex] += 1;
    remaining -= 1;
  }

  return shuffle(targets, rng);
}

function tryRescueUnassignedCells(owner, regionSizes, regionTargets, frontierByRegion, rng) {
  const unassigned = owner
    .map((regionId, index) => ({ regionId, index }))
    .filter((entry) => entry.regionId === null)
    .map((entry) => entry.index);

  if (!unassigned.length) return true;

  for (const cell of shuffle(unassigned, rng)) {
    const orthogonal = shuffle(getOrthogonalNeighbours(cell), rng);
    let assigned = false;

    for (const neighbour of orthogonal) {
      const neighbourRegion = owner[neighbour];

      if (neighbourRegion === null) continue;
      if (regionSizes[neighbourRegion] >= regionTargets[neighbourRegion]) continue;

      owner[cell] = neighbourRegion;
      regionSizes[neighbourRegion] += 1;

      for (let regionId = 0; regionId < frontierByRegion.length; regionId += 1) {
        frontierByRegion[regionId].delete(cell);
      }

      getOrthogonalNeighbours(cell).forEach((nextNeighbour) => {
        if (owner[nextNeighbour] === null) {
          frontierByRegion[neighbourRegion].add(nextNeighbour);
        }
      });

      assigned = true;
      break;
    }

    if (!assigned) return false;
  }

  return true;
}

function tryForceAssignRemaining(owner, regionSizes, regionTargets, rng) {
  const unassigned = owner
    .map((regionId, index) => ({ regionId, index }))
    .filter((entry) => entry.regionId === null)
    .map((entry) => entry.index);

  if (!unassigned.length) return true;

  const regionsWithCapacity = regionSizes
    .map((count, regionId) => ({
      regionId,
      remaining: regionTargets[regionId] - count,
    }))
    .filter((entry) => entry.remaining > 0);

  if (!regionsWithCapacity.length) return false;

  for (const cell of shuffle(unassigned, rng)) {
    const availableRegions = regionsWithCapacity.filter(
      (entry) => regionSizes[entry.regionId] < regionTargets[entry.regionId]
    );

    if (!availableRegions.length) return false;

    const chosenRegion = sample(availableRegions, rng).regionId;
    owner[cell] = chosenRegion;
    regionSizes[chosenRegion] += 1;
  }

  return true;
}

function buildRegionMap(rng, palette) {
  const regionTargets = generateRegionTargets(palette.length, TOTAL_CELLS, rng, 5);

  const regionSeeds = shuffle(
    Array.from({ length: TOTAL_CELLS }, (_, index) => index),
    rng
  ).slice(0, palette.length);

  const owner = Array(TOTAL_CELLS).fill(null);
  const regionSizes = Array(palette.length).fill(0);
  const frontierByRegion = Array.from({ length: palette.length }, () => new Set());

  regionSeeds.forEach((index, regionId) => {
    owner[index] = regionId;
    regionSizes[regionId] = 1;

    getOrthogonalNeighbours(index).forEach((neighbour) => {
      if (owner[neighbour] === null) {
        frontierByRegion[regionId].add(neighbour);
      }
    });
  });

  let assignedCount = palette.length;
  let guard = 0;

  while (assignedCount < TOTAL_CELLS && guard < 5000) {
    guard += 1;

    const candidateRegions = [];

    for (let regionId = 0; regionId < palette.length; regionId += 1) {
      if (regionSizes[regionId] >= regionTargets[regionId]) continue;

      const frontier = [...frontierByRegion[regionId]].filter(
        (cell) => owner[cell] === null
      );

      if (!frontier.length) continue;

      candidateRegions.push({
        regionId,
        frontier,
        remainingCapacity: regionTargets[regionId] - regionSizes[regionId],
      });
    }

    if (!candidateRegions.length) break;

    const maxRemainingCapacity = Math.max(
      ...candidateRegions.map((entry) => entry.remainingCapacity)
    );

    const preferredRegions = candidateRegions.filter(
      (entry) => entry.remainingCapacity === maxRemainingCapacity
    );

    const chosenRegion = sample(preferredRegions, rng);
    const chosenCell = sample(chosenRegion.frontier, rng);

    owner[chosenCell] = chosenRegion.regionId;
    regionSizes[chosenRegion.regionId] += 1;
    assignedCount += 1;

    for (let regionId = 0; regionId < frontierByRegion.length; regionId += 1) {
      frontierByRegion[regionId].delete(chosenCell);
    }

    getOrthogonalNeighbours(chosenCell).forEach((neighbour) => {
      if (owner[neighbour] === null) {
        frontierByRegion[chosenRegion.regionId].add(neighbour);
      }
    });
  }

  if (assignedCount < TOTAL_CELLS) {
    const rescueWorked = tryRescueUnassignedCells(
      owner,
      regionSizes,
      regionTargets,
      frontierByRegion,
      rng
    );

    if (!rescueWorked) {
      const forceWorked = tryForceAssignRemaining(owner, regionSizes, regionTargets, rng);

      if (!forceWorked) {
        const finalAssigned = owner.filter((regionId) => regionId !== null).length;
        throw new Error(
          `Region growth stalled. Assigned ${finalAssigned} of ${TOTAL_CELLS} cells.`
        );
      }
    }
  }

  const finalAssigned = owner.filter((regionId) => regionId !== null).length;

  if (finalAssigned !== TOTAL_CELLS) {
    throw new Error(
      `Region growth stalled. Assigned ${finalAssigned} of ${TOTAL_CELLS} cells.`
    );
  }

  const usageCounts = Array(palette.length).fill(0);

  owner.forEach((regionId) => {
    usageCounts[regionId] += 1;
  });

  const overLimit = usageCounts.find((count) => count > 5);

  if (overLimit) {
    throw new Error(`Region colour cap exceeded. Found usage count ${overLimit}.`);
  }

  return owner.map((regionId) => palette[regionId]);
}

function chooseSeedCells(rng) {
  const allCells = shuffle(
    Array.from({ length: TOTAL_CELLS }, (_, index) => index),
    rng
  );

  const chosen = [];

  for (const cell of allCells) {
    const tooClose = chosen.some(
      (existing) =>
        getTouchingOrDiagonalNeighbours(existing).includes(cell) || existing === cell
    );

    if (!tooClose) {
      chosen.push(cell);
    }

    if (chosen.length === 6) {
      return chosen;
    }
  }

  return allCells.slice(0, 6);
}

function buildBaseGroups(rng) {
  const groups = Array.from({ length: 6 }, (_, index) => ({
    id: `g${index + 1}`,
    label: `G${index + 1}`,
    cellSet: new Set(),
  }));

  const owner = Array(TOTAL_CELLS).fill(null);
  const frontierByGroup = Array.from({ length: 6 }, () => new Set());

  const seeds = chooseSeedCells(rng);

  seeds.forEach((cell, groupIndex) => {
    groups[groupIndex].cellSet.add(cell);
    owner[cell] = groupIndex;

    getOrthogonalNeighbours(cell).forEach((neighbour) => {
      if (owner[neighbour] === null) {
        frontierByGroup[groupIndex].add(neighbour);
      }
    });
  });

  let assignedCount = seeds.length;
  let guard = 0;

  while (assignedCount < TOTAL_CELLS && guard < 1000) {
    guard += 1;

    const candidateGroups = groups
      .map((group, groupIndex) => ({
        group,
        groupIndex,
        frontier: [...frontierByGroup[groupIndex]].filter((cell) => owner[cell] === null),
      }))
      .filter((entry) => entry.frontier.length > 0);

    if (!candidateGroups.length) break;

    const smallestSize = Math.min(...candidateGroups.map((entry) => entry.group.cellSet.size));

    const preferredGroups = candidateGroups.filter(
      (entry) => entry.group.cellSet.size === smallestSize
    );

    const chosenGroupEntry = sample(preferredGroups, rng);
    const chosenCell = sample(chosenGroupEntry.frontier, rng);
    const { groupIndex } = chosenGroupEntry;

    groups[groupIndex].cellSet.add(chosenCell);
    owner[chosenCell] = groupIndex;
    assignedCount += 1;

    frontierByGroup[groupIndex].delete(chosenCell);

    getOrthogonalNeighbours(chosenCell).forEach((neighbour) => {
      if (owner[neighbour] === null) {
        frontierByGroup[groupIndex].add(neighbour);
      }
    });

    for (let i = 0; i < frontierByGroup.length; i += 1) {
      frontierByGroup[i].delete(chosenCell);
    }
  }

  if (assignedCount !== TOTAL_CELLS) {
    throw new Error(
      `Base group growth stalled. Assigned ${assignedCount} of ${TOTAL_CELLS} cells.`
    );
  }

  return groups;
}

function rebalanceGroupSizes(groups, rng) {
  let guard = 0;

  while (guard < 1000) {
    guard += 1;

    const tooBig = groups.find((group) => group.cellSet.size > 7);
    const tooSmall = groups.find((group) => group.cellSet.size < 4);

    if (!tooBig && !tooSmall) break;

    if (tooBig) {
      const targetGroups = groups.filter(
        (group) => group !== tooBig && group.cellSet.size < 7
      );

      const movable = shuffle([...tooBig.cellSet], rng).filter((cell) => {
        const remainder = [...tooBig.cellSet].filter((item) => item !== cell);

        if (remainder.length < 4 || !isConnected(remainder)) return false;

        return targetGroups.some((group) =>
          [...group.cellSet].some((ownedCell) =>
            getOrthogonalNeighbours(ownedCell).includes(cell)
          )
        );
      });

      if (movable.length) {
        const chosenCell = movable[0];

        const validTargets = targetGroups.filter((group) =>
          [...group.cellSet].some((ownedCell) =>
            getOrthogonalNeighbours(ownedCell).includes(chosenCell)
          )
        );

        if (validTargets.length) {
          const target = sample(validTargets, rng);
          tooBig.cellSet.delete(chosenCell);
          target.cellSet.add(chosenCell);
          continue;
        }
      }
    }

    if (tooSmall) {
      const donorGroups = groups.filter(
        (group) => group !== tooSmall && group.cellSet.size > 4
      );

      const donors = shuffle(donorGroups, rng);
      let moved = false;

      for (const donor of donors) {
        const movable = shuffle([...donor.cellSet], rng).filter((cell) => {
          const donorRemaining = [...donor.cellSet].filter((item) => item !== cell);

          if (donorRemaining.length < 4 || !isConnected(donorRemaining)) {
            return false;
          }

          return [...tooSmall.cellSet].some((ownedCell) =>
            getOrthogonalNeighbours(ownedCell).includes(cell)
          );
        });

        if (movable.length) {
          donor.cellSet.delete(movable[0]);
          tooSmall.cellSet.add(movable[0]);
          moved = true;
          break;
        }
      }

      if (moved) continue;
    }

    break;
  }

  return groups;
}

function createConnectionGraph(rng) {
  const nodes = shuffle([0, 1, 2, 3, 4, 5], rng);

  return {
    edges: [
      [nodes[0], nodes[1]],
      [nodes[1], nodes[2]],
      [nodes[2], nodes[3]],
      [nodes[3], nodes[4]],
      [nodes[4], nodes[5]],
    ],
    tripleEdgeIndex: 0,
  };
}

function cloneGroups(groups) {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    cellSet: new Set(group.cellSet),
  }));
}

function getSharedIndices(groupA, groupB) {
  const shared = [];

  groupA.cellSet.forEach((cell) => {
    if (groupB.cellSet.has(cell)) {
      shared.push(cell);
    }
  });

  return shared.sort((a, b) => a - b);
}

function hasValidSharedPair(sharedIndices) {
  if (sharedIndices.length < 2) return false;

  for (let i = 0; i < sharedIndices.length; i += 1) {
    for (let j = i + 1; j < sharedIndices.length; j += 1) {
      if (areTouchingOrDiagonal(sharedIndices[i], sharedIndices[j])) {
        return true;
      }
    }
  }

  return false;
}

function hasValidTripleCluster(sharedIndices) {
  if (sharedIndices.length !== 3) return false;

  let connectedEdges = 0;

  for (let i = 0; i < sharedIndices.length; i += 1) {
    for (let j = i + 1; j < sharedIndices.length; j += 1) {
      if (areTouchingOrDiagonal(sharedIndices[i], sharedIndices[j])) {
        connectedEdges += 1;
      }
    }
  }

  return connectedEdges >= 2;
}

function canGroupAcceptCells(group, cells) {
  return (
    cells.some((cell) => group.cellSet.has(cell)) ||
    [...group.cellSet].some((ownedCell) =>
      cells.some((cell) => getOrthogonalNeighbours(ownedCell).includes(cell))
    )
  );
}

function addCellsToGroup(group, cells, cellUsage) {
  cells.forEach((cell) => {
    if (!group.cellSet.has(cell)) {
      group.cellSet.add(cell);
      cellUsage[cell] += 1;
    }
  });
}

function addPairOverlaps(groups, rng) {
  const overlapUsage = new Set();
  const cellUsage = Array(TOTAL_CELLS).fill(0);

  groups.forEach((group) => {
    group.cellSet.forEach((cell) => {
      cellUsage[cell] += 1;
    });
  });

  const { edges, tripleEdgeIndex } = createConnectionGraph(rng);
  const allPairs = shuffle(getAdjacentPairs(), rng);
  const allTriples = shuffle(getConnectedTriples(), rng);
  const edgeReports = [];

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    const [groupAIndex, groupBIndex] = edges[edgeIndex];
    const groupA = groups[groupAIndex];
    const groupB = groups[groupBIndex];
    const targetSharedCount = edgeIndex === tripleEdgeIndex ? 3 : 2;

    const existingShared = getSharedIndices(groupA, groupB);

    if (existingShared.length === targetSharedCount) {
      const existingValid =
        targetSharedCount === 3
          ? hasValidTripleCluster(existingShared)
          : hasValidSharedPair(existingShared);

      if (existingValid) {
        edgeReports.push({
          edge: `${groupA.id}-${groupB.id}`,
          status: 'already-valid',
          targetSharedCount,
          sharedCount: existingShared.length,
          cells: existingShared,
        });
        continue;
      }
    }

    const candidates =
      targetSharedCount === 3
        ? allTriples.filter((cells) => {
            const sortedCells = [...cells].sort((a, b) => a - b);
            const key = sortedCells.join('-');

            if (overlapUsage.has(key)) return false;
            if (sortedCells.some((cell) => cellUsage[cell] >= 3)) return false;

            const canAttachToA = canGroupAcceptCells(groupA, sortedCells);
            const canAttachToB = canGroupAcceptCells(groupB, sortedCells);

            if (!canAttachToA || !canAttachToB) return false;

            const trialA = new Set(groupA.cellSet);
            const trialB = new Set(groupB.cellSet);

            sortedCells.forEach((cell) => {
              trialA.add(cell);
              trialB.add(cell);
            });

            if (!isConnected([...trialA]) || !isConnected([...trialB])) return false;
            if (trialA.size > 7 || trialB.size > 7) return false;

            const sharedAfter = [...trialA]
              .filter((cell) => trialB.has(cell))
              .sort((a, b) => a - b);

            return sharedAfter.length === 3 && hasValidTripleCluster(sharedAfter);
          })
        : allPairs.filter((cells) => {
            const sortedCells = [...cells].sort((a, b) => a - b);
            const key = sortedCells.join('-');

            if (overlapUsage.has(key)) return false;
            if (sortedCells.some((cell) => cellUsage[cell] >= 3)) return false;

            const canAttachToA = canGroupAcceptCells(groupA, sortedCells);
            const canAttachToB = canGroupAcceptCells(groupB, sortedCells);

            if (!canAttachToA || !canAttachToB) return false;

            const trialA = new Set(groupA.cellSet);
            const trialB = new Set(groupB.cellSet);

            sortedCells.forEach((cell) => {
              trialA.add(cell);
              trialB.add(cell);
            });

            if (!isConnected([...trialA]) || !isConnected([...trialB])) return false;
            if (trialA.size > 7 || trialB.size > 7) return false;

            const sharedAfter = [...trialA]
              .filter((cell) => trialB.has(cell))
              .sort((a, b) => a - b);

            return sharedAfter.length === 2 && hasValidSharedPair(sharedAfter);
          });

    if (!candidates.length) {
      edgeReports.push({
        edge: `${groupA.id}-${groupB.id}`,
        status: 'failed',
        targetSharedCount,
        reason:
          targetSharedCount === 3
            ? 'No valid 3-cell overlap cluster found'
            : 'No valid 2-cell overlap pair found',
        existingSharedCount: existingShared.length,
        groupASize: groupA.cellSet.size,
        groupBSize: groupB.cellSet.size,
      });

      return {
        ok: false,
        reason: targetSharedCount === 3 ? 'triple-overlap-edge-failed' : 'overlap-edge-failed',
        details: {
          failedEdge: `${groupA.id}-${groupB.id}`,
          targetSharedCount,
          edgeReports,
          edges: edges.map(([a, b], index) => ({
            edge: `${groups[a].id}-${groups[b].id}`,
            targetSharedCount: index === tripleEdgeIndex ? 3 : 2,
          })),
        },
      };
    }

    const scoredCandidates = candidates
      .map((cells) => {
        const sortedCells = [...cells].sort((a, b) => a - b);
        let score = 0;

        sortedCells.forEach((cell) => {
          if (groupA.cellSet.has(cell)) score += 3;
          if (groupB.cellSet.has(cell)) score += 3;
          if (cellUsage[cell] === 0) score += 2;
          if (cellUsage[cell] === 1) score += 1;
          if (cellUsage[cell] === 2) score -= 2;
        });

        score -= Math.abs(
          groupA.cellSet.size +
            sortedCells.filter((cell) => !groupA.cellSet.has(cell)).length -
            6
        );
        score -= Math.abs(
          groupB.cellSet.size +
            sortedCells.filter((cell) => !groupB.cellSet.has(cell)).length -
            6
        );

        return {
          cells: sortedCells,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const chosenCells = scoredCandidates[0].cells;
    const usageKey = chosenCells.join('-');

    overlapUsage.add(usageKey);

    addCellsToGroup(groupA, chosenCells, cellUsage);
    addCellsToGroup(groupB, chosenCells, cellUsage);

    edgeReports.push({
      edge: `${groupA.id}-${groupB.id}`,
      status: 'added',
      targetSharedCount,
      cells: chosenCells,
    });
  }

  return {
    ok: true,
    groups,
    edges,
    tripleEdgeIndex,
    edgeReports,
  };
}

function normaliseGroups(groups) {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    cells: [...group.cellSet]
      .map((index) => {
        const { row, col } = indexToRowCol(index);
        return { row, col };
      })
      .sort((a, b) => a.row - b.row || a.col - b.col),
  }));
}

function validateGroups(groups, edges = null, tripleEdgeIndex = null) {
  const coverage = Array(TOTAL_CELLS).fill(0);

  for (const group of groups) {
    const indices = group.cells.map((cell) => rowColToIndex(cell.row, cell.col));

    if (group.cells.length < 4 || group.cells.length > 7) {
      return {
        ok: false,
        reason: 'group-size-out-of-range',
        details: {
          groupId: group.id,
          size: group.cells.length,
          min: 4,
          max: 7,
        },
      };
    }

    if (!isConnected(indices)) {
      return {
        ok: false,
        reason: 'group-not-connected',
        details: {
          groupId: group.id,
          cells: group.cells,
        },
      };
    }

    indices.forEach((index) => {
      coverage[index] += 1;
    });
  }

  const uncovered = coverage
    .map((count, index) => ({ count, index }))
    .filter((item) => item.count < 1);

  if (uncovered.length) {
    return {
      ok: false,
      reason: 'grid-cell-uncovered',
      details: {
        cells: uncovered.map((item) => ({
          index: item.index,
          ...indexToRowCol(item.index),
        })),
      },
    };
  }

  const overused = coverage
    .map((count, index) => ({ count, index }))
    .filter((item) => item.count > 3);

  if (overused.length) {
    return {
      ok: false,
      reason: 'grid-cell-overused',
      details: {
        cells: overused.map((item) => ({
          index: item.index,
          row: indexToRowCol(item.index).row,
          col: indexToRowCol(item.index).col,
          count: item.count,
        })),
      },
    };
  }

  if (edges && edges.length) {
    let tripleOverlapEdgeCount = 0;
    const overlapParticipation = new Map();

    groups.forEach((group) => {
      overlapParticipation.set(group.id, 0);
    });

    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
      const [groupAIndex, groupBIndex] = edges[edgeIndex];
      const groupA = groups[groupAIndex];
      const groupB = groups[groupBIndex];
      const targetSharedCount = edgeIndex === tripleEdgeIndex ? 3 : 2;

      const aSet = new Set(
        groupA.cells.map((cell) => rowColToIndex(cell.row, cell.col))
      );
      const bSet = new Set(
        groupB.cells.map((cell) => rowColToIndex(cell.row, cell.col))
      );

      const shared = [...aSet].filter((cell) => bSet.has(cell)).sort((a, b) => a - b);

      if (shared.length !== targetSharedCount) {
        return {
          ok: false,
          reason: 'edge-overlap-wrong-size',
          details: {
            edge: `${groupA.id}-${groupB.id}`,
            targetSharedCount,
            sharedCount: shared.length,
            sharedCells: shared.map((index) => ({
              index,
              ...indexToRowCol(index),
            })),
          },
        };
      }

      if (targetSharedCount === 3) {
        if (!hasValidTripleCluster(shared)) {
          return {
            ok: false,
            reason: 'edge-overlap-invalid-triple-cluster',
            details: {
              edge: `${groupA.id}-${groupB.id}`,
              sharedCells: shared.map((index) => ({
                index,
                ...indexToRowCol(index),
              })),
            },
          };
        }

        tripleOverlapEdgeCount += 1;
      } else if (!hasValidSharedPair(shared)) {
        return {
          ok: false,
          reason: 'edge-overlap-no-touching-pair',
          details: {
            edge: `${groupA.id}-${groupB.id}`,
            sharedCount: shared.length,
            sharedCells: shared.map((index) => ({
              index,
              ...indexToRowCol(index),
            })),
          },
        };
      }

      overlapParticipation.set(
        groupA.id,
        (overlapParticipation.get(groupA.id) || 0) + 1
      );
      overlapParticipation.set(
        groupB.id,
        (overlapParticipation.get(groupB.id) || 0) + 1
      );
    }

    if (tripleOverlapEdgeCount !== 1) {
      return {
        ok: false,
        reason: 'triple-overlap-count-invalid',
        details: {
          tripleOverlapEdgeCount,
        },
      };
    }

    const nonParticipatingGroups = [...overlapParticipation.entries()]
      .filter(([, count]) => count < 1)
      .map(([groupId]) => groupId);

    if (nonParticipatingGroups.length) {
      return {
        ok: false,
        reason: 'group-has-no-overlap',
        details: {
          groupIds: nonParticipatingGroups,
        },
      };
    }
  }

  return {
    ok: true,
  };
}

function formatFailureSummary(seed, attempts, failureCounts, lastFailure) {
  const sortedFailureCounts = Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(', ');

  const lastFailureText = lastFailure
    ? JSON.stringify(lastFailure, null, 2)
    : 'No last failure captured';

  return [
    `Failed to generate puzzle for seed "${seed}" after ${attempts} attempts.`,
    sortedFailureCounts
      ? `Failure breakdown -> ${sortedFailureCounts}`
      : 'Failure breakdown -> none recorded',
    `Last failure -> ${lastFailureText}`,
  ].join('\n');
}

export function generatePuzzle(seed = 'topo-test', options = {}) {
  const suppliedPalette = options.palette || null;
  const attemptLimit = options.attemptLimit || 200;

  const failureCounts = {};
  let lastFailure = null;

  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    const attemptSeed = `${seed}-${attempt}`;
    const rng = createRng(attemptSeed);

    try {
      const paletteResult = suppliedPalette
      ? {
          palette: suppliedPalette,
          meta: [],
          minimumDistance: null,
        }
      : generatePaletteWithMeta(rng);

    const palette = paletteResult.palette;
      const answer = buildRegionMap(rng, palette);

      let groups = buildBaseGroups(rng);
      groups = rebalanceGroupSizes(groups, rng);

      const baseNormalised = normaliseGroups(groups);
      const baseValidation = validateGroups(baseNormalised);

      if (!baseValidation.ok && baseValidation.reason !== 'group-size-out-of-range') {
        failureCounts[baseValidation.reason] =
          (failureCounts[baseValidation.reason] || 0) + 1;

        lastFailure = {
          stage: 'base-validation',
          attempt,
          attemptSeed,
          ...baseValidation,
        };

        continue;
      }

      const overlapResult = addPairOverlaps(cloneGroups(groups), rng);

      if (!overlapResult.ok) {
        failureCounts[overlapResult.reason] =
          (failureCounts[overlapResult.reason] || 0) + 1;

        lastFailure = {
          stage: 'add-pair-overlaps',
          attempt,
          attemptSeed,
          reason: overlapResult.reason,
          details: overlapResult.details,
        };

        continue;
      }

      const fragments = normaliseGroups(overlapResult.groups);

      const fragmentValidation = validateGroups(
        fragments,
        overlapResult.edges,
        overlapResult.tripleEdgeIndex
      );

      if (!fragmentValidation.ok) {
        failureCounts[fragmentValidation.reason] =
          (failureCounts[fragmentValidation.reason] || 0) + 1;

        lastFailure = {
          stage: 'fragment-validation',
          attempt,
          attemptSeed,
          ...fragmentValidation,
          edgeReports: overlapResult.edgeReports,
        };

        continue;
      }

      return {
        id: `topo-${seed}`,
        title: `Topo ${seed}`,
        palette,
        answer,
        fragments,
        meta: {
          seed,
          attempt,
          attemptSeed,
          tripleEdgeIndex: overlapResult.tripleEdgeIndex,
          edgeReports: overlapResult.edgeReports,
          palette: paletteResult.meta,
          paletteMinimumDistance: paletteResult.minimumDistance,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const reason = message.includes('Region growth stalled')
        ? 'region-growth-stalled'
        : message.includes('Region colour cap exceeded')
        ? 'region-colour-cap-exceeded'
        : message.includes('Base group growth stalled')
        ? 'base-growth-stalled'
        : 'generation-threw';

      failureCounts[reason] = (failureCounts[reason] || 0) + 1;

      lastFailure = {
        stage: 'generation',
        attempt,
        attemptSeed,
        reason,
        details: {
          message,
        },
      };
    }
  }

  throw new Error(formatFailureSummary(seed, attemptLimit, failureCounts, lastFailure));
}

export function generatePuzzleBatch(count = 10, prefix = 'test', options = {}) {
  return Array.from({ length: count }, (_, index) =>
    generatePuzzle(`${prefix}-${index + 1}`, options)
  );
}