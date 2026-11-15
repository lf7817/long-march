import * as THREE from 'three';
import { TYPE_META, dayOf } from '../data';
import type { ArmyKey, EventArmy, GameEvent, RouteDef, EnemyMove, Blockade } from '../data';
import type { EncircleRing } from '../battles';
import { toWorld, terrainHeight, makeLabel, KX, KZ } from './world';

let glowTex: THREE.CanvasTexture | null = null;
export function getGlowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

const UP = new THREE.Vector3(0, 1, 0);
const SEG = 1000, RAD = 8;

export interface Army {
  key: string;
  grp: THREE.Group;
  head: THREE.Group;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Sprite;
  curve: THREE.CatmullRomCurve3;
  startDay: number;
  endDay: number;
  tAt: (day: number) => number;
  lenAt: (day: number) => number;
  reveal: (day: number) => number;
  setGhost: (v: boolean) => void;
  setEnabled: (v: boolean) => void;
}

export function buildArmies(scene: THREE.Scene, routes: Record<string, RouteDef>): Record<string, Army> {
  const armies: Record<string, Army> = {};
  for (const key of Object.keys(routes)) {
    const r = routes[key];
    // 沿路线密集采样地形高度贴地重建曲线，避免 waypoint 之间插值切进山脊
    const wp: { day: number; lon: number; lat: number }[] = [];
    for (const [date, lon, lat] of r.points) {
      const prev = wp[wp.length - 1];
      if (prev && prev.lon === lon && prev.lat === lat) continue;
      wp.push({ day: dayOf(date), lon, lat });
    }
    const dense: { day: number; p: THREE.Vector3 }[] = [];
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const [ax, az] = toWorld(a.lon, a.lat);
      const [bx, bz] = toWorld(b.lon, b.lat);
      const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6));
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        const lon = a.lon + (b.lon - a.lon) * f;
        const lat = a.lat + (b.lat - a.lat) * f;
        const [x, z] = toWorld(lon, lat);
        dense.push({ day: a.day + (b.day - a.day) * f, p: new THREE.Vector3(x, terrainHeight(lon, lat) + 0.32, z) });
      }
    }
    {
      const last = wp[wp.length - 1];
      const [x, z] = toWorld(last.lon, last.lat);
      dense.push({ day: last.day, p: new THREE.Vector3(x, terrainHeight(last.lon, last.lat) + 0.32, z) });
    }
    const days = dense.map((w) => w.day);
    const curve = new THREE.CatmullRomCurve3(dense.map((w) => w.p), false, 'centripetal', 0.5);
    curve.arcLengthDivisions = SEG;
    const tubeGeo = new THREE.TubeGeometry(curve, SEG, 0.17, RAD, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: r.color, emissive: r.glow, emissiveIntensity: 1.35, roughness: 0.4, metalness: 0.1 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    const coreGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(SEG));
    const core = new THREE.Line(coreGeo, new THREE.LineBasicMaterial({ color: 0xfff1e0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
    const ghostGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(600));
    const ghost = new THREE.Line(ghostGeo, new THREE.LineDashedMaterial({ color: r.color, transparent: true, opacity: 0.22, dashSize: 0.7, gapSize: 0.5 }));
    ghost.computeLineDistances();

    const head = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 12), new THREE.MeshStandardMaterial({ color: r.color, emissive: r.glow, emissiveIntensity: 2.2 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 40), new THREE.MeshBasicMaterial({ color: r.glow, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: r.glow, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.6, 3.6, 1);
    const light = new THREE.PointLight(r.glow, 28, 18, 2);
    head.add(cone, ring, glow, light);
    head.visible = false;

    const grp = new THREE.Group();
    grp.add(ghost, tube, core, head);
    scene.add(grp);

    const lengths = curve.getLengths(SEG);
    const totalLen = lengths[SEG];
    const tAt = (day: number): number => {
      if (day <= days[0]) return 0;
      if (day >= days[days.length - 1]) return 1;
      let lo = 0, hi = days.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (days[mid] <= day) lo = mid; else hi = mid;
      }
      const f = (day - days[lo]) / (days[hi] - days[lo]);
      return (lo + f) / (days.length - 1);
    };
    const lenAt = (day: number): number => lengths[Math.min(SEG, Math.floor(tAt(day) * SEG))];

    armies[key] = {
      key, grp, head, ring, glow, curve,
      startDay: days[0], endDay: days[days.length - 1], tAt, lenAt,
      reveal(day: number) {
        const t = tAt(day);
        const n = Math.floor(t * SEG);
        // TubeGeometry 按弧长均匀采样，drawRange 需换算为弧长分数才能与 getPoint(t) 的军标对齐
        const x = t * SEG;
        const i0 = Math.min(SEG - 1, Math.floor(x));
        const arc = (lengths[i0] + (lengths[i0 + 1] - lengths[i0]) * (x - i0)) / totalLen;
        tubeGeo.setDrawRange(0, Math.floor(arc * SEG) * RAD * 6);
        coreGeo.setDrawRange(0, n + 1);
        const active = day >= days[0] && t > 0.0005;
        head.visible = active;
        tube.visible = core.visible = n > 0;
        if (active) {
          const p = curve.getPoint(t);
          const tan = curve.getTangent(Math.min(0.9999, Math.max(0.0001, t)));
          head.position.copy(p).add(new THREE.Vector3(0, 0.35, 0));
          cone.quaternion.setFromUnitVectors(UP, tan.clone().normalize());
          cone.position.set(0, 0.55, 0);
        }
        return t;
      },
      setGhost(v: boolean) { ghost.visible = v; },
      setEnabled(v: boolean) { grp.visible = v; },
    };
  }
  return armies;
}

