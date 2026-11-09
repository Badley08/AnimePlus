/**
 * Detail.js — Fiche anime détaillée avec saisons et épisodes réels
 */
const Detail = (() => {
  let currentAnime = null;
  let selectedSeasonIndex = 0;

  function render(params = {}) {
    return `
      <section class="v" id="det">
        <button class="back" id="det-back" aria-label="Retour"><svg class="i"><use href="#back"></use></svg></button>
        <div class="p cover" id="dc"></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:16px;">
          <h1 class="title" id="dt" style="margin-bottom:8px; flex:1;"></h1>
          <button id="det-fav" style="padding:8px; margin-top:2px;" aria-label="Ajouter aux favoris">
            <svg class="i" id="fav-icon"><use href="#heart"></use></svg>
          </button>
        </div>
        <div class="chips" id="dm"></div>
        <p class="muted" id="dd" style="font-size:15px;line-height:1.5; margin-bottom:16px;"></p>
        
        <h2 class="h" id="sh">Saisons</h2>
        <div class="chips" id="seas"></div>
        
        <h2 class="h" id="eh" style="margin-top:12px">Épisodes</h2>
        <div id="eps">
          <div class="muted" style="padding:16px 0;">Chargement des épisodes...</div>
        </div>
      </section>
    `;
  }

  async function mount(params = {}) {
    const backBtn = document.getElementById('det-back');
    if (backBtn) {
      backBtn.onclick = () => Router.back();
    }

    if (params.anime) {
      currentAnime = params.anime;
    } else if (params.url) {
      // Charger les détails depuis le scraper
      try {
        currentAnime = await ScraperService.getAnimeDetail(params.url, params.source || 'animesama');
      } catch (e) {
        Toast.show("Impossible de charger les détails de l'anime.");
        Router.back();
        return;
      }
    }

    if (!currentAnime) {
      Router.back();
      return;
    }

    // Si les saisons ne sont pas encore peuplées
    if (!currentAnime.seasons || !currentAnime.seasons.length) {
      try {
        const enriched = await ScraperService.getAnimeDetail(currentAnime.url, currentAnime.source);
        currentAnime.seasons = enriched.seasons || [];
        if (enriched.synopsis) currentAnime.synopsis = enriched.synopsis;
      } catch (err) {
        console.warn('Scrape season error:', err);
      }
    }

    // Affichage des informations
    const cover = document.getElementById('dc');
    if (cover && currentAnime.poster) {
      cover.style.backgroundImage = `url('${currentAnime.poster}')`;
      cover.style.backgroundSize = 'cover';
      cover.style.backgroundPosition = 'center';
    }

    document.getElementById('dt').textContent = currentAnime.title || 'Anime';
    document.getElementById('dd').textContent = currentAnime.synopsis || "Aucun synopsis disponible.";

    // Chips tags
    const dm = document.getElementById('dm');
    let tagsHtml = '';
    if (currentAnime.year) tagsHtml += `<span class="chip">${currentAnime.year}</span>`;
    if (currentAnime.type) tagsHtml += `<span class="chip">${currentAnime.type === 'film' ? 'Film' : 'Série'}</span>`;
    if (currentAnime.source) tagsHtml += `<span class="chip">${currentAnime.source}</span>`;
    if (currentAnime.genres) {
      tagsHtml += currentAnime.genres.map(g => `<span class="chip">${g}</span>`).join('');
    }
    dm.innerHTML = tagsHtml;

    // Favori toggle
    const favBtn = document.getElementById('det-fav');
    function updateFavIcon() {
      const isFav = Storage.isFavorite ? Storage.isFavorite(currentAnime.id) : false;
      favBtn.style.color = isFav ? 'var(--danger)' : 'var(--muted)';
    }
    updateFavIcon();
    favBtn.onclick = () => {
      Storage.toggleFavorite(currentAnime);
      updateFavIcon();
      Toast.show("Favoris mis à jour");
    };

    renderSeasonsAndEpisodes();
  }

  function renderSeasonsAndEpisodes() {
    const seasons = currentAnime.seasons || [{ number: 1, title: 'Saison 1', episodes: [] }];
    const seasonsContainer = document.getElementById('seas');
    const seasonsHeader = document.getElementById('sh');

    if (currentAnime.type === 'film' || seasons.length <= 1) {
      seasonsContainer.hidden = true;
      seasonsHeader.hidden = true;
    } else {
      seasonsContainer.hidden = false;
      seasonsHeader.hidden = false;
      seasonsContainer.innerHTML = seasons.map((s, idx) => `
        <button class="chip ${idx === selectedSeasonIndex ? 'on' : ''}" data-s="${idx}">
          ${s.title || 'Saison ' + (s.number || (idx + 1))}
        </button>
      `).join('');

      seasonsContainer.querySelectorAll('[data-s]').forEach(b => {
        b.onclick = () => {
          selectedSeasonIndex = parseInt(b.getAttribute('data-s'), 10);
          renderSeasonsAndEpisodes();
        };
      });
    }

    const currentSeason = seasons[selectedSeasonIndex] || seasons[0];
    const episodes = currentSeason.episodes || [];
    const epsContainer = document.getElementById('eps');
    const eh = document.getElementById('eh');

    eh.textContent = currentAnime.type === 'film' ? 'Film complet' : `${currentSeason.title || 'Saison ' + (selectedSeasonIndex + 1)} (${episodes.length} épisodes)`;

    if (!episodes.length) {
      epsContainer.innerHTML = '<div class="muted" style="padding:16px 0;">Aucun épisode disponible pour cette saison.</div>';
      return;
    }

    epsContainer.innerHTML = episodes.map((ep, idx) => {
      const epNum = ep.number || (idx + 1);
      const isComp = Storage.isCompressed ? Storage.isCompressed(currentAnime.id, selectedSeasonIndex, idx) : false;
      return `
        <div class="ep" data-ep-idx="${idx}">
          <div class="n">${epNum}</div>
          <div class="t">
            <b>${ep.title || 'Épisode ' + epNum}</b>
            <small>${ep.duration || '24 min'} • ${isComp ? 'Compressé' : 'Streaming'}</small>
          </div>
          <button class="ib btn-dl" data-idx="${idx}" aria-label="Télécharger">
            <svg class="i"><use href="#zip"></use></svg>
          </button>
          <button class="ib pl btn-play" data-idx="${idx}" aria-label="Lire">
            <svg class="i f"><use href="#play"></use></svg>
          </button>
        </div>
      `;
    }).join('');

    epsContainer.querySelectorAll('.btn-play').forEach(btn => {
      btn.onclick = () => {
        const epIdx = parseInt(btn.getAttribute('data-idx'), 10);
        Router.go('ply', {
          anime: currentAnime,
          season: selectedSeasonIndex,
          ep: epIdx
        });
      };
    });

    epsContainer.querySelectorAll('.btn-dl').forEach(btn => {
      btn.onclick = () => {
        const epIdx = parseInt(btn.getAttribute('data-idx'), 10);
        const ep = episodes[epIdx];
        Downloader.startDownload(currentAnime, selectedSeasonIndex, epIdx, ep.url || '');
      };
    });
  }

  return { render, mount };
})();
