import { useApp } from '../store';

export default function TopBar() {
  const sound = useApp((s) => s.sound);
  const engine = useApp((s) => s.engine);
  const patch = useApp((s) => s.patch);
  const chronicleOpen = useApp((s) => s.chronicleOpen);
  const mode = useApp((s) => s.mode);
  const activeBattleId = useApp((s) => s.activeBattleId);
  return (
    <header id="topbar">
      <div className="brand">
        <div className="seal">★</div>
        <div className="brand-text">
          <h1>长征 · 万里征途</h1>
          <p>1934.10 — 1936.10 · 红军长征交互沙盘</p>
        </div>
      </div>
      <div className="mode-switch">
        <button className={mode === 'panorama' ? 'on' : ''} onClick={() => engine?.exitBattle()}>全景</button>
        <button className={mode === 'battle' ? 'on' : ''} onClick={() => engine?.enterBattle(activeBattleId)}>战役</button>
      </div>
      <div className="top-actions">
        <button
          id="btn-chronicle"
          className="btn mobile-only"
          onClick={() => patch({ chronicleOpen: !chronicleOpen })}
        >☰ 大事记</button>
        <button id="btn-help" className="btn" title="图例与帮助（H）" onClick={() => patch({ helpOpen: true })}>？</button>
        <button
          id="btn-sound"
          className={'btn' + (sound ? '' : ' off')}
          title="音效开关（M）"
          onClick={() => engine?.toggleSound()}
        >{sound ? '♪ 音效开' : '♪ 已静音'}</button>
      </div>
    </header>
  );
}