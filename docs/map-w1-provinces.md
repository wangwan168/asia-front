# W1 省份划分定版清单（州 54 / 省 197）

划分依据：1936 年真实行政区骨架——中国按省+大省细分（四川/河北/山东等拆 4–6 省）、
日本本土按地方、朝鲜按道、台湾按州；东南亚按殖民地邦/省；苏联远东/蒙古/印度东部/菲律宾/印尼北部边缘同理。
几何：省质心取所代城市真实经纬度 → Voronoi 分区 → 以 Natural Earth 真实国境线裁剪；
相邻=共享边界（多边形实测相接）+ 海峡陆路连接 7 对 + 跨海航线边 47 对；渡河边 13 条（见 provinces.ts RIVER_CROSSINGS）。
经济层：工业/人力/资源按省存放、州为汇总视图（UI 省份卡显示州合计）；省层只承载地形/驻军/相邻。

跨海航线边 47 对、海峡陆路连接 7 对、渡河边 13 条。

## 辽宁（liaoning，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 沈阳 `shenyang` | city | manchukuo | 14 | 6000 | steel30 |
| 大连 `dalian` | port | manchukuo | 6 | 3500 | — |
| 安东 `andong` | port | manchukuo | 2 | 2000 | — |
| 辽西 `liaoxi` | plain | manchukuo | 2 | 3000 | — |

## 吉林（jilin，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 长春 `changchun` | city | manchukuo | 8 | 4500 | — |
| 吉林 `jilin` | city | manchukuo | 4 | 3000 | — |
| 延边 `yanbian` | mountain | manchukuo | 1 | 2000 | — |

## 黑龙江（heilongjiang，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 哈尔滨 `harbin` | city | manchukuo | 8 | 5000 | food25 |
| 黑河 `heihe` | plain | manchukuo | 1 | 1500 | — |
| 牡丹江 `mudanjiang` | mountain | manchukuo | 2 | 2500 | — |

## 热河（rehe，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 承德 `chengde` | mountain | manchukuo | 2 | 2500 | — |
| 朝阳 `chaoyang` | mountain | manchukuo | 1 | 2000 | — |

## 河北（hebei，6 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 北平 `beiping` | city | roc | 6 | 7000 | — |
| 天津 `tianjin` | port | roc | 8 | 6000 | — |
| 石家庄 `shijiazhuang` | plain | warlords | 3 | 5000 | — |
| 保定 `baoding` | plain | warlords | 2 | 4500 | — |
| 唐山 `tangshan` | city | roc | 4 | 4000 | steel10 |
| 邯郸 `handan` | plain | warlords | 2 | 4500 | — |

## 山东（shandong，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 济南 `jinan` | city | warlords | 5 | 6000 | — |
| 青岛 `qingdao` | port | warlords | 5 | 4000 | — |
| 烟台 `yantai` | port | warlords | 2 | 3000 | — |
| 临沂 `linyi` | mountain | warlords | 1 | 4000 | — |

## 山西（shanxi，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 太原 `taiyuan` | mountain | warlords | 6 | 4000 | steel15 |
| 大同 `datong` | mountain | warlords | 2 | 2500 | — |
| 临汾 `linfen` | mountain | warlords | 1 | 3000 | — |

## 绥远（suiyuan，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 归绥 `hohhot` | city | warlords | 2 | 2000 | — |
| 包头 `baotou` | plain | warlords | 2 | 1500 | — |

## 察哈尔（chahar，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 张家口 `zhangjiakou` | mountain | warlords | 2 | 2000 | — |
| 多伦 `duolun` | plain | warlords | 1 | 1200 | — |

## 陕西（shaanxi，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 延安 `yanan` | mountain | ccp | 1 | 2500 | — |
| 西安 `xian` | city | roc | 4 | 5000 | — |
| 宝鸡 `baoji` | plain | roc | 1 | 3000 | — |
| 汉中 `hanzhong` | mountain | roc | 1 | 3000 | — |

## 甘肃（含宁夏）（gansu，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 兰州 `lanzhou` | city | warlords | 3 | 3000 | — |
| 天水 `tianshui` | mountain | warlords | 1 | 2500 | — |
| 武威 `wuwei` | plain | warlords | 1 | 2000 | — |
| 银川 `yinchuan` | plain | warlords | 1 | 1500 | — |
| 阿拉善 `alashan` | desert | warlords | 0 | 500 | — |

## 青海（qinghai，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 西宁 `xining` | mountain | warlords | 1 | 1500 | — |
| 格尔木 `golmud` | desert | warlords | 0 | 300 | — |

