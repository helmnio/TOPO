import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTestFragmentRotations,
  getTestLandmarks,
  TEST_LANDMARK_ICONS,
} from './testLandmarks.js';

test('Test fragment rotations are deterministic quarter turns', () => {
  const puzzle = {
    id: 'rotation-test',
    meta: { seed: 'rotation-seed' },
    fragments: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  };

  const first = getTestFragmentRotations(puzzle);
  const second = getTestFragmentRotations(puzzle);

  assert.deepEqual(first, second);
  Object.values(first).forEach((rotation) => {
    assert.equal(Number.isInteger(rotation), true);
    assert.equal(rotation >= 0 && rotation <= 3, true);
  });
});

test('the Test catalogue contains two unique icons for all 20 palette groups', () => {
  const groups = Object.keys(TEST_LANDMARK_ICONS);
  const icons = Object.values(TEST_LANDMARK_ICONS).flat();

  assert.equal(groups.length, 20);
  groups.forEach((group) => {
    assert.equal(TEST_LANDMARK_ICONS[group].length, 2);
  });
  assert.equal(icons.length, 40);
  assert.equal(new Set(icons).size, 40);
});

test('landmarks are selected only from groups and colours used by the board', () => {
  const puzzle = {
    id: 'test-puzzle',
    answer: [
      ...Array(5).fill('#111111'),
      ...Array(5).fill('#222222'),
      ...Array(5).fill('#333333'),
      ...Array(5).fill('#444444'),
      ...Array(3).fill('#555555'),
      ...Array(2).fill('#666666'),
    ],
    fragments: [
      {
        id: 'fragment-a',
        cells: Array.from({ length: 25 }, (_, index) => ({
          row: Math.floor(index / 5),
          col: index % 5,
        })),
      },
      {
        id: 'fragment-b',
        cells: Array.from({ length: 25 }, (_, index) => ({
          row: Math.floor(index / 5),
          col: index % 5,
        })),
      },
    ],
    meta: {
      seed: 'landmark-test',
      palette: [
        { group: 'dark-green', finalColour: '#111111' },
        { group: 'light-blue', finalColour: '#222222' },
        { group: 'mid-brown', finalColour: '#333333' },
        { group: 'pale-grey', finalColour: '#444444' },
        { group: 'mid-sand', finalColour: '#555555' },
        { group: 'pale-green', finalColour: '#666666' },
        { group: 'dark-grey', finalColour: '#777777' },
      ],
    },
  };

  const landmarks = getTestLandmarks(puzzle);

  assert.equal(landmarks.length, 6);
  assert.deepEqual(
    new Set(landmarks.map((landmark) => landmark.group)),
    new Set([
      'dark-green',
      'light-blue',
      'mid-brown',
      'pale-grey',
      'mid-sand',
      'pale-green',
    ])
  );
  landmarks.forEach((landmark) => {
    assert.equal(puzzle.answer[landmark.answerIndex], landmark.color);
    assert.notEqual(landmark.fragmentId, landmark.hintFragmentId);
  });
  assert.equal(
    landmarks.filter((landmark) => landmark.hintFragmentId).length >= 3,
    true
  );
});
