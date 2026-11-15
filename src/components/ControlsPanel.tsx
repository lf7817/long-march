import { useApp } from '../store';
import type { ShowFlags } from '../store';
import { battleById } from '../battles';

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i className="sw" />
    </label>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="row slider-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

export default function ControlsPanel() {
  const show = useApp((s) => s.show);
  const fx = useApp((s) => s.fx);
  const follow = useApp((s) => s.follow);
  const followArmy = useApp((s) => s.followArmy);
  const autoPause = useApp((s) => s.autoPause);
  const mode = useApp((s) => s.mode);
  const activeBattleId = useApp((s) => s.activeBattleId);
  const setShow = useApp((s) => s.setShow);
  const setFx = useApp((s) => s.setFx);
  const patch = useApp((s) => s.patch);
  const engine = useApp((s) => s.engine);
  const battle = mode === 'battle' ? battleById(activeBattleId) : undefined;
  const followOptions = battle
    ? [{ id: 'auto', label: '自动' }, ...battle.red.map((r) => ({ id: r.id, label: r.label }))]
    : [{ id: 'auto', label: '自动' }, { id: 'central', label: '红一方面军' }, { id: 'fourth', label: '红四方面军' }, { id: 'second', label: '红二方面军' }];
  const showKeys: { k: keyof ShowFlags; label: string }[] = [
    { k: 'enemies', label: '敌军动态' },
    { k: 'fourth', label: '红四方面军' },
    { k: 'second', label: '红二方面军' },
    { k: 'labels', label: '地名标注' },
    { k: 'rivers', label: '河流' },
    { k: 'ghost', label: '全程轨迹预览' },
  ];
  return (
    <section id="controls">
      <div className="ctl-sec">
        <h4>视角</h4>
        <Switch label="跟随红军" checked={follow} onChange={(v) => patch({ follow: v })} />
        <label className="row select-row">
          <span>跟随目标</span>
          <select value={followArmy} onChange={(e) => patch({ followArmy: e.target.value })}>
            {followOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <div className="row btn-row">
          <button className="btn" onClick={() => engine?.resetView()}>全局</button>
          <button className="btn" onClick={() => engine?.topView()}>俯瞰</button>
          <button className="btn" title="导出当前画面 PNG" onClick={() => engine?.screenshot()}>截图</button>
        </div>
      </div>
      <div className="ctl-sec">
        <h4>图层</h4>
        {showKeys.map(({ k, label }) => (
          <Switch key={k} label={label} checked={show[k]} onChange={(v) => setShow(k, v)} />
        ))}
      </div>
      <div className="ctl-sec">
        <h4>效果</h4>
        <Switch label="战役自动暂停" checked={autoPause} onChange={(v) => patch({ autoPause: v })} />
        <Switch label="辉光特效" checked={fx.bloom} onChange={(v) => setFx('bloom', v)} />
        <Slider label="辉光强度" min={0} max={2} step={0.05} value={fx.glow} onChange={(v) => setFx('glow', v)} />
        <Slider label="粒子密度" min={0} max={1} step={0.05} value={fx.particles} onChange={(v) => setFx('particles', v)} />
        <Slider label="地形起伏" min={0.4} max={2.2} step={0.05} value={fx.exag} onChange={(v) => setFx('exag', v)} />
        <Slider label="画面亮度" min={0.5} max={1.8} step={0.05} value={fx.exposure} onChange={(v) => setFx('exposure', v)} />
      </div>
    </section>
  );
}