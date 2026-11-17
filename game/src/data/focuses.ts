// 国策简表（M1）：大国 5 个、其余 3 个。效果结构化，完成即生效（结算层执行）。
// 国策按顺序推进（START_FOCUS 选定一个，月结推进，months 到期完成；同时只能进行一个）。

export type FocusEffect =
  | { kind: "addEquipment"; amount: number }
  | { kind: "addManpower"; amount: number }
  | { kind: "addResource"; resource: "oil" | "steel" | "rubber" | "food"; amount: number }
  | { kind: "addFactory"; provinceId: string; factory: "mil" | "civ" }
  | { kind: "stability"; delta: number }
  | { kind: "warSupport"; delta: number }
  | { kind: "relation"; targetId: string; delta: number };

export interface FocusDef {
  id: string;
  factionId: string;
  name: string;
  months: number;
  desc: string;
  effects: FocusEffect[];
}

const F = (
  factionId: string, id: string, name: string, months: number, desc: string, effects: FocusEffect[],
): FocusDef => ({ id: `${factionId}_${id}`, factionId, name, months, desc, effects });

export const FOCUSES: FocusDef[] = [
  // 国民政府
  F("roc", "industry_inland", "工业内迁", 4, "工厂内迁西南，南京军工+1", [{ kind: "addFactory", provinceId: "chongqing", factory: "mil" }, { kind: "stability", delta: 3 }]),
  F("roc", "german_mission", "德国顾问团", 3, "德械装备到货", [{ kind: "addEquipment", amount: 120 }]),
  F("roc", "united_front", "第二次国共合作", 3, "与中共关系改善、战争支持上升", [{ kind: "relation", targetId: "ccp", delta: 30 }, { kind: "warSupport", delta: 8 }]),
  F("roc", "burma_road", "滇缅公路", 4, "打通外援通道，装备与资源入账", [{ kind: "addEquipment", amount: 80 }, { kind: "addResource", resource: "steel", amount: 40 }]),
  F("roc", "youth_army", "青年军动员", 3, "人力动员", [{ kind: "addManpower", amount: 150000 }]),
  // 中共
  F("ccp", "base_expansion", "根据地扩张", 3, "敌后人力与粮食", [{ kind: "addManpower", amount: 60000 }, { kind: "addResource", resource: "food", amount: 80 }]),
  F("ccp", "hundred_regiments_prep", "破袭战准备", 4, "装备缴获与整训", [{ kind: "addEquipment", amount: 50 }, { kind: "warSupport", delta: 6 }]),
  F("ccp", "yanan_rectification", "整风与练兵", 3, "稳定与支持上升", [{ kind: "stability", delta: 6 }, { kind: "warSupport", delta: 5 }]),
  // 日本
  F("japan", "china_incident_prep", "支那事变准备", 4, "战时动员，装备与人力", [{ kind: "addEquipment", amount: 150 }, { kind: "addManpower", amount: 100000 }]),
  F("japan", "southward", "南进论", 4, "海军与登陆准备，石油储备", [{ kind: "addResource", resource: "oil", amount: 80 }, { kind: "warSupport", delta: 6 }]),
  F("japan", "total_mobilization", "国家总动员", 5, "东京军工+1", [{ kind: "addFactory", provinceId: "tokyo", factory: "mil" }]),
  F("japan", "kwantung_expand", "关东军扩充", 3, "满洲驻军装备", [{ kind: "addEquipment", amount: 100 }]),
  F("japan", "steel_embargo_response", "资源统制", 3, "钢铁配给", [{ kind: "addResource", resource: "steel", amount: 60 }]),
  // 苏联
  F("ussr", "far_east_buildup", "远东增兵", 4, "远东装备与人力", [{ kind: "addEquipment", amount: 130 }, { kind: "addManpower", amount: 80000 }]),
  F("ussr", "trans_siberian", "西伯利亚铁路扩能", 4, "伯力军工+1", [{ kind: "addFactory", provinceId: "khabarovsk", factory: "mil" }]),
  F("ussr", "aid_china", "援华空军志愿队", 3, "与国民政府关系改善", [{ kind: "relation", targetId: "roc", delta: 25 }]),
  // 美国
  F("usa", "pacific_fleet", "太平洋舰队扩建", 5, "关岛军工+1", [{ kind: "addFactory", provinceId: "guam", factory: "mil" }]),
  F("usa", "lend_lease_prep", "租借法案准备", 4, "装备储备", [{ kind: "addEquipment", amount: 200 }]),
  F("usa", "embargo", "对日禁运施压", 3, "与日本关系恶化、战争支持上升", [{ kind: "relation", targetId: "japan", delta: -30 }, { kind: "warSupport", delta: 5 }]),
  // 英国
  F("uk", "india_mobilization", "印度动员", 4, "印度人力", [{ kind: "addManpower", amount: 200000 }]),
  F("uk", "singapore_fortress", "新加坡要塞", 4, "新加坡军工+1", [{ kind: "addFactory", provinceId: "singapore", factory: "mil" }]),
  F("uk", "burma_defense", "缅甸防御", 3, "仰光装备", [{ kind: "addEquipment", amount: 70 }]),
  // 其余各家 3 个（精简）
  F("warlords", "self_strengthening", "自强运动", 3, "太原军工维持", [{ kind: "addEquipment", amount: 60 }]),
  F("warlords", "grain_tax", "田赋整顿", 2, "粮食入账", [{ kind: "addResource", resource: "food", amount: 120 }]),
  F("warlords", "neutrality", "严守中立", 3, "稳定上升", [{ kind: "stability", delta: 6 }]),
  F("manchukuo", "industrial_plan", "产业开发五カ年计划", 4, "沈阳军工+1", [{ kind: "addFactory", provinceId: "shenyang", factory: "mil" }]),
  F("manchukuo", "grain_requisition", "粮谷出荷", 2, "粮食入账", [{ kind: "addResource", resource: "food", amount: 100 }]),
  F("manchukuo", "border_guard", "国境守备", 3, "装备补充", [{ kind: "addEquipment", amount: 50 }]),
  F("thailand", "irredentism", "收复失地宣传", 3, "战争支持上升", [{ kind: "warSupport", delta: 8 }]),
  F("thailand", "rubber_exports", "橡胶出口", 2, "换取装备", [{ kind: "addEquipment", amount: 40 }]),
  F("thailand", "bangkok_industry", "曼谷工业", 4, "曼谷民用+1", [{ kind: "addFactory", provinceId: "bangkok", factory: "civ" }]),
  F("netherlands", "oil_fields", "油田扩产", 3, "石油入账", [{ kind: "addResource", resource: "oil", amount: 60 }]),
  F("netherlands", "colonial_army", "殖民军整备", 3, "装备补充", [{ kind: "addEquipment", amount: 40 }]),
  F("netherlands", "fortify_java", "爪哇设防", 3, "稳定上升", [{ kind: "stability", delta: 4 }]),
  F("france", "indochina_rubber", "印支橡胶园", 3, "橡胶入账", [{ kind: "addResource", resource: "rubber", amount: 50 }]),
  F("france", "colonial_troops", "殖民地兵整训", 3, "装备补充", [{ kind: "addEquipment", amount: 40 }]),
  F("france", "haiphong_port", "海防港扩建", 4, "海防民用+1", [{ kind: "addFactory", provinceId: "haiphong", factory: "civ" }]),
  F("mongolia", "soviet_aid", "苏联援助", 3, "装备入账", [{ kind: "addEquipment", amount: 35 }]),
  F("mongolia", "cavalry_modernization", "骑兵现代化", 3, "战争支持上升", [{ kind: "warSupport", delta: 5 }]),
  F("mongolia", "border_posts", "边境哨所", 2, "稳定上升", [{ kind: "stability", delta: 4 }]),
  F("mengjiang", "mongol_autonomy", "蒙古自治宣传", 3, "人力动员", [{ kind: "addManpower", amount: 20000 }]),
  F("mengjiang", "cavalry_herds", "军马征集", 2, "装备补充", [{ kind: "addEquipment", amount: 25 }]),
  F("mengjiang", "japan_alignment", "亲日路线", 3, "与日本关系改善", [{ kind: "relation", targetId: "japan", delta: 25 }]),
  F("wangjingwei", "peace_movement", "和平运动", 3, "战争支持（占领区）", [{ kind: "warSupport", delta: 5 }]),
  F("wangjingwei", "peace_army", "和平建国军整编", 4, "装备补充", [{ kind: "addEquipment", amount: 45 }]),
  F("wangjingwei", "nanjing_admin", "还都行政整顿", 3, "稳定上升", [{ kind: "stability", delta: 5 }]),
  F("vietminh", "vietminh_front", "越盟阵线扩大", 3, "人力动员", [{ kind: "addManpower", amount: 25000 }]),
  F("vietminh", "guerrilla_network", "游击网络", 3, "装备缴获", [{ kind: "addEquipment", amount: 20 }]),
  F("vietminh", "base_areas", "越北根据地", 4, "粮食入账", [{ kind: "addResource", resource: "food", amount: 60 }]),
  F("bna", "independence_promise", "独立承诺动员", 3, "人力动员", [{ kind: "addManpower", amount: 20000 }]),
  F("bna", "jungle_training", "丛林整训", 3, "装备补充", [{ kind: "addEquipment", amount: 20 }]),
  F("bna", "rangoon_admin", "仰光行政接管", 3, "稳定上升", [{ kind: "stability", delta: 4 }]),
  F("ina", "delhi_chalo", "向德里进军", 3, "战争支持上升", [{ kind: "warSupport", delta: 8 }]),
  F("ina", "azad_hind", "自由印度临时政府", 4, "人力动员", [{ kind: "addManpower", amount: 15000 }]),
  F("ina", "japan_liaison", "日军联络整备", 2, "装备补充", [{ kind: "addEquipment", amount: 20 }]),
  F("philippines", "resistance_network", "抵抗网络", 3, "人力动员", [{ kind: "addManpower", amount: 15000 }]),
  F("philippines", "us_liaison", "与美联络", 3, "装备空投", [{ kind: "addEquipment", amount: 18 }]),
  F("philippines", "island_cells", "岛屿游击小组", 3, "粮食入账", [{ kind: "addResource", resource: "food", amount: 50 }]),
];

