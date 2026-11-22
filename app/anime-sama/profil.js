/* ============================================================
   script_profils.js (v2) — Page profil "bibliothèque"
   - Rendu en onglets + recherche / tri / filtres (type, langue)
   - Suppression PAR URL (robuste avec tri/filtre actifs)
   - Conserve toute la logique de données + sync serveur existante
   - Préserve le "Reprenez votre visionnage" de l'accueil (#containerVisionnages)
   ============================================================ */

/* ---------- Utils ---------- */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ---------- Images : jumelles JS de cdn_img() / cdn_thumb() du header ----------
   Les URLs viennent du localStorage en raw.githubusercontent.com brut.
   cdnImg   -> passe par le CDN jsDelivr
   cdnThumb -> pointe vers la vignette WebP 440px (contenu/thumb/)
   Toute URL qui n'est pas une de nos images ressort inchangee.            */

function cdnImg(url) {
    if (!url) return url;
    return url.replace(
        '://raw.githubusercontent.com/Anime-Sama/IMG/img/',
        '://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/'
    );
}

function cdnThumb(url) {
    if (!url) return url;

    var cdn = cdnImg(url);

    var marker = '/gh/Anime-Sama/IMG@img/contenu/';
    var pos = cdn.indexOf(marker);
    if (pos === -1) return cdn;

    var prefix = cdn.slice(0, pos + marker.length);
    var file   = cdn.slice(pos + marker.length);

    // Pas de sous-dossier, pas de remontee de chemin.
    if (!file || /[\/\\?#]/.test(file) || file.indexOf('..') !== -1) return cdn;

    var name = decodeURIComponent(file).replace(/\.[^.]*$/, '');
    if (!name) return cdn;

    return prefix + 'thumb/' + encodeURIComponent(name) + '.webp';
}

function sanitizeUrl(url) {
    if (typeof url !== 'string') return '#';
    const u = url.trim();
    // Uniquement des chemins internes
    if (u.charAt(0) !== '/' || u.indexOf('//') !== -1) return '#';
    if (/^\s*(javascript|data|vbscript)\s*:/i.test(u)) return '#';
    return escapeHtml(u);
}

// Déduit le type (Anime/Scans) et la langue depuis l'URL interne
// Format attendu : /catalogue/{slug}/{section}/{langue}/
function parseWork(url) {
    const parts = String(url || '').split('/').filter(Boolean);
    let kind = 'Anime';
    let lang = '';
    if (parts.length >= 4) {
        if (parts[2].toLowerCase().indexOf('scan') !== -1) kind = 'Scans';
        lang = (parts[3] || '').toUpperCase();
    } else {
        if (String(url).indexOf('/scan') !== -1) kind = 'Scans';
        lang = (parts[parts.length - 1] || '').toUpperCase();
    }
    return { kind: kind, lang: lang };
}

/* ---------- Cartes (réutilisent card_styles_v4.css) ---------- */
const LANG_TO_FLAG = {
    'VF': 'flag_fr', 'VF1': 'flag_fr', 'VF2': 'flag_fr',
    'VO': 'flag_jp', 'VOSTFR': 'flag_jp', 'VJ': 'flag_jp', 'VJSTFR': 'flag_jp',
    'VA': 'flag_en', 'VASTFR': 'flag_en',
    'VKR': 'flag_kr', 'VCN': 'flag_cn', 'VAR': 'flag_ar', 'VQC': 'flag_qc'
};

function deleteBtnSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="delete-icon">' +
        '<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>';
}

function boutonMenuCarte() {
    return '<button class="pf-carte-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Actions" title="Actions">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" /></svg></button>';
}

function carteHistorique(nom, url, image, type, langue, episode, avecMenu) {
    const safeNom = escapeHtml(nom);
    const safeUrl = sanitizeUrl(url);
    const safeImage = escapeHtml(cdnThumb(image));
    const safeType = escapeHtml(type);
    const safeLangue = escapeHtml(langue);
    const safeEpisode = escapeHtml(episode);
    const flagCode = LANG_TO_FLAG[langue] || 'unknown';
    const isScan = (type === 'Scans') || (parseWork(url).kind === 'Scans');
    const cardClass = isScan ? 'scan-card-premium' : 'anime-card-premium';
    const badgeClass = isScan ? 'scan-badge' : 'anime-badge';
    const badgeText = isScan ? 'Scans' : 'Anime';
    const infoClass = isScan ? 'chapter' : 'episode';
    // « Saison 1 Episode 3 » s'affiche « S1 · Épisode 3 » (même règle que date_relative.php)
    const infoText = isScan ? safeEpisode : texteFilm(safeType + ' ' + safeEpisode)
        .replace(/\bSaison\s+(\d+)\s+(?:Episode|Épisode)s?\b/i, 'S$1 · Épisode')
        .replace(/\bSaison\s+(\d+)\b/i, 'S$1');
    const infoIcon = isScan
        ? '<path d="M10.75 16.82A7.46 7.46 0 0 1 15 15.5c.71 0 1.4.1 2.05.28A.75.75 0 0 0 18 15.06v-11a.75.75 0 0 0-.55-.72A9 9 0 0 0 15 3a8.96 8.96 0 0 0-4.25 1.07V16.82ZM9.25 4.07A8.96 8.96 0 0 0 5 3c-.85 0-1.67.12-2.45.34A.75.75 0 0 0 2 4.06v11a.75.75 0 0 0 .95.72A7.5 7.5 0 0 1 5 15.5c1.58 0 3.04.49 4.25 1.32V4.07Z" />'
        : '<path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.34-5.89a1.5 1.5 0 0 0 0-2.54L6.3 2.84Z" />';

    return '' +
    '<div class="carteHistorique shrink-0 card-base ' + cardClass + '" data-url="' + safeUrl + '" data-cat="histo">' +
        (avecMenu ? boutonMenuCarte() : '<button class="supprHistorique card-delete-btn" type="button" aria-label="Retirer de l\'historique">' + deleteBtnSvg() + '</button>') +
        '<a href="' + safeUrl + '">' +
            '<div class="card-image-container">' +
                '<img class="card-image" src="' + safeImage + '" alt="' + safeNom + '" loading="lazy">' +
                '<div class="image-overlay"></div><div class="image-shine"></div>' +
                '<div class="badge ' + badgeClass + '"><p class="badge-text">' + badgeText + '</p><div class="badge-glow"></div></div>' +
                '<div class="badge language-badge-middle">' +
                    '<img class="flag-icon" src="' + cdnImg('https://raw.githubusercontent.com/Anime-Sama/IMG/img/autres/' + flagCode + '.png') + '" alt="' + safeLangue + '" title="' + safeLangue + '" loading="lazy"><div class="badge-glow"></div>' +
                '</div>' +
            '</div>' +
            '<div class="card-content">' +
                '<h1 class="card-title uppercase">' + safeNom + '</h1>' +
                '<div class="content-divider"></div>' +
                '<div class="card-info"><div class="info-item ' + infoClass + ' text-sm">' +
                    '<svg class="info-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' + infoIcon + '</svg>' +
                    '<span>' + infoText + '</span>' +
                '</div></div>' +
            '</div>' +
        '</a>' +
    '</div>';
}

function carteCatalog(cat, nom, url, image, avecMenu) {
    const safeNom = escapeHtml(nom);
    const safeUrl = sanitizeUrl(url);
    const safeImage = escapeHtml(cdnThumb(image));
    const btnClass = (cat === 'fav') ? 'supprFavoris' : (cat === 'watch') ? 'supprWatchlist' : 'supprVus';
    const rootClass = (cat === 'fav') ? 'carteFavori' : (cat === 'watch') ? 'carteWatchlist' : 'carteVu';
    return '' +
    '<div class="' + rootClass + ' shrink-0 catalog-card" data-url="' + safeUrl + '" data-cat="' + cat + '">' +
        (avecMenu ? boutonMenuCarte() : '<button class="' + btnClass + ' card-delete-btn-catalog" type="button" aria-label="Retirer">' + deleteBtnSvg() + '</button>') +
        '<a href="' + safeUrl + '">' +
            '<div class="card-image-container">' +
                '<img class="card-image" src="' + safeImage + '" alt="' + safeNom + '" loading="lazy" decoding="async">' +
                '<div class="image-overlay"></div><div class="image-shine"></div>' +
            '</div>' +
            '<div class="card-content"><h1 class="card-title">' + safeNom + '</h1></div>' +
        '</a>' +
    '</div>';
}

/* ---------- Données ---------- */
var histoNom = [], histoUrl = [], histoImg = [], histoType = [], histoLang = [], histoEp = [], histoNum = [];
var favoriNom = [], favoriUrl = [], favoriImg = [];
var watchlistNom = [], watchlistUrl = [], watchlistImg = [];
var vuNom = [], vuUrl = [], vuImg = [];

// Lecture protégée d'une liste du navigateur. Avant, un seul JSON abîmé
// (ancienne version du site, extension, quota plein...) faisait planter tout
// le script : le profil restait vide. Ici une liste illisible devient [],
// et chaque valeur vide ou numérique devient du texte.
function lireListe(cle, enNombre) {
    var liste;
    try { liste = JSON.parse(localStorage.getItem(cle) || '[]'); }
    catch (e) { liste = []; }
    if (!Array.isArray(liste)) liste = [];
    return liste.map(function (v) {
        if (enNombre) return parseInt(v, 10) || 0;
        return (v === null || v === undefined) ? '' : String(v);
    });
}

function loadDataFromLocalStorage() {
    histoNom = lireListe('histoNom');
    histoUrl = lireListe('histoUrl');
    histoImg = lireListe('histoImg');
    histoType = lireListe('histoType');
    histoLang = lireListe('histoLang');
    histoEp = lireListe('histoEp');
    histoNum = lireListe('histoNum', true);
    favoriNom = lireListe('favoriNom');
    favoriUrl = lireListe('favoriUrl');
    favoriImg = lireListe('favoriImg');
    watchlistNom = lireListe('watchlistNom');
    watchlistUrl = lireListe('watchlistUrl');
    watchlistImg = lireListe('watchlistImg');
    vuNom = lireListe('vuNom');
    vuUrl = lireListe('vuUrl');
    vuImg = lireListe('vuImg');
}

// Construit la liste d'items normalisés d'une catégorie
function buildItems(cat) {
    const items = [];
    if (cat === 'histo') {
        for (let i = 0; i < histoUrl.length; i++) {
            if (!histoUrl[i]) continue; // entrée abîmée : on la saute
            let ep = histoEp[i];
            if (typeof getProgressFromLocal === 'function') {
                const p = getProgressFromLocal(histoUrl[i]);
                if (p && p.name) ep = p.name;
            }
            const meta = parseWork(histoUrl[i]);
            items.push({
                idx: i, nom: histoNom[i] || '', url: histoUrl[i], img: histoImg[i] || '',
                type: histoType[i] || '', lang: histoLang[i] || meta.lang, ep: ep,
                kind: meta.kind, flang: (histoLang[i] || meta.lang || '').toUpperCase()
            });
        }
    } else {
        const A = (cat === 'fav') ? [favoriNom, favoriUrl, favoriImg]
               : (cat === 'watch') ? [watchlistNom, watchlistUrl, watchlistImg]
               : [vuNom, vuUrl, vuImg];
        for (let i = 0; i < A[1].length; i++) {
            if (!A[1][i]) continue; // entrée abîmée : on la saute
            const meta = parseWork(A[1][i]);
            items.push({
                idx: i, nom: A[0][i] || '', url: A[1][i], img: A[2][i] || '',
                kind: meta.kind, flang: meta.lang
            });
        }
    }
    return items;
}

/* ---------- État de la bibliothèque ---------- */
var pfState = { tab: 'histo', q: '', sort: 'recent', type: 'all', lang: 'all', retard: false, page: 1 };
const PF_PER_PAGE = 60;
const PF_CATS = ['histo', 'watch', 'fav', 'vu'];
const PF_EMPTY_MSG = {
    histo: 'Aucune oeuvre dans votre historique.',
    watch: 'Votre watchlist est vide.',
    fav: 'Aucun favori pour le moment.',
    vu: 'Aucune oeuvre marquée comme vue.'
};
const PF_EMPTY_SUB = {
    histo: 'Les épisodes et chapitres que vous ouvrez apparaissent ici automatiquement.',
    watch: 'Ajoutez des oeuvres à regarder plus tard depuis leur fiche ou depuis l\'historique.',
    fav: 'Ajoutez vos oeuvres préférées depuis leur fiche ou depuis l\'historique.',
    vu: 'Marquez les oeuvres terminées depuis leur fiche ou depuis l\'historique.'
};

function pfCount(cat) {
    if (cat === 'histo') return histoUrl.length;
    if (cat === 'fav') return favoriUrl.length;
    if (cat === 'watch') return watchlistUrl.length;
    return vuUrl.length;
}

function updateLimitNote() {
    const note = document.getElementById('pfLimitNote');
    if (!note) return;
    const tab = pfState.tab;
    const count = pfCount(tab);
    if (count >= 500) {
        if (tab === 'histo') {
            note.textContent = 'Historique plein (500 max) : les oeuvres les plus anciennes sont automatiquement remplacées par les nouvelles.';
        } else {
            note.textContent = 'Liste pleine : 500 oeuvres maximum. Retire des oeuvres pour pouvoir en ajouter de nouvelles.';
        }
        note.hidden = false;
    } else {
        note.hidden = true;
        note.textContent = '';
    }
}

function renderLibrary() {
    const grid = document.getElementById('pfGrid');
    if (!grid) return; // pas sur la page profil

    // Compteurs d'onglets
    PF_CATS.forEach(function (c) {
        const el = document.querySelector('.pf-tab[data-tab="' + c + '"] .pf-count');
        if (el) {
            el.textContent = pfCount(c) + '/500';
            el.classList.toggle('pf-count-full', pfCount(c) >= 500);
        }
    });

    updateLimitNote();

    let items = buildItems(pfState.tab);

    // Les filtres "langue" et "type" n'ont de sens que pour l'HISTORIQUE.
    // Les favoris/watchlist/vus pointent vers la racine d'une oeuvre
    // (/catalogue/slug/), sans segment de langue ni de section : on masque donc
    // ces deux filtres et on ne les applique pas pour ces catégories.
    const isHisto = (pfState.tab === 'histo');
    const langDD = document.getElementById('pfLangDD');
    const seg = document.querySelector('.pf-segment');
    if (langDD) langDD.style.display = isHisto ? '' : 'none';
    if (seg) seg.style.display = isHisto ? '' : 'none';
    const segRetard = document.getElementById('pfRetardSeg');
    if (segRetard) segRetard.style.display = isHisto ? '' : 'none';
    const triNouveautes = document.querySelector('#pfSortDD [data-value="new"]');
    if (triNouveautes) triNouveautes.style.display = isHisto ? '' : 'none';

    if (isHisto) {
        // Options de langue (dropdown personnalisé) selon l'historique
        populateLangDropdown(items);
        avCharger(items);
    } else {
        pfState.lang = 'all';
        pfState.type = 'all';
        pfState.retard = false;
    }

    // Filtres
    const q = pfState.q.trim().toLowerCase();
    if (q) items = items.filter(function (it) { return (it.nom || '').toLowerCase().indexOf(q) !== -1; });
    if (isHisto && pfState.type !== 'all') items = items.filter(function (it) { return it.kind === pfState.type; });
    if (isHisto && pfState.lang !== 'all') items = items.filter(function (it) { return it.flang === pfState.lang; });
    if (isHisto && pfState.retard) items = items.filter(function (it) { return avRang(it) > 0; });

    // Tri
    if (pfState.sort === 'recent') items.sort(function (a, b) { return b.idx - a.idx; });
    else if (pfState.sort === 'old') items.sort(function (a, b) { return a.idx - b.idx; });
    else if (pfState.sort === 'az') items.sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || '', 'fr'); });
    else if (pfState.sort === 'za') items.sort(function (a, b) { return (b.nom || '').localeCompare(a.nom || '', 'fr'); });
    else if (pfState.sort === 'new') items.sort(function (a, b) { return (avRang(b) - avRang(a)) || (b.idx - a.idx); });

    // Rendu
    const pag = document.getElementById('pfPagination');
    if (items.length === 0) {
        const empty = (pfCount(pfState.tab) === 0)
            ? PF_EMPTY_MSG[pfState.tab]
            : 'Aucun résultat pour ces filtres.';
        const vide = (pfCount(pfState.tab) === 0);
        const sub = vide ? PF_EMPTY_SUB[pfState.tab] : 'Essayez de modifier la recherche ou les filtres.';
        const liens = vide
            ? '<div class="pf-empty-liens"><a href="/catalogue" class="pf-btn">Parcourir le catalogue</a><a href="/planning" class="pf-btn">Voir le planning</a></div>'
            : '';
        grid.innerHTML =
            '<div class="pf-empty">' +
            '<p>' + empty + '</p><p class="pf-empty-sub">' + sub + '</p>' + liens + '</div>';
        if (pag) pag.innerHTML = '';
        return;
    }

    // Pagination : on n'affiche qu'une page à la fois
    const perPage = PF_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    if (pfState.page > totalPages) pfState.page = totalPages;
    if (pfState.page < 1) pfState.page = 1;
    const startIdx = (pfState.page - 1) * perPage;
    const pageItems = items.slice(startIdx, startIdx + perPage);

    let html = '';
    pageItems.forEach(function (it) { html += carteAS(it, pfState.tab); });
    grid.innerHTML = html;

    renderPagination(totalPages, items.length, startIdx, pageItems.length);
}

