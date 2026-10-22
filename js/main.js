/* Shared behaviour: header, menu, reveals, plate light, progress, dawn tint,
   clip autoplay, modals (trailer, character, lightbox), slider, filters, tables. */
(function () {
  document.documentElement.classList.add("js");
  const S = window.Site;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  S.ready.then((data) => {
    S.render(document);
    S.initCounters(document);
    initReveal();
    initHeader();
    initMenu();
    initPlateLight();
    initClips();
    initModals(data);
    initSlider();
    initFacts();
    initCastFilter();
    initDataToggles();
    initScrollBits();
    initSpy();
    if (S.initCharts) S.initCharts(data);
    if (S.initHero) S.initHero(data);
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }).catch((err) => {
    console.warn(err);
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
  });

  // ---------- reveal on scroll -----------------------------------------------
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) return els.forEach((el) => el.classList.add("is-in"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.18, rootMargin: "0px 0px -5% 0px" });
    els.forEach((el) => io.observe(el));
    // bars inside groups animate with their parent
    document.querySelectorAll(".cmp, .country, .rating").forEach((el) => io.observe(el));
  }

  // ---------- header: glass after hero edge, hide on scroll down --------------
  function initHeader() {
    const header = document.querySelector(".header");
    if (!header) return;
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle("is-glass", y > 40);
      const inJump = document.body.classList.contains("is-jumping");
      if (inJump) header.classList.add("is-hidden");
      else if (y > last + 6 && y > 200 && !document.documentElement.classList.contains("menu-open")) header.classList.add("is-hidden");
      else if (y < last - 6 || y < 200) header.classList.remove("is-hidden");
      last = y;
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initMenu() {
    const btn = document.querySelector(".burger");
    const root = document.documentElement;
    if (!btn) return;
    const set = (open) => {
      root.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
      document.querySelector(".mnav").inert = !open;
      if (open) document.querySelector(".mnav a").focus();
    };
    document.querySelector(".mnav").inert = true;
    btn.addEventListener("click", () => set(!root.classList.contains("menu-open")));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("menu-open")) { set(false); btn.focus(); } });
    document.querySelectorAll(".mnav a").forEach((a, i) => a.style.setProperty("--i", i));
  }

  // ---------- light that follows the cursor on plates -------------------------
  function initPlateLight() {
    if (!finePointer) return;
    document.addEventListener("pointermove", (e) => {
      const p = e.target.closest && e.target.closest(".plate");
      if (!p) return;
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", (e.clientX - r.left) + "px");
      p.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  // ---------- clips: play only while visible, pause when off-screen -----------
  function initClips() {
    const vids = [...document.querySelectorAll("video[data-autoplay]")];
    vids.forEach((v) => { v.muted = true; v.playsInline = true; });
    if (reduce) return; // posters only
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) { if (v.preload === "none") v.preload = "auto"; const p = v.play(); if (p) p.catch(() => {}); }
        else v.pause();
      });
    }, { threshold: 0.15 });
    vids.forEach((v) => io.observe(v));
    document.addEventListener("visibilitychange", () => { if (document.hidden) vids.forEach((v) => v.pause()); });
  }

  // ---------- modals ---------------------------------------------------------
  function trapFocus(modal, e) {
    if (e.key !== "Tab") return;
    const f = [...modal.querySelectorAll("a, button, iframe, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  }
  function openModal(modal, opener, onClose) {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    modal.querySelector(".modal__close").focus();
    const keys = (e) => { if (e.key === "Escape") close(); else trapFocus(modal, e); if (modal._keys) modal._keys(e); };
    const click = (e) => { if (e.target === modal) close(); };
    function close() {
      modal.classList.remove("is-open");
      removeEventListener("keydown", keys); modal.removeEventListener("click", click);
      setTimeout(() => { modal.hidden = true; if (onClose) onClose(); }, 320);
      if (opener) opener.focus();
    }
    addEventListener("keydown", keys); modal.addEventListener("click", click);
    modal.querySelector(".modal__close").onclick = close;
    return close;
  }

  function initModals(data) {
    // trailer: the iframe is created only after the click
    document.querySelectorAll("[data-trailer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // YouTube refuses embeds from file:// (no referrer) -> open the trailer on YouTube instead
        if (location.protocol === "file:") { window.open(`https://www.youtube.com/watch?v=${data.trailer.youtubeId}`, "_blank", "noopener"); return; }
        const modal = document.getElementById("trailer-modal");
        const box = modal.querySelector(".modal__box");
        const f = document.createElement("iframe");
        f.src = `https://www.youtube-nocookie.com/embed/${data.trailer.youtubeId}?autoplay=1&rel=0`;
        f.title = `Трейлер «${data.film.title_ru}»`;
        f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        f.allowFullscreen = true;
        box.append(f);
        openModal(modal, btn, () => f.remove());
      });
    });

    // character dialog
    document.querySelectorAll("[data-cast]").forEach((card) => {
      card.addEventListener("click", () => {
        const c = data.film.cast[+card.dataset.cast];
        const modal = document.getElementById("char-modal");
        const body = modal.querySelector(".modal__body");
        body.replaceChildren(
          S.h("span", { class: "tag", text: card.querySelector(".badge").textContent }),
          S.h("h2", { class: "h2", id: "char-modal-title", text: c.character }),
          S.h("p", { class: "lead", text: c.actor }),
          S.h("p", { text: c.fact }),
          c.more ? S.h("p", { class: "muted", text: c.more }) : null,
          S.sourceNode(c.source, data));
        openModal(modal, card);
      });
    });

    // gallery lightbox
    const tiles = [...document.querySelectorAll("[data-lightbox]")];
    if (tiles.length) {
      const modal = document.getElementById("lightbox");
      const stage = modal.querySelector(".lightbox__stage");
      const cap = modal.querySelector(".lightbox__cap");
      let idx = 0;
      const show = (i) => {
        idx = (i + tiles.length) % tiles.length;
        const name = tiles[idx].dataset.lightbox;
        const v = S.clip(name, { eager: true });
        v.autoplay = true; v.controls = false; v.removeAttribute("data-autoplay");
        stage.replaceChildren(v);
        const p = v.play(); if (p) p.catch(() => {});
        cap.textContent = `${idx + 1} / ${tiles.length} — ${data.media[name].alt}`;
      };
      modal.querySelector("[data-prev]").onclick = () => show(idx - 1);
      modal.querySelector("[data-next]").onclick = () => show(idx + 1);
      modal._keys = (e) => { if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); };
      let sx = null;
      stage.addEventListener("pointerdown", (e) => (sx = e.clientX));
      stage.addEventListener("pointerup", (e) => { if (sx != null && Math.abs(e.clientX - sx) > 40) show(idx + (e.clientX < sx ? 1 : -1)); sx = null; });
      tiles.forEach((t, i) => t.addEventListener("click", () => { show(i); openModal(modal, t, () => stage.replaceChildren()); }));
    }
  }

  // ---------- horizontal slider: arrows + drag --------------------------------
  function initSlider() {
    document.querySelectorAll(".slider").forEach((sl) => {
      const track = sl.querySelector(".slider__track");
      const step = () => track.firstElementChild.getBoundingClientRect().width + 16;
      sl.querySelector("[data-prev]")?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" }));
      sl.querySelector("[data-next]")?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" }));
      if (!finePointer) return;
      let down = false, x0 = 0, s0 = 0, moved = false;
      track.addEventListener("pointerdown", (e) => { down = true; moved = false; x0 = e.clientX; s0 = track.scrollLeft; });
      addEventListener("pointerup", () => { if (down) { down = false; track.classList.remove("is-drag"); } });
      track.addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - x0;
        if (Math.abs(dx) > 6) { moved = true; track.classList.add("is-drag"); }
        track.scrollLeft = s0 - dx;
      });
      track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    });
  }

  // ---------- facts: filter pills + random fact -------------------------------
  function initFacts() {
    const grid = document.querySelector("[data-render='facts'][data-filterable]");
    if (!grid) return;
    const pills = document.getElementById("facts-pills");
    const cards = [...grid.querySelectorAll(".fact")];
    const cats = ["Все", ...new Set(S.data.facts.map((f) => f.category))];
    cats.forEach((c) => {
      const n = c === "Все" ? cards.length : S.data.facts.filter((f) => f.category === c).length;
      const b = S.h("button", { class: "pill", type: "button", "aria-pressed": c === "Все" ? "true" : "false" }, c, S.h("small", { text: n }));
      b.addEventListener("click", () => {
        pills.querySelectorAll(".pill").forEach((p) => p.setAttribute("aria-pressed", String(p === b)));
        let j = 0;
        cards.forEach((card, i) => {
          const show = c === "Все" || S.data.facts[i].category === c;
          card.classList.toggle("is-hidden", !show);
          if (show) { card.style.setProperty("--j", j++); card.style.animation = "none"; card.offsetHeight; card.style.animation = ""; }
        });
        document.getElementById("facts-count").textContent = `Показано ${j} из ${cards.length}`;
      });
      pills.append(b);
    });
    document.getElementById("facts-count").textContent = `Показано ${cards.length} из ${cards.length}`;
    document.querySelector("[data-random]").addEventListener("click", () => {
      const visible = cards.filter((c) => !c.classList.contains("is-hidden"));
      cards.forEach((c) => c.classList.remove("is-picked"));
      const pick = visible[Math.floor(Math.random() * visible.length)];
      pick.classList.add("is-picked", "is-in");
      pick.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      pick.setAttribute("tabindex", "-1"); pick.focus({ preventScroll: true });
    });
  }

  // ---------- one page: highlight the chapter in view, close the menu on jump -----
  function initSpy() {
    const links = [...document.querySelectorAll("[data-spy]")];
    if (!links.length) return;
    const ids = [...new Set(links.map((a) => a.dataset.spy))];
    const secs = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const update = () => {
      const y = scrollY + innerHeight * .35;
      let cur = null;
      secs.forEach((s) => { if (s.getBoundingClientRect().top + scrollY <= y) cur = s.id; });
      links.forEach((a) => { if (a.dataset.spy === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    };
    addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    update();
    document.querySelectorAll(".mnav a").forEach((a) => a.addEventListener("click", () => {
      document.documentElement.classList.remove("menu-open");
      document.querySelector(".burger").setAttribute("aria-expanded", "false");
      document.querySelector(".mnav").inert = true;
    }));
  }

  // ---------- characters: group filter --------------------------------------
  function initCastFilter() {
    const bar = document.querySelector("[data-filter-for]");
    if (!bar) return;
    const grid = document.getElementById(bar.dataset.filterFor);
    bar.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      bar.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      grid.querySelectorAll("[data-group]").forEach((card) => {
        card.classList.toggle("is-filtered", b.dataset.filter !== "all" && card.dataset.group !== b.dataset.filter);
        card.classList.add("is-in");
      });
    }));
  }

  // ---------- "show data" tables under charts ---------------------------------
  function initDataToggles() {
    document.querySelectorAll("[data-toggle-table]").forEach((btn) => {
      const t = document.getElementById(btn.getAttribute("aria-controls"));
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        t.classList.toggle("is-open", open);
        btn.querySelector("span").textContent = open ? "Скрыть данные" : "Показать данные";
      });
    });
  }

  // ---------- progress bar, dawn tint, timelines -----------------------------
  function initScrollBits() {
    const root = document.documentElement;
    const miles = document.querySelector(".miles");
    const chron = document.querySelector(".chron");
    const milesItems = miles ? [...miles.querySelectorAll(".mile")] : [];
    const chronItems = chron ? [...chron.querySelectorAll(".chron__item")] : [];
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = Math.max(1, root.scrollHeight - innerHeight);
      const p = Math.min(1, scrollY / max);
      root.style.setProperty("--read", p.toFixed(4));
      root.style.setProperty("--dawn", Math.max(0, (p - .35) / .65).toFixed(3));
      if (miles) {
        const r = miles.getBoundingClientRect();
        const mp = Math.min(1, Math.max(0, (innerHeight * .75 - r.top) / r.height));
        miles.style.setProperty("--p", reduce ? 1 : mp.toFixed(3));
        milesItems.forEach((m) => { const mr = m.getBoundingClientRect(); m.classList.toggle("is-lit", reduce || mr.top < innerHeight * .72); });
      }
      if (chron) {
        const r = chron.getBoundingClientRect();
        const cp = Math.min(1, Math.max(0, (innerHeight * .6 - r.top) / r.height));
        chron.style.setProperty("--p", reduce ? 1 : cp.toFixed(3));
        chronItems.forEach((c) => { if (c.getBoundingClientRect().top < innerHeight * .6) c.classList.add("is-in"); });
      }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
    document.querySelectorAll("[data-top]").forEach((b) => b.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })));
  }
})();
