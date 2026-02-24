const filmCarousel = document.getElementById("filmCarousel");
const filmPagination = document.getElementById("filmPagination");
const siteLoader = document.getElementById("siteLoader");
const rightPanel = document.getElementById("rightPanel");
const panelCounter = document.getElementById("panelCounter");
const panelLoader = document.getElementById("panelLoader");
const xpPopups = Array.from(document.querySelectorAll(".xp-popup"));
const xpPlayerToggle = document.getElementById("xpPlayerToggle");
const xpAudioTrack = document.getElementById("xpAudioTrack");
const xpMessageTrack = document.getElementById("xpMessageTrack");
const njClock = document.getElementById("njClock");
const popupContactForm = document.getElementById("popupContactForm");
const contactMessage = document.getElementById("contactMessage");
const contactStatus = document.getElementById("contactStatus");
const galleryGrid = document.getElementById("galleryGrid");
const galleryZoom = document.getElementById("galleryZoom");
const galleryZoomImage = document.getElementById("galleryZoomImage");
const aboutPanelMount = document.getElementById("aboutPanelMount");
const aboutPanelCounter = document.getElementById("aboutPanelCounter");
const aboutCopy = document.querySelector(".about-top-copy");
const aboutPrevButton = document.getElementById("aboutPrevButton");
const aboutNextButton = document.getElementById("aboutNextButton");
const guySequenceFrame = document.getElementById("guySequenceFrame");
const videoShell = document.querySelector(".video-shell");
const mobileGifStage = document.getElementById("mobileGifStage");
const mobileClickHint = document.getElementById("mobileClickHint");
const brandHeading = document.querySelector(".brand");
const videoMosaicOverlay = document.getElementById("videoMosaicOverlay");
const daysSinceDeployment = document.getElementById("daysSinceDeployment");
const pageThreeSubline = document.getElementById("pageThreeSubline");
const pageHero = document.querySelector(".page-hero");
const pageTwo = document.querySelector(".page-two");
const pageBubbles = document.querySelector(".page-bubbles");
const pageThree = document.querySelector(".page-three");
const bubblesFrame = document.querySelector(".bubbles-frame");
const bubblesGameSvg = document.getElementById("bubblesGameSvg");
const bubblesGameStars = document.getElementById("bubblesGameStars");
const bubblesGameAsteroids = document.getElementById("bubblesGameAsteroids");
const bubblesGameBullets = document.getElementById("bubblesGameBullets");
const bubblesGameShip = document.getElementById("bubblesGameShip");
const bubblesGameMode = document.getElementById("bubblesGameMode");
const bubbleResumeTrigger = document.getElementById("bubbleResumeTrigger");
const popup2Cards = Array.from(
  document.querySelectorAll("[data-collapsible-card]")
);
let hasPlayedBrandIntro = false;

const panelState = {
  current: 0,
  total: 9
};
let dvdScreensaverController = null;

const updatePanelCounter = () => {
  if (!panelCounter) return;
  panelCounter.textContent = `${panelState.current}/${panelState.total}`;
};

const updatePopupVisibility = () => {
  if (xpPopups.length === 0) return;
  xpPopups.forEach((popup, index) => {
    if (index < panelState.current) {
      popup.classList.add("is-visible");
    } else {
      popup.classList.remove("is-visible");
    }
  });
  dvdScreensaverController?.wake?.();
};

const setPanelPage = (next) => {
  const clamped = Math.min(Math.max(next, 0), panelState.total);
  panelState.current = clamped;
  updatePanelCounter();
  updatePopupVisibility();
};

const setupPopupPlayer = () => {
  if (!xpPlayerToggle) return;
  const playerPopup = xpPlayerToggle.closest(".xp-popup");
  if (!playerPopup) return;

  const startVisual = () => playerPopup.classList.add("is-playing");
  const stopVisual = () => playerPopup.classList.remove("is-playing");

  xpPlayerToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!xpAudioTrack) {
      playerPopup.classList.toggle("is-playing");
      return;
    }

    if (xpAudioTrack.paused) {
      startVisual();
      xpAudioTrack.play().catch(() => {
        /* Audio file may not exist yet; keep visual state for design preview. */
      });
      return;
    }

    xpAudioTrack.pause();
    stopVisual();
  });

  if (xpAudioTrack) {
    xpAudioTrack.addEventListener("pause", stopVisual);
    xpAudioTrack.addEventListener("ended", stopVisual);
    xpAudioTrack.addEventListener("play", startVisual);
  }
};

const deriveTrackLabel = () => {
  const fallback =
    xpAudioTrack?.dataset.fallbackTrack || "Taking What's Not Yours - TV Girl";
  if (!xpAudioTrack?.src) return fallback;

  try {
    const sourceUrl = new URL(xpAudioTrack.src, window.location.href);
    const fileName = decodeURIComponent(
      sourceUrl.pathname.split("/").pop() || ""
    );
    const title = fileName.replace(/\.[^/.]+$/, "").trim();
    if (!title) return fallback;
    if (title.includes(" - ")) return title;

    const artistFromFallback = fallback.split(" - ").slice(1).join(" - ").trim();
    if (artistFromFallback) {
      return `${title} - ${artistFromFallback}`;
    }

    return title;
  } catch {
    return fallback;
  }
};

const setupTrackMessage = () => {
  if (!xpMessageTrack) return;
  xpMessageTrack.textContent = deriveTrackLabel();
};

const setupPopup2Collapsibles = () => {
  if (popup2Cards.length === 0) return;

  popup2Cards.forEach((card) => {
    const toggle = card.querySelector(".card-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isCollapsed = card.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
  });
};

const setupContactForm = () => {
  if (!popupContactForm) return;

  popupContactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(popupContactForm);
    const fullName = String(formData.get("fullName") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!fullName || !subject || !message) {
      popupContactForm.reportValidity();
      return;
    }

    if (contactStatus) {
      contactStatus.textContent = "Sending...";
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName,
          subject,
          message
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send message.");
      }

      popupContactForm.reset();
      if (contactStatus) {
        contactStatus.textContent = "Message sent.";
      }
    } catch (error) {
      if (contactStatus) {
        contactStatus.textContent =
          error instanceof Error ? error.message : "Unable to send message.";
      }
    }
  });
};

const setupNjClock = () => {
  if (!njClock) return;
  registerNjClock(njClock);
};

const njClockRegistry = new Set();
let njClockTimerId = null;
const njClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const updateRegisteredNjClocks = () => {
  const value = njClockFormatter.format(new Date());
  njClockRegistry.forEach((el) => {
    if (!el || !el.isConnected) {
      njClockRegistry.delete(el);
      return;
    }
    el.textContent = value;
  });

  if (njClockRegistry.size === 0 && njClockTimerId) {
    clearInterval(njClockTimerId);
    njClockTimerId = null;
  }
};

const registerNjClock = (el) => {
  if (!el) return;
  njClockRegistry.add(el);
  updateRegisteredNjClocks();
  if (!njClockTimerId) {
    njClockTimerId = window.setInterval(updateRegisteredNjClocks, 1000);
  }
};

