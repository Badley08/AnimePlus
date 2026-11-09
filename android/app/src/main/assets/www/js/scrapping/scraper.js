/**
 * scraper.js — Service de Scraping Réel & Robuste pour AnimePlus
 * Sources :
 * 1. Anime-Sama : https://anime-sama.to/
 *    - Recherche API : /catalogue/fragment.php?search={query} (renvoie JSON {"liste": "...", "total": X})
 *    - Fiche œuvre : /catalogue/{slug}/ (titre, alters, synopsis, fond, affiche, panneauAnime)
 *    - Épisodes : /{saison}/{langue}/episodes.js (tableaux réels eps1, eps2, eps3...)
 * 2. VoirAnime : https://voiranime.be/
 *    - Recherche API : POST /wp-admin/admin-ajax.php (action=ts_ac_do_search&ts_ac_query={query})
 *    - Fiche série : /series/{slug}/ (synopsis, affiche, .eplister pour les épisodes)
 *    - Lecteur : /episode/ (extraction iframes embed vkspeed, uqload, etc.)
 */

const ScraperService = (() => {

  const CORS_KEY = 'ec30d025';

  function isNativeAndroid() {
    return typeof window.Android !== 'undefined' && typeof window.Android.httpGet === 'function';
  }

  // Wrapper d'appel réseau natif Android via OkHttp
  function nativeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const callbackId = 'cb_' + Math.random().toString(36).substring(2, 9);

      if (!window._nativeHttpCallbacks) window._nativeHttpCallbacks = {};
      window._nativeHttpCallbacks[callbackId] = { resolve, reject };

      if (!window.onNativeHttpSuccess) {
        window.onNativeHttpSuccess = (cbId, data) => {
          if (window._nativeHttpCallbacks && window._nativeHttpCallbacks[cbId]) {
            window._nativeHttpCallbacks[cbId].resolve(data);
            delete window._nativeHttpCallbacks[cbId];
          }
        };
      }
      if (!window.onNativeHttpError) {
        window.onNativeHttpError = (cbId, error) => {
          if (window._nativeHttpCallbacks && window._nativeHttpCallbacks[cbId]) {
            window._nativeHttpCallbacks[cbId].reject(new Error(error));
            delete window._nativeHttpCallbacks[cbId];
          }
        };
      }

      try {
        if (options.method === 'POST') {
          const bodyStr = options.body || '';
          const cType = (options.headers && options.headers['Content-Type']) || 'application/x-www-form-urlencoded';
          window.Android.httpPost(url, bodyStr, cType, callbackId);
        } else {
          window.Android.httpGet(url, callbackId);
        }
      } catch (e) {
        delete window._nativeHttpCallbacks[callbackId];
        reject(e);
      }
    });
  }

  /**
   * Effectue une requête réseau réelle avec gestion CORS transparente
   * Priorité :
   * 1. Android Natif (OkHttp sécurisé sans proxy, bypass Cloudflare/Referer)
   * 2. Serveur Python local AnimePlus (/proxy?url=...)
   * 3. cors.lol (https://api.cors.lol/?url=...)
   * 4. corsproxy.io avec clé API
   * 5. allorigins & codetabs
   */
  async function request(url, options = {}) {
    const isNative = isNativeAndroid();
    console.log(`[Scraper] Request: ${url} (Native: ${isNative})`);

    // 1. Android Natif : OkHttp interne ultra-rapide avec injection automatique des Referers
    if (isNative) {
      try {
        return await nativeHttpRequest(url, options);
      } catch (err) {
        console.warn(`[Scraper] Native OkHttp failed for ${url}, fallback to web proxies:`, err);
      }
    }

    // 2. Proxies Web avec priorités
    const proxies = [
      `http://127.0.0.1:8888/proxy?url=${encodeURIComponent(url)}`, // Serveur proxy embarqué dans l'APK
      `/proxy?url=${encodeURIComponent(url)}`, // Serveur proxy local de dev (server.py)
      `https://api.cors.lol/?url=${encodeURIComponent(url)}`, // Proxy cors.lol
      `https://corsproxy.io/?key=${CORS_KEY}&url=${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    let lastError = null;
    for (const proxyUrl of proxies) {
      try {
        console.log(`[Scraper] Via Proxy: ${proxyUrl.split('?')[0]}...`);

        const fetchOpts = {
          headers: {
            'Accept': options.headers && options.headers['Accept'] ? options.headers['Accept'] : '*/*',
            ...(options.headers || {})
          }
        };

        if (options.method === 'POST') {
          fetchOpts.method = 'POST';
          fetchOpts.body = options.body;
        }

        const res = await fetch(proxyUrl, fetchOpts);
        if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
        const text = await res.text();
        if (text && text.length > 5 && !text.includes('Rate limit exceeded') && !text.includes('Attention Required! | Cloudflare')) {
          return text;
        }
      } catch (err) {
        console.warn(`[Scraper] Proxy ${proxyUrl.split('?')[0]} a échoué:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error(`Impossible de contacter ${url}`);
  }

  function parseHTML(str) {
    const parser = new DOMParser();
    return parser.parseFromString(str, 'text/html');
  }

  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  // ==========================================
  // 1. RECHERCHE EN DIRECT
  // ==========================================
  async function search(query) {
    const q = (query || '').trim();
    if (!q) return [];
    console.log(`[Scraper] Recherche globale: "${q}"`);

    const results = [];
    const errors = [];

    // Recherche 1 : Anime-Sama (API fragment.php réelle)
    try {
      const asResults = await searchAnimeSama(q);
      results.push(...asResults);
      console.log(`[Scraper] Anime-Sama: ${asResults.length} animes trouvés`);
    } catch (err) {
      console.error('[Scraper] Erreur Anime-Sama:', err);
      errors.push({ src: 'Anime-Sama', error: err.message });
    }

    // Recherche 2 : VoirAnime (API ts_ac_do_search réelle + fallback)
    try {
      const vaResults = await searchVoirAnime(q);
      results.push(...vaResults);
      console.log(`[Scraper] VoirAnime: ${vaResults.length} animes trouvés`);
    } catch (err) {
      console.error('[Scraper] Erreur VoirAnime:', err);
      errors.push({ src: 'VoirAnime', error: err.message });
    }

    console.log(`[Scraper] Total combiné: ${results.length} résultats`);
    return results;
  }

  // --- Recherche Anime-Sama via fragment.php ---
  async function searchAnimeSama(query) {
    const url = `https://anime-sama.to/catalogue/fragment.php?search=${encodeURIComponent(query)}`;
    const raw = await request(url, {
      headers: { 'Accept': 'application/json' }
    });

    const items = [];
    try {
      const data = JSON.parse(raw);
      if (data && data.liste) {
        const doc = parseHTML(data.liste);
        const cards = doc.querySelectorAll('.as-carte, .cardListAnime');

        cards.forEach(card => {
          try {
            const nom = card.getAttribute('data-nom') ||
                        clean(card.querySelector('.as-carte-titre, h3, h2')?.textContent);
            let urlPath = card.getAttribute('data-url') ||
                          card.querySelector('a')?.getAttribute('href') || '';
            const imgUrl = card.getAttribute('data-img') ||
                           card.querySelector('img')?.getAttribute('src') || '';

            if (!nom) return;
            if (!urlPath.startsWith('http')) {
              urlPath = `https://anime-sama.to${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
            }

            const badges = [];
            card.querySelectorAll('.as-badge, .type-badge').forEach(b => badges.push(clean(b.textContent)));
            if (card.querySelector('img[src*="flag_fr"]')) badges.push('VF');
            if (card.querySelector('img[src*="flag_jp"]')) badges.push('VOSTFR');

            items.push({
              id: `as_${urlPath.split('/').filter(Boolean).pop() || Math.random().toString(36).slice(2)}`,
              title: nom,
              poster: imgUrl,
              url: urlPath,
              source: 'animesama',
              type: badges.includes('Film') ? 'film' : 'serie',
              badges: badges
            });
          } catch (e) {
            console.warn('[Scraper] Erreur parsing carte AS:', e);
          }
        });
      }
    } catch (e) {
      console.warn('[Scraper] JSON parse error AnimeSama fragment:', e);
    }

    return items;
  }

  // --- Recherche VoirAnime via admin-ajax.php / HTML ---
  async function searchVoirAnime(query) {
    const items = [];

    // Tentative 1 : API Ajax de recherche en direct (WordPress DramaStream)
    try {
      const ajaxUrl = `https://voiranime.be/wp-admin/admin-ajax.php`;
      const body = `action=ts_ac_do_search&ts_ac_query=${encodeURIComponent(query)}`;
      const raw = await request(ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      const json = JSON.parse(raw);
      if (json && json.series && json.series[0] && Array.isArray(json.series[0].all)) {
        json.series[0].all.forEach(item => {
          if (!item.post_title || !item.post_link) return;
          const badges = ['VOSTFR'];
          if (item.post_sub) badges.push(item.post_sub);
          if (item.post_latest) badges.push(`Ep ${item.post_latest}`);

          items.push({
            id: `va_${item.ID || item.post_link.split('/').filter(Boolean).pop()}`,
            title: clean(item.post_title),
            poster: item.post_image || '',
            url: item.post_link,
            source: 'voiranime',
            type: (item.post_type || '').toLowerCase() === 'movie' ? 'film' : 'serie',
            badges: badges,
            genres: (item.post_genres || '').split(',').map(s => s.trim()).filter(Boolean)
          });
        });
      }
    } catch (e) {
      console.warn('[Scraper] VoirAnime live ajax search failed, trying HTML fallback:', e.message);
    }

    // Tentative 2 : Recherche classique HTML si l'AJAX n'a rien renvoyé
    if (items.length === 0) {
      try {
        const htmlUrl = `https://voiranime.be/?s=${encodeURIComponent(query)}`;
        const html = await request(htmlUrl);
        const doc = parseHTML(html);

        doc.querySelectorAll('article.bs .bsx, .film-detail').forEach(card => {
          const link = card.querySelector('a');
          if (!link) return;
          const href = link.getAttribute('href');
          const title = clean(card.querySelector('.tt, h2')?.textContent || link.getAttribute('title'));
          const img = card.querySelector('img')?.getAttribute('src') || '';
          if (title && href) {
            items.push({
              id: `va_${href.split('/').filter(Boolean).pop()}`,
              title: title,
              poster: img,
              url: href,
              source: 'voiranime',
              type: 'serie',
              badges: ['VOSTFR']
            });
          }
        });
      } catch (e) {
        console.warn('[Scraper] VoirAnime HTML search error:', e.message);
      }
    }

    return items;
  }

  // ==========================================
  // 2. EXTRACTION COMPLÈTE DE LA FICHE ANIME
  //    (Style exact Anime-Sama / Boruto)
  // ==========================================
  async function getAnimeDetail(animeUrl, source) {
    console.log(`[Scraper] getAnimeDetail: ${animeUrl} (Source: ${source})`);

    if (!animeUrl || typeof animeUrl !== 'string') {
      console.warn('[Scraper] URL invalide ou manquante pour getAnimeDetail:', animeUrl);
      throw new Error("L'URL de l'anime est invalide ou manquante.");
    }

    if (source === 'animesama' || animeUrl.includes('anime-sama')) {
      return await getDetailAnimeSama(animeUrl);
    } else {
      return await getDetailVoirAnime(animeUrl);
    }
  }

  // --- Fiche Réelle Anime-Sama (Boruto, Bleach, etc.) ---
  async function getDetailAnimeSama(url) {
    const html = await request(url);
    const doc = parseHTML(html);

    // Titres
    const title = clean(doc.querySelector('#titreOeuvre, .oe-titre, h1')?.textContent) || 'Anime';
    const alters = clean(doc.querySelector('#titreAlter, .oe-alters')?.textContent) || '';

    // Synopsis
    const synopsis = clean(doc.querySelector('#synopsisText, .oe-synopsis p')?.textContent) ||
                     clean(doc.querySelector('.oe-corps p')?.textContent) || '';

    // Images : bannière fond hero + affiche
    const heroBg = doc.querySelector('.oe-fond img')?.getAttribute('src') ||
                   doc.querySelector('#imgOeuvre')?.getAttribute('src') || '';
    const poster = doc.querySelector('.oe-affiche img')?.getAttribute('src') || heroBg;

    // Métadonnées (Année · Format · Studio · Statut)
    const meta = clean(doc.querySelector('.oe-meta')?.textContent) || '';

    // Notes
    const noteText = clean(doc.querySelector('.oe-note b')?.textContent) || '7.5';

    // Genres réels
    const genres = [];
    doc.querySelectorAll('.oe-genres a, .genre-pill').forEach(a => {
      const g = clean(a.textContent);
      if (g) genres.push(g);
    });

    // Détection des saisons réelles via panneauAnime("Nom Saison", "url_relative")
    const seasons = [];
    const regexPanneau = /panneauAnime\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
    let match;
    const foundPanels = [];

    while ((match = regexPanneau.exec(html)) !== null) {
      foundPanels.push({ name: match[1], path: match[2] });
    }

    console.log(`[Scraper] Panneaux de saisons détectés sur Anime-Sama:`, foundPanels);

    const baseNorm = url.endsWith('/') ? url : `${url}/`;

    if (foundPanels.length > 0) {
      for (let i = 0; i < foundPanels.length; i++) {
        const p = foundPanels[i];
        const seasonFullUrl = new URL(p.path.replace(/^\//, ''), baseNorm).href;
        const normalizedUrl = seasonFullUrl.endsWith('/') ? seasonFullUrl : `${seasonFullUrl}/`;

        const isVf = p.path.toLowerCase().includes('vf');
        const isVostfr = p.path.toLowerCase().includes('vostfr');
        const langBadge = isVf ? 'VF' : (isVostfr ? 'VOSTFR' : '');

        seasons.push({
          number: i + 1,
          title: p.name,
          lang: langBadge,
          url: normalizedUrl,
          episodes: [] // Chargés à la demande pour performance maximale
        });
      }
    } else {
      // Si la page est déjà une saison finale (ex: /saison2-4/vf/)
      seasons.push({
        number: 1,
        title: "Épisodes",
        lang: url.includes('/vf') ? 'VF' : 'VOSTFR',
        url: baseNorm,
        episodes: []
      });
    }

    return {
      title,
      alters,
      synopsis,
      heroBg,
      poster,
      meta,
      note: noteText,
      genres,
      source: 'animesama',
      url: url,
      seasons
    };
  }

  // --- Chargement des épisodes réels d'une saison Anime-Sama via episodes.js ---
  async function getSeasonEpisodesAnimeSama(seasonUrl) {
    if (!seasonUrl) return [];
    const normUrl = seasonUrl.endsWith('/') ? seasonUrl : `${seasonUrl}/`;
    console.log(`[Scraper] Chargement des flux réels: ${normUrl}`);

    try {
      // 1. Tenter d'abord de charger la page HTML pour récupérer le filever ou eps1 directement
      let filever = '';
      try {
        const pageHtml = await request(normUrl);
        const fvMatch = pageHtml.match(/episodes\.js\?filever=([a-zA-Z0-9]+)/);
        if (fvMatch) filever = fvMatch[1];

        const directEps = parseEpisodesFromScript(pageHtml);
        if (directEps && directEps.length > 0) {
          console.log(`[Scraper] ${directEps.length} épisodes trouvés directement dans la page`);
          return directEps;
        }
      } catch (pageErr) {
        console.warn(`[Scraper] Info page saison: ${pageErr.message}`);
      }

      // 2. Charger le fichier episodes.js
      const jsUrl = filever ? `${normUrl}episodes.js?filever=${filever}` : `${normUrl}episodes.js`;
      console.log(`[Scraper] Fetch episodes.js: ${jsUrl}`);
      const js = await request(jsUrl);
      const episodes = parseEpisodesFromScript(js);

      console.log(`[Scraper] ${episodes.length} épisodes réels chargés depuis Anime-Sama`);
      return episodes;
    } catch (err) {
      console.error(`[Scraper] Erreur lecture episodes.js sur ${seasonUrl}:`, err);
      return [];
    }
  }

  function parseEpisodesFromScript(scriptContent) {
    if (!scriptContent) return [];
    const episodes = [];

    // Analyse des tableaux eps1, eps2, eps3...
    const eps1Match = scriptContent.match(/var\s+eps1\s*=\s*\[([\s\S]*?)\];/);
    const eps2Match = scriptContent.match(/var\s+eps2\s*=\s*\[([\s\S]*?)\];/);
    const eps3Match = scriptContent.match(/var\s+eps3\s*=\s*\[([\s\S]*?)\];/);

    const targetArray = eps1Match ? eps1Match[1] : (eps2Match ? eps2Match[1] : (eps3Match ? eps3Match[1] : ''));
    if (targetArray) {
      const urls = targetArray.match(/['"]([^'"]+)['"]/g) || [];
      urls.forEach((u, idx) => {
        const rawUrl = u.replace(/['"]/g, '').trim();
        if (rawUrl) {
          episodes.push({
            number: idx + 1,
            title: `Épisode ${idx + 1}`,
            streamUrl: rawUrl,
            duration: '24 min'
          });
        }
      });
    }
    return episodes;
  }

  // --- Fiche Réelle VoirAnime (ex: Bleach, Akame ga Kill) ---
  async function getDetailVoirAnime(url) {
    const html = await request(url);
    const doc = parseHTML(html);

    const title = clean(doc.querySelector('h1.entry-title, h1[itemprop="name"], h1')?.textContent) || 'Anime';
    const synopsis = clean(doc.querySelector('.entry-content p, .synopsis p')?.textContent) || '';
    const poster = doc.querySelector('.thumb img, [itemprop="image"]')?.getAttribute('src') || '';
    const meta = clean(doc.querySelector('.spe, .info-content')?.textContent) || 'VOSTFR';

    const episodes = [];
    const epLinks = doc.querySelectorAll('.eplister ul li a, ul.episodelst li a');

    epLinks.forEach((el, idx) => {
      const epUrl = el.getAttribute('href');
      const epNumEl = el.querySelector('.epl-num');
      const epTitleEl = el.querySelector('.epl-title');
      const epNum = epNumEl ? clean(epNumEl.textContent) : (idx + 1);
      const epTitle = epTitleEl ? clean(epTitleEl.textContent) : `Épisode ${epNum}`;

      if (epUrl) {
        episodes.push({
          number: parseInt(epNum, 10) || (idx + 1),
          title: epTitle,
          streamUrl: epUrl,
          duration: '24 min'
        });
      }
    });

    if (episodes.length > 1 && episodes[0].number > episodes[episodes.length - 1].number) {
      episodes.reverse();
    }

    console.log(`[Scraper] VoirAnime: ${episodes.length} épisodes détectés`);

    return {
      title,
      alters: '',
      synopsis,
      heroBg: poster,
      poster,
      meta,
      note: '7.8',
      genres: ['VOSTFR', 'Anime'],
      source: 'voiranime',
      url,
      seasons: [
        {
          number: 1,
          title: "Épisodes VOSTFR",
          lang: "VOSTFR",
          url: url,
          episodes: episodes
        }
      ]
    };
  }

  // --- Résolution du flux vidéo d'un épisode VoirAnime ---
  async function resolveVoirAnimeStream(episodePageUrl) {
    try {
      console.log(`[Scraper] Résolution iframe VoirAnime: ${episodePageUrl}`);
      const html = await request(episodePageUrl);
      const doc = parseHTML(html);

      const embedIframe = doc.querySelector('.player-embed iframe, #pembed iframe, #embed_holder iframe, iframe[src*="voembed"], iframe[src*="vkspeed"], iframe[src*="uqload"], iframe');
      if (embedIframe) {
        const src = embedIframe.getAttribute('src');
        if (src && !src.includes('ads') && !src.includes('google')) {
          console.log(`[Scraper] Lecteur VoirAnime trouvé: ${src}`);
          return src;
        }
      }

      const regexMatch = html.match(/<iframe[^>]+src=["']([^"']*(?:embed|voembed|vkspeed|uqload)[^"']*)["']/i);
      if (regexMatch && regexMatch[1]) {
        return regexMatch[1];
      }
    } catch (e) {
      console.warn('[Scraper] Erreur extraction iframe VoirAnime:', e);
    }
    return episodePageUrl;
  }

  // ==========================================
  // 3. TENDANCES / POPULAIRES AU DÉMARRAGE (ZÉRO FAKE)
  // ==========================================
  async function getTrending() {
    console.log('[Scraper] Chargement des nouveautés réelles Anime-Sama...');
    try {
      // Charge les animes de la page catalogue principale Anime-Sama
      const url = `https://anime-sama.to/catalogue/fragment.php?type[]=Anime&order=date`;
      const raw = await request(url, { headers: { 'Accept': 'application/json' } });
      const data = JSON.parse(raw);
      if (data && data.liste) {
        const doc = parseHTML(data.liste);
        const list = [];
        doc.querySelectorAll('.as-carte').forEach(c => {
          const nom = c.getAttribute('data-nom') || clean(c.querySelector('.as-carte-titre')?.textContent);
          let u = c.getAttribute('data-url') || c.querySelector('a')?.getAttribute('href') || '';
          const img = c.getAttribute('data-img') || c.querySelector('img')?.getAttribute('src') || '';
          if (nom && u) {
            if (!u.startsWith('http')) u = `https://anime-sama.to${u.startsWith('/') ? '' : '/'}${u}`;
            list.push({
              id: `as_${u.split('/').filter(Boolean).pop()}`,
              title: nom,
              poster: img,
              url: u,
              source: 'animesama',
              type: 'serie'
            });
          }
        });
        if (list.length > 0) return list.slice(0, 10);
      }
    } catch (e) {
      console.warn('[Scraper] Échec chargement tendances AS:', e);
    }

    // Si le fragment avec tri échoue, recherche un set de référence bien réel
    try {
      return await searchAnimeSama('Bleach');
    } catch {
      return [];
    }
  }

  return {
    search,
    getAnimeDetail,
    getSeasonEpisodesAnimeSama,
    resolveVoirAnimeStream,
    getTrending,
    isNativeAndroid
  };

})();

window.ScraperService = ScraperService;
