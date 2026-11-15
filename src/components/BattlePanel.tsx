import { useEffect, useRef } from 'react';
import { useApp } from '../store';
import { BATTLES, battleById } from '../battles';
import { dayOf, fmtDate } from '../data';

export default function BattlePanel() {
  const activeId = useApp((s) => s.activeBattleId);
  const currentStep = useApp((s) => s.currentStep);
  const dayInt = useApp((s) => Math.floor(s.day));
  const engine = useApp((s) => s.engine);
  const patch = useApp((s) => s.patch);
  const battle = battleById(activeId);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (currentStep < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`li[data-step="${currentStep}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentStep]);

  if (!battle) return null;
  return (
    <aside id="chronicle" className="battle-panel">
      <div className="panel-head">
        <h2>战役模式</h2>
        <div id="battle-select">
          {BATTLES.map((b) => (
            <button key={b.id} className={b.id === activeId ? 'on' : ''} onClick={() => engine?.enterBattle(b.id)}>{b.name}</button>
          ))}
        </div>
      </div>
      <div className="battle-intro">
        <div className="battle-title">{battle.name}<span>{battle.subtitle}</span></div>
        <p>{battle.intro}</p>
      </div>
      <ol id="event-list" ref={listRef}>
        {battle.steps.map((s, i) => (
          <li key={i} data-step={i} className={i === currentStep ? 'current' : (dayOf(s.date) > dayInt ? 'future' : '')}
            onClick={() => engine?.jumpTo(dayOf(s.date) + 0.02)}>
            <span className="ev-date">{fmtDate(dayOf(s.date)).slice(5)}</span>
            <span className="step-idx">{i + 1}</span>
            <span className="ev-name">{s.title}</span>
          </li>
        ))}
      </ol>
      <div className="panel-foot">
        <p className="note">点击解说节拍跳转 · 播放时自动推进 · 虚线环为敌合围圈</p>
        <button className="btn" style={{ width: '100%' }} onClick={() => { engine?.exitBattle(); patch({ chronicleOpen: false }); }}>← 返回全景</button>
      </div>
    </aside>
  );
}