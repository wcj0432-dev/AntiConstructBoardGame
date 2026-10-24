import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:5173";
const shots = process.env.FOW_SCREENSHOT_DIR || "artifacts/screenshots/v5";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const saveKey = "federation-worlds-v2";
const sizes = [
  [1920, 1080],
  [1600, 900],
  [1366, 768],
  [1280, 720],
];
const errors = [];
const results = {
  fixtures:
    "none; all gameplay branches use original standard opening resources",
  desktop: [],
  native125: [],
};
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(15000);
page.on("pageerror", (error) => errors.push(error.message));

const rail = (name, target = page) =>
  target
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
async function close(target = page) {
  const button = target.locator(".panel-heading .panel-close");
  if (await button.count()) await button.first().click();
}
async function shot(name, target = page) {
  await target.screenshot({ path: path.join(shots, `${name}.png`) });
}
async function rosterShot(name) {
  await page.locator(".panel-scroll").evaluate((node) => {
    const table = node.querySelector(".personnel-table-scroll");
    table.scrollLeft = 0;
    node.scrollTop +=
      table.getBoundingClientRect().top - node.getBoundingClientRect().top - 12;
  });
  await shot(name);
}
async function confirm() {
  assert.equal(
    await page.locator(".execution-result:not(.failed)").count(),
    0,
    "historical results must stay outside a new decision",
  );
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  const button = page.getByRole("button", { name: "确认执行", exact: true });
  assert.equal(
    await button.isDisabled(),
    false,
    await page.getByRole("dialog").innerText(),
  );
  await button.click();
  assert.equal(
    await page.getByRole("button", { name: "确认执行", exact: true }).count(),
    0,
  );
}
async function save() {
  await close();
  await page.getByRole("button", { name: "暂停菜单", exact: true }).click();
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  const game = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    saveKey,
  );
  await close();
  assert.ok(game?.schema === 2);
  return game;
}
async function start(seed, mode = "experimental") {
  await page.goto(base);
  await page.evaluate((key) => localStorage.removeItem(key), saveKey);
  await page.reload();
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("剧本", { exact: true }).selectOption(mode);
  await page.getByLabel("政治开局", { exact: true }).selectOption("classic");
  await page.getByLabel("种子模式", { exact: true }).selectOption("specified");
  await page.getByLabel("数字或字符串种子").fill(seed);
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  const guide = page.getByRole("button", { name: "独立治理", exact: true });
  if (await guide.count()) await guide.click();
  await close();
  const game = await save();
  assert.equal(game.core.treasury, 12);
  assert.deepEqual(game.machine.fiscal.locals, {
    industry: 6,
    south: 6,
    north: 6,
  });
  assert.equal(game.machine.fiscal.cultTreasury, 5);
  return game;
}
async function finance() {
  await close();
  await page
    .locator(".resource-tip")
    .filter({
      has: page.locator("button > span", { hasText: "财政 / 下回合" }),
    })
    .getByRole("button")
    .click();
  await page.getByRole("dialog", { name: "国家财政", exact: true }).waitFor();
}
async function economy(label) {
  await close();
  await rail("经济建设").click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await confirm();
}
async function region(province) {
  await close();
  await page
    .locator(`[data-province="${province}"][data-district="0"]`)
    .click();
  await close();
}
async function matter(kind, option) {
  const game = await save();
  const entry = game.machine.matters.find((item) => item.kind === kind);
  assert.ok(entry, `missing ${kind} at turn ${game.core.turn}`);
  await rail("国家事务").click();
  const card = page.locator(".v2-matter").filter({
    has: page.getByRole("heading", { name: entry.title, exact: true }),
  });
  await card
    .locator(".v2-plan-list button")
    .filter({ hasText: option })
    .click();
  await confirm();
}
async function policy(issue, label) {
  await close();
  await rail("政策改革").click();
  await page.getByRole("button", { name: "全国政策", exact: true }).click();
  await page.getByLabel("政策议题").selectOption(issue);
  await page.getByRole("button", { name: label, exact: true }).click();
  await confirm();
}
async function reform(category, label, scope) {
  await close();
  await rail("政策改革").click();
  await page.getByRole("button", { name: category, exact: true }).click();
  if (scope)
    await page
      .getByLabel("制度改革适用范围", { exact: true })
      .selectOption(scope);
  await page.getByRole("button", { name: label, exact: true }).click();
  await confirm();
}
async function project(type, worker, funding = "central") {
  await close();
  await rail("经济建设").click();
  await page.getByLabel("建设类型", { exact: true }).selectOption(type);
  await page.getByLabel("项目负责人", { exact: true }).selectOption(worker);
  await page.getByLabel("工作分配", { exact: true }).selectOption("dedicated");
  await page.getByLabel("工程出资方式", { exact: true }).selectOption(funding);
  await page.getByRole("button", { name: "预览项目开工", exact: true }).click();
  if (type === "grid") {
    assert.ok((await page.getByRole("dialog").innerText()).includes("供能"));
    await shot("joint-grid-decision");
  }
  await confirm();
}
async function budget(department, level) {
  await close();
  await rail("经济建设").click();
  await page
    .getByLabel(`${department}预算`, { exact: true })
    .selectOption(String(level));
  await page
    .getByRole("button", { name: `预览${department}预算`, exact: true })
    .click();
  await confirm();
}
async function transfer(direction, amount) {
  const before = await save();
  await finance();
  await page.getByLabel("财政转移金额", { exact: true }).fill(String(amount));
  await page
    .getByRole("button", {
      name: direction === "grant" ? "预览中央专项拨款" : "预览地方财政征调",
      exact: true,
    })
    .click();
  await confirm();
  const after = await save(),
    multiplier = direction === "grant" ? 1 : -1;
  assert.equal(after.core.treasury, before.core.treasury - amount * multiplier);
  assert.equal(
    after.machine.fiscal.locals.south,
    before.machine.fiscal.locals.south + amount * multiplier,
  );
  assert.equal(
    after.core.treasury + after.machine.fiscal.locals.south,
    before.core.treasury + before.machine.fiscal.locals.south,
    "transfers cannot create money",
  );
  assert.equal(after.machine.fiscal.ledger[0].category, "transfer");
}
async function turn() {
  await close();
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  const button = page.getByRole("button", { name: "确认推进", exact: true });
  await button.waitFor();
  const box = await button.boundingBox();
  assert.ok(box.y + box.height <= page.viewportSize().height);
  await button.click();
}
async function authorize(kind, lead) {
  const game = await save(),
    entry = game.machine.matters.find((item) => item.kind === kind);
  assert.ok(entry);
  await rail("国家事务").click();
  const card = page.locator(".v2-matter").filter({
    has: page.getByRole("heading", { name: entry.title, exact: true }),
  });
  await card
    .getByRole("button", { name: "调整本事务指挥关系 / 临时授权" })
    .click();
  await page.getByLabel("临时主管", { exact: true }).selectOption(lead);
  await page.getByLabel("正式邀请中央—地方联合参与").uncheck();
  await page.getByRole("button", { name: "预览临时授权", exact: true }).click();
  await confirm();
}
async function appointment(personName, office, secondary = false) {
  await close();
  await rail("人事管理").click();
  await page.locator(".staff-query > summary").click();
  await page
    .getByRole("button", { name: `查看${personName}资料`, exact: true })
    .click();
  await page
    .getByLabel("人员详情任免职位", { exact: true })
    .selectOption(office);
  await page
    .getByLabel("人员任命工作关系", { exact: true })
    .selectOption(secondary ? "secondary" : "primary");
  await page
    .getByRole("button", {
      name: secondary ? "预览正式兼职" : "预览主职任命",
      exact: true,
    })
    .click();
  await page.getByRole("region", { name: "人事安排后果", exact: true }).count();
  assert.ok(
    (await page.locator(".appointment-impact").innerText()).includes(
      "职务变化",
    ),
  );
  await confirm();
}

