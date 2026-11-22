/**
 * cloud-sync.js — Synchronisation Cloud de l'historique de lecture et des favoris (type Netflix)
 * Utilise l'API REST de Firestore sous le compte utilisateur connecté
 */

const CloudSync = (() => {
  let pushTimer = null;
  let isSyncing = false;

  function isConfigured() {
    return Boolean(
      window.FirebaseConfig &&
      window.FirebaseConfig.projectId &&
      window.FirebaseAuthService &&
      window.FirebaseAuthService.getCurrentUser()
    );
  }

  function getDocPath(uid) {
    const projectId = window.FirebaseConfig.projectId;
    return `projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users_sync/${encodeURIComponent(uid)}`;
  }

  // Envoi des données locales vers Firestore
  async function pushToCloud() {
    if (!isConfigured() || isSyncing) return false;
    const user = window.FirebaseAuthService.getCurrentUser();
    if (!user || !user.uid) return false;

    try {
      isSyncing = true;
      const token = await window.FirebaseAuthService.getIdToken();
      const projectId = window.FirebaseConfig.projectId;
      const url = `https://firestore.googleapis.com/v1/${getDocPath(user.uid)}`;

      const favorites = Storage.getFavorites ? Storage.getFavorites() : [];
      const watchHistory = Storage.getWatchHistory ? Storage.getWatchHistory() : [];
      const lastWatch = Storage.getLastWatch ? Storage.getLastWatch() : null;
      const allProgress = Storage.getAllProgress ? Storage.getAllProgress() : {};

      const payload = {
        fields: {
          uid: { stringValue: user.uid },
          email: { stringValue: user.email || '' },
          favoritesJson: { stringValue: JSON.stringify(favorites) },
          watchHistoryJson: { stringValue: JSON.stringify(watchHistory) },
          lastWatchJson: { stringValue: JSON.stringify(lastWatch) },
          progressJson: { stringValue: JSON.stringify(allProgress) },
          updatedAt: { integerValue: String(Date.now()) }
        }
      };

      const res = await fetch(`${url}?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=favoritesJson&updateMask.fieldPaths=watchHistoryJson&updateMask.fieldPaths=lastWatchJson&updateMask.fieldPaths=progressJson&updateMask.fieldPaths=updatedAt`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      return res.ok;
    } catch (e) {
      console.warn('[CloudSync] Erreur push Firestore:', e);
      return false;
    } finally {
      isSyncing = false;
    }
  }

  function debouncedPush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushToCloud().catch(() => {});
    }, 2000);
  }

  // Récupération des données depuis Firestore lors de la connexion
  async function pullFromCloud() {
    if (!isConfigured() || isSyncing) return false;
    const user = window.FirebaseAuthService.getCurrentUser();
    if (!user || !user.uid) return false;

    try {
      isSyncing = true;
      const token = await window.FirebaseAuthService.getIdToken();
      const url = `https://firestore.googleapis.com/v1/${getDocPath(user.uid)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        // Document inexistant -> initialiser avec le contenu local actuel
        if (res.status === 404) {
          debouncedPush();
        }
        return false;
      }

      const doc = await res.json();
      const fields = doc.fields || {};

      // Restauration des favoris
      if (fields.favoritesJson && fields.favoritesJson.stringValue) {
        try {
          const cloudFavs = JSON.parse(fields.favoritesJson.stringValue);
          if (Array.isArray(cloudFavs)) {
            const localFavs = Storage.getFavorites ? Storage.getFavorites() : [];
            const mergedMap = new Map();
            localFavs.forEach(f => { if (f && (f.url || f.id)) mergedMap.set(f.url || f.id, f); });
            cloudFavs.forEach(f => { if (f && (f.url || f.id)) mergedMap.set(f.url || f.id, f); });
            localStorage.setItem('ap_favorites', JSON.stringify(Array.from(mergedMap.values())));
          }
        } catch (e) {}
      }

      // Restauration de l'historique de visionnage
      if (fields.watchHistoryJson && fields.watchHistoryJson.stringValue) {
        try {
          const cloudHist = JSON.parse(fields.watchHistoryJson.stringValue);
          if (Array.isArray(cloudHist)) {
            const localHist = Storage.getWatchHistory ? Storage.getWatchHistory() : [];
            const mergedMap = new Map();
            localHist.forEach(h => {
              const k = (h.anime && (h.anime.url || h.anime.id || h.anime.title));
              if (k) mergedMap.set(k, h);
            });
            cloudHist.forEach(h => {
              const k = (h.anime && (h.anime.url || h.anime.id || h.anime.title));
              if (k) mergedMap.set(k, h);
            });
            localStorage.setItem('ap_watch_history', JSON.stringify(Array.from(mergedMap.values())));
          }
        } catch (e) {}
      }

      // Restauration du dernier anime regardé (Reprendre)
      if (fields.lastWatchJson && fields.lastWatchJson.stringValue) {
        try {
          const cloudLast = JSON.parse(fields.lastWatchJson.stringValue);
          if (cloudLast && cloudLast.anime) {
            const localLast = Storage.getLastWatch ? Storage.getLastWatch() : null;
            if (!localLast || (cloudLast.updatedAt || 0) >= (localLast.updatedAt || 0)) {
              localStorage.setItem('ap_last_watch', JSON.stringify(cloudLast));
            }
          }
        } catch (e) {}
      }

      // Restauration de la progression détaillée
      if (fields.progressJson && fields.progressJson.stringValue) {
        try {
          const cloudProg = JSON.parse(fields.progressJson.stringValue);
          if (cloudProg && typeof cloudProg === 'object') {
            const localProg = Storage.getAllProgress ? Storage.getAllProgress() : {};
            const mergedProg = { ...localProg, ...cloudProg };
            localStorage.setItem('ap_progress', JSON.stringify(mergedProg));
          }
        } catch (e) {}
      }

      return true;
    } catch (e) {
      console.warn('[CloudSync] Erreur pull Firestore:', e);
      return false;
    } finally {
      isSyncing = false;
    }
  }

  return {
    pushToCloud,
    debouncedPush,
    pullFromCloud,
    isConfigured
  };
})();

window.CloudSync = CloudSync;
