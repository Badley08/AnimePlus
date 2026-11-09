/**
 * router.js — Gestionnaire de navigation par composants avec GSAP
 */
const Router = (() => {
  let currentScreen = null;
  const historyStack = [];

  const screens = {
    splash: Splash,
    gate: Gate,
    home: Home,
    search: Search,
    det: Detail,
    ply: Player,
    lib: Library,
    set: Settings
  };

  function init() {
    NavBar.init();
    Toast.init();
    Sheet.init();
    go('splash');
  }

  function go(screenName, params = {}) {
    if (!screens[screenName]) {
      console.error(`Écran inconnu : ${screenName}`);
      return;
    }

    // Nettoyage de l'écran précédent
    if (currentScreen && screens[currentScreen] && screens[currentScreen].destroy) {
      screens[currentScreen].destroy();
    }

    if (currentScreen && currentScreen !== screenName && !['splash', 'gate'].includes(screenName)) {
      historyStack.push({ screen: currentScreen, params });
    }

    const container = document.getElementById('view-container');
    const comp = screens[screenName];

    // Rendu HTML
    container.innerHTML = comp.render(params);

    // Affichage / masquage de l'écran avec classe CSS .on
    const screenEl = document.getElementById(screenName);
    if (screenEl) {
      screenEl.classList.add('on');
      if (window.gsap && !['splash', 'gate'].includes(screenName)) {
        gsap.fromTo(screenEl, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.22, ease: 'power2.out' });
      }
    }

    // Gestion de la Navbar basse
    NavBar.setActive(screenName);

    // Montage du composant (attachement des écouteurs)
    if (comp.mount) {
      comp.mount(params);
    }

    currentScreen = screenName;
  }

  function back() {
    if (historyStack.length > 0) {
      const prev = historyStack.pop();
      go(prev.screen, prev.params);
    } else {
      go('home');
    }
  }

  return { init, go, back };
})();