export const FOCUS_MAP: Record<string, FocusDef> = Object.fromEntries(FOCUSES.map((f) => [f.id, f]));
// 大国补充国策（usa/uk/ussr 各补至 5 个）
FOCUSES.push(
  F("usa", "two_ocean_navy", "两洋海军法案", 5, "舰队扩建，装备入账", [{ kind: "addEquipment", amount: 150 }]),
  F("usa", "arsenal_of_democracy", "民主兵工厂", 4, "战争支持与稳定上升", [{ kind: "warSupport", delta: 8 }, { kind: "stability", delta: 3 }]),
  F("uk", "raf_expansion", "皇家空军扩编", 4, "装备入账", [{ kind: "addEquipment", amount: 90 }]),
  F("uk", "imperial_supply", "帝国补给线", 3, "橡胶与石油入账", [{ kind: "addResource", resource: "rubber", amount: 40 }, { kind: "addResource", resource: "oil", amount: 40 }]),
  F("ussr", "industrialization", "工业化加速", 4, "伊尔库茨克民用+1", [{ kind: "addFactory", provinceId: "irkutsk", factory: "civ" }]),
  F("ussr", "mongolia_guarantee", "保障蒙古", 3, "与蒙古关系改善", [{ kind: "relation", targetId: "mongolia", delta: 20 }]),
);
