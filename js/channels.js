/* channels.js - VCR channel switching logic */

// These are only used for the channel-switch flash (kept separate from idle screensaver)
const FLASH_GIFS = [
  '/assets/gifs/static/static1.gif',
  '/assets/gifs/static/static2.gif',
];

const CHANNELS = {
  idle: 'channel-idle',
  1: 'channel-1',
  2: 'channel-2',
  3: 'channel-3',
  4: 'channel-4',
  5: 'channel-5',
};

const CHANNEL_LABELS = {
  idle: 'IDLE',
  1: 'CH 01',
  2: 'CH 02',
  3: 'CH 03',
  4: 'CH 04',
  5: 'CH 05',
};

let currentChannel = 'idle';
let isFlashing = false;

const flashEl = document.getElementById('channel-flash');
const flashGif = document.getElementById('flash-gif');
const hudCh = document.getElementById('hud-ch');
const chDisplay = document.getElementById('ch-display');
const navBtns = document.querySelectorAll('.nav-btn[data-channel]');
const btnRandom = document.getElementById('btn-random');
let cursorWaitTimer = null;

function setWaitCursorFor(ms = 500) {
  document.body.classList.add('is-cursor-wait');
  clearTimeout(cursorWaitTimer);
  cursorWaitTimer = setTimeout(() => {
    document.body.classList.remove('is-cursor-wait');
    cursorWaitTimer = null;
  }, ms);
}

function setWaitCursorUntilUnload() {
  document.body.classList.add('is-cursor-wait');
}

function switchChannel(target) {
  // If the MENU btn is in back-mode, don't switch - let closeProject handle it
  // channels.js inside switchChannel(target)
  document.body.setAttribute('data-current-channel', target);

  const menuBtn = document.querySelector('.nav-btn[data-channel="1"]');
  if (menuBtn && menuBtn.classList.contains('nav-btn--back-mode') && target === 1) return;

  if (isFlashing || target === currentChannel) return;
  isFlashing = true;

  // Channel switching uses FLASH_GIFS - completely separate from the idle overlay
  const gif = FLASH_GIFS[Math.floor(Math.random() * FLASH_GIFS.length)];
  flashGif.src = gif + '?t=' + Date.now();
  flashEl.classList.add('active');

  setTimeout(() => {
    document.querySelectorAll('.screen-channel').forEach((el) => {
      el.classList.add('hidden');
    });

    const nextEl = document.getElementById(CHANNELS[target]);
    if (nextEl) nextEl.classList.remove('hidden');
    if (typeof window.renderInfoTitleBars === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(window.renderInfoTitleBars));
    }

    currentChannel = target;

    if (hudCh) hudCh.textContent = CHANNEL_LABELS[target] || 'CH';
    if (chDisplay) {
      chDisplay.textContent = target !== 'idle' ? String(target).padStart(2, '0') : '--';
    }

    navBtns.forEach((btn) => {
      btn.classList.toggle('active', String(btn.dataset.channel) === String(target));
    });

    // If we navigated away while a project was open, reset MENU → BACK → MENU
    const menuBtn = document.querySelector('.nav-btn[data-channel="1"]');
    if (menuBtn && menuBtn.classList.contains('nav-btn--back-mode')) {
      menuBtn.textContent = 'MENU';
      menuBtn.classList.remove('nav-btn--back-mode');
    }

    // If we navigated away while PDF reader was open, reset RESEARCH → BACK → RESEARCH
    const researchBtn = document.querySelector('.nav-btn[data-channel="4"]');
    if (researchBtn && researchBtn.classList.contains('nav-btn--back-mode')) {
      researchBtn.textContent = 'RESEARCH';
      researchBtn.classList.remove('nav-btn--back-mode');
    }

    flashEl.classList.remove('active');
    isFlashing = false;
  }, 280);
}

// Hover preload
navBtns.forEach((btn) => {
  btn.addEventListener('mouseenter', () => {
    const ch = Number(btn.dataset.channel);
    if (ch === currentChannel) return;
    const preload = new Image();
    preload.src = FLASH_GIFS[Math.floor(Math.random() * FLASH_GIFS.length)];
  });

  btn.addEventListener('click', () => {
    setWaitCursorFor(500);
    switchChannel(Number(btn.dataset.channel));
  });
});

