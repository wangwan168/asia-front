// 地图视图控制冒烟：缩放锚定/钳制/平移/复位（纯函数层）。
import { describe, it, expect } from "vitest";
import { fullView, zoomAt, panBy, clampView, viewHeight, MAP_W, MAP_H, MIN_W } from "../src/ui/mapView";

describe("地图视图控制", () => {
  it("复位=全图", () => {
    const v = fullView();
    expect(v).toEqual({ x: 0, y: 0, w: MAP_W });
    expect(viewHeight(v)).toBeCloseTo(MAP_H);
  });

  it("滚轮放大：以光标点为锚，锚点地图坐标不变", () => {
    const v0 = fullView();
    const fx = 0.62; const fy = 0.3; // 华北一带
    const before = { x: v0.x + fx * v0.w, y: v0.y + fy * viewHeight(v0) };
    const v1 = zoomAt(v0, fx, fy, 2);
    expect(v1.w).toBeCloseTo(v0.w / 2);
    const after = { x: v1.x + fx * v1.w, y: v1.y + fy * viewHeight(v1) };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("缩放上下限：最大 4 倍、最小全图", () => {
    let v = fullView();
    for (let i = 0; i < 10; i += 1) v = zoomAt(v, 0.5, 0.5, 2);
    expect(v.w).toBeCloseTo(MIN_W);
    for (let i = 0; i < 10; i += 1) v = zoomAt(v, 0.5, 0.5, 0.5);
    expect(v.w).toBeCloseTo(MAP_W);
  });

  it("平移钳制：怎么拖都拖不出地图范围", () => {
    const v = zoomAt(fullView(), 0.5, 0.5, 3);
    const far = panBy(v, -99999, -99999);
    expect(far.x).toBe(0);
    expect(far.y).toBe(0);
    const far2 = panBy(v, 99999, 99999);
    expect(far2.x).toBeCloseTo(MAP_W - far2.w);
    expect(far2.y).toBeCloseTo(MAP_H - viewHeight(far2));
    const c = clampView({ x: -50, y: -50, w: MAP_W * 2 });
    expect(c.w).toBeLessThanOrEqual(MAP_W);
    expect(c.x).toBeGreaterThanOrEqual(0);
  });

  it("全图状态下平移无效（无处可拖）", () => {
    const v = panBy(fullView(), 300, 200);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });
});
