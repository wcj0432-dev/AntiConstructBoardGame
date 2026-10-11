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
const shots = process.env.FOW_SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const rail = (name) =>
  page
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
async function close() {
  const b = page.locator(".panel-heading .panel-close");
  if (await b.count()) await b.first().click();
}
async function screenshot(name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
}
async function confirm(double = false) {
  assert.equal(
    await page.locator(".execution-result:not(.failed)").count(),
    0,
    "a previous result must never appear inside a new command",
  );
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  const b = page.getByRole("button", { name: "确认执行", exact: true });
  assert.equal(
    await b.isDisabled(),
    false,
    await page.getByRole("dialog").innerText(),
  );
  if (double) await b.dblclick();
  else await b.click();
  assert.equal(
    await page.getByRole("button", { name: "确认执行", exact: true }).count(),
    0,
    "successful command must clear its confirmation",
  );
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
async function matter(title, option, double = false) {
  await close();
  await rail("国家事务").click();
  const card = page
    .locator(".v2-matter")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card
    .locator(".v2-plan-list button")
    .filter({ hasText: option })
    .click();
  await confirm(double);
  assert.equal(await page.locator(".execution-result").count(), 0);
}
async function region(pid) {
  await close();
  await page.locator(`[data-province="${pid}"][data-district="0"]`).click();
  await close();
}
async function economy(label) {
  await close();
  await rail("经济建设").click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await confirm();
}
async function turn() {
  await close();
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  await page
    .getByRole("dialog", { name: "回合结算 · 推进时间", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "预览后果", exact: true }).count(),
    0,
  );
  const b = page.getByRole("button", { name: "确认推进", exact: true });
  const r = await b.boundingBox();
  assert.ok(r.y + r.height <= 768);
  await b.dblclick();
}
async function authorize(title, lead) {
  await close();
  await rail("国家事务").click();
  const card = page
    .locator(".v2-matter")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card
    .getByRole("button", { name: "调整本事务指挥关系 / 临时授权" })
    .click();
  await page.getByLabel("临时主管", { exact: true }).selectOption(lead);
  await page.getByLabel("正式邀请中央—地方联合参与").uncheck();
  await page.getByRole("button", { name: "预览临时授权", exact: true }).click();
  assert.ok(
    (await page.locator(".reform-impact").innerText()).includes(
      "本回合结算后到期",
    ),
  );
  await confirm();
}
try {
  await page.goto(process.argv[2] || "http://localhost:5173");
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("剧本", { exact: true }).selectOption("national");
  await page.getByLabel("政治开局", { exact: true }).selectOption("classic");
  await page.getByLabel("种子模式", { exact: true }).selectOption("specified");
  await page.getByLabel("数字或字符串种子").fill("v04-真实财政完整战役");
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  const guide = page.getByRole("button", { name: "独立治理", exact: true });
  if (await guide.count()) await guide.click();
  await matter("南岭灵脉电站故障预警", "群众参与预防巡检", true);
  await matter("关于飞剑运输量纳入铁路统计的通知", "兼容标准");
  await economy("灵脉勘探");
  await close();
  await rail("经济建设").click();
  await page.getByLabel("工作分配", { exact: true }).selectOption("dedicated");
  await screenshot("project-assignment");
  await page.getByRole("button", { name: "预览项目开工", exact: true }).click();
  await confirm();
  let g = await save();
  assert.equal(g.machine.works[0].worker, "mo");
  assert.equal(g.machine.works[0].assignment, "dedicated");
  assert.notEqual(g.core.appointments["gov-south"], "mo");
  assert.equal(g.machine.occupied.mo, undefined);
  await region("industry");
  await economy("地方财政稽核");
  g = await save();
  assert.equal(g.machine.audits.industry.rounds, 1);
  await close();
  await rail("经济建设").click();
  await page.getByRole("button").filter({ hasText: "地方财政稽核" }).click();
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "确认执行", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  await close();
  await turn();
  g = await save();
  assert.equal(g.core.turn, 2);
  assert.equal(g.machine.works[0].progress, 1);
  await rail("国家目标").click();
  await page.getByRole("button", { name: /星火计划立项/ }).click();
  await confirm();
  await close();
  await rail("政策改革").click();
  await page.getByRole("button", { name: "地图与地区", exact: true }).click();
  await page
    .locator('.reform-map [data-province="south"][data-district="0"]')
    .click();
  await page.getByRole("button", { name: "组织结构图", exact: true }).click();
  await page
    .getByRole("button", { name: "调整某类事务的长期归属", exact: true })
    .click();
  await screenshot("authority-diagram");
  await page
    .getByRole("button", { name: "中央跨省运输体系", exact: true })
    .click();
  assert.ok(
    (await page.locator(".reform-impact").innerText()).includes("长期有效"),
  );
  await screenshot("reform-preview");
  await confirm();
  await close();
  await rail("政策改革").click();
  await page.getByRole("button", { name: "全国政策", exact: true }).click();
  await page.getByLabel("政策议题").selectOption("method");
  await page.getByRole("button", { name: "协商", exact: true }).click();
  await confirm();
  await region("south");
  await economy("合作磋商");
  await economy("撤销工程与派遣");
  g = await save();
  assert.equal(g.machine.works[0].cancelled, true);
  await economy("恢复已取消工程");
  g = await save();
  assert.equal(g.machine.works[0].cancelled, false);
  assert.equal(g.machine.works[0].progress, 0);
  await turn();
  g = await save();
  assert.equal(g.core.turn, 3);
  assert.equal(g.machine.works[0].progress, 1);
  const accident = "灵脉事故：谁来指挥救援？";
  await matter(accident, "地方临时遏制");
  await turn();
  g = await save();
  assert.equal(g.core.turn, 4);
  assert.equal(g.machine.works[0].completed, true);
  await close();
  await rail("人事管理").click();
  await page.getByLabel("职位", { exact: true }).selectOption("gov-south");
  await page.locator(".v2-roster button").filter({ hasText: "墨玄" }).click();
  await page.getByRole("button", { name: "预览任命", exact: true }).click();
  await confirm();
  await matter("北境旧神苏醒", "撤离与应急配给");
  assert.ok(
    (await page.locator(".matter-progress").first().innerText()).includes(
      "异常源尚未封印",
    ),
  );
  await screenshot("partial-event-clean");
  await region("industry");
  await economy("资源普查");
  await close();
  await rail("经济建设").click();
  await page
    .getByLabel("国家安全委员会预算", { exact: true })
    .selectOption("0");
  await page
    .getByRole("button", { name: "预览国家安全委员会预算", exact: true })
    .click();
  await confirm();
  await close();
  await rail("经济建设").click();
  await page.getByLabel("计划委员会预算", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "预览计划委员会预算", exact: true })
    .click();
  await confirm();
  await turn();
  await authorize(accident, "anomaly");
  await matter(accident, "第十三号高级封印");
  await turn();
  await authorize("地方公开要求秘密处置说明", "plan");
  await matter("地方公开要求秘密处置说明", "签署资源收益协约");
  g = await save();
  const original = JSON.stringify(g);
  await page.reload();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "确认执行", exact: true }).count(),
    0,
  );
  assert.equal(await page.locator(".execution-result").count(), 0);
  g = await save();
  assert.equal(JSON.stringify(g), original);
  while (g.core.turn < 8) {
    if (g.machine.matters.find((x) => x.kind === "oldgod").containment === 0)
      await matter("北境旧神苏醒", "地方临时遏制");
    await turn();
    g = await save();
    assert.equal(g.core.status, "playing");
  }
  await matter("北境旧神苏醒", "地方临时遏制");
  await matter("全国能源网络点火仪式", "全国能源网络点火仪式");
  await turn();
  await page
    .getByRole("dialog", { name: "国家机器发挥了作用。", exact: true })
    .waitFor();
  await screenshot("governance-victory");
  g = await save();
  assert.equal(g.core.status, "won");
  assert.equal(g.machine.departmentBudgets.plan, 2);
  assert.equal(g.machine.audits.industry.rounds, 1);
  assert.equal(g.core.insolvency, 0);
  assert.ok(g.machine.results.length > 20);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      commandCleanup:
        "continuous commands + resolved/partial + double click + panel switch + reload",
      turn: "distinct one-step review + unused commands expire + no duplicate advance",
      engineer: "free dedicated + cancel/restart + real completion",
      economy: "bounded audit + actual cooperation + survey + funded budget",
      reforms: "diagram/map + scoped metadata + real transport rights",
      campaign:
        "full eight-turn spark victory using original starting resources",
      errors,
    }),
  );
} catch (e) {
  if (shots)
    await page.screenshot({ path: `${shots}/failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
