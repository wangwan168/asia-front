// 音频系统（纯 UI 层）：WebAudio 双通道（配乐/音效）＋设置持久化＋挂钩判定（纯函数）。
// 设计稿 docs/audio-system-design.md；素材路径以 ASSET-REGISTRY 音频类为准（assets/audio/）。
// 挂钩只读 applyAction 结果与纪事差分，不改引擎结算。
import type { GameState } from "../state/types";
import type { GameAction } from "../core/applyAction";
import { FACTIONS } from "../data/factions";

// ---------- 素材槽位（与 AUDIO-LIST.md 一一对应） ----------
export const SFX_FILES: Record<string, string> = {
  ui_click: "/assets/audio/sfx/sfx_ui_click.ogg",
  ui_tab: "/assets/audio/sfx/sfx_ui_tab.ogg",
  panel_open: "/assets/audio/sfx/sfx_ui_panel_open.ogg",
  panel_close: "/assets/audio/sfx/sfx_ui_panel_close.ogg",
  order_march: "/assets/audio/sfx/sfx_order_march.ogg",
  order_attack: "/assets/audio/sfx/sfx_order_attack.ogg",
  order_garrison: "/assets/audio/sfx/sfx_order_garrison.ogg",
  order_cancel: "/assets/audio/sfx/sfx_order_cancel.ogg",
  battle_start: "/assets/audio/sfx/sfx_battle_start.ogg",
  battle_loop: "/assets/audio/sfx/sfx_battle_loop.ogg",
  battle_victory: "/assets/audio/sfx/sfx_battle_victory.ogg",
  battle_defeat: "/assets/audio/sfx/sfx_battle_defeat.ogg",
  province_captured: "/assets/audio/sfx/sfx_province_captured.ogg",
  province_lost: "/assets/audio/sfx/sfx_province_lost.ogg",
  event_telegraph: "/assets/audio/sfx/sfx_event_telegraph.ogg",
  declare_war: "/assets/audio/sfx/sfx_declare_war.ogg",
  peace: "/assets/audio/sfx/sfx_peace.ogg",
  airraid: "/assets/audio/sfx/sfx_airraid.ogg",
};
export const MUSIC_FILES = {
  menu: "/assets/audio/music/music_menu.ogg",
  war: [
    "/assets/audio/music/music_war_1.ogg",
    "/assets/audio/music/music_war_2.ogg",
    "/assets/audio/music/music_war_3.ogg",
  ],
  victory: "/assets/audio/music/music_victory.ogg",
  defeat: "/assets/audio/music/music_defeat.ogg",
  ambience: "/assets/audio/sfx/amb_hq_loop.ogg",
};

// ---------- 设置 ----------
export interface AudioSettings {
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
  muted: boolean;
  ambience: boolean; // 指挥室底噪开关（默认关）
}
export const DEFAULT_SETTINGS: AudioSettings = { musicVol: 0.5, sfxVol: 0.8, muted: false, ambience: false };
const SETTINGS_KEY = "asia-front-audio";

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
export function loadSettings(storage: StorageLike | null = defaultStorage()): AudioSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const p = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicVol: typeof p.musicVol === "number" ? Math.min(1, Math.max(0, p.musicVol)) : DEFAULT_SETTINGS.musicVol,
      sfxVol: typeof p.sfxVol === "number" ? Math.min(1, Math.max(0, p.sfxVol)) : DEFAULT_SETTINGS.sfxVol,
      muted: p.muted === true,
      ambience: p.ambience === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s: AudioSettings, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 存储不可用时静默 */
  }
}

// ---------- 挂钩判定（纯函数，可单测） ----------
export interface SoundCue {
  slot: string;
  gain: number; // 相对音量 0..1（再乘通道音量）
}

const cue = (slot: string, gain = 1): SoundCue => ({ slot, gain });

function newLogs(pre: GameState, post: GameState): GameState["log"] {
  return post.log.slice(pre.log.length);
}
function warsAdded(pre: GameState, post: GameState, pid: string): boolean {
  const before = new Set(pre.wars);
  return post.wars.some((w) => !before.has(w) && w.split("|").includes(pid));
}

/** 按一次 dispatch 的前后状态与结果判定要播的音效队列（串行播放、战斗优先）。
 *  只读判定：不改任何状态。error 非空 → 驳回音。 */
