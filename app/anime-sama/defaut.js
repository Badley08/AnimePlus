/*
 * Anti Pop-Ads back-button Protection
 */
/*
(function () {
  "use strict";
  var BAD = ["kettledroopingcontinuation.com", "spendsdetachment.com"];
  function isBad(u){ u=String(u||""); for(var i=0;i<BAD.length;i++){ if(u.indexOf(BAD[i])!==-1) return true; } return false; }

  // Bloque les pop-ups vers ces domaines
  var _open = window.open;
  window.open = function(url){ if(isBad(url)){ return null; } return _open.apply(window, arguments); };

  // Neutralise le piège "back button" : refuse toute injection d'historique
  // vers un AUTRE site (c'est ce que fait la pub pour piéger le bouton précédent)
  function guard(fn){
    return function(state, title, url){
      try { if(url){ var d=new URL(url, location.href); if(d.origin!==location.origin || isBad(d.href)) return; } } catch(e){}
      return fn.apply(history, arguments);
    };
  }
  history.pushState = guard(history.pushState);
  history.replaceState = guard(history.replaceState);
})();


/*
 * Anti Pop-Ads Protection
 */
/*
(function () {
    'use strict';

    // ── Config ──
    var MON_DOMAINE = window.location.hostname;

    // Classes et IDs légitimes de ton site à ne jamais toucher
    var WHITELIST = [
        'asn-mobile-menu',
        'asn-menu-backdrop',
        'asn-menu-panel',
        'asn-menu-nav',
        'asn-navbar',
        'asn-burger',
        'asn-mobile-search',
        'asn-nav-desktop',
        'ad-container',
        'ad-content',
        'blocEntier',
        'sousBlocLeft',
        'sousBlocMiddle',
        'sousBlocRight',
        'blocBottom'
    ];

    function estLegit(el) {
        if (!el) return false;

        // Vérifie l'élément lui-même
        for (var i = 0; i < WHITELIST.length; i++) {
            if (el.classList && el.classList.contains(WHITELIST[i])) return true;
            if (el.id === WHITELIST[i]) return true;
        }

        // Vérifie si un parent est whitelisté
        var parent = el.parentElement;
        while (parent && parent !== document.body) {
            for (var j = 0; j < WHITELIST.length; j++) {
                if (parent.classList && parent.classList.contains(WHITELIST[j])) return true;
                if (parent.id === WHITELIST[j]) return true;
            }
            parent = parent.parentElement;
        }

        return false;
    }

    // =============================================
    // 1. Bloquer window.open (pop-ups / pop-unders)
    // =============================================
    var originalOpen = window.open;
    var lastUserClick = 0;

    document.addEventListener('click', function () {
        lastUserClick = Date.now();
    }, true);

    window.open = function (url, name, features) {
        var timeSinceClick = Date.now() - lastUserClick;

        if (timeSinceClick < 500 && url && url.indexOf(MON_DOMAINE) !== -1) {
            return originalOpen.call(window, url, name, features);
        }

        console.warn('[Anti-PopAd] window.open bloqué:', url);
        return null;
    };

    // =============================================
    // 2. Bloquer les liens invisibles injectés
    // =============================================
    document.addEventListener('click', function (e) {
        var el = e.target;

        while (el && el !== document.body) {
            if (el.tagName === 'A') {
                if (estLegit(el)) return; // lien légitime du site

                var href = el.getAttribute('href') || '';
                var style = window.getComputedStyle(el);
                var isOverlay = el.offsetWidth > window.innerWidth * 0.3
                    && el.offsetHeight > window.innerHeight * 0.3;
                var isInvisible = parseFloat(style.opacity) < 0.1
                    || style.visibility === 'hidden';
                var isExternal = href && href.indexOf(MON_DOMAINE) === -1
                    && href.indexOf('http') === 0;

                if (isExternal && (isOverlay || isInvisible)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    console.warn('[Anti-PopAd] Clic sur lien piégé bloqué:', href);
                    return false;
                }
            }
            el = el.parentElement;
        }
    }, true);

    // =============================================
    // 3. Supprimer les overlays invisibles
    // =============================================
    function nettoyerOverlays() {
        var elements = document.querySelectorAll('div, a, span, iframe');

        elements.forEach(function (el) {
            if (estLegit(el)) return; // ne jamais toucher aux éléments du site

            var style;
            try {
                style = window.getComputedStyle(el);
            } catch (e) {
                return;
            }

            var isFixed = style.position === 'fixed' || style.position === 'absolute';
            var highZ = parseInt(style.zIndex) > 9000;
            var isLarge = el.offsetWidth > window.innerWidth * 0.7
                && el.offsetHeight > window.innerHeight * 0.7;
            var isTiny = el.offsetWidth === 0 && el.offsetHeight === 0
                && el.tagName === 'IFRAME';
            var isTransparent = parseFloat(style.opacity) < 0.1
                || style.background === 'transparent'
                || style.backgroundColor === 'transparent'
                || style.backgroundColor === 'rgba(0, 0, 0, 0)';

            // Grand overlay invisible en position fixe
            if (isFixed && isLarge && (highZ || isTransparent)) {
                el.remove();
                console.warn('[Anti-PopAd] Overlay supprimé:', el.tagName, el.className);
            }

            // Iframe 0x0 caché (tracking/pop-under)
            if (isTiny && isFixed) {
                el.remove();
                console.warn('[Anti-PopAd] Iframe caché supprimé');
            }
        });
    }

    // Un seul nettoyage initial après le chargement.
    // Les injections dynamiques (pubs qui s'ajoutent après) sont déjà
    // interceptées par le MutationObserver ci-dessous, donc le scan complet
    // répété toutes les 3s (très coûteux) n'est plus nécessaire.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(nettoyerOverlays, 2000);
        });
    } else {
        setTimeout(nettoyerOverlays, 2000);
    }

    // =============================================
    // 4. Observer les ajouts dynamiques au DOM
    // =============================================
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return;
                if (!node.tagName) return;
                if (estLegit(node)) return; // élément légitime, on ignore

                var style;
                try {
                    style = window.getComputedStyle(node);
                } catch (e) {
                    return;
                }

                if ((style.position === 'fixed' || style.position === 'absolute')
                    && node.offsetWidth > window.innerWidth * 0.7
                    && node.offsetHeight > window.innerHeight * 0.7
                    && parseInt(style.zIndex) > 5000) {

                    setTimeout(function () {
                        if (document.body.contains(node) && !estLegit(node)) {
                            node.remove();
                            console.warn('[Anti-PopAd] Élément injecté supprimé:', node.tagName, node.className);
                        }
                    }, 100);
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();*/

