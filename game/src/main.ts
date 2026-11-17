// 《亚洲战场》第一版可玩界面（M3）：选国 -> 省份色块地图 -> 生产/科技/国策/外交/纪事全接线。
// UI 只读状态、只经 applyAction 改状态（铁律）。LLM 对话本版仅保留骨架入口（设置在纪事页）。

import { FACTIONS, FACTION_IDS, type FactionId } from "./data/factions";
import { PROVINCES, PROVINCE_MAP, RIVER_CROSSINGS, MAP_W, MAP_H, isRiverCrossing, type Terrain } from "./data/provinces";
import { RIVER_PATHS, RIVER_FRAME_TRANSFORM } from "./data/rivers";
import { SEA_LABELS } from "./data/seaLabels";
import { BASEMAP_PATH } from "./data/basemap";
import { TEMPLATES, SUPPORTS } from "./data/units";
import { TECH_BRANCHES, TECH_BRANCH_IDS } from "./data/tech";
import { FOCUSES } from "./data/focuses";
import { STATE_MAP } from "./data/states";
import { fullView, zoomAt, panBy, viewBoxString, viewHeight, clampView, type MapView } from "./ui/mapView";
import { TERRAIN_PARAMS } from "./data/terrain";
import { DIPLOMACY_ACTIONS, relationTierOf } from "./data/diplomacy";
import { ECONOMY } from "./data/economy";
import { createInitialState } from "./state/createInitialState";
import { applyAction, type GameAction } from "./core/applyAction";
import { neighborsOf, isSeaEdge } from "./core/mapGraph";
import { audio, initAudioOnFirstInteraction, planSounds } from "./ui/audio";
import { PROVINCE_POLYS, provinceAtPoint } from "./ui/provinceHit";
import { Map3D, type LabelData } from "./ui/map3d";
import { reachableWithin } from "./core/movement";
import { estimateAttack } from "./core/combat";
import { suppliedProvinces } from "./core/supply";
import { findMovePaths } from "./core/movement";
import { isAtWar, isAllied, relationOf, factionPower, controlledProvinceCount } from "./core/relations";
import { SaveManager, serializeSave, importSaveJson } from "./save/saveGame";
import { createLocalStorageAdapter } from "./save/localStorage";
import { loadLlmSettings } from "./llm/llmSettings";
import { getDiplomacyDialogEntry } from "./llm/llmClient";
import type { GameState } from "./state/types";
import "./ui/styles.css";

const app = document.getElementById("app")!;

let game: GameState | null = null;
let selectedProvince: string | null = null;
let selectedDivisionId: string | null = null;
let selectedDivisionIds = new Set<string>(); // 当前指挥编组（勾选的师）
let satBasemapFailed = false; // 卫星底图加载失败标记（失败回退平色剪影）
let drawerOpen = false; // 右侧抽屉面板开关（默认收起，地图为主角）
let selectedSpearheads = new Set<string>();
let pendingMissionSupportId: string | null = null;
let lastDispatchAt = 0; // 音频 UI 委托判重用：刚 dispatch 的按钮不再叠 UI 点击音 // 空军任务改派中：下一次点省 = 设为任务目标 // UI 层矛头指定（下令时随 ATTACK 带上）
let mapMode: "political" | "terrain" = "political";
/** 地图显示模式：3D 立体（默认）/ 2D 平面（性能兜底），存本地。 */
let viewMode: "3d" | "2d" = (() => {
  try {
    const urlView = new URLSearchParams(location.search).get("view");
    if (urlView === "2d" || urlView === "3d") return urlView;
    return localStorage.getItem("asia-front-view") === "2d" ? "2d" : "3d";
  } catch { return "3d"; }
})();
let map3dHandle: Map3D | null = null;
let map3dWrap: HTMLElement | null = null;
let activeTab = "province";
let notice = "";
let noticeIsError = false;
let startSeed = "1936";
let startDifficulty = "normal";

const saveManager = new SaveManager(createLocalStorageAdapter());

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 本回合已下达命令（地图箭头层；结束回合后清除）。 */
interface TurnOrder { kind: "move" | "attack" | "raid"; points: Array<[number, number]> }
let turnOrders: TurnOrder[] = [];
/** 失省警报追踪：上一回合结束时的归属快照（UI 层对比，非引擎状态）。 */
let prevOwners = new Map<string, string>();
let prevTurnSeen = 0;
let lostProvinces: string[] = [];

function dispatch(action: GameAction): boolean {
  if (!game) return false;
  // 命令箭头：成功才记（用动作前状态算行军路径/出发省）
  const pre = game;
  const res = applyAction(game, action);
  if (res.error) {
    notice = `操作失败：${res.error}`;
    noticeIsError = true;
    if (res.error.startsWith("DIPLOMACY_REJECTED")) {
      game = res.state; // 拒绝也已产生状态变化（关系/冷却），如实呈现
    }
    lastDispatchAt = performance.now();
    audio.playCues(planSounds(pre, action, res.state, res.error));
    render();
    return false;
  }
  game = res.state;
  lastDispatchAt = performance.now();
  audio.playCues(planSounds(pre, action, game, null));
  notice = "";
  noticeIsError = false;
  if (action.type === "END_TURN") {
    turnOrders = [];
  } else if (action.type === "MOVE_UNITS") {
    const div = pre.divisions.find((d) => action.divisionIds.includes(d.id));
    const path = div ? findMovePaths(pre, div).get(action.toProvinceId) : undefined;
    const ids = path && path.length >= 2 ? path : [div?.provinceId ?? "", action.toProvinceId];
    turnOrders.push({ kind: "move", points: ids.map((id) => [PROVINCE_MAP[id]!.cx, PROVINCE_MAP[id]!.cy] as [number, number]) });
  } else if (action.type === "ATTACK" || action.type === "RAID") {
    const target = PROVINCE_MAP[action.targetProvinceId]!;
    const origins = [...new Set(pre.divisions.filter((d) => action.divisionIds.includes(d.id)).map((d) => d.provinceId))];
    for (const oid of origins) {
      const o = PROVINCE_MAP[oid]!;
      turnOrders.push({ kind: action.type === "ATTACK" ? "attack" : "raid", points: [[o.cx, o.cy], [target.cx, target.cy]] });
    }
  }
  render();
  return true;
}

function playerId(): string {
  return game?.playerFactionId ?? "roc";
}

function factionName(fid: string): string {
  return FACTIONS[fid as FactionId]?.name ?? (fid === "neutral" ? "中立地区" : fid);
}

function ownerColor(ownerId: string): string {
  return FACTIONS[ownerId as FactionId]?.colorHex ?? "#5a5a5a";
}

// ---------------- 选国界面 ----------------

const BLOC_NAMES: Record<string, string> = {
  axis: "轴心", allies: "同盟", comintern: "共产国际", neutral: "中立",
};
const DIFFICULTY_NAMES: Record<string, string> = {
  simple: "简单", normal: "普通", hard: "困难", hell: "地狱",
};

/** 导入存档成功后的统一落点：换状态、清 UI 选择、顺手存进本地 manual-1 槽。 */
function applyImportedState(state: GameState): void {
  game = state;
  selectedProvince = null;
  selectedDivisionId = null;
  selectedDivisionIds.clear();
  turnOrders = [];
  prevOwners = new Map();
  lostProvinces = [];
  saveManager.save("manual-1", state);
  notice = "存档导入成功，已顺手存入本地 manual-1 槽。";
  noticeIsError = false;
  render();
}

/** 选一个 JSON 文件导入存档（兼容网页版现行存档格式与裸 state 导出）。 */
function pickSaveFile(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const res = importSaveJson(text);
      if (res.ok) applyImportedState(res.state);
      else {
        notice = `存档导入失败：${res.error}`;
        noticeIsError = true;
        render();
      }
    });
  });
  input.click();
}

