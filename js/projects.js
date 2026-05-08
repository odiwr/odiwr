/* projects.js — odiwr.com
   CH1 project grid: open a project detail panel, close it back to the grid.
   Add your real project data in the PROJECTS object below.
   Asset path for banners: /assets/images/
*/

(function () {

  /* ── Project data — fill in real content here ── */
  const PROJECTS = {
    p1: {
      title: 'PROJECT ONE',
      banner: '../assets/images/idkandfriends.png',
      description: `idk studios is an independent integrated creative collective. They don't just specialize in one field; they control the music, the visuals, the clothing, and the events to build a complete brand identity from the ground up ("we make anything and everything"). The primary philosophy of idk studios is to create "alot with enough."
      \n
      \n
      2023-2026`,      
      work: [
        'Designed the fullstack website from scratch',
        'Produced and co-directed many of the studio\'s music videos and visual content',
        'Created bumps and fills for long form content breaks',
        'Provided feedback for various demo tracks released by the studio',
      ],
      link: 'https://example.com/project-one',
      linkLabel: 'VIEW PROJECT →',
    },
    p2: {
      title: 'PROJECT TWO',
      banner: '/assets/images/project2.gif',
      description: 'Description for project two. Explain what makes this one interesting, the tech stack, the challenge, or the outcome.',
      work: [
        'Led research and concept development',
        'Prototyped interactive demo in p5.js',
        'Wrote custom shader effects in GLSL',
        'Presented at local design meetup',
      ],
      link: 'https://example.com/project-two',
      linkLabel: 'VIEW PROJECT →',
    },
    p3: {
      title: 'PROJECT THREE',
      banner: '/assets/images/project3.gif',
      description: 'Description for project three.',
      work: [
        'Embedded firmware in C on ESP32',
        'Designed PCB layout in KiCad',
        'Built companion web dashboard',
        'Documented hardware build process',
      ],
      link: 'https://example.com/project-three',
      linkLabel: 'VIEW PROJECT →',
    },
    p4: {
      title: 'PROJECT FOUR',
      banner: '/assets/images/project4.gif',
      description: 'Description for project four.',
      work: [
        'Directed and shot on 16mm film',
        'Edited in DaVinci Resolve',
        'Composed original score in Ableton',
        'Screened at independent film festival',
      ],
      link: 'https://example.com/project-four',
      linkLabel: 'VIEW PROJECT →',
    },
  };

  /* ── DOM refs ── */
  const bannerImg = document.getElementById('proj-banner-img');
  const backBtn = document.querySelector('.nav-btn[data-channel="1"]'); /* MENU btn doubles as BACK */
  const descEl = document.getElementById('proj-description');
  const workEl = document.getElementById('proj-work');
  const projectPanel = document.getElementById('channel-project');
  const flashEl = document.getElementById('channel-flash');
  const flashGif = document.getElementById('flash-gif');

  const STATIC_GIFS = [
    '/assets/gifs/static/static1.gif',
    '/assets/gifs/static/static2.gif',
  ];

  function flashThen(callback) {
    flashGif.src = STATIC_GIFS[Math.floor(Math.random() * STATIC_GIFS.length)] + '?t=' + Date.now();
    flashEl.classList.add('active');
    setTimeout(() => {
      callback();
      flashEl.classList.remove('active');
    }, 280);
  }

  function openProject(id) {
    const p = PROJECTS[id];
    if (!p) return;

    flashThen(() => {
      document.querySelectorAll('.screen-channel').forEach(el => el.classList.add('hidden'));

      bannerImg.src = p.banner;
      bannerImg.alt = p.title;

      descEl.innerHTML = `<p class="proj-desc-text">${p.description}</p>`;

      /* Cycle gif bullets across work items */
      const bullets = p.work.map((w, i) => {
        const idx = (i % 3) + 1;
        return `<li><img src="/assets/gifs/bullets/bullet${idx}.gif" alt="*" class="gif-bullet" />${w}</li>`;
      }).join('');

      workEl.innerHTML = `
        <p class="proj-work-heading">MY WORK:</p>
        <ul class="proj-work-list">${bullets}</ul>
        <div class="proj-ext-link-spacer"></div>
      `;

      projectPanel.classList.remove('hidden');

      /* Switch MENU → BACK */
      if (backBtn) {
        backBtn.textContent = 'BACK';
        backBtn.classList.remove('active');
        backBtn.classList.add('nav-btn--back-mode');
      }
    });
  }

  function closeProject() {
    flashThen(() => {
      document.querySelectorAll('.screen-channel').forEach(el => el.classList.add('hidden'));
      document.getElementById('channel-1')?.classList.remove('hidden');
      document.querySelectorAll('.nav-btn[data-channel]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.channel === '1');
      });
      if (backBtn) {
        backBtn.textContent = 'MENU';
        backBtn.classList.remove('nav-btn--back-mode');
      }
    });
  }

  /* Attach open handlers to menu items */
  document.querySelectorAll('.menu-item[data-project]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openProject(el.dataset.project);
    });
  });

  /* MENU/BACK button */
  if (backBtn) backBtn.addEventListener('click', closeProject);

})();
