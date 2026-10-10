// Uses a fresh full Chromium profile; never changes the user's browser settings.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const profile = await mkdtemp(path.join(os.tmpdir(), "fow-native-zoom-"));
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
  await page.locator("#zoomLevel").selectOption("1.25");
  await page.goto(process.argv[2] || "http://localhost:5173");
  await page.getByRole("button", { name: "教学战役", exact: true }).click();
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  const results = [];
  const shots = process.env.FOW_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  for (const [width, height] of [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1280, 720],
  ]) {
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
    assert.equal(metrics.css[0], Math.round(width / 1.25));
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
        fromSurface: true,
      });
      await writeFile(
        path.join(shots, `native125-${width}x${height}.png`),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      nativeBrowserZoom: "125% via Chrome settings",
      results,
      errors,
    }),
  );
} finally {
  if (context) await context.close();
  await rm(profile, { recursive: true, force: true });
}
