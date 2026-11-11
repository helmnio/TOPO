// Visual theme switch. 'classic' is the original look; every other theme is
// scoped to html[data-theme='<id>'], so classic is always untouched.
//
// To revert for good: set DEFAULT_THEME to 'classic' (or delete this folder and
// its import in main.jsx). A look can also be tried with ?theme=<id>, which lasts
// for that browser tab only.
import './survey.css';
import './gts.css';
import './adventure-v1.css';
import './adventure-v2.css';

const FONT_BASE = 'https://fonts.googleapis.com/css2?';

const ADVENTURE_FONTS =
  'family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Special+Elite&family=Caveat:wght@500;600&family=Orbitron:wght@700;800;900';

// Each theme has its own stylesheet, scoped to its own id, so none overrides
// another. Switch with ?theme=<id> (this tab only) or change DEFAULT_THEME.
const THEMES = {
  'adventure-v1': { fonts: ADVENTURE_FONTS },
  'adventure-v2': { fonts: `${ADVENTURE_FONTS}&family=Cormorant+SC:wght@600;700` },
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

const DEFAULT_THEME = 'adventure-v2';
const STORAGE_KEY = 'topo:theme';

// The chosen theme lasts for this tab only (sessionStorage), so opening the plain
// address in a new tab or visit always gives DEFAULT_THEME.
function readStoredTheme() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function applyTheme() {
  const param = new URLSearchParams(window.location.search).get('theme');
  // 'adventure' was the id before versioning
  const requested = param === 'adventure' ? 'adventure-v1' : param;
  const stored = readStoredTheme();
  const storedTheme = stored === 'adventure' ? 'adventure-v1' : stored;
  const theme = THEMES[requested]
    ? requested
    : THEMES[storedTheme]
      ? storedTheme
      : DEFAULT_THEME;

  if (THEMES[requested]) {
    try {
      sessionStorage.setItem(STORAGE_KEY, requested);
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
