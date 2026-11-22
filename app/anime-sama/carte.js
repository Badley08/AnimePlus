/* ============================================================
   carte.js — ce qui fait vivre les cartes « as-carte » sur tout le site
   (chargé par le header, styles dans css/carte.css) :
   - le menu ⋯ : Watchlist / Favoris / Vu / Voir la fiche (/ Retirer sur le profil) ;
   - les webtoons restent en couleur (les autres scans sont en noir et blanc).
   Tout est dans une fonction fermée : rien ne peut entrer en conflit avec
   les scripts des pages (lecteur, scans, profil…).
   Le profil (profil.js) écoute deux événements :
   - « as-listes-maj » : une liste a changé, il redessine ;
   - « as-carte-retirer » : retirer une carte de l'une de ses listes.
   ============================================================ */
(function () {
    'use strict';

    var MAX = 500;
    var LISTES = {
        watch: { nom: 'Watchlist', cle: 'watchlist', api: '/api/sync-watchlist.php', champ: 'watchlist', libelle: 'Watchlist' },
        fav:   { nom: 'Favoris',   cle: 'favori',    api: '/api/sync-favorites.php', champ: 'favorites', libelle: 'Favoris' },
        vu:    { nom: 'Vus',       cle: 'vu',        api: '/api/sync-viewed.php',    champ: 'viewed',    libelle: 'Vu' }
    };
    var NOMS_LISTES = { histo: 'l\'historique', watch: 'la Watchlist', fav: 'les Favoris', vu: 'les Vus' };
    var ICONES = {
        watch: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" /></svg>',
        fav: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" /></svg>',
        vu: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>',
        fiche: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>',
        retirer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>'
    };

    /* ---------- Listes (navigateur + compte) ---------- */
    function lire(cle) {
        try { var v = JSON.parse(localStorage.getItem(cle) || '[]'); return Array.isArray(v) ? v : []; }
        catch (e) { return []; }
    }
    function slugDe(url) {
        var p = String(url || '').split('?')[0].split('/').filter(Boolean);
        return p[0] === 'catalogue' && p[1] ? p[1] : '';
    }
    function ficheDe(url) {
        var s = slugDe(url);
        return s ? '/catalogue/' + s + '/' : url;
    }
    function tableaux(cat) {
        var c = LISTES[cat].cle;
        return [lire(c + 'Nom'), lire(c + 'Url'), lire(c + 'Img')];
    }
    function indexDans(cat, url) {
        var s = slugDe(url), urls = tableaux(cat)[1];
        for (var i = 0; i < urls.length; i++) if (urls[i] === url || (s && slugDe(urls[i]) === s)) return i;
        return -1;
    }
    function envoyerAuCompte(cat, T) {
        if (typeof isUserLoggedIn !== 'function') return;
        Promise.resolve(isUserLoggedIn()).then(function (connecte) {
            if (!connecte) return;
            var corps = {}; corps[LISTES[cat].champ] = { nom: T[0], url: T[1], img: T[2] };
            fetch(LISTES[cat].api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(function () {});
        }).catch(function () {});
    }
    function basculer(cat, url, nom, img) {
        var L = LISTES[cat], T = tableaux(cat), i = indexDans(cat, url);
        if (i !== -1) {
            T[0].splice(i, 1); T[1].splice(i, 1); T[2].splice(i, 1);
            toast('Retiré ' + (cat === 'watch' ? 'de la ' : 'des ') + L.nom);
        } else {
            if (T[1].length >= MAX) { toast('Liste pleine : 500 oeuvres maximum.', true); return; }
            T[0].push(nom); T[1].push(ficheDe(url)); T[2].push(img);
            toast('Ajouté ' + (cat === 'watch' ? 'à la ' : 'aux ') + L.nom);
        }
        try {
            localStorage.setItem(L.cle + 'Nom', JSON.stringify(T[0]));
            localStorage.setItem(L.cle + 'Url', JSON.stringify(T[1]));
            localStorage.setItem(L.cle + 'Img', JSON.stringify(T[2]));
        } catch (e) { toast('Impossible d\'enregistrer sur cet appareil.', true); return; }
        document.dispatchEvent(new CustomEvent('as-listes-maj', { detail: { cat: cat } }));
        envoyerAuCompte(cat, T);
    }

    /* ---------- Petit message en bas de l'écran ---------- */
    function toast(message, alerte) {
        var ancien = document.querySelector('.pf-toast');
        if (ancien) ancien.remove();
        var t = document.createElement('div');
        t.className = 'pf-toast' + (alerte ? ' pf-toast-alerte' : '');
        t.textContent = message;
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 3000);
    }

    /* ---------- Menu ⋯ ---------- */
    var ouvert = null;   // { bouton, cat, url, nom, img }
    function echapper(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]; });
    }
    function fermer() {
        var menu = document.getElementById('pfCarteMenu');
        if (menu) menu.hidden = true;
        if (ouvert && ouvert.bouton) ouvert.bouton.setAttribute('aria-expanded', 'false');
        ouvert = null;
    }
    function ouvrir(bouton) {
        var carte = bouton.closest('[data-url]');
        if (!carte) return;
        if (ouvert && ouvert.bouton === bouton) { fermer(); return; }
        fermer();
        var menu = document.getElementById('pfCarteMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'pfCarteMenu'; menu.className = 'pf-carte-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
        }
        if (menu.parentElement !== document.body) document.body.appendChild(menu);   // coordonnées de page

        var cat = carte.getAttribute('data-cat') || 'oeuvre';
        var url = carte.getAttribute('data-url');
        var titre = carte.querySelector('.as-carte-titre');
        var image = carte.querySelector('.as-carte-image img');
        ouvert = {
            bouton: bouton, cat: cat, url: url,
            nom: carte.getAttribute('data-nom') || (titre ? titre.textContent : ''),
            img: carte.getAttribute('data-img') || (image ? image.src : '')
        };

        var html = '';
        ['watch', 'fav', 'vu'].forEach(function (c) {
            if (c === cat) return;                     // sa propre liste : « Retirer » plus bas
            var dedans = indexDans(c, url) !== -1;
            html += '<button type="button" role="menuitemcheckbox" aria-checked="' + dedans + '" data-action="liste" data-liste="' + c + '">' +
                ICONES[c] + '<span>' + (dedans ? 'Dans ' : 'Ajouter : ') + LISTES[c].libelle + '</span>' + (dedans ? '<span class="pf-coche">✓</span>' : '') + '</button>';
        });
        if (!LISTES[cat]) {                            // historique, œuvre : lien vers la fiche
            html += '<button type="button" role="menuitem" data-action="fiche">' + ICONES.fiche + '<span>Voir la fiche</span></button>';
        }
        if (NOMS_LISTES[cat]) {
            html += '<div class="pf-menu-sep"></div>';
            html += '<button type="button" role="menuitem" class="pf-menu-danger" data-action="retirer">' + ICONES.retirer + '<span>Retirer de ' + echapper(NOMS_LISTES[cat]) + '</span></button>';
        }
        menu.innerHTML = html;

        // Sous le bouton, sans sortir de l'écran (au-dessus s'il n'y a pas la place)
        menu.hidden = false;
        var r = bouton.getBoundingClientRect(), larg = menu.offsetWidth;
        var gauche = r.right - larg + window.scrollX;
        gauche = Math.max(window.scrollX + 8, Math.min(gauche, window.scrollX + document.documentElement.clientWidth - larg - 8));
        var haut = r.bottom + 6 + window.scrollY;
        if (r.bottom + 6 + menu.offsetHeight > window.innerHeight && r.top - menu.offsetHeight - 6 > 0) haut = r.top - menu.offsetHeight - 6 + window.scrollY;
        menu.style.left = gauche + 'px';
        menu.style.top = haut + 'px';
        bouton.setAttribute('aria-expanded', 'true');
        var premier = menu.querySelector('button');
        if (premier) premier.focus({ preventScroll: true });
    }
    function action(quoi, liste) {
        var m = ouvert;
        if (!m) return;
        fermer();
        if (quoi === 'liste') basculer(liste, m.url, m.nom, m.img);
        else if (quoi === 'fiche') window.location.href = ficheDe(m.url);
        else if (quoi === 'retirer') {
            if (LISTES[m.cat]) basculer(m.cat, m.url, m.nom, m.img);      // Watchlist / Favoris / Vus
            else document.dispatchEvent(new CustomEvent('as-carte-retirer', { detail: { cat: m.cat, url: m.url } }));   // historique : profil.js
        }
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.pf-carte-btn');
        if (btn) { e.preventDefault(); e.stopPropagation(); ouvrir(btn); return; }
        var item = e.target.closest('#pfCarteMenu button');
        if (item) { e.preventDefault(); action(item.getAttribute('data-action'), item.getAttribute('data-liste')); return; }
        if (!e.target.closest('#pfCarteMenu')) fermer();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && ouvert) { var b = ouvert.bouton; fermer(); if (b) b.focus(); }
    });
    window.addEventListener('resize', fermer);

    /* ---------- Webtoons en couleur ----------
       La liste des œuvres webtoon (manhwa, manhua…) vient de /api/webtoons.php,
       gardée 30 min dans le navigateur (une œuvre ajoutée apparaît vite en « Webtoon »). Les cartes de scans de ces œuvres gardent leurs couleurs,
       y compris celles dessinées après coup (historique, profil). */
    var webtoons = null;
    function appliquerWebtoons(racine) {
        if (!webtoons) return;
        (racine || document).querySelectorAll('.as-carte-scan:not(.as-carte-couleur)').forEach(function (c) {
            if (!webtoons[slugDe(c.getAttribute('data-url'))]) return;
            c.classList.add('as-carte-couleur');
            var badge = c.querySelector('.as-badge-scan');
            if (badge) { badge.textContent = 'Webtoon'; badge.classList.remove('as-badge-scan'); badge.classList.add('as-badge-webtoon'); }
        });
    }
    function chargerWebtoons() {
        try {
            var cache = JSON.parse(localStorage.getItem('asWebtoons') || 'null');
            if (cache && cache.t && Date.now() - cache.t < 30 * 60 * 1000 && Array.isArray(cache.slugs)) {
                webtoons = {}; cache.slugs.forEach(function (s) { webtoons[s] = true; });
                appliquerWebtoons();
                return;
            }
        } catch (e) {}
        fetch('/api/webtoons.php?v=2').then(function (r) { return r.ok ? r.json() : []; }).then(function (slugs) {
            if (!Array.isArray(slugs)) return;
            webtoons = {}; slugs.forEach(function (s) { webtoons[s] = true; });
            try { localStorage.setItem('asWebtoons', JSON.stringify({ t: Date.now(), slugs: slugs })); } catch (e) {}
            appliquerWebtoons();
        }).catch(function () {});
    }
    function demarrer() {
        if (!document.querySelector('.as-carte') && !document.getElementById('containerVisionnages') && !document.getElementById('pfGrid')) return;
        chargerWebtoons();
        // Cartes ajoutées plus tard (historique, profil, catalogue en direct) : on ne surveille
        // que ces zones, pas toute la page (l'horloge du planning change chaque seconde, les pubs aussi…)
        var attente = null;
        var surveillant = new MutationObserver(function () {
            if (attente) return;
            attente = setTimeout(function () { attente = null; appliquerWebtoons(); }, 50);
        });
        ['containerVisionnages', 'pfGrid', 'pfRepriseRangee', 'list_catalog'].forEach(function (id) {
            var zone = document.getElementById(id);
            if (zone) surveillant.observe(zone, { childList: true, subtree: true });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
    else demarrer();

    // Vignette pas encore prête (contenu/thumb/xxx.webp introuvable) : on affiche la grande image à la place
    document.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || img.getAttribute('data-repli')) return;
        var m = /^(.*\/contenu\/)thumb\/([^\/?#]+)\.webp(?:[?#].*)?$/.exec(img.getAttribute('src') || '');
        if (!m) return;
        img.setAttribute('data-repli', '1');
        img.src = m[1] + m[2] + '.jpg';
    }, true);

    window.AS_CARTE = { slugDe: slugDe, ficheDe: ficheDe, toast: toast, basculer: basculer };
})();
