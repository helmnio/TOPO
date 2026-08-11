export const DAILY_PLAY_SESSION_STORAGE_KEY = 'topo:daily-play-session';
export const RANDOM_PLAY_SESSION_STORAGE_KEY = 'topo:random-play-session';

function getStorageKey(gameMode = 'daily') {
  return gameMode === 'random'
    ? RANDOM_PLAY_SESSION_STORAGE_KEY
    : DAILY_PLAY_SESSION_STORAGE_KEY;
}

export function loadPlaySession(gameMode = 'daily') {
  try {
    const raw = localStorage.getItem(getStorageKey(gameMode));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load play session:', error);
    return null;
  }
}

export function savePlaySession(session) {
  try {
    const storageKey = getStorageKey(session?.gameMode);

    localStorage.setItem(storageKey, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save play session:', error);
  }
}

export function clearPlaySession(gameMode = 'daily') {
  try {
    localStorage.removeItem(getStorageKey(gameMode));
  } catch (error) {
    console.error('Failed to clear play session:', error);
  }
}