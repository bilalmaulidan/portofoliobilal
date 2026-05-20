/* ============================================================
   CANVAS — Cinematic Editorial Portfolio
   main.js — Parallax system, animations, audio player, interactions
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────────
   PARALLAX DEPTH SYSTEM
   
   7-layer depth architecture where each layer
   moves at a different scroll speed to create
   cinematic spatial depth.
   
   Speed reference:
     background grid : 0.03
     blobs (far)     : 0.05
     meshes (mid)    : 0.08
     geo (near)      : 0.15
   ───────────────────────────────────────────── */

const ParallaxSystem = (() => {
  const SPEEDS = {
    grid:   0.03,
    blob1:  0.04,
    blob2: -0.05, // negative = opposite direction
    blob3:  0.03,
    mesh1:  0.08,
    mesh2: -0.07,
    geo_circle: 0.12,
    geo_square: -0.15,
    geo_line1:  0.10,
    geo_line2: -0.09,
  };

  // Cached element references
  const els = {};
  let scrollY = 0;
  let ticking = false;
  const isMobile = () => window.innerWidth < 768;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cacheElements() {
    els.grid       = document.getElementById('bg-grid');
    els.blob1      = document.getElementById('blob-1');
    els.blob2      = document.getElementById('blob-2');
    els.blob3      = document.getElementById('blob-3');
    els.mesh1      = document.getElementById('mesh-1');
    els.mesh2      = document.getElementById('mesh-2');
    els.geoCircle  = document.getElementById('geo-circle');
    els.geoSquare  = document.getElementById('geo-square');
    els.geoLine1   = document.getElementById('geo-line1');
    els.geoLine2   = document.getElementById('geo-line2');
  }

  // Apply transform to element with specific parallax multiplier
  function applyParallax(el, speed, extraTransform = '') {
    if (!el) return;
    const offset = scrollY * speed;
    el.style.transform = `translateY(${offset}px) ${extraTransform}`;
  }

  function update() {
    if (prefersReducedMotion) return;

    const mobileMult = isMobile() ? 0.4 : 1; // reduce intensity on mobile

    applyParallax(els.grid, SPEEDS.grid * mobileMult);
    applyParallax(els.blob1, SPEEDS.blob1 * mobileMult);
    applyParallax(els.blob2, SPEEDS.blob2 * mobileMult);
    applyParallax(els.blob3, SPEEDS.blob3 * mobileMult);
    applyParallax(els.mesh1, SPEEDS.mesh1 * mobileMult);
    applyParallax(els.mesh2, SPEEDS.mesh2 * mobileMult);
    applyParallax(els.geoCircle, SPEEDS.geo_circle * mobileMult);
    applyParallax(els.geoSquare, SPEEDS.geo_square * mobileMult, 'rotate(15deg)');
    applyParallax(els.geoLine1, SPEEDS.geo_line1 * mobileMult);
    applyParallax(els.geoLine2, SPEEDS.geo_line2 * mobileMult);

    ticking = false;
  }

  // Fallback scroll listener for background structures if present in HTML in future
  function onScroll() {
    scrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  function init() {
    cacheElements();
    window.addEventListener('scroll', onScroll, { passive: true });
    update(); // Initial paint
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   REVEAL ON SCROLL SYSTEM
   
   IntersectionObserver watches .reveal elements
   and adds .visible class when they enter viewport.
   Stagger delays are applied via data-delay attr
   in CSS (transition-delay).
   ───────────────────────────────────────────── */

const RevealSystem = (() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    if (prefersReducedMotion) {
      // Skip observer — just make everything visible immediately
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target); // Observe once only
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px', // Trigger slightly before fully visible
      }
    );

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   SECTION DEPTH TRANSITIONS

   Adds scroll-based progress to each major section
   so sections feel like layered scenes entering the
   viewport instead of static blocks.
   ───────────────────────────────────────────── */

const SectionDepthSystem = (() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sections = [];
  let ticking = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateSection(section) {
    const rect = section.getBoundingClientRect();
    const viewportH = window.innerHeight || 1;
    const start = viewportH * 0.92;
    const end = viewportH * 0.2;
    const rawProgress = (start - rect.top) / (start - end);
    const progress = clamp(rawProgress, 0, 1);

    section.style.setProperty('--section-progress', progress.toFixed(3));
    section.classList.toggle('visible-depth', progress > 0.18);
  }

  function update() {
    sections.forEach(updateSection);
    ticking = false;
  }

  function requestUpdate() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  function init() {
    sections = Array.from(document.querySelectorAll('.section-depth'));
    if (!sections.length) return;

    if (prefersReducedMotion) {
      sections.forEach(section => {
        section.style.setProperty('--section-progress', '1');
        section.classList.add('visible-depth');
      });
      return;
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   NAVIGATION SYSTEM
   
   - Scroll state: adds .scrolled class for frosted effect
   - Mobile menu: hamburger toggle
   - Active link highlighting
   ───────────────────────────────────────────── */

const NavSystem = (() => {
  const nav = document.getElementById('nav');
  const menuBtn = document.getElementById('menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileLinks = document.querySelectorAll('.mobile-nav__link');
  let isMenuOpen = false;

  function updateScrollState() {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    mobileNav.classList.toggle('open', isMenuOpen);
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';

    // Animate hamburger to X
    const spans = menuBtn.querySelectorAll('span');
    if (isMenuOpen) {
      spans[0].style.transform = 'translateY(6px) rotate(45deg)';
      spans[1].style.transform = 'translateY(-6px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.transform = '';
    }
  }

  function closeMenu() {
    if (isMenuOpen) toggleMenu();
  }

  function init() {
    if (!nav) return;

    window.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState(); // Initial

    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);

    // Close mobile nav when a link is clicked
    mobileLinks.forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on backdrop click
    mobileNav?.addEventListener('click', (e) => {
      if (e.target === mobileNav) closeMenu();
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   CUSTOM CURSOR SYSTEM
   
   Dot + ring cursor for desktop.
   The ring follows the dot with slight delay,
   creating a cinematic lag effect.
   ───────────────────────────────────────────── */

const CursorSystem = (() => {
  const isTouch = 'ontouchstart' in window;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cursor, ring;
  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;

  function createCursor() {
    cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    ring = document.createElement('div');
    ring.className = 'custom-cursor-ring';
    document.body.append(cursor, ring);
  }

  function animateRing() {
    // Smooth lag for ring following dot
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;

    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';

    requestAnimationFrame(animateRing);
  }

  function init() {
    if (isTouch || prefersReducedMotion) return;

    createCursor();

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
    });

    // Expand ring on interactive elements
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button, .podcast-progress')) {
        ring.style.width = '56px';
        ring.style.height = '56px';
        ring.style.borderColor = 'rgba(77,124,255,0.8)';
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('a, button, .podcast-progress')) {
        ring.style.width = '';
        ring.style.height = '';
        ring.style.borderColor = '';
      }
    });

    animateRing();
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   PODCAST AUDIO PLAYER
   
   Custom HTML5 audio player with:
   - Play/Pause toggle
   - Progress bar (click to seek)
   - Time display update
   - Rewind/Forward ±15s
   ───────────────────────────────────────────── */

const PodcastPlayer = (() => {
  let audio, btnPlay, btnRewind, btnForward, progressFill, progressBar, durationDisplay;
  let isPlaying = false;

  function formatTime(secs) {
    if (!isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function setPlayState(playing) {
    isPlaying = playing;
    const iconPlay  = btnPlay.querySelector('.icon-play');
    const iconPause = btnPlay.querySelector('.icon-pause');
    if (iconPlay && iconPause) {
      iconPlay.style.display  = playing ? 'none' : '';
      iconPause.style.display = playing ? '' : 'none';
    }

    // Animate waveform when playing
    const waveSpans = document.querySelectorAll('.podcast-waveform span');
    waveSpans.forEach(span => {
      span.style.animationPlayState = playing ? 'running' : 'paused';
    });
  }

  function updateProgress() {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + '%';
    progressBar.setAttribute('aria-valuenow', Math.round(pct));

    // Update time display
    if (durationDisplay) {
      durationDisplay.textContent =
        `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  }

  function seek(e) {
    if (!audio.duration) return;
    const rect = progressBar.querySelector('.podcast-progress__track').getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    updateProgress();
  }

  function init() {
    audio = document.getElementById('podcast-audio');
    btnPlay = document.getElementById('btn-play');
    btnRewind = document.getElementById('btn-rewind');
    btnForward = document.getElementById('btn-forward');
    progressFill = document.getElementById('progress-fill');
    progressBar = document.getElementById('podcast-progress');
    durationDisplay = document.querySelector('.podcast-player__duration');

    if (!audio || !btnPlay) return;

    // Play / Pause
    btnPlay.addEventListener('click', () => {
      if (isPlaying) {
        audio.pause();
        setPlayState(false);
      } else {
        audio.play().catch(() => {}); // Ignore autoplay policy errors
        setPlayState(true);
      }
    });

    // Rewind 15s
    btnRewind?.addEventListener('click', () => {
      audio.currentTime = Math.max(0, audio.currentTime - 15);
      updateProgress();
    });

    // Forward 15s
    btnForward?.addEventListener('click', () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
      updateProgress();
    });

    // Progress updates
    audio.addEventListener('timeupdate', updateProgress);

    // Ended state
    audio.addEventListener('ended', () => {
      setPlayState(false);
      audio.currentTime = 0;
      updateProgress();
    });

    // Seek on progress bar click
    progressBar?.addEventListener('click', seek);

    // Load metadata for initial duration display
    audio.addEventListener('loadedmetadata', updateProgress);

    // Initialise waveform as paused
    document.querySelectorAll('.podcast-waveform span').forEach(s => {
      s.style.animationPlayState = 'paused';
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   MEDIA PLACEHOLDER VISIBILITY
   
   Shows placeholder divs when images have
   placeholder/missing src. Hides them when
   real images load successfully.
   ───────────────────────────────────────────── */

const PlaceholderSystem = (() => {
  function init() {
    // Handle portrait infographic
    const infographicImg = document.querySelector('.media-img--portrait');
    const infographicPlaceholder = document.querySelector('.media-placeholder--portrait');

    if (infographicImg && infographicPlaceholder) {
      infographicImg.addEventListener('load', () => {
        infographicPlaceholder.style.display = 'none';
        infographicImg.style.display = 'block';
      });
      infographicImg.addEventListener('error', () => {
        infographicImg.style.display = 'none';
        infographicPlaceholder.style.display = 'flex';
      });
      // Trigger check if already loaded (cached)
      if (infographicImg.complete && infographicImg.naturalHeight !== 0) {
        infographicPlaceholder.style.display = 'none';
      } else if (infographicImg.complete) {
        infographicImg.style.display = 'none';
      }
    }

    // Handle landscape poster
    const posterImg = document.querySelector('.media-img--landscape');
    const posterPlaceholder = document.querySelector('.media-placeholder--landscape');

    if (posterImg && posterPlaceholder) {
      posterImg.addEventListener('load', () => {
        posterPlaceholder.style.display = 'none';
        posterImg.style.display = 'block';
      });
      posterImg.addEventListener('error', () => {
        posterImg.style.display = 'none';
        posterPlaceholder.style.display = 'flex';
      });
      if (posterImg.complete && posterImg.naturalHeight !== 0) {
        posterPlaceholder.style.display = 'none';
      } else if (posterImg.complete) {
        posterImg.style.display = 'none';
      }
    }

    // Podcast cover placeholder
    const podcastImg = document.querySelector('.podcast-cover__img');
    const podcastPlaceholder = document.querySelector('.podcast-cover__placeholder');

    if (podcastImg && podcastPlaceholder) {
      podcastImg.addEventListener('load', () => {
        podcastPlaceholder.style.display = 'none';
      });
      podcastImg.addEventListener('error', () => {
        podcastImg.style.display = 'none';
        podcastPlaceholder.style.display = 'flex';
      });
      if (podcastImg.complete && podcastImg.naturalHeight !== 0) {
        podcastPlaceholder.style.display = 'none';
      } else if (podcastImg.complete) {
        podcastImg.style.display = 'none';
      }
    }
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   FULLSCREEN — Genially Game
   ───────────────────────────────────────────── */

const FullscreenSystem = (() => {
  function init() {
    const btn = document.getElementById('btn-fullscreen');
    const iframe = document.getElementById('genially-embed');

    if (!btn || !iframe) return;

    btn.addEventListener('click', () => {
      const target = iframe.parentElement; // The media frame wrapper

      if (!document.fullscreenElement) {
        target.requestFullscreen?.().catch(() => {
          // Fallback: try the iframe directly
          iframe.requestFullscreen?.();
        });
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   SMOOTH ACTIVE NAV LINKS
   
   Highlights nav links based on which section
   is currently in view using IntersectionObserver.
   ───────────────────────────────────────────── */

const ActiveNavSystem = (() => {
  function init() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');

    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach(link => {
              const href = link.getAttribute('href');
              link.style.color = href === `#${id}` ? 'var(--text)' : '';
            });
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '-20% 0px -60% 0px',
      }
    );

    sections.forEach(s => observer.observe(s));
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   FLOATING BLOB AMBIENT ANIMATION
   
   In addition to scroll parallax, the blobs
   independently float using CSS-like keyframe
   animation driven by JS for smooth atmospheric
   ambient movement when the user is not scrolling.
   ───────────────────────────────────────────── */

const AmbientAnimation = (() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let startTime = null;

  // Sine wave oscillation for a given blob
  function oscillate(t, period, amp) {
    return Math.sin((t / period) * Math.PI * 2) * amp;
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const t = (timestamp - startTime) / 1000; // seconds elapsed

    const blob1 = document.getElementById('blob-1');
    const blob2 = document.getElementById('blob-2');
    const blob3 = document.getElementById('blob-3');

    // Each blob drifts in a gentle figure-8-like path
    if (blob1) {
      const existingY = window.scrollY * 0.04;
      const driftX = oscillate(t, 8, 20);
      const driftY = oscillate(t, 11, 15);
      blob1.style.transform = `translate(${driftX}px, ${existingY + driftY}px)`;
    }

    if (blob2) {
      const existingY = window.scrollY * -0.05;
      const driftX = oscillate(t, 10, -18);
      const driftY = oscillate(t, 13, 20);
      blob2.style.transform = `translate(${driftX}px, ${existingY + driftY}px)`;
    }

    if (blob3) {
      const existingY = window.scrollY * 0.03;
      const driftX = oscillate(t, 12, 12);
      const driftY = oscillate(t, 9, -10);
      blob3.style.transform = `translate(${driftX}px, ${existingY + driftY}px)`;
    }

    requestAnimationFrame(animate);
  }

  function init() {
    if (prefersReducedMotion) return;
    requestAnimationFrame(animate);
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   HERO PARALLAX — Content within hero
   
   The hero's large decorative number drifts
   subtly as you scroll past, creating depth.
   ───────────────────────────────────────────── */

const HeroContentParallax = (() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    if (prefersReducedMotion) return;

    const heroNum = document.querySelector('.hero__number');
    if (!heroNum) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          const heroH = document.querySelector('.hero')?.offsetHeight || window.innerHeight;
          if (y < heroH) {
            const progress = y / heroH;
            heroNum.style.transform = `translateY(calc(-50% + ${progress * 80}px))`;
            heroNum.style.opacity = Math.max(0, 1 - progress * 2);
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  return { init };
})();


/* ─────────────────────────────────────────────
   INIT — Orchestrate all systems on DOM ready
   ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  ParallaxSystem.init();
  RevealSystem.init();
  SectionDepthSystem.init();
  NavSystem.init();
  CursorSystem.init();
  PodcastPlayer.init();
  PlaceholderSystem.init();
  FullscreenSystem.init();
  ActiveNavSystem.init();
  AmbientAnimation.init();
  HeroContentParallax.init();

  console.log('%cCANVAS — Creative Portfolio', 'color: #4D7CFF; font-weight: bold; font-size: 14px;');
  console.log('%cCinematic Editorial Portfolio System initialized.', 'color: #A1A1AA; font-size: 12px;');
});


/* ============================================================
   OLD PARALLAX CODE DEPRECATED
   Note: Parallax logic for .portrait, .planet, and .collage
   has been moved to parallax.js for smooth LERP interpolation
   and hardware GPU acceleration.
   ============================================================ */
