import { generatePuzzle } from '../utils/generator';
import { DAILY_PUZZLE_VERSIONS } from './puzzleVersions';

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getDailyVersion(dateKey = getLocalDateKey()) {
  return DAILY_PUZZLE_VERSIONS[dateKey] || null;
}

export function getDailySeed(dateKey = getLocalDateKey()) {
  const version = getDailyVersion(dateKey);

  if (!version) {
    return `daily-${dateKey}`;
  }

  return `daily-${dateKey}-v${version}`;
}

export function getExampleSeed() {
  return 'example-topo-v1';
}

export function getDailyPuzzle(dateKey = getLocalDateKey()) {
  return generatePuzzle(getDailySeed(dateKey));
}

export function getExamplePuzzle() {
  return generatePuzzle(getExampleSeed());
}

export function getRandomPuzzle() {
  const seed = [
    Date.now(),
    performance.now(),
    Math.random(),
    Math.random(),
    Math.random(),
  ].join('-');

  return generatePuzzle(seed);
}