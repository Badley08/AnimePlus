/* ============================================================
   espion-pub.js — mode enquête sur les pubs qui s'ouvrent toutes seules
   Activer : ouvrir n'importe quelle page avec ?debug_pub=1 (désactiver : ?debug_pub=0).
   Tant qu'il est actif, chaque ouverture de nouvel onglet / fenêtre (window.open, lien
   « _blank » cliqué par un script, formulaire) est notée avec l'heure, l'adresse et le
   script responsable, dans un petit panneau en bas de l'écran. Rien n'est bloqué.
   Chargé en tout premier dans le header, avant le script Adcash.
   ============================================================ */
(function () {
    'use strict';
    try {
        var m = /[?&]debug_pub=([01])/.exec(location.search);
        if (m) localStorage.setItem('debugPub', m[1]);
        if (localStorage.getItem('debugPub') !== '1') return;
    } catch (e) { return; }

    var journal = [];
    try { journal = JSON.parse(sessionStorage.getItem('debugPubJournal') || '[]'); } catch (e) {}

    function source() {
        var lignes = String(new Error().stack || '').split('\n').slice(3);
        for (var i = 0; i < lignes.length; i++) {
            var u = /(https?:\/\/[^\s)]+?):\d+:\d+/.exec(lignes[i]);
            if (u && u[1].indexOf('espion-pub.js') === -1) return u[1];
        }
        return '(inconnu : sans doute dans un cadre de pub)';
    }
    function noter(type, url) {
        var e = { heure: new Date().toLocaleTimeString('fr-FR'), page: location.pathname, type: type, url: String(url || '(vide)'), script: source() };
        journal.push(e);
        journal = journal.slice(-20);
        try { sessionStorage.setItem('debugPubJournal', JSON.stringify(journal)); } catch (er) {}
        afficher();
    }

    var ouvrir = window.open;
    window.open = function (url) { noter('window.open', url); return ouvrir.apply(window, arguments); };
    var clic = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.target && this.target !== '_self') noter('lien cliqué par un script', this.href); return clic.apply(this, arguments); };
    var envoyer = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () { if (this.target && this.target !== '_self') noter('formulaire', this.action); return envoyer.apply(this, arguments); };
    // Clic réel qui part vers un autre site dans un nouvel onglet, sur un élément ajouté par une pub
    document.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest && ev.target.closest('a[target="_blank"]');
        if (a && a.host && a.host !== location.host && !/korbo\.fr|discord|twitter|x\.com/.test(a.host)) noter('lien de pub cliqué', a.href);
    }, true);
    // Onglet quitté sans raison visible (signe d'une pub qui s'ouvre au premier plan)
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) noter('la page passe en arrière-plan', '(un autre onglet vient peut-être de s’ouvrir)');
    });

    var panneau = null;
    function afficher() {
        if (!document.body) { document.addEventListener('DOMContentLoaded', afficher); return; }
        if (!panneau) {
            panneau = document.createElement('div');
            panneau.setAttribute('style', 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;max-height:45vh;overflow:auto;padding:8px 10px;border-radius:10px;background:#1a0b0b;border:1px solid #f87171;color:#fecaca;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6)');
            document.body.appendChild(panneau);
        }
        panneau.innerHTML = '<b>Enquête pubs</b> (désactiver : ?debug_pub=0) — fais une capture de ce panneau quand la pub s\'ouvre<br>'
            + (journal.length ? journal.slice().reverse().map(function (e) {
                return '<div style="margin-top:6px;border-top:1px solid #7f1d1d;padding-top:4px"><b>' + e.heure + '</b> · ' + e.type + ' · page ' + e.page
                    + '<br>vers : ' + e.url.replace(/</g, '&lt;').slice(0, 200) + '<br>par : ' + e.script.replace(/</g, '&lt;') + '</div>';
            }).join('') : '<i>Rien pour l\'instant.</i>');
    }
    afficher();
})();
