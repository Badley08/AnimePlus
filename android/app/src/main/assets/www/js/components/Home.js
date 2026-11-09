/**
 * Home.js — Écran d'accueil
 */
const Home = (() => {
  function render() {
    const last = (typeof Storage.getLastWatch === 'function') ? Storage.getLastWatch() : null;
    let resumeHtml = '';

    if (last && last.anime) {
      const percent = last.percent || (last.duration > 0 ? Math.round((last.seconds / last.duration) * 100) : 0);
      resumeHtml = `
        <button class="p hero" id="btn-resume">
          <small style="color:#cfe0ff">Reprendre</small>
          <h2>${last.anime.title || last.anime.t || 'En cours'}</h2>
          <small style="color:#cfe0ff">Saison ${last.season + 1}, Épisode ${last.episode + 1}</small>
          <div class="prog"><i style="width: ${percent}%"></i></div>
        </button>
      `;
    } else {
      resumeHtml = `
        <button class="p hero" id="btn-resume-demo">
          <small style="color:#cfe0ff">Découvrir</small>
          <h2>Explore le catalogue</h2>
          <small style="color:#cfe0ff">Recherche des animes en streaming direct</small>
        </button>
      `;
    }

    return `
      <section class="v" id="home">
        <h1 class="title">Accueil</h1>
        ${resumeHtml}
        
        <h2 class="h">Ajoutés récemment</h2>
        <div class="rail" id="hr">
          <div class="muted" style="padding:16px;">Chargement des nouveautés...</div>
        </div>

        <h2 class="h">Ma liste</h2>
        <div id="home-favs">
          <div class="muted" style="padding:12px 0;">Aucun anime favori pour l'instant.</div>
        </div>
      </section>
    `;
  }

  function mount() {
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.onclick = () => {
        const last = Storage.getLastWatch();
        if (last && last.anime) {
          Router.go('ply', { anime: last.anime, season: last.season, ep: last.episode });
        }
      };
    }
    const btnDemo = document.getElementById('btn-resume-demo');
    if (btnDemo) {
      btnDemo.onclick = () => Router.go('search');
    }

    // Charger les favoris
    const favs = Storage.getFavorites ? Storage.getFavorites() : [];
    const favsContainer = document.getElementById('home-favs');
    if (favs.length && favsContainer) {
      favsContainer.innerHTML = favs.slice(0, 4).map(a => `
        <button class="row" data-id="${a.id}">
          <div class="p" style="background-image:url('${a.poster || ''}');background-size:cover;background-position:center;"></div>
          <div>
            <b>${a.title || a.t}</b>
            <small>${a.genres ? a.genres.join(', ') : 'Anime'}</small>
          </div>
        </button>
      `).join('');

      favsContainer.querySelectorAll('.row').forEach(row => {
        row.onclick = () => {
          const id = row.getAttribute('data-id');
          const anime = favs.find(f => f.id === id);
          if (anime) Router.go('det', { anime });
        };
      });
    }

    // Nouveautés via Scraper ou fallback
    const rail = document.getElementById('hr');
    if (rail && window.ScraperService) {
      ScraperService.getRecents().then(list => {
        if (!list || !list.length) {
          rail.innerHTML = '<div class="muted" style="padding:16px;">Ouvre la recherche pour explorer les flux.</div>';
          return;
        }
        rail.innerHTML = list.map(a => `
          <button class="card" data-url="${encodeURIComponent(a.url || '')}" data-source="${a.source || 'animesama'}">
            <div class="p" style="background-image:url('${a.poster || ''}');background-size:cover;background-position:center;">
              <i class="badge">${a.type === 'film' ? 'Film' : 'Ép. ' + (a.latestEp || 'N/A')}</i>
            </div>
            <b>${a.title}</b>
          </button>
        `).join('');

        rail.querySelectorAll('.card').forEach(card => {
          card.onclick = () => {
            const url = decodeURIComponent(card.getAttribute('data-url'));
            const source = card.getAttribute('data-source');
            Router.go('det', { url, source });
          };
        });
      }).catch(err => {
        rail.innerHTML = '<div class="muted" style="padding:16px;">Vérifie ta connexion internet.</div>';
      });
    }
  }

  return { render, mount };
})();
