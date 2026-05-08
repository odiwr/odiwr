/* channels.js — odiwr.com
   Handles:
     1. VCR-style channel switching with static-gif flash
     2. DVD bouncing-logo idle screensaver (triggers after 60s of inactivity)
     3. Gif bullet randomisation across the whole page
   
   Asset paths updated to new hierarchy:
     /assets/gifs/static/   — channel-switch flash GIFs
     /assets/gifs/bullets/  — randomised list-bullet GIFs
     /assets/gifs/logo/     — site logo GIF (referenced in HTML, not here)
*/

/* ════════════════════════════════════════
   CHANNEL SWITCHING
════════════════════════════════════════ */

const FLASH_GIFS = [
  '/assets/gifs/static/static1.gif',
  '/assets/gifs/static/static2.gif',
];

const CHANNELS = {
  idle: 'channel-idle',
  1:    'channel-1',
  2:    'channel-2',
  3:    'channel-3',
  4:    'channel-4',
  5:    'channel-5',
};

const CHANNEL_LABELS = {
  idle: 'IDLE',
  1:    'CH 01',
  2:    'CH 02',
  3:    'CH 03',
  4:    'CH 04',
  5:    'CH 05',
};

let currentChannel = 'idle';
let isFlashing     = false;
let cursorWaitTimer = null;

const flashEl   = document.getElementById('channel-flash');
const flashGif  = document.getElementById('flash-gif');
const hudCh     = document.getElementById('hud-ch');
const chDisplay = document.getElementById('ch-display');
const navBtns   = document.querySelectorAll('.nav-btn[data-channel]');
const btnRandom = document.getElementById('btn-random');

/* Show the wait cursor for a fixed duration (ms) */
function setWaitCursorFor(ms = 500) {
  document.body.classList.add('is-cursor-wait');
  clearTimeout(cursorWaitTimer);
  cursorWaitTimer = setTimeout(() => {
    document.body.classList.remove('is-cursor-wait');
    cursorWaitTimer = null;
  }, ms);
}

/* Show the wait cursor until the page unloads (real navigation) */
function setWaitCursorUntilUnload() {
  document.body.classList.add('is-cursor-wait');
}

function switchChannel(target) {
  /* Update the body attribute so CSS can scope by current channel */
  document.body.setAttribute('data-current-channel', target);

  /* If MENU is in BACK mode, bail out — closeProject handles the click */
  const menuBtn = document.querySelector('.nav-btn[data-channel="1"]');
  if (menuBtn && menuBtn.classList.contains('nav-btn--back-mode') && target === 1) return;

  if (isFlashing || target === currentChannel) return;
  isFlashing = true;

  /* Trigger the channel-switch static flash */
  const gif = FLASH_GIFS[Math.floor(Math.random() * FLASH_GIFS.length)];
  flashGif.src = gif + '?t=' + Date.now();
  flashEl.classList.add('active');

  setTimeout(() => {
    /* Hide all channels, reveal the target */
    document.querySelectorAll('.screen-channel').forEach(el => el.classList.add('hidden'));
    const nextEl = document.getElementById(CHANNELS[target]);
    if (nextEl) nextEl.classList.remove('hidden');

    /* Re-render info title bars if they exist (responsive width calculation) */
    if (typeof window.renderInfoTitleBars === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(window.renderInfoTitleBars));
    }

    currentChannel = target;

    /* Update HUD displays */
    if (hudCh)     hudCh.textContent = CHANNEL_LABELS[target] || 'CH';
    if (chDisplay) chDisplay.textContent = target !== 'idle' ? String(target).padStart(2, '0') : '--';

    /* Update active state on nav buttons */
    navBtns.forEach(btn => {
      btn.classList.toggle('active', String(btn.dataset.channel) === String(target));
    });

    /* Reset MENU if we navigated away while a project was open */
    if (menuBtn && menuBtn.classList.contains('nav-btn--back-mode')) {
      menuBtn.textContent = 'MENU';
      menuBtn.classList.remove('nav-btn--back-mode');
    }

    /* Reset RESEARCH if we navigated away while a PDF was open */
    const researchBtn = document.querySelector('.nav-btn[data-channel="4"]');
    if (researchBtn && researchBtn.classList.contains('nav-btn--back-mode')) {
      researchBtn.textContent = 'RESEARCH';
      researchBtn.classList.remove('nav-btn--back-mode');
    }

    flashEl.classList.remove('active');
    isFlashing = false;
  }, 280);
}

/* Hover preload — preload a random flash GIF on nav button hover */
navBtns.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (Number(btn.dataset.channel) === currentChannel) return;
    const preload = new Image();
    preload.src = FLASH_GIFS[Math.floor(Math.random() * FLASH_GIFS.length)];
  });

  btn.addEventListener('click', () => {
    setWaitCursorFor(500);
    switchChannel(Number(btn.dataset.channel));
  });
});

/* Random channel button */
if (btnRandom) {
  btnRandom.addEventListener('click', () => {
    setWaitCursorFor(500);
    const others = [1, 2, 3, 4].filter(k => k !== currentChannel);
    switchChannel(others[Math.floor(Math.random() * others.length)]);
  });
}

