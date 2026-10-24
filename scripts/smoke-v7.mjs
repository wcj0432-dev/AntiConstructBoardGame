import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:5173",
  shots = process.env.FOW_SCREENSHOT_DIR || "artifacts/screenshots/v7",
  executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const sizes = [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1280, 720],
  ],
  errors = [],
  results = {
    source:
      "Real standard campaign UI actions; no high-resource fixture. Native profiles restore this exact saved game.",
    desktop: [],
    native125: [],
    audio: {},
  };
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
});
await context.addInitScript(() => {
  const Real = window.AudioContext;
  window.__audioAudit = { contexts: [], starts: 0, active: 0, peak: 0 };
  if (Real)
    window.AudioContext = class extends Real {
      constructor(...args) {
        super(...args);
        window.__audioAudit.contexts.push(this);
        this.__gains = [];
      }
      createGain() {
        const g = super.createGain();
        this.__gains.push(g);
        return g;
      }
      createBufferSource() {
        const s = super.createBufferSource(),
          start = s.start.bind(s);
        s.start = (...args) => {
          window.__audioAudit.starts++;
          window.__audioAudit.active++;
          window.__audioAudit.peak = Math.max(
            window.__audioAudit.peak,
            window.__audioAudit.active,
          );
          return start(...args);
        };
        s.addEventListener("ended", () => window.__audioAudit.active--);
        return s;
      }
    };
});
const page = await context.newPage();
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
  const s = await page.evaluate(() =>
    localStorage.getItem("federation-worlds-v2"),
  );
  await close();
  return s;
}
async function capture(name, p = page) {
  await p.screenshot({ path: path.join(shots, `${name}.png`) });
}
async function panel(p = page) {
  const m = await p.getByRole("dialog").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      box: [r.x, r.y, r.right, r.bottom],
      viewport: [innerWidth, innerHeight],
    };
  });
  assert.ok(
    m.box[0] >= 0 &&
      m.box[1] >= 0 &&
      m.box[2] <= m.viewport[0] + 1 &&
      m.box[3] <= m.viewport[1] + 1,
    JSON.stringify(m),
  );
  assert.equal(await p.getByRole("dialog").count(), 1);
  await p.locator(".panel-close").click({ trial: true });
}
async function viewport(p, label) {
  const m = await p.evaluate((label) => {
    const b = [...document.querySelectorAll("button")].find(
        (x) => x.textContent.trim() === "结束回合",
      ),
      r = b.getBoundingClientRect(),
      hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      map = document.querySelector(".federation-map").getBoundingClientRect();
    return {
      label,
      viewport: [innerWidth, innerHeight],
      doc: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
      ratio: devicePixelRatio,
      end: [r.x, r.y, r.right, r.bottom],
      hit: b === hit || b.contains(hit),
      map: [map.width, map.height],
      font: parseFloat(
        getComputedStyle(document.querySelector(".command-app")).fontSize,
      ),
    };
  }, label);
  assert.deepEqual(m.doc, m.viewport, `${label}: global overflow`);
  assert.ok(m.hit, `${label}: end turn covered`);
  assert.ok(m.end[3] <= m.viewport[1] && m.end[0] >= 0);
  assert.ok(m.font >= 16 && m.map[0] > 250 && m.map[1] > 150);
  return m;
}
try {
  await page.goto(base);
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("剧本", { exact: true }).selectOption("experimental");
  await page.getByLabel("政治开局", { exact: true }).selectOption("classic");
  await page.getByLabel("种子模式", { exact: true }).selectOption("specified");
  await page.getByLabel("数字或字符串种子").fill("v07-browser-real");
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  await page.getByRole("button", { name: "开启辅助提示", exact: true }).click();
  await page.getByRole("complementary", { name: "秘书主动提示" }).waitFor();
  await page.getByRole("button", { name: "立即显示全文", exact: true }).click();
  await capture("formal-welcome");
  await page.getByRole("button", { name: "关闭秘书提示", exact: true }).click();
  await rail("人事管理").click();
  await page
    .locator(".secretary-inline")
    .getByText("沈岚 · 职位、人物与任务", { exact: true })
    .waitFor();
  await page
    .locator(".secretary-inline")
    .getByRole("button", { name: "已阅 / 跳过", exact: true })
    .click();
  assert.ok((await page.locator(".v7-core-portrait").count()) >= 2);
  await capture("core-organization");
  await close();
  await rail("经济建设").click();
  await page
    .locator(".secretary-inline")
    .getByRole("button", { name: "已阅 / 跳过", exact: true })
    .click();
  await page.getByRole("button", { name: "国家财政账本", exact: true }).click();
  await page
    .locator(".secretary-inline")
    .getByText("沈岚 · 钱在哪个账户", { exact: true })
    .waitFor();
  await page
    .locator(".secretary-inline")
    .getByRole("button", { name: "已阅 / 跳过", exact: true })
    .click();
  await close();
  await page.getByRole("button", { name: "首席秘书", exact: true }).click();
  assert.ok((await page.locator(".advisor-issue").count()) <= 5);
  await capture("secretary-brief");
  await page.getByRole("button", { name: "规则与引导", exact: true }).click();
  await page.locator(".secretary-console select").selectOption("staff");
  await page.getByRole("button", { name: "标记已读", exact: true }).click();
  await close();
  const original = JSON.parse(await save());
  assert.deepEqual(
    original.machine.advisor.seen.sort(),
    ["welcome", "staff", "economy", "finance"].sort(),
  );
  assert.equal(original.core.turn, 1);
  assert.equal(original.core.treasury, 12);
  assert.equal(original.core.commands, 5);
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  await page.getByRole("button", { name: "确认推进", exact: true }).click();
  await rail("国家目标").click();
  if (await page.locator(".secretary-inline button").count())
    await page.locator(".secretary-inline button").click();
  await page.locator(".planning-route-picker summary").click();
  await page
    .getByRole("button", { name: "提交万象法典立项", exact: true })
    .click();
  await confirm();
  await page.locator('[data-strategy-node="plural"]').click();
  await page
    .getByRole("button", { name: "预览多元契约法域", exact: true })
    .click();
  await page
    .getByRole("button", { name: "秘书意见 · 当前事务", exact: true })
    .click();
  await confirm();
  await capture("codex-branch");
  // An unavailable registry action must expose the same actual requirements without spending resources.
  await page.getByRole("button", { name: /登记中央工业省契约/ }).click();
  await page
    .getByRole("button", { name: "秘书意见 · 当前事务", exact: true })
    .click();
  assert.ok(
    (await page.locator(".secretary-action-advice").innerText()).includes(
      "真实履约设施",
    ),
  );
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "确认执行", exact: true })
      .isDisabled(),
    true,
  );
  await capture("blocked-law-advice");
  await close();
  await close();
  const saved = await save();
  const savedObject = JSON.parse(saved);
  assert.equal(savedObject.machine.rulesVersion, "0.8.0");
  assert.equal(savedObject.machine.strategy.branch, "plural");
  assert.equal(savedObject.core.commands, 4);
  await page.getByRole("button", { name: "暂停菜单", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("秘书提示模式", { exact: true }).selectOption("manual");
  await page
    .getByLabel("对话打字机效果（可立即显示全文）", { exact: true })
    .uncheck();
  await page.getByLabel("音乐音量", { exact: true }).focus();
  await page.getByLabel("音乐音量", { exact: true }).press("Home");
  await page.getByLabel("全部静音", { exact: true }).check();
  await page.getByRole("button", { name: "试听政务音效", exact: true }).click();
  await page.waitForTimeout(1800);
  const audio = await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem("federation-audio")),
    contexts: window.__audioAudit.contexts.map((c) => ({
      state: c.state,
      gains: c.__gains.slice(0, 2).map((g) => g.gain.value),
    })),
    active: window.__audioAudit.active,
    peak: window.__audioAudit.peak,
    starts: window.__audioAudit.starts,
  }));
  assert.equal(audio.settings.music, 0);
  assert.equal(audio.settings.muted, true);
  assert.equal(audio.contexts.length, 1);
  assert.equal(audio.contexts[0].state, "running");
  assert.ok(audio.contexts[0].gains.every((x) => x < 0.001));
  assert.ok(audio.active <= 2 && audio.peak <= 2);
  results.audio = audio;
  await capture("audio-settings");
  await close();
  await page.reload();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  assert.equal(await page.locator(".secretary-cue").count(), 0);
  const restored = JSON.parse(await save());
  assert.deepEqual(restored, savedObject);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    results.desktop.push(await viewport(page, `${width}x${height}`));
    await page.getByRole("button", { name: "首席秘书", exact: true }).click();
    await panel();
    await capture(`secretary-${width}x${height}`);
    await close();
    await rail("国家目标").click();
    await page
      .getByLabel("查看国家战略", { exact: true })
      .selectOption("comms");
    await panel();
    await page.locator(".strategy-board").scrollIntoViewIfNeeded();
    await page.locator(".strategy-board").evaluate((n) => (n.scrollTop = 0));
    await capture(`strategy-${width}x${height}`);
    await page.locator('[data-strategy-node="central"]').click();
    await page.locator(".strategy-detail").scrollIntoViewIfNeeded();
    await panel();
    await close();
    await page.getByRole("button", { name: "结束回合", exact: true }).click();
    await panel();
    await page
      .getByRole("button", { name: "确认推进", exact: true })
      .click({ trial: true });
    await close();
  }
  await native(saved);
  // Browser without audio capability must still enter a formal campaign and open settings.
  const fallback = await browser.newContext();
  await fallback.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw Error("test unavailable audio");
      }
    };
  });
  const fp = await fallback.newPage();
  fp.on("pageerror", (e) => errors.push(e.message));
  await fp.goto(base);
  await fp.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await fp.getByRole("button", { name: "开始任期", exact: true }).click();
  await fp.getByRole("button", { name: "独立治理", exact: true }).click();
  if (
    await fp.getByRole("dialog", { name: "初始国情报告", exact: true }).count()
  )
    await close(fp);
  await fp.getByRole("button", { name: "首席秘书", exact: true }).click();
  await panel(fp);
  await fallback.close();
  results.save = {
    turn: savedObject.core.turn,
    version: savedObject.machine.rulesVersion,
    branch: savedObject.machine.strategy.branch,
    seen: savedObject.machine.advisor.seen,
  };
  results.errors = errors;
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(shots, "test-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    "v0.7 secretary, formal guidance, actual planning, save/reload, audio, 4 desktop and 4 native125 checks passed",
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
  const profile = await mkdtemp(path.join(os.tmpdir(), "fow-v7-native125-"));
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
    for (const [width, height] of sizes) {
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width, height },
      });
      await p.waitForFunction(
        ([w, h]) => outerWidth === w && outerHeight === h,
        [width, height],
      );
      const frame = await p.evaluate(
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
      assert.equal(frame.ratio, 1);
      frames.push(frame);
    }
    results.nativeChromeAt100 = frames;
    await p.locator("#zoomLevel").selectOption("1.25");
    await c.addInitScript((s) => {
      try {
        localStorage.setItem("federation-worlds-v2", s);
        localStorage.setItem(
          "federation-ui",
          JSON.stringify({
            scale: 100,
            hints: false,
            advisorMode: "manual",
            animate: false,
          }),
        );
        localStorage.setItem("federation-guide-choice", "1");
      } catch {}
    }, saved);
    await p.goto(base);
    await p.getByRole("button", { name: "继续游戏", exact: true }).click();
    for (const frame of frames) {
      const [width, height] = frame.outer;
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width, height },
      });
      await p.waitForFunction(
        ([w, h]) => outerWidth === w && outerHeight === h,
        [width, height],
      );
      const m = await viewport(p, `native125-${width}x${height}`);
      assert.equal(m.ratio, 1.25);
      assert.deepEqual(
        m.viewport,
        frame.content.map((n) => Math.round(n / 1.25)),
      );
      m.chromeInsets = frame.insets;
      await p.getByRole("button", { name: "首席秘书", exact: true }).click();
      await panel(p);
      await p.getByRole("button", { name: "规则与引导", exact: true }).click();
      await p.locator(".secretary-console select").selectOption("finance");
      await panel(p);
      await close(p);
      await rail("国家目标", p).click();
      await p.locator('[data-strategy-node="plural"]').click();
      await p.locator(".strategy-detail").scrollIntoViewIfNeeded();
      await panel(p);
      await close(p);
      await p.getByRole("button", { name: "结束回合", exact: true }).click();
      await panel(p);
      await p
        .getByRole("button", { name: "确认推进", exact: true })
        .click({ trial: true });
      await close(p);
      await rail("国家目标", p).click();
      await panel(p);
      await p.locator(".strategy-board").scrollIntoViewIfNeeded();
      await p.locator(".strategy-board").evaluate((n) => (n.scrollTop = 0));
      const capture = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: false,
          captureBeyondViewport: false,
        }),
        bytes = Buffer.from(capture.data, "base64"),
        pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
      assert.deepEqual(pixels, frame.content);
      m.pixels = pixels;
      results.native125.push(m);
      await writeFile(
        path.join(shots, `native125-${width}x${height}.png`),
        bytes,
      );
      await close(p);
    }
  } finally {
    await c?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