/* ---------- Pagination ---------- */
function renderPagination(totalPages, totalItems, startIdx, shownCount) {
    const pag = document.getElementById('pfPagination');
    if (!pag) return;
    if (totalPages <= 1) {
        pag.innerHTML = '<div class="pf-page-info">' + totalItems + ' oeuvre' + (totalItems > 1 ? 's' : '') + '</div>';
        return;
    }
    const cur = pfState.page;
    const nums = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= cur - 1 && p <= cur + 1)) nums.push(p);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    let html = '<div class="pf-page-info">' + (startIdx + 1) + '–' + (startIdx + shownCount) + ' sur ' + totalItems + '</div>';
    html += '<div class="pf-page-btns">';
    html += '<button class="pf-page-btn" type="button" data-page="prev"' + (cur === 1 ? ' disabled' : '') + ' aria-label="Page précédente">‹</button>';
    nums.forEach(function (p) {
        if (p === '…') html += '<span class="pf-page-gap">…</span>';
        else html += '<button class="pf-page-btn' + (p === cur ? ' pf-page-current' : '') + '" type="button" data-page="' + p + '">' + p + '</button>';
    });
    html += '<button class="pf-page-btn" type="button" data-page="next"' + (cur === totalPages ? ' disabled' : '') + ' aria-label="Page suivante">›</button>';
    html += '</div>';
    pag.innerHTML = html;
}