/* Menu Mobile */
document.addEventListener('DOMContentLoaded', function() {
    const burger = document.querySelector('.asn-burger');
    const menu = document.querySelector('.asn-mobile-menu');
    const backdrop = document.querySelector('.asn-menu-backdrop');
    const navLinks = document.querySelectorAll('.asn-menu-nav a');

    if (burger && menu) {
        burger.addEventListener('click', function() {
            menu.classList.toggle('asn-active');
        });
    }

    if (backdrop && menu) {
        backdrop.addEventListener('click', function() {
            menu.classList.remove('asn-active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            menu.classList.remove('asn-active');
        });
    });

    // Le choix logo avec/sans écriture se fait maintenant en CSS (defaut.css) :
    // avant, il se faisait ici après l'affichage, d'où le petit logo visible 0,5 s.
});

$(document).ready(function(){

    /* ---------- Recherche de la navbar ----------
       - 180 ms de pause après la dernière frappe, et toute requête encore
         en vol est annulée (1 requête au lieu d'une par touche).
       - Les réponses sont gardées en mémoire : recliquer dans le champ
         réaffiche les résultats sans refaire de requête.
       - Flèches haut/bas pour choisir, Entrée pour ouvrir, Échap pour fermer.
       - « Aucun résultat » s'affiche au lieu d'une liste qui disparaît.   */

    var searchTimer = null;
    var searchXhr   = null;
    var searchCache = {};          // requête -> HTML déjà reçu
    var $inputs     = $('input[name="search_text"]');
    var $panels     = $('#asn-result-desktop, #asn-result-mobile');

    function renderResults(html){
        $panels.html(html);
    }

    function clearResults(){
        $panels.empty();
    }

    function load_data(query, done){
        if (searchCache[query] !== undefined) {
            renderResults(searchCache[query]);
            if (done) done();
            return;
        }
        if (searchXhr) searchXhr.abort();
        searchXhr = $.ajax({
            url: "/template-php/defaut/fetch.php",
            method: "POST",
            data: { query: query },
            success: function(data){
                searchXhr = null;
                searchCache[query] = data;
                // Le champ a pu changer pendant la requête : on n'affiche
                // que si la réponse correspond encore à ce qui est tapé.
                if ($.trim($inputs.filter(':focus').val() || query) !== query) return;
                renderResults(data);
                if (done) done();
            },
            error: function(_x, status){
                if (status !== 'abort') searchXhr = null;
            }
        });
    }

    function scheduleSearch(query){
        clearTimeout(searchTimer);
        // 2 lettres minimum : une seule lettre ramène n'importe quoi
        if (query.length < 2){
            if (searchXhr) { searchXhr.abort(); searchXhr = null; }
            clearResults();
            return;
        }
        // Rien d'affiché encore : petit message le temps que la réponse arrive
        if (searchCache[query] === undefined && !$panels.children('.asn-search-result').length) {
            renderResults('<p class="asn-search-attente">Recherche…</p>');
        }
        searchTimer = setTimeout(function(){ load_data(query); }, 180);
    }

    // Le panneau de résultats visible (ordinateur ou mobile)
    function visiblePanel(){
        var $d = $('#asn-result-desktop');
        return $d.is(':visible') ? $d : $('#asn-result-mobile');
    }

    function moveSelection(step){
        var $items = visiblePanel().find('.asn-search-result');
        if (!$items.length) return;
        var i = $items.index($items.filter('.est-choisi'));
        i = (i + step + $items.length) % $items.length;
        $items.removeClass('est-choisi').eq(i).addClass('est-choisi')[0].scrollIntoView({ block: 'nearest' });
    }

    function openSelection(){
        var $items = visiblePanel().find('.asn-search-result');
        var $l = $items.filter('.est-choisi').first();
        if (!$l.length) $l = $items.first();
        if ($l.length) { window.location.href = $l.attr('href'); return true; }
        return false;
    }

    $inputs.on('input search', function(){
        scheduleSearch($.trim($(this).val()));
    });

    $inputs.on('focus', function(){
        var search = $.trim($(this).val());
        if (search !== '') scheduleSearch(search);
    });

    // keydown et pas keyup : il faut bloquer la soumission avant qu'elle parte.
    $inputs.on('keydown', function(e){
        if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); moveSelection(-1); return; }
        if (e.key === 'Escape')    { clearResults(); this.blur(); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();

        var query = $.trim($(this).val());
        if (query === '') return;
        if (openSelection()) return;

        // Rien d'affiché encore (frappe rapide + Entrée immédiate) :
        // on lance la requête et on ouvre dès que la réponse arrive.
        clearTimeout(searchTimer);
        load_data(query, openSelection);
    });

    // La souris et le clavier partagent la même sélection
    $panels.on('mouseenter', '.asn-search-result', function(){
        $panels.find('.asn-search-result').removeClass('est-choisi');
        $(this).addClass('est-choisi');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('input[name="search_text"], #asn-result-desktop, #asn-result-mobile').length) {
            clearResults();
        }
    });

    // Le glisser à la souris des rangées est maintenant géré par js/defaut/rangees.js

});

