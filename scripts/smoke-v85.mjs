import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
const base = process.argv[2] || "http://localhost:5173",
  shots = process.env.FOW_SCREENSHOT_DIR || "artifacts/screenshots/v85",
  executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const loader = await createServer({
    server: { middlewareMode: true, hmr: false },
  }),
  E = await loader.ssrLoadModule("/src/v2/engine.ts"),
  T = await loader.ssrLoadModule("/src/v2/governanceTrial.ts"),
  D = await loader.ssrLoadModule("/src/v2/data.ts"),
  F = await loader.ssrLoadModule("/src/v2/fiscal.ts"),
  A = await loader.ssrLoadModule("/src/v2/administration.ts"),
  W = await loader.ssrLoadModule("/scripts/governance-trial.ts");
const witnesses = Object.fromEntries(
  ["central", "local", "professional"].map((p) => [p, W.runGovernanceTrial(p)]),
);
await loader.close();
const sizes = [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1280, 720],
  ],
  errors = [],
  results = {
    source:
      "All three four-meeting scenarios through actual UI and original command API. Disclosed scenario budgets, not ordinary campaign balance. Native profiles restore a real UI save; no injected high-resource fixture.",
    routes: [],
    desktop: [],
    native125: [],
    burden: [],
    humanReadability:
      "NOT RUN: screenshots and blank evaluation sheets are provided for independent human review.",
  };
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
let page, g, checkpoint, riskBaseSave;
const rail = (name, p = page) =>
  p
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
async function close(p = page) {
  const x = p.locator(".panel-heading .panel-close");
  if (await x.count()) await x.first().click();
}
async function confirm() {
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  const b = page.getByRole("button", { name: "确认执行", exact: true });
  assert.equal(
    await b.isDisabled(),
    false,
    await page.getByRole("dialog").innerText(),
  );
  await b.click();
}
async function save() {
  await close();
  await page.getByRole("button", { name: "暂停菜单", exact: true }).click();
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  const x = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  await close();
  return x;
}
async function work(id) {
  await close();
  await page.locator(`[data-board-work="${id}"]`).click();
}
async function stage(a) {
  await close();
  if (a.type === "appoint" || a.type === "concurrent") {
    await page.locator(`[data-board-office="${a.office}"]`).click();
    await page.getByLabel("职位", { exact: true }).selectOption(a.office);
    if (a.person) {
      await page
        .getByLabel("组织候选人", { exact: true })
        .selectOption(a.person);
      await page
        .getByRole("button", {
          name:
            a.type === "concurrent" ? "预览正式兼职安排" : "比较后预览主职任命",
          exact: true,
        })
        .click();
    } else
      await page.getByRole("button", { name: "预览免职", exact: true }).click();
  } else if (a.type === "project") {
    await page.getByLabel("关注地区", { exact: true }).selectOption(a.province);
    await rail("经济建设").click();
    await page.getByLabel("建设类型", { exact: true }).selectOption(a.project);
    await page.getByLabel("项目负责人", { exact: true }).selectOption(a.worker);
    await page
      .getByLabel("工作分配", { exact: true })
      .selectOption(a.assignment);
    await page
      .getByLabel("工程出资方式", { exact: true })
      .selectOption(a.funding);
    await page
      .getByRole("button", { name: "预览项目开工", exact: true })
      .click();
  } else if (a.type === "agendaDecision") {
    await page.locator(`[data-board-agenda="${a.agenda}"]`).click();
    await page
      .getByRole("button", {
        name: `预览${{ accept: "接受议程", negotiate: "谈判议程", delay: "延期议程", reject: "拒绝议程" }[a.choice]}`,
        exact: true,
      })
      .click();
  } else if (a.type === "resolve") {
    const m = g.machine.matters.find((m) => m.id === a.matter),
      p = D.plansFor(m, g.machine.goal).find((p) => p.id === a.option);
    const onBoard = page.locator(`[data-board-matter="${a.matter}"]`);
    if (await onBoard.count()) await onBoard.click();
    else await rail("国家事务").click();
    await page
      .locator(`[data-matter-id="${a.matter}"]`)
      .getByRole("button", { name: new RegExp(p.title) })
      .click();
  } else if (a.type === "authorize") {
    await rail("国家事务").click();
    await page
      .locator(`[data-matter-id="${a.matter}"]`)
      .getByRole("button", {
        name: "调整本事务指挥关系 / 临时授权",
        exact: true,
      })
      .click();
    await page.getByLabel("具体事务", { exact: true }).selectOption(a.matter);
    await page.getByLabel("临时主管", { exact: true }).selectOption(a.lead);
    await page.getByLabel("正式邀请中央—地方联合参与").setChecked(a.joint);
    await page.getByLabel("阶段≥2时取得紧急强制权").setChecked(a.emergency);
    await page
      .getByRole("button", { name: "预览临时授权", exact: true })
      .click();
  } else if (a.type === "reconcile") {
    await page.locator(".board-action-slots>summary").click();
    await page
      .getByLabel("部门行动机构", { exact: true })
      .selectOption(`gov-${a.province}`);
    await page
      .getByRole("button", { name: "恢复地方协约", exact: true })
      .click();
  } else if (a.type === "fiscalTransfer") {
    await page.getByLabel("关注地区", { exact: true }).selectOption(a.province);
    await rail("经济建设").click();
    await page
      .getByRole("button", { name: "国家财政账本", exact: true })
      .click();
    await page
      .getByLabel("财政转移金额", { exact: true })
      .fill(String(a.amount));
    await page
      .getByRole("button", {
        name: a.direction === "grant" ? "预览中央专项拨款" : "预览地方财政征调",
        exact: true,
      })
      .click();
  } else if (a.type === "maintenanceSponsor") {
    await work(a.work);
    await page
      .getByRole("button", {
        name: `${F.accountLabel(g, a.account)}承接本设施维护`,
        exact: true,
      })
      .click();
  } else if (a.type === "network") {
    await work(a.work);
    await page
      .locator(`[data-network-id="${a.work}"]`)
      .getByRole("button", {
        name: {
          repair: "组织实际电网维修",
          consent: "协商运营者应急授权",
          close: "按合同停机",
          reopen: "按合同恢复供能",
        }[a.operation],
        exact: true,
      })
      .click();
  } else if (a.type === "borderSupply") {
    const grid = g.machine.works.find((w) => w.type === "grid");
    await work(grid.id);
    await page.getByText("交通—工业设备—北境防线", { exact: true }).click();
    await page
      .getByRole("button", {
        name: a.route === "rail" ? "铁路输送工业防线设备" : "江湖联运北境设备",
        exact: true,
      })
      .click();
  } else if (a.type === "train") {
    await rail("人事管理").click();
    await page.getByLabel("培养专业", { exact: true }).selectOption(a.cap);
    await page.getByLabel("培养导师", { exact: true }).selectOption(a.mentor);
    await page.getByLabel("培养学员", { exact: true }).selectOption(a.student);
    await page.getByLabel("教学地区", { exact: true }).selectOption(a.province);
    await page.getByLabel("教学方式", { exact: true }).selectOption(a.method);
    await page.getByLabel("教学设施", { exact: true }).selectOption(a.facility);
    await page
      .getByRole("button", { name: "预览指定学员培养", exact: true })
      .click();
  } else if (a.type === "pause") {
    await work(a.work);
    const w = g.machine.works.find((w) => w.id === a.work);
    await page
      .getByRole("button", {
        name: w.paused ? "恢复工程安排" : "暂停工程释放人员",
        exact: true,
      })
      .click();
  } else if (a.type === "budget") {
    await rail("经济建设").click();
    const name = A.departmentLabels[a.department];
    await page
      .getByLabel(`${name}预算`, { exact: true })
      .selectOption(String(a.level));
    await page
      .getByRole("button", { name: `预览${name}预算`, exact: true })
      .click();
  } else throw Error(`Unimplemented UI action ${a.type}`);
}
async function viewport(p, label) {
  const m = await p.evaluate(() => {
    const end = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "结束回合",
      ),
      r = end.getBoundingClientRect(),
      hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      viewport: [innerWidth, innerHeight],
      doc: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
      ratio: devicePixelRatio,
      hit: hit === end || end.contains(hit),
      offices: document.querySelectorAll("[data-board-office]").length,
      font: parseFloat(
        getComputedStyle(document.querySelector(".command-app")).fontSize,
      ),
      zones: [...document.querySelectorAll(".board-zone")].map((n) => {
        const r = n.getBoundingClientRect();
        return [r.x, r.y, r.right, r.bottom];
      }),
    };
  });
  assert.deepEqual(m.doc, m.viewport);
  assert.ok(m.hit);
  assert.equal(m.offices, 6);
  assert.ok(m.font >= 16);
  assert.ok(
    m.zones.every(
      (r) =>
        r[0] >= 0 &&
        r[1] >= 0 &&
        r[2] <= m.viewport[0] + 1 &&
        r[3] <= m.viewport[1] + 1,
    ),
  );
  return { label, ...m };
}
async function bounds(p) {
  const m = await p.getByRole("dialog").evaluate((n) => {
    const r = n.getBoundingClientRect();
    return {
      box: [r.x, r.y, r.right, r.bottom],
      view: [innerWidth, innerHeight],
      doc: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
    };
  });
  assert.deepEqual(m.doc, m.view);
  assert.ok(
    m.box[0] >= 0 &&
      m.box[1] >= 0 &&
      m.box[2] <= m.view[0] + 1 &&
      m.box[3] <= m.view[1] + 1,
  );
  await p.locator(".panel-close").click({ trial: true });
  assert.equal(await p.getByRole("dialog").count(), 1);
}
try {
  for (const route of process.env.FOW_V85_ROUTE
    ? [process.env.FOW_V85_ROUTE]
    : ["central", "local", "professional"]) {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page
      .getByRole("button", { name: "四次会议与一座电站", exact: true })
      .click();
    await close();
    g = T.startGovernanceTrial();
    assert.equal(
      await page
        .getByRole("region", { name: "国家治理桌面", exact: true })
        .count(),
      1,
    );
    assert.ok(
      (await page.locator('[data-board-office="plan"]').innerText()).includes(
        "专职派遣",
      ),
    );
    if (route === "central")
      await page.screenshot({
        path: path.join(shots, "Case-E-first-meeting.png"),
      });
    const metrics = { route, actions: [], status: null };
    for (const t of witnesses[route].trace) {
      const a = t.action;
      await close();
      await page
        .getByRole("button", { name: "国家治理桌面", exact: true })
        .click();
      if (route === "local" && a.type === "maintenanceSponsor")
        riskBaseSave = await save();
      if (a.type === "end") {
        await page
          .getByRole("button", { name: "结束回合", exact: true })
          .click();
        await page
          .getByRole("button", { name: "确认推进", exact: true })
          .click();
      } else {
        await stage(a);
        await confirm();
      }
      g = E.executeCommand(g, a).game;
      const actual = await save();
      assert.deepEqual(actual.core, g.core);
      assert.deepEqual(actual.machine.works, g.machine.works);
      assert.deepEqual(actual.machine.trainings, g.machine.trainings);
      assert.deepEqual(actual.machine.agendas, g.machine.agendas);
      assert.deepEqual(
        actual.machine.secondaryAppointments,
        g.machine.secondaryAppointments,
      );
      metrics.actions.push({
        turn: t.turn,
        type: a.type,
        commands: actual.core.commands,
        cash: actual.core.treasury,
      });
      await page
        .getByRole("button", { name: "国家治理桌面", exact: true })
        .click();
      if (a.type === "end" && actual.core.turn === 3) {
        await page.screenshot({
          path: path.join(shots, `${route}-meeting3.png`),
        });
        if (route === "central") checkpoint = actual;
      }
    }
    assert.equal(g.core.status, "won");
    assert.ok(T.trialChecks(g).every((c) => c.met));
    metrics.status = g.core.status;
    results.routes.push(metrics);
    await page.screenshot({ path: path.join(shots, `${route}-outcome.png`) });
    console.log("UI ROUTE PASS", route);
    await ctx.close();
  }
  if (checkpoint) {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((s) => {
      try {
        localStorage.setItem("federation-worlds-v2", JSON.stringify(s));
        localStorage.setItem(
          "federation-ui",
          JSON.stringify({
            scale: 100,
            hints: false,
            advisorMode: "manual",
            animate: false,
            workView: "table",
          }),
        );
        localStorage.setItem("federation-guide-choice", "1");
      } catch {}
    }, checkpoint);
    await page.goto(base);
    await page.getByRole("button", { name: "继续游戏", exact: true }).click();
    await close();
    const before = await save();
    await page.getByRole("button", { name: "地图视图", exact: true }).click();
    await page
      .getByRole("button", { name: "国家治理桌面", exact: true })
      .click();
    assert.deepEqual(await save(), before);
    await page.getByRole("button", { name: "规则速查卡", exact: true }).click();
    await bounds(page);
    await close();
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      results.desktop.push(await viewport(page, `${w}x${h}`));
      await page.screenshot({ path: path.join(shots, `table-${w}x${h}.png`) });
      const grid = checkpoint.machine.works.find((w) => w.type === "grid");
      await page.locator(`[data-board-work="${grid.id}"]`).click();
      await bounds(page);
      await validPreview(page, checkpoint, grid);
      await close();
    }
    await ctx.close();
    await native(checkpoint);
  }
  if (riskBaseSave) {
    await riskAndBurden(riskBaseSave);
  }
  assert.deepEqual(errors, []);
  results.errors = errors;
  await writeFile(
    path.join(shots, "test-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    `v0.8.5 governance table, ${results.routes.length} actual UI routes, synchronized state, four desktop and native125 checks passed`,
  );
} catch (e) {
  await page
    ?.screenshot({ path: path.join(shots, "failure.png") })
    .catch(() => {});
  throw e;
} finally {
  await browser.close();
}
async function native(saved) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "fow-v85-native-"));
  let c;
  try {
    c = await chromium.launchPersistentContext(profile, {
      executablePath,
      channel: executablePath ? undefined : "chromium",
      headless: true,
      viewport: null,
      args: ["--no-sandbox", "--window-size=1280,720"],
    });
    const p = c.pages()[0];
    p.setDefaultTimeout(15000);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("chrome://settings/appearance");
    const cdp = await c.newCDPSession(p),
      { windowId } = await cdp.send("Browser.getWindowForTarget"),
      frames = [];
    for (const [w, h] of sizes) {
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: w, height: h },
      });
      await p.waitForFunction(
        ([w, h]) => outerWidth === w && outerHeight === h,
        [w, h],
      );
      frames.push(
        await p.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  resolve({
                    content: [innerWidth, innerHeight],
                    ratio: devicePixelRatio,
                  }),
                ),
              ),
            ),
        ),
      );
      assert.equal(frames.at(-1).ratio, 1);
    }
    await p.locator("#zoomLevel").selectOption("1.25");
    await c.addInitScript((s) => {
      try {
        localStorage.setItem("federation-worlds-v2", JSON.stringify(s));
        localStorage.setItem(
          "federation-ui",
          JSON.stringify({
            scale: 100,
            hints: false,
            advisorMode: "manual",
            animate: false,
            workView: "table",
          }),
        );
        localStorage.setItem("federation-guide-choice", "1");
      } catch {}
    }, saved);
    await p.goto(base);
    await p.getByRole("button", { name: "继续游戏", exact: true }).click();
    await close(p);
    for (let i = 0; i < sizes.length; i++) {
      const [w, h] = sizes[i],
        frame = frames[i];
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: w, height: h },
      });
      await p.waitForFunction(
        ({ w, h, content }) =>
          outerWidth === w &&
          outerHeight === h &&
          devicePixelRatio === 1.25 &&
          innerWidth === Math.round(content[0] / 1.25) &&
          innerHeight === Math.round(content[1] / 1.25),
        { w, h, content: frame.content },
      );
      const m = await viewport(p, `${w}x${h}`);
      assert.equal(m.ratio, 1.25);
      const capture = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: false,
          captureBeyondViewport: false,
        }),
        bytes = Buffer.from(capture.data, "base64");
      m.pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
      assert.deepEqual(m.pixels, frame.content);
      results.native125.push(m);
      await writeFile(path.join(shots, `native125-${w}x${h}.png`), bytes);
      await p.getByRole("button", { name: "规则速查卡", exact: true }).click();
      await bounds(p);
      await close(p);
      const grid = saved.machine.works.find((w) => w.type === "grid");
      await p.locator(`[data-board-work="${grid.id}"]`).click();
      await bounds(p);
      await validPreview(p, saved, grid);
      await close(p);
    }
    console.log("NATIVE125 PASS", results.native125.length);
  } finally {
    await c?.close();
    await rm(profile, { recursive: true, force: true });
  }
}

