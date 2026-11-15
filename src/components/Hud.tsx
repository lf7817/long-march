import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../store';
import { ROUTES, STRENGTH, TOTAL_DAYS, WUQI_DAY, ARMY_META, dayOf, fmtDate, strengthAt } from '../data';
import type { ArmyKey } from '../data';
import { battleById } from '../battles';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function drawStrength(c: HTMLCanvasElement, day: number): void {
  const g = c.getContext('2d');
  if (!g) return;
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const X = (d: number) => 8 + (d / TOTAL_DAYS) * (W - 16);
  const Y = (n: number) => H - 14 - (n / 90000) * (H - 26);
  g.strokeStyle = 'rgba(200,180,140,0.18)';
  g.beginPath(); g.moveTo(8, H - 14); g.lineTo(W - 8, H - 14); g.stroke();
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(232,64,47,0.5)');
  grad.addColorStop(1, 'rgba(232,64,47,0.02)');
  g.beginPath();
  g.moveTo(X(STRENGTH[0].day), Y(STRENGTH[0].n));
  for (const p of STRENGTH) g.lineTo(X(p.day), Y(p.n));
  g.lineTo(X(STRENGTH[STRENGTH.length - 1].day), H - 14);
  g.lineTo(X(STRENGTH[0].day), H - 14);
  g.closePath();
  g.fillStyle = grad; g.fill();
  g.beginPath();
  g.moveTo(X(STRENGTH[0].day), Y(STRENGTH[0].n));
  for (const p of STRENGTH) g.lineTo(X(p.day), Y(p.n));
  g.strokeStyle = '#ff6a4d'; g.lineWidth = 1.6; g.stroke();
  const labelIdx = [0, 1, STRENGTH.length - 1];
  const shortNames = ['出发', '湘江后', '到陕北'];
  STRENGTH.forEach((p, i) => {
    g.beginPath(); g.arc(X(p.day), Y(p.n), 2, 0, 7); g.fillStyle = '#f5c542'; g.fill();
    if (labelIdx.includes(i)) {
      g.fillStyle = 'rgba(230,215,180,0.7)';
      g.font = '9px sans-serif';
      g.fillText(shortNames[labelIdx.indexOf(i)], clamp(X(p.day) - 8, 4, W - 34), Y(p.n) - 5);
    }
  });
  const n = strengthAt(day);
  g.strokeStyle = 'rgba(245,197,66,0.8)';
  g.beginPath(); g.moveTo(X(Math.min(day, WUQI_DAY)), 4); g.lineTo(X(Math.min(day, WUQI_DAY)), H - 14); g.stroke();
  g.beginPath(); g.arc(X(Math.min(day, WUQI_DAY)), Y(n), 3, 0, 7); g.fillStyle = '#fff'; g.fill();
}

export function StrengthChart({ day }: { day: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawStrength(ref.current, day); }, [day]);
  return <canvas id="strength-chart" ref={ref} width={248} height={66} />;
}

export default function Hud() {
  const dayInt = useApp((s) => Math.floor(s.day));
  const show = useApp((s) => s.show);
  const mode = useApp((s) => s.mode);
  const activeBattleId = useApp((s) => s.activeBattleId);
  const currentStep = useApp((s) => s.currentStep);
  const engine = useApp((s) => s.engine);
  const battle = mode === 'battle' ? battleById(activeBattleId) : undefined;
  const n = strengthAt(dayInt);
  const dist = engine ? engine.distanceAt(dayInt) : 0;
  return (
    <div id="hud">
      <div className="hud-date-wrap">
        <span id="hud-date">{fmtDate(dayInt)}</span>
        <span id="hud-day">第 {dayInt + 1} 天</span>
      </div>
      {battle ? (
        <div className="hud-chips">
          <span className="chip battle-chip"><b>{battle.name}</b></span>
          <span className="chip">解说 <b>{Math.max(0, currentStep + 1)}/{battle.steps.length}</b></span>
        </div>
      ) : (
        <>
          <div className="hud-chips">
            <span className="chip" title="中央红军兵力（史料约数）">兵力 <b>{n >= 10000 ? `约 ${(n / 10000).toFixed(1)} 万人` : `约 ${Math.round(n / 100) * 100} 人`}</b></span>
            <span className="chip" title="红一方面军累计里程">里程 <b>约 {dist.toLocaleString('zh-CN')} 里</b></span>
          </div>
          <div className="hud-armies">
            {(Object.keys(ROUTES) as ArmyKey[]).map((k) => {
              const a = ROUTES[k];
              const s0 = dayOf(a.points[0][0]);
              const s1 = dayOf(a.points[a.points.length - 1][0]);
              const st = dayInt < s0 ? '未出发' : dayInt >= s1 ? '已到达' : '行军中';
              return (
                <span key={k} className={'army-chip' + (st === '行军中' ? ' moving' : '')}
                  style={{ '--c': ARMY_META[k].color, opacity: k === 'central' || show[k] ? 1 : 0.35 } as CSSProperties}>
                  {ARMY_META[k].label} · {st}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}