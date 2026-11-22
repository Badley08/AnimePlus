/* ============================================================
   appli.js — installer Anime-Sama comme une appli (PWA)
   - enregistre le script d'arrière-plan /sw.js (page « Pas de connexion ») ;
   - retient l'invitation d'installation du navigateur (Chrome, Edge, Android…) :
     les boutons [data-installer-appli] installent alors en un clic,
     sinon ils mènent aux explications de /application/ ;
   - ajoute « appli-installee » sur <html> quand le site est ouvert en mode appli
     (la section d'installation de l'accueil se cache alors).
   ============================================================ */
(function () {
    'use strict';
    var html = document.documentElement;
    var invite = null;

    var installee = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    if (installee) html.classList.add('appli-installee');

    function appareil() {
        var ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
        if (/Android/i.test(ua)) return 'android';
        return 'ordinateur';
    }
    html.setAttribute('data-appareil', appareil());

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();                 // on garde l'invitation pour nos propres boutons
        invite = e;
        html.classList.add('appli-installable');
    });
    window.addEventListener('appinstalled', function () {
        invite = null;
        html.classList.remove('appli-installable');
        html.classList.add('appli-installee');
        if (window.AS_CARTE) window.AS_CARTE.toast('Raccourci ajouté ! Retrouve Anime-Sama sur ton écran d\'accueil.');
    });

    function installer() {
        if (!invite) return false;
        invite.prompt();
        invite.userChoice.then(function () { invite = null; html.classList.remove('appli-installable'); }).catch(function () {});
        return true;
    }

    // Croix du bandeau de l'accueil : on ne le montre plus
    document.addEventListener('click', function (e) {
        if (!e.target.closest('[data-fermer-appli]')) return;
        html.classList.add('appli-bandeau-ferme');
        try { localStorage.setItem('appliBandeauFerme', '1'); } catch (er) {}
    });

    // Boutons « Installer » : en un clic quand le navigateur le permet, sinon les explications
    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-installer-appli]');
        if (!b) return;
        var cible = b.getAttribute('data-installer-appli');          // '', 'iphone', 'android', 'ordinateur'
        if (cible !== 'iphone' && installer()) { e.preventDefault(); return; }
        if (b.tagName !== 'A') window.location.href = '/application/#' + (cible || appareil());
    });

    // Script d'arrière-plan (après le chargement, pour ne rien ralentir)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js?v=2').catch(function () {});
        });
    }

    window.AS_APPLI = { installer: installer, appareil: appareil, installable: function () { return !!invite; } };
})();
