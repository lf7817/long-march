import { useApp } from '../store';
import { EV_SORTED, TYPE_META, TOTAL_DAYS, dayOf, fmtDate } from '../data';
import { battleById } from '../battles';

export default function Dock() {
  const day = useApp((s) => s.day);
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const show = useApp((s) => s.show);
  const current = useApp((s) => s.current);
  const mode = useApp((s) => s.mode);
  const activeBattleId = useApp((s) => s.activeBattleId);
  const patch = useApp((s) => s.patch);
  const engine = useApp((s) => s.engine);
  const battle = mode === 'battle' ? battleById(activeBattleId) : undefined;
  const min = battle ? dayOf(battle.start) : 0;
  const max = battle ? dayOf(battle.end) : TOTAL_DAYS;
  const ticks = battle
    ? [...battle.events].sort((a, b) => dayOf(a.date) - dayOf(b.date)).map((ev) => ({ id: ev.id, date: ev.date, type: ev.type, name: ev.name, army: 'central' as const }))
    : EV_SORTED;
  const attn = !playing && current && (current.type === 'battle' || current.type === 'meeting' || current.type === 'join');
  return (
    <footer id="dock">
      <button id="btn-play" className={'play' + (attn ? ' attn' : '')} title={playing ? '暂停（空格）' : '播放（空格）'} onClick={() => engine?.togglePlay()}>
        {playing ? '⏸' : '▶'}
      </button>
      <button id="btn-prev" className="step" title="上一事件（↓）" onClick={() => engine?.stepEvent(-1)}>⏮</button>
      <div id="timeline-wrap">
        <div id="ticks">
          {ticks.map((ev) => {
            if (!battle && ev.army !== 'central' && ev.army !== 'join' && !show[ev.army as 'fourth' | 'second']) return null;
            const d = dayOf(ev.date);
            const major = ev.type === 'battle' || ev.type === 'join';
            return (
              <div key={ev.id} className={'tick' + (major ? ' major' : '')}
                style={{ left: `${((d - min) / (max - min)) * 100}%`, background: TYPE_META[ev.type].color }}
                title={`${ev.name} · ${fmtDate(d)}`}
                onClick={(e) => { e.stopPropagation(); engine?.jumpTo(d + 0.02, ev.id); }} />
            );
          })}
        </div>
        <input type="range" id="scrub" min={min} max={max} step={0.25} value={day}
          title="拖动时间线"
          onPointerDown={() => engine?.setDragging(true)}
          onPointerUp={() => engine?.setDragging(false)}
          onChange={(e) => engine?.setDay(+e.target.value)} />
        <div className="tl-labels">
          {battle
            ? (<><span>{fmtDate(min)}</span><span>{battle.name}</span><span>{fmtDate(max)}</span></>)
            : (<><span>1934.10 出发</span><span>1935.10 落脚陕北</span><span>1936.10 三军会师</span></>)}
        </div>
      </div>
      <button id="btn-next" className="step" title="下一事件（↑）" onClick={() => engine?.stepEvent(1)}>⏭</button>
      <div id="speed-wrap">
        <label htmlFor="speed">速度</label>
        <input type="range" id="speed" min={1} max={40} step={1} value={speed} onChange={(e) => patch({ speed: +e.target.value })} />
        <span id="speed-val">{speed} 天/秒</span>
      </div>
    </footer>
  );
}