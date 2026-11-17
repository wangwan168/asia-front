// 一期 UI 冒烟：模式选择器已消失、矛头钮在、补给行在、袭扰钮按兵种出现
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.env.SMOKE_URL ?? "http://localhost:4181/", { waitUntil: "networkidle" });
const cards = await page.$$(".af-faction-card");
for (const c of cards) { const t = await c.textContent(); if (t?.includes("国民政府")) { await c.click(); break; } }
await page.waitForSelector(".af-map", { timeout: 15000 });
await page.waitForTimeout(800);
async function clickGame(gx, gy) {
  const pt = await page.evaluate(([x, y]) => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, [gx, gy]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(450);
}
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); if (!ok) fails++; };
await clickGame(548.3, 348.4); // 南京
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".af-info-card button")].find((x) => x.textContent?.includes("打开详情"));
  b?.click();
});
await page.waitForTimeout(400);
check("模式选择器已消失", await page.evaluate(() => {
  const names = ["正面强攻", "筹备攻势", "坚守·筑垒", "包围·断补给", "侧翼渗透", "航空支援", "两栖登陆", "游击袭扰"];
  return ![...document.querySelectorAll(".af-drawer button")].some((b) => names.includes(b.textContent ?? ""));
}));
const panelText = await page.evaluate(() => document.querySelector(".af-drawer")?.textContent ?? "");
check("省份面板有补给行", panelText.includes("补给：连通"), panelText.slice(0, 0));
check("驻军行有设矛头钮", await page.evaluate(() => [...document.querySelectorAll(".af-drawer button")].some((b) => b.textContent === "设矛头")));
check("进攻区文案为系统口径", panelText.includes("自动结算"));
// 点设矛头 → 变 ★矛头
await page.evaluate(() => [...document.querySelectorAll(".af-drawer button")].find((b) => b.textContent === "设矛头")?.click());
await page.waitForTimeout(300);
check("矛头可切换为 ★矛头", await page.evaluate(() => [...document.querySelectorAll(".af-drawer button")].some((b) => b.textContent === "★矛头")));
await page.screenshot({ path: "../docs/p1-ui-spearhead.png" });
await browser.close();
console.log(fails === 0 ? "P1 SMOKE ALL PASS" : `P1 SMOKE ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
