import { Link, useLocation } from 'react-router-dom';

import { getLocalDateKey } from '../../data/puzzles';
import { loadPlaySession } from '../../utils/playStorage';

const SELECTED_GAME_MODE_STORAGE_KEY = 'topo:selected-game-mode';

function BottomNav() {
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isPlay = location.pathname === '/play';
  const isExample = location.pathname === '/example';
  const isStats = location.pathname === '/stats';

  const todayDateKey = getLocalDateKey();

  const currentDailySession = loadPlaySession('daily');

  const isCurrentDailyComplete = Boolean(
    currentDailySession &&
      currentDailySession.gameMode === 'daily' &&
      currentDailySession.dateKey === todayDateKey &&
      (
        currentDailySession.isSolved ||
        currentDailySession.isSubmitted
      )
  );

  const primaryLabel = isCurrentDailyComplete
    ? 'View Game'
    : 'Play Game';

  return (
    <nav className="bottom-nav">
      {/* HOME */}
      <Link
        to="/"
        className={`bottom-nav__item ${
          isHome ? 'is-active' : ''
        }`}
      >
        <span className="material-symbols-outlined bottom-nav__icon" aria-hidden="true">explore</span>
        <span className="bottom-nav__label">Home</span>
      </Link>

      {/* PLAY */}
      <Link
        to="/play"
        onClick={() => {
          localStorage.setItem(SELECTED_GAME_MODE_STORAGE_KEY, 'daily');
        }}
        className={`bottom-nav__item ${
          isPlay ? 'is-active' : ''
        }`}
      >
        {/* {primaryLabel} */}
        <span className="material-symbols-outlined bottom-nav__icon" aria-hidden="true">map</span>
        <span className="bottom-nav__label">Game</span>
      </Link>

      {/* STATS */}
      <Link
        to="/stats"
        className={`bottom-nav__item ${
          isStats ? 'is-active' : ''
        }`}
      >
        <span className="material-symbols-outlined bottom-nav__icon" aria-hidden="true">leaderboard</span>
        <span className="bottom-nav__label">Stats</span>
      </Link>

      {/* EXAMPLE */}
      <Link
        to="/example"
        className={`bottom-nav__item ${
          isExample ? 'is-active' : ''
        }`}
      >
        <span className="material-symbols-outlined bottom-nav__icon" aria-hidden="true">menu_book</span>
        <span className="bottom-nav__label">Learn</span>
      </Link>
    </nav>
  );
}

export default BottomNav;
