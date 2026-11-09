/**
 * scraper.js — Service de scraping multi-sources pour AnimePlus
 * Sources : anime-sama.fr, voiranimes.com, 2anime.xyz
 * Utilise un proxy CORS en mode dev web
 */

const ScraperService = (() => {

  // En mode WebView Android, le CORS est géré nativement
  // En mode dev web, on utilise un proxy CORS public
  const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
  const IS_WEBVIEW = typeof window.AndroidBridge !== 'undefined' || navigator.userAgent.includes('AnimePlusApp');

  const SOURCES = {
    ANIMESAMA: 'animesama',
    VOIRANIMES: 'voiranimes',
    ANIME2: '2anime',
  };

  const DOMAINS = {
    ANIMESAMA: 'https://anime-sama.to',
    // VoirAnime change constamment de TLD (.be, .to, .com, .fr, .io, .club)
    VOIRANIMES: [
      'https://voiranime.be',
      'https://voir-anime.to',
      'https://v6.voiranimes.com',
      'https://voiranime.com'
    ],
    ANIME2: 'https://2anime.xyz'
  };

  let activeVoirAnimeDomain = DOMAINS.VOIRANIMES[0];

  /**
   * Teste ou résout le domaine fonctionnel pour VoirAnime
   */
  async function resolveVoirAnimeDomain() {
    for (const d of DOMAINS.VOIRANIMES) {
      try {
        const test = await fetchWithProxy(`${d}/`, { method: 'HEAD' });
        if (test) {
          activeVoirAnimeDomain = d;
          return d;
        }
      } catch (e) {
        // Continue sur le suivant
      }
    }
    return activeVoirAnimeDomain;
  }

  // Délai entre requêtes pour éviter le rate limiting
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  /**
   * Fait une requête HTTP avec gestion CORS proxy
   * @param {string} url
   * @param {object} options
   * @returns {Promise<string>} HTML content
   */
  async function fetchWithProxy(url, options = {}) {
    const finalUrl = IS_WEBVIEW ? url : `${CORS_PROXY}${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(finalUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
          ...options.headers,
        },
        ...options,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Parse HTML string en Document
   */
  function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  /**
   * Nettoie le texte (trim + supprime espaces multiples)
   */
  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Résout une URL relative en URL absolue
   */
  function resolveUrl(base, relative) {
    try {
      if (!relative) return '';
      if (relative.startsWith('http')) return relative;
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  // ======================================================
  // ANIME-SAMA.TO
  // ======================================================

  async function _searchAnimeSama(query) {
    const base = DOMAINS.ANIMESAMA;
    const url = `${base}/catalogue/?search=${encodeURIComponent(query)}`;
    try {
      const html = await fetchWithProxy(url);
      const doc = parseHTML(html);
      const results = [];

      // Anime-sama utilise des cartes avec classe spécifique
      const cards = doc.querySelectorAll('.cardListAnime, [id^="anime-"], .anime-item');

      cards.forEach(card => {
        try {
          // Essai sélecteurs multiples pour robustesse
          const titleEl = card.querySelector('h1, h2, h3, .title, [class*="title"]') ||
                          card.querySelector('a[title]');
          const title = titleEl ? cleanText(titleEl.getAttribute('title') || titleEl.textContent) : '';
          if (!title) return;

          const link = card.querySelector('a');
          const href = link ? resolveUrl(base + '/', link.getAttribute('href')) : '';

          const img = card.querySelector('img');
          const poster = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';

          const metaEls = card.querySelectorAll('.meta, .type, .year, [class*="meta"]');
          let year = null, type = 'serie', genres = [];

          metaEls.forEach(el => {
            const text = cleanText(el.textContent);
            if (/^\d{4}$/.test(text)) year = parseInt(text);
            if (/film|movie/i.test(text)) type = 'film';
          });

          if (!href) return;

          const id = `animesama_${href.split('/').filter(Boolean).pop() || Math.random().toString(36).slice(2)}`;

          results.push({
            id,
            title,
            year,
            genres,
            poster: resolveUrl(base + '/', poster),
            synopsis: '',
            type,
            seasons: [],
            source: SOURCES.ANIMESAMA,
            url: href,
          });
        } catch (e) {
          // Ignore une carte mal parsée
        }
      });

      // Fallback : chercher des liens avec motif /catalogue/
      if (results.length === 0) {
        const links = doc.querySelectorAll('a[href*="/catalogue/"]');
        links.forEach(link => {
          const href = resolveUrl(base + '/', link.getAttribute('href'));
          const title = cleanText(link.getAttribute('title') || link.textContent);
          if (!title || href.includes('?') || title.length < 2) return;
          const id = `animesama_${href.split('/').filter(Boolean).pop()}`;
          if (!results.find(r => r.id === id)) {
            results.push({
              id, title, year: null, genres: [], poster: '', synopsis: '',
              type: 'serie', seasons: [], source: SOURCES.ANIMESAMA, url: href,
            });
          }
        });
      }

      return results;
    } catch (err) {
      console.warn('[Scraper] AnimeSama search error:', err.message);
      return [];
    }
  }

  async function _getDetailAnimeSama(url) {
    try {
      const html = await fetchWithProxy(url);
      const doc = parseHTML(html);

      const title = cleanText(
        doc.querySelector('h1.title, h1[class*="title"], h1')?.textContent ||
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
      );

      const poster =
        doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
        doc.querySelector('.poster img, .cover img, [class*="poster"] img')?.getAttribute('src') || '';

      const synopsis = cleanText(
        doc.querySelector('.synopsis, [class*="synopsis"], [class*="description"], .resume')?.textContent || ''
      );

      const genreEls = doc.querySelectorAll('[class*="genre"] a, [class*="tag"] a, .genres a');
      const genres = Array.from(genreEls).map(el => cleanText(el.textContent)).filter(Boolean);

      const yearEl = doc.querySelector('[class*="year"], [class*="annee"], time');
      const yearText = yearEl?.textContent || '';
      const yearMatch = yearText.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      // Chercher les saisons — anime-sama organise généralement par saison
      const seasons = [];
      const seasonEls = doc.querySelectorAll('[id^="saison"], [class*="saison"], [href*="saison"]');

      if (seasonEls.length > 0) {
        for (let i = 0; i < Math.min(seasonEls.length, 10); i++) {
          const el = seasonEls[i];
          const seasonNum = i + 1;
          const seasonUrl = resolveUrl(url, el.getAttribute('href') || el.getAttribute('data-url') || '');
          seasons.push({
            number: seasonNum,
            title: `Saison ${seasonNum}`,
            episodes: [],
            url: seasonUrl || url,
          });
        }
      }

      // Si pas de saisons trouvées, chercher épisodes directement
      if (seasons.length === 0) {
        const epEls = doc.querySelectorAll('[class*="episode"] a, [class*="eps"] a, a[href*="episode"]');
        const episodes = [];
        epEls.forEach((el, idx) => {
          const epUrl = resolveUrl(url, el.getAttribute('href'));
          const epTitle = cleanText(el.textContent) || `Épisode ${idx + 1}`;
          if (epUrl) {
            episodes.push({ number: idx + 1, title: epTitle, duration: '', url: epUrl });
          }
        });

        if (episodes.length > 0) {
          seasons.push({ number: 1, title: 'Saison 1', episodes, url });
        } else {
          // Créer une saison par défaut
          seasons.push({ number: 1, title: 'Saison 1', episodes: [], url });
        }
      }

      return { title, poster: resolveUrl(url, poster), synopsis, genres, year, seasons };
    } catch (err) {
      console.warn('[Scraper] AnimeSama detail error:', err.message);
      return { title: '', poster: '', synopsis: '', genres: [], year: null, seasons: [] };
    }
  }

  async function _getEpisodesAnimeSama(seasonUrl) {
    try {
      const html = await fetchWithProxy(seasonUrl);
      const doc = parseHTML(html);
      const episodes = [];

      // Episodes souvent dans des scripts JS (eps = [...])
      const scripts = doc.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        // Chercher tableau d'épisodes
        const epsMatch = content.match(/(?:var\s+eps\s*=\s*|eps\s*=\s*)(\[[\s\S]*?\]);/);
        if (epsMatch) {
          try {
            const epsArr = JSON.parse(epsMatch[1]);
            epsArr.forEach((ep, idx) => {
              const epUrl = typeof ep === 'string' ? ep : ep.url || ep.link || '';
              episodes.push({
                number: idx + 1,
                title: `Épisode ${idx + 1}`,
                duration: '',
                url: resolveUrl(seasonUrl, epUrl),
              });
            });
            if (episodes.length > 0) return episodes;
          } catch {}
        }

        // Chercher lecteur direct
        const urlsMatch = content.match(/['"](?:https?:\/\/[^'"]+\.(?:mp4|m3u8|mkv)[^'"]*)['"]/g);
        if (urlsMatch && urlsMatch.length > 0) {
          urlsMatch.forEach((match, idx) => {
            const videoUrl = match.replace(/['"]/g, '');
            episodes.push({
              number: idx + 1,
              title: `Épisode ${idx + 1}`,
              duration: '',
              url: videoUrl,
              directStream: true,
            });
          });
          if (episodes.length > 0) return episodes;
        }
      }

      // Fallback : chercher liens dans la page
      const epLinks = doc.querySelectorAll('a[href*="episode"], a[href*="ep-"], [class*="episode"] a');
      epLinks.forEach((el, idx) => {
        const href = resolveUrl(seasonUrl, el.getAttribute('href'));
        if (href) {
          episodes.push({
            number: idx + 1,
            title: cleanText(el.textContent) || `Épisode ${idx + 1}`,
            duration: '',
            url: href,
          });
        }
      });

      return episodes;
    } catch (err) {
      console.warn('[Scraper] AnimeSama episodes error:', err.message);
      return [];
    }
  }

  async function _getStreamLinksAnimeSama(episodeUrl) {
    try {
      const html = await fetchWithProxy(episodeUrl);
      const doc = parseHTML(html);
      const links = [];

      // Chercher iframes lecteur
      const iframes = doc.querySelectorAll('iframe[src]');
      iframes.forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (src && (src.includes('video') || src.includes('player') || src.includes('embed'))) {
          links.push({ type: 'iframe', url: resolveUrl(episodeUrl, src), quality: 'auto', label: 'Lecteur' });
        }
      });

      // Chercher liens mp4/m3u8 dans les scripts
      const scripts = doc.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        const mp4Matches = content.match(/['"]([^'"]*\.(?:mp4|m3u8|mkv)[^'"]*)['"]/g);
        if (mp4Matches) {
          mp4Matches.forEach(match => {
            const url = match.replace(/['"]/g, '');
            if (url.startsWith('http')) {
              const quality = url.includes('1080') ? '1080p' : url.includes('720') ? '720p' : url.includes('480') ? '480p' : 'auto';
              links.push({ type: 'direct', url, quality, label: quality });
            }
          });
        }
      }

      // Chercher source tags
      const sources = doc.querySelectorAll('source[src]');
      sources.forEach(src => {
        const url = src.getAttribute('src');
        if (url) {
          const quality = url.includes('1080') ? '1080p' : url.includes('720') ? '720p' : 'auto';
          links.push({ type: 'direct', url: resolveUrl(episodeUrl, url), quality, label: quality });
        }
      });

      return links;
    } catch (err) {
      console.warn('[Scraper] AnimeSama stream error:', err.message);
      return [];
    }
  }

  // ======================================================
  // VOIRANIMES
  // ======================================================

  async function _searchVoirAnimes(query) {
    const base = await resolveVoirAnimeDomain();
    const apiUrl = `${base}/api/search?q=${encodeURIComponent(query)}`;
    const htmlUrl = `${base}/?s=${encodeURIComponent(query)}`;
    const fallbackListUrl = `${base}/anime-listings?search=${encodeURIComponent(query)}`;

    try {
      // Tentative API JSON
      try {
        const jsonText = await fetchWithProxy(apiUrl);
        const data = JSON.parse(jsonText);
        const list = data.data || data.results || data || [];
        if (Array.isArray(list) && list.length > 0) {
          return list.map(item => ({
            id: `voiranimes_${item.id || item.slug || Math.random().toString(36).slice(2)}`,
            title: item.title || item.name || item.titre || '',
            year: item.year || item.annee || null,
            genres: (item.genres || item.tags || []).map(g => typeof g === 'string' ? g : g.name || ''),
            poster: item.poster || item.image || item.thumbnail || '',
            synopsis: item.synopsis || item.description || '',
            type: (item.type || '').toLowerCase() === 'film' ? 'film' : 'serie',
            seasons: [],
            source: SOURCES.VOIRANIMES,
            url: item.url || `${base}/anime/${item.slug || item.id}`,
          }));
        }
      } catch {}

      // Fallback HTML avec sélecteurs universels
      let html = '';
      try {
        html = await fetchWithProxy(htmlUrl);
      } catch {
        html = await fetchWithProxy(fallbackListUrl);
      }

      const doc = parseHTML(html);
      const results = [];

      const cards = doc.querySelectorAll('.anime-card, .item-anime, article[class*="anime"], .card, .post, .bsx, .film-detail');
      cards.forEach(card => {
        try {
          const link = card.querySelector('a');
          const href = link ? resolveUrl(base, link.getAttribute('href')) : '';
          const titleEl = card.querySelector('h1, h2, h3, .title, .name, [class*="title"], .tt') ||
                          card.querySelector('a[title]');
          const title = titleEl ? cleanText(titleEl.getAttribute('title') || titleEl.textContent) : '';
          if (!title || !href) return;

          const img = card.querySelector('img');
          const poster = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';

          const id = `voiranimes_${href.split('/').filter(Boolean).pop()}`;
          results.push({
            id, title, year: null, genres: [],
            poster: resolveUrl(base, poster),
            synopsis: '', type: 'serie', seasons: [],
            source: SOURCES.VOIRANIMES, url: href,
          });
        } catch {}
      });

      return results;
    } catch (err) {
      console.warn('[Scraper] VoirAnimes search error:', err.message);
      return [];
    }
  }

  async function _getDetailVoirAnimes(url) {
    try {
      const html = await fetchWithProxy(url);
      const doc = parseHTML(html);

      const title = cleanText(
        doc.querySelector('h1[class*="title"], h1.title, h1')?.textContent ||
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
      );
      const poster = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                     doc.querySelector('[class*="poster"] img, .cover img')?.getAttribute('src') || '';
      const synopsis = cleanText(
        doc.querySelector('[class*="synopsis"], [class*="description"], .resume, .plot')?.textContent || ''
      );
      const genreEls = doc.querySelectorAll('[class*="genre"] a, .tags a, [class*="tag"] a');
      const genres = Array.from(genreEls).map(el => cleanText(el.textContent)).filter(Boolean);

      const yearMatch = (doc.querySelector('[class*="year"], [class*="annee"]')?.textContent || '').match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      // Episodes
      const epEls = doc.querySelectorAll('[class*="episode"] a, .eps a, a[href*="episode"]');
      const episodes = [];
      epEls.forEach((el, idx) => {
        const epUrl = resolveUrl(url, el.getAttribute('href'));
        if (epUrl) {
          episodes.push({ number: idx + 1, title: cleanText(el.textContent) || `Épisode ${idx + 1}`, duration: '', url: epUrl });
        }
      });

      const seasons = episodes.length > 0
        ? [{ number: 1, title: 'Saison 1', episodes, url }]
        : [{ number: 1, title: 'Saison 1', episodes: [], url }];

      return { title, poster: resolveUrl(url, poster), synopsis, genres, year, seasons };
    } catch (err) {
      console.warn('[Scraper] VoirAnimes detail error:', err.message);
      return { title: '', poster: '', synopsis: '', genres: [], year: null, seasons: [] };
    }
  }

  async function _getStreamLinksVoirAnimes(episodeUrl) {
    try {
      const html = await fetchWithProxy(episodeUrl);
      const doc = parseHTML(html);
      const links = [];

      doc.querySelectorAll('iframe[src]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (src) links.push({ type: 'iframe', url: resolveUrl(episodeUrl, src), quality: 'auto', label: 'Lecteur' });
      });

      doc.querySelectorAll('script').forEach(script => {
        const content = script.textContent;
        const matches = content.match(/['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/g);
        if (matches) {
          matches.forEach(m => {
            const url = m.replace(/['"]/g, '');
            if (url.startsWith('http')) {
              links.push({ type: 'direct', url, quality: 'auto', label: 'Stream' });
            }
          });
        }
      });

      return links;
    } catch (err) {
      console.warn('[Scraper] VoirAnimes stream error:', err.message);
      return [];
    }
  }

  // ======================================================
  // 2ANIME.XYZ
  // ======================================================

  async function _search2Anime(query) {
    const url = `https://2anime.xyz/?s=${encodeURIComponent(query)}`;
    try {
      const html = await fetchWithProxy(url);
      const doc = parseHTML(html);
      const results = [];

      // WordPress-based site
      const cards = doc.querySelectorAll('article, .item, .animearch, [class*="anime"], .post');
      cards.forEach(card => {
        try {
          const link = card.querySelector('a');
          const href = link ? resolveUrl('https://2anime.xyz', link.getAttribute('href')) : '';
          const titleEl = card.querySelector('h2, h3, .title, [class*="title"]') ||
                          card.querySelector('a[title]');
          const title = titleEl ? cleanText(titleEl.getAttribute('title') || titleEl.textContent) : '';
          if (!title || !href || href === 'https://2anime.xyz/') return;

          const img = card.querySelector('img');
          const poster = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';

          const id = `2anime_${href.split('/').filter(Boolean).pop()}`;
          results.push({
            id, title, year: null, genres: [],
            poster: resolveUrl('https://2anime.xyz', poster),
            synopsis: '', type: 'serie', seasons: [],
            source: SOURCES.ANIME2, url: href,
          });
        } catch {}
      });

      return results;
    } catch (err) {
      console.warn('[Scraper] 2Anime search error:', err.message);
      return [];
    }
  }

  async function _getDetail2Anime(url) {
    try {
      const html = await fetchWithProxy(url);
      const doc = parseHTML(html);

      const title = cleanText(
        doc.querySelector('h1[class*="title"], h1.entry-title, h1, .title')?.textContent ||
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
      );
      const poster = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                     doc.querySelector('.poster img, .thumb img, .cover img')?.getAttribute('src') || '';
      const synopsis = cleanText(
        doc.querySelector('[class*="synopsis"], [class*="description"], .entry-content p, .resume')?.textContent || ''
      );
      const genreEls = doc.querySelectorAll('[class*="genre"] a, .tags a, .cat a');
      const genres = Array.from(genreEls).map(el => cleanText(el.textContent)).filter(Boolean);

      const yearEl = doc.querySelector('[class*="year"], time[datetime]');
      const yearMatch = (yearEl?.getAttribute('datetime') || yearEl?.textContent || '').match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      // Episodes list
      const epEls = doc.querySelectorAll('.episodelist a, [class*="episode"] a, a[href*="episode"]');
      const episodes = [];
      epEls.forEach((el, idx) => {
        const epUrl = resolveUrl(url, el.getAttribute('href'));
        const epTitle = cleanText(el.textContent) || `Épisode ${idx + 1}`;
        if (epUrl && !episodes.find(e => e.url === epUrl)) {
          episodes.push({ number: idx + 1, title: epTitle, duration: '', url: epUrl });
        }
      });

      // Trier par numéro
      episodes.sort((a, b) => a.number - b.number);

      const seasons = episodes.length > 0
        ? [{ number: 1, title: 'Saison 1', episodes, url }]
        : [{ number: 1, title: 'Saison 1', episodes: [], url }];

      return { title, poster: resolveUrl(url, poster), synopsis, genres, year, seasons };
    } catch (err) {
      console.warn('[Scraper] 2Anime detail error:', err.message);
      return { title: '', poster: '', synopsis: '', genres: [], year: null, seasons: [] };
    }
  }

  async function _getStreamLinks2Anime(episodeUrl) {
    try {
      const html = await fetchWithProxy(episodeUrl);
      const doc = parseHTML(html);
      const links = [];

      doc.querySelectorAll('iframe[src], iframe[data-src]').forEach(iframe => {
        const src = iframe.getAttribute('src') || iframe.getAttribute('data-src');
        if (src) links.push({ type: 'iframe', url: resolveUrl(episodeUrl, src), quality: 'auto', label: 'Lecteur' });
      });

      doc.querySelectorAll('video source[src], video[src]').forEach(el => {
        const src = el.getAttribute('src');
        if (src) links.push({ type: 'direct', url: resolveUrl(episodeUrl, src), quality: 'auto', label: 'Direct' });
      });

      doc.querySelectorAll('script').forEach(script => {
        const content = script.textContent;
        const matches = content.match(/(?:file|src|source)\s*[:=]\s*['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/g);
        if (matches) {
          matches.forEach(m => {
            const urlMatch = m.match(/['"]([^'"]+)['"]/);
            if (urlMatch && urlMatch[1].startsWith('http')) {
              links.push({ type: 'direct', url: urlMatch[1], quality: 'auto', label: 'Stream' });
            }
          });
        }
      });

      return links;
    } catch (err) {
      console.warn('[Scraper] 2Anime stream error:', err.message);
      return [];
    }
  }

  // ======================================================
  // API PUBLIQUE
  // ======================================================

  /**
   * Fusionne et déduplique les résultats de plusieurs sources
   */
  function _mergeResults(arrays) {
    const all = arrays.flat();
    const seen = new Set();
    return all.filter(item => {
      if (!item.title) return false;
      const key = item.title.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Recherche sur toutes les sources et merge les résultats
   * @param {string} query
   * @param {string} [preferredSource] 'animesama'|'voiranimes'|'2anime'|'auto'
   * @returns {Promise<Array>}
   */
  async function search(query, preferredSource = 'auto') {
    if (!query || query.trim().length < 2) return [];

    const sources = preferredSource === 'auto'
      ? [SOURCES.ANIMESAMA, SOURCES.VOIRANIMES, SOURCES.ANIME2]
      : [preferredSource];

    const promises = sources.map(source => {
      switch (source) {
        case SOURCES.ANIMESAMA: return _searchAnimeSama(query);
        case SOURCES.VOIRANIMES: return _searchVoirAnimes(query);
        case SOURCES.ANIME2: return _search2Anime(query);
        default: return Promise.resolve([]);
      }
    });

    const results = await Promise.allSettled(promises);
    const arrays = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    return _mergeResults(arrays);
  }

  /**
   * Récupère les détails d'un anime (saisons + épisodes)
   * @param {string} animeUrl
   * @param {string} source
   * @returns {Promise<object>}
   */
  async function getAnimeDetail(animeUrl, source) {
    switch (source) {
      case SOURCES.ANIMESAMA: return _getDetailAnimeSama(animeUrl);
      case SOURCES.VOIRANIMES: return _getDetailVoirAnimes(animeUrl);
      case SOURCES.ANIME2: return _getDetail2Anime(animeUrl);
      default: return _getDetailAnimeSama(animeUrl);
    }
  }

  /**
   * Récupère les épisodes d'une saison
   * @param {string} seasonUrl
   * @param {string} source
   * @returns {Promise<Array>}
   */
  async function getSeasonEpisodes(seasonUrl, source) {
    switch (source) {
      case SOURCES.ANIMESAMA: return _getEpisodesAnimeSama(seasonUrl);
      default: return [];
    }
  }

  /**
   * Récupère les liens de stream d'un épisode
   * @param {string} episodeUrl
   * @param {string} source
   * @returns {Promise<Array>} [{type, url, quality, label}]
   */
  async function getStreamLinks(episodeUrl, source) {
    switch (source) {
      case SOURCES.ANIMESAMA: return _getStreamLinksAnimeSama(episodeUrl);
      case SOURCES.VOIRANIMES: return _getStreamLinksVoirAnimes(episodeUrl);
      case SOURCES.ANIME2: return _getStreamLinks2Anime(episodeUrl);
      default: return _getStreamLinksAnimeSama(episodeUrl);
    }
  }

  /**
   * Filtre les liens par qualité préférée
   * @param {Array} links
   * @param {string} preferredQuality '360p'|'480p'|'720p'|'1080p'|'auto'
   */
  function filterLinksByQuality(links, preferredQuality = 'auto') {
    if (preferredQuality === 'auto' || links.length === 0) return links;

    const ordered = ['1080p', '720p', '480p', '360p'];
    const targetIdx = ordered.indexOf(preferredQuality);

    // Chercher la qualité exacte d'abord
    const exact = links.filter(l => l.quality === preferredQuality);
    if (exact.length > 0) return exact;

    // Sinon chercher la qualité la plus proche
    for (let i = targetIdx; i < ordered.length; i++) {
      const q = links.filter(l => l.quality === ordered[i]);
      if (q.length > 0) return q;
    }

    return links;
  }

  return {
    search,
    getAnimeDetail,
    getSeasonEpisodes,
    getStreamLinks,
    filterLinksByQuality,
    SOURCES,
    // Exposer internals pour debug
    _searchAnimeSama,
    _searchVoirAnimes,
    _search2Anime,
  };
})();