const setupDeploymentCounter = () => {
  if (!daysSinceDeployment) return;

  const deployDateRaw =
    daysSinceDeployment.getAttribute("data-deployment-date") || "2026-02-24";
  const deployDate = new Date(`${deployDateRaw}T00:00:00`);

  if (Number.isNaN(deployDate.getTime())) {
    daysSinceDeployment.textContent = "001";
    return {
      playIntro: () => {},
      setIdleBlink: () => {}
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const getDayCount = () => {
    const now = new Date();
    const diff = now.getTime() - deployDate.getTime();
    return Math.max(1, Math.floor(diff / msPerDay) + 1);
  };

  const renderDigits = () => {
    const totalDays = getDayCount();
    const digitString = String(totalDays).padStart(3, "0");
    daysSinceDeployment.innerHTML = "";

    digitString.split("").forEach((digit, index) => {
      const span = document.createElement("span");
      span.className = "page-three-digit";
      span.textContent = digit;

      const shouldMute =
        (totalDays < 10 && (index === 0 || index === 1)) ||
        (totalDays >= 10 && totalDays < 100 && index === 0);

      span.classList.add(shouldMute ? "is-muted" : "is-live");
      daysSinceDeployment.appendChild(span);
    });

    daysSinceDeployment.setAttribute(
      "aria-label",
      `${totalDays} days since deployment`
    );
  };

  const getSublineText = () => {
    if (!pageThreeSubline) return { prefix: "", strong: "" };
    const strongEl = pageThreeSubline.querySelector("strong");
    const strong = (strongEl?.textContent || "").trim();
    const full = (pageThreeSubline.textContent || "").replace(/\s+/g, " ").trim();
    const prefix = strong ? full.replace(strong, "").trim() : full;
    return { prefix: prefix ? `${prefix} ` : "", strong };
  };

  const renderSublineStatic = () => {
    if (!pageThreeSubline) return;
    const { prefix, strong } = getSublineText();
    pageThreeSubline.innerHTML = "";
    pageThreeSubline.append(document.createTextNode(prefix));
    if (strong) {
      const strongEl = document.createElement("strong");
      strongEl.textContent = strong;
      pageThreeSubline.appendChild(strongEl);
    }
  };

  const playSublineIntro = async () => {
    if (!pageThreeSubline) return;
    const { prefix, strong } = getSublineText();
    const all = `${prefix}${strong}`;
    const strongStart = prefix.length;
    pageThreeSubline.innerHTML = "";

    const spans = all.split("").map((char, index) => {
      const span = document.createElement("span");
      span.className = "subline-char";
      if (index >= strongStart) span.classList.add("subline-strong");
      span.textContent = char === " " ? "\u00A0" : char.toUpperCase();
      pageThreeSubline.appendChild(span);
      return span;
    });

    for (let i = 0; i < spans.length; i += 1) {
      const span = spans[i];
      span.classList.add("is-visible");
      if (all[i] && all[i] !== " ") {
        span.textContent = all[i].toUpperCase();
      }

      if (i > 0 && all[i - 1] && all[i - 1] !== " ") {
        spans[i - 1].textContent = all[i - 1].toLowerCase();
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 52));
    }

    const lastIndex = spans.length - 1;
    if (lastIndex >= 0 && all[lastIndex] && all[lastIndex] !== " ") {
      spans[lastIndex].textContent = all[lastIndex].toLowerCase();
    }
  };

  let sublineIntroPlayed = false;
  const playIntro = async () => {
    renderDigits();
    daysSinceDeployment.classList.remove("is-entering");

    if (!sublineIntroPlayed) {
      sublineIntroPlayed = true;
      await playSublineIntro();
    } else {
      renderSublineStatic();
    }
  };

  const setIdleBlink = (active) => {
    if (active) renderDigits();
    daysSinceDeployment.classList.toggle("is-idle-blink", !!active);
  };

  renderDigits();
  renderSublineStatic();

  return {
    playIntro,
    setIdleBlink
  };
};

const setupLazyGalleryGrid = ({ gridEl, zoomEl, zoomImageEl, photos }) => {
  if (!gridEl || !zoomEl || !zoomImageEl || !Array.isArray(photos) || photos.length === 0) {
    return;
  }

  let zoomOpen = false;
  let closeTimer = null;
  let hydrated = false;
  let hydrateQueued = false;

  const popupRoot = gridEl.closest(".xp-popup");

  const hydrateThumb = (img) => {
    if (!img || img.dataset.loaded === "1") return;
    const src = img.dataset.src;
    if (!src) return;
    img.src = src;
    img.dataset.loaded = "1";
  };

  const hydrateAllThumbs = () => {
    if (hydrated || hydrateQueued) return;
    hydrateQueued = true;
    const imgs = Array.from(gridEl.querySelectorAll("img[data-src]"));
    let i = 0;

    const runBatch = () => {
      const batchSize = 3;
      for (let count = 0; count < batchSize && i < imgs.length; count += 1, i += 1) {
        hydrateThumb(imgs[i]);
      }
      if (i < imgs.length) {
        requestAnimationFrame(runBatch);
        return;
      }
      hydrated = true;
      hydrateQueued = false;
    };

    requestAnimationFrame(runBatch);
  };

  const openZoom = (photo, index) => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    hydrateAllThumbs();
    zoomImageEl.src = photo;
    zoomImageEl.alt = `Enlarged photo ${index + 1}`;
    zoomEl.hidden = false;
    requestAnimationFrame(() => {
      zoomEl.classList.add("is-open");
      zoomOpen = true;
    });
  };

  const closeZoom = () => {
    if (!zoomOpen) return;
    zoomEl.classList.remove("is-open");
    zoomOpen = false;
    closeTimer = setTimeout(() => {
      zoomEl.hidden = true;
      closeTimer = null;
    }, 220);
  };

  gridEl.innerHTML = "";
  photos.forEach((photo, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gallery-thumb";
    btn.setAttribute("aria-label", `Open photo ${i + 1}`);

    const img = document.createElement("img");
    img.alt = `Photo ${i + 1}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "low");
    img.dataset.src = photo;
    btn.appendChild(img);

    btn.addEventListener("click", () => {
      openZoom(photo, i);
    });

    gridEl.appendChild(btn);
  });

  const maybeHydrateOnVisible = () => {
    if (!popupRoot) return;
    if (popupRoot.classList.contains("is-visible")) {
      hydrateAllThumbs();
    }
  };

  if (popupRoot) {
    const observer = new MutationObserver(() => {
      maybeHydrateOnVisible();
    });
    observer.observe(popupRoot, {
      attributes: true,
      attributeFilter: ["class"]
    });
    maybeHydrateOnVisible();
  }

  zoomEl.addEventListener("click", () => {
    closeZoom();
  });
};

const setupPopupGallery = () => {
  if (!galleryGrid || !galleryZoom || !galleryZoomImage) return;

  const basePhotos = [
    "media/gallery/1.JPG",
    "media/gallery/2.JPG",
    "media/gallery/3.JPG",
    "media/gallery/4.JPG",
    "media/gallery/5.JPG"
  ];
  const photos = Array.from({ length: 16 }, (_, i) => basePhotos[i % basePhotos.length]);
  setupLazyGalleryGrid({
    gridEl: galleryGrid,
    zoomEl: galleryZoom,
    zoomImageEl: galleryZoomImage,
    photos
  });
};

const buildPagination = (count) => {
  if (!filmPagination) return;
  filmPagination.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const item = document.createElement("div");
    item.className = "pagination-item";
    const fill = document.createElement("span");
    fill.className = "pagination-fill";
    item.appendChild(fill);
    filmPagination.appendChild(item);
  }

  const themes = ["theme-white", "theme-black", "theme-blue", "theme-pink"];
  let themeIndex = 0;

  const applyTheme = () => {
    filmPagination.classList.remove(...themes);
    filmPagination.classList.add(themes[themeIndex]);
  };

  const cycleTheme = () => {
    themeIndex = (themeIndex + 1) % themes.length;
    applyTheme();
  };

  applyTheme();
  filmPagination.onclick = null;
  filmPagination.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cycleTheme();
    }
  };

  if (filmCarousel) {
    filmCarousel.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 640px)").matches) return;
      cycleTheme();
    });
  }
};

const updatePagination = (index, progress) => {
  if (!filmPagination) return;
  const items = filmPagination.querySelectorAll(".pagination-item");
  items.forEach((item, i) => {
    const fill = item.querySelector(".pagination-fill");
    if (!fill) return;
    if (i < index) {
      fill.style.transform = "scaleX(1)";
    } else if (i === index) {
      fill.style.transform = `scaleX(${progress})`;
    } else {
      fill.style.transform = "scaleX(0)";
    }
  });
};

const waitForVideo = (video) =>
  new Promise((resolve) => {
    if (video.readyState >= 3) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("loadeddata", onReady);
      resolve();
    };
    video.addEventListener("canplaythrough", onReady, { once: true });
    video.addEventListener("loadeddata", onReady, { once: true });
    setTimeout(resolve, 5000);
  });

const runReveal = (onComplete) => {
  document.body.classList.add("is-ready");
  document.body.classList.remove("is-loading");
  if (siteLoader) siteLoader.setAttribute("aria-hidden", "true");

  const steps = [
    () => document.body.classList.add("reveal-1"),
    () => document.body.classList.add("reveal-2"),
    () => document.body.classList.add("reveal-3"),
    () => document.body.classList.add("reveal-4")
  ];

  const stepDelay = 120;
  steps.forEach((fn, i) => {
    setTimeout(fn, i * stepDelay);
  });

  setTimeout(() => {
    if (typeof onComplete === "function") onComplete();
  }, stepDelay * steps.length + 40);
};

const finalizeLoad = (startedAt, onComplete) => {
  const minDuration = 900;
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(minDuration - elapsed, 0);

  setTimeout(() => runReveal(onComplete), remaining);
};

const setupCarousel = () => {
  if (!filmCarousel || !filmPagination) return null;
  const videos = Array.from(filmCarousel.querySelectorAll(".film-video"));
  if (videos.length === 0) return null;

  buildPagination(videos.length);

  let activeIndex = 0;
  let isTransitioning = false;
  let rafId = null;

  const resetClasses = () => {
    videos.forEach((video, index) => {
      video.classList.remove("is-active", "is-out", "is-next");
      if (index === activeIndex) {
        video.classList.add("is-active");
      } else {
        video.classList.add("is-next");
      }
    });
  };

  const playActive = () => {
    videos.forEach((video, index) => {
      if (index === activeIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  };

  const startProgress = () => {
    if (rafId) cancelAnimationFrame(rafId);
    const step = () => {
      const activeVideo = videos[activeIndex];
      const duration = activeVideo?.duration || 0;
      if (duration > 0) {
        const progress = Math.min(activeVideo.currentTime / duration, 1);
        updatePagination(activeIndex, progress);
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  };

  const transitionToNext = () => {
    if (isTransitioning) return;
    isTransitioning = true;

    const currentVideo = videos[activeIndex];
    const nextIndex = (activeIndex + 1) % videos.length;
    const nextVideo = videos[nextIndex];

    currentVideo.classList.remove("is-active");
    currentVideo.classList.add("is-out");

    nextVideo.classList.remove("is-next", "is-out");
    nextVideo.classList.add("is-active");
    nextVideo.currentTime = 0;
    nextVideo.play().catch(() => {});

    const finish = () => {
      currentVideo.pause();
      currentVideo.classList.remove("is-out");
      currentVideo.classList.add("is-next");

      activeIndex = nextIndex;
      updatePagination(nextIndex, 0);
      startProgress();
      isTransitioning = false;
    };

    setTimeout(finish, 900);
  };

  videos.forEach((video) => {
    video.addEventListener("ended", () => {
      transitionToNext();
    });
  });

  videos.forEach((video) => {
    video.addEventListener("timeupdate", () => {
      if (video !== videos[activeIndex]) return;
      const duration = video.duration || 0;
      if (duration > 0 && video.currentTime / duration >= 0.98) {
        transitionToNext();
      }
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      videos.forEach((video) => video.pause());
    } else {
      playActive();
    }
  });

  resetClasses();

  return {
    videos,
    start: () => {
      playActive();
      startProgress();
    }
  };
};

const setupVideoMosaicOverlay = () => {
  if (!filmCarousel || !videoMosaicOverlay) return;

  const mosaicCanvas = videoMosaicOverlay;
  const mosaicCtx = mosaicCanvas.getContext("2d");
  if (!mosaicCtx) return;

  const pixelBlockSize = 11;
  const sourceZoom = 1.14;
  let rafId = null;

  const resizeIfNeeded = () => {
    const rect = filmCarousel.getBoundingClientRect();
    const targetWidth = Math.max(1, Math.floor(rect.width / pixelBlockSize));
    const targetHeight = Math.max(1, Math.floor(rect.height / pixelBlockSize));

    if (mosaicCanvas.width !== targetWidth || mosaicCanvas.height !== targetHeight) {
      mosaicCanvas.width = targetWidth;
      mosaicCanvas.height = targetHeight;
    }
  };

  const render = () => {
    resizeIfNeeded();
    const activeVideo = filmCarousel.querySelector(".film-video.is-active");

    if (activeVideo && activeVideo.readyState >= 2) {
      mosaicCtx.imageSmoothingEnabled = false;
      mosaicCtx.clearRect(0, 0, mosaicCanvas.width, mosaicCanvas.height);

      const videoWidth = activeVideo.videoWidth || 1;
      const videoHeight = activeVideo.videoHeight || 1;
      const canvasWidth = mosaicCanvas.width;
      const canvasHeight = mosaicCanvas.height;
      const videoAspect = videoWidth / videoHeight;
      const canvasAspect = canvasWidth / canvasHeight;

      // Match object-fit: cover behavior, then add the original zoom feel.
      let sourceWidth;
      let sourceHeight;
      if (videoAspect > canvasAspect) {
        sourceHeight = videoHeight;
        sourceWidth = sourceHeight * canvasAspect;
      } else {
        sourceWidth = videoWidth;
        sourceHeight = sourceWidth / canvasAspect;
      }

      sourceWidth /= sourceZoom;
      sourceHeight /= sourceZoom;

      const sourceX = (videoWidth - sourceWidth) / 2;
      const sourceY = (videoHeight - sourceHeight) / 2;

      mosaicCtx.drawImage(
        activeVideo,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvasWidth,
        canvasHeight
      );
    }

    rafId = requestAnimationFrame(render);
  };

  render();

  window.addEventListener("resize", resizeIfNeeded);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
      return;
    }

    if (!document.hidden && !rafId) {
      render();
    }
  });
};

const setupRightPanel = () => {
  if (!rightPanel) return;
  panelState.total = xpPopups.length || panelState.total;
  panelState.current = 0;
  setPanelPage(0);
  updatePanelCounter();
  let startPanelBoot = () => {};

  if (panelLoader) {
    const items = Array.from(panelLoader.querySelectorAll(".terminal-list li"));
    const bars = {
      media: panelLoader.querySelector('[data-bar="media"]'),
      assets: panelLoader.querySelector('[data-bar="assets"]')
    };
    const percents = {
      media: panelLoader.querySelector('[data-percent="media"]'),
      assets: panelLoader.querySelector('[data-percent="assets"]')
    };

    const setBar = (barEl, percentEl, percent) => {
      if (!barEl || !percentEl) return;
      barEl.style.setProperty("--bar-fill", `${percent}%`);
      percentEl.textContent = `${percent}%`;
    };

    const animateBar = (barEl, percentEl) =>
      new Promise((resolve) => {
        let percent = 0;
        const tick = () => {
          if (percent >= 100) {
            setBar(barEl, percentEl, 100);
            resolve();
            return;
          }

          const step = 22 + Math.floor(Math.random() * 12);
          percent = Math.min(100, percent + step);
          setBar(barEl, percentEl, percent);
          setTimeout(tick, 45 + Math.floor(Math.random() * 25));
        };

        setBar(barEl, percentEl, 0);
        setTimeout(tick, 60);
      });

    const revealLine = (line) =>
      new Promise((resolve) => {
        line.classList.add("is-done");
        setTimeout(resolve, 110);
      });

    const runSequence = async () => {
      const startTime = Date.now();
      await revealLine(items[0]);
      await revealLine(items[1]);
      await revealLine(items[2]);
      await revealLine(items[3]);
      await animateBar(bars.media, percents.media);
      await revealLine(items[4]);
      await revealLine(items[5]);
      await animateBar(bars.assets, percents.assets);
      await revealLine(items[6]);

      const elapsed = Date.now() - startTime;
      const waitMore = Math.max(1900 - elapsed, 0);
      setTimeout(() => {
        panelLoader.classList.add("is-hidden");
        rightPanel.classList.add("show-counter");
      }, waitMore);
    };
    let hasStartedBoot = false;
    startPanelBoot = () => {
      if (hasStartedBoot) return;
      hasStartedBoot = true;
      runSequence();
    };
  }

  rightPanel.addEventListener("mousemove", (event) => {
    const rect = rightPanel.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    rightPanel.style.setProperty("--cursor-x", `${x}px`);
    rightPanel.style.setProperty("--cursor-y", `${y}px`);
  });

  const linksPanel = rightPanel.querySelector(".xp-popup[data-popup-index='2'] .xp-body-links");
  let isScrollbarDrag = false;

  const isOverPopup2Scrollbar = (event) => {
    if (!linksPanel) return false;
    const barWidth = linksPanel.offsetWidth - linksPanel.clientWidth;
    if (barWidth <= 0) return false;
    const rect = linksPanel.getBoundingClientRect();
    const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;
    const withinX = event.clientX >= rect.right - barWidth && event.clientX <= rect.right;
    return withinX && withinY;
  };

  const isSquareTarget = (event) => {
    if (!(event.target instanceof Element)) return false;
    if (event.target.closest(".social-links a")) return true;
    if (event.target.closest("#xpPlayerToggle")) return true;
    if (isOverPopup2Scrollbar(event)) return true;
    return false;
  };

  const setPointerSquare = (isSquare) => {
    if (isSquare) {
      rightPanel.classList.add("cursor-square");
    } else {
      rightPanel.classList.remove("cursor-square");
    }
  };

  rightPanel.addEventListener("mousemove", (event) => {
    setPointerSquare(isScrollbarDrag || isSquareTarget(event));
  });

  rightPanel.addEventListener("mousedown", (event) => {
    if (isOverPopup2Scrollbar(event)) {
      isScrollbarDrag = true;
      setPointerSquare(true);
    }
  });

  document.addEventListener("mouseup", () => {
    isScrollbarDrag = false;
  });

  document.addEventListener("mousemove", (event) => {
    const rect = rightPanel.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!inside) return;
    rightPanel.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
    rightPanel.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
    rightPanel.classList.add("is-hovered");
  });

  rightPanel.addEventListener("click", () => {
    rightPanel.classList.add("is-focused");
  });

  rightPanel.addEventListener("mouseenter", () => {
    rightPanel.classList.add("is-hovered");
    document.body.classList.add("panel-cursor-none");
  });

  rightPanel.addEventListener("mouseleave", () => {
    rightPanel.classList.remove("is-hovered");
    document.body.classList.remove("panel-cursor-none");
    setPointerSquare(false);
    isScrollbarDrag = false;
  });

  let wheelAccum = 0;
  const wheelStep = 24;
  const edgeWheelStep = 8;
  let lastWheelDirection = 0;
  const normalizeWheelDelta = (event) => {
    if (event.deltaMode === 1) return event.deltaY * 16;
    if (event.deltaMode === 2) return event.deltaY * 320;
    return event.deltaY;
  };

  rightPanel.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const normalizedDelta = normalizeWheelDelta(event) * 0.85;
      if (normalizedDelta === 0) return;
      const direction = normalizedDelta > 0 ? 1 : -1;

      if (direction !== lastWheelDirection) {
        wheelAccum = 0;
        lastWheelDirection = direction;
      }

      wheelAccum += Math.abs(normalizedDelta);

      const isAtStart = panelState.current === 0 && direction > 0;
      const isAtEnd = panelState.current === panelState.total && direction < 0;
      const activeStep = isAtStart || isAtEnd ? edgeWheelStep : wheelStep;

      let stepsApplied = 0;
      while (wheelAccum >= activeStep && stepsApplied < 1) {
        setPanelPage(panelState.current + direction);
        wheelAccum -= activeStep;
        stepsApplied += 1;
      }
    },
    { passive: false }
  );

  document.addEventListener("click", (event) => {
    if (!rightPanel.contains(event.target)) {
      rightPanel.classList.remove("is-focused");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      rightPanel.classList.remove("is-focused");
    }
  });

  rightPanel.addEventListener("mouseleave", () => {
    rightPanel.classList.remove("is-focused");
  });

  return {
    startPanelBoot
  };
};

const setupGuySequence = () => {
  if (!guySequenceFrame) return { start: () => {} };
  const gifPath = "media/gif/Banner.gif";

  return {
    start: () => {
      if (guySequenceFrame.getAttribute("src") !== gifPath) {
        guySequenceFrame.setAttribute("src", gifPath);
      }
    }
  };
};

const setupMobileMediaSwap = (videos) => {
  if (!videoShell || !mobileGifStage) return;
  const mobileQuery = window.matchMedia("(max-width: 640px)");

  const playActiveVideo = () => {
    if (!Array.isArray(videos) || videos.length === 0) return;
    videos.forEach((video) => {
      if (video.classList.contains("is-active")) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  };

  const pauseAllVideos = () => {
    if (!Array.isArray(videos) || videos.length === 0) return;
    videos.forEach((video) => video.pause());
  };

  const syncWithViewport = () => {
    if (!mobileQuery.matches) {
      videoShell.classList.remove("is-showing-gif");
      playActiveVideo();
    }
  };

  videoShell.addEventListener("click", () => {
    if (!mobileQuery.matches) return;
    const showingGif = videoShell.classList.toggle("is-showing-gif");
    videoShell.classList.add("is-fading-shell");

    window.setTimeout(() => {
      videoShell.classList.remove("is-fading-shell");
    }, 260);

    if (showingGif) {
      pauseAllVideos();
      videoShell.classList.remove("is-pop-gif");
      void videoShell.offsetWidth;
      videoShell.classList.add("is-pop-gif");
      window.setTimeout(() => {
        videoShell.classList.remove("is-pop-gif");
      }, 430);
    } else {
      playActiveVideo();
      videoShell.classList.remove("is-pop-gif");
    }

    if (mobileClickHint) {
      mobileClickHint.classList.add("is-hidden");
    }
  });

  if (mobileClickHint) {
    mobileClickHint.addEventListener("click", () => {
      if (!mobileQuery.matches) return;
      videoShell.click();
    });
  }

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncWithViewport);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(syncWithViewport);
  }
};

const setupBrandLetterClicks = () => {
  if (!brandHeading) return;

  const text = (brandHeading.textContent || "").trim();
  if (!text) return;

  const colors = ["#000000", "#e32078", "#2ba6d6"];
  brandHeading.innerHTML = "";

  text.split("").forEach((char) => {
    const letter = document.createElement("span");
    const currentIndex = brandHeading.children.length;
    const variant = (currentIndex % 5) + 1;
    const introRotations = [5, -4, 6, -5, 4];
    letter.className = `brand-letter brand-letter--v${variant}`;
    letter.textContent = char;
    letter.style.color = colors[0];
    letter.style.setProperty("--intro-rot", `${introRotations[currentIndex % introRotations.length]}deg`);
    letter.dataset.colorIndex = "0";

    letter.addEventListener("click", () => {
      const currentIndex = Number(letter.dataset.colorIndex || "0");
      const nextIndex = (currentIndex + 1) % colors.length;
      letter.dataset.colorIndex = String(nextIndex);
      letter.style.color = colors[nextIndex];
      letter.classList.remove("is-pop");
      void letter.offsetWidth;
      letter.classList.add("is-pop");
    });

    brandHeading.appendChild(letter);
  });
};

const playBrandIntroAnimation = () => {
  if (!brandHeading || hasPlayedBrandIntro) return;
  const letters = Array.from(brandHeading.querySelectorAll(".brand-letter"));
  if (letters.length === 0) return;
  hasPlayedBrandIntro = true;

  letters.forEach((letter, index) => {
    const delay = index * 55;
    window.setTimeout(() => {
      letter.classList.remove("is-intro");
      void letter.offsetWidth;
      const onIntroEnd = () => {
        letter.style.color = "#000000";
        letter.classList.remove("is-intro");
      };
      letter.addEventListener("animationend", onIntroEnd, { once: true });
      letter.classList.add("is-intro");

      window.setTimeout(() => {
        letter.style.color = "#e32078";
      }, 40);
      window.setTimeout(() => {
        letter.style.color = "#2ba6d6";
      }, 125);
    }, delay);
  });
};

const setupDvdScreensavers = (() => {
  const instances = new Set();
  // Classic DVD screensaver hues: RGB + CMY.
  const palette = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff"];
  const DVD_SVG_MARKUP = `
    <svg viewBox="26 278 544 273" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path d="M137.34,447.54c46.69,0,84.54-37.85,84.54-84.54,0-17.94-5.6-34.56-15.13-48.24h125.89s61.67-3.31,61.67,46.38-100.32,50.11-100.32,50.11l19.32-82h-65.37l-26.72,117.62h91.69s138.97-5.8,144.73-88.22c1.1-15.81-2.78-28.48-9.77-38.63h94.61l-26.06-40.89h-189.58.01s-178.97.01-178.97.01c-3.45-.43-6.97-.68-10.54-.68-46.69,0-84.54,37.85-84.54,84.54s37.85,84.54,84.54,84.54ZM137.34,320.03c23.74,0,42.98,19.24,42.98,42.98s-19.24,42.98-42.98,42.98-42.98-19.24-42.98-42.98,19.24-42.98,42.98-42.98Z"/>
      <polygon points="515.1 446.21 542.47 329.26 477.1 329.26 451.04 446.21 515.1 446.21"/>
      <ellipse cx="433.08" cy="507.63" rx="16.31" ry="11.32"/>
      <path d="M277.33,496.59v22.06s19.76,2.29,19.76-10.94-19.76-11.12-19.76-11.12Z"/>
      <path d="M297.64,469.23c-149.51,0-270.71,18.09-270.71,40.41s121.2,40.41,270.71,40.41,270.71-18.09,270.71-40.41-121.2-40.41-270.71-40.41ZM166.51,527.82h-12.13l-23.34-40.24h15.71l14.21,24.53,13.32-24.53h16.59l-24.35,40.24ZM230.92,527.82h-14.82v-40.24c-.35-.35,14.82,0,14.82,0v40.24ZM285.27,527.82h-22.94v-40.39s25.15.16,25.15.16c0,0,25.15,1.59,25.15,20.12s-27.35,20.12-27.35,20.12ZM373.68,496.59h-18v7.06h16.94v8.29h-16.76v7.59h17.82v8.29h-32.82v-40.39c-.53,0,32.82,0,32.82,0v9.16ZM433.08,529.25c-17.21,0-31.16-9.68-31.16-21.63s13.95-21.63,31.16-21.63,31.16,9.68,31.16,21.63-13.95,21.63-31.16,21.63Z"/>
    </svg>
  `;
  let globalHooksBound = false;

  const nextColorIndex = (prevIndex) => {
    let next = prevIndex;
    while (next === prevIndex) {
      next = Math.floor(Math.random() * palette.length);
    }
    return next;
  };

  const applyColor = (inst, idx) => {
    inst.colorIndex = idx;
    inst.logo.style.color = palette[idx];
  };

  const measure = (inst) => {
    const stageW = inst.stage.clientWidth;
    const stageH = inst.stage.clientHeight;
    if (!stageW || !stageH) return false;

    const logoW = Math.max(40, Math.min(78, Math.round(stageW * 0.17)));
    const logoH = Math.round(logoW / 1.99);

    inst.stageW = stageW;
    inst.stageH = stageH;
    inst.logoW = logoW;
    inst.logoH = logoH;
    inst.logo.style.width = `${logoW}px`;
    inst.logo.style.height = `${logoH}px`;

    const maxX = Math.max(0, stageW - logoW);
    const maxY = Math.max(0, stageH - logoH);
    inst.x = Math.min(Math.max(inst.x, 0), maxX);
    inst.y = Math.min(Math.max(inst.y, 0), maxY);
    inst.logo.style.left = `${inst.x}px`;
    inst.logo.style.top = `${inst.y}px`;
    return true;
  };

  const ensureRunning = (inst) => {
    if (inst.rafId) return;

    const step = (ts) => {
      inst.rafId = 0;
      if (!inst.stage.isConnected) return;
      if (document.hidden) {
        return;
      }
      if (inst.popup && !inst.popup.classList.contains("is-visible")) {
        return;
      }

      if (inst.needsMeasure) {
        inst.needsMeasure = false;
        if (!measure(inst)) {
          inst.rafId = requestAnimationFrame(step);
          return;
        }
      }

      const dtFactor =
        inst.lastTs && ts ? Math.min(2, (ts - inst.lastTs) / 16.67) : 1;
      inst.lastTs = ts || 0;

      let bounced = false;
      if (inst.y + inst.logoH >= inst.stageH || inst.y <= 0) {
        inst.dirY *= -1;
        bounced = true;
      }
      if (inst.x + inst.logoW >= inst.stageW || inst.x <= 0) {
        inst.dirX *= -1;
        bounced = true;
      }

      if (inst.colorCooldownFrames > 0) {
        inst.colorCooldownFrames -= 1;
      }
      if (bounced && inst.colorCooldownFrames <= 0) {
        applyColor(inst, nextColorIndex(inst.colorIndex));
        inst.colorCooldownFrames = 6;
      }

      inst.x += inst.dirX * inst.speed * dtFactor;
      inst.y += inst.dirY * inst.speed * dtFactor;

      const maxX = Math.max(0, inst.stageW - inst.logoW);
      const maxY = Math.max(0, inst.stageH - inst.logoH);
      inst.x = Math.min(Math.max(inst.x, 0), maxX);
      inst.y = Math.min(Math.max(inst.y, 0), maxY);

      inst.logo.style.left = `${inst.x}px`;
      inst.logo.style.top = `${inst.y}px`;

      inst.rafId = requestAnimationFrame(step);
    };

    inst.rafId = requestAnimationFrame(step);
  };

  const wake = () => {
    instances.forEach((inst) => {
      inst.needsMeasure = true;
      inst.lastTs = 0;
      ensureRunning(inst);
    });
  };

  const bindGlobalHooks = () => {
    if (globalHooksBound) return;
    globalHooksBound = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) wake();
    });
    window.addEventListener("resize", wake, { passive: true });
  };

  return (root = document) => {
    bindGlobalHooks();
    const stages = Array.from(root.querySelectorAll(".xp-body-game"));

    stages.forEach((stage) => {
      if (!(stage instanceof HTMLElement)) return;
      if (stage.dataset.dvdInitialized === "true" && stage.__dvdInstance) return;
      stage.dataset.dvdInitialized = "true";
      stage.classList.add("is-dvd-saver");

      const logo = document.createElement("div");
      logo.className = "dvd-logo";
      logo.setAttribute("aria-hidden", "true");
      logo.innerHTML = DVD_SVG_MARKUP;
      stage.replaceChildren(logo);

      const inst = {
        stage,
        popup: stage.closest(".xp-popup"),
        logo,
        x: 8,
        y: 8,
        dirX: 1,
        dirY: 1,
        speed: 1.15,
        stageW: 0,
        stageH: 0,
        logoW: 0,
        logoH: 0,
        colorIndex: 0,
        needsMeasure: true,
        rafId: 0,
        lastTs: 0,
        colorCooldownFrames: 0
      };

      applyColor(inst, 0);
      stage.__dvdInstance = inst;
      instances.add(inst);
      if ("ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(() => {
          inst.needsMeasure = true;
          ensureRunning(inst);
        });
        resizeObserver.observe(stage);
        inst.resizeObserver = resizeObserver;
      }
      ensureRunning(inst);
    });

    return { wake };
  };
})();

const setupPanelDuplicateInteractions = (panelRoot) => {
  if (!panelRoot) return { startPanelBoot: () => {} };

  const panelLoaderEl = panelRoot.querySelector(".panel-loader");
  const panelCounterEl = panelRoot.querySelector(".panel-counter span");
  const popups = Array.from(panelRoot.querySelectorAll(".xp-popup"));
  const playerToggle = panelRoot.querySelector(".xp-player-toggle");
  const audioTrack = panelRoot.querySelector("audio");
  const messageTrack = panelRoot.querySelector(".xp-message-track");
  const clockEl = panelRoot.querySelector("#njClock");
  const form = panelRoot.querySelector(".contact-form");
  const messageArea = panelRoot.querySelector("#contactMessage");
  const statusEl = panelRoot.querySelector(".contact-status");
  const gallery = panelRoot.querySelector(".gallery-grid");
  const zoom = panelRoot.querySelector(".gallery-zoom");
  const zoomImage = panelRoot.querySelector(".gallery-zoom-image");
  const cards = Array.from(panelRoot.querySelectorAll("[data-collapsible-card]"));
  const dvdController = setupDvdScreensavers(panelRoot);

  const localState = {
    current: 0,
    total: popups.length || 9
  };
  let idleCycleTimer = null;
  let bootFinished = false;
  let pendingIdleStart = false;
  let idleCycleEnabled = true;
  const aboutCopyByPage = [
    "What’s up! My name is Bill and thank you for checking out my website portfolio. I have a ton of cool things on here and I put a lot of love and time into really making it cool. Use the bottom arrows to cycle through each module.",
    "I am a student, developer, filmmaker, and artist based in New Jersey. I’ve lived here for a decade and a half but I’m originally from Kenya! [KENYA_FLAG]",
    "Check out my social media and connect with me on linkedIN. I plan to eventually post some film content on Instagram so #follow",
    "I am always busy and I am currently working on a few web dev and film things. I will most likely add more pages in the future (this is only v5.0).",
    "Vintage media is so cool to me! Personally I own about 40 VHS tapes of old cartoons and I have a crt tv. I tend to base so much of my \"aesthetic\" around older styles so I felt like this odivd (odi dvd) looked cool here. I made it in illustrator and converted it into a path for HTML.",
    "Zero clue what I will put here yet…",
    "A collage of a few professional photos I’ve taken for friends. As much as I do enjoy it, I consider myself a filmmaker over photographer. I also primarily shoot on the S5IIX and AG-HVX200A #PanasonicForLife #FX3KILLER",
    "Click next again…",
    "I love listening to music (so do most people probably) and I wanted to add a small section for my favorite tracks. Click on the vinyl to hear the music but be cautious, it might be loud.",
    "If you have any projects you want to work on together, shoot me a message. I do consider myself a perfectionist, so prepare for that. If for any reason the message box doesn’t send, wait about a day for me to fix it. Enjoy the rest of the site :))"
  ];

  const updateAboutCopy = () => {
    if (!aboutCopy) return;
    const nextCopy = aboutCopyByPage[localState.current] || aboutCopyByPage[0];
    if (!nextCopy.includes("[KENYA_FLAG]")) {
      aboutCopy.textContent = nextCopy;
      return;
    }

    aboutCopy.textContent = "";
    const [before, after = ""] = nextCopy.split("[KENYA_FLAG]");
    aboutCopy.append(document.createTextNode(before));
    const flag = document.createElement("img");
    flag.className = "about-emoji-flag";
    flag.setAttribute("aria-label", "Kenya flag");
    flag.alt = "🇰🇪";
    flag.src = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1f0-1f1ea.svg";
    aboutCopy.append(flag);
    if (after) {
      aboutCopy.append(document.createTextNode(after));
    }
  };

  const updateCounter = () => {
    if (panelCounterEl) {
      panelCounterEl.textContent = `${localState.current}/${localState.total}`;
    }
    if (aboutPanelCounter) {
      aboutPanelCounter.textContent = `${localState.current}/${localState.total}`;
    }
    updateAboutCopy();
  };

  const updatePopupVisibilityLocal = () => {
    popups.forEach((popup, index) => {
      if (index < localState.current) {
        popup.classList.add("is-visible");
      } else {
        popup.classList.remove("is-visible");
      }
    });
    dvdController?.wake?.();
  };

  const setPanelPageLocal = (next) => {
    const clamped = Math.min(Math.max(next, 0), localState.total);
    localState.current = clamped;
    updateCounter();
    updatePopupVisibilityLocal();
  };

  const disableIdleCycleUntilPageLeave = () => {
    idleCycleEnabled = false;
    pendingIdleStart = false;
    stopIdleCycle();
  };

  const startIdleCycle = () => {
    if (!idleCycleEnabled) return;
    if (!bootFinished) {
      pendingIdleStart = true;
      return;
    }
    if (idleCycleTimer || popups.length === 0) return;
    idleCycleTimer = window.setInterval(() => {
      const next = localState.current >= localState.total ? 0 : localState.current + 1;
      setPanelPageLocal(next);
    }, 2600);
  };

  const stopIdleCycle = () => {
    if (!idleCycleTimer) return;
    clearInterval(idleCycleTimer);
    idleCycleTimer = null;
  };

  const onPageLeave = () => {
    idleCycleEnabled = true;
    pendingIdleStart = false;
    stopIdleCycle();
  };

  const setupCardsLocal = () => {
    cards.forEach((card) => {
      const toggle = card.querySelector(".card-toggle");
      if (!toggle) return;
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isCollapsed = card.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      });
    });
  };

  const setPanelPageLooped = (next) => {
    const max = localState.total;
    let wrapped = next;
    if (wrapped > max) wrapped = 0;
    if (wrapped < 0) wrapped = max;
    disableIdleCycleUntilPageLeave();
    setPanelPageLocal(wrapped);
  };

  const setupPlayerLocal = () => {
    if (!playerToggle) return;
    const playerPopup = playerToggle.closest(".xp-popup");
    if (!playerPopup) return;

    const startVisual = () => playerPopup.classList.add("is-playing");
    const stopVisual = () => playerPopup.classList.remove("is-playing");

    playerToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!audioTrack) {
        playerPopup.classList.toggle("is-playing");
        return;
      }

      if (audioTrack.paused) {
        startVisual();
        audioTrack.play().catch(() => {});
      } else {
        audioTrack.pause();
        stopVisual();
      }
    });

    if (audioTrack) {
      audioTrack.addEventListener("pause", stopVisual);
      audioTrack.addEventListener("ended", stopVisual);
      audioTrack.addEventListener("play", startVisual);
    }
  };

  const setupMessageLocal = () => {
    if (!messageTrack || !audioTrack) return;
    const fallback =
      audioTrack.dataset.fallbackTrack || "Taking What's Not Yours - TV Girl";
    try {
      const sourceUrl = new URL(audioTrack.src, window.location.href);
      const fileName = decodeURIComponent(sourceUrl.pathname.split("/").pop() || "");
      const title = fileName.replace(/\.[^/.]+$/, "").trim();
      messageTrack.textContent = title || fallback;
    } catch {
      messageTrack.textContent = fallback;
    }
  };

  const setupClockLocal = () => {
    if (!clockEl) return;
    registerNjClock(clockEl);
  };

  const setupGalleryLocal = () => {
    if (!gallery || !zoom || !zoomImage) return;
    const basePhotos = [
      "media/gallery/1.png",
      "media/gallery/2.png",
      "media/gallery/3.png",
      "media/gallery/4.png",
      "media/gallery/5.JPG",
      "media/gallery/6.JPG",
      "media/gallery/7.JPG",
      "media/gallery/8.JPG",
      "media/gallery/9.png",
      "media/gallery/10.png",
      "media/gallery/11.png",
      "media/gallery/12.png",
      "media/gallery/13.png",
      "media/gallery/14.png",
      "media/gallery/15.png",
      "media/gallery/16.png"
    ];
    const photos = Array.from({ length: 16 }, (_, i) => basePhotos[i % basePhotos.length]);
    setupLazyGalleryGrid({
      gridEl: gallery,
      zoomEl: zoom,
      zoomImageEl: zoomImage,
      photos
    });
  };

  const setupContactLocal = () => {
    if (!form || !messageArea) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const fullName = String(formData.get("fullName") || "").trim();
      const subject = String(formData.get("subject") || "").trim();
      const message = String(formData.get("message") || "").trim();

      if (!fullName || !subject || !message) {
        form.reportValidity();
        return;
      }

      if (statusEl) statusEl.textContent = "Sending...";

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            subject,
            message
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to send message.");
        }

        form.reset();
        if (statusEl) statusEl.textContent = "Message sent.";
      } catch (error) {
        if (statusEl) {
          statusEl.textContent =
            error instanceof Error ? error.message : "Unable to send message.";
        }
      }
    });
  };

  setPanelPageLocal(0);
  updateCounter();
  setupCardsLocal();
  setupPlayerLocal();
  setupMessageLocal();
  setupClockLocal();
  setupGalleryLocal();
  setupContactLocal();
  let panelRect = null;
  let cursorRaf = 0;
  let pendingCursor = null;

  const refreshPanelRect = () => {
    panelRect = panelRoot.getBoundingClientRect();
  };

  const flushCursorPosition = () => {
    cursorRaf = 0;
    if (!pendingCursor) return;
    panelRoot.style.setProperty("--cursor-x", `${pendingCursor.x}px`);
    panelRoot.style.setProperty("--cursor-y", `${pendingCursor.y}px`);
  };

  const scheduleCursorPosition = (clientX, clientY) => {
    if (!panelRect) refreshPanelRect();
    if (!panelRect) return;
    pendingCursor = {
      x: clientX - panelRect.left,
      y: clientY - panelRect.top
    };
    if (!cursorRaf) {
      cursorRaf = requestAnimationFrame(flushCursorPosition);
    }
  };

  panelRoot.addEventListener("mousemove", (event) => {
    scheduleCursorPosition(event.clientX, event.clientY);
  });

  const linksPanel = panelRoot.querySelector(".xp-popup[data-popup-index='2'] .xp-body-links");
  let isScrollbarDrag = false;

  const isOverPopup2Scrollbar = (event) => {
    if (!linksPanel) return false;
    const barWidth = linksPanel.offsetWidth - linksPanel.clientWidth;
    if (barWidth <= 0) return false;
    const rect = linksPanel.getBoundingClientRect();
    const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;
    const withinX = event.clientX >= rect.right - barWidth && event.clientX <= rect.right;
    return withinX && withinY;
  };

  const isSquareTarget = (event) => {
    if (!(event.target instanceof Element)) return false;
    if (event.target.closest(".social-links a")) return true;
    if (event.target.closest(".xp-player-toggle")) return true;
    if (isOverPopup2Scrollbar(event)) return true;
    return false;
  };

  const setPointerSquare = (isSquare) => {
    if (isSquare) {
      panelRoot.classList.add("cursor-square");
    } else {
      panelRoot.classList.remove("cursor-square");
    }
  };

  panelRoot.addEventListener("mousemove", (event) => {
    setPointerSquare(isScrollbarDrag || isSquareTarget(event));
  });

  panelRoot.addEventListener("mousedown", (event) => {
    if (isOverPopup2Scrollbar(event)) {
      isScrollbarDrag = true;
      setPointerSquare(true);
    }
  });

  document.addEventListener("mouseup", () => {
    isScrollbarDrag = false;
  });

  document.addEventListener("mousemove", (event) => {
    if (!panelRoot.classList.contains("is-hovered") && !isScrollbarDrag) return;
    if (!panelRect) refreshPanelRect();
    const rect = panelRect;
    if (!rect) return;
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) return;
    scheduleCursorPosition(event.clientX, event.clientY);
    panelRoot.classList.add("is-hovered");
  });

  panelRoot.addEventListener("click", () => {
    panelRoot.classList.add("is-focused");
  });

  panelRoot.addEventListener("mouseenter", () => {
    refreshPanelRect();
    panelRoot.classList.add("is-hovered");
    document.body.classList.add("panel-cursor-none");
  });

  panelRoot.addEventListener("mouseleave", () => {
    panelRoot.classList.remove("is-hovered");
    document.body.classList.remove("panel-cursor-none");
    setPointerSquare(false);
    isScrollbarDrag = false;
    panelRoot.classList.remove("is-focused");
  });

  window.addEventListener("resize", refreshPanelRect);
  window.addEventListener("scroll", refreshPanelRect, { passive: true });

  // Wheel paging intentionally disabled; page changes are controlled by external arrows now.

  document.addEventListener("click", (event) => {
    if (!panelRoot.contains(event.target)) {
      panelRoot.classList.remove("is-focused");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      panelRoot.classList.remove("is-focused");
    }
  });

  let startPanelBoot = () => {};
  if (panelLoaderEl) {
    const items = Array.from(panelLoaderEl.querySelectorAll(".terminal-list li"));
    const bars = {
      media: panelLoaderEl.querySelector('[data-bar="media"]'),
      assets: panelLoaderEl.querySelector('[data-bar="assets"]')
    };
    const percents = {
      media: panelLoaderEl.querySelector('[data-percent="media"]'),
      assets: panelLoaderEl.querySelector('[data-percent="assets"]')
    };

    const setBar = (barEl, percentEl, percent) => {
      if (!barEl || !percentEl) return;
      barEl.style.setProperty("--bar-fill", `${percent}%`);
      percentEl.textContent = `${percent}%`;
    };

    const animateBar = (barEl, percentEl) =>
      new Promise((resolve) => {
        let percent = 0;
        const tick = () => {
          if (percent >= 100) {
            setBar(barEl, percentEl, 100);
            resolve();
            return;
          }
          const step = 22 + Math.floor(Math.random() * 12);
          percent = Math.min(100, percent + step);
          setBar(barEl, percentEl, percent);
          setTimeout(tick, 45 + Math.floor(Math.random() * 25));
        };
        setBar(barEl, percentEl, 0);
        setTimeout(tick, 60);
      });

    const revealLine = (line) =>
      new Promise((resolve) => {
        line.classList.add("is-done");
        setTimeout(resolve, 110);
      });

    const runSequence = async () => {
      const startTime = Date.now();
      await revealLine(items[0]);
      await revealLine(items[1]);
      await revealLine(items[2]);
      await revealLine(items[3]);
      await animateBar(bars.media, percents.media);
      await revealLine(items[4]);
      await revealLine(items[5]);
      await animateBar(bars.assets, percents.assets);
      await revealLine(items[6]);
      const elapsed = Date.now() - startTime;
      const waitMore = Math.max(1900 - elapsed, 0);
      setTimeout(() => {
        panelLoaderEl.classList.add("is-hidden");
        panelRoot.classList.add("show-counter");
        bootFinished = true;
        if (pendingIdleStart) {
          pendingIdleStart = false;
          startIdleCycle();
        }
      }, waitMore);
    };

    let hasStartedBoot = false;
    startPanelBoot = () => {
      if (hasStartedBoot) return;
      hasStartedBoot = true;
      runSequence();
    };
  } else {
    panelRoot.classList.add("show-counter");
  }

  return {
    startPanelBoot,
    startIdleCycle,
    stopIdleCycle,
    setPanelPageLocal,
    setPanelPageLooped,
    onPageLeave
  };
};

const setupAboutPanelArrows = (aboutPanelController) => {
  if (!aboutPanelController) return;
  if (aboutPrevButton) {
    aboutPrevButton.addEventListener("click", () => {
      aboutPanelController.setPanelPageLooped?.(
        (Number((aboutPanelCounter?.textContent || "0/9").split("/")[0]) || 0) - 1
      );
    });
  }
  if (aboutNextButton) {
    aboutNextButton.addEventListener("click", () => {
      aboutPanelController.setPanelPageLooped?.(
        (Number((aboutPanelCounter?.textContent || "0/9").split("/")[0]) || 0) + 1
      );
    });
  }
};

const setupAboutPanelDuplicate = () => {
  if (!rightPanel || !aboutPanelMount) return;
  const clone = rightPanel.cloneNode(true);
  clone.id = "rightPanelAbout";
  clone.classList.remove("hero-panel-source");
  const taskbar = document.createElement("div");
  taskbar.className = "xp-taskbar";
  taskbar.innerHTML = `
    <span class="xp-taskbar-start">start</span>
    <span class="xp-taskbar-tabs" aria-hidden="true">
      <span class="xp-taskbar-tab"></span>
      <span class="xp-taskbar-tab"></span>
      <span class="xp-taskbar-tab"></span>
    </span>
    <span class="xp-taskbar-clock">4:44</span>
  `;
  clone.appendChild(taskbar);

  aboutPanelMount.innerHTML = "";
  aboutPanelMount.appendChild(clone);
  return setupPanelDuplicateInteractions(clone);
};

const setupBubbleResumeRedirect = () => {
  if (!bubbleResumeTrigger) return;

  const bubbleImages = Array.from(document.querySelectorAll(".bubble-image"));
  bubbleImages.forEach((bubble) => {
    bubble.addEventListener("mouseleave", () => {
      if (bubblesFrame?.classList.contains("is-asteroids-focus")) return;
      bubble.classList.remove("is-returning");
      void bubble.offsetWidth;
      bubble.classList.add("is-returning");
    });
    bubble.addEventListener("animationend", () => {
      bubble.classList.remove("is-returning");
    });
  });

  const openResume = () => {
    window.location.href = "resume.html";
  };

  bubbleResumeTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    openResume();
  });

  bubbleResumeTrigger.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openResume();
  });
};

const setupPageThreeLinkToggle = () => {
  if (!pageThreeSubline) return;

  const labels = ["odiwr.com", "my portfolio v5.0"];
  let index = 0;
  const prefixText = "days since deployment of ";

  pageThreeSubline.style.cursor = "pointer";
  pageThreeSubline.setAttribute("role", "button");
  pageThreeSubline.setAttribute("tabindex", "0");
  pageThreeSubline.setAttribute("aria-label", "Toggle portfolio label");

  const applyLabel = () => {
    pageThreeSubline.innerHTML = `${prefixText}<strong>${labels[index]}</strong>`;
  };

  const toggle = () => {
    const currentText = (pageThreeSubline.textContent || "").trim().toLowerCase();
    const currentIndex = labels.findIndex((label) =>
      currentText.includes(label.toLowerCase())
    );
    index = currentIndex >= 0 ? currentIndex : index;
    index = (index + 1) % labels.length;
    applyLabel();
  };

  pageThreeSubline.addEventListener("click", (event) => {
    event.preventDefault();
    toggle();
  });

  pageThreeSubline.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
};

const setupBubblesAsteroidsBackdrop = () => {
  if (
    !bubblesFrame ||
    !bubblesGameSvg ||
    !bubblesGameStars ||
    !bubblesGameAsteroids ||
    !bubblesGameBullets ||
    !bubblesGameShip ||
    !bubblesGameMode
  ) {
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const createSvgEl = (tag) => document.createElementNS(SVG_NS, tag);
  const rand = (min, max) => min + Math.random() * (max - min);
  const wrapAngle = (angle) => {
    let next = angle;
    while (next > Math.PI) next -= Math.PI * 2;
    while (next < -Math.PI) next += Math.PI * 2;
    return next;
  };
  const wrapPos = (obj, width, height) => {
    if (obj.x < 0) obj.x += width;
    if (obj.x > width) obj.x -= width;
    if (obj.y < 0) obj.y += height;
    if (obj.y > height) obj.y -= height;
  };
  const isEditableTarget = (target) =>
    !!target &&
    (target.closest("input, textarea, select, button, [contenteditable='true']") ||
      target.isContentEditable);

  const keyState = new Map();
  const state = {
    width: Math.max(100, bubblesFrame.clientWidth || 100),
    height: Math.max(100, bubblesFrame.clientHeight || 100),
    isVisible: true,
    lastTs: 0,
    manualUntil: 0,
    forcePlayerLock: false,
    fireCooldown: 0,
    aiFireCooldown: 0,
    shipInvuln: 0,
    ship: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 13
    },
    bullets: [],
    asteroids: []
  };

  const nodes = {
    asteroidPolys: [],
    bulletCircles: [],
    shipGroup: createSvgEl("g"),
    shipHull: createSvgEl("polygon"),
    shipFlame: createSvgEl("polyline"),
    shipPilot: createSvgEl("circle")
  };

  const setModeIndicator = (isUser) => {
    bubblesGameMode.classList.toggle("is-user", isUser && !state.forcePlayerLock);
    bubblesGameMode.classList.toggle("is-player-lock", !!state.forcePlayerLock);
    const label = bubblesGameMode.querySelector(".bubbles-game-label");
    if (label) label.textContent = isUser ? "You" : "BOT";
  };

  const buildStars = () => {
    bubblesGameStars.innerHTML = "";
    const starCount = Math.max(22, Math.round((state.width * state.height) / 35000));
    for (let i = 0; i < starCount; i += 1) {
      const x = rand(8, state.width - 8);
      const y = rand(8, state.height - 8);
      const dot = createSvgEl("circle");
      dot.setAttribute("cx", `${x.toFixed(1)}`);
      dot.setAttribute("cy", `${y.toFixed(1)}`);
      dot.setAttribute("r", `${rand(0.65, 1.65).toFixed(2)}`);
      dot.setAttribute("fill", "rgba(0,0,0,0.22)");
      bubblesGameStars.appendChild(dot);

      if (Math.random() < 0.28) {
        const mark = createSvgEl("path");
        const dx = rand(-9, 9);
        const dy = rand(-9, 9);
        mark.setAttribute(
          "d",
          `M ${x.toFixed(1)} ${y.toFixed(1)} q ${(dx * 0.5).toFixed(1)} ${(-dy * 0.2).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`
        );
        mark.setAttribute("fill", "none");
        mark.setAttribute("stroke", "rgba(0,0,0,0.12)");
        mark.setAttribute("stroke-width", "1.1");
        mark.setAttribute("stroke-linecap", "round");
        bubblesGameStars.appendChild(mark);
      }
    }
  };

  const makeAsteroidShape = (size) => {
    const points = [];
    const pointCount = 9;
    for (let i = 0; i < pointCount; i += 1) {
      const a = (Math.PI * 2 * i) / pointCount;
      const r = size * rand(0.74, 1.16);
      points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return points;
  };

  const spawnAsteroid = (size = rand(26, 54), x, y) => {
    const safePadding = 120;
    let ax = x ?? rand(0, state.width);
    let ay = y ?? rand(0, state.height);
    const distToShip = Math.hypot(ax - state.ship.x, ay - state.ship.y);
    if (distToShip < safePadding) {
      ax = (ax + state.width * 0.45) % state.width;
      ay = (ay + state.height * 0.4) % state.height;
    }
    state.asteroids.push({
      x: ax,
      y: ay,
      vx: rand(-45, 45),
      vy: rand(-45, 45),
      angle: rand(0, Math.PI * 2),
      spin: rand(-0.7, 0.7),
      size,
      shape: makeAsteroidShape(size)
    });
  };

  const seedAsteroids = () => {
    state.asteroids = [];
    const count = Math.max(6, Math.round((state.width * state.height) / 180000));
    for (let i = 0; i < count; i += 1) {
      spawnAsteroid();
    }
  };

  const resetShip = () => {
    state.ship.x = state.width * 0.5;
    state.ship.y = state.height * 0.52;
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.angle = -Math.PI / 2;
    state.shipInvuln = 1.6;
  };

  const resize = () => {
    state.width = Math.max(100, bubblesFrame.clientWidth || 100);
    state.height = Math.max(100, bubblesFrame.clientHeight || 100);
    bubblesGameSvg.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
    buildStars();
    if (!state.ship.x && !state.ship.y) {
      resetShip();
      seedAsteroids();
    } else {
      state.ship.x = Math.min(Math.max(state.ship.x, 0), state.width);
      state.ship.y = Math.min(Math.max(state.ship.y, 0), state.height);
    }
  };

  const ensurePools = () => {
    while (nodes.asteroidPolys.length < Math.max(24, state.asteroids.length + 6)) {
      const poly = createSvgEl("polygon");
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", "rgba(0,0,0,0.35)");
      poly.setAttribute("stroke-width", "2");
      poly.setAttribute("stroke-linejoin", "round");
      bubblesGameAsteroids.appendChild(poly);
      nodes.asteroidPolys.push(poly);
    }

    while (nodes.bulletCircles.length < Math.max(20, state.bullets.length + 6)) {
      const bullet = createSvgEl("circle");
      bullet.setAttribute("r", "2");
      bullet.setAttribute("fill", "#d62424");
      bubblesGameBullets.appendChild(bullet);
      nodes.bulletCircles.push(bullet);
    }
  };

  const buildShip = () => {
    nodes.shipHull.setAttribute("points", "15,0 -10,9 -5,0 -10,-9");
    nodes.shipHull.setAttribute("fill", "none");
    nodes.shipHull.setAttribute("stroke", "rgba(0,0,0,0.55)");
    nodes.shipHull.setAttribute("stroke-width", "2");
    nodes.shipHull.setAttribute("stroke-linejoin", "round");

    nodes.shipFlame.setAttribute("points", "-8,0 -17,0 -12,4 -19,0 -12,-4 -17,0");
    nodes.shipFlame.setAttribute("fill", "none");
    nodes.shipFlame.setAttribute("stroke", "rgba(214,36,36,0.7)");
    nodes.shipFlame.setAttribute("stroke-width", "1.8");
    nodes.shipFlame.setAttribute("stroke-linecap", "round");
    nodes.shipFlame.style.display = "none";

    nodes.shipPilot.setAttribute("cx", "4");
    nodes.shipPilot.setAttribute("cy", "0");
    nodes.shipPilot.setAttribute("r", "1.5");
    nodes.shipPilot.setAttribute("fill", "rgba(0,0,0,0.4)");

    nodes.shipGroup.appendChild(nodes.shipFlame);
    nodes.shipGroup.appendChild(nodes.shipHull);
    nodes.shipGroup.appendChild(nodes.shipPilot);
    bubblesGameShip.appendChild(nodes.shipGroup);
  };

  const shootBullet = () => {
    if (state.fireCooldown > 0) return false;
    const noseX = state.ship.x + Math.cos(state.ship.angle) * 16;
    const noseY = state.ship.y + Math.sin(state.ship.angle) * 16;
    state.bullets.push({
      x: noseX,
      y: noseY,
      vx: state.ship.vx + Math.cos(state.ship.angle) * 340,
      vy: state.ship.vy + Math.sin(state.ship.angle) * 340,
      life: 1.15
    });
    state.fireCooldown = 0.16;
    return true;
  };

  const controlPressed = (codes) => codes.some((code) => keyState.get(code));
  const isManualActive = (now) =>
    state.isVisible &&
    (state.forcePlayerLock ||
      controlPressed(["ArrowUp", "KeyW", "ArrowLeft", "KeyA", "ArrowRight", "KeyD", "ArrowDown", "KeyS", "Space"]) ||
      now < state.manualUntil);

  const getUserControl = () => ({
    turn:
      (controlPressed(["ArrowRight", "KeyD"]) ? 1 : 0) -
      (controlPressed(["ArrowLeft", "KeyA"]) ? 1 : 0),
    thrust: controlPressed(["ArrowUp", "KeyW"]),
    brake: controlPressed(["ArrowDown", "KeyS"]),
    fire: controlPressed(["Space"])
  });

  const getWrappedDelta = (fromX, fromY, toX, toY) => {
    let dx = toX - fromX;
    let dy = toY - fromY;
    if (Math.abs(dx) > state.width * 0.5) dx -= Math.sign(dx) * state.width;
    if (Math.abs(dy) > state.height * 0.5) dy -= Math.sign(dy) * state.height;
    return { dx, dy };
  };

  const solveInterceptTime = (rx, ry, rvx, rvy, projectileSpeed) => {
    const a = rvx * rvx + rvy * rvy - projectileSpeed * projectileSpeed;
    const b = 2 * (rx * rvx + ry * rvy);
    const c = rx * rx + ry * ry;

    if (c <= 1e-6) return 0;

    if (Math.abs(a) < 1e-6) {
      if (Math.abs(b) < 1e-6) return null;
      const t = -c / b;
      return t > 0 ? t : null;
    }

    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-b - root) / (2 * a);
    const t2 = (-b + root) / (2 * a);
    const positives = [t1, t2].filter((t) => Number.isFinite(t) && t > 0);
    if (positives.length === 0) return null;
    return Math.min(...positives);
  };

  const getPredictedAimForAsteroid = (asteroid) => {
    const { dx, dy } = getWrappedDelta(state.ship.x, state.ship.y, asteroid.x, asteroid.y);
    const dist = Math.hypot(dx, dy);
    const relVx = asteroid.vx - state.ship.vx;
    const relVy = asteroid.vy - state.ship.vy;
    const bulletSpeed = 340;
    const t = solveInterceptTime(dx, dy, relVx, relVy, bulletSpeed);

    if (t == null) {
      const desired = Math.atan2(dy, dx);
      return {
        asteroid,
        dist,
        interceptTime: null,
        desiredAngle: desired,
        aimX: state.ship.x + dx,
        aimY: state.ship.y + dy,
        score: dist * 1.1 + (220 - Math.min(220, asteroid.size * 4))
      };
    }

    const leadDx = dx + relVx * t;
    const leadDy = dy + relVy * t;
    const desired = Math.atan2(leadDy, leadDx);
    const leadDist = Math.hypot(leadDx, leadDy);
    const bulletLife = 1.15;
    const inLifeWindow = t <= bulletLife * 0.98;
    const score =
      t * 240 +
      dist * 0.18 -
      asteroid.size * 1.35 +
      (inLifeWindow ? -24 : 120);

    return {
      asteroid,
      dist,
      interceptTime: t,
      desiredAngle: desired,
      aimX: state.ship.x + leadDx,
      aimY: state.ship.y + leadDy,
      inLifeWindow,
      score
    };
  };

  const getBestAiTarget = () => {
    let best = null;
    for (const asteroid of state.asteroids) {
      const candidate = getPredictedAimForAsteroid(asteroid);
      if (!best || candidate.score < best.score) best = candidate;
    }
    return best;
  };

  const getAiControl = () => {
    const targetInfo = getBestAiTarget();
    if (!targetInfo) {
      return { turn: 0.35, thrust: false, brake: false, fire: false };
    }
    const { asteroid: target, dist, desiredAngle, interceptTime, inLifeWindow } = targetInfo;
    const diff = wrapAngle(desiredAngle - state.ship.angle);
    const speed = Math.hypot(state.ship.vx, state.ship.vy);
    let turn = 0;
    if (Math.abs(diff) > 0.07) turn = diff > 0 ? 1 : -1;

    const tooClose = dist < target.size + 90;
    const thrust =
      !tooClose &&
      Math.abs(diff) < 0.58 &&
      (dist > 170 || speed < 55);
    const brake = tooClose || (!thrust && speed > 150);

    const angularTolerance = Math.max(0.045, Math.min(0.11, target.size / Math.max(90, dist)));
    const hasGoodLead =
      interceptTime != null &&
      inLifeWindow &&
      interceptTime > 0.03;
    const fire =
      state.aiFireCooldown <= 0 &&
      Math.abs(diff) < angularTolerance &&
      dist < Math.max(state.width, state.height) * 0.82 &&
      (hasGoodLead || (dist < 130 && Math.abs(diff) < 0.06));

    return { turn, thrust, brake, fire };
  };

  const splitAsteroid = (index) => {
    const asteroid = state.asteroids[index];
    if (!asteroid) return;
    const { x, y, size } = asteroid;
    state.asteroids.splice(index, 1);
    if (size > 24) {
      spawnAsteroid(size * 0.62, x + rand(-8, 8), y + rand(-8, 8));
      spawnAsteroid(size * 0.56, x + rand(-8, 8), y + rand(-8, 8));
    }
    if (state.asteroids.length < 5) {
      spawnAsteroid(rand(26, 54));
    }
  };

  const update = (dt, now) => {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.aiFireCooldown = Math.max(0, state.aiFireCooldown - dt);
    state.shipInvuln = Math.max(0, state.shipInvuln - dt);

    const userActive = isManualActive(now);
    setModeIndicator(userActive);
    const control = userActive ? getUserControl() : getAiControl();

    state.ship.angle += control.turn * 3.6 * dt;

    if (control.thrust) {
      state.ship.vx += Math.cos(state.ship.angle) * 260 * dt;
      state.ship.vy += Math.sin(state.ship.angle) * 260 * dt;
    }

    if (control.brake) {
      const brakeFactor = Math.pow(0.87, dt * 60);
      state.ship.vx *= brakeFactor;
      state.ship.vy *= brakeFactor;
    }

    const drag = Math.pow(0.992, dt * 60);
    state.ship.vx *= drag;
    state.ship.vy *= drag;

    state.ship.x += state.ship.vx * dt;
    state.ship.y += state.ship.vy * dt;
    wrapPos(state.ship, state.width, state.height);

    if (control.fire) {
      const fired = shootBullet();
      if (fired && !userActive) {
        state.aiFireCooldown = 0.34 + Math.random() * 0.14;
      }
    }

    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      wrapPos(bullet, state.width, state.height);
      if (bullet.life <= 0) {
        state.bullets.splice(i, 1);
      }
    }

    for (const asteroid of state.asteroids) {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.angle += asteroid.spin * dt;
      wrapPos(asteroid, state.width, state.height);
    }

    for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = state.bullets[bi];
      let hitIndex = -1;
      for (let ai = state.asteroids.length - 1; ai >= 0; ai -= 1) {
        const asteroid = state.asteroids[ai];
        if (Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.size) {
          hitIndex = ai;
          break;
        }
      }
      if (hitIndex >= 0) {
        state.bullets.splice(bi, 1);
        splitAsteroid(hitIndex);
      }
    }

    if (state.shipInvuln <= 0) {
      for (const asteroid of state.asteroids) {
        if (
          Math.hypot(state.ship.x - asteroid.x, state.ship.y - asteroid.y) <
          asteroid.size + state.ship.radius
        ) {
          resetShip();
          break;
        }
      }
    }
  };

  const render = () => {
    ensurePools();

    for (let i = 0; i < nodes.asteroidPolys.length; i += 1) {
      const node = nodes.asteroidPolys[i];
      const asteroid = state.asteroids[i];
      if (!asteroid) {
        node.style.display = "none";
        continue;
      }
      node.style.display = "";
      const cos = Math.cos(asteroid.angle);
      const sin = Math.sin(asteroid.angle);
      const pts = asteroid.shape
        .map((p) => {
          const x = asteroid.x + p.x * cos - p.y * sin;
          const y = asteroid.y + p.x * sin + p.y * cos;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      node.setAttribute("points", pts);
      node.setAttribute("stroke-width", asteroid.size > 34 ? "2.2" : "1.8");
    }

    for (let i = 0; i < nodes.bulletCircles.length; i += 1) {
      const node = nodes.bulletCircles[i];
      const bullet = state.bullets[i];
      if (!bullet) {
        node.style.display = "none";
        continue;
      }
      node.style.display = "";
      node.setAttribute("cx", bullet.x.toFixed(1));
      node.setAttribute("cy", bullet.y.toFixed(1));
      node.setAttribute("opacity", `${Math.max(0.25, bullet.life / 1.15)}`);
    }

    nodes.shipGroup.setAttribute(
      "transform",
      `translate(${state.ship.x.toFixed(1)} ${state.ship.y.toFixed(1)}) rotate(${((state.ship.angle * 180) / Math.PI).toFixed(1)})`
    );

    const thrusting =
      controlPressed(["ArrowUp", "KeyW"]) ||
      (!isManualActive(performance.now()) && getAiControl().thrust);
    nodes.shipFlame.style.display = thrusting ? "" : "none";
    nodes.shipGroup.setAttribute(
      "opacity",
      state.shipInvuln > 0 && Math.sin(performance.now() / 55) > 0 ? "0.35" : "1"
    );
  };

  const onKeyDown = (event) => {
    const code = event.code;
    const relevant = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space"
    ];
    if (!relevant.includes(code)) return;
    if (!state.isVisible) return;
    if (isEditableTarget(event.target)) return;

    keyState.set(code, true);
    state.manualUntil = performance.now() + 2200;

    if (code.startsWith("Arrow") || code === "Space") {
      event.preventDefault();
    }
  };

  const onKeyUp = (event) => {
    const code = event.code;
    if (!keyState.has(code)) return;
    keyState.set(code, false);
    if (code.startsWith("Arrow") || code === "Space") {
      event.preventDefault();
    }
  };

  const onVisibilityChange = () => {
    const rect = bubblesFrame.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const visiblePx = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    state.isVisible = visiblePx > Math.min(rect.height * 0.25, 180);
  };

  buildShip();
  resize();
  ensurePools();
  setModeIndicator(false);
  onVisibilityChange();

  bubblesGameMode.addEventListener("click", (event) => {
    event.preventDefault();
    state.forcePlayerLock = !state.forcePlayerLock;
    bubblesFrame.classList.toggle("is-asteroids-focus", state.forcePlayerLock);
    setModeIndicator(state.forcePlayerLock || isManualActive(performance.now()));
  });

  let resizeRaf = 0;
  const queueResize = () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resize();
    });
  };

  window.addEventListener("resize", queueResize);
  window.addEventListener("scroll", onVisibilityChange, { passive: true });
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => queueResize())
      : null;
  observer?.observe(bubblesFrame);

  const loop = (ts) => {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min((ts - state.lastTs) / 1000, 0.05);
    state.lastTs = ts;
    update(dt, ts);
    render();
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
};

const setupPageEntryMotion = ({ aboutPanelController, deploymentCounterController }) => {
  const sections = [
    { key: "hero", el: pageHero },
    { key: "pageTwo", el: pageTwo },
    { key: "bubbles", el: pageBubbles },
    { key: "pageThree", el: pageThree }
  ].filter((item) => item.el);

  if (sections.length === 0) return;

  const visited = new Set();
  let brandIdleTimer = null;
  let brandIdlePhase = 0;

  const getBrandLetters = () =>
    brandHeading ? Array.from(brandHeading.querySelectorAll(".brand-letter")) : [];

  const brandColors = ["#000000", "#2ba6d6", "#e32078"];

  const areBrandColorsUntouched = () => {
    const letters = getBrandLetters();
    return letters.length > 0 && letters.every((letter) => (letter.dataset.colorIndex || "0") === "0");
  };

  const stopBrandIdle = () => {
    if (brandIdleTimer) {
      clearInterval(brandIdleTimer);
      brandIdleTimer = null;
    }
    getBrandLetters().forEach((letter) => {
      letter.classList.remove("is-idle-blink");
      if ((letter.dataset.colorIndex || "0") === "0") {
        letter.style.opacity = "1";
        letter.style.color = "#000000";
      }
    });
  };

  const tickBrandIdle = () => {
    if (!areBrandColorsUntouched()) {
      stopBrandIdle();
      return;
    }
    const letters = getBrandLetters();
    letters.forEach((letter, index) => {
      const jitter = (Math.random() * 3) | 0;
      const nextColor = brandColors[(brandIdlePhase + index + jitter) % brandColors.length];
      letter.style.color = nextColor;
      letter.classList.add("is-idle-blink");
      letter.style.opacity = "1";
    });
    brandIdlePhase = (brandIdlePhase + 1) % brandColors.length;
  };

  const startBrandIdle = () => {
    if (brandIdleTimer || !areBrandColorsUntouched()) return;
    tickBrandIdle();
    brandIdleTimer = window.setInterval(tickBrandIdle, 260);
  };

  const playBubblesIntro = () => {
    const bubbles = [
      document.querySelector(".bubble-image-1"),
      document.querySelector(".bubble-image-2"),
      document.querySelector(".bubble-image-3")
    ].filter(Boolean);
    bubbles.forEach((el, idx) => {
      const isMiddle = el.classList.contains("bubble-image-2");
      const baseY = isMiddle ? "-50%" : "0%";
      el.classList.add("is-enter-pop");
      el.animate(
        [
          {
            opacity: 0,
            transform: isMiddle
              ? `translateY(${baseY}) scale(0.78)`
              : "translateY(24px) scale(0.78)"
          },
          {
            opacity: 1,
            transform: isMiddle
              ? `translateY(${baseY}) scale(1.08)`
              : "translateY(-8px) scale(1.08)",
            offset: 0.72
          },
          {
            opacity: 1,
            transform: isMiddle
              ? `translateY(${baseY}) scale(1)`
              : "translateY(0) scale(1)"
          }
        ],
        {
          duration: 840,
          delay: idx * 240,
          easing: "cubic-bezier(0.2, 0.95, 0.24, 1)",
          fill: "both"
        }
      );
      window.setTimeout(() => el.classList.remove("is-enter-pop"), 1200 + idx * 240);
    });
  };

  const leaveHandlers = {
    hero: () => stopBrandIdle(),
    pageTwo: () => aboutPanelController?.onPageLeave?.(),
    pageThree: () => deploymentCounterController?.setIdleBlink?.(false)
  };

  const enterHandlers = {
    hero: (isFirst) => {
      if (isFirst) {
        playBrandIntroAnimation();
        stopBrandIdle();
        window.setTimeout(() => {
          startBrandIdle();
        }, 2000);
        return;
      }
      startBrandIdle();
    },
    pageTwo: (isFirst) => {
      if (isFirst) {
        aboutPanelController?.startPanelBoot?.();
        aboutPanelController?.startIdleCycle?.();
        return;
      }
      aboutPanelController?.startIdleCycle?.();
    },
    bubbles: (isFirst) => {
      if (isFirst) playBubblesIntro();
    },
    pageThree: async (isFirst) => {
      if (isFirst) {
        await deploymentCounterController?.playIntro?.();
        deploymentCounterController?.setIdleBlink?.(true);
        return;
      }
      deploymentCounterController?.setIdleBlink?.(true);
    }
  };

  const activeMap = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const target = sections.find((s) => s.el === entry.target);
        if (!target) return;
        const isActive = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        const wasActive = !!activeMap.get(target.key);
        activeMap.set(target.key, isActive);

        if (isActive && !wasActive) {
          const isFirst = !visited.has(target.key);
          visited.add(target.key);
          enterHandlers[target.key]?.(isFirst);
        } else if (!isActive && wasActive) {
          leaveHandlers[target.key]?.();
        }
      });
    },
    { threshold: [0.25, 0.55, 0.75] }
  );

  sections.forEach((section) => observer.observe(section.el));
};

const init = async () => {
  const startedAt = Date.now();
  const carousel = setupCarousel();
  const guySequence = setupGuySequence();
  const videos = carousel?.videos || [];

  const rightPanelController =
    rightPanel && !rightPanel.classList.contains("hero-panel-source")
      ? setupRightPanel()
      : null;
  setupPopupPlayer();
  setupTrackMessage();
  setupPopup2Collapsibles();
  setupContactForm();
  setupPopupGallery();
  setupNjClock();
  const deploymentCounterController = setupDeploymentCounter();
  setupVideoMosaicOverlay();
  setupBubbleResumeRedirect();
  setupPageThreeLinkToggle();
  setupBubblesAsteroidsBackdrop();
  setupMobileMediaSwap(videos);
  setupBrandLetterClicks();
  dvdScreensaverController = setupDvdScreensavers(document);
  const aboutPanelController = setupAboutPanelDuplicate();
  setupAboutPanelArrows(aboutPanelController);

  await Promise.all(videos.map(waitForVideo));
  finalizeLoad(startedAt, () => {
    rightPanelController?.startPanelBoot?.();
    carousel?.start();
    guySequence?.start?.();
    playBrandIntroAnimation();
    setupPageEntryMotion({
      aboutPanelController,
      deploymentCounterController
    });
  });
};

init();