export function planSounds(pre: GameState, action: GameAction, post: GameState, error: string | null): SoundCue[] {
  const pid = "factionId" in action ? action.factionId : (pre.playerFactionId ?? "");
  if (error) return [cue("order_cancel", 0.9)];
  switch (action.type) {
    case "MOVE_UNITS":
      return [cue("order_march")];
    case "HOLD_POSITION":
      return [cue("order_garrison")];
    case "PREPARE_LANDING":
      return [cue("order_march", 0.9)];
    case "CANCEL_LANDING":
      return [cue("order_cancel")];
    case "ATTACK":
    case "RAID":
    case "EXECUTE_LANDING": {
      const cues: SoundCue[] = [cue("order_attack"), cue("battle_start")];
      const targetId = action.type === "EXECUTE_LANDING"
        ? pre.landingPlans.find((p) => p.id === action.planId)?.targetProvinceId
        : action.targetProvinceId;
      if (action.type === "RAID") {
        const entry = newLogs(pre, post).find((l) => l.kind === "battle");
        cues.push(cue(entry && entry.text.includes("得手") ? "battle_victory" : "battle_defeat", 0.8));
        return cues;
      }
      if (targetId && post.provinces[targetId] && pre.provinces[targetId]) {
        const captured = post.provinces[targetId]!.ownerId === pid && pre.provinces[targetId]!.ownerId !== pid;
        if (captured) cues.push(cue("province_captured"), cue("battle_victory"));
        else cues.push(cue("battle_defeat", 0.85));
      }
      return cues;
    }
    case "DIPLOMACY": {
      if (action.actionId === "declareWar") return [cue("declare_war")];
      if (action.actionId === "peace" || action.actionId === "alliance" || action.actionId === "vassalize" || action.actionId === "nonAggression") {
        return [cue("peace")];
      }
      return [cue("ui_click")];
    }
    case "END_TURN": {
      const cues: SoundCue[] = [cue("order_march", 0.65)];
      const logs = newLogs(pre, post);
      // 胜负结算（音乐层覆盖 cue，引擎特殊处理 music_ 前缀）
      if (post.gameOver && !pre.gameOver) {
        cues.push(cue(post.gameOver.winnerId === pid ? "music_victory" : "music_defeat"));
        return cues.slice(0, 4);
      }
      if (warsAdded(pre, post, pid)) cues.push(cue("declare_war", 0.9));
      // 省份得失（owner 差分）
      let lost = 0;
      let gained = 0;
      for (const provId of Object.keys(post.provinces)) {
        const before = pre.provinces[provId]?.ownerId;
        const after = post.provinces[provId]?.ownerId;
        if (before === pid && after !== pid) lost++;
        else if (before !== pid && after === pid) gained++;
      }
      const battleLogs = logs.filter((l) => l.kind === "battle");
      if (lost > 0) cues.push(cue("province_lost"), cue("battle_defeat", 0.7));
      else if (gained > 0) cues.push(cue("province_captured", 0.9));
      else if (battleLogs.length > 0) {
        // 玩家相关战斗（纪事提到玩家势力 id 或玩家原省份名）但无得失：守住/击退，轻响炮火
        const myProvNames = Object.keys(pre.provinces)
          .filter((id) => pre.provinces[id]?.ownerId === pid)
          .map((id) => id);
        const involves = battleLogs.some(
          (l) => l.text.includes(pid) || myProvNames.some((id) => l.text.includes(FACTIONS[pid as keyof typeof FACTIONS]?.name ?? pid)),
        );
        if (involves) cues.push(cue("battle_start", 0.55));
      }
      // 激战月（≥2 场玩家相关战斗）：战斗氛围循环垫底一遍
      if (battleLogs.length >= 2 && (lost > 0 || gained > 0)) cues.push(cue("battle_loop", 0.3));
      if (logs.some((l) => l.kind === "event")) cues.push(cue("event_telegraph", 0.9));
      // 空袭标记落在玩家省份
      const preMarks = new Set(pre.combatMarks.map((m) => `${m.provinceId}|${m.kind}|${m.turn}`));
      const raided = post.combatMarks.some(
        (m) => m.kind === "airraid" && !preMarks.has(`${m.provinceId}|${m.kind}|${m.turn}`)
          && post.provinces[m.provinceId]?.ownerId === pid,
      );
      if (raided) cues.push(cue("airraid", 0.5));
      return cues.slice(0, 4);
    }
    default:
      return [cue("ui_click", 0.8)];
  }
}

// ---------- 引擎（DOM/WebAudio，懒初始化） ----------
export type MusicScene = "menu" | "main" | "end-victory" | "end-defeat";

class AudioEngine {
  settings: AudioSettings = loadSettings();
  played: string[] = []; // 验收/调试用：记录实际触发的槽位
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayAt = new Map<string, number>();
  private musicEl: HTMLAudioElement | null = null;
  private ambEl: HTMLAudioElement | null = null;
  private scene: MusicScene | null = null;
  private warIdx = -1;
  private queue: SoundCue[] = [];
  private queueTimer: ReturnType<typeof setTimeout> | null = null;

