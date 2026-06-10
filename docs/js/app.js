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
  let currentCard = null;
  let sharedAudio = null;
  let sharedAudioSongId = null;
  let pendingAutoPlayTimer = null;
  let pendingAutoPlayToken = 0;
  const audioBlobUrlCache = {};
  const playbackStateBySongId = {};

  const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  const DEFAULT_PAUSE_BETWEEN_TRACKS_SECONDS = 2;
  const DEFAULT_CONFIG_SRC = 'js/config.js';
  const ALT_CONFIG_BASE = 'configs/';
  const APP_VERSION = 'milestone-2-slider-debug-2026-05-29-01';

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSongKey(song, index) {
    return song && song.id ? song.id : `missing-id-${index}`;
  }

  function getPlaylist() {
    return typeof SONGS === 'undefined' ? undefined : SONGS;
  }

  function getAudioBase() {
    return typeof AUDIO_BASE === 'undefined' ? '../audio/' : AUDIO_BASE;
  }

  function getLyricsBase() {
    return typeof LYRICS_BASE === 'undefined' ? '../lyrics/' : LYRICS_BASE;
  }

  function getPlaybackState(songId) {
    if (!playbackStateBySongId[songId]) {
      playbackStateBySongId[songId] = {
        currentTime: 0,
        duration: 0,
        progressValue: 0
      };
    }

    return playbackStateBySongId[songId];
  }

  function parseTimeValue(value, options = {}) {
    if ((value === null || typeof value === 'undefined' || value === '') && options.allowEmpty) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 ? value : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    const parts = trimmed.split(':');
    if (parts.length !== 2 && parts.length !== 3) {
      return null;
    }

    if (!parts.every(part => /^\d+$/.test(part))) {
      return null;
    }

    const numbers = parts.map(Number);
    const seconds = numbers[numbers.length - 1];
    const minutes = numbers[numbers.length - 2];

    if (seconds > 59) return null;
    if (parts.length === 3 && minutes > 59) return null;

    return parts.length === 2
      ? (minutes * 60) + seconds
      : (numbers[0] * 3600) + (minutes * 60) + seconds;
  }

  function normalizePlaylistEntry(song) {
    const normalizedStartTime = typeof song.startTime === 'undefined'
      ? 0
      : parseTimeValue(song.startTime);
    const normalizedStopTime = (song.stopTime === null || typeof song.stopTime === 'undefined' || song.stopTime === '')
      ? null
      : parseTimeValue(song.stopTime);
    const normalizedPauseBeforeSeconds = typeof song.pauseBeforeSeconds === 'undefined'
      ? DEFAULT_PAUSE_BETWEEN_TRACKS_SECONDS
      : parseTimeValue(song.pauseBeforeSeconds);

    return {
      ...song,
      normalizedStartTime,
      normalizedStopTime,
      normalizedPauseBeforeSeconds,
      isSegment: normalizedStartTime > 0 || normalizedStopTime !== null,
      isPlayable: !!song.audio
    };
  }

  function parseQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      config: params.get('config'),
      track: params.get('track')
    };
  }

  function isSafeConfigFilename(value) {
    if (!value || value.includes('/') || value.includes('\\') || value.includes(':') || value.includes('..')) {
      return false;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      return false;
    }

    return /^[a-zA-Z0-9_-]+\.js$/.test(value);
  }

  function loadConfigScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(src);
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  function loadSelectedConfig(query) {
    const status = {
      requestedConfig: query.config,
      loadedConfig: null,
      warnings: [],
      errors: []
    };

    let selectedSrc = DEFAULT_CONFIG_SRC;

    if (query.config) {
      if (isSafeConfigFilename(query.config)) {
        selectedSrc = `${ALT_CONFIG_BASE}${query.config}`;
      } else {
        status.warnings.push(`Requested config "${query.config}" was rejected; using ${DEFAULT_CONFIG_SRC} instead.`);
      }
    }

    return loadConfigScript(selectedSrc)
      .then(src => {
        status.loadedConfig = src;
        return status;
      })
      .catch(() => {
        if (selectedSrc === DEFAULT_CONFIG_SRC) {
          status.errors.push(`Default config ${DEFAULT_CONFIG_SRC} could not be loaded.`);
          return status;
        }

        status.warnings.push(`Requested config "${query.config}" could not be loaded; using ${DEFAULT_CONFIG_SRC} instead.`);

        return loadConfigScript(DEFAULT_CONFIG_SRC)
          .then(src => {
            status.loadedConfig = src;
            return status;
          })
          .catch(() => {
            status.errors.push(`Default config ${DEFAULT_CONFIG_SRC} could not be loaded.`);
            return status;
          });
      });
  }

  function addIssue(report, index, entryId, type, message) {
    const issue = { index, entryId, type, message };
    report[type === 'error' ? 'errors' : 'warnings'].push(issue);

    if (!report.issuesByIndex[index]) {
      report.issuesByIndex[index] = { errors: [], warnings: [] };
    }
    report.issuesByIndex[index][type === 'error' ? 'errors' : 'warnings'].push(issue);

    const issueKey = entryId || `missing-id-${index}`;
    if (!report.issuesByEntryId[issueKey]) {
      report.issuesByEntryId[issueKey] = { errors: [], warnings: [] };
    }
    report.issuesByEntryId[issueKey][type === 'error' ? 'errors' : 'warnings'].push(issue);
  }

  function validatePlaylist() {
    const playlist = getPlaylist();
    const report = {
      entryCount: 0,
      errors: [],
      warnings: [],
      issuesByEntryId: {},
      issuesByIndex: {},
      normalizedEntries: [],
      canRender: false
    };

    if (typeof playlist === 'undefined') {
      report.errors.push({ type: 'error', message: 'SONGS is missing.' });
      return report;
    }

    if (!Array.isArray(playlist)) {
      report.errors.push({ type: 'error', message: 'SONGS is not an array.' });
      return report;
    }

    report.entryCount = playlist.length;

    if (playlist.length === 0) {
      report.errors.push({ type: 'error', message: 'SONGS is empty.' });
      return report;
    }

    report.canRender = true;

    const firstIndexById = {};

    playlist.forEach((song, index) => {
      const entryId = song && song.id;
      const normalized = normalizePlaylistEntry(song || {});
      report.normalizedEntries[index] = normalized;

      if (!entryId) {
        addIssue(report, index, entryId, 'error', 'Missing id.');
      } else {
        if (!VALID_ID_PATTERN.test(entryId)) {
          addIssue(report, index, entryId, 'error', `Invalid id format: "${entryId}".`);
        }

        if (Object.prototype.hasOwnProperty.call(firstIndexById, entryId)) {
          addIssue(report, index, entryId, 'error', `Duplicate id: "${entryId}".`);
          addIssue(report, firstIndexById[entryId], entryId, 'error', `Duplicate id: "${entryId}".`);
        } else {
          firstIndexById[entryId] = index;
        }
      }

      if (!song || !song.title) {
        addIssue(report, index, entryId, 'error', 'Missing title.');
      }

      if (!song || !song.lyrics) {
        addIssue(report, index, entryId, 'warning', 'Missing lyrics.');
      }

      if (!song || !song.description) {
        addIssue(report, index, entryId, 'warning', 'Missing description.');
      }

      if (song && typeof song.pauseBeforeSeconds !== 'undefined' && normalized.normalizedPauseBeforeSeconds === null) {
        addIssue(report, index, entryId, 'error', 'Invalid pauseBeforeSeconds.');
      }

      if (song && typeof song.startTime !== 'undefined' && normalized.normalizedStartTime === null) {
        addIssue(report, index, entryId, 'error', 'Invalid startTime.');
      }

      if (song && !(song.stopTime === null || typeof song.stopTime === 'undefined' || song.stopTime === '') && normalized.normalizedStopTime === null) {
        addIssue(report, index, entryId, 'error', 'Invalid stopTime.');
      }

      if (
        normalized.normalizedStartTime !== null &&
        normalized.normalizedStopTime !== null &&
        normalized.normalizedStopTime <= normalized.normalizedStartTime
      ) {
        addIssue(report, index, entryId, 'error', 'stopTime must be greater than startTime.');
      }
    });

    return report;
  }

  function logValidationReport(report) {
    const groupTitle = `Playlist validation: ${report.errors.length} error(s), ${report.warnings.length} warning(s)`;
    const openGroup = console.groupCollapsed || console.group;
    const closeGroup = console.groupEnd;

    if (openGroup) openGroup.call(console, groupTitle);
    console.log('Validation report:', report);
    if (report.errors.length) console.error('Playlist validation errors:', report.errors);
    if (report.warnings.length) console.warn('Playlist validation warnings:', report.warnings);
    if (closeGroup) closeGroup.call(console);
  }

  function logProgressDebug(song, message, details) {
    console.log(`[Scam-A-Lot ${APP_VERSION}] progress ${song && song.id ? song.id : 'unknown'}: ${message}`, details || '');
  }

  function getAudioBlobUrl(audioSrc) {
    if (!audioBlobUrlCache[audioSrc]) {
      audioBlobUrlCache[audioSrc] = fetch(audioSrc)
        .then(res => {
          if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          audioBlobUrlCache[audioSrc] = blobUrl;
          return blobUrl;
        });
    }

    return Promise.resolve(audioBlobUrlCache[audioSrc]);
  }

  function renderValidationPanel(report, songList, configStatus, trackStatus) {
    const panel = document.createElement('section');
    const hasStatusErrors = configStatus && configStatus.errors.length;
    const hasStatusWarnings = (configStatus && configStatus.warnings.length) || (trackStatus && trackStatus.warning);
    const statusClass = report.errors.length || hasStatusErrors ? 'has-errors' : report.warnings.length || hasStatusWarnings ? 'has-warnings' : 'success';
    panel.className = `validation-panel ${statusClass}`;
    panel.setAttribute('aria-label', 'Playlist validation report');

    const configMessages = [];
    if (configStatus && configStatus.loadedConfig) {
      configMessages.push(`<p class="config-status">Loaded config: ${escapeHTML(configStatus.loadedConfig)}</p>`);
    }
    if (configStatus) {
      configStatus.warnings.forEach(message => {
        configMessages.push(`<p class="config-status validation-warning">Warning: ${escapeHTML(message)}</p>`);
      });
      configStatus.errors.forEach(message => {
        configMessages.push(`<p class="config-status validation-error">Error: ${escapeHTML(message)}</p>`);
      });
    }
    if (trackStatus && trackStatus.warning) {
      configMessages.push(`<p class="config-status validation-warning">Warning: ${escapeHTML(trackStatus.warning)}</p>`);
    }

    const issueItems = report.errors.concat(report.warnings).slice(0, 12).map(issue => {
      const issueClass = issue.type === 'error' ? 'validation-error' : 'validation-warning';
      const entryLabel = typeof issue.index === 'number' ? `Entry ${issue.index + 1}` : 'Config';
      const idLabel = issue.entryId ? ` (${issue.entryId})` : '';
      return `<li class="${issueClass}"><strong>${entryLabel}${escapeHTML(idLabel)}:</strong> ${escapeHTML(issue.message)}</li>`;
    }).join('');

    const remainingCount = report.errors.length + report.warnings.length - 12;

    panel.innerHTML = `
      <div class="validation-summary">
        <span>Playlist validation</span>
        <span>${report.entryCount} entries</span>
        <span>${report.errors.length} errors</span>
        <span>${report.warnings.length} warnings</span>
      </div>
      ${configMessages.join('')}
      ${report.errors.length || report.warnings.length ? `
        <ul class="validation-issues">
          ${issueItems}
          ${remainingCount > 0 ? `<li>${remainingCount} more issue(s); see console for details.</li>` : ''}
        </ul>
      ` : '<p class="validation-success">Playlist configuration looks valid.</p>'}
    `;

    songList.parentNode.insertBefore(panel, songList);
  }

  // ── Format time (seconds → MM:SS) ──
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ── Pause current audio ──
  function cancelPendingAutoPlayback() {
    if (pendingAutoPlayTimer) {
      clearTimeout(pendingAutoPlayTimer);
      pendingAutoPlayTimer = null;
    }
    pendingAutoPlayToken++;
  }

  function pauseCurrent() {
    cancelPendingAutoPlayback();
    if (currentAudio) {
      currentAudio.pause();
    }
    if (currentPlayBtn) {
      currentPlayBtn.textContent = '▶';
      currentPlayBtn.classList.remove('playing');
    }
    if (currentCard) {
      currentCard.classList.remove('now-playing');
    }
  }

  // ── Toggle play/pause for a song ──
  function togglePlay(audioEl, btnEl, cardEl) {
    cancelPendingAutoPlayback();
    if (currentAudio === audioEl && currentCard === cardEl && !audioEl.paused) {
      // Pause this track
      audioEl.pause();
      btnEl.textContent = '▶';
      btnEl.classList.remove('playing');
      cardEl.classList.remove('now-playing');
      currentAudio = null;
      currentPlayBtn = null;
      currentCard = null;
    } else {
      // Pause any other track, play this one
      pauseCurrent();
      const playPromise = audioEl.play();
      btnEl.textContent = '⏸';
      btnEl.classList.add('playing');
      cardEl.classList.add('now-playing');
      currentAudio = audioEl;
      currentPlayBtn = btnEl;
      currentCard = cardEl;

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          btnEl.textContent = '▶';
          btnEl.classList.remove('playing');
          cardEl.classList.remove('now-playing');
          if (currentAudio === audioEl && currentCard === cardEl) {
            currentAudio = null;
            currentPlayBtn = null;
            currentCard = null;
          }
        });
      }
    }
  }

  // ── Build a single song card ──
  function createSongCard(song, index, issues) {
    const songData = song || {};
    const card = document.createElement('div');
    card.className = 'song-card';
    const safeId = getSongKey(songData, index);
    card.id = `song-${safeId}`;

    if (issues && issues.errors.length) {
      card.classList.add('has-validation-error');
    } else if (issues && issues.warnings.length) {
      card.classList.add('has-validation-warning');
    }

    const hasAudio = !!songData.audio;
    const title = songData.title || '';
    const description = songData.description || '';
    const issueBadge = issues && (issues.errors.length || issues.warnings.length)
      ? `<span class="validation-badge ${issues.errors.length ? 'error' : 'warning'}">${issues.errors.length ? 'Config error' : 'Config warning'}</span>`
      : '';

    card.innerHTML = `
      <div class="song-header" data-song="${escapeHTML(safeId)}">
        <div class="song-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="song-info">
          <div class="song-title">${title}</div>
          <div class="song-description">${description}</div>
        </div>
        ${issueBadge}
        <div class="song-toggle">▼</div>
      </div>
      <div class="song-body">
        <div class="song-body-inner">
          ${hasAudio ? `
          <div class="audio-section">
            <div class="audio-player">
              <button class="play-btn" aria-label="Play ${title}">▶</button>
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
      let audio = null;
      let pendingSeekPct = null;
      let isUserSeeking = false;
      let isPrimingSeek = false;
      let blobSourceReady = false;
      let blobSourceLoading = false;
      let sourceReadyPromise = Promise.resolve();
      let hasHandledEnd = false;
      const audioSrc = `${getAudioBase()}${song.audio}`;
      const playbackState = getPlaybackState(song.id);

      progressBar.value = playbackState.progressValue;
      currentTimeEl.textContent = formatTime(playbackState.currentTime);

      function getSegmentStart() {
        return song.normalizedStartTime || 0;
      }

      function getSegmentStop() {
        return song.normalizedStopTime;
      }

      function getSegmentDuration(audioDuration) {
        const start = getSegmentStart();
        const stop = getSegmentStop();
        if (stop !== null && typeof stop !== 'undefined') {
          return Math.max(stop - start, 0);
        }

        return Number.isFinite(audioDuration) && audioDuration > start
          ? audioDuration - start
          : 0;
      }

      function getSegmentElapsed(currentTime, audioDuration) {
        const elapsed = currentTime - getSegmentStart();
        const duration = getSegmentDuration(audioDuration);
        return Math.min(Math.max(elapsed, 0), duration || 0);
      }

      function getProgressPctForTime(currentTime, audioDuration) {
        const duration = getSegmentDuration(audioDuration);
        return duration ? getSegmentElapsed(currentTime, audioDuration) / duration : 0;
      }

      function updateProgressDisplay(currentTime, audioDuration) {
        const segmentDuration = getSegmentDuration(audioDuration);
        const segmentElapsed = getSegmentElapsed(currentTime, audioDuration);
        progressBar.value = segmentDuration ? (segmentElapsed / segmentDuration) * 100 : 0;
        currentTimeEl.textContent = formatTime(segmentElapsed);
        durationEl.textContent = formatTime(segmentDuration || audioDuration || 0);
      }

      function savePlaybackState(currentTime, duration) {
        const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : playbackState.duration;
        const safeCurrentTime = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;

        playbackState.currentTime = safeCurrentTime;
        playbackState.duration = safeDuration || 0;
        const segmentDuration = getSegmentDuration(safeDuration);
        const segmentElapsed = getSegmentElapsed(safeCurrentTime, safeDuration);
        playbackState.progressValue = segmentDuration ? (segmentElapsed / segmentDuration) * 100 : 0;
      }

      function renderPlaybackState() {
        progressBar.value = playbackState.progressValue;
        currentTimeEl.textContent = formatTime(getSegmentElapsed(playbackState.currentTime, playbackState.duration));
        if (playbackState.duration) {
          durationEl.textContent = formatTime(getSegmentDuration(playbackState.duration) || playbackState.duration);
        }
      }

      function saveActiveSharedAudioState() {
        if (sharedAudio && sharedAudioSongId) {
          const activeState = getPlaybackState(sharedAudioSongId);
          const duration = Number.isFinite(sharedAudio.duration) && sharedAudio.duration > 0
            ? sharedAudio.duration
            : activeState.duration;
          const currentTime = Number.isFinite(sharedAudio.currentTime) && sharedAudio.currentTime > 0
            ? sharedAudio.currentTime
            : activeState.currentTime;

          activeState.currentTime = currentTime;
          activeState.duration = duration || 0;
        }
      }

      function handleTrackEnded() {
        if (hasHandledEnd) return;
        hasHandledEnd = true;

        if (audio) {
          audio.pause();
        }
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
        card.classList.remove('now-playing');
        progressBar.value = 0;
        currentTimeEl.textContent = '0:00';
        savePlaybackState(getSegmentStart(), audio ? audio.duration : playbackState.duration);
        if (currentAudio === audio) {
          currentAudio = null;
          currentPlayBtn = null;
          currentCard = null;
        }

        const allCards = document.querySelectorAll('.song-card');
        const currentIndex = Array.from(allCards).indexOf(card);
        for (let i = currentIndex + 1; i < allCards.length; i++) {
          const nextCard = allCards[i];
          const nextBtn = nextCard.querySelector('.play-btn');
          if (nextBtn && typeof nextCard._startPlayback === 'function') {
            const nextBody = nextCard.querySelector('.song-body');
            const nextToggle = nextCard.querySelector('.song-toggle');
            if (!nextBody.classList.contains('expanded')) {
              nextBody.classList.add('expanded');
              nextToggle.classList.add('expanded');
            }
            nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nextCard._startPlayback(true);
            break;
          }
        }
      }

      function ensureAudio() {
        if (!sharedAudio) {
          logProgressDebug(song, 'creating shared audio element');
          sharedAudio = document.createElement('audio');
          sharedAudio.preload = 'auto';
        }

        audio = sharedAudio;
        card.querySelector('.audio-section').appendChild(audio);

        audio.onended = handleTrackEnded;

        // Update progress bar during playback
        audio.ontimeupdate = () => {
          if (!isUserSeeking && pendingSeekPct === null && audio.duration) {
            updateProgressDisplay(audio.currentTime, audio.duration);
            savePlaybackState(audio.currentTime, audio.duration);
          }

          const stopTime = getSegmentStop();
          if (stopTime !== null && typeof stopTime !== 'undefined' && audio.currentTime >= stopTime) {
            handleTrackEnded();
          }
        };

        // Set duration when metadata loads
        audio.onloadedmetadata = () => {
          logProgressDebug(song, 'loadedmetadata', {
            duration: audio.duration,
            readyState: audio.readyState,
            networkState: audio.networkState,
            src: audio.currentSrc || audio.src
          });
          durationEl.textContent = formatTime(getSegmentDuration(audio.duration) || audio.duration);
          playbackState.duration = audio.duration;
          if (pendingSeekPct !== null) {
            applySeekPct(pendingSeekPct);
          } else if (!song.isSegment && playbackState.currentTime > 0) {
            applySeekPct(getProgressPctForTime(playbackState.currentTime, audio.duration), false);
          }
        };
        audio.ondurationchange = () => {
          logProgressDebug(song, 'durationchange', {
            duration: audio.duration,
            readyState: audio.readyState,
            networkState: audio.networkState
          });
          durationEl.textContent = formatTime(getSegmentDuration(audio.duration) || audio.duration);
          playbackState.duration = audio.duration;
          if (pendingSeekPct !== null) {
            applySeekPct(pendingSeekPct);
          } else if (!song.isSegment && playbackState.currentTime > 0) {
            applySeekPct(getProgressPctForTime(playbackState.currentTime, audio.duration), false);
          }
        };
        audio.oncanplay = () => {
          logProgressDebug(song, 'canplay', {
            duration: audio.duration,
            readyState: audio.readyState,
            networkState: audio.networkState
          });
          if (pendingSeekPct !== null) {
            applySeekPct(pendingSeekPct, false);
          }
        };
        audio.onerror = () => {
          logProgressDebug(song, 'audio error', {
            code: audio.error && audio.error.code,
            message: audio.error && audio.error.message,
            networkState: audio.networkState,
            src: audio.currentSrc || audio.src
          });
        };

        audio.volume = volumeSlider.value;

        if (sharedAudioSongId !== song.id) {
          saveActiveSharedAudioState();
          pendingSeekPct = null;
          blobSourceReady = false;
          blobSourceLoading = false;
          renderPlaybackState();
          sharedAudioSongId = song.id;

          if (typeof audioBlobUrlCache[audioSrc] === 'string') {
            blobSourceReady = true;
            audio.src = audioBlobUrlCache[audioSrc];
            audio.load();
            sourceReadyPromise = Promise.resolve();
          } else if (audioBlobUrlCache[audioSrc] && typeof audioBlobUrlCache[audioSrc].then === 'function') {
            sourceReadyPromise = audioBlobUrlCache[audioSrc].then(blobUrl => {
              if (sharedAudioSongId === song.id) {
                blobSourceReady = true;
                audio.src = blobUrl;
                audio.load();
              }
            });
          } else {
            audio.src = audioSrc;
            audio.load();
            sourceReadyPromise = Promise.resolve();
          }
        }

        return audio;
      }

      function ensureBlobSource() {
        const activeAudio = ensureAudio();
        if (blobSourceReady || blobSourceLoading) return;

        blobSourceLoading = true;
        logProgressDebug(song, 'fetching audio blob for reliable Chrome seek', { src: audioSrc });

        getAudioBlobUrl(audioSrc)
          .then(blobUrl => {
            blobSourceLoading = false;
            if (sharedAudioSongId !== song.id) return;

            blobSourceReady = true;
            activeAudio.src = blobUrl;
            activeAudio.load();
            logProgressDebug(song, 'audio blob ready', { blobUrl });
          })
          .catch(err => {
            blobSourceLoading = false;
            logProgressDebug(song, 'audio blob fetch failed', { message: err.message });
          });
      }

      function waitForDuration(activeAudio) {
        if (Number.isFinite(activeAudio.duration) && activeAudio.duration > 0) {
          return Promise.resolve();
        }

        return new Promise(resolve => {
          const done = () => {
            activeAudio.removeEventListener('loadedmetadata', done);
            activeAudio.removeEventListener('durationchange', done);
            resolve();
          };
          activeAudio.addEventListener('loadedmetadata', done);
          activeAudio.addEventListener('durationchange', done);
          activeAudio.load();
        });
      }

      function preparePlaybackStart(activeAudio) {
        return sourceReadyPromise
          .then(() => waitForDuration(activeAudio))
          .then(() => {
            if (sharedAudioSongId !== song.id) return false;

            hasHandledEnd = false;
            if (song.isSegment) {
              applySeekPct(0, false);
            } else if (playbackState.currentTime > 0) {
              applySeekPct(getProgressPctForTime(playbackState.currentTime, activeAudio.duration), false);
            }

            return true;
          });
      }

      function stopControlEvent(e) {
        e.stopPropagation();
      }

      function stopScrubEvent(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      function primeSeek(pct) {
        const activeAudio = ensureAudio();
        if (isPrimingSeek || !activeAudio.paused) return;

        isPrimingSeek = true;
        pendingSeekPct = pct;
        const wasMuted = activeAudio.muted;
        activeAudio.muted = true;
        activeAudio.load();

        const playPromise = activeAudio.play();
        if (!playPromise || typeof playPromise.then !== 'function') {
          activeAudio.pause();
          activeAudio.muted = wasMuted;
          isPrimingSeek = false;
          return;
        }

        playPromise
          .then(() => {
            activeAudio.pause();
            activeAudio.muted = wasMuted;
            isPrimingSeek = false;
            if (pendingSeekPct !== null) {
              applySeekPct(pendingSeekPct, false);
            }
          })
          .catch(() => {
            activeAudio.muted = wasMuted;
            isPrimingSeek = false;
          });
      }

      function applySeekPct(pct, allowPrime = true) {
        const activeAudio = ensureAudio();
        const safePct = Math.min(Math.max(pct, 0), 1);
        progressBar.value = safePct * 100;

        logProgressDebug(song, 'apply seek requested', {
          requestedPct: safePct,
          duration: activeAudio.duration,
          currentTimeBefore: activeAudio.currentTime,
          readyState: activeAudio.readyState,
          networkState: activeAudio.networkState,
          paused: activeAudio.paused,
          seekableRanges: activeAudio.seekable.length
        });

        if (Number.isFinite(activeAudio.duration) && activeAudio.duration > 0) {
          const targetTime = getSegmentStart() + (safePct * getSegmentDuration(activeAudio.duration));
          activeAudio.currentTime = targetTime;
          currentTimeEl.textContent = formatTime(getSegmentElapsed(targetTime, activeAudio.duration));
          savePlaybackState(targetTime, activeAudio.duration);
          const seekAccepted = targetTime === 0 || Math.abs(activeAudio.currentTime - targetTime) <= 0.75;
          logProgressDebug(song, 'apply seek completed', {
            targetTime,
            currentTimeAfter: activeAudio.currentTime,
            sliderValue: progressBar.value,
            seekAccepted,
            blobSourceReady
          });
          if (seekAccepted) {
            pendingSeekPct = null;
          } else {
            pendingSeekPct = safePct;
            ensureBlobSource();
          }
          if (allowPrime && activeAudio.paused && !seekAccepted) {
            primeSeek(safePct);
          }
          return seekAccepted;
        }

        pendingSeekPct = safePct;
        logProgressDebug(song, 'seek pending until duration is available', {
          requestedPct: safePct,
          readyState: activeAudio.readyState,
          networkState: activeAudio.networkState
        });
        activeAudio.load();
        return false;
      }

      function seekToProgress() {
        const pct = Number(progressBar.value) / 100;
        applySeekPct(pct);
      }

      function previewProgressPct(pct) {
        const activeAudio = ensureAudio();
        const safePct = Math.min(Math.max(pct, 0), 1);
        progressBar.value = safePct * 100;

        if (Number.isFinite(activeAudio.duration) && activeAudio.duration > 0) {
          currentTimeEl.textContent = formatTime(safePct * getSegmentDuration(activeAudio.duration));
        } else if (playbackState.duration) {
          currentTimeEl.textContent = formatTime(safePct * playbackState.duration);
        }
      }

      function getPointerPct(e) {
        const rect = progressBar.getBoundingClientRect();
        if (!rect.width) return Number(progressBar.value) / 100;
        return (e.clientX - rect.left) / rect.width;
      }

      function handleScrubMove(e) {
        if (!isUserSeeking) return;
        previewProgressPct(getPointerPct(e));
        stopScrubEvent(e);
      }

      function handleScrubEnd(e) {
        if (!isUserSeeking) return;
        logProgressDebug(song, 'scrub end', {
          pointerPct: getPointerPct(e),
          sliderValueBeforeSeek: progressBar.value
        });
        const pct = getPointerPct(e);
        applySeekPct(pct);
        isUserSeeking = false;
        document.removeEventListener('pointermove', handleScrubMove);
        document.removeEventListener('pointerup', handleScrubEnd);
        document.removeEventListener('pointercancel', handleScrubEnd);
        stopScrubEvent(e);
      }

      // Play/pause
      card._startPlayback = (isAutomatic = false) => {
        const activeAudio = ensureAudio();

        if (currentAudio === activeAudio && currentCard === card && !activeAudio.paused) {
          togglePlay(activeAudio, playBtn, card);
          return;
        }

        const startWhenReady = () => {
          preparePlaybackStart(activeAudio).then(shouldStart => {
            if (shouldStart) {
              togglePlay(activeAudio, playBtn, card);
            }
          });
        };

        if (isAutomatic && song.normalizedPauseBeforeSeconds > 0) {
          cancelPendingAutoPlayback();
          const timerToken = pendingAutoPlayToken;
          pendingAutoPlayTimer = setTimeout(() => {
            pendingAutoPlayTimer = null;
            if (timerToken === pendingAutoPlayToken) {
              startWhenReady();
            }
          }, song.normalizedPauseBeforeSeconds * 1000);
        } else {
          cancelPendingAutoPlayback();
          startWhenReady();
        }
      };
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card._startPlayback();
      });

      // Seek via progress bar
      progressBar.addEventListener('pointerdown', (e) => {
        isUserSeeking = true;
        previewProgressPct(getPointerPct(e));
        document.addEventListener('pointermove', handleScrubMove);
        document.addEventListener('pointerup', handleScrubEnd);
        document.addEventListener('pointercancel', handleScrubEnd);
        stopScrubEvent(e);
      });
      progressBar.addEventListener('click', stopControlEvent);
      progressBar.addEventListener('input', (e) => {
        if (!isUserSeeking) {
          seekToProgress();
        }
        stopControlEvent(e);
      });
      progressBar.addEventListener('change', (e) => {
        if (!isUserSeeking) {
          seekToProgress();
        }
        stopControlEvent(e);
      });

      // Volume control
      volumeSlider.addEventListener('pointerdown', stopControlEvent);
      volumeSlider.addEventListener('pointerup', stopControlEvent);
      volumeSlider.addEventListener('click', stopControlEvent);
      volumeSlider.addEventListener('input', (e) => {
        if (audio) {
          audio.volume = volumeSlider.value;
        }
        stopControlEvent(e);
      });
    }

    // Lyrics toggle
    let lyricsLoaded = false;
    lyricsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (!lyricsLoaded) {
        // Fetch lyrics
        fetch(`${getLyricsBase()}${song.lyrics}`)
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

  function getTrackStatus(trackId, playlist) {
    const status = {
      requestedTrack: trackId,
      found: false,
      warning: ''
    };

    if (!trackId) {
      return status;
    }

    if (!VALID_ID_PATTERN.test(trackId)) {
      status.warning = `Track "${trackId}" is not a valid entry id. Showing the beginning of the playlist instead.`;
      return status;
    }

    status.found = playlist.some(song => song && song.id === trackId);
    if (!status.found) {
      status.warning = `Track "${trackId}" was not found in this playlist. Showing the beginning of the playlist instead.`;
    }

    return status;
  }

  function selectTrack(trackId) {
    if (!trackId) return;

    const card = document.getElementById(`song-${trackId}`);
    if (!card) return;

    const body = card.querySelector('.song-body');
    const toggle = card.querySelector('.song-toggle');
    card.classList.add('selected-track');
    if (body) body.classList.add('expanded');
    if (toggle) toggle.classList.add('expanded');

    window.setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function hasValidationProblems(report, configStatus, trackStatus) {
    return (
      report.errors.length > 0 ||
      report.warnings.length > 0 ||
      (configStatus && configStatus.errors.length > 0) ||
      (configStatus && configStatus.warnings.length > 0) ||
      (trackStatus && trackStatus.warning)
    );
  }

  // ── Initialize the page ──
  function init(configStatus, query) {
    const songList = document.getElementById('song-list');
    const playlist = getPlaylist();
    const validationReport = validatePlaylist();
    const trackStatus = Array.isArray(playlist)
      ? getTrackStatus(query.track, playlist)
      : { requestedTrack: query.track, found: false, warning: query.track ? `Track "${query.track}" could not be selected because the playlist is invalid.` : '' };

    logValidationReport(validationReport);
    if (hasValidationProblems(validationReport, configStatus, trackStatus)) {
      renderValidationPanel(validationReport, songList, configStatus, trackStatus);
    }


    if (!validationReport.canRender) {
      songList.innerHTML = '<p class="playlist-error">Playlist could not be rendered because the configuration is invalid.</p>';
      return;
    }

    validationReport.normalizedEntries.forEach((song, index) => {
      const card = createSongCard(song, index, validationReport.issuesByIndex[index]);
      setupSongCard(card, song);
      songList.appendChild(card);
    });

    if (trackStatus.found) {
      selectTrack(query.track);
    }
  }

  function startApp() {
    console.log(`[Scam-A-Lot ${APP_VERSION}] app script loaded`, {
      href: window.location.href,
      userAgent: navigator.userAgent
    });
    const query = parseQueryParams();
    loadSelectedConfig(query).then(configStatus => {
      console.log(`[Scam-A-Lot ${APP_VERSION}] config load complete`, configStatus);
      init(configStatus, query);
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
})();
