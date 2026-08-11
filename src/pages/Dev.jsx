import { useMemo, useState } from 'react';
import { generatePuzzle, generatePuzzleBatch } from '../utils/generator';
import { GRID_SIZE, rowColToIndex } from '../utils/grid';

function chunkArray(array, size) {
  const rows = [];

  for (let i = 0; i < array.length; i += size) {
    rows.push(array.slice(i, i + size));
  }

  return rows;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbDistance(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  return Math.sqrt(
    (a.r - b.r) ** 2 +
      (a.g - b.g) ** 2 +
      (a.b - b.b) ** 2
  );
}

function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);

  const values = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function getContrastRatio(colorA, colorB) {
  const lumA = getRelativeLuminance(colorA);
  const lumB = getRelativeLuminance(colorB);

  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  return (lighter + 0.05) / (darker + 0.05);
}

function scoreClosestDistance(value) {
  if (value >= 65) return '10/10 Excellent';
  if (value >= 55) return '9/10 Great';
  if (value >= 48) return '8/10 Strong';
  if (value >= 42) return '7/10 Good';
  if (value >= 36) return '6/10 Acceptable';
  if (value >= 30) return '5/10 Weak';
  if (value >= 24) return '4/10 Poor';
  if (value >= 18) return '3/10 Bad';
  if (value >= 10) return '2/10 Very Bad';

  return '1/10 Critical';
}

function scoreContrast(value) {
  if (value >= 1.8) return '10/10 Excellent';
  if (value >= 1.6) return '9/10 Great';
  if (value >= 1.45) return '8/10 Strong';
  if (value >= 1.35) return '7/10 Good';
  if (value >= 1.25) return '6/10 Acceptable';
  if (value >= 1.18) return '5/10 Weak';
  if (value >= 1.12) return '4/10 Poor';
  if (value >= 1.08) return '3/10 Bad';
  if (value >= 1.04) return '2/10 Very Bad';

  return '1/10 Critical';
}

function scoreEdgeCount(value) {
  if (value <= 4) return '10/10 Excellent';
  if (value <= 6) return '9/10 Great';
  if (value <= 8) return '8/10 Strong';
  if (value <= 10) return '7/10 Good';
  if (value <= 12) return '6/10 Acceptable';
  if (value <= 14) return '5/10 Weak';
  if (value <= 16) return '4/10 Poor';
  if (value <= 18) return '3/10 Bad';
  if (value <= 20) return '2/10 Very Bad';

  return '1/10 Critical';
}

function scoreFailureCount(value, total) {
  const ratio = total > 0 ? value / total : 0;

  if (ratio <= 0.01) return '10/10 Excellent';
  if (ratio <= 0.03) return '9/10 Great';
  if (ratio <= 0.05) return '8/10 Strong';
  if (ratio <= 0.08) return '7/10 Good';
  if (ratio <= 0.12) return '6/10 Acceptable';
  if (ratio <= 0.18) return '5/10 Weak';
  if (ratio <= 0.25) return '4/10 Poor';
  if (ratio <= 0.4) return '3/10 Bad';
  if (ratio <= 0.6) return '2/10 Very Bad';

  return '1/10 Critical';
}