/** 把当前对局导出为 JSON 文件（与网页版互导）。 */
function exportSaveFile(): void {
  if (!game) return;
  const blob = new Blob([serializeSave(game)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asia-front-save-${game.year}-${String(game.month).padStart(2, "0")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function renderStart(): void {
  app.replaceChildren();
  const wrap = el("div", "af-start");
  const hero = el("div", "af-hero");
  hero.append(el("h1", "af-title", "亚洲战场"));
  wrap.append(hero);
  wrap.append(el("p", "af-subtitle", "1936 年 1 月 · 月回合 · 无回合上限——只看胜负条件：控制 70% 省份，或令其余势力全灭/臣服。选择你要扮演的国家："));
  const controls = el("div", "af-start-controls");
  const seedLabel = el("label", "", "种子 ");
  const seedInput = el("input", "af-input") as HTMLInputElement;
  seedInput.value = startSeed;
  seedInput.addEventListener("change", () => { startSeed = seedInput.value || "1936"; });
  seedLabel.append(seedInput);
  const diffLabel = el("label", "", " AI 难度 ");
  const diffSelect = el("select", "af-input") as HTMLSelectElement;
  for (const [id, name] of [["easy", "简单"], ["normal", "普通"], ["hard", "困难"]] as const) {
    const opt = el("option", "", name) as HTMLOptionElement;
    opt.value = id;
    if (id === startDifficulty) opt.selected = true;
    diffSelect.append(opt);
  }
  diffSelect.addEventListener("change", () => { startDifficulty = diffSelect.value; });
  diffLabel.append(diffSelect);
  const importBtn = el("button", "af-btn af-btn-small", "导入存档 JSON");
  importBtn.title = "把网页版导出的存档 JSON 搬进来继续打";
  importBtn.addEventListener("click", () => pickSaveFile());
  controls.append(seedLabel, diffLabel, importBtn);
  wrap.append(controls);

  const grid = el("div", "af-faction-grid");
  for (const fid of FACTION_IDS) {
    const f = FACTIONS[fid];
    const card = el("button", "af-faction-card");
    card.style.borderTopColor = f.colorHex;
    const head = el("div", "af-faction-head");
    head.append(img(f.flagAsset, "af-flag"));
    if (f.leaderAsset) head.append(img(f.leaderAsset, "af-leader"));
    card.append(head);
    const title = el("div", "af-faction-name");
    const chip = el("span", "af-chip");
    chip.style.background = f.colorHex;
    title.append(chip, document.createTextNode(f.name));
    card.append(title);
    card.append(el("div", "af-faction-line", `领袖：${f.leader.name} · 首都：${PROVINCE_MAP[f.capitalProvinceId]?.name ?? f.capitalProvinceId} · 阵营：${BLOC_NAMES[f.bloc]}`));
    card.append(el("div", "af-faction-line", f.specialty));
    const foot = el("div", "af-faction-foot");
    const diff = el("span", `af-diff af-diff-${f.difficulty.level}`, `难度：${DIFFICULTY_NAMES[f.difficulty.level]}`);
    foot.append(diff);
    foot.append(el("span", "af-faction-reason", f.difficulty.reason));
    card.append(foot);
    if (!f.startsActive && f.spawn) {
      card.append(el("div", "af-faction-line af-warn", `事件生成势力（${f.spawn.year} 年登场）；选它开局将提前激活（what-if）`));
    }
    card.addEventListener("click", () => {
      turnOrders = [];
      prevOwners = new Map();
      prevTurnSeen = 0;
      lostProvinces = [];
      game = createInitialState({
        seed: Number.isNaN(Number(startSeed)) ? startSeed : Number(startSeed),
        playerFactionId: fid,
        difficulty: startDifficulty,
      });
      selectedProvince = f.capitalProvinceId;
      selectedDivisionId = null;
      notice = "";
      render();
    });
    grid.append(card);
  }
  wrap.append(grid);
  app.append(wrap);
}

// ---------------- 地图 ----------------

const CAPITAL_IDS = new Set(Object.values(FACTIONS).map((f) => f.capitalProvinceId));

// 地图视图状态（仅 UI 层，不进存档）：缩放/平移跨重渲染保留；拖动后抑制误触点选。
let mapView: MapView = fullView();

function reachableSet(): Map<string, number> | null {
  if (!game) return null;
  const pid = playerId();
  // 编组选中时：高亮任一选中师可经路径到达的省份（跨省行军）
  if (selectedDivisionIds.size > 0) {
    const out = new Map<string, number>();
    for (const d of game.divisions) {
      if (!selectedDivisionIds.has(d.id) || d.factionId !== pid || d.movedTurn >= game.turn) continue;
      for (const target of findMovePaths(game, d).keys()) {
        if (!out.has(target)) out.set(target, 1);
      }
    }
    return out.size > 0 ? out : null;
  }
  if (!selectedDivisionId) return null;
  const div = game.divisions.find((d) => d.id === selectedDivisionId);
  if (!div || div.factionId !== pid || div.movedTurn >= game.turn) return null;
  return reachableWithin(game, div);
}

/** 当前参战/行动编组：有勾选时用勾选（限未行动），否则用当前省全部未行动己方师（整省快捷）。 */
function currentGroupIds(targetId?: string): string[] {
  const g = game;
  if (!g) return [];
  const pid = playerId();
  const ready = g.divisions.filter((d) => d.factionId === pid && d.movedTurn < g.turn);
  const pool = selectedDivisionIds.size > 0
    ? ready.filter((d) => selectedDivisionIds.has(d.id))
    : ready.filter((d) => d.provinceId === selectedProvince);
  return (targetId ? pool.filter((d) => neighborsOf(d.provinceId).includes(targetId)) : pool).map((d) => d.id);
}

/** 交战省界段缓存：相邻两省共享的边界折线段（顶点对匹配，两省 path 同源几何）。 */
let FRONT_SEGMENTS: Map<string, Array<[number, number, number, number]>> | null = null;
function frontSegments(): Map<string, Array<[number, number, number, number]>> {
  if (FRONT_SEGMENTS) return FRONT_SEGMENTS;
  const map = new Map<string, Array<[number, number, number, number]>>();
  // 两省 path 各自独立简化，顶点不严格重合：改用「边中点到对方折线的距离 < 0.9」判定共享边（容差 3 地图单位）
  const distToSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  for (const def of PROVINCES) {
    for (const nb of neighborsOf(def.id)) {
      if (def.id >= nb) continue;
      const bEdges: Array<[number, number, number, number]> = [];
      for (const sub of PROVINCE_POLYS.get(nb) ?? []) {
        for (let i = 0; i + 1 < sub.length; i++) bEdges.push([sub[i]![0]!, sub[i]![1]!, sub[i + 1]![0]!, sub[i + 1]![1]!]);
      }
      const segs: Array<[number, number, number, number]> = [];
      for (const sub of PROVINCE_POLYS.get(def.id) ?? []) {
        for (let i = 0; i + 1 < sub.length; i++) {
          const p = sub[i]!, q = sub[i + 1]!;
          const mx = (p[0]! + q[0]!) / 2, my = (p[1]! + q[1]!) / 2;
          if (bEdges.some(([ax, ay, bx, by]) => distToSeg(mx, my, ax, ay, bx, by) < 3)) {
            segs.push([p[0]!, p[1]!, q[0]!, q[1]!]);
          }
        }
      }
      if (segs.length > 0) map.set(`${def.id}|${nb}`, segs);
    }
  }
  FRONT_SEGMENTS = map;
  return map;
}

/** 3D 模式下可攻省集合（与 2D 的 af-prov-attack 同口径）。 */
function attackableSet(): Set<string> {
  const out = new Set<string>();
  if (!game || !selectedProvince) return out;
  const pid = playerId();
  const st0 = game.provinces[selectedProvince];
  if (!st0) return out;
  const hasReady = game.divisions.some((d) => d.factionId === pid && d.provinceId === selectedProvince && d.movedTurn < game!.turn);
  if (!hasReady) return out;
  for (const nb of neighborsOf(selectedProvince)) {
    const st = game.provinces[nb]!;
    if (st.ownerId !== pid && st.ownerId !== "neutral" && isAtWar(game, pid, st.ownerId)) out.add(nb);
  }
  return out;
}

/** 3D 标签数据（与 2D renderMap 的 labelRegistry 同口径）。 */
function buildLabels3D(): LabelData[] {
  if (!game) return [];
  return PROVINCES.map((def) => {
    const st = game!.provinces[def.id]!;
    const isCapital = CAPITAL_IDS.has(def.id);
    const isMajor = def.terrain === "urban" && st.factoriesMil + st.factoriesCiv >= 3;
    const isSelected = def.id === selectedProvince;
    return {
      id: def.id, name: def.name, cx: def.cx, cy: def.cy,
      priority: isSelected ? 5 : isCapital ? 4 : isMajor ? 3 : def.isPort ? 2 : 1,
      base: isSelected ? 9.5 : isCapital ? 9.5 : isMajor ? 8.5 : 7.5,
      chars: [...def.name].length,
    };
  });
}

/** 3D 地图容器（单例，跨重渲染搬移复用，WebGL 上下文不重建）。 */
function map3dContainer(): HTMLElement {
  if (map3dWrap) return map3dWrap;
  const wrap = el("div", "af-map-viewport af-3d-wrap");
  const host = el("div", "af-3d-host-slot");
  wrap.append(host);
  map3dHandle = new Map3D(host, (provinceId) => {
    if (provinceId) onProvinceClick(provinceId);
  });
  const controls = el("div", "af-map-controls");
  const mkBtn = (label: string, fn: () => void) => {
    const b = el("button", "af-map-btn", label);
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
  };
  controls.append(
    mkBtn("＋", () => map3dHandle?.zoomBy(1 / 1.4)),
    mkBtn("－", () => map3dHandle?.zoomBy(1.4)),
    mkBtn("俯视", () => map3dHandle?.resetView()),
    mkBtn("倾斜", () => map3dHandle?.tiltView()),
  );
  wrap.append(controls);
  map3dWrap = wrap;
  return wrap;
}

/** 把当前游戏状态同步进 3D 层（贴图/单位/标签）。 */
function syncMap3D(): void {
  if (!map3dHandle || !game) return;
  const reach = reachableSet();
  map3dHandle.update({
    state: game,
    selectedProvince,
    reachable: reach ? new Set(reach.keys()) : null,
    attackable: attackableSet(),
    mode: mapMode,
  });
  map3dHandle.setLabels(buildLabels3D());
  map3dHandle.setRunning(true);
}

function renderMap(): HTMLElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBoxString(mapView));
  svg.setAttribute("class", `af-map af-z${zoomTier()}`);
  attachMapControls(svg);
  const reach = reachableSet();
  const pid = playerId();
  const pathEls = new Map<string, SVGPathElement>();
  labelRegistry = [];
  badgeRegistry = [];
  // A1 卫星底图（美术交付，NASA Blue Marble 按现行游戏坐标系重渲染+同口径调色）：
  // 铺满画布作最底层，陆海皆卫星图本身；加载失败才回退平色剪影（不同时出现）
  if (!satBasemapFailed) {
    const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", "assets/basemap_sat.webp");
    img.setAttribute("x", "0");
    img.setAttribute("y", "0");
    img.setAttribute("width", String(MAP_W));
    img.setAttribute("height", String(MAP_H));
    img.setAttribute("preserveAspectRatio", "none");
    img.setAttribute("class", "af-satbase");
    img.addEventListener("error", () => { satBasemapFailed = true; render(); });
    svg.append(img);
  } else {
    const base = document.createElementNS("http://www.w3.org/2000/svg", "path");
    base.setAttribute("d", BASEMAP_PATH);
    base.setAttribute("class", "af-basemap");
    svg.append(base);
  }
  // SVG defs：A2 地形纹理 pattern ×8 + 命令箭头头
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  for (const t of Object.keys(TERRAIN_PARAMS) as Terrain[]) {
    const pat = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pat.setAttribute("id", `pat-${t}`);
    pat.setAttribute("width", "90"); pat.setAttribute("height", "90");
    pat.setAttribute("patternUnits", "userSpaceOnUse");
    const pim = document.createElementNS("http://www.w3.org/2000/svg", "image");
    pim.setAttribute("href", `assets/terrain/terrain_${t}.png`);
    pim.setAttribute("width", "90"); pim.setAttribute("height", "90");
    pat.append(pim);
    defs.append(pat);
  }
  for (const [id, color] of [["arrowGray", "#cfd6dd"], ["arrowRed", "#ff5147"]] as const) {
    const mk = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    mk.setAttribute("id", id);
    mk.setAttribute("viewBox", "0 0 10 10");
    mk.setAttribute("refX", "8.5"); mk.setAttribute("refY", "5");
    mk.setAttribute("markerWidth", "5.5"); mk.setAttribute("markerHeight", "5.5");
    mk.setAttribute("orient", "auto-start-reverse");
    const mp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mp.setAttribute("d", "M0,0 L10,5 L0,10 z");
    mp.setAttribute("fill", color);
    mk.append(mp);
    defs.append(mk);
  }
  svg.append(defs);
  // A2 地形纹理层（罩染之下、卫星之上；美术 MAP-DRESSING-SPEC 层序）
  for (const def of PROVINCES) {
    const tp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tp.setAttribute("d", def.path);
    tp.setAttribute("fill", `url(#pat-${def.terrain})`);
    tp.setAttribute("fill-opacity", mapMode === "terrain" ? "0.85" : "0.5");
    tp.setAttribute("class", "af-terrain-tex");
    svg.append(tp);
  }
  // A6 经纬网（按游戏帧投影现算，10° 一线，淡白）
  const grat = document.createElementNS("http://www.w3.org/2000/svg", "g");
  grat.setAttribute("class", "af-graticule");
  for (let lon = 60; lon <= 150; lon += 10) {
    const x = ((lon - 59) * 11 * Math.cos((34 * Math.PI) / 180)).toFixed(1);
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", x); ln.setAttribute("x2", x);
    ln.setAttribute("y1", "0"); ln.setAttribute("y2", String(MAP_H));
    grat.append(ln);
  }
  for (let lat = 0; lat <= 60; lat += 10) {
    const y = String((64 - lat) * 11);
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", "0"); ln.setAttribute("x2", String(MAP_W));
    ln.setAttribute("y1", y); ln.setAttribute("y2", y);
    grat.append(ln);
  }
  svg.append(grat);
  // A3 河流矢量（美术 rivers.json 真实河道，旧帧变换到游戏帧）
  const riverG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  riverG.setAttribute("transform", RIVER_FRAME_TRANSFORM);
  riverG.setAttribute("class", "af-rivers-real");
  for (const r of RIVER_PATHS) {
    const rp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    rp.setAttribute("d", r.d);
    riverG.append(rp);
  }
  svg.append(riverG);
  // A6 海域名（纸面色低透明、大字斜排）
  for (const sl of SEA_LABELS) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", String(sl.x));
    t.setAttribute("y", String(sl.y));
    t.setAttribute("transform", `rotate(${sl.rotate} ${sl.x} ${sl.y})`);
    t.setAttribute("class", "af-sea-label");
    t.textContent = sl.name;
    svg.append(t);
  }
  // 省份多边形（归属色半透明罩染，写实地形底图由美术层垫在下方同坐标系）
  for (const def of PROVINCES) {
    const st = game!.provinces[def.id]!;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEls.set(def.id, path);
    path.setAttribute("d", def.path);
    path.setAttribute("fill", mapMode === "terrain" ? TERRAIN_PARAMS[def.terrain].color : ownerColor(st.ownerId));
    if (mapMode === "terrain") path.setAttribute("fill-opacity", "0.45");
    let cls = "af-prov";
    if (def.id === selectedProvince) cls += " af-prov-selected";
    if (reach?.has(def.id)) cls += " af-prov-reach";
    if (selectedProvince && selectedProvince !== def.id
      && game!.divisions.some((d) => d.factionId === pid && d.provinceId === selectedProvince && d.movedTurn < game!.turn)
      && neighborsOf(selectedProvince).includes(def.id)
      && st.ownerId !== pid && st.ownerId !== "neutral"
      && isAtWar(game!, pid, st.ownerId)) {
      cls += " af-prov-attack";
    }
    path.setAttribute("class", cls);
    path.setAttribute("data-terrain", def.terrain); // A2 地形底纹挂载点（美术纹理到位后按此属性配 pattern）
    svg.append(path);
  }
  // 战线层：交战双方接壤省界加粗着色（涉己方蓝 / 涉敌方红 / 他方交战橙），随归属实时变化
  for (const [pairKey, segs] of frontSegments()) {
    const [pa, pb] = pairKey.split("|") as [string, string];
    const oa = game!.provinces[pa]!.ownerId;
    const ob = game!.provinces[pb]!.ownerId;
    if (oa === ob || oa === "neutral" || ob === "neutral" || !isAtWar(game!, oa, ob)) continue;
    const cls = oa === pid || ob === pid ? "af-front af-front-mine"
      : isAtWar(game!, pid, oa) || isAtWar(game!, pid, ob) ? "af-front af-front-enemy" : "af-front af-front-other";
    for (const [x1, y1, x2, y2] of segs) {
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", String(x1)); ln.setAttribute("y1", String(y1));
      ln.setAttribute("x2", String(x2)); ln.setAttribute("y2", String(y2));
      ln.setAttribute("class", cls);
      svg.append(ln);
    }
  }
  // 渡河点：真实河流已上图（A3），渡河边只在两省质心中点落一个小点示意可渡位置
  for (const r of RIVER_CROSSINGS) {
    const a = PROVINCE_MAP[r.a]!;
    const b = PROVINCE_MAP[r.b]!;
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String((a.cx + b.cx) / 2));
    dot.setAttribute("cy", String((a.cy + b.cy) / 2));
    dot.setAttribute("r", "1.7");
    dot.setAttribute("class", "af-crossing-dot");
    svg.append(dot);
  }
  // 标记层：省名（首都带 ★、港口带 ⚓）+ 驻军徽记
  for (const def of PROVINCES) {
    const st = game!.provinces[def.id]!;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(def.cx));
    label.setAttribute("y", String(def.cy - 1));
    const isCapital = CAPITAL_IDS.has(def.id);
    const isMajor = def.terrain === "urban" && st.factoriesMil + st.factoriesCiv >= 3;
    const isSelected = def.id === selectedProvince;
    label.setAttribute("class", "af-prov-label"
      + (isCapital ? " af-label-capital" : isMajor ? " af-label-major" : "")
      + (isSelected ? " af-label-selected" : ""));
    label.textContent = def.name;
    labelRegistry.push({
      el: label, cx: def.cx, cy: def.cy, chars: [...def.name].length,
      base: isSelected ? 9.5 : isCapital ? 9.5 : isMajor ? 8.5 : 7.5,
      priority: isSelected ? 5 : isCapital ? 4 : isMajor ? 3 : def.isPort ? 2 : 1,
      fitRatio: isCapital ? 1.7 : isMajor ? 1.4 : def.isPort ? 1.1 : 1.0,
      provinceId: def.id,
    });
    const pathEl = pathEls.get(def.id);
    if (pathEl) {
      pathEl.addEventListener("mouseenter", () => label.classList.add("af-label-hover"));
      pathEl.addEventListener("mouseleave", () => label.classList.remove("af-label-hover"));
    }
    const marker = CAPITAL_IDS.has(def.id) && st.ownerId !== "neutral"
      ? "assets/markers/marker_capital.png"
      : def.isPort ? "assets/markers/marker_port.png" : null;
    if (marker) {
      const mi = document.createElementNS("http://www.w3.org/2000/svg", "image");
      mi.setAttribute("href", marker);
      mi.setAttribute("x", String(def.cx - 16));
      mi.setAttribute("y", String(def.cy - 7));
      mi.setAttribute("width", "11");
      mi.setAttribute("height", "11");
      mi.setAttribute("class", "af-marker");
      svg.append(mi);
    }
    // A5 资源点图标（小而克制：产油/钢/橡胶，粮食只标主产区 food≥50）
    const resIcons: string[] = [];
    if ((def.oil ?? 0) > 0) resIcons.push("oil");
    if ((def.steel ?? 0) > 0) resIcons.push("steel");
    if ((def.rubber ?? 0) > 0) resIcons.push("rubber");
    if ((def.food ?? 0) >= 50) resIcons.push("grain");
    resIcons.slice(0, 2).forEach((r, i) => {
      const ri = document.createElementNS("http://www.w3.org/2000/svg", "image");
      ri.setAttribute("href", `assets/markers/res_${r}_map.png`);
      ri.setAttribute("x", String(def.cx + 6 + i * 8));
      ri.setAttribute("y", String(def.cy - 14));
      ri.setAttribute("width", "7.5");
      ri.setAttribute("height", "7.5");
      ri.setAttribute("class", "af-res-icon");
      svg.append(ri);
    });
    svg.append(label);
    const divs = game!.divisions.filter((d) => d.provinceId === def.id);
    if (divs.length > 0) {
      // 军棋式小牌：兵种徽记 + 兵力条 + 组织度条（主体势力口径；多方混驻右上角红三角；选中编组金边）
      const byFaction = new Map<string, typeof divs>();
      for (const d of divs) {
        const arr = byFaction.get(d.factionId) ?? [];
        arr.push(d);
        byFaction.set(d.factionId, arr);
      }
      const domFaction = byFaction.has(st.ownerId) ? st.ownerId
        : [...byFaction.entries()].sort((a, b) => b[1].length - a[1].length)[0]![0];
      const dom = byFaction.get(domFaction)!;
      const totS = dom.reduce((a, d) => a + d.strength, 0);
      const totF = dom.reduce((a, d) => a + (TEMPLATES[d.templateId]?.fullStrength ?? 10000), 0);
      const orgAvg = totS > 0 ? dom.reduce((a, d) => a + d.org * d.strength, 0) / totS : 0;
      const tierScale = zoomTier() === 1 ? 0.8 : zoomTier() === 2 ? 0.95 : 1.1;
      const gEl = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gEl.setAttribute("transform", `translate(${def.cx} ${def.cy + 6}) scale(${tierScale})`);
      gEl.setAttribute("class", "af-counter");
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", "-16"); rect.setAttribute("y", "-6.5");
      rect.setAttribute("width", "32"); rect.setAttribute("height", "13");
      rect.setAttribute("rx", "2");
      rect.setAttribute("class", "af-counter-plate"
        + (divs.some((d) => selectedDivisionIds.has(d.id)) ? " af-counter-selected" : ""));
      rect.style.stroke = ownerColor(domFaction);
      gEl.append(rect);
      const ins = document.createElementNS("http://www.w3.org/2000/svg", "image");
      ins.setAttribute("href", badgeSrc(dom[0]!.templateId));
      ins.setAttribute("x", "-14.8"); ins.setAttribute("y", "-4.6");
      ins.setAttribute("width", "9.2"); ins.setAttribute("height", "9.2");
      gEl.append(ins);
      const barBgS = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      barBgS.setAttribute("x", "-4.2"); barBgS.setAttribute("y", "-3.6");
      barBgS.setAttribute("width", "19"); barBgS.setAttribute("height", "2.7");
      barBgS.setAttribute("class", "af-bar-bg");
      gEl.append(barBgS);
      const barS = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      barS.setAttribute("x", "-4.2"); barS.setAttribute("y", "-3.6");
      barS.setAttribute("width", String(Math.max(0.8, 19 * Math.min(1, totS / Math.max(1, totF)))));
      barS.setAttribute("height", "2.7");
      barS.setAttribute("class", "af-bar-strength");
      gEl.append(barS);
      const barBgO = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      barBgO.setAttribute("x", "-4.2"); barBgO.setAttribute("y", "0.4");
      barBgO.setAttribute("width", "19"); barBgO.setAttribute("height", "2.7");
      barBgO.setAttribute("class", "af-bar-bg");
      gEl.append(barBgO);
      const barO = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      barO.setAttribute("x", "-4.2"); barO.setAttribute("y", "0.4");
      barO.setAttribute("width", String(Math.max(0.8, 19 * Math.min(1, orgAvg / 100))));
      barO.setAttribute("height", "2.7");
      barO.setAttribute("class", "af-bar-org");
      gEl.append(barO);
      if (divs.length > 1) {
        const cnt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        cnt.setAttribute("x", "15"); cnt.setAttribute("y", "5.4");
        cnt.setAttribute("text-anchor", "end");
        cnt.setAttribute("class", "af-counter-count");
        cnt.textContent = `×${divs.length}`;
        gEl.append(cnt);
      }
      if ([...byFaction.keys()].some((f) => f !== domFaction && isAtWar(game!, domFaction, f))) {
        const tri = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tri.setAttribute("d", "M10.5,-6.5 L16,-6.5 L16,-1 Z");
        tri.setAttribute("class", "af-counter-hostile");
        gEl.append(tri);
      }
      svg.append(gEl);
    }
  }
  // C5 战斗标记（本月/上月发生战斗的省份；引擎 combatMarks 落账，保留到下回合）
  const MARK_FILE: Record<string, string> = {
    battle: "attack", encircle: "encircle", landing: "landing", airraid: "airraid", raid: "guerrilla", decisive: "attack",
  };
  const MARK_NAME: Record<string, string> = {
    battle: "交战", encircle: "包围全歼", landing: "登陆作战", airraid: "空袭支援", raid: "游击袭击", decisive: "大捷",
  };
  for (const m of game!.combatMarks) {
    const def = PROVINCE_MAP[m.provinceId];
    if (!def) continue;
    const mi = document.createElementNS("http://www.w3.org/2000/svg", "image");
    mi.setAttribute("href", `assets/markers/combat_${MARK_FILE[m.kind]}.png`);
    mi.setAttribute("x", String(def.cx - 15));
    mi.setAttribute("y", String(def.cy - 16));
    mi.setAttribute("width", "13");
    mi.setAttribute("height", "13");
    mi.setAttribute("class", "af-combat-marker");
    const tt = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tt.textContent = `${MARK_NAME[m.kind]}：${def.name}`;
    mi.append(tt);
    svg.append(mi);
    if (m.kind === "decisive") {
      const star = document.createElementNS("http://www.w3.org/2000/svg", "text");
      star.setAttribute("x", String(def.cx - 3.5));
      star.setAttribute("y", String(def.cy - 4));
      star.setAttribute("class", "af-decisive-star");
      star.textContent = "★";
      svg.append(star);
    }
  }
  // 命令箭头层：本回合已下达的行军（虚线灰/全路径）与进攻（实线红/弧线）
  for (const o of turnOrders) {
    if (o.points.length < 2) continue;
    if (o.kind === "move") {
      const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      pl.setAttribute("points", o.points.map(([x, y]) => `${x},${y}`).join(" "));
      pl.setAttribute("class", "af-arrow-move");
      pl.setAttribute("marker-end", "url(#arrowGray)");
      svg.append(pl);
    } else {
      const [x1, y1] = o.points[0]!;
      const [x2, y2] = o.points[o.points.length - 1]!;
      const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18;
      const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M${x1},${y1} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2},${y2}`);
      p.setAttribute("class", o.kind === "attack" ? "af-arrow-attack" : "af-arrow-raid");
      p.setAttribute("marker-end", "url(#arrowRed)");
      svg.append(p);
    }
  }
  layoutLabels();
  const wrap = el("div", "af-map-viewport");
  wrap.append(svg);
  const controls = el("div", "af-map-controls");
  const mkBtn = (label: string, fn: () => void) => {
    const b = el("button", "af-map-btn", label);
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); applyMapView(svg); });
    return b;
  };
  controls.append(
    mkBtn("＋", () => { mapView = zoomAt(mapView, 0.5, 0.5, 1.4); }),
    mkBtn("－", () => { mapView = zoomAt(mapView, 0.5, 0.5, 1 / 1.4); }),
    mkBtn("复位", () => { mapView = fullView(); }),
  );
  wrap.append(controls);
  return wrap;
}

function zoomTier(): 1 | 2 | 3 {
  const z = MAP_W / mapView.w;
  return z < 1.4 ? 1 : z < 2.4 ? 2 : 3;
}

/** 省份包围盒宽（地图单位，解析 path 一次缓存）：标签适配判定用。 */
const PROVINCE_W = new Map<string, number>();
for (const def of PROVINCES) {
  const nums = def.path.match(/[\d.]+/g)?.map(Number) ?? [];
  let min = Infinity, max = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (nums[i]! < min) min = nums[i]!;
    if (nums[i]! > max) max = nums[i]!;
  }
  PROVINCE_W.set(def.id, max - min);
}

interface LabelEntry {
  el: SVGTextElement;
  cx: number;
  cy: number;
  chars: number;
  base: number;      // 缩放 1 时的字号（地图单位）
  priority: number;  // 选中 5 > 首都 4 > 大城市 3 > 港口 2 > 普通 1
  fitRatio: number;  // 标签宽可超过省宽的倍数上限
  provinceId: string;
}
let labelRegistry: LabelEntry[] = [];
let badgeRegistry: { el: SVGTextElement; base: number }[] = [];

/** 标签布局：字号随缩放反向补偿（增速 z^0.55）、按省宽适配、视野内碰撞避让（低优先级让位）。 */
function layoutLabels(): void {
  const z = MAP_W / mapView.w;
  const scale = Math.pow(z, -0.45);
  const tier = zoomTier();
  const viewH = viewHeight(mapView);
  const view = { x0: mapView.x - 6, y0: mapView.y - 6, x1: mapView.x + mapView.w + 6, y1: mapView.y + viewH + 6 };
  const candidates: { e: LabelEntry; fs: number; w: number }[] = [];
  for (const e of labelRegistry) {
    const fs = e.base * scale;
    e.el.style.fontSize = `${fs.toFixed(1)}px`; // 内联样式压过 CSS 的 .af-prov-label 字号
    e.el.style.display = "none";
    const minPrio = tier === 1 ? 3 : tier === 2 ? 2 : 1;
    if (e.priority < minPrio && e.priority < 5) continue;
    if (e.cx < view.x0 || e.cx > view.x1 || e.cy < view.y0 || e.cy > view.y1) continue;
    const w = e.chars * fs;
    if (e.priority < 5 && w > (PROVINCE_W.get(e.provinceId) ?? 0) * e.fitRatio) continue;
    candidates.push({ e, fs, w });
  }
  candidates.sort((a, b) => b.e.priority - a.e.priority
    || (PROVINCE_W.get(b.e.provinceId) ?? 0) - (PROVINCE_W.get(a.e.provinceId) ?? 0));
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const { e, fs, w } of candidates) {
    const box = {
      x0: e.cx - (w / 2) * 0.94, x1: e.cx + (w / 2) * 0.94,
      y0: e.cy - 1 - fs * 0.72, y1: e.cy - 1 + fs * 0.3,
    };
    if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
    placed.push(box);
    e.el.style.display = "";
  }
  for (const b of badgeRegistry) {
    b.el.style.fontSize = `${(b.base * scale).toFixed(1)}px`;
  }
}

function applyMapView(svg: SVGElement): void {
  svg.setAttribute("viewBox", viewBoxString(mapView));
  svg.setAttribute("class", `af-map af-z${zoomTier()}`);
  layoutLabels();
}

/** 滚轮缩放（光标锚定）＋拖动平移＋双指缩放；拖动与点选以位移阈值区分。 */
function attachMapControls(svg: SVGElement): void {
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    mapView = zoomAt(mapView, fx, fy, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    applyMapView(svg);
  }, { passive: false });

  const pointers = new Map<number, { x: number; y: number }>();
  let startView: MapView | null = null;
  let startMid = { x: 0, y: 0 };
  let startDist = 0;
  let moved = false;

  let downPos = { x: 0, y: 0 };
  svg.addEventListener("click", (e) => {
    // 拖动松手不算点选：按下-抬起位移 >4px 忽略（不用延时全局标志，避免吞正常点击）
    if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 4) return;
    const ctm = (svg as unknown as SVGSVGElement).getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const hit = provinceAtPoint(p.x, p.y);
    if (hit) onProvinceClick(hit);
  });
  svg.addEventListener("pointerdown", (e) => {
    if (pointers.size === 0) downPos = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svg.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      startView = { ...mapView };
      startMid = { x: e.clientX, y: e.clientY };
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      startView = { ...mapView };
      startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      startDist = Math.hypot(a.x - b.x, a.y - b.y);
      moved = true;
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !startView) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (pointers.size === 1) {
      const dx = e.clientX - startMid.x;
      const dy = e.clientY - startMid.y;
      if (Math.hypot(dx, dy) > 4) { moved = true; }
      if (moved) {
        mapView = panBy(startView, -(dx / r.width) * startView.w, -(dy / r.height) * startView.w * (MAP_H / MAP_W));
        applyMapView(svg);
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const fx = (startMid.x - r.left) / r.width;
      const fy = (startMid.y - r.top) / r.height;
      let v = zoomAt(startView, fx, fy, startDist > 0 ? dist / startDist : 1);
      v = panBy(v, -((mid.x - startMid.x) / r.width) * v.w, -((mid.y - startMid.y) / r.height) * v.w * (MAP_H / MAP_W));
      mapView = v;
      applyMapView(svg);
    }
  });
  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      startView = null;
    }
  };
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
}

function onProvinceClick(provinceId: string): void {
  if (!game) return;
  const pid = playerId();
  // 空军任务改派中：点任意省 = 把该省设为任务目标
  if (pendingMissionSupportId) {
    const sup = game.supports.find((x) => x.id === pendingMissionSupportId);
    const supName = sup ? SUPPORTS[sup.kind].name : "支援单位";
    if (dispatch({ type: "SET_SUPPORT_MISSION", factionId: pid, supportId: pendingMissionSupportId, targetProvinceId: provinceId })) {
      notice = `${supName}任务目标改为 ${PROVINCE_MAP[provinceId]?.name ?? provinceId}`;
    }
    pendingMissionSupportId = null;
    selectedProvince = provinceId;
    render();
    return;
  }
  const g = game;
  const prevSelected = selectedProvince;
  const target0 = g.provinces[provinceId]!;
  let failReason = "";
  const tName = PROVINCE_MAP[provinceId]?.name ?? provinceId;
  // 编组命令优先：点敌省 = 选中编组合击该省；点可达非敌省 = 选中编组行军（逐师过滤无路者）
  if (selectedDivisionIds.size > 0) {
    const isForeignFaction = target0.ownerId !== pid && target0.ownerId !== "neutral";
    if (isForeignFaction && !isAtWar(game, pid, target0.ownerId)) {
      failReason = `未与${factionName(target0.ownerId)}宣战，不能进攻或占领${tName}——该省详情里可直接宣战（或外交页签）`;
    } else if (target0.ownerId !== pid && isAtWar(game, pid, target0.ownerId)) {
      const parts = currentGroupIds(provinceId);
      if (parts.length > 0) {
        // 跨海目标走登陆项目制：点图直攻给人话指引，不发注定失败的 ATTACK
        const seaAll = parts.every((id) => isSeaEdge(game!.divisions.find((d) => d.id === id)!.provinceId, provinceId));
        if (seaAll) {
          failReason = `跨海进攻${tName}须先筹备登陆：在出发港省份面板的进攻区点「筹备登陆」（参战师锁定筹备、次月执行）`;
        } else {
          selectedProvince = provinceId;
          dispatch({
            type: "ATTACK", factionId: pid, divisionIds: parts, targetProvinceId: provinceId,
            spearheadIds: parts.filter((id) => selectedSpearheads.has(id)),
          });
          return;
        }
      }
      failReason = `所选编组打不到${tName}：须有本月未行动的师与该省相邻（或先行军接近）`;
    } else {
      const movers = g.divisions.filter(
        (d) => selectedDivisionIds.has(d.id) && d.factionId === pid && d.movedTurn < g.turn
          && findMovePaths(g, d).has(provinceId),
      );
      if (movers.length > 0) {
        selectedProvince = provinceId;
        dispatch({ type: "MOVE_UNITS", factionId: pid, divisionIds: movers.map((d) => d.id), toProvinceId: provinceId });
        return;
      }
      failReason = `所选编组行军到不了${tName}：移动力不足、无通路，或所选师本月已行动`;
    }
  }
  const reach = reachableSet();
  if (selectedDivisionId) {
    if (reach?.has(provinceId)) {
      const divId = selectedDivisionId;
      selectedDivisionId = null;
      selectedProvince = provinceId;
      dispatch({ type: "MOVE_UNITS", factionId: pid, divisionIds: [divId], toProvinceId: provinceId });
      return;
    }
    failReason = `该师行军到不了${tName}：移动力不足或无通路（绿色高亮为本月可达范围）`;
  }
  if (selectedProvince && selectedProvince !== provinceId
    && neighborsOf(selectedProvince).includes(provinceId)) {
    const target = game.provinces[provinceId]!;
    if (target.ownerId !== pid && target.ownerId !== "neutral" && !isAtWar(game, pid, target.ownerId)) {
      failReason = `未与${factionName(target.ownerId)}宣战，不能进攻${tName}——该省详情里可直接宣战（或外交页签）`;
    } else if (target.ownerId !== pid && isAtWar(game, pid, target.ownerId)) {
      const parts = currentGroupIds(provinceId);
      if (parts.length > 0) {
        // 跨海目标走登陆项目制：点图直攻给人话指引，不发注定失败的 ATTACK
        const seaAll = parts.every((id) => isSeaEdge(game!.divisions.find((d) => d.id === id)!.provinceId, provinceId));
        if (seaAll) {
          failReason = `跨海进攻${tName}须先筹备登陆：在出发港省份面板的进攻区点「筹备登陆」（参战师锁定筹备、次月执行）`;
        } else {
          selectedProvince = provinceId;
          dispatch({
            type: "ATTACK", factionId: pid, divisionIds: parts, targetProvinceId: provinceId,
            spearheadIds: parts.filter((id) => selectedSpearheads.has(id)),
          });
          return;
        }
      }
      failReason = `${PROVINCE_MAP[selectedProvince]?.name ?? "原省"}驻军打不了${tName}：本月已行动或无可战之师`;
    }
  }
  selectedProvince = provinceId;
  selectedDivisionId = null;
  activeTab = "province";
  if (failReason) {
    notice = failReason;
    noticeIsError = true;
    drawerOpen = true;
    audio.playSfx("order_cancel", 0.8); // 点图下令失败驳回音（未走 dispatch 的路径）
  } else if (selectedProvince !== prevSelected) {
    audio.playSfx("ui_click", 0.45); // 省份选中轻响
  }
  render();
}

// ---------------- 侧栏面板 ----------------

const TERRAIN_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(TERRAIN_PARAMS).map(([k, v]) => [k, v.name]),
);

function renderProvincePanel(box: HTMLElement): void {
  if (!game || !selectedProvince) {
    box.append(el("p", "af-empty", "点击地图上的省份查看详情。"));
    return;
  }
  const pid = playerId();
  const def = PROVINCE_MAP[selectedProvince]!;
  const st = game.provinces[selectedProvince]!;
  box.append(el("h3", "af-panel-title", `${def.name}（${TERRAIN_NAMES[def.terrain]}）`));
  box.append(el("div", "af-line", `归属：${factionName(st.ownerId)} · 工厂：军工 ${st.factoriesMil} / 民用 ${st.factoriesCiv}`));
  if (st.ownerId !== "neutral") {
    const supplied = suppliedProvinces(game, st.ownerId).has(def.id);
    box.append(el("div", "af-line", supplied
      ? `补给：连通（与${factionName(st.ownerId)}补给网相连）`
      : `补给：已断绝——该省被包围，守军战力 ×0.5、被攻克时全歼`));
  }
  if (st.ownerId !== pid && st.ownerId !== "neutral") {
    if (isAtWar(game, pid, st.ownerId)) {
      box.append(el("div", "af-line", `与${factionName(st.ownerId)}：交战中`));
    } else {
      const bWar = document.createElement("button");
      bWar.className = "af-btn";
      bWar.textContent = `向${factionName(st.ownerId)}宣战`;
      bWar.addEventListener("click", () => {
        if (dispatch({ type: "DIPLOMACY", factionId: pid, targetId: st.ownerId, actionId: "declareWar" })) {
          notice = `已向${factionName(st.ownerId)}宣战`;
          render();
        }
      });
      box.append(bWar);
    }
  }
  const stateProvs = PROVINCES.filter((p) => p.stateId === def.stateId);
  const stateMine = stateProvs.filter((p) => game!.provinces[p.id]!.ownerId === st.ownerId);
  const stateInd = stateMine.reduce((a, p) => a + p.industry, 0);
  box.append(el("div", "af-line", `所属州：${STATE_MAP[def.stateId]?.name ?? def.stateId}（全州 ${stateProvs.length} 省 · ${factionName(st.ownerId)} 控制 ${stateMine.length} 省 · 州工业合计 ${stateInd}）`));
  const res: string[] = [];
  if (def.oil) res.push(`油 ${def.oil}/月`);
  if (def.steel) res.push(`钢 ${def.steel}/月`);
  if (def.rubber) res.push(`橡胶 ${def.rubber}/月`);
  if (def.food) res.push(`粮 ${def.food}/月`);
  box.append(el("div", "af-line", `资源：${res.length > 0 ? res.join(" · ") : "无"} · 人力池 ${def.manpower}`));
  const tp = TERRAIN_PARAMS[def.terrain];
  const feats: string[] = [];
  if (def.isPort) feats.push("港口");
  if (def.isIsland) feats.push("岛屿");
  if (def.isPort || def.isIsland || (def.seaLinks?.length ?? 0) > 0) feats.push("沿海");
  if (Object.values(FACTIONS).some((f) => f.capitalProvinceId === def.id)) feats.push("首都");
  if (feats.length > 0) box.append(el("div", "af-line", `特征：${feats.join(" · ")}`));
  box.append(el("div", "af-line",
    `地形效果：守方防御 ×${tp.defMult.toFixed(2)}${def.isPort ? "（港口另 ×1.10）" : ""} · 进省行军成本 ${tp.moveCost} 点 · 断补给月损 ${(5 * tp.unsuppliedMult).toFixed(1)}%${tp.suppliedAttrition > 0 ? ` · 有补给环境损耗 ${(tp.suppliedAttrition * 100).toFixed(1)}%/月` : ""}`));
  box.append(el("div", "af-line",
    `容量：有效参战 ${tp.capacity} 个师（现驻军 ${game.divisions.filter((d) => d.provinceId === def.id).length}，超出递减） · 筑垒成长 ×${tp.fortGrowMult} · 补员速度 ×${tp.recoveryMult}`));

  const divs = game.divisions.filter((d) => d.provinceId === selectedProvince);
  box.append(el("h4", "af-panel-sub", `驻军（${divs.length} 个师）`));
  if (divs.length === 0) box.append(el("div", "af-line", "无驻军。"));
  for (const div of divs) {
    const tpl = TEMPLATES[div.templateId]!;
    const row = el("div", "af-div-row");
    const chip = el("span", "af-chip");
    chip.style.background = ownerColor(div.factionId);
    row.append(chip);
    row.append(img(badgeSrc(div.templateId), "af-badge-icon"));
    if (div.factionId === pid) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selectedDivisionIds.has(div.id);
      cb.title = "勾选进当前指挥编组";
      cb.addEventListener("change", () => {
        if (cb.checked) selectedDivisionIds.add(div.id);
        else selectedDivisionIds.delete(div.id);
        render();
      });
      row.append(cb);
    }
    row.append(el("span", "", `${factionName(div.factionId)} · ${tpl.name}${tpl.infiltration ? "（渗透）" : ""} · ${div.strength}/${tpl.fullStrength} 人 · 组织 ${Math.round(div.org)}${div.staticMonths >= 1 ? ` · 筹备 ${Math.floor(div.staticMonths)} 层` : ""}${div.pathIds?.length ? ` · 行军中（余 ${div.pathIds.length} 省）` : ""}${div.groupId ? ` · 编组` : ""}${selectedSpearheads.has(div.id) ? " · ★矛头" : ""}`));
    if (div.factionId === pid) {
      const acted = div.movedTurn >= game.turn;
      const btn = el("button", "af-btn af-btn-small", acted ? "已行动" : "移动");
      btn.disabled = acted;
      btn.addEventListener("click", () => {
        selectedDivisionId = div.id;
        notice = `已选中 ${tpl.name}，点击高亮省份移动（移动点 ${tpl.speed * 2}，进省按地形扣点）。`;
        noticeIsError = false;
        render();
      });
      row.append(btn);
      const bSpear = el("button", "af-btn af-btn-small", selectedSpearheads.has(div.id) ? "★矛头" : "设矛头");
      bSpear.title = "矛头：战力 ×1.35、战损 ×1.5、组织消耗 ×1.5，获胜优先进驻；每场最多 2 个";
      bSpear.addEventListener("click", () => {
        if (selectedSpearheads.has(div.id)) selectedSpearheads.delete(div.id);
        else {
          selectedSpearheads.add(div.id);
          while (selectedSpearheads.size > 2) {
            const oldest = selectedSpearheads.values().next().value as string;
            selectedSpearheads.delete(oldest);
          }
        }
        render();
      });
      row.append(bSpear);
      if (selectedDivisionId === div.id) row.classList.add("af-div-selected");
    }
    box.append(row);
  }
  const sups = game.supports.filter((s) => s.provinceId === selectedProvince);
  const mySups = sups.filter((s) => s.factionId === pid);
  const foeSups = sups.filter((s) => s.factionId !== pid);
  if (foeSups.length > 0) {
    box.append(el("div", "af-line", `支援单位：${foeSups.map((s) => `${factionName(s.factionId)}·${SUPPORTS[s.kind].name}`).join("；")}`));
  }
  for (const s of mySups) {
    const row = el("div", "af-mode-row");
    row.append(el("span", "af-line", `${SUPPORTS[s.kind].name} · 任务：${PROVINCE_MAP[s.missionTargetId]?.name ?? s.missionTargetId}`));
    const bM = el("button", "af-btn af-btn-small", pendingMissionSupportId === s.id ? "点地图选目标…" : "改派任务");
    bM.addEventListener("click", () => {
      pendingMissionSupportId = pendingMissionSupportId === s.id ? null : s.id;
      notice = pendingMissionSupportId ? `为${SUPPORTS[s.kind].name}指派任务：点地图上的省份设为任务目标（战斗机=制空、轰炸机=对地支援、舰队=制海）` : "";
      render();
    });
    row.append(bM);
    box.append(row);
  }
  // 登陆计划（仅己方可见）：本省出发的计划（状态+取消）与以本省为目标的计划（就绪可执行）
  for (const p of game.landingPlans.filter((x) => x.factionId === pid && x.fromProvinceId === selectedProvince)) {
    const row = el("div", "af-mode-row");
    row.append(el("span", "af-line", `登陆计划：目标 ${PROVINCE_MAP[p.targetProvinceId]?.name ?? p.targetProvinceId}（${p.divisionIds.length} 师）· ${game.turn >= p.readyTurn ? "本月可执行（在目标省面板点执行登陆）" : "筹备中，下月可执行"}`));
    const bC = el("button", "af-btn af-btn-small", "取消登陆");
    bC.addEventListener("click", () => { dispatch({ type: "CANCEL_LANDING", factionId: pid, planId: p.id }); });
    row.append(bC);
    box.append(row);
  }
  for (const p of game.landingPlans.filter((x) => x.factionId === pid && x.targetProvinceId === selectedProvince)) {
    if (game.turn >= p.readyTurn) {
      const bE = el("button", "af-btn af-btn-attack", `执行登陆（自 ${PROVINCE_MAP[p.fromProvinceId]?.name ?? p.fromProvinceId} 港 · ${p.divisionIds.length} 师）`);
      bE.addEventListener("click", () => { dispatch({ type: "EXECUTE_LANDING", factionId: pid, planId: p.id }); });
      box.append(bE);
    } else {
      box.append(el("div", "af-line", `登陆筹备中：自 ${PROVINCE_MAP[p.fromProvinceId]?.name ?? p.fromProvinceId} 港出发的船队下月抵达`));
    }
  }
  const missionedHere = game.supports.filter((s) => s.factionId === pid && s.missionTargetId === selectedProvince && s.provinceId !== selectedProvince);
  if (missionedHere.length > 0) {
    box.append(el("div", "af-line", `任务指向本省：${missionedHere.map((s) => `${SUPPORTS[s.kind].name}（驻 ${PROVINCE_MAP[s.provinceId]?.name ?? s.provinceId}）`).join("；")}`));
  }

  // 指挥区：勾选编组、全选本省、驻扎与常设编组管理
  {
    box.append(el("h4", "af-panel-sub", "指挥编组"));
    const selCount = game.divisions.filter((d) => selectedDivisionIds.has(d.id) && d.factionId === pid).length;
    box.append(el("div", "af-line", selCount > 0
      ? `已勾选 ${selCount} 个师：点地图敌省合击、点可达省行军（跨省自动续程）。`
      : "勾选上方师组成编组（不选 = 整省部队快捷口径）；点地图也可直接下令。"));
    const rowBtns = el("div", "af-mode-row");
    const bAll = el("button", "af-btn af-btn-small", "全选本省部队");
    bAll.addEventListener("click", () => {
      for (const d of game!.divisions) {
        if (d.provinceId === selectedProvince && d.factionId === pid) selectedDivisionIds.add(d.id);
      }
      render();
    });
    const bClear = el("button", "af-btn af-btn-small", "清空选择");
    bClear.addEventListener("click", () => { selectedDivisionIds.clear(); render(); });
    const bHold = el("button", "af-btn af-btn-small", "驻扎防守（清行军）");
    bHold.addEventListener("click", () => {
      if (selectedDivisionIds.size > 0) {
        dispatch({ type: "HOLD_POSITION", factionId: pid, divisionIds: [...selectedDivisionIds] });
      }
    });
    rowBtns.append(bAll, bClear, bHold);
    box.append(rowBtns);
    // 常设编组
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "编组名（如 第一军）";
    nameInput.className = "af-group-input";
    const bCreate = el("button", "af-btn af-btn-small", "把已选存为编组");
    bCreate.addEventListener("click", () => {
      if (selectedDivisionIds.size === 0) return;
      dispatch({
        type: "CREATE_GROUP", factionId: pid,
        name: nameInput.value.trim() || "未命名编组", divisionIds: [...selectedDivisionIds],
      });
    });
    const grow = el("div", "af-mode-row");
    grow.append(nameInput, bCreate);
    box.append(grow);
    for (const g of (game.groups ?? []).filter((x) => x.factionId === pid)) {
      const members = game.divisions.filter((d) => d.groupId === g.id);
      const line = el("div", "af-line", `${g.name}（${members.length} 个师）`);
      const bSel = el("button", "af-btn af-btn-small", "全选");
      bSel.addEventListener("click", () => {
        selectedDivisionIds = new Set(members.map((d) => d.id));
        render();
      });
      const bUpd = el("button", "af-btn af-btn-small", "更新为已选");
      bUpd.addEventListener("click", () => {
        dispatch({ type: "SET_GROUP_MEMBERS", factionId: pid, groupId: g.id, divisionIds: [...selectedDivisionIds] });
      });
      const bDel = el("button", "af-btn af-btn-small", "解散");
      bDel.addEventListener("click", () => {
        dispatch({ type: "DELETE_GROUP", factionId: pid, groupId: g.id });
      });
      line.append(bSel, bUpd, bDel);
      box.append(line);
    }
  }

  // 进攻区：按当前编组（勾选或整省）列出可打的敌省与预估
  const turnNow = game.turn;
  const groupIds = currentGroupIds();
  const myReady = groupIds.length > 0;
  if (myReady) {
    box.append(el("h4", "af-panel-sub", "进攻（点地图上的红色敌省，或点下方按钮；筹备/包围/渗透/空优按部队与站位自动结算）"));
    const targets = new Set<string>();
    for (const id of groupIds) {
      const d = game.divisions.find((x) => x.id === id)!;
      for (const nb of neighborsOf(d.provinceId)) targets.add(nb);
    }
    for (const nb of targets) {
      const owner = game.provinces[nb]!.ownerId;
      if (owner === pid || !isAtWar(game, pid, owner)) continue;
      const parts = currentGroupIds(nb);
      if (parts.length === 0) continue;
      const spearParts = parts.filter((id) => selectedSpearheads.has(id));
      const est = estimateAttack(game, pid, parts, nb, [], spearParts);
      // 跨海目标（三期项目制）：参战师同港出发时给「筹备登陆」钮，不给直攻钮
      const seaOriginSet = new Set(parts.map((id) => game!.divisions.find((d) => d.id === id)!.provinceId));
      const allSea = parts.every((id) => isSeaEdge(game!.divisions.find((d) => d.id === id)!.provinceId, nb));
      if (allSea && seaOriginSet.size === 1) {
        const fromId = [...seaOriginSet][0]!;
        const pb = el("button", "af-btn af-btn-attack",
          `筹备登陆 ${PROVINCE_MAP[nb]!.name}（自 ${PROVINCE_MAP[fromId]!.name} 港 · 参战 ${parts.length} 师 · 次月执行${est ? ` · 预估战力比 ${est.ratio.toFixed(2)}` : ""}）`);
        pb.title = "参战师本月锁定筹备，下月在目标省面板点「执行登陆」";
        pb.addEventListener("click", () => {
          dispatch({ type: "PREPARE_LANDING", factionId: pid, divisionIds: parts, fromProvinceId: fromId, targetProvinceId: nb });
        });
        box.append(pb);
        continue;
      }
      const b = el("button", "af-btn af-btn-attack",
        `攻 ${PROVINCE_MAP[nb]!.name}（${factionName(owner)}）· 参战 ${parts.length} 师${est ? ` · 预估战力比 ${est.ratio.toFixed(2)}` : ""}${est && !est.targetSupplied ? " · 守军已断补给（包围）" : ""}`);
      b.addEventListener("click", () => {
        dispatch({
          type: "ATTACK", factionId: pid, divisionIds: parts, targetProvinceId: nb,
          spearheadIds: spearParts,
        });
      });
      box.append(b);
      // 袭扰：参战部队全为游击类时可走独立 RAID（降产出扰补给，不占城）
      if (parts.every((id) => TEMPLATES[game!.divisions.find((d) => d.id === id)?.templateId ?? ""]?.guerrilla)) {
        const rb = el("button", "af-btn af-btn-attack af-btn-support",
          `袭扰 ${PROVINCE_MAP[nb]!.name}（游击专属：工业受损＋驻军扰动，不占领）`);
        rb.addEventListener("click", () => {
          dispatch({ type: "RAID", factionId: pid, divisionIds: parts, targetProvinceId: nb });
        });
        box.append(rb);
      }
      // 支援进攻：已勾选编组作支援（参战不进驻），其余相邻就绪部队作主攻
      if (selectedDivisionIds.size > 0 && parts.length > 0) {
        const others = game.divisions.filter(
          (d) => d.factionId === pid && d.movedTurn < turnNow && !selectedDivisionIds.has(d.id)
            && neighborsOf(d.provinceId).includes(nb),
        ).map((d) => d.id);
        if (others.length > 0) {
          const sEst = estimateAttack(game, pid, others, nb, parts);
          const sb = el("button", "af-btn af-btn-attack af-btn-support",
            `支援进攻 ${PROVINCE_MAP[nb]!.name}（已选 ${parts.length} 师支援、主攻 ${others.length} 师${sEst ? ` · 预估 ${sEst.ratio.toFixed(2)}` : ""}）`);
          sb.title = "支援部队参战加火力但不离开本省、不跟着占领";
          sb.addEventListener("click", () => {
            dispatch({
              type: "ATTACK", factionId: pid, divisionIds: others, supportDivisionIds: parts,
              targetProvinceId: nb,
            });
          });
          box.append(sb);
        }
      }
      if (est) {
        const originsText = est.origins.map((o, i) => `${i === 0 ? "主攻" : "助攻"} ${PROVINCE_MAP[o.provinceId]?.name ?? o.provinceId} ${o.count} 师`).join("＋");
        const riverNote = est.origins.some((o) => isRiverCrossing(o.provinceId, nb)) ? " · 含渡河进攻（加权 ×0.85）" : "";
        box.append(el("div", "af-line af-est-detail",
          `　来源：${originsText} · 前线 ${est.atkFrontline} 师＋预备 ${est.atkReserves} 师（守方前线 ${est.defFrontline}＋预备 ${est.defReserves}，容量 ${est.capacity}） · 地形：${TERRAIN_NAMES[est.terrain]} 守方防御 ×${est.defTerrainMult.toFixed(2)} · 守军补给：${est.targetSupplied ? "连通" : "已断绝（包围成立：守方 ×0.5、获胜全歼）"}${est.modifiers.length ? ` · 修正：${est.modifiers.join("、")}` : ""}${riverNote}`));
      }
    }
  }
}

function renderProductionPanel(box: HTMLElement): void {
  if (!game) return;
  const pid = playerId();
  const f = game.factions[pid]!;
  const target = selectedProvince && game.provinces[selectedProvince]!.ownerId === pid
    ? selectedProvince
    : FACTIONS[pid as FactionId].capitalProvinceId;
  box.append(el("h3", "af-panel-title", `生产（在 ${PROVINCE_MAP[target]?.name ?? target} 编成/建设）`));
  box.append(el("div", "af-line", `装备 ${Math.floor(f.stockpile.equipment)} · 人力 ${Math.floor(f.stockpile.manpower)} · 建设点 ${Math.floor(f.constructionPoints)}`));
  if (!target || game.provinces[target]?.ownerId !== pid) {
    box.append(el("p", "af-empty", "先在地图上选择一个己方省份作为编成地。"));
    return;
  }
  box.append(el("h4", "af-panel-sub", "编成师"));
  for (const tpl of Object.values(TEMPLATES)) {
    if (tpl.factionId && tpl.factionId !== pid) continue;
    const b = el("button", "af-btn");
    b.append(img(badgeSrc(tpl.id), "af-badge-icon"));
    b.append(document.createTextNode(`${tpl.name}（${tpl.fullStrength} 人 · 装备 ${tpl.equipmentCost} · ${tpl.buildMonths} 月 · 攻 ${tpl.attack}/防 ${tpl.defense}）${tpl.infiltration ? " · 渗透特性：特性师过半时山地/丛林守方地形减半" : ""}`));
    b.disabled = f.stockpile.equipment < tpl.equipmentCost || f.stockpile.manpower < tpl.fullStrength;
    b.addEventListener("click", () => {
      dispatch({ type: "BUILD_DIVISION", factionId: pid, provinceId: target, templateId: tpl.id });
    });
    box.append(b);
  }
  box.append(el("h4", "af-panel-sub", "支援单位"));
  for (const sup of Object.values(SUPPORTS)) {
    const b = el("button", "af-btn");
    b.append(img(`assets/badges/sup_${sup.kind}.png`, "af-badge-icon"));
    b.append(document.createTextNode(`${sup.name}（装备 ${sup.equipmentCost} · ${sup.buildMonths} 月）`));
    b.disabled = f.stockpile.equipment < sup.equipmentCost;
    b.addEventListener("click", () => {
      dispatch({ type: "BUILD_SUPPORT", factionId: pid, provinceId: target, kind: sup.kind });
    });
    box.append(b);
  }
  box.append(el("h4", "af-panel-sub", `建厂（${ECONOMY.factoryBuildCost} 建设点 · ${ECONOMY.factoryBuildMonths} 月）`));
  for (const kind of ["mil", "civ"] as const) {
    const b = el("button", "af-btn", kind === "mil" ? "军工厂" : "民用工厂");
    b.disabled = f.constructionPoints < ECONOMY.factoryBuildCost;
    b.addEventListener("click", () => {
      dispatch({ type: "BUILD_FACTORY", factionId: pid, provinceId: target, factory: kind });
    });
    box.append(b);
  }
  box.append(el("h4", "af-panel-sub", "生产队列"));
  const queue = game.production.filter((p) => p.factionId === pid);
  if (queue.length === 0) box.append(el("div", "af-line", "队列为空。"));
  for (const item of queue) {
    const name = item.kind === "division" ? TEMPLATES[item.templateId!]!.name
      : item.kind === "support" ? SUPPORTS[item.supportKind!]!.name
        : item.kind === "factoryMil" ? "军工厂" : "民用工厂";
    box.append(el("div", "af-line", `${name} @ ${PROVINCE_MAP[item.provinceId]?.name ?? item.provinceId} · 剩 ${item.monthsLeft} 月`));
  }
}

function renderTechPanel(box: HTMLElement): void {
  if (!game) return;
  const pid = playerId();
  const f = game.factions[pid]!;
  box.append(el("h3", "af-panel-title", "科技"));
  box.append(el("div", "af-line", `研究点：${Math.floor(f.researchPoints)}（民用工厂每月 +2/座）· 当前研究：${f.researchBranch ? TECH_BRANCHES[f.researchBranch].name : "未设定"}`));
  for (const bid of TECH_BRANCH_IDS) {
    const branch = TECH_BRANCHES[bid];
    const level = f.tech[bid] ?? 0;
    const row = el("div", "af-div-row");
    row.append(el("span", "", `${branch.name} Lv.${level}/3 · ${branch.effectDesc}`));
    const next = branch.levels[level];
    const b = el("button", `af-btn af-btn-small${f.researchBranch === bid ? " af-btn-active" : ""}`,
      next ? `研究（下级 ${next.cost} 点）` : "已满级");
    b.disabled = !next;
    b.addEventListener("click", () => {
      dispatch({ type: "SET_RESEARCH", factionId: pid, branch: bid });
    });
    row.append(b);
    box.append(row);
  }
}

function renderFocusPanel(box: HTMLElement): void {
  if (!game) return;
  const pid = playerId();
  const f = game.factions[pid]!;
  box.append(el("h3", "af-panel-title", "国策"));
  if (f.focusId) {
    box.append(el("div", "af-line", `进行中：${FOCUSES.find((x) => x.id === f.focusId)?.name ?? f.focusId} · 剩 ${f.focusMonthsLeft} 月`));
  }
  for (const focus of FOCUSES.filter((x) => x.factionId === pid)) {
    const done = f.completedFocuses.includes(focus.id);
    const row = el("div", "af-div-row");
    row.append(el("span", "", `${focus.name}（${focus.months} 月）· ${focus.desc}`));
    if (!done && !f.focusId) {
      const b = el("button", "af-btn af-btn-small", "启动");
      b.addEventListener("click", () => {
        dispatch({ type: "START_FOCUS", factionId: pid, focusId: focus.id });
      });
      row.append(b);
    } else if (done) {
      row.append(el("span", "af-done", "已完成"));
    }
    box.append(row);
  }
}

function renderDiplomacyPanel(box: HTMLElement): void {
  if (!game) return;
  const pid = playerId();
  const me = game.factions[pid]!;
  box.append(el("h3", "af-panel-title", "外交"));
  if (me.vassalOf) {
    box.append(el("div", "af-line", `我国为 ${factionName(me.vassalOf)} 的附庸（每月进贡）。`));
    const b = el("button", "af-btn", "脱离附庸");
    b.addEventListener("click", () => { dispatch({ type: "BREAK_VASSAL", factionId: pid }); });
    box.append(b);
  }
  for (const fid of FACTION_IDS) {
    if (fid === pid) continue;
    const other = game.factions[fid]!;
    if (!other.active) {
      box.append(el("div", "af-line af-dim", `${factionName(fid)}：尚未登场（事件生成）`));
      continue;
    }
    if (!other.alive) {
      box.append(el("div", "af-line af-dim", `${factionName(fid)}：已出局`));
      continue;
    }
    const rel = relationOf(game, pid, fid);
    const status = isAtWar(game, pid, fid) ? "交战中"
      : other.vassalOf === pid ? "我国附庸"
        : me.vassalOf === fid ? "我国宗主"
          : isAllied(game, pid, fid) ? "盟友" : relationTierOf(rel).name;
    const head = el("div", "af-dip-head");
    const chip = el("span", "af-chip");
    chip.style.background = ownerColor(fid);
    head.append(chip);
    head.append(el("span", "", `${factionName(fid)} · 关系 ${rel}（${status}）· 战力约 ${Math.round(factionPower(game, fid))} · 控省 ${controlledProvinceCount(game, fid)}`));
    box.append(head);
    const row = el("div", "af-dip-actions");
    for (const action of DIPLOMACY_ACTIONS) {
      const b = el("button", "af-btn af-btn-small", action.name);
      b.title = `需关系 >= ${action.requiresMinRelation} · 耗装备 ${action.costEquipment}`;
      b.addEventListener("click", () => {
        dispatch({ type: "DIPLOMACY", factionId: pid, targetId: fid, actionId: action.id });
      });
      row.append(b);
    }
    box.append(row);
  }
}

function renderRecordsPanel(box: HTMLElement): void {
  if (!game) return;
  box.append(el("h3", "af-panel-title", "纪事"));
  const entry = getDiplomacyDialogEntry(loadLlmSettings(createLocalStorageAdapter()));
  box.append(el("div", "af-line", `领袖对话：${entry.label}（本版仅保留入口骨架，无 AI 也可完整游玩）`));
  box.append(el("h4", "af-panel-sub", "存档"));
  const slots = el("div", "af-dip-actions");
  for (const slot of ["manual-1", "manual-2", "manual-3"] as const) {
    const saveBtn = el("button", "af-btn af-btn-small", `存 ${slot}`);
    saveBtn.addEventListener("click", () => {
      saveManager.save(slot, game!);
      notice = `已保存到 ${slot}。`;
      noticeIsError = false;
      render();
    });
    const loadBtn = el("button", "af-btn af-btn-small", `读 ${slot}`);
    loadBtn.disabled = !saveManager.has(slot);
    loadBtn.addEventListener("click", () => {
      const res = saveManager.load(slot);
      if (res.ok) {
        game = res.state;
        selectedProvince = null;
        notice = `已读取 ${slot}。`;
        noticeIsError = false;
      } else {
        notice = `读取失败：${res.error}`;
        noticeIsError = true;
      }
      render();
    });
    slots.append(saveBtn, loadBtn);
  }
  box.append(slots);
  const transfer = el("div", "af-dip-actions");
  const expBtn = el("button", "af-btn af-btn-small", "导出存档 JSON");
  expBtn.addEventListener("click", () => exportSaveFile());
  const impBtn = el("button", "af-btn af-btn-small", "导入存档 JSON");
  impBtn.addEventListener("click", () => pickSaveFile());
  transfer.append(expBtn, impBtn);
  box.append(transfer);
  box.append(el("h4", "af-panel-sub", "战报与纪事（最新在前）"));
  const list = el("div", "af-log");
  for (const entryLog of [...game.log].reverse().slice(0, 120)) {
    list.append(el("div", "af-log-line", `${entryLog.year}-${String(entryLog.month).padStart(2, "0")} · ${entryLog.text}`));
  }
  box.append(list);
}

function renderTroopsPanel(box: HTMLElement): void {
  if (!game) return;
  const pid = playerId();
  box.append(el("h3", "af-panel-title", "部队"));
  const mine = game.divisions.filter((d) => d.factionId === pid);
  box.append(el("div", "af-line", `共 ${mine.length} 个师 · 总兵力 ${mine.reduce((s, d) => s + d.strength, 0)} 人`));
  for (const div of mine) {
    const tpl = TEMPLATES[div.templateId]!;
    const row = el("div", "af-div-row");
    row.append(img(badgeSrc(div.templateId), "af-badge-icon"));
    row.append(el("span", "", `${tpl.name} @ ${PROVINCE_MAP[div.provinceId]?.name ?? div.provinceId} · ${div.strength}/${tpl.fullStrength}${div.movedTurn >= game.turn ? " · 已行动" : ""}`));
    const b = el("button", "af-btn af-btn-small", "查看");
    b.addEventListener("click", () => {
      selectedProvince = div.provinceId;
      activeTab = "province";
      render();
    });
    row.append(b);
    box.append(row);
  }
  const sups = game.supports.filter((s) => s.factionId === pid);
  if (sups.length > 0) {
    box.append(el("h4", "af-panel-sub", "支援单位"));
    for (const s of sups) {
      const row = el("div", "af-mode-row");
      row.append(el("span", "af-line", `${SUPPORTS[s.kind].name} @ ${PROVINCE_MAP[s.provinceId]?.name ?? s.provinceId} · 任务：${PROVINCE_MAP[s.missionTargetId]?.name ?? s.missionTargetId}`));
      const bM = el("button", "af-btn af-btn-small", pendingMissionSupportId === s.id ? "点地图选目标…" : "改派任务");
      bM.addEventListener("click", () => {
        pendingMissionSupportId = pendingMissionSupportId === s.id ? null : s.id;
        notice = pendingMissionSupportId ? `为${SUPPORTS[s.kind].name}指派任务：点地图上的省份设为任务目标` : "";
        render();
      });
      row.append(bM);
      box.append(row);
    }
  }
}

// ---------------- 主渲染 ----------------

function img(src: string, cls: string): HTMLImageElement {
  const i = document.createElement("img");
  i.src = src;
  i.className = cls;
  i.alt = "";
  return i;
}
const GENERIC_TEMPLATES = new Set(["infantry", "mountain", "cavalry", "motorized", "armor", "marine", "garrison", "guerrilla"]);
function badgeSrc(templateId: string): string {
  return `assets/badges/div_${GENERIC_TEMPLATES.has(templateId) ? templateId : "special"}.png`;
}

const TAB_ICONS: Record<string, string> = {
  province: "assets/icons/nav_provinces.png", troops: "assets/icons/nav_general.png",
  production: "assets/icons/nav_production.png", tech: "assets/icons/nav_research.png",
  focus: "assets/icons/nav_focus.png", diplomacy: "assets/icons/nav_diplomacy.png",
  records: "assets/icons/nav_journal.png",
};
const TABS: Array<{ id: string; name: string }> = [
  { id: "province", name: "省份" },
  { id: "troops", name: "部队" },
  { id: "production", name: "生产" },
  { id: "tech", name: "科技" },
  { id: "focus", name: "国策" },
  { id: "diplomacy", name: "外交" },
  { id: "records", name: "纪事" },
];

function renderGame(): void {
  // 失省警报：回合变化时对比归属快照（UI 层追踪）
  if (game) {
    if (prevTurnSeen !== game.turn) {
      if (prevOwners.size > 0) {
        const pid0 = playerId();
        lostProvinces = PROVINCES
          .filter((d) => prevOwners.get(d.id) === pid0 && game!.provinces[d.id]!.ownerId !== pid0)
          .map((d) => d.id);
      }
      prevOwners = new Map(PROVINCES.map((d) => [d.id, game!.provinces[d.id]!.ownerId]));
      prevTurnSeen = game.turn;
    }
  }
  if (!game) return;
  const pid = playerId();
  const f = game.factions[pid]!;
  app.replaceChildren();
  const wrap = el("div", "af-game");

  const top = el("div", "af-topbar");
  top.append(el("span", "af-game-title", "亚洲战场"));
  top.append(el("span", "af-date", `${game.year} 年 ${game.month} 月 · 第 ${game.turn} 回合`));
  const playerSpan = el("span", "af-player");
  playerSpan.append(img(FACTIONS[pid as FactionId].flagAsset, "af-flag-small"));
  playerSpan.append(document.createTextNode(` ${factionName(pid)} · 控省 ${controlledProvinceCount(game, pid)}/${Object.keys(game.provinces).length}`));
  top.append(playerSpan);
  const sp = f.stockpile;
  const milTotal = Object.values(game.provinces).filter((p) => p.ownerId === pid)
    .reduce((s, p) => s + p.factoriesMil, 0);
  const civTotal = Object.values(game.provinces).filter((p) => p.ownerId === pid)
    .reduce((s, p) => s + p.factoriesCiv, 0);
  const resItem = (icon: string | null, text: string) => {
    const sp2 = el("span", "af-res-item");
    if (icon) sp2.append(img(icon, "af-res-icon"));
    sp2.append(document.createTextNode(text));
    return sp2;
  };
  const topRes = el("div", "af-top-res");
  topRes.append(
    resItem("assets/icons/res_industry.png", `装备 ${Math.floor(sp.equipment)}`),
    resItem("assets/icons/res_manpower.png", `人力 ${Math.floor(sp.manpower)}`),
    resItem("assets/icons/res_oil.png", `油 ${Math.floor(sp.oil)}`),
    resItem("assets/icons/res_steel.png", `钢 ${Math.floor(sp.steel)}`),
    resItem("assets/icons/res_rubber.png", `橡胶 ${Math.floor(sp.rubber)}`),
    resItem("assets/icons/res_grain.png", `粮 ${Math.floor(sp.food)}`),
    resItem(null, `工厂 军${milTotal}/民${civTotal} · 建设 ${Math.floor(f.constructionPoints)} · 稳定 ${Math.round(f.stability)} · 战支 ${Math.round(f.warSupport)}`),
  );
  top.append(topRes);
  const menuWrap = el("div", "af-menu-wrap");
  const menuBtn = el("button", "af-btn af-btn-small", "菜单 ☰");
  const menuDrop = el("div", "af-menu-drop");
  menuDrop.style.display = "none";
  const restartBtn = el("button", "af-btn", "重开一局");
  restartBtn.addEventListener("click", () => {
    game = null;
    selectedProvince = null;
    render();
  });
  menuDrop.append(restartBtn);
  const viewBtn = el("button", "af-btn", viewMode === "3d" ? "地图：3D 立体（点击切 2D）" : "地图：2D 平面（点击切 3D）");
  viewBtn.addEventListener("click", () => {
    viewMode = viewMode === "3d" ? "2d" : "3d";
    try { localStorage.setItem("asia-front-view", viewMode); } catch { /* 隐私模式忽略 */ }
    render();
  });
  menuDrop.append(viewBtn);
  { // 音频设置（音乐/音效音量、静音、指挥室底噪）
    const box = el("div", "af-audio-box");
    box.append(el("div", "af-audio-title", "声音"));
    const row = (label: string, input: HTMLElement): HTMLElement => {
      const r = el("label", "af-audio-row");
      r.append(el("span", "af-audio-label", label), input);
      return r;
    };
    const musicRange = document.createElement("input");
    musicRange.type = "range"; musicRange.min = "0"; musicRange.max = "100";
    musicRange.value = String(Math.round(audio.settings.musicVol * 100));
    musicRange.addEventListener("input", () => audio.updateSettings({ musicVol: Number(musicRange.value) / 100 }));
    const sfxRange = document.createElement("input");
    sfxRange.type = "range"; sfxRange.min = "0"; sfxRange.max = "100";
    sfxRange.value = String(Math.round(audio.settings.sfxVol * 100));
    sfxRange.addEventListener("input", () => audio.updateSettings({ sfxVol: Number(sfxRange.value) / 100 }));
    const muteChk = document.createElement("input");
    muteChk.type = "checkbox"; muteChk.checked = audio.settings.muted;
    muteChk.addEventListener("change", () => audio.updateSettings({ muted: muteChk.checked }));
    const ambChk = document.createElement("input");
    ambChk.type = "checkbox"; ambChk.checked = audio.settings.ambience;
    ambChk.addEventListener("change", () => audio.updateSettings({ ambience: ambChk.checked }));
    box.append(row("音乐", musicRange), row("音效", sfxRange), row("静音", muteChk), row("底噪", ambChk));
    menuDrop.append(box);
  }
  menuBtn.addEventListener("click", () => {
    menuDrop.style.display = menuDrop.style.display === "none" ? "block" : "none";
  });
  menuWrap.append(menuBtn, menuDrop);
  top.append(menuWrap);
  wrap.append(top);

  if (notice) {
    wrap.append(el("div", noticeIsError ? "af-notice af-notice-error" : "af-notice", notice));
  }
  // 警报旗列（钢4 式）：有才显示，点旗直达对应面板/省份
  if (!game.gameOver) {
    const alerts: Array<{ icon: string; text: string; go: () => void }> = [];
    const myDivs = game.divisions.filter((d) => d.factionId === pid);
    const supplied = suppliedProvinces(game, pid);
    const cut = myDivs.filter((d) => !supplied.has(d.provinceId));
    if (cut.length > 0) {
      alerts.push({
        icon: "⚠", text: `部队断补给 ×${cut.length}`,
        go: () => { selectedProvince = cut[0]!.provinceId; selectedDivisionIds = new Set([cut[0]!.id]); render(); },
      });
    }
    if (lostProvinces.length > 0) {
      alerts.push({
        icon: "🏳", text: `${PROVINCE_MAP[lostProvinces[0]!]!.name} 被占${lostProvinces.length > 1 ? ` 等 ${lostProvinces.length} 省` : ""}`,
        go: () => { selectedProvince = lostProvinces[0]!; render(); },
      });
    }
    const myProvSet = new Set(PROVINCES.filter((d) => game!.provinces[d.id]!.ownerId === pid).map((d) => d.id));
    const declarable = Object.keys(game.factions).filter((fid) => fid !== pid
      && game!.factions[fid]!.alive !== false
      && !isAtWar(game!, pid, fid)
      && relationOf(game!, pid, fid) < 50
      && PROVINCES.some((d) => game!.provinces[d.id]!.ownerId === fid && d.neighbors.some((n) => myProvSet.has(n))));
    if (declarable.length > 0) {
      alerts.push({
        icon: "⚔", text: `可宣战：${factionName(declarable[0]!)}${declarable.length > 1 ? ` 等 ${declarable.length} 家` : ""}`,
        go: () => { activeTab = "diplomacy"; drawerOpen = true; render(); },
      });
    }
    if (game.factions[pid]!.constructionPoints >= ECONOMY.factoryBuildCost) {
      alerts.push({
        icon: "🏭", text: "建设点可建工厂",
        go: () => { activeTab = "production"; drawerOpen = true; render(); },
      });
    }
    if (!game.factions[pid]!.researchBranch) {
      alerts.push({
        icon: "🔬", text: "科研闲置",
        go: () => { activeTab = "tech"; drawerOpen = true; render(); },
      });
    }
    if (alerts.length > 0) {
      const row = el("div", "af-alerts");
      for (const a of alerts) {
        const b = el("button", "af-alert-flag", `${a.icon} ${a.text}`);
        b.addEventListener("click", a.go);
        row.append(b);
      }
      wrap.append(row);
    }
  }

  const main = el("div", "af-main");
  const mapWrap = el("div", "af-map-wrap");
  const modeRow = el("div", "af-mapmode-row");
  for (const m of [{ id: "political", name: "政治" }, { id: "terrain", name: "地形" }] as const) {
    const b = el("button", `af-btn af-btn-small${mapMode === m.id ? " af-btn-active" : ""}`, m.name);
    b.addEventListener("click", () => { mapMode = m.id; render(); });
    modeRow.append(b);
  }
  mapWrap.append(modeRow);
  if (viewMode === "3d") {
    mapWrap.append(map3dContainer());
    syncMap3D();
  } else {
    map3dHandle?.setRunning(false);
    mapWrap.append(renderMap());
  }
  const legend = el("div", "af-legend");
  if (mapMode === "terrain") {
    legend.textContent = "地形模式：" + Object.values(TERRAIN_PARAMS).map((t) => t.name).join(" / ")
      + "（颜色见图面；山地/丛林/沼泽/城市利于防守且限容，平原利于装甲与行军）";
  } else {
    legend.textContent = "地图按归属着色；军棋牌 = 驻军（徽记＋兵力/组织条，×N 为师数）。点己方省份选中编组，再点相邻敌省进攻、点高亮省行军；跨海进攻走登陆项目：港口选师筹备、次月执行。";
  }
  mapWrap.append(legend);
  main.append(mapWrap);

  // 图标轨（48px）：页签开关；抽屉从右侧浮出盖在地图上，地图本体不缩
  const rail = el("div", "af-rail");
  for (const tab of TABS) {
    const b = el("button", `af-rail-btn${drawerOpen && activeTab === tab.id ? " af-rail-active" : ""}`);
    b.title = tab.name;
    if (TAB_ICONS[tab.id]) b.append(img(TAB_ICONS[tab.id]!, "af-rail-icon"));
    b.append(el("span", "af-rail-label", tab.name));
    b.addEventListener("click", () => {
      if (drawerOpen && activeTab === tab.id) drawerOpen = false;
      else { activeTab = tab.id; drawerOpen = true; }
      render();
    });
    rail.append(b);
  }
  main.append(rail);
  const side = el("div", `af-side af-drawer${drawerOpen ? " af-drawer-open" : ""}`);
  const drawerHead = el("div", "af-drawer-head");
  drawerHead.append(el("span", "af-drawer-title", TABS.find((t) => t.id === activeTab)?.name ?? ""));
  const closeBtn = el("button", "af-btn af-btn-small", "✕ 收起");
  closeBtn.addEventListener("click", () => { drawerOpen = false; render(); });
  drawerHead.append(closeBtn);
  side.append(drawerHead);
  const panel = el("div", "af-panel");
  if (activeTab === "province") renderProvincePanel(panel);
  else if (activeTab === "troops") renderTroopsPanel(panel);
  else if (activeTab === "production") renderProductionPanel(panel);
  else if (activeTab === "tech") renderTechPanel(panel);
  else if (activeTab === "focus") renderFocusPanel(panel);
  else if (activeTab === "diplomacy") renderDiplomacyPanel(panel);
  else renderRecordsPanel(panel);
  side.append(panel);
  {
    const ov = el("div", "af-side-overview");
    ov.append(el("div", "af-overview-title", "战局总览"));
    const g = game!;
    const myDivs = g.divisions.filter((d) => d.factionId === pid);
    const ready = myDivs.filter((d) => d.movedTurn < g.turn).length;
    const marching = myDivs.filter((d) => d.pathIds?.length).length;
    ov.append(el("div", "af-line",
      `${g.year} 年 ${g.month} 月 · 控省 ${controlledProvinceCount(g, pid)}/${Object.keys(g.provinces).length} · 师 ${myDivs.length}（待命 ${ready} · 行军中 ${marching}）`));
    const groups = (g.groups ?? []).filter((gr) => gr.factionId === pid);
    if (groups.length > 0) {
      for (const gr of groups) {
        const members = myDivs.filter((d) => d.groupId === gr.id);
        const avgOrg = members.length
          ? Math.round(members.reduce((sum, d) => sum + d.org, 0) / members.length) : 0;
        ov.append(el("div", "af-line", `编组「${gr.name}」：${members.length} 师 · 平均组织 ${avgOrg}`));
      }
    } else {
      ov.append(el("div", "af-line af-dim", "暂无常设编组（在省份面板勾选师后可存为编组）"));
    }
    const top = Object.keys(g.factions)
      .map((fid) => ({ fid, c: controlledProvinceCount(g, fid) }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, 5);
    ov.append(el("div", "af-line", "控省前列：" + top.map((x) => `${factionName(x.fid)} ${x.c}`).join(" · ")));
    side.append(ov);
  }
  main.append(side);
  if (selectedProvince && game.provinces[selectedProvince]) {
    const def = PROVINCE_MAP[selectedProvince]!;
    const st = game.provinces[selectedProvince]!;
    const card = el("div", "af-info-card");
    const head = el("div", "af-info-head");
    head.append(el("span", "af-info-name",
      `${def.name}（${TERRAIN_PARAMS[def.terrain].name}） · ${st.ownerId === "neutral" ? "无主" : factionName(st.ownerId)}`));
    const xBtn = el("button", "af-btn af-btn-small", "✕");
    xBtn.addEventListener("click", () => { selectedProvince = null; render(); });
    head.append(xBtn);
    card.append(head);
    const divsHere = game.divisions.filter((d) => d.provinceId === def.id);
    const mineHere = divsHere.filter((d) => d.factionId === pid).length;
    const unsupplied = st.ownerId !== "neutral" && !suppliedProvinces(game, st.ownerId).has(def.id);
    card.append(el("div", "af-line",
      `驻军 ${divsHere.length} 师${mineHere ? `（己方 ${mineHere}）` : ""} · 军工 ${st.factoriesMil}/民工 ${st.factoriesCiv}`
      + (def.isPort ? " · 港口" : "") + (CAPITAL_IDS.has(def.id) ? " · 首都" : "")
      + (unsupplied ? " · 补给断绝（包围）" : "")));
    const detailBtn = el("button", "af-btn af-btn-small", "打开详情 / 指挥");
    detailBtn.addEventListener("click", () => { activeTab = "province"; drawerOpen = true; render(); });
    card.append(detailBtn);
    main.append(card);
  }
  wrap.append(main);

  // 底部常驻功能栏：功能入口 + 结束回合常驻；选中编组时并排指挥命令
  const bottomBar = el("div", "af-bottombar");
  const mapBtn = el("button", "af-bb-square");
  mapBtn.title = "回到全图（并收起面板）";
  mapBtn.append(img("assets/ui/compass_button.png", "af-bb-compass"));
  mapBtn.addEventListener("click", () => { mapView = fullView(); if (viewMode === "3d") map3dHandle?.resetView(); drawerOpen = false; render(); });
  bottomBar.append(mapBtn);
  if (selectedDivisionIds.size > 0) {
    const selDivs = game.divisions.filter((d) => selectedDivisionIds.has(d.id) && d.factionId === pid);
    const gids = new Set(selDivs.map((d) => d.groupId).filter(Boolean));
    const gname = gids.size === 1
      ? (game.groups.find((g) => g.id === [...gids][0])?.name ?? "编组")
      : "已选编组";
    void gname;
    const bMove = el("button", "af-btn af-btn-small", "行军");
    bMove.addEventListener("click", () => { notice = "行军：点地图上高亮的省份，部队会沿路径开进（跨省自动续程）"; noticeIsError = false; render(); });
    const bAtk = el("button", "af-btn af-btn-small", "进攻");
    bAtk.addEventListener("click", () => { notice = "进攻：点地图上的红色敌省合击，或在省份面板的目标按钮下令"; noticeIsError = false; render(); });
    const bHold2 = el("button", "af-btn af-btn-small", "驻扎");
    bHold2.addEventListener("click", () => {
      dispatch({ type: "HOLD_POSITION", factionId: pid, divisionIds: [...selectedDivisionIds] });
    });
    const bCancel = el("button", "af-btn af-btn-small", "取消选择");
    bCancel.addEventListener("click", () => { selectedDivisionIds.clear(); selectedDivisionId = null; render(); });
    bottomBar.append(bMove, bAtk, bHold2, bCancel);
  }
  const endBtn2 = el("button", "af-btn-end-img", "结束回合 ▶");
  endBtn2.addEventListener("click", () => {
    selectedDivisionId = null;
    dispatch({ type: "END_TURN" });
  });
  bottomBar.append(endBtn2);
  // 编组卡带（底栏上方）：每个师一张卡，点卡定位到省
  if (selectedDivisionIds.size > 0) {
    const selDivs = game.divisions.filter((d) => selectedDivisionIds.has(d.id) && d.factionId === pid);
    if (selDivs.length > 0) {
      const strip = el("div", "af-group-strip");
      const gids = new Set(selDivs.map((d) => d.groupId).filter(Boolean));
      const gname = gids.size === 1 ? (game.groups.find((g) => g.id === [...gids][0])?.name ?? "编组") : "已选编组";
      strip.append(el("span", "af-group-strip-name", `${gname} · ${selDivs.length} 师`));
      for (const d of selDivs) {
        const tpl = TEMPLATES[d.templateId]!;
        const card = el("button", "af-group-card");
        card.append(img(badgeSrc(d.templateId), "af-group-card-icon"));
        const mid = el("div", "af-group-card-mid");
        mid.append(el("div", "af-group-card-name", tpl.name));
        const barS = el("div", "af-mini-bar");
        const fillS = el("div", "af-mini-bar-fill af-fill-strength");
        fillS.style.width = `${Math.round(100 * Math.min(1, d.strength / tpl.fullStrength))}%`;
        barS.append(fillS);
        const barO = el("div", "af-mini-bar");
        const fillO = el("div", "af-mini-bar-fill af-fill-org");
        fillO.style.width = `${Math.round(d.org)}%`;
        barO.append(fillO);
        mid.append(barS, barO);
        card.append(mid);
        const status = d.pathIds && d.pathIds.length > 0 ? "行军中" : d.movedTurn >= game.turn ? "已行动" : "待命";
        card.append(el("span", "af-group-card-status", `${(d.strength / 10000).toFixed(1)}万 · ${status}`));
        card.addEventListener("click", () => {
          selectedProvince = d.provinceId;
          const def = PROVINCE_MAP[d.provinceId]!;
          mapView = clampView({ x: def.cx - mapView.w / 2, y: def.cy - viewHeight(mapView) / 2, w: mapView.w });
          if (viewMode === "3d") map3dHandle?.focusOn(def.cx, def.cy);
          render();
        });
        strip.append(card);
      }
      wrap.append(strip);
    }
  }
  wrap.append(bottomBar);

  if (game.gameOver) {
    const overlay = el("div", "af-overlay");
    const card = el("div", `af-overlay-card ${game.gameOver.winnerId === pid ? "af-overlay-win" : "af-overlay-lose"}`);
    card.append(el("h2", "", game.gameOver.winnerId === pid ? "胜利！" : "本局结束"));
    card.append(el("p", "", game.gameOver.reason));
    const again = el("button", "af-btn af-btn-end", "再来一局");
    again.addEventListener("click", () => {
      game = null;
      selectedProvince = null;
      render();
    });
    card.append(again);
    overlay.append(card);
    wrap.append(overlay);
  }
  app.append(wrap);
}

function render(): void {
  // 配乐场景同步（选国=菜单曲 / 对局=战争轮换 / 结算=胜负曲）
  audio.setScene(!game ? "menu" : game.gameOver ? (game.gameOver.winnerId === playerId() ? "end-victory" : "end-defeat") : "main");
  if (!game) {
    map3dHandle?.setRunning(false);
    renderStart();
  } else renderGame();
}

initAudioOnFirstInteraction();
document.addEventListener("click", (e) => {
  // UI 声音委托：页签/面板开关/菜单项/未 dispatch 的面板按钮
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  if (btn.closest(".af-rail")) { audio.playSfx("ui_tab", 0.9); return; }
  const txt = btn.textContent?.trim() ?? "";
  if (txt === "✕ 收起") { audio.playSfx("panel_close", 0.9); return; }
  if (txt === "打开详情 / 指挥") { audio.playSfx("panel_open", 0.9); return; }
  if (btn.closest(".af-menu-drop")) { audio.playSfx("ui_click", 0.8); return; }
  if ((btn.closest(".af-drawer") || btn.closest(".af-bottombar")) && performance.now() - lastDispatchAt > 40) {
    audio.playSfx("ui_click", 0.55);
  }
});
render();
{ // 加载图（D6）：首帧渲染后淡出
  const splash = document.getElementById("splash");
  if (splash) setTimeout(() => { splash.style.opacity = "0"; setTimeout(() => splash.remove(), 550); }, 350);
}
