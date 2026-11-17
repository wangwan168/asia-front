// 固定种子随机数（项目铁律：随机数只走本文件，禁止直接 Math.random）。
// 算法：mulberry32（32 位状态、周期 2^32），种子可为数字或字符串（字符串先做 FNV-1a 哈希）。
// 子流：derive(label) 以「主种子 + 标签」派生独立序列，各系统（战斗/外交/事件）各用一条子流，
// 互不干扰且整体可复现：同一种子 + 同一调用顺序 => 同一结果（测试与存档复盘的基础）。

export type SeedInput = number | string;

export function hashSeed(seed: SeedInput): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }
  // FNV-1a 32 位
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** 下一个 [0, 1) 浮点数 */
  next(): number;
  /** [min, max) 整数 */
  nextInt(minInclusive: number, maxExclusive: number): number;
  /** [min, max] 浮点数 */
  nextRange(min: number, max: number): number;
  /** 以 probability（0-1）概率返回 true */
  chance(probability: number): boolean;
  /** 从非空数组中等概率取一项 */
  pick<T>(items: readonly T[]): T;
  /** 派生一条独立子流（同主种子 + 同标签 => 同序列） */
  derive(label: string): Rng;
  /** 当前内部状态（可序列化，用于存档续跑） */
  getState(): number;
}

export function createRng(seed: SeedInput): Rng {
  const rootSeed = hashSeed(seed);
  let state = rootSeed;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt(minInclusive: number, maxExclusive: number): number {
      if (maxExclusive <= minInclusive) {
        throw new Error(`nextInt: empty range [${minInclusive}, ${maxExclusive})`);
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    nextRange(min: number, max: number): number {
      return min + next() * (max - min);
    },
    chance(probability: number): boolean {
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("pick: empty array");
      }
      return items[Math.floor(next() * items.length)]!;
    },
    derive(label: string): Rng {
      return createRng(`${rootSeed}:${label}`);
    },
    getState(): number {
      return state;
    },
  };
}

/** 从已保存的内部状态恢复一条流（存档续跑用）：恢复后序列与原流从该点起一致。
 *  原理：createRng(数字) 的初始内部状态就是该数字本身，故以 getState() 的返回值作种子即可续跑。 */
export function restoreRng(state: number): Rng {
  return createRng(state >>> 0);
}
