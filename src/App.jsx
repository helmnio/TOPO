import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Play from './pages/Play';
import Stats from './pages/Stats';
import Dev from './pages/Dev';
import Example from './pages/Example';
import Control from './pages/Control';
import { ENABLE_TEST_FEATURES } from './config/environment';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play />} />
        <Route path="/example" element={<Example />} />
        <Route path="/stats" element={<Stats />} />
        {ENABLE_TEST_FEATURES && <Route path="/dev" element={<Dev />} />}
        {ENABLE_TEST_FEATURES && <Route path="/control" element={<Control />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
