/* info.js — odiwr.com
   CH2 Info channel utilities:
     - renderInfoTitleBars(): fills .info-title-bar elements with a repeating
       character pattern to fill the full container width (responsive).
     - Tag image tooltip on desktop.
   Exposed as window.renderInfoTitleBars so channels.js can call it on channel switch.
*/
/* ── TAG IMAGE TOOLTIP (desktop only) ── */
function initTagTooltips() {
  const tooltip = document.getElementById('tag-tooltip');
  if (!tooltip) return;

  // Use a more specific check for mobile vs touch-laptops
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return;

  document.querySelectorAll('.tag-img').forEach(el => {
    // Prevent duplicate listeners
    el.removeEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseenter', handleEnter);
    
    el.removeEventListener('mousemove', positionTooltip);
    el.addEventListener('mousemove', positionTooltip);
    
    el.removeEventListener('mouseleave', handleLeave);
    el.addEventListener('mouseleave', handleLeave);
  });

  function handleEnter(e) {
    tooltip.textContent = this.dataset.label;
    tooltip.classList.add('visible');
    positionTooltip(e);
  }

  function handleLeave() {
    tooltip.classList.remove('visible');
  }

  function positionTooltip(e) {
    // Add a small offset so it doesn't flicker under the cursor
    tooltip.style.left = (e.clientX + 25) + 'px';
    tooltip.style.top = (e.clientY + 25) + 'px';
  }
}

// Run on load
initTagTooltips();
// Export so channels.js can call it when switching to CH2
window.initTagTooltips = initTagTooltips;

(function () {

  /* ── INFO TITLE BAR RENDERER ── */

  function renderInfoTitleBars() {
    document.querySelectorAll('.info-title-bar').forEach(titleEl => {
      /* Cache raw text on first render */
      const rawTitle = (titleEl.dataset.rawTitle || titleEl.textContent || '').trim();
      titleEl.dataset.rawTitle = rawTitle;

      const section = titleEl.closest('.info-section');
      const divider = section ? section.querySelector('.info-divider[data-char]') : null;
      const ch      = ((divider && divider.getAttribute('data-char')) || '-').charAt(0);

      const style         = window.getComputedStyle(titleEl);
      const fontSize      = parseFloat(style.fontSize) || 18;
      const containerWidth = titleEl.clientWidth || titleEl.parentElement?.clientWidth || 0;
      if (!containerWidth) return;

      const approxCharWidth = Math.max(6, fontSize * 0.66);
      const totalChars      = Math.max(40, Math.ceil(containerWidth / approxCharWidth));
      const sideCount       = Math.max(8, Math.floor(totalChars / 2)) + 1;

      const fillHtml = Array.from({ length: sideCount }, () =>
        `<span class="info-title-char" style="background:#ffffff;color:#ffffff;">${ch}</span>`
      ).join('');

      titleEl.innerHTML = `
        <span class="info-title-fill" aria-hidden="true">${fillHtml}</span>
        <span class="info-title-text">${rawTitle}</span>
        <span class="info-title-fill" aria-hidden="true">${fillHtml}</span>
      `;
    });
  }

  /* Run on DOM ready, on resize, and expose globally for channels.js */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderInfoTitleBars);
  } else {
    renderInfoTitleBars();
  }

  window.addEventListener('resize', renderInfoTitleBars);
  window.renderInfoTitleBars = renderInfoTitleBars;


  /* ── TAG IMAGE TOOLTIP (desktop only) ── */

  const tooltip = document.getElementById('tag-tooltip');
  if (!tooltip) return;

  /* Disable on touch devices */
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

  document.querySelectorAll('.tag-img').forEach(el => {
    el.addEventListener('mouseenter', function (e) {
      tooltip.textContent = this.dataset.label;
      tooltip.classList.add('visible');
      positionTooltip(e);
    });
    el.addEventListener('mousemove', positionTooltip);
    el.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
  });

  function positionTooltip(e) {
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top  = (e.clientY + 12) + 'px';
  }

})();
