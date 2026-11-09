/**
 * Toast.js — Notifications flottantes
 */
const Toast = (() => {
  let el = null;
  let timer = null;

  function init() {
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.hidden = true;
      document.body.appendChild(el);
    }
  }

  function show(message, duration = 2400) {
    init();
    el.textContent = message;
    el.hidden = false;
    clearTimeout(timer);

    if (window.gsap) {
      gsap.fromTo(el, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
    }

    timer = setTimeout(() => {
      if (window.gsap) {
        gsap.to(el, {
          opacity: 0,
          y: 10,
          duration: 0.2,
          onComplete: () => { el.hidden = true; }
        });
      } else {
        el.hidden = true;
      }
    }, duration);
  }

  return { show, init };
})();

