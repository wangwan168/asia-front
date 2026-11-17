// 三期冒烟：登陆项目全流程（日本：对 roc 宣战 → 台北筹备登陆福州 → 次月执行）
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
async function clickBtnExact(text, scope = "button") {
  for (const b of await page.$$(scope)) { const t = await b.textContent(); if (t?.trim() === text) { await b.evaluate((e) => e.click()); await page.waitForTimeout(500); return true; } }
  return false;
}
async function clickBtnContains(text, scope = "button") {
  for (const b of await page.$$(scope)) { const t = await b.textContent(); if (t?.includes(text)) { await b.evaluate((e) => e.click()); await page.waitForTimeout(500); return t.trim(); } }
  return null;
}
// 1) 福州面板宣战
await clickProvince(543.2, 408.8);
await page.waitForSelector(".af-info-card", { timeout: 8000 });
await clickBtnExact("打开详情 / 指挥");
await page.waitForTimeout(400);
const war = await clickBtnContains("宣战", ".af-drawer button");
console.log("declared:", war);
await clickBtnExact("✕ 收起");
// 2) 台北全选 -> 进攻区筹备登陆
await clickProvince(568.6, 431.3);
await page.waitForSelector(".af-info-card", { timeout: 8000 });
await clickBtnExact("打开详情 / 指挥");
await page.waitForTimeout(400);
await clickBtnExact("全选本省部队", ".af-drawer button");
await page.waitForTimeout(500);
const prepLabel = await clickBtnContains("筹备登陆", ".af-drawer button");
console.log("prepare clicked:", prepLabel);
await page.waitForTimeout(500);
const planLine = await page.evaluate(() => document.querySelector(".af-drawer")?.textContent?.includes("登陆计划：目标 福州") ?? false);
console.log("plan line at taipei:", planLine);
// 3) 结束回合 -> 次月在福州面板执行登陆
await clickBtnExact("✕ 收起");
await clickBtnContains("结束回合");
await page.waitForTimeout(2500);
await clickProvince(543.2, 408.8);
await page.waitForSelector(".af-info-card", { timeout: 8000 });
await clickBtnExact("打开详情 / 指挥");
await page.waitForTimeout(400);
const execLabel = await clickBtnContains("执行登陆", ".af-drawer button");
console.log("execute clicked:", execLabel);
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  drawer: document.querySelector(".af-drawer")?.textContent?.slice(0, 120) ?? "",
  markers: document.querySelectorAll(".af-combat-marker").length,
  notice: document.querySelector(".af-notice")?.textContent ?? "",
}));
console.log("after execute:", JSON.stringify(after));
const ok = !!war && !!prepLabel && planLine && !!execLabel && after.markers >= 1;
console.log(ok ? "P3 SMOKE PASS" : "P3 SMOKE FAIL");
await page.screenshot({ path: "../docs/p3-landing.png" });
await browser.close();
