import * as THREE from 'three';
import { RIDGES, GRASSLAND, RIVERS, CITIES } from '../data';
import type { GeoData, LonLat } from '../data';

export const LON0 = 107.5, LAT0 = 30.0, KX = 8.7, KZ = 10.0;
export const EXTENT = { lonMin: 96.5, lonMax: 118.5, latMin: 20.5, latMax: 39.5 };
export const toWorld = (lon: number, lat: number): [number, number] => [(lon - LON0) * KX, -(lat - LAT0) * KZ];

const ridges = RIDGES.map((r) => ({ ...r, pts: r.pts.map(([lo, la]) => [lo * 0.87, la] as [number, number]) }));

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
  return Math.sqrt(ex * ex + ey * ey);
}

const hash = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function terrainHeight(lon: number, lat: number): number {
  const px = lon * 0.87, py = lat;
  let h = 0.10 + 0.16 * vnoise(lon * 2.3, lat * 2.3);
  for (const r of ridges) {
    let d = Infinity;
    for (let i = 0; i < r.pts.length - 1; i++) {
      d = Math.min(d, segDist(px, py, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]));
    }
    const s = r.w * 0.5;
    h += r.h * Math.exp(-(d * d) / (2 * s * s)) * (0.62 + 0.75 * vnoise(px * 1.7 + r.h, py * 1.7));
  }
  const gx = (lon - GRASSLAND.center[0]) / GRASSLAND.rx;
  const gy = (lat - GRASSLAND.center[1]) / GRASSLAND.ry;
  const gm = Math.exp(-(gx * gx + gy * gy) * 1.6);
  h = h * (1 - gm * 0.82) + 1.05 * gm * 0.82;
  return Math.max(0.05, h);
}

export interface LabelOpts {
  px?: number;
  color?: string;
  font?: string;
  weight?: string;
  scale?: number;
  spacing?: number;
  opacity?: number;
}

export function makeLabel(text: string, { px = 26, color = '#c8d6e5', font = '"Noto Serif SC","Songti SC","STSong",serif', weight = '600', scale = 2.2, spacing = 0, opacity = 1 }: LabelOpts = {}): THREE.Sprite {
  const pad = 12;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const f = `${weight} ${px}px ${font}`;
  ctx.font = f;
  if (spacing && 'letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing + 'px';
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2 + spacing * text.length;
  c.width = Math.max(2, w); c.height = px + pad * 2;
  const g = c.getContext('2d')!;
  g.font = f;
  if (spacing && 'letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing + 'px';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 8;
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set((c.width / c.height) * scale, scale, 1);
  sp.renderOrder = 20;
  return sp;
}

function buildLandMask(provinces: GeoData['provinces']): (lon: number, lat: number) => boolean {
  const W = 512, H = 448;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  const X = (lon: number) => (lon - EXTENT.lonMin) / (EXTENT.lonMax - EXTENT.lonMin) * W;
  const Y = (lat: number) => (1 - (lat - EXTENT.latMin) / (EXTENT.latMax - EXTENT.latMin)) * H;
  for (const p of provinces) {
    for (const ring of p.rings) {
      g.beginPath();
      ring.forEach(([lo, la], i) => (i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))));
      g.closePath(); g.fill();
    }
  }
  const data = g.getImageData(0, 0, W, H).data;
  return (lon, lat) => {
    const x = Math.round(X(lon)), y = Math.round(Y(lat));
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return data[(y * W + x) * 4] > 128;
  };
}

const cSea = new THREE.Color(0x0a1520);
const cLow = new THREE.Color(0x243428);
const cMid = new THREE.Color(0x3d4a33);
const cHigh = new THREE.Color(0x63594a);
const cSnow = new THREE.Color(0xb9c4cf);
const cMarsh = new THREE.Color(0x17323a);
const cLoess = new THREE.Color(0x4a3d28);
const cEdge = new THREE.Color(0x070d16);

export interface World {
  group: THREE.Group;
  labels: THREE.Sprite[];
  riverGroup: THREE.Group;
  cityGroup: THREE.Group;
  borders: THREE.LineSegments;
  baseStar: THREE.Sprite;
  setExaggeration: (f: number) => void;
}

