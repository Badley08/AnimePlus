/**
 * NavBar.js — Barre de navigation basse
 */
const NavBar = (() => {
  let navEl = null;

  function init() {
    navEl = document.getElementById('tabs');
    if (!navEl) return;
    navEl.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const screen = tab.getAttribute('data-v');
        if (screen && window.Router) {
          Router.go(screen);
        }
      });
    });
  }

  function setActive(screenName) {
    if (!navEl) navEl = document.getElementById('tabs');
    if (!navEl) return;
    const allowed = ['home', 'search', 'lib', 'set'];
    navEl.hidden = !allowed.includes(screenName);
    navEl.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('on', tab.getAttribute('data-v') === screenName);
    });
  }

  return { init, setActive };
})();

