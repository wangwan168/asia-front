#!/usr/bin/env python3
# 《亚洲战场》地图生成器（W1/W2）：1936 行政区骨架 → 经纬度质心 → Voronoi 省界
# → 以真实国境线（Natural Earth, tools/countries.geo.json）裁剪 → 输出
# src/data/provinces.ts + src/data/states.ts。重跑即重生成，勿手改生成文件。
import json, math, sys
from scipy.spatial import Voronoi
from shapely.geometry import Polygon, MultiPolygon, Point, box
from shapely.ops import unary_union

# ---- 州（state）：1936 行政/地理层。省归州，州汇总工业/人口/资源（视图层聚合）----
STATES = [
    # id, 名称
    ("liaoning", "辽宁"), ("jilin", "吉林"), ("heilongjiang", "黑龙江"), ("rehe", "热河"),
    ("hebei", "河北"), ("shandong", "山东"), ("shanxi", "山西"), ("suiyuan", "绥远"),
    ("chahar", "察哈尔"), ("shaanxi", "陕西"), ("gansu", "甘肃（含宁夏）"), ("qinghai", "青海"),
    ("xinjiang", "新疆"), ("henan", "河南"), ("jiangsu", "江苏"), ("anhui", "安徽"),
    ("zhejiang", "浙江"), ("fujian", "福建"), ("hubei", "湖北"), ("hunan", "湖南"),
    ("jiangxi", "江西"), ("guangdong", "广东"), ("guangxi", "广西"), ("sichuan", "四川"),
    ("yunnan", "云南"), ("guizhou", "贵州"), ("xizang", "西藏"), ("taiwan", "台湾"),
    ("korea", "朝鲜"), ("hokkaido", "北海道"), ("tohoku", "东北（日本）"), ("kanto", "关东（日本）"),
    ("chubu", "中部"), ("kinki", "近畿"), ("chugoku", "中国·四国"), ("kyushu", "九州"),
    ("mongolia", "蒙古"), ("primorye", "滨海边疆"), ("siberia", "东西伯利亚"),
    ("upper_burma", "上缅甸"), ("lower_burma", "下缅甸"), ("british_india", "英属印度"),
    ("siam_north", "暹罗北部"), ("siam", "暹罗中部"), ("tonkin", "北圻"), ("laos", "老挝"),
    ("annan", "安南·南圻"), ("malaya", "马来亚"), ("sumatra", "苏门答腊"), ("java", "爪哇"),
    ("borneo", "婆罗洲"), ("luzon", "吕宋"), ("mindanao", "棉兰老"), ("pacific", "太平洋诸岛"),
]

