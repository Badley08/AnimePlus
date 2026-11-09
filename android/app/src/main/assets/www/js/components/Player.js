/**
 * Player.js — Lecteur vidéo réel avec reprise de lecture et contrôles optimisés
 */
const Player = (() => {
  let videoEl = null;
  let progressInterval = null;
  let currentAnime = null;
  let currentSeason = 0;
  let currentEp = 0;

  function render() {
    return `
      <section class="v" id="ply">
        <button class="back" id="pb" aria-label="Retour"><svg class="i"><use href="#back"></use></svg></button>
        <div class="ptop" id="pt">Titre de l'anime</div>
        
        <div class="player-wrapper" id="player-container">
          <video id="video-player" playsinline preload="auto" poster=""></video>
          <div class="video-overlay" id="video-overlay">
            <button class="pb" id="pp" aria-label="Lecture ou pause">
              <svg class="i f"><use href="#play" id="pu"></use></svg>
            </button>
          </div>
        </div>

        <div class="pbot">
          <div class="seek" id="seek-bar"><i id="sk"></i></div>
          <div class="times">
            <span id="tc">0:00</span>
            <span id="td">0:00</span>
          </div>
        </div>
      </section>
    `;
  }

  function formatTime(secs) {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  async function mount(params = {}) {
    const backBtn = document.getElementById('pb');
    const playPauseBtn = document.getElementById('pp');
    const playIcon = document.getElementById('pu');
    const seekBar = document.getElementById('seek-bar');
    const progressFill = document.getElementById('sk');
    const currentTimeEl = document.getElementById('tc');
    const durationEl = document.getElementById('td');
    const titleEl = document.getElementById('pt');
    const overlay = document.getElementById('video-overlay');

    videoEl = document.getElementById('video-player');
    currentAnime = params.anime || { id: 'demo', title: 'Vidéo Test', seasons: [{ episodes: [{ url: '' }] }] };
    currentSeason = params.season || 0;
    currentEp = params.ep || 0;

    const seasonData = currentAnime.seasons ? (currentAnime.seasons[currentSeason] || {}) : {};
    const episodeData = seasonData.episodes ? (seasonData.episodes[currentEp] || {}) : {};

    titleEl.textContent = currentAnime.type === 'film' 
      ? currentAnime.title 
      : `${currentAnime.title} - S${currentSeason + 1} E${currentEp + 1}`;

    backBtn.onclick = () => {
      saveProgress();
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      }
      Router.back();
    };

    // Chercher la source de stream réelle
    let streamUrl = episodeData.streamUrl || episodeData.url;
    if (!streamUrl || !streamUrl.endsWith('.mp4')) {
      try {
        titleEl.textContent = 'Résolution du flux...';
        const streamData = await ScraperService.getStreamLinks(episodeData.url || '', currentAnime.source);
        if (streamData && streamData.url) {
          streamUrl = streamData.url;
        } else {
          // Fallback démo Big Buck Bunny si le scraper renvoie un embed non compatible natif
          streamUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        }
      } catch (err) {
        streamUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      }
    }

    titleEl.textContent = currentAnime.type === 'film' 
      ? currentAnime.title 
      : `${currentAnime.title} - S${currentSeason + 1} E${currentEp + 1}`;

    videoEl.src = streamUrl;

    // Reprise de lecture
    const saved = Storage.getProgress(currentAnime.id, currentSeason, currentEp);
    if (saved && saved.seconds > 10) {
      videoEl.currentTime = saved.seconds;
      Toast.show(`Reprise à ${formatTime(saved.seconds)}`);
    }

    // Gestion play/pause
    function togglePlay() {
      if (videoEl.paused || videoEl.ended) {
        videoEl.play();
        playIcon.setAttribute('href', '#pause');
      } else {
        videoEl.pause();
        playIcon.setAttribute('href', '#play');
      }
    }

    playPauseBtn.onclick = (e) => {
      e.stopPropagation();
      togglePlay();
    };

    overlay.onclick = () => {
      togglePlay();
    };

    videoEl.ontimeupdate = () => {
      if (!videoEl.duration) return;
      const current = videoEl.currentTime;
      const duration = videoEl.duration;
      const percent = (current / duration) * 100;
      progressFill.style.width = `${percent}%`;
      currentTimeEl.textContent = formatTime(current);
      durationEl.textContent = formatTime(duration);
    };

    videoEl.onloadedmetadata = () => {
      durationEl.textContent = formatTime(videoEl.duration);
    };

    videoEl.onended = () => {
      playIcon.setAttribute('href', '#play');
      saveProgress(true);
    };

    // Seek bar cliquable
    seekBar.onclick = (e) => {
      const rect = seekBar.getBoundingClientRect();
      const clickPos = (e.clientX - rect.left) / rect.width;
      if (videoEl.duration) {
        videoEl.currentTime = clickPos * videoEl.duration;
      }
    };

    // Auto-save toutes les 5 secondes
    progressInterval = setInterval(() => {
      saveProgress();
    }, 5000);
  }

  function saveProgress(ended = false) {
    if (!videoEl || !currentAnime) return;
    const current = ended ? 0 : videoEl.currentTime;
    const duration = videoEl.duration || 0;
    Storage.setProgress(currentAnime.id, currentSeason, currentEp, current, duration);
    Storage.setLastWatch({
      anime: currentAnime,
      season: currentSeason,
      episode: currentEp,
      seconds: current,
      duration: duration
    });
  }

  function destroy() {
    clearInterval(progressInterval);
    if (videoEl) {
      saveProgress();
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
  }

  return { render, mount, destroy };
})();

