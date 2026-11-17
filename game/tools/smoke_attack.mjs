// 进攻箭头 + C5 战斗标记实测：对军阀宣战 → 南京编组点徐州直接合击（编组命令优先口径）
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:4181/", { waitUntil: "networkidle" });
const cards = await page.$$(".af-faction-card");
for (const c of cards) { const t = await c.textContent(); if (t?.includes("中共") || t?.includes("红军") || t?.includes("共产")) { await c.click(); break; } }
await page.waitForSelector(".af-map", { timeout: 20000 });
async function clickBtn(text) {
  for (const b of await page.$$("button")) { const t = await b.textContent(); if (t?.trim() === text) { await b.evaluate((e) => e.click()); await page.waitForTimeout(500); return true; } }
  return false;
}
async function clickProvince(gx, gy) {
  const pt = await page.evaluate(([x, y]) => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, [gx, gy]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(600);
}
// 延安（中共）全选 → 点西安（roc 交战省）直接进攻（编组命令优先口径）
await clickProvince(456.1, 291.8); // yanan
await page.waitForSelector(".af-info-card", { timeout: 8000 });
console.log("info:", await page.evaluate(() => document.querySelector(".af-info-name")?.textContent));
await clickBtn("打开详情 / 指挥");
await page.waitForTimeout(500);
await clickBtn("全选本省部队");
await clickBtn("✕ 收起");
await clickProvince(459.2, 332.6); // xian (roc, 交战中)
await page.waitForTimeout(800);
const res = await page.evaluate(() => ({
  atkArrows: document.querySelectorAll(".af-arrow-attack").length,
  markers: document.querySelectorAll(".af-combat-marker").length,
  notice: document.querySelector(".af-notice")?.textContent ?? "",
}));
console.log("attack arrows:", res.atkArrows, "| combat markers:", res.markers, "| notice:", res.notice);
await page.mouse.move(690, 330);
await page.mouse.wheel(0, -1000);
await page.waitForTimeout(600);
await page.screenshot({ path: "../docs/enrich-attack.png" });
console.log(res.atkArrows >= 1 && res.markers >= 1 ? "ATTACK SMOKE PASS" : "ATTACK SMOKE FAIL");
await browser.close();
