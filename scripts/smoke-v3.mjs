import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const shots = process.env.FOW_SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const rail = (name) =>
  page
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
const close = async () => {
  const button = page.locator(".panel-heading .panel-close");
  if (await button.count()) await button.first().click();
};
async function shot(name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
}
async function confirm(double = false) {
  const advance = page.getByRole("button", { name: "确认推进", exact: true });
  if (await advance.count()) { await advance.click(); return; }
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  const button = page.getByRole("button", { name: "确认执行", exact: true });
  if (double) await button.dblclick();
  else await button.click();
}
async function save() {
  await close();
  await page.locator(".pause-trigger").click();
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  const g = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  await close();
  return g;
}
async function setup({
  mode = "national",
  politics = "random",
  seed,
  random = false,
} = {}) {
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("剧本", { exact: true }).selectOption(mode);
  await page.getByLabel("政治开局", { exact: true }).selectOption(politics);
  await page
    .getByLabel("种子模式", { exact: true })
    .selectOption(random ? "random" : "specified");
  if (!random) await page.getByLabel("数字或字符串种子").fill(seed);
  assert.equal(await page.locator(".v2-goal-choices").count(), 0);
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  const guide = page.getByRole("button", { name: "独立治理", exact: true });
  if (await guide.count()) await guide.click();
  if (politics === "random") {
    await page
      .getByRole("dialog", { name: "初始国情报告", exact: true })
      .waitFor();
    await shot("initial-report");
    await close();
  }
}
async function menu() {
  await page.locator(".pause-trigger").click();
  await page.getByRole("button", { name: "返回主菜单", exact: true }).click();
}
async function turn() {
  await close();
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  await confirm();
}
async function matter(title, option, double = false) {
  await rail("国家事务").click();
  const card = page
    .locator(".v2-matter")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card
    .locator(".v2-plan-list button")
    .filter({ hasText: option })
    .click();
  await confirm(double);
}
try {
  await page.goto(process.argv[2] || "http://localhost:5173");
  await setup({ seed: "可复现-政治结构" });
  const first = await save();
  assert.equal(first.machine.goalPending, true);
  await page.locator(".pause-trigger").click();
  await page.getByRole("button", { name: "重玩同一种子", exact: true }).click();
  await close();
  const replay = await save();
  assert.deepEqual(replay, first);
  await menu();
  await setup({ random: true });
  const a = await save();
  await menu();
  await setup({ random: true });
  const b = await save();
  assert.notEqual(a.core.seed, b.core.seed);
  // Browser keyboard tooltip, pinning and local scrolling never cover the footer.
  await page.keyboard.press("Tab");
  await page.locator(".resource-tip").nth(1).getByRole("button").focus();
  await page.getByRole("tooltip").waitFor();
  await page.getByRole("button", { name: "固定说明", exact: true }).click();
  const fixed = page.locator(".unified-tooltip.pinned");
  await fixed.locator(".tooltip-body").evaluate((n) => {
    n.scrollTop = n.scrollHeight;
    n.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
  });
  assert.equal(await fixed.isVisible(), true);
  await page.keyboard.press("Escape");
  await menu();
  await setup({
    mode: "experimental",
    politics: "classic",
    seed: "联邦-v03-验收",
  });
  await rail("国家目标").click();
  await page
    .getByRole("heading", { name: "国家发展规划会议", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "预览长夜防线立项", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "确认执行", exact: true })
      .isDisabled(),
    true,
  );
  assert.ok(
    (await page.getByRole("dialog").innerText()).includes("第2回合开放"),
  );
  await close();
  await shot("planning-turn1");
  await close();
  await rail("政策改革").click();
  await page.getByRole("button").filter({ hasText: "中央垂直领导" }).click();
  await confirm();
  await close();
  await matter("南岭灵脉电站故障预警", "记录异常频谱", true);
  assert.equal(await page.locator(".execution-result").count(), 0);
  await shot("event-resolved");
  let g = await save();
  assert.equal(g.core.commands, 3);
  assert.equal(g.machine.archive.filter((x) => x.kind === "warning").length, 1);
  assert.equal(
    g.machine.results.filter((x) => x.action.type === "resolve").length,
    1,
  );
  for (const province of ["industry", "south", "north"]) {
    await page
      .locator(
        `.federation-map [data-province="${province}"][data-district="0"]`,
      )
      .press("Enter");
    await close();
    await page.getByRole("button", { name: "预警建设", exact: true }).click();
    await confirm();
    await close();
  }
  await turn();
  await rail("国家目标").click();
  await page
    .getByRole("button", { name: "提交长夜防线立项", exact: true })
    .click();
  await confirm();
  await shot("strategy-approved");
  await close();
  await matter("灵脉事故：谁来指挥救援？", "第十三号高级封印");
  await turn();
  await rail("国家事务").click();
  const demand = page.locator(".v2-matter").filter({
    has: page.getByRole("heading", {
      name: "地方公开要求秘密处置说明",
      exact: true,
    }),
  });
  await demand
    .getByRole("button", { name: "调整本事务指挥关系 / 临时授权", exact: true })
    .click();
  await page.getByLabel("临时主管").selectOption("plan");
  await page.getByLabel("正式邀请中央—地方联合参与").uncheck();
  await page.getByRole("button", { name: "预览临时授权", exact: true }).click();
  await confirm();
  await close();
  await matter("地方公开要求秘密处置说明", "签署资源收益协约");
  await turn();
  await matter("北境旧神苏醒", "第十三号高级封印");
  await close();
  for (let current = 4; current < 10; current++) await turn();
  await rail("国家目标").click();
  await page
    .getByRole("button", { name: "预览全国协作演练", exact: true })
    .click();
  await confirm();
  await close();
  g = await save();
  assert.equal(g.core.turn, 10);
  assert.equal(g.machine.terminalInspected, true);
  assert.equal(g.machine.goal, "night");
  await menu();
  await page.getByRole("button", { name: "读取存档", exact: true }).click();
  const restored = await save();
  assert.deepEqual(restored, g);
  await turn();
  await turn();
  await matter("全国级异常防线总动员", "全国级异常防线总动员");
  await turn();
  await page
    .getByRole("heading", { name: "国家机器发挥了作用。", exact: true })
    .waitFor();
  await shot("twelve-turn-victory");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      randomStarts: "two unique crypto seeds",
      replay: "identical full state",
      tooltip: "keyboard + pin + local scroll",
      doubleClick: "one debit + one archive",
      strategy: "in-game turn2",
      experimental: "full 12-turn UI victory + turn10 save/reload",
      errors,
    }),
  );
} catch (e) {
  await page.screenshot({ path: "/tmp/fow-v3-failure.png" }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
