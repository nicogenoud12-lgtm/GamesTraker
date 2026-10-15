import { Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
import Toast from './components/Toast';
import Home from './pages/Home';
import Search from './pages/Search';
import GamePage from './pages/GamePage';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import Library from './pages/Library';
import Settings from './pages/Settings';
import ScrollToTop from './components/ScrollToTop';

export default function App() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/buscar" element={<Search />} />
        <Route path="/juego/:id" element={<GamePage />} />
        <Route path="/listas" element={<Lists />} />
        <Route path="/listas/:id" element={<ListDetail />} />
        <Route path="/mis-juegos" element={<Library />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <TabBar />
      <Toast />
    </div>
  );
}
