/* Rangées qui défilent horizontalement (accueil, œuvres similaires...).
   Pour chaque bloc .grabScroll :
   - une flèche à gauche et à droite, posées sur les côtés de la rangée, visibles
     seulement quand il reste quelque chose à voir dans ce sens ;
   - glisser à la souris (comme sur Korbo) : la rangée suit la souris au pixel près,
     et relâcher après un glisser n'ouvre pas la carte survolée.
   Au doigt, le défilement natif du téléphone suffit. */
(function () {
    var FLECHE_G = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var FLECHE_D = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    // Glisser à la souris : la rangée suit la souris, et relâcher après un glisser n'ouvre pas la carte.
    function activerGlisser(rangee) {
        var depart = null, aBouge = false;
        rangee.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'mouse' || e.button !== 0 || rangee.scrollWidth <= rangee.clientWidth) return;
            depart = { x: e.clientX, gauche: rangee.scrollLeft };
            aBouge = false;
        });
        window.addEventListener('pointermove', function (e) {
            if (!depart) return;
            var dx = e.clientX - depart.x;
            if (!aBouge && Math.abs(dx) > 6) { aBouge = true; rangee.classList.add('glisse'); }
            if (aBouge) rangee.scrollLeft = depart.gauche - dx;
        });
        window.addEventListener('pointerup', function () {
            if (!depart) return;
            depart = null;
            // on attend le clic qui suit le relâchement avant de remettre à zéro
            setTimeout(function () { rangee.classList.remove('glisse'); aBouge = false; }, 0);
        });
        rangee.addEventListener('click', function (e) {
            if (aBouge) { e.preventDefault(); e.stopPropagation(); }
        }, true);
        rangee.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }

    function preparer(rangee) {
        if (rangee.dataset.rangee) return;
        rangee.dataset.rangee = '1';

        // data-sans-fleches (colonnes du planning) : seulement le glisser, sans cadre ni flèches
        if (rangee.hasAttribute('data-sans-fleches')) { activerGlisser(rangee); return; }

        // On enveloppe la rangée pour pouvoir poser les flèches par-dessus ses bords.
        var cadre = document.createElement('div');
        cadre.className = 'rangee';
        rangee.parentNode.insertBefore(cadre, rangee);
        cadre.appendChild(rangee);

        var gauche = document.createElement('button');
        gauche.type = 'button';
        gauche.className = 'rangee-fleche gauche';
        gauche.setAttribute('aria-label', 'Défiler vers la gauche');
        gauche.innerHTML = FLECHE_G;

        var droite = document.createElement('button');
        droite.type = 'button';
        droite.className = 'rangee-fleche droite';
        droite.setAttribute('aria-label', 'Défiler vers la droite');
        droite.innerHTML = FLECHE_D;

        cadre.appendChild(gauche);
        cadre.appendChild(droite);

        function majFleches() {
            gauche.hidden = rangee.scrollLeft <= 4;
            droite.hidden = rangee.scrollLeft + rangee.clientWidth >= rangee.scrollWidth - 4;
        }
        rangee.addEventListener('scroll', majFleches, { passive: true });
        window.addEventListener('resize', majFleches);
        window.addEventListener('load', majFleches);
        // « Reprenez votre visionnage » se remplit après coup : on recalcule quand les cartes arrivent.
        new MutationObserver(majFleches).observe(rangee, { childList: true });
        // Les jours du planning sont cachés puis affichés : on recalcule quand la rangée change de taille.
        if ('ResizeObserver' in window) new ResizeObserver(majFleches).observe(rangee);
        majFleches();

        gauche.addEventListener('click', function () {
            rangee.scrollBy({ left: -rangee.clientWidth * 0.8, behavior: 'smooth' });
        });
        droite.addEventListener('click', function () {
            rangee.scrollBy({ left: rangee.clientWidth * 0.8, behavior: 'smooth' });
        });

        activerGlisser(rangee);
    }

    function tout() { document.querySelectorAll('.grabScroll').forEach(preparer); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tout);
    else tout();
})();
