import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(10000);
const shots = process.env.FOW_SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
async function shot(name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
}
const rail = (name) =>
  page
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
async function confirm() {
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  await page.getByRole("button", { name: "确认执行", exact: true }).click();
}
async function close() {
  await page.getByRole("button", { name: "关闭面板", exact: true }).click();
}
async function option(name) {
  await page
    .locator(".v2-plan-list button")
    .filter({ hasText: name })
    .first()
    .click();
  await confirm();
}
async function viewCheck(label) {
  const metrics = await page.evaluate(() => {
    const r = document.querySelector(".end-turn").getBoundingClientRect();
    const map = document
      .querySelector(".map-workspace")
      .getBoundingClientRect();
    const heading = document
      .querySelector(".status-bar")
      .getBoundingClientRect();
    const root = document.documentElement;
    const button = document.querySelector(".end-turn");
    const hit = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2,
    );
    return {
      viewport: [innerWidth, innerHeight],
      doc: [root.scrollWidth, root.scrollHeight],
      end: [r.x, r.y, r.right, r.bottom],
      map: [map.width, map.height],
      top: [heading.x, heading.y, heading.bottom],
      resourcesInside: [
        ...document.querySelectorAll(".resource-tip>button"),
      ].every((n) => {
        const b = n.getBoundingClientRect();
        return b.y >= heading.y && b.bottom <= heading.bottom + 1;
      }),
      hit: button === hit || button.contains(hit),
      bodyFont: parseFloat(
        getComputedStyle(document.querySelector(".command-app")).fontSize,
      ),
    };
  });
  assert.deepEqual(metrics.doc, metrics.viewport, `${label}: global overflow`);
  assert.ok(
    metrics.end[0] >= 0 &&
      metrics.end[2] <= metrics.viewport[0] &&
      metrics.end[3] <= metrics.viewport[1],
    `${label}: end button clipped`,
  );
  assert.ok(metrics.resourcesInside, `${label}: resource bar overflow`);
  assert.ok(metrics.hit, `${label}: end button covered`);
  assert.ok(
    metrics.map[0] > 300 && metrics.map[1] > 180,
    `${label}: map too small`,
  );
  assert.ok(metrics.bodyFont >= 16);
  return metrics;
}
async function panelCheck(label) {
  const box = await page.getByRole("dialog").boundingBox();
  const button = page.locator(".panel-heading .panel-close");
  assert.ok(
    box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= page.viewportSize().width + 1 &&
      box.y + box.height <= page.viewportSize().height + 1,
    `${label}: panel clipped`,
  );
  assert.equal(await page.getByRole("dialog").count(), 1);
  await button.click({ trial: true });
  const footer = page.locator(".panel-footer");
  if (await footer.count()) {
    const b = await footer.boundingBox();
    assert.ok(b.y + b.height <= page.viewportSize().height);
    for (const item of await footer.getByRole("button").all())
      if (await item.isEnabled()) await item.click({ trial: true });
  }
  const before = await page.evaluate(() => document.documentElement.scrollTop);
  await page
    .locator(".panel-scroll")
    .evaluate((n) => (n.scrollTop = n.scrollHeight));
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollTop),
    before,
  );
}
try {
  console.log("Testing menu/tutorial...");
  await page.goto(base);
  await page.getByRole("navigation", { name: "主菜单" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "继续游戏", exact: true })
      .isDisabled(),
    true,
  );
  await shot("main-menu");
  // A malformed save cannot enable continue and is never silently discarded.
  await page.evaluate(() =>
    localStorage.setItem("federation-worlds-v2", '{"schema":2}'),
  );
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: "继续游戏", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "读取存档", exact: true }).click();
  await page.getByRole("status").waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("federation-worlds-v2")),
    '{"schema":2}',
  );
  await page.evaluate(() => localStorage.removeItem("federation-worlds-v2"));
  await page.reload();
  // Separate tutorial entry uses the same game shell and unchanged actions.
  await page.getByRole("button", { name: "教学战役", exact: true }).click();
  await page.getByRole("heading", { name: "01 · 人物不是数值工具" }).waitFor();
  await page.getByRole("button", { name: "前往人事任命" }).click();
  await page.getByRole("button", { name: "预览任命", exact: true }).click();
  await confirm();
  await rail("国家事务").click();
  await option("群众参与预防巡检");
  await page.getByRole("heading", { name: "02 · 先确定谁能参与" }).waitFor();
  await page
    .getByRole("button", { name: "调整本事务指挥关系 / 临时授权" })
    .click();
  await page
    .locator(".panel-footer")
    .getByRole("button", { name: "预览临时授权" })
    .click();
  await confirm();
  await rail("国家事务").click();
  await option("公开群众救援");
  await page.getByRole("heading", { name: "03 · 看清财政承诺" }).waitFor();
  await rail("经济建设").click();
  await page.getByRole("button", { name: "核对财政预测" }).click();
  await confirm();
  await rail("国家事务").click();
  await option("保障民生、暂缓工业");
  await page.getByRole("heading", { name: "教学完成", exact: true }).waitFor();
  await close();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  assert.equal(save.machine.tutorial, 4);
  assert.equal(save.core.commands, 0);
  assert.equal(save.core.appointments["gov-south"], "xing");
  await page.getByRole("button", { name: "返回主菜单", exact: true }).click();
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: "继续游戏", exact: true })
      .isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await page.getByRole("heading", { name: "教学完成", exact: true }).waitFor();
  // Formal new game selects campaign and national goal independently of tutorial.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "返回主菜单", exact: true }).click();
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("游玩模式").selectOption("national");
  await page
    .locator(".v2-goal-choices button")
    .filter({ hasText: "星火计划" })
    .click();
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  await page.getByRole("button", { name: "独立治理", exact: true }).click();
  await rail("国家目标").click();
  await page.getByRole("heading", { name: "星火计划", exact: true }).waitFor();
  await close();
  assert.equal(await page.locator(".tutorial-strip").count(), 0);
  console.log("Tutorial/save/new goal passed. Testing viewports...");
  // Real project commitment appears in finance hover; completion locates its province.
  await page.getByRole("button", { name: "预警建设", exact: true }).click();
  await confirm();
  await page.locator(".resource-tip").nth(1).getByRole("button").hover();
  const tip = page.getByRole("tooltip");
  await tip.waitFor();
  assert.ok((await tip.innerText()).includes("可施工项目1"));
  assert.ok((await tip.innerText()).includes("预警站"));
  await tip.hover();
  assert.equal(await tip.isVisible(), true);
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  await confirm();
  await page.locator(".secondary-alerts summary").click();
  await page
    .locator(".alert-item.info")
    .filter({ hasText: "工程竣工" })
    .click();
  await page.getByRole("dialog", { name: "地方档案" }).waitFor();
  assert.ok((await page.getByRole("dialog").innerText()).includes("已竣工"));
  assert.ok(
    (await page.locator(".selected-object").innerText()).includes("南岭"),
  );
  await close();
  await rail("政策改革").click();
  await page.getByRole("button", { name: "全国政策", exact: true }).click();
  await page.getByLabel("政策议题").selectOption("method");
  await page.getByRole("button", { name: "协商", exact: true }).click();
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  await close();
  await close();
  const dimensions = [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1280, 720],
  ];
  for (const [w, h] of dimensions) {
    await page.setViewportSize({ width: w, height: h });
    await viewCheck(`${w}x${h}`);
    await shot(`map-${w}x${h}`);
    await rail("人事管理").click();
    await panelCheck(`${w}x${h} staff`);
    await shot(`staff-${w}x${h}`);
    await page.keyboard.press("Escape");
    await rail("国家事务").click();
    await page.locator(".v2-plan-list button").first().click();
    await page.getByRole("button", { name: "预览后果", exact: true }).click();
    await panelCheck(`${w}x${h} decision`);
    await shot(`decision-${w}x${h}`);
    await close();
    await close();
  }
  // Browser zoom changes the effective CSS viewport. Validate 125% equivalent
  // for every requested screen, plus the independent in-game UI scaling option.
  for (const [w, h] of dimensions) {
    await page.setViewportSize({
      width: Math.floor(w / 1.25),
      height: Math.floor(h / 1.25),
    });
    await viewCheck(`${w}x${h}@125% CSS viewport`);
    await rail("人事管理").click();
    await panelCheck(`${w}x${h}@125% panel`);
    await page.keyboard.press("Escape");
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("UI缩放").selectOption("125");
  await close();
  await viewCheck("1024x576, UI scale125");
  await rail("人事管理").click();
  await panelCheck("UI125 staff");
  await shot("ui-scale125-small-window");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("UI缩放").selectOption("100");
  await close();
  await page.setViewportSize({ width: 1366, height: 768 });
  console.log("Viewport checks passed. Testing panel persistence...");
  // Switching six management panels never changes saved game data.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("federation-worlds-v2"),
  );
  await close();
  for (const name of [
    "中央政府",
    "人事管理",
    "政策改革",
    "经济建设",
    "国家目标",
    "国家事务",
  ]) {
    await rail(name).click();
    assert.equal(await page.getByRole("dialog").count(), 1);
  }
  await close();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("federation-worlds-v2")),
    before,
  );
  await close();
  console.log("Panels passed. Testing reminder/map...");
  // Reminder opens exactly its linked matter and selects the province.
  await page
    .locator(".alert-item")
    .filter({ hasText: "南岭灵脉电站故障预警" })
    .click();
  assert.equal(await page.locator(".v2-matter").count(), 1);
  await page
    .getByRole("heading", { name: "南岭灵脉电站故障预警", exact: true })
    .waitFor();
  assert.ok(
    (await page.locator(".selected-object").innerText()).includes("南岭"),
  );
  await close();
  // Map modes, real zoom/pan and district selection keep their state after close.
  for (const name of ["行政", "资源", "危机", "政治"]) {
    await page
      .getByRole("group", { name: "地图模式" })
      .getByRole("button", { name, exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("group", { name: "地图模式" })
        .getByRole("button", { name, exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
  }
  const svg = page.locator(".federation-map");
  const initial = await svg.getAttribute("viewBox");
  await page.getByRole("button", { name: "放大地图" }).click();
  assert.notEqual(await svg.getAttribute("viewBox"), initial);
  await page.getByRole("button", { name: "复位地图" }).click();
  const rect = await svg.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.88, rect.y + rect.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.88 + 35,
    rect.y + rect.height * 0.8 + 15,
  );
  await page.mouse.up();
  assert.notEqual(await svg.getAttribute("viewBox"), initial);
  await page.getByRole("button", { name: "复位地图" }).click();
  await page.locator('[data-map-region="4"]').press("Enter");
  await page.getByRole("dialog", { name: "地方档案" }).waitFor();
  await close();
  assert.ok(
    (await page.locator(".selected-object").innerText()).includes("北境"),
  );
  await page.locator('[data-map-region="0"]').click();
  await page.getByRole("dialog", { name: "地方档案" }).waitFor();
  await close();
  assert.ok(
    (await page.locator(".selected-object").innerText()).includes("工业"),
  );
  console.log("Map checks passed. Testing full campaign...");
  // Complete the existing four-turn rules through the new interface.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "返回主菜单", exact: true }).click();
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("游玩模式").selectOption("campaign");
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  async function end() {
    await page.getByRole("button", { name: "结束回合", exact: true }).click();
    await confirm();
  }
  await rail("国家事务").click();
  await option("群众参与预防巡检");
  await close();
  await end();
  await rail("国家事务").click();
  await option("公开群众救援");
  await close();
  await end();
  await rail("国家事务").click();
  await option("保障民生、暂缓工业");
  await close();
  await end();
  await rail("国家事务").click();
  await page
    .locator(".v2-matter.oldgod .v2-plan-list button")
    .filter({ hasText: "撤离与应急配给" })
    .click();
  await confirm();
  await close();
  await end();
  await page.getByRole("heading", { name: "国家机器发挥了作用。" }).waitFor();
  await page.getByRole("button", { name: "查阅完整决策历史" }).click();
  assert.ok((await page.locator(".v2-history article").count()) > 10);
  await close();
  await page.getByRole("button", { name: "执政报告", exact: true }).click();
  await page.getByRole("heading", { name: "国家机器发挥了作用。" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      mainMenu: "passed",
      tutorial: "four real stages",
      saveReload: "passed",
      panels: "six preserved state",
      map: "four modes + zoom/pan + district selection",
      alerts: "linked matter",
      campaign: "full four-turn victory",
      screens: dimensions,
      zoom: "125% equivalent CSS viewport for all four + UI125%",
      errors,
    }),
  );
} catch (e) {
  await page.screenshot({ path: "/tmp/fow-ui-failure.png" });
  throw e;
} finally {
  await browser.close();
}
