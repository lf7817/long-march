import { useApp } from '../store';
import { TYPE_META, ARMY_META, dayOf, fmtDate } from '../data';

export default function EventCard() {
  const ev = useApp((s) => s.current);
  const open = useApp((s) => s.cardOpen);
  const patch = useApp((s) => s.patch);
  const engine = useApp((s) => s.engine);
  if (!ev) return <section id="event-card" />;
  const meta = TYPE_META[ev.type];
  const army = ARMY_META[ev.army];
  return (
    <section id="event-card" className={open ? 'show' : ''}>
      <div className="card-top">
        <span id="card-type" className="card-type" style={{ color: meta.color, borderColor: meta.color }}>{meta.icon} {meta.label}</span>
        <span id="card-army" className="card-army" style={{ background: army.color }}>{army.label}</span>
        <button id="card-next" className="btn card-next-top" onClick={() => engine?.stepEvent(1)}>下一事件 →</button>
        <button id="card-close" className="card-close" title="关闭" onClick={() => patch({ cardOpen: false })}>×</button>
      </div>
      <h3 id="card-name">{ev.name}</h3>
      <div className="card-meta">
        <span id="card-date">{ev.endDate ? `${fmtDate(dayOf(ev.date))} — ${fmtDate(dayOf(ev.endDate))}` : fmtDate(dayOf(ev.date))}</span>
        <span id="card-place">📍 {ev.place}</span>
      </div>
      <p id="card-summary">{ev.summary}</p>
      <div className="card-result">
        <span className="result-label">战果 / 决议</span>
        <p id="card-result">{ev.result}</p>
      </div>
      <p id="card-sig">{ev.significance}</p>
    </section>
  );
}