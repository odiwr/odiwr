/* version.js — odiwr.com
   CH5 Version channel:
     - Renders the days-since-deployment counter as big ASCII digits.
     - Animates the subline text with a typewriter effect.
   Update the data-deployment-date attribute in index.html to change the start date.
*/

(function () {

  /* ── ASCII digit glyphs ── */
  const DIGITS = {
    '0': ['   __     ', " /'__`\\   ", '/\\ \\/\\ \\  ', '\\ \\ \\ \\ \\ ', ' \\ \\ \\_\\ \\', '  \\ \\____/', '   \\/___/ '],
    '1': [' _     ',   "/' \\   ",   '\\_, \\  ',    '/_/\\ \\ ',    '\\ \\ \\ \\',    ' \\ \\_\\',     '  \\/_/ '],
    '2': ['   _     ',  " /' \\    ", '/\\_, \\   ',  '\\/_/\\ \\  ', '   \\ \\ \\ ',  '    \\ \\_\\',  '     \\/_/'],
    '3': ['   __     ', " /'__`\\   ", '/\\_\\L\\ \\  ', '\\/_/_\\_<_ ', '  /\\ \\L\\ \\', '  \\ \\____/', '   \\/___/ '],
    '4': [' __ __      ', '/\\ \\\\ \\     ', '\\ \\ \\\\ \\    ', ' \\ \\ \\\\ \\_  ', '  \\ \\__ ,__\\', '   \\/_/\\_\\_/', '      \\/_/  '],
    '5': [' ______    ', '/\\  ___\\   ', '\\ \\ \\__/   ', ' \\ \\___``\\ ', '  \\/___L\\ \\', '   /\\____/', '    \\/___/ '],
    '6': ['  ____    ',  " / ___\\   ", '/\\ \\__/   ',  '\\ \\  _``\\ ', ' \\ \\ \\L\\ \\', '  \\ \\____/', '   \\/___/ '],
    '7': [' ________ ', '/\\_____  \\', '\\/___//\'/', "     /\\' /\\'", "    /\\' /\' ", '   /\\_/   ',  ' \\/_  '],
    '8': ['   __     ',  " /'_ `\\   ", '/\\ \\L\\ \\  ', '\\/_> _ <_ ', '  /\\ \\L\\ \\', '  \\ \\____/', '   \\/___/ '],
    '9': ['   __      ', " /'_ `\\    ", '/\\ \\L\\ \\   ', '\\ \\___, \\  ', ' \\/__,/\\ \\ ', '      \\ \\_\\', '       \\/_/'],
  };

  const container = document.getElementById('daysSinceDeployment');
  if (!container) return;

  const deployDateRaw = container.getAttribute('data-deployment-date') || '2026-02-24';
  const deployDate    = new Date(deployDateRaw);
  const now           = new Date();
  const diffDays      = Math.floor(Math.abs(now - deployDate) / (1000 * 60 * 60 * 24));

  /* Pad to 3 digits */
  const dayString          = diffDays.toString().padStart(3, '0');
  const firstNonZeroIndex  = dayString.search(/[1-9]/);
  const leadingZeroEnd     = firstNonZeroIndex === -1 ? dayString.length - 1 : firstNonZeroIndex;

  container.innerHTML = '';

  dayString.split('').forEach((char, index) => {
    const pre       = document.createElement('pre');
    pre.className   = 'page-three-digit';
    pre.classList.add(index < leadingZeroEnd ? 'is-muted' : 'is-live');
    pre.textContent = (DIGITS[char] || []).join('\n');
    container.appendChild(pre);
  });

  /* ── Subline typewriter animation ── */
  const subline = document.getElementById('pageThreeSubline');
  if (!subline) return;

  subline.innerHTML =
    '<span>days since deployment of </span>' +
    '<strong class="subline-strong">odiwr.com</strong>';

  const text = subline.innerText || subline.textContent;
  subline.innerHTML = '';

  text.split('').forEach((c, i) => {
    const s       = document.createElement('span');
    s.className   = 'subline-char';
    s.textContent = c;
    subline.appendChild(s);
    setTimeout(() => s.classList.add('is-visible'), 50 * i);
  });

})();
