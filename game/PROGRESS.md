# AsiaFront (亚洲战场) — Progress

**v1 playable prototype delivered 2026-11-16 (night shift).** Stack: Vite 6 +
TypeScript (strict) + Vitest. Engine lineage: archived Daqing project
(rng / guards / save / llm / sim skeleton), all gameplay built fresh for WW2.

## What v1 contains

- **Data (src/data)**: 18 factions (historical leaders, aiPersonality +
  leader persona cards from the same source, difficulty label for the
  faction-select screen only), 78 provinces (hex odd-r layout, land
  adjacency derived from coordinates + explicit sea links, historical
  resource sites), 8 generic division templates + faction specials
  (real headcounts, infantry division = 10,000), data-driven attack modes (8 finalized: frontal/prepared/fortified/encirclement/
  infiltration/air-support CAS/amphibious/guerrilla raid, all data-driven
  with prep/fortify static-month layers and three-tier air/sea advantage), economy/tech (6 branches x 3)/focuses (3-5 per faction)/events
  (18 historical events 1936-1945)/diplomacy (7 actions).
- **Logic (src/core, src/ai)**: monthly settlement (industry, manpower,
  resources, supply-line decay, replenishment, research, focuses,
  production queues, vassal tribute, trade), movement with speed +
  sea-edge rules, combat (terrain/counters/tech/support/mode multipliers,
  product clamped 0.3-3.0, +-15% roll, losses in real headcounts,
  retreat/occupation), event interpreter, unified victory check,
  rules AI per faction personality (build/research/focus/diplomacy/
  offense/maneuver, all through applyAction only).
- **UI (src/main.ts)**: faction-select screen (18 cards with leader,
  specialty, difficulty + reason), SVG hex map colored by owner with
  click select / move highlights / attack highlights, side panels
  (province / troops / production / tech / focus / diplomacy / records
  with save slots and the LLM dialog skeleton entry), end-turn button,
  game-over overlay with restart.

## Standing rules (user, 2026-11-16)

- Starts January 1936; 1 turn = 1 month; NO turn cap anywhere — the game
  ends only on victory/defeat conditions (see src/data/timeline.ts).
- Unified victory for every faction (user 02:10, overrides per-faction
  goals): control >= 70% of provinces (vassals count toward overlord) or
  all others eliminated/vassalized; losing all provinces and divisions
  = eliminated. Faction difficulty labels are display-only.
- Player may pick any of the 18 factions (Nationalist China is only the
  default); never hardcode the player faction. Event factions
  (Wang Jingwei regime / Viet Minh / BNA / INA) activate by historical
  events, or at start if the player picks them (what-if).
- Fully playable with no LLM connected; LLM dialogue is only an extra
  negotiation channel (llm layer falls back, never blocks).
- Troop counts are real headcounts. AI difficulty only via the unified
  DIFFICULTY multiplier table (player always 1.0).
- All numbers/text in src/data; state changes only via applyAction;
  seeded RNG only via src/core/rng.ts; new logic ships with Vitest tests.

## Historical-accuracy pass (manager order, user 02:09)

- 1936 setup audited against history: Japan holds Manchuria/Korea/Taiwan;
  colonies as historical (UK Burma/Malaya/Hong Kong, France Indochina,
  Netherlands East Indies, US Philippines); CCP starts with only the
  Yan'an base area; warlords semi-autonomous (own faction, own stockpile).
- Mengjiang is now event-spawned (1939-09) like Wang Jingwei (1940-03):
  dormant in 1936, its three home provinces start under warlords and are
  transferred on activation (or at start if the player picks it).
- Events carry a `condition` field: if the player has already changed
  history (e.g. Japan-USA already at war before Dec 1941, or Haiphong no
  longer French), the event is skipped and the log records a "historical
  fork" note. US home-industry power enters via the Jan 1942
  mobilization event (overseas-support caliber, noted in faction data).
- Every faction has a `flagAsset` placeholder (flags/<id>.png); flag art
  (period-correct 1936 flags) is the art line's job, code does not draw.

## Verification (v1)

- `npm test`: 46/46 (data 13, engine 10, timeline 6, logic 12, sim 5).
- `npm run build`: passes. Preview smoke-tested (page + bundle 200).
- Sim: 300-turn full-AI runs do not crash; borders move (>= 8 provinces
  change hands by 1942); an idle ROC player is eliminated by Japan
  around 1938-1941 (regional decision before 1945); same seed = same
  result; single END_TURN with all AI settles well under 1s (~30-100ms).

## Known gaps (v1)

- Balance is rough: Japan crushes an idle player fast, but against an
  AI-driven ROC it can collapse by 1944; post-1945 stalemates are common
  (by design there is no turn cap — a balance pass is future work).
- Combat uses province-level combined arms (all ready divisions in the
  origin province attack together); no stacking limits or combat width.
- Sea movement uses abstract transport (fleet blockade only); air/naval
  units are support abstractions, not independent maneuver units.
- LLM leader dialogue is skeleton-only this version (settings + entry).
- Map art is functional color blocks; flags/art pass belongs to the art line.

## v2 地图切换（钢4 模式，2026-11-16 W1–W3）
- 地图由 78 六角节点换为 **54 州 / 197 省**不规则多边形：1936 行政骨架、省质心=真实城市经纬度、
  Voronoi 分区 + Natural Earth 真实国境裁剪（tools/gen_map.py 可重跑生成 provinces.ts/states.ts）。
