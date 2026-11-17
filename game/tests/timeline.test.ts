// 时间系统断言（用户 2026-11-16 亲定口径）：1936 年 1 月开局、1 回合 = 1 个月、无回合上限。

import { describe, it, expect } from "vitest";
import {
  TIMELINE,
  advanceYearMonth,
  monthsBetween,
  yearMonthOfTurn,
} from "../src/data/timeline";

describe("TIMELINE 口径", () => {
  it("开局为 1936 年 1 月，回合粒度为月", () => {
    expect(TIMELINE.startYear).toBe(1936);
    expect(TIMELINE.startMonth).toBe(1);
    expect(TIMELINE.turnUnit).toBe("month");
  });

  it("无回合上限：maxTurns 恒为 null，且不存在任何有限回合上限字段", () => {
    expect(TIMELINE.maxTurns).toBeNull();
    for (const [key, value] of Object.entries(TIMELINE)) {
      if (/turn/i.test(key) && key !== "turnUnit") {
        expect(value, `字段 ${key} 不许是有限回合上限`).toBeNull();
      }
    }
  });

  it("历史事件推进到 1945 年（之后自由战争，无终点）", () => {
    expect(TIMELINE.historicalEventsEndYear).toBe(1945);
  });
});

describe("年月推进", () => {
  it("年内推进与跨年", () => {
    expect(advanceYearMonth({ year: 1936, month: 1 })).toEqual({ year: 1936, month: 2 });
    expect(advanceYearMonth({ year: 1936, month: 12 })).toEqual({ year: 1937, month: 1 });
    expect(advanceYearMonth({ year: 1945, month: 12 })).toEqual({ year: 1946, month: 1 });
  });

  it("回合与年月换算：回合 1 = 1936-01，回合 110 约在 1945 年初（典型局长、非上限）", () => {
    expect(yearMonthOfTurn(1)).toEqual({ year: 1936, month: 1 });
    expect(yearMonthOfTurn(13)).toEqual({ year: 1937, month: 1 });
    expect(yearMonthOfTurn(110)).toEqual({ year: 1945, month: 2 });
    // 远超 110 回合仍然有定义（无上限）
    expect(yearMonthOfTurn(1200)).toEqual({ year: 2035, month: 12 });
  });

  it("monthsBetween 与推进自洽", () => {
    expect(monthsBetween({ year: 1936, month: 1 }, { year: 1937, month: 1 })).toBe(12);
    let ym = { year: 1936, month: 1 };
    for (let i = 0; i < 25; i += 1) {
      ym = advanceYearMonth(ym);
    }
    expect(ym).toEqual({ year: 1938, month: 2 });
    expect(monthsBetween({ year: 1936, month: 1 }, ym)).toBe(25);
  });
});