async function panelBounds(target, label) {
  const panel = target.locator(".command-panel");
  const metrics = await panel.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      box: [box.x, box.y, box.right, box.bottom],
      doc: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
    };
  });
  assert.deepEqual(
    metrics.doc,
    metrics.viewport,
    `${label}: page scroll while panel open`,
  );
  assert.ok(
    metrics.box[0] >= 0 &&
      metrics.box[1] >= 0 &&
      metrics.box[2] <= metrics.viewport[0] + 1 &&
      metrics.box[3] <= metrics.viewport[1] + 1,
    `${label}: panel outside viewport`,
  );
  await target.locator(".panel-heading .panel-close").click({ trial: true });
  const footer = target.locator(".panel-footer");
  if (await footer.count())
    for (const button of await footer.getByRole("button").all())
      if (await button.isEnabled()) await button.click({ trial: true });
}
async function viewMetrics(target, label) {
  const value = await target.evaluate(() => {
    const doc = document.documentElement,
      bar = document.querySelector(".status-bar").getBoundingClientRect(),
      end = document.querySelector(".end-turn"),
      box = end.getBoundingClientRect();
    const map = document
      .querySelector(".map-workspace")
      .getBoundingClientRect();
    return {
      label: "",
      viewport: [innerWidth, innerHeight],
      doc: [doc.scrollWidth, doc.scrollHeight],
      ratio: devicePixelRatio,
      endInside:
        box.bottom <= innerHeight && box.x >= 0 && box.right <= innerWidth,
      endHit: end.contains(
        document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        ),
      ),
      resourcesInside: [
        ...document.querySelectorAll(".resource-tip strong"),
      ].every((node) => node.getBoundingClientRect().bottom <= bar.bottom + 1),
      functionsInside: [...document.querySelectorAll(".function-rail>button")]
        .slice(0, 6)
        .every((node) => {
          const r = node.getBoundingClientRect();
          return r.y >= bar.bottom && r.bottom <= box.y;
        }),
      map: [map.width, map.height],
      font: parseFloat(
        getComputedStyle(document.querySelector(".command-app")).fontSize,
      ),
    };
  });
  value.label = label;
  assert.deepEqual(value.doc, value.viewport, `${label}: global page overflow`);
  assert.ok(
    value.endInside && value.endHit,
    `${label}: end button clipped or covered`,
  );
  assert.ok(
    value.resourcesInside && value.functionsInside,
    `${label}: essential controls clipped`,
  );
  assert.ok(
    value.font >= 16 && value.map[0] > 250 && value.map[1] > 150,
    `${label}: unreadable or map lost`,
  );
  return value;
}

