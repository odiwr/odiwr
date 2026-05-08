/* audio.js — odiwr.com
   Left-panel music player.
   Features: shuffled playlist, play/pause/prev/next, track display with
   blinking caret on pause, and a VCR-style click-to-reveal volume panel.
   Asset path: /assets/music/
*/

const playlist = [
  { title: 'LOST IN PARADISE',            artist: 'ALI, AKLO',                              src: '/assets/music/LOST IN PARADISE - ALI, AKLO.mp3' },
  { title: '82.99 F.M',                   artist: 'ANDER503',                               src: '/assets/music/82.99 F.M - ANDER503.mp3' },
  { title: 'A Night To Remember',         artist: 'beabadoobee, Laufey',                    src: '/assets/music/A Night To Remember - beabadoobee, Laufey.mp3' },
  { title: 'Agua De Beber',               artist: 'Sergio Mendes',                          src: '/assets/music/Agua De Beber - Sergio Mendes.mp3' },
  { title: 'AIZO',                        artist: 'King Gnu',                               src: '/assets/music/AIZO - King Gnu.mp3' },
  { title: 'bad',                         artist: 'wave to earth',                          src: '/assets/music/bad - wave to earth.mp3' },
  { title: 'Been So Long',                artist: 'Durand Jones & The Indications, Aaron Frazer', src: '/assets/music/Been So Long - Durand Jones & The Indications, Aaron Frazer.mp3' },
  { title: 'Consume',                     artist: 'Chase Atlantic, GOON DES GARCONS',       src: '/assets/music/Consume - Chase Atlantic, GOON DES GARCONS.mp3' },
  { title: 'Does The Swallow Dream Of Flying', artist: 'Cosmo Sheldrake, HOWL',             src: '/assets/music/Does The Swallow Dream Of Flying - Cosmo Sheldrake, HOWL.mp3' },
  { title: 'F L Y (1991 MIX)',            artist: 'Spectrum',                               src: '/assets/music/F L Y (1991 MIX) - Spectrum.mp3' },
  { title: 'Favour',                      artist: 'Avenoir',                                src: '/assets/music/Favour - Avenoir.mp3' },
  { title: 'Inaction',                    artist: 'We Are Scientists',                      src: '/assets/music/Inaction - We Are Scientists.mp3' },
  { title: 'Judas',                       artist: 'Lady Gaga',                              src: '/assets/music/Judas - Lady Gaga.mp3' },
  { title: 'Last Surprise',               artist: 'Lyn',                                    src: '/assets/music/Last Surprise - Lyn.mp3' },
  { title: 'love',                        artist: 'wave to earth',                          src: '/assets/music/love - wave to earth.mp3' },
  { title: 'Mas Que Nada',                artist: 'Sergio Mendes',                          src: '/assets/music/Mas Que Nada - Sergio Mendes.mp3' },
  { title: 'Navajo',                      artist: 'Masego',                                 src: '/assets/music/Navajo - Masego.mp3' },
  { title: 'NIGHT DANCER',                artist: 'imase',                                  src: '/assets/music/NIGHT DANCER - imase.mp3' },
  { title: 'nytmp',                       artist: 'berlioz',                                src: '/assets/music/nytmp - berlioz.mp3' },
  { title: 'Oh Qué Será?',                artist: 'Willie Colón',                           src: '/assets/music/Oh Qué Será - Willie Colón.mp3' },
  { title: 'peace',                       artist: 'berlioz',                                src: '/assets/music/peace - berlioz.mp3' },
  { title: 'seasons',                     artist: 'wave to earth',                          src: '/assets/music/seasons - wave to earth.mp3' },
  { title: 'Sober',                       artist: 'Childish Gambino',                       src: '/assets/music/Sober - Childish Gambino.mp3' },
  { title: 'Sunny',                       artist: 'Boney M.',                               src: '/assets/music/Sunny - Boney M..mp3' },
  { title: "Taking What's Not Yours",     artist: 'TV Girl',                                src: "/assets/music/Taking What's Not Yours - TV Girl.mp3" },
];

/* ── Shuffle: keep track 0 first, shuffle the rest ── */
function getShuffledPlaylist(arr) {
  const first = arr[0];
  const rest  = arr.slice(1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}

const activePlaylist = getShuffledPlaylist(playlist);
let currentIndex = 0;
let hasPlayed    = false;

const audio       = new Audio();
const playBtn     = document.getElementById('play-btn');
const trackInfoEl = document.getElementById('track-info');

const MAX_CHARS = 32; /* max visible chars after the "> " caret */

/* Build track-info DOM: caret span + text span */
trackInfoEl.innerHTML =
  '<span id="track-caret">&gt;</span>' +
  '<span id="track-info-text">CLICK TO ADJUST VOLUME</span>';

const caretEl    = () => document.getElementById('track-caret');
const trackTextEl = () => document.getElementById('track-info-text');

/* Initial placeholder blinks */
trackTextEl().classList.add('blinking');

function getTrackBody(index) {
  const { title, artist } = activePlaylist[index];
  const body = `${title} - ${artist}`;
  return body.length > MAX_CHARS ? body.substring(0, MAX_CHARS) + '...' : body;
}

function setTrackText(body, blinkCaret) {
  trackTextEl().textContent = body;
  trackTextEl().classList.remove('blinking');
  caretEl().classList.toggle('blinking', blinkCaret);
}

function loadTrack(index) {
  currentIndex  = index;
  audio.src     = activePlaylist[currentIndex].src;
  if (hasPlayed) setTrackText(getTrackBody(currentIndex), false);
}

function togglePlay() {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = 'PAUSE';
    hasPlayed = true;
    setTrackText(getTrackBody(currentIndex), false);
  } else {
    audio.pause();
    playBtn.textContent = 'PLAY';
    setTrackText(getTrackBody(currentIndex), true); /* caret blinks while paused */
  }
}

