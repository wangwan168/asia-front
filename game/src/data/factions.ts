// 势力数据（M1）：18 家，1936 年 1 月口径。领导人用史实人物；性格参数 + 人设卡同源
// （规则 AI 读 aiPersonality、LLM 对话读 leader 卡，保证「说的和做的」一致）。
//
// 胜利口径（用户 2026-11-16 02:10 亲定，覆盖夜班默认）：所有势力统一胜利定义——
// 控制 >=70% 省份，或其余势力全灭/全附庸；失去全部省份为败。不设分国家专属胜利目标。
// 每家只标 difficulty（简单/普通/困难/地狱 + 一句话理由），仅选国界面展示、不改任何数值。
// 强度按史实分档（大国工业/人力大、小国小），靠统一胜利定义 + AI 性格差异保可玩。
//
// wangjingwei / vietminh / bna / ina 为事件生成或游击势力：startsActive=false，
// 由 events.ts 的历史事件激活；若玩家开局选了它们，建局时按 spawn 口径提前激活（what-if）。

export type BlocId = "axis" | "allies" | "comintern" | "neutral";

export type FactionId =
  | "roc" | "ccp" | "warlords" | "japan" | "manchukuo" | "wangjingwei"
  | "mengjiang" | "thailand" | "usa" | "uk" | "netherlands" | "france"
  | "ussr" | "mongolia" | "vietminh" | "bna" | "ina" | "philippines";

export interface LeaderCard {
  name: string;
  personality: string; // 性格
  ambition: string; // 野心/目标倾向（影响 AI 与对话底线，不改统一胜利定义）
  speakingStyle: string; // 说话风格（LLM 对话用）
  redLine: string; // 红线（谈判不可让步项）
}

export interface AiPersonality {
  aggression: number; // 侵略 0-1
  expansion: number; // 扩张 0-1
  industry: number; // 工业倾向 0-1（建厂/生产积极性）
  caution: number; // 谨慎 0-1（劣势时收缩/求和倾向）
}

export interface Stockpile {
  equipment: number; // 装备点
  manpower: number; // 人力池（人）
  oil: number;
  steel: number;
  rubber: number;
  food: number;
}

export interface InitialDivision {
  templateId: string;
  provinceId: string;
  strength?: number; // 缺省满编
}

export interface InitialSupport {
  kind: "fighter" | "bomber" | "fleet";
  provinceId: string;
}

export type DifficultyLevel = "simple" | "normal" | "hard" | "hell";

export interface FactionDef {
  id: FactionId;
  name: string;
  capitalProvinceId: string;
  colorHex: string;
  flagAsset: string;
  leaderAsset: string | null; // 国旗素材占位（美术线按二战当时现行国旗出图，代码侧不自绘）
  bloc: BlocId;
  leader: LeaderCard;
  aiPersonality: AiPersonality;
  specialty: string; // 特色方向（一句话）
  difficulty: { level: DifficultyLevel; reason: string }; // 仅展示
  startsActive: boolean;
  spawn: { year: number; month: number; note: string } | null; // 事件生成口径
  initialStockpile: Stockpile;
  initialDivisions: InitialDivision[];
  initialSupports: InitialSupport[];
}

const D = (
  templateId: string,
  provinceId: string,
  strength?: number,
): InitialDivision => ({ templateId, provinceId, strength });