async function realCampaign() {
  console.log("v0.5: unmodified-resource twelve-turn prosperity campaign");
  let game = await start("v05-真实财政富国新政");
  await finance();
  assert.equal(
    await page
      .getByRole("region", { name: "各省财政收支预测", exact: true })
      .locator("tbody tr")
      .count(),
    3,
  );
  await shot("state-finance-opening");
  await close();
  await rail("人事管理").click();
  await page.locator(".staff-query > summary").click();
  assert.equal(await page.locator(".personnel-table tbody tr").count(), 24);
  await page
    .getByLabel("按派系筛选人员", { exact: true })
    .selectOption("technocrat");
  assert.ok((await page.locator(".personnel-table tbody tr").count()) > 0);
  await page
    .getByLabel("按专业筛选人员", { exact: true })
    .selectOption("production");
  const filtered = await page.locator(".personnel-table tbody").innerText();
  assert.ok(filtered.includes("林铸") && filtered.includes("墨玄"));
  await page
    .getByRole("button", { name: "按组织状态排序", exact: true })
    .click();
  assert.equal(
    await page.locator('th[aria-sort="ascending"]').innerText(),
    "组织状态 ↑",
  );
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await rosterShot("national-personnel");
  await reform("改变国家基本管理体制", "中央垂直领导");
  await matter("warning", "记录异常频谱");
  await matter("gazette", "兼容标准");
  await economy("灵脉勘探");
  await policy("method", "协商");
  await turn();
  await rail("国家目标").click();
  await page.locator(".planning-route-picker summary").click();
  await page.getByRole("button", { name: /提交富国新政立项/ }).click();
  await confirm();
  await region("south");
  await economy("合作磋商");
  await matter("accident", "第十三号高级封印");
  await reform("调整某类事务的长期归属", "全国异常垂直主责", "south");
  await turn();
  await authorize("distrust", "gov-south");
  await matter("distrust", "签署资源收益协约");
  await region("south");
  await project("energy", "mo");
  await region("industry");
  await economy("地方财政稽核");
  await budget("国家安全委员会", 0);
  await turn();
  await finance();
  await page
    .getByRole("button", { name: "预览联合出资协议", exact: true })
    .click();
  await confirm();
  await region("industry");
  await economy("资源普查");
  await matter("oldgod", "第十三号高级封印");
  await turn();
  await region("industry");
  await project("factory", "han");
  await region("south");
  const beforeGrid = await save();
  await project("grid", "mo", "joint");
  game = await save();
  const grid = game.machine.works.find((work) => work.type === "grid");
  assert.ok(grid && grid.contract.mode === "joint");
  assert.equal(game.core.treasury, beforeGrid.core.treasury - 2);
  assert.equal(
    game.machine.fiscal.locals.south,
    beforeGrid.machine.fiscal.locals.south - 2,
  );
  assert.equal(
    game.machine.fiscal.ledger
      .filter(
        (entry) =>
          entry.category === "investment" && entry.source === grid.source,
      )
      .reduce((sum, entry) => sum + entry.amount, 0),
    4,
  );
  await close();
  await rail("经济建设").click();
  const network = page.locator(`[data-network-id="${grid.id}"]`);
  await network
    .getByRole("button", { name: "调阅中央计划委员会", exact: true })
    .click();
  await page.getByRole("dialog", { name: "中央政府", exact: true }).waitFor();
  await close();
  await rail("经济建设").click();
  await page
    .locator(`[data-network-id="${grid.id}"]`)
    .getByRole("button", { name: "调阅墨玄", exact: true })
    .click();
  await page.getByRole("dialog", { name: "人事管理", exact: true }).waitFor();
  await page.locator(".staff-query > summary").click();
  assert.ok(
    (await page.locator(".personnel-detail").innerText()).includes("专职"),
  );
  await shot("grid-specialist-assignment");
  await transfer("levy", 4);
  await turn();
  await appointment("墨玄", "gov-south");
  await transfer("grant", 1);
  await turn();
  await turn();
  await transfer("grant", 2);
  await turn();
  game = await save();
  assert.equal(
    game.machine.works.find((work) => work.type === "grid").completed,
    true,
  );
  await close();
  await rail("经济建设").click();
  await shot("operating-energy-network");
  let repairs = 0;
  while (game.core.turn < 12) {
    if (game.machine.works.find((work) => work.type === "grid").network.fault) {
      await economy("组织实际电网维修");
      repairs++;
    }
    if (game.core.turn >= 10 && !game.machine.terminalInspected) {
      await close();
      await rail("国家目标").click();
      await page.locator('[data-strategy-node="final"]').click();
      await page
        .getByRole("button", { name: "预览全国协作演练", exact: true })
        .click();
      await confirm();
    }
    await turn();
    game = await save();
    assert.equal(game.core.status, "playing");
    if (game.core.turn === 10) {
      const original = JSON.stringify(game);
      await page.reload();
      await page.getByRole("button", { name: "继续游戏", exact: true }).click();
      await close();
      assert.equal(
        JSON.stringify(await save()),
        original,
        "reloading must preserve fiscal, assignment, project and RNG state",
      );
    }
  }
  await matter("final", "全国财政与产业制度审议");
  await turn();
  await page
    .getByRole("dialog", { name: "国家机器发挥了作用。", exact: true })
    .waitFor();
  await shot("twelve-turn-prosperity-victory");
  game = await save();
  assert.equal(game.core.status, "won");
  assert.equal(game.core.turn, 12);
  assert.equal(game.core.insolvency, 0);
  assert.equal(game.machine.works.filter((work) => work.completed).length, 3);
  assert.ok(repairs > 0, "the genuine grid fault must require a real repair");
  results.campaign = {
    seed: game.core.seed,
    turn: game.core.turn,
    status: game.core.status,
    repairs,
    projects: game.machine.works.length,
    fiscalLedgerEntries: game.machine.fiscal.ledger.length,
  };
}

