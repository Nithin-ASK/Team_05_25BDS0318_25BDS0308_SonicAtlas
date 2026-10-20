import { HashRouter, Route, Routes } from 'react-router-dom';
import { lazy } from 'react';
import { Layout } from './components/Layout';
import { ThemeProvider } from './lib/theme';
import { EmptyState } from './components/ui';
import { Link } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const QueryStudio = lazy(() => import('./pages/QueryStudio'));
const AcousticMap = lazy(() => import('./pages/AcousticMap'));
const SonicTwins = lazy(() => import('./pages/SonicTwins'));
const Compare = lazy(() => import('./pages/Compare'));
const TimeMachine = lazy(() => import('./pages/TimeMachine'));
const Genres = lazy(() => import('./pages/Genres'));
const Lyrics = lazy(() => import('./pages/Lyrics'));
const Network = lazy(() => import('./pages/Network'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));

function NotFound() {
  return <EmptyState title="Page not found" action={<Link className="btn-primary" to="/">Go home</Link>}>That page does not exist.</EmptyState>;
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="query" element={<QueryStudio />} />
            <Route path="map" element={<AcousticMap />} />
            <Route path="twins" element={<SonicTwins />} />
            <Route path="compare" element={<Compare />} />
            <Route path="time" element={<TimeMachine />} />
            <Route path="genres" element={<Genres />} />
            <Route path="lyrics" element={<Lyrics />} />
            <Route path="network" element={<Network />} />
            <Route path="profile" element={<Profile />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
