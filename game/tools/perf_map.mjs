// 地图渲染耗时基线/复测：初始渲染 + 5 次点选重渲染平均
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const t0 = Date.now();
await page.goto("http://localhost:4181/", { waitUntil: "networkidle" });
const cards = await page.$$(".af-faction-card");
for (const c of cards) { const t = await c.textContent(); if (t?.includes("国民政府")) { await c.click(); break; } }
await page.waitForSelector(".af-map", { timeout: 20000 });
console.log("initial render ms:", Date.now() - t0);
const spots = [[423.1, 353.4], [536.1, 329.1], [548.3, 348.4], [456.1, 291.8], [459.2, 332.6]];
const times = [];
for (const [gx, gy] of spots) {
  const pt = await page.evaluate(([x, y]) => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, [gx, gy]);
  const s = Date.now();
  await page.mouse.click(pt.x, pt.y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  times.push(Date.now() - s);
}
console.log("click rerender ms:", times.join(","), "avg:", Math.round(times.reduce((a, b) => a + b, 0) / times.length));
const nodes = await page.evaluate(() => document.querySelector(".af-map").querySelectorAll("*").length);
console.log("svg nodes:", nodes);
await browser.close();