- 相邻=共享边界实测 + 海峡陆路连接 7 对 + 跨海航线 47 对；全图连通（测试断言）。
- 河流：RIVER_CROSSINGS 13 条渡河边（黄河/长江/松花江/湄公河/红河/萨尔温江/鸭绿江），
  进攻乘区 RIVER_ATK_MULT=0.85 已进战斗公式并有数值测试（比值恰 ×0.85）。
- 胜利门槛随省数动态：ceil(197×0.7)=138 省。
- 渲染：SVG 多边形、归属色 fill-opacity 0.55 半透明罩染（写实底图同坐标系垫底接口）、
  河流蓝线层、首都 ★/港口 ⚓ 标记、省份卡显示所属州与州内控制汇总。
- 1936 开局：国民政府 53 省 / 日本 36 / 军阀 34 / 英 16 / 满洲国 12 / 荷 12 / 法 9 / 苏 7 / 菲 7 / 泰 5 / 蒙 3 / 美 2 / 中共 1。
- sim 观察（seed 3，泰国挂机 300 回合）：27.6ms/回合、无胜者；国民政府 91 省、日本被逐出大陆并最终出局
  （长线 AI 平衡问题与 v1 同源：日本对 AI 国民政府偏弱，待平衡批次处理）。
- 测试 50/50、build 通过。源码包 asia-front-v2.zip。

## 收口自查与美术接入（2026-11-16 夜班收口）
自查发现并已修：
- 加尔各答被达卡胞元隔断成 1 度孤点 → 人工相邻修正（恒河/孟加拉海岸走廊 2 条）；
  吉隆坡同理（马来半岛走廊）、黎牙实比（吕宋东岸走廊）一并修正，全图仍 197/197 连通。
- 8 省质心落在自身多边形外（达沃最远 ~100 单位）→ 质心改用多边形 representative_point，标记必落省内。
- data.test 国旗断言随真实文件接入更新；新增领袖肖像 16/18 断言。
sim 三种子（300 回合）：seed3 泰国挂机——国民政府 91 省、日本出局；seed11 国民政府挂机——
日本 112 省、国民政府出局（53→0）、汪伪/蒙疆事件势力登场持地；seed7 日本挂机——国民政府 89 省、日本出局。
无一种子 300 回合内有人达 138 省胜利线（无回合上限设计下靠淘汰分胜负）；性能 8–28ms/回合。

## 美术接入台账（用户 03:43 立规，按 ART-REQUIREMENTS A1–D6 逐项登记）
| 项 | 内容 | 到位情况 | 接入状态 |
|---|---|---|---|
| A1 | 写实底图（真实地理数据打底） | 已交付（basemap_sat_2x/1x，NASA Blue Marble） | **已接入（2026-11-16）**：注意美术原图是几何 v3 之前的旧坐标系（lon 58–231/lat ≤56/cos30，含檀香山），与现行帧（lon 59–149/lat −9–64/cos34，821×803）不能直用；代码侧按同源 GIBS BlueMarble_ShadedRelief_Bathymetry 在现行帧重渲染＋美术 build_basemap_v2.py 同口径调色（陆地饱和/海面深板岩/暗角），WebP 222KB 进 public/assets/basemap_sat.webp，SVG image 铺满画布作最底层，矢量剪影转加载失败兜底；省界描线对位图 docs/basemap-sat-align-check.png 验收贴合。构建脚本 tools-basemap/build_sat_game_frame.py（ww2-asia 根下，中间产物不进交付包） |
| A2 | 地形底纹 8 种 | **已交付**（terrain_*.png 256 平铺×8＋legend_*.png，2026-11-16 05:09） | **已接入（2026-11-16 主界面丰富化批）**：SVG pattern 按省形裁切，层序 卫星→纹理→经纬网→河流→罩染；政治模式纹理 0.5、地形模式 0.85 且罩染降至 0.45 |
| A3 | 河流矢量层 | **已交付**（rivers.svg/rivers.json，2026-11-16 04:42） | **已接入（2026-11-16 丰富化批）**：旧帧→游戏帧仿射变换（gx=0.9572·xa−9.118, gy=ya+88）整组描画 8 河；RIVER_CROSSINGS 渡河边改落质心中点小点（原直连蓝线撤下，战斗公式不变） |
| A4 | 地图标记（城市三档/港口/机场/要塞） | 到位 6 文件（城市/首都/港口/机场/要塞/战斗） | 已接：首都、港口（v2）；未接：城市档（与省名标签重复，暂缓）、机场/要塞（引擎无对应系统）、战斗标记（需纪事结构化省份字段，接口在标记层） |
| A5 | 资源小图标（油/钢/橡胶/粮） | **已交付**：奖章版（D1）＋上图版 res_*_map×4（油/钢/橡胶/粮）＋顶栏橡胶图标 res_rubber.png | 已接奖章版于顶栏；**上图版已接入（2026-11-16 丰富化批）**：油/钢/橡胶产出省＋粮食主产区（food≥50）挂 res_*_map 小图标（每省至多 2 枚，质心右上） |
| A6 | 罗盘/经纬网格/海域名 | **已交付**（graticule.svg＋sea_labels.json 14 海名＋MAP-DRESSING-SPEC） | **已接入（2026-11-16 丰富化批）**：经纬网按游戏帧投影现算（10° 间隔、淡白 0.10）；海名锚点经仿射换算入帧 11/14（太平洋等 3 个落点在现行帧外剔除，见 seaLabels.ts 注记）；罗盘已随 D 皮肤批接入 |
| B1 | 国旗 ×19 | 到位 19/19 | 已接 18（v2，选国卡+顶栏）；西藏旗无对应势力、无接入点 |
| B2 | 领袖肖像 ×18 | 到位 18/18（溥仪/昂山厚涂油画版已补，照片版备份） | 已接 18/18（选国卡），data.test 断言 18/18 |
| B3 | 国家徽章变体 | 未单独交付（清单允许以国旗代并注明） | 已接（以国旗代徽章，选国卡/顶栏/省份驻军色片同源）；如美术出专属徽章版再替换 |
| C1 | 师徽记 ×8+特色 | 到位 13 文件 | 已接（v2：驻军行/部队/生产面板；特色师用 div_special） |
| C2 | 支援徽记 ×3 | 到位（+blank 1） | 已接（v2：生产面板支援单位） |
| C3 | 通用 3D 模型 ×10 | 全量到位（assets/models/，登记册第一节） | **样机已接入自有模型**（2026-11-16 纠错令）：terrain3d-demo 单位全换自有模型——步兵按势力涂装变体、装甲按势力选型（type95/sherman/t34/medium）、零式/轰炸机分工、舰队航母+巡洋+驱逐编成、苏军骑兵；步兵 march 动画已播（51 个 mixer）；2D 正式版接入待 3D 表现层立项 |
| C4 | 特色 3D 模型 ×6 | 全量到位（九五式/零式/五家步兵涂装等，登记册第一节） | **样机已接入自有模型**（同 C3）；2D 正式版待 3D 表现层立项 |
| C5 | 战斗/事件标记 ×5 | **已交付**（markers/combat_attack/encircle/landing/airraid/guerrilla） | **已接入（2026-11-16 丰富化批）**：引擎新增 combatMarks 落账（STATE_VERSION 5，旧档迁移补 []）——交战/包围/登陆/空袭/大捷/游击袭击六种（大捷＝attack 图＋★角标，美术五图无大捷独立图），呼吸脉冲显示、保留到下回合 |
| C6 | 事件插图 ×19（可选） | 未交付（清单标可选/后期） | 接口已留：纪事面板事件条目可挂图；不阻塞 |
| D1 | UI 套件 | 到位（含 SKIN.md 挂载说明） | **已接入（2026-11-16 布局+质感批）**：顶栏 topbar_plate repeat-x 瘦栏 44px、底栏 bottombar_plate、图标轨 btn_square、结束回合 btn_endturn 图钮、抽屉 panel_frame border-image、信息卡 province_card_frame、总览 state_panel_frame、选国卡 button_frame；图标 13/13＋橡胶图标已挂顶栏。素材转 WebP 后全套约 1.06MB |
| D2 | 省份卡/州面板样式 | 未交付（仅概念图） | 接口已留：省份面板 DOM 结构稳定（af-panel/af-line），样式到位后换皮不改结构 |
| D3 | 主菜单背景 | 已交付 | **已接入**：选国页页眉主视觉带（bg_main_menu.webp＋暗渐变） |
| D4 | 选国背景 | 已交付 | **已接入**：选国页整页底图（bg_nation_select.webp＋86–93% 暗罩保可读性） |
| D5 | 胜利/失败画面 ×2 | 已交付 | **已接入**：结算弹窗卡背景（胜/败两图＋暗罩） |
| D6 | 加载图 | 已交付 | **已接入**：index.html 静态 splash（bg_loading.webp），首帧后淡出移除 |

