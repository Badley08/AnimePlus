/**
 * Splash.js — Écran de démarrage avec animation GSAP
 */
const Splash = (() => {
  function render() {
    return `
      <section class="v on" id="splash">
        <div class="logo-wrap">
          <svg class="logo" viewBox="0 0 120 120" role="img" aria-label="Anime Plus">
            <rect id="logo-rect" x="8" y="8" width="104" height="104" rx="28" pathLength="1"></rect>
            <path id="logo-play" d="M38 36 L70 60 L38 84 Z" pathLength="1"></path>
            <path id="logo-plus" d="M88 68 V92 M76 80 H100" pathLength="1"></path>
          </svg>
        </div>
        <div class="word" id="splash-word">animeplus</div>
        <div class="credits">Idée par <b>Strong</b><br>Dev par <b>Karlito</b></div>
      </section>
    `;
  }

  function mount() {
    const tl = gsap.timeline();
    tl.fromTo('#logo-rect', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.out' })
      .fromTo('#logo-play', { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.4')
      .fromTo('#logo-plus', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2')
      .from('#splash-word', { opacity: 0, y: 15, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.1')
      .from('.credits', { opacity: 0, duration: 0.4 }, '-=0.2');

    setTimeout(() => {
      const settings = Storage.getSettings ? Storage.getSettings() : {};
      if (settings.lockEnabled === false) {
        Router.go('home');
      } else {
        Router.go('gate');
      }
    }, 2400);
  }

  return { render, mount };
})();

