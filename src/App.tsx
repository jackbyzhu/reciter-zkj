import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { useSettings } from './stores/settingsStore';
import { Home } from './pages/Home';
import { AddWord } from './pages/AddWord';
import { Review } from './pages/Review';
import { WordLibrary } from './pages/WordLibrary';
import { CardDetail } from './pages/CardDetail';
import { EditCard } from './pages/EditCard';
import { Practice } from './pages/Practice';
import { Curve } from './pages/Curve';
import { PracticeResult } from './pages/PracticeResult';
import { Settings } from './pages/Settings';

export default function App() {
  const init = useSettings((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/add" element={<AddWord />} />
        <Route path="/review" element={<Review />} />
        <Route path="/library" element={<WordLibrary />} />
        <Route path="/library/:id" element={<CardDetail />} />
        <Route path="/library/:id/edit" element={<EditCard />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/result" element={<PracticeResult />} />
        <Route path="/curve" element={<Curve />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}