## 热修：地图缩放/平移（2026-11-16 总管热修令）
丢失原因（如实）：W2 换图时 renderMap 整体重写，只迁了点选/高亮，视图控制未实现；
v1 回执中「缩放拖动保留」为沿袭 v1 描述的误报，此后回执逐项与构建实测对照（已入自查清单）。
实现：src/ui/mapView.ts（纯函数：zoomAt 光标锚定/panBy/clampView，缩放 1–4 倍、平移钳制不出图）
+ main.ts 接线（滚轮/单指拖动/双指缩放/＋－复位按钮；视图状态只存 UI 层不进存档；
拖动位移 >4px 判定为拖动、松手 120ms 内抑制点选）。tests/mapview.test.ts 5 项冒烟全过，全量 55/55。

## 删省：檀香山（2026-11-16 用户点名，总管追加令）
删除清单：省份 honolulu（生成器 PROVS 行）、州归属（pacific 州保留关岛，州数仍 54）、
跨海边 guam–honolulu、美国初始驻军 garrison@honolulu→关岛、支援 fleet/fighter@honolulu→关岛、
美国首都 honolulu→关岛、国策 pacific_fleet 的 addFactory 目标与文案（关岛军工+1）。
全仓 grep honolulu/檀香山 零残留（生成注释已同步改词）。
取景重算：生成器按内容包围盒归一化（10 单位边距），新画布 712×812（原 1650×790 大半是太平洋空洋），
MAP_W/MAP_H 由 provinces.ts 导出、main.ts/mapView.ts 改为从数据层读，主战场省份屏幕尺寸约放大 2.3 倍。
胜利分母 196 省，70% 门槛 ceil(137.2)=138（与原 197 省时同为 138，纯属巧合，断言已按 196 更新）。
连带修复：平移后两省代表点整数取舍撞点（cx/cy 改 0.1 精度输出，质心唯一性断言恢复）。
复测：连通 196/196、测试 55/55（含 300 回合 sim）、build 通过。关岛按令保留。

