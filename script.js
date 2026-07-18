/* ═══════════════════════════════════════════════════════════════
   هشت سال با تو — script.js
   بدون هیچ فریم‌ورکی، فقط جاوااسکریپت خالص.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  /* ─────────────────────────────────────────────
     تنظیمات قابل‌تغییر
     هرچیزی که ممکنه بخوای دستی عوض کنی، همینجاست.
     ───────────────────────────────────────────── */
  const CONFIG = {
    redirectUrl: "https://example.com",   // لینک دکمه‌ی پایانی
    reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    petals: {
      desktopCount: 70,
      mobileCount: 34,
      burstMultiplier: 2.2,      // تعداد گلبرگ در لحظه‌ی باز شدن سایت
      colors: ["#f3b6c9", "#fdfaf5", "#e8919c", "#c9a0dc", "#f7c9a0", "#f2a679"]
    },
    introDelay: 850,             // مکث تاریک قبل از شروع
    introDuration: 3200,         // مدت گذار سینمایی اولیه
    introTargetProgress: 0.16    // چقدر از مسیر رنگ در همون ابتدا طی بشه
  };

  /* ─────────────────────────────────────────────
     ابزارهای کمکی
     ───────────────────────────────────────────── */
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const mixRGB = (c1, c2, t) => [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ];
  const isMobile = () => window.innerWidth < 720;

  /* ═══════════════════════════════════════════════
     ۱) پس‌زمینه‌ی سینمایی — درون‌یابی رنگ بر اساس پیشرفت
     مشکی → بنفش ملایم → صورتی → رزگلد → کرم گرم
     ═══════════════════════════════════════════════ */
  const COLOR_STOPS = [
    { p: 0.00, bgA: [11, 7, 20],    bgB: [21, 12, 34],   fg: [245, 238, 255], fgSoft: [205, 192, 222] },
    { p: 0.26, bgA: [37, 22, 62],   bgB: [63, 38, 94],   fg: [248, 235, 248], fgSoft: [214, 195, 224] },
    { p: 0.50, bgA: [107, 55, 92],  bgB: [163, 88, 121], fg: [255, 244, 248], fgSoft: [255, 222, 232] },
    { p: 0.74, bgA: [176, 111, 92], bgB: [201, 145, 110],fg: [253, 240, 224], fgSoft: [255, 232, 210] },
    { p: 1.00, bgA: [244, 227, 203],bgB: [253, 246, 236],fg: [44, 24, 16],    fgSoft: [107, 83, 68] }
  ];

  function colorAtProgress(progress) {
    const p = clamp(progress, 0, 1);
    let i = 0;
    while (i < COLOR_STOPS.length - 2 && p > COLOR_STOPS[i + 1].p) i++;
    const a = COLOR_STOPS[i];
    const b = COLOR_STOPS[i + 1];
    const span = b.p - a.p || 1;
    const t = easeInOutCubic(clamp((p - a.p) / span, 0, 1));
    return {
      bgA: mixRGB(a.bgA, b.bgA, t),
      bgB: mixRGB(a.bgB, b.bgB, t),
      fg: mixRGB(a.fg, b.fg, t),
      fgSoft: mixRGB(a.fgSoft, b.fgSoft, t)
    };
  }

  const root = document.documentElement;
  function applyProgress(progress) {
    const c = colorAtProgress(progress);
    root.style.setProperty("--bg-a", c.bgA.join(","));
    root.style.setProperty("--bg-b", c.bgB.join(","));
    root.style.setProperty("--fg", c.fg.join(","));
    root.style.setProperty("--fg-soft", c.fgSoft.join(","));
  }

  let sceneProgress = 0;      // پیشرفت کلی صحنه (۰ تا ۱)
  let introDone = false;
  let introStartTime = null;

  function getScrollFraction() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return clamp(window.scrollY / max, 0, 1);
  }

  function updateSceneFromScroll() {
    if (!introDone) return;
    const scrollFrac = getScrollFraction();
    sceneProgress = CONFIG.introTargetProgress +
      (1 - CONFIG.introTargetProgress) * scrollFrac;
    applyProgress(sceneProgress);
    updateProgressRail(scrollFrac);
    updateParallax(scrollFrac);
  }

  const progressFillEl = document.getElementById("progressFill");
  function updateProgressRail(scrollFrac) {
    if (progressFillEl) progressFillEl.style.width = (scrollFrac * 100).toFixed(2) + "%";
  }

  /* گذار سینمایی اولیه — مستقل از اسکرول */
  function runIntroSequence(timestamp) {
    if (introStartTime === null) introStartTime = timestamp;
    const elapsed = timestamp - introStartTime - CONFIG.introDelay;

    if (elapsed < 0) {
      applyProgress(0);
      requestAnimationFrame(runIntroSequence);
      return;
    }
    const t = clamp(elapsed / CONFIG.introDuration, 0, 1);
    sceneProgress = easeInOutCubic(t) * CONFIG.introTargetProgress;
    applyProgress(sceneProgress);

    if (t < 1) {
      requestAnimationFrame(runIntroSequence);
    } else {
      introDone = true;
      revealHero();
      updateSceneFromScroll();
    }
  }

  /* ═══════════════════════════════════════════════
     ۲) گلبرگ‌های شناور — روی کانواس
     ═══════════════════════════════════════════════ */
  const canvas = document.getElementById("petal-canvas");
  const ctx = canvas.getContext("2d");
  let petals = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePetal(burst) {
    const size = lerp(9, 20, Math.random());
    return {
      x: Math.random() * window.innerWidth,
      y: burst ? Math.random() * -window.innerHeight * 0.4 : Math.random() * window.innerHeight,
      size,
      color: CONFIG.petals.colors[(Math.random() * CONFIG.petals.colors.length) | 0],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: lerp(-0.02, 0.02, Math.random()),
      flipPhase: Math.random() * Math.PI * 2,
      flipSpeed: lerp(0.015, 0.045, Math.random()),
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: lerp(0.006, 0.018, Math.random()),
      swayAmount: lerp(18, 46, Math.random()),
      speedY: lerp(0.35, 1.1, Math.random()) * (size / 14),
      opacity: lerp(0.55, 0.95, Math.random())
    };
  }

  function initPetals() {
    const base = isMobile() ? CONFIG.petals.mobileCount : CONFIG.petals.desktopCount;
    const total = Math.round(base * CONFIG.petals.burstMultiplier);
    petals = Array.from({ length: total }, () => makePetal(true));
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const flip = Math.cos(p.flipPhase);       // شبیه‌سازی چرخش سه‌بعدی
    ctx.scale(flip, 1);
    ctx.globalAlpha = p.opacity;
    ctx.shadowColor = "rgba(30,10,20,0.25)";
    ctx.shadowBlur = 6;

    const s = p.size;
    const grad = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, "rgba(255,255,255,0.35)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.bezierCurveTo(s / 2, -s / 2, s / 2, s / 3, 0, s / 2);
    ctx.bezierCurveTo(-s / 2, s / 3, -s / 2, -s / 2, 0, -s / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  let petalCanvasOpacity = 1;
  function updatePetals() {
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    for (const p of petals) {
      p.rot += p.rotSpeed;
      p.flipPhase += p.flipSpeed;
      p.swayPhase += p.swaySpeed;
      p.y += p.speedY;
      p.x += Math.sin(p.swayPhase) * (p.swayAmount / 300);

      if (p.y - p.size > h) {
        p.y = -p.size * 2;
        p.x = Math.random() * w;
      }
      drawPetal(p);
    }
  }

  function petalLoop() {
    if (!CONFIG.reduceMotion) {
      canvas.style.opacity = petalCanvasOpacity.toFixed(2);
      updatePetals();
    }
    requestAnimationFrame(petalLoop);
  }

  function updateParallax(scrollFrac) {
    // گلبرگ‌ها بعد از هیرو کم‌رنگ می‌شوند اما کاملاً محو نمی‌شوند
    const heroFrac = clamp(window.scrollY / (window.innerHeight * 0.9), 0, 1);
    petalCanvasOpacity = lerp(1, 0.16, heroFrac);
  }

  /* ═══════════════════════════════════════════════
     ۳) ظاهر شدن عناصر هنگام اسکرول
     ═══════════════════════════════════════════════ */
  function revealHero() {
    document.querySelectorAll(".hero .reveal-item, .hero .reveal-line").forEach(el => {
      const delay = Number(el.dataset.delay || 0) * 260;
      setTimeout(() => el.classList.add("is-visible"), delay);
    });
  }

  function setupScrollReveal() {
    const targets = document.querySelectorAll("[data-reveal]");
    const groups = new Map();
    targets.forEach(el => {
      const parent = el.closest("section");
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach(list => {
      list.forEach((el, i) => { el.style.transitionDelay = (i * 0.12) + "s"; });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });

    targets.forEach(el => io.observe(el));

    // کارت‌های گالری هم با همین منطق استگرد بشوند
    document.querySelectorAll(".frame").forEach((el, i) => {
      el.style.transitionDelay = (i * 0.08) + "s";
    });
  }

  /* ═══════════════════════════════════════════════
     ۴) گالری — کج‌شدن سه‌بعدی با موس + لایتباکس
     ═══════════════════════════════════════════════ */
  function setupGalleryTilt() {
    document.querySelectorAll(".frame").forEach(frame => {
      frame.addEventListener("mousemove", (e) => {
        const rect = frame.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rotY = (px - 0.5) * 14;
        const rotX = (0.5 - py) * 14;
        frame.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        frame.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        frame.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      });
      frame.addEventListener("mouseleave", () => {
        frame.style.transform = "";
      });
    });
  }

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxStage = document.getElementById("lightboxStage");
  const lightboxParticlesCanvas = document.getElementById("lightboxParticles");
  const pctx = lightboxParticlesCanvas.getContext("2d");

  function openLightbox(frame) {
    const img = frame.querySelector("img");
    const caption = frame.dataset.caption || "";
    const isEmpty = frame.classList.contains("frame--empty");

    lightbox.classList.toggle("is-empty", isEmpty);
    lightboxImg.src = isEmpty ? "" : img.src;
    lightboxImg.alt = caption;
    lightboxCaption.textContent = caption;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    burstParticles();
  }
  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll(".frame").forEach(frame => {
    frame.addEventListener("click", () => openLightbox(frame));
  });
  document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  lightboxStage.addEventListener("mousemove", (e) => {
    const rect = lightboxStage.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    lightboxStage.style.transform = `scale(1) rotateX(${(-py * 10).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg)`;
  });
  lightboxStage.addEventListener("mouseleave", () => {
    lightboxStage.style.transform = "scale(1) rotateX(0deg) rotateY(0deg)";
  });

  function resizeParticleCanvas() {
    const rect = lightboxStage.getBoundingClientRect();
    lightboxParticlesCanvas.width = rect.width * dpr;
    lightboxParticlesCanvas.height = rect.height * dpr;
    lightboxParticlesCanvas.style.width = rect.width + "px";
    lightboxParticlesCanvas.style.height = rect.height + "px";
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burstParticles() {
    if (CONFIG.reduceMotion) return;
    resizeParticleCanvas();
    const rect = lightboxStage.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const count = 26;
    const parts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = lerp(0.6, 2.4, Math.random());
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: lerp(2, 5, Math.random()),
        color: CONFIG.petals.colors[(Math.random() * CONFIG.petals.colors.length) | 0]
      };
    });

    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      pctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;
      parts.forEach(pt => {
        if (pt.life <= 0) return;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.015;
        pt.life -= 0.012;
        if (pt.life > 0) {
          alive = true;
          pctx.globalAlpha = clamp(pt.life, 0, 1);
          pctx.fillStyle = pt.color;
          pctx.beginPath();
          pctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          pctx.fill();
        }
      });
      pctx.globalAlpha = 1;
      if (alive && elapsed < 1600) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ═══════════════════════════════════════════════
     ۵) پاکت نامه
     ═══════════════════════════════════════════════ */
  function setupEnvelope() {
    const envelope = document.getElementById("envelope");
    const lines = envelope.querySelectorAll(".paper__line");
    lines.forEach((line, i) => line.style.setProperty("--i", i));

    function toggle() {
      envelope.classList.toggle("is-open");
    }
    envelope.addEventListener("click", toggle);
    envelope.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }

  /* ═══════════════════════════════════════════════
     ۶) دکمه‌ی مغناطیسی پایانی
     ═══════════════════════════════════════════════ */
  function setupMagneticButton() {
    const zone = document.getElementById("magneticZone");
    const btn = document.getElementById("magneticBtn");
    const maxPull = 18;

    zone.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clamp((e.clientX - cx) / (rect.width * 1.4), -1, 1);
      const dy = clamp((e.clientY - cy) / (rect.height * 1.6), -1, 1);
      btn.style.transform = `translate(${dx * maxPull}px, ${dy * maxPull}px)`;
    });
    zone.addEventListener("mouseleave", () => {
      btn.style.transform = "translate(0,0)";
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      btn.classList.add("is-pressed");
      setTimeout(() => {
        window.location.href = btn.dataset.href || CONFIG.redirectUrl;
      }, 380);
    });
  }

  /* ─────────────────────────────────────────────
     پیمایش نرم از طریق نشانگر اسکرول در هیرو
     ───────────────────────────────────────────── */
  function setupScrollCue() {
    const cue = document.getElementById("scrollCue");
    cue.addEventListener("click", () => {
      document.getElementById("gallery").scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ═══════════════════════════════════════════════
     اجرای اصلی
     ═══════════════════════════════════════════════ */
  function onScroll() {
    updateSceneFromScroll();
  }

  function init() {
    resizeCanvas();
    initPetals();
    applyProgress(0);

    setupScrollReveal();
    setupGalleryTilt();
    setupEnvelope();
    setupMagneticButton();
    setupScrollCue();

    window.addEventListener("resize", () => {
      resizeCanvas();
      initPetals();
    }, { passive: true });

    window.addEventListener("scroll", onScroll, { passive: true });

    requestAnimationFrame(petalLoop);
    requestAnimationFrame(runIntroSequence);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();