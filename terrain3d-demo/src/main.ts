// 3D 地形可行性样机：高度场网格 + 现行 2D 地图贴图 + 轨道相机 + 射线拾取省份。
// 只验证「立体化好看 + 能跑」，不接游戏状态。
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";

const MAP_W = 821;
const MAP_H = 803;
const HEIGHT_SCALE = 46; // 高程归一化：8848m -> 约 32 个地图单位（再乘夸张系数）

interface ProvPoly { id: string; name: string; owner: string; polys: number[][][] }

const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
app.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10161d);
scene.fog = new THREE.Fog(0x10161d, 1400, 2600);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 180;
controls.maxDistance = 2400;

function topView(): void {
  camera.position.set(MAP_W / 2, 1050, MAP_H / 2 + 240);
  controls.target.set(MAP_W / 2, 0, MAP_H / 2);
  controls.update();
}
function tiltView(): void {
  camera.position.set(MAP_W / 2, 470, MAP_H / 2 + 880);
  controls.target.set(MAP_W / 2, 0, MAP_H / 2 - 40);
  controls.update();
}
topView();

scene.add(new THREE.AmbientLight(0xbfb49a, 0.85));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
sun.position.set(-600, 900, -300);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9db8c4, 0.35);
fill.position.set(700, 300, 800);
scene.add(fill);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

let terrainMesh: THREE.Mesh | null = null;
let highlightMesh: THREE.Mesh | null = null;
let provinces: ProvPoly[] = [];
const statsEl = document.getElementById("stats")!;
const pickedEl = document.getElementById("picked")!;

