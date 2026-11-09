/**
 * downloader.js — Service de téléchargement pour AnimePlus
 * Utilise fetch + ReadableStream pour le download progressif
 * WebView Android: interface via JavaBridge
 * Dev web: URL.createObjectURL + <a download>
 */

const DownloaderService = (() => {

  const IS_WEBVIEW = typeof window.AndroidBridge !== 'undefined' || navigator.userAgent.includes('AnimePlusApp');
  const activeDownloads = new Map(); // id -> { controller, callbacks }

  /**
   * Génère un ID unique pour un download
   */
  function _genId(animeId, season, ep) {
    return `dl_${animeId}_s${season}_e${ep}`;
  }

  /**
   * Formate la taille en lisible
   */
  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  /**
   * Nettoie un nom de fichier
   */
  function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0, 100);
  }

  /**
   * Download via fetch avec progression (dev web)
   * @param {string} url - URL du fichier à télécharger
   * @param {string} filename - Nom du fichier
   * @param {function} onProgress - callback(percent, loaded, total)
   * @param {AbortSignal} signal - pour annulation
   * @returns {Promise<Blob>}
   */
  async function _fetchWithProgress(url, filename, onProgress, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      const percent = contentLength > 0 ? Math.round((loaded / contentLength) * 100) : -1;
      onProgress(percent, loaded, contentLength);
    }

    return new Blob(chunks);
  }

  /**
   * Sauvegarde un Blob en fichier (dev web)
   */
  function _saveBlobWeb(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Sauvegarde via bridge Android
   */
  function _saveBlobAndroid(blob, filename, downloadId) {
    // Convertit le Blob en base64 et envoie au bridge Java
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result.split(',')[1];
      if (window.AndroidBridge && window.AndroidBridge.saveFile) {
        window.AndroidBridge.saveFile(filename, base64, downloadId);
      }
    };
    reader.readAsDataURL(blob);
  }

  /**
   * Démarre un téléchargement
   * @param {object} options
   * @param {string} options.url - URL du stream/fichier
   * @param {string} options.animeId
   * @param {string} options.animeTitle
   * @param {number} options.season
   * @param {number} options.ep
   * @param {string} options.epTitle
   * @param {function} options.onProgress - callback(percent, loaded, total)
   * @param {function} options.onComplete - callback(id)
   * @param {function} options.onError - callback(id, error)
   * @returns {string} download ID
   */
  async function startDownload({
    url,
    animeId,
    animeTitle,
    season,
    ep,
    epTitle,
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {},
  }) {
    const id = _genId(animeId, season, ep);
    const filename = sanitizeFilename(`${animeTitle}_S${season}E${ep}_${epTitle}.mp4`);

    // Vérifier si déjà en cours
    if (activeDownloads.has(id)) {
      console.warn('[Downloader] Download already in progress:', id);
      return id;
    }

    const controller = new AbortController();
    activeDownloads.set(id, { controller, callbacks: { onProgress, onComplete, onError } });

    // Enregistrer dans Storage
    Storage.addDownload({
      id,
      animeId,
      animeTitle,
      season,
      ep,
      epTitle,
      url,
      progress: 0,
      status: 'downloading',
      filename,
      size: 0,
    });

    // Lancer en background
    (async () => {
      try {
        const blob = await _fetchWithProgress(
          url,
          filename,
          (percent, loaded, total) => {
            Storage.updateDownload(id, { progress: percent, size: total });
            onProgress(percent, loaded, total);
          },
          controller.signal
        );

        // Sauvegarder le fichier
        if (IS_WEBVIEW) {
          _saveBlobAndroid(blob, filename, id);
        } else {
          _saveBlobWeb(blob, filename);
        }

        Storage.updateDownload(id, { progress: 100, status: 'done' });
        activeDownloads.delete(id);
        onComplete(id);
      } catch (err) {
        if (err.name === 'AbortError') {
          Storage.updateDownload(id, { status: 'cancelled' });
          console.info('[Downloader] Cancelled:', id);
        } else {
          console.error('[Downloader] Error:', id, err.message);
          Storage.updateDownload(id, { status: 'error', error: err.message });
          onError(id, err.message);
        }
        activeDownloads.delete(id);
      }
    })();

    return id;
  }

  /**
   * Annule un téléchargement en cours
   */
  function cancelDownload(id) {
    const dl = activeDownloads.get(id);
    if (dl) {
      dl.controller.abort();
      activeDownloads.delete(id);
      Storage.updateDownload(id, { status: 'cancelled', progress: 0 });
      return true;
    }
    return false;
  }

  /**
   * Vérifie si un téléchargement est actif
   */
  function isDownloading(id) {
    return activeDownloads.has(id);
  }

  /**
   * Retourne l'ID pour un episode
   */
  function getDownloadId(animeId, season, ep) {
    return _genId(animeId, season, ep);
  }

  /**
   * Télécharge toute une saison
   */
  async function downloadSeason(anime, seasonNum, episodes, {
    onEpisodeProgress,
    onEpisodeComplete,
    onEpisodeError,
    onAllComplete,
  } = {}) {
    const ids = [];
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      await delay(500); // Petit délai entre les téléchargements
      const id = await startDownload({
        url: ep.url,
        animeId: anime.id,
        animeTitle: anime.title,
        season: seasonNum,
        ep: ep.number,
        epTitle: ep.title,
        onProgress: (percent, loaded, total) => {
          if (onEpisodeProgress) onEpisodeProgress(ep.number, percent, loaded, total);
        },
        onComplete: (id) => {
          if (onEpisodeComplete) onEpisodeComplete(ep.number, id);
        },
        onError: (id, err) => {
          if (onEpisodeError) onEpisodeError(ep.number, id, err);
        },
      });
      ids.push(id);
    }
    return ids;
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Retourne les téléchargements actifs
   */
  function getActiveDownloads() {
    return Array.from(activeDownloads.keys());
  }

  return {
    startDownload,
    cancelDownload,
    isDownloading,
    getDownloadId,
    downloadSeason,
    getActiveDownloads,
    formatSize,
  };
})();
