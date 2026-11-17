// 二期冒烟：空军任务改派（日本东京战斗机 → 任务改指大阪）
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.env.SMOKE_URL ?? "http://localhost:4181/", { waitUntil: "networkidle" });
const cards = await page.$$(".af-faction-card");
for (const c of cards) { const t = await c.textContent(); if (t?.includes("大日本帝国")) { await c.click(); break; } }
await page.waitForSelector(".af-map", { timeout: 20000 });
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
async function clickBtn(text, scope = "button") {
  for (const b of await page.$$(scope)) { const t = await b.textContent(); if (t?.trim() === text) { await b.evaluate((e) => e.click()); await page.waitForTimeout(500); return true; } }
  return false;
}
await clickProvince(736.5, 307.4); // tokyo
await page.waitForSelector(".af-info-card", { timeout: 8000 });
await clickBtn("打开详情 / 指挥");
await page.waitForTimeout(500);
const before = await page.evaluate(() => document.querySelector(".af-drawer")?.textContent ?? "");
console.log("tokyo panel has mission line:", before.includes("任务：东京"));
const clicked = await clickBtn("改派任务", ".af-drawer button");
console.log("reassign clicked:", clicked);
await page.waitForTimeout(300);
await clickBtn("✕ 收起");
await clickProvince(698.9, 327.7); // osaka
await page.waitForTimeout(500);
const notice = await page.evaluate(() => document.querySelector(".af-notice")?.textContent ?? "");
console.log("notice:", notice);
await clickProvince(736.5, 307.4);
await page.waitForSelector(".af-info-card", { timeout: 8000 });
await clickBtn("打开详情 / 指挥");
await page.waitForTimeout(500);
const after = await page.evaluate(() => document.querySelector(".af-drawer")?.textContent ?? "");
const ok = notice.includes("任务目标改为 大阪") && after.includes("任务：大阪");
console.log(ok ? "P2 SMOKE PASS" : "P2 SMOKE FAIL");
await page.screenshot({ path: "../docs/p2-mission.png" });
await browser.close();
