// Uses a fresh full Chromium profile; never changes the user's browser settings.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const profile = await mkdtemp(path.join(os.tmpdir(), "fow-native-zoom-"));
const sizes = [
  [1920, 1080],
  [1600, 900],
  [1366, 768],
  [1280, 720],
];
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? undefined
      : "chromium",
    headless: true,
    viewport: null,
    args: ["--no-sandbox", "--window-size=1280,720"],
  });
  const page = context.pages()[0];
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("chrome://settings/appearance");
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  // Native window bounds also include browser controls and platform borders.
  // Calibrate their size without page zoom so Windows frames are accounted for.
  const nativeChromeAt100 = [];
  for (const [width, height] of sizes) {
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { width, height },
    });
    await page.waitForFunction(
      ([w, h]) => outerWidth === w && outerHeight === h,
      [width, height],
    );
    const frame = await page.evaluate(
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
    assert.equal(frame.ratio, 1, "native frame calibration requires 100% zoom");
    assert.deepEqual(frame.outer, [width, height]);
    assert.ok(frame.insets.every((inset) => inset >= 0));
    nativeChromeAt100.push(frame);
  }
  await page.locator("#zoomLevel").selectOption("1.25");
  await page.goto(process.argv[2] || "http://localhost:5173");
  await page
    .getByRole("button", { name: "特别剧本 / 规则演示", exact: true })
    .click();
  await page.getByRole("button", { name: "教学战役", exact: true }).click();
  const results = [];
  const shots = process.env.FOW_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  for (const frame of nativeChromeAt100) {
    const [width, height] = frame.outer;
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { width, height },
    });
    await page.waitForFunction(
      ([w, h]) => outerWidth === w && outerHeight === h,
      [width, height],
    );
    const metrics = await page.evaluate(() => {
      const root = document.documentElement,
        heading = document.querySelector(".status-bar").getBoundingClientRect(),
        end = document.querySelector(".end-turn"),
        r = end.getBoundingClientRect();
      return {
        css: [innerWidth, innerHeight],
        outer: [outerWidth, outerHeight],
        ratio: devicePixelRatio,
        doc: [root.scrollWidth, root.scrollHeight],
        resourcesInside: [
          ...document.querySelectorAll(".resource-tip strong"),
        ].every((n) => n.getBoundingClientRect().bottom <= heading.bottom + 1),
        functionsInside: [...document.querySelectorAll(".function-rail>button")]
          .slice(0, 6)
          .every((n) => {
            const b = n.getBoundingClientRect();
            return b.y >= heading.bottom && b.bottom < r.y;
          }),
        endInside: r.bottom <= innerHeight,
        endHit: end.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        ),
      };
    });
    assert.equal(metrics.ratio, 1.25);
    assert.deepEqual(
      metrics.css,
      frame.content.map((dimension) => Math.round(dimension / 1.25)),
      "125% CSS viewport must match the measured native content area",
    );
    metrics.chromeInsets = frame.insets;
    metrics.contentPixels = frame.content;
    assert.deepEqual(metrics.doc, metrics.css);
    assert.ok(metrics.resourcesInside);
    assert.ok(metrics.functionsInside);
    assert.ok(metrics.endInside && metrics.endHit);
    results.push(metrics);
    await page
      .getByRole("navigation", { name: "主要管理功能" })
      .getByRole("button", { name: "人事管理", exact: true })
      .click();
    const dialog = await page.getByRole("dialog").boundingBox();
    assert.ok(dialog.y + dialog.height <= metrics.css[1]);
    await page
      .locator(".panel-scroll")
      .evaluate((n) => (n.scrollTop = n.scrollHeight));
    await page
      .locator(".panel-footer")
      .getByRole("button", { name: "预览任命" })
      .click({ trial: true });
    await page.getByRole("button", { name: "关闭面板" }).click();
    if (shots) {
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        fromSurface: false,
      });
      const bytes = Buffer.from(shot.data, "base64");
      const pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
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
  }
  // Smallest native-zoom window also exercises an unplanned formal game and long strategy content.
  await page.locator(".pause-trigger").click();
  await page.getByRole("button", { name: "返回主菜单", exact: true }).click();
  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await page.getByLabel("剧本", { exact: true }).selectOption("national");
  await page.getByLabel("政治开局", { exact: true }).selectOption("classic");
  await page.getByRole("button", { name: "开始任期", exact: true }).click();
  await page.getByRole("button", { name: "独立治理", exact: true }).click();
  const formal = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    doc: [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ],
    end: document.querySelector(".end-turn").getBoundingClientRect().bottom,
  }));
  assert.deepEqual(formal.doc, [formal.width, formal.height]);
  assert.ok(formal.end <= formal.height);
  await page
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name: "国家目标", exact: true })
    .click();
  const planning = await page
    .getByRole("dialog", { name: "国家目标", exact: true })
    .boundingBox();
  assert.ok(planning.y + planning.height <= formal.height);
  await page
    .locator(".panel-scroll")
    .evaluate((n) => (n.scrollTop = n.scrollHeight));
  await page.locator(".panel-close").click({ trial: true });
  await page.locator(".planning-route-picker summary").click();
  await page
    .locator(".planning-candidates")
    .last()
    .getByRole("button")
    .last()
    .hover();
  const tip = page.getByRole("tooltip");
  await tip.waitFor();
  const tipBounds = await tip.boundingBox();
  assert.ok(
    tipBounds.y >= 0 &&
      tipBounds.x >= 0 &&
      tipBounds.y + tipBounds.height <= formal.height,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".panel-layer").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      nativeBrowserZoom: "125% via Chrome settings",
      nativeChromeAt100,
      results,
      errors,
    }),
  );
} finally {
  if (context) await context.close();
  await rm(profile, { recursive: true, force: true });
}
