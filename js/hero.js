/* Hero scene: mask -> hover -> fall.
   The fall is a real time-based animation (not scrubbed frame-by-frame by the wheel):
   the first scroll gesture down plays frames 61-95 at a steady 24 fps, then the page
   glides to the next chapter. Coming back to the top rewinds him to the hover, and the
   next gesture plays the fall again. Frames come from tools/upscale.py (Real-ESRGAN x4). */
(function () {
  const HERO = {
    path: { desktop: "assets/hero/frames/desktop/", mobile: "assets/hero/frames/mobile/" },
    ext: "webp",
    count: 95,
    maskStart: 1, maskEnd: 60,   // he pulls the mask on and lifts his head
    holdFrame: 60,               // mask on, eyes to camera
    jumpStart: 61, jumpEnd: 95,  // camera pulls back, he dives between towers
    maskMs: 2000,                // the scroll lock during the mask never exceeds this
    fallFps: 24,                 // 35 frames -> ~1.5 s
    rewindMs: 650,
    glideMs: 900,                // scroll from the hero to the next chapter after the fall
    focusX: .5, focusY: .44,
    slowAfterMs: 6000            // desktop set still loading by then -> light set
  };

  const S = window.Site;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  S.initHero = function () {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const stage = hero.querySelector(".hero__sticky");
    const canvas = hero.querySelector(".hero__canvas");
    const ctx = canvas.getContext("2d");
    const pcan = hero.querySelector(".hero__particles");
    const pctx = pcan.getContext("2d");
    const flash = hero.querySelector(".hero__flash");
    const next = hero.nextElementSibling;
    const pre = document.querySelector(".preloader");
    const firstVisit = !store.get("pautina-intro");
    const light = innerWidth < 768 || (navigator.connection && navigator.connection.saveData);

    // ---------- preload + decode (decoded frames = no hitch on the first draw) --------
    const frames = new Array(HERO.count + 1);
    let loaded = 0, set = light ? "mobile" : "desktop";
    const url = (i, s) => `${HERO.path[s]}f_${String(i).padStart(4, "0")}.${HERO.ext}`;
    const order = [HERO.holdFrame, 1]; for (let i = 1; i <= HERO.count; i++) if (!order.includes(i)) order.push(i);
    function loadFrame(i, s) {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => { if (!frames[i] || s === set) frames[i] = img; res(); }); };
        img.onerror = () => res();
        img.src = url(i, s);
      });
    }
    function progress() {
      loaded++;
      if (!pre) return;
      const p = loaded / HERO.count;
      pre.style.setProperty("--load", p.toFixed(3));
      const pct = pre.querySelector(".preloader__pct");
      if (pct) pct.textContent = Math.round(p * 100) + "%";
    }
    async function preload() {
      const slow = setTimeout(() => { if (loaded < HERO.count && set === "desktop") set = "mobile"; }, HERO.slowAfterMs);
      const queue = order.slice();
      const worker = async () => { while (queue.length) { const i = queue.shift(); if (!frames[i]) await loadFrame(i, set); progress(); } };
      await Promise.all(Array.from({ length: 6 }, worker));
      clearTimeout(slow);
    }

    // ---------- drawing ------------------------------------------------------------
    const off = document.createElement("canvas"), octx = off.getContext("2d");
    const tiny = document.createElement("canvas"); tiny.width = 64; tiny.height = 36;
    const tctx = tiny.getContext("2d");
    let drawn = -1, cur = HERO.holdFrame;
    function resize() {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      const W = stage.clientWidth, H = stage.clientHeight;
      for (const c of [canvas, pcan]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      off.width = canvas.width; off.height = canvas.height;
      seedParticles(dpr);
      drawn = -1; draw(cur);
    }
    function nearest(i) {
      if (frames[i]) return frames[i];
      for (let d = 1; d < HERO.count; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; }
      return null;
    }
    function draw(i) {
      i = clamp(Math.round(i), 1, HERO.count);
      const img = nearest(i);
      if (!img || i === drawn) return;
      drawn = i; cur = i;
      const cw = canvas.width, ch = canvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
      const portrait = cw / ch < 1;
      // landscape: cover. portrait: ~32% of the frame width visible, so he is never cut off
      const cover = Math.max(cw / iw, ch / ih);
      const scale = portrait ? Math.min(cover, cw / (iw * .32)) : cover;
      const dw = iw * scale, dh = ih * scale;
      const dx = clamp(cw / 2 - HERO.focusX * dw, cw - dw, 0);
      const dy = dh >= ch ? clamp(ch / 2 - HERO.focusY * dh, ch - dh, 0) : ch * .46 - dh / 2;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      if (dh >= ch) { ctx.drawImage(img, dx, dy, dw, dh); return; }
      tctx.drawImage(img, 0, 0, 64, 36);
      const bs = Math.max(cw / 64, ch / 36);
      ctx.drawImage(tiny, (cw - 64 * bs) / 2, (ch - 36 * bs) / 2, 64 * bs, 36 * bs);
      ctx.fillStyle = "rgba(5,7,15,.45)"; ctx.fillRect(0, 0, cw, ch);
      octx.clearRect(0, 0, cw, ch);
      octx.globalCompositeOperation = "source-over";
      octx.drawImage(img, dx, dy, dw, dh);
      octx.globalCompositeOperation = "destination-in";
      const g = octx.createLinearGradient(0, dy, 0, dy + dh);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.08, "#000"); g.addColorStop(.92, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
      octx.fillStyle = g; octx.fillRect(0, 0, cw, ch);
      ctx.drawImage(off, 0, 0);
    }

    // ---------- petals + dust (from the reference's falling petals) ------------------
    let parts = [], lift = 0, mx = 0, visible = true;
    function seedParticles(dpr) {
      const n = reduce ? 0 : (innerWidth < 768 ? 24 : 48);
      parts = Array.from({ length: n }, () => {
        const petal = Math.random() < .45;
        return { x: Math.random() * pcan.width, y: Math.random() * pcan.height, r: (petal ? 3 + Math.random() * 4 : .6 + Math.random() * 1.4) * dpr,
          vx: (.1 + Math.random() * .35) * dpr, vy: (.15 + Math.random() * .45) * dpr, a: Math.random() * 6.28, va: (Math.random() - .5) * .03,
          petal, alpha: petal ? .35 + Math.random() * .4 : .15 + Math.random() * .35, z: .5 + Math.random() };
      });
    }
    function tickParticles() {
      pctx.clearRect(0, 0, pcan.width, pcan.height);
      for (const p of parts) {
        p.x += p.vx * p.z + mx * p.z * .15; p.y += (p.vy - lift * 9) * p.z; p.a += p.va;
        if (p.y > pcan.height + 20) { p.y = -20; p.x = Math.random() * pcan.width; }
        if (p.y < -30) { p.y = pcan.height + 20; p.x = Math.random() * pcan.width; }
        if (p.x > pcan.width + 20) p.x = -20;
        pctx.save(); pctx.translate(p.x, p.y); pctx.rotate(p.a); pctx.globalAlpha = p.alpha;
        pctx.fillStyle = p.petal ? "#E2202C" : "#F4F6FB";
        pctx.beginPath();
        if (p.petal) pctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.2832); else pctx.arc(0, 0, p.r, 0, 6.2832);
        pctx.fill(); pctx.restore();
      }
    }
    (function loop() {
      if (visible && parts.length) tickParticles();
      lift *= .94;
      requestAnimationFrame(loop);
    })();

    // ---------- time-based frame player -------------------------------------------------
    let playing = null;
    function play(from, to, ms, onFrame) {
      if (playing) playing.cancel = true;
      const job = { cancel: false };
      playing = job;
      return new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          if (job.cancel) return res(false);
          const t = clamp((now - t0) / ms, 0, 1);
          draw(from + (to - from) * t);
          if (onFrame) onFrame(t);
          if (t < 1) requestAnimationFrame(step); else { playing = null; res(true); }
        };
        requestAnimationFrame(step);
      });
    }
    function glideTo(y, ms) {
      const y0 = scrollY, t0 = performance.now();
      return new Promise((res) => {
        const step = (now) => {
          const t = clamp((now - t0) / ms, 0, 1);
          scrollTo({ top: y0 + (y - y0) * easeInOut(t), behavior: "instant" });
          if (t < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }

    // ---------- input lock (mask and fall only) ------------------------------------
    const block = (e) => e.preventDefault();
    const blockKeys = (e) => { if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Spacebar", "End", "Home"].includes(e.key)) e.preventDefault(); };
    let locked = false;
    function lock(on) {
      if (locked === on) return;
      locked = on;
      const f = on ? addEventListener : removeEventListener;
      f("wheel", block, { passive: false }); f("touchmove", block, { passive: false }); f("keydown", blockKeys);
    }

    // ---------- state machine ----------------------------------------------------------
    // load -> mask -> hold -> falling -> fallen -> (back at top) rewinding -> hold
    let state = "load";
    const setState = (s) => {
      state = s;
      hero.classList.toggle("is-titled", s !== "load" && s !== "mask");
      hero.classList.toggle("is-idle", s === "hold" && !reduce);
      hero.classList.toggle("is-fallen", s === "falling" || s === "fallen");
      document.body.classList.toggle("is-jumping", s === "falling");
    };

    let gliding = false;
    async function fall(glide) {
      if (state !== "hold") return;
      setState("falling");
      if (glide) lock(true);
      const ms = (HERO.jumpEnd - HERO.jumpStart + 1) / HERO.fallFps * 1000;
      await play(HERO.jumpStart, HERO.jumpEnd, ms, (t) => { lift = Math.max(lift, t * 1.4); });
      flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on");
      setState("fallen");
      if (glide && next) {
        gliding = true;
        await glideTo(next.getBoundingClientRect().top + scrollY, HERO.glideMs);
        gliding = false;
        next.classList.remove("shake"); void next.offsetWidth; next.classList.add("shake");
      }
      lock(false);
      sync();
    }
    async function rewind() {
      if (state !== "fallen") return;
      setState("rewinding");
      const ok = await play(cur, HERO.holdFrame, HERO.rewindMs);
      if (ok) setState("hold");
      sync();
    }
    // keep the scene in step with where the page is, after every scroll and every animation
    function sync() {
      if (reduce || gliding) return;
      if (state === "hold" && scrollY > innerHeight * .15) fall(false);
      else if (state === "fallen" && scrollY < innerHeight * .35) rewind();
    }

    // the first gesture down at the top of the page starts the fall
    const atTop = () => scrollY < 8;
    addEventListener("wheel", (e) => { if (!reduce && state === "hold" && atTop() && e.deltaY > 0) { e.preventDefault(); fall(true); } }, { passive: false });
    let ty = null;
    addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
    addEventListener("touchmove", (e) => {
      if (!reduce && state === "hold" && atTop() && ty != null && ty - e.touches[0].clientY > 8) { e.preventDefault(); ty = null; fall(true); }
    }, { passive: false });
    addEventListener("keydown", (e) => {
      if (!reduce && state === "hold" && atTop() && ["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key) && !e.target.closest("input, textarea, button, a")) { e.preventDefault(); fall(true); }
    });
    // any other way down (scrollbar drag, anchor link) still plays the fall, without the glide
    addEventListener("scroll", sync, { passive: true });

    // ---------- boot ---------------------------------------------------------------------
    resize();
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    if (finePointer && !reduce) {
      hero.addEventListener("pointermove", (e) => {
        mx = e.clientX / innerWidth - .5;
        hero.style.setProperty("--px", (mx * -14).toFixed(1) + "px");
        hero.style.setProperty("--py", ((e.clientY / innerHeight - .5) * -10).toFixed(1) + "px");
      });
    }
    new IntersectionObserver((e) => { visible = e[0].isIntersecting && !document.hidden; }).observe(hero);
    document.addEventListener("visibilitychange", () => { visible = !document.hidden; });
    if (pre && !firstVisit) pre.remove();
    if (pre && firstVisit) document.documentElement.classList.add("preloader-lock");

    (async () => {
      await loadFrame(HERO.holdFrame, set); draw(HERO.holdFrame);
      const deep = scrollY > innerHeight * .5;
      if (reduce) { if (pre) pre.remove(); document.documentElement.classList.remove("preloader-lock"); setState("hold"); preload(); return; }
      if (deep) { if (pre) pre.remove(); document.documentElement.classList.remove("preloader-lock"); setState("fallen"); await preload(); draw(HERO.jumpEnd); return; }
      await preload();   // every frame decoded before anything moves: no stutter
      if (pre) { pre.classList.add("is-done"); document.documentElement.classList.remove("preloader-lock"); setTimeout(() => pre.remove(), 1000); }
      store.set("pautina-intro", "1");
      setState("mask");
      lock(true);
      await play(HERO.maskStart, HERO.maskEnd, HERO.maskMs);
      lock(false);
      setState("hold");
    })();
  };
})();
