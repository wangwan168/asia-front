# 攻击玩法重做设计稿：模式菜单拆回系统

状态：设计稿，待总管审。审过后按文末分期实现。
背景：现行 8 种「攻击模式」是 8 个倍率开关，点哪个都是一键出结果，没有决策过程。
钢4 没有攻击模式菜单——玩法来自系统咬合（编制、地形、计划、空优、补给、速度差），
战术是玩家用站位和时机打出来的。本稿把模式表逐个拆回系统，并补三件真玩法
（空军任务、登陆项目、突破追击＋矛头）。

## 总原则

1. ATTACK 回归单一动作：选部队、选目标、（可选）指定矛头，下令。差异来自
   部队构成、地形、筹备状态、补给连通、空军任务分配——全是**下令之前**的决策。
2. 一切数值仍只放 `src/data`；结算只读表做通用计算，不按 id 特判（旧规矩不变）。
3. `src/data/attackModes.ts` 整体退役，内容拆进两个新家（见 §9 数据重组），
   不许留双套口径。ATTACK 动作去掉 `mode` 字段，STATE_VERSION 4→5（见 §10）。

## 1. 正面强攻 → 默认进攻（基准参数）

- 规则：唯一的常规进攻动作。现 frontal_assault 的乘区升格为全局基准
  BASE_ATTACK { attackMult 1.15, attackerLossMult 1.2, defenderLossMult 1.1 }，
  保持现行手感、零平衡冲击；其余系统都在基准上叠乘（总乘积仍受 0.3–3.0 封顶）。
- 数值位置：新表 `src/data/combatSystems.ts` 的 BASE_ATTACK。
- AI：无变化（默认动作即它）。

## 2. 筹备攻势 → 计划系统（自动）

- 规则：任何进攻自动结算筹备——参战师按兵力加权取 staticMonths 层数，
  每层 +12%、上限 3 层（现行 prep 参数原样），进攻后参战师层数清零。
  玩家决策是「等部队驻扎攒满再打，还是抢时间现在打」，不是菜单勾选。
- 衔接：与坚守共用 staticMonths 字段的现行口径不变——同一支部队的层数，
  进攻时读作筹备、防守时读作筑垒（battlePowers 现行读法保留，只换数据来源）。
  层数成长仍走 settlement（×地形 fortGrowMult），受击/移动清零规则不变。
- UI：进攻预估区显示「筹备 +24%（2 层）」；驻军行已有「筹备 M 层」读数。
- AI：现行「攒层优先」逻辑保留（staticMonths≥2 且其他条件满足时更愿意进攻），
  不再需要选 mode。

## 3. 坚守·筑垒 → 驻扎姿态（自动）

- 规则：守方被动生效（现行 battlePowers 已直读 fortify 参数），参数迁入
  FORTIFY 表 { perLayer 0.12, maxLayers 3 }，上限仍 ×地形 fortCapMult。
  HOLD_POSITION 姿态不变（驻扎即攒层）。
- UI：省份面板与预估的守方拆解行显示「筑垒 +N%」；菜单中删除该项。

## 4. 包围·断补给 → 涌现结果（自动）

- 规则：对**任何**进攻统一判定——目标省不在守方 suppliedProvinces 内时：
  守方战力 ×0.5（现 unsuppliedDefMult），且攻方获胜时守军**不许撤退、就地歼灭**
  （现 encircleDestroy 语义）。有补给时按普通进攻。包围是站位打出来的：
  切断目标与补给源的连通（reachableThrough 现行判定）即成立。
- 数值位置：ENCIRCLEMENT { unsuppliedDefMult 0.5, destroyOnWin true }。
- UI（关键）：目标省信息里必须能**看见**补给状态——省份面板与进攻预估加
  「守军补给：连通/已断绝（包围成立）」一行，否则玩家无从规划合围。
- AI：现行 AI 不懂合围；本批加一条启发：同等战力比下，优先攻击已断补给目标
  （estimate 时目标 unsupplied 则胜率权重上调），追击（§7）会自然帮它合口。

## 5. 侧翼渗透 → 兵种特性（自动触发）

- 规则：模板特性 infiltration。触发条件：参战部队中具特性师的**兵力占比 ≥50%**
  且目标地形 ∈ {mountain, jungle} → 守方地形防御乘子减半、自损 ×1.2
  （现行参数原样）。不足 50% 不触发（混编稀释，与钢4「编制决定战术」同构）。
- 数值位置：特性标记写进 `src/data/units.ts` 模板表（mountain/cavalry/guerrilla/
  eighthRoute/infantry_jp/marine_jp 六个模板加 `infiltration: true`），
  参数表 INFILTRATION { terrains [mountain, jungle], defTerrainMult 0.5,
  attackerLossMult 1.2, minShare 0.5 }。
