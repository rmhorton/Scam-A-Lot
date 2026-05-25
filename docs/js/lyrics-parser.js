/**
 * Parses lyric text files into structured HTML.
 * 
 * Format conventions in the lyrics files:
 *   - First line(s): Song title (ALL CAPS) or AI prompt/description
 *   - === separator between description and lyrics (in some files)
 *   - Section headers: [VERSE 1], [CHORUS], [BRIDGE], etc.
 *   - Speaker labels: [THE KING], [SOLOIST], [CHOIR], [CROWD CHANTS]
 *   - Stage directions: [clap clap], [Now stomp!], (parenthetical)
 *   - Dividers: ⸻ or ---
 */

function parseLyrics(rawText) {
  const lines = rawText.split('\n');
  const elements = [];
  let description = '';

  // Phase 1: collect description lines (before first bracket header or ===)
  let descriptionLines = [];
  let lyricsStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '===') {
      lyricsStartIndex = i + 1;
      break;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      lyricsStartIndex = i;
      break;
    }
    if (line) {
      descriptionLines.push(line);
    }
  }

  // Separate title from description in collected lines
  let descOnly = [];
  for (const dl of descriptionLines) {
    const clean = dl.replace(/^#\s*/, '');
    // Skip lines that are all-caps titles
    if (clean === clean.toUpperCase() && clean.length > 3) {
      continue;
    }
    descOnly.push(dl);
  }
  description = descOnly.join(' ');

  // Known speaker patterns (names, roles, groups)
  const speakerPatterns = [
    /\b(king|queen|soloist|choir|crowd|peasant|master|ceremonies)\b/i,
    /\b(everyone|ensemble|all)\b/i,
    /\b(narrator|host|dj|flower|dave|pirate|radio)\b/i,
    /\b(chants|sings|whispers|shouts|chants|response)\b/i,
    /\b(boy|girl|man|woman|child|children)\b/i,
  ];

  // Stage direction patterns (actions, sounds)
  const directionPatterns = [
    /\b(clap|stomp|hop|wave|turn|snap|high five)\b/i,
    /\b(step|pull|spread|hands up)\b/i,
    /\b(now|then|next)\b/i,
  ];

  // Phase 2: process lyrics from lyricsStartIndex onward
  for (let i = lyricsStartIndex; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Process dividers
    if (line === '⸻' || line === '---' || line === '—') {
      elements.push({ type: 'divider', content: '⸻' });
      continue;
    }
    
    // Process bracketed headers
    if (line.startsWith('[') && line.endsWith(']')) {
      const content = line.slice(1, -1);

      // Determine if it's a section header, speaker, or stage direction
      const sectionKeywords = [
        'verse', 'chorus', 'bridge', 'intro', 'outro', 'pre-chorus',
        'post-chorus', 'interlude', 'phase', 'final', 'solo', 'duet',
        'grand waltz'
      ];
      
      const lower = content.toLowerCase();
      const isSection = sectionKeywords.some(kw => lower.includes(kw)) ||
                        /^verse\s*\d/i.test(lower) ||
                        /^chorus\s*\d/i.test(lower) ||
                        /^phase\s*\d/i.test(lower);
      
      if (isSection) {
        elements.push({ type: 'section-header', content: content });
      } else if (directionPatterns.some(p => p.test(content))) {
        // Stage direction like [Now stomp!], [clap clap]
        elements.push({ type: 'stage-direction', content: `[${content}]` });
      } else if (speakerPatterns.some(p => p.test(content))) {
        elements.push({ type: 'speaker', content: content });
      } else {
        // Default: treat as stage direction for safety
        elements.push({ type: 'stage-direction', content: `[${content}]` });
      }
      continue;
    }

    // Stage directions in parentheses (whole line)
    if (line.startsWith('(') && line.endsWith(')')) {
      elements.push({ type: 'stage-direction', content: line });
      continue;
    }
    
    // Regular lyric line
    elements.push({ type: 'lyric', content: line });
  }
  
  return { description, elements };
}

function renderLyricsHTML(parsed) {
  let html = '';
  
  for (const el of parsed.elements) {
    switch (el.type) {
      case 'divider':
        html += `<div class="lyrics-divider">${el.content}</div>`;
        break;
      case 'section-header':
        html += `<div class="section-header">${escapeHTML(el.content)}</div>`;
        break;
      case 'speaker':
        html += `<span class="speaker">[${escapeHTML(el.content)}]</span>`;
        break;
      case 'stage-direction':
        html += `<p class="stage-direction">${escapeHTML(el.content)}</p>`;
        break;
      case 'lyric':
        html += `<p>${escapeHTML(el.content)}</p>`;
        break;
    }
  }
  
  return html;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
