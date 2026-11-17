# 《亚洲战场》素材统一登记册（唯一口径）

总管维护，2026-11-16 建立。**本册是素材的唯一真相**：美术产出以本册登记为准，代码取材以本册路径为准。
与本册冲突的旧说法（包括任何回执里的「缺口清单」）一律作废。

## 铁规（用户 2026-11-16 令「你要统一好」）
1. 代码侧（含样机）：需要任何素材，**先查本册**；本册有的必须用本册的，禁止另找外部包顶替。
2. 引入外部素材（开源包等）前，必须先确认本册无同类、并报总管登记授权后才可使用。
3. 美术侧：新产出交付时同步报总管登记（路径＋用途＋授权），未登记不算交付。
4. 总管验收：凡回执提到素材/缺口，先对本册与 `assets/` 实物核对再转述用户。

## 一、3D 模型（assets/models/，美术自建，授权见 assets/LICENSES.md）
| 文件 | 内容 | 状态 |
|---|---|---|
| infantry_ww2.glb | 二战步兵（CC0 底模＋自建 idle/march/attack/die 动画＋步枪） | 待接入（3D 正式版） |
| infantry_roc.glb / infantry_japan.glb / infantry_ccp.glb / infantry_usa.glb / infantry_uk.glb | 五家势力涂装变体 | 待接入 |
| tank_light.glb / tank_medium.glb | 轻/中型坦克（注：tank_light 为占位版自建，美术记录口径，正式版前可重做） | 待接入 |
| t34.glb / sherman.glb / type95.glb | T-34 / 谢尔曼 / 九五式 | 待接入 |
| fighter_zero.glb / bomber.glb | 零式 / 轰炸机 | 待接入 |
| destroyer.glb / cruiser.glb / carrier.glb / transport.glb | 驱逐/巡洋/航母/运输船 | 待接入 |
| artillery.glb / cavalry_ussr.glb | 火炮 / 苏军骑兵 | 待接入（炮兵待游戏侧立项） |
| opensource/ | 第三方原始包存档（soldier_oga、quaternius_tank 等） | 仅存档，非取材口 |

## 二、地图层（assets/tiles/）
| 素材 | 状态 |
|---|---|
| basemap_sat_2x/1x（卫星底图源） | 已接入（游戏内同源重渲染版 basemap_sat.webp） |
| terrain_*.png ×8（plains/forest/hills/mountain/jungle/desert/marsh/urban 底纹）＋ legend_*.png ×8 图例 | 已接入（丰富化批，2026-11-16，smoke_enrich 12/12） |
| rivers.svg / rivers.json | 已接入（丰富化批） |
| graticule.svg（经纬网）＋ sea_labels.json（14 海域名） | 已接入（丰富化批） |
| markers/res_*_map.png ×4（油/钢/橡胶/粮 资源点） | 已接入（丰富化批） |
| markers/combat_*.png ×5（attack/encircle/landing/airraid/guerrilla） | 已接入（丰富化批 C5） |
| markers/marker_capital/port/city/major_city.png | 已接入（首都/港口）；city/major_city 随标签体系在用 |
| markers/marker_airfield/fortress.png | 待接入（A4，引擎暂无对应系统，登记原因） |

## 三、UI（assets/ui/）
| 素材 | 状态 |
|---|---|
| flags ×19 | 已接入 18（西藏旗无对应势力） |
| leaders ×18（油画版）＋ *_photo.png 备份 ×2 | 已接入 |
| 顶栏资源图标 ×5＋功能图标（橡胶已补，13/13） | 已接入 |
| badges/ 师与支援徽记 13 种 | 已接入 |
| D 系列皮肤（栏板/方钮/tab/结束回合钮/框体 border-image，依 SKIN.md） | 已接入 |
| D3–D6 背景（主菜单/选国/胜负/加载） | 已接入 |

## 四、3D 样机（terrain3d-demo/）
- 地形：AWS Terrain Tiles 高程（公有领域）＋现行地图贴图，已验证。
- 单位：**必须换用本册第一节自有模型**（纠错令 2026-11-16 已下，执行中）；样机此前误用的 Quaternius/Kenney 通用包模型只作废弃对照，不进任何正式口径。

## 五、音频（assets/audio/，2026-11-16 交付，清单 AUDIO-LIST.md）
| 素材 | 状态 |
|---|---|
| music_menu.ogg（瓦格纳《齐格弗里德葬礼进行曲》，公有领域录音，80s 循环） | **待接入**（音频系统批） |
| music_war_1/2/3.ogg（苏萨进行曲×3，美军乐团公有领域录音，循环） | 待接入 |
| music_victory.ogg / music_defeat.ogg（结算短乐各 14s） | 待接入 |
| sfx_*.ogg ×18（UI/下令/战斗/得失/事件/宣战/停战/空袭，全自制合成零采样）＋ amb_hq_loop.ogg（指挥室底噪） | 待接入 |
| 试听包 audio_audition_pack.zip | 待总管/用户试听定版 |

## 六、真实缺口（对本册核对后成立的，只有这些）
- 无。其余「缺口」说法未经核对不得上报。