function getColourAnalysis(puzzle) {
  const usage = new Map();

  puzzle.palette.forEach((color) => {
    usage.set(color, 0);
  });

  puzzle.answer.forEach((color) => {
    usage.set(color, (usage.get(color) || 0) + 1);
  });

  const usageRows = puzzle.palette.map((color, index) => ({
    index,
    color,
    count: usage.get(color) || 0,
    percentage: Number((((usage.get(color) || 0) / puzzle.answer.length) * 100).toFixed(1)),
  }));

  const counts = usageRows.map((row) => row.count);
  const unusedColours = usageRows.filter((row) => row.count === 0);
  const overLimitColours = usageRows.filter((row) => row.count > 5);

  const pairDistances = [];
  const pairContrasts = [];

  for (let i = 0; i < puzzle.palette.length; i += 1) {
    for (let j = i + 1; j < puzzle.palette.length; j += 1) {
      pairDistances.push({
        pair: [puzzle.palette[i], puzzle.palette[j]],
        indexes: [i, j],
        distance: Number(rgbDistance(puzzle.palette[i], puzzle.palette[j]).toFixed(2)),
      });

      pairContrasts.push({
        pair: [puzzle.palette[i], puzzle.palette[j]],
        indexes: [i, j],
        contrast: Number(getContrastRatio(puzzle.palette[i], puzzle.palette[j]).toFixed(2)),
      });
    }
  }

  const sortedDistances = [...pairDistances].sort((a, b) => a.distance - b.distance);
  const sortedContrasts = [...pairContrasts].sort((a, b) => a.contrast - b.contrast);

  const adjacentSameColourEdges = [];

  puzzle.answer.forEach((color, index) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;

    const rightIndex = col < GRID_SIZE - 1 ? index + 1 : null;
    const downIndex = row < GRID_SIZE - 1 ? index + GRID_SIZE : null;

    if (rightIndex !== null && puzzle.answer[rightIndex] === color) {
      adjacentSameColourEdges.push([index, rightIndex]);
    }

    if (downIndex !== null && puzzle.answer[downIndex] === color) {
      adjacentSameColourEdges.push([index, downIndex]);
    }
  });

  return {
    usageRows,
    uniqueColourCount: usageRows.filter((row) => row.count > 0).length,
    minUsage: Math.min(...counts),
    maxUsage: Math.max(...counts),
    unusedColours,
    overLimitColours,
    closestColourPair: sortedDistances[0] || null,
    lowestContrastPair: sortedContrasts[0] || null,
    averagePairDistance: Number(
      (
        pairDistances.reduce((total, row) => total + row.distance, 0) /
        Math.max(pairDistances.length, 1)
      ).toFixed(2)
    ),
    averagePairContrast: Number(
      (
        pairContrasts.reduce((total, row) => total + row.contrast, 0) /
        Math.max(pairContrasts.length, 1)
      ).toFixed(2)
    ),
    adjacentSameColourEdges,
    adjacentSameColourEdgeCount: adjacentSameColourEdges.length,
  };
}

function getFragmentIndexSet(fragment) {
  return new Set(
    fragment.cells.map((cell) => rowColToIndex(cell.row, cell.col))
  );
}

function getSharedIndices(fragmentA, fragmentB) {
  const aSet = getFragmentIndexSet(fragmentA);
  const bSet = getFragmentIndexSet(fragmentB);

  return [...aSet]
    .filter((index) => bSet.has(index))
    .sort((a, b) => a - b);
}

function analyseFragmentsOverview(fragments, edgeReports = []) {
  const reportMap = new Map();

  edgeReports.forEach((report) => {
    if (!report?.edge) {
      return;
    }

    reportMap.set(report.edge, report);
  });

  return fragments.map((fragment) => {
    let overlapPartnerCount = 0;
    let totalSharedCellsAcrossPartners = 0;
    let hasTripleEdge = false;

    fragments.forEach((otherFragment) => {
      if (otherFragment.id === fragment.id) {
        return;
      }

      const shared = getSharedIndices(fragment, otherFragment);

      if (!shared.length) {
        return;
      }

      overlapPartnerCount += 1;
      totalSharedCellsAcrossPartners += shared.length;

      const edgeKeyA = `${fragment.id}-${otherFragment.id}`;
      const edgeKeyB = `${otherFragment.id}-${fragment.id}`;
      const edgeReport = reportMap.get(edgeKeyA) || reportMap.get(edgeKeyB) || null;

      if (edgeReport?.targetSharedCount === 3) {
        hasTripleEdge = true;
      }
    });

    return {
      id: fragment.id,
      label: fragment.label,
      cellCount: fragment.cells.length,
      overlapPartnerCount,
      totalSharedCellsAcrossPartners,
      hasTripleEdge,
    };
  });
}

