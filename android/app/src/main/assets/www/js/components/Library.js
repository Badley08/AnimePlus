/**
 * Library.js — Bibliothèque : Tout, Favoris, Téléchargements
 */
const Library = (() => {
  let currentFilter = 'all';

  function render() {
    return `
      <section class="v" id="lib">
        <h1 class="title">Bibliothèque</h1>
        <div class="chips" id="lf">
          <button class="chip on" data-f="all">Tout</button>
          <button class="chip" data-f="fav">Favoris</button>
          <button class="chip" data-f="down">Téléchargés</button>
        </div>
        <div class="grid" id="lg"></div>
      </section>
    `;
  }

  function mount() {
    const filterContainer = document.getElementById('lf');
    const grid = document.getElementById('lg');

    function updateGrid() {
      let list = [];
      const favs = Storage.getFavorites ? Storage.getFavorites() : [];
      const lib = Storage.getLibrary ? Storage.getLibrary() : [];
      const downloads = Downloader.getDownloads ? Downloader.getDownloads() : [];

      if (currentFilter === 'all') {
        // Union des bibliothèques et favoris
        const map = new Map();
        [...favs, ...lib].forEach(item => {
          if (item && item.id) map.set(item.id, item);
        });
        list = Array.from(map.values());
      } else if (currentFilter === 'fav') {
        list = favs;
      } else if (currentFilter === 'down') {
        list = downloads;
      }

      if (!list.length) {
        grid.innerHTML = '<p class="empty" style="grid-column: 1/-1;">Aucun élément dans cette catégorie.</p>';
        return;
      }

      grid.innerHTML = list.map(item => {
        const bg = item.poster ? `background-image:url('${item.poster}');background-size:cover;background-position:center;` : '';
        return `
          <button class="card lib-item" data-item="${encodeURIComponent(JSON.stringify(item))}">
            <div class="p" style="${bg}">
              <i class="badge">${item.type === 'film' ? 'Film' : (item.seasons ? item.seasons.length + ' Saisons' : 'Série')}</i>
            </div>
            <b>${item.title || item.t}</b>
          </button>
        `;
      }).join('');

      grid.querySelectorAll('.lib-item').forEach(card => {
        card.onclick = () => {
          const raw = decodeURIComponent(card.getAttribute('data-item'));
          const anime = JSON.parse(raw);
          Router.go('det', { anime });
        };
      });
    }

    filterContainer.onclick = (e) => {
      const chip = e.target.closest('[data-f]');
      if (!chip) return;
      currentFilter = chip.getAttribute('data-f');
      filterContainer.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === chip));
      updateGrid();
    };

    updateGrid();
  }

  return { render, mount };
})();

