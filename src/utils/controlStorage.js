const CONTROL_PUZZLES_KEY = 'topo:control-puzzles';

export function loadControlOverrides() {
  try {
    const raw = localStorage.getItem(CONTROL_PUZZLES_KEY);

    if (!raw) {
      return {};
    }

    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveControlOverride(dateKey, puzzle) {
  const existing = loadControlOverrides();

  existing[dateKey] = puzzle;

  localStorage.setItem(
    CONTROL_PUZZLES_KEY,
    JSON.stringify(existing)
  );
}