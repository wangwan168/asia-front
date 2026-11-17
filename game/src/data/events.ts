// 历史事件表（M1）：1936-1945 按年月触发，效果全部结构化（关系/宣战/领土/资源/激活势力等）。
// 1945 年后无新事件，战争按胜负条件继续。事件触发在 END_TURN 结算链最前面执行（core/events 解释器）。

export type EventEffect =
  | { kind: "declareWar"; a: string; b: string }
  | { kind: "endWar"; a: string; b: string } // 停战（移出交战表）
  | { kind: "relation"; a: string; b: string; delta: number }
  | { kind: "transfer"; provinceId: string; to: string }
  | { kind: "activate"; factionId: string } // 激活事件生成势力（按其 initialDivisions 落子）
  | { kind: "addEquipment"; factionId: string; amount: number }
  | { kind: "addResource"; factionId: string; resource: "oil" | "steel" | "rubber" | "food"; amount: number }
  | { kind: "stability"; factionId: string; delta: number }
  | { kind: "warSupport"; factionId: string; delta: number }
  | { kind: "alliance"; a: string; b: string }
  | { kind: "damageAt"; factionId: string; provinceId: string; ratio: number }; // 该省驻军按比例减员

/** 事件条件口径（用户 02:09 史实定版第 5 条）：玩家已改动历史时相关事件可被跳过。
 *  条件不满足时事件标记为已触发但不生效，纪事记一笔「史实分岔」。 */
export interface EventCondition {
  notAtWar?: [string, string]; // 两国尚未交战才发生（如七七、太平洋战争的宣战部分）
  atWar?: [string, string]; // 两国交战中才发生
  ownerIs?: { provinceId: string; ownerId: string }; // 某省仍属某势力才发生（如印支进驻须仍为法国属地）
}

export interface HistoricalEvent {
  id: string;
  year: number;
  month: number;
  title: string;
  text: string;
  condition?: EventCondition;
  effects: EventEffect[];
}