function AnswerGrid({ answer, cellSize = 40 }) {
  const rows = useMemo(() => chunkArray(answer, GRID_SIZE), [answer]);

  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
            gap: '6px',
          }}
        >
          {row.map((color, index) => (
            <div
              key={`${rowIndex}-${index}`}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: color,
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ColourSwatch({ color, size = 28 }) {
  return (
    <span
      title={color}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        backgroundColor: color,
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.2)',
        verticalAlign: 'middle',
      }}
    />
  );
}

function ColourAnalysisPanel({ analysis }) {
  return (
    <div
      style={{
        background: '#1f1f1f',
        padding: '16px',
        borderRadius: '12px',
        marginTop: '20px',
        marginBottom: '24px',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Colour Analysis</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>Unique colours: {analysis.uniqueColourCount}</div>
        <div>Min usage: {analysis.minUsage}</div>
        <div>Max usage: {analysis.maxUsage}</div>
        <div>Unused colours: {analysis.unusedColours.length}</div>
        <div>Colours over cap: {analysis.overLimitColours.length}</div>
        <div>Same-colour edges: {analysis.adjacentSameColourEdgeCount}</div>
        <div>Average RGB distance: {analysis.averagePairDistance}</div>
        <div>Average contrast: {analysis.averagePairContrast}</div>
      </div>

      <h4>Palette Usage</h4>

      <div style={{ display: 'grid', gap: '8px' }}>
        {analysis.usageRows.map((row) => (
          <div
            key={row.color}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 90px 1fr',
              gap: '10px',
              alignItems: 'center',
              fontSize: '14px',
            }}
          >
            <ColourSwatch color={row.color} />
            <code>{row.color}</code>
            <span>
              {row.count} cells / {row.percentage}%
            </span>
          </div>
        ))}
      </div>

      {analysis.closestColourPair && (
        <div style={{ marginTop: '20px' }}>
          <h4>Closest Colour Pair</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <ColourSwatch color={analysis.closestColourPair.pair[0]} />
            <ColourSwatch color={analysis.closestColourPair.pair[1]} />
            <span>
              Distance: {analysis.closestColourPair.distance} | Indexes:{' '}
              {analysis.closestColourPair.indexes.join(', ')}
            </span>
          </div>
        </div>
      )}

      {analysis.lowestContrastPair && (
        <div style={{ marginTop: '20px' }}>
          <h4>Lowest Contrast Pair</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <ColourSwatch color={analysis.lowestContrastPair.pair[0]} />
            <ColourSwatch color={analysis.lowestContrastPair.pair[1]} />
            <span>
              Contrast: {analysis.lowestContrastPair.contrast} | Indexes:{' '}
              {analysis.lowestContrastPair.indexes.join(', ')}
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h4>Raw Colour Report</h4>
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '280px', overflow: 'auto' }}>
          {JSON.stringify(analysis, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function FragmentGrid({ fragment, answer, cellSize = 28 }) {
  const fragmentLookup = new Map();

  fragment.cells.forEach((cell) => {
    const index = rowColToIndex(cell.row, cell.col);
    fragmentLookup.set(`${cell.row}-${cell.col}`, answer[index]);
  });

  const cells = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const key = `${row}-${col}`;
      const color = fragmentLookup.get(key) || null;

      cells.push(
        <div
          key={key}
          title={key}
          style={{
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            backgroundColor: color || 'transparent',
            borderRadius: '4px',
            border: color
              ? '1px solid rgba(255,255,255,0.18)'
              : '1px dashed rgba(255,255,255,0.08)',
            boxSizing: 'border-box',
          }}
        />
      );
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
        gap: '4px',
      }}
    >
      {cells}
    </div>
  );
}

function FragmentOverviewStats({ stats }) {
  return (
    <div
      style={{
        background: '#151515',
        padding: '10px',
        borderRadius: '10px',
        marginTop: '10px',
        fontSize: '13px',
        display: 'grid',
        gap: '4px',
      }}
    >
      <div>Cells: {stats.cellCount}</div>
      <div>Overlap partners: {stats.overlapPartnerCount}</div>
      <div>Total shared cells: {stats.totalSharedCellsAcrossPartners}</div>
      <div>Triple overlap edge: {stats.hasTripleEdge ? 'Yes' : 'No'}</div>
    </div>
  );
}

function Dev() {
  const [seed, setSeed] = useState('dev-1');
  const [count, setCount] = useState(200);
  const [prefix, setPrefix] = useState('dev');
  const [attemptLimit, setAttemptLimit] = useState(50);

  const [singleResult, setSingleResult] = useState(null);
  const [batchSummary, setBatchSummary] = useState(null);
  const [batchPreview, setBatchPreview] = useState(null);
  const [error, setError] = useState('');

  const runSingle = () => {
    try {
      const puzzle = generatePuzzle(seed, { attemptLimit: Number(attemptLimit) });

      setSingleResult(puzzle);
      setError('');
    } catch (err) {
      setSingleResult(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runMany = () => {
    const total = Number(count);

    const results = {
      total,
      success: 0,
      failed: 0,
      failedSeeds: [],
      successSeeds: [],
      stats: {
        averageAttempt: 0,
        highestAttempt: 0,
        zeroAttemptCount: 0,
        over10: [],
        over25: [],
        over50: [],
        distribution: {},
      },
      colourStats: {
        averageClosestDistance: 0,
        averageLowestContrast: 0,
        lowestClosestDistance: null,
        lowestContrast: null,
        highestSameColourEdges: null,
        maxUsageOverLimitSeeds: [],
        unusedColourSeeds: [],
        closestDistanceUnder40: [],
        contrastUnder12: [],
      },
    };

    let totalAttempts = 0;
    let totalClosestDistance = 0;
    let totalLowestContrast = 0;

    for (let i = 0; i < total; i += 1) {
      const runSeed = `${prefix}-${i + 1}`;

      try {
        const puzzle = generatePuzzle(runSeed, {
          attemptLimit: Number(attemptLimit),
        });

        const attempt = puzzle?.meta?.attempt ?? 0;
        const colourAnalysis = getColourAnalysis(puzzle);
        const closestDistance = colourAnalysis.closestColourPair?.distance ?? 0;
        const lowestContrast = colourAnalysis.lowestContrastPair?.contrast ?? 0;

        results.success += 1;

        results.successSeeds.push({
          seed: runSeed,
          attempt,
        });

        totalAttempts += attempt;
        totalClosestDistance += closestDistance;
        totalLowestContrast += lowestContrast;

        if (attempt === 0) {
          results.stats.zeroAttemptCount += 1;
        }

        if (attempt > results.stats.highestAttempt) {
          results.stats.highestAttempt = attempt;
        }

        if (attempt > 10) {
          results.stats.over10.push({
            seed: runSeed,
            attempt,
          });
        }

        if (attempt > 25) {
          results.stats.over25.push({
            seed: runSeed,
            attempt,
          });
        }

        if (attempt > 50) {
          results.stats.over50.push({
            seed: runSeed,
            attempt,
          });
        }

        const bucket =
          attempt <= 0
            ? '0'
            : attempt <= 5
            ? '1-5'
            : attempt <= 10
            ? '6-10'
            : attempt <= 25
            ? '11-25'
            : attempt <= 50
            ? '26-50'
            : '51+';

        results.stats.distribution[bucket] =
          (results.stats.distribution[bucket] || 0) + 1;

        const colourSummary = {
          seed: runSeed,
          attempt,
          closestColourPair: colourAnalysis.closestColourPair,
          lowestContrastPair: colourAnalysis.lowestContrastPair,
          adjacentSameColourEdgeCount: colourAnalysis.adjacentSameColourEdgeCount,
          minUsage: colourAnalysis.minUsage,
          maxUsage: colourAnalysis.maxUsage,
          unusedColours: colourAnalysis.unusedColours,
          overLimitColours: colourAnalysis.overLimitColours,
        };

        if (
          !results.colourStats.lowestClosestDistance ||
          closestDistance < results.colourStats.lowestClosestDistance.closestColourPair.distance
        ) {
          results.colourStats.lowestClosestDistance = colourSummary;
        }

        if (
          !results.colourStats.lowestContrast ||
          lowestContrast < results.colourStats.lowestContrast.lowestContrastPair.contrast
        ) {
          results.colourStats.lowestContrast = colourSummary;
        }

        if (
          !results.colourStats.highestSameColourEdges ||
          colourAnalysis.adjacentSameColourEdgeCount >
            results.colourStats.highestSameColourEdges.adjacentSameColourEdgeCount
        ) {
          results.colourStats.highestSameColourEdges = colourSummary;
        }

        if (colourAnalysis.overLimitColours.length) {
          results.colourStats.maxUsageOverLimitSeeds.push(colourSummary);
        }

        if (colourAnalysis.unusedColours.length) {
          results.colourStats.unusedColourSeeds.push(colourSummary);
        }

        if (closestDistance < 40) {
          results.colourStats.closestDistanceUnder40.push(colourSummary);
        }

        if (lowestContrast < 1.2) {
          results.colourStats.contrastUnder12.push(colourSummary);
        }
      } catch (err) {
        results.failed += 1;

        results.failedSeeds.push({
          seed: runSeed,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    results.stats.averageAttempt =
      results.success > 0
        ? Number((totalAttempts / results.success).toFixed(2))
        : 0;

    results.colourStats.averageClosestDistance =
      results.success > 0
        ? Number((totalClosestDistance / results.success).toFixed(2))
        : 0;

    results.colourStats.averageLowestContrast =
      results.success > 0
        ? Number((totalLowestContrast / results.success).toFixed(2))
        : 0;

    setBatchSummary(results);
    setError('');
  };

  const runBatchPreview = () => {
    try {
      const batch = generatePuzzleBatch(Number(count), prefix, {
        attemptLimit: Number(attemptLimit),
      });

      setBatchPreview(batch);
      setError('');
    } catch (err) {
      setBatchPreview(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const singleColourAnalysis = singleResult ? getColourAnalysis(singleResult) : null;

  return (
    <div style={{ padding: '24px', color: '#fff' }}>
      <h1>Generator Dev</h1>

      <div
        style={{
          display: 'grid',
          gap: '12px',
          maxWidth: '720px',
          marginTop: '24px',
          marginBottom: '32px',
        }}
      >
        <label style={{ display: 'grid', gap: '6px' }}>
          <span>Single seed</span>
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          <span>Prefix</span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          <span>Count</span>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          <span>Attempt limit</span>
          <input
            type="number"
            value={attemptLimit}
            onChange={(e) => setAttemptLimit(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px' }}
          />
        </label>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={runSingle} style={{ padding: '10px 14px' }}>
            Run single seed
          </button>

          <button onClick={runMany} style={{ padding: '10px 14px' }}>
            Run multiple seeds
          </button>

          <button onClick={runBatchPreview} style={{ padding: '10px 14px' }}>
            Run batch preview
          </button>
        </div>
      </div>

      {error && (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: '#1f1f1f',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '24px',
          }}
        >
          {error}
        </pre>
      )}

      {singleResult && (
        <section style={{ marginBottom: '40px' }}>
          <h2>{singleResult.title}</h2>
          <p>
            Seed: {singleResult.meta?.seed} | Attempt: {singleResult.meta?.attempt}
          </p>

          <div style={{ marginTop: '20px', marginBottom: '24px' }}>
            <h3>Answer</h3>
            <AnswerGrid answer={singleResult.answer} />
          </div>

          {singleColourAnalysis && (
            <ColourAnalysisPanel analysis={singleColourAnalysis} />
          )}

          <div style={{ marginTop: '20px' }}>
            <h3>Fragments</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginTop: '16px',
              }}
            >
              {singleResult.fragments.map((fragment) => (
                <div
                  key={fragment.id}
                  style={{
                    background: '#1f1f1f',
                    padding: '16px',
                    borderRadius: '12px',
                  }}
                >
                  <p style={{ marginTop: 0, marginBottom: '12px' }}>
                    {fragment.label}
                  </p>
                  <FragmentGrid fragment={fragment} answer={singleResult.answer} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {batchSummary && (
        <section style={{ marginBottom: '40px' }}>
          <h2>Multiple run summary</h2>

          <div
            style={{
              background: '#1f1f1f',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '16px',
            }}
          >
            <p>Total: {batchSummary.total}</p>
            <p>Success: {batchSummary.success}</p>
            <p>Failed: {batchSummary.failed}</p>
          </div>

          <div
            style={{
              background: '#1f1f1f',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Generation Stats</h3>

            <p>Average attempt: {batchSummary.stats.averageAttempt}</p>
            <p>Highest attempt: {batchSummary.stats.highestAttempt}</p>
            <p>Zero-attempt solves: {batchSummary.stats.zeroAttemptCount}</p>

            <div style={{ marginTop: '16px' }}>
              <h4>Distribution</h4>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(batchSummary.stats.distribution, null, 2)}
              </pre>
            </div>
          </div>

          <div
            style={{
              background: '#1f1f1f',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '16px',
            }}
          >
            
            <h3 style={{ marginTop: 0 }}>Batch Colour Stats</h3>

<pre
  style={{
    whiteSpace: 'pre-wrap',
    background: '#151515',
    padding: '16px',
    borderRadius: '10px',
    overflow: 'auto',
    fontSize: '14px',
    lineHeight: 1.5,
  }}
>
{`COLOUR HEALTH REPORT

Overall Score
${batchSummary.colourStats.healthScore ?? 'N/A'}/10

Average Closest Distance
${batchSummary.colourStats.averageClosestDistance}
Score: ${
  batchSummary.colourStats.averageClosestDistance >= 60
    ? '10/10 — Excellent'
    : batchSummary.colourStats.averageClosestDistance >= 45
    ? '8/10 — Good'
    : batchSummary.colourStats.averageClosestDistance >= 35
    ? '6/10 — Playable'
    : batchSummary.colourStats.averageClosestDistance >= 25
    ? '4/10 — Weak'
    : '2/10 — Poor'
}

Worst Closest Distance
${
  batchSummary.colourStats.lowestClosestDistance
    ?.closestColourPair?.distance ?? 'N/A'
}
Score: ${
  (batchSummary.colourStats.lowestClosestDistance
    ?.closestColourPair?.distance ?? 0) >= 45
    ? '10/10 — Excellent'
    : (batchSummary.colourStats.lowestClosestDistance
        ?.closestColourPair?.distance ?? 0) >= 35
    ? '8/10 — Good'
    : (batchSummary.colourStats.lowestClosestDistance
        ?.closestColourPair?.distance ?? 0) >= 25
    ? '6/10 — Playable'
    : (batchSummary.colourStats.lowestClosestDistance
        ?.closestColourPair?.distance ?? 0) >= 18
    ? '4/10 — Weak'
    : '2/10 — Poor'
}

Palette Distance Notes
Distance is the useful colour readability metric for Topo.
Contrast has been removed from scoring because it is mainly a text-readability metric and can mark different-hue colours as poor even when they are playable.

Closest Distance Under 35
${
  batchSummary.colourStats.closestDistanceUnder40?.length
    ? batchSummary.colourStats.closestDistanceUnder40
        .filter((item) => {
          const distance = item.closestColourPair?.distance ?? 999;
          return distance < 35;
        })
        .map((item) => {
          const pair = item.closestColourPair;

          return `${item.seed ?? 'Unknown seed'} — distance ${pair?.distance ?? 'N/A'}`;
        })
        .join('\n') || 'None'
    : 'None'
}

Map Structure Notes

Highest Same-Colour Edges
${
  batchSummary.colourStats.highestSameColourEdges
    ?.adjacentSameColourEdgeCount ?? 'N/A'
}

This is not scored as palette health.
Same-colour edges are expected because each colour grows as a region on the board.
Use this only to judge map clustering, not whether the palette is good.

Debug Only

Average Lowest Contrast
${batchSummary.colourStats.averageLowestContrast ?? 'N/A'}

Worst Lowest Contrast
${
  batchSummary.colourStats.lowestContrast
    ?.lowestContrastPair?.contrast ?? 'N/A'
}

Lowest Contrast Under 2
${batchSummary.colourStats.lowestContrastUnder2 ?? 'N/A'}
`}
</pre>

          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: '#1f1f1f',
                padding: '16px',
                borderRadius: '12px',
              }}
            >
              <h3>Success seeds</h3>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '500px', overflow: 'auto' }}>
                {JSON.stringify(batchSummary.successSeeds, null, 2)}
              </pre>
            </div>

            <div
              style={{
                background: '#1f1f1f',
                padding: '16px',
                borderRadius: '12px',
              }}
            >
              <h3>Failed seeds</h3>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '500px', overflow: 'auto' }}>
                {JSON.stringify(batchSummary.failedSeeds, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}

      {batchPreview && (
        <section>
          <h2>Batch preview</h2>
          <p>Generated: {batchPreview.length} puzzles</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            {batchPreview.map((puzzle) => {
              const fragmentStats = analyseFragmentsOverview(
                puzzle.fragments,
                puzzle.meta?.edgeReports || []
              );

              const colourAnalysis = getColourAnalysis(puzzle);

              return (
                <div
                  key={puzzle.id}
                  style={{
                    background: '#1f1f1f',
                    padding: '16px',
                    borderRadius: '12px',
                    // display: 'none',
                  }}
                >
                  
                  <h3 style={{ marginTop: 0 }}>{puzzle.title}</h3>

                  <div style={{ display: 'none', }}>
                  <p>Attempt: {puzzle.meta?.attempt}</p>
                  <p>
                    Closest colour distance:{' '}
                    {colourAnalysis.closestColourPair?.distance}
                  </p>
                  <p>
                    Lowest contrast:{' '}
                    {colourAnalysis.lowestContrastPair?.contrast}
                  </p>
                  <p>
                    Same-colour edges:{' '}
                    {colourAnalysis.adjacentSameColourEdgeCount}
                  </p>
                  </div>


                  <div style={{ marginBottom: '16px' }}>
  <AnswerGrid answer={puzzle.answer} cellSize={24} />
</div>

<div
  style={{
    background: '#151515',
    borderRadius: '10px',
    padding: '12px',
    display: 'grid',
    gap: '10px',
    fontSize: '12px',
    lineHeight: 1.4,
  }}
>
  <strong>Palette Used</strong>

  {puzzle.palette.map((colour, index) => {
    const meta = puzzle.meta?.palette?.[index] || null;

    return (
      <div
        key={`${puzzle.id}-palette-${index}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '5px',
            backgroundColor: colour,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />

        <div>
          <div>
            <strong>#{index + 1}</strong>
            {' — '}
            <strong>{meta?.group || 'No group meta found'}</strong>
          </div>

          <div>
            Final Hex: <code>{colour}</code>
          </div>

          <div>
            Base Hex: <code>{meta?.baseColour || 'N/A'}</code>
          </div>

          <div>
            Meta Final: <code>{meta?.finalColour || 'N/A'}</code>
          </div>
        </div>
      </div>
    );
  })}

  <pre
    style={{
      whiteSpace: 'pre-wrap',
      background: '#101010',
      padding: '10px',
      borderRadius: '8px',
      maxHeight: '180px',
      overflow: 'auto',
      margin: 0,
    }}
  >
    {JSON.stringify(puzzle.meta?.palette || [], null, 2)}
  </pre>
</div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '12px',
                      // display: 'none',
                    }}
                  >
                    {puzzle.fragments.map((fragment, index) => (
                      <div key={fragment.id}>
                        <p style={{ marginTop: 0, marginBottom: '8px', fontSize: '14px' }}>
                          {fragment.label}
                        </p>

                        <FragmentGrid
                          fragment={fragment}
                          answer={puzzle.answer}
                          cellSize={16}
                        />

                        <FragmentOverviewStats stats={fragmentStats[index]} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default Dev;