/**
 * app.js — Point d'entrée de l'application AnimePlus
 */
document.addEventListener('DOMContentLoaded', () => {
  // Callbacks natifs exposés au bridge Kotlin
  window.onCompressionProgress = (callbackId, percent) => {
    const bar = document.getElementById('bar');
    const btn = document.getElementById('sb');
    if (bar) bar.style.width = `${percent}%`;
    if (btn) btn.textContent = `Compression ${percent}%`;
  };

  window.onCompressionDone = (callbackId, outputPath, err) => {
    if (err) {
      Toast.show(`Erreur compression : ${err}`);
    } else {
      Toast.show("Vidéo compressée avec succès !");
      Sheet.close();
    }
  };

  window.onDownloadProgress = (callbackId, percent) => {
    console.log(`Download progress ${callbackId}: ${percent}%`);
  };

  window.onDownloadDone = (callbackId, path, err) => {
    if (err) {
      Toast.show(`Échec téléchargement : ${err}`);
    } else {
      Toast.show(`Épisode téléchargé !`);
    }
  };

  window.onUpdateCheck = (result) => {
    if (result && result.hasUpdate) {
      Sheet.open(`
        <h3>Mise à jour v${result.latestVersion} !</h3>
        <p class="muted" style="margin-bottom:12px;">${result.changelog || "Corrections de bugs et améliorations."}</p>
        <button class="btn" onclick="window.open('${result.downloadUrl}', '_blank')">Installer la mise à jour</button>
      `);
    } else {
      Toast.show("L'application est à jour.");
    }
  };

  // Initialisation du Routeur
  Router.init();
});