async function reformBranch() {
  console.log("v0.5: genuine opening tax reform and account distribution");
  const initial = await start("v05-UI税制分配", "national");
  await finance();
  await page
    .getByRole("button", { name: "预览中央统一征税", exact: true })
    .click();
  assert.ok(
    (await page.locator(".semantic-conditions").innerText()).includes("已满足"),
  );
  await confirm();
  const game = await save();
  assert.equal(game.machine.fiscal.taxSystem, "central");
  assert.equal(game.core.treasury, initial.core.treasury - 1);
  assert.deepEqual(game.machine.fiscal.locals, initial.machine.fiscal.locals);
  for (const pid of ["industry", "south", "north"])
    assert.equal(
      game.core.grievances[game.core.appointments[`gov-${pid}`]],
      initial.core.grievances[game.core.appointments[`gov-${pid}`]] + 1,
    );
  await finance();
  const rows = await page
    .getByRole("region", { name: "各省财政收支预测", exact: true })
    .locator("tbody tr")
    .allTextContents();
  assert.ok(
    rows.every((row) => /3 = 3 \+ 0/.test(row)),
    `centralized taxes leave no duplicate local share: ${rows}`,
  );
  await shot("central-tax-reform");
  results.taxReform =
    "real starting resources; central cash cost, local political cost and tax distribution verified";
}

