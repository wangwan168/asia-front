// A6 海域名（美术交付 sea_labels.json，旧美术帧坐标已换算到游戏帧；帧外标签已剔除）。
export interface SeaLabel { name: string; x: number; y: number; rotate: number }
export const SEA_LABELS: SeaLabel[] = [
  // 帧外剔除：太平洋（换算后 967,396）
  { name: "菲律宾海", x: 674.8, y: 484.0, rotate: -24 },
  { name: "东海", x: 597.3, y: 401.5, rotate: -38 },
  { name: "南海", x: 501.5, y: 555.5, rotate: -52 },
  { name: "黄海", x: 583.6, y: 313.5, rotate: 0 },
  { name: "日本海", x: 697.6, y: 275.0, rotate: -30 },
  // 帧外剔除：鄂霍次克海（换算后 875,132）
  { name: "孟加拉湾", x: 273.5, y: 572.0, rotate: -24 },
  { name: "安达曼海", x: 332.8, y: 605.0, rotate: -55 },
  { name: "爪哇海", x: 465.1, y: 764.5, rotate: 0 },
  { name: "苏禄海", x: 560.8, y: 599.5, rotate: 18 },
  { name: "班达海", x: 629.1, y: 759.0, rotate: 0 },
  // 帧外剔除：阿拉弗拉海（换算后 702,798）
  { name: "泰国湾", x: 387.5, y: 610.5, rotate: 30 },
];
