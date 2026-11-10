const http = require('http');

const PORT = process.env.PORT || 8787;
const ALLOWED_HOSTS = ['anime-sama.to', 'voiranime.be'];
const TIMEOUT_MS = 20000;
const MAX_BYTES = 20 * 1024 * 1024;

function isAllowed(target) {
  try {
    const u = new URL(target);
    return /^https?:$/.test(u.protocol) &&
      ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch (e) {
    return false;
  }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
}

http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  if (reqUrl.pathname !== '/raw') { res.writeHead(404); return res.end('Not found'); }

  const target = reqUrl.searchParams.get('url');
  if (!target || !isAllowed(target)) {
    res.writeHead(400);
    return res.end('URL manquante ou domaine non autorisé.');
  }

  try {
    const upstream = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
        'Accept': 'text/html,application/xml,application/json,*/*',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) { res.writeHead(502); return res.end('Réponse trop volumineuse.'); }
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
    });
    res.end(buf);
  } catch (err) {
    res.writeHead(502);
    res.end(`Erreur proxy : ${err.message}`);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy prêt sur http://127.0.0.1:${PORT}/raw?url=...`);
});