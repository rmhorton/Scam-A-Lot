/**
 * Radio Free Scam-A-Lot — Main Application
 * 
 * Renders song cards with audio players and lyrics.
 * Handles single-track playback (pausing others when one plays).
 */

(function() {
  'use strict';

  // Track currently playing audio
  let currentAudio = null;
  let currentPlayBtn = null;

  // ── Format time (seconds → MM:SS) ──
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ── Pause current audio ──
  function pauseCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (currentPlayBtn) {
      currentPlayBtn.textContent = '▶';
      currentPlayBtn.classList.remove('playing');
    }
  }

  // ── Toggle play/pause for a song ──
  function togglePlay(audioEl, btnEl, cardEl) {
    if (currentAudio === audioEl && !audioEl.paused) {
      // Pause this track
      audioEl.pause();
      btnEl.textContent = '▶';
      btnEl.classList.remove('playing');
      cardEl.classList.remove('now-playing');
      currentAudio = null;
      currentPlayBtn = null;
    } else {
      // Pause any other track, play this one
      pauseCurrent();
      audioEl.play();
      btnEl.textContent = '⏸';
      btnEl.classList.add('playing');
      cardEl.classList.add('now-playing');
      currentAudio = audioEl;
      currentPlayBtn = btnEl;
    }
  }

  // ── Build a single song card ──
  function createSongCard(song, index) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.id = `song-${song.id}`;

    const hasAudio = !!song.audio;

    card.innerHTML = `
      <div class="song-header" data-song="${song.id}">
        <div class="song-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="song-info">
          <div class="song-title">${song.title}</div>
          <div class="song-description">${song.description}</div>
        </div>
        <div class="song-toggle">▼</div>
      </div>
      <div class="song-body">
        <div class="song-body-inner">
          ${hasAudio ? `
          <div class="audio-section">
            <div class="audio-player">
              <button class="play-btn" aria-label="Play ${song.title}">▶</button>
              <div class="progress-container">
                <input type="range" class="progress-bar" min="0" max="100" value="0" step="0.1">
                <div class="time-display">
                  <span class="current-time">0:00</span>
                  <span class="duration">0:00</span>
                </div>
              </div>
              <div class="volume-control">
                <span class="volume-icon">🔊</span>
                <input type="range" class="volume-slider" min="0" max="1" value="0.8" step="0.01">
              </div>
            </div>
          </div>
          ` : `
          <div class="audio-section">
            <span class="no-audio-badge">Audio coming soon</span>
          </div>
          `}
          <div class="lyrics-section">
            <button class="lyrics-toggle-btn">Show Lyrics</button>
            <div class="lyrics-container">
              <div class="lyrics-content loading">Loading lyrics…</div>
            </div>
          </div>
        </div>
      </div>
    `;

    return card;
  }

  // ── Set up song card event listeners ──
  function setupSongCard(card, song) {
    const header = card.querySelector('.song-header');
    const body = card.querySelector('.song-body');
    const toggle = card.querySelector('.song-toggle');
    const playBtn = card.querySelector('.play-btn');
    const progressBar = card.querySelector('.progress-bar');
    const currentTimeEl = card.querySelector('.current-time');
    const durationEl = card.querySelector('.duration');
    const volumeSlider = card.querySelector('.volume-slider');
    const lyricsBtn = card.querySelector('.lyrics-toggle-btn');
    const lyricsContainer = card.querySelector('.lyrics-container');
    const lyricsContent = card.querySelector('.lyrics-content');

    // Expand/collapse song card
    header.addEventListener('click', () => {
      const isExpanded = body.classList.contains('expanded');
      body.classList.toggle('expanded');
      toggle.classList.toggle('expanded');
    });

    // Audio setup
    if (playBtn) {
      const audio = document.createElement('audio');
      audio.src = `${AUDIO_BASE}${song.audio}`;
      audio.preload = 'metadata';
      card.querySelector('.audio-section').appendChild(audio);

      // Play/pause
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay(audio, playBtn, card);
      });

      // Audio ended — auto-play the next song
      audio.addEventListener('ended', () => {
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
        card.classList.remove('now-playing');
        progressBar.value = 0;
        currentTimeEl.textContent = '0:00';
        if (currentAudio === audio) {
          currentAudio = null;
          currentPlayBtn = null;
        }

        // Find next song with audio and play it
        const allCards = document.querySelectorAll('.song-card');
        const currentIndex = Array.from(allCards).indexOf(card);
        for (let i = currentIndex + 1; i < allCards.length; i++) {
          const nextCard = allCards[i];
          const nextAudio = nextCard.querySelector('audio');
          const nextBtn = nextCard.querySelector('.play-btn');
          if (nextAudio && nextBtn && nextAudio.src) {
            // Expand the next card so the player is visible
            const nextBody = nextCard.querySelector('.song-body');
            const nextToggle = nextCard.querySelector('.song-toggle');
            if (!nextBody.classList.contains('expanded')) {
              nextBody.classList.add('expanded');
              nextToggle.classList.add('expanded');
            }
            // Scroll the next card into view
            nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Start playing after a short delay for smoothness
            setTimeout(() => {
              togglePlay(nextAudio, nextBtn, nextCard);
            }, 400);
            break;
          }
        }
      });

      // Update progress bar during playback
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          const pct = (audio.currentTime / audio.duration) * 100;
          progressBar.value = pct;
          currentTimeEl.textContent = formatTime(audio.currentTime);
        }
      });

      // Set duration when metadata loads
      audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audio.duration);
      });

      // Seek via progress bar
      progressBar.addEventListener('input', (e) => {
        e.stopPropagation();
        if (audio.duration) {
          audio.currentTime = (progressBar.value / 100) * audio.duration;
        }
      });

      // Volume control
      volumeSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        audio.volume = volumeSlider.value;
      });
      audio.volume = volumeSlider.value;
    }

    // Lyrics toggle
    let lyricsLoaded = false;
    lyricsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (!lyricsLoaded) {
        // Fetch lyrics
        fetch(`${LYRICS_BASE}${song.lyrics}`)
          .then(res => {
            if (!res.ok) throw new Error('Lyrics not found');
            return res.text();
          })
          .then(rawText => {
            const parsed = parseLyrics(rawText);
            lyricsContent.innerHTML = renderLyricsHTML(parsed);
            lyricsBtn.textContent = 'Hide Lyrics';
            lyricsContainer.classList.add('expanded');
            lyricsLoaded = true;
          })
          .catch(err => {
            lyricsContent.innerHTML = `<p class="stage-direction">Lyrics not available.</p>`;
            lyricsBtn.textContent = 'Show Lyrics';
          });
      } else {
        // Toggle visibility
        const isExpanded = lyricsContainer.classList.contains('expanded');
        lyricsContainer.classList.toggle('expanded');
        lyricsBtn.textContent = isExpanded ? 'Show Lyrics' : 'Hide Lyrics';
      }
    });
  }

  // ── Initialize the page ──
  function init() {
    const songList = document.getElementById('song-list');

    SONGS.forEach((song, index) => {
      const card = createSongCard(song, index);
      setupSongCard(card, song);
      songList.appendChild(card);
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
