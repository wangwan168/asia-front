# 音频系统设计（代码侧 · 待素材接入）

总管预告令 2026-11-16 下达。素材由美术侧生产/选材（配乐 3 类＋音效 5 类，CC0/自制），
交付后登记 ASSET-REGISTRY 音频类；本设计先行，素材到位按本稿接入，不改引擎结算。

## 1. 引擎（src/ui/audio.ts，纯 UI 层）

- WebAudio：AudioContext 懒初始化；两条通道 GainNode（music / sfx）→ master GainNode → destination。
- 配乐走 `<audio>` 元素经 MediaElementAudioSourceNode 接入 music 通道（长曲流式、省内存、可淡入淡出）；
  音效走 AudioBuffer 解码后 BufferSource 播放（低延迟、可叠加、带 50ms 同槽节流）。
- 设置存 localStorage `asia-front-audio`：{ musicVol: 0.5, sfxVol: 0.8, muted: false }；
  UI 入口放顶栏「菜单 ☰」下拉（音乐音量/音效音量滑杆＋静音开关）。
- 自动播放限制：全局 pointerdown 一次性监听 → 初始化 AudioContext 并淡入配乐（1.5s 线性 ramp）；
  选国页第一次点击即满足。页面 hidden 时 suspend，visible 恢复（仅已启动后）。
- 素材清单常量 AUDIO_ASSETS 集中一处，路径以 ASSET-REGISTRY 音频类登记为准，接入时锁定；
  缺文件时对应槽静默跳过（不报错、不阻塞游戏）。

## 2. 配乐轮换

- 槽位：MUS_MENU（选国/主菜单）/ MUS_MAIN（主界面氛围，2–3 文件随机轮换，播完换下一首、不连播同一首，切换 2s 交叉淡化）/
  MUS_TENSION（主界面类内可选文件：近 2 回合玩家相关战斗 ≥3 场时切入，静默 1 回合后切回）/
  MUS_END（胜负结算覆盖：winner 确定后淡出轮换、播结算曲，胜利/战败各一文件，若只交付一首则共用）。
- 游戏结束（phase 变化/winner 出现）后停轮换；重开一局回 MUS_MAIN。

## 3. 挂钩点清单（全部只读：dispatch 结果、log 差分、prevOwners 差分；不改 applyAction/结算）

接缝总纲：main.ts 的 dispatch() 是全部动作的唯一入口（成功换 state、失败带 res.error）；
END_TURN 后果靠「log 数组差分（kind: battle/event/diplomacy/economy）＋省份 owner 差分
（UI 层已有 prevOwners 快照）」判定。UI 声音走 DOM 事件委托，不逐按钮埋点。

| # | 挂钩点 | 触发接缝 | 判定口径（只读） | 音效槽 |
|---|---|---|---|---|
| 1 | 按钮/页签/面板 UI 音 | .af-rail 页签钮、抽屉开关、菜单项的委托 click 监听 | 点击即响（50ms 节流） | SFX_UI（电台咔哒） |
| 2 | 省份选中 | onProvinceClick 选中成功（信息卡打开） | 选中省变化时 | SFX_UI 低音量变体 |
| 3 | 下令成功（行军/驻扎/编组/生产/科研/国策/外交常规） | dispatch() 返回 true 且非战斗类动作 | res.error 为空 | SFX_CONFIRM |
| 4 | 下令失败 | dispatch() 返回 false；及点图 failReason 提示路径 | res.error 非空 / failReason 非空 | SFX_REJECT 驳回音（SFX_CONFIRM 类内变调） |
| 5 | 进攻下令（ATTACK/RAID/EXECUTE_LANDING） | dispatch 成功且动作类型 ∈ 三者 | — | SFX_CONFIRM 加重变体＋SFX_BATTLE 炮火底 |
| 6 | 战斗结算（玩家进攻） | 上条 dispatch 前后 log 差分新增 kind=battle 条目 | 结果档：目标省 owner 变为玩家=攻克（捷报）；未变且参战师存活=未克；参战师被歼≥1=惨败档；含「追击」=大捷档上扬 | SFX_BATTLE（炮火＋胜/败音） |
| 7 | 战斗结算（回合内 AI 战，含玩家防守） | END_TURN 后 log 差分 kind=battle 且条目涉及玩家势力/玩家省份 | 玩家省份 owner 丢失=失守档；守住=守住档；非玩家战斗不响 | SFX_BATTLE 低音量 |
| 8 | 省份得失（非战斗途径/事件移交等兜底） | prevOwners 差分：玩家省数增/减 | 增=得省、减=失省（与 #6/#7 同回合去重，战斗已响的省份不重复） | SFX_BATTLE 胜/败音复用 |
| 9 | 事件弹出 | END_TURN 后 log 差分新增 kind=event 条目 | 有新事件即响；势力生成/宣战类事件加重 | SFX_EVENT（电报声） |
| 10 | 宣战 | dispatch DIPLOMACY(actionId=declareWar) 成功；或 END_TURN 后 log 出现对玩家宣战 | 己方宣战/被宣战同槽 | SFX_WAR（鼓点重音） |
| 11 | 回合结束 | END_TURN 钮点击、dispatch 发起时 | 先响翻页音，后果音（#7/#8/#9）在结算完成后按序排队（间隔 150ms 串行，不叠） | SFX_UI 变体（翻页/印章） |
| 12 | 胜负结算 | render 时 state.winner/phase 变化 | 胜利/战败各一 | MUS_END 覆盖播放＋停轮换 |

排队与去重：同一 dispatch 产生的后果音走一个小队列串行播放（≤3 个、间隔 150ms），
战斗音优先于事件音；静音/未初始化（首次交互前）时全部跳过。

## 4. 素材槽位（待美术交付后按登记册锁定文件名）

- 配乐 3 类 → MUS_MENU ×1、MUS_MAIN ×2–3（紧张曲若有编入 MUS_TENSION）、MUS_END ×1–2。
- 音效 5 类 → SFX_UI、SFX_CONFIRM（含驳回变调）、SFX_BATTLE（炮火＋胜负）、SFX_EVENT、SFX_WAR。
- 格式建议：配乐 mp3/ogg、单首 ≤4MB、可循环段落；音效 ≤2s、mp3/ogg。
  若交付类目与槽位不完全对应，接入回执里报映射表请总管确认，不擅自改类目。

## 5. 不做

- 不改引擎/结算/存档结构（STATE_VERSION 不动）；不给 AI 动作单独埋点（后果统一走 log 差分）；
- 不做 3D 样机音频；不做语音/旁白。