- 兵种说明：上述模板的 desc 补一句「渗透特性：山地/丛林战守方地形优势减半」，
  部队面板/生产面板可见——特性要写在明处，玩家才规划得出来。
- AI：现行「有轻装师概率选渗透」改为：组队时若目标为山地/丛林，
  优先抽调特性师凑过 50% 占比（抽调逻辑在 ai.ts 组队段）。

## 6. 航空支援 → 空军任务系统（本批核心决策点）

- 规则：支援单位（fighter/bomber/fleet）新增**任务**字段：
  `mission: { targetProvinceId }`，任务类型由 kind 决定（fighter=制空、
  bomber=对地支援、fleet=制海），不另设类型字段。新动作
  SET_SUPPORT_MISSION { supportId, targetProvinceId }（只能指派己方支援单位，
  目标任意省份；缺省 = 驻扎省，即现行行为）。
- 结算（battlePowers 内替换现 tierKind 分支）：
  - 制空三档：比较双方**任务目标 = 本场目标省**的 fighter 数（沿用 advantageTier
    的多/少/平三档比较法，只是计数口径从「驻扎在出发/目标省」改为「任务指向
    目标省」），乘区沿用 { friendly 1.25, contested 1.0, enemy 0.8 }。
  - CAS：攻方有 bomber 任务指向目标省 → 攻方 ×1.15、守方战损 ×1.15（现行数）。
  - 制海（仅跨海进攻时）：双方 fleet 任务指向目标省比较三档
    { 1.15 / 1.0 / 0.75 }，攻方 fleet 指向目标另叠舰炮 ×1.15。
  - supportMult 的「在场」口径同步扩展：支援单位驻扎省命中**或**任务指向
    本场相关省，都算在场（避免任务系统与在场加成互相打架）。
- 玩家决策：空军是稀缺资源，一个月只能压一个方向——「派去哪」就是决策。
  UI：省份面板支援单位行加「任务：X省」读数与改派控件（点支援单位 →
  再点地图省份设为任务目标，复用现有选省交互；或面板内下拉列相邻省份，
  实现时二选一，优先点图指派）。
- AI：每月行动前，把本月主攻目标定为任务目标：fighter/bomber 指向其
  计划进攻的目标省，fleet 指向登陆目标（无登陆则指向其驻扎省最近的敌沿海省）。
- 预估：AttackEstimate 的 modifiers 已有「空优 我方/争夺/敌方」人话行，口径不变。

## 7. 突破与追击（新玩法）

- 触发：一场进攻**获胜且决胜**——终局战力比 ≥ 2.2（与现行守军崩溃阈值同口径），
  且参战部队中有合格追击者。无合格者则不追击（步兵大胜也只能占领当面）。
- 追击者：cls ∈ {armor, motorized, cavalry} 且战后 org ≥ 30 的主攻师；
  若本场指定了矛头（§8），矛头中的合格者优先且**仅**矛头可追击
  （赌注要兑现：拿精锐撕口，精锐负责穿插）。
- 目标：被攻占省的相邻敌省中，无守军者，或守军总兵力 ≤ 追击部队总兵力 ×25%
  的弱守军省；多个候选时取守军最弱者，并列取省份 id 序（确定性，不掷骰选目标）。
- 结算：空省直接占领；弱守军打一场**一阶段速决战**（双方战力公式同正战，
  战损 ×0.5，守方败则撤退/按补给规则歼灭）；速决败则追击者留在已占省。
  追击每场正战最多 1 格，不连环追击。
- 代价：追击师 org −25（organization.ts 增 ORG_PURSUIT_COST），且当月行动已耗
  （movedTurn 已置位，不额外获得行动）。
- 数值位置：PURSUIT { minRatio 2.2, minOrg 30, orgCost 25,
  weakDefRatio 0.25, clashLossScale 0.5, classes [armor, motorized, cavalry] }。
- 战报：必须有行——「第 X 师追击占领 Y（空城）/击破弱守军」，纪事同记。
- 与包围联动：追击占领的省份在月结时自然参与补给连通重算——先撕口、再穿插、
  后合围的链条靠站位完成，不需要额外规则。
- AI：AI 的装甲/摩托化师优先编入对弱点的进攻（现行组队按兵力排序即可），
  追击自动结算对 AI 同样生效，无额外代码（除组队偏好）。

## 8. 矛头指定（新玩法）

- 规则：ATTACK 动作加可选 `spearheadIds`（参战师的子集，≤2 个）。
  矛头师：战力 ×1.35、自身战损 ×1.5、组织消耗 ×1.5（每阶段 9 点）；
  获胜时矛头**优先进驻**目标省（进驻顺序影响追击资格，见 §7）。