## 几何返工 v3：真实行政边界骨架（2026-11-16 用户否决半圆团块后返工）
管线换代：tools/gen_map2.py（旧 gen_map.py 保留备查）。形状来源 Natural Earth admin-1
（省/邦/道级真实边界，公有领域，tools/admin1.geo.json 需另下、未进交付包）：
每游戏省 = 落入其质心的 admin-1 单元并集；同一单元被 ≥2 省质心落入时才在该单元内部
Voronoi 切分（外形永远由真实边界决定）；未被落入的单元归同国最近省；香港由质心切分、
关岛因 NE 无此岛以真实经纬轮廓手绘小多边形（48×13km 长轴）。
全陆地底衬：admin-0 并集（basemap.ts）已接渲染（不可玩陆地完整画出）。
取景框东经 59–149 / 北纬 −9–64（雅库茨克 62°N、爪哇 −7° 决定南北界），画布 821×803。
数据层全保全：196 省 id/归属/地形/经济/河流边不变，相邻按真实共享边界重算，196/196 连通，测试 55/55、sim 复跑通过。
视觉自查（docs/map-v3-shape.png）：中国海岸线/山东/辽东半岛/海南/台湾、中南半岛 S 形、
马来半岛、印度三角、日本列岛弧度、朝鲜半岛、印尼群岛逐项对照真实地图成立。
同批：B2 领袖肖像补齐 18/18（溥仪/昂山真实照片版接入，断言已更新）。
已知小疵：萨哈林岛在苏联省面内（无独立省，1936 南萨哈林归属待后续口径）；稀疏区内部分割线为直切（外形不受影响）。

## 地形系统 T1（2026-11-16，钢4 式）
八类主体地貌 plains/forest/hills/mountain/jungle/desert/marsh/urban（gen_map2 迁移表+逐省地理
override：西伯利亚/东北林区 forest、蒙古草原 plains、大都会港口 urban、三角洲 marsh 等）；
port/island 拆为特征标记 isPort(64)/isIsland(6)，coastal/capital 由数据推导。
参数总表 src/data/terrain.ts：守方防御/行军成本/省份容量/断补给倍率/有补给环境损耗/
筑垒增速与上限/补员乘子/兵种大类默认攻防与行军系数——战斗、行军（移动点+Dijkstra，
渡河行军成本与战斗惩罚分开）、月结算、AI 共用同一表，无双套规则。
城市/港口旧 +15% 已并入 urban defMult 1.3 与港口特征 1.1，未双叠。
T2 留口：terrain.ts seasonal 字段（冬季/季风，未启用）；基础设施/筑垒工程未建字段（待系统立项）。
测试 62/62（新增 terrain.test 7 项逐项验收）；sim 2 种子 300 回合不崩（19–35ms/回合）。
平衡观察：seed 11 英国 AI 扩张至 99 省（新行军/容量口径下 AI 机会主义增强），留平衡批次处理。
美术 A2：八类底纹未到，代码侧以 TERRAIN_PARAMS.color 色板占位（地形地图模式已可切换），
data-terrain 挂载点保留，纹理到位后替换填充即可。

## 指挥层返工（2026-11-16，用户点名「城里派兵出来控制军队攻击」）
命令层改编组制（STATE_VERSION 3，v2 存档自动迁移 groups/groupId）：
- ATTACK 改 divisionIds 编组下令：可分兵（留守师不参战、不承损、仍可行动）、可多路合击
  （多出发省一次命令合并一场结算，estimate/战报分列主攻＋助攻；跨海/港口/支援规则逐师判定，
  渡河按兵力加权）。结算仍即时（未改月结排队，保住 AI 时序与旧测试语义，取舍已报总管）。
- MOVE_UNITS 路径行军：全图 Dijkstra 路径（不限月距），当月按移动点先走一段，余程存
  division.pathIds，END_TURN 自动续走；路径被阻断/单步永超预算则停驻放弃。HOLD_POSITION 驻扎清行军。
- 常设编组 groups（军/集团军）：CREATE/DELETE/SET_GROUP_MEMBERS，成员以 division.groupId
  为单一事实源；纯指挥工具、零数值加成。UI：驻军逐师勾选、全选本省、编组存取、预估按编组
  （参战师数＋来源＋地形拆解），点地图敌省合击/可达省行军。AI 同步走新动作结构。
- 留口：钢4 战线/作战计划画线未做（下一批）；合击的月结排队式结算未采用（见上取舍）。
测试 69/69（新增 command.test 7 项）；sim 2 种子 300 回合不崩（40–46ms/回合），
seed 11 英国 99 省的平衡观察与地形批一致（AI 行为聚合未变），仍留平衡批次。

## 持续战斗＋组织度＋底部功能栏（2026-11-16，总管补充令：钢4 校准＋底部排）
- 战斗改月内阶段结算（接敌→激战→决战，最多 3 阶段）：目标省地形容量定前线师数，
  主攻编组先入前线、余为预备队，前线被歼次月阶段自动递补；守方同制。原 T1「超容效率
  递减」由前线/预备制取代（预估字段改 atkFrontline/atkReserves 等）。
- 支援进攻（钢4 support attack）：ATTACK 加 supportDivisionIds——支援师全额计入火力、
  战损 35%、付支援组织度，但不离开本省、胜利不进驻；预估/战报与主攻分开列。AI 暂只用主攻。
- 组织度（师级新状态 org，STATE_VERSION 4，v2/v3 存档自动迁移补 100）：进攻每阶段 -6
  （支援 -4、守方 -3）、行军每省 -3（下限 5）；战力系数 0.5+0.5*org/100；org<20 不得进攻，
  战斗中前线平均 org<15 被迫停攻；恢复在月结算（未行动月 +25*地形恢复乘子，断补给 *0.25）。
  面板驻军行显示「组织 N · 筹备 M 层」。
- 多方向包抄：参战出发省数（主攻+支援）给攻方乘子 2 方向 *1.1 / 3+ *1.2（数据表
  DIRECTION_BONUS）；战报按阶段列战力比＋修正明细（地形/渡河/筹备/筑垒/空优/包抄/断补给）。