const FORCE_COLORS: Record<string, number> = { pursue: 0x6c8fb5, block: 0x93aecb, defend: 0x7d94ad };

export interface EnemySystem {
  grp: THREE.Group;
  update: (day: number, time: number, showLabels: boolean) => void;
  setExaggeration: (f: number) => void;
}

export function buildEnemies(scene: THREE.Scene, moves: EnemyMove[], blockadeDefs: Blockade[] = [], withCommanders = false, labelScale = 1): EnemySystem {
  const items: {
    curve: THREE.QuadraticBezierCurve3;
    tube: THREE.Mesh; cone: THREE.Mesh;
    mat: THREE.MeshBasicMaterial; coneMat: THREE.MeshBasicMaterial;
    flows: THREE.Sprite[]; label: THREE.Sprite;
    startDay: number; endDay: number;
  }[] = [];
  const grp = new THREE.Group();
  scene.add(grp);
  for (const m of moves) {
    const [fx, fz] = toWorld(m.from[0], m.from[1]);
    const [tx, tz] = toWorld(m.to[0], m.to[1]);
    const fy = terrainHeight(m.from[0], m.from[1]) + 0.4;
    const ty = terrainHeight(m.to[0], m.to[1]) + 0.4;
    const dx = tx - fx, dz = tz - fz;
    const dist = Math.hypot(dx, dz) || 1;
    const mx = (fx + tx) / 2 - (dz / dist) * dist * 0.14;
    const mz = (fz + tz) / 2 + (dx / dist) * dist * 0.14;
    const my = Math.max(fy, ty) + 1.2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(fx, fy, fz), new THREE.Vector3(mx, my, mz), new THREE.Vector3(tx, ty, tz));
    const color = FORCE_COLORS[m.kind] || 0x6c8fb5;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.085, 6, false), mat);
    const coneMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 10), coneMat);
    cone.position.copy(curve.getPoint(1));
    cone.quaternion.setFromUnitVectors(UP, curve.getTangent(0.999).normalize());
    const flows: THREE.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xbcd6ee, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.set(1.4, 1.4, 1);
      flows.push(sp);
      grp.add(sp);
    }
    const label = makeLabel(m.name, { px: 22, color: '#a8c4e0', scale: 1.8 * labelScale, weight: '500' });
    label.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 1.1, 0));
    label.userData.baseY = label.position.y;
    label.material.opacity = 0;
    grp.add(tube, cone, label);
    items.push({ curve, tube, cone, mat, coneMat, flows, label, startDay: dayOf(m.start), endDay: dayOf(m.end) });
  }

  const blockades: { line: THREE.Line; mat: THREE.LineDashedMaterial; label: THREE.Sprite; untilDay: number; startDay: number }[] = [];
  for (const b of blockadeDefs) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const lon = b.a[0] + (b.b[0] - b.a[0]) * t;
      const lat = b.a[1] + (b.b[1] - b.a[1]) * t;
      const [x, z] = toWorld(lon, lat);
      pts.push(new THREE.Vector3(x, terrainHeight(lon, lat) + 0.3, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0xa8c4e0, transparent: true, opacity: 0.8, dashSize: 0.65, gapSize: 0.4 });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    const label = makeLabel(b.name, { px: 21, color: '#bcd6ee', scale: 1.7 * labelScale });
    label.position.copy(pts[7]).add(new THREE.Vector3(0, 1.0, 0));
    label.userData.baseY = label.position.y;
    grp.add(line, label);
    blockades.push({ line, mat, label, untilDay: dayOf(b.until), startDay: dayOf(b.until) - 25 });
  }

  const commanders = (withCommanders ? [
    { name: '蒋介石·南昌行营', at: [115.89, 28.68] as [number, number], start: '1934-10-10', end: '1934-12-15' },
    { name: '蒋介石·贵阳督战', at: [106.63, 26.65] as [number, number], start: '1935-03-24', end: '1935-04-10' },
    { name: '蒋介石·昆明督战', at: [102.73, 25.04] as [number, number], start: '1935-04-10', end: '1935-05-15' },
    { name: '蒋介石·成都督战', at: [104.07, 30.67] as [number, number], start: '1935-05-15', end: '1935-10-30' },
  ] : []).map((c) => {
    const [x, z] = toWorld(c.at[0], c.at[1]);
    const y = terrainHeight(c.at[0], c.at[1]) + 0.7;
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshBasicMaterial({ color: 0xc9b98a, transparent: true, opacity: 0 }));
    mesh.position.set(x, y, z);
    const label = makeLabel(c.name, { px: 21, color: '#d8c698', scale: 1.7 * labelScale });
    label.position.set(x, y + 1.2, z);
    label.userData.baseY = label.position.y;
    label.material.opacity = 0;
    grp.add(mesh, label);
    return { mesh, label, startDay: dayOf(c.start), endDay: dayOf(c.end) };
  });

  const update = (day: number, time: number, showLabels: boolean) => {
    for (const it of items) {
      const fade = Math.max(0, Math.min(1, (day - it.startDay) / 3, (it.endDay - day) / 3));
      const on = fade > 0.01;
      it.tube.visible = it.cone.visible = on;
      it.mat.opacity = 0.8 * fade;
      it.coneMat.opacity = 0.9 * fade;
      it.label.visible = on && showLabels;
      it.label.material.opacity = fade * 0.95;
      for (let i = 0; i < 3; i++) {
        const sp = it.flows[i];
        sp.visible = on && fade > 0.25;
        if (sp.visible) {
          const t = (time * 0.11 + i / 3) % 1;
          sp.position.copy(it.curve.getPoint(t));
          sp.material.opacity = 0.75 * fade * Math.sin(t * Math.PI);
        }
      }
    }
    for (const bl of blockades) {
      const fadeIn = Math.max(0, Math.min(1, (day - bl.startDay) / 3));
      const fadeOut = day < bl.untilDay ? 1 : Math.max(0, 1 - (day - bl.untilDay) / 12);
      const op = 0.8 * fadeIn * fadeOut;
      bl.mat.opacity = op;
      bl.line.visible = op > 0.02;
      bl.label.material.opacity = Math.min(0.95, op + 0.1);
      bl.label.visible = showLabels && op > 0.02;
    }
    for (const cm of commanders) {
      const fade = Math.max(0, Math.min(1, (day - cm.startDay) / 3, (cm.endDay - day) / 3));
      cm.mesh.visible = fade > 0.01;
      cm.mesh.material.opacity = fade;
      cm.mesh.rotation.y = time * 0.8;
      cm.label.visible = fade > 0.01 && showLabels;
      cm.label.material.opacity = fade;
    }
  };

  const setExaggeration = (f: number) => {
    grp.scale.y = f;
    grp.traverse((o) => { if (o.userData.baseY !== undefined) o.position.y = o.userData.baseY * f; });
  };

  return { grp, update, setExaggeration };
}

