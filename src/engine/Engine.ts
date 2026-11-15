import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ROUTES, ENEMY_MOVES, BLOCKADES, EVENTS, EV_SORTED, TYPE_META, TOTAL_DAYS, WUQI_DAY, dayOf, fmtDate } from '../data';
import type { GameEvent, GeoData, RouteDef, EnemyMove } from '../data';
import { battleById } from '../battles';
import type { Battle } from '../battles';
import { useApp } from '../store';
import type { FxFlags, ShowFlags } from '../store';
import { buildWorld, terrainHeight, toWorld, KX, KZ } from './world';
import type { World } from './world';
import { buildArmies, buildEnemies, buildEventMarkers, buildEncircleRing, getGlowTexture } from './armies';
import type { Army, EnemySystem, MarkerSystem, EncircleSystem } from './armies';
import { SolemnAudio } from './audio';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const OVERVIEW_TGT = new THREE.Vector3(5, 0, -6);
const CAM_DIR = new THREE.Vector3(0.05, 0.68, 0.73).normalize();

interface Systems {
  armies: Record<string, Army>;
  enemies: EnemySystem;
  markers: MarkerSystem;
  ring?: EncircleSystem;
  eventsSorted: GameEvent[];
}
interface Burst { sp: THREE.Sprite; vel: THREE.Vector3; life: number; max: number }
interface Ring { m: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; life: number }
interface CamTween { t: number; dur: number; fp: THREE.Vector3; tp: THREE.Vector3; ft: THREE.Vector3; tt: THREE.Vector3; done?: () => void }