$('body').on('contextmenu', 'img', function(e){return false;});

function decalRight(idContainer){ document.getElementById(idContainer).scrollLeft += 1000; }
function decalLeft(idContainer){ document.getElementById(idContainer).scrollLeft -= 1000; }

function topFunction() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Throttle via requestAnimationFrame : au lieu d'exécuter le calcul à chaque
// événement de scroll (60+/s), on ne le fait qu'une fois par frame d'affichage.
// { passive: true } indique au navigateur qu'on ne bloquera jamais le scroll,
// ce qui lui permet de scroller de façon fluide sans attendre notre code.
let _scrollTicking = false;
document.addEventListener('scroll', function () {
    if (!_scrollTicking) {
        _scrollTicking = true;
        requestAnimationFrame(function () {
            updateScrollProgress();
            _scrollTicking = false;
        });
    }
}, { passive: true });
window.addEventListener('load', updateScrollProgress);

function updateScrollProgress() {
    const svg = document.getElementById('scrollProgressSvg');
    if (!svg) return;
    const circle = svg.querySelector('circle');
    if (!circle) return;

    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollRatio = scrollHeight === 0 ? 0 : scrollTop / scrollHeight;

    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - scrollRatio);

    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${offset}`;
}

/* ============================================
   SYNCHRONISATION GLOBALE DES DONNÉES
   ============================================ */

let _isLoggedInCache = null;
let _isLoggedInCacheTime = 0;
/* Une seule requête /api/get-data.php pour tous les scripts de la page (15/11/2026) : avant, l'en-tête,
   la liste des épisodes et le lecteur la demandaient chacun (2 à 3 fois par page). Les appels à moins
   de 3 s d'écart partagent la même réponse (chacun en reçoit sa copie). asGetData.oublier() : redemander. */
window.asGetData = window.asGetData || (function () {
    var p = null, t = 0;
    function lire() {
        var maintenant = Date.now();
        if (!p || maintenant - t > 3000) {
            t = maintenant;
            p = fetch('/api/get-data.php', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); });
            p.catch(function () { p = null; });
        }
        return p.then(function (d) { return JSON.parse(JSON.stringify(d)); });
    }
    lire.oublier = function () { p = null; };
    return lire;
})();
let _isLoggedInPending = null;
const CACHE_DURATION = 5000;

async function isUserLoggedIn() {
    const now = Date.now();
    if (_isLoggedInCache !== null && (now - _isLoggedInCacheTime) < CACHE_DURATION) {
        return _isLoggedInCache;
    }
    
    // Si une vérification est déjà en cours, on attend la même réponse au lieu
    // de relancer une requête (plusieurs scripts appellent ça au même moment).
    if (_isLoggedInPending) return _isLoggedInPending;

    _isLoggedInPending = (async function () {
        try {
            const data = await window.asGetData();
            _isLoggedInCache = data.logged_in === true;
            _isLoggedInCacheTime = Date.now();
            return _isLoggedInCache;
        } catch (e) {
            return false;
        } finally {
            _isLoggedInPending = null;
        }
    })();
    return _isLoggedInPending;
}

function invalidateLoginCache() {
    if (window.asGetData && window.asGetData.oublier) window.asGetData.oublier();
    _isLoggedInCache = null;
    _isLoggedInCacheTime = 0;
}

function isOnProfilePage() {
    return window.location.pathname.includes('/profil');
}

function isScanUrl(url) {
    return url.includes('/scan/') || url.includes('/scans/') || url.includes('/s2/');
}

/* ============================================
   FONCTIONS LOCALSTORAGE
   ============================================ */

function getProgressFromLocal(url) {
    if (isScanUrl(url)) {
        const name = localStorage.getItem('savedChapName' + url);
        const num = localStorage.getItem('savedChapNb' + url);
        if (name || num) {
            return {
                name: name ? JSON.parse(name) : '',
                num: parseInt(num) || 0
            };
        }
    } else {
        const name = localStorage.getItem('savedEpName' + url);
        const num = localStorage.getItem('savedEpNb' + url);
        if (name || num) {
            return {
                name: name ? JSON.parse(name) : '',
                num: parseInt(num) || 0
            };
        }
    }
    return null;
}

function setProgressToLocal(url, name, num) {
    if (isScanUrl(url)) {
        localStorage.setItem('savedChapName' + url, JSON.stringify(name));
        localStorage.setItem('savedChapNb' + url, num);
    } else {
        localStorage.setItem('savedEpName' + url, JSON.stringify(name));
        localStorage.setItem('savedEpNb' + url, num);
    }
}

function getAllProgressFromLocal() {
    const progress = {};
    const processedUrls = new Set();
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        let url = null;
        let isScan = false;
        
        if (key.startsWith('savedChapName')) {
            url = key.replace('savedChapName', '');
            isScan = true;
        } else if (key.startsWith('savedEpName')) {
            url = key.replace('savedEpName', '');
            isScan = false;
        } else {
            continue;
        }
        
        if (processedUrls.has(url)) continue;
        processedUrls.add(url);
        
        const shouldUseScanKey = isScanUrl(url);
        
        if (shouldUseScanKey && !isScan) continue;
        if (!shouldUseScanKey && isScan) continue;
        
        const data = getProgressFromLocal(url);
        if (data) {
            progress[url] = data;
        }
    }
    
    return progress;
}

// Dernier nombre d'un nom d'épisode / chapitre (« Episode 12 » → 12, « Chapitre 533.5 » → 533.5)
function numeroDansNom(nom) {
    const m = String(nom || '').match(/(\d+(?:[.,]\d+)?)(?!.*\d)/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

// Ancienne fonction (gardée pour les scripts qui l'appelleraient encore) : la progression vient
// maintenant de l'historique, voir asHisto juste en dessous.
function setAllProgressToLocal(serverProgress) {
    for (const [url, data] of Object.entries(serverProgress || {})) {
        if (!data || !data.name) continue;
        setProgressToLocal(url, data.name, parseInt(data.num, 10) || 0);
    }
}

/* ============================================
   HISTORIQUE + PROGRESSION ENTRE APPAREILS (refait le 21/11/2026)
   --------------------------------------------
   Avant : chaque appareil renvoyait tout son historique, qui remplaçait celui du compte, et
   l'épisode ne pouvait jamais reculer. Résultat : un appareil pas à jour (souvent le PC resté
   ouvert) remettait son épisode par-dessus celui choisi sur le téléphone, et passer du 5 au 3
   ne se synchronisait pas.

   Maintenant : chaque œuvre de l'historique a une date (histoT, horloge du serveur) = quand on a
   choisi cet épisode. Pour une même œuvre, le choix le plus récent gagne, même s'il recule.
   On n'envoie que l'œuvre qui change (api/sync-history.php, op « maj »). Les retraits et
   « vider » sont mémorisés sur le compte pour qu'un vieil appareil ne les fasse pas revenir.

   asHisto.pret      : promesse, résolue quand la synchro du chargement est faite (4 s max).
                       Les pages épisode / scan l'attendent avant de se placer.
   asHisto.enregistrer(entrée, {ouverture}) : l'œuvre de la page (ouverture = simple ouverture,
                       pas un choix d'épisode).
   asHisto.retirer(urls) / asHisto.vider() : profil.
   Événement « as-histo-maj » (detail.urls) : un autre appareil a changé ces œuvres.
   ============================================ */
window.asHisto = (function () {
    var COLS = { nom: 'histoNom', url: 'histoUrl', img: 'histoImg', type: 'histoType', lang: 'histoLang', ep: 'histoEp', num: 'histoNum', t: 'histoT' };
    var CAP = 500;
    var VRAIE_DATE = 1e11;          // en dessous : ancienne ligne sans date (1, 2, 3…)
    var decalage = 0;               // heure du serveur - heure de l'appareil (ms)
    try { decalage = parseInt(localStorage.getItem('histoDecalage'), 10) || 0; } catch (e) {}
    var etat = 'attente';           // attente | ok | hors-compte | echec
    var derniereSynchro = 0;
    var finir;
    var vraiPret = new Promise(function (r) { finir = r; });
    var pret = Promise.race([vraiPret, new Promise(function (r) { setTimeout(r, 4000); })]);

    function maintenant() { return Date.now() + decalage; }
    function estScan(url) { return url.indexOf('/scan/') !== -1 || url.indexOf('/scans/') !== -1 || url.indexOf('/s2/') !== -1; }

    function lireCol(k) {
        try { var a = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function texte(v) { return (v === null || v === undefined) ? '' : String(v); }
    function propre(e, tDefaut) {
        var t = parseInt(e.t, 10);
        return {
            nom: texte(e.nom), url: texte(e.url), img: texte(e.img), type: texte(e.type), lang: texte(e.lang),
            ep: texte(e.ep), num: parseInt(e.num, 10) || 0, t: t > 0 ? t : tDefaut
        };
    }
    // colonnes {nom:[…], url:[…], …} → lignes [{nom, url, …, t}] (une seule ligne par œuvre)
    function versLignes(c) {
        var urls = Array.isArray(c.url) ? c.url : [], out = [], ou = {};
        for (var i = 0; i < urls.length; i++) {
            if (!urls[i] || typeof urls[i] !== 'string') continue;
            var e = {};
            for (var k in COLS) e[k] = Array.isArray(c[k]) ? c[k][i] : undefined;
            var l = propre(e, i + 1);
            if (ou[l.url] === undefined) { ou[l.url] = out.length; out.push(l); }
            else if (l.t >= out[ou[l.url]].t) out[ou[l.url]] = l;
        }
        return out;
    }
    function lire() {
        var c = {};
        for (var k in COLS) c[k] = lireCol(COLS[k]);
        return versLignes(c);
    }
    function ecrire(lignes) {
        lignes = lignes.slice().sort(function (a, b) { return a.t - b.t; });
        if (lignes.length > CAP) lignes = lignes.slice(lignes.length - CAP);
        for (var k in COLS) {
            localStorage.setItem(COLS[k], JSON.stringify(lignes.map(function (l) { return l[k]; })));
        }
    }
    function colonnes() {
        var lignes = lire(), c = {};
        for (var k in COLS) c[k] = lignes.map(function (l) { return l[k]; });
        return c;
    }

    // savedEp* / savedChap* = copie de l'historique, lue par les pages épisode / scan
    function lireProgression(url) {
        var p = estScan(url) ? 'savedChap' : 'savedEp';
        try { return JSON.parse(localStorage.getItem(p + 'Name' + url)); } catch (e) { return null; }
    }
    function poserProgression(l) {
        if (!l.ep) return;
        var p = estScan(l.url) ? 'savedChap' : 'savedEp';
        localStorage.setItem(p + 'Name' + l.url, JSON.stringify(l.ep));
        localStorage.setItem(p + 'Nb' + l.url, l.num);
    }
    function effacerProgression(url) {
        ['savedChapName', 'savedChapNb', 'savedEpName', 'savedEpNb'].forEach(function (k) { localStorage.removeItem(k + url); });
    }

    // Envois, dans l'ordre, un à la fois
    var chaine = Promise.resolve();
    function envoyer(corps) {
        chaine = chaine.then(function () {
            return fetch('/api/sync-history.php', {
                method: 'POST', credentials: 'same-origin', keepalive: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(corps)
            }).then(function (r) { return r.ok ? r.json() : null; })
              .then(function (d) { if (d && Array.isArray(d.refus) && d.refus.length) appliquerRefus(d.refus); })
              .catch(function () {});
        });
        return chaine;
    }
    // Le compte avait plus récent (autre appareil) ou l'œuvre a été retirée : on se remet à jour
    function appliquerRefus(refus) {
        var lignes = lire(), ou = {}, urls = [];
        lignes.forEach(function (l, i) { ou[l.url] = i; });
        refus.forEach(function (r) {
            if (!r || !r.url || ou[r.url] === undefined) return;
            if (r.retire) { lignes[ou[r.url]] = null; effacerProgression(r.url); urls.push(r.url); return; }
            var s = propre(r, 0);
            if (s.t > lignes[ou[r.url]].t) { lignes[ou[r.url]] = s; poserProgression(s); urls.push(r.url); }
        });
        if (!urls.length) return;
        ecrire(lignes.filter(Boolean));
        prevenir(urls);
    }
    function prevenir(urls) {
        try { document.dispatchEvent(new CustomEvent('as-histo-maj', { detail: { urls: urls } })); } catch (e) {}
    }

    // Mises à jour regroupées (la page d'épisode se place plusieurs fois au chargement)
    var enAttente = {}, minuteur = null;
    function vider_file() {
        clearTimeout(minuteur); minuteur = null;
        var entrees = Object.keys(enAttente).map(function (u) { return enAttente[u]; });
        enAttente = {};
        if (entrees.length && etat !== 'hors-compte') envoyer({ op: 'maj', entrees: entrees });
    }
    function planifier(l) {
        enAttente[l.url] = l;
        clearTimeout(minuteur);
        minuteur = setTimeout(function () { vraiPret.then(vider_file); }, 400);
    }
    window.addEventListener('pagehide', function () { if (etat !== 'attente' && minuteur) vider_file(); });

    function enregistrer(e, opts) {
        if (!e || !e.url) return;
        var ouverture = !!(opts && opts.ouverture);
        var lignes = lire(), i = -1, maxT = 0;
        for (var j = 0; j < lignes.length; j++) {
            if (lignes[j].url === e.url) i = j;
            if (lignes[j].t > maxT) maxT = lignes[j].t;
        }
        var l = propre(e, 0);
        var synchroFaite = (etat === 'ok' || etat === 'hors-compte');
        if (ouverture && !synchroFaite) {
            // le compte n'a pas encore répondu : simple ouverture = on ne date rien (sinon
            // une valeur pas à jour passerait pour un choix récent) et on n'envoie rien
            l.t = i !== -1 ? lignes[i].t : 1;
        } else {
            l.t = Math.max(maintenant(), maxT + 1);
        }
        if (i !== -1) lignes[i] = l; else lignes.push(l);
        ecrire(lignes);
        poserProgression(l);
        if (!(ouverture && !synchroFaite)) planifier(l);
    }

    function retirer(urls) {
        urls = (urls || []).filter(Boolean);
        if (!urls.length) return Promise.resolve();
        ecrire(lire().filter(function (l) { return urls.indexOf(l.url) === -1; }));
        urls.forEach(function (u) { effacerProgression(u); delete enAttente[u]; });
        if (etat === 'hors-compte') return Promise.resolve();
        return vraiPret.then(function () { return etat === 'hors-compte' ? null : envoyer({ op: 'retirer', urls: urls }); });
    }
    function vider() {
        lire().forEach(function (l) { effacerProgression(l.url); });
        ecrire([]);
        enAttente = {};
        if (etat === 'hors-compte') return Promise.resolve();
        return vraiPret.then(function () { return etat === 'hors-compte' ? null : envoyer({ op: 'vider' }); });
    }

    /* Fusion avec l'historique du compte. Pour chaque œuvre, la date la plus récente gagne
       (égalité : le compte). Les lignes locales sans date et les œuvres retirées ailleurs
       cèdent au compte. Les lignes locales plus récentes (choisies hors ligne, ou dont l'envoi
       a échoué) sont renvoyées si pousser. Renvoie les œuvres changées par le compte. */
    function fusionner(srv, pousser) {
        if (!srv || !Array.isArray(srv.url)) return [];
        var locales = lire(), parUrl = {}, res = {}, envoi = [], changees = [];
        locales.forEach(function (l) { parUrl[l.url] = l; });
        var suppr = (srv.suppr && typeof srv.suppr === 'object' && !Array.isArray(srv.suppr)) ? srv.suppr : {};
        var vide = parseInt(srv.vide, 10) || 0;
        versLignes(srv).forEach(function (s) { res[s.url] = s; });
        locales.forEach(function (l) {
            if (l.t < VRAIE_DATE) return;                                         // ancienne ligne : le compte fait foi
            if (l.t <= Math.max(vide, parseInt(suppr[l.url], 10) || 0)) return;   // retirée ailleurs
            var s = res[l.url];
            if (!s || l.t > s.t) { res[l.url] = l; envoi.push(l); }
        });
        var lignes = Object.keys(res).map(function (u) { return res[u]; });
        ecrire(lignes);
        var gardees = {};
        lire().forEach(function (l) {
            gardees[l.url] = true;
            var a = parUrl[l.url];
            if (!a || a.ep !== l.ep || a.num !== l.num) changees.push(l.url);
            if (lireProgression(l.url) !== l.ep) poserProgression(l);
        });
        locales.forEach(function (l) {
            if (gardees[l.url]) return;
            changees.push(l.url);
            if (l.t <= Math.max(vide, parseInt(suppr[l.url], 10) || 0)) effacerProgression(l.url);
        });
        if (pousser) envoi.forEach(function (l) { if (gardees[l.url]) enAttente[l.url] = l; });
        return changees;
    }

    function noterHeureServeur(now) {
        now = parseInt(now, 10);
        if (!(now > VRAIE_DATE)) return;
        decalage = now - Date.now();
        try { localStorage.setItem('histoDecalage', String(decalage)); } catch (e) {}
    }

    function terminer(nouvelEtat) {
        etat = nouvelEtat;
        derniereSynchro = Date.now();
        finir(nouvelEtat);
        if (Object.keys(enAttente).length) vraiPret.then(vider_file);
    }

    // Retour sur un onglet resté ouvert : on reprend ce qui a été fait sur les autres appareils
    function resynchroniser() {
        if (etat !== 'ok' || Date.now() - derniereSynchro < 15000) return;
        derniereSynchro = Date.now();
        if (window.asGetData && window.asGetData.oublier) window.asGetData.oublier();
        window.asGetData().then(function (d) {
            if (!d || !d.logged_in || d.need_merge) return;
            noterHeureServeur(d.now);
            var avant = ['favoriUrl', 'watchlistUrl', 'vuUrl'].map(function (k) { return localStorage.getItem(k); }).join('|');
            var changees = fusionner(d.history, true);
            if (typeof updateListsFromServer === 'function') updateListsFromServer(d);
            var apres = ['favoriUrl', 'watchlistUrl', 'vuUrl'].map(function (k) { return localStorage.getItem(k); }).join('|');
            vider_file();
            if (!changees.length && avant === apres) return;
            if (changees.length) prevenir(changees);
            if (typeof updateUI === 'function') updateUI();
            if (typeof updateUIAfterLoad === 'function') updateUIAfterLoad();
        }).catch(function () {});
    }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') resynchroniser(); });
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) resynchroniser(); });

    // Import d'une sauvegarde (profil) : les lignes sans date prennent la date d'aujourd'hui
    // (dans l'ordre du fichier) puis tout part au compte, qui garde le plus récent.
    function apresImport() {
        var lignes = lire(), n = lignes.length, base = maintenant();
        lignes.forEach(function (l, i) { if (l.t < VRAIE_DATE) l.t = base - (n - i); });
        ecrire(lignes);
        lignes.forEach(poserProgression);
        if (etat === 'hors-compte') return Promise.resolve();
        return vraiPret.then(function () {
            if (etat === 'hors-compte') return null;
            return envoyer({ op: 'maj', entrees: lire() });
        });
    }

    return {
        pret: pret, enregistrer: enregistrer, retirer: retirer, vider: vider, apresImport: apresImport,
        fusionner: fusionner, colonnes: colonnes, noterHeureServeur: noterHeureServeur, terminer: terminer,
        etat: function () { return etat; }
    };
})();

/* ============================================
   LOGIQUE PRINCIPALE
   ============================================ */

async function loadAllDataFromServer() {
    let serverData;
    try {
        serverData = await window.asGetData();
    } catch (e) {
        window.asHisto.terminer('echec');
        return false;
    }
    try {
        window.asHisto.noterHeureServeur(serverData.now);

        if (!serverData.logged_in) {
            window.asHisto.terminer('hors-compte');
            return false;
        }

        if (serverData.need_merge === true) {
            // Première connexion sur ce navigateur : on fusionne ce qu'il contient avec le compte
            const localData = {
                favorites: {
                    nom: JSON.parse(localStorage.getItem('favoriNom')) || [],
                    url: JSON.parse(localStorage.getItem('favoriUrl')) || [],
                    img: JSON.parse(localStorage.getItem('favoriImg')) || []
                },
                watchlist: {
                    nom: JSON.parse(localStorage.getItem('watchlistNom')) || [],
                    url: JSON.parse(localStorage.getItem('watchlistUrl')) || [],
                    img: JSON.parse(localStorage.getItem('watchlistImg')) || []
                },
                viewed: {
                    nom: JSON.parse(localStorage.getItem('vuNom')) || [],
                    url: JSON.parse(localStorage.getItem('vuUrl')) || [],
                    img: JSON.parse(localStorage.getItem('vuImg')) || []
                },
                history: window.asHisto.colonnes()
            };

            try {
                const mergeResponse = await fetch('/api/merge-data.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(localData)
                });
                const mergeResult = await mergeResponse.json();
                if (!mergeResult.merged) throw new Error('fusion');

                window.asHisto.fusionner(mergeResult.merged.history, false);
                updateListsFromServer(mergeResult.merged);
                window.asHisto.terminer('ok');

                if (isOnProfilePage()) {
                    window.location.reload();
                    return true;
                }
            } catch (mergeError) {
                window.asHisto.terminer('echec');
                return false;
            }

        } else {
            window.asHisto.fusionner(serverData.history, true);
            updateListsFromServer(serverData);
            window.asHisto.terminer('ok');
        }

        if (typeof updateUI === 'function') updateUI();
        if (typeof updateUIAfterLoad === 'function') updateUIAfterLoad();

        return true;

    } catch (e) {
        window.asHisto.terminer('echec');
        return false;
    }
}

// Favoris, watchlist, vus (l'historique, lui, passe par asHisto.fusionner)
function updateListsFromServer(data) {
    if (data.favorites && data.favorites.nom) {
        localStorage.setItem('favoriNom', JSON.stringify(data.favorites.nom || []));
        localStorage.setItem('favoriUrl', JSON.stringify(data.favorites.url || []));
        localStorage.setItem('favoriImg', JSON.stringify(data.favorites.img || []));
    }

    if (data.watchlist && data.watchlist.nom) {
        localStorage.setItem('watchlistNom', JSON.stringify(data.watchlist.nom || []));
        localStorage.setItem('watchlistUrl', JSON.stringify(data.watchlist.url || []));
        localStorage.setItem('watchlistImg', JSON.stringify(data.watchlist.img || []));
    }

    if (data.viewed && data.viewed.nom) {
        localStorage.setItem('vuNom', JSON.stringify(data.viewed.nom || []));
        localStorage.setItem('vuUrl', JSON.stringify(data.viewed.url || []));
        localStorage.setItem('vuImg', JSON.stringify(data.viewed.img || []));
    }
}

/* ============================================
   FONCTIONS LEGACY (compatibilité)
   ============================================ */

function getLocalProgress() {
    return getAllProgressFromLocal();
}

function updateLocalStorageFromServer(serverData) {
    window.asHisto.fusionner(serverData.history, false);
    updateListsFromServer(serverData);
}

async function syncLocalProgressToServer() {
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) return;

    const progress = getAllProgressFromLocal();

    if (Object.keys(progress).length > 0) {
        fetch('/api/sync-progress.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({progress: progress})
        }).catch(() => {});
    }
}

async function syncMergedDataToServer() {
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) return;

    const favorites = {
        nom: JSON.parse(localStorage.getItem('favoriNom')) || [],
        url: JSON.parse(localStorage.getItem('favoriUrl')) || [],
        img: JSON.parse(localStorage.getItem('favoriImg')) || []
    };

    const watchlist = {
        nom: JSON.parse(localStorage.getItem('watchlistNom')) || [],
        url: JSON.parse(localStorage.getItem('watchlistUrl')) || [],
        img: JSON.parse(localStorage.getItem('watchlistImg')) || []
    };

    const viewed = {
        nom: JSON.parse(localStorage.getItem('vuNom')) || [],
        url: JSON.parse(localStorage.getItem('vuUrl')) || [],
        img: JSON.parse(localStorage.getItem('vuImg')) || []
    };

    fetch('/api/sync-favorites.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({favorites})
    }).catch(() => {});

    fetch('/api/sync-watchlist.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({watchlist})
    }).catch(() => {});

    fetch('/api/sync-viewed.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({viewed})
    }).catch(() => {});

    // l'historique ne s'envoie plus en entier (voir asHisto)
}

async function initializeUserData() {
    await new Promise(resolve => setTimeout(resolve, 500));
    const dataLoaded = await loadAllDataFromServer();
    if (dataLoaded && typeof updateUIAfterLoad === 'function') {
        updateUIAfterLoad();
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadAllDataFromServer();
});



// ADS
/* ── Masquer les containers si adblock empêche le chargement ──
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        document.querySelectorAll('.ad-container').forEach(function (container) {
            // On vérifie tout le container (pas seulement .ad-content) :
            // une bannière directe (<a><img>) peut être placée en dehors
            // de .ad-content, comme les bannières Gamivo.
            var hasAd = container.querySelector('iframe, img, canvas, ins, object');
 
            // Hauteur visible de .ad-content si présent, sinon du container entier
            var content = container.querySelector('.ad-content');
            var hasHeight = content
                ? content.offsetHeight > 10
                : container.offsetHeight > 10;
 
            if (!hasAd && !hasHeight) {
                container.classList.add('ad-hidden');
            }
        });
    }, 3000); // attend 3s que les pubs se chargent
});
*/