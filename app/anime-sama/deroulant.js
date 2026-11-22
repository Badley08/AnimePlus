/* ============================================================
   deroulant.js — listes déroulantes du site (même style que le profil)

   La vraie <select> reste dans la page, juste cachée : les scripts existants
   (videos.js, scans.js, lecteur.js, catalogue.js…) continuent de lire et
   d'écrire selectedIndex et d'écouter « change », rien ne change pour eux.
   On ajoute seulement un bouton et un panneau par-dessus.
   Pour en habiller une autre : <select data-deroulant> (ou AS_DEROULANT.habiller(select)).
   ============================================================ */
(function () {
    'use strict';

    var CIBLES = '#catalogueTri, .catalog-option select, .ct-select-saison select, .ct-champ select, select.ct-vitesse, select[data-deroulant]';
    var SEUIL_RECHERCHE = 12;       // au-delà, un champ pour filtrer (ex. aller à l'épisode 105)
    var CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>';

    var protoIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
    var protoValeur = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    // Écran tactile : au moindre indice (certains navigateurs Android se disent « souris »).
    // Sur tactile, on ne met jamais le curseur dans la recherche à l'ouverture : le clavier
    // s'ouvrait, rétrécissait l'écran… et ce redimensionnement refermait la liste aussitôt.
    var tactile = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window
        || (window.matchMedia && (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches));
    var largeurAvant = window.innerWidth;
    var ouvert = null;              // la <select> dont le panneau est ouvert
    var compteur = 0;

    function normal(t) {
        return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function echapper(t) {
        return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    // Le bouton affiche toujours l'option choisie (et suit l'état de la vraie liste)
    function maj(sel) {
        var d = sel.__dd;
        var opt = sel.options[protoIndex.get.call(sel)];
        d.texte.textContent = opt ? opt.textContent : '';
        d.bouton.disabled = sel.disabled;
        d.boite.classList.toggle('as-dd-mort', sel.classList.contains('ct-select-mort'));
        d.boite.hidden = sel.hidden || sel.style.display === 'none';
    }

    function remplir(sel) {
        var d = sel.__dd;
        var html = '';
        var groupe = null;
        for (var i = 0; i < sel.options.length; i++) {
            var o = sel.options[i];
            if (o.hidden) continue;                     // option masquée (lecteur sans cet épisode)
            if (o.parentNode !== groupe && o.parentNode.tagName === 'OPTGROUP') {
                groupe = o.parentNode;
                html += '<div class="as-dd-groupe">' + echapper(groupe.label) + '</div>';
            }
            html += '<button type="button" class="as-dd-option" role="option" data-i="' + i + '"'
                + ' aria-selected="' + (i === protoIndex.get.call(sel)) + '"'
                + (o.disabled ? ' disabled' : '') + '>' + echapper(o.textContent) + '</button>';
        }
        d.liste.innerHTML = html || '<div class="as-dd-vide">Aucun choix</div>';
        d.recherche.hidden = sel.options.length <= SEUIL_RECHERCHE;
        d.champ.value = '';
    }

    // « 105 », « ep 105 », « épisode 105 » ou « chap 12 » : chaque mot tapé doit se retrouver
    // dans l'option ; un nombre trouve les numéros qui COMMENCENT par lui, pour que la liste
    // se réduise au fur et à mesure (3 -> 3, 30…39, 300…399 ; 39 -> 39, 390…399 ; 390 -> 390)
    var MOTS_IGNORES = /^(ep|epi|episode|chap|chapitre|ch|e|c|no|n°|#)\.?$/;
    function correspond(t, mots) {
        var nombres = (t.match(/\d+/g) || []).map(function (n) { return String(+n); });
        for (var i = 0; i < mots.length; i++) {
            var m = mots[i];
            if (/^\d+$/.test(m)) {
                var debut = String(+m);
                if (!nombres.some(function (n) { return n.indexOf(debut) === 0; })) return false;
            } else if (!MOTS_IGNORES.test(m) && t.indexOf(m) === -1) {
                return false;
            }
        }
        return true;
    }

    function filtrer(sel) {
        var d = sel.__dd;
        var q = normal(d.champ.value.trim());
        var mots = q.replace(/(\d+)/g, ' $1 ').split(/\s+/).filter(Boolean);
        var visibles = 0;
        d.liste.querySelectorAll('.as-dd-option').forEach(function (b) {
            var t = normal(b.textContent);
            var ok = !q || correspond(t, mots);
            b.hidden = !ok;
            if (ok) visibles++;
        });
        d.liste.querySelectorAll('.as-dd-groupe').forEach(function (g) { g.hidden = !!q; });
        var vide = d.liste.querySelector('.as-dd-vide');
        if (!visibles && !vide) d.liste.insertAdjacentHTML('beforeend', '<div class="as-dd-vide">Aucun résultat</div>');
        if (visibles && vide) vide.remove();
    }

    function ouvrir(sel) {
        fermer();
        var d = sel.__dd;
        remplir(sel);
        ouvert = sel;
        d.boite.classList.add('as-dd-ouvert');
        d.bouton.setAttribute('aria-expanded', 'true');
        d.panneau.hidden = false;

        // Vers le haut s'il n'y a pas la place en dessous ; jamais hors de l'écran à droite
        d.panneau.style.left = '';
        d.panneau.style.right = '';
        var r = d.bouton.getBoundingClientRect();
        var dessous = window.innerHeight - r.bottom;
        d.boite.classList.toggle('as-dd-haut', dessous < 260 && r.top > dessous);
        var p = d.panneau.getBoundingClientRect();
        if (p.right > document.documentElement.clientWidth - 8) {
            d.panneau.style.left = 'auto';
            d.panneau.style.right = '0';
        }

        var choisi = d.liste.querySelector('[aria-selected="true"]');
        if (choisi) d.liste.scrollTop = choisi.offsetTop - d.liste.clientHeight / 2 + choisi.offsetHeight / 2;
        if (!d.recherche.hidden && !tactile) d.champ.focus();
        else if (choisi) choisi.focus({ preventScroll: true });
        else d.bouton.focus();
    }

    function fermer(rendreFocus) {
        if (!ouvert) return;
        var d = ouvert.__dd;
        ouvert = null;
        d.boite.classList.remove('as-dd-ouvert', 'as-dd-haut');
        d.bouton.setAttribute('aria-expanded', 'false');
        d.panneau.hidden = true;
        d.liste.innerHTML = '';     // les longues listes (1000 épisodes) ne restent pas dans la page
        if (rendreFocus) d.bouton.focus();
    }

    function choisir(sel, i) {
        fermer(true);
        if (i === protoIndex.get.call(sel)) return;
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function options(sel) {
        return Array.prototype.filter.call(sel.__dd.liste.querySelectorAll('.as-dd-option'), function (b) { return !b.hidden && !b.disabled; });
    }

    function habiller(sel) {
        if (!sel || sel.__dd || sel.multiple || sel.size > 1) return;
        var id = 'as-dd-' + (++compteur);
        var boite = document.createElement('div');
        boite.className = 'as-dd ' + (sel.closest('.catalog-tri, .catalog-option') ? 'as-dd-nu' : 'as-dd-cadre') + (sel.classList.contains('ct-vitesse') ? ' as-dd-petit' : '');
        boite.innerHTML =
            '<button type="button" class="as-dd-bouton" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '">'
            + '<span class="as-dd-texte"></span>' + CHEVRON + '</button>'
            + '<div class="as-dd-panneau" id="' + id + '" hidden>'
            + '<div class="as-dd-recherche" hidden><input type="search" enterkeyhint="go"autocomplete="off" spellcheck="false" placeholder="Rechercher…" aria-label="Filtrer la liste"></div>'
            + '<div class="as-dd-liste" role="listbox"></div></div>';
        sel.insertAdjacentElement('afterend', boite);

        var d = sel.__dd = {
            boite: boite,
            bouton: boite.querySelector('.as-dd-bouton'),
            texte: boite.querySelector('.as-dd-texte'),
            panneau: boite.querySelector('.as-dd-panneau'),
            recherche: boite.querySelector('.as-dd-recherche'),
            champ: boite.querySelector('input'),
            liste: boite.querySelector('.as-dd-liste')
        };
        var etiquette = sel.getAttribute('aria-label') || sel.title;
        if (etiquette) d.bouton.setAttribute('aria-label', etiquette);
        if (sel.title) d.bouton.title = sel.title;
        if (sel.id === 'selectEpisodes') d.champ.placeholder = 'Aller à l\'épisode…';
        if (sel.id === 'selectChapitres') d.champ.placeholder = 'Aller au chapitre…';

        sel.classList.add('as-dd-natif');
        // Sur iPhone, toucher notre liste (placée dans le <label> de la vraie liste) « réveillait » la
        // liste native : le sélecteur de l'iPhone s'ouvrait par-dessus, puis tout se refermait.
        // On empêche le <label> de renvoyer le toucher vers la vraie liste…
        boite.addEventListener('click', function (e) { if (boite.closest('label')) e.preventDefault(); });
        // …et on retire l'ancien « appui long = champ pour taper un numéro » (clavier qui s'ouvrait
        // puis se fermait aussitôt) : le champ de recherche de notre liste le remplace.
        sel.removeAttribute('ontouchstart');
        sel.removeAttribute('ondblclick');
        sel.ontouchstart = null;
        sel.ondblclick = null;
        var etiquette2 = sel.closest('label');
        if (etiquette2) { etiquette2.removeAttribute('title'); etiquette2.addEventListener('click', function (e) { if (e.target === etiquette2 || !boite.contains(e.target)) e.preventDefault(); }); }
        sel.tabIndex = -1;
        sel.setAttribute('aria-hidden', 'true');

        // Les scripts changent l'épisode avec selectedIndex = … (sans événement) : on suit
        Object.defineProperty(sel, 'selectedIndex', {
            configurable: true,
            get: function () { return protoIndex.get.call(this); },
            set: function (v) { protoIndex.set.call(this, v); maj(this); }
        });
        Object.defineProperty(sel, 'value', {
            configurable: true,
            get: function () { return protoValeur.get.call(this); },
            set: function (v) { protoValeur.set.call(this, v); maj(this); }
        });
        sel.addEventListener('change', function () { maj(sel); });
        new MutationObserver(function () { maj(sel); }).observe(sel, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['class', 'disabled', 'hidden', 'style', 'selected']
        });

        d.bouton.addEventListener('click', function () {
            if (ouvert === sel) fermer(true); else ouvrir(sel);
        });
        d.bouton.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ouvrir(sel); }
            // Taper directement un numéro sur la liste fermée : elle s'ouvre déjà filtrée
            else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey && sel.options.length > SEUIL_RECHERCHE) {
                e.preventDefault();
                ouvrir(sel);
                d.champ.value = e.key;
                d.champ.focus();
                filtrer(sel);
            }
        });
        d.liste.addEventListener('click', function (e) {
            var b = e.target.closest('.as-dd-option');
            if (b && !b.disabled) choisir(sel, +b.getAttribute('data-i'));
        });
        d.champ.addEventListener('input', function () { filtrer(sel); });
        d.panneau.addEventListener('keydown', function (e) {
            var liste = options(sel);
            var pos = liste.indexOf(document.activeElement);
            if (e.key === 'Escape') { e.preventDefault(); fermer(true); }
            else if (e.key === 'Tab') { fermer(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); (liste[pos + 1] || liste[0] || d.champ).focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (pos > 0) liste[pos - 1].focus(); else if (!d.recherche.hidden) d.champ.focus(); }
            else if (e.key === 'Enter' && e.target === d.champ) { e.preventDefault(); if (liste[0]) choisir(sel, +liste[0].getAttribute('data-i')); }
        });
        maj(sel);
    }

    function tout(racine) {
        (racine || document).querySelectorAll(CIBLES).forEach(habiller);
    }

    document.addEventListener('click', function (e) {
        if (ouvert && !ouvert.__dd.boite.contains(e.target)) fermer();
    }, true);
    // On ne referme que si la LARGEUR change (rotation, fenêtre redimensionnée) ; le clavier du
    // téléphone ne change que la hauteur, et on ne ferme jamais pendant qu'on tape dans la recherche.
    window.addEventListener('resize', function () {
        var l = window.innerWidth;
        if (l === largeurAvant) return;
        largeurAvant = l;
        if (ouvert && document.activeElement === ouvert.__dd.champ) return;
        fermer();
    });

    window.AS_DEROULANT = { habiller: habiller, tout: tout };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { tout(); });
    else tout();
})();
