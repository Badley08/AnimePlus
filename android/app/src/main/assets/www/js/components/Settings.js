/**
 * Settings.js — Réglages, compression et À propos
 */
const Settings = (() => {
  function render() {
    const settings = Storage.getSettings ? Storage.getSettings() : { quality: '720p', source: 'auto', lockEnabled: true };

    return `
      <section class="v" id="set">
        <h1 class="title">Réglages</h1>
        
        <div class="group">
          <div class="set" id="row-quality">
            <span>Qualité vidéo par défaut</span>
            <small id="lbl-quality">${settings.quality || '720p'}</small>
          </div>
          <div class="set" id="row-source">
            <span>Source de streaming</span>
            <small id="lbl-source">${settings.source || 'Automatique'}</small>
          </div>
          <div class="set" id="row-lock">
            <span>Verrouiller au démarrage</span>
            <small id="lbl-lock">${settings.lockEnabled ? 'Activé' : 'Désactivé'}</small>
          </div>
        </div>

        <h2 class="h" style="margin-top:8px">Maintenance</h2>
        <div class="group">
          <div class="set" id="row-clear">
            <span>Vider le cache & historique</span>
            <small style="color:var(--danger)">Nettoyer</small>
          </div>
        </div>

        <h2 class="h" style="margin-top:8px">À propos</h2>
        <div class="group">
          <div class="set"><span>Version</span><small>1.0.0 (WebView Edition)</small></div>
          <div class="set"><span>Idée originale</span><small>Strong</small></div>
          <div class="set"><span>Développement</span><small>Karlito</small></div>
        </div>
        <div class="notice">
          <b>Usage Privé Strict</b>
          Anime Plus n'est ni à vendre ni à louer. Aucune vidéo n'est hébergée sur nos serveurs.
        </div>
      </section>
    `;
  }

  function mount() {
    const settings = Storage.getSettings ? Storage.getSettings() : { quality: '720p', source: 'auto', lockEnabled: true };

    // Choix qualité
    document.getElementById('row-quality').onclick = () => {
      const qualities = ['480p', '720p', '1080p'];
      const currentIdx = qualities.indexOf(settings.quality || '720p');
      const nextQuality = qualities[(currentIdx + 1) % qualities.length];
      settings.quality = nextQuality;
      Storage.setSettings(settings);
      document.getElementById('lbl-quality').textContent = nextQuality;
      Toast.show(`Qualité définie sur ${nextQuality}`);
    };

    // Choix source
    document.getElementById('row-source').onclick = () => {
      const sources = ['auto', 'animesama', 'voiranimes', '2anime'];
      const labels = { 'auto': 'Automatique', 'animesama': 'Anime-Sama', 'voiranimes': 'VoirAnime', '2anime': '2Anime' };
      const currentIdx = sources.indexOf(settings.source || 'auto');
      const nextSource = sources[(currentIdx + 1) % sources.length];
      settings.source = nextSource;
      Storage.setSettings(settings);
      document.getElementById('lbl-source').textContent = labels[nextSource];
      Toast.show(`Source: ${labels[nextSource]}`);
    };

    // Toggle verrou
    document.getElementById('row-lock').onclick = () => {
      settings.lockEnabled = !settings.lockEnabled;
      Storage.setSettings(settings);
      document.getElementById('lbl-lock').textContent = settings.lockEnabled ? 'Activé' : 'Désactivé';
      Toast.show(`Verrouillage ${settings.lockEnabled ? 'activé' : 'désactivé'}`);
    };

    // Vider le cache
    document.getElementById('row-clear').onclick = () => {
      if (confirm("Supprimer l'historique et le cache local ?")) {
        Storage.clearHistory();
        Toast.show("Cache vidé !");
      }
    };
  }

  return { render, mount };
})();