- 底部常驻功能栏：地图（回全图）/省份/部队/生产/科技/国策/外交/纪事＋结束回合常驻底部
  （sticky、窄屏横滚）；选中编组时并排「编组名 N 师＋行军/进攻/驻扎/取消选择」。
  截图 docs/ui-bottombar-desktop.png（1440 宽，含指挥段）/ui-bottombar-mobile.png（390 宽）。
测试 75/75（新增 battle.test 6 项＋容量测试改前线口径）；sim 2 种子 300 回合不崩
（40–213ms/回合，阶段结算后单回合变重）；平均组织度 97–100（恢复与消耗平衡）。
平衡观察不变：seed 11 英国仍雪球（124 省），属平衡批次。

## A1 卫星底图接入（2026-11-16，总管接入令，用户点名）
- 美术交付图为旧坐标系（几何 v3 前），代码侧同源重渲染至现行帧并接入（详见台账 A1 行）。
- 层级：卫星图（最底）→ 省份罩染（政治 0.55/地形 0.88）→ 河流线 → 标记。地形模式下
  罩染 0.88 基本盖住卫星图（地形模式是分析视图、靠色板+后续 A2 纹理读地形），政治模式透地形。
- 台账自查（同日）：A2/A3/A5 上图版/A6/C5/D 系列皮肤与背景均已交付未接入，已逐项
  更新台账并排期：D 皮肤＝下一批（总管「第二笔账」）；A2+A3+A6+A5 上图版＝地图层批次；
  C5＝引擎记最近战斗后挂。

## 布局修复（2026-11-16，总管亲测三问题）
1. 选国滚不到底：根因 body overflow:hidden + #app 100vh flex 列，.af-start 不是滚动层、
   内容溢出被截。修：.af-start 改 flex:1/min-height:0/overflow-y:auto/width:100%，
   max-width 放宽 1500px、网格 minmax(300px)（1080 宽 3 列、更宽 4 列）。
   实测（1080x1121）：滚动到底最后一家菲律宾卡完整可见，18 家全可达。
2. 主界面留白：地图区改 flex 列＋视口居中（svg 100%x100% meet 最大化居中），
   底色改深海板岩渐变与卫星海面衔接（竖长视口下剩余边距是海色不是死黑）；
   页签改 nowrap 单行（flex 等分、12.5px）；右侧栏底部加常驻「战局总览」
   （日期/控省/待命与行军中师数/编组概览/控省前列 Top5）填空白。
3. 标签密度：缩放三档（z<1.5 / <2.5 / >=2.5，applyMapView 同步 class）——
   低档只显首都（11.5px 粗体描边）/大城市（城市且工厂>=3）/选中省，其余渐显；
   悬停省份强制显示其标签（path mouseenter 联动）。实测默认档可见标签 53/196。
截图：docs/ui-start-scrolled-bottom.png、docs/ui-main-layout-fixed.png（均为 1080x1121）。
测试 75/75 不变（纯 UI/CSS 层）。

## 标签优化二轮（2026-11-16，用户实测点名）
- 标签布局引擎 layoutLabels()（main.ts）：每次渲染/缩放/平移后统一计算。
  字号三级降档：首都/选中 9.5、大城市 8.5、普通 7.5（原 11.5/9.5），描边 3→2；
  驻军徽记 9.5→8 且同步缩放补偿、opacity 0.92。
- 缩放反向补偿：字号 = 基准 x z^-0.45（屏幕增速约为地图的 0.55 倍），三档阈值
  重校为 z<1.4 / <2.4 / >=2.4（低档候选=首都/大城市/选中，中档+港口，高档全量）。
- 省宽适配：标签宽（字数x字号）超过省包围盒宽x适配比（首都 1.7/大城市 1.4/
  港口 1.1/普通 1.0）默认不显；选中省豁免；悬停/点选必显（原有联动保留）。
- 碰撞避让：视野内候选按优先级（选中>首都>大城市>港口>普通，同级大省优先）
  贪心放置，包围盒相交者让位隐藏。字号必须用内联 style 设置——CSS 类字号会
  压过 SVG font-size 属性（本轮实测踩坑，初版因此在放大视图失效）。
- 实测（脚本量真实渲染包围盒）：默认全图可见 45 标签、重叠 0 对；华东放大
  （z~2.7）可见 108、重叠 0 对。截图 docs/ui-labels-default.png、
  docs/ui-labels-eastchina.png。测试 75/75（纯 UI 层）。

## 布局+质感批（2026-11-16，总管令：学钢4比例，第二笔账结清）
- 右栏废除：改图标轨（48px 竖排方形钮）+ 抽屉浮层（336px，right:48px，盖地图不挤图，
  transform/opacity 滑出）。抽屉默认关；点轨上页签开/同签再点关；底栏罗盘钮=全图+收起。
- 取舍（令中授权二选一）：页签入口只留图标轨，底栏不再重复放 7 个页签钮——底栏只管
  全图（罗盘）/选中编组指挥段/结束回合。结束回合按 SKIN.md 只留底栏右端（图钮），
  顶栏不再放；「重开一局」收进顶栏「菜单 ☰」下拉。
- 顶栏一行 44px：标题/日期/国旗国名控省/资源全量内嵌（可横滚）/菜单。资源栏独立行撤销。
- 紧凑信息卡：选中省时主区左下浮卡（省名地形归属/驻军/工厂/港口首都标记+「打开详情」
  直达抽屉省份页），省份卡框体 border-image。
