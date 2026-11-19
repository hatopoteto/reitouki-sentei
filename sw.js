// 電波が無くても動くように、アプリのファイルを iPhone の中にしまっておく。
// 中身を変えたら `node 版を上げる.mjs` で VERSION を上げる（上げないと、iPhone は古いまま）。
const VERSION = "2026-11-19-2316";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "data/daikin.js",
  "data/hitachi.js",
  "data/index.js",
  "data/mitsubishi.js",
  "data/panasonic-reitouki.js",
  "data/panasonic.js",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// まずしまってある物を出し、無ければ取りに行く
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
