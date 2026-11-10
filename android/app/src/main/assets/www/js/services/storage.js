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
    PROFILE: 'ap_profile',
  };
  const PASSWORD_ITERATIONS = 210000;
  const DEFAULT_PASSWORD_RECORDS = [
    { salt: 'fbdfd692389ad127e795ca317c5c7304', hash: '2f857251c75ed455d0a5a2638c76e40b19bfa6f79b68a740def4552f4a8a0c14' },
    { salt: '296406157c0d5afde0a741b1f5f4dd47', hash: 'e8e0334f86051004a3631fd412c0796fa60fe73e56b82c03fe616a14e000f97d' },
    { salt: '9c783035df73ca72809e5c5a2bac9be1', hash: '3a3f85545ad037e76486ddd39f6d6d23fa053cff7afe9296a13da8e631a9761e' },
  ];

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
  // Ensure the anime has a stable identifier – fallback to its URL or title hash
  if (!anime) return false;
  if (!anime.id) {
    if (anime.url) {
      anime.id = anime.url;
    } else if (anime.title) {
      // simple deterministic hash (djb2) of the title
      let hash = 5381;
      for (let i = 0; i < anime.title.length; i++) {
        hash = ((hash << 5) + hash) + anime.title.charCodeAt(i);
      }
      anime.id = 'anime_' + (hash >>> 0);
    } else {
      // cannot identify – abort
      console.warn('[Storage] addToLibrary: missing id, url, and title');
      return false;
    }
  }
  // If already present, update the entry but do NOT create a duplicate
  let lib = getLibrary();
  const existing = lib.findIndex(a => a.id === anime.id);
  if (existing >= 0) {
    // Merge new fields while preserving original addedAt
    lib[existing] = { ...lib[existing], ...anime, addedAt: lib[existing].addedAt || Date.now() };
    return _set(KEYS.LIBRARY, lib);
  }
  // New entry – prepend to library
  lib.unshift({ ...anime, addedAt: Date.now(), status: 'added' });
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

  function _getAnimeKey(animeOrId) {
    if (!animeOrId) return null;
    if (typeof animeOrId === 'string') return animeOrId;
    return animeOrId.id || animeOrId.url || (animeOrId.title ? 'anime_' + animeOrId.title.trim().toLowerCase() : null);
  }

  function isFavorite(animeOrId) {
    const key = _getAnimeKey(animeOrId);
    if (!key) return false;
    const favs = getFavorites();
    return favs.some(item => {
      if (typeof item === 'string') return item === key;
      return (item.id === key || item.url === key || (item.title && key.includes(item.title.trim().toLowerCase())));
    });
  }

  function toggleFavorite(anime) {
    if (!anime) return false;
    let favs = getFavorites();
    const key = _getAnimeKey(anime);
    if (!key) return false;

    const existingIdx = favs.findIndex(item => {
      if (typeof item === 'string') return item === key;
      return (item.id === key || item.url === key || (item.title && key.includes(item.title.trim().toLowerCase())));
    });

    let isFavNow = false;
    if (existingIdx >= 0) {
      favs.splice(existingIdx, 1);
      isFavNow = false;
    } else {
      // Normaliser l'objet favori pour toujours avoir un objet complet sans doublons
      const animeObj = (typeof anime === 'object') ? {
        id: anime.id || key,
        title: anime.title || 'Anime',
        poster: anime.poster || '',
        url: anime.url || '',
        source: anime.source || 'animesama',
        genres: anime.genres || []
      } : { id: key, title: key, poster: '', url: key, source: 'animesama' };

      favs.unshift(animeObj);
      isFavNow = true;
    }

    _set(KEYS.FAVORITES, favs);
    return isFavNow;
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

  function getProfile() {
    return _get(KEYS.PROFILE, { name: '', avatar: '🎬', avatarType: 'emoji', setupComplete: false });
  }

  function setProfile(profile) {
    const name = String(profile && profile.name || '').trim().slice(0, 24);
    const emojiAvatars = new Set(['🎬', '🌙', '✨', '🐱', '🎧', '⭐', '🔥', '🌸', '🐼', '🦊', '🐧', '🍥']);
    const svgAvatars = new Set(['home', 'search', 'lib', 'set', 'play', 'pause', 'zip', 'ok', 'clock', 'star', 'bookmark', 'info', 'download', 'lock', 'x']);
    const avatarType = profile && profile.avatarType === 'svg' ? 'svg' : 'emoji';
    if (!name) return false;
    if (avatarType === 'emoji' ? !emojiAvatars.has(profile.avatar) : !svgAvatars.has(profile.avatar)) return false;
    return _set(KEYS.PROFILE, {
      name,
      avatar: profile.avatar,
      avatarType,
      setupComplete: true
    });
  }

  // ---- Mot de passe (PBKDF2-SHA-256 avec sel) ----
  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex) {
    if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
      throw new Error('Sel de mot de passe invalide.');
    }
    return Uint8Array.from(hex.match(/.{2}/g), byte => parseInt(byte, 16));
  }

  async function derivePassword(input, salt, iterations = PASSWORD_ITERATIONS) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(input),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: hexToBytes(salt),
      iterations,
      hash: 'SHA-256'
    }, key, 256);
    return bytesToHex(new Uint8Array(bits));
  }

  async function hashLegacyPassword(input) {
    const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return bytesToHex(new Uint8Array(bits));
  }

  function createSalt() {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return bytesToHex(salt);
  }

  async function hashPassword(input) {
    const normalized = String(input).trim().toLowerCase();
    const salt = createSalt();
    return {
      algorithm: 'PBKDF2-SHA-256',
      iterations: PASSWORD_ITERATIONS,
      salt,
      hash: await derivePassword(normalized, salt)
    };
  }

  function getPasswordHash() {
    return _get(KEYS.PASSWORD, null);
  }

  async function setPassword(plainText) {
    const hash = await hashPassword(plainText);
    if (!_set(KEYS.PASSWORD, hash)) throw new Error('Impossible d’enregistrer le mot de passe.');
    return hash;
  }

  async function checkPassword(input) {
    const normalized = String(input).trim().toLowerCase();
    if (!normalized) return false;

    const stored = getPasswordHash();
    if (typeof stored === 'string') {
      const legacyHashes = await Promise.all([
        hashLegacyPassword(String(input).trim()),
        hashLegacyPassword(normalized)
      ]);
      if (legacyHashes.includes(stored)) {
        await setPassword(normalized);
        return true;
      }
    } else if (stored && stored.algorithm === 'PBKDF2-SHA-256') {
      const iterations = Number(stored.iterations);
      if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) {
        throw new Error('Paramètres de mot de passe enregistrés invalides.');
      }
      const hash = await derivePassword(normalized, stored.salt, iterations);
      if (hash === stored.hash) return true;
    }

    const defaultMatches = await Promise.all(DEFAULT_PASSWORD_RECORDS.map(async record =>
      await derivePassword(normalized, record.salt) === record.hash
    ));
    return defaultMatches.some(Boolean);
  }

  async function initDefaultPassword() {
    if (!getPasswordHash()) {
      const record = DEFAULT_PASSWORD_RECORDS[0];
      _set(KEYS.PASSWORD, {
        algorithm: 'PBKDF2-SHA-256',
        iterations: PASSWORD_ITERATIONS,
        ...record
      });
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
    getProfile,
    setProfile,
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