export function buildWorld(scene: THREE.Scene, geo: GeoData): World {
  const isLand = buildLandMask(geo.provinces);
  const group = new THREE.Group();
  scene.add(group);
  const labels: THREE.Sprite[] = [];

  const W = (EXTENT.lonMax - EXTENT.lonMin) * KX;
  const H = (EXTENT.latMax - EXTENT.latMin) * KZ;
  const SX = 320, SZ = 292;
  const geoT = new THREE.PlaneGeometry(W, H, SX, SZ);
  geoT.rotateX(-Math.PI / 2);
  const pos = geoT.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const lon = x / KX + LON0, lat = -z / KZ + LAT0;
    const h = terrainHeight(lon, lat);
    pos.setY(i, h);
    const land = isLand(lon, lat);
    if (!land) {
      tmp.copy(cSea).offsetHSL(0, 0, 0.006 * (hash(lon, lat) - 0.5));
    } else {
      const t = Math.min(1, h / 3.2);
      if (t < 0.45) tmp.copy(cLow).lerp(cMid, t / 0.45);
      else tmp.copy(cMid).lerp(cHigh, (t - 0.45) / 0.55);
      if (h > 2.8) tmp.lerp(cSnow, Math.min(1, (h - 2.8) / 0.7));
      const gx = (lon - GRASSLAND.center[0]) / GRASSLAND.rx;
      const gy = (lat - GRASSLAND.center[1]) / GRASSLAND.ry;
      const gm = Math.exp(-(gx * gx + gy * gy) * 1.6);
      if (gm > 0.15) tmp.lerp(cMarsh, gm * 0.8);
      if (lat > 34.2 && lat < 38.5 && lon > 103.5 && lon < 111.5 && h < 2.2) tmp.lerp(cLoess, 0.38);
      tmp.offsetHSL(0, 0, 0.01 * (hash(lon * 3.1, lat * 2.7) - 0.5));
    }
    const edge = Math.min(lon - EXTENT.lonMin, EXTENT.lonMax - lon, lat - EXTENT.latMin, EXTENT.latMax - lat);
    if (edge < 1.6) tmp.lerp(cEdge, 1 - edge / 1.6);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geoT.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geoT.computeVertexNormals();
  const terrain = new THREE.Mesh(geoT, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  group.add(terrain);

  const borderPts: number[] = [];
  for (const p of geo.provinces) {
    for (const ring of p.rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lo1, la1] = ring[i], [lo2, la2] = ring[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot((lo2 - lo1) * KX, (la2 - la1) * KZ) / 0.9));
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps, t1 = (s + 1) / steps;
          const a: LonLat = [lo1 + (lo2 - lo1) * t0, la1 + (la2 - la1) * t0];
          const b: LonLat = [lo1 + (lo2 - lo1) * t1, la1 + (la2 - la1) * t1];
          const [ax, az] = toWorld(a[0], a[1]);
          const [bx, bz] = toWorld(b[0], b[1]);
          borderPts.push(ax, terrainHeight(a[0], a[1]) + 0.14, az, bx, terrainHeight(b[0], b[1]) + 0.14, bz);
        }
      }
    }
  }
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPts, 3));
  const borders = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: 0x9a8c62, transparent: true, opacity: 0.42 }));
  group.add(borders);

  for (const p of geo.provinces) {
    if (!p.center) continue;
    const [lo, la] = p.center;
    if (lo < EXTENT.lonMin + 1 || lo > EXTENT.lonMax - 1 || la < EXTENT.latMin + 1 || la > EXTENT.latMax - 1) continue;
    const name = p.name.replace(/(省|市|壮族自治区|回族自治区|自治区|特别行政区)$/g, '');
    const sp = makeLabel(name, { px: 40, color: 'rgba(216,198,152,0.34)', scale: 5.4, spacing: 8, weight: '500' });
    const [x, z] = toWorld(lo, la);
    sp.position.set(x, terrainHeight(lo, la) + 0.6, z);
    sp.userData.baseY = sp.position.y;
    group.add(sp); labels.push(sp);
  }

  const riverGroup = new THREE.Group();
  group.add(riverGroup);
  for (const r of RIVERS) {
    const pts = r.pts.map(([lo, la]) => {
      const [x, z] = toWorld(lo, la);
      return new THREE.Vector3(x, terrainHeight(lo, la) + 0.12, z);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    const tube = new THREE.TubeGeometry(curve, 120, r.major ? 0.13 : 0.075, 6, false);
    const mesh = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: r.major ? 0x3fa7d6 : 0x2e8fc0, transparent: true, opacity: r.major ? 0.9 : 0.75 }));
    riverGroup.add(mesh);
    const mid = curve.getPoint(0.5);
    const sp = makeLabel(r.name, { px: 24, color: '#7fd4f0', scale: 1.9, weight: '500', font: '"Kaiti SC","STKaiti","KaiTi",serif' });
    sp.position.copy(mid).add(new THREE.Vector3(0, 0.5, 0));
    sp.userData.baseY = sp.position.y;
    riverGroup.add(sp); labels.push(sp);
  }

  {
    const [lo, la] = GRASSLAND.center;
    const sp = makeLabel('松潘草地', { px: 26, color: '#6fb5a0', scale: 2.2, spacing: 4 });
    const [x, z] = toWorld(lo, la);
    sp.position.set(x, terrainHeight(lo, la) + 0.5, z);
    sp.userData.baseY = sp.position.y;
    group.add(sp); labels.push(sp);
  }

  const cityGroup = new THREE.Group();
  group.add(cityGroup);
  const dotGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xb8c8d8 });
  for (const c of CITIES) {
    const [x, z] = toWorld(c.lon, c.lat);
    const y = terrainHeight(c.lon, c.lat) + 0.2;
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, z);
    cityGroup.add(dot);
    const sp = makeLabel(c.name, { px: 25, color: '#c8d6e5', scale: 2.0 });
    sp.position.set(x, y + 0.9, z);
    sp.userData.baseY = sp.position.y;
    cityGroup.add(sp); labels.push(sp);
  }

  const baseStar = makeLabel('★ 陕北根据地', { px: 28, color: '#f5c542', scale: 2.6, weight: '700' });
  {
    const [x, z] = toWorld(109.49, 36.59);
    baseStar.position.set(x, terrainHeight(109.49, 36.59) + 1.6, z);
    baseStar.userData.baseY = baseStar.position.y;
    group.add(baseStar); labels.push(baseStar);
  }

  const setExaggeration = (f: number) => {
    group.scale.y = f;
    for (const sp of labels) sp.position.y = sp.userData.baseY * f;
  };

  return { group, labels, riverGroup, cityGroup, borders, setExaggeration, baseStar };
}