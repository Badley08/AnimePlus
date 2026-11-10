/**
 * Gate.js — Écran de verrouillage / mot de passe
 */
const Gate = (() => {
  function render() {
    return `
      <section class="v" id="gate">
        <svg class="logo" viewBox="0 0 120 120" aria-hidden="true">
          <rect x="8" y="8" width="104" height="104" rx="28"></rect>
          <path d="M38 36 L70 60 L38 84 Z"></path>
          <path d="M88 68 V92 M76 80 H100"></path>
        </svg>
        <div class="word" style="font-size:26px">animeplus</div>
        <p class="muted" style="margin-top:8px">Application privée, entre le mot de passe.</p>
        <form id="gf" autocomplete="off">
          <div class="pw">
            <svg class="i"><use href="#lock"></use></svg>
            <input class="field" id="pw" type="password" placeholder="Mot de passe" aria-label="Mot de passe" required autofocus>
          </div>
          <p class="err" id="ge"></p>
          <button class="btn" type="submit" id="btn-unlock">Déverrouiller</button>
        </form>
        <svg class="tick" id="tk" viewBox="0 0 52 52" hidden aria-hidden="true">
          <circle cx="26" cy="26" r="23" pathLength="1"></circle>
          <path d="M15 27l8 8 14-16" pathLength="1"></path>
        </svg>
        <p class="err ok" id="gm" hidden>Mot de passe correct, bienvenue.</p>
      </section>
    `;
  }

  function mount() {
    const form = document.getElementById('gf');
    const input = document.getElementById('pw');
    const err = document.getElementById('ge');
    const gate = document.getElementById('gate');
    const tick = document.getElementById('tk');
    const msg = document.getElementById('gm');

    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const val = input.value.trim();
      input.classList.remove('bad', 'good');
      err.textContent = '';

      if (!val) {
        err.textContent = 'Entre le mot de passe.';
        return;
      }

      let isValid = false;
      try {
        if (typeof Storage.checkPassword !== 'function') {
          throw new Error('Service de vérification indisponible.');
        }
        isValid = await Storage.checkPassword(val);
      } catch (error) {
        console.error('Password verification failed:', error);
        err.textContent = 'Le déverrouillage est indisponible pour le moment.';
        return;
      }

      if (!isValid) {
        err.textContent = 'Mot de passe incorrect. Réessaie.';
        input.classList.add('bad');
        if (window.Android && window.Android.vibrate) {
          window.Android.vibrate(80);
        } else if (navigator.vibrate) {
          navigator.vibrate([60, 40, 60]);
        }
        if (window.gsap) {
          gsap.fromTo(input, { x: -8 }, { x: 8, duration: 0.08, repeat: 3, yoyo: true });
        }
        input.select();
        return;
      }

      // Succès
      input.classList.add('good');
      gate.classList.add('win');
      tick.hidden = false;
      msg.hidden = false;
      if (window.Android && window.Android.vibrate) {
        window.Android.vibrate(40);
      } else if (navigator.vibrate) {
        navigator.vibrate(40);
      }

      setTimeout(() => {
        Router.go('home');
        setTimeout(() => {
          gate.classList.remove('win');
          tick.hidden = true;
          msg.hidden = true;
          input.value = '';
          input.classList.remove('good');
        }, 500);
      }, 900);
    };
  }

  return { render, mount };
})();
