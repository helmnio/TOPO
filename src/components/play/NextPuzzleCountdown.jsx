import { useEffect, useState } from 'react';

function getMillisecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);

  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);

  return Math.max(0, midnight.getTime() - now.getTime());
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));

  if (totalSeconds <= 10 * 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  const totalMinutes = Math.ceil(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function useCountdown() {
  const [remaining, setRemaining] = useState(getMillisecondsUntilMidnight);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining(getMillisecondsUntilMidnight());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return formatCountdown(remaining);
}

export function CompactNextPuzzleCountdown() {
  const countdown = useCountdown();

  return <span>Next TOPO · {countdown}</span>;
}