## 新疆（xinjiang，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 迪化 `urumqi` | city | warlords | 2 | 1500 | — |
| 喀什 `kashgar` | desert | warlords | 1 | 2000 | — |
| 哈密 `hami` | desert | warlords | 1 | 800 | — |
| 伊犁 `yili` | plain | warlords | 1 | 1200 | — |
| 阿勒泰 `altay` | mountain | warlords | 0 | 600 | — |

## 河南（henan，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 郑州 `zhengzhou` | plain | roc | 4 | 7000 | food20 |
| 洛阳 `luoyang` | plain | roc | 3 | 5000 | — |
| 开封 `kaifeng` | plain | roc | 2 | 5000 | — |
| 南阳 `nanyang` | plain | roc | 2 | 6000 | — |
| 信阳 `xinyang` | mountain | roc | 1 | 4000 | — |

## 江苏（jiangsu，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 南京 `nanjing` | city | roc | 8 | 6000 | — |
| 上海 `shanghai` | port | roc | 12 | 9000 | — |
| 苏州 `suzhou` | city | roc | 5 | 6000 | — |
| 徐州 `xuzhou` | plain | roc | 3 | 5500 | — |
| 连云港 `lianyungang` | port | roc | 2 | 2500 | — |

## 安徽（anhui，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 合肥 `hefei` | city | roc | 3 | 4500 | — |
| 蚌埠 `bengbu` | plain | roc | 2 | 4000 | — |
| 安庆 `anqing` | plain | roc | 2 | 4000 | — |
| 淮南 `huainan` | plain | roc | 2 | 3000 | steel8 |

## 浙江（zhejiang，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 杭州 `hangzhou` | port | roc | 6 | 5500 | — |
| 宁波 `ningbo` | port | roc | 4 | 4000 | — |
| 温州 `wenzhou` | port | roc | 2 | 4000 | — |
| 金华 `jinhua` | mountain | roc | 1 | 4000 | — |

## 福建（fujian，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 福州 `fuzhou` | port | roc | 3 | 4000 | — |
| 厦门 `xiamen` | port | roc | 3 | 2500 | — |
| 泉州 `quanzhou` | port | roc | 2 | 4000 | — |
| 龙岩 `longyan` | mountain | roc | 1 | 3000 | — |

## 湖北（hubei，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 武汉 `wuhan` | city | roc | 8 | 7000 | steel10 |
| 宜昌 `yichang` | mountain | roc | 2 | 3000 | — |
| 襄阳 `xiangyang` | plain | roc | 2 | 3500 | — |
| 恩施 `enshi` | mountain | roc | 1 | 2500 | — |

## 湖南（hunan，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 长沙 `changsha` | city | roc | 4 | 5000 | food15 |
| 衡阳 `hengyang` | plain | roc | 2 | 4000 | — |
| 常德 `changde` | plain | roc | 2 | 4000 | — |
| 邵阳 `shaoyang` | mountain | roc | 1 | 3500 | — |

## 江西（jiangxi，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 南昌 `nanchang` | city | roc | 3 | 4000 | — |
| 九江 `jiujiang` | city | roc | 2 | 3000 | — |
| 赣州 `ganzhou` | mountain | roc | 1 | 3500 | — |
| 吉安 `jian` | mountain | roc | 1 | 3000 | — |

## 广东（guangdong，6 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 广州 `guangzhou` | port | roc | 9 | 7000 | — |
| 香港 `hongkong` | port | uk | 4 | 3000 | — |
| 汕头 `shantou` | port | roc | 3 | 3500 | — |
| 海南 `hainan` | island | roc | 1 | 2500 | rubber8 |
| 韶关 `shaoguan` | mountain | roc | 1 | 3000 | — |
| 湛江 `zhanjiang` | port | roc | 1 | 2500 | — |

## 广西（guangxi，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 南宁 `nanning` | city | roc | 2 | 3500 | — |
| 柳州 `liuzhou` | mountain | roc | 2 | 3000 | — |
| 桂林 `guilin` | mountain | roc | 1 | 3000 | — |
| 北海 `beihai` | port | roc | 1 | 1500 | — |

## 四川（sichuan，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 成都 `chengdu` | city | warlords | 6 | 9000 | food20 |
| 重庆 `chongqing` | mountain | warlords | 6 | 8000 | — |
| 泸州 `luzhou` | city | warlords | 2 | 4500 | — |
| 宜宾 `yibin` | city | warlords | 2 | 4000 | — |
| 西康 `xikang` | mountain | warlords | 1 | 1500 | — |