async function init(): Promise<void> {
  const [hbuf, prov] = await Promise.all([
    fetch("height.bin").then((r) => r.arrayBuffer()),
    fetch("provinces.json").then((r) => r.json()) as Promise<ProvPoly[]>,
  ]);
  provinces = prov;
  const view = new DataView(hbuf);
  const cols = view.getUint32(0, true);
  const rows = view.getUint32(4, true);
  const heights = new Float32Array(hbuf, 8, cols * rows);

  const geo = new THREE.PlaneGeometry(MAP_W, MAP_H, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2); // XZ 平面，+Y 为高；UV 与游戏坐标同向（v 翻转在下方处理）
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const gx = uv.getX(i) * MAP_W;
    const gy = (1 - uv.getY(i)) * MAP_H;
    const ci = Math.min(cols - 1, Math.round((gx / MAP_W) * (cols - 1)));
    const ri = Math.min(rows - 1, Math.round((gy / MAP_H) * (rows - 1)));
    const meters = heights[ri * cols + ci]!;
    pos.setY(i, (meters / 8848) * HEIGHT_SCALE);
  }
  geo.computeVertexNormals();
  geo.translate(MAP_W / 2, 0, MAP_H / 2); // PlaneGeometry 以原点为中心，平移到游戏坐标系

  const tex = await new THREE.TextureLoader().loadAsync("map_texture.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0.0 });
  terrainMesh = new THREE.Mesh(geo, mat);
  worldGroup.add(terrainMesh);

  // 高亮层：同几何克隆，透明贴图按拾取重绘
  const hlCanvas = document.createElement("canvas");
  hlCanvas.width = 1024; hlCanvas.height = 1002;
  const hlTex = new THREE.CanvasTexture(hlCanvas);
  const hlMat = new THREE.MeshBasicMaterial({
    map: hlTex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  highlightMesh = new THREE.Mesh(geo.clone(), hlMat);
  highlightMesh.position.y = 0.22;
  highlightMesh.userData = { canvas: hlCanvas, tex: hlTex };
  worldGroup.add(highlightMesh);

  const tris = (geo.index ? geo.index.count : pos.count) / 3;
  statsEl.innerHTML =
    `网格 ${cols}×${rows} · 三角面 ${Math.round(tris).toLocaleString()} · 贴图 1642×1606 (394KB)<br />` +
    `<span id="fps">帧率 …</span>`;

  await loadUnits((gx, gy) => {
    const ci = Math.min(cols - 1, Math.max(0, (gx / MAP_W) * (cols - 1)));
    const ri = Math.min(rows - 1, Math.max(0, (gy / MAP_H) * (rows - 1)));
    const i0 = Math.floor(ci), j0 = Math.floor(ri);
    const fx = ci - i0, fy = ri - j0;
    const g = (ii: number, jj: number) => heights[Math.min(rows - 1, jj) * cols + Math.min(cols - 1, ii)]!;
    const meters = (g(i0, j0) * (1 - fx) + g(i0 + 1, j0) * fx) * (1 - fy)
      + (g(i0, j0 + 1) * (1 - fx) + g(i0 + 1, j0 + 1) * fx) * fy;
    return (meters / 8848) * HEIGHT_SCALE;
  });

  applyExagg();
}

function applyExagg(): void {
  const v = Number((document.getElementById("exagg") as HTMLInputElement).value);
  document.getElementById("exaggVal")!.textContent = `${v.toFixed(1)}×`;
  worldGroup.scale.y = v;
}

// --- 省份拾取：射线 -> UV -> 游戏坐标 -> 点在多边形内 ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pointInPoly(x: number, y: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!; const [xj, yj] = poly[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
let downAt = 0;
renderer.domElement.addEventListener("pointerdown", () => { downAt = performance.now(); });
renderer.domElement.addEventListener("pointerup", (ev) => {
  if (performance.now() - downAt > 220 || !terrainMesh || !highlightMesh) return; // 拖动不算点选
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(terrainMesh)[0];
  if (!hit || !hit.uv) { pickedEl.textContent = "未选中省份（海面）"; return; }
  const gx = hit.uv.x * MAP_W;
  const gy = (1 - hit.uv.y) * MAP_H;
  const found = provinces.find((p) => p.polys.some((poly) => pointInPoly(gx, gy, poly)));
  const { canvas, tex } = highlightMesh.userData as { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (found) {
    ctx.fillStyle = "rgba(255, 233, 168, 0.42)";
    ctx.strokeStyle = "rgba(255, 240, 190, 0.95)";
    ctx.lineWidth = 2.5;
    for (const poly of found.polys) {
      ctx.beginPath();
      poly.forEach(([x, y], i) => {
        const cx = (x / MAP_W) * canvas.width;
        const cy = (y / MAP_H) * canvas.height;
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    pickedEl.textContent = `选中：${found.name}（${found.id}）`;
  } else {
    pickedEl.textContent = "未选中省份（海面/无主地）";
  }
  tex.needsUpdate = true;
});


// --- 单位摆放（开局布势 13 省）：全部用项目自有模型库（assets/models，台账 C3/C4），按势力选变体 ---
interface UnitItem { kind: string; label: string; icon: string; factionId: string; templateId?: string; supportKind?: string; anchor?: [number, number] }
interface UnitProv { province: string; name: string; cx: number; cy: number; faction: string; color: string; items: UnitItem[] }

const INF_VARIANT: Record<string, string> = {
  roc: "infantry_roc", ccp: "infantry_ccp", japan: "infantry_japan", usa: "infantry_usa", uk: "infantry_uk",
};
const MODEL_FILES: Record<string, string> = {
  infantry_roc: "models/infantry_roc.glb", infantry_ccp: "models/infantry_ccp.glb",
  infantry_japan: "models/infantry_japan.glb", infantry_usa: "models/infantry_usa.glb",
  infantry_uk: "models/infantry_uk.glb", infantry_ww2: "models/infantry_ww2.glb",
  cavalry_ussr: "models/cavalry_ussr.glb",
  type95: "models/type95.glb", sherman: "models/sherman.glb", t34: "models/t34.glb",
  tank_medium: "models/tank_medium.glb", tank_light: "models/tank_light.glb",
  fighter_zero: "models/fighter_zero.glb", bomber: "models/bomber.glb",
  carrier: "models/carrier.glb", cruiser: "models/cruiser.glb", destroyer: "models/destroyer.glb",
};
// 归一目标尺寸：步兵按身高，其余按水平跨度（地图单位）
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
const SKINNED = new Set(Object.keys(INF_VARIANT).map((k) => INF_VARIANT[k]!).concat(["infantry_ww2"]));

function modelKeyFor(item: UnitItem): string {
  switch (item.kind) {
    case "soldier": return INF_VARIANT[item.factionId] ?? "infantry_ww2";
    case "cavalry": return item.factionId === "ussr" ? "cavalry_ussr" : (INF_VARIANT[item.factionId] ?? "infantry_ww2");
    case "tank":
      return item.factionId === "japan" ? "type95"
        : item.factionId === "usa" ? "sherman"
        : item.factionId === "ussr" ? "t34" : "tank_medium";
    case "truck": return "tank_light"; // C3 清单无摩托化卡车模型，以轻型坦克代车辆（台账口径）
    case "plane": return item.supportKind === "bomber" ? "bomber" : "fighter_zero";
    default: return "infantry_ww2";
  }
}

const labelAnchors: { el: HTMLDivElement; gx: number; gy: number; h: number }[] = [];
const mixers: THREE.AnimationMixer[] = [];
let unitStats = { items: 0, tris: 0 };

async function loadUnits(heightAt: (gx: number, gy: number) => number): Promise<void> {
  const data = (await fetch("units.json").then((r) => r.json())) as UnitProv[];

  // 先算需要哪些模型（舰队一项拆航母/巡洋/驱逐三舰）
  const needed = new Set<string>();
  for (const prov of data) for (const item of prov.items) {
    if (item.kind === "ship") { needed.add("carrier"); needed.add("cruiser"); needed.add("destroyer"); }
    else needed.add(modelKeyFor(item));
  }
  const loader = new GLTFLoader();
  const protos = new Map<string, { obj: THREE.Object3D; tris: number; clips: THREE.AnimationClip[] }>();
  const triByKind: Record<string, number> = {};
  for (const key of needed) {
    const gltf = await loader.loadAsync(MODEL_FILES[key]!);
    const inner = gltf.scene;
    inner.updateMatrixWorld(true);
    // precise=true：蒙皮网格按骨骼实际姿态量界
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
    protos.set(key, { obj: wrap, tris: Math.round(tris), clips: gltf.animations });
    triByKind[key] = Math.round(tris);
  }
  const labelsRoot = document.getElementById("labels")!;
  let placedTris = 0;
  const placeOne = (key: string, x: number, y: number, z: number, rotY: number, phase: number): void => {
    const proto = protos.get(key)!;
    const obj = skeletonClone(proto.obj);
    obj.traverse((o) => { (o as THREE.Mesh).frustumCulled = false; }); // 蒙皮包围球不可靠，关剔除
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    worldGroup.add(obj);
    placedTris += proto.tris;
    // 步兵骨骼动画：march 循环（相位错开，不整齐划一）
    if (SKINNED.has(key) && proto.clips.length > 0) {
      const innerClone = obj.children[0]!;
      const mixer = new THREE.AnimationMixer(innerClone);
      const clip = proto.clips.find((c) => c.name === "march") ?? proto.clips[0]!;
      const action = mixer.clipAction(clip);
      action.time = phase % clip.duration;
      action.timeScale = 0.9;
      action.play();
      mixers.push(mixer);
    }
  };
  for (const prov of data) {
    const summary: string[] = [];
    prov.items.forEach((item, idx) => {
      summary.push(`${item.icon} ${item.label}`);
      const angle = idx * 2.4;
      const radius = idx === 0 ? 0 : 11;
      const gx = prov.cx + Math.cos(angle) * radius;
      const gy = prov.cy + Math.sin(angle) * radius;
      if (item.kind === "ship" && item.anchor) {
        // 舰队编成：航母居中、巡洋/驱逐两翼（锚点在近海）
        const heading = Math.atan2(item.anchor[0] - prov.cx, item.anchor[1] - prov.cy);
        placeOne("carrier", item.anchor[0], 0.4, item.anchor[1], heading, 0);
        placeOne("cruiser", item.anchor[0] + 14, 0.4, item.anchor[1] + 8, heading, 0);
        placeOne("destroyer", item.anchor[0] - 12, 0.4, item.anchor[1] + 10, heading, 0);
      } else if (item.kind === "plane") {
        const key = modelKeyFor(item);
        placeOne(key, gx, heightAt(gx, gy) + 15, gy, angle + 0.6, idx);
      } else {
        const key = modelKeyFor(item);
        const figures = item.kind === "soldier" || item.kind === "cavalry" ? 3 : 1;
        for (let f = 0; f < figures; f++) {
          const ox = figures > 1 ? Math.cos(f * 2.1) * 4.5 : 0;
          const oz = figures > 1 ? Math.sin(f * 2.1) * 4.5 : 0;
          placeOne(key, gx + ox, Math.max(0, heightAt(gx + ox, gy + oz)), gy + oz, angle + f * 0.7, idx * 0.7 + f * 0.45);
        }
      }
      unitStats.items++;
    });
    const el = document.createElement("div");
    el.className = "unit-label";
    el.innerHTML = `<b style="border-left: 4px solid ${prov.color}">${prov.name} · ${prov.faction}</b><br />${summary.join(" · ")}`;
    labelsRoot.append(el);
    labelAnchors.push({ el, gx: prov.cx, gy: prov.cy, h: heightAt(prov.cx, prov.cy) });
  }
  unitStats.tris = placedTris;
  (window as unknown as { __units: unknown }).__units = { provinces: data.length, items: unitStats.items, placedTris, triByKind, animatedSoldiers: mixers.length };
  const st = document.getElementById("stats");
  if (st) st.innerHTML += `<br />单位：${data.length} 省 ${unitStats.items} 支（自有模型 · 三角面合计 ${placedTris.toLocaleString()} · 步兵动画 ${mixers.length} 个）`;
}

const projV = new THREE.Vector3();
function updateLabels(): void {
  for (const a of labelAnchors) {
    projV.set(a.gx, a.h + 26, a.gy);
    worldGroup.localToWorld(projV);
    projV.project(camera);
    if (projV.z > 1 || projV.z < -1) { a.el.style.display = "none"; continue; }
    a.el.style.display = "block";
    a.el.style.left = `${((projV.x + 1) / 2) * innerWidth}px`;
    a.el.style.top = `${((1 - projV.y) / 2) * innerHeight}px`;
  }
}

function eastView(): void {
  camera.position.set(400, 320, 660);
  controls.target.set(528, 0, 336);
  controls.update();
}
document.getElementById("resetView")!.addEventListener("click", topView);
document.getElementById("eastView")!.addEventListener("click", eastView);
document.getElementById("tiltView")!.addEventListener("click", tiltView);
document.getElementById("exagg")!.addEventListener("input", applyExagg);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- 帧率统计（1 秒滑动平均，写 window 供验收脚本读） ---
let frames = 0;
let lastStat = performance.now();
(window as unknown as { __fps: number }).__fps = 0;
const animClock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = animClock.getDelta();
  for (const m of mixers) m.update(dt);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  frames++;
  const now = performance.now();
  if (now - lastStat >= 1000) {
    const fps = Math.round((frames * 1000) / (now - lastStat));
    (window as unknown as { __fps: number }).__fps = fps;
    const el = document.getElementById("fps");
    if (el) el.textContent = `帧率 ${fps} FPS`;
    frames = 0; lastStat = now;
  }
});

init().catch((e: unknown) => {
  (window as unknown as { __error: string }).__error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.error("init failed", e);
});