- 皮肤：钢板顶/底栏、黄铜描边、纸面字；D1–D6 全部转已接入（见台账）。
- 实测（脚本量）：地图占比 1440 宽 97%、1080 宽 96%（抽屉开/关不变）；顶栏 44px；轨 48px。
  截图 docs/ui-skin-main-1440.png（关）、ui-skin-drawer-1440.png（开）、
  ui-skin-drawer-1080.png、ui-skin-start.png。测试 75/75。
- 已知小疵：信息卡浮在地图左下时遮住图例行左端（卡可关、图例为次要信息，未处理）。

## P0 省份点击失效修复（2026-11-16，总管实测令）
- 根因：缩放热修给 svg 加了 setPointerCapture，浏览器把 pointerup 后的 click 重定向到 svg 本身，path 上的 click 监听永远收不到（面板按钮/拖拽/缩放都在 svg 或 HTML 层，所以只有省份点击全灭且静默）。
- 修法：点击改走 svg 级监听——按下点记 downPos，点击时按「按下-抬起位移 ≤4px」判定（废除 dragMoved＋120ms 延时复位），坐标经 getScreenCTM 逆变换后用 provinceAtPoint（省多边形点内判定，模块级缓存解析）命中省份。path 级 click 监听删除，hover 不受影响。
- 静默失败堵漏：onProvinceClick 全部命令分支落空都给原因（未宣战/编组打不到/行军到不了/驻军已行动），失败时自动打开抽屉；省份详情新增对外国势力的「宣战」按钮与「交战中」状态行（宣战入口）。
- 数据修正：RIVER_CROSSINGS 删除「南京-合肥 长江」一条——两市同在长江北岸、行军不渡江，误标使进合肥成本 3+2=5 超步兵月预算 4，单师行军永远到不了（渡河口径 13→12 条）。
- 浏览器级冒烟（tools/smoke_click.mjs，常驻验收）：点选成都/徐州/南京、拖动不误触、单师行军南京→合肥（驻军 1→0 / 0→1 断言）、未宣战点济南出提示＋宣战入口、交战打不到延安出原因——12/12 PASS；单测 75/75、build 通过。证据图 docs/p0-smoke-move.png、p0-smoke-notice.png。

## 攻击玩法重做 · 一期（2026-11-16，总管审稿通过后开工）
- attackModes.ts 退役删除，新表 src/data/combatSystems.ts（BASE_ATTACK/PLAN/FORTIFY/ENCIRCLEMENT/INFILTRATION/AIR/LANDING/PURSUIT/SPEARHEAD/RAID）；ATTACK 动作去 mode 字段、加 spearheadIds；新增独立 RAID 动作（游击专属）。
- 自动系统：筹备（PLAN 按静止层数）、筑垒（FORTIFY）、包围（目标不在守方补给网 → 守方 ×0.5 且获胜全歼，对所有进攻统一判定）、渗透（units 六模板 infiltration 特性，兵力占比 ≥50%＋山地/丛林触发，守方地形减半）、空优/CAS 与制海/舰炮按在场与跨海语境自动结算；跨海进攻一期自动按 LANDING 参数（港口出发校验保留，三期改项目制）。
- 矛头：≤2 个主攻师，战力 ×1.35/战损 ×1.5/组织消耗 ×1.5，获胜优先进驻；AI 在预估比 [1.0,1.6] 且有装甲/摩托化师时指定，且可凭矛头预估把不够阈值的仗抬过线。
- 包围 UI 化（一期必交）：省份面板补给行、信息卡「补给断绝（包围）」标记、进攻按钮与预估明细的守军补给状态（targetSupplied 进 AttackEstimate）。
- AI：整省游击驻军改走 RAID；渗透/包围因已进预估口径，目标选择自然生效（未另加权重防双算）。
- 数据修正：首尔/海南/土格加劳/萨哈林/关岛 5 个海航线端点补 isPort（港口 64→69，关岛为美国首都兼唯一省，原标记缺失会堵死跨海出发）。
- 测试：单测 82/82（新增 combat-systems 7 项：筹备/包围全歼/补给连通/渗透触发与稀释/矛头与校验/空优自动）；P0 点击冒烟 12/12、一期 UI 冒烟 5/5（tools/smoke_p1.mjs：模式钮消失/补给行/设矛头/★切换）全过；build 通过。证据图 docs/p1-ui-spearhead.png。

## 2026-11-16 主界面丰富化批（总管令：治「太单调」）
- 地图填肉：A2 纹理/A3 河流/A6 经纬网＋海名/A5 资源图标全接入（见台账）。
- 战争可视化：战线描边（交战省界按涉己方蓝/涉敌方红/他方橙，共享边以边中点距对方折线 <3 判定，几何缓存一次）；命令箭头（行军虚线灰走全路径、进攻实线红弧线、袭扰红虚线，结束回合清除）；C5 战斗标记（引擎 combatMarks）；军棋牌计数器（徽记＋兵力条＋组织条＋×N 角标＋混驻红三角＋选中金边，替掉 ⚔ 徽记）。
- 信息密度：警报旗列（断补给/失省/可宣战/建设点闲置/科研闲置，点旗直达）；编组卡带（底栏上方每师一卡，点卡定位）；海面呼吸光斑（CSS）。
- 性能（本机软渲染同口径）：SVG 节点 533→1133，点选重渲染 ~91ms→~120ms 稳态，未出量级。
- 冒烟：tools/smoke_enrich.mjs 12/12、tools/smoke_attack.mjs 通过；P0/P1 回归全过。截图 docs/enrich-full/east/group/move/attack.png。

