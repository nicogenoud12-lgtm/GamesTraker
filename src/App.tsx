import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { startSync } from './lib/sync';
import { useMode } from './store/useUi';
import { MODES } from './lib/mode';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import Toast from './components/Toast';
import Home from './pages/Home';
import Search from './pages/Search';
import GamePage from './pages/GamePage';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Discover from './pages/Discover';
import Explore from './pages/Explore';
import Stats from './pages/Stats';
import YearReview from './pages/YearReview';
import Account from './pages/Account';
import ScrollToTop from './components/ScrollToTop';

export default function App() {
  useEffect(() => startSync(), []);
  const mode = useMode();
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    // The tab is named after the side in use: GamesTracker / MediaTracker.
    document.title = `${MODES[mode].brand}Tracker`;
  }, [mode]);

  return (
    <div className="min-h-dvh lg:overflow-x-clip lg:pl-64">
      <ScrollToTop />
      <Sidebar />
      <main className="mx-auto max-w-lg pb-28 lg:max-w-6xl lg:px-6 lg:pb-12 2xl:max-w-7xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/descubrir" element={<Discover />} />
          <Route path="/descubrir/explorar" element={<Explore />} />
          <Route path="/buscar" element={<Search />} />
          <Route path="/juego/:id" element={<GamePage />} />
          <Route path="/listas" element={<Lists />} />
          <Route path="/listas/:id" element={<ListDetail />} />
          <Route path="/mis-juegos" element={<Library />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="/estadisticas" element={<Stats />} />
          <Route path="/resumen" element={<YearReview />} />
          <Route path="/cuenta" element={<Account />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <TabBar />
      <Toast />
    </div>
  );
}
