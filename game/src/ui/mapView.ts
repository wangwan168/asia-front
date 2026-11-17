// 地图视图状态（纯函数，UI 层专用，不进游戏存档）：viewBox 的 x/y/w。
// viewBox 恒保持地图宽高比（SVG 元素 height:auto 按 viewBox 比例渲染，无变形无黑边）。
// 缩放 1–4 倍，平移钳制在地图范围内（视图永不脱出地图）。

export interface MapView {
  x: number;
  y: number;
  w: number;
}

import { MAP_W as DATA_MAP_W, MAP_H as DATA_MAP_H } from "../data/provinces";
export const MAP_W = DATA_MAP_W;
export const MAP_H = DATA_MAP_H;
export const ASPECT = MAP_H / MAP_W;
export const MIN_W = MAP_W / 4; // 最大 4 倍

export function fullView(): MapView {
  return { x: 0, y: 0, w: MAP_W };
}

export function viewHeight(v: MapView): number {
  return v.w * ASPECT;
}

export function clampView(v: MapView): MapView {
  const w = Math.min(Math.max(v.w, MIN_W), MAP_W);
  const h = w * ASPECT;
  return {
    w,
    x: Math.min(Math.max(v.x, 0), Math.max(MAP_W - w, 0)),
    y: Math.min(Math.max(v.y, 0), Math.max(MAP_H - h, 0)),
  };
}

/**
 * 以视口内某点（fx, fy 为 0–1 比例）为中心缩放 factor 倍（>1 放大）。
 * 缩放后该比例点对应的地图坐标不变（光标锚定）。
 */
export function zoomAt(v: MapView, fx: number, fy: number, factor: number): MapView {
  const mx = v.x + fx * v.w;
  const my = v.y + fy * viewHeight(v);
  const w2 = v.w / factor;
  return clampView({ x: mx - fx * w2, y: my - fy * w2 * ASPECT, w: w2 });
}

/** 按地图坐标增量平移。 */
export function panBy(v: MapView, dx: number, dy: number): MapView {
  return clampView({ x: v.x + dx, y: v.y + dy, w: v.w });
}

export function viewBoxString(v: MapView): string {
  return `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${viewHeight(v).toFixed(1)}`;
}