// Random channel
if (btnRandom) {
  btnRandom.addEventListener('click', () => {
    setWaitCursorFor(500);
    const channelKeys = [1, 2, 3, 4];
    const others = channelKeys.filter((k) => k !== currentChannel);
    const pick = others[Math.floor(Math.random() * others.length)];
    switchChannel(pick);
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
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

// Real page navigation links: show wait cursor until unload
document.addEventListener('click', (e) => {
  const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!link) return;
  if (link.hasAttribute('download')) return;
  if (link.target && link.target.toLowerCase() === '_blank') return;
  const href = link.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
  setWaitCursorUntilUnload();
}, true);

window.addEventListener('pageshow', () => {
  document.body.classList.remove('is-cursor-wait');
});

// IDLE DVD SCREENSAVER
// Triggers ONLY on inactivity (120s). Channel switching never touches this.
const IDLE_TIMEOUT_MS = 60_000;
let idleTimer = null;
let idleOverlayActive = false;
let dvdRafId = 0;
let lastDvdTs = 0;

const DVD_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
const DVD_SVG = `
<svg viewBox="26 278 544 273" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <path d="M137.34,447.54c46.69,0,84.54-37.85,84.54-84.54,0-17.94-5.6-34.56-15.13-48.24h125.89s61.67-3.31,61.67,46.38-100.32,50.11-100.32,50.11l19.32-82h-65.37l-26.72,117.62h91.69s138.97-5.8,144.73-88.22c1.1-15.81-2.78-28.48-9.77-38.63h94.61l-26.06-40.89h-189.58.01s-178.97.01-178.97.01c-3.45-.43-6.97-.68-10.54-.68-46.69,0-84.54,37.85-84.54,84.54s37.85,84.54,84.54,84.54ZM137.34,320.03c23.74,0,42.98,19.24,42.98,42.98s-19.24,42.98-42.98,42.98-42.98-19.24-42.98-42.98,19.24-42.98,42.98-42.98Z"></path>
  <polygon points="515.1 446.21 542.47 329.26 477.1 329.26 451.04 446.21 515.1 446.21"></polygon>
  <ellipse cx="433.08" cy="507.63" rx="16.31" ry="11.32"></ellipse>
  <path d="M277.33,496.59v22.06s19.76,2.29,19.76-10.94-19.76-11.12-19.76-11.12Z"></path>
  <path d="M297.64,469.23c-149.51,0-270.71,18.09-270.71,40.41s121.2,40.41,270.71,40.41,270.71-18.09,270.71-40.41-121.2-40.41-270.71-40.41ZM166.51,527.82h-12.13l-23.34-40.24h15.71l14.21,24.53,13.32-24.53h16.59l-24.35,40.24ZM230.92,527.82h-14.82v-40.24c-.35-.35,14.82,0,14.82,0v40.24ZM285.27,527.82h-22.94v-40.39s25.15.16,25.15.16c0,0,25.15,1.59,25.15,20.12s-27.35,20.12-27.35,20.12ZM373.68,496.59h-18v7.06h16.94v8.29h-16.76v7.59h17.82v8.29h-32.82v-40.39c-.53,0,32.82,0,32.82,0v9.16ZM433.08,529.25c-17.21,0-31.16-9.68-31.16-21.63s13.95-21.63,31.16-21.63,31.16,9.68,31.16,21.63-13.95,21.63-31.16,21.63Z"></path>
</svg>
`;

const idleOverlay = document.createElement('div');
idleOverlay.id = 'idle-glitch-overlay';
idleOverlay.innerHTML = '<div id="idle-dvd-logo" aria-hidden="true"></div>';

const screenInner = document.querySelector('.screen-inner');
if (screenInner) {
  screenInner.appendChild(idleOverlay);
} else {
  document.body.appendChild(idleOverlay);
}

const dvdLogo = document.getElementById('idle-dvd-logo');
const dvdState = {
  x: 24,
  y: 24,
  dx: 1,
  dy: 1,
  speed: 99,
  w: 96,
  h: 48,
  colorIndex: 0,
};

if (dvdLogo) {
  dvdLogo.innerHTML = DVD_SVG;
}

function applyDvdColor(color) {
  if (!dvdLogo) return;
  dvdLogo.style.color = color;
  dvdLogo.querySelectorAll('path, polygon, ellipse').forEach((node) => {
    node.style.fill = color;
  });
}

function changeDvdColor() {
  if (!dvdLogo) return;
  let next = Math.floor(Math.random() * DVD_COLORS.length);
  if (next === dvdState.colorIndex) next = (next + 1) % DVD_COLORS.length;
  dvdState.colorIndex = next;
  applyDvdColor(DVD_COLORS[next]);
}
if (dvdLogo) applyDvdColor(DVD_COLORS[dvdState.colorIndex]);

function measureDvd() {
  if (!dvdLogo || !screenInner) return false;
  const stageW = screenInner.clientWidth;
  const stageH = screenInner.clientHeight;
  if (!stageW || !stageH) return false;

  dvdState.w = Math.max(72, Math.min(132, Math.round(stageW * 0.12)));
  dvdState.h = Math.round(dvdState.w * 0.5);
  dvdLogo.style.width = `${dvdState.w}px`;
  dvdLogo.style.height = `${dvdState.h}px`;

  const maxX = Math.max(0, stageW - dvdState.w);
  const maxY = Math.max(0, stageH - dvdState.h);
  dvdState.x = Math.min(Math.max(dvdState.x, 0), maxX);
  dvdState.y = Math.min(Math.max(dvdState.y, 0), maxY);
  dvdLogo.style.left = `${dvdState.x}px`;
  dvdLogo.style.top = `${dvdState.y}px`;
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
  if (!measureDvd()) {
    dvdRafId = requestAnimationFrame(stepDvd);
    return;
  }

  const stageW = screenInner.clientWidth;
  const stageH = screenInner.clientHeight;
  const dt = lastDvdTs ? Math.min(0.05, (ts - lastDvdTs) / 1000) : 1 / 60;
  lastDvdTs = ts;

  dvdState.x += dvdState.dx * dvdState.speed * dt;
  dvdState.y += dvdState.dy * dvdState.speed * dt;

  const maxX = Math.max(0, stageW - dvdState.w);
  const maxY = Math.max(0, stageH - dvdState.h);
  let bounced = false;

  if (dvdState.x <= 0) {
    dvdState.x = 0;
    dvdState.dx = 1;
    bounced = true;
  } else if (dvdState.x >= maxX) {
    dvdState.x = maxX;
    dvdState.dx = -1;
    bounced = true;
  }

  if (dvdState.y <= 0) {
    dvdState.y = 0;
    dvdState.dy = 1;
    bounced = true;
  } else if (dvdState.y >= maxY) {
    dvdState.y = maxY;
    dvdState.dy = -1;
    bounced = true;
  }

  if (bounced) changeDvdColor();

  dvdLogo.style.left = `${dvdState.x}px`;
  dvdLogo.style.top = `${dvdState.y}px`;
  dvdRafId = requestAnimationFrame(stepDvd);
}

function startDvdAnimation() {
  if (dvdRafId) return;
  dvdRafId = requestAnimationFrame(stepDvd);
}

function showIdleOverlay() {
  if (idleOverlayActive) return;
  idleOverlayActive = true;
  
  // 1. Master switch: Turn body black via CSS class
  document.body.classList.add('idle-dim');
  
  measureDvd();
  idleOverlay.classList.add('active');
  startDvdAnimation();

  // 2. Target specific panels for internal layout changes
  const lp = document.querySelector('.left-panel');
  if (lp) lp.classList.add('idle-dim');

  const nav = document.querySelector('.nav-remote');
  if (nav) nav.classList.add('idle-dim');
}

function hideIdleOverlay() {
  if (!idleOverlayActive) return;
  idleOverlayActive = false;
  
  // Remove master black background immediately
  document.body.classList.remove('idle-dim');
  
  idleOverlay.classList.remove('active');
  stopDvdAnimation();

  // Delay panel snap-back to match the smooth body transition if desired
  setTimeout(() => {
    const lp = document.querySelector('.left-panel');
    if (lp) lp.classList.remove('idle-dim');

    const nav = document.querySelector('.nav-remote');
    if (nav) nav.classList.remove('idle-dim');
    
    const controls = document.querySelector('.player-controls');
    if (controls) controls.classList.remove('idle-dim');
  }, 30);
}

function hideIdleOverlay() {
  if (!idleOverlayActive) return;
  idleOverlayActive = false;
  
  // Remove classes IMMEDIATELY for an instant wake feel
  document.body.classList.remove('idle-dim');
  idleOverlay.classList.remove('active');
  
  const lp = document.querySelector('.left-panel');
  if (lp) lp.classList.remove('idle-dim');

  const nav = document.querySelector('.nav-remote');
  if (nav) nav.classList.remove('idle-dim');

  stopDvdAnimation();
}

function resetIdleTimer() {
  hideIdleOverlay();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(showIdleOverlay, IDLE_TIMEOUT_MS);
}

// Only real user interactions reset the idle timer - NOT channel switching
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach((evt) => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

window.addEventListener('resize', () => {
  if (idleOverlayActive) measureDvd();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopDvdAnimation();
  } else if (idleOverlayActive) {
    startDvdAnimation();
  }
});

// Randomize all gif bullets on load (and for future injected bullets)
const BULLET_POOL = Array.from({ length: 12 }, (_, i) => `/assets/gifs/bullets/bullet${i + 1}.gif`);

function randomizeGifBullets(root = document) {
  const bullets = root.querySelectorAll ? root.querySelectorAll('.gif-bullet') : [];
  bullets.forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    const pick = BULLET_POOL[Math.floor(Math.random() * BULLET_POOL.length)];
    img.src = `${pick}?t=${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  });
}

randomizeGifBullets();

const bulletObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.classList.contains('gif-bullet')) {
        randomizeGifBullets(node.parentElement || document);
      } else if (node.querySelector('.gif-bullet')) {
        randomizeGifBullets(node);
      }
    });
  });
});

bulletObserver.observe(document.body, { childList: true, subtree: true });

resetIdleTimer();

// Expose for other scripts
window.odiwr = window.odiwr || {};
window.odiwr.switchChannel = switchChannel;