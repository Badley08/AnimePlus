/**
 * scrappers.js — indexation des sitemaps Anime-Sama et VoirAnime (métadonnées uniquement).
 *
 * Ce module lit les sitemaps publics, construit un index local (titre, URL, source, date)
 * et permet de le rechercher hors-ligne. Il ne récupère PAS de liens vidéo.
 *
 * Usage :
 *   const index = await Scrappers.loadAll();            // index fusionné
 *   const hits  = await Scrappers.search('boruto');     // recherche locale
 *   const one   = await Scrappers.loadSource('animesama');
 */
const Scrappers = (() => {
  const SOURCES = {
    animesama: {
      label: 'Anime-Sama',
      sitemap: 'https://anime-sama.to/sitemap.xml',
      // URLs de fiches : /catalogue/<slug>/ (on ignore les sous-pages saison/langue)
      accept: path => /^\/catalogue\/[^/]+\/?$/i.test(path)
    },
    voiranime: {
      label: 'VoirAnime',
      sitemap: 'https://voiranime.be/sitemap_index.xml',
      // Fiches : /anime/<slug>/ (on ignore les pages d'épisodes, catégories, pages statiques)
      accept: path => /^\/anime\/[^/]+\/?$/i.test(path)
    }
  };

  const CORS_PROXY = 'https://api.allorigins.win/raw';
  const REQUEST_TIMEOUT = 20000;
  const MAX_RESPONSE_SIZE = 20 * 1024 * 1024;
  const MAX_SUB_SITEMAPS = 50;
  const INDEX_TTL = 6 * 60 * 60 * 1000; // 6 h
  const STORAGE_PREFIX = 'scrappers_index_v1_';
  const memory = new Map();

  // ---------- Utilitaires ----------
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();

  function normalize(v) {
    return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function titleFromSlug(slug) {
    return clean(
      decodeURIComponent(slug)
        .replace(/-(?:vf|vostfr)$/i, '')
        .replace(/[-_]+/g, ' ')
    ).replace(/\b\p{L}/gu, c => c.toUpperCase());
  }

  function isAllowedUrl(value) {
    try {
      const u = new URL(value);
      return Object.values(SOURCES).some(s => {
        const host = new URL(s.sitemap).hostname;
        return u.hostname === host || u.hostname.endsWith('.' + host);
      }) && /^https?:$/.test(u.protocol);
    } catch (e) {
      return false;
    }
  }

  // ---------- Réseau ----------
  function isNativeAndroid() {
    return typeof window !== 'undefined' && window.Android && typeof window.Android.httpGet === 'function';
  }

  function nativeGet(url) {
    return new Promise((resolve, reject) => {
      const callbacks = window._scrappersHttp || (window._scrappersHttp = {});
      const id = `sc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => { delete callbacks[id]; reject(new Error('Délai dépassé.')); }, REQUEST_TIMEOUT);
      callbacks[id] = {
        resolve: b => { clearTimeout(timer); resolve(b); },
        reject: e => { clearTimeout(timer); reject(e); }
      };
      // Chaînage avec d'éventuels callbacks déjà définis (ex. scrapping.js)
      const prevOk = window.onNativeHttpSuccess;
      const prevErr = window.onNativeHttpError;
      window.onNativeHttpSuccess = (cid, body) => {
        const cb = window._scrappersHttp[cid];
        if (cb) { delete window._scrappersHttp[cid]; cb.resolve(body); }
        else if (prevOk) prevOk(cid, body);
      };
      window.onNativeHttpError = (cid, msg) => {
        const cb = window._scrappersHttp[cid];
        if (cb) { delete window._scrappersHttp[cid]; cb.reject(new Error(msg || 'Échec Android.')); }
        else if (prevErr) prevErr(cid, msg);
      };
      try { window.Android.httpGet(url, id); }
      catch (e) { clearTimeout(timer); delete callbacks[id]; reject(e); }
    });
  }

  async function fetchText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(url, {
        credentials: 'omit',
        headers: { Accept: 'application/xml,text/xml,*/*' },
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function get(url) {
    if (!isAllowedUrl(url)) throw new Error('Domaine non autorisé.');
    let body;
    if (isNativeAndroid()) {
      body = await nativeGet(url);
    } else {
      try {
        body = await fetchText(url);
      } catch (err) {
        // Repli via proxy CORS (navigateur uniquement)
        const proxy = new URL(CORS_PROXY);
        proxy.searchParams.set('url', url);
        body = await fetchText(proxy.href);
      }
    }
    if (typeof body !== 'string' || !body.length) throw new Error('Réponse vide.');
    if (body.length > MAX_RESPONSE_SIZE) throw new Error('Réponse trop volumineuse.');
    return body;
  }

  // ---------- Parsing sitemap ----------
  function parseSitemapXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML de sitemap invalide.');
    const root = doc.documentElement.localName.toLowerCase();
    const nodes = [...doc.getElementsByTagNameNS('*', root === 'sitemapindex' ? 'sitemap' : 'url')];
    const entries = nodes.map(n => ({
      loc: clean(n.getElementsByTagNameNS('*', 'loc')[0]?.textContent),
      lastmod: clean(n.getElementsByTagNameNS('*', 'lastmod')[0]?.textContent)
    })).filter(e => e.loc);
    return { type: root === 'sitemapindex' ? 'index' : 'urlset', entries };
  }

  async function collectUrls(sitemapUrl, depth = 0, budget = { left: MAX_SUB_SITEMAPS }) {
    if (depth > 2 || budget.left <= 0) return [];
    budget.left--;
    const parsed = parseSitemapXml(await get(sitemapUrl));
    if (parsed.type === 'urlset') return parsed.entries;

    // Pour un index, on ne garde que les sous-sitemaps pertinents (pas les images/catégories/tags)
    const subs = parsed.entries.filter(e => {
      const name = e.loc.toLowerCase();
      return isAllowedUrl(e.loc) && !/(category|tag|author|page-sitemap|image|video|taxonomy)/.test(name);
    });
    const settled = await Promise.allSettled(subs.map(s => collectUrls(s.loc, depth + 1, budget)));
    return settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  }

  function buildIndex(sourceKey, entries) {
    const src = SOURCES[sourceKey];
    const seen = new Set();
    const items = [];
    for (const { loc, lastmod } of entries) {
      let u;
      try { u = new URL(loc); } catch (e) { continue; }
      if (!src.accept(u.pathname)) continue;
      const slug = u.pathname.split('/').filter(Boolean).pop();
      if (!slug) continue;
      const url = u.origin + u.pathname.replace(/\/?$/, '/');
      if (seen.has(url)) continue;
      seen.add(url);
      const title = titleFromSlug(slug);
      items.push({
        id: `${sourceKey === 'animesama' ? 'as' : 'va'}_${slug}`,
        title,
        slug,
        url,
        source: sourceKey,
        sourceLabel: src.label,
        lastmod: lastmod || '',
        poster: '',
        type: /(^|-)(film|movie)(-|$)/i.test(slug) ? 'film' : 'serie',
        badges: [],
        _search: normalize(`${title} ${slug.replace(/-/g, ' ')}`)
      });
    }
    return items;
  }

  // ---------- Cache (mémoire + localStorage) ----------
  function readCache(key) {
    const m = memory.get(key);
    if (m && m.expiresAt > Date.now()) return m.items;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.expiresAt > Date.now() && Array.isArray(data.items)) {
        memory.set(key, data);
        return data.items;
      }
    } catch (e) { /* stockage indisponible */ }
    return null;
  }

  function writeCache(key, items) {
    const data = { expiresAt: Date.now() + INDEX_TTL, items };
    memory.set(key, data);
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data)); }
    catch (e) { /* quota dépassé : on garde la mémoire seulement */ }
  }

  // ---------- API publique ----------
  async function loadSource(sourceKey, { force = false } = {}) {
    if (!SOURCES[sourceKey]) throw new Error(`Source inconnue : ${sourceKey}`);
    if (!force) {
      const cached = readCache(sourceKey);
      if (cached) return cached;
    }
    const entries = await collectUrls(SOURCES[sourceKey].sitemap);
    const items = buildIndex(sourceKey, entries);
    if (!items.length) throw new Error(`Aucune fiche trouvée dans le sitemap ${SOURCES[sourceKey].label}.`);
    writeCache(sourceKey, items);
    return items;
  }

  async function loadAll(options = {}) {
    const keys = Object.keys(SOURCES);
    const settled = await Promise.allSettled(keys.map(k => loadSource(k, options)));
    const items = settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    if (!items.length) {
      const msg = settled.filter(r => r.status === 'rejected').map(r => r.reason.message).join(' | ');
      throw new Error(`Index indisponible : ${msg}`);
    }
    return items;
  }

  async function search(query, { limit = 40, sources = Object.keys(SOURCES) } = {}) {
    const terms = normalize(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const all = await loadAll();
    return all
      .filter(it => sources.includes(it.source) && terms.every(t => it._search.includes(t)))
      .map(it => {
        const exact = it._search === terms.join(' ') ? 2 : it._search.startsWith(terms[0]) ? 1 : 0;
        return { it, exact };
      })
      .sort((a, b) => b.exact - a.exact || a.it.title.length - b.it.title.length)
      .slice(0, limit)
      .map(({ it }) => {
        const { _search, ...pub } = it;
        return pub;
      });
  }

  async function recent(limit = 20) {
    const all = await loadAll();
    return all
      .filter(it => it.lastmod)
      .sort((a, b) => b.lastmod.localeCompare(a.lastmod))
      .slice(0, limit)
      .map(({ _search, ...pub }) => pub);
  }

  function clearCache() {
    memory.clear();
    try {
      Object.keys(SOURCES).forEach(k => localStorage.removeItem(STORAGE_PREFIX + k));
    } catch (e) { /* ignore */ }
  }

  return Object.freeze({ SOURCES, loadSource, loadAll, search, recent, clearCache });
})();

if (typeof window !== 'undefined') window.Scrappers = Scrappers;