## 2026-11-16 战斗重做二期：空军任务系统（总管放行令）
- SupportState 新增 missionTargetId（STATE_VERSION 6；v2–v5 旧档迁移补 = 驻扎省）；新动作 SET_SUPPORT_MISSION（己方单位校验，目标任意省、免费即时）。
- 结算口径切换（combat.ts）：空优/制海三档改按「双方任务指向目标省」计数（advantageTier）；CAS 改轰炸机任务指向触发；舰炮改舰队任务指向触发；supportMult 在场口径扩展为驻扎命中或任务指向。
- AI：planAiActions 在首个 ATTACK 前插入任务改派——fighter/bomber 指向主攻目标，fleet 登陆主攻时指向登陆目标、否则指向最近敌港（无敌港回驻扎省）。AI 预估仍按改派前状态算（保守口径，已在回执声明）。
- UI：省份面板己方支援逐行显示「任务：X省」＋改派钮（点钮→点地图任意省指派）；部队面板同；他省面板有「任务指向本省」提示行。
- 验收：单测 89/89（新增任务口径/校验/迁移/AI 动作序 4 项，确定性构造）；sim 2 种子：seed 11 跑满 300 回合（60ms/回合，26 个支援中 17 个在外指派任务）、seed 42 第 61 回合玩家位被灭出局（设计内终局）；冒烟 smoke_p2 通过（东京舰队改派大阪全流程）、P0/P1 回归无损。截图 docs/p2-mission.png。

## 2026-11-16 战斗重做三期：登陆项目＋追击＋AI 轮换（总管放行令）
- 登陆项目制：GameState.landingPlans（STATE_VERSION 7，旧档迁移补 []）；PREPARE_LANDING（港口出发/seaLink 目标/组织度校验，参战师锁定＋消耗当月行动，readyTurn=下月）/EXECUTE_LANDING（就绪月执行、走正战登陆结算、出航即消耗计划）/CANCEL_LANDING（解锁、当月行动不恢复）；锁定师行军/进攻/袭扰/驻扎/改编组回 LANDING_LOCKED；直接跨海 ATTACK 拦截回 AMPHIBIOUS_REQUIRES_PLAN；月结自动取消（过期/出发港易主/参战师被歼，纪事留痕）。
- 追击：正战决胜（终局比 ≥2.2）且占领后，合格快速师（装甲/摩托化/骑兵、战后 org≥30；指定矛头时仅矛头）向相邻最弱敌省（无守军或守军 ≤ 追击方 25%）多走一格：空城直占、弱守军一阶段速决（战损 ×0.5、不连环），org −25，战报必带追击行、追击省落 battle 标记。
- AI：登陆同规则（就绪执行、无计划时港口部队预估占优才筹备、普通进攻跳过跨海目标）；预备轮换（前线 org<35 退后、后方 org≥80 补上，每月 ≤2 次，仅 AI 行为）。
- UI：进攻区跨海目标改「筹备登陆」钮（同港出发才给）；点图点跨海敌省给人话指引；出发港面板计划状态＋取消钮、目标省面板就绪「执行登陆」钮/筹备中提示；计划仅发起方可见。
- 验收：单测 92/92（新增锁定/取消/过期/追击负例等，旧跨海直攻与支援进攻测试按新口径改写）；sim seed 11 跑满 300 回合 67ms/回合、seed 42 第 57 回合玩家位出局（设计内终局）；冒烟 smoke_p3 全流程通过（宣战→台北筹备→次月福州执行，预估 0.74 登陆被击退、计划正常消耗）、P0/P1/P2 回归无损。截图 docs/p3-landing.png。
- 遗留数据口径（报总管）：大连 ownerId=满洲国（关东州），日军师驻扎但港口非日属——PREPARE 须出发港为己方所有，日军在大连只能驻防不能筹备登陆；是否把大连归属改日本请总管/用户定，测试里相关场景已显式设定归属并注明。

## 2026-11-16 3D 样机纠错：换用自有模型（总管纠错令＋素材单一口径令）
- 样机单位模型全部换成 assets/models 自有库（路径以 ASSET-REGISTRY.md 登记册为准）：步兵五涂装变体按势力（roc/ccp/japan/usa/uk，其余 ww2 通用）；装甲日 type95/美 sherman/苏 t34/其余 medium，摩托化以 tank_light 代（登记册 C3 清单本无卡车模型）；骑兵苏军 cavalry_ussr、其余步兵变体；战斗机 fighter_zero、轰炸机 bomber；舰队每支拆 carrier+cruiser+destroyer 编成。Quaternius/Kenney 旧模型与原始包已删除，样机 LICENSES.md 与页脚署名已改自有库口径。
- 步兵 march 骨骼动画已播：SkeletonUtils 克隆后逐个挂 AnimationMixer（相位错开），实测 51 个动画实例；骑兵模型无骨骼（节点动画）未播，留正式版。
- 体量：样机 dist 6,364,893B（模型目录 4,989,517B，含全套 19 个 GLB 备存）；摆放三角面合计 281,155（旧外部包口径 1,074,652，自有模型轻 74%）；步兵单模型 5,121 面（旧 20,712）。截图 docs/3d-units-tilt.png / docs/3d-units-east.png 已重出。
- units.json 已由 game/tools/gen_units3d.ts 重新生成（带 factionId/templateId/supportKind，供变体选型）。
- 登记册对账：本台账 C3/C4 已按纠错令更新；登记册第二节把地图层五组（地形底纹/河流/海名/资源点/战斗标记）记为「待接入（丰富化批）」，而丰富化批已于本日早些时候接入主游戏并有冒烟与截图证据、本台账记为已接入——此冲突按统一令回报总管，请总管侧更新登记册第二节状态（登记册由总管维护，本侧不擅改）。

