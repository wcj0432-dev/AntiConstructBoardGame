import { _electron } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const exe = process.argv[2];
if (!exe) throw new Error('Usage: node scripts/smoke-desktop.mjs <packaged executable>');
const userData = await mkdtemp(path.join(os.tmpdir(), 'fow-smoke-'));
let application;
try {
  application = await _electron.launch({ executablePath: path.resolve(exe), env: { ...process.env, FOW_SMOKE: '1', FOW_USER_DATA: userData }, timeout: 60000 });
  const page = await application.firstWindow();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('heading', { name: '灵脉电站事故', exact: true }).waitFor();
  await page.getByRole('button', { name: '审议事务' }).click();
  await page.getByRole('button', { name: '预览执行', exact: true }).click();
  await page.getByRole('button', { name: '确认执行', exact: true }).click();
  await page.getByRole('heading', { name: '本季事务已处理' }).waitFor();
  await page.getByRole('button', { name: '存档', exact: true }).click();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('federation-worlds-v1')));
  assert.equal(save.resolved, 1); assert.equal(save.commands, 1);
  assert.equal(save.grievances.bai, 0); assert.deepEqual(errors, []);
  await application.close(); application = undefined;
  application = await _electron.launch({ executablePath: path.resolve(exe), env: { ...process.env, FOW_SMOKE: '1', FOW_USER_DATA: userData }, timeout: 60000 });
  const reloaded = await application.firstWindow();
  await reloaded.getByRole('button', { name: '读档', exact: true }).click();
  await reloaded.getByRole('heading', { name: '本季事务已处理' }).waitFor();
  console.log('Packaged desktop smoke passed: gameplay, local save, restart and reload.');
} finally {
  if (application) await application.close();
  await rm(userData, { recursive: true, force: true });
}
