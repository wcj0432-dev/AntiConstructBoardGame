import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
const base = process.argv[2] || "http://localhost:5173",
  shots = process.env.FOW_SCREENSHOT_DIR || "artifacts/screenshots/v8",
  executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const loader = await createServer({
  server: { middlewareMode: true, hmr: false },
});
const { runStoryCampaign } = await loader.ssrLoadModule(
  "/scripts/storyCampaign.ts",
);
const E = await loader.ssrLoadModule("/src/v2/engine.ts"),
  D = await loader.ssrLoadModule("/src/v2/data.ts");
const witness = runStoryCampaign();
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
      "All story and supporting campaign actions through the actual UI, standard random opening v08-story-496. Native zoom restores the same actual saved game.",
    desktop: [],
    native125: [],
    actions: [],
  };
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => errors.push(e.message));
const rail = (name, p = page) =>
  p
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name, exact: true });
async function close(p = page) {
  const b = p.locator(".panel-heading .panel-close");
  if (await b.count()) await b.first().click();
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
  const g = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  await close();
  return g;
}
async function story(p = page) {
  await close(p);
  await p.getByRole("button", { name: "首席秘书", exact: true }).click();
  await p.getByRole("button", { name: "政治故事", exact: true }).click();
}
async function south() {
  await close();
  await page
    .getByRole("button", { name: /^南岭修仙省 / })
    .first()
    .click();
}
async function bounds(p) {
  const b = await p.getByRole("dialog").evaluate((n) => {
    const r = n.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      right: r.right,
      bottom: r.bottom,
      w: innerWidth,
      h: innerHeight,
    };
  });
  assert.ok(
    b.x >= 0 && b.y >= 0 && b.right <= b.w + 1 && b.bottom <= b.h + 1,
    JSON.stringify(b),
  );
  await p.locator(".panel-close").click({ trial: true });
  assert.equal(await p.getByRole("dialog").count(), 1);
  assert.equal(
    await p.evaluate(
      () =>
        document.documentElement.scrollHeight > innerHeight ||
        document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
async function storyPreview(p) {
  await p
    .getByRole("button", { name: "签署具名培养安排", exact: true })
    .click();
  await p.getByRole("button", { name: "预览后果", exact: true }).click();
  await bounds(p);
  const confirm = p.getByRole("button", { name: "确认执行", exact: true });
  assert.equal(await confirm.isDisabled(), false);
  await confirm.click({ trial: true });
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
      font: parseFloat(
        getComputedStyle(document.querySelector(".command-app")).fontSize,
      ),
    };
  });
  assert.deepEqual(m.doc, m.viewport);
  assert.ok(m.hit);
  assert.ok(m.font >= 16);
  return { label, ...m };
}
let g = witness.opening,
  teachingSave;