function playNext() {
  loadTrack((currentIndex + 1) % activePlaylist.length);
  audio.play();
  playBtn.textContent = 'PAUSE';
  hasPlayed = true;
  setTrackText(getTrackBody(currentIndex), false);
}

function playPrev() {
  loadTrack((currentIndex - 1 + activePlaylist.length) % activePlaylist.length);
  audio.play();
  playBtn.textContent = 'PAUSE';
  hasPlayed = true;
  setTrackText(getTrackBody(currentIndex), false);
}

playBtn.addEventListener('click', togglePlay);
document.getElementById('next-btn').addEventListener('click', playNext);
document.getElementById('prev-btn').addEventListener('click', playPrev);
audio.addEventListener('ended', playNext);


/* ════════════════════════════════════════
   VOLUME PANEL
   Appears below track-info on click.
   VCR bar-graph style.
════════════════════════════════════════ */

const TOTAL_BARS = 20;
const MAX_VOL    = 1.0;
let currentVol   = 0.5;
audio.volume     = currentVol;

const SVG_MINUS = `<svg viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg">
  <line x1="1" y1="4.5" x2="8" y2="4.5" stroke="rgb(0,0,255)" stroke-width="1.5" stroke-linecap="square"/>
</svg>`;

const SVG_PLUS = `<svg viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg">
  <line x1="4.5" y1="1" x2="4.5" y2="8" stroke="rgb(0,0,255)" stroke-width="1.5" stroke-linecap="square"/>
  <line x1="1" y1="4.5" x2="8" y2="4.5" stroke="rgb(0,0,255)" stroke-width="1.5" stroke-linecap="square"/>
</svg>`;

function buildVolPanel() {
  const panel    = document.createElement('div');
  panel.id       = 'volume-panel';

  const minusBtn = document.createElement('button');
  minusBtn.className = 'vol-btn';
  minusBtn.id        = 'vol-minus';
  minusBtn.innerHTML = SVG_MINUS;
  minusBtn.setAttribute('aria-label', 'Volume down');

  const barsEl = document.createElement('div');
  barsEl.id    = 'vol-bars';

  const plusBtn  = document.createElement('button');
  plusBtn.className = 'vol-btn';
  plusBtn.id        = 'vol-plus';
  plusBtn.innerHTML = SVG_PLUS;
  plusBtn.setAttribute('aria-label', 'Volume up');

  panel.appendChild(minusBtn);
  panel.appendChild(barsEl);
  panel.appendChild(plusBtn);

  /* Insert immediately after #track-info */
  trackInfoEl.parentNode.insertBefore(panel, trackInfoEl.nextSibling);

  renderBars();

  minusBtn.addEventListener('click', e => { e.stopPropagation(); setVolume(currentVol - 1 / TOTAL_BARS); });
  plusBtn.addEventListener( 'click', e => { e.stopPropagation(); setVolume(currentVol + 1 / TOTAL_BARS); });

  /* Click on bar track: set volume proportionally */
  barsEl.addEventListener('click', e => {
    e.stopPropagation();
    const rect   = barsEl.getBoundingClientRect();
    const PAD    = 6;
    const usable = rect.width - PAD * 2;
    const clickX = Math.max(0, Math.min(e.clientX - rect.left - PAD, usable));
    setVolume((clickX / usable) * MAX_VOL);
  });
}

function setVolume(v) {
  currentVol   = Math.max(0, Math.min(MAX_VOL, v));
  audio.volume = currentVol;
  renderBars();
}

function renderBars() {
  const barsEl = document.getElementById('vol-bars');
  if (!barsEl) return;
  barsEl.innerHTML = '';
  const filledCount = Math.round((currentVol / MAX_VOL) * TOTAL_BARS);
  for (let i = 0; i < TOTAL_BARS; i++) {
    const slot = document.createElement('span');
    slot.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:8px;flex-shrink:0;';
    const bar       = document.createElement('span');
    bar.className   = 'vol-bar ' + (i < filledCount ? 'filled' : 'empty');
    slot.appendChild(bar);
    barsEl.appendChild(slot);
  }
}

/* Toggle volume panel; on first click before play, reveal the track name */
trackInfoEl.addEventListener('click', () => {
  const panel  = document.getElementById('volume-panel');
  const isOpen = trackInfoEl.classList.toggle('vol-open');
  panel.classList.toggle('vol-visible', isOpen);

  /* If user hasn't played yet, just reveal the first track name without playing */
  if (!hasPlayed) {
    trackTextEl().classList.remove('blinking');
    trackTextEl().textContent = getTrackBody(currentIndex);
    /* hasPlayed stays false so PLAY button still triggers audio.play() */
  }
});

/* ── Init ── */
buildVolPanel();
loadTrack(currentIndex);
