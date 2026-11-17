// 3D 地图渲染层（一期）：真实高程网格＋动态省份贴图（归属/高亮随状态重绘）＋自有模型单位＋HTML 标签覆盖层。
// 与 2D SVG 层并存（设置开关切换）；交互口径与 P0 一致：射线→UV→游戏坐标→provinceAtPoint 点内判定。
// 本模块不改游戏状态：点选只回调 onPick(provinceId)，后续走 main.ts 的 onProvinceClick 全流程。
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { PROVINCES, PROVINCE_MAP, MAP_W, MAP_H } from "../data/provinces";
import { FACTIONS } from "../data/factions";
import { TEMPLATES } from "../data/units";
import { TERRAIN_PARAMS } from "../data/terrain";
import { neighborsOf, isSeaEdge } from "../core/mapGraph";
import { provinceAtPoint } from "./provinceHit";
import type { GameState } from "../state/types";

const HEIGHT_SCALE = 46;
const EXAGGERATION = 1.35;
const TEX_SCALE = 2;

export interface Map3DInput {
  state: GameState;
  selectedProvince: string | null;
  reachable: Set<string> | null;
  attackable: Set<string>;
  mode: "political" | "terrain";
}
export interface LabelData {
  id: string;
  name: string;
  cx: number;
  cy: number;
  priority: number; // 选中 5 > 首都 4 > 大城市 3 > 港口 2 > 普通 1
  base: number; // 2D 口径字号（地图单位）
  chars: number;
}

function ownerColor(ownerId: string): string {
  return FACTIONS[ownerId as keyof typeof FACTIONS]?.colorHex ?? "#77796f";
}

// ---------- 单位模型选型（与样机/登记册口径一致） ----------
const INF_VARIANT: Record<string, string> = {
  roc: "infantry_roc", ccp: "infantry_ccp", japan: "infantry_japan", usa: "infantry_usa", uk: "infantry_uk",
};
const MODEL_FILES: Record<string, string> = {
  infantry_roc: "assets/models/infantry_roc.glb", infantry_ccp: "assets/models/infantry_ccp.glb",
  infantry_japan: "assets/models/infantry_japan.glb", infantry_usa: "assets/models/infantry_usa.glb",
  infantry_uk: "assets/models/infantry_uk.glb", infantry_ww2: "assets/models/infantry_ww2.glb",
  cavalry_ussr: "assets/models/cavalry_ussr.glb",
  type95: "assets/models/type95.glb", sherman: "assets/models/sherman.glb", t34: "assets/models/t34.glb",
  tank_medium: "assets/models/tank_medium.glb", tank_light: "assets/models/tank_light.glb",
  fighter_zero: "assets/models/fighter_zero.glb", bomber: "assets/models/bomber.glb",
  carrier: "assets/models/carrier.glb", cruiser: "assets/models/cruiser.glb", destroyer: "assets/models/destroyer.glb",
};
const MODEL_SIZE: Record<string, { size: number; byHeight: boolean }> = {
  infantry_roc: { size: 11, byHeight: true }, infantry_ccp: { size: 11, byHeight: true },
  infantry_japan: { size: 11, byHeight: true }, infantry_usa: { size: 11, byHeight: true },
  infantry_uk: { size: 11, byHeight: true }, infantry_ww2: { size: 11, byHeight: true },
  cavalry_ussr: { size: 14, byHeight: false },
  type95: { size: 18, byHeight: false }, sherman: { size: 19, byHeight: false },
  t34: { size: 19, byHeight: false }, tank_medium: { size: 19, byHeight: false },
  tank_light: { size: 16, byHeight: false },
  fighter_zero: { size: 19, byHeight: false }, bomber: { size: 22, byHeight: false },
  carrier: { size: 36, byHeight: false }, cruiser: { size: 30, byHeight: false },
  destroyer: { size: 25, byHeight: false },
};
const SKINNED = new Set([...Object.values(INF_VARIANT), "infantry_ww2"]);

function modelKeyForDivision(factionId: string, templateId: string): string {
  const tpl = TEMPLATES[templateId];
  const cls = tpl?.cls ?? "infantry";
  if (cls === "armor") {
    return factionId === "japan" ? "type95" : factionId === "usa" ? "sherman" : factionId === "ussr" ? "t34" : "tank_medium";
  }
  if (cls === "motorized") return "tank_light";
  if (cls === "cavalry") return factionId === "ussr" ? "cavalry_ussr" : (INF_VARIANT[factionId] ?? "infantry_ww2");
  return INF_VARIANT[factionId] ?? "infantry_ww2";
}

