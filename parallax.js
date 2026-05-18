/* ============================================================
   PORTFOLIO — Cinematic Parallax Engine
   parallax.js — Smooth scroll LERP and dynamic space starfield
   ============================================================ */

'use strict';

const CinematicParallax = (() => {
  // Config and system states
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  let targetScrollY = window.scrollY;
  let currentScrollY = window.scrollY;
  let isRunning = false;

  // Cinematic Damping factor (lower = smoother/more lag; 1.0 = instant)
  // On mobile/touch devices, we set easing to 1.0 to avoid interfering with native momentum scroll
  const LERP_EASE = isTouchDevice ? 1.0 : 0.08;

  // Mouse tracking for interactive starfield drift
  let targetMouse = { x: 0, y: 0 };
  let currentMouse = { x: 0, y: 0 };
  const MOUSE_EASE = 0.05; // Smooth lag for mouse interaction

  // Particle Starfield configuration
  let canvas = null;
  let ctx = null;
  let stars = [];
  const STAR_COUNT = isTouchDevice ? 40 : 120; // Reduced for performance on mobile

  // Parallax elements cache
  let parallaxElements = [];

  // ─────────────────────────────────────────────
  // 1. STARFIELD CLASS & SYSTEM
  // ─────────────────────────────────────────────
  class Star {
    constructor(canvasWidth, canvasHeight) {
      this.reset(canvasWidth, canvasHeight, true);
    }

    reset(width, height, initialRandomY = false) {
      this.x = Math.random() * width;
      // Distribute stars initially over screen, otherwise spawn only at bottom/top edges when wrapping
      this.y = initialRandomY ? Math.random() * height : (Math.random() > 0.5 ? -10 : height + 10);
      
      // Determine depth tier (1: Far, 2: Mid, 3: Near)
      const rand = Math.random();
      if (rand < 0.6) {
        // Far stars (small, dim, slow)
        this.size = Math.random() * 0.8 + 0.4;
        this.baseOpacity = Math.random() * 0.25 + 0.15;
        this.parallaxSpeed = 0.04;
        this.mouseSpeed = 8;
      } else if (rand < 0.9) {
        // Mid stars (medium, mid-brightness, medium speed)
        this.size = Math.random() * 1.0 + 0.8;
        this.baseOpacity = Math.random() * 0.4 + 0.35;
        this.parallaxSpeed = 0.12;
        this.mouseSpeed = 16;
      } else {
        // Near stars (larger, bright, fast)
        this.size = Math.random() * 1.2 + 1.6;
        this.baseOpacity = Math.random() * 0.3 + 0.65;
        this.parallaxSpeed = 0.28;
        this.mouseSpeed = 28;
        // Add a gentle twinkling pulse
        this.twinkleSpeed = Math.random() * 0.02 + 0.005;
        this.twinklePhase = Math.random() * Math.PI;
      }
      
      this.opacity = this.baseOpacity;
    }

    update(width, height, scrollDiff, elapsed) {
      // Modify opacity slightly if twinkle is defined
      if (this.twinkleSpeed) {
        this.twinklePhase += this.twinkleSpeed;
        this.opacity = this.baseOpacity + Math.sin(this.twinklePhase) * 0.2;
      }

      // Parallax mouse drift offset calculation
      const driftX = currentMouse.x * this.mouseSpeed;
      const driftY = currentMouse.y * this.mouseSpeed;

      // Draw star
      ctx.beginPath();
      // Apply parallax scrolling effect + mouse drift
      // The scroll offset wraps seamlessly using modulo with screen height
      let renderY = (this.y - (currentScrollY * this.parallaxSpeed) + driftY) % height;
      if (renderY < 0) renderY += height;

      let renderX = (this.x + driftX) % width;
      if (renderX < 0) renderX += width;

      ctx.arc(renderX, renderY, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, Math.min(1.0, this.opacity))})`;
      ctx.fill();
    }
  }

  function initStarfield() {
    canvas = document.getElementById('space-stars');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    // Spawn initial stars
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push(new Star(canvas.width, canvas.height));
    }

    window.addEventListener('resize', resizeCanvas);
    
    // Track mouse coordinates centered around screen origin (-0.5 to 0.5)
    if (!isTouchDevice) {
      window.addEventListener('mousemove', (e) => {
        targetMouse.x = (e.clientX / window.innerWidth) - 0.5;
        targetMouse.y = (e.clientY / window.innerHeight) - 0.5;
      });

      // Reset drift smoothly on mouseout
      document.addEventListener('mouseleave', () => {
        targetMouse.x = 0;
        targetMouse.y = 0;
      });
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ─────────────────────────────────────────────
  // 2. PARALLAX ELEMENTS CACHING & MATHS
  // ─────────────────────────────────────────────
  function cacheParallaxElements() {
    const els = document.querySelectorAll('.parallax-el, .parallax-fade-el');
    
    // Save current transforms and temporarily clear them to get pure layout offsets
    const savedTransforms = [];
    els.forEach(el => {
      savedTransforms.push(el.style.transform);
      el.style.transform = 'none';
    });

    parallaxElements = Array.from(els).map((el, index) => {
      // Get base layout offsets so we can trigger will-change only when in/near viewport
      const rect = el.getBoundingClientRect();
      const initialTop = rect.top + window.scrollY;
      const height = rect.height;

      // Restore transform immediately so it doesn't cause a visual flash
      el.style.transform = savedTransforms[index];

      // Extract details from data-attributes
      const speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.1;
      const direction = el.getAttribute('data-parallax-direction') || 'vertical';
      const rotateIntensity = parseFloat(el.getAttribute('data-parallax-rotate')) || 0;
      const scaleDrift = parseFloat(el.getAttribute('data-parallax-scale')) || 0;
      const enableFade = el.classList.contains('parallax-fade-el') || el.hasAttribute('data-parallax-fade');
      const isPortrait = el.classList.contains('portrait');
      const isPlanet = el.classList.contains('planet');
      
      return {
        el,
        initialTop,
        height,
        speed,
        direction,
        rotateIntensity,
        scaleDrift,
        enableFade,
        isPortrait,
        isPlanet
      };
    });
  }

  function updateParallaxElements() {
    const viewTop = currentScrollY;
    const viewBottom = viewTop + window.innerHeight;
    const t = performance.now() / 1000; // Get current time in seconds

    parallaxElements.forEach((item, index) => {
      // Calculate intersection: only update elements that are near viewport
      const threshold = 150; // extra boundary pixels
      const elTop = item.initialTop;
      const elBottom = elTop + item.height;

      if (elBottom + threshold >= viewTop && elTop - threshold <= viewBottom) {
        // Calculate scroll displacement relative to element's initial position
        // Center displacement makes items float symmetrically when they pass the center of viewport
        const centerOffset = elTop - (viewTop + window.innerHeight / 2) + item.height / 2;
        const drift = centerOffset * item.speed;

        let transformStr = '';
        
        const isCollage = item.el.classList.contains('collage');
        
        // Handle specialized elements with absolute offsets or general transforms
        if (item.isPortrait) {
          // Portrait: moves slowly, scales slightly, shifts X
          const driftX = centerOffset * 0.015;
          const scale = 1 + Math.abs(centerOffset) * 0.0001;
          transformStr = `translate3d(${driftX}px, ${drift}px, 0) scale(${scale})`;
        } else if (item.isPlanet) {
          // Planet: moves faster, scales, floats horizontally, rotates
          const driftX = centerOffset * -0.07;
          const scale = 1 + Math.abs(centerOffset) * 0.0003;
          const rotation = centerOffset * 0.015;
          transformStr = `translate3d(${driftX}px, ${drift}px, 0) scale(${scale}) rotate(${rotation}deg)`;
        } else if (isCollage) {
          // Collage images: add a gentle ambient floating sway + mouse movement for 3D depth
          // Unique frequencies and amplitudes based on index to create organic, asynchronous motion
          const freqX = 0.5 + (index % 3) * 0.15;
          const freqY = 0.6 + (index % 4) * 0.1;
          const ampX = 12 + (index % 3) * 6;
          const ampY = 15 + (index % 4) * 5;
          
          const ambientX = Math.sin(t * freqX) * ampX;
          const ambientY = Math.cos(t * freqY) * ampY;
          
          // Mouse reaction drift: foreground elements drift more, background drifts less
          const speedFactor = Math.abs(item.speed);
          const mouseDriftX = currentMouse.x * speedFactor * 120;
          const mouseDriftY = currentMouse.y * speedFactor * 120;
          
          const translateY = drift + ambientY + mouseDriftY;
          const translateX = ambientX + mouseDriftX;
          
          const rotateSpeed = item.rotateIntensity || 0.01;
          const ambientRotate = Math.sin(t * 0.4 + index) * 3; // ambient rotation sway (degrees)
          const scrollRotate = centerOffset * rotateSpeed;
          const rotation = scrollRotate + ambientRotate;
          
          // Apply transform with scaling to prevent empty gaps during scroll (1.03)
          const scale = 1.03; 
          
          transformStr = `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotation}deg) scale(${scale})`;
        } else {
          // Standard elements
          const translateY = item.direction === 'horizontal' ? 0 : drift;
          const translateX = item.direction === 'vertical' ? 0 : drift;
          
          transformStr = `translate3d(${translateX}px, ${translateY}px, 0)`;

          if (item.scaleDrift) {
            const scale = 1 + Math.abs(centerOffset) * item.scaleDrift;
            transformStr += ` scale(${scale})`;
          }

          if (item.rotateIntensity) {
            const rotation = centerOffset * item.rotateIntensity;
            transformStr += ` rotate(${rotation}deg)`;
          }
        }

        // Apply transformations smoothly on GPU
        item.el.style.transform = transformStr;

        // Apply dynamic cinematic fading out based on viewport distance
        if (item.enableFade) {
          const relativeScroll = Math.abs(centerOffset) / (window.innerHeight / 1.5);
          const opacity = Math.max(0, Math.min(1, 1.2 - relativeScroll));
          item.el.style.opacity = opacity;
        }
      }
    });
  }

  // ─────────────────────────────────────────────
  // 3. CORE LERP INTERPOLATION LOOP
  // ─────────────────────────────────────────────
  function tick(timestamp) {
    if (prefersReducedMotion) return;

    // 1. Smoothly interpolate Scroll (LERP)
    const scrollDelta = targetScrollY - currentScrollY;
    if (Math.abs(scrollDelta) > 0.05) {
      currentScrollY += scrollDelta * LERP_EASE;
    } else {
      currentScrollY = targetScrollY;
    }

    // 2. Smoothly interpolate Mouse positions (LERP)
    if (!isTouchDevice) {
      currentMouse.x += (targetMouse.x - currentMouse.x) * MOUSE_EASE;
      currentMouse.y += (targetMouse.y - currentMouse.y) * MOUSE_EASE;
    }

    // 3. Render Particle Starfield
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = timestamp;
      stars.forEach(star => star.update(canvas.width, canvas.height, scrollDelta, elapsed));
    }

    // 4. Update Parallax Elements
    updateParallaxElements();

    // Loop
    requestAnimationFrame(tick);
  }

  function onScroll() {
    targetScrollY = window.scrollY;
  }

  // ─────────────────────────────────────────────
  // 4. SYSTEM INITIALIZATION
  // ─────────────────────────────────────────────
  function init() {
    if (prefersReducedMotion) {
      console.log('Parallax System: Reduced motion preferred. System disabled.');
      return;
    }

    // Setup Canvas Particle Starfield
    initStarfield();

    // Cache elements to avoid DOM thrashing during animation loop
    cacheParallaxElements();

    // Re-cache element offsets on window resize and image loads to avoid layout shifts
    window.addEventListener('resize', () => {
      cacheParallaxElements();
    });
    
    // Listen for image loads to re-cache correct geometry
    window.addEventListener('load', () => {
      cacheParallaxElements();
    });

    // Listen to window scroll events
    window.addEventListener('scroll', onScroll, { passive: true });

    // Launch central animation loop
    requestAnimationFrame(tick);

    console.log('%cCinematic Smooth Parallax Engine Active.', 'color: #00FFB2; font-weight: bold;');
  }

  return {
    init,
    recalculate: cacheParallaxElements
  };
})();

// Initialize on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  CinematicParallax.init();
});
