/**
 * Search.js — Recherche d'anime multi-sources avec suggestions interactives
 */
const Search = (() => {
  let searchTimeout = null;

  function render() {
    return `
      <section class="v" id="search">
        <h1 class="title">Recherche</h1>
        <div class="sf">
          <svg class="i"><use href="#search"></use></svg>
          <input class="field" id="q" placeholder="Rechercher (ex: Naruto, Solo Leveling...)" aria-label="Rechercher" autocomplete="off">
          <button class="clr" id="qc" hidden aria-label="Effacer"><svg class="i"><use href="#x"></use></svg></button>
        </div>
        <div class="sug" id="sug"></div>
      </section>
    `;
  }

  function mount() {
    const input = document.getElementById('q');
    const clearBtn = document.getElementById('qc');
    const sugContainer = document.getElementById('sug');

    function renderHistory() {
      const history = Storage.getHistory ? Storage.getHistory() : [];
      if (!history.length) {
        sugContainer.innerHTML = '<p class="empty">Tape un mot-clé pour chercher sur Anime-Sama, VoirAnime & 2Anime.</p>';
        return;
      }
      sugContainer.innerHTML = '<small style="padding:8px 0; display:block;">Recherches récentes</small>' +
        history.map(item => `
          <button class="rec" data-query="${item}">
            <svg class="i"><use href="#clock"></use></svg>
            <span>${item}</span>
          </button>
        `).join('');

      sugContainer.querySelectorAll('.rec').forEach(btn => {
        btn.onclick = () => {
          input.value = btn.getAttribute('data-query');
          clearBtn.hidden = false;
          triggerSearch(input.value);
        };
      });
    }

    async function triggerSearch(val) {
      const query = val.trim();
      if (!query) {
        clearBtn.hidden = true;
        renderHistory();
        return;
      }
      clearBtn.hidden = false;
      sugContainer.innerHTML = '<p class="empty">Recherche en cours sur les plateformes...</p>';

      try {
        const results = await ScraperService.search(query);
        if (!results || !results.length) {
          sugContainer.innerHTML = `<p class="empty">Aucun résultat trouvé pour « ${query} ».<br>Vérifie l'orthographe.</p>`;
          return;
        }

        sugContainer.innerHTML = results.map(anime => {
          const bgStyle = anime.poster ? `background-image:url('${anime.poster}');background-size:cover;background-position:center;` : '';
          return `
            <button class="row anime-res" data-anime="${encodeURIComponent(JSON.stringify(anime))}">
              <div class="p" style="${bgStyle}"></div>
              <div>
                <b>${anime.title}</b>
                <small>${anime.type === 'film' ? 'Film' : 'Série'} • ${anime.source || 'Anime-Sama'}</small><br>
                <small class="muted">${anime.year || ''} ${anime.genres ? '• ' + anime.genres.slice(0, 2).join(', ') : ''}</small>
              </div>
            </button>
          `;
        }).join('');

        sugContainer.querySelectorAll('.anime-res').forEach(el => {
          el.onclick = () => {
            const raw = decodeURIComponent(el.getAttribute('data-anime'));
            const anime = JSON.parse(raw);
            Storage.addHistory(query);
            Router.go('det', { anime });
          };
        });
      } catch (err) {
        sugContainer.innerHTML = `<p class="empty">Erreur de connexion aux serveurs de streaming.<br>${err.message || ''}</p>`;
      }
    }

    input.oninput = () => {
      clearTimeout(searchTimeout);
      const val = input.value;
      if (!val.trim()) {
        clearBtn.hidden = true;
        renderHistory();
        return;
      }
      clearBtn.hidden = false;
      searchTimeout = setTimeout(() => triggerSearch(val), 400);
    };

    clearBtn.onclick = () => {
      input.value = '';
      clearBtn.hidden = true;
      renderHistory();
      input.focus();
    };

    renderHistory();
  }

  return { render, mount };
})();