export interface EventMarker {
  ev: GameEvent;
  mesh: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>;
  label: THREE.Sprite;
  day: number;
  armyKey: EventArmy;
}

export interface MarkerSystem {
  markers: EventMarker[];
  byArmy: Record<EventArmy, THREE.Group>;
  setExaggeration: (f: number) => void;
}

export function buildEventMarkers(scene: THREE.Scene, events: GameEvent[], labelScale = 1): MarkerSystem {
  const markers: EventMarker[] = [];
  const byArmy: Record<EventArmy, THREE.Group> = {
    central: new THREE.Group(), fourth: new THREE.Group(), second: new THREE.Group(), join: new THREE.Group(),
  };
  Object.values(byArmy).forEach((g) => scene.add(g));
  const geo = new THREE.OctahedronGeometry(0.36);
  for (const ev of events) {
    const meta = TYPE_META[ev.type];
    const color = new THREE.Color(meta.color);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, transparent: true, opacity: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    const [x, z] = toWorld(ev.lon, ev.lat);
    const y = terrainHeight(ev.lon, ev.lat) + 0.75;
    mesh.position.set(x, y, z);
    mesh.userData.eventId = ev.id;
    const label = makeLabel(ev.name, { px: 22, color: meta.color, scale: 1.65 * labelScale, weight: '600' });
    label.position.set(x, y + 1.15, z);
    label.userData.baseY = label.position.y;
    const armyKey: EventArmy = ev.army === 'join' ? 'join' : ev.army;
    byArmy[armyKey].add(mesh, label);
    markers.push({ ev, mesh, label, day: dayOf(ev.date), armyKey });
  }
  const setExaggeration = (f: number) => {
    Object.values(byArmy).forEach((g) => {
      g.scale.y = f;
      g.traverse((o) => { if (o.userData.baseY !== undefined) o.position.y = o.userData.baseY * f; });
    });
  };
  return { markers, byArmy, setExaggeration };
}