export const EVENTS: HistoricalEvent[] = [
  {
    id: "xian_incident", year: 1936, month: 12, title: "西安事变",
    text: "张学良、杨虎城兵谏，抗日民族统一战线形成，国共走向第二次合作。",
    effects: [
      { kind: "relation", a: "roc", b: "ccp", delta: 40 },
      { kind: "endWar", a: "roc", b: "ccp" },
      { kind: "warSupport", factionId: "roc", delta: 5 },
      { kind: "warSupport", factionId: "ccp", delta: 5 },
    ],
  },
  {
    id: "marco_polo", year: 1937, month: 7, title: "七七事变",
    text: "卢沟桥事变，日本发动全面侵华战争；国共合作抗日，八路军、新四军改编参战。",
    condition: { notAtWar: ["japan", "roc"] },
    effects: [
      { kind: "declareWar", a: "japan", b: "roc" },
      { kind: "declareWar", a: "japan", b: "ccp" },
      { kind: "declareWar", a: "japan", b: "warlords" },
      { kind: "alliance", a: "roc", b: "ccp" },
      { kind: "warSupport", factionId: "roc", delta: 15 },
      { kind: "warSupport", factionId: "ccp", delta: 15 },
    ],
  },
  {
    id: "shanghai_nanjing", year: 1937, month: 11, title: "淞沪与南京",
    text: "淞沪会战结束、南京告急，国民政府西迁重庆，中国军民伤亡惨重但抵抗意志未灭。",
    effects: [
      { kind: "stability", factionId: "roc", delta: -6 },
      { kind: "warSupport", factionId: "roc", delta: 10 },
      { kind: "addEquipment", factionId: "japan", amount: -40 },
    ],
  },
  {
    id: "wuhan_battle", year: 1938, month: 10, title: "武汉会战",
    text: "武汉会战结束，抗战转入相持阶段，日军速战速决战略破产。",
    effects: [
      { kind: "warSupport", factionId: "roc", delta: 6 },
      { kind: "stability", factionId: "japan", delta: -3 },
    ],
  },
  {
    id: "nomonhan", year: 1939, month: 9, title: "诺门罕战役",
    text: "关东军在诺门罕惨败于苏军，日本北进论受挫，转而南进。",
    effects: [
      { kind: "damageAt", factionId: "japan", provinceId: "shenyang", ratio: 0.25 },
      { kind: "relation", a: "japan", b: "ussr", delta: -25 },
      { kind: "warSupport", factionId: "ussr", delta: 5 },
    ],
  },
  {
    id: "mengjiang_formal", year: 1939, month: 9, title: "蒙疆联合自治政府成立",
    text: "蒙疆政权正式成立（察哈尔/绥远蒙古自治政权合并），与日本结盟。",
    effects: [
      { kind: "activate", factionId: "mengjiang" },
      { kind: "alliance", a: "mengjiang", b: "japan" },
      { kind: "relation", a: "mengjiang", b: "japan", delta: 30 },
    ],
  },
  {
    id: "wangjingwei_regime", year: 1940, month: 3, title: "汪伪还都南京",
    text: "汪精卫在南京成立伪国民政府（若南京等地已被日军占领，则在此基础上组建；否则以流亡政权形态活动）。",
    effects: [{ kind: "activate", factionId: "wangjingwei" }],
  },
  {
    id: "indochina_north", year: 1940, month: 9, title: "日军进驻法属印支北部",
    text: "维希法国妥协，日军进驻河内、海防，切断滇越外援线。",
    condition: { ownerIs: { provinceId: "haiphong", ownerId: "france" } },
    effects: [
      { kind: "transfer", provinceId: "haiphong", to: "japan" },
      { kind: "relation", a: "japan", b: "france", delta: -15 },
      { kind: "addResource", factionId: "japan", resource: "rubber", amount: 30 },
    ],
  },
  {
    id: "soviet_japan_pact", year: 1941, month: 4, title: "苏日中立条约",
    text: "苏日签订中立条约，苏联稳住远东，日本放手南进。",
    effects: [
      { kind: "relation", a: "ussr", b: "japan", delta: 35 },
      { kind: "endWar", a: "ussr", b: "japan" },
    ],
  },
  {
    id: "vietminh_founded", year: 1941, month: 5, title: "越盟成立",
    text: "越南独立同盟会在越北成立，胡志明领导的游击力量登上舞台。",
    effects: [{ kind: "activate", factionId: "vietminh" }],
  },
  {
    id: "indochina_south", year: 1941, month: 7, title: "日军进驻印支南部",
    text: "日军进驻西贡，矛头直指马来亚与东印度，美英荷冻结日本资产、石油禁运。",
    condition: { ownerIs: { provinceId: "saigon", ownerId: "france" } },
    effects: [
      { kind: "transfer", provinceId: "saigon", to: "japan" },
      { kind: "relation", a: "japan", b: "usa", delta: -40 },
      { kind: "relation", a: "japan", b: "uk", delta: -30 },
      { kind: "relation", a: "japan", b: "netherlands", delta: -30 },
    ],
  },
  {
    id: "pacific_war", year: 1941, month: 12, title: "太平洋战争爆发",
    text: "日本偷袭珍珠港并南下东南亚，美国、英国、荷兰对日宣战，亚洲战场全面扩大。",
    condition: { notAtWar: ["japan", "usa"] },
    effects: [
      { kind: "declareWar", a: "japan", b: "usa" },
      { kind: "declareWar", a: "japan", b: "uk" },
      { kind: "declareWar", a: "japan", b: "netherlands" },
      { kind: "declareWar", a: "japan", b: "philippines" },
      { kind: "warSupport", factionId: "usa", delta: 25 },
      { kind: "warSupport", factionId: "japan", delta: 10 },
    ],
  },
  {
    id: "us_mobilization", year: 1942, month: 1, title: "美国战争动员",
    text: "美国本土工业全面转向军工，跨太平洋补给线全速运转（美国本土产能以海外支援口径入账）。",
    effects: [
      { kind: "addEquipment", factionId: "usa", amount: 250 },
      { kind: "addResource", factionId: "usa", resource: "steel", amount: 100 },
      { kind: "warSupport", factionId: "usa", delta: 10 },
    ],
  },
  {
    id: "bna_rising", year: 1942, month: 3, title: "缅甸国民军起事",
    text: "日军入缅，昂山率缅甸国民军配合日军驱逐英军（缅甸省份在日军手中时正式成军）。",
    effects: [{ kind: "activate", factionId: "bna" }],
  },
  {
    id: "burma_campaign", year: 1942, month: 5, title: "缅甸战役与远征军",
    text: "缅甸全境鏖战，中国远征军入缅作战，滇缅公路被切断。",
    effects: [
      { kind: "warSupport", factionId: "uk", delta: 5 },
      { kind: "addEquipment", factionId: "roc", amount: 40 },
    ],
  },
  {
    id: "ina_proclaimed", year: 1943, month: 10, title: "印度国民军与自由印度",
    text: "鲍斯在新加坡成立自由印度临时政府，印度国民军誓师向德里进军。",
    effects: [{ kind: "activate", factionId: "ina" }],
  },
  {
    id: "ichigo", year: 1944, month: 4, title: "一号作战",
    text: "日军发动一号作战打通大陆交通线，豫湘桂震动，国军损失惨重。",
    effects: [
      { kind: "addEquipment", factionId: "japan", amount: 120 },
      { kind: "stability", factionId: "roc", delta: -5 },
      { kind: "damageAt", factionId: "roc", provinceId: "hengyang", ratio: 0.3 },
    ],
  },
  {
    id: "soviet_entry", year: 1945, month: 8, title: "苏联对日参战",
    text: "苏联废除中立条约、百万红军进入满洲，关东军防线崩解。",
    condition: { notAtWar: ["ussr", "japan"] },
    effects: [
      { kind: "declareWar", a: "ussr", b: "japan" },
      { kind: "declareWar", a: "ussr", b: "manchukuo" },
      { kind: "declareWar", a: "ussr", b: "mengjiang" },
      { kind: "warSupport", factionId: "ussr", delta: 10 },
    ],
  },
  {
    id: "august_storm_aftermath", year: 1945, month: 9, title: "终战与受降",
    text: "日本宣布接受波茨坦公告——但在本局中，战争是否结束只看胜负条件：未达条件者，战斗继续。",
    effects: [
      { kind: "stability", factionId: "japan", delta: -10 },
      { kind: "warSupport", factionId: "japan", delta: -15 },
    ],
  },
];

export const EVENT_MAP: Record<string, HistoricalEvent> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
);
