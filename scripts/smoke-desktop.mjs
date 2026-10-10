import { _electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
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
  await reloaded.getByRole("button", { name: "读取存档", exact: true }).click();
  await reloaded
    .getByRole("heading", { name: "02 · 先确定谁能参与" })
    .waitFor();
  const restored = await reloaded.evaluate(() =>
    JSON.parse(localStorage.getItem("federation-worlds-v2")),
  );
  assert.deepEqual(restored, save);
  console.log(
    "Packaged v0.2 desktop smoke passed: appointment, special ability, save, restart and reload.",
  );
} finally {
  if (application) await application.close();
  await rm(userData, { recursive: true, force: true });
}
