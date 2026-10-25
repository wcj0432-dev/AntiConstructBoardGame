import { useMapForLegacyChecks } from "./legacy-map-view.mjs";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:5173",
  shots = process.env.FOW_SCREENSHOT_DIR || "artifacts/screenshots/v6",
  saveKey = "federation-worlds-v2",
  executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const sizes = [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1280, 720],
  ],
  errors = [],
  results = {
    fixtures:
      "none; disclosed independent demonstration scenario, actual UI commands",
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
await useMapForLegacyChecks(page);
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => errors.push(e.message));
const rail = (name, target = page) =>
  target
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
async function close(target = page) {
  const b = target.locator(".panel-heading .panel-close");
  if (await b.count()) await b.first().click();
}
async function shot(name) {
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
}
async function contentShot(name, selector) {
  await page.locator(".panel-scroll").evaluate((node, sel) => {
    const target = node.querySelector(sel);
    node.scrollTop +=
      target.getBoundingClientRect().top -
      node.getBoundingClientRect().top -
      10;
  }, selector);
  await shot(name);
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
  const g = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)),
    saveKey,
  );
  await close();
  assert.equal(g.machine.rulesVersion, "0.8.5");
  return g;
}
async function scene() {
  await close();
  await page.getByRole("button", { name: /接班场景 · 第/ }).click();
}
async function turn() {
  await close();
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  await page.getByRole("button", { name: "确认推进", exact: true }).click();
}
async function finance() {
  await close();
  await rail("经济建设").click();
  await page.getByRole("button", { name: "国家财政账本", exact: true }).click();
}
async function start() {
  await page.goto(base);
  await page.evaluate((k) => localStorage.removeItem(k), saveKey);
  await page.reload();
  await page
    .getByRole("button", { name: "特别剧本 / 规则演示", exact: true })
    .click();
  await page
    .getByRole("button", { name: "南岭工程与人才接班", exact: true })
    .click();
}
async function network(operation) {
  await close();
  await rail("经济建设").click();
  const name = { consent: "协商运营者应急授权", repair: "组织实际电网维修" }[
    operation
  ];
  await page
    .locator("[data-network-id]")
    .getByRole("button", { name, exact: true })
    .click();
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
    await useMapForLegacyChecks(target);
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
      .getByRole("button", { name: "特别剧本 / 规则演示", exact: true })
      .click();
    await target
      .getByRole("button", { name: "南岭工程与人才接班", exact: true })
      .click();
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
        .getByLabel("组织机构范围", { exact: true })
        .selectOption("local");
      await target.locator('[data-office-id="gov-south"]').click();
      await target
        .getByRole("button", { name: "适配组织图", exact: true })
        .click();
      await target
        .getByLabel("教学方式", { exact: true })
        .selectOption("academy");
      const academySelect = target.getByLabel("教学设施", { exact: true });
      await academySelect.selectOption(
        await academySelect.locator("option").nth(1).getAttribute("value"),
      );
      await target
        .getByRole("button", { name: "预览指定学员培养", exact: true })
        .click();
      await panelBounds(target, "native125 course decision");
      await target
        .getByRole("button", { name: "预览后果", exact: true })
        .click();
      await target
        .getByRole("button", { name: "确认执行", exact: true })
        .click({ trial: true });
      await close(target);
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
  await start();
  await shot("stage1-contract");
  await page.getByLabel("场景电网合同", { exact: true }).selectOption("local");
  await page
    .getByRole("button", { name: "预览签订场景电网合同", exact: true })
    .click();
  await confirm();
  await page
    .getByRole("button", { name: "预览墨玄培养陶祈（学院）", exact: true })
    .click();
  await confirm();
  await contentShot("stage2-named-course", "[data-training-id]");
  await turn();
  await turn();
  let g = await save();
  assert.ok(
    g.machine.trainings.some(
      (t) => t.student === "taoqi" && t.state === "completed",
    ),
  );
  assert.ok(g.machine.works.find((w) => w.type === "grid").completed);
  await scene();
  await page
    .getByRole("button", { name: "预览应急准备金调拨", exact: true })
    .click();
  await confirm();
  await turn();
  g = await save();
  const grid = g.machine.works.find((w) => w.type === "grid");
  assert.ok(grid.maintenance.arrears > 0);
  assert.ok(g.machine.demonstration.failed);
  // The state-derived alert opens the real financial decision at the associated province.
  const alert = page
    .locator(".alerts-scroll")
    .getByRole("button", { name: /跨省灵能电网维护欠付/ });
  await alert.click();
  await panelBounds(page, "maintenance alert destination");
  assert.ok(
    (
      await page
        .getByRole("region", { name: "逐设施维护与运营", exact: true })
        .innerText()
    ).includes("维护欠付停运"),
  );
  await shot("stage3-maintenance-debt");
  let card = page.locator(`[data-facility-id="${grid.id}"]`);
  await card.getByText("协商维护接管（保留原产权）", { exact: true }).click();
  await card
    .getByRole("button", { name: "中央财政承担维护", exact: true })
    .click();
  await confirm();
  card = page.locator(`[data-facility-id="${grid.id}"]`);
  await card.getByRole("button", { name: "预览补足维护", exact: true }).click();
  await confirm();
  await close();
  await rail("人事管理").click();
  await page.getByLabel("组织机构范围", { exact: true }).selectOption("local");
  await page.locator('[data-office-id="gov-south"]').click();
  await page.getByLabel("组织候选人", { exact: true }).selectOption("taoqi");
  await page
    .getByRole("button", { name: "比较后预览主职任命", exact: true })
    .click();
  await confirm();
  await page.getByLabel("组织机构范围", { exact: true }).selectOption("local");
  assert.ok(
    (await page.locator('[data-office-id="gov-south"]').innerText()).includes(
      "陶祈",
    ),
  );
  await contentShot("organization-successor", ".org-viewport");
  // Fault repair retains local ownership even after maintenance responsibility changes.
  await network("consent");
  await turn();
  await network("repair");
  g = await save();
  assert.equal(
    g.machine.works.find((w) => w.type === "grid").contract.owner,
    "south",
  );
  assert.equal(
    g.machine.works.find((w) => w.type === "grid").maintenance.arrears,
    0,
  );
  await page.reload();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  const restored = await save();
  assert.deepEqual(restored, g);
  await scene();
  await shot("stage4-actual-qualification");
  while (g.core.turn < 12) {
    if (g.core.turn === 10) {
      await scene();
      await page
        .getByRole("button", { name: "预览全国工程演练", exact: true })
        .click();
      await confirm();
    }
    await turn();
    g = await save();
    assert.equal(g.core.status, "playing");
  }
  await close();
  await rail("国家事务").click();
  const final = page.locator(".v2-matter").filter({
    has: page.getByRole("heading", {
      name: "全国能源网络点火仪式",
      exact: true,
    }),
  });
  await final.getByRole("button", { name: /全国能源网络点火仪式/ }).click();
  await confirm();
  await turn();
  g = await save();
  assert.equal(g.core.status, "won");
  results.demonstration = {
    turn: g.core.turn,
    status: g.core.status,
    contract: g.machine.works.find((w) => w.type === "grid").contract,
    student: g.machine.trainings[0].student,
    ledger: g.machine.fiscal.ledger.length,
  };
  // A second fresh game is used for live panel layout and office changes.
  await start();
  await close();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    results.desktop.push(await viewMetrics(page, `${width}x${height}`));
    await rail("人事管理").click();
    await panelBounds(page, "organization");
    await page
      .getByLabel("组织机构范围", { exact: true })
      .selectOption("central");
    await page.getByRole("button", { name: "适配组织图", exact: true }).click();
    await page.locator('[data-office-id="plan"]').click();
    await page.getByLabel("组织候选人", { exact: true }).selectOption("wen");
    await page
      .getByRole("button", { name: "比较后预览主职任命", exact: true })
      .click({ trial: true });
    await contentShot(`organization-${width}x${height}`, ".org-viewport");
    await close();
    await finance();
    await panelBounds(page, "finance");
    await close();
    await page.locator('[data-province="south"][data-district="0"]').click();
    const local = page.getByRole("region", {
      name: "地区行动适用范围",
      exact: true,
    });
    assert.ok((await local.innerText()).includes("地方特色"));
    await panelBounds(page, "regional actions");
    await shot(`regional-${width}x${height}`);
    await close();
  }
  await native125Layout();
  assert.deepEqual(errors, []);
  results.errors = errors;
  await writeFile(
    path.join(shots, "test-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} catch (e) {
  await page
    .screenshot({ path: path.join(shots, "failure.png") })
    .catch(() => {});
  throw e;
} finally {
  await browser.close();
}
