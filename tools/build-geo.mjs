import { writeFile, mkdir, readFile } from 'node:fs/promises';

const EXTENT = { lonMin: 96.5, lonMax: 118.5, latMin: 20.5, latMax: 39.5 };
const TOL = 0.045;

function dp(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol * tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

const inside = (p) => p[0] >= EXTENT.lonMin - 0.5 && p[0] <= EXTENT.lonMax + 0.5 && p[1] >= EXTENT.latMin - 0.5 && p[1] <= EXTENT.latMax + 0.5;

function clipRing(ring) {
  const runs = [];
  let cur = [];
  for (const p of ring) {
    if (inside(p)) cur.push(p);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs.filter(r => r.length >= 3);
}

console.log('reading geojson...');
const gj = JSON.parse(await readFile(new URL('./china-full.json', import.meta.url), 'utf8'));
console.log('features:', gj.features.length);

const provinces = [];
for (const f of gj.features) {
  const name = f.properties?.name;
  if (!name) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  let hit = false;
  for (const poly of polys) {
    for (const ring of poly) {
      if (ring.some(inside)) hit = true;
      for (const run of clipRing(ring)) {
        const s = dp(run, TOL).map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]);
        if (s.length >= 4) rings.push(s);
      }
    }
  }
  if (!hit || !rings.length) continue;
  const c = f.properties.center || f.properties.centroid;
  provinces.push({ name, center: c ? [+c[0].toFixed(2), +c[1].toFixed(2)] : null, rings });
}
await mkdir('data', { recursive: true });
const out = JSON.stringify({ extent: EXTENT, provinces });
await writeFile('data/provinces.json', out);
console.log('provinces kept:', provinces.length, 'size:', (out.length / 1024).toFixed(0) + 'KB');