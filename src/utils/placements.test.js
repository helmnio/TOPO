import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampPlacement,
  findPlacementAt,
  getCentredPlacement,
  getConflictCells,
  getRotatedPlacement,
  paintPlacements,
} from './placements.js';

// 5x5 answer where every square's colour is its own index.
const answer = Array.from({ length: 25 }, (_, index) => `c${index}`);

// Two squares side by side (answer squares 0 and 1) and a 2x2 block.
const fragments = [
  {
    id: 'bar',
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ],
  },
  {
    id: 'block',
    cells: [
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ],
  },
];

test('paintPlacements paints every placed square and leaves the rest empty', () => {
  const map = paintPlacements(
    [{ id: 'bar', row: 2, col: 3, rotation: 0 }],
    fragments,
    answer
  );

  assert.equal(map[2 * 5 + 3], 'c0');
  assert.equal(map[2 * 5 + 4], 'c1');
  assert.equal(map.filter(Boolean).length, 2);
});

test('a quarter turn changes the footprint from wide to tall', () => {
  const map = paintPlacements(
    [{ id: 'bar', row: 0, col: 0, rotation: 1 }],
    fragments,
    answer
  );

  assert.notEqual(map[0], null);
  assert.notEqual(map[5], null);
  assert.equal(map[1], null);
});

test('later placements paint on top of earlier ones', () => {
  const map = paintPlacements(
    [
      { id: 'bar', row: 0, col: 0, rotation: 0 },
      { id: 'block', row: 0, col: 0, rotation: 0 },
    ],
    fragments,
    answer
  );

  assert.equal(map[0], 'c6');
  assert.equal(map[1], 'c7');
});

test('findPlacementAt returns only the topmost fragment on an overlap', () => {
  const placements = [
    { id: 'bar', row: 0, col: 0, rotation: 0 },
    { id: 'block', row: 0, col: 0, rotation: 0 },
  ];

  assert.equal(findPlacementAt(placements, 0, fragments, answer).id, 'block');
  assert.equal(findPlacementAt(placements, 12, fragments, answer), null);
});

test('getConflictCells flags squares where fragments disagree only', () => {
  const overlapping = [
    { id: 'bar', row: 0, col: 0, rotation: 0 },
    { id: 'block', row: 0, col: 0, rotation: 0 },
  ];

  assert.deepEqual([...getConflictCells(overlapping, fragments, answer)], [0, 1]);

  const apart = [
    { id: 'bar', row: 0, col: 0, rotation: 0 },
    { id: 'block', row: 2, col: 2, rotation: 0 },
  ];

  assert.equal(getConflictCells(apart, fragments, answer).size, 0);
});

test('placement helpers keep fragments inside the grid', () => {
  const wide = [[{}, {}]];
  const tall = [[{}], [{}]];

  assert.deepEqual(clampPlacement({ row: -3, col: 9 }, wide), {
    row: 0,
    col: 3,
  });
  assert.deepEqual(getCentredPlacement(wide), { row: 2, col: 1 });
  assert.deepEqual(getRotatedPlacement({ row: 2, col: 4 }, wide, tall), {
    row: 2,
    col: 4,
  });
});
