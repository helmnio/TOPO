import { generatePuzzle, generatePuzzleBatch } from '../utils/generator';
import { GRID_SIZE } from '../utils/grid';

function chunkArray(array, size) {
  const rows = [];

  for (let i = 0; i < array.length; i += size) {
    rows.push(array.slice(i, i + size));
  }

  return rows;
}

function printAnswerGrid(answer) {
  const rows = chunkArray(answer, GRID_SIZE);

  console.log('--- ANSWER GRID ---');

  rows.forEach((row, rowIndex) => {
    console.log(`row ${rowIndex}:`, row);
  });
}

function printFragments(fragments) {
  console.log('--- FRAGMENTS ---');

  fragments.forEach((fragment) => {
    console.log(`${fragment.id} (${fragment.cells.length} cells)`);
    console.log(fragment.cells);
  });
}

export function testSeed(seed = 'dev-1', options = {}) {
  try {
    const puzzle = generatePuzzle(seed, options);

    console.group(`✅ Generated seed: ${seed}`);
    console.log('Puzzle object:', puzzle);
    printAnswerGrid(puzzle.answer);
    printFragments(puzzle.fragments);
    console.log('Meta:', puzzle.meta || null);
    console.groupEnd();

    return puzzle;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.group(`❌ Failed seed: ${seed}`);
    console.error(message);
    console.groupEnd();

    return null;
  }
}

export function testManySeeds(count = 50, prefix = 'dev', options = {}) {
  const results = {
    total: count,
    success: 0,
    failed: 0,
    failedSeeds: [],
    successSeeds: [],
  };

  for (let i = 0; i < count; i += 1) {
    const seed = `${prefix}-${i + 1}`;

    try {
      const puzzle = generatePuzzle(seed, options);

      results.success += 1;
      results.successSeeds.push({
        seed,
        attempt: puzzle?.meta?.attempt ?? null,
        attemptSeed: puzzle?.meta?.attemptSeed ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.failed += 1;
      results.failedSeeds.push({
        seed,
        error: message,
      });
    }
  }

  console.group(`Batch test: ${prefix} x ${count}`);
  console.log('Summary:', {
    total: results.total,
    success: results.success,
    failed: results.failed,
  });
  console.log('Successful seeds:', results.successSeeds);
  console.log('Failed seeds:', results.failedSeeds);
  console.groupEnd();

  return results;
}

export function testBatch(count = 12, prefix = 'dev', options = {}) {
  try {
    const batch = generatePuzzleBatch(count, prefix, options);

    console.group(`✅ Generated batch: ${prefix} x ${count}`);
    console.log(batch);
    console.groupEnd();

    return batch;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.group(`❌ Batch failed: ${prefix} x ${count}`);
    console.error(message);
    console.groupEnd();

    return null;
  }
}