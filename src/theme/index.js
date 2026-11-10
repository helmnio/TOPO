// Visual theme switch. 'classic' is the original look; every other theme is
// scoped to html[data-theme='<id>'], so classic is always untouched.
//
// To revert for good: set DEFAULT_THEME to 'classic' (or delete this folder and
// its import in main.jsx). A look can also be tried with ?theme=<id>, which is
// remembered in this browser.
import './survey.css';
import './gts.css';
import './adventure.css';

const FONT_BASE = 'https://fonts.googleapis.com/css2?';

const THEMES = {
  adventure: {
    fonts:
      'family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Special+Elite&family=Caveat:wght@500;600&family=Orbitron:wght@700;800;900',
  },
  gts: {
    fonts:
      'family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=IM+Fell+DW+Pica:ital@0;1',
  },
  survey: {
    fonts:
      'family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700',
  },
  classic: { fonts: null },
};

const DEFAULT_THEME = 'adventure';
const STORAGE_KEY = 'topo:theme';

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function applyTheme() {
  const requested = new URLSearchParams(window.location.search).get('theme');
  const stored = readStoredTheme();
  const theme = THEMES[requested]
    ? requested
    : THEMES[stored]
      ? stored
      : DEFAULT_THEME;

  if (THEMES[requested]) {
    try {
      localStorage.setItem(STORAGE_KEY, requested);
    } catch {
      // storage unavailable; the choice just lasts for this page load
    }
  }

  document.documentElement.dataset.theme = theme;

  if (THEMES[theme].fonts) {
    const link = document.createElement('link');

    link.rel = 'stylesheet';
    link.href = `${FONT_BASE}${THEMES[theme].fonts}&display=swap`;
    document.head.appendChild(link);
  }
}