## 2026-11-16 大连归属裁定（总管裁定）
- provinces.ts：dalian ownerId 满洲国 → 日本（关东州租借地史实口径，1905 年起日本直辖）。驻军（日军师）与港口口径随之自洽；三期 PREPARE 须出发港为己方所有的校验不再卡大连。开局省数：日本 36→37、满洲国 12→11（胜利门槛 138 不变）。测试里三处显式设定大连归属的底盘行已删；过期清理测试因日 AI 自家登陆计划改为按 factionId 过滤玩家计划断言。回归：单测全过、sim seed 11 跑满 300 回合、seed 42 第 65 回合玩家位出局（设计内终局）。

## 2026-11-16 音频系统接入（总管接入令，素材登记册第五节）
- 引擎 src/ui/audio.ts：WebAudio 双通道（music/sfx GainNode → master），配乐 <audio> 元素经 MediaElementSource 接入（菜单曲循环/战争轮换 3 首随机不连播/胜负结算覆盖），音效 AudioBuffer 预载播放（同槽 60ms 节流）；首次 pointerdown 才初始化并淡入（自动播放限制）；设置 localStorage（musicVol/sfxVol/muted/ambience）＋菜单下拉滑杆/开关；hidden 时 suspend。
- 挂钩 12 项按设计稿落地：dispatch 唯一入口挂 planSounds 纯函数判定（成功/失败、动作类型、log 差分、owner 差分、wars 差分、combatMarks 差分）只读不改结算；UI 声音走 document 委托（页签 ui_tab/面板开关 panel_open·close/菜单与未 dispatch 按钮 ui_click，dispatch 判重 40ms）；点图 failReason 路径补驳回音；省份选中轻响。槽位与 AUDIO-LIST 一一对应（下令按动作分 march/attack/garrison/cancel，无独立紧张曲——激战月以 battle_loop 低音量垫底替代，已在回执注明）。
- 素材：assets/audio 全量拷入 game/public/assets/audio（配乐 6 首 4.8MB＋音效 19 条 464KB，ogg）。
- 验收：单测 100/100（新增 audio.test 8 项：planSounds 分档/事件/胜负/设置持久化）；冒烟 smoke_audio 7/7（引擎初始化/行军 order_march/连过 11 回合西安事变 event_telegraph/进攻 order_attack→battle_start→province_captured→battle_victory/两会话零 pageerror）；P0/P1/P2/P3 回归冒烟全过。

## 2026-11-17 3D 正式版一期（平台定版：Windows 本地版，网页版取消）
- 渲染层 src/ui/map3d.ts：Three.js 高程网格（height.bin 256×250、127k 面）＋动态省份贴图（离线画布 1642×1606：卫星底图＋归属/地形罩染＋省界＋选中/可达/可攻高亮烘焙，Path2D 缓存＋输入哈希跳绘，实测重绘 0.5ms）；点选与 P0 同口径（射线→UV→provinceAtPoint，判定抽到 src/ui/provinceHit.ts 与 2D 共用）；轨道相机倾斜上限 60°、目标钳制、俯视/倾斜预设；单位按真实布势全量摆放（93 对象/总 351k 面：步兵势力涂装变体环形布阵＋march 动画、装甲选型、舰队三舰编成、战斗机/轰炸机），模型并行分批加载、渲染循环等资源就绪再启动（防软渲染抢占加载）；HTML 标签覆盖层复用 2D 优先级/分档规则（距离三档＋屏幕空间碰撞避让，华东特写实测 157 标签）。
- 接入：viewMode 存本地（默认 3D），菜单可切 2D（SVG 层完整保留作兜底），?view= 参数可指定（冒烟用）；抽屉/底栏/信息卡/警报旗等 DOM UI 零改动；罗盘钮与编组卡聚焦在 3D 下驱动相机。图例的登陆文案同步订正为登陆项目制。
- 平台：Electron 壳（electron/ 工程）：主进程仅绑 127.0.0.1 静态服务喂 dist（绕 file:// 的 fetch/CORS 限制，游戏代码零改），存档随应用数据目录本地存储；图标由美术 compass 素材合成。打包实况：win-unpacked 完整产出并逐项验过（主程序「亚洲战场.exe」＋resources/game 全量、静态服务对 index/height.bin/GLB/ogg/webp 均 200 且 MIME 正确）；NSIS 安装包的最后组装步被本机 wine32:i386 依赖冲突挡住（builder 需 wine 运行 32 位 NSIS  stub 做校验，wine64 已装、wine32 与之冲突装不上），一期交付改为免安装 zip（AsiaFront-Portable-1.0.0.zip，126MB，解压双击即玩）；NSIS 目标在 Windows 构建机上同一工程 `npm run dist` 一条命令可出。
- 存档导出/导入 JSON：按总管令，网页存档迁移已取消（用户明确不搬）；已写好的导出/导入留在纪事面板与开始界面作备份工具（importSaveJson 宽容三种格式＋迁移链复用 deserializeSave），不占验收项。
- 验收：单测 101/101（新增 importSaveJson 3 项）；冒烟全绿——smoke_3d 7/7（点选/行军/标签/单位/2D 兜底）、2D 套件 click/p1/p2/p3/enrich/audio 在 ?view=2d 下全过（四支旧冒烟已改为认 SMOKE_URL）；三图 docs/3d-game-{tilt,top,east}.png。帧率如实：本机 SwiftShader 约 1 FPS 为软渲染下限，真实帧率待用户 Windows 实机验。
- 二期预告衔接：战线/命令箭头/战斗标记/地形底纹河流贴图层/选中与可达高亮 3D 化；三期（桌面性能口径）：LOD/聚合与帧率降档。
