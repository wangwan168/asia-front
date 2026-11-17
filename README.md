# 亚洲战场（Asia Front）

二战亚洲战场大战略游戏：1936 年 1 月开局，18 个势力可选，196 个省份的真实地理地图，
月回合制。参考《钢铁雄心》机制设计（借机制、不照搬），战斗由筹备/补给/地形/兵种
特性等系统共同决定，支持包围歼灭、矛头突破、空军任务、登陆作战与突破追击。

## 本地版安装（Windows，唯一正式版）

1. 下载免安装版 `AsiaFront-Portable-1.0.0.zip`，解压到任意目录，双击其中
   的「亚洲战场.exe」运行。（NSIS 安装包 `AsiaFront-Setup-1.0.0.exe` 在 Windows
   构建机上用同一工程一条命令产出，见下「本地版打包」。）
2. 首次点击任意处后配乐开始播放（浏览器内核的自动播放规则，本地版同理）。
3. 存档保存在应用数据目录（Chromium 本地存储，随应用走），游戏内「纪事」面板有
   3 个手动槽＋自动存档；纪事面板另有存档 JSON 导出/导入，可作备份。

## 旧网页版（已停更）

asia-front.pages.dev 上的旧网页版已停止更新，仅保留至下线；正式玩法以本地版为准。

## 从源码运行（开发）

环境：Node.js 20+。

```bash
cd game
npm install
npm run dev        # 开发服务器（浏览器调试用）
npm test           # 单元测试
npm run build      # 构建到 dist/（Electron 打包的输入）
```

本地版打包（Electron，Linux 侧交叉打包 Windows）：

```bash
cd game && npm run build
cd ../electron
npm install
npm run dist       # 产出 Windows 安装包与免安装版（electron/release/）
```

## 目录说明

- `game/` — 游戏本体（Vite + TypeScript，引擎在 `src/core`，数据在 `src/data`）
- `terrain3d-demo/` — 3D 地形样机（Three.js，正式版渲染层的前身）
- `assets/` — 全部美术/音频素材（授权见 `assets/LICENSES.md`、`assets/audio/AUDIO-LIST.md`）
- `ASSET-REGISTRY.md` — 素材统一登记册（唯一口径）
- `docs/` — 设计稿、验收截图与回执证据

## 素材与授权

- 3D 模型、UI、图标均为项目自建或 CC0/公有领域素材，逐项登记在登记册中。
- 配乐为公有领域录音（美军军乐团演奏的苏萨进行曲、瓦格纳、肖邦），音效全部自制合成。
- 地形高程数据：AWS Terrain Tiles（SRTM/GEBCO 系，公有领域）。
