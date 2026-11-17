# 样机单位模型授权（已换用项目自有模型库）

全部模型取自项目自有模型库 `~/workspace/ww2-asia/assets/models/`（美术线交付，台账 C3/C4），
总授权汇编见 `assets/LICENSES.md`。要点：

| 文件 | 用途 | 来源与授权 |
|---|---|---|
| infantry_ww2.glb + infantry_{roc,ccp,japan,usa,uk}.glb | 步兵系（按势力涂装变体） | 底模 Rigged Lowpoly WW2 Soldier（OpenGameArt，**CC0**）；idle/march/attack/die 动画、步枪、五家涂装均为美术线自建 |
| cavalry_ussr.glb | 苏军骑兵 | 美术线自建（Blender 脚本 build_cavalry.py） |
| tank_light / tank_medium / t34 / sherman / type95 .glb | 装甲（按势力选型） | 美术线自建（build_tank*.py） |
| fighter_zero.glb / bomber.glb | 战斗机 / 轰炸机 | 美术线自建（build_fighter.py / build_gun_bomber.py） |
| destroyer / cruiser / carrier / transport .glb | 舰队编成 | 美术线自建（build_destroyer.py / build_ships2.py） |
| artillery.glb | 火炮（游戏暂无对应编制，随库备存、样机未摆） | 美术线自建 |

注：样机早期版本曾临时用 Quaternius/Kenney 通用包，已按总管纠错令全部撤下删除
（其原始包不在本目录留存；项目自有库 opensource/ 内的同名文件是美术线风格参考件，与样机无关）。