/* Keyboard shortcuts: 1–4 = channels, R = random, H/0 = idle */
document.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '4') {
    setWaitCursorFor(500);
    switchChannel(Number(e.key));
  } else if (e.key.toLowerCase() === 'r') {
    setWaitCursorFor(500);
    if (btnRandom) btnRandom.click();
  } else if (e.key.toLowerCase() === 'h' || e.key === '0') {
    setWaitCursorFor(500);
    switchChannel('idle');
  }
});

/* Show wait cursor on real page navigation links until unload */
document.addEventListener('click', e => {
  const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!link) return;
  if (link.hasAttribute('download')) return;
  if (link.target && link.target.toLowerCase() === '_blank') return;
  const href = link.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
  setWaitCursorUntilUnload();
}, true);

/* Remove wait cursor if user comes back via bfcache */
window.addEventListener('pageshow', () => {
  document.body.classList.remove('is-cursor-wait');
});

/* Expose switchChannel globally for other scripts */
window.odiwr = window.odiwr || {};
window.odiwr.switchChannel = switchChannel;


/* ════════════════════════════════════════
   IDLE DVD SCREENSAVER
   Triggers after 60s of user inactivity.
   Completely separate from channel switching.
════════════════════════════════════════ */

const IDLE_TIMEOUT_MS = 60_000;
let idleTimer         = null;
let idleOverlayActive = false;
let dvdRafId          = 0;
let lastDvdTs         = 0;

const DVD_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];

const DVD_SVG = `
<svg viewBox="26 278 544 273" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <path d="M137.34,447.54c46.69,0,84.54-37.85,84.54-84.54,0-17.94-5.6-34.56-15.13-48.24h125.89s61.67-3.31,61.67,46.38-100.32,50.11-100.32,50.11l19.32-82h-65.37l-26.72,117.62h91.69s138.97-5.8,144.73-88.22c1.1-15.81-2.78-28.48-9.77-38.63h94.61l-26.06-40.89h-189.58.01s-178.97.01-178.97.01c-3.45-.43-6.97-.68-10.54-.68-46.69,0-84.54,37.85-84.54,84.54s37.85,84.54,84.54,84.54ZM137.34,320.03c23.74,0,42.98,19.24,42.98,42.98s-19.24,42.98-42.98,42.98-42.98-19.24-42.98-42.98,19.24-42.98,42.98-42.98Z"></path>
  <polygon points="515.1 446.21 542.47 329.26 477.1 329.26 451.04 446.21 515.1 446.21"></polygon>
  <ellipse cx="433.08" cy="507.63" rx="16.31" ry="11.32"></ellipse>
  <path d="M277.33,496.59v22.06s19.76,2.29,19.76-10.94-19.76-11.12-19.76-11.12Z"></path>
  <path d="M297.64,469.23c-149.51,0-270.71,18.09-270.71,40.41s121.2,40.41,270.71,40.41,270.71-18.09,270.71-40.41-121.2-40.41-270.71-40.41ZM166.51,527.82h-12.13l-23.34-40.24h15.71l14.21,24.53,13.32-24.53h16.59l-24.35,40.24ZM230.92,527.82h-14.82v-40.24c-.35-.35,14.82,0,14.82,0v40.24ZM285.27,527.82h-22.94v-40.39s25.15.16,25.15.16c0,0,25.15,1.59,25.15,20.12s-27.35,20.12-27.35,20.12ZM373.68,496.59h-18v7.06h16.94v8.29h-16.76v7.59h17.82v8.29h-32.82v-40.39c-.53,0,32.82,0,32.82,0v9.16ZM433.08,529.25c-17.21,0-31.16-9.68-31.16-21.63s13.95-21.63,31.16-21.63,31.16,9.68,31.16,21.63-13.95,21.63-31.16,21.63Z"></path>
</svg>`;

/* Build and inject the overlay into .screen-inner */
const idleOverlay = document.createElement('div');
idleOverlay.id = 'idle-glitch-overlay';
idleOverlay.innerHTML = '<div id="idle-dvd-logo" aria-hidden="true"></div>';

const screenInner = document.querySelector('.screen-inner');
if (screenInner) screenInner.appendChild(idleOverlay);
else             document.body.appendChild(idleOverlay);

const dvdLogo = document.getElementById('idle-dvd-logo');
if (dvdLogo) dvdLogo.innerHTML = DVD_SVG;

const dvdState = { x: 24, y: 24, dx: 1, dy: 1, speed: 99, w: 96, h: 48, colorIndex: 0 };

function applyDvdColor(color) {
  if (!dvdLogo) return;
  dvdLogo.style.color = color;
  dvdLogo.querySelectorAll('path, polygon, ellipse').forEach(node => node.style.fill = color);
}

function changeDvdColor() {
  if (!dvdLogo) return;
  let next = Math.floor(Math.random() * DVD_COLORS.length);
  if (next === dvdState.colorIndex) next = (next + 1) % DVD_COLORS.length;
  dvdState.colorIndex = next;
  applyDvdColor(DVD_COLORS[next]);
}

