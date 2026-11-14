/**
 * Standalone metadata scraper. It never follows or extracts third-party player streams.
 */
const ScrappingService = (() => {
  const SOURCES = {
    animesama: 'https://anime-sama.to',
    voiranime: 'https://voiranime.be'
  };
  const CORS_PROXY = 'http://127.0.0.1:8787/raw';
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
    });
    if (!/^https?:$/.test(url.protocol) || !allowed) {
      throw new Error('La requête est limitée aux domaines Anime-Sama et VoirAnime.');
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
    try {
      return await fetchText(url);
    } catch (directError) {
      if (directError.name === 'AbortError') {
        throw new Error(`Délai dépassé pour ${new URL(url).hostname}.`);
      }
      if (!(directError instanceof TypeError)) throw directError;

      const proxyUrl = new URL(CORS_PROXY);
      proxyUrl.searchParams.set('url', url);
      try {
        console.info(`[Scrapping] Source CORS indisponible; essai proxy local pour ${new URL(url).hostname}.`);
        return await fetchText(proxyUrl.href);
      } catch (proxyError) {
        if (proxyError.name === 'AbortError') {
          throw new Error(`Le service CORS gratuit a dépassé le délai pour ${new URL(url).hostname}.`);
        }
        throw new Error(`Requête directe et service CORS indisponibles pour ${new URL(url).hostname}.`);
      }
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
    const url = new URL('/', SOURCES.voiranime);
    url.searchParams.set('s', query);
    const response = await requestText(url.href, 15 * 1000);
    return parseAnimeCards(response, 'voiranime', url.href);
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

      scored.push({
        score,
        item: {
          id: item.id,
          title: item.title,
          poster: '', // sera enrichi par l'affiche réelle sur la fiche
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

    // 1. Recherche instantanée via sitemap index
    let sitemapResults = [];
    try {
      const catalog = await loadSitemapIndex();
      sitemapResults = searchSitemapIndex(value, catalog);
    } catch (e) {
      console.warn('[ScrappingService] Erreur recherche sitemap index:', e);
    }

    // 2. Recherche live sur les 2 sites
    const settled = await Promise.allSettled([
      searchAnimeSama(value),
      searchVoirAnime(value)
    ]);
    const liveResults = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);

    // 3. Fusion intelligente : prioriser les live results avec poster, et compléter avec le catalogue sitemap
    if (liveResults.length || sitemapResults.length) {
      const combined = [...liveResults];
      const seenUrls = new Set(liveResults.map(r => r.url.toLowerCase()));

      for (const sItem of sitemapResults) {
        if (!seenUrls.has(sItem.url.toLowerCase())) {
          combined.push(sItem);
          seenUrls.add(sItem.url.toLowerCase());
        }
      }
      return uniqueResults(combined);
    }

    const errors = settled
      .filter(result => result.status === 'rejected')
      .map(result => result.reason.message);
    if (errors.length) throw new Error(`Recherche indisponible : ${errors.join(' | ')}`);
    return [];
  }

  async function getTrending() {
    const url = new URL('/catalogue/fragment.php', SOURCES.animesama);
    url.searchParams.set('type[]', 'Anime');
    url.searchParams.set('order', 'date');
    return parseAnimeCards(await requestText(url.href), 'animesama', url.href).slice(0, 20);
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
    const markup = await requestText(url);
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
      note: clean(doc.querySelector('.oe-note b')?.textContent),
      genres,
      source: 'animesama',
      url,
      seasons: animeSamaSeasons(markup, url)
    };
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
        streamUrl: '',
        streams: [],
        duration: '24 min'
      });
    });

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

  async function getSeasonEpisodesAnimeSama(seasonUrl) {
    const url = normalizeAnimeUrl(seasonUrl, 'animesama');
    if (!url) throw new Error('URL de saison Anime-Sama invalide.');
    const pageUrl = url.endsWith('/') ? url : `${url}/`;
    const page = await requestText(pageUrl);
    const titles = episodeTitlesFromHTML(page);
    let count = Math.max(countArrayStrings(page), titles.length);
    if (count) return makeEpisodeList(count, titles);

    const pageDoc = parseHTML(page);
    const scriptSrc = [...pageDoc.querySelectorAll('script[src]')]
      .map(script => script.getAttribute('src'))
      .find(src => /episodes\.js(?:\?|$)/i.test(src || ''));
    const fileVersion = page.match(/episodes\.js\?filever=([a-zA-Z0-9_-]+)/)?.[1];
    const scriptUrl = scriptSrc
      ? normalizeAnimeUrl(scriptSrc, 'animesama', pageUrl)
      : `${pageUrl}episodes.js${fileVersion ? `?filever=${encodeURIComponent(fileVersion)}` : ''}`;
    if (!scriptUrl) return [];

    const script = await requestText(scriptUrl, 30 * 1000);
    count = countArrayStrings(script);
    return makeEpisodeList(count, titles);
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

    return {
      title,
      alters: '',
      synopsis: clean(doc.querySelector('.entry-content p, .synopsis p')?.textContent),
      heroBg: poster,
      poster,
      meta: clean(doc.querySelector('.spe, .info-content')?.textContent),
      note: '',
      genres: [],
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
    isDirectMediaUrl,
    playDirectMedia
  });
})();

window.ScrappingService = ScrappingService;
