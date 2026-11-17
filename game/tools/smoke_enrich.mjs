// 主界面丰富化冒烟：图层计数 + 战线/军棋牌 + 警报旗 + 行军箭头 + 进攻箭头/战斗标记 + 编组卡带
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];
const check = (name, ok, extra = "") => { results.push([name, ok, extra]); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };
await page.goto(process.env.SMOKE_URL ?? "http://localhost:4181/", { waitUntil: "networkidle" });
const cards = await page.$$(".af-faction-card");
for (const c of cards) { const t = await c.textContent(); if (t?.includes("国民政府")) { await c.click(); break; } }
await page.waitForSelector(".af-map", { timeout: 20000 });
await page.waitForTimeout(800);
const counts = await page.evaluate(() => ({
  tex: document.querySelectorAll(".af-terrain-tex").length,
  rivers: document.querySelectorAll(".af-rivers-real path").length,
  sea: document.querySelectorAll(".af-sea-label").length,
  grat: document.querySelectorAll(".af-graticule line").length,
  front: document.querySelectorAll(".af-front").length,
  counters: document.querySelectorAll(".af-counter").length,
  badges: document.querySelectorAll(".af-prov-badge").length,
  resIcons: document.querySelectorAll(".af-res-icon").length,
  alerts: document.querySelectorAll(".af-alert-flag").length,
  alertText: [...document.querySelectorAll(".af-alert-flag")].map((e) => e.textContent).join(" | "),
}));
check("A2 地形纹理层 = 196 省", counts.tex === 196, `=${counts.tex}`);
check("A3 河流 = 8 条", counts.rivers === 8, `=${counts.rivers}`);
check("A6 海名 ≥ 8", counts.sea >= 8, `=${counts.sea}`);
check("A6 经纬网 = 17 线", counts.grat === 17, `=${counts.grat}`);
check("战线段 > 0（国共交界）", counts.front > 0, `=${counts.front}`);
check("军棋牌 > 40", counts.counters > 40, `=${counts.counters}`);
check("旧 ⚔ 徽记已清零", counts.badges === 0);
check("A5 资源图标 > 10", counts.resIcons > 10, `=${counts.resIcons}`);
check("警报旗出现（科研闲置等）", counts.alerts >= 1, counts.alertText);
await page.screenshot({ path: "../docs/enrich-full.png" });
// 点省的坐标换算
async function clickProvince(gx, gy) {
  const pt = await page.evaluate(([x, y]) => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, [gx, gy]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(500);
}
async function clickButtonByText(text, scope = null) {
  const els = await (scope ?? page).$$("button");
  for (const b of els) { const t = await b.textContent(); if (t?.trim() === text) { await b.evaluate((e) => e.click()); return true; } }
  return false;
}
// 武汉选编组（roc 步兵师驻防；西安驻军是军阀师、选不到，故用武汉）
await clickProvince(507.5, 370.0); // wuhan
await page.waitForSelector(".af-info-card", { timeout: 8000 });
await clickButtonByText("打开详情 / 指挥");
await page.waitForTimeout(600);
// 面板里全选本省部队 → 收起抽屉 → 点相邻可达省（临汾）下行军令
const selClicked = await clickButtonByText("全选本省部队");
check("面板全选本省部队可点", selClicked);
await page.waitForTimeout(400);
const strip = await page.evaluate(() => document.querySelectorAll(".af-group-card").length);
check("编组卡带出现（每师一卡）", strip >= 1, `=${strip}`);
await page.screenshot({ path: "../docs/enrich-group.png" });
await clickButtonByText("✕ 收起");
await page.waitForTimeout(300);
// 点可达省行军：按省名标签坐标点（长沙优先，备选宜昌/信阳）
async function clickProvinceByName(name) {
  const pt = await page.evaluate((n) => {
    const labels = [...document.querySelectorAll(".af-prov-label")];
    const t = labels.find((e) => e.textContent === n);
    if (!t) return null;
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint();
    p.x = Number(t.getAttribute("x")); p.y = Number(t.getAttribute("y")) + 1;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, name);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(600);
  return true;
}
for (const cand of ["长沙", "宜昌", "信阳"]) {
  await clickProvinceByName(cand);
  const n = await page.evaluate(() => document.querySelectorAll(".af-arrow-move").length);
  if (n >= 1) break;
}
const arrows = await page.evaluate(() => document.querySelectorAll(".af-arrow-move").length);
check("行军箭头出现", arrows >= 1, `=${arrows}`);
await page.screenshot({ path: "../docs/enrich-move.png" });
// 截图：华东放大（滚轮放大到南京一带）
await page.mouse.move(770, 400);
await page.mouse.wheel(0, -1200);
await page.waitForTimeout(700);
await page.screenshot({ path: "../docs/enrich-east.png" });
const failed = results.filter((r) => !r[1]).length;
console.log(failed === 0 ? "ENRICH SMOKE ALL PASS" : `ENRICH SMOKE ${failed} FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