# ---- 省（province）：id, 名称, 州, 纬度, 经度, 地形, 1936归属, 工业, 军工占比, 人力, 资源 ----
# 地形口径：节点所代地区主导地貌（审计成果）；城市/港口按功能记 city/port。
P = [
    # 辽宁（满洲国）
    ("shenyang", "沈阳", "liaoning", 41.8, 123.4, "city", "manchukuo", 14, 0.8, 6000, {"steel": 30}),
    ("dalian", "大连", "liaoning", 38.9, 121.6, "port", "manchukuo", 6, 0.5, 3500, None),
    ("andong", "安东", "liaoning", 40.0, 124.5, "port", "manchukuo", 2, 0.3, 2000, None),
    ("liaoxi", "辽西", "liaoning", 41.1, 121.2, "plain", "manchukuo", 2, 0.3, 3000, None),
    # 吉林（满洲国）
    ("changchun", "长春", "jilin", 43.9, 125.3, "city", "manchukuo", 8, 0.6, 4500, None),
    ("jilin", "吉林", "jilin", 43.8, 126.6, "city", "manchukuo", 4, 0.4, 3000, None),
    ("yanbian", "延边", "jilin", 42.9, 129.5, "mountain", "manchukuo", 1, 0.3, 2000, None),
    # 黑龙江（满洲国）
    ("harbin", "哈尔滨", "heilongjiang", 45.8, 126.5, "city", "manchukuo", 8, 0.5, 5000, {"food": 25}),
    ("heihe", "黑河", "heilongjiang", 50.2, 127.5, "plain", "manchukuo", 1, 0.3, 1500, None),
    ("mudanjiang", "牡丹江", "heilongjiang", 44.6, 129.6, "mountain", "manchukuo", 2, 0.4, 2500, None),
    # 热河（满洲国）
    ("chengde", "承德", "rehe", 41.0, 117.9, "mountain", "manchukuo", 2, 0.3, 2500, None),
    ("chaoyang", "朝阳", "rehe", 41.6, 120.4, "mountain", "manchukuo", 1, 0.3, 2000, None),
    # 河北
    ("beiping", "北平", "hebei", 39.9, 116.4, "city", "roc", 6, 0.4, 7000, None),
    ("tianjin", "天津", "hebei", 39.1, 117.2, "port", "roc", 8, 0.5, 6000, None),
    ("shijiazhuang", "石家庄", "hebei", 38.0, 114.5, "plain", "warlords", 3, 0.4, 5000, None),
    ("baoding", "保定", "hebei", 38.9, 115.5, "plain", "warlords", 2, 0.3, 4500, None),
    ("tangshan", "唐山", "hebei", 39.6, 118.2, "city", "roc", 4, 0.6, 4000, {"steel": 10}),
    ("handan", "邯郸", "hebei", 36.6, 114.5, "plain", "warlords", 2, 0.3, 4500, None),
    # 山东（军阀）
    ("jinan", "济南", "shandong", 36.7, 117.0, "city", "warlords", 5, 0.4, 6000, None),
    ("qingdao", "青岛", "shandong", 36.1, 120.4, "port", "warlords", 5, 0.5, 4000, None),
    ("yantai", "烟台", "shandong", 37.5, 121.4, "port", "warlords", 2, 0.3, 3000, None),
    ("linyi", "临沂", "shandong", 35.1, 118.3, "mountain", "warlords", 1, 0.3, 4000, None),
    # 山西（军阀）
    ("taiyuan", "太原", "shanxi", 37.9, 112.7, "mountain", "warlords", 6, 0.7, 4000, {"steel": 15}),
    ("datong", "大同", "shanxi", 40.1, 113.3, "mountain", "warlords", 2, 0.4, 2500, None),
    ("linfen", "临汾", "shanxi", 36.1, 111.5, "mountain", "warlords", 1, 0.3, 3000, None),
    # 绥远（军阀）
    ("hohhot", "归绥", "suiyuan", 40.8, 111.7, "city", "warlords", 2, 0.3, 2000, None),
    ("baotou", "包头", "suiyuan", 40.6, 109.9, "plain", "warlords", 2, 0.4, 1500, None),
    # 察哈尔（军阀）
    ("zhangjiakou", "张家口", "chahar", 40.8, 114.9, "mountain", "warlords", 2, 0.3, 2000, None),
    ("duolun", "多伦", "chahar", 42.2, 116.5, "plain", "warlords", 1, 0.3, 1200, None),
    # 陕西
    ("yanan", "延安", "shaanxi", 36.6, 109.5, "mountain", "ccp", 1, 0.3, 2500, None),
    ("xian", "西安", "shaanxi", 34.3, 108.9, "city", "roc", 4, 0.4, 5000, None),
    ("baoji", "宝鸡", "shaanxi", 34.4, 107.2, "plain", "roc", 1, 0.3, 3000, None),
    ("hanzhong", "汉中", "shaanxi", 33.1, 107.0, "mountain", "roc", 1, 0.3, 3000, None),
    # 甘肃含宁夏（军阀）
    ("lanzhou", "兰州", "gansu", 36.1, 103.8, "city", "warlords", 3, 0.3, 3000, None),
    ("tianshui", "天水", "gansu", 34.6, 105.7, "mountain", "warlords", 1, 0.3, 2500, None),
    ("wuwei", "武威", "gansu", 37.9, 102.6, "plain", "warlords", 1, 0.3, 2000, None),
    ("yinchuan", "银川", "gansu", 38.5, 106.2, "plain", "warlords", 1, 0.3, 1500, None),
    ("alashan", "阿拉善", "gansu", 38.8, 104.0, "desert", "warlords", 0, 0.3, 500, None),
    # 青海（军阀）
    ("xining", "西宁", "qinghai", 36.6, 101.8, "mountain", "warlords", 1, 0.3, 1500, None),
    ("golmud", "格尔木", "qinghai", 36.4, 94.9, "desert", "warlords", 0, 0.3, 300, None),
    # 新疆（军阀）
    ("urumqi", "迪化", "xinjiang", 43.8, 87.6, "city", "warlords", 2, 0.3, 1500, None),
    ("kashgar", "喀什", "xinjiang", 39.5, 76.0, "desert", "warlords", 1, 0.3, 2000, None),
    ("hami", "哈密", "xinjiang", 42.8, 93.5, "desert", "warlords", 1, 0.3, 800, None),
    ("yili", "伊犁", "xinjiang", 44.0, 81.3, "plain", "warlords", 1, 0.3, 1200, None),
    ("altay", "阿勒泰", "xinjiang", 47.9, 88.1, "mountain", "warlords", 0, 0.3, 600, None),
    # 河南（国民政府）
    ("zhengzhou", "郑州", "henan", 34.8, 113.7, "plain", "roc", 4, 0.4, 7000, {"food": 20}),
    ("luoyang", "洛阳", "henan", 34.6, 112.4, "plain", "roc", 3, 0.4, 5000, None),
    ("kaifeng", "开封", "henan", 34.8, 114.3, "plain", "roc", 2, 0.3, 5000, None),
    ("nanyang", "南阳", "henan", 32.5, 112.5, "plain", "roc", 2, 0.3, 6000, None),
    ("xinyang", "信阳", "henan", 32.1, 114.1, "mountain", "roc", 1, 0.3, 4000, None),
    # 江苏（国民政府）
    ("nanjing", "南京", "jiangsu", 32.1, 118.8, "city", "roc", 8, 0.5, 6000, None),
    ("shanghai", "上海", "jiangsu", 31.2, 121.5, "port", "roc", 12, 0.5, 9000, None),
    ("suzhou", "苏州", "jiangsu", 31.3, 120.6, "city", "roc", 5, 0.3, 6000, None),
    ("xuzhou", "徐州", "jiangsu", 34.3, 117.2, "plain", "roc", 3, 0.4, 5500, None),
    ("lianyungang", "连云港", "jiangsu", 34.6, 119.2, "port", "roc", 2, 0.3, 2500, None),
    # 安徽（国民政府）
    ("hefei", "合肥", "anhui", 31.9, 117.3, "city", "roc", 3, 0.3, 4500, None),
    ("bengbu", "蚌埠", "anhui", 32.9, 117.4, "plain", "roc", 2, 0.3, 4000, None),
    ("anqing", "安庆", "anhui", 30.5, 117.1, "plain", "roc", 2, 0.3, 4000, None),
    ("huainan", "淮南", "anhui", 32.6, 117.0, "plain", "roc", 2, 0.5, 3000, {"steel": 8}),
    # 浙江（国民政府）
    ("hangzhou", "杭州", "zhejiang", 30.3, 120.2, "port", "roc", 6, 0.4, 5500, None),
    ("ningbo", "宁波", "zhejiang", 29.9, 121.6, "port", "roc", 4, 0.4, 4000, None),
    ("wenzhou", "温州", "zhejiang", 28.0, 120.7, "port", "roc", 2, 0.3, 4000, None),
    ("jinhua", "金华", "zhejiang", 29.1, 119.6, "mountain", "roc", 1, 0.3, 4000, None),
    # 福建（国民政府）
    ("fuzhou", "福州", "fujian", 26.1, 119.3, "port", "roc", 3, 0.4, 4000, None),
    ("xiamen", "厦门", "fujian", 24.5, 118.1, "port", "roc", 3, 0.4, 2500, None),
    ("quanzhou", "泉州", "fujian", 24.9, 118.7, "port", "roc", 2, 0.3, 4000, None),
    ("longyan", "龙岩", "fujian", 25.1, 117.0, "mountain", "roc", 1, 0.3, 3000, None),
    # 湖北（国民政府）
    ("wuhan", "武汉", "hubei", 30.6, 114.3, "city", "roc", 8, 0.6, 7000, {"steel": 10}),
    ("yichang", "宜昌", "hubei", 30.7, 111.3, "mountain", "roc", 2, 0.3, 3000, None),
    ("xiangyang", "襄阳", "hubei", 32.0, 112.1, "plain", "roc", 2, 0.3, 3500, None),
    ("enshi", "恩施", "hubei", 30.3, 109.5, "mountain", "roc", 1, 0.3, 2500, None),
    # 湖南（国民政府）
    ("changsha", "长沙", "hunan", 28.2, 112.9, "city", "roc", 4, 0.4, 5000, {"food": 15}),
    ("hengyang", "衡阳", "hunan", 26.9, 112.6, "plain", "roc", 2, 0.3, 4000, None),
    ("changde", "常德", "hunan", 29.0, 111.7, "plain", "roc", 2, 0.3, 4000, None),
    ("shaoyang", "邵阳", "hunan", 27.2, 111.5, "mountain", "roc", 1, 0.3, 3500, None),
    # 江西（国民政府）
    ("nanchang", "南昌", "jiangxi", 28.7, 115.9, "city", "roc", 3, 0.3, 4000, None),
    ("jiujiang", "九江", "jiangxi", 29.7, 116.0, "city", "roc", 2, 0.3, 3000, None),
    ("ganzhou", "赣州", "jiangxi", 25.8, 114.9, "mountain", "roc", 1, 0.3, 3500, None),
    ("jian", "吉安", "jiangxi", 27.1, 114.9, "mountain", "roc", 1, 0.3, 3000, None),
    # 广东
    ("guangzhou", "广州", "guangdong", 23.1, 113.3, "port", "roc", 9, 0.5, 7000, None),
    ("hongkong", "香港", "guangdong", 22.3, 114.2, "port", "uk", 4, 0.4, 3000, None),
    ("shantou", "汕头", "guangdong", 23.4, 116.7, "port", "roc", 3, 0.3, 3500, None),
    ("hainan", "海南", "guangdong", 19.2, 109.7, "island", "roc", 1, 0.3, 2500, {"rubber": 8}),
    ("shaoguan", "韶关", "guangdong", 24.8, 113.6, "mountain", "roc", 1, 0.3, 3000, None),
    ("zhanjiang", "湛江", "guangdong", 21.3, 110.4, "port", "roc", 1, 0.3, 2500, None),
    # 广西（国民政府）
    ("nanning", "南宁", "guangxi", 22.8, 108.4, "city", "roc", 2, 0.3, 3500, None),
    ("liuzhou", "柳州", "guangxi", 24.3, 109.4, "mountain", "roc", 2, 0.3, 3000, None),
    ("guilin", "桂林", "guangxi", 25.3, 110.3, "mountain", "roc", 1, 0.3, 3000, None),
    ("beihai", "北海", "guangxi", 21.5, 109.1, "port", "roc", 1, 0.3, 1500, None),
    # 四川（军阀）
    ("chengdu", "成都", "sichuan", 30.7, 104.1, "city", "warlords", 6, 0.3, 9000, {"food": 20}),
    ("chongqing", "重庆", "sichuan", 29.6, 106.5, "mountain", "warlords", 6, 0.5, 8000, None),
    ("luzhou", "泸州", "sichuan", 28.9, 105.4, "city", "warlords", 2, 0.3, 4500, None),
    ("yibin", "宜宾", "sichuan", 28.8, 104.6, "city", "warlords", 2, 0.3, 4000, None),
    ("xikang", "西康", "sichuan", 30.1, 101.9, "mountain", "warlords", 1, 0.3, 1500, None),
    # 云南（军阀）
    ("kunming", "昆明", "yunnan", 25.0, 102.7, "mountain", "warlords", 3, 0.4, 3500, None),
    ("dali", "大理", "yunnan", 25.6, 100.3, "mountain", "warlords", 1, 0.3, 2000, None),
    ("mengzi", "蒙自", "yunnan", 23.4, 103.4, "mountain", "warlords", 1, 0.3, 1500, None),
    # 贵州
    ("guiyang", "贵阳", "guizhou", 26.6, 106.6, "mountain", "roc", 2, 0.3, 2500, None),
    ("zunyi", "遵义", "guizhou", 27.7, 106.9, "mountain", "roc", 1, 0.3, 2500, None),
    # 西藏（名义国民政府）
    ("lhasa", "拉萨", "xizang", 29.7, 91.1, "mountain", "roc", 0, 0.3, 800, None),
    ("xigaze", "日喀则", "xizang", 29.3, 88.9, "mountain", "roc", 0, 0.3, 600, None),
    # 台湾（日本）
    ("taipei", "台北", "taiwan", 25.0, 121.6, "port", "japan", 4, 0.5, 3500, {"food": 15}),
    ("taichung", "台中", "taiwan", 24.1, 120.7, "plain", "japan", 2, 0.3, 3000, None),
    ("kaohsiung", "高雄", "taiwan", 22.6, 120.3, "port", "japan", 3, 0.5, 3000, None),
    # 朝鲜（日本）
    ("pyongyang", "平壤", "korea", 39.0, 125.8, "city", "japan", 4, 0.6, 3500, None),
    ("hamhung", "咸兴", "korea", 39.9, 127.5, "port", "japan", 3, 0.5, 2500, None),
    ("sinuiju", "新义州", "korea", 40.2, 124.3, "port", "japan", 2, 0.4, 2000, None),
    ("seoul", "汉城", "korea", 37.6, 127.0, "city", "japan", 5, 0.5, 4500, None),
    ("pusan", "釜山", "korea", 35.2, 129.1, "port", "japan", 4, 0.5, 3500, None),
    ("daegu", "大邱", "korea", 35.9, 128.6, "city", "japan", 2, 0.3, 3000, None),
    # 北海道（日本）
    ("sapporo", "札幌", "hokkaido", 43.1, 141.3, "city", "japan", 3, 0.4, 2500, None),
    ("hakodate", "函馆", "hokkaido", 41.8, 140.8, "port", "japan", 2, 0.4, 1800, None),
    ("asahikawa", "旭川", "hokkaido", 43.8, 142.4, "plain", "japan", 1, 0.3, 1500, None),
    # 东北·日本
    ("sendai", "仙台", "tohoku", 38.3, 140.9, "city", "japan", 3, 0.5, 3000, None),
    ("aomori", "青森", "tohoku", 40.8, 140.8, "port", "japan", 2, 0.4, 1800, None),
    ("akita", "秋田", "tohoku", 39.7, 140.1, "plain", "japan", 1, 0.3, 2000, {"oil": 5}),
    ("morioka", "盛冈", "tohoku", 39.7, 141.2, "plain", "japan", 1, 0.3, 1800, None),
    # 关东·日本
    ("tokyo", "东京", "kanto", 35.7, 139.7, "port", "japan", 16, 0.7, 8000, None),
    ("yokohama", "横滨", "kanto", 35.4, 139.6, "port", "japan", 8, 0.7, 5000, None),
    ("nagano", "长野", "kanto", 36.6, 138.2, "mountain", "japan", 2, 0.4, 2500, None),
    ("niigata", "新潟", "kanto", 37.9, 139.1, "port", "japan", 3, 0.4, 2500, None),
    # 中部（日本）
    ("nagoya", "名古屋", "chubu", 35.2, 136.9, "city", "japan", 9, 0.7, 5000, None),
    ("shizuoka", "静冈", "chubu", 35.0, 138.4, "city", "japan", 3, 0.4, 3000, None),
    ("kanazawa", "金泽", "chubu", 36.6, 136.7, "city", "japan", 2, 0.4, 2200, None),
    ("toyama", "富山", "chubu", 36.7, 137.2, "city", "japan", 2, 0.5, 2000, None),
    # 近畿（日本）
    ("osaka", "大阪", "kinki", 34.7, 135.5, "port", "japan", 12, 0.7, 6000, None),
    ("kyoto", "京都", "kinki", 35.0, 135.8, "city", "japan", 5, 0.5, 3500, None),
    ("kobe", "神户", "kinki", 34.7, 135.2, "port", "japan", 6, 0.6, 3500, None),
    # 中国·四国（日本）
    ("hiroshima", "广岛", "chugoku", 34.4, 132.5, "city", "japan", 5, 0.6, 3000, None),
    ("okayama", "冈山", "chugoku", 34.7, 133.9, "city", "japan", 3, 0.4, 2500, None),
    ("shimonoseki", "下关", "chugoku", 34.0, 130.9, "port", "japan", 2, 0.4, 1500, None),
    ("matsuyama", "松山", "chugoku", 33.8, 132.8, "city", "japan", 2, 0.3, 2000, None),
    ("takamatsu", "高松", "chugoku", 34.3, 134.0, "port", "japan", 2, 0.3, 1800, None),
    # 九州（日本）
    ("nagasaki", "长崎", "kyushu", 32.8, 129.9, "port", "japan", 5, 0.6, 3000, None),
    ("fukuoka", "福冈", "kyushu", 33.6, 130.4, "city", "japan", 5, 0.5, 3500, None),
    ("kagoshima", "鹿儿岛", "kyushu", 31.6, 130.6, "port", "japan", 2, 0.4, 2200, None),
    ("oita", "大分", "kyushu", 33.2, 131.7, "port", "japan", 1, 0.3, 1800, None),
    # 蒙古
    ("ulaanbaatar", "乌兰巴托", "mongolia", 47.9, 106.9, "city", "mongolia", 1, 0.3, 1200, None),
    ("ulaangom", "乌兰固木", "mongolia", 49.9, 92.0, "plain", "mongolia", 0, 0.3, 600, None),
    ("choibalsan", "乔巴山", "mongolia", 48.1, 114.5, "plain", "mongolia", 0, 0.3, 600, None),
    # 苏联远东
    ("vladivostok", "海参崴", "primorye", 43.1, 131.9, "port", "ussr", 4, 0.6, 2500, None),
    ("khabarovsk", "伯力", "primorye", 48.5, 135.1, "city", "ussr", 3, 0.5, 2200, None),
    ("blagoveshchensk", "海兰泡", "primorye", 50.3, 127.5, "plain", "ussr", 1, 0.3, 1200, None),
    ("sakhalin", "萨哈林", "primorye", 49.0, 142.8, "island", "ussr", 1, 0.4, 800, {"oil": 25}),
    ("chita", "赤塔", "siberia", 52.0, 113.5, "mountain", "ussr", 2, 0.5, 1500, None),
    ("irkutsk", "伊尔库茨克", "siberia", 52.3, 104.3, "city", "ussr", 3, 0.4, 2000, None),
    ("yakutsk", "雅库茨克", "siberia", 62.0, 129.7, "plain", "ussr", 1, 0.3, 800, None),
    # 上缅甸（英）
    ("mandalay", "曼德勒", "upper_burma", 22.0, 96.1, "city", "uk", 3, 0.3, 3000, {"oil": 20}),
    ("lashio", "腊戍", "upper_burma", 22.9, 97.7, "mountain", "uk", 1, 0.3, 1500, None),
    ("myitkyina", "密支那", "upper_burma", 25.4, 97.4, "jungle", "uk", 1, 0.3, 1200, None),
    # 下缅甸（英）
    ("rangoon", "仰光", "lower_burma", 16.8, 96.2, "port", "uk", 4, 0.4, 3500, {"food": 20}),
    ("mawlamyine", "毛淡棉", "lower_burma", 16.5, 97.6, "port", "uk", 1, 0.3, 1500, None),
    ("sittwe", "实兑", "lower_burma", 20.2, 92.9, "port", "uk", 1, 0.3, 1500, None),
    # 英属印度
    ("delhi", "德里", "british_india", 28.6, 77.2, "city", "uk", 5, 0.3, 6000, None),
    ("calcutta", "加尔各答", "british_india", 22.6, 88.4, "port", "uk", 7, 0.5, 7000, None),
    ("patna", "巴特那", "british_india", 25.6, 85.1, "city", "uk", 3, 0.2, 6000, None),
    ("dhaka", "达卡", "british_india", 23.8, 90.4, "city", "uk", 3, 0.2, 5000, None),
    ("chittagong", "吉大港", "british_india", 22.4, 91.8, "port", "uk", 2, 0.3, 2500, None),
    # 暹罗北部
    ("chiangmai", "清迈", "siam_north", 18.8, 99.0, "jungle", "thailand", 1, 0.3, 2000, None),
    ("phitsanulok", "彭世洛", "siam_north", 16.8, 100.3, "plain", "thailand", 1, 0.3, 2000, None),
    # 暹罗中部
    ("bangkok", "曼谷", "siam", 13.8, 100.5, "port", "thailand", 4, 0.4, 4000, {"food": 45}),
    ("korat", "呵叻", "siam", 15.0, 102.1, "plain", "thailand", 2, 0.3, 2500, {"food": 15}),
    ("songkhla", "宋卡", "siam", 7.2, 100.6, "port", "thailand", 1, 0.3, 1500, {"rubber": 15}),
    # 北圻（法）
    ("hanoi", "河内", "tonkin", 21.0, 105.9, "city", "france", 4, 0.4, 4500, None),
    ("haiphong", "海防", "tonkin", 20.9, 106.7, "port", "france", 3, 0.5, 3000, None),
    ("langson", "谅山", "tonkin", 21.9, 106.8, "mountain", "france", 1, 0.3, 1500, None),
    # 老挝（法）
    ("vientiane", "万象", "laos", 18.0, 102.6, "jungle", "france", 1, 0.3, 1200, None),
    ("luangprabang", "琅勃拉邦", "laos", 19.9, 102.1, "jungle", "france", 0, 0.3, 800, None),
    # 安南·南圻（法）
    ("hue", "顺化", "annan", 16.5, 107.6, "port", "france", 2, 0.3, 2500, None),
    ("danang", "岘港", "annan", 16.1, 108.2, "port", "france", 2, 0.4, 2000, None),
    ("saigon", "西贡", "annan", 10.8, 106.7, "port", "france", 5, 0.5, 4500, {"rubber": 25}),
    ("phnompenh", "金边", "annan", 11.6, 104.9, "city", "france", 2, 0.3, 2500, None),
    # 马来亚（英）
    ("kualalumpur", "吉隆坡", "malaya", 3.1, 101.7, "jungle", "uk", 3, 0.3, 2500, {"rubber": 50}),
    ("singapore", "新加坡", "malaya", 1.4, 104.0, "port", "uk", 5, 0.5, 3000, None),
    ("penang", "槟城", "malaya", 5.4, 100.3, "port", "uk", 2, 0.3, 1800, None),
    ("ipoh", "怡保", "malaya", 4.6, 101.1, "jungle", "uk", 2, 0.3, 1800, {"steel": 6}),
    # 苏门答腊（荷）
    ("medan", "棉兰", "sumatra", 3.6, 98.7, "port", "netherlands", 3, 0.3, 2500, {"oil": 40, "rubber": 20}),
    ("palembang", "巨港", "sumatra", -3.0, 104.8, "port", "netherlands", 3, 0.3, 2500, {"oil": 20}),
    ("padang", "巴东", "sumatra", -0.9, 100.4, "port", "netherlands", 1, 0.3, 1800, None),
    ("aceh", "亚齐", "sumatra", 5.2, 95.6, "jungle", "netherlands", 1, 0.3, 1500, None),
    # 爪哇（荷）
    ("jakarta", "巴达维亚", "java", -6.2, 106.8, "port", "netherlands", 6, 0.5, 4500, None),
    ("surabaya", "泗水", "java", -7.2, 112.7, "port", "netherlands", 4, 0.5, 3500, None),
    ("semarang", "三宝垄", "java", -7.0, 110.4, "port", "netherlands", 3, 0.4, 3000, None),
    ("bandung", "万隆", "java", -6.9, 107.6, "city", "netherlands", 3, 0.3, 3000, None),
    # 婆罗洲（荷）
    ("balikpapan", "巴厘巴板", "borneo", -1.2, 116.8, "port", "netherlands", 3, 0.4, 1500, {"oil": 60}),
    ("pontianak", "坤甸", "borneo", 0.0, 109.3, "port", "netherlands", 1, 0.3, 1500, {"rubber": 15}),
    ("bandjarmasin", "班贾尔马辛", "borneo", -3.3, 114.6, "port", "netherlands", 1, 0.3, 1500, None),
    ("tarakan", "打拉根", "borneo", 3.3, 117.6, "port", "netherlands", 1, 0.3, 800, {"oil": 15}),
    # 吕宋（菲律宾）
    ("manila", "马尼拉", "luzon", 14.6, 121.0, "port", "philippines", 5, 0.5, 4500, None),
    ("baguio", "碧瑶", "luzon", 16.4, 120.6, "mountain", "philippines", 1, 0.3, 1500, None),
    ("tuguegarao", "土格加劳", "luzon", 17.6, 121.7, "plain", "philippines", 1, 0.3, 2000, None),
    ("legazpi", "黎牙实比", "luzon", 13.1, 123.7, "port", "philippines", 1, 0.3, 1500, None),
    # 棉兰老（菲律宾）
    ("davao", "达沃", "mindanao", 7.1, 125.6, "port", "philippines", 2, 0.3, 2000, None),
    ("cagayan", "卡加延", "mindanao", 8.5, 124.6, "port", "philippines", 1, 0.3, 1500, None),
    ("zamboanga", "三宝颜", "mindanao", 6.9, 122.1, "port", "philippines", 1, 0.3, 1200, None),
    # 太平洋诸岛（美）
    ("guam", "关岛", "pacific", 13.4, 144.8, "island", "usa", 1, 0.5, 500, None),
]