function pfGoToPage(p) {
    if (p === 'prev') pfState.page = Math.max(1, pfState.page - 1);
    else if (p === 'next') pfState.page = pfState.page + 1;
    else pfState.page = parseInt(p, 10) || 1;
    renderLibrary();
    const lib = document.getElementById('pfLibrary');
    if (lib && lib.scrollIntoView) lib.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Rendu "Reprenez votre visionnage" (accueil) ---------- */
function renderRepriseVisionnage() {
    const repVisioContainer = document.getElementById('containerVisionnages');
    if (!repVisioContainer) return;

    repVisioContainer.querySelectorAll('.carteHistorique').forEach(function (el) { el.remove(); });
    repVisioContainer.querySelectorAll('p:not(.msgEmptyHisto)').forEach(function (el) { el.remove(); });

    const repVisioSection = document.getElementById('repVisio');
    const msgEmpty = repVisioContainer.querySelector('.msgEmptyHisto');

    if (histoNom.length === 0) {
        if (repVisioSection) repVisioSection.style.display = 'none';
        if (msgEmpty) msgEmpty.classList.remove('hidden');
        return;
    }
    if (repVisioSection) repVisioSection.style.display = 'block';
    if (msgEmpty) msgEmpty.classList.add('hidden');

    if (repVisioContainer.getAttribute('data-carte') === 'as') {
        repVisioContainer.querySelectorAll('.as-carte').forEach(function (el) { el.remove(); });
        const items = buildItems('histo').sort(function (a, b) { return b.idx - a.idx; }).slice(0, 20);
        repVisioContainer.insertAdjacentHTML('beforeend', items.map(function (it) { return carteAS(it, 'histo'); }).join(''));
        avCharger(items);
        return;
    }

    let html = '';
    const limit = Math.min(histoNom.length, 20);
    for (let i = histoNom.length - 1; i >= histoNom.length - limit; i--) {
        let currentEp = histoEp[i];
        if (typeof getProgressFromLocal === 'function') {
            const p = getProgressFromLocal(histoUrl[i]);
            if (p && p.name) currentEp = p.name;
        }
        html += carteHistorique(histoNom[i], histoUrl[i], histoImg[i], histoType[i], histoLang[i], currentEp);
    }
    repVisioContainer.insertAdjacentHTML('beforeend', html);
}

// Appelée par script_defaut après loadAllDataFromServer() ET au chargement
function updateUIAfterLoad() {
    loadDataFromLocalStorage();
    updateMemberStats();
    renderLibrary();
    renderRepriseVisionnage();
    renderRepriseProfil();
}

function updateMemberStats() {
    const chiffres = { pfStatHisto: histoUrl.length, pfStatWatch: watchlistUrl.length, pfStatFav: favoriUrl.length, pfStatVu: vuUrl.length };
    Object.keys(chiffres).forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = chiffres[id];
    });
}

/* ---------- Profil : rangée « Reprendre » (10 dernières oeuvres en cours) ---------- */
const PF_REPRISE_MAX = 10;

/* Films (12/11/2026) : la page d'un film a une liste « Episode 1 », la carte disait « Film Episode 1 ».
   « Film Episode 1 » -> « Film », « Film Episode 2 » -> « Film 2 », « Film Film 2 » -> « Film 2 ».
   Même règle côté serveur : template-php/home/date_relative.php (saison_courte). */