export class Engine {
  readonly audio = new SolemnAudio();
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private world!: World;
  private global!: Systems;
  private battleCache = new Map<string, Systems>();
  private battle: Systems | null = null;
  private activeBattle: Battle | null = null;
  private fxGroup!: THREE.Group;
  private snow!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private dust!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private fogSprites: THREE.Sprite[] = [];
  private bursts: Burst[] = [];
  private rings: Ring[] = [];
  private timer = new THREE.Timer();
  private raf = 0;
  private time = 0;
  private day = 0;
  private pubDay = -1;
  private evIndex = -1;
  private dragging = false;
  private finaleShown = false;
  private battleDoneShown = false;
  private bloomPulse = 0;
  private windTimer = 0;
  private camTween: CamTween | null = null;
  private lastShow: ShowFlags | null = null;
  private lastFx: FxFlags | null = null;
  private lastSound = true;
  private disposed = false;
  private built = false;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private downXY: [number, number] | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    let geo: GeoData;
    try {
      geo = (await (await fetch('./data/provinces.json')).json()) as GeoData;
    } catch {
      useApp.setState({ failed: '地理数据加载失败，请通过 pnpm dev 启动本地服务。' });
      return;
    }
    if (this.disposed) return;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch {
      useApp.setState({ failed: '当前浏览器不支持 WebGL，无法显示三维沙盘。' });
      return;
    }
    const st = useApp.getState();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = st.fx.exposure;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070d16);
    this.scene.fog = new THREE.FogExp2(0x070d16, 0.0012);

    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1600);
    this.camera.position.set(0, 260, 300);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(OVERVIEW_TGT);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = 1.45;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 620;
    this.controls.enabled = false;

    this.scene.add(new THREE.HemisphereLight(0x35486b, 0x0a0d12, 0.9));
    const key = new THREE.DirectionalLight(0xffd9a0, 1.5);
    key.position.set(-70, 42, 26);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4a7ab5, 0.6);
    rim.position.set(60, 30, -70);
    this.scene.add(rim);

    this.world = buildWorld(this.scene, geo);
    this.global = {
      armies: buildArmies(this.scene, ROUTES),
      enemies: buildEnemies(this.scene, ENEMY_MOVES, BLOCKADES, true),
      markers: buildEventMarkers(this.scene, EVENTS),
      eventsSorted: EV_SORTED,
    };
    this.buildAmbient();
    this.buildPools();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), st.fx.glow, 0.55, 0.75);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.applyVisibility(st.show);
    this.applyExag(st.fx.exag);
    this.applyViewOffset();
    this.bind();
    this.built = true;
    if (import.meta.env.DEV) (window as unknown as { __lm?: Engine }).__lm = this;
    useApp.setState({ ready: true });
    this.setDay(0);
    this.triggerEvent(EV_SORTED[0], { quiet: true });
    this.loop();
  }

  private buildAmbient(): void {
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);
    {
      const n = 500, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const lon = 99.3 + Math.random() * 5.4, lat = 26.8 + Math.random() * 7.4;
        p[i * 3] = (lon - 107.5) * 8.7;
        p[i * 3 + 1] = 3 + Math.random() * 6;
        p[i * 3 + 2] = -(lat - 30) * 10;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8f2, size: 0.22, transparent: true, opacity: 0.75, depthWrite: false }));
      this.fxGroup.add(this.snow);
    }
    {
      const n = 260, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        p[i * 3] = (Math.random() - 0.5) * 180;
        p[i * 3 + 1] = 1 + Math.random() * 7;
        p[i * 3 + 2] = (Math.random() - 0.5) * 180;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8fa3b8, size: 0.3, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.fxGroup.add(this.dust);
    }
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0x9fc4b8, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }));
      const lon = 102.2 + Math.random() * 1.6, lat = 32.6 + Math.random() * 1.2;
      sp.position.set((lon - 107.5) * 8.7, terrainHeight(lon, lat) + 1.2, -(lat - 30) * 10);
      sp.scale.set(9 + Math.random() * 6, 5 + Math.random() * 3, 1);
      sp.userData.seed = Math.random() * 10;
      this.fogSprites.push(sp);
      this.fxGroup.add(sp);
    }
  }

  private buildPools(): void {
    for (let i = 0; i < 70; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff6a4d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.visible = false;
      this.scene.add(sp);
      this.bursts.push({ sp, vel: new THREE.Vector3(), life: 0, max: 1 });
    }
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      this.rings.push({ m, life: 0 });
    }
  }

  // ── 生命周期 ───────────────────────────────────────────────────
  private onResize = (): void => {
    if (!this.built) return;
    this.camera.aspect = innerWidth / innerHeight;
    this.applyViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  };

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range') return;
    if (t.tagName === 'SELECT') return;
    const st = useApp.getState();
    if (st.introVisible) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); this.togglePlay(); break;
      case 'ArrowLeft': this.setDay(this.day - 5); break;
      case 'ArrowRight': this.setDay(this.day + 5); break;
      case 'ArrowUp': e.preventDefault(); this.stepEvent(1); break;
      case 'ArrowDown': e.preventDefault(); this.stepEvent(-1); break;
      case 'KeyF': useApp.setState({ follow: !st.follow }); break;
      case 'KeyM': this.toggleSound(); break;
      case 'KeyH': useApp.setState({ helpOpen: !st.helpOpen }); break;
      case 'KeyR': this.resetView(); break;
    }
  };

  private onPointerDown = (e: PointerEvent): void => { this.downXY = [e.clientX, e.clientY]; };
  private onPointerUp = (e: PointerEvent): void => {
    if (!this.downXY || Math.hypot(e.clientX - this.downXY[0], e.clientY - this.downXY[1]) > 6) return;
    const ptr = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ptr, this.camera);
    const sys = this.currentSystems();
    const meshes = sys.markers.markers.filter((m) => this.visibleEvent(m.ev)).map((m) => m.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) {
      const ev = sys.eventsSorted.find((x) => x.id === hit.object.userData.eventId);
      if (ev) this.jumpTo(dayOf(ev.date) + 0.02, ev.id);
    }
  };
  private onFirstGesture = (): void => { this.audio.init(); this.audio.setEnabled(useApp.getState().sound); };

  private bind(): void {
    addEventListener('resize', this.onResize);
    addEventListener('keydown', this.onKey);
    addEventListener('pointerdown', this.onFirstGesture, { once: true });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    removeEventListener('keydown', this.onKey);
    removeEventListener('pointerdown', this.onFirstGesture);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.audio.dispose();
    if (!this.built) return;
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
  }

  // ── 模式切换 ───────────────────────────────────────────────────
  private ensureBattle(b: Battle): Systems {
    const cached = this.battleCache.get(b.id);
    if (cached) return cached;
    const routes: Record<string, RouteDef> = {};
    for (const r of b.red) routes[r.id] = { name: r.label, short: r.label, color: r.color, glow: r.glow, points: r.points };
    const events: GameEvent[] = b.events.map((e) => ({ ...e, army: 'central', significance: e.significance || '' }));
    const moves: EnemyMove[] = b.enemy.map((e) => ({ ...e, name: e.label, note: e.note || '' }));
    const sys: Systems = {
      armies: buildArmies(this.scene, routes),
      enemies: buildEnemies(this.scene, moves, [], false, 0.7),
      markers: buildEventMarkers(this.scene, events, 0.7),
      ring: b.ring ? buildEncircleRing(this.scene, b.ring, 0.7) : undefined,
      eventsSorted: [...events].sort((a, c) => dayOf(a.date) - dayOf(c.date)),
    };
    for (const a of Object.values(sys.armies)) a.setEnabled(false);
    sys.enemies.grp.visible = false;
    for (const g of Object.values(sys.markers.byArmy)) g.visible = false;
    sys.ring?.setVisible(false);
    sys.markers.setExaggeration(useApp.getState().fx.exag);
    sys.enemies.setExaggeration(useApp.getState().fx.exag);
    this.battleCache.set(b.id, sys);
    return sys;
  }

  enterBattle(id: string): void {
    const b = battleById(id);
    if (!b || !this.built) return;
    useApp.setState({ panoramaDay: this.day });
    this.battle = this.ensureBattle(b);
    this.activeBattle = b;
    this.evIndex = -1;
    this.battleDoneShown = false;
    const start = dayOf(b.start);
    this.day = start;
    this.pubDay = -1;
    useApp.setState({ mode: 'battle', activeBattleId: id, day: start, playing: false, currentStep: -1, current: null, cardOpen: false, followArmy: 'auto', finaleOpen: false, battleDone: false });
    const v = this.battleView(b);
    this.tweenCam(v.pos, v.tgt, 1.6, () => { this.controls.enabled = true; });
    this.setDay(start);
  }

  exitBattle(): void {
    if (!this.built) return;
    this.battle = null;
    this.activeBattle = null;
    const d = useApp.getState().panoramaDay;
    this.day = d;
    this.pubDay = -1;
    let i = -1;
    while (i + 1 < EV_SORTED.length && dayOf(EV_SORTED[i + 1].date) <= d) i++;
    this.evIndex = i;
    useApp.setState({ mode: 'panorama', day: d, playing: false, currentStep: -1, current: i >= 0 ? EV_SORTED[i] : null, cardOpen: false, followArmy: 'auto', battleDone: false });
    const v = this.overviewView();
    this.tweenCam(v.pos, v.tgt, 1.6, () => { this.controls.enabled = true; });
  }

  private battleView(b: Battle): { pos: THREE.Vector3; tgt: THREE.Vector3 } {
    const clon = (b.region.lonMin + b.region.lonMax) / 2;
    const clat = (b.region.latMin + b.region.latMax) / 2;
    const [tx, tz] = toWorld(clon, clat);
    const tgt = new THREE.Vector3(tx, 0, tz);
    const spanX = (b.region.lonMax - b.region.lonMin) * KX;
    const spanZ = (b.region.latMax - b.region.latMin) * KZ;
    const aspect = innerWidth / innerHeight;
    const tan = Math.tan((50 / 2) * Math.PI / 180);
    const dist = Math.max(40, (spanZ * 1.4) / (2 * tan), (spanX * 1.4) / (2 * tan * aspect));
    const battleDir = new THREE.Vector3(0.0, 0.88, 0.48).normalize();
    return { pos: tgt.clone().addScaledVector(battleDir, dist), tgt };
  }

  private currentSystems(): Systems {
    return (useApp.getState().mode === 'battle' && this.battle) ? this.battle : this.global;
  }
  private activeEndDay(): number {
    return this.activeBattle ? dayOf(this.activeBattle.end) : TOTAL_DAYS;
  }

  // ── 对外操作 ───────────────────────────────────────────────────
  begin(withSound: boolean): void {
    this.audio.init();
    this.audio.setEnabled(withSound);
    useApp.setState({ introVisible: false, sound: withSound, playing: true });
    const v = this.overviewView();
    this.tweenCam(v.pos, v.tgt, 2.6, () => { this.controls.enabled = true; });
  }

  toggleSound(): void {
    this.audio.init();
    const v = !useApp.getState().sound;
    this.audio.setEnabled(v);
    useApp.setState({ sound: v });
  }

  togglePlay(): void {
    const st = useApp.getState();
    if (!st.playing && this.day >= this.activeEndDay()) {
      const start = this.activeBattle ? dayOf(this.activeBattle.start) : 0;
      this.day = start; this.evIndex = -1; this.finaleShown = false;
      const list = this.currentSystems().eventsSorted;
      if (list[0]) this.triggerEvent(list[0], { quiet: true });
    }
    useApp.setState({ playing: !st.playing });
  }

  setDragging(v: boolean): void { this.dragging = v; }

  stepEvent(dir: number): void {
    const sys = this.currentSystems();
    const vis = sys.eventsSorted.filter((e) => this.visibleEvent(e));
    const cur = useApp.getState().current;
    let idx = vis.findIndex((e) => e.id === (cur ? cur.id : vis[0]?.id));
    if (idx < 0) idx = 0;
    const next = vis[clamp(idx + dir, 0, vis.length - 1)];
    if (next) this.jumpTo(dayOf(next.date) + 0.02, next.id);
  }

  jumpTo(day: number, evId?: string): void {
    const sys = this.currentSystems();
    let i = -1;
    while (i + 1 < sys.eventsSorted.length && dayOf(sys.eventsSorted[i + 1].date) <= day) i++;
    this.evIndex = i;
    this.day = clamp(day, 0, this.activeEndDay());
    this.pubDay = -1;
    const ev = evId ? sys.eventsSorted.find((e) => e.id === evId) : i >= 0 ? sys.eventsSorted[i] : sys.eventsSorted[0];
    useApp.setState({ playing: false, day: this.day });
    if (ev) this.triggerEvent(ev, { burst: true });
    this.updateStep();
  }

  setDay(d: number): void {
    const prev = this.day;
    const end = this.activeEndDay();
    this.day = clamp(d, 0, end);
    const sys = this.currentSystems();
    if (this.day < prev) {
      this.finaleShown = false;
      if (this.battleDoneShown && this.day < this.activeEndDay()) {
        this.battleDoneShown = false;
        useApp.setState({ battleDone: false });
      }
      let i = -1;
      while (i + 1 < sys.eventsSorted.length && dayOf(sys.eventsSorted[i + 1].date) <= this.day) i++;
      this.evIndex = i;
    } else {
      while (this.evIndex + 1 < sys.eventsSorted.length && dayOf(sys.eventsSorted[this.evIndex + 1].date) <= this.day) {
        this.evIndex++;
        const ev = sys.eventsSorted[this.evIndex];
        if (this.visibleEvent(ev)) this.triggerEvent(ev, { burst: this.day - prev < 6 });
      }
    }
    this.updateStep();
    if (this.day !== this.pubDay) {
      this.pubDay = this.day;
      useApp.setState({ day: this.day });
    }
  }

  private updateStep(): void {
    if (!this.activeBattle) { if (useApp.getState().currentStep !== -1) useApp.setState({ currentStep: -1 }); return; }
    let idx = -1;
    this.activeBattle.steps.forEach((s, i) => { if (dayOf(s.date) <= this.day) idx = i; });
    if (idx !== useApp.getState().currentStep) useApp.setState({ currentStep: idx });
  }

  resetView(): void {
    useApp.setState({ follow: false });
    const v = this.activeBattle ? this.battleView(this.activeBattle) : this.overviewView();
    this.tweenCam(v.pos, v.tgt, 1.4, () => { this.controls.enabled = true; });
  }

  topView(): void {
    useApp.setState({ follow: false });
    const tgt = this.activeBattle ? this.battleView(this.activeBattle).tgt : OVERVIEW_TGT;
    this.tweenCam(new THREE.Vector3(tgt.x, 240, tgt.z - 0.1), tgt, 1.4, () => { this.controls.enabled = true; });
  }

  screenshot(): void {
    this.composer.render();
    const a = document.createElement('a');
    a.download = `长征沙盘_${fmtDate(this.day).replace(/[年月]/g, '-').replace('日', '')}.png`;
    a.href = this.renderer.domElement.toDataURL('image/png');
    a.click();
  }

  distanceAt(day: number): number {
    if (!this.built) return 0;
    const c = this.global.armies.central;
    return Math.round((c.lenAt(Math.min(day, WUQI_DAY)) / c.lenAt(WUQI_DAY)) * 25000);
  }

  // ── 内部 ───────────────────────────────────────────────────────
  private visibleEvent(ev: GameEvent): boolean {
    if (useApp.getState().mode === 'battle') return true;
    if (ev.army === 'central' || ev.army === 'join') return true;
    return useApp.getState().show[ev.army];
  }

  private triggerEvent(ev: GameEvent, { burst = false, quiet = false }: { burst?: boolean; quiet?: boolean } = {}): void {
    useApp.setState({ current: ev, cardOpen: true });
    if (!quiet) this.audio.forEvent(ev.type);
    if (burst) {
      const sys = this.currentSystems();
      const mk = sys.markers.markers.find((m) => m.ev.id === ev.id);
      if (mk) {
        mk.mesh.getWorldPosition(this.tmpV);
        this.spawnBurst(this.tmpV, new THREE.Color(TYPE_META[ev.type].color), ev.type === 'battle' || ev.type === 'join');
      }
      this.bloomPulse = 0.5;
    }
    const st = useApp.getState();
    if (!quiet && st.playing && st.autoPause && (ev.type === 'battle' || ev.type === 'meeting' || ev.type === 'join')) {
      useApp.setState({ playing: false });
    }
  }

  private spawnBurst(pos: THREE.Vector3, color: THREE.Color, big: boolean): void {
    const n = Math.round((big ? 34 : 20) * useApp.getState().fx.particles);
    let spawned = 0;
    for (const b of this.bursts) {
      if (spawned >= n) break;
      if (b.life > 0) continue;
      spawned++;
      b.sp.visible = true;
      b.sp.position.copy(pos);
      b.sp.material.color.copy(color).lerp(new THREE.Color(0xffe9b0), Math.random() * 0.5);
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * (big ? 6 : 4);
      b.vel.set(Math.cos(a) * r, 2 + Math.random() * (big ? 6 : 4), Math.sin(a) * r);
      b.max = b.life = 1.1 + Math.random() * 0.7;
      b.sp.scale.setScalar(0.5 + Math.random() * (big ? 1.2 : 0.8));
    }
    for (const r of this.rings) {
      if (r.life > 0) continue;
      r.m.visible = true;
      r.m.position.copy(pos);
      r.m.material.color.copy(color);
      r.life = 1.2;
      r.m.scale.setScalar(0.4);
      break;
    }
  }

  private overviewView(): { pos: THREE.Vector3; tgt: THREE.Vector3 } {
    const aspect = innerWidth / innerHeight;
    const dist = 225 * Math.max(1, 1 / aspect);
    return { pos: OVERVIEW_TGT.clone().addScaledVector(CAM_DIR, dist), tgt: OVERVIEW_TGT.clone() };
  }

  private applyViewOffset(): void {
    if (innerWidth <= 920) this.camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.16, innerWidth, innerHeight);
    else this.camera.clearViewOffset();
  }

  private tweenCam(pos: THREE.Vector3, tgt: THREE.Vector3, dur: number, done?: () => void): void {
    this.camTween = { t: 0, dur, fp: this.camera.position.clone(), tp: pos.clone(), ft: this.controls.target.clone(), tt: tgt.clone(), done };
    this.controls.enabled = false;
  }

  private focusArmy(): Army {
    const st = useApp.getState();
    if (st.mode === 'battle' && this.battle) {
      const keys = Object.keys(this.battle.armies);
      if (st.followArmy !== 'auto' && this.battle.armies[st.followArmy]) return this.battle.armies[st.followArmy];
      for (const k of keys) {
        const a = this.battle.armies[k];
        if (this.day >= a.startDay && this.day < a.endDay) return a;
      }
      return this.battle.armies[keys[0]];
    }
    if (st.followArmy !== 'auto' && this.global.armies[st.followArmy]) {
      const enabled = st.followArmy === 'central' || st.show[st.followArmy as 'fourth' | 'second'];
      if (enabled) return this.global.armies[st.followArmy];
    }
    const order = ['central', 'fourth', 'second'];
    let best: Army | null = null;
    for (const k of order) {
      if (k !== 'central' && !st.show[k as 'fourth' | 'second']) continue;
      const a = this.global.armies[k];
      if (this.day >= a.startDay && this.day < a.endDay) { best = a; break; }
    }
    if (!best) {
      for (const k of order) {
        const a = this.global.armies[k];
        if (this.day >= a.endDay && (!best || a.endDay > best.endDay)) best = a;
      }
    }
    return best || this.global.armies.central;
  }

  private focusPos(out: THREE.Vector3): THREE.Vector3 {
    const a = this.focusArmy();
    if (a.head.visible) out.copy(a.head.position);
    else out.copy(a.curve.getPoint(a.tAt(this.day)));
    out.y *= useApp.getState().fx.exag;
    return out;
  }

  private applyVisibility(show: ShowFlags): void {
    for (const a of Object.values(this.global.armies)) a.setGhost(show.ghost);
    for (const sys of this.battleCache.values()) for (const a of Object.values(sys.armies)) a.setGhost(show.ghost);
    this.world.riverGroup.visible = show.rivers;
    for (const sp of this.world.labels) sp.visible = show.labels;
  }

  private applyExag(f: number): void {
    this.world.setExaggeration(f);
    const all = [this.global, ...this.battleCache.values()];
    for (const sys of all) {
      sys.enemies.setExaggeration(f);
      sys.markers.setExaggeration(f);
      sys.ring?.setExaggeration(f);
      for (const a of Object.values(sys.armies)) a.grp.scale.y = f;
    }
    this.fxGroup.scale.y = f;
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.time += dt;
    const st = useApp.getState();
    const inBattle = st.mode === 'battle' && !!this.battle;

    if (st.playing && !this.dragging) {
      this.setDay(this.day + st.speed * dt);
      if (!inBattle && this.day >= TOTAL_DAYS && !this.finaleShown) {
        this.finaleShown = true;
        useApp.setState({ playing: false, finaleOpen: true });
        this.audio.forEvent('join');
      }
      if (inBattle && this.day >= this.activeEndDay() && !this.battleDoneShown) {
        this.battleDoneShown = true;
        useApp.setState({ playing: false, battleDone: true });
        this.audio.forEvent('join');
      }
    }

    if (st.show !== this.lastShow) { this.lastShow = st.show; this.applyVisibility(st.show); }
    if (st.fx !== this.lastFx) {
      const prev = this.lastFx;
      this.lastFx = st.fx;
      this.bloom.enabled = st.fx.bloom;
      this.bloom.strength = st.fx.glow;
      this.renderer.toneMappingExposure = st.fx.exposure;
      this.snow.geometry.setDrawRange(0, Math.floor(500 * st.fx.particles));
      this.dust.geometry.setDrawRange(0, Math.floor(260 * st.fx.particles));
      if (!prev || prev.exag !== st.fx.exag) this.applyExag(st.fx.exag);
    }
    if (st.sound !== this.lastSound) { this.lastSound = st.sound; this.audio.setEnabled(st.sound); }

    // 可见性门控：全景 vs 战役
    this.global.armies.central.setEnabled(!inBattle);
    this.global.armies.fourth.setEnabled(!inBattle && st.show.fourth);
    this.global.armies.second.setEnabled(!inBattle && st.show.second);
    this.global.enemies.grp.visible = !inBattle && st.show.enemies;
    this.global.markers.byArmy.central.visible = !inBattle;
    this.global.markers.byArmy.fourth.visible = !inBattle && st.show.fourth;
    this.global.markers.byArmy.second.visible = !inBattle && st.show.second;
    this.global.markers.byArmy.join.visible = !inBattle;
    for (const bs of this.battleCache.values()) {
      const on = inBattle && bs === this.battle;
      for (const a of Object.values(bs.armies)) a.setEnabled(on);
      bs.enemies.grp.visible = on && st.show.enemies;
      for (const g of Object.values(bs.markers.byArmy)) g.visible = on;
      bs.ring?.setVisible(on && st.show.enemies);
    }

    const sys = inBattle ? this.battle! : this.global;
    for (const a of Object.values(sys.armies)) {
      a.reveal(this.day);
      if (a.head.visible) {
        a.ring.scale.setScalar(1 + 0.18 * Math.sin(this.time * 4));
        a.ring.material.opacity = 0.55 + 0.3 * Math.sin(this.time * 4);
        a.glow.material.opacity = 0.7 + 0.25 * Math.sin(this.time * 3);
      }
    }
    sys.enemies.update(this.day, this.time, st.show.labels);
    if (inBattle) this.battle!.ring?.update(this.day, this.time);

    // 事件标记：未来事件完全隐藏；已过事件标签随时间淡出；屏幕空间去重叠防堆叠
    const labelCands: { m: (typeof sys.markers.markers)[number]; op: number; isCur: boolean; day: number }[] = [];
    for (const m of sys.markers.markers) {
      const past = this.day >= m.day;
      m.mesh.visible = past;
      m.mesh.material.opacity = past ? 1 : 0;
      m.mesh.material.emissiveIntensity = past ? 1.2 : 0;
      m.mesh.rotation.y = this.time * 0.9;
      const isCur = !!st.current && st.current.id === m.ev.id;
      m.mesh.scale.setScalar(isCur ? 1.5 + 0.25 * Math.sin(this.time * 5) : 1);
      if (!past || !st.show.labels) { m.label.visible = false; continue; }
      const age = this.day - m.day;
      const op = isCur ? 1 : Math.max(0, 1 - Math.max(0, age - 12) / 28) * 0.9;
      if (op <= 0.05) { m.label.visible = false; continue; }
      m.label.material.opacity = op;
      labelCands.push({ m, op, isCur, day: m.day });
    }
    labelCands.sort((a, b) => (b.isCur ? 1 : 0) - (a.isCur ? 1 : 0) || b.day - a.day);
    const accepted: { x: number; y: number; w: number; h: number }[] = [];
    const pxPerUnitBase = innerHeight / (2 * Math.tan((this.camera.fov / 2) * Math.PI / 180));
    for (const c of labelCands) {
      c.m.label.getWorldPosition(this.tmpV2);
      const dist = this.tmpV2.distanceTo(this.camera.position);
      this.tmpV2.project(this.camera);
      if (this.tmpV2.z > 1 || this.tmpV2.z < -1 || dist < 0.001) { c.m.label.visible = false; continue; }
      const sx = (this.tmpV2.x * 0.5 + 0.5) * innerWidth;
      const sy = (-this.tmpV2.y * 0.5 + 0.5) * innerHeight;
      const ppu = pxPerUnitBase / dist;
      const w = c.m.label.scale.x * ppu + 8;
      const h = c.m.label.scale.y * ppu + 6;
      const rect = { x: sx - w / 2, y: sy - h / 2, w, h };
      const hit = accepted.some((r) => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y);
      if (hit) { c.m.label.visible = false; }
      else { c.m.label.visible = true; accepted.push(rect); }
    }

    if (this.camTween) {
      this.camTween.t += dt;
      const k = ease(clamp(this.camTween.t / this.camTween.dur, 0, 1));
      this.camera.position.lerpVectors(this.camTween.fp, this.camTween.tp, k);
      this.controls.target.lerpVectors(this.camTween.ft, this.camTween.tt, k);
      if (this.camTween.t >= this.camTween.dur) {
        const done = this.camTween.done;
        this.camTween = null;
        this.controls.enabled = true;
        done?.();
      }
    } else if (st.follow) {
      this.focusPos(this.tmpV);
      const delta = this.tmpV.sub(this.controls.target).multiplyScalar(Math.min(1, dt * 2.2));
      this.controls.target.add(delta);
      this.camera.position.add(delta);
    }
    this.controls.update();

    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) { b.sp.visible = false; continue; }
      b.vel.y -= 3.2 * dt;
      b.vel.multiplyScalar(1 - 1.6 * dt);
      b.sp.position.addScaledVector(b.vel, dt);
      b.sp.material.opacity = clamp(b.life / b.max, 0, 1) * 0.9;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.m.visible = false; continue; }
      const k = 1 - r.life / 1.2;
      r.m.scale.setScalar(0.4 + k * 9);
      r.m.material.opacity = (1 - k) * 0.85;
    }
    {
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const n = Math.floor(500 * st.fx.particles);
      for (let i = 0; i < n; i++) {
        let y = p.getY(i) - dt * (0.7 + (i % 5) * 0.12);
        let x = p.getX(i) + Math.sin(this.time * 0.7 + i) * dt * 0.35;
        if (y < 0.4) { y = 8.5; x = (99.3 + Math.random() * 5.4 - 107.5) * 8.7; }
        p.setY(i, y); p.setX(i, x);
      }
      p.needsUpdate = true;
      const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      const dn = Math.floor(260 * st.fx.particles);
      for (let i = 0; i < dn; i++) {
        dp.setX(i, dp.getX(i) + Math.sin(this.time * 0.3 + i * 1.7) * dt * 0.5);
        dp.setY(i, dp.getY(i) + Math.cos(this.time * 0.2 + i) * dt * 0.2);
      }
      dp.needsUpdate = true;
    }
    {
      const inGrass = this.day > dayOf('1935-08-10') && this.day < dayOf('1935-09-20');
      for (const sp of this.fogSprites) {
        sp.position.x += Math.sin(this.time * 0.15 + sp.userData.seed) * dt * 0.4;
        sp.material.opacity = (inGrass ? 0.16 : 0.05) * (0.7 + 0.3 * Math.sin(this.time * 0.4 + sp.userData.seed));
      }
    }

    this.windTimer += dt;
    if (this.windTimer > 0.6) {
      this.windTimer = 0;
      this.focusPos(this.tmpV);
      const h = this.tmpV.y / st.fx.exag;
      this.audio.setWind(h > 2.6 ? 1 : h > 1.4 ? 0.5 : 0.15);
    }

    if (this.bloomPulse > 0) {
      this.bloomPulse = Math.max(0, this.bloomPulse - dt * 1.4);
      this.bloom.strength = st.fx.glow + this.bloomPulse;
    }

    this.composer.render();
  };
}