// ---------- 动态省份贴图 ----------
class ProvinceTexture {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  private basemap: HTMLImageElement | null = null;
  private paths = new Map<string, Path2D>();
  private lastHash = "";
  paintMs = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = MAP_W * TEX_SCALE;
    this.canvas.height = MAP_H * TEX_SCALE;
    this.ctx = this.canvas.getContext("2d")!;
    for (const def of PROVINCES) this.paths.set(def.id, new Path2D(def.path));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.src = "assets/basemap_sat.webp";
    img.addEventListener("load", () => {
      this.basemap = img;
      this.lastHash = ""; // 底图到货后强制重绘一次
    });
    this.paintEmpty();
  }

  private paintEmpty(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = "#22384a";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** 按当前状态重绘（哈希未变则跳过）；返回是否真重绘。 */
  paint(input: Map3DInput): boolean {
    const { state, selectedProvince, reachable, attackable, mode } = input;
    const owners = PROVINCES.map((d) => state.provinces[d.id]?.ownerId ?? "").join(",");
    const hash = [state.turn, mode, selectedProvince ?? "",
      reachable ? [...reachable].sort().join(",") : "",
      [...attackable].sort().join(","), owners, this.basemap ? "img" : "flat"].join("|");
    if (hash === this.lastHash) return false;
    this.lastHash = hash;
    const t0 = performance.now();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.basemap) ctx.drawImage(this.basemap, 0, 0, this.canvas.width, this.canvas.height);
    else this.paintEmpty();
    ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    // 归属/地形罩染
    for (const def of PROVINCES) {
      const st = state.provinces[def.id];
      if (!st) continue;
      const p = this.paths.get(def.id)!;
      ctx.globalAlpha = mode === "terrain" ? 0.45 : 0.55;
      ctx.fillStyle = mode === "terrain" ? TERRAIN_PARAMS[def.terrain].color : ownerColor(st.ownerId);
      ctx.fill(p);
    }
    ctx.globalAlpha = 1;
    // 高亮：可达（蓝）/ 可攻（红）
    if (reachable) {
      ctx.fillStyle = "rgba(110, 195, 255, 0.34)";
      for (const id of reachable) {
        const p = this.paths.get(id);
        if (p) ctx.fill(p);
      }
    }
    if (attackable.size > 0) {
      ctx.fillStyle = "rgba(255, 92, 77, 0.34)";
      for (const id of attackable) {
        const p = this.paths.get(id);
        if (p) ctx.fill(p);
      }
    }
    // 省界
    ctx.strokeStyle = "rgba(24, 19, 12, 0.6)";
    ctx.lineWidth = 0.7;
    for (const def of PROVINCES) ctx.stroke(this.paths.get(def.id)!);
    // 选中省：金色描边＋提亮
    if (selectedProvince && this.paths.has(selectedProvince)) {
      const p = this.paths.get(selectedProvince)!;
      ctx.fillStyle = "rgba(255, 233, 168, 0.30)";
      ctx.fill(p);
      ctx.strokeStyle = "rgba(255, 226, 140, 0.95)";
      ctx.lineWidth = 2.2;
      ctx.stroke(p);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.texture.needsUpdate = true;
    this.paintMs = performance.now() - t0;
    return true;
  }
}

// ---------- 3D 地图 ----------
export class Map3D {
  stats = { paintMs: 0, paints: 0, unitObjects: 0, unitTris: 0, fps: 0, labelsShown: 0 };
  private container: HTMLElement;
  private onPick: (provinceId: string | null) => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private world = new THREE.Group();
  private terrain: THREE.Mesh | null = null;
  private tex = new ProvinceTexture();
  private heights: Float32Array | null = null;
  private hCols = 0;
  private hRows = 0;
  private protos = new Map<string, { obj: THREE.Object3D; tris: number; clips: THREE.AnimationClip[] }>();
  private unitGroup = new THREE.Group();
  private mixers: THREE.AnimationMixer[] = [];
  private unitSignature = "";
  private labelsLayer: HTMLDivElement;
  private labelEls = new Map<string, HTMLDivElement>();
  private labels: LabelData[] = [];
  private running = false;
  private raf = 0;
  private clock = new THREE.Clock();
  private frames = 0;
  private lastFpsAt = performance.now();
  private readyPromise: Promise<void>;

