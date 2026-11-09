/**
 * storage.js — localStorage wrapper pour AnimePlus
 * Gère : historique recherche, progression lecture, bibliothèque, favoris, settings, mdp
 */

const Storage = (() => {

  const KEYS = {
    HISTORY: 'ap_history',
    PROGRESS: 'ap_progress',
    LIBRARY: 'ap_library',
    FAVORITES: 'ap_favorites',
    SETTINGS: 'ap_settings',
    PASSWORD: 'ap_password',
    LAST_WATCH: 'ap_last_watch',
  };

  function _get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch (e) {
      console.warn('[Storage] _get error', key, e);
      return fallback;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[Storage] _set error', key, e);
      return false;
    }
  }

  // ---- Historique recherche ----
  function getHistory() {
    return _get(KEYS.HISTORY, []);
  }

  function addHistory(query) {
    if (!query || query.trim().length < 2) return;
    const q = query.trim();
    let history = getHistory().filter(h => h.toLowerCase() !== q.toLowerCase());
    history.unshift(q);
    if (history.length > 20) history = history.slice(0, 20);
    _set(KEYS.HISTORY, history);
  }

  function clearHistory() {
    _set(KEYS.HISTORY, []);
  }

  // ---- Progression lecture ----
  function _progressKey(animeId, season, ep) {
    return `${animeId}_s${season}_e${ep}`;
  }

  function getProgress(animeId, season, ep) {
    const all = _get(KEYS.PROGRESS, {});
    const key = _progressKey(animeId, season, ep);
    return all[key] || { seconds: 0, duration: 0, percent: 0, updatedAt: null };
  }

  function setProgress(animeId, season, ep, seconds, duration = 0) {
    const all = _get(KEYS.PROGRESS, {});
    const key = _progressKey(animeId, season, ep);
    const percent = duration > 0 ? Math.min(100, Math.round((seconds / duration) * 100)) : 0;
    all[key] = { seconds, duration, percent, updatedAt: Date.now() };
    _set(KEYS.PROGRESS, all);
  }

  function getAllProgress() {
    return _get(KEYS.PROGRESS, {});
  }

  function getAnimeProgress(animeId) {
    // Retourne tous les épisodes avec progression pour un anime
    const all = _get(KEYS.PROGRESS, {});
    const result = {};
    const prefix = `${animeId}_`;
    for (const key of Object.keys(all)) {
      if (key.startsWith(prefix)) {
        result[key] = all[key];
      }
    }
    return result;
  }

  // ---- Dernière lecture (pour "Reprendre") ----
  function getLastWatch() {
    return _get(KEYS.LAST_WATCH, null);
  }

  function setLastWatch(data) {
    // data = { anime, season, episode, seconds, duration }
    _set(KEYS.LAST_WATCH, { ...data, updatedAt: Date.now() });
  }

  // ---- Bibliothèque ----
  function getLibrary() {
    return _get(KEYS.LIBRARY, []);
  }

  function addToLibrary(anime) {
    if (!anime || !anime.id) return false;
    let lib = getLibrary();
    const existing = lib.findIndex(a => a.id === anime.id);
    if (existing >= 0) {
      // Met à jour
      lib[existing] = { ...lib[existing], ...anime, addedAt: lib[existing].addedAt || Date.now() };
    } else {
      lib.unshift({ ...anime, addedAt: Date.now(), status: 'added' });
    }
    return _set(KEYS.LIBRARY, lib);
  }

  function removeFromLibrary(animeId) {
    let lib = getLibrary().filter(a => a.id !== animeId);
    return _set(KEYS.LIBRARY, lib);
  }

  function isInLibrary(animeId) {
    return getLibrary().some(a => a.id === animeId);
  }

  function getLibraryAnime(animeId) {
    return getLibrary().find(a => a.id === animeId) || null;
  }

  function updateLibraryAnime(animeId, updates) {
    let lib = getLibrary();
    const idx = lib.findIndex(a => a.id === animeId);
    if (idx >= 0) {
      lib[idx] = { ...lib[idx], ...updates };
      _set(KEYS.LIBRARY, lib);
    }
  }

  // ---- Favoris ----
  function getFavorites() {
    return _get(KEYS.FAVORITES, []);
  }

  function isFavorite(animeId) {
    return getFavorites().includes(animeId);
  }

  function toggleFavorite(animeId) {
    let favs = getFavorites();
    if (favs.includes(animeId)) {
      favs = favs.filter(id => id !== animeId);
    } else {
      favs.unshift(animeId);
    }
    _set(KEYS.FAVORITES, favs);
    return favs.includes(animeId); // retourne l'état actuel
  }

  // ---- Settings ----
  const DEFAULT_SETTINGS = {
    quality: '720p',
    preferredSource: 'auto',
    lockEnabled: false,
    theme: 'dark',
    autoPlay: true,
    skipIntro: false,
    version: '1.0.0',
  };

  function getSettings() {
    const stored = _get(KEYS.SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  function setSettings(settings) {
    const current = getSettings();
    return _set(KEYS.SETTINGS, { ...current, ...settings });
  }

  function getSetting(key) {
    return getSettings()[key];
  }

  function setSetting(key, value) {
    const s = getSettings();
    s[key] = value;
    return _set(KEYS.SETTINGS, s);
  }

  // ---- Mot de passe (hash SHA-256) ----
  async function hashPassword(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getPasswordHash() {
    return _get(KEYS.PASSWORD, null);
  }

  async function setPassword(plainText) {
    const hash = await hashPassword(plainText);
    _set(KEYS.PASSWORD, hash);
    return hash;
  }

  async function checkPassword(input) {
    const stored = getPasswordHash();
    if (!stored) {
      // Pas de mot de passe défini — créer le défaut "animeplus"
      await setPassword('animeplus');
      const hash = await hashPassword(input);
      return hash === getPasswordHash();
    }
    const hash = await hashPassword(input);
    return hash === stored;
  }

  async function initDefaultPassword() {
    if (!getPasswordHash()) {
      await setPassword('animeplus');
    }
  }

  // ---- Téléchargements ----
  const DL_KEY = 'ap_downloads';

  function getDownloads() {
    return _get(DL_KEY, []);
  }

  function addDownload(dl) {
    // dl = { id, animeId, animTitle, season, ep, epTitle, url, progress, status, path, size }
    let downloads = getDownloads();
    const idx = downloads.findIndex(d => d.id === dl.id);
    if (idx >= 0) {
      downloads[idx] = { ...downloads[idx], ...dl };
    } else {
      downloads.unshift({ ...dl, createdAt: Date.now() });
    }
    _set(DL_KEY, downloads);
  }

  function updateDownload(id, updates) {
    let downloads = getDownloads();
    const idx = downloads.findIndex(d => d.id === id);
    if (idx >= 0) {
      downloads[idx] = { ...downloads[idx], ...updates };
      _set(DL_KEY, downloads);
    }
  }

  function removeDownload(id) {
    let downloads = getDownloads().filter(d => d.id !== id);
    _set(DL_KEY, downloads);
  }

  function isDownloaded(animeId, season, ep) {
    return getDownloads().some(d =>
      d.animeId === animeId &&
      d.season === season &&
      d.ep === ep &&
      d.status === 'done'
    );
  }

  // ---- En cours (animes avec progression > 0 et < 100) ----
  function getOngoing() {
    const lib = getLibrary();
    const allProgress = getAllProgress();
    const ongoing = [];

    for (const anime of lib) {
      const animeProgress = getAnimeProgress(anime.id);
      const eps = Object.values(animeProgress);
      if (eps.length === 0) continue;
      // Trouver le dernier episode vu
      const lastEp = eps.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      if (lastEp.percent > 0 && lastEp.percent < 95) {
        ongoing.push({
          ...anime,
          lastProgress: lastEp,
        });
      }
    }

    // Trier par mise à jour la plus récente
    return ongoing.sort((a, b) => (b.lastProgress.updatedAt || 0) - (a.lastProgress.updatedAt || 0));
  }

  // ---- Reset ----
  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(DL_KEY);
  }

  // Public API
  return {
    // History
    getHistory,
    addHistory,
    clearHistory,
    // Progress
    getProgress,
    setProgress,
    getAllProgress,
    getAnimeProgress,
    // Last watch
    getLastWatch,
    setLastWatch,
    // Library
    getLibrary,
    addToLibrary,
    removeFromLibrary,
    isInLibrary,
    getLibraryAnime,
    updateLibraryAnime,
    getOngoing,
    // Favorites
    getFavorites,
    isFavorite,
    toggleFavorite,
    // Settings
    getSettings,
    setSettings,
    getSetting,
    setSetting,
    // Password
    hashPassword,
    getPasswordHash,
    setPassword,
    checkPassword,
    initDefaultPassword,
    // Downloads
    getDownloads,
    addDownload,
    updateDownload,
    removeDownload,
    isDownloaded,
    // Reset
    clearAll,
  };
})();
