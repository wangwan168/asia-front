// 界面配置脚手架（《亚洲战场》）：只定界面结构与占位文字，不含任何游戏数值。
// 国家/省份/师模板/工业/科技/国策等数据包由后续阶段录入 src/data，本文件届时只改文字口径。

export const GAME_TITLE = "亚洲战场";

export interface ResourceDef {
  id: "industry" | "manpower" | "resources" | "supply" | "troops" | "stability";
  label: string;
  icon: string; // 界面小图标占位符（正式素材到位后换图片路径）
}

// 顶栏资源位（数值口径待数据包定版，此处仅占位结构）
export const RESOURCES: ResourceDef[] = [
  { id: "industry", label: "工业", icon: "工" },
  { id: "manpower", label: "人力", icon: "人" },
  { id: "resources", label: "资源", icon: "资" },
  { id: "supply", label: "补给", icon: "给" },
  { id: "troops", label: "兵力", icon: "兵" },
  { id: "stability", label: "稳定", icon: "稳" },
];

export type PanelContentId =
  | "city"
  | "commanders"
  | "strategy"
  | "expedition"
  | "diplomacy"
  | "records";

export interface NavItem {
  id: "map" | "city" | "commanders" | "strategy" | "expedition" | "diplomacy" | "records";
  label: string;
  icon: string;
  panel: "left" | "right" | null; // null = 不打开面板（“地图”回到全图）
  content: PanelContentId | null;
}

// 底部导航是唯一的面板入口（顶栏不放重复按钮）
export const NAV_ITEMS: NavItem[] = [
  { id: "map", label: "地图", icon: "图", panel: null, content: null },
  { id: "city", label: "省份", icon: "省", panel: "left", content: "city" },
  { id: "commanders", label: "将领", icon: "将", panel: "right", content: "commanders" },
  { id: "strategy", label: "国策", icon: "策", panel: "right", content: "strategy" },
  { id: "expedition", label: "部队", icon: "军", panel: "right", content: "expedition" },
  { id: "diplomacy", label: "外交", icon: "交", panel: "right", content: "diplomacy" },
  { id: "records", label: "纪事", icon: "纪", panel: "left", content: "records" },
];

// 省份面板字段（占位，数据包定版后对齐）
export const CITY_PANEL_FIELDS: string[] = [
  "省份",
  "地形",
  "基础设施",
  "防空/要塞",
  "驻军",
  "控制方",
];

export interface NamedDesc {
  label: string;
  desc: string;
}

// 将领面板：将领/指挥官名册结构占位
export const COMMANDER_ATTRIBUTES: string[] = [
  "指挥",
  "进攻",
  "防御",
  "后勤",
  "忠诚",
  "军衔",
  "所属部队",
];

export const COMMANDER_ROLES: NamedDesc[] = [
  { label: "陆军将领", desc: "指挥师级及以上部队" },
  { label: "海军将领", desc: "指挥舰队（海军系统接入后）" },
  { label: "空军将领", desc: "指挥航空队（空军系统接入后）" },
];

export const COMMANDERS_EMPTY_NOTE = "名册暂无数据 — 将领数据随数据包录入后，这里按人显示属性与所属部队";

// 国策面板：内政/国策两组占位（具体国策树待数据包）
export const STRATEGY_SECTIONS: { title: string; items: NamedDesc[] }[] = [
  {
    title: "内政",
    items: [
      { label: "工业建设", desc: "兴建工厂与基础设施（口径待数据包）" },
      { label: "征兵动员", desc: "补充人力与预备役（口径待数据包）" },
      { label: "后勤补给", desc: "改善补给线与仓储（口径待数据包）" },
    ],
  },
  {
    title: "国策",
    items: [{ label: "国策树", desc: "各国国策树随数据包录入后在此推进" }],
  },
];

// 部队面板：师级编制占位（兵力按实际人数计，一个步兵师约万人量级，模板待数据包）
export const TROOP_LIST_ITEMS: NamedDesc[] = [
  { label: "步兵师", desc: "师级编制，实际人数计" },
  { label: "装甲师", desc: "师级编制，实际人数计" },
  { label: "炮兵", desc: "支援火力" },
  { label: "海军陆战队", desc: "两栖作战" },
  { label: "航空队", desc: "空军系统接入后显示" },
  { label: "舰队", desc: "海军系统接入后显示" },
];

export const EXPEDITION_NOTE = "数量是当前选中省份/部队的现有兵力（实际人数）；部队调动与作战在玩法阶段接入";

// 外交面板：按钮外交为完整外交；AI 领袖对话只是多一种谈判方式（无 Key 时隐藏入口，其余照常）
export const DIPLOMACY_ACTIONS: NamedDesc[] = [
  { label: "改善关系", desc: "提升与目标国关系" },
  { label: "贸易协定", desc: "资源与工业品交换（口径待数据包）" },
  { label: "军事同盟", desc: "加入/组建阵营同盟" },
  { label: "互不侵犯", desc: "签订条约，绑定短期和平" },
  { label: "扶持傀儡", desc: "对傀儡国的操作（口径待数据包）" },
  { label: "议和", desc: "结束交战状态" },
  { label: "宣战", desc: "进入交战状态，关系归零" },
];

export const DIPLOMACY_EMPTY_NOTE = "国家名册暂无数据 — 势力数据包录入后，这里按国显示关系值与阵营";

// 纪事面板：回合日志 + 存档位
export const RECORDS_SECTIONS: { title: string; items: NamedDesc[] }[] = [
  {
    title: "纪事（回合日志）",
    items: [{ label: "暂无记录", desc: "开局后，每月的战报与大事会按时间记在这里" }],
  },
  {
    title: "存档",
    items: [
      { label: "自动存档", desc: "每回合自动保存一次" },
      { label: "存档位 1", desc: "手动存档" },
      { label: "存档位 2", desc: "手动存档" },
      { label: "存档位 3", desc: "手动存档" },
    ],
  },
];

// 界面布局尺寸（单位 px）——改尺寸只改这一处
export const LAYOUT = {
  topBarHeight: 44,
  bottomBarHeight: 54,
  panelWidth: 264,
  panelRailWidth: 0,
} as const;

// 配色占位（画风定版后替换）
export const COLORS = {
  bgDeep: "#14161a",
  bgPanel: "#1f232a",
  paper: "#e8e4da",
  paperDim: "#cfc9ba",
  red: "#8c2f26",
  redBright: "#b0402f",
  gold: "#c9a24b",
  goldBright: "#e6c878",
  divider: "#4a4f58",
} as const;
