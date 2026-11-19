// アプリの中身（データ・画面）を変えた後に1回実行する。
// sw.js の VERSION を今の日時に上げ、FILES をフォルダの中身から作り直す。data/index.js の version（画面の「データ ◯◯ 版」）も今日にする。
// 使い方（このフォルダで）: node 版を上げる.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const ver = `${day}-${pad(now.getHours())}${pad(now.getMinutes())}`;

const files = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest"];
for (const dir of ["data", "icons"]) {
  for (const f of fs.readdirSync(path.join(here, dir)).sort()) if (!f.startsWith(".")) files.push(`${dir}/${f}`);
}

const swPath = path.join(here, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace(/const VERSION = "[^"]*";/, `const VERSION = "${ver}";`);
sw = sw.replace(/const FILES = \[[\s\S]*?\];/, `const FILES = [\n${files.map((f) => `  "${f}"`).join(",\n")}\n];`);
fs.writeFileSync(swPath, sw);

const idxPath = path.join(here, "data", "index.js");
fs.writeFileSync(idxPath, fs.readFileSync(idxPath, "utf8").replace(/version: "[^"]*"/, `version: "${day}"`).replace(/window\.APP_VERSION = "[^"]*"/, `window.APP_VERSION = "${ver}"`));

// index.html が読むデータのファイルが、data/ の中身と合っているか
const html = fs.readFileSync(path.join(here, "index.html"), "utf8");
const missing = fs.readdirSync(path.join(here, "data")).filter((f) => f.endsWith(".js") && !html.includes(`data/${f}`));
if (missing.length) console.log(`⚠ index.html が読んでいないデータ: ${missing.join(", ")}（<script src="data/…"> を足してください）`);
console.log(`版を ${ver} にしました（${files.length} ファイル）`);