function texteFilm(texte) {
    return String(texte)
        .replace(/^(Films?)\s+(?:Episode|Épisode)\s+1\s*$/i, 'Film')
        .replace(/^(Films?)\s+(?:Episode|Épisode)\s+(\d+)\s*$/i, 'Film $2')
        .replace(/^(Films?)\s+(Films?\b)/i, '$2');
}

// « Saison 2 Episode 3 » -> « S2 · Épisode 3 » (même règle que les cartes)
function texteProgression(type, ep, isScan) {
    if (isScan) return ep || '';
    return texteFilm(((type || '') + ' ' + (ep || '')).trim())
        .replace(/\bSaison\s+(\d+)\s+(?:Episode|Épisode)s?\b/i, 'S$1 · Épisode')
        .replace(/\bSaison\s+(\d+)\b/i, 'S$1')
        .replace(/^Episode/i, 'Épisode');
}

/* Carte « as-carte » : image 16:9, titre et progression par-dessus, badge Anime / Scans,
   drapeau, bouton ⋯ ; au survol, ▶ pour un anime, livre ouvert pour des scans,
   rien pour une carte d'œuvre (Watchlist / Favoris / Vus). */
const AS_ICONE_JOUER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.34-5.89a1.5 1.5 0 0 0 0-2.54L6.3 2.84Z" /></svg>';
const AS_ICONE_LIRE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 16.82A7.46 7.46 0 0 1 15 15.5c.71 0 1.4.1 2.05.28A.75.75 0 0 0 18 15.06v-11a.75.75 0 0 0-.55-.72A9 9 0 0 0 15 3a8.96 8.96 0 0 0-4.25 1.07V16.82ZM9.25 4.07A8.96 8.96 0 0 0 5 3c-.85 0-1.67.12-2.45.34A.75.75 0 0 0 2 4.06v11a.75.75 0 0 0 .95.72A7.5 7.5 0 0 1 5 15.5c1.58 0 3.04.49 4.25 1.32V4.07Z" /></svg>';

/* ---------- Avancement de l'historique : « À jour » et « Nouveau · +2 » ----------
   /api/avancement.php situe l'épisode de chaque carte dans la liste de sa page. Réponses gardées
   5 minutes dans l'onglet ; une carte qu'on ne sait pas situer n'a simplement pas de badge. */
function avLire() {
    if (window.AS_AV) return window.AS_AV;
    window.AS_AV = { map: {}, debut: Date.now(), demandes: {} };
    try {
        const sauve = JSON.parse(sessionStorage.getItem('asAvancement'));
        if (sauve && Date.now() - sauve.t < 5 * 60 * 1000) { window.AS_AV.map = sauve.m || {}; window.AS_AV.debut = sauve.t; }
    } catch (e) {}
    return window.AS_AV;
}

function avCle(url, ep) { return url + '|' + ep; }

// 2 = sortie récente à voir, 1 = du retard, 0 = à jour ou inconnu
function avRang(it) {
    const a = avLire().map[avCle(it.url, it.ep)];
    return !a || a.r <= 0 ? 0 : (a.nv ? 2 : 1);
}

function avBadge(url, ep, isScan) {
    const a = avLire().map[avCle(url, ep)];
    if (!a) return '';
    if (a.r <= 0) return '<span class="as-etat as-av as-av-ajour">À jour</span>';
    // Du retard sans sortie récente : pas de badge (seulement « Nouveau » et « À jour »)
    if (a.nv) return '<span class="as-etat as-av as-av-nouveau">Nouveau · +' + a.r + '</span>';
    return '';
}

function avCharger(items) {
    const av = avLire();
    const manque = items.filter(function (it) {
        const cle = avCle(it.url, it.ep);
        return it.ep && !(cle in av.map) && !av.demandes[cle];
    }).slice(0, 500);
    if (manque.length === 0) return;
    manque.forEach(function (it) { av.demandes[avCle(it.url, it.ep)] = true; });
    fetch('/api/avancement.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: manque.map(function (it) { return { u: it.url, n: it.ep }; }) })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !Array.isArray(d.av)) return;
        manque.forEach(function (it, i) { av.map[avCle(it.url, it.ep)] = d.av[i] || null; });
        try { sessionStorage.setItem('asAvancement', JSON.stringify({ t: av.debut, m: av.map })); } catch (e) {}
        avAppliquer();
    }).catch(function () {});
}

// Pose les badges sur les cartes déjà affichées, sans les redessiner
function avAppliquer() {
    if (document.getElementById('pfGrid') && pfState.tab === 'histo' && (pfState.retard || pfState.sort === 'new')) renderLibrary();
    document.querySelectorAll('.as-carte[data-cat="histo"]').forEach(function (carte) {
        const badges = carte.querySelector('.as-carte-badges');
        if (!badges || badges.querySelector('.as-av')) return;
        const html = avBadge(carte.getAttribute('data-url'), carte.getAttribute('data-ep'), carte.classList.contains('as-carte-scan'));
        if (html) badges.insertAdjacentHTML('beforeend', html);
    });
}

function carteAS(it, cat) {
    const enCours = (cat === 'histo');
    const isScan = enCours && (it.kind === 'Scans' || it.type === 'Scans');
    const genre = !enCours ? 'oeuvre' : (isScan ? 'scan' : 'anime');
    let badges = '';
    if (enCours) {
        const flag = LANG_TO_FLAG[it.flang] || 'unknown';
        badges = '<div class="as-carte-badges">' +
            '<span class="as-badge as-badge-' + genre + '">' + (isScan ? 'Scans' : 'Anime') + '</span>' +
            '<span class="as-drapeau"><img src="' + cdnImg('https://raw.githubusercontent.com/Anime-Sama/IMG/img/autres/' + flag + '.png') + '" alt="' + escapeHtml(it.flang) + '" title="' + escapeHtml(it.flang) + '" loading="lazy"></span>' +
            avBadge(it.url, it.ep, isScan) +
        '</div>';
    }
    const survol = enCours ? '<span class="as-carte-survol">' + (isScan ? AS_ICONE_LIRE : AS_ICONE_JOUER) + '</span>' : '';
    const info = enCours
        ? '<div class="as-carte-info">' + (isScan ? AS_ICONE_LIRE : AS_ICONE_JOUER) + '<span>' + escapeHtml(texteProgression(it.type, it.ep, isScan)) + '</span></div>'
        : '';
    return '<div class="as-carte as-carte-' + genre + '" data-url="' + sanitizeUrl(it.url) + '" data-cat="' + cat + '"' +
        ' data-nom="' + escapeHtml(it.nom) + '" data-img="' + escapeHtml(it.img) + '"' +
        (enCours ? ' data-ep="' + escapeHtml(it.ep || '') + '"' : '') + '>' +
        '<a class="as-carte-lien" href="' + sanitizeUrl(it.url) + '" draggable="false">' +
            '<div class="as-carte-image"><img src="' + escapeHtml(cdnThumb(it.img)) + '" alt="" loading="lazy" decoding="async" draggable="false"></div>' +
            survol + badges +
            '<div class="as-carte-texte"><h3 class="as-carte-titre">' + escapeHtml(it.nom) + '</h3>' + info + '</div>' +
        '</a>' +
        boutonMenuCarte() +
    '</div>';
}