async function personnelBranch() {
  console.log("v0.5: genuine opening limited formal side appointment");
  await start("v05-UI真实兼职", "national");
  await rail("人事管理").click();
  await page.locator(".staff-query > summary").click();
  await page
    .getByRole("button", { name: "查看星野澪资料", exact: true })
    .click();
  await page
    .getByRole("button", { name: "预览免去南岭省政府", exact: true })
    .click();
  await confirm();
  await appointment("林铸", "gov-south", true);
  let game = await save();
  assert.equal(game.core.appointments.plan, "lin");
  assert.equal(game.core.appointments["gov-south"], null);
  assert.equal(game.machine.secondaryAppointments["gov-south"], "lin");
  await rail("人事管理").click();
  await page.locator(".staff-query > summary").click();
  await page
    .getByLabel("按机构筛选人员", { exact: true })
    .selectOption("gov-south");
  await page
    .getByLabel("按工作状态筛选人员", { exact: true })
    .selectOption("concurrent");
  assert.equal(await page.locator(".personnel-table tbody tr").count(), 1);
  assert.ok(
    (await page.locator(".personnel-table tbody").innerText()).includes("林铸"),
  );
  await rosterShot("formal-side-appointment");
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await page.getByRole("button", { name: "查看叶冬资料", exact: true }).click();
  await page
    .getByRole("button", { name: "预览免去北境省政府", exact: true })
    .click();
  await confirm();
  const beforeRejectedSide = await save();
  await close();
  await rail("人事管理").click();
  await page.locator(".staff-query > summary").click();
  await page.getByRole("button", { name: "查看林铸资料", exact: true }).click();
  await page
    .getByLabel("人员详情任免职位", { exact: true })
    .selectOption("gov-north");
  await page
    .getByLabel("人员任命工作关系", { exact: true })
    .selectOption("secondary");
  await page.getByRole("button", { name: "预览正式兼职", exact: true }).click();
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "确认执行", exact: true })
      .isDisabled(),
    true,
  );
  assert.ok(
    (await page.getByRole("dialog").innerText()).includes("最多一项正式兼职"),
  );
  await close();
  game = await save();
  assert.deepEqual(
    game,
    beforeRejectedSide,
    "opening a blocked second-side preview must not mutate any game state",
  );
  assert.equal(game.machine.secondaryAppointments["gov-north"] || null, null);
  assert.equal(game.core.commands, 2);
  const original = JSON.stringify(game);
  await page.reload();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await close();
  assert.equal(JSON.stringify(await save()), original);
  await rail("人事管理").click();
  await page.locator(".staff-query > summary").click();
  await page.getByRole("button", { name: "查看林铸资料", exact: true }).click();
  await page
    .getByRole("button", { name: "预览取消南岭省政府兼职", exact: true })
    .click();
  await confirm();
  game = await save();
  assert.equal(game.machine.secondaryAppointments["gov-south"], null);
  assert.equal(game.core.appointments.plan, "lin");
  results.personnel =
    "all24, combined filters, numerical sort, real vacancy + one side limit, unchanged rejected request, reload + cancellation";
}

async function desktopLayout() {
  await close();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    results.desktop.push(await viewMetrics(page, `${width}x${height}`));
    await finance();
    await panelBounds(page, "finance");
    await close();
    await rail("人事管理").click();
    await page.locator(".staff-query > summary").click();
    await panelBounds(page, "personnel");
    await page
      .locator(".panel-scroll")
      .evaluate((node) => (node.scrollTop = node.scrollHeight));
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollTop),
      0,
    );
    await close();
    await shot(`desktop-${width}x${height}`);
  }
}

