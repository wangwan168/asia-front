// 音频挂钩冒烟：下令（行军）/战斗（进攻）/事件（结束回合到 1936-12）各触发一次，
// 断言 __audio.played 出现对应槽位且全程无 pageerror。
// 前置：npm run build + preview 4181；运行：node tools/smoke_audio.mjs
import { chromium } from "playwright-core";
const BASE = process.env.SMOKE_URL ?? "http://localhost:4181/";
const browser = await chromium.launch();
let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}
async function newSession(factionText) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  const cards = await page.$$(".af-faction-card");
  for (const c of cards) {
    const t = await c.textContent();
    if (t && t.includes(factionText)) { await c.click(); break; }
  }
  await page.waitForSelector(".af-map", { timeout: 20000 });
  await page.waitForTimeout(1200);
  return { page, errors };
}
async function clickGame(page, gx, gy) {
  const pt = await page.evaluate(([x, y]) => {
    const svg = document.querySelector(".af-map");
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const sp = p.matrixTransform(svg.getScreenCTM());
    return { x: sp.x, y: sp.y };
  }, [gx, gy]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(500);
}
async function clickBtn(page, text, scope = "button") {
  for (const b of await page.$$(scope)) {
    const t = await b.textContent();
    if (t && t.includes(text)) { await b.evaluate((e) => e.click()); await page.waitForTimeout(450); return true; }
  }
  return false;
}
const played = (page) => page.evaluate(() => (window.__audio ? window.__audio.played : []));

// 会话 A（国民政府）：首次交互初始化 + 行军下令 + 连过 11 回合触发西安事变（1936-12）
{
  const { page, errors } = await newSession("国民政府");
  const init = await page.evaluate(() => ({ has: !!window.__audio, initialized: window.__audio ? window.__audio.initialized : false }));
  check("音频引擎已初始化（首次点击后）", init.has && init.initialized, JSON.stringify(init));
  // 徐州全选 -> 点合肥行军
  await clickGame(page, 536.1, 329.1);
  await clickBtn(page, "打开详情 / 指挥");
  await clickBtn(page, "全选本省部队", ".af-drawer button");
  await clickGame(page, 530.2, 355.5); // hefei
  await page.waitForTimeout(600);
  let p = await played(page);
  check("行军下令音 order_march", p.includes("order_march"), p.slice(-6).join(","));
  // 结束回合 ×11 到 1936-12
  for (let i = 0; i < 11; i++) {
    await clickBtn(page, "结束回合");
    await page.waitForTimeout(1300);
  }
  p = await played(page);
  check("事件音 event_telegraph（西安事变月）", p.includes("event_telegraph"), p.slice(-8).join(","));
  check("会话 A 无 pageerror", errors.length === 0, errors.join(" | ").slice(0, 200));
  await page.close();
}
// 会话 B（中共）：延安编组进攻西安 -> 进攻/战斗音
{
  const { page, errors } = await newSession("中国共产党");
  await clickGame(page, 456.1, 291.8); // yanan
  await clickBtn(page, "打开详情 / 指挥");
  await clickBtn(page, "全选本省部队", ".af-drawer button");
  await clickGame(page, 459.2, 332.6); // xian
  await page.waitForTimeout(700);
  const p = await played(page);
  check("进攻下令音 order_attack", p.includes("order_attack"), p.slice(-6).join(","));
  check("战斗音 battle_start + 结果档", p.includes("battle_start") && (p.includes("battle_victory") || p.includes("battle_defeat")), p.slice(-6).join(","));
  check("会话 B 无 pageerror", errors.length === 0, errors.join(" | ").slice(0, 200));
  await page.close();
}
await browser.close();
console.log(failures === 0 ? "AUDIO SMOKE ALL PASS" : `AUDIO SMOKE ${failures} FAILURES`);
process.exitCode = failures === 0 ? 0 : 1;