export interface EncircleSystem {
  grp: THREE.Group;
  update: (day: number, time: number) => void;
  setVisible: (v: boolean) => void;
  setExaggeration: (f: number) => void;
}

// 合围环：随时间收缩的包围圈，直观表现敌人合围收紧 / 突围后失效
export function buildEncircleRing(scene: THREE.Scene, ring: EncircleRing, labelScale = 1): EncircleSystem {
  const grp = new THREE.Group();
  scene.add(grp);
  const pts: THREE.Vector3[] = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color: 0x9fb8d8, transparent: true, opacity: 0, dashSize: 0.06, gapSize: 0.04 });
  const loop = new THREE.LineLoop(geo, mat);
  loop.computeLineDistances();
  const [cx, cz] = toWorld(ring.center[0], ring.center[1]);
  const cy = terrainHeight(ring.center[0], ring.center[1]) + 0.5;
  loop.position.set(cx, cy, cz);
  const label = makeLabel(ring.label || '敌合围圈', { px: 22, color: '#bcd6ee', scale: 1.8 * labelScale });
  label.position.set(cx, cy + 1.2, cz);
  label.userData.baseY = label.position.y;
  grp.add(loop, label);
  const startDay = dayOf(ring.start);
  const endDay = dayOf(ring.end);
  const update = (day: number, time: number) => {
    const frac = Math.max(0, Math.min(1, (day - startDay) / (endDay - startDay)));
    const r = ring.radiusStart + (ring.radiusEnd - ring.radiusStart) * frac;
    loop.scale.set(r * KX, 1, r * KZ);
    const fadeIn = Math.max(0, Math.min(1, (day - startDay) / 2));
    const fadeOut = Math.max(0, Math.min(1, (endDay + 3 - day) / 3));
    const op = 0.55 * fadeIn * fadeOut * (0.75 + 0.25 * Math.sin(time * 2));
    mat.opacity = op;
    label.material.opacity = Math.min(0.9, op + 0.15);
    loop.visible = label.visible = op > 0.02;
  };
  const setVisible = (v: boolean) => { grp.visible = v; };
  const setExaggeration = (f: number) => {
    grp.scale.y = f;
    label.position.y = label.userData.baseY * f;
  };
  return { grp, update, setVisible, setExaggeration };
}