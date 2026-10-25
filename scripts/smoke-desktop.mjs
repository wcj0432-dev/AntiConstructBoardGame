import { _electron } from "playwright";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const exe = process.argv[2];
if (!exe)
  throw new Error(
    "Usage: node scripts/smoke-desktop.mjs <packaged executable>",
  );
const userData = await mkdtemp(path.join(os.tmpdir(), "fow-smoke-"));
let application;
async function confirm(page) {
  await page.getByRole("button", { name: "预览后果", exact: true }).click();
  await page.getByRole("button", { name: "确认执行", exact: true }).click();
}
try {
  const options = {
    executablePath: path.resolve(exe),
    env: { ...process.env, FOW_SMOKE: "1", FOW_USER_DATA: userData },
    timeout: 60000,
  };
  application = await _electron.launch(options);
  const page = await application.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("button", { name: "特别剧本 / 规则演示", exact: true })
    .click();
  await page.getByRole("button", { name: "教学战役", exact: true }).click();
  await page.getByRole("button", { name: "前往人事任命" }).click();
  await page.getByRole("button", { name: "预览任命", exact: true }).click();
  await confirm(page);
  await page
    .getByRole("navigation", { name: "主要管理功能" })
    .getByRole("button", { name: "国家事务", exact: true })
    .click();
  await page
    .locator(".v2-plan-list button")
    .filter({ hasText: "群众参与预防巡检" })
    .click();
  await confirm(page);
  await page.getByRole("heading", { name: "02 · 先确定谁能参与" }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存游戏", exact: true }).click();
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  assert.equal(save.schema, 2);
  assert.equal(save.core.resolved, 1);
  assert.equal(save.core.commands, 3);
  assert.equal(save.machine.tutorial, 1);
  assert.equal(save.core.appointments["gov-south"], "xing");
  assert.deepEqual(errors, []);
  await application.close();
  application = undefined;
  application = await _electron.launch(options);
  const reloaded = await application.firstWindow();
  reloaded.on("pageerror", (e) => errors.push(e.message));
  await reloaded.getByRole("button", { name: "读取存档", exact: true }).click();
  await reloaded
    .getByRole("heading", { name: "02 · 先确定谁能参与" })
    .waitFor();
  const restored = await reloaded.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  assert.deepEqual(restored, save);
  // Keep the original teaching save/restart check, then exercise the new board in the packaged exe.
  const oldPanel = reloaded.locator(".panel-heading .panel-close");
  if (await oldPanel.count()) await oldPanel.click();
  await reloaded.getByRole("button", { name: "暂停菜单", exact: true }).click();
  await reloaded
    .getByRole("button", { name: "返回主菜单", exact: true })
    .click();
  await reloaded
    .getByRole("button", { name: "四次会议与一座电站", exact: true })
    .click();
  await reloaded.locator(".panel-heading .panel-close").click();
  assert.equal(await reloaded.locator("[data-board-office]").count(), 6);
  assert.ok(
    (await reloaded.locator('[data-board-office="plan"]').innerText()).includes(
      "专职派遣",
    ),
  );
  await reloaded.locator('[data-board-office="plan"]').click();
  await reloaded.getByLabel("组织候选人", { exact: true }).selectOption("wen");
  await reloaded
    .getByRole("button", { name: "比较后预览主职任命", exact: true })
    .click();
  await confirm(reloaded);
  await reloaded.locator(".unified-tooltip").waitFor({ state: "detached" });
  await reloaded.locator(".panel-heading .panel-close").click();
  await reloaded.getByRole("button", { name: "地图视图", exact: true }).click();
  await reloaded
    .getByRole("button", { name: "国家治理桌面", exact: true })
    .click();
  await reloaded.getByRole("button", { name: "暂停菜单", exact: true }).click();
  await reloaded.getByRole("button", { name: "保存游戏", exact: true }).click();
  const tableSave = await reloaded.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  assert.equal(tableSave.machine.rulesVersion, "0.8.5");
  assert.equal(tableSave.core.commands, 4);
  assert.equal(tableSave.core.appointments.plan, "wen");
  await reloaded.locator(".panel-heading .panel-close").click();
  await mkdir("artifacts/screenshots/desktop-v85", { recursive: true });
  await reloaded.screenshot({
    path: "artifacts/screenshots/desktop-v85/table-appointment.png",
  });
  await application.close();
  application = undefined;
  application = await _electron.launch(options);
  const tableReload = await application.firstWindow();
  tableReload.on("pageerror", (e) => errors.push(e.message));
  await tableReload
    .getByRole("button", { name: "继续游戏", exact: true })
    .click();
  assert.equal(await tableReload.locator("[data-board-office]").count(), 6);
  assert.ok(
    (
      await tableReload.locator('[data-board-office="plan"]').innerText()
    ).includes("温序"),
  );
  assert.deepEqual(
    await tableReload.evaluate(() =>
      JSON.parse(localStorage.getItem("federation-worlds-v2")),
    ),
    tableSave,
  );
  await tableReload
    .getByRole("button", { name: "规则速查卡", exact: true })
    .click();
  await tableReload.locator(".panel-heading .panel-close").click();
  const layout = await tableReload.evaluate(() => ({
    view: [innerWidth, innerHeight],
    doc: [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ],
  }));
  assert.deepEqual(layout.view, layout.doc);
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/screenshots/desktop-v85/test-results.json",
    JSON.stringify(
      {
        platform: process.platform,
        version: "0.8.5",
        legacyTutorialSaveRestart: true,
        tableAppointment: true,
        viewSwitch: true,
        tableSaveRestart: true,
        layout,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Packaged desktop smoke passed: original tutorial and new governance table; real appointment, view switch, save, restart and reload.",
  );
} catch (error) {
  if (application) {
    try {
      const p = await application.firstWindow();
      await mkdir("artifacts/screenshots/desktop-v85", { recursive: true });
      await p.screenshot({
        path: "artifacts/screenshots/desktop-v85/failure.png",
      });
      const details = await p.evaluate(() => ({
        focus: document.activeElement?.outerHTML,
        close: document
          .querySelector(".panel-close")
          ?.getBoundingClientRect()
          .toJSON(),
        tooltips: [...document.querySelectorAll(".unified-tooltip")].map(
          (n) => ({
            title: n.getAttribute("aria-label"),
            box: n.getBoundingClientRect().toJSON(),
            trigger: document.querySelector(`[aria-describedby="${n.id}"]`)
              ?.outerHTML,
          }),
        ),
      }));
      await writeFile(
        "artifacts/screenshots/desktop-v85/failure.json",
        JSON.stringify(details, null, 2),
      );
      console.error("Desktop UI context:", JSON.stringify(details));
    } catch {}
  }
  throw error;
} finally {
  if (application) await application.close();
  await rm(userData, { recursive: true, force: true });
}