# 跨海航线边（seaLinks）：真实海峡/航线
SEA = [
    ("dalian", "tianjin"), ("dalian", "yantai"), ("dalian", "pusan"), ("qingdao", "dalian"),
    ("shanghai", "nagasaki"), ("shanghai", "pusan"), ("fuzhou", "taipei"), ("xiamen", "kaohsiung"),
    ("hongkong", "hainan"), ("hainan", "haiphong"), ("hainan", "beihai"),
    ("pusan", "shimonoseki"), ("pusan", "nagasaki"), ("seoul", "dalian"),
    ("vladivostok", "hamhung"), ("vladivostok", "sakhalin"), ("vladivostok", "hakodate"),
    ("sakhalin", "hakodate"), ("taipei", "nagasaki"), ("taipei", "manila"),
    ("manila", "hongkong"), ("manila", "davao"), ("davao", "balikpapan"),
    ("singapore", "jakarta"), ("singapore", "medan"), ("singapore", "palembang"),
    ("medan", "penang"), ("penang", "rangoon"), ("surabaya", "balikpapan"),
    ("jakarta", "pontianak"), ("haiphong", "hongkong"), ("hongkong", "manila"),
    ("tokyo", "guam"), ("guam", "manila"),
    ("hakodate", "aomori"), ("kaohsiung", "xiamen"), ("guangzhou", "hainan"),
    ("zhanjiang", "hainan"), ("beihai", "hainan"), ("semarang", "pontianak"),
    ("bandjarmasin", "surabaya"), ("tarakan", "balikpapan"), ("cagayan", "manila"),
    ("zamboanga", "davao"), ("legazpi", "manila"), ("tuguegarao", "taipei"),
]
# 海峡陆路连接（landLinks：窄海峡/跨海通道，按陆路相邻处理，非两栖）
LANDLINK = [
    ("aomori", "hakodate"),        # 津轻海峡（青函）
    ("shimonoseki", "fukuoka"),     # 关门海峡
    ("hiroshima", "matsuyama"),     # 濑户内海岛链
    ("okayama", "takamatsu"),       # 濑户大桥方向岛链
    ("hongkong", "guangzhou"),      # 珠江口（相邻即含，兜底）
    ("andong", "sinuiju"),          # 鸭绿江桥
    ("yakutsk", "irkutsk"),         # 勒拿河走廊
    ("calcutta", "patna"),          # 恒河走廊（自查修正：达卡胞元隔断）
    ("calcutta", "chittagong"),     # 孟加拉海岸走廊（自查修正）
    ("kualalumpur", "singapore"),   # 马来半岛走廊（自查修正）
    ("legazpi", "tuguegarao"),      # 吕宋东岸走廊（自查修正）
]
# 渡河边（river:true）：边须为最终相邻，生成时校验
RIVERS = [
    ("luoyang", "zhengzhou", "黄河"), ("kaifeng", "jinan", "黄河"),
    ("linfen", "luoyang", "黄河"), ("xian", "luoyang", "黄河"),
    ("wuhan", "changsha", "长江"), ("bengbu", "nanjing", "长江"),
    ("nanjing", "hefei", "长江"), ("harbin", "changchun", "松花江"),
    ("vientiane", "korat", "湄公河"), ("mengzi", "hanoi", "红河"),
    ("dali", "lashio", "萨尔温江"), ("andong", "sinuiju", "鸭绿江"), ("yichang", "enshi", "长江"),
]

