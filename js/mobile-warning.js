/* mobile-warning.js — odiwr.com
   Shows a one-time "you're missing out" popup on first mobile visit.
   Dismissed state stored in localStorage under 'odiwr_mobile_warned'.
*/

(function () {
  const isMobile = window.innerWidth <= 640;
  if (!isMobile) return;

  const STORAGE_KEY = 'odiwr_mobile_warned';
  if (localStorage.getItem(STORAGE_KEY)) return;

  const overlay = document.createElement('div');
  overlay.id    = 'mobile-warning-overlay';
  overlay.innerHTML = `
    <div id="mobile-warning-box">
      <p id="mobile-warning-msg">You're missing so much by viewing this site on your phone.</p>
      <button id="mobile-warning-btn">I understand</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('mobile-warning-btn').addEventListener('click', () => {
    overlay.classList.add('dismissing');
    setTimeout(() => overlay.remove(), 300);
    localStorage.setItem(STORAGE_KEY, '1');
  });

})();
