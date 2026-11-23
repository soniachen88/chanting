/* Chanting tracker service worker.
   Served from the GitHub Pages project root (/chanting/sw.js), so relative
   URLs stay inside that folder and do not escape to the user site root. */
var CACHE = "chanting-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./logic.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(ASSETS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!isShell(url) && req.mode !== "navigate") return;
  event.respondWith(fromCacheThenNetwork(event, req));
});

function isShell(url) {
  var path = url.pathname;
  return /\/(?:index\.html|styles\.css|logic\.js|app\.js|manifest\.json)$/.test(path) ||
    /\/icons\/[^/]+\.png$/.test(path) ||
    /\/$/.test(path);
}

function fromCacheThenNetwork(event, req) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            cache.put(req, res.clone()).catch(function () {});
          }
          return res;
        })
        .catch(function () {
          return null;
        });
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network.then(function (res) {
        if (res) return res;
        if (req.mode === "navigate") {
          return cache.match("./index.html").then(function (page) {
            return page || cache.match("./");
          });
        }
        return Response.error();
      });
    });
  });
}