  get initialized(): boolean {
    return this.ctx !== null;
  }

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const master = this.ctx.createGain();
      master.gain.value = this.settings.muted ? 0 : 1;
      master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.musicVol;
      this.musicGain.connect(master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfxVol;
      this.sfxGain.connect(master);
      this.master = master;
      void this.preloadSfx();
      if (this.scene) this.startScene(this.scene, true);
      this.applyAmbience();
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else if (!this.settings.muted) void this.ctx.resume();
      });
    } catch {
      this.ctx = null; // 音频不可用时静默降级，游戏照常
    }
  }
  private master: GainNode | null = null;

  private async preloadSfx(): Promise<void> {
    if (!this.ctx) return;
    for (const [slot, url] of Object.entries(SFX_FILES)) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(slot, buf);
      } catch {
        /* 缺文件静默跳过 */
      }
    }
  }

  updateSettings(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    if (this.ctx && this.master && this.musicGain && this.sfxGain) {
      this.master.gain.value = this.settings.muted ? 0 : 1;
      this.musicGain.gain.value = this.settings.musicVol;
      this.sfxGain.gain.value = this.settings.sfxVol;
    }
    this.applyAmbience();
  }

  private applyAmbience(): void {
    if (typeof document === "undefined") return;
    if (this.settings.ambience && this.ctx) {
      if (!this.ambEl) {
        this.ambEl = new Audio(MUSIC_FILES.ambience);
        this.ambEl.loop = true;
        this.ambEl.volume = 0.12;
      }
      void this.ambEl.play().catch(() => undefined);
    } else if (this.ambEl) {
      this.ambEl.pause();
    }
  }

  setScene(scene: MusicScene): void {
    if (this.scene === scene) return;
    this.scene = scene;
    if (this.ctx) this.startScene(scene, false);
  }

  private startScene(scene: MusicScene, fadeIn: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusic();
    const el = new Audio();
    el.crossOrigin = "anonymous";
    if (scene === "menu") {
      el.src = MUSIC_FILES.menu;
      el.loop = true;
    } else if (scene === "main") {
      this.warIdx = Math.floor(Math.random() * MUSIC_FILES.war.length);
      el.src = MUSIC_FILES.war[this.warIdx]!;
      el.loop = false;
      el.addEventListener("ended", () => {
        if (this.scene !== "main") return;
        let next = Math.floor(Math.random() * MUSIC_FILES.war.length);
        if (next === this.warIdx) next = (next + 1) % MUSIC_FILES.war.length;
        this.warIdx = next;
        el.src = MUSIC_FILES.war[next]!;
        void el.play().catch(() => undefined);
      });
    } else {
      el.src = scene === "end-victory" ? MUSIC_FILES.victory : MUSIC_FILES.defeat;
      el.loop = false;
    }
    try {
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.musicGain);
    } catch {
      /* 已连接过同一元素等异常时忽略，元素自身默认输出仍可响 */
    }
    this.musicEl = el;
    if (fadeIn) {
      el.volume = 0;
      void el.play().catch(() => undefined);
      const t0 = performance.now();
      const step = (): void => {
        const k = Math.min(1, (performance.now() - t0) / 1500);
        el.volume = k;
        if (k < 1 && this.musicEl === el) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      void el.play().catch(() => undefined);
    }
  }

  private stopMusic(): void {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.removeAttribute("src");
      this.musicEl = null;
    }
  }

  /** 串行播放一串 cue（间隔 150ms，战斗类优先已由 planSounds 排序）。 */
  playCues(cues: SoundCue[]): void {
    for (const c of cues) this.queue.push(c);
    if (this.queueTimer !== null) return;
    const step = (): void => {
      const c = this.queue.shift();
      if (!c) {
        this.queueTimer = null;
        return;
      }
      this.playNow(c);
      this.queueTimer = setTimeout(step, 150);
    };
    step();
  }

  playSfx(slot: string, gain = 1): void {
    this.playNow({ slot, gain });
  }

  private playNow(c: SoundCue): void {
    this.played.push(c.slot);
    if (this.played.length > 200) this.played.splice(0, this.played.length - 200);
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (c.slot === "music_victory") {
      this.setScene("end-victory");
      return;
    }
    if (c.slot === "music_defeat") {
      this.setScene("end-defeat");
      return;
    }
    const now = performance.now();
    if (now - (this.lastPlayAt.get(c.slot) ?? 0) < 60) return; // 同槽节流
    this.lastPlayAt.set(c.slot, now);
    const buf = this.buffers.get(c.slot);
    if (!buf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = Math.min(1, Math.max(0, c.gain));
      src.connect(g);
      g.connect(this.sfxGain);
      src.start();
    } catch {
      /* 播放失败静默 */
    }
  }
}

export const audio = new AudioEngine();

/** 首次交互后启动音频（浏览器自动播放限制）：pointerdown 一次性监听。 */
export function initAudioOnFirstInteraction(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __audio: AudioEngine }).__audio = audio;
  const kick = (): void => {
    audio.init();
    window.removeEventListener("pointerdown", kick);
  };
  window.addEventListener("pointerdown", kick);
}
