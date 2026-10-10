import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1365, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function confirm() {
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  await page.getByRole("button", { name: "确认执行", exact: true }).click();
}
async function option(name) {
  await page
    .locator(".v2-plan-list button")
    .filter({ hasText: name })
    .first()
    .click();
  await confirm();
}
await page.goto(process.argv[2] || "http://localhost:5173");
await page.getByRole("heading", { name: "01 · 人物不是数值工具" }).waitFor();
assert.ok(
  await page
    .locator(".v2-plan-list button.blocked")
    .filter({ hasText: "群众参与预防巡检" })
    .count(),
);
await page.getByRole("button", { name: "前往人事任命" }).click();
await page.getByRole("button", { name: "预览任命", exact: true }).click();
await confirm();
await option("群众参与预防巡检");
await page.getByRole("heading", { name: "02 · 先确定谁能参与" }).waitFor();
await page
  .getByRole("button", { name: "调整本事务指挥关系 / 临时授权" })
  .click();
await page.getByRole("button", { name: "预览临时授权", exact: true }).click();
await confirm();
await option("公开群众救援");
await page.getByRole("heading", { name: "03 · 看清财政承诺" }).waitFor();
await page.getByRole("button", { name: "核对财政预测", exact: true }).click();
await confirm();
await page
  .getByRole("heading", { name: "04 · 你的决定改变下一场危机" })
  .waitFor();
await option("保障民生、暂缓工业");
await page.getByRole("heading", { name: "教学完成", exact: true }).waitFor();
await page.getByRole("button", { name: "存档", exact: true }).click();
const saved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("federation-worlds-v2")),
);
assert.equal(saved.machine.tutorial, 4);
assert.equal(saved.core.commands, 0);
assert.equal(saved.core.appointments["gov-south"], "xing");
await page.reload();
await page.getByRole("button", { name: "读档", exact: true }).click();
await page.getByRole("heading", { name: "教学完成", exact: true }).waitFor();
await page.getByRole("button", { name: "新任期", exact: true }).click();
await page.getByLabel("游玩模式").selectOption("national");
await page
  .locator(".v2-goal-choices button")
  .filter({ hasText: "长夜防线" })
  .click();
await page.getByRole("button", { name: "开始任期", exact: true }).click();
await page.locator(".v2-main h2").filter({ hasText: "长夜防线" }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
const metrics = await page.evaluate(() => ({
  width: document.documentElement.clientWidth,
  scroll: document.documentElement.scrollWidth,
  button: getComputedStyle(document.querySelector(".v2-bottom button"))
    .fontSize,
  body: getComputedStyle(document.querySelector(".v2-app")).fontSize,
}));
assert.equal(metrics.width, metrics.scroll);
assert.equal(metrics.body, "16px");
assert.equal(metrics.button, "16px");
assert.deepEqual(errors, []);
console.log(
  JSON.stringify({
    tutorial: "all four actual stages",
    saveReload: "passed",
    goalMode: "passed",
    mobile: metrics,
    errors,
  }),
);
await page.setViewportSize({ width: 1365, height: 950 });
await page.getByRole("button", { name: "新任期", exact: true }).click();
await page.getByLabel("游玩模式").selectOption("campaign");
await page.getByRole("button", { name: "开始任期", exact: true }).click();
async function endTurn() {
  await page.getByRole("button", { name: "预览回合结算" }).click();
  await confirm();
}
await option("群众参与预防巡检");
await endTurn();
await option("公开群众救援");
await endTurn();
await option("保障民生、暂缓工业");
await endTurn();
await page
  .locator(".v2-matter.oldgod .v2-plan-list button")
  .filter({ hasText: "撤离与应急配给" })
  .click();
await confirm();
await endTurn();
await page.getByRole("heading", { name: "国家机器发挥了作用。" }).waitFor();
await page.getByRole("button", { name: "查阅完整决策历史" }).click();
assert.equal((await page.locator(".v2-history article").count()) > 10, true);
assert.equal(await page.getByRole("dialog").count(), 0);
await page.getByRole("button", { name: "执政报告", exact: true }).click();
await page.getByRole("dialog", { name: "执政报告" }).waitFor();
assert.deepEqual(errors, []);
console.log(
  "Full four-turn UI win, complete causal history and report reopen passed.",
);
await browser.close();
