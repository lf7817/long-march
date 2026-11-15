import SceneCanvas from './components/SceneCanvas';
import TopBar from './components/TopBar';
import Hud from './components/Hud';
import Chronicle from './components/Chronicle';
import BattlePanel from './components/BattlePanel';
import EventCard from './components/EventCard';
import ControlsPanel from './components/ControlsPanel';
import Dock from './components/Dock';
import { IntroOverlay, HelpOverlay, FinaleOverlay, FallbackOverlay, BattleConclusion } from './components/Overlays';
import { useApp } from './store';

export default function App() {
  const mode = useApp((s) => s.mode);
  return (
    <>
      <SceneCanvas />
      <div id="grain" />
      <div id="vignette" />
      <TopBar />
      <Hud />
      {mode === 'battle' ? <BattlePanel /> : <Chronicle />}
      <aside id="right-rail">
        <EventCard />
        <ControlsPanel />
      </aside>
      <Dock />
      <IntroOverlay />
      <HelpOverlay />
      <FinaleOverlay />
      <BattleConclusion />
      <FallbackOverlay />
    </>
  );
}