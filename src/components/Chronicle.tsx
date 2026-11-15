import { useEffect, useRef } from 'react';
import { useApp } from '../store';
import type { FilterKey } from '../store';
import { EV_SORTED, TYPE_META, ARMY_META, dayOf, fmtDate } from '../data';
import { StrengthChart } from './Hud';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'battle', label: '战役' },
  { key: 'meeting', label: '会议' },
  { key: 'terrain', label: '天险' },
  { key: 'join', label: '会师' },
];

export default function Chronicle() {
  const filter = useApp((s) => s.filter);
  const show = useApp((s) => s.show);
  const current = useApp((s) => s.current);
  const dayInt = useApp((s) => Math.floor(s.day));
  const open = useApp((s) => s.chronicleOpen);
  const patch = useApp((s) => s.patch);
  const engine = useApp((s) => s.engine);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!current || !listRef.current) return;
    const el = listRef.current.querySelector(`li[data-id="${current.id}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  const visible = (army: string, type: string): boolean => {
    const armyOk = army === 'central' || army === 'join' || show[army as 'fourth' | 'second'];
    const typeOk = filter === 'all'
      || (filter === 'battle' && type === 'battle')
      || (filter === 'meeting' && type === 'meeting')
      || (filter === 'terrain' && (type === 'crossing' || type === 'mountain' || type === 'alliance'))
      || (filter === 'join' && type === 'join');
    return armyOk && typeOk;
  };

  return (
    <>
      <aside id="chronicle" className={open ? 'open' : ''}>
        <div className="panel-head">
          <h2>大事记</h2>
          <div id="filters">
            {FILTERS.map((f) => (
              <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => patch({ filter: f.key })}>{f.label}</button>
            ))}
          </div>
        </div>
        <ol id="event-list" ref={listRef}>
          {EV_SORTED.map((ev) => {
            if (!visible(ev.army, ev.type)) return null;
            const d = new Date(Date.parse(ev.date + 'T00:00:00Z'));
            const meta = TYPE_META[ev.type];
            return (
              <li key={ev.id} data-id={ev.id}
                className={(current?.id === ev.id ? 'current ' : '') + (dayOf(ev.date) > dayInt ? 'future' : '')}
                title={`${ev.name} · ${fmtDate(dayOf(ev.date))}`}
                onClick={() => { engine?.jumpTo(dayOf(ev.date) + 0.02, ev.id); patch({ chronicleOpen: false }); }}>
                <span className="ev-date">{d.getUTCMonth() + 1}.{String(d.getUTCDate()).padStart(2, '0')}</span>
                <span className="ev-icon" style={{ color: meta.color }}>{meta.icon}</span>
                <span className="ev-name">{ev.name}</span>
                <span className="ev-army" style={{ background: ARMY_META[ev.army].color }} />
              </li>
            );
          })}
        </ol>
        <div className="panel-foot">
          <div className="foot-title">中央红军兵力变化（约数）</div>
          <StrengthChart day={dayInt} />
          <p className="note">史料记载略有出入，均为约数</p>
        </div>
      </aside>
      <div id="chronicle-backdrop" onClick={() => patch({ chronicleOpen: false })} />
    </>
  );
}