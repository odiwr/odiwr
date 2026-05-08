/* research.js — odiwr.com
   CH4 Research channel: triptych PDF carousel + inline PDF reader powered by pdf.js.
   Add your PDFs in the PDFS array below.
   Asset paths: /assets/pdfs/
*/

(function () {

  /* ── PDF data — add entries here ── */
  const PDFS = [
    {
      id: 'pdf1',
      title: 'The New Web',
      cover: '../assets/pdfs/The New Web.png',
      src: '../assets/pdfs/The New Web.pdf',
      status: 'COMPLETED',
    },
    {
      id: 'pdf2',
      title: 'Trapped in Memory',
      cover: '../assets/pdfs/Trapped in Memory.png',
      src: '../assets/pdfs/Trapped in Memory.pdf',
      status: 'COMPLETED',
    },
    {
      id: 'pdf3',
      title: 'The Financial Fortress',
      cover: '../assets/pdfs/The Financial Fortress.png',
      src: '../assets/pdfs/The Financial Fortress.pdf',
      status: 'IN PROGRESS',
    },
  ];

  /* Carousel always needs at least 3 entries — recycle if fewer */
  function buildDeck(list) {
    const out = [...list];
    while (out.length < 3) {
      for (let i = 0; i < list.length && out.length < 3; i++) {
        out.push({ ...list[i], _recycled: true });
      }
    }
    return out;
  }

  const deck = buildDeck(PDFS);
  let centerIndex = 1;
  let isAnimating = false;

  /* ── DOM refs ── */
  const stage = document.getElementById('research-stage');
  const readerPanel = document.getElementById('channel-pdf-reader');
  const readerView = document.getElementById('pdf-reader-view');
  const readerInner = document.getElementById('pdf-reader-inner');
  const flashEl = document.getElementById('channel-flash');
  const flashGif = document.getElementById('flash-gif');

  const STATIC_GIFS = ['/assets/gifs/static/static1.gif', '/assets/gifs/static/static2.gif'];
  const isMobile = () => window.innerWidth <= 640;

  if (!stage) return;

  /* ── Animated carousel transition ── */
  function animateAndNav(direction) {
    if (isAnimating) return;
    isAnimating = true;
    const n = deck.length;
    const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
    const inClass = direction === 'next' ? 'slide-in-right' : 'slide-in-left';

    Array.from(stage.querySelectorAll('.research-card')).forEach(c => c.classList.add(outClass));

    setTimeout(() => {
      centerIndex = direction === 'next'
        ? (centerIndex + 1) % n
        : (centerIndex - 1 + n) % n;
      renderStage(inClass);
      /* research.js — Line ~66 */
      setTimeout(() => {
        // Use a safer way to remove classes that might have spaces
        stage.querySelectorAll('.research-card').forEach(c => {
          if (inClass) c.classList.remove(...inClass.split(' ').filter(Boolean));
        });
        isAnimating = false;
      }, 240);
    }, 180);
  }

function renderStage(animInClass) {
  // FIX: If animInClass is not a string (like a Resize Event object), set it to undefined
  if (typeof animInClass !== 'string') animInClass = undefined;

  stage.innerHTML = '';
  const n = deck.length;
    /* ── Render the visible card slots ── */
    if (isMobile()) {
      /* Mobile: single card + prev/next buttons + dots */
      const pdf = deck[centerIndex];
      const role = 'mobile-center'; // FIX: Define the missing role variable
      const card = document.createElement('div');

      card.className = `research-card research-card--${role}`;

      // FIX: Use spread/split to prevent whitespace errors and check for existence
      if (animInClass) {
        card.classList.add(...animInClass.split(' ').filter(Boolean));
      }

      card.dataset.role = role;
      // ... rest of mobile code
      card.innerHTML = `
        <div class="pdf-cover-wrap">
          ${coverHtml(pdf)}
          <div class="pdf-cover-hover-label">OPEN →</div>
          ${statusHtml(pdf)}
        </div>`;
      card.addEventListener('click', () => openPdf(pdf));
      stage.appendChild(card);

      const prevBtn = document.createElement('button');
      prevBtn.className = 'mobile-carousel-btn mobile-carousel-btn--prev';
      prevBtn.innerHTML = '‹';
      prevBtn.addEventListener('click', () => animateAndNav('prev'));

      const nextBtn = document.createElement('button');
      nextBtn.className = 'mobile-carousel-btn mobile-carousel-btn--next';
      nextBtn.innerHTML = '›';
      nextBtn.addEventListener('click', () => animateAndNav('next'));

      stage.appendChild(prevBtn);
      stage.appendChild(nextBtn);

      const dots = document.createElement('div');
      dots.className = 'mobile-carousel-dots';
      deck.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'carousel-dot' + (i === centerIndex ? ' carousel-dot--active' : '');
        dots.appendChild(dot);
      });
      stage.appendChild(dots);

    } else {
      /* Desktop: prev | center | next triptych */
      const prevIdx = (centerIndex - 1 + n) % n;
      const nextIdx = (centerIndex + 1) % n;
      const slots = [
        { pdf: deck[prevIdx], role: 'prev' },
        { pdf: deck[centerIndex], role: 'center' },
        { pdf: deck[nextIdx], role: 'next' },
      ];

      slots.forEach(({ pdf, role }) => {
        const card = document.createElement('div');
        card.className = `research-card research-card--${role}`;

        // FIX: Use spread/split to prevent whitespace errors and check for existence
        if (animInClass) {
          card.classList.add(...animInClass.split(' ').filter(Boolean));
        }

        card.dataset.role = role;

        if (role === 'center') {
          card.innerHTML = `
            <div class="pdf-cover-wrap">
              ${coverHtml(pdf)}
              <div class="pdf-cover-hover-label">OPEN →</div>
              ${statusHtml(pdf)}
            </div>`;
          card.addEventListener('click', () => openPdf(pdf));
        } else {
          const arrow = role === 'prev' ? '‹' : '›';
          card.innerHTML = `
            <div class="pdf-cover-wrap pdf-cover-wrap--nav">
              ${coverHtml(pdf)}
              <div class="pdf-nav-arrow">${arrow}</div>
              ${statusHtml(pdf)}
            </div>`;
          card.addEventListener('click', () => animateAndNav(role));
        }

        stage.appendChild(card);
      });
    }
  }

  /* Cover image or placeholder */
  function coverHtml(pdf) {
    return pdf.cover
      ? `<img class="pdf-cover-img" src="${pdf.cover}" alt="${pdf.title}" />`
      : `<div class="pdf-cover-placeholder"><span class="pdf-cover-label">${pdf.title}</span></div>`;
  }

  /* Status badge */
  function statusHtml(pdf) {
    if (!pdf.status) return '';
    const cls = pdf.status === 'COMPLETED' ? 'done' : 'wip';
    return `<div class="pdf-status-badge pdf-status--${cls}">${pdf.status}</div>`;
  }

  /* Mobile swipe to navigate */
  let touchStartX = 0;
  stage.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return;
    animateAndNav(dx < 0 ? 'next' : 'prev');
  }, { passive: true });

  /* ── Flash helper ── */
  function flashThen(cb) {
    flashGif.src = STATIC_GIFS[Math.floor(Math.random() * STATIC_GIFS.length)] + '?t=' + Date.now();
    flashEl.classList.add('active');
    setTimeout(() => { cb(); flashEl.classList.remove('active'); }, 280);
  }

  /* ── Open PDF reader ── */
  function openPdf(pdf) {
    const centerCard = stage.querySelector('.research-card--center');
    if (centerCard) {
      centerCard.classList.add('is-opening');
      centerCard.addEventListener('animationend', () => centerCard.classList.remove('is-opening'), { once: true });
    }

    flashThen(() => {
      document.querySelectorAll('.screen-channel').forEach(el => {
        if (el.id !== 'channel-pdf-reader') el.classList.add('hidden');
      });
      readerPanel.classList.remove('hidden');
      readerView.scrollTop = 0;
      readerInner.innerHTML = '<div class="pdf-loading">Loading...</div>';

      const researchBtn = document.querySelector('.nav-btn[data-channel="4"]');
      if (researchBtn) {
        researchBtn.textContent = 'BACK';
        researchBtn.classList.remove('active');
        researchBtn.classList.add('nav-btn--back-mode');
      }

      if (!window.pdfjsLib) {
        readerInner.innerHTML = '<div class="pdf-loading pdf-err">pdf.js not loaded.</div>';
        return;
      }

      window.pdfjsLib.getDocument(pdf.src).promise
        .then(doc => { readerInner.innerHTML = ''; renderAllPages(doc); })
        .catch(err => {
          readerInner.innerHTML = `<div class="pdf-loading pdf-err">Could not load PDF.<br><small>${err.message}</small></div>`;
        });
    });
  }

  async function renderAllPages(doc) {
    const containerW = readerInner.clientWidth || 800;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(2, containerW / unscaled.width);
      const vp = page.getViewport({ scale });
      const wrap = document.createElement('div');
      wrap.className = 'pdf-page-wrap';
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      wrap.appendChild(canvas);
      readerInner.appendChild(wrap);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    }
  }

  /* ── Close PDF → return to carousel ── */
  function closePdf() {
    flashThen(() => {
      document.querySelectorAll('.screen-channel').forEach(el => el.classList.add('hidden'));
      document.getElementById('channel-4')?.classList.remove('hidden');
      document.querySelectorAll('.nav-btn[data-channel]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.channel === '4');
      });
      const researchBtn = document.querySelector('.nav-btn[data-channel="4"]');
      if (researchBtn) {
        researchBtn.textContent = 'RESEARCH';
        researchBtn.classList.remove('nav-btn--back-mode');
      }
      readerInner.innerHTML = '';
    });
  }

  /* RESEARCH/BACK button handler */
  document.querySelector('.nav-btn[data-channel="4"]')?.addEventListener('click', () => {
    const btn = document.querySelector('.nav-btn[data-channel="4"]');
    if (btn?.classList.contains('nav-btn--back-mode')) closePdf();
  });

  /* Expose for external use if needed */
  window.odiwr = window.odiwr || {};
  window.odiwr.closePdf = closePdf;

  /* Re-render on resize (handles mobile ↔ desktop switch) */
  window.addEventListener('resize', renderStage);

  /* Initial render */
  renderStage();

})();
