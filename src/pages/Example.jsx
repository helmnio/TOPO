import { useNavigate } from 'react-router-dom';

import BottomNav from '../components/layout/BottomNav';
import LearnBoard from '../components/learn/LearnBoard';

const STEPS = [
  {
    title: '1 · Place',
    text: 'Tap a fragment and drag it onto the map. Tap empty space to drop it.',
  },
  {
    title: '2 · Turn',
    text: 'Rotate it until it fits. North, the arrow, must end up pointing up.',
  },
  {
    title: '3 · Match',
    text: 'Overlaps must agree. A red outline shows a clash. Then add the symbols.',
  },
];

function Example() {
  const navigate = useNavigate();

  return (
    <div className="page page--example">
      <div className="page__inner">
        <main className="play-shell play-shell--game">
          <header className="play-header">
            <p className="eyebrow">Learn</p>

            <h1 className="play-title">Learn TOPO</h1>

            <p className="panel-copy">
              Rebuild the map from overlapping fragments.
            </p>
          </header>

          <section className="learn-rules">
            <h2>How to play</h2>

            <div className="learn-rules__grid">
              {STEPS.map((step) => (
                <div key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </section>

          <LearnBoard />

          <p className="learn-gestures">
            Rotate with the button, a double-tap or a two-finger twist. Drag a
            piece off the map to remove it.
          </p>

          <div className="learn-cta">
            <button
              type="button"
              className="button button--primary"
              onClick={() => navigate('/play')}
            >
              Play today’s TOPO
            </button>
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

export default Example;