## 云南（yunnan，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 昆明 `kunming` | mountain | warlords | 3 | 3500 | — |
| 大理 `dali` | mountain | warlords | 1 | 2000 | — |
| 蒙自 `mengzi` | mountain | warlords | 1 | 1500 | — |

## 贵州（guizhou，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 贵阳 `guiyang` | mountain | roc | 2 | 2500 | — |
| 遵义 `zunyi` | mountain | roc | 1 | 2500 | — |

## 西藏（xizang，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 拉萨 `lhasa` | mountain | roc | 0 | 800 | — |
| 日喀则 `xigaze` | mountain | roc | 0 | 600 | — |

## 台湾（taiwan，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 台北 `taipei` | port | japan | 4 | 3500 | food15 |
| 台中 `taichung` | plain | japan | 2 | 3000 | — |
| 高雄 `kaohsiung` | port | japan | 3 | 3000 | — |

## 朝鲜（korea，6 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 平壤 `pyongyang` | city | japan | 4 | 3500 | — |
| 咸兴 `hamhung` | port | japan | 3 | 2500 | — |
| 新义州 `sinuiju` | port | japan | 2 | 2000 | — |
| 汉城 `seoul` | city | japan | 5 | 4500 | — |
| 釜山 `pusan` | port | japan | 4 | 3500 | — |
| 大邱 `daegu` | city | japan | 2 | 3000 | — |

## 北海道（hokkaido，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 札幌 `sapporo` | city | japan | 3 | 2500 | — |
| 函馆 `hakodate` | port | japan | 2 | 1800 | — |
| 旭川 `asahikawa` | plain | japan | 1 | 1500 | — |

## 东北（日本）（tohoku，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 仙台 `sendai` | city | japan | 3 | 3000 | — |
| 青森 `aomori` | port | japan | 2 | 1800 | — |
| 秋田 `akita` | plain | japan | 1 | 2000 | oil5 |
| 盛冈 `morioka` | plain | japan | 1 | 1800 | — |

## 关东（日本）（kanto，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 东京 `tokyo` | port | japan | 16 | 8000 | — |
| 横滨 `yokohama` | port | japan | 8 | 5000 | — |
| 长野 `nagano` | mountain | japan | 2 | 2500 | — |
| 新潟 `niigata` | port | japan | 3 | 2500 | — |

## 中部（chubu，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 名古屋 `nagoya` | city | japan | 9 | 5000 | — |
| 静冈 `shizuoka` | city | japan | 3 | 3000 | — |
| 金泽 `kanazawa` | city | japan | 2 | 2200 | — |
| 富山 `toyama` | city | japan | 2 | 2000 | — |

## 近畿（kinki，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 大阪 `osaka` | port | japan | 12 | 6000 | — |
| 京都 `kyoto` | city | japan | 5 | 3500 | — |
| 神户 `kobe` | port | japan | 6 | 3500 | — |

## 中国·四国（chugoku，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 广岛 `hiroshima` | city | japan | 5 | 3000 | — |
| 冈山 `okayama` | city | japan | 3 | 2500 | — |
| 下关 `shimonoseki` | port | japan | 2 | 1500 | — |
| 松山 `matsuyama` | city | japan | 2 | 2000 | — |
| 高松 `takamatsu` | port | japan | 2 | 1800 | — |

## 九州（kyushu，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 长崎 `nagasaki` | port | japan | 5 | 3000 | — |
| 福冈 `fukuoka` | city | japan | 5 | 3500 | — |
| 鹿儿岛 `kagoshima` | port | japan | 2 | 2200 | — |
| 大分 `oita` | port | japan | 1 | 1800 | — |

## 蒙古（mongolia，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 乌兰巴托 `ulaanbaatar` | city | mongolia | 1 | 1200 | — |
| 乌兰固木 `ulaangom` | plain | mongolia | 0 | 600 | — |
| 乔巴山 `choibalsan` | plain | mongolia | 0 | 600 | — |

## 滨海边疆（primorye，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 海参崴 `vladivostok` | port | ussr | 4 | 2500 | — |
| 伯力 `khabarovsk` | city | ussr | 3 | 2200 | — |
| 海兰泡 `blagoveshchensk` | plain | ussr | 1 | 1200 | — |
| 萨哈林 `sakhalin` | island | ussr | 1 | 800 | oil25 |

## 东西伯利亚（siberia，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 赤塔 `chita` | mountain | ussr | 2 | 1500 | — |
| 伊尔库茨克 `irkutsk` | city | ussr | 3 | 2000 | — |
| 雅库茨克 `yakutsk` | plain | ussr | 1 | 800 | — |