async function native125Layout() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "fow-v5-native125-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      channel: executablePath ? undefined : "chromium",
      headless: true,
      viewport: null,
      args: ["--no-sandbox", "--window-size=1280,720"],
    });
    const target = context.pages()[0];
    target.setDefaultTimeout(15000);
    target.on("pageerror", (error) => errors.push(error.message));
    await target.goto("chrome://settings/appearance");
    const cdp = await context.newCDPSession(target),
      { windowId } = await cdp.send("Browser.getWindowForTarget");
    // Window bounds include native borders and the browser toolbar. Measure
    // their actual size at 100%, before page zoom changes CSS pixel dimensions.
    // Windows has horizontal frame insets that Linux's headless window lacks.
    const nativeFrames = [];
    for (const [width, height] of sizes) {
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width, height },
      });
      await target.waitForFunction(
        ([w, h]) => outerWidth === w && outerHeight === h,
        [width, height],
      );
      const frame = await target.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve({
                  outer: [outerWidth, outerHeight],
                  content: [innerWidth, innerHeight],
                  insets: [outerWidth - innerWidth, outerHeight - innerHeight],
                  ratio: devicePixelRatio,
                }),
              ),
            ),
          ),
      );
      assert.equal(
        frame.ratio,
        1,
        "native frame calibration requires 100% zoom",
      );
      assert.deepEqual(frame.outer, [width, height]);
      assert.ok(frame.insets.every((inset) => inset >= 0));
      nativeFrames.push(frame);
    }
    results.nativeChromeAt100 = nativeFrames;
    await target.locator("#zoomLevel").selectOption("1.25");
    await target.goto(base);
    await target
      .getByRole("button", { name: "开始新游戏", exact: true })
      .click();
    await target.getByLabel("剧本", { exact: true }).selectOption("national");
    await target
      .getByLabel("政治开局", { exact: true })
      .selectOption("classic");
    await target.getByRole("button", { name: "开始任期", exact: true }).click();
    const guide = target.getByRole("button", { name: "独立治理", exact: true });
    if (await guide.count()) await guide.click();
    await close(target);
    for (const frame of nativeFrames) {
      const [width, height] = frame.outer;
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width, height },
      });
      await target.waitForFunction(
        ([w, h]) => outerWidth === w && outerHeight === h,
        [width, height],
      );
      const metrics = await viewMetrics(target, `native125-${width}x${height}`);
      assert.equal(metrics.ratio, 1.25);
      assert.deepEqual(
        metrics.viewport,
        frame.content.map((dimension) => Math.round(dimension / 1.25)),
        "125% CSS viewport must match the measured native content area",
      );
      metrics.chromeInsets = frame.insets;
      metrics.contentPixels = frame.content;
      results.native125.push(metrics);
      await rail("人事管理", target).click();
      await panelBounds(target, "native125 personnel");
      await target
        .locator(".panel-scroll")
        .evaluate((node) => (node.scrollTop = node.scrollHeight));
      await close(target);
      await rail("经济建设", target).click();
      await target
        .getByRole("button", { name: "国家财政账本", exact: true })
        .click();
      assert.equal(
        await target
          .getByRole("region", { name: "各省财政收支预测", exact: true })
          .locator("tbody tr")
          .count(),
        3,
        "native zoom must exercise the full new ledger, not the legacy placeholder",
      );
      await panelBounds(target, "native125 finance");
      await close(target);
      await target
        .getByRole("button", { name: "结束回合", exact: true })
        .click();
      await panelBounds(target, "native125 turn decision");
      await target
        .getByRole("button", { name: "确认推进", exact: true })
        .click({ trial: true });
      await close(target);
      // Playwright's default surface screenshot crops to CSS pixels at native
      // page zoom. Capture the real compositor viewport, without rescaling it.
      const capture = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: false,
        captureBeyondViewport: false,
      });
      const bytes = Buffer.from(capture.data, "base64");
      const pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
      assert.ok(
        pixels.every(
          (value, index) =>
            Math.abs(value - metrics.viewport[index] * metrics.ratio) <= 1,
        ),
        "native screenshot must include the complete physical viewport",
      );
      assert.deepEqual(
        pixels,
        frame.content,
        "compositor capture must match the content area measured at 100%",
      );
      metrics.pixels = pixels;
      await writeFile(
        path.join(shots, `native125-${width}x${height}.png`),
        bytes,
      );
    }
  } finally {
    if (context) await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

try {
  await realCampaign();
  await reformBranch();
  await personnelBranch();
  await desktopLayout();
  await native125Layout();
  assert.deepEqual(errors, []);
  results.errors = errors;
  await writeFile(
    path.join(shots, "v5-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} catch (error) {
  await shot("failure").catch(() => {});
  await writeFile(
    path.join(shots, "failure-context.txt"),
    await page
      .locator("body")
      .innerText()
      .catch(() => "page closed"),
  ).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