function renderRepriseProfil() {
    const section = document.getElementById('pfReprise');
    const rangee = document.getElementById('pfRepriseRangee');
    if (!section || !rangee) return;
    const items = buildItems('histo').sort(function (a, b) { return b.idx - a.idx; }).slice(0, PF_REPRISE_MAX);
    if (items.length === 0) { section.hidden = true; rangee.innerHTML = ''; return; }
    section.hidden = false;
    rangee.innerHTML = items.map(function (it) { return carteAS(it, 'histo'); }).join('');
}

/* ---------- Profil : le menu ⋯ des cartes est dans carte.js ----------
   carte.js prévient quand une liste change (« as-listes-maj ») ou quand on retire
   une carte de l'historique (« as-carte-retirer ») : on met la page à jour ici. */
document.addEventListener('as-listes-maj', function () { updateUIAfterLoad(); });
document.addEventListener('as-carte-retirer', async function (e) {
    const d = e.detail || {};
    if (PF_CATS.indexOf(d.cat) === -1) return;
    await removeByUrl(d.cat, d.url);
    if (window.AS_CARTE) window.AS_CARTE.toast('Retiré de l\'historique');
});

/* ---------- Suppression (par URL : robuste avec tri/filtre) ---------- */
function persistHisto() {
    localStorage.setItem('histoNom', JSON.stringify(histoNom));
    localStorage.setItem('histoUrl', JSON.stringify(histoUrl));
    localStorage.setItem('histoImg', JSON.stringify(histoImg));
    localStorage.setItem('histoType', JSON.stringify(histoType));
    localStorage.setItem('histoLang', JSON.stringify(histoLang));
    localStorage.setItem('histoEp', JSON.stringify(histoEp));
    localStorage.setItem('histoNum', JSON.stringify(histoNum));
}
function clearLocalProgress(url) {
    if (!url) return;
    localStorage.removeItem('savedChapName' + url);
    localStorage.removeItem('savedChapNb' + url);
    localStorage.removeItem('savedEpName' + url);
    localStorage.removeItem('savedEpNb' + url);
}

async function removeByUrl(cat, url) {
    if (cat === 'histo') {
        if (histoUrl.indexOf(url) === -1) return;
        // 21/11/2026 : retrait mémorisé sur le compte (asHisto, defaut.js) pour qu'un autre appareil
        // pas à jour ne fasse pas revenir l'œuvre
        const envoi = window.asHisto.retirer([url]);
        updateUIAfterLoad();   // la page change tout de suite, l'envoi au compte suit
        await envoi;
    } else if (cat === 'fav') {
        const i = favoriUrl.indexOf(url);
        if (i === -1) return;
        favoriNom.splice(i, 1); favoriUrl.splice(i, 1); favoriImg.splice(i, 1);
        localStorage.setItem('favoriNom', JSON.stringify(favoriNom));
        localStorage.setItem('favoriUrl', JSON.stringify(favoriUrl));
        localStorage.setItem('favoriImg', JSON.stringify(favoriImg));
        updateUIAfterLoad();   // la page change tout de suite, l'envoi au compte suit
        await syncFavoritesToServer();
    } else if (cat === 'watch') {
        const i = watchlistUrl.indexOf(url);
        if (i === -1) return;
        watchlistNom.splice(i, 1); watchlistUrl.splice(i, 1); watchlistImg.splice(i, 1);
        localStorage.setItem('watchlistNom', JSON.stringify(watchlistNom));
        localStorage.setItem('watchlistUrl', JSON.stringify(watchlistUrl));
        localStorage.setItem('watchlistImg', JSON.stringify(watchlistImg));
        updateUIAfterLoad();   // la page change tout de suite, l'envoi au compte suit
        await syncWatchlistToServer();
    } else if (cat === 'vu') {
        const i = vuUrl.indexOf(url);
        if (i === -1) return;
        vuNom.splice(i, 1); vuUrl.splice(i, 1); vuImg.splice(i, 1);
        localStorage.setItem('vuNom', JSON.stringify(vuNom));
        localStorage.setItem('vuUrl', JSON.stringify(vuUrl));
        localStorage.setItem('vuImg', JSON.stringify(vuImg));
        updateUIAfterLoad();   // la page change tout de suite, l'envoi au compte suit
        await syncViewedToServer();
    }
    updateUIAfterLoad();
}

async function clearCategory(cat) {
    if (cat === 'histo') {
        // vide l'historique et la progression locale ; le compte retient la date du vidage (asHisto)
        await window.asHisto.vider();
    } else if (cat === 'fav') {
        favoriNom = []; favoriUrl = []; favoriImg = [];
        localStorage.setItem('favoriNom', '[]'); localStorage.setItem('favoriUrl', '[]'); localStorage.setItem('favoriImg', '[]');
        await syncFavoritesToServer();
    } else if (cat === 'watch') {
        watchlistNom = []; watchlistUrl = []; watchlistImg = [];
        localStorage.setItem('watchlistNom', '[]'); localStorage.setItem('watchlistUrl', '[]'); localStorage.setItem('watchlistImg', '[]');
        await syncWatchlistToServer();
    } else if (cat === 'vu') {
        vuNom = []; vuUrl = []; vuImg = [];
        localStorage.setItem('vuNom', '[]'); localStorage.setItem('vuUrl', '[]'); localStorage.setItem('vuImg', '[]');
        await syncViewedToServer();
    }
    updateUIAfterLoad();
}

