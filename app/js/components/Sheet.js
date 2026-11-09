/**
 * Sheet.js — Bottom Sheet modal réutilisable
 */
const Sheet = (() => {
  let scrim = null;
  let sheetEl = null;

  function init() {
    scrim = document.getElementById('scrim');
    sheetEl = document.getElementById('sheet');
    if (scrim) {
      scrim.onclick = () => close();
    }
  }

  function open(contentHtml) {
    if (!sheetEl || !scrim) init();
    if (contentHtml) {
      sheetEl.innerHTML = contentHtml;
    }
    scrim.hidden = false;
    sheetEl.classList.add('on');
    if (window.gsap) {
      gsap.fromTo(sheetEl, { y: '100%' }, { y: '0%', duration: 0.28, ease: 'power2.out' });
      gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    }
  }

  function close() {
    if (!sheetEl || !scrim) return;
    if (window.gsap) {
      gsap.to(sheetEl, {
        y: '100%',
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          sheetEl.classList.remove('on');
          scrim.hidden = true;
        }
      });
      gsap.to(scrim, { opacity: 0, duration: 0.2 });
    } else {
      sheetEl.classList.remove('on');
      scrim.hidden = true;
    }
  }

  return { init, open, close };
})();