- 数值位置：SPEARHEAD { maxCount 2, powerMult 1.35, lossMult 1.5, orgCostMult 1.5 }。
- UI：省份面板驻军勾选行加「设为矛头」切换（★标记，最多 2 个，超出时点新替旧）；
  预估区单列矛头贡献行。决策本质：拿精锐赌突破，还是全军稳推。
- AI：估计战力比落在 [1.0, 1.6] 且队中有装甲/摩托化师时，指定最强的
  1–2 个快速师为矛头；碾压（>1.6）不赌、劣势（<1.0）不攻（现行阈值）。

## 9. 两栖登陆 → 登陆作战项目（独立命令）

- 规则：从菜单摘除，改为项目制三动作：
  - PREPARE_LANDING { divisionIds, fromProvinceId（须港口）, targetProvinceId
    （须与出发省有 seaLink） }：校验参战师都在出发港、org ≥ ORG_MIN_ATTACK、
    目标为敌方/无主沿海省；生成计划 { readyTurn = turn + 1 }，参战师**锁定**
    （筹备月内不得行军/进攻/被编组改派，相关动作回错 LANDING_LOCKED）。
  - EXECUTE_LANDING { planId }：readyTurn 起可执行（当月内有效，过期自动作废），
    按正战结算＋登陆参数：攻方基准 ×0.85、自损 ×1.3（现 amphibious 参数），
    制海三档与舰炮走 §6 的 fleet 任务口径。胜则参战师进驻目标省，败则退回
    出发港（现行跨海败退口径）。
  - CANCEL_LANDING { planId }：随时取消，解锁参战师（当月行动不恢复）。
- 可见性：计划只对发起方可见（筹备中敌方无提示——月尺度奇袭口径；
  若总管想要「筹备被侦察」机制，另立项，不在本批）。
- 失效：出发港易主、参战师被歼（所在省被攻占等）→ 月结时自动取消并纪事。
- 数值位置：LANDING { prepMonths 1, attackMult 0.85, attackerLossMult 1.3,
  defenderLossMult 1.0, seaTierMult {1.15/1.0/0.75}, fleetGunsMult 1.15 }。
- 状态：GameState 加 `landingPlans: LandingPlanState[]`；DivisionState 不加字段
  （锁定关系由计划的 divisionIds 反查）。
- UI：选中港口省己方师后，点跨海敌省时进攻区出现「筹备登陆（次月执行）」钮；
  计划就绪时出发港省份面板与纪事出提示，目标省面板出「执行登陆」钮。
- AI：现行「跨海边即选 amphibious」改为：无计划时 PREPARE（选其最强港口
  部队），就绪当月 EXECUTE；AI 同受锁定与时序约束（同规则，无后门）。

## 10. 游击袭扰 → 专属命令（保留独立结算）

- 规则：独立动作 RAID { divisionIds, targetProvinceId }，仅 guerrilla /
  eighthRoute 模板可下（其余模板回错 GUERRILLA_MODE_REQUIRES_GUERRILLA_UNIT，
  错误码沿用）。结算沿用现行 resolveRaid（成功率 0.8/驻军密集 0.45、
  工业受损 damagedMonths=2、驻军减员 5%、可小股跨海），参数迁 RAID 表。
- UI：进攻区只在参战部队含游击模板时出现「袭扰」钮，其余部队不显示
  （菜单按兵种出现/消失，而不是全员列 8 项）。

## 11. 预备与轮换（AI 行为，玩家用现有命令）

- 引擎不新增机制：前线/预备递补已在战斗内；轮换是命令层行为。
- AI 规则（ai.ts 月内行动段）：
  - 前线省（与敌相邻）己方师 org < 35 → 下 MOVE 退往最近的非前线己方省休整；
  - 后方省己方师 org ≥ 80 且前线有空缺（前线省驻军 < capacity）→ MOVE 上前线。
  - 每月每家此类轮换 ≤ 2 次，避免 AI 把行动额度耗在轮换上。
- 玩家：通过行军/驻扎自行轮换（组织恢复规则已有），面板驻军行 org 读数已有。

## 12. 数据重组（attackModes 退役映射）

| 旧 mode 字段 | 去向 |
|---|---|
| frontal_assault 三乘区 | combatSystems.ts BASE_ATTACK |
| prepared_offensive.prep | combatSystems.ts PLAN { perLayer 0.12, maxLayers 3 } |
| fortified_defense.fortify | combatSystems.ts FORTIFY { perLayer 0.12, maxLayers 3 } |
| encirclement.unsuppliedDefMult + encircleDestroy | combatSystems.ts ENCIRCLEMENT |
| infiltration.hal
...[truncated 3010 chars]