## 上缅甸（upper_burma，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 曼德勒 `mandalay` | city | uk | 3 | 3000 | oil20 |
| 腊戍 `lashio` | mountain | uk | 1 | 1500 | — |
| 密支那 `myitkyina` | jungle | uk | 1 | 1200 | — |

## 下缅甸（lower_burma，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 仰光 `rangoon` | port | uk | 4 | 3500 | food20 |
| 毛淡棉 `mawlamyine` | port | uk | 1 | 1500 | — |
| 实兑 `sittwe` | port | uk | 1 | 1500 | — |

## 英属印度（british_india，5 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 德里 `delhi` | city | uk | 5 | 6000 | — |
| 加尔各答 `calcutta` | port | uk | 7 | 7000 | — |
| 巴特那 `patna` | city | uk | 3 | 6000 | — |
| 达卡 `dhaka` | city | uk | 3 | 5000 | — |
| 吉大港 `chittagong` | port | uk | 2 | 2500 | — |

## 暹罗北部（siam_north，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 清迈 `chiangmai` | jungle | thailand | 1 | 2000 | — |
| 彭世洛 `phitsanulok` | plain | thailand | 1 | 2000 | — |

## 暹罗中部（siam，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 曼谷 `bangkok` | port | thailand | 4 | 4000 | food45 |
| 呵叻 `korat` | plain | thailand | 2 | 2500 | food15 |
| 宋卡 `songkhla` | port | thailand | 1 | 1500 | rubber15 |

## 北圻（tonkin，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 河内 `hanoi` | city | france | 4 | 4500 | — |
| 海防 `haiphong` | port | france | 3 | 3000 | — |
| 谅山 `langson` | mountain | france | 1 | 1500 | — |

## 老挝（laos，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 万象 `vientiane` | jungle | france | 1 | 1200 | — |
| 琅勃拉邦 `luangprabang` | jungle | france | 0 | 800 | — |

## 安南·南圻（annan，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 顺化 `hue` | port | france | 2 | 2500 | — |
| 岘港 `danang` | port | france | 2 | 2000 | — |
| 西贡 `saigon` | port | france | 5 | 4500 | rubber25 |
| 金边 `phnompenh` | city | france | 2 | 2500 | — |

## 马来亚（malaya，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 吉隆坡 `kualalumpur` | jungle | uk | 3 | 2500 | rubber50 |
| 新加坡 `singapore` | port | uk | 5 | 3000 | — |
| 槟城 `penang` | port | uk | 2 | 1800 | — |
| 怡保 `ipoh` | jungle | uk | 2 | 1800 | steel6 |

## 苏门答腊（sumatra，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 棉兰 `medan` | port | netherlands | 3 | 2500 | oil40 rubber20 |
| 巨港 `palembang` | port | netherlands | 3 | 2500 | oil20 |
| 巴东 `padang` | port | netherlands | 1 | 1800 | — |
| 亚齐 `aceh` | jungle | netherlands | 1 | 1500 | — |

## 爪哇（java，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 巴达维亚 `jakarta` | port | netherlands | 6 | 4500 | — |
| 泗水 `surabaya` | port | netherlands | 4 | 3500 | — |
| 三宝垄 `semarang` | port | netherlands | 3 | 3000 | — |
| 万隆 `bandung` | city | netherlands | 3 | 3000 | — |

## 婆罗洲（borneo，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 巴厘巴板 `balikpapan` | port | netherlands | 3 | 1500 | oil60 |
| 坤甸 `pontianak` | port | netherlands | 1 | 1500 | rubber15 |
| 班贾尔马辛 `bandjarmasin` | port | netherlands | 1 | 1500 | — |
| 打拉根 `tarakan` | port | netherlands | 1 | 800 | oil15 |

## 吕宋（luzon，4 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 马尼拉 `manila` | port | philippines | 5 | 4500 | — |
| 碧瑶 `baguio` | mountain | philippines | 1 | 1500 | — |
| 土格加劳 `tuguegarao` | plain | philippines | 1 | 2000 | — |
| 黎牙实比 `legazpi` | port | philippines | 1 | 1500 | — |

## 棉兰老（mindanao，3 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 达沃 `davao` | port | philippines | 2 | 2000 | — |
| 卡加延 `cagayan` | port | philippines | 1 | 1500 | — |
| 三宝颜 `zamboanga` | port | philippines | 1 | 1200 | — |

## 太平洋诸岛（pacific，2 省）

| 省 | 地形 | 1936 归属 | 工业 | 人力 | 资源 |
|---|---|---|---|---|---|
| 关岛 `guam` | island | usa | 1 | 500 | — |
| 檀香山 `honolulu` | port | usa | 3 | 2000 | — |