export const FACTIONS: Record<FactionId, FactionDef> = {
  roc: {
    id: "roc", name: "中华民国国民政府", capitalProvinceId: "nanjing", colorHex: "#3f6fb5",
    flagAsset: "assets/flags/roc.png", leaderAsset: "assets/leaders/roc.jpg",
    bloc: "neutral",
    leader: { name: "蒋介石", personality: "强势集权、隐忍务实", ambition: "先安内后攘外，完成国家统一与现代化", speakingStyle: "文言与训话体，喜引孙中山遗教", redLine: "不承认伪政权、不割让主权" },
    aiPersonality: { aggression: 0.45, expansion: 0.5, industry: 0.6, caution: 0.55 },
    specialty: "人力雄厚、德械师为精锐核心，工业薄弱需外援",
    difficulty: { level: "normal", reason: "地大人力足但工业弱、内有分裂，开局即面临强敌" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 260, manpower: 900000, oil: 20, steel: 60, rubber: 5, food: 900 },
    initialDivisions: [
      D("germanTrained", "nanjing"), D("germanTrained", "shanghai"), D("infantry", "wuhan"),
      D("infantry", "zhengzhou"), D("infantry", "xuzhou"), D("infantry", "beiping"),
      D("infantry", "jinan"), D("infantry", "changsha"), D("infantry", "nanchang"),
      D("garrison", "guangzhou"), D("garrison", "fuzhou"), D("cavalry", "shijiazhuang"),
    ],
    initialSupports: [{ kind: "fighter", provinceId: "nanjing" }],
  },
  ccp: {
    id: "ccp", name: "中国共产党（八路军/新四军）", capitalProvinceId: "yanan", colorHex: "#b03a2e",
    flagAsset: "assets/flags/ccp.png", leaderAsset: "assets/leaders/ccp.jpg",
    bloc: "comintern",
    leader: { name: "毛泽东", personality: "耐心、善用矛盾、持久战思维", ambition: "在抗战中壮大根据地，最终夺取全国政权", speakingStyle: "辩证、爱用比喻与农村语言", redLine: "不交出军队与根据地政权" },
    aiPersonality: { aggression: 0.35, expansion: 0.75, industry: 0.3, caution: 0.8 },
    specialty: "游击战与根据地扩张，敌后渗透强、正规战弱",
    difficulty: { level: "hard", reason: "开局只有延安一隅、装备极差，靠游击与扩张滚雪球" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 60, manpower: 120000, oil: 0, steel: 5, rubber: 0, food: 200 },
    initialDivisions: [
      D("eighthRoute", "yanan"), D("guerrilla", "taiyuan", 2400), D("guerrilla", "shijiazhuang", 2000),
    ],
    initialSupports: [],
  },
  warlords: {
    id: "warlords", name: "地方军阀（合一）", capitalProvinceId: "taiyuan", colorHex: "#8a7d3b",
    flagAsset: "assets/flags/warlords.png", leaderAsset: "assets/leaders/warlords.jpg",
    bloc: "neutral",
    leader: { name: "阎锡山等地方实力派", personality: "保守自保、善于骑墙", ambition: "保住地盘与军队，在中央与日本之间周旋", speakingStyle: "乡土、精打细算、爱讲三个鸡蛋上跳舞", redLine: "不交出地盘与兵权" },
    aiPersonality: { aggression: 0.25, expansion: 0.3, industry: 0.45, caution: 0.85 },
    specialty: "地盘分散、兵多但杂，以守成为主",
    difficulty: { level: "hard", reason: "地盘大但四分五裂、工业零散，谁都想吞你" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 150, manpower: 500000, oil: 5, steel: 25, rubber: 0, food: 600 },
    initialDivisions: [
      D("infantry", "taiyuan"), D("infantry", "xian"), D("infantry", "chengdu"),
      D("infantry", "nanning"), D("infantry", "kunming"), D("cavalry", "lanzhou"),
      D("garrison", "urumqi"), D("garrison", "chengdu"),
    ],
    initialSupports: [],
  },
  japan: {
    id: "japan", name: "大日本帝国", capitalProvinceId: "tokyo", colorHex: "#7a1f1f",
    flagAsset: "assets/flags/japan.png", leaderAsset: "assets/leaders/japan.jpg",
    bloc: "axis",
    leader: { name: "裕仁天皇（内阁：广田弘毅）", personality: "军部强势、扩张冲动、对华蔑视", ambition: "建立大东亚共荣圈，夺取资源与霸权", speakingStyle: "军国主义辞令，强调国体与圣战", redLine: "不放弃满洲与在华权益" },
    aiPersonality: { aggression: 0.9, expansion: 0.9, industry: 0.75, caution: 0.2 },
    specialty: "工业与海空军亚洲最强，关东军精锐，资源依赖进口",
    difficulty: { level: "simple", reason: "开局实力碾压亚洲诸国，难在战线过长与资源" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 700, manpower: 600000, oil: 120, steel: 220, rubber: 40, food: 700 },
    initialDivisions: [
      D("kwantung", "shenyang"), D("kwantung", "changchun"), D("infantry_jp", "dalian"),
      D("infantry_jp", "seoul"), D("infantry_jp", "taipei"), D("marine_jp", "shanghai", 6000),
      D("infantry_jp", "tokyo"), D("infantry_jp", "osaka"), D("garrison", "pusan"),
    ],
    initialSupports: [
      { kind: "fleet", provinceId: "tokyo" }, { kind: "fleet", provinceId: "nagasaki" },
      { kind: "fighter", provinceId: "tokyo" }, { kind: "bomber", provinceId: "osaka" },
      { kind: "fighter", provinceId: "shenyang" },
    ],
  },
  manchukuo: {
    id: "manchukuo", name: "满洲国", capitalProvinceId: "changchun", colorHex: "#6e4f8f",
    flagAsset: "assets/flags/manchukuo.png", leaderAsset: "assets/leaders/manchukuo.jpg",
    bloc: "axis",
    leader: { name: "溥仪", personality: "傀儡皇帝、谨慎依附", ambition: "保住皇位，借日本之力维持满洲国", speakingStyle: "宫廷辞令、含蓄", redLine: "不忤逆关东军" },
    aiPersonality: { aggression: 0.3, expansion: 0.25, industry: 0.55, caution: 0.7 },
    specialty: "东北工业与资源，军事依附日本",
    difficulty: { level: "hell", reason: "工业不弱但主权在人，强敌环伺（苏/蒙/中共）" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 180, manpower: 250000, oil: 15, steel: 90, rubber: 0, food: 500 },
    initialDivisions: [
      D("infantry", "changchun"), D("infantry", "harbin"), D("cavalry", "shenyang"), D("garrison", "harbin"),
    ],
    initialSupports: [],
  },
  wangjingwei: {
    id: "wangjingwei", name: "汪伪国民政府", capitalProvinceId: "nanjing", colorHex: "#5b6e46",
    flagAsset: "assets/flags/wangjingwei.png", leaderAsset: "assets/leaders/wangjingwei.jpg",
    bloc: "axis",
    leader: { name: "汪精卫", personality: "理想主义破灭、曲线救国自辩", ambition: "以和平运动自立政权，与重庆分庭抗礼", speakingStyle: "文人政客体，引孙中山和平遗训", redLine: "不解散和平建国军" },
    aiPersonality: { aggression: 0.3, expansion: 0.4, industry: 0.4, caution: 0.6 },
    specialty: "事件生成势力（1940 还都南京），占领区维持与和平军",
    difficulty: { level: "hard", reason: "傀儡开局、四面楚歌，存续全看日军战局" },
    startsActive: false, spawn: { year: 1940, month: 3, note: "汪伪还都南京事件生成（或玩家选国时提前激活）" },
    initialStockpile: { equipment: 80, manpower: 150000, oil: 0, steel: 10, rubber: 0, food: 300 },
    initialDivisions: [D("garrison", "nanjing"), D("infantry", "shanghai"), D("garrison", "hangzhou")],
    initialSupports: [],
  },
  mengjiang: {
    id: "mengjiang", name: "蒙疆联合自治政府", capitalProvinceId: "hohhot", colorHex: "#7d6a4f",
    flagAsset: "assets/flags/mengjiang.png", leaderAsset: "assets/leaders/mengjiang.jpg",
    bloc: "axis",
    leader: { name: "德穆楚克栋鲁普（德王）", personality: "蒙古民族主义、借日自立", ambition: "蒙古独立建国，脱离中国统治", speakingStyle: "直率、强调蒙古民族自决", redLine: "不接受汉人政权统治蒙古" },
    aiPersonality: { aggression: 0.4, expansion: 0.5, industry: 0.2, caution: 0.6 },
    specialty: "骑兵机动，草原地带强、工业几乎为零",
    difficulty: { level: "hard", reason: "人少地贫、全靠骑兵与日本扶持" },
    startsActive: false, spawn: { year: 1939, month: 9, note: "蒙疆联合自治政府成立事件生成（或玩家选国时提前激活）" },
    initialStockpile: { equipment: 50, manpower: 60000, oil: 0, steel: 3, rubber: 0, food: 150 },
    initialDivisions: [D("cavalry", "hohhot"), D("cavalry", "zhangjiakou")],
    initialSupports: [],
  },
  thailand: {
    id: "thailand", name: "泰国", capitalProvinceId: "bangkok", colorHex: "#2e6e6a",
    flagAsset: "assets/flags/thailand.png", leaderAsset: "assets/leaders/thailand.jpg",
    bloc: "neutral",
    leader: { name: "帕霍尔（后銮披汶）", personality: "灵活骑墙、民族主义", ambition: "在大国夹缝中保独立并收复失地", speakingStyle: "务实、强调泰国人至上", redLine: "不做任何一方的殖民地" },
    aiPersonality: { aggression: 0.35, expansion: 0.45, industry: 0.35, caution: 0.75 },
    specialty: "东南亚骑墙者，丛林地形适应",
    difficulty: { level: "hard", reason: "体量小、四周皆强邻，靠站队与地形求生" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 90, manpower: 150000, oil: 5, steel: 12, rubber: 30, food: 400 },
    initialDivisions: [D("infantry", "bangkok"), D("infantry", "chiangmai"), D("garrison", "bangkok")],
    initialSupports: [{ kind: "fighter", provinceId: "bangkok" }],
  },
  usa: {
    id: "usa", name: "美国", capitalProvinceId: "guam", colorHex: "#2e4a7a",
    flagAsset: "assets/flags/usa.png", leaderAsset: "assets/leaders/usa.jpg",
    bloc: "allies",
    leader: { name: "富兰克林·罗斯福", personality: "自信、善用工业与舆论", ambition: "维护太平洋秩序，战时总动员碾压对手", speakingStyle: "炉边谈话式，亲切而坚定", redLine: "不容忍对美属领土的攻击" },
    aiPersonality: { aggression: 0.5, expansion: 0.55, industry: 1.0, caution: 0.4 },
    specialty: "工业潜力无上限（离岛据点开局），海空军顶级；本土产能以海外支援口径体现（见 1942 年战争动员事件）",
    difficulty: { level: "simple", reason: "工业怪兽，1936 亚洲据点少但没人能打到本土" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 500, manpower: 400000, oil: 300, steel: 300, rubber: 60, food: 800 },
    initialDivisions: [D("marine_us", "guam"), D("garrison", "guam"), D("garrison", "manila")],
    initialSupports: [
      { kind: "fleet", provinceId: "guam" }, { kind: "fleet", provinceId: "manila" },
      { kind: "fighter", provinceId: "guam" },
    ],
  },
  uk: {
    id: "uk", name: "英国", capitalProvinceId: "calcutta", colorHex: "#4a5d23",
    flagAsset: "assets/flags/uk.png", leaderAsset: "assets/leaders/uk.jpg",
    bloc: "allies",
    leader: { name: "斯坦利·鲍德温", personality: "绥靖、保守、殖民地优先", ambition: "保住印度与东南亚殖民帝国", speakingStyle: "议会绅士体，含蓄强硬", redLine: "印度不容有失" },
    aiPersonality: { aggression: 0.35, expansion: 0.3, industry: 0.7, caution: 0.65 },
    specialty: "殖民地纵深与海军，陆军靠印度兵源",
    difficulty: { level: "normal", reason: "地盘大兵力散，欧洲战事会抽走注意力" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 320, manpower: 500000, oil: 60, steel: 120, rubber: 120, food: 700 },
    initialDivisions: [
      D("gurkha", "calcutta"), D("infantry", "delhi"), D("infantry", "rangoon"),
      D("garrison", "singapore"), D("garrison", "hongkong"), D("garrison", "kualalumpur"),
    ],
    initialSupports: [{ kind: "fleet", provinceId: "singapore" }, { kind: "fighter", provinceId: "calcutta" }],
  },
  netherlands: {
    id: "netherlands", name: "荷兰", capitalProvinceId: "jakarta", colorHex: "#c96a1e",
    flagAsset: "assets/flags/netherlands.png", leaderAsset: "assets/leaders/netherlands.jpg",
    bloc: "allies",
    leader: { name: "亨德里克斯·科莱恩", personality: "保守、中立自保", ambition: "保住东印度殖民地与石油橡胶", speakingStyle: "商人式务实", redLine: "东印度不容侵犯" },
    aiPersonality: { aggression: 0.15, expansion: 0.15, industry: 0.4, caution: 0.85 },
    specialty: "石油与橡胶富饶，军力薄弱",
    difficulty: { level: "hard", reason: "资源招祸、本土兵力几乎为零" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 60, manpower: 80000, oil: 150, steel: 10, rubber: 150, food: 350 },
    initialDivisions: [D("garrison", "jakarta"), D("garrison", "medan"), D("garrison", "balikpapan")],
    initialSupports: [{ kind: "fleet", provinceId: "jakarta" }],
  },
  france: {
    id: "france", name: "法国（法属印支）", capitalProvinceId: "hanoi", colorHex: "#5a6e9e",
    flagAsset: "assets/flags/france.png", leaderAsset: "assets/leaders/france.jpg",
    bloc: "allies",
    leader: { name: "莱昂·布鲁姆", personality: "左翼理想主义、本土优先", ambition: "保住印度支那殖民地", speakingStyle: "共和派演说体", redLine: "印支主权不容谈判" },
    aiPersonality: { aggression: 0.2, expansion: 0.2, industry: 0.45, caution: 0.8 },
    specialty: "印支橡胶与港口，本土陷落后成飞地",
    difficulty: { level: "hard", reason: "兵力单薄、四面受压，本土自顾不暇" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 110, manpower: 120000, oil: 5, steel: 20, rubber: 80, food: 450 },
    initialDivisions: [D("infantry", "hanoi"), D("garrison", "saigon"), D("garrison", "haiphong")],
    initialSupports: [],
  },
  ussr: {
    id: "ussr", name: "苏联", capitalProvinceId: "vladivostok", colorHex: "#8f1d1d",
    flagAsset: "assets/flags/ussr.png", leaderAsset: "assets/leaders/ussr.jpg",
    bloc: "comintern",
    leader: { name: "约瑟夫·斯大林", personality: "多疑、铁腕、战略耐心", ambition: "保住远东并在时机成熟时南下取利", speakingStyle: "简短命令式，喜用钢铁比喻", redLine: "远东领土与外蒙不容侵犯" },
    aiPersonality: { aggression: 0.55, expansion: 0.6, industry: 0.85, caution: 0.5 },
    specialty: "远东重兵集团与装甲力量，工业动员强",
    difficulty: { level: "simple", reason: "远东军力雄厚，主要看欧洲方向脸色" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 600, manpower: 800000, oil: 150, steel: 260, rubber: 10, food: 800 },
    initialDivisions: [
      D("farEast", "vladivostok"), D("farEast", "khabarovsk"), D("armor", "chita"),
      D("infantry", "irkutsk"), D("cavalry", "ulaanbaatar", 5000), D("garrison", "sakhalin"),
    ],
    initialSupports: [{ kind: "fighter", provinceId: "vladivostok" }, { kind: "fleet", provinceId: "vladivostok" }],
  },
  mongolia: {
    id: "mongolia", name: "蒙古人民共和国", capitalProvinceId: "ulaanbaatar", colorHex: "#9e3b2e",
    flagAsset: "assets/flags/mongolia.png", leaderAsset: "assets/leaders/mongolia.jpg",
    bloc: "comintern",
    leader: { name: "霍尔洛·乔巴山", personality: "强硬亲苏", ambition: "在苏联保护下保住独立，防日本与蒙疆", speakingStyle: "简洁、强调苏蒙友谊", redLine: "不脱离苏联阵营" },
    aiPersonality: { aggression: 0.35, expansion: 0.3, industry: 0.15, caution: 0.6 },
    specialty: "骑兵与草原，依附苏联",
    difficulty: { level: "hell", reason: "人口极少、全靠苏援与草原纵深" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 40, manpower: 40000, oil: 0, steel: 2, rubber: 0, food: 120 },
    initialDivisions: [D("cavalry", "ulaanbaatar"), D("garrison", "ulaanbaatar")],
    initialSupports: [],
  },
  vietminh: {
    id: "vietminh", name: "越盟", capitalProvinceId: "hanoi", colorHex: "#a83232",
    flagAsset: "assets/flags/vietminh.png", leaderAsset: "assets/leaders/vietminh.jpg",
    bloc: "neutral",
    leader: { name: "胡志明", personality: "坚韧、善于统一战线", ambition: "越南民族独立，赶走法国与日本", speakingStyle: "朴素有力，爱引民族历史", redLine: "不接受殖民统治复辟" },
    aiPersonality: { aggression: 0.4, expansion: 0.7, industry: 0.1, caution: 0.75 },
    specialty: "事件生成（1941），丛林游击与根据地",
    difficulty: { level: "hell", reason: "从零起家、全靠游击滚雪球" },
    startsActive: false, spawn: { year: 1941, month: 5, note: "越盟成立事件生成（或玩家选国时提前激活）" },
    initialStockpile: { equipment: 20, manpower: 30000, oil: 0, steel: 0, rubber: 0, food: 80 },
    initialDivisions: [D("guerrilla", "hanoi"), D("guerrilla", "vientiane", 1500)],
    initialSupports: [],
  },
  bna: {
    id: "bna", name: "缅甸国民军", capitalProvinceId: "rangoon", colorHex: "#3e7a4e",
    flagAsset: "assets/flags/bna.png", leaderAsset: "assets/leaders/bna.jpg",
    bloc: "axis",
    leader: { name: "昂山", personality: "年轻、民族主义、 opportunistic 转向快", ambition: "借日本驱逐英国，实现缅甸独立", speakingStyle: "学生运动式热烈演说", redLine: "缅甸必须真正独立" },
    aiPersonality: { aggression: 0.5, expansion: 0.55, industry: 0.15, caution: 0.55 },
    specialty: "事件生成（1942），借日反英的丛林军",
    difficulty: { level: "hell", reason: "傀儡与民族军之间走钢丝" },
    startsActive: false, spawn: { year: 1942, month: 3, note: "日军入缅后缅甸国民军事件生成（或玩家选国时提前激活）" },
    initialStockpile: { equipment: 30, manpower: 40000, oil: 0, steel: 0, rubber: 0, food: 100 },
    initialDivisions: [D("guerrilla", "rangoon"), D("infantry", "mandalay", 6000)],
    initialSupports: [],
  },
  ina: {
    id: "ina", name: "印度国民军", capitalProvinceId: "calcutta", colorHex: "#c9841e",
    flagAsset: "assets/flags/ina.png", leaderAsset: "assets/leaders/ina.jpg",
    bloc: "axis",
    leader: { name: "苏巴斯·钱德拉·鲍斯", personality: "激进、煽动性强", ambition: "武力解放印度，进军德里", speakingStyle: "口号式演说（向德里进军）", redLine: "不与英国妥协" },
    aiPersonality: { aggression: 0.65, expansion: 0.6, industry: 0.1, caution: 0.35 },
    specialty: "事件生成（1943），借日军之势的解放军",
    difficulty: { level: "hell", reason: "无根基外来军，全看日军推进" },
    startsActive: false, spawn: { year: 1943, month: 10, note: "印度国民军事件生成（或玩家选国时提前激活）" },
    initialStockpile: { equipment: 25, manpower: 35000, oil: 0, steel: 0, rubber: 0, food: 90 },
    initialDivisions: [D("guerrilla", "calcutta"), D("infantry", "mandalay", 5000)],
    initialSupports: [],
  },
  philippines: {
    id: "philippines", name: "菲律宾游击力量", capitalProvinceId: "manila", colorHex: "#7a5ba6",
    flagAsset: "assets/flags/philippines.png", leaderAsset: "assets/leaders/philippines.jpg",
    bloc: "allies",
    leader: { name: "曼努埃尔·奎松（流亡）/各地游击队", personality: "分散坚韧、亲美", ambition: "坚持敌后抗战，迎接美军反攻", speakingStyle: "强调菲美友谊与必胜信念", redLine: "不承认占领当局" },
    aiPersonality: { aggression: 0.35, expansion: 0.6, industry: 0.05, caution: 0.8 },
    specialty: "岛屿游击，1936 即以游击队形态存在于美属菲律宾",
    difficulty: { level: "hell", reason: "无正规军无工业，纯游击求生" },
    startsActive: true, spawn: null,
    initialStockpile: { equipment: 15, manpower: 25000, oil: 0, steel: 0, rubber: 0, food: 70 },
    initialDivisions: [D("guerrilla", "manila"), D("guerrilla", "davao", 1800)],
    initialSupports: [],
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
export const DEFAULT_PLAYER_FACTION: FactionId = "roc";
