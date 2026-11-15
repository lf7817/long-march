import { useApp } from '../store';
import { BATTLES, battleById } from '../battles';
import { dayOf, fmtDate } from '../data';

export function IntroOverlay() {
  const visible = useApp((s) => s.introVisible);
  const ready = useApp((s) => s.ready);
  const engine = useApp((s) => s.engine);
  if (!visible) return null;
  return (
    <div id="intro">
      <div className="intro-inner">
        <div className="intro-seal">★</div>
        <h1>长征 · 万里征途</h1>
        <div className="intro-rule" />
        <p className="intro-lead">1934年10月，中央红军8.6万人撤离苏区，踏上战略转移的征途。湘江血战、遵义转折、四渡赤水、巧渡金沙江、飞夺泸定桥、雪山草地……二万五千里，纵横十一省。</p>
        <p className="intro-sub">本沙盘按时间线推演三个方面军的轨迹与敌军围堵，每到重大战役与会议，自动展开战果详情。音景为寒风、低钟与远处号角，肃穆哀悼，可随时静音。</p>
        <div className="intro-stats">
          <div><b>8.6万</b><span>出发兵力</span></div>
          <div><b>25000</b><span>里 · 红一方面军</span></div>
          <div><b>11</b><span>省 · 纵横驰骋</span></div>
          <div><b>371</b><span>天 · 中央红军</span></div>
        </div>
        <div className="intro-btns">
          <button id="btn-start" className="btn-primary" disabled={!ready} onClick={() => engine?.begin(true)}>▶ 开始征程</button>
          <button id="btn-silent" className="btn-ghost" disabled={!ready} onClick={() => engine?.begin(false)}>静默浏览</button>
        </div>
      </div>
    </div>
  );
}

export function HelpOverlay() {
  const open = useApp((s) => s.helpOpen);
  const patch = useApp((s) => s.patch);
  if (!open) return null;
  return (
    <div id="help" onClick={(e) => { if (e.target === e.currentTarget) patch({ helpOpen: false }); }}>
      <div className="modal">
        <button className="card-close" onClick={() => patch({ helpOpen: false })}>×</button>
        <h2>图例与操作</h2>
        <div className="legend">
          <span><i style={{ background: '#e8402f' }} />红一方面军</span>
          <span><i style={{ background: '#f2a03d' }} />红四方面军</span>
          <span><i style={{ background: '#d94f8e' }} />红二方面军</span>
          <span><i style={{ background: '#6c8fb5' }} />敌军追击 / 堵截</span>
          <span><i className="dash" />四道封锁线</span>
          <span><i style={{ background: '#ff5a3c' }} />⚔ 战役</span>
          <span><i style={{ background: '#f5c542' }} />★ 会议</span>
          <span><i style={{ background: '#4fc3f7' }} />≋ 渡河</span>
          <span><i style={{ background: '#b8e0d2' }} />▲ 雪山草地</span>
          <span><i style={{ background: '#ffd75e' }} />✦ 会师</span>
        </div>
        <h3>操作</h3>
        <p className="help-line">左键拖拽旋转 · 滚轮缩放 · 右键平移 · 点击地图上的事件标记或时间轴刻度跳转</p>
        <p className="help-line"><kbd>空格</kbd>播放/暂停 <kbd>←</kbd><kbd>→</kbd>±5天 <kbd>↑</kbd><kbd>↓</kbd>上/下一事件 <kbd>F</kbd>跟随 <kbd>M</kbd>静音 <kbd>R</kbd>重置视角 <kbd>H</kbd>帮助</p>
        <h3>音景</h3>
        <p className="help-note">寒风与低音持续音铺底；战役为丧钟式深钟与远处闷雷，会议为暖垫，渡河为水声，雪山草地为风啸，会师为远处号角。全部慢起慢落、带山谷混响，无打击乐。</p>
        <h3>说明</h3>
        <p className="help-note">底图为简化现代省界与示意地形，事件坐标为近似值；兵力数字为史料约数，各方记载略有出入。史实依据公开党史军史资料整理，仅供学习参考。</p>
      </div>
    </div>
  );
}

export function FinaleOverlay() {
  const open = useApp((s) => s.finaleOpen);
  const patch = useApp((s) => s.patch);
  const engine = useApp((s) => s.engine);
  if (!open) return null;
  return (
    <div id="finale">
      <div className="modal finale-modal">
        <div className="intro-seal small">✦</div>
        <h2>三军过后尽开颜</h2>
        <p className="finale-sub">1936年10月22日 · 将台堡会师 · 红军长征胜利结束</p>
        <div className="poem">
          <p className="poem-title">七律 · 长征 · 毛泽东</p>
          <p>红军不怕远征难，万水千山只等闲。</p>
          <p>五岭逶迤腾细浪，乌蒙磅礴走泥丸。</p>
          <p>金沙水拍云崖暖，大渡桥横铁索寒。</p>
          <p>更喜岷山千里雪，三军过后尽开颜。</p>
        </div>
        <div className="finale-stats">
          <div><b>红一方面军</b><span>371天 · 二万五千里 · 纵横11省</span></div>
          <div><b>红二方面军</b><span>约2万里 · 转战8省</span></div>
          <div><b>红四方面军</b><span>约1万余里 · 三过草地</span></div>
        </div>
        <div className="intro-btns">
          <button className="btn-primary" onClick={() => { patch({ finaleOpen: false }); engine?.jumpTo(0, 'start'); engine?.togglePlay(); }}>↺ 重新播放</button>
          <button className="btn-ghost" onClick={() => patch({ finaleOpen: false })}>自由浏览</button>
        </div>
      </div>
    </div>
  );
}

export function FallbackOverlay() {
  const failed = useApp((s) => s.failed);
  if (!failed) return null;
  return (
    <div id="fallback">
      <div className="modal"><h2>无法打开沙盘</h2><p>{failed}</p></div>
    </div>
  );
}

export function BattleConclusion() {
  const open = useApp((s) => s.battleDone);
  const activeId = useApp((s) => s.activeBattleId);
  const engine = useApp((s) => s.engine);
  const patch = useApp((s) => s.patch);
  const battle = battleById(activeId);
  if (!open || !battle) return null;
  const idx = BATTLES.findIndex((b) => b.id === battle.id);
  const next = BATTLES[(idx + 1) % BATTLES.length];
  return (
    <div id="finale">
      <div className="modal finale-modal">
        <div className="intro-seal small">✦</div>
        <h2>{battle.name} · 收束</h2>
        <p className="finale-sub">{fmtDate(dayOf(battle.start))} — {fmtDate(dayOf(battle.end))}</p>
        <p className="battle-conclusion">{battle.conclusion}</p>
        <div className="intro-btns">
          <button className="btn-primary" onClick={() => engine?.enterBattle(battle.id)}>↺ 重播本战役</button>
          <button className="btn-ghost" onClick={() => engine?.enterBattle(next.id)}>下一战役 · {next.name}</button>
          <button className="btn-ghost" onClick={() => { patch({ battleDone: false }); engine?.exitBattle(); }}>返回全景</button>
        </div>
      </div>
    </div>
  );
}