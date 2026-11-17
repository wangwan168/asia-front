// 存档层（纯逻辑）：序列化/反序列化、槽位管理、读档校验。
// 存储介质经 KeyValueStorage 接口注入（浏览器用 localStorage 适配层，测试用内存实现），纯逻辑与介质分离。
// 存档带版本号与种子；反序列化失败一律返回 { ok: false, error }，不抛异常、不返回半成品状态。

import { STATE_VERSION, type GameState } from "../state/types";

export const SAVE_FORMAT_VERSION = 1;
export const SAVE_KEY_PREFIX = "asia-front.save.";

export type SaveSlotId = "manual-1" | "manual-2" | "manual-3" | "auto";
export const SAVE_SLOTS: SaveSlotId[] = ["manual-1", "manual-2", "manual-3", "auto"];

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface SaveEnvelope {
  formatVersion: number;
  savedAt: string; // ISO 时间（由调用方传入或默认当前时间，仅作展示元数据）
  seed: number;
  state: GameState;
}

export type LoadResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

export function serializeSave(state: GameState, savedAt?: string): string {
  const envelope: SaveEnvelope = {
    formatVersion: SAVE_FORMAT_VERSION,
    savedAt: savedAt ?? new Date().toISOString(),
    seed: state.seed,
    state,
  };
  return JSON.stringify(envelope);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function deserializeSave(json: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "SAVE_NOT_JSON" };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "SAVE_NOT_OBJECT" };
  }
  if (parsed.formatVersion !== SAVE_FORMAT_VERSION) {
    return {
      ok: false,
      error: `SAVE_VERSION_MISMATCH: expected ${SAVE_FORMAT_VERSION}, got ${String(parsed.formatVersion)}`,
    };
  }
  if (typeof parsed.seed !== "number") {
    return { ok: false, error: "SAVE_MISSING_SEED" };
  }
  const state = parsed.state;
  if (!isRecord(state)) {
    return { ok: false, error: "SAVE_MISSING_STATE" };
  }
  if (state.version === 2 || state.version === 3 || state.version === 4 || state.version === 5 || state.version === 6) {
    // v2 -> v4：补指挥层字段（编组/路径）；v3 -> v4：补组织度 org=100；v4 -> v5：补战斗标记 combatMarks=[]；v5 -> v6：支援单位补任务目标 missionTargetId=驻扎省
    const divs = Array.isArray(state.divisions) ? (state.divisions as Array<Record<string, unknown>>) : [];
    for (const d of divs) {
      if (d && typeof d === "object") {
        if (!("groupId" in d)) d.groupId = null;
        if (typeof d.org !== "number") d.org = 100;
      }
    }
    if (!Array.isArray((state as Record<string, unknown>).groups)) {
      (state as Record<string, unknown>).groups = [];
    }
    if (!Array.isArray((state as Record<string, unknown>).combatMarks)) {
      (state as Record<string, unknown>).combatMarks = [];
    }
    if (!Array.isArray((state as Record<string, unknown>).landingPlans)) {
      (state as Record<string, unknown>).landingPlans = [];
    }
    const sups = Array.isArray((state as Record<string, unknown>).supports)
      ? ((state as Record<string, unknown>).supports as Array<Record<string, unknown>>) : [];
    for (const sp of sups) {
      if (sp && typeof sp === "object" && typeof sp.missionTargetId !== "string") {
        sp.missionTargetId = sp.provinceId;
      }
    }
    (state as Record<string, unknown>).version = STATE_VERSION;
  } else if (state.version !== STATE_VERSION) {
    return {
      ok: false,
      error: `SAVE_STATE_VERSION_MISMATCH: expected ${STATE_VERSION}, got ${String(state.version)}`,
    };
  }
  if (
    typeof state.turn !== "number" ||
    typeof state.year !== "number" ||
    typeof state.month !== "number" ||
    typeof state.seed !== "number" ||
    !isRecord(state.factions) ||
    !isRecord(state.provinces) ||
    !Array.isArray(state.divisions) ||
    !Array.isArray(state.log)
  ) {
    return { ok: false, error: "SAVE_STATE_INCOMPLETE" };
  }
  if (state.seed !== parsed.seed) {
    return { ok: false, error: "SAVE_SEED_MISMATCH" };
  }
  return { ok: true, state: state as unknown as GameState };
}

/**
 * 宽容导入（网页版搬家用）：接受标准存档信封 JSON，也接受直接导出的裸 GameState JSON
 * （如从旧网页版 localStorage 里复制出的 asia-front.save.* 的值再包一层或其 state 本体）。
 * 裸 state 会先包成信封再走同一套校验/迁移，保证与网页版现行格式完全兼容。
 */
export function importSaveJson(json: string): LoadResult {
  const direct = deserializeSave(json);
  if (direct.ok) return direct;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return direct;
  }
  // 情形一：整个 localStorage 存档值本身就是信封（deserializeSave 已处理）；情形二：裸 state
  if (isRecord(parsed) && isRecord(parsed.provinces) && typeof parsed.turn === "number" && typeof parsed.seed === "number") {
    const wrapped = JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      seed: parsed.seed,
      state: parsed,
    });
    const viaWrap = deserializeSave(wrapped);
    if (viaWrap.ok) return viaWrap;
  }
  // 情形三：信封被多包了一层字符串
  if (typeof parsed === "string") {
    const inner = deserializeSave(parsed);
    if (inner.ok) return inner;
  }
  return direct;
}

export class SaveManager {
  constructor(private readonly storage: KeyValueStorage) {}

  private key(slot: SaveSlotId): string {
    return SAVE_KEY_PREFIX + slot;
  }

  save(slot: SaveSlotId, state: GameState, savedAt?: string): void {
    this.storage.set(this.key(slot), serializeSave(state, savedAt));
  }

  load(slot: SaveSlotId): LoadResult {
    const raw = this.storage.get(this.key(slot));
    if (raw === null) {
      return { ok: false, error: `SAVE_SLOT_EMPTY: ${slot}` };
    }
    return deserializeSave(raw);
  }

  has(slot: SaveSlotId): boolean {
    return this.storage.get(this.key(slot)) !== null;
  }

  remove(slot: SaveSlotId): void {
    this.storage.remove(this.key(slot));
  }
}

/** 内存存储（测试与无 localStorage 环境用） */
export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v);
    },
    remove: (k) => {
      map.delete(k);
    },
  };
}
