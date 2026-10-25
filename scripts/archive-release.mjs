import { ZipArchive } from "archiver";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const prefix = `Federation-of-Worlds-v${pkg.version}`;
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });
async function zip(name, add) {
  const output = createWriteStream(path.join(artifacts, name));
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const finished = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", reject);
  });
  archive.pipe(output);
  add(archive);
  await archive.finalize();
  await finished;
  console.log(`Download: artifacts/${name}`);
}
await zip(`${prefix}-Offline.zip`, (archive) => {
  archive.file(path.join(root, "offline/index.html"), {
    name: "诸界联邦.html",
  });
  archive.file(path.join(root, "PLAYER_GUIDE.md"), { name: "游玩说明.md" });
  archive.file(path.join(root, "THIRD_PARTY_NOTICES.md"), {
    name: "THIRD_PARTY_NOTICES.md",
  });
  archive.file(path.join(root, "RULES.md"), { name: "RULES.md" });
  archive.file(path.join(root, "V5_DELIVERY.md"), { name: "v0.5交付说明.md" });
  archive.file(path.join(root, "V6_DELIVERY.md"), { name: "v0.6交付说明.md" });
  archive.file(path.join(root, "V7_DELIVERY.md"), {
    name: "V7_DELIVERY.md",
  });
  archive.file(path.join(root, "V8_DELIVERY.md"), { name: "V8_DELIVERY.md" });
  archive.file(path.join(root, "docs/V8_CAMPAIGN_MATRIX.json"), {
    name: "docs/V8_CAMPAIGN_MATRIX.json",
  });
  archive.file(path.join(root, "V85_DELIVERY.md"), { name: "V85_DELIVERY.md" });
  archive.file(path.join(root, "docs/V85_CAMPAIGN_MATRIX.json"), {
    name: "docs/V85_CAMPAIGN_MATRIX.json",
  });
  archive.directory(path.join(root, "docs/v85"), "docs/v85");
  archive.directory(
    path.join(root, "docs/screenshots/v85"),
    "docs/screenshots/v85",
  );
  for (const doc of ["ART_AUDIO_V7.md", "V7_EXPANSION_DESIGN.md"])
    archive.file(path.join(root, "docs", doc), { name: `docs/${doc}` });
});
await zip(`${prefix}-Source.zip`, (archive) => {
  for (const name of ["src", "desktop", "scripts", "docs", ".github"])
    archive.directory(path.join(root, name), `${prefix}-Source/${name}`);
  for (const name of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "README.md",
    "RULES.md",
    "PLAYER_GUIDE.md",
    "RELEASE_NOTES.md",
    "CHANGELOG.md",
    "UI_REFACTOR.md",
    "V3_DELIVERY.md",
    "V4_DELIVERY.md",
    "V5_DELIVERY.md",
    "V6_DELIVERY.md",
    "V7_DELIVERY.md",
    "V7_PROGRESS.md",
    "V8_DELIVERY.md",
    "V8_PROGRESS.md",
    "V85_DELIVERY.md",
    "V85_PROGRESS.md",
    "THIRD_PARTY_NOTICES.md",
    ".gitignore",
  ])
    archive.file(path.join(root, name), { name: `${prefix}-Source/${name}` });
});
const dirs = await readdir(path.join(artifacts, "desktop")).catch(() => []);
for (const name of dirs) {
  const platform = name.includes("-win32-")
    ? "Windows"
    : name.includes("-linux-")
      ? "Linux"
      : null;
  if (!platform) continue;
  const arch = name.split("-").at(-1);
  await zip(`${prefix}-${platform}-${arch}.zip`, (archive) =>
    archive.directory(path.join(artifacts, "desktop", name), name),
  );
}
const checksums = [];
for (const name of (await readdir(artifacts))
  .filter((n) => n.startsWith(prefix) && n.endsWith(".zip"))
  .sort()) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join(artifacts, name)))
    hash.update(chunk);
  checksums.push(`${hash.digest("hex")}  ${name}`);
}
await writeFile(
  path.join(artifacts, "SHA256SUMS.txt"),
  checksums.join("\n") + "\n",
);