LON0, LAT0, K = 58.0, 56.0, 11.0
def proj(lon, lat):
    return ((lon - LON0) * math.cos(math.radians(30)) * K, (LAT0 - lat) * K)

def main():
    geo = json.load(open("tools/countries.geo.json"))
    keep = {"CHN","JPN","PRK","KOR","RUS","MNG","IND","BGD","MMR","THA","VNM","LAO","KHM",
            "MYS","SGP","IDN","PHL","TWN","NPL","BTN","USA"}
    polys = []
    for f in geo["features"]:
        if f.get("id") not in keep:
            continue
        g = f["geometry"]
        parts = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for part in parts:
            rings = []
            for ring in part:
                pts = []
                for lon, lat in ring:
                    if lon < 0: lon += 360
                    if not (70 <= lon <= 215 and -12 <= lat <= 65):
                        pts = []
                        break
                    pts.append(proj(lon, lat))
                if len(pts) >= 4:
                    rings.append(pts)
            if rings:
                try:
                    p = Polygon(rings[0], rings[1:])
                    if p.is_valid and p.area > 30:
                        polys.append(p)
                except Exception:
                    pass
    # 关岛不在国家数据内：补小岛多边形
    gx, gy = proj(144.8, 13.4)
    polys.append(Point(gx, gy).buffer(14))
    land = unary_union(polys)
    land = land.intersection(box(-20, -20, 1650, 760))

    pts = [proj(lon, lat) for (_, _, _, lat, lon, *_r) in [(p[0], p[1], p[2], p[3], p[4]) for p in P]]
    cents = {p[0]: proj(p[4], p[3]) for p in P}
    vor = Voronoi([[cents[p[0]][0], cents[p[0]][1]] for p in P])
    # 邻接：Voronoi 棱
    adj = {p[0]: set() for p in P}
    for (i, j), ridge in zip(vor.ridge_points, vor.ridge_vertices):
        a, b = P[i][0], P[j][0]
        adj[a].add(b); adj[b].add(a)
    # 省多边形：Voronoi 胞 ∩ 陆地
    cells = {}
    for idx, p in enumerate(P):
        region = vor.point_region[idx]
        verts = vor.regions[region]
        if -1 in verts or not verts:
            cx, cy = cents[p[0]]
            cell = Point(cx, cy).buffer(60)
        else:
            cell = Polygon([vor.vertices[v] for v in verts])
        inter = cell.intersection(land)
        if inter.is_empty or inter.area < 40:
            cx, cy = cents[p[0]]
            inter = Point(cx, cy).buffer(10)
        if isinstance(inter, MultiPolygon):
            inter = max(inter.geoms, key=lambda g: g.area)
        inter = inter.simplify(2.0)
        if isinstance(inter, MultiPolygon):
            inter = max(inter.geoms, key=lambda g: g.area)
        cells[p[0]] = inter
    # 以裁剪后多边形是否真共享边界复核邻接（避免隔海误连/漏连靠 SEA/LANDLINK 补）
    ids = [p[0] for p in P]
    final_adj = {i: set() for i in ids}
    for i, a in enumerate(ids):
        for b in ids[i+1:]:
            if b in adj[a] and cells[a].distance(cells[b]) < 3.0:
                final_adj[a].add(b); final_adj[b].add(a)
    for a, b in LANDLINK:
        final_adj[a].add(b); final_adj[b].add(a)
    sea = {i: set() for i in ids}
    for a, b in SEA:
        sea[a].add(b); sea[b].add(a)
        final_adj[a].add(b); final_adj[b].add(a)
    # 连通性
    seen = set(); stack = ["tokyo"]
    while stack:
        n = stack.pop()
        if n in seen: continue
        seen.add(n); stack.extend(final_adj[n])
    print(f"provinces={len(P)} states={len(STATES)} connected={len(seen)}/{len(P)}", file=sys.stderr)
    if len(seen) < len(P):
        print("UNREACHED:", sorted(set(ids) - seen), file=sys.stderr)
    rivers = set()
    for a, b, _ in RIVERS:
        if b in final_adj[a]:
            rivers.add(tuple(sorted([a, b])))
        else:
            print(f"RIVER NOT ADJACENT: {a}-{b}", file=sys.stderr)
    # 包围盒归一化（2026-11-16 删省后重算取景）：内容平移到 (10,10)，画布=内容+20
    from shapely.affinity import translate as _translate
    _all = unary_union(list(cells.values()))
    _minx, _miny, _maxx, _maxy = _all.bounds
    _dx, _dy = 10 - _minx, 10 - _miny
    cells = {pid: _translate(g, xoff=_dx, yoff=_dy) for pid, g in cells.items()}
    MAP_W = round(_maxx - _minx + 20)
    MAP_H = round(_maxy - _miny + 20)
    print(f"map bounds: {MAP_W}x{MAP_H}", file=sys.stderr)

    def path_of(poly):
        xs, ys = poly.exterior.coords.xy
        pts = list(zip(xs, ys))
        s = "M" + " L".join(f"{x:.0f},{y:.0f}" for x, y in pts) + " Z"
        return s
    out = []
    out.append("// 由 tools/gen_map.py 生成（1936 行政骨架 + Voronoi 省界 + 真实国境裁剪），勿手改。")
    out.append("// 省=打仗层（地形/驻军/相邻），州=经济层（工业/人力/资源按省汇总展示）。")
    out.append("")
    out.append(f"export const MAP_W = {MAP_W};")
    out.append(f"export const MAP_H = {MAP_H};")
    out.append("")
    out.append("export type Terrain = \"plain\" | \"mountain\" | \"jungle\" | \"desert\" | \"city\" | \"port\" | \"island\";")
    out.append("")
    out.append("export interface ProvinceDef {")
    out.append("  id: string; name: string; stateId: string; terrain: Terrain; ownerId: string;")
    out.append("  industry: number; milShare: number; manpower: number;")
    out.append("  oil?: number; steel?: number; rubber?: number; food?: number;")
    out.append("  cx: number; cy: number; path: string;")
    out.append("  neighbors: string[]; landLinks?: string[]; seaLinks: string[];")
    out.append("}")
    out.append("")
    out.append("export const PROVINCES: ProvinceDef[] = [")
    ll = {}
    for a, b in LANDLINK:
        ll.setdefault(a, []).append(b); ll.setdefault(b, []).append(a)
    for p in P:
        pid = p[0]
        res = p[10] or {}
        res_s = "".join(f", {k}: {v}" for k, v in res.items())
        nb = sorted(final_adj[pid] - sea[pid] - set(ll.get(pid, [])))
        out.append(
            f'  {{ id: "{pid}", name: "{p[1]}", stateId: "{p[2]}", terrain: "{p[5]}", ownerId: "{p[6]}", '
            f"industry: {p[7]}, milShare: {p[8]}, manpower: {p[9]}{res_s}, "
            f"cx: {cells[pid].representative_point().x:.1f}, cy: {cells[pid].representative_point().y:.1f}, path: \"{path_of(cells[pid])}\", "
            f"neighbors: [{', '.join(chr(34)+n+chr(34) for n in nb)}]"
            + (f", landLinks: [{', '.join(chr(34)+n+chr(34) for n in ll[pid])}]" if pid in ll else "")
            + f", seaLinks: [{', '.join(chr(34)+n+chr(34) for n in sorted(sea[pid]))}] }},")
    out.append("];")
    out.append("")
    out.append("export const PROVINCE_MAP: Record<string, ProvinceDef> = Object.fromEntries(PROVINCES.map((p) => [p.id, p]));")
    out.append("")
    out.append("/** 渡河边：两省之间隔大河，进攻乘区见 combat RIVER_ATK_MULT。 */")
    out.append("export const RIVER_CROSSINGS: Array<{ a: string; b: string; river: string }> = [")
    for a, b, r in RIVERS:
        if tuple(sorted([a, b])) in rivers:
            out.append(f'  {{ a: "{a}", b: "{b}", river: "{r}" }},')
    out.append("];")
    out.append("")
    out.append("")
    out.append("/** 渡河进攻乘区（草案值，随 W2 报总管）。 */")
    out.append("export const RIVER_ATK_MULT = 0.85;")
    out.append("const RIVER_SET = new Set(RIVER_CROSSINGS.map((r) => [r.a, r.b].sort().join(\"|\")));")
    out.append("export function isRiverCrossing(a: string, b: string): boolean {")
    out.append("  return RIVER_SET.has([a, b].sort().join(\"|\"));")
    out.append("}")
    open("src/data/provinces.ts", "w").write("\n".join(out) + "\n")

    out2 = []
    out2.append("// 由 tools/gen_map.py 生成，勿手改。州为经济层：工业/人力/资源由其辖省汇总。")
    out2.append("")
    out2.append("export interface StateDef { id: string; name: string }")
    out2.append("")
    out2.append("export const STATES: StateDef[] = [")
    for sid, name in STATES:
        out2.append(f'  {{ id: "{sid}", name: "{name}" }},')
    out2.append("];")
    out2.append("")
    out2.append("export const STATE_MAP: Record<string, StateDef> = Object.fromEntries(STATES.map((s) => [s.id, s]));")
    open("src/data/states.ts", "w").write("\n".join(out2) + "\n")
    print("written src/data/provinces.ts + src/data/states.ts", file=sys.stderr)

if __name__ == "__main__":
    main()
