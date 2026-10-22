/* Builds every plate from data.json into [data-render] containers.
   Text goes in through textContent only (dataviz / interaction rule). */
(function () {
  const S = window.Site;
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---------- tiny DOM helpers -------------------------------------------------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
      else if (k === "text") el.textContent = S.typo(String(v));
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c); });
    return el;
  }
  function icon(name, cls = "icon") {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true");
    const u = document.createElementNS(SVGNS, "use");
    u.setAttribute("href", "#i-" + name);
    s.append(u);
    return s;
  }
  const src = (keys, asOf) => S.sourceNode(keys, S.data, asOf);
  const foot = (keys, asOf) => h("div", { class: "plate__foot" }, src(keys, asOf));
  const plate = (cls, ...kids) => h("article", { class: "plate reveal " + (cls || "") }, ...kids);
  const badge = (text, ico) => h("span", { class: "badge" }, ico ? icon(ico) : null, text);
  const quoteMark = () => {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "quote__mark"); s.setAttribute("viewBox", "0 0 64 48"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<path fill="currentColor" d="M0 48V29C0 13 8 3 24 0l3 7C18 10 14 16 14 24h12v24H0zm36 0V29C36 13 44 3 60 0l3 7c-9 3-13 9-13 17h12v24H36z"/>';
    return s;
  };

  // looping clip = <video> with WebM (VP8) first, MP4 (H.264) second, WebP poster
  function clip(name, opts = {}) {
    const m = S.data.media[name] || {};
    const v = h("video", {
      muted: true, loop: true, playsinline: true, preload: opts.eager ? "auto" : "none",
      poster: `assets/media/${name}.webp`, width: m.w, height: m.h,
      "data-autoplay": "", "aria-label": m.alt, role: "img"
    });
    v.muted = true;
    v.append(h("source", { src: `assets/media/${name}.webm`, type: "video/webm" }),
             h("source", { src: `assets/media/${name}.mp4`, type: "video/mp4" }));
    return v;
  }
  S.clip = clip; S.h = h; S.icon = icon;

  // ---------- plates -------------------------------------------------------------
  function kpi({ label, value, digits, note, badgeText, badgeIcon, keys, asOf, cls, big, spark }) {
    const parts = S.fmt.moneyParts(value, digits);
    const num = h("span", { class: "kpi__fig" },
      h("span", { class: "sr-only", text: S.fmt.money(value, { digits }) }),
      h("span", { class: "kpi__num" + (big ? " kpi__num--xl" : ""), "aria-hidden": "true" },
        h("span", { class: "kpi__val", "data-count": value, "data-parts": "", "data-digits": parts.digits }, parts.num),
        parts.unit ? h("span", { class: "kpi__unit", text: parts.unit }) : null));
    const p = plate("kpi " + (cls || ""),
      h("div", { class: "plate__top" }, h("span", { class: "kpi__label", text: label }), badgeText ? badge(badgeText, badgeIcon) : null),
      num,
      note ? h("p", { class: "kpi__note", text: note }) : null,
      spark || null,
      foot(keys, asOf));
    if (cls && cls.includes("plate--record")) p.prepend(h("span", { class: "plate__ring", "aria-hidden": "true" }));
    return p;
  }

  function sparkline(values) {
    const w = 300, hgt = 44, pad = 4;
    const max = Math.max(...values), min = 0;
    const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = (v) => hgt - pad - ((v - min) / (max - min)) * (hgt - pad * 2);
    const d = values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "spark"); s.setAttribute("viewBox", `0 0 ${w} ${hgt}`); s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = `<path class="area" d="${d} L${x(values.length - 1)} ${hgt} L${x(0)} ${hgt} Z"/><path class="line" d="${d}"/><circle r="4" cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}"/>`;
    return s;
  }

  function fact(f, accent) {
    return plate("fact " + (accent === "blue" ? "plate--blue" : ""),
      h("div", { class: "plate__top" }, h("span", { class: "fact__icon" }, icon(f.icon || "sparkles")), h("span", { class: "tag", text: f.category })),
      h("p", { class: "plate__text", text: f.text }),
      foot(f.source));
  }

  function dyk(d) {
    return h("aside", { class: "plate dyk reveal", "aria-label": "Знаете ли вы?" },
      h("span", { class: "dyk__q", "aria-hidden": "true", text: "?" }),
      h("span", { class: "tag", text: "Знаете ли вы?" }),
      h("p", { class: "dyk__text", text: d.text }),
      d.source && d.source.length ? foot(d.source) : null);
  }

  function compare(c) {
    const max = Math.max(c.a.value, c.b.value);
    const diff = (c.a.value / c.b.value - 1) * 100;
    return plate("cmp",
      h("div", { class: "plate__top" }, h("span", { class: "kpi__label", text: c.title }), badge(S.fmt.pct(diff), "trending-up")),
      h("div", { class: "cmp__row" },
        h("div", { class: "cmp__side" }, h("span", { class: "micro", text: c.a.label }), h("span", { class: "cmp__val", text: S.fmt.money(c.a.value) })),
        h("span", { class: "cmp__vs", text: "VS" }),
        h("div", { class: "cmp__side cmp__side--b" }, h("span", { class: "micro", text: c.b.label }), h("span", { class: "cmp__val muted", text: S.fmt.money(c.b.value) }))),
      h("div", { class: "cmp__bars", "aria-hidden": "true" },
        h("span", { class: "cmp__bar cmp__bar--a", style: { "--w": (c.a.value / max).toFixed(3) } }),
        h("span", { class: "cmp__bar", style: { "--w": (c.b.value / max).toFixed(3) } })),
      h("p", { class: "kpi__note" }, "Разница: ", h("strong", { text: S.fmt.pct(diff) })),
      foot(c.source));
  }

  function quote(q, cls) {
    return h("figure", { class: "plate quote reveal " + (cls || "") }, quoteMark(),
      h("blockquote", { class: "quote__text" }, h("p", { text: "«" + q.text + "»" })),
      h("figcaption", { class: "micro" }, h("span", { class: "quote__who", text: q.author }), q.note ? ", " + q.note : ""),
      foot(q.source));
  }

  function record(r) {
    const p = plate(r.gold ? "plate--record" : "plate--blue",
      h("div", { class: "plate__top" }, h("span", { class: "fact__icon" }, icon(r.gold ? "trophy" : "award")), badge(r.gold ? "Рекорд" : "Достижение", r.gold ? "crown" : "star")),
      h("h3", { class: "plate__title", text: r.title }),
      h("p", { class: "plate__text", text: r.detail }),
      foot(r.source));
    if (r.gold) p.prepend(h("span", { class: "plate__ring", "aria-hidden": "true" }));
    return p;
  }

  function rating(r) {
    return plate("rating " + (r.site.startsWith("Rotten") ? "" : "plate--blue"),
      h("div", { class: "ring", style: { "--v": r.value } },
        (() => { const s = document.createElementNS(SVGNS, "svg"); s.setAttribute("viewBox", "0 0 120 120"); s.setAttribute("aria-hidden", "true");
          s.innerHTML = '<circle class="track" cx="60" cy="60" r="50" pathLength="100"/><circle class="fill" cx="60" cy="60" r="50" pathLength="100"/>'; return s; })(),
        h("span", { class: "ring__val", text: r.display })),
      h("span", { class: "rating__site", text: r.site }),
      h("p", { class: "kpi__note", text: r.note }),
      foot(r.source, S.data.ratingsAsOf));
  }

  // ---------- renderers keyed by [data-render] -----------------------------------
  const R = {
    "kpi-bento"(el, d) {
      const bo = d.boxOffice;
      el.append(
        kpi({ label: "Сборы в мире", value: bo.total.world, digits: 2, note: `за ${bo.total.days} дня проката, по данным на ${S.fmt.dateShort(bo.asOf)}`, badgeText: "№3 в истории", badgeIcon: "crown", keys: bo.total.sources, cls: "bento__big", big: false,
              spark: sparkline(bo.weekly.map((w) => w.cumulative)) }),
        kpi({ label: "Старт в США", value: bo.opening.us, digits: 1, note: "лучший уик-энд открытия в истории", badgeText: "Рекорд", badgeIcon: "trophy", keys: ["bom", "cnbcOpen"], cls: "plate--record" }),
        kpi({ label: "Старт в мире", value: bo.opening.world, digits: 0, note: "второй результат после «Мстителей: Финал»", keys: ["deadlineOpen", "cnbcOpen"] }),
        kpi({ label: "Рубеж $2 млрд", value: 2e9, digits: 0, note: "за 17 дней — второй результат в истории", badgeText: "17 дней", badgeIcon: "timer", keys: ["deadline2b", "cosmic2b"], cls: "plate--blue" }),
        kpi({ label: "Сборы в США", value: bo.total.us, digits: 1, note: "самый кассовый фильм в истории проката США", badgeText: "№1", badgeIcon: "crown", keys: ["bom", "deadlineDom"], cls: "plate--blue" })
      );
    },
    "bo-kpis"(el, d) {
      const bo = d.boxOffice;
      el.append(
        kpi({ label: "США и Канада", value: bo.total.us, digits: 1, note: "38,1% от мировых сборов", keys: bo.total.sources, asOf: bo.asOf }),
        kpi({ label: "Международный прокат", value: bo.total.intl, digits: 2, note: "61,9% от мировых сборов", keys: bo.total.sources, asOf: bo.asOf, cls: "plate--blue" }),
        kpi({ label: "Старт в США", value: bo.opening.us, digits: 1, note: "31 июля — 2 августа", badgeText: "Рекорд", badgeIcon: "trophy", keys: ["bom", "numbers"], cls: "plate--record" }),
        kpi({ label: "Старт в мире", value: bo.opening.world, digits: 0, note: `${S.fmt.money(bo.opening.intl)} за рубежом, ${bo.opening.intlMarkets} рынков`, keys: bo.opening.sources.slice(2) }),
        kpi({ label: "Бюджет", value: bo.budget.value, digits: 0, note: bo.budget.note, keys: bo.budget.source, cls: "plate--blue" }),
        kpi({ label: "Окупаемость", value: bo.total.world, digits: 2, note: `в ${(bo.total.world / bo.budget.value).toFixed(1).replace(".", ",")} раза больше бюджета`, keys: ["numbers"] })
      );
      // last one reads better as a ratio than a sum
      const ratio = (bo.total.world / bo.budget.value).toFixed(1).replace(".", ",");
      const fig = el.lastElementChild.querySelector(".kpi__fig");
      fig.replaceChildren(h("span", { class: "sr-only", text: `в ${ratio} раза больше бюджета` }),
        h("span", { class: "kpi__num", "aria-hidden": "true" }, h("span", { class: "kpi__val" }, "×" + ratio)));
      el.lastElementChild.querySelector(".kpi__note").textContent = "мировые сборы к производственному бюджету";
    },
    marquee(el, d) {
      const items = d.boxOffice.records.map((r) => r.title).concat(["$2,48 млрд в мире", "718,6 млн просмотров трейлера за сутки"]);
      const row = () => items.map((t) => h("span", { class: "marquee__item" }, t, h("span", { class: "marquee__sep", "aria-hidden": "true", text: "✦" })));
      const track = h("div", { class: "marquee__track" }, row(), h("div", { "aria-hidden": "true", style: { display: "contents" } }, row()));
      el.append(h("p", { class: "sr-only", text: "Рекорды фильма: " + items.join("; ") }), track);
      el.setAttribute("aria-hidden", "false");
      track.setAttribute("aria-hidden", "true");
    },
    facts(el, d) {
      const pick = (el.dataset.pick || "").split(",").filter(Boolean).map(Number);
      const list = pick.length ? pick.map((i) => d.facts[i]) : d.facts;
      list.forEach((f, i) => { const p = fact(f, i % 2 ? "blue" : "red"); p.style.setProperty("--i", i); el.append(p); });
    },
    production(el, d) { d.film.production.forEach((f, i) => { const p = fact(f, i % 2 ? "blue" : "red"); p.style.setProperty("--i", i % 3); el.append(p); }); },
    dyk(el, d) { el.append(dyk(d.didYouKnow[el.dataset.key])); },
    compare(el, d) { d.boxOffice.compare.forEach((c, i) => { const p = compare(c); p.style.setProperty("--i", i); el.append(p); }); },
    records(el, d) {
      const sel = el.dataset.only === "gold" ? d.boxOffice.records.filter((r) => r.gold) : d.boxOffice.records;
      sel.forEach((r, i) => { const p = record(r); p.style.setProperty("--i", i % 4); el.append(p); });
    },
    ratings(el, d) { d.ratings.forEach((r, i) => { const p = rating(r); p.style.setProperty("--i", i); el.append(p); }); },
    milestones(el, d) {
      const line = h("div", { class: "miles__line", "aria-hidden": "true" }, h("i"));
      el.append(line);
      d.boxOffice.milestones.forEach((m, i) => {
        el.append(h("div", { class: "mile reveal", style: { "--i": i } },
          h("div", { class: "mile__dot", "aria-hidden": "true" }, h("span")),
          plate(i % 2 ? "plate--blue" : "",
            h("span", { class: "tag", text: m.region === "США" ? "США и Канада" : "Мир" }),
            h("span", { class: "mile__amount", text: m.label }),
            h("div", { class: "mile__meta" }, h("span", {}, icon("timer"), " ", `${m.days} ${plural(m.days, "день", "дня", "дней")}`), h("span", { text: S.fmt.dateShort(m.date) })),
            m.note ? h("p", { class: "kpi__note", text: m.note }) : null,
            foot(m.source))));
      });
    },
    countries(el, d) {
      const bo = d.boxOffice;
      const max = bo.countries[0].gross;
      bo.countries.forEach((c, i) => {
        el.append(h("article", { class: "plate country reveal", style: { "--i": i % 4 } },
          h("span", { class: "country__code", text: c.code }),
          h("span", { class: "country__name", text: c.country }),
          h("span", { class: "country__sum", text: S.fmt.money(c.gross) }),
          h("span", { class: "country__bar", "aria-hidden": "true" }, h("i", { style: { "--w": (c.gross / max).toFixed(3) } })),
          h("span", { class: "country__share", text: `${(c.gross / bo.total.world * 100).toFixed(1).replace(".", ",")}% мировых сборов` })));
      });
    },
    passport(el, d) {
      d.film.passport.forEach((p, i) => {
        const pl = plate(i % 3 === 1 ? "plate--blue" : "",
          h("span", { class: "kpi__label", text: p.label }),
          h("span", { class: "passport__value", text: p.value }),
          p.note ? h("p", { class: "kpi__note", text: p.note }) : null,
          foot(p.source));
        pl.style.setProperty("--i", i % 4);
        el.append(pl);
      });
      const r = d.film.release;
      const pl = plate("plate--record",
        h("span", { class: "kpi__label", text: "Премьера" }),
        h("span", { class: "passport__value", text: S.fmt.date(r.premiere) }),
        h("p", { class: "kpi__note", text: `${r.premierePlace}. В прокате США — с ${S.fmt.date(r.us)}, в Китае, Франции и Бразилии — с ${S.fmt.date(r.intlFrom)}.` }),
        foot(r.source));
      pl.prepend(h("span", { class: "plate__ring", "aria-hidden": "true" }));
      el.prepend(pl);
    },
    chronology(el, d) {
      d.film.chronology.forEach((c, i) => {
        el.append(h("div", { class: "chrono__item reveal" + (c.current ? " chrono__item--current" : ""), style: { "--i": i } },
          h("span", { class: "chrono__year", text: c.year }),
          h("span", { class: "chrono__title", text: "«" + c.title + "»" }),
          c.note ? h("span", { class: "micro", text: c.note }) : null));
      });
    },
    quote(el, d) { el.append(quote(S.get(d, el.dataset.path))); },
    cast(el, d) {
      const groups = { hero: "Герой", ally: "Союзник", villain: "Противник", mystery: "Тайна" };
      d.film.cast.forEach((c, i) => {
        const media = h("div", { class: "char__media" });
        if (c.media) media.append(clip(c.media));
        else media.append(h("span", { class: "char__mono", "aria-hidden": "true", text: c.actor.split(" ").map((w) => w[0]).join("") }));
        const card = h("button", { class: "plate char reveal " + (c.color === "blue" ? "plate--blue" : c.color === "gold" ? "plate--gold" : ""), type: "button", "data-group": c.group, "data-cast": i, style: { "--i": i % 4 }, "aria-haspopup": "dialog" },
          media,
          h("div", { class: "char__body" },
            h("span", { class: "badge", text: groups[c.group] }),
            h("span", { class: "char__name", text: c.character }),
            h("span", { class: "char__actor", text: c.actor }),
            h("p", { class: "char__fact", text: c.fact }),
            c.more ? h("div", { class: "char__more" }, h("p", { text: c.more })) : null));
        el.append(card);
      });
    },
    actors(el, d) {
      const max = Math.max(...d.actors.map((a) => a.world));
      d.actors.forEach((a, i) => {
        const cur = a.actor === "Том Холланд";
        el.append(plate(cur ? "" : "plate--blue",
          h("div", { class: "plate__top" }, h("span", { class: "kpi__label", text: a.years }), cur ? badge("Сейчас", "star") : null),
          h("h3", { class: "plate__title", text: a.actor }),
          h("p", { class: "plate__text", text: `${a.films} ${plural(a.films, "сольный фильм", "сольных фильма", "сольных фильмов")}, режиссёр${a.director.includes(",") ? "ы" : ""}: ${a.director}` }),
          h("span", { class: "cmp__val", text: S.fmt.money(a.world, { digits: 2 }) }),
          h("div", { class: "cmp__bars", "aria-hidden": "true" }, h("span", { class: "cmp__bar" + (cur ? " cmp__bar--a" : ""), style: { "--w": (a.world / max).toFixed(3) } })),
          foot(["numbersFranchise"])));
        el.lastElementChild.style.setProperty("--i", i);
      });
    },
    history(el, d) {
      const line = h("div", { class: "chron__line", "aria-hidden": "true" });
      line.innerHTML = '<svg preserveAspectRatio="none" viewBox="0 0 2 100"><path d="M1 0V100" pathLength="1"/></svg>';
      el.append(line);
      d.history.forEach((e) => {
        el.append(h("article", { class: "chron__item" + (e.current ? " chron__item--current" : "") },
          plate(e.current ? "plate--record" : "",
            h("span", { class: "chron__year", text: e.year }),
            h("h3", { class: "plate__title", text: e.title }),
            h("p", { class: "plate__text", text: e.text }),
            foot(e.source))));
      });
      el.querySelectorAll(".plate--record").forEach((p) => p.prepend(h("span", { class: "plate__ring", "aria-hidden": "true" })));
    },
    comicArc(el, d) { d.comicArc.forEach((f, i) => { const p = fact({ ...f, category: "Комиксы, 2008", icon: "book-open" }, i % 2 ? "blue" : "red"); p.style.setProperty("--i", i); el.append(p); }); },
    "franchise-table"(el, d) {
      const rows = d.franchise.slice();
      const cols = [
        { key: "title", label: "Фильм", num: false, fmt: (r) => r.title },
        { key: "year", label: "Год", num: true, fmt: (r) => r.year },
        { key: "actor", label: "Паук", num: false, fmt: (r) => r.actor },
        { key: "world", label: "Сборы в мире", num: true, fmt: (r) => S.fmt.money(r.world, { digits: 2 }) }
      ];
      const table = h("table", {});
      const caption = h("caption", { class: "sr-only", text: "Мировые сборы всех фильмов о Человеке-пауке. Нажмите на заголовок столбца, чтобы отсортировать." });
      const headRow = h("tr");
      const tbody = h("tbody");
      let sortKey = "year", dir = 1;
      const draw = () => {
        rows.sort((a, b) => (a[sortKey] > b[sortKey] ? dir : a[sortKey] < b[sortKey] ? -dir : 0));
        tbody.replaceChildren(...rows.map((r) => h("tr", { class: r.current ? "is-current" : "" }, cols.map((c) => h("td", { class: c.num ? "num" : "", text: c.fmt(r) })))));
        headRow.querySelectorAll("th").forEach((th) => {
          if (th.dataset.key === sortKey) th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending"); else th.removeAttribute("aria-sort");
        });
      };
      cols.forEach((c) => {
        const b = h("button", { type: "button" }, c.label, icon("arrow-up"));
        b.addEventListener("click", () => { dir = sortKey === c.key ? -dir : (c.num ? -1 : 1); sortKey = c.key; draw(); });
        headRow.append(h("th", { class: c.num ? "num" : "", scope: "col", "data-key": c.key }, b));
      });
      table.append(caption, h("thead", {}, headRow), tbody);
      el.append(table);
      draw();
    },
    sources(el, d) {
      const seen = new Set();
      Object.values(d.meta.sources).forEach((s) => {
        const host = new URL(s.url).hostname.replace("www.", "");
        if (seen.has(host)) return; seen.add(host);
        el.append(h("a", { href: s.url, target: "_blank", rel: "noopener", text: s.name }));
      });
    }
  };

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  S.plural = plural;

  S.render = function (root = document) {
    root.querySelectorAll("[data-render]").forEach((el) => {
      const fn = R[el.dataset.render];
      if (fn) fn(el, S.data);
    });
  };
})();
