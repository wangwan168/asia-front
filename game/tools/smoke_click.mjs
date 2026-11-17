// 浏览器级点击冒烟测试（交付验收必跑，逻辑单测测不出 DOM 事件链）：
//   前置：npm run build && npm run preview -- --port 4181（另开终端）
//   运行：node tools/smoke_click.mjs   （依赖 playwright-core，验收后可卸）
// 覆盖：①点选切换 ②单师行军全流程（驻军数变化断言）③点未交战外国省→未宣战提示+宣战入口 ④拖动不误触点选
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_URL ?? "http://localhost:4181/";
const results = [];
function check(name, ok, extra = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`;
  results.push(line);
  console.log(line);
  if (!ok) process.exitCode = 1;
}
async function clickText(scope, text) {
  const h = await page.evaluateHandle(([sc, tx]) => {
    return [...document.querySelectorAll(`${sc} button`)].find((b) => b.textContent?.includes(tx)) ?? null;
  }, [scope, text]);
  const el = h.asElement();
  if (!el) throw new Error(`button not found: ${scope} :: ${text}`);
  await el.click();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
// 开局：国民政府
const cards = await page.$$(".af-faction-card");
for (const c of cards) {
  const t = await c.textContent();
  if (t && t.includes("国民政府")) { await c.click(); break; }
}
await page.waitForSelector(".af-map", { timeout: 15000 });
await page.waitForTimeout(900);

async function clickGame(gx, gy) {
  const pt = await page.evaluate(([x, y]) => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint();
    p.x = x; p.y = y;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, [gx, gy]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(450);
}
const infoName = () => page.evaluate(() => document.querySelector(".af-info-name")?.textContent ?? "");
const infoLine = () => page.evaluate(() => document.querySelector(".af-info-card .af-line")?.textContent ?? "");
const noticeText = () => page.evaluate(() => document.querySelector(".af-notice")?.textContent ?? "");

// ① 点选切换：成都 → 徐州
await clickGame(423.1, 353.4);
check("点选成都", (await infoName()).includes("成都"), await infoName());
await clickGame(536.1, 329.1);
check("点选徐州", (await infoName()).includes("徐州"), await infoName());

// ④ 拖动不误触：从徐州附近拖 90px，选区应仍是徐州
{
  const pt = await page.evaluate(() => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint();
    p.x = 536.1; p.y = 329.1;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  });
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.move(pt.x + 90, pt.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  check("拖动不触发点选", (await infoName()).includes("徐州"), await infoName());
}

// ② 单师行军：南京（德械师 1 个）→ 合肥
await clickGame(548.3, 348.4);
check("点选南京", (await infoName()).includes("南京"), await infoName());
check("南京驻军 1 师", (await infoLine()).includes("驻军 1 师"), await infoLine());
await clickText(".af-info-card", "打开详情");
await page.waitForTimeout(400);
const moveBtn = await page.evaluateHandle(() => {
  return [...document.querySelectorAll(".af-drawer button")].find((b) => b.textContent === "移动") ?? null;
});
check("详情里有行军按钮", !!(await moveBtn.evaluate((e) => e !== null).catch(() => false)));
await moveBtn.asElement()?.click();
await page.waitForTimeout(300);
await page.click(".af-drawer-head button"); // 收起抽屉，避免遮挡目标省
await page.waitForTimeout(300);
await clickGame(530.2, 355.5); // 合肥
check("行军后选中合肥", (await infoName()).includes("合肥"), await infoName());
check("合肥驻军 1 师（己方）", (await infoLine()).includes("驻军 1 师"), await infoLine());
await page.screenshot({ path: "../docs/p0-smoke-move.png" });
await clickGame(548.3, 348.4);
check("南京驻军归零", (await infoLine()).includes("驻军 0 师"), await infoLine());

// ③ 未宣战链路：合肥的师编组后点济南（地方军阀，未交战）
await clickGame(530.2, 355.5);
await clickText(".af-info-card", "打开详情");
await page.waitForTimeout(400);
await page.click(".af-drawer input[type=checkbox]");
await page.waitForTimeout(300);
await page.click(".af-drawer-head button");
await page.waitForTimeout(300);
await clickGame(527.9, 304.5); // 济南
const nText = await noticeText();
check("未宣战提示出现", nText.includes("未与") && nText.includes("宣战"), nText);
const warBtn = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".af-drawer button")].find((x) => x.textContent?.includes("宣战"));
  return b ? b.textContent : "";
});
check("省份详情有宣战入口", warBtn.includes("宣战"), warBtn);
await page.screenshot({ path: "../docs/p0-smoke-notice.png" });

// ⑤ 交战方打不到也要有原因：取消编组勾选后重新勾选（师在合肥），点延安（中共·交战中，不相邻）
await page.click(".af-drawer input[type=checkbox]"); // 取消济南流程里残留的勾选状态影响：先点一次切换
await page.waitForTimeout(200);
const cbState = await page.evaluate(() => document.querySelector(".af-drawer input[type=checkbox]")?.checked);
if (!cbState) {
  await page.click(".af-drawer input[type=checkbox]");
  await page.waitForTimeout(200);
}
await page.click(".af-drawer-head button");
await page.waitForTimeout(300);
await clickGame(456.1, 291.8); // 延安（若坐标不符以下断言会暴露）
const n2 = await noticeText();
check("交战打不到有原因", n2.includes("打不到") || n2.includes("打不了"), n2);
await page.screenshot({ path: "../docs/p0-smoke-notice.png" });

await browser.close();
console.log(results.join("\n"));
console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE ALL PASS");
