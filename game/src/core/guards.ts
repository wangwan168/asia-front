// 数值边界保护工具（core 层）：所有状态写入前过这里钳制，禁止出现负资源、越界民心等非法值。
// 纯函数、无副作用。

/** 把 value 钳制到 [min, max]；非有限数（NaN/Infinity）按 min 处理，避免脏数据污染状态。 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

/** 整数钳制（先取整再钳制） */
export function clampInt(value: number, min: number, max: number): number {
  return clamp(Math.trunc(value), min, max);
}

/** 民心/关系等百分量表：0-100 */
export function clampPercent(value: number): number {
  return clamp(value, 0, 100);
}

/** 民心 0-100（语义别名，调用点可读性） */
export function clampMorale(value: number): number {
  return clampPercent(value);
}

/** 外交关系 0-100 */
export function clampRelation(value: number): number {
  return clampPercent(value);
}

/** 资源（银/粮/人口/兵力等）不得为负，非有限数归 0 */
export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

/** 人数类资源：非负整数 */
export function clampHeadcount(value: number): number {
  return Math.trunc(clampNonNegative(value));
}