/* ---------- Sync serveur (inchangé) ---------- */
async function syncFavoritesToServer() {
    if (typeof isUserLoggedIn !== 'function') return;
    if (!(await isUserLoggedIn())) return;
    const favorites = { nom: favoriNom, url: favoriUrl, img: favoriImg };
    try { await fetch('/api/sync-favorites.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: favorites }) }); } catch (e) {}
}
async function syncWatchlistToServer() {
    if (typeof isUserLoggedIn !== 'function') return;
    if (!(await isUserLoggedIn())) return;
    const watchlist = { nom: watchlistNom, url: watchlistUrl, img: watchlistImg };
    try { await fetch('/api/sync-watchlist.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchlist: watchlist }) }); } catch (e) {}
}
async function syncViewedToServer() {
    if (typeof isUserLoggedIn !== 'function') return;
    if (!(await isUserLoggedIn())) return;
    const viewed = { nom: vuNom, url: vuUrl, img: vuImg };
    try { await fetch('/api/sync-viewed.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viewed: viewed }) }); } catch (e) {}
}
// 21/11/2026 : sert seulement après un import ; les œuvres partent au compte datées (asHisto, defaut.js)
async function syncHistoryToServer() {
    try { await window.asHisto.apresImport(); } catch (e) {}
}

/* ---------- Déconnexion ---------- */
async function handleLogout() {
    try {
        const r = await fetch('/api/auth/logout.php');
        await r.json();
    } catch (e) {}
    window.location.reload();
}

/* ---------- Dropdowns personnalisés (tri / langue) ---------- */
function pfCloseAllDropdowns(except) {
    document.querySelectorAll('.pf-dd.pf-dd-open').forEach(function (dd) {
        if (dd !== except) {
            dd.classList.remove('pf-dd-open');
            const t = dd.querySelector('.pf-dd-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
        }
    });
}
function pfSelectDropdown(dd, value, label) {
    dd.setAttribute('data-value', value);
    const lab = dd.querySelector('.pf-dd-label');
    if (lab && label != null) lab.textContent = label;
    dd.querySelectorAll('.pf-dd-option').forEach(function (o) {
        o.setAttribute('aria-selected', o.getAttribute('data-value') === value ? 'true' : 'false');
    });
}
function pfWireDropdown(id, onSelect) {
    const dd = document.getElementById(id);
    if (!dd) return;
    const trigger = dd.querySelector('.pf-dd-trigger');
    if (trigger) {
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            const willOpen = !dd.classList.contains('pf-dd-open');
            pfCloseAllDropdowns(dd);
            dd.classList.toggle('pf-dd-open', willOpen);
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
    }
    dd.addEventListener('click', function (e) {
        const opt = e.target.closest('.pf-dd-option');
        if (!opt) return;
        pfSelectDropdown(dd, opt.getAttribute('data-value'), opt.textContent);
        dd.classList.remove('pf-dd-open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        if (typeof onSelect === 'function') onSelect(opt.getAttribute('data-value'));
    });
}
function populateLangDropdown(items) {
    const dd = document.getElementById('pfLangDD');
    if (!dd) return;
    const panel = dd.querySelector('.pf-dd-panel');
    if (!panel) return;
    const langs = Array.from(new Set(items.map(function (it) { return it.flang; }).filter(Boolean))).sort();
    let cur = pfState.lang;
    if (cur !== 'all' && langs.indexOf(cur) === -1) cur = 'all';
    pfState.lang = cur;
    let html = '<button type="button" class="pf-dd-option" role="option" data-value="all">Toutes les langues</button>';
    langs.forEach(function (l) {
        const s = escapeHtml(l);
        html += '<button type="button" class="pf-dd-option" role="option" data-value="' + s + '">' + s + '</button>';
    });
    panel.innerHTML = html;
    pfSelectDropdown(dd, cur, cur === 'all' ? 'Toutes les langues' : cur);
}

/* ---------- Câblage des contrôles ---------- */
function wireProfileControls() {
    // Onglets
    document.querySelectorAll('.pf-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            pfState.tab = tab.getAttribute('data-tab');
            pfState.q = ''; pfState.type = 'all'; pfState.lang = 'all'; pfState.retard = false; pfState.page = 1;
            const btnRetardOnglet = document.querySelector('#pfRetardSeg button');
            if (btnRetardOnglet) btnRetardOnglet.setAttribute('aria-pressed', 'false');
            document.querySelectorAll('.pf-tab').forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
            const search = document.getElementById('pfSearch');
            if (search) search.value = '';
            document.querySelectorAll('.pf-segment [data-type]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-type') === 'all' ? 'true' : 'false'); });
            renderLibrary();
        });
    });

    const search = document.getElementById('pfSearch');
    if (search) search.addEventListener('input', function () { pfState.q = search.value; pfState.page = 1; renderLibrary(); });

    pfWireDropdown('pfSortDD', function (v) { pfState.sort = v; pfState.page = 1; renderLibrary(); });
    pfWireDropdown('pfLangDD', function (v) { pfState.lang = v; pfState.page = 1; renderLibrary(); });
    document.addEventListener('click', function (e) { if (!e.target.closest('.pf-dd')) pfCloseAllDropdowns(null); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pfCloseAllDropdowns(null); });

    // Pagination (délégation)
    const pag = document.getElementById('pfPagination');
    if (pag) pag.addEventListener('click', function (e) {
        const btn = e.target.closest('.pf-page-btn');
        if (!btn || btn.disabled) return;
        pfGoToPage(btn.getAttribute('data-page'));
    });

    const btnRetard = document.querySelector('#pfRetardSeg button');
    if (btnRetard) btnRetard.addEventListener('click', function () {
        pfState.retard = !pfState.retard;
        pfState.page = 1;
        btnRetard.setAttribute('aria-pressed', pfState.retard ? 'true' : 'false');
        renderLibrary();
    });

    document.querySelectorAll('.pf-segment [data-type]').forEach(function (b) {
        b.addEventListener('click', function () {
            pfState.type = b.getAttribute('data-type');
            pfState.page = 1;
            document.querySelectorAll('.pf-segment [data-type]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            renderLibrary();
        });
    });

    const clearBtn = document.getElementById('pfClear');
    if (clearBtn) clearBtn.addEventListener('click', function () {
        const n = pfCount(pfState.tab);
        if (n === 0) return;
        if (confirm('Vider entièrement cette liste (' + n + ' oeuvre' + (n > 1 ? 's' : '') + ') ? Cette action est irréversible.')) {
            clearCategory(pfState.tab);
        }
    });

    // Chiffres de l'en-tête : ouvrent la liste correspondante
    document.querySelectorAll('.pf-stat[data-aller]').forEach(function (b) {
        b.addEventListener('click', function () {
            const tab = document.querySelector('.pf-tab[data-tab="' + b.getAttribute('data-aller') + '"]');
            if (tab) tab.click();
            const lib = document.getElementById('pfLibrary');
            if (lib && lib.scrollIntoView) lib.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Menu « ⋯ » du compte (exporter, importer, se déconnecter)
    const menuCompte = document.getElementById('pfMenuCompte');
    if (menuCompte) {
        const declencheur = menuCompte.querySelector('.pf-btn-icone');
        declencheur.addEventListener('click', function (e) {
            e.stopPropagation();
            const ouvert = menuCompte.classList.toggle('pf-ouvert');
            declencheur.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
        });
        menuCompte.querySelector('.pf-menu-panneau').addEventListener('click', function () {
            menuCompte.classList.remove('pf-ouvert');
            declencheur.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#pfMenuCompte')) { menuCompte.classList.remove('pf-ouvert'); declencheur.setAttribute('aria-expanded', 'false'); }
        });
    }

    // Téléphone : bouton « Filtres »
    const filtresBtn = document.getElementById('pfFiltresBtn');
    const filtres = document.getElementById('pfFiltres');
    if (filtresBtn && filtres) filtresBtn.addEventListener('click', function () {
        const ouvert = filtres.classList.toggle('pf-ouvert');
        filtresBtn.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });

    // Suppression par carte (délégation : marche avec tri/filtre/accueil)
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.card-delete-btn, .card-delete-btn-catalog');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('[data-url]');
        if (!card) return;
        removeByUrl(card.getAttribute('data-cat'), card.getAttribute('data-url'));
    });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function () {
    loadDataFromLocalStorage();
    wireProfileControls();
    updateUIAfterLoad();
    // Si connecté, script_defaut.js rappellera updateUIAfterLoad() après le serveur.
});


/* ============================================================
   EXPORT / IMPORT DES DONN\u00c9ES  (bloc isol\u00e9 et autonome)
   Encapsul\u00e9 : ne d\u00e9clare rien globalement et ne peut pas
   emp\u00eacher le reste de la page de fonctionner.
   ============================================================ */
(function () {
    var LIST_KEYS = [
        'histoNom', 'histoUrl', 'histoImg', 'histoType', 'histoLang', 'histoEp', 'histoNum', 'histoT',
        'favoriNom', 'favoriUrl', 'favoriImg',
        'watchlistNom', 'watchlistUrl', 'watchlistImg',
        'vuNom', 'vuUrl', 'vuImg'
    ];
    var PREFIXES = ['savedEpNb', 'savedEpName', 'savedChapNb', 'savedChapName'];
    var CAP = 500;

    function isOurKey(k) {
        if (LIST_KEYS.indexOf(k) !== -1) return true;
        for (var i = 0; i < PREFIXES.length; i++) {
            if (k.indexOf(PREFIXES[i]) === 0) return true;
        }
        return false;
    }

    function parseArr(raw) {
        try { var a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }

    function countEntries(d) {
        return parseArr(d.histoUrl).length + parseArr(d.favoriUrl).length +
               parseArr(d.watchlistUrl).length + parseArr(d.vuUrl).length;
    }

    /* ---------- EXPORT ---------- */
    // Categories exportables : cle -> colonnes concernees
    var CATS = {
        histo: { label: 'Historique', cols: ['histoNom', 'histoUrl', 'histoImg', 'histoType', 'histoLang', 'histoEp', 'histoNum', 'histoT'], urlKey: 'histoUrl' },
        watch: { label: 'Watchlist', cols: ['watchlistNom', 'watchlistUrl', 'watchlistImg'], urlKey: 'watchlistUrl' },
        fav:   { label: 'Favoris',   cols: ['favoriNom', 'favoriUrl', 'favoriImg'],          urlKey: 'favoriUrl' },
        vu:    { label: 'Vus',       cols: ['vuNom', 'vuUrl', 'vuImg'],                      urlKey: 'vuUrl' }
    };

    function catCount(cat) {
        return parseArr(localStorage.getItem(CATS[cat].urlKey)).length;
    }

    // Construit le fichier a partir des categories choisies
    function doExport(selected) {
        var data = {};
        selected.forEach(function (cat) {
            CATS[cat].cols.forEach(function (c) {
                var v = localStorage.getItem(c);
                if (v !== null) data[c] = v;
            });
        });

        // Les positions de reprise ne suivent que si l'historique est exporte
        if (selected.indexOf('histo') !== -1) {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (!k) continue;
                for (var p = 0; p < PREFIXES.length; p++) {
                    if (k.indexOf(PREFIXES[p]) === 0) { data[k] = localStorage.getItem(k); break; }
                }
            }
        }

        var payload = {
            _app: 'anime-sama',
            _type: 'sauvegarde-bibliotheque',
            _version: 1,
            _exportedAt: new Date().toISOString(),
            _categories: selected,
            data: data
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var d = new Date();
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        var stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                    '_' + pad(d.getHours()) + 'h' + pad(d.getMinutes());
        // Si export partiel, on le precise dans le nom du fichier
        var suffix = (selected.length === Object.keys(CATS).length) ? '' : '_' + selected.join('-');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'anime-sama_sauvegarde' + suffix + '_' + stamp + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /* ---------- Fenetre de selection des categories ---------- */
    function openExportDialog() {
        var old = document.getElementById('pfExportModal');
        if (old) old.parentNode.removeChild(old);

        var overlay = document.createElement('div');
        overlay.id = 'pfExportModal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(2,8,18,0.72);';

        var rows = '';
        Object.keys(CATS).forEach(function (cat) {
            var n = catCount(cat);
            rows += '<label style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.6rem;border-radius:9px;background:rgba(255,255,255,0.03);border:1px solid rgba(56,189,248,0.14);cursor:pointer;">' +
                '<input type="checkbox" class="pfExpCat" value="' + cat + '" checked style="width:16px;height:16px;cursor:pointer;accent-color:#38bdf8;">' +
                '<span style="flex:1;color:#e6f0fa;font-size:0.88rem;font-weight:600;">' + CATS[cat].label + '</span>' +
                '<span style="color:#7f9bb3;font-size:0.78rem;">' + n + '</span>' +
                '</label>';
        });

        overlay.innerHTML =
            '<div style="width:100%;max-width:400px;border-radius:16px;border:1px solid rgba(56,189,248,0.40);background:#0c1a2e;padding:1.3rem;box-shadow:0 24px 60px rgba(0,0,0,0.5);">' +
                '<h2 style="color:#38bdf8;font-size:1.1rem;font-weight:800;margin-bottom:0.3rem;">Exporter mes donn&eacute;es</h2>' +
                '<p style="color:#7f9bb3;font-size:0.8rem;margin-bottom:0.9rem;">Choisissez ce que vous souhaitez inclure dans le fichier.</p>' +
                '<div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.7rem;">' + rows + '</div>' +
                '<label style="display:flex;align-items:center;gap:0.5rem;color:#7f9bb3;font-size:0.78rem;cursor:pointer;margin-bottom:1rem;">' +
                    '<input type="checkbox" id="pfExpAll" checked style="width:15px;height:15px;cursor:pointer;accent-color:#38bdf8;"> Tout s&eacute;lectionner' +
                '</label>' +
                '<div id="pfExpError" style="color:#f87171;font-size:0.78rem;min-height:1.1em;margin-bottom:0.5rem;"></div>' +
                '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">' +
                    '<button type="button" id="pfExpCancel" class="pf-btn">Annuler</button>' +
                    '<button type="button" id="pfExpGo" class="pf-btn pf-btn-accent">Exporter</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var boxes = overlay.querySelectorAll('.pfExpCat');
        var allBox = overlay.querySelector('#pfExpAll');
        var err = overlay.querySelector('#pfExpError');

        function syncAllBox() {
            var total = boxes.length, checked = 0;
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) checked++;
            allBox.checked = (checked === total);
            allBox.indeterminate = (checked > 0 && checked < total);
            if (checked > 0) err.textContent = '';
        }
        for (var i = 0; i < boxes.length; i++) boxes[i].addEventListener('change', syncAllBox);

        allBox.addEventListener('change', function () {
            for (var j = 0; j < boxes.length; j++) boxes[j].checked = allBox.checked;
            syncAllBox();
        });

        function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
        overlay.querySelector('#pfExpCancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
        });

        overlay.querySelector('#pfExpGo').addEventListener('click', function () {
            var selected = [];
            for (var j = 0; j < boxes.length; j++) if (boxes[j].checked) selected.push(boxes[j].value);
            if (selected.length === 0) {
                err.textContent = 'S\u00e9lectionnez au moins une cat\u00e9gorie.';
                return;
            }
            try { doExport(selected); } catch (e) { err.textContent = 'Erreur : ' + e.message; return; }
            close();
        });
    }

    /* ---------- FUSION (l'import est prioritaire) ---------- */
    function mergeCols(cols, localRaw, impRaw) {
        var L = {}, I = {}, out = {};
        cols.forEach(function (c) {
            L[c] = parseArr(localRaw[c]);
            I[c] = parseArr(impRaw[c]);
            out[c] = [];
        });
        var urlCol = cols[1];
        var impIdx = {};
        I[urlCol].forEach(function (u, i) { if (u) impIdx[u] = i; });

        var seen = {};
        L[urlCol].forEach(function (u, i) {
            if (!u || seen[u]) return;
            seen[u] = true;
            var fromImp = Object.prototype.hasOwnProperty.call(impIdx, u);
            cols.forEach(function (c) {
                var v = fromImp ? I[c][impIdx[u]] : L[c][i];
                if (v === undefined) v = (L[c][i] !== undefined ? L[c][i] : '');
                out[c].push(v);
            });
        });
        I[urlCol].forEach(function (u, i) {
            if (!u || seen[u]) return;
            seen[u] = true;
            cols.forEach(function (c) { out[c].push(I[c][i] !== undefined ? I[c][i] : ''); });
        });

        if (out[urlCol].length > CAP) {
            var off = out[urlCol].length - CAP;
            cols.forEach(function (c) { out[c] = out[c].slice(off); });
        }
        cols.forEach(function (c) { localStorage.setItem(c, JSON.stringify(out[c])); });
    }

    function doMerge(imported, selected) {
        function readLocal(keys) {
            var o = {};
            keys.forEach(function (k) { o[k] = localStorage.getItem(k); });
            return o;
        }
        function pickImp(keys) {
            var o = {};
            keys.forEach(function (k) { o[k] = (typeof imported[k] === 'string') ? imported[k] : '[]'; });
            return o;
        }
        selected.forEach(function (cat) {
            var cols = CATS[cat].cols;
            mergeCols(cols, readLocal(cols), pickImp(cols));
        });

        // Positions de reprise : seulement si l'historique est importe
        if (selected.indexOf('histo') !== -1) {
            Object.keys(imported).forEach(function (k) {
                if (typeof imported[k] !== 'string') return;
                for (var i = 0; i < PREFIXES.length; i++) {
                    if (k.indexOf(PREFIXES[i]) === 0) { localStorage.setItem(k, imported[k]); return; }
                }
            });
        }
    }

    // Fenetre de choix a l'import (meme structure que celle de l'export)
    function openImportDialog(imported) {
        var avail = Object.keys(CATS).filter(function (cat) {
            return typeof imported[CATS[cat].urlKey] === 'string' && parseArr(imported[CATS[cat].urlKey]).length > 0;
        });
        if (avail.length === 0) { alert('Ce fichier ne contient aucune donn\u00e9e \u00e0 importer.'); return; }

        var old = document.getElementById('pfImportModal');
        if (old) old.parentNode.removeChild(old);

        var overlay = document.createElement('div');
        overlay.id = 'pfImportModal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(2,8,18,0.72);';

        var rows = '';
        avail.forEach(function (cat) {
            var n = parseArr(imported[CATS[cat].urlKey]).length;
            rows += '<label style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.6rem;border-radius:9px;background:rgba(255,255,255,0.03);border:1px solid rgba(56,189,248,0.14);cursor:pointer;">' +
                '<input type="checkbox" class="pfImpCat" value="' + cat + '" checked style="width:16px;height:16px;cursor:pointer;accent-color:#38bdf8;">' +
                '<span style="flex:1;color:#e6f0fa;font-size:0.88rem;font-weight:600;">' + CATS[cat].label + '</span>' +
                '<span style="color:#7f9bb3;font-size:0.78rem;">' + n + '</span>' +
                '</label>';
        });

        overlay.innerHTML =
            '<div style="width:100%;max-width:400px;border-radius:16px;border:1px solid rgba(56,189,248,0.40);background:#0c1a2e;padding:1.3rem;box-shadow:0 24px 60px rgba(0,0,0,0.5);">' +
                '<h2 style="color:#38bdf8;font-size:1.1rem;font-weight:800;margin-bottom:0.3rem;">Importer des donn&eacute;es</h2>' +
                '<p style="color:#7f9bb3;font-size:0.8rem;margin-bottom:0.9rem;">Choisissez ce que vous souhaitez importer depuis ce fichier.</p>' +
                '<div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.7rem;">' + rows + '</div>' +
                '<label style="display:flex;align-items:center;gap:0.5rem;color:#7f9bb3;font-size:0.78rem;cursor:pointer;margin-bottom:0.8rem;">' +
                    '<input type="checkbox" id="pfImpAll" checked style="width:15px;height:15px;cursor:pointer;accent-color:#38bdf8;"> Tout s&eacute;lectionner' +
                '</label>' +
                '<p style="color:#fde68a;font-size:0.76rem;line-height:1.4;margin-bottom:0.7rem;">Vos donn&eacute;es actuelles sont conserv&eacute;es. En cas de doublon, la version import&eacute;e est prioritaire.</p>' +
                '<div id="pfImpError" style="color:#f87171;font-size:0.78rem;min-height:1.1em;margin-bottom:0.5rem;"></div>' +
                '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">' +
                    '<button type="button" id="pfImpCancel" class="pf-btn">Annuler</button>' +
                    '<button type="button" id="pfImpGo" class="pf-btn pf-btn-accent">Importer</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var boxes = overlay.querySelectorAll('.pfImpCat');
        var allBox = overlay.querySelector('#pfImpAll');
        var err = overlay.querySelector('#pfImpError');

        function syncAllBox() {
            var total = boxes.length, checked = 0;
            for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) checked++;
            allBox.checked = (checked === total);
            allBox.indeterminate = (checked > 0 && checked < total);
            if (checked > 0) err.textContent = '';
        }
        for (var i = 0; i < boxes.length; i++) boxes[i].addEventListener('change', syncAllBox);
        allBox.addEventListener('change', function () {
            for (var j = 0; j < boxes.length; j++) boxes[j].checked = allBox.checked;
            syncAllBox();
        });

        function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
        overlay.querySelector('#pfImpCancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

        overlay.querySelector('#pfImpGo').addEventListener('click', function () {
            var selected = [];
            for (var j = 0; j < boxes.length; j++) if (boxes[j].checked) selected.push(boxes[j].value);
            if (selected.length === 0) { err.textContent = 'S\u00e9lectionnez au moins une cat\u00e9gorie.'; return; }
            try { doMerge(imported, selected); }
            catch (e) { err.textContent = 'Erreur : ' + e.message; return; }
            close();
            pushToServer(function () {
                alert('Import termin\u00e9.');
                window.location.reload();
            });
        });
    }

    /* ---------- IMPORT ---------- */
    function doImport(file) {
        var reader = new FileReader();
        reader.onload = function () {
            var payload;
            try { payload = JSON.parse(reader.result); }
            catch (e) { alert("Fichier illisible : ce n'est pas une sauvegarde valide."); return; }

            if (!payload || payload._app !== 'anime-sama' || !payload.data || typeof payload.data !== 'object') {
                alert("Ce fichier n'est pas une sauvegarde Anime-Sama valide.");
                return;
            }
            openImportDialog(payload.data);
        };
        reader.onerror = function () { alert('Impossible de lire le fichier.'); };
        reader.readAsText(file);
    }

    // Pousse vers le serveur si connecte, puis rappelle done() dans tous les cas
    function pushToServer(done) {
        try {
            if (typeof loadDataFromLocalStorage === 'function') loadDataFromLocalStorage();
            if (typeof isUserLoggedIn !== 'function') { done(); return; }
            Promise.resolve(isUserLoggedIn()).then(function (logged) {
                if (!logged) { done(); return; }
                var jobs = [];
                if (typeof syncHistoryToServer === 'function') jobs.push(syncHistoryToServer());
                if (typeof syncFavoritesToServer === 'function') jobs.push(syncFavoritesToServer());
                if (typeof syncWatchlistToServer === 'function') jobs.push(syncWatchlistToServer());
                if (typeof syncViewedToServer === 'function') jobs.push(syncViewedToServer());
                Promise.all(jobs).then(done, done);
            }, done);
        } catch (e) { done(); }
    }

    /* ---------- Branchement des boutons ---------- */
    function wire() {
        try {
            var exportBtn = document.getElementById('pfExportBtn');
            if (exportBtn) exportBtn.addEventListener('click', openExportDialog);

            var importBtn = document.getElementById('pfImportBtn');
            var importInput = document.getElementById('pfImportInput');
            if (importBtn && importInput) {
                importBtn.addEventListener('click', function () { importInput.click(); });
                importInput.addEventListener('change', function () {
                    if (importInput.files && importInput.files[0]) {
                        doImport(importInput.files[0]);
                        importInput.value = '';
                    }
                });
            }
        } catch (e) {
            console.error('Import/Export : branchement impossible', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();