async function validPreview(p, saved, grid) {
  const account =
    grid.maintenanceSponsor === "central" ? grid.province : "central";
  await p
    .getByRole("button", {
      name: `${F.accountLabel(saved, account)}承接本设施维护`,
      exact: true,
    })
    .click();
  await bounds(p);
  await p.getByRole("button", { name: "预览后果", exact: true }).click();
  const b = p.getByRole("button", { name: "确认执行", exact: true });
  assert.equal(await b.isDisabled(), false);
  await b.click({ trial: true });
  await close(p);
}
async function restore(saved, view = "table") {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ s, view }) => {
      try {
        localStorage.setItem("federation-worlds-v2", JSON.stringify(s));
        localStorage.setItem(
          "federation-ui",
          JSON.stringify({
            scale: 100,
            hints: false,
            advisorMode: "manual",
            animate: false,
            workView: view,
          }),
        );
        localStorage.setItem("federation-guide-choice", "1");
      } catch {}
    },
    { s: saved, view },
  );
  await page.goto(base);
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await close();
  g = structuredClone(saved);
  return ctx;
}
async function riskAndBurden(saved) {
  let ctx = await restore(saved),
    grid = g.machine.works.find((w) => w.type === "grid");
  const levy = {
    type: "fiscalTransfer",
    province: "south",
    direction: "levy",
    amount: 2,
  };
  await stage(levy);
  await confirm();
  g = E.executeCommand(g, levy).game;
  const atRisk = await save();
  assert.deepEqual(atRisk.core, g.core);
  const before = F.nationalForecast(g).facilities.find(
    (w) => w.work === grid.id,
  );
  assert.ok(before.maintenance.arrears > 0);
  await page.screenshot({ path: path.join(shots, "Case-A-risk.png") });
  await work(grid.id);
  await page.screenshot({ path: path.join(shots, "Case-B-components.png") });
  const sponsor = {
    type: "maintenanceSponsor",
    work: grid.id,
    account: "central",
  };
  await stage(sponsor);
  assert.ok(E.previewAction(g, sponsor).errors.length > 0);
  assert.equal(
    await page
      .getByRole("button", { name: "确认执行", exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({ path: path.join(shots, "Case-C-bottleneck.png") });
  await page
    .locator('section[aria-label="组织瓶颈与构筑前后对照"]')
    .getByRole("button", { name: /中央计划委员会.*林铸/ })
    .click();
  assert.equal(
    await page.getByLabel("职位", { exact: true }).inputValue(),
    "plan",
  );
  await page.getByLabel("组织候选人", { exact: true }).selectOption("wen");
  await page
    .getByRole("button", { name: "比较后预览主职任命", exact: true })
    .click();
  await confirm();
  g = E.executeCommand(g, {
    type: "appoint",
    office: "plan",
    person: "wen",
  }).game;
  await stage(sponsor);
  await confirm();
  g = E.executeCommand(g, sponsor).game;
  const actual = await save();
  assert.deepEqual(actual.core, g.core);
  assert.deepEqual(actual.machine.works, g.machine.works);
  const after = F.nationalForecast(g).facilities.find(
    (w) => w.work === grid.id,
  );
  assert.equal(after.maintenance.arrears, 0);
  assert.equal(
    g.machine.works.find((w) => w.id === grid.id).contract.owner,
    "south",
  );
  assert.equal(
    g.machine.works.find((w) => w.id === grid.id).maintenanceSponsor,
    "central",
  );
  assert.ok(
    g.machine.agendas.items.some(
      (a) => a.kind === "maintenance-voice" && a.state === "active",
    ),
  );
  await page.screenshot({ path: path.join(shots, "Case-D-reorganized.png") });
  results.riskScenario = {
    source:
      "Actual local-route UI checkpoint, then real levy2 creates forecast grid shortfall and occupies planner. Appointment and maintenance transfer use original API. No injected resources or fake debts.",
    before: before.maintenance,
    after: after.maintenance,
    commands: g.core.commands,
    owner: "south",
    maintenance: "central",
    agenda: "maintenance-voice",
  };
  await ctx.close();
  for (const view of ["map", "table"]) {
    ctx = await restore(atRisk, view);
    await page.evaluate(() => {
      window.__burden = { clicks: 0, panels: [] };
      document.addEventListener("click", () => window.__burden.clicks++, true);
      const update = () => {
        const title = document.querySelector(".panel-heading h2")?.textContent;
        if (title && window.__burden.panels.at(-1) !== title)
          window.__burden.panels.push(title);
      };
      new MutationObserver(update).observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
    if (view === "map") {
      await rail("经济建设").click();
      await page
        .getByRole("button", { name: "国家财政账本", exact: true })
        .click();
      const card = page.locator(`[data-facility-id="${grid.id}"]`);
      await card
        .getByText("协商维护接管（保留原产权）", { exact: true })
        .click();
      await card
        .getByRole("button", { name: "中央财政承担维护", exact: true })
        .click();
    } else {
      await work(grid.id);
      await page
        .getByRole("button", { name: "中央财政承接本设施维护", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "预览后果", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "确认执行", exact: true })
        .isDisabled(),
      true,
    );
    results.burden.push({
      view,
      ...(await page.evaluate(() => window.__burden)),
    });
    assert.deepEqual((await save()).core, atRisk.core);
    await ctx.close();
  }
  assert.ok(
    results.burden.find((x) => x.view === "table").clicks <
      results.burden.find((x) => x.view === "map").clicks,
  );
}
