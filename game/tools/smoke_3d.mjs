// 3D 一期冒烟：渲染/点选/行军/标签/相机 + 2D 兜底开关。
// 前置：npm run build + preview 4181；运行：node tools/smoke_3d.mjs
import { chromium } from "playwright-core";
const BASE = process.env.SMOKE_URL ?? "http://localhost:4181/";
const browser = await chromium.launch();
let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: "networkidle" });
const cards = await page.$$(".af-faction-card");
for (const c of cards) {
  const t = await c.textContent();
  if (t && t.includes("国民政府")) { await c.click(); break; }
}
await page.waitForSelector(".af-3d-canvas", { timeout: 20000 });
await page.waitForFunction(() => window.__map3d && window.__map3d.stats.unitObjects > 50, null, { timeout: 90000 });
await page.waitForTimeout(800);
const stats0 = await page.evaluate(() => window.__map3d.stats);
check("3D 单位已按真实布势摆放", stats0.unitObjects > 50, `objects=${stats0.unitObjects} tris=${stats0.unitTris}`);
check("贴图已重绘", stats0.paints >= 1, `paints=${stats0.paints} paintMs=${stats0.paintMs.toFixed(1)}`);
await page.screenshot({ path: "docs/3d-game-tilt.png" });
// 俯视
await page.evaluate(() => window.__map3d.resetView());
await page.waitForTimeout(900);
await page.screenshot({ path: "docs/3d-game-top.png" });
// 点选徐州：投影坐标 -> 鼠标点击
async function clickProvince(gx, gy) {
  const pt = await page.evaluate(([x, y]) => {
    const p = window.__map3d.project(x, y);
    const r = document.querySelector(".af-3d-canvas").getBoundingClientRect();
    return p ? { x: r.left + p.x, y: r.top + p.y } : null;
  }, [gx, gy]);
  if (!pt) throw new Error("project failed");
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(600);
}
const infoName = () => page.evaluate(() => document.querySelector(".af-info-name")?.textContent ?? "");
await clickProvince(536.1, 329.1);
check("3D 点选徐州", (await infoName()).includes("徐州"), await infoName());
// 华东特写（带兵）
await page.evaluate(() => { window.__map3d.focusOn(536.1, 329.1); window.__map3d.zoomBy(0.42); });
await page.waitForTimeout(900);
await page.screenshot({ path: "docs/3d-game-east.png" });
const labelsShown = await page.evaluate(() => window.__map3d.stats.labelsShown);
check("华东特写标签可见", labelsShown >= 10, `labels=${labelsShown}`);
// 行军流程：全选徐州部队 -> 点合肥
for (const b of await page.$$("button")) {
  const t = await b.textContent();
  if (t && t.includes("打开详情 / 指挥")) { await b.evaluate((e) => e.click()); break; }
}
await page.waitForTimeout(400);
for (const b of await page.$$(".af-drawer button")) {
  const t = await b.textContent();
  if (t && t.includes("全选本省部队")) { await b.evaluate((e) => e.click()); break; }
}
await page.waitForTimeout(400);
await clickProvince(530.2, 355.5);
const hefeiLine = await page.evaluate(() => document.querySelector(".af-info-card")?.textContent ?? "");
check("3D 行军点通（选中合肥）", (await infoName()).includes("合肥"), await infoName());
check("无 pageerror", errors.length === 0, errors.join(" | ").slice(0, 200));
await page.close();
// 2D 兜底
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p2.goto(BASE + "?view=2d", { waitUntil: "networkidle" });
const cards2 = await p2.$$(".af-faction-card");
for (const c of cards2) {
  const t = await c.textContent();
  if (t && t.includes("国民政府")) { await c.click(); break; }
}
await p2.waitForSelector(".af-map", { timeout: 15000 });
check("2D 模式兜底可用（?view=2d）", true);
await p2.close();
await browser.close();
console.log(failures === 0 ? "3D SMOKE ALL PASS" : `3D SMOKE ${failures} FAILURES`);
process.exitCode = failures === 0 ? 0 : 1;
