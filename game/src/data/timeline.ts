// 时间系统口径（用户 2026-11-16 亲定，写死）：
// - 1936 年 1 月开局，1 回合 = 1 个月
// - 不设回合上限：maxTurns 恒为 null。禁止在任何胜负/结束逻辑里写回合上限——
//   游戏只因胜负条件达成为止而结束。历史事件按真实日期推进到 1945 年，
//   之后未分胜负就继续打（约 110 回合只是典型局长，不是终点）。

export const TIMELINE = {
  startYear: 1936,
  startMonth: 1, // 1-12
  turnUnit: "month", // 回合粒度：月
  maxTurns: null, // 无回合上限（用户亲定，禁止改成数字）
  historicalEventsEndYear: 1945, // 历史事件脚本推进到的年份，之后为自由战争
} as const;

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

/** 推进一个月（纯函数）：12 月 -> 次年 1 月 */
export function advanceYearMonth(ym: YearMonth): YearMonth {
  return ym.month === 12
    ? { year: ym.year + 1, month: 1 }
    : { year: ym.year, month: ym.month + 1 };
}

/** 两个年月之间的月数差（b - a，可为负） */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** 第 turn 回合（从 1 开始）对应的年月：回合 1 = 开局年月 */
export function yearMonthOfTurn(turn: number): YearMonth {
  const total = (TIMELINE.startMonth - 1) + (turn - 1);
  return {
    year: TIMELINE.startYear + Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}