/* Initialise with the first colour */
if (dvdLogo) applyDvdColor(DVD_COLORS[dvdState.colorIndex]);

function measureDvd() {
  if (!dvdLogo || !screenInner) return false;
  const stageW = screenInner.clientWidth;
  const stageH = screenInner.clientHeight;
  if (!stageW || !stageH) return false;

  dvdState.w = Math.max(72, Math.min(132, Math.round(stageW * 0.12)));
  dvdState.h = Math.round(dvdState.w * 0.5);
  dvdLogo.style.width  = `${dvdState.w}px`;
  dvdLogo.style.height = `${dvdState.h}px`;

  const maxX = Math.max(0, stageW - dvdState.w);
  const maxY = Math.max(0, stageH - dvdState.h);
  dvdState.x = Math.min(Math.max(dvdState.x, 0), maxX);
  dvdState.y = Math.min(Math.max(dvdState.y, 0), maxY);
  dvdLogo.style.left = `${dvdState.x}px`;
  dvdLogo.style.top  = `${dvdState.y}px`;
  return true;
}

function stopDvdAnimation() {
  if (!dvdRafId) return;
  cancelAnimationFrame(dvdRafId);
  dvdRafId = 0;
  lastDvdTs = 0;
}

function stepDvd(ts) {
  dvdRafId = 0;
  if (!idleOverlayActive || !dvdLogo || !screenInner) return;
  if (!measureDvd()) { dvdRafId = requestAnimationFrame(stepDvd); return; }

  const stageW = screenInner.clientWidth;
  const stageH = screenInner.clientHeight;
  const dt = lastDvdTs ? Math.min(0.05, (ts - lastDvdTs) / 1000) : 1 / 60;
  lastDvdTs = ts;

  dvdState.x += dvdState.dx * dvdState.speed * dt;
  dvdState.y += dvdState.dy * dvdState.speed * dt;

  const maxX = Math.max(0, stageW - dvdState.w);
  const maxY = Math.max(0, stageH - dvdState.h);
  let bounced = false;

  if (dvdState.x <= 0)    { dvdState.x = 0;    dvdState.dx =  1; bounced = true; }
  else if (dvdState.x >= maxX) { dvdState.x = maxX; dvdState.dx = -1; bounced = true; }
  if (dvdState.y <= 0)    { dvdState.y = 0;    dvdState.dy =  1; bounced = true; }
  else if (dvdState.y >= maxY) { dvdState.y = maxY; dvdState.dy = -1; bounced = true; }

  if (bounced) changeDvdColor();

  dvdLogo.style.left = `${dvdState.x}px`;
  dvdLogo.style.top  = `${dvdState.y}px`;
  dvdRafId = requestAnimationFrame(stepDvd);
}

function startDvdAnimation() {
  if (dvdRafId) return;
  dvdRafId = requestAnimationFrame(stepDvd);
}

function showIdleOverlay() {
  if (idleOverlayActive) return;
  idleOverlayActive = true;
  document.body.classList.add('idle-dim');
  measureDvd();
  idleOverlay.classList.add('active');
  startDvdAnimation();
  document.querySelector('.left-panel')?.classList.add('idle-dim');
  document.querySelector('.nav-remote')?.classList.add('idle-dim');
}

function hideIdleOverlay() {
  if (!idleOverlayActive) return;
  idleOverlayActive = false;
  document.body.classList.remove('idle-dim');
  idleOverlay.classList.remove('active');
  document.querySelector('.left-panel')?.classList.remove('idle-dim');
  document.querySelector('.nav-remote')?.classList.remove('idle-dim');
  stopDvdAnimation();
}

function resetIdleTimer() {
  hideIdleOverlay();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(showIdleOverlay, IDLE_TIMEOUT_MS);
}

/* Only genuine user interactions reset the timer — not channel switching */
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

window.addEventListener('resize', () => { if (idleOverlayActive) measureDvd(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden)       stopDvdAnimation();
  else if (idleOverlayActive) startDvdAnimation();
});

/* Kick off the idle timer on load */
resetIdleTimer();


/* ════════════════════════════════════════
   GIF BULLET RANDOMISER
   Picks a random bullet gif for every .gif-bullet
   image on load and whenever new ones are injected.
════════════════════════════════════════ */

const BULLET_POOL = Array.from({ length: 12 }, (_, i) => `/assets/gifs/bullets/bullet${i + 1}.gif`);

function randomizeGifBullets(root = document) {
  const bullets = root.querySelectorAll ? root.querySelectorAll('.gif-bullet') : [];
  bullets.forEach(img => {
    if (!(img instanceof HTMLImageElement)) return;
    img.src = `${BULLET_POOL[Math.floor(Math.random() * BULLET_POOL.length)]}?t=${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  });
}

randomizeGifBullets();

/* Watch for dynamically injected bullets (e.g. project work lists) */
const bulletObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      if (node.classList.contains('gif-bullet'))     randomizeGifBullets(node.parentElement || document);
      else if (node.querySelector('.gif-bullet'))    randomizeGifBullets(node);
    });
  });
});

bulletObserver.observe(document.body, { childList: true, subtree: true });