  constructor(container: HTMLElement, onPick: (provinceId: string | null) => void) {
    this.container = container;
    this.onPick = onPick;
    container.classList.add("af-3d-host");
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.classList.add("af-3d-canvas");
    container.append(this.renderer.domElement);
    this.labelsLayer = document.createElement("div");
    this.labelsLayer.className = "af-3d-labels";
    container.append(this.labelsLayer);
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 5000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.335; // 倾斜上限 60°，防迷路
    this.controls.minDistance = 240;
    this.controls.maxDistance = 2100;
    this.scene.background = new THREE.Color(0x10161d);
    this.scene.fog = new THREE.Fog(0x10161d, 1700, 2900);
    this.scene.add(new THREE.AmbientLight(0xbfb49a, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
    sun.position.set(-600, 900, -300);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9db8c4, 0.35);
    fill.position.set(700, 300, 800);
    this.scene.add(fill);
    this.world.scale.y = EXAGGERATION;
    this.scene.add(this.world);
    this.world.add(this.unitGroup);
    this.tiltView();
    this.attachPicking();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.resize();
    this.readyPromise = this.init();
    (window as unknown as { __map3d: Map3D }).__map3d = this;
  }

  private async init(): Promise<void> {
    const hbuf = await fetch("assets/height.bin").then((r) => r.arrayBuffer());
    const view = new DataView(hbuf);
    this.hCols = view.getUint32(0, true);
    this.hRows = view.getUint32(4, true);
    this.heights = new Float32Array(hbuf, 8, this.hCols * this.hRows);
    const geo = new THREE.PlaneGeometry(MAP_W, MAP_H, this.hCols - 1, this.hRows - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const gx = uv.getX(i) * MAP_W;
      const gy = (1 - uv.getY(i)) * MAP_H;
      pos.setY(i, (this.heightAtRaw(gx, gy) / 8848) * HEIGHT_SCALE);
    }
    geo.computeVertexNormals();
    geo.translate(MAP_W / 2, 0, MAP_H / 2);
    this.tex.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.texture, roughness: 0.96, metalness: 0 });
    this.terrain = new THREE.Mesh(geo, mat);
    this.world.add(this.terrain);
    await this.loadProtos();
    // 资源到货后按最近一次输入补刷（单位层在 update 里按签名重建）
    if (this.lastInput) this.update(this.lastInput);
  }

  private heightAtRaw(gx: number, gy: number): number {
    if (!this.heights) return 0;
    const ci = Math.min(this.hCols - 1, Math.max(0, Math.round((gx / MAP_W) * (this.hCols - 1))));
    const ri = Math.min(this.hRows - 1, Math.max(0, Math.round((gy / MAP_H) * (this.hRows - 1))));
    return this.heights[ri * this.hCols + ci]!;
  }
  /** 贴地高度（未乘夸张系数；单位与模型同在 world 组内，组上统一缩放）。 */
  private groundY(gx: number, gy: number): number {
    return (this.heightAtRaw(gx, gy) / 8848) * HEIGHT_SCALE;
  }

  private async loadProtos(): Promise<void> {
    const loader = new GLTFLoader();
    const entries = Object.entries(MODEL_FILES);
    // 分批并行加载（串行逐个在弱 CPU 上要几分钟）
    for (let i = 0; i < entries.length; i += 5) {
      await Promise.all(entries.slice(i, i + 5).map(([key, file]) => this.loadOne(loader, key, file)));
    }
  }

  private async loadOne(loader: GLTFLoader, key: string, file: string): Promise<void> {
      try {
        const gltf = await loader.loadAsync(file);
        const inner = gltf.scene;
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner, true);
        const size = box.getSize(new THREE.Vector3());
        const spec = MODEL_SIZE[key]!;
        const ref = spec.byHeight ? size.y : Math.max(size.x, size.z);
        inner.scale.setScalar(spec.size / ref);
        inner.updateMatrixWorld(true);
        const box2 = new THREE.Box3().setFromObject(inner, true);
        const center = box2.getCenter(new THREE.Vector3());
        inner.position.set(-center.x, -box2.min.y, -center.z);
        const wrap = new THREE.Group();
        wrap.add(inner);
        let tris = 0;
        inner.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            const g = mesh.geometry as THREE.BufferGeometry;
            tris += (g.index ? g.index.count : g.attributes.position!.count) / 3;
          }
        });
        this.protos.set(key, { obj: wrap, tris: Math.round(tris), clips: gltf.animations });
      } catch {
        /* 单个模型缺失不阻塞地图 */
      }
  }

  private place(key: string, x: number, y: number, z: number, rotY: number, phase: number): void {
    const proto = this.protos.get(key);
    if (!proto) return;
    const obj = skeletonClone(proto.obj);
    obj.traverse((o) => { (o as THREE.Mesh).frustumCulled = false; });
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    this.unitGroup.add(obj);
    this.stats.unitTris += proto.tris;
    if (SKINNED.has(key) && proto.clips.length > 0) {
      const mixer = new THREE.AnimationMixer(obj.children[0]!);
      const clip = proto.clips.find((c) => c.name === "march") ?? proto.clips[0]!;
      const action = mixer.clipAction(clip);
      action.time = phase % clip.duration;
      action.timeScale = 0.9;
      action.play();
      this.mixers.push(mixer);
    }
  }

  private rebuildUnits(state: GameState): void {
    this.unitGroup.clear();
    this.mixers = [];
    this.stats.unitTris = 0;
    let objects = 0;
    const byProv = new Map<string, GameState["divisions"]>();
    for (const d of state.divisions) {
      const arr = byProv.get(d.provinceId) ?? [];
      arr.push(d);
      byProv.set(d.provinceId, arr);
    }
    for (const [provId, divs] of byProv) {
      const def = PROVINCE_MAP[provId];
      if (!def) continue;
      const n = Math.min(divs.length, 8);
      for (let i = 0; i < n; i++) {
        const d = divs[i]!;
        const ang = n === 1 ? 0.8 : (i / n) * Math.PI * 2;
        const r = n === 1 ? 0 : 7;
        const gx = def.cx + Math.cos(ang) * r;
        const gy = def.cy + Math.sin(ang) * r;
        this.place(modelKeyForDivision(d.factionId, d.templateId), gx, Math.max(0, this.groundY(gx, gy)), gy, ang + 2.2, i * 0.45 + provId.length);
        objects++;
      }
    }
    for (const sup of state.supports) {
      const def = PROVINCE_MAP[sup.provinceId];
      if (!def) continue;
      if (sup.kind === "fleet") {
        const seaNb = neighborsOf(sup.provinceId).find((nb) => isSeaEdge(sup.provinceId, nb));
        let ax = def.cx + 18;
        let ay = def.cy + 10;
        if (seaNb) {
          const nd = PROVINCE_MAP[seaNb]!;
          const dx = nd.cx - def.cx;
          const dy = nd.cy - def.cy;
          const len = Math.hypot(dx, dy) || 1;
          ax = def.cx + (dx / len) * 30;
          ay = def.cy + (dy / len) * 30;
        }
        const heading = Math.atan2(ax - def.cx, ay - def.cy);
        this.place("carrier", ax, 0.4, ay, heading, 0);
        this.place("cruiser", ax + 14, 0.4, ay + 8, heading, 0);
        this.place("destroyer", ax - 12, 0.4, ay + 10, heading, 0);
        objects += 3;
      } else {
        const key = sup.kind === "bomber" ? "bomber" : "fighter_zero";
        this.place(key, def.cx + 5, this.groundY(def.cx, def.cy) + 15, def.cy - 4, 0.7, 0);
        objects++;
      }
    }
    this.stats.unitObjects = objects;
  }

  private lastInput: Map3DInput | null = null;

  /** 状态刷新入口：贴图按哈希重绘、单位按签名重建。 */
  update(input: Map3DInput): void {
    this.lastInput = input;
    if (this.tex.paint(input)) {
      this.stats.paintMs = this.tex.paintMs;
      this.stats.paints++;
    }
    const sig = input.state.divisions.map((d) => `${d.id}@${d.provinceId}`).join(",")
      + "|" + input.state.supports.map((s) => `${s.id}@${s.provinceId}`).join(",");
    if (sig !== this.unitSignature && this.protos.size > 0) {
      this.unitSignature = sig;
      this.rebuildUnits(input.state);
    }
  }

  setLabels(labels: LabelData[]): void {
    this.labels = labels;
    const wanted = new Set(labels.map((l) => l.id));
    for (const [id, elx] of this.labelEls) {
      if (!wanted.has(id)) {
        elx.remove();
        this.labelEls.delete(id);
      }
    }
    for (const l of labels) {
      if (!this.labelEls.has(l.id)) {
        const d = document.createElement("div");
        d.className = "af-3d-label";
        d.textContent = l.name;
        this.labelsLayer.append(d);
        this.labelEls.set(l.id, d);
      }
    }
  }

  private projectLabels(): void {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const tier = dist >= 1250 ? 1 : dist >= 750 ? 2 : 3;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    const v = new THREE.Vector3();
    const kept: Array<{ x: number; y: number; w: number; h: number }> = [];
    let shown = 0;
    const sorted = [...this.labels].sort((a, b) => b.priority - a.priority);
    for (const l of sorted) {
      const elx = this.labelEls.get(l.id);
      if (!elx) continue;
      const minP = tier === 1 ? 4 : tier === 2 ? 3 : 1;
      if (l.priority < minP) {
        elx.style.display = "none";
        continue;
      }
      v.set(l.cx, this.groundY(l.cx, l.cy) * EXAGGERATION + 7, l.cy);
      v.project(this.camera);
      if (v.z > 1 || v.z < -1) {
        elx.style.display = "none";
        continue;
      }
      const sx = ((v.x + 1) / 2) * w;
      const sy = ((1 - v.y) / 2) * h;
      const fs = l.base * 1.45 * Math.pow(1500 / Math.max(400, dist), 0.45);
      const rect = { x: sx - (l.chars * fs * 0.62) / 2, y: sy - fs / 2, w: l.chars * fs * 0.62, h: fs * 1.25 };
      if (kept.some((k) => rect.x < k.x + k.w && rect.x + rect.w > k.x && rect.y < k.y + k.h && rect.y + rect.h > k.y)) {
        elx.style.display = "none";
        continue;
      }
      kept.push(rect);
      shown++;
      elx.style.display = "block";
      elx.style.fontSize = `${fs.toFixed(1)}px`;
      elx.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      elx.classList.toggle("af-3d-label-capital", l.priority >= 4);
    }
    this.stats.labelsShown = shown;
  }

  private attachPicking(): void {
    const elx = this.renderer.domElement;
    let downX = 0;
    let downY = 0;
    let downAt = 0;
    elx.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downAt = performance.now();
    });
    elx.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downAt > 500) return;
      if (!this.terrain) return;
      const rect = elx.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(pointer, this.camera);
      const hit = ray.intersectObject(this.terrain)[0];
      if (!hit || !hit.uv) {
        this.onPick(null);
        return;
      }
      const gx = hit.uv.x * MAP_W;
      const gy = (1 - hit.uv.y) * MAP_H;
      this.onPick(provinceAtPoint(gx, gy));
    });
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private wantRunning = false;

  setRunning(v: boolean): void {
    this.wantRunning = v;
    if (!v) {
      if (this.running) {
        this.running = false;
        cancelAnimationFrame(this.raf);
      }
      return;
    }
    if (this.running) return;
    // init 未完成时先等（软渲染循环会抢占模型加载的 CPU）
    void this.readyPromise.then(() => {
      if (this.wantRunning && !this.running) this.startLoop();
    });
  }

  private startLoop(): void {
    this.running = true;
    {
      this.clock.getDelta();
      const loop = (): void => {
        if (!this.running) return;
        const dt = Math.min(0.05, this.clock.getDelta());
        for (const m of this.mixers) m.update(dt);
        this.controls.update();
        // 相机目标钳制在地图范围内，防平移迷路
        const t = this.controls.target;
        t.x = Math.min(MAP_W + 120, Math.max(-120, t.x));
        t.z = Math.min(MAP_H + 120, Math.max(-120, t.z));
        t.y = 0;
        this.renderer.render(this.scene, this.camera);
        this.projectLabels();
        this.frames++;
        const now = performance.now();
        if (now - this.lastFpsAt >= 1000) {
          this.stats.fps = Math.round((this.frames * 1000) / (now - this.lastFpsAt));
          this.frames = 0;
          this.lastFpsAt = now;
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  resetView(): void {
    this.camera.position.set(MAP_W / 2, 1060, MAP_H / 2 + 250);
    this.controls.target.set(MAP_W / 2, 0, MAP_H / 2);
    this.controls.update();
  }
  tiltView(): void {
    this.camera.position.set(MAP_W / 2, 480, MAP_H / 2 + 890);
    this.controls.target.set(MAP_W / 2, 0, MAP_H / 2 - 40);
    this.controls.update();
  }
  focusOn(gx: number, gy: number): void {
    const off = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(gx, 0, gy);
    this.camera.position.set(gx + off.x, off.y, gy + off.z);
    this.controls.update();
  }
  zoomBy(factor: number): void {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = Math.min(2100, Math.max(240, dir.length() * factor));
    dir.setLength(len);
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
  }
  /** 游戏坐标 → 容器内像素坐标（验收/调试用）。 */
  project(gx: number, gy: number): { x: number; y: number } | null {
    const v = new THREE.Vector3(gx, this.groundY(gx, gy) * EXAGGERATION + 4, gy);
    v.project(this.camera);
    if (v.z > 1) return null;
    return {
      x: ((v.x + 1) / 2) * this.container.clientWidth,
      y: ((1 - v.y) / 2) * this.container.clientHeight,
    };
  }
  get isReady(): Promise<void> {
    return this.readyPromise;
  }
}
