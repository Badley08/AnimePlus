// Proxy CORS local pour le front HTML/JS (Node 18+, aucune dépendance)
// Lancer : node proxy.js
// Écoute sur 127.0.0.1:8888 (/proxy?url=...) et 127.0.0.1:8787 (/raw?url=...)
// Option : &referer=https%3A%2F%2Fsite.com%2F pour forcer un Referer
//          (par défaut : l'origine de l'URL cible)

const http = require("http");

const ALLOWED_HOSTS = [
  "anime-sama.to",
  "voiranime.be",
  "ansembed.net",
  "vidmoly.to",
  "vidmoly.net",
  "vidmoly.biz",
  "vidmoly.me",
  "staticmoly.me",
  "voembed.net",
  "voembed.com",
  "vmnow.online", // flux HLS vidmoly / voembed (ex: gate-*.vmnow.online)
  "vmpx.online", // flux HLS d'ansembed (sous-domaines inclus)
  "sendvid.com",
  "video.sibnet.ru",
  "sibnet.ru",
  "smoothpre.com",
  "earnvids.com",
  "anikoto.net",
  "megaplay.buzz",
  "animeheaven.me",
  "senshi.live",
  "uqload.to",
  "uqload.vc",
  "uqload.io",
  "vkspeed.com",
  "vk.com",
  "streamtape.com",
  "doodstream.com",
  "dood.to",
  "dood.so",
  "dood.cx",
  "dood.la",
  "mixdrop.co",
  "mixdrop.to",
  "filelions.com",
  "filelions.to",
  "streamwish.to",
  "streamwish.com",
  "vidhidepro.com",
  "vidhide.com",
  "upstream.to",
  "myvi.tv",
];

const RETRIES = 2;
const TIMEOUT_MS = 15000;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hostAllowed = (hostname) =>
  ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));

async function fetchWithRetry(href, headers) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const r = await fetch(href, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.status >= 500 && i < RETRIES) {
        console.warn(`[retry ${i + 1}] ${r.status} sur ${href}`);
        await sleep(400 * (i + 1));
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      console.warn(`[retry ${i + 1}] ${e.cause?.code || e.name}: ${e.message} sur ${href}`);
      await sleep(400 * (i + 1));
    }
  }
  throw lastErr;
}

// Réécrit un manifeste HLS pour que segments / sous-playlists / clés repassent par le proxy
function rewriteM3u8(text, baseUrl, proxyBase, referer) {
  const prox = (u) => {
    const abs = new URL(u, baseUrl).href;
    return `${proxyBase}?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`;
  };
  return text
    .split(/\r?\n/)
    .map((line) => {
      const l = line.trim();
      if (!l) return line;
      if (l.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${prox(u)}"`);
      }
      return prox(l);
    })
    .join("\n");
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  const reqUrl = new URL(req.url, "http://localhost");
  if (reqUrl.pathname !== "/proxy" && reqUrl.pathname !== "/raw") {
    res.writeHead(404, CORS);
    return res.end("Not found");
  }

  const target = reqUrl.searchParams.get("url");
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.writeHead(400, CORS);
    return res.end("URL invalide");
  }

  if (!hostAllowed(parsed.hostname)) {
    console.error(`[403] hôte non autorisé : ${parsed.hostname}`);
    res.writeHead(403, CORS);
    return res.end("Hôte non autorisé : " + parsed.hostname);
  }

  const referer = reqUrl.searchParams.get("referer") || parsed.origin + "/";
  const headers = {
    "User-Agent": UA,
    Referer: referer,
    Origin: parsed.origin,
    Accept: "*/*",
    "Accept-Language": "fr-FR,fr;q=0.9",
  };
  if (parsed.pathname.includes("/api/lien.php")) {
    headers["Referer"] = reqUrl.searchParams.get("referer") || "https://anime-sama.to/";
    headers["Origin"] = "https://anime-sama.to";
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["Sec-Fetch-Dest"] = "empty";
    headers["Sec-Fetch-Mode"] = "cors";
    headers["Sec-Fetch-Site"] = "same-origin";
  }
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    const upstream = await fetchWithRetry(parsed.href, headers);
    let body = Buffer.from(await upstream.arrayBuffer());
    let contentType = upstream.headers.get("content-type") || "text/html; charset=utf-8";

    if (upstream.status >= 400) {
      console.error(`[${upstream.status}] ${parsed.href}`);
    }

    const isM3u8 =
      /mpegurl/i.test(contentType) ||
      /\.m3u8(\?|$)/i.test(parsed.pathname + parsed.search) ||
      (body.length < 2_000_000 && body.subarray(0, 7).toString() === "#EXTM3U");

    if (isM3u8 && upstream.ok) {
      const proxyBase = `http://${req.headers.host}${reqUrl.pathname}`;
      body = Buffer.from(rewriteM3u8(body.toString("utf8"), upstream.url || parsed.href, proxyBase, referer));
      contentType = "application/vnd.apple.mpegurl";
    }

    const out = { ...CORS, "Content-Type": contentType, "Content-Length": body.length };
    const cr = upstream.headers.get("content-range");
    if (cr) out["Content-Range"] = cr;
    res.writeHead(upstream.status, out);
    res.end(body);
  } catch (e) {
    const detail = `${e.cause?.code || e.name}: ${e.message}`;
    console.error(`[ERREUR] ${parsed.href} -> ${detail}`);
    res.writeHead(502, { ...CORS, "Content-Type": "text/plain; charset=utf-8" });
    res.end("Erreur proxy : " + detail);
  }
}

for (const port of [8888, 8787]) {
  http.createServer(handler).listen(port, "127.0.0.1", () => {
    console.log(`Proxy prêt sur http://127.0.0.1:${port}`);
  });
}