try {
  await page.goto(base);
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("剧本", { exact: true }).selectOption("experimental");
  await page.getByLabel("政治开局", { exact: true }).selectOption("random");
  await page.getByLabel("种子模式", { exact: true }).selectOption("specified");
  await page.getByLabel("数字或字符串种子").fill("v08-story-496");
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  await page.getByRole("button", { name: "独立治理", exact: true }).click();
  await close();
  for (const entry of witness.trace) {
    const a = entry.action;
    await close();
    if (a.type === "storyDecision" && a.chapter === "teaching")
      teachingSave = await save();
    if (a.type === "storyDecision") {
      await story();
      const card = page.locator(`[data-story-work="${a.work}"]`);
      if (a.chapter === "teaching") {
        await card.getByLabel("故事导师").selectOption(a.mentor);
        await card.getByLabel("故事学员").selectOption(a.student);
        await card.getByLabel("故事培养专业").selectOption(a.cap);
        await card.getByLabel("故事教学方式").selectOption(a.choice);
      }
      await card
        .getByRole("button", {
          name: {
            charter: "中央承接维护",
            teaching: "签署具名培养安排",
            tax: "全国统一征税",
          }[a.chapter],
          exact: true,
        })
        .click();
      await confirm();
    } else if (a.type === "resolve") {
      await rail("国家事务").click();
      const m = g.machine.matters.find((x) => x.id === a.matter),
        plan = D.plansFor(m, g.machine.goal).find((x) => x.id === a.option);
      await page
        .locator(`[data-matter-id="${a.matter}"]`)
        .getByRole("button", { name: new RegExp(plan.title) })
        .click();
      await confirm();
    } else if (a.type === "investigate") {
      await rail("经济建设").click();
      await page.getByRole("button", { name: "灵脉勘探", exact: true }).click();
      await confirm();
    } else if (a.type === "end") {
      await page.getByRole("button", { name: "结束回合", exact: true }).click();
      await page.getByRole("button", { name: "确认推进", exact: true }).click();
    } else if (a.type === "selectGoal") {
      await rail("国家目标").click();
      await page.locator(".planning-route-picker summary").click();
      await page
        .getByRole("button", { name: "提交星火计划立项", exact: true })
        .click();
      await confirm();
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
      await confirm();
    } else if (a.type === "reconcile") {
      await south();
      await page
        .getByRole("button", { name: "恢复地方协约", exact: true })
        .click();
      await confirm();
    } else if (a.type === "fiscalTransfer") {
      await south();
      await close();
      await rail("经济建设").click();
      await page
        .getByRole("button", { name: "国家财政账本", exact: true })
        .click();
      await page
        .getByLabel("财政转移金额", { exact: true })
        .fill(String(a.amount));
      await page
        .getByRole("button", { name: "预览地方财政征调", exact: true })
        .click();
      await confirm();
    } else throw Error(`Unimplemented real UI action ${a.type}`);
    g = E.executeCommand(g, a).game;
    const actual = await save();
    assert.equal(actual.core.turn, g.core.turn);
    assert.equal(actual.core.treasury, g.core.treasury);
    assert.equal(actual.core.commands, g.core.commands);
    assert.equal(actual.core.capital, g.core.capital);
    assert.deepEqual(actual.machine.fiscal.locals, g.machine.fiscal.locals);
    assert.deepEqual(actual.machine.storylines, g.machine.storylines);
    assert.deepEqual(actual.machine.trainings, g.machine.trainings);
    results.actions.push({
      turn: g.core.turn,
      type: a.type,
      chapter: a.chapter,
    });
  }
  const saved = await save();
  assert.equal(saved.machine.storylines[0].decisions.length, 3);
  assert.equal(saved.machine.trainings[0].state, "completed");
  assert.equal(saved.machine.fiscal.taxSystem, "central");
  await page.evaluate(
    (s) => localStorage.setItem("federation-worlds-v2", JSON.stringify(s)),
    teachingSave,
  );
  await page.reload();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  for (const [w, h] of sizes) {
    await close();
    await page.setViewportSize({ width: w, height: h });
    results.desktop.push(await viewport(page, `${w}x${h}`));
    await story();
    await bounds(page);
    await page
      .getByRole("button", { name: "签署具名培养安排", exact: true })
      .scrollIntoViewIfNeeded();
    await page
      .getByRole("button", { name: "签署具名培养安排", exact: true })
      .click({ trial: true });
    await page.screenshot({ path: path.join(shots, `story-${w}x${h}.png`) });
    await storyPreview(page);
    await close();
  }
  await native(JSON.stringify(teachingSave));
  assert.deepEqual(errors, []);
  results.errors = errors;
  await writeFile(
    path.join(shots, "test-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    "v0.8: real three-chapter UI campaign, save/reload, 4 desktop + 4 native125 passed",
  );
} catch (e) {
  await page
    .screenshot({ path: path.join(shots, "failure.png") })
    .catch(() => {});
  throw e;
} finally {
  await browser.close();
}
async function native(saved) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "fow-v8-native125-"));
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
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("chrome://settings/appearance");
    const cdp = await c.newCDPSession(p),
      { windowId } = await cdp.send("Browser.getWindowForTarget");
    const frames = [];
    for (const [w, h] of sizes) {
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: w, height: h },
      });
      await p.waitForFunction(
        ([w, h]) => outerWidth === w && outerHeight === h,
        [w, h],
      );
      // On Windows outer bounds can settle before the renderer's content area.
      // Match the existing v7 calibration: let both layout frames complete.
      const frame = await p.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve({
                  outer: [outerWidth, outerHeight],
                  content: [innerWidth, innerHeight],
                  ratio: devicePixelRatio,
                }),
              ),
            );
          }),
      );
      frames.push(frame);
      assert.equal(frames.at(-1).ratio, 1);
    }
    results.nativeChromeAt100 = frames;
    await p.locator("#zoomLevel").selectOption("1.25");
    await c.addInitScript((s) => {
      try {
        localStorage.setItem("federation-worlds-v2", s);
        localStorage.setItem("federation-guide-choice", "1");
        localStorage.setItem(
          "federation-ui",
          JSON.stringify({
            scale: 100,
            hints: false,
            advisorMode: "manual",
            animate: false,
          }),
        );
      } catch {}
    }, saved);
    await p.goto(base);
    await p.getByRole("button", { name: "继续游戏", exact: true }).click();
    for (const [w, h] of sizes) {
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: w, height: h },
      });
      const frame = frames[sizes.findIndex((size) => size[0] === w)];
      await p.waitForFunction(
        ({ w, h, content }) =>
          outerWidth === w &&
          outerHeight === h &&
          devicePixelRatio === 1.25 &&
          innerWidth === Math.round(content[0] / 1.25) &&
          innerHeight === Math.round(content[1] / 1.25),
        { w, h, content: frame.content },
      );
      results.native125.push(await viewport(p, `${w}x${h}`));
      assert.equal(results.native125.at(-1).ratio, 1.25);
      assert.deepEqual(
        results.native125.at(-1).viewport,
        frame.content.map((n) => Math.round(n / 1.25)),
      );
      await story(p);
      await bounds(p);
      await p
        .getByRole("button", { name: "签署具名培养安排", exact: true })
        .scrollIntoViewIfNeeded();
      await p
        .getByRole("button", { name: "签署具名培养安排", exact: true })
        .click({ trial: true });
      const capture = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: false,
        captureBeyondViewport: false,
      });
      const bytes = Buffer.from(capture.data, "base64");
      const pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
      assert.deepEqual(pixels, frame.content);
      results.native125.at(-1).pixels = pixels;
      await writeFile(path.join(shots, `native125-${w}x${h}.png`), bytes);
      await storyPreview(p);
      await close(p);
    }
  } finally {
    await c?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
