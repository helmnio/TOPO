export function formatShareDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getFailShareGrid(correctTiles, totalTiles = 25) {
  const percent = totalTiles > 0
    ? correctTiles / totalTiles
    : 0;

  if (percent >= 1) {
    return '🟩🟩\n🟩🟩';
  }

  if (percent >= 0.75) {
    return '🟥🟩\n🟩🟩';
  }

  if (percent >= 0.5) {
    return '🟥🟥\n🟩🟩';
  }

  if (percent >= 0.25) {
    return '🟥🟥\n🟥🟩';
  }

  return '🟥🟥\n🟥🟥';
}

export function getWinShareText({
  date = new Date(),
  time,
  streak,
  averageTime,
}) {
  return `TOPO ${formatShareDate(date)}
🟩🟩
🟩🟩

Mapped in ${time}
Streak: ${streak}
Avg: ${averageTime}`;
}

export function getFailShareText({
  date = new Date(),
  correctTiles,
  totalTiles = 25,
  streakLost,
  averageTime,
}) {
  return `TOPO ${formatShareDate(date)}
${getFailShareGrid(correctTiles, totalTiles)}

${correctTiles}/${totalTiles} mapped
Streak lost: ${streakLost}
Avg: ${averageTime}`;
}

export function getStatsShareText({
  mapsBuilt,
  winRate,
  totalCorrectTiles,
  totalTiles,
  bestStreak,
  averageTime,
}) {
  return `TOPO Stats
🟦🟩
🟩🟫

Maps built: ${mapsBuilt}
Win rate: ${winRate}%
Tiles correct: ${totalCorrectTiles}/${totalTiles}
Best streak: ${bestStreak}
Avg: ${averageTime}`;
}

export async function copyShareText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', '');

  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  const successful = document.execCommand('copy');

  document.body.removeChild(textarea);

  return successful;
}