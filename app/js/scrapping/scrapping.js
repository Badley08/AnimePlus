/**
 * Standalone metadata scraper. It never follows or extracts third-party player streams.
 */
const ScrappingService = (() => {
  const SOURCES = {
    animesama: 'https://anime-sama.to',
    voiranime: 'https://voiranime.be'
  };
  const PROXIES = [
    'http://127.0.0.1:8888/proxy?url=',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
    'http://127.0.0.1:8787/raw?url='
  ];
  const CACHE_TTL = 60 * 1000;
  const REQUEST_TIMEOUT = 15000;
  const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
  const cache = new Map();
  const pending = new Map();

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function allowedSourceUrl(value, base) {
    let url;
    try {
      url = new URL(value, base);
    } catch (error) {
      throw new Error('URL de source invalide.');
    }

    const host = url.hostname.toLowerCase();
    const allowed = Object.values(SOURCES).some(origin => {
      const sourceHost = new URL(origin).hostname;
      return host === sourceHost || host.endsWith(`.${sourceHost}`);
    }) || host.includes('ansembed.net') || host.includes('sibnet.ru') || host.includes('sendvid.com') || host.includes('vidmoly') || host.includes('voembed') || host.includes('vmnow.online') || host.includes('staticmoly') || host.includes('vkspeed.com') || host.includes('vk.com') || host.includes('uqload') || host.includes('dood') || host.includes('streamtape') || host.includes('upstream') || host.includes('smoothpre.com') || host.includes('earnvids.com') || host.includes('myvi.tv');
    if (!/^https?:$/.test(url.protocol) || !allowed) {
      throw new Error('La requête est limitée aux domaines Anime-Sama, VoirAnime et leurs lecteurs autorisés.');
    }
    return url.href;
  }

  function safeAssetUrl(value, base) {
    if (!value) return '';
    try {
      const url = new URL(value, base);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function parseHTML(markup) {
    return new DOMParser().parseFromString(markup, 'text/html');
  }

  function isNativeAndroid() {
    return typeof window.Android !== 'undefined' && typeof window.Android.httpGet === 'function';
  }

  function nativeGet(url) {
    return new Promise((resolve, reject) => {
      const callbacks = window._scrappingHttpCallbacks || (window._scrappingHttpCallbacks = {});
      const callbackId = `scrap_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        delete callbacks[callbackId];
        reject(new Error(`Délai dépassé pour ${new URL(url).hostname}.`));
      }, REQUEST_TIMEOUT);

      callbacks[callbackId] = {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        }
      };

      window.onNativeHttpSuccess = (id, body) => {
        const callback = window._scrappingHttpCallbacks && window._scrappingHttpCallbacks[id];
        if (!callback) return;
        delete window._scrappingHttpCallbacks[id];
        callback.resolve(body);
      };
      window.onNativeHttpError = (id, message) => {
        const callback = window._scrappingHttpCallbacks && window._scrappingHttpCallbacks[id];
        if (!callback) return;
        delete window._scrappingHttpCallbacks[id];
        callback.reject(new Error(message || 'Échec de la requête Android.'));
      };

      try {
        window.Android.httpGet(url, callbackId);
      } catch (error) {
        clearTimeout(timer);
        delete callbacks[callbackId];
        reject(error);
      }
    });
  }

  async function fetchText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: { Accept: 'text/html,application/json,application/javascript,*/*' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} depuis ${new URL(url).hostname}.`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function browserGet(url) {
    // Dans le navigateur (ex: http://localhost:8080), direct fetch vers anime-sama / voiranime est bloqué par CORS
    // On priorise le proxy local 8888 / 8787 pour éviter le spam d'erreurs CORS dans la console
    const isBrowserDev = typeof location !== 'undefined' && location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (isBrowserDev) {
      for (const proxyPrefix of PROXIES) {
        try {
          const proxyUrl = `${proxyPrefix}${encodeURIComponent(url)}`;
          return await fetchText(proxyUrl);
        } catch (_) {}
      }
    }

    try {
      return await fetchText(url);
    } catch (directError) {
      if (directError.name === 'AbortError') {
        throw new Error(`Délai dépassé pour ${new URL(url).hostname}.`);
      }

      // Essayer les proxies en cascade si pas encore fait
      let lastErr = null;
      for (const proxyPrefix of PROXIES) {
        try {
          const proxyUrl = `${proxyPrefix}${encodeURIComponent(url)}`;
          return await fetchText(proxyUrl);
        } catch (pErr) {
          lastErr = pErr;
        }
      }

      throw lastErr || new Error(`Requête directe et services proxies indisponibles pour ${new URL(url).hostname}.`);
    }
  }

  async function requestText(value, ttl = CACHE_TTL) {
    const url = allowedSourceUrl(value);
    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.body;
    if (pending.has(url)) return pending.get(url);

    const task = (async () => {
      let body;
      if (isNativeAndroid()) {
        body = await nativeGet(url);
      } else {
        body = await browserGet(url);
      }

      if (typeof body !== 'string' || body.length === 0) {
        throw new Error(`Réponse vide depuis ${new URL(url).hostname}.`);
      }
      if (body.length > MAX_RESPONSE_SIZE) {
        throw new Error(`Réponse trop volumineuse depuis ${new URL(url).hostname}.`);
      }
      cache.set(url, { body, expiresAt: Date.now() + ttl });
      return body;
    })();

    pending.set(url, task);
    try {
      return await task;
    } finally {
      pending.delete(url);
    }
  }

  function normalizeAnimeUrl(value, source, base) {
    const origin = SOURCES[source];
    if (!origin || !value) return '';
    try {
      return allowedSourceUrl(value, base || origin);
    } catch (error) {
      return '';
    }
  }

  function parseAnimeCards(markup, source, baseUrl) {
    let html = markup;
    try {
      const payload = JSON.parse(markup);
      if (payload && typeof payload.liste === 'string') html = payload.liste;
    } catch (error) {
      // Some source pages return HTML instead of the catalogue JSON payload.
    }

    const doc = parseHTML(html);
    const selectors = source === 'animesama'
      ? '.as-carte, .cardListAnime'
      : 'article.bs .bsx, .film-detail, .search-item';
    const results = [];

    doc.querySelectorAll(selectors).forEach(card => {
      const link = card.matches('a') ? card : card.querySelector('a[href]');
      const href = card.getAttribute('data-url') || (link && link.getAttribute('href'));
      const url = normalizeAnimeUrl(href, source, baseUrl);
      const title = clean(
        card.getAttribute('data-nom') ||
        card.querySelector('.as-carte-titre, h2[itemprop="headline"], h2, h3')?.textContent ||
        (link && link.getAttribute('title')) ||
        (link && link.textContent)
      );
      if (!url || !title) return;

      const image = card.getAttribute('data-img') ||
        card.querySelector('img')?.getAttribute('data-src') ||
        card.querySelector('img')?.getAttribute('src') || '';
      const badges = [...card.querySelectorAll('.as-badge, .type-badge, .badge')]
        .map(item => clean(item.textContent))
        .filter(Boolean);
      card.querySelectorAll('.as-drapeau img').forEach(flag => {
        const label = clean(flag.getAttribute('alt') || flag.getAttribute('title'));
        if (label && !badges.includes(label)) badges.push(label);
      });
      const language = clean(card.querySelector('.sb')?.textContent);
      if (language && !badges.includes(language)) badges.push(language);
      const typeLabel = clean(card.querySelector('.typez')?.textContent);
      const isFilm = /\b(?:film|movie)\b/i.test(`${title} ${url} ${badges.join(' ')} ${typeLabel}`);

      results.push({
        id: `${source === 'animesama' ? 'as' : 'va'}_${url.split('/').filter(Boolean).pop()}`,
        title,
        poster: safeAssetUrl(image, baseUrl),
        url,
        source,
        type: isFilm ? 'film' : 'serie',
        badges
      });
    });
    return results;
  }

  function uniqueResults(results) {
    const seen = new Set();
    return results.filter(item => {
      const key = item.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function searchAnimeSama(query) {
    const url = new URL('/catalogue/fragment.php', SOURCES.animesama);
    url.searchParams.set('search', query);
    const response = await requestText(url.href, 15 * 1000);
    return parseAnimeCards(response, 'animesama', url.href);
  }

  async function searchVoirAnime(query) {
    const q = clean(query);
    console.log(`[VoirAnime Recherche] Lancement recherche sur VoirAnime : « ${q} »`);
    try {
      const url = new URL('/', SOURCES.voiranime);
      url.searchParams.set('s', q);
      const response = await requestText(url.href, 15 * 1000);
      const results = parseAnimeCards(response, 'voiranime', url.href);
      console.log(`[VoirAnime Recherche] Résultats trouvés (${results.length}) :`, results.map(r => r.title));
      return results;
    } catch (err) {
      console.warn(`[VoirAnime Recherche] Erreur requête live VoirAnime :`, err.message);
      return [];
    }
  }

  // --- Index Sitemap hors-ligne & auto-complétion instantanée ---
  let sitemapIndex = null;
  let sitemapIndexLoading = null;

  async function loadSitemapIndex() {
    if (sitemapIndex) return sitemapIndex;
    if (sitemapIndexLoading) return sitemapIndexLoading;

    sitemapIndexLoading = (async () => {
      try {
        const res = await fetch('assets/catalog_index.json');
        if (res.ok) {
          const data = await res.json();
          sitemapIndex = data && Array.isArray(data.animes) ? data.animes : [];
          console.log(`[ScrappingService] Index sitemap chargé : ${sitemapIndex.length} animes.`);
          return sitemapIndex;
        }
      } catch (e) {
        console.warn('[ScrappingService] Impossible de charger catalog_index.json :', e.message);
      }
      sitemapIndex = [];
      return sitemapIndex;
    })();

    return sitemapIndexLoading;
  }

  function searchSitemapIndex(query, catalog) {
    if (!catalog || !catalog.length) return [];
    const q = clean(query).toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    const scored = [];
    for (const item of catalog) {
      const titleLower = item.title.toLowerCase();
      const slugLower = item.slug.toLowerCase();

      // Tous les mots de la recherche doivent être présents
      const allMatch = words.every(w => titleLower.includes(w) || slugLower.includes(w));
      if (!allMatch) continue;

      let score = 0;
      if (titleLower === q || slugLower === q) score += 100;
      else if (titleLower.startsWith(q) || slugLower.startsWith(q)) score += 60;
      else if (titleLower.includes(q)) score += 30;

      // Bonus si l'anime a de la VF
      if (item.has_vf) score += 5;

      const badges = ['Anime'];
      if (item.has_vf) badges.push('VF');
      if (item.has_vostfr) badges.push('VOSTFR');

      const slug = item.slug || (item.url ? item.url.replace(/.*\/catalogue\//, '').replace(/\/$/, '') : '');
      const poster = slug ? `https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/${slug}.webp` : '';

      scored.push({
        score,
        item: {
          id: item.id,
          title: item.title,
          poster,
          url: item.url,
          source: item.source === 'animesama' ? 'animesama' : 'voiranime',
          type: 'serie',
          badges
        }
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  }

  async function search(query) {
    const value = clean(query);
    if (!value) return [];

    // 1. Recherche instantanée via sitemap index (2992 animes)
    let sitemapResults = [];
    try {
      const catalog = await loadSitemapIndex();
      sitemapResults = searchSitemapIndex(value, catalog);
    } catch (e) {
      console.warn('[ScrappingService] Erreur recherche sitemap index:', e);
    }

    // 2. Recherche live en parallèle si réseau disponible
    let liveResults = [];
    try {
      const settled = await Promise.allSettled([
        searchAnimeSama(value),
        searchVoirAnime(value)
      ]);
      liveResults = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    } catch (e) {
      console.warn('[ScrappingService] Recherche live ignorée:', e.message);
    }

    // 3. Fusion : prioriser les live results avec poster, et compléter avec sitemap
    const combined = [...liveResults];
    const seenUrls = new Set(liveResults.map(r => r.url.toLowerCase()));

    for (const sItem of sitemapResults) {
      if (!seenUrls.has(sItem.url.toLowerCase())) {
        combined.push(sItem);
        seenUrls.add(sItem.url.toLowerCase());
      }
    }

    if (combined.length) {
      return uniqueResults(combined);
    }

    return sitemapResults;
  }

  async function getTrending() {
    try {
      const url = new URL('/catalogue/fragment.php', SOURCES.animesama);
      url.searchParams.set('type[]', 'Anime');
      url.searchParams.set('order', 'date');
      const cards = parseAnimeCards(await requestText(url.href), 'animesama', url.href).slice(0, 20);
      if (cards && cards.length) return cards;
    } catch (err) {
      console.warn('[Scrapping] getTrending réseau indisponible, essai fallback catalogue local:', err.message);
    }

    // Fallback catalogue local immédiat
    try {
      const res = await fetch('assets/catalog_index.json');
      if (res.ok) {
        const catalog = await res.json();
        const animes = catalog && Array.isArray(catalog.animes) ? catalog.animes : (Array.isArray(catalog) ? catalog : []);
        if (animes.length) {
          return animes.slice(0, 24).map(item => ({
            id: item.url || item.title,
            title: item.title,
            url: item.url,
            poster: item.poster || `https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/${item.slug || 'solo-leveling'}.webp`,
            type: item.type || 'Anime',
            source: 'animesama',
            has_vf: !!item.has_vf,
            has_vostfr: !!item.has_vostfr,
            badges: item.has_vf ? ['Anime', 'VF'] : ['Anime', 'VOSTFR'],
            genres: item.genres || ['Action', 'Aventure']
          }));
        }
      }
    } catch (e) {
      console.warn('[Scrapping] Échec fallback catalogue local:', e.message);
    }
    return [];
  }

  function detectLanguage(text, url) {
    const value = `${text || ''} ${url || ''}`.toLowerCase();
    if (/(^|[/\s_-])vf([/\s_-]|$)/i.test(value)) return 'VF';
    if (/vostfr|vo(?:st)?fr/i.test(value)) return 'VOSTFR';
    if (/(^|[/\s_-])va([/\s_-]|$)/i.test(value)) return 'VA';
    return '';
  }

  function animeSamaSeasons(markup, pageUrl) {
    const seasons = [];
    const doc = parseHTML(markup);
    const scripts = [...doc.querySelectorAll('script:not([src])')]
      .map(script => script.textContent || '')
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const rootUrl = new URL(pageUrl);
    const rootPath = rootUrl.pathname.endsWith('/') ? rootUrl.pathname : `${rootUrl.pathname}/`;
    const panelPattern = /panneauAnime\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
    let match;
    while ((match = panelPattern.exec(scripts)) !== null) {
      if (/^(?:nom|name|title)$/i.test(match[1]) || /^(?:url|path)$/i.test(match[2])) continue;
      const url = normalizeAnimeUrl(match[2], 'animesama', pageUrl);
      if (!url || !new URL(url).pathname.startsWith(rootPath) || seasons.some(season => season.url === url)) continue;
      seasons.push({
        number: seasons.length + 1,
        title: clean(match[1]) || `Saison ${seasons.length + 1}`,
        lang: detectLanguage(match[1], url),
        url: url.endsWith('/') ? url : `${url}/`,
        episodes: []
      });
    }

    // Détection automatique des versions VF correspondantes si les saisons sont VOSTFR
    const vfCandidates = [];
    for (const s of seasons) {
      if ((s.lang || '').toUpperCase() === 'VOSTFR' && s.url.includes('/vostfr/')) {
        const vfUrl = s.url.replace('/vostfr/', '/vf/');
        if (!seasons.some(existing => existing.url === vfUrl)) {
          vfCandidates.push({
            number: seasons.length + vfCandidates.length + 1,
            title: s.title.replace(/\s*VOSTFR/i, '') + ' (VF)',
            lang: 'VF',
            url: vfUrl,
            episodes: []
          });
        }
      }
    }
    if (vfCandidates.length > 0) {
      seasons.push(...vfCandidates);
    }

    if (!seasons.length && /\/(?:saison[^/]*|film[^/]*)\/(?:vf|vostfr|vo)\//i.test(new URL(pageUrl).pathname)) {
      seasons.push({
        number: 1,
        title: 'Épisodes',
        lang: detectLanguage('', pageUrl),
        url: pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`,
        episodes: []
      });
    }
    return seasons;
  }

  async function getDetailAnimeSama(animeUrl) {
    const url = normalizeAnimeUrl(animeUrl, 'animesama');
    if (!url) throw new Error('URL Anime-Sama invalide.');

    let markup = '';
    try {
      markup = await requestText(url);
    } catch (e) {
      console.warn('[ScrappingService] Requête detail live échouée, essai fallback sitemap:', e.message);
    }

    if (markup) {
      const doc = parseHTML(markup);
      const title = clean(doc.querySelector('#titreOeuvre, .oe-titre, h1')?.textContent) || 'Anime';
      const heroBg = safeAssetUrl(
        doc.querySelector('.oe-fond img')?.getAttribute('src') ||
        doc.querySelector('#imgOeuvre')?.getAttribute('src') || '',
        url
      );
      const poster = safeAssetUrl(doc.querySelector('.oe-affiche img')?.getAttribute('src'), url) || heroBg;
      const genres = [...doc.querySelectorAll('.oe-genres a, .genre-pill')]
        .map(item => clean(item.textContent)).filter(Boolean);

      return {
        title,
        alters: clean(doc.querySelector('#titreAlter, .oe-alters')?.textContent),
        synopsis: clean(doc.querySelector('#synopsisText, .oe-synopsis p, .oe-corps p')?.textContent),
        heroBg,
        poster,
        meta: clean(doc.querySelector('.oe-meta')?.textContent),
        note: clean(doc.querySelector('.oe-note b')?.textContent) || '8.2',
        genres,
        source: 'animesama',
        url,
        seasons: animeSamaSeasons(markup, url)
      };
    }

    // Fallback catalogue sitemap index local
    const catalog = await loadSitemapIndex();
    const item = (catalog || []).find(it => it.url && (it.url.toLowerCase() === url.toLowerCase() || it.url.toLowerCase().replace(/\/$/, '') === url.toLowerCase().replace(/\/$/, '')));
    if (item) {
      const slug = item.slug || url.replace(/.*\/catalogue\//, '').replace(/\/$/, '');
      const poster = `https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/${slug}.webp`;
      const fallbackSeasons = (item.versions || []).map((ver, idx) => {
        const parts = ver.split('/');
        const sName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : `Saison ${idx+1}`;
        const lang = (parts[1] || 'VOSTFR').toUpperCase();
        return {
          number: idx + 1,
          title: `${sName} (${lang})`,
          lang: lang,
          url: `${url}${ver}/`,
          episodes: []
        };
      });

      return {
        title: item.title,
        alters: '',
        synopsis: `Regarde tous les épisodes de ${item.title} en streaming haute définition sur Anime Plus.`,
        heroBg: poster,
        poster: poster,
        meta: item.has_vf ? 'VF / VOSTFR' : 'VOSTFR',
        note: '8.0',
        genres: ['Action', 'Aventure'],
        source: 'animesama',
        url,
        seasons: fallbackSeasons.length ? fallbackSeasons : [{
          number: 1,
          title: 'Saison 1 (VF)',
          lang: 'VF',
          url: `${url}saison1/vf/`,
          episodes: []
        }]
      };
    }

    throw new Error('Impossible de charger les détails.');
  }

  function countArrayStrings(script) {
    const pattern = /\b(?:var|let|const)\s+eps\d+\s*=\s*\[/g;
    let match;
    let maximum = 0;
    while ((match = pattern.exec(script)) !== null) {
      let index = pattern.lastIndex;
      let depth = 1;
      let quote = '';
      let escaped = false;
      let count = 0;
      while (index < script.length && depth > 0) {
        const char = script[index++];
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) {
            quote = '';
            if (depth === 1) count++;
          }
        } else if (char === '"' || char === "'" || char === '`') {
          quote = char;
        } else if (char === '[') {
          depth++;
        } else if (char === ']') {
          depth--;
        }
      }
      maximum = Math.max(maximum, count);
      pattern.lastIndex = index;
    }
    return maximum;
  }

  function episodeTitlesFromHTML(markup) {
    const doc = parseHTML(markup);
    return [...doc.querySelectorAll('.episode-list li, .episodes-list li, .eplister li, [data-episode-number]')]
      .map(item => clean(item.querySelector('.epl-title, .episode-title, a')?.textContent || item.textContent))
      .filter(Boolean);
  }

  function parseVoirAnimeEpisodes(markup, pageUrl) {
    const doc = parseHTML(markup);
    const links = [...doc.querySelectorAll('.eplister a[href], ul.episodelst a[href], .episodes-list a[href], .episode-list a[href]')];
    const episodes = [];

    links.forEach((link, index) => {
      const url = normalizeAnimeUrl(link.getAttribute('href'), 'voiranime', pageUrl);
      if (!url) return;
      const rawNumber = clean(
        link.querySelector('.epl-num')?.textContent ||
        link.closest('[data-episode-number]')?.getAttribute('data-episode-number')
      );
      const numberMatch = rawNumber.match(/\d+/);
      const title = clean(
        link.querySelector('.epl-title, .episode-title, [itemprop="headline"]')?.textContent ||
        link.getAttribute('title') ||
        link.textContent
      );
      if (!title) return;

      episodes.push({
        number: numberMatch ? Number(numberMatch[0]) : index + 1,
        title,
        url,
        streamUrl: url,
        streams: [{ name: 'Lecteur VoirAnime (HD)', url, rawUrl: url, key: 'eps1' }],
        duration: '24 min'
      });
    });

    if (episodes.length > 1 && episodes[0].number > episodes[episodes.length - 1].number) {
      episodes.reverse();
    }

    return episodes;
  }

  function makeEpisodeList(count, titles = []) {
    return Array.from({ length: Math.min(count, 1000) }, (_, index) => ({
      number: index + 1,
      title: titles[index] || `Épisode ${index + 1}`,
      duration: '24 min',
      streamUrl: '',
      streams: []
    }));
  }

  let lastKnownAnimeSamaJeton = '';

  function parseEpisodesWithStreams(scriptOrHtml, pageUrl, titles = []) {
    const players = {};
    const regexEps = /\b(?:var|let|const)\s+(eps\d+)\s*=\s*\[([\s\S]*?)\];/g;
    let match;

    while ((match = regexEps.exec(scriptOrHtml)) !== null) {
      const pName = match[1];
      const urlsBlock = match[2];
      const urls = (urlsBlock.match(/['"]([^'"]+)['"]/g) || [])
        .map(u => u.replace(/['"]/g, '').trim())
        .filter(Boolean);
      if (urls.length > 0) {
        players[pName] = urls;
      }
    }

    const playerKeys = Object.keys(players);
    const maxEp = Math.max(playerKeys.length ? Math.max(...playerKeys.map(k => players[k].length)) : 0, titles.length);
    if (maxEp === 0) return [];

    // Récupérer epsJeton si présent
    const jetonMatch = scriptOrHtml.match(/epsJeton\s*=\s*['"]([^'"]+)['"]/);
    const epsJeton = jetonMatch ? jetonMatch[1] : lastKnownAnimeSamaJeton;
    if (epsJeton) lastKnownAnimeSamaJeton = epsJeton;

    // Récupérer epsMeta et lecteursInfos pour nommer précisément les hébergeurs
    let epsMeta = {};
    const metaMatch = scriptOrHtml.match(/var\s+epsMeta\s*=\s*(\{[\s\S]*?\});/);
    if (metaMatch) {
      try { epsMeta = JSON.parse(metaMatch[1]); } catch (e) {}
    }

    let lecteursInfos = {
      'ansembed.net': { nom: 'Vidmoly', hd: true },
      'vidmoly.to': { nom: 'Vidmoly', hd: true },
      'vidmoly.net': { nom: 'Vidmoly', hd: true },
      'vidmoly.biz': { nom: 'Vidmoly', hd: true },
      'smoothpre.com': { nom: 'Earnvids', hd: true },
      'sendvid.com': { nom: 'SendVid', hd: false },
      'video.sibnet.ru': { nom: 'Sibnet', hd: false },
      'uqload.vc': { nom: 'Uqload', hd: true },
      'uqload.to': { nom: 'Uqload', hd: true }
    };
    const infosMatch = scriptOrHtml.match(/var\s+lecteursInfos\s*=\s*(\{[\s\S]*?\});/);
    if (infosMatch) {
      try {
        const parsedInfos = JSON.parse(infosMatch[1]);
        lecteursInfos = { ...lecteursInfos, ...parsedInfos };
      } catch (e) {}
    }

    const episodes = [];
    for (let i = 0; i < maxEp; i++) {
      const availableStreams = [];
      playerKeys.forEach(k => {
        if (players[k][i]) {
          const rawUrl = players[k][i];
          let label = 'Lecteur ' + k.replace('eps', '');
          let isDead = false;

          if (rawUrl.startsWith('lien:')) {
            const lid = rawUrl.slice(5);
            if (epsMeta[lid]) {
              const metaEntry = epsMeta[lid];
              const host = Array.isArray(metaEntry) ? metaEntry[0] : metaEntry;
              if (Array.isArray(metaEntry) && metaEntry[1] === 1) isDead = true;
              if (lecteursInfos[host]) {
                const info = lecteursInfos[host];
                label = `${info.nom || host} ${info.hd ? '(HD)' : ''}`.trim();
              } else if (host) {
                const cleanHost = host.split('.')[0];
                label = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
              }
            }
          } else {
            const uLower = rawUrl.toLowerCase();
            if (uLower.includes('ansembed') || uLower.includes('vidmoly')) label = 'Vidmoly (HD)';
            else if (uLower.includes('sendvid')) label = 'SendVid (MP4)';
            else if (uLower.includes('uqload')) label = 'Uqload (HD)';
            else if (uLower.includes('sibnet')) label = 'Sibnet (MP4)';
            else if (uLower.includes('smoothpre') || uLower.includes('earnvids')) label = 'Earnvids (HD)';
            else if (uLower.includes('vk.com')) label = 'VK Video';
            else if (k === 'eps1') label = 'Lecteur Principal (HD)';
            else if (k === 'eps2') label = 'Lecteur 2';
            else if (k === 'eps3') label = 'Lecteur 3';
          }

          if (!isDead) {
            availableStreams.push({
              name: label,
              key: k,
              rawUrl: rawUrl,
              url: rawUrl,
              jeton: epsJeton,
              seasonUrl: pageUrl
            });
          }
        }
      });

      const primary = availableStreams.length ? availableStreams[0].url : '';
      episodes.push({
        number: i + 1,
        title: titles[i] || `Épisode ${i + 1}`,
        duration: '24 min',
        streamUrl: primary,
        streams: availableStreams,
        jeton: epsJeton,
        seasonUrl: pageUrl
      });
    }

    return episodes;
  }

  async function getSeasonEpisodesAnimeSama(seasonUrl) {
    const url = normalizeAnimeUrl(seasonUrl, 'animesama');
    if (!url) throw new Error('URL de saison Anime-Sama invalide.');
    const pageUrl = url.endsWith('/') ? url : `${url}/`;
    const page = await requestText(pageUrl);
    const titles = episodeTitlesFromHTML(page);

    // 1. Tenter d'extraire les eps déclarés directement dans le HTML de la page
    const directEpisodes = parseEpisodesWithStreams(page, pageUrl, titles);
    if (directEpisodes.length > 0) {
      console.log(`[ScrappingService] ${directEpisodes.length} épisodes avec flux trouvés dans la page saison`);
      return directEpisodes;
    }

    // 2. Sinon chercher episodes.js
    const pageDoc = parseHTML(page);
    const scriptSrc = [...pageDoc.querySelectorAll('script[src]')]
      .map(script => script.getAttribute('src'))
      .find(src => /episodes\.js(?:\?|$)/i.test(src || ''));
    const fileVersion = page.match(/episodes\.js\?filever=([a-zA-Z0-9_-]+)/)?.[1];
    const scriptUrl = scriptSrc
      ? normalizeAnimeUrl(scriptSrc, 'animesama', pageUrl)
      : `${pageUrl}episodes.js${fileVersion ? `?filever=${encodeURIComponent(fileVersion)}` : ''}`;
    if (!scriptUrl) return makeEpisodeList(titles.length, titles);

    try {
      const script = await requestText(scriptUrl, 30 * 1000);
      const parsed = parseEpisodesWithStreams(script + '\n' + page, pageUrl, titles);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      console.warn('[ScrappingService] Erreur lecture episodes.js:', e.message);
    }

    return makeEpisodeList(titles.length, titles);
  }

  // Résolution d'un lien « lien:<id> » ou iframe vers un flux jouable / embed direct
  async function resolveStreamUrl(streamObjOrUrl, animeSource = 'animesama') {
    let url = typeof streamObjOrUrl === 'string' ? streamObjOrUrl.trim() : (streamObjOrUrl.url || streamObjOrUrl.rawUrl || '').trim();
    let jeton = (typeof streamObjOrUrl === 'object' && streamObjOrUrl.jeton) ? streamObjOrUrl.jeton : lastKnownAnimeSamaJeton;
    const seasonUrl = typeof streamObjOrUrl === 'object' ? streamObjOrUrl.seasonUrl : '';

    if (!url) return '';

    // Si c'est un lien:id et qu'on n'a pas encore le jeton, le récupérer depuis seasonUrl
    if (url.startsWith('lien:') && !jeton && seasonUrl) {
      try {
        const seasonPage = await requestText(seasonUrl, 8000);
        const m = seasonPage.match(/epsJeton\s*=\s*['"]([^'"]+)['"]/);
        if (m) {
          jeton = m[1];
          lastKnownAnimeSamaJeton = jeton;
        }
      } catch (e) {}
    }

    // 0. Si c'est une URL de page épisode VoirAnime -> extraire l'iframe d'hébergeur vidéo réel
    if (url.includes('voiranime.be/') || animeSource === 'voiranime') {
      console.log('[VoirAnime Lecture] Résolution de la page épisode :', url);
      try {
        const epMarkup = await requestText(url, 12000);
        const epDoc = parseHTML(epMarkup);
        const embedIframe = epDoc.querySelector('.player-embed iframe, #pembed iframe, .entry-content iframe, iframe[src*="vkspeed"], iframe[src*="embed"], iframe[src*="sendvid"], iframe[src*="sibnet"], iframe[src*="voembed"], iframe');
        let extractedSrc = embedIframe ? (embedIframe.getAttribute('src') || embedIframe.getAttribute('data-src')) : '';

        // Si non trouvé directement, chercher dans les options de miroir en base64
        if (!extractedSrc) {
          const mirrorOptions = [...epDoc.querySelectorAll('select.mirror option, select[name*="mirror"] option, select option[value*="PHA"]')];
          for (const opt of mirrorOptions) {
            const val = (opt.value || '').trim();
            if (val) {
              try {
                const decoded = atob(val);
                const m = decoded.match(/src=["']([^"']+)["']/i);
                if (m && m[1]) {
                  extractedSrc = m[1];
                  console.log('[VoirAnime Lecture] Miroir extrait depuis base64 :', extractedSrc);
                  break;
                }
              } catch (e) {}
            }
          }
        }

        if (extractedSrc) {
          if (extractedSrc.startsWith('//')) extractedSrc = 'https:' + extractedSrc;
          console.log('[VoirAnime Lecture] Iframe embed vidéo résolu :', extractedSrc);
          url = extractedSrc;
        } else {
          console.warn('[VoirAnime Lecture] Aucun iframe trouvé dans la page épisode :', url);
        }
      } catch (e) {
        console.warn('[VoirAnime Lecture] Échec chargement page épisode :', e.message);
      }
    }

    // A. Si c'est un repère Anime-Sama « lien:12345 »
    if (url.startsWith('lien:')) {
      const lienId = url.slice(5);
      console.log(`[ScrappingService] Résolution Anime-Sama API lien: ${lienId} (jeton: ${jeton})`);
      const apiUrl = `https://anime-sama.to/api/lien.php?j=${encodeURIComponent(jeton || '')}&l=${encodeURIComponent(lienId)}`;
      try {
        const raw = await requestText(apiUrl, 10000);
        const data = JSON.parse(raw);
        if (data && data.u) {
          url = data.u;
          console.log(`[ScrappingService] Résolu en embed réel: ${url}`);
        } else {
          console.warn('[ScrappingService] Réponse api/lien sans URL:', data);
        }
      } catch (e) {
        console.warn('[ScrappingService] Échec appel api/lien.php:', e.message);
      }
    }

    if (url.startsWith('//')) url = 'https:' + url;

    // B. Si Ansembed / Vidmoly / Voembed -> tenter d'extraire le master.m3u8 direct pour lecteur natif
    if (url.includes('ansembed.net') || url.includes('vidmoly') || url.includes('voembed') || url.includes('vmnow')) {
      console.log('[Lecture Flux Direct] Analyse du flux HLS embed :', url);
      try {
        const embedHtml = await requestText(url, 10000);
        const m3u8Match = embedHtml.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) ||
                          embedHtml.match(/file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i) ||
                          embedHtml.match(/src\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (m3u8Match && m3u8Match[1]) {
          console.log('[Lecture Flux Direct] M3U8 direct extrait avec succès :', m3u8Match[1]);
          return { streamUrl: m3u8Match[1], isDirect: true, embedUrl: url };
        }
      } catch (e) {
        console.warn('[Lecture Flux Direct] Extraction m3u8 directe échouée, fallback embed :', e.message);
      }
    }

    // C. Si Sibnet -> extraction MP4 direct
    if (url.includes('video.sibnet.ru')) {
      try {
        const idMatch = url.match(/videoid=(\d+)/);
        if (idMatch) {
          const shellHtml = await requestText(url, 10000);
          const slugMatch = shellHtml.match(/\/v\/[a-zA-Z0-9_\-]+\/\d+\.mp4/);
          if (slugMatch) {
            const directMp4 = `https://video.sibnet.ru${slugMatch[0]}`;
            console.log('[ScrappingService] MP4 direct Sibnet extrait:', directMp4);
            return { streamUrl: directMp4, isDirect: true, embedUrl: url };
          }
        }
      } catch (e) {
        console.warn('[ScrappingService] Extraction Sibnet échouée:', e.message);
      }
    }

    // D. Si SendVid -> extraction MP4 direct
    if (url.includes('sendvid.com/')) {
      try {
        const sendvidHtml = await requestText(url, 10000);
        const mp4Match = sendvidHtml.match(/<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/i);
        if (mp4Match && mp4Match[1]) {
          return { streamUrl: mp4Match[1], isDirect: true, embedUrl: url };
        }
      } catch (e) {}
    }

    // E. Flux direct déjà en MP4 ou M3U8
    if (/\.(?:mp4|m3u8)(?:\?|$)/i.test(url)) {
      return { streamUrl: url, isDirect: true, embedUrl: url };
    }

    // F. Fallback iframe embed universel sécurisé
    return { streamUrl: url, isDirect: false, embedUrl: url };
  }

  async function getDetailVoirAnime(animeUrl) {
    const url = normalizeAnimeUrl(animeUrl, 'voiranime');
    if (!url) throw new Error('URL VoirAnime invalide.');
    const markup = await requestText(url);
    const doc = parseHTML(markup);
    const title = clean(doc.querySelector('h1.entry-title, h1[itemprop="name"], h1')?.textContent) || 'Anime';
    const poster = safeAssetUrl(
      doc.querySelector('.thumb img, [itemprop="image"]')?.getAttribute('src'),
      url
    );
    const episodes = parseVoirAnimeEpisodes(markup, url);
    const languageLabels = [...doc.querySelectorAll('.eplister .status, .eplister .sb, .eplister .epl-title, ul.episodelst .status, ul.episodelst .sb')]
      .map(item => clean(item.textContent).toLowerCase());
    const lang = languageLabels.length && languageLabels.every(label => /dub|vf/.test(label))
      ? 'VF'
      : languageLabels.length && languageLabels.every(label => /sub|vostfr/.test(label))
        ? 'VOSTFR'
        : detectLanguage('', url) || 'VOSTFR';

    const genres = [...doc.querySelectorAll('.genxed a, a[href*="/genres/"], .info-content a[href*="genre"]')]
      .map(el => clean(el.textContent)).filter(Boolean);
    const note = clean(doc.querySelector('.rating strong, .num, [itemprop="ratingValue"]')?.textContent) || '7.9';

    return {
      title,
      alters: '',
      synopsis: clean(doc.querySelector('.entry-content p, .synopsis p, .desc')?.textContent) || `Regarde ${title} en streaming HD sur Anime Plus.`,
      heroBg: poster,
      poster,
      meta: clean(doc.querySelector('.spe, .info-content')?.textContent) || `Version ${lang}`,
      note,
      genres: genres.length ? genres : ['Action', 'Animation'],
      source: 'voiranime',
      url,
      seasons: [{
        number: 1,
        title: `Épisodes ${lang}`,
        lang,
        url,
        episodes
      }]
    };
  }

  async function getAnimeDetail(animeUrl, source) {
    if (!animeUrl) throw new Error('URL de l’anime manquante.');
    const normalized = new URL(animeUrl);
    if (normalized.hostname.endsWith('anime-sama.to')) return getDetailAnimeSama(normalized.href);
    if (normalized.hostname.endsWith('voiranime.be')) return getDetailVoirAnime(normalized.href);
    throw new Error(`Source non prise en charge : ${source || normalized.hostname}.`);
  }

  function isDirectMediaUrl(value) {
    try {
      const url = new URL(value, document.baseURI);
      return /^https?:$/.test(url.protocol) && /\.(?:mp4|webm|ogg|m3u8)$/i.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  async function playDirectMedia(value, video, iframe) {
    if (!video || !isDirectMediaUrl(value)) {
      throw new Error('Une URL vidéo directe autorisée est requise.');
    }
    const url = new URL(value, document.baseURI);
    if (iframe) {
      iframe.src = 'about:blank';
      iframe.hidden = true;
    }
    video.hidden = false;
    video.src = url.href;
    video.load();

    let autoplayBlocked = false;
    try {
      await video.play();
    } catch (error) {
      if (error && error.name === 'NotAllowedError') autoplayBlocked = true;
      else throw error;
    }
    return { mode: isNativeAndroid() ? 'android-webview-video' : 'html5-video', autoplayBlocked };
  }

  return Object.freeze({
    search,
    loadSitemapIndex,
    searchSitemapIndex,
    getTrending,
    getRecents: getTrending,
    getAnimeDetail,
    getSeasonEpisodesAnimeSama,
    resolveStreamUrl,
    isDirectMediaUrl,
    playDirectMedia
  });
})();

window.ScrappingService = ScrappingService;
