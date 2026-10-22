/* Charts (D3 v7). Built to the dataviz skill:
   emphasis form (one red series, the rest muted), 2px lines, <=24px bars with a 4px
   rounded data-end, hairline solid grid, crosshair tooltip on the line, per-mark
   tooltip on bars, a data table under every chart, Russian number format. */
(function () {
  const S = window.Site;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const money = (n, d) => S.fmt.money(n, { digits: d });
  const axisMoney = (n) => (n === 0 ? "0" : S.fmt.money(n, { digits: n >= 1e9 ? 1 : 0 }));

  function tip(host) {
    let t = host.querySelector(".tip");
    if (!t) { t = S.h("div", { class: "tip", role: "status", "aria-live": "polite" }); host.append(t); }
    return {
      show(x, y, rows) {
        t.replaceChildren(...rows);
        t.classList.add("is-on");
        const hw = host.clientWidth, tw = t.offsetWidth;
        t.style.left = Math.min(Math.max(0, x + 14), hw - tw) + "px";
        t.style.top = Math.max(0, y - t.offsetHeight - 12) + "px";
      },
      hide() { t.classList.remove("is-on"); }
    };
  }
  const tipRows = (label, value, sub, color) => [
    S.h("span", {}, color ? S.h("i", { class: "k", style: { "--c": color } }) : null, label),
    S.h("b", { text: value }),
    sub ? S.h("span", { text: sub }) : null
  ];

  // draw when first visible, redraw on resize
  function mount(el, draw) {
    let drawn = false, w = 0;
    const go = () => { const nw = el.clientWidth; if (!nw || nw === w) return; w = nw; el.querySelector("svg")?.remove(); draw(el, nw, !drawn && !reduce); drawn = true; };
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { go(); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (drawn) { w = 0; go(); } }, 180); });
  }

  // ---------- cumulative domestic gross: line + area, crosshair --------------
  function cumulative(el, width, animate, data, compact) {
    const rows = data.boxOffice.weekly;
    const h = compact ? 220 : Math.max(260, Math.min(420, width * .5));
    const m = { t: 24, r: compact ? 16 : 110, b: 34, l: 64 };
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("role", "img")
      .attr("aria-label", `Накопленные сборы в США по уик-эндам: от ${money(rows[0].cumulative, 1)} до ${money(rows.at(-1).cumulative, 1)}`);
    const x = d3.scalePoint().domain(rows.map((r) => r.week)).range([m.l, width - m.r]).padding(.2);
    const y = d3.scaleLinear().domain([0, 1e9]).range([h - m.b, m.t]);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(4)).join("line")
      .attr("x1", m.l).attr("x2", width - m.r).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l - 8},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(axisMoney).tickSize(0)).call((g) => g.select(".domain").remove());
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b + 16})`)
      .call(d3.axisBottom(x).tickSize(0).tickFormat((d) => (compact || width < 640 ? d : rows[d - 1].label))).call((g) => g.select(".domain").remove());
    if (width < 640 && !compact) xa.selectAll("text").text((d) => d);
    const accent = css("--viz-accent");
    const area = d3.area().x((d) => x(d.week)).y0(y(0)).y1((d) => y(d.cumulative)).curve(d3.curveMonotoneX);
    const line = d3.line().x((d) => x(d.week)).y((d) => y(d.cumulative)).curve(d3.curveMonotoneX);
    svg.append("path").datum(rows).attr("d", area).attr("fill", accent).attr("opacity", .12);
    const path = svg.append("path").datum(rows).attr("d", line).attr("fill", "none").attr("stroke", accent).attr("stroke-width", 2).attr("stroke-linecap", "round");
    if (animate) {
      const L = path.node().getTotalLength();
      path.attr("stroke-dasharray", L).attr("stroke-dashoffset", L).transition().duration(1100).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
    }
    // milestone annotation: $700M crossed on day 13, between weekend 2 and 3
    if (!compact) {
      const yy = y(7e8);
      svg.append("line").attr("x1", m.l).attr("x2", width - m.r).attr("y1", yy).attr("y2", yy).attr("stroke", "rgba(245,196,81,.45)").attr("stroke-width", 1);
      svg.append("text").attr("class", "anno").attr("x", m.l + 6).attr("y", yy - 8).text("$700 млн — 13 дней, рекорд");
    }
    const last = rows.at(-1);
    svg.append("circle").attr("cx", x(last.week)).attr("cy", y(last.cumulative)).attr("r", 5).attr("fill", accent).attr("stroke", css("--bg-1")).attr("stroke-width", 2);
    if (!compact) svg.append("text").attr("class", "lbl").attr("x", x(last.week) + 12).attr("y", y(last.cumulative) + 4).text(money(last.cumulative, 1));
    // crosshair + tooltip
    const tt = tip(el);
    const xh = svg.append("line").attr("class", "xhair").attr("y1", m.t).attr("y2", h - m.b).attr("opacity", 0);
    const dot = svg.append("circle").attr("r", 5).attr("fill", accent).attr("stroke", css("--bg-1")).attr("stroke-width", 2).attr("opacity", 0);
    const hit = svg.append("rect").attr("class", "hit").attr("x", m.l - 20).attr("y", m.t).attr("width", width - m.l - m.r + 40).attr("height", h - m.t - m.b).attr("tabindex", 0)
      .attr("aria-label", "Наведите или используйте стрелки, чтобы посмотреть значения");
    let cur = rows.length - 1;
    const show = (i) => {
      cur = Math.max(0, Math.min(rows.length - 1, i));
      const r = rows[cur], px = x(r.week), py = y(r.cumulative);
      xh.attr("x1", px).attr("x2", px).attr("opacity", 1); dot.attr("cx", px).attr("cy", py).attr("opacity", 1);
      const k = el.clientWidth / width;
      tt.show(px * k, py * k, tipRows(`Уик-энд ${r.week}, ${r.label}`, money(r.cumulative, 1), `за уик-энд ${money(r.weekend, 1)}`, accent));
    };
    const nearest = (evt) => { const [mx] = d3.pointer(evt); let best = 0, bd = 1e9; rows.forEach((r, i) => { const d = Math.abs(x(r.week) - mx); if (d < bd) { bd = d; best = i; } }); return best; };
    hit.on("pointermove", (e) => show(nearest(e))).on("pointerleave blur", () => { tt.hide(); xh.attr("opacity", 0); dot.attr("opacity", 0); })
      .on("focus", () => show(cur)).on("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
  }

  // ---------- weekend grosses: columns ----------------------------------------
  function weekends(el, width, animate, data) {
    const rows = data.boxOffice.weekly;
    const h = Math.max(240, Math.min(360, width * .45));
    const m = { t: 28, r: 12, b: 34, l: 64 };
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("role", "img").attr("aria-label", "Сборы в США за каждый уик-энд");
    const x = d3.scaleBand().domain(rows.map((r) => r.week)).range([m.l, width - m.r]).padding(.3);
    const y = d3.scaleLinear().domain([0, 4e8]).range([h - m.b, m.t]);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", width - m.r).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l - 8},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(axisMoney).tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b + 16})`).call(d3.axisBottom(x).tickSize(0)).call((g) => g.select(".domain").remove());
    const bw = Math.min(24, x.bandwidth()), accent = css("--viz-accent"), muted = css("--viz-other");
    const tt = tip(el);
    const col = (r, hh) => { const x0 = x(r.week) + (x.bandwidth() - bw) / 2, y0 = h - m.b, rr = Math.min(4, hh); return `M${x0},${y0}V${y0 - hh + rr}Q${x0},${y0 - hh} ${x0 + rr},${y0 - hh}H${x0 + bw - rr}Q${x0 + bw},${y0 - hh} ${x0 + bw},${y0 - hh + rr}V${y0}Z`; };
    const g = svg.append("g");
    rows.forEach((r, i) => {
      const hh = h - m.b - y(r.weekend);
      const p = g.append("path").attr("fill", i === 0 ? accent : muted).attr("d", col(r, animate ? 0 : hh)).attr("tabindex", 0)
        .attr("aria-label", `Уик-энд ${r.week}, ${r.label}: ${money(r.weekend, 1)}`);
      if (animate) p.transition().delay(i * 70).duration(900).ease(d3.easeCubicOut).attrTween("d", () => (t) => col(r, hh * t));
      const showTip = () => { const k = el.clientWidth / width; tt.show((x(r.week) + x.bandwidth() / 2) * k, y(r.weekend) * k, tipRows(`${r.label}`, money(r.weekend, 1), i ? `${Math.round((r.weekend / rows[i - 1].weekend - 1) * 100)}% к прошлому уик-энду` : "стартовый уик-энд, рекорд", i === 0 ? accent : muted)); p.attr("opacity", .85); };
      p.on("pointerenter focus", showTip).on("pointerleave blur", () => { tt.hide(); p.attr("opacity", 1); });
      // label only the extreme (the record opening)
      if (i === 0) svg.append("text").attr("class", "lbl").attr("x", x(r.week) + x.bandwidth() / 2).attr("y", y(r.weekend) - 8).attr("text-anchor", "middle").text(money(r.weekend, 1));
    });
  }

  // ---------- horizontal emphasis bars (franchise, all-time) -------------------
  function hbars(el, width, animate, rows, opts) {
    const rowH = 34;
    const labelW = width < 560 ? 0 : Math.min(300, width * .36);
    const m = { t: 8, r: 90, b: 8, l: labelW ? labelW + 12 : 8 };
    const h = m.t + m.b + rows.length * (rowH + (labelW ? 0 : 20));
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${width} ${h}`).attr("role", "img").attr("aria-label", opts.aria);
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.world) * 1.02]).range([m.l, width - m.r]);
    const y = (i) => m.t + i * (rowH + (labelW ? 0 : 20)) + (labelW ? 0 : 20);
    const accent = css("--viz-accent"), muted = css("--viz-muted");
    const tt = tip(el);
    svg.append("g").attr("class", "grid").selectAll("line").data(x.ticks(4)).join("line").attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", m.t).attr("y2", h - m.b);
    rows.forEach((r, i) => {
      const yy = y(i), bw = 18, by = yy + (rowH - bw) / 2;
      const lblX = labelW ? m.l - 12 : m.l;
      svg.append("text").attr("class", r.current ? "lbl" : "lbl lbl--muted").attr("x", lblX).attr("y", labelW ? yy + rowH / 2 + 4 : yy - 4).attr("text-anchor", labelW ? "end" : "start").text(opts.label(r));
      const full = x(r.world) - m.l;
      const bar = (w) => { const rr = Math.min(4, w); return `M${m.l},${by}H${m.l + w - rr}Q${m.l + w},${by} ${m.l + w},${by + rr}V${by + bw - rr}Q${m.l + w},${by + bw} ${m.l + w - rr},${by + bw}H${m.l}Z`; };
      const p = svg.append("path").attr("fill", r.current ? accent : muted).attr("d", bar(animate ? 0 : full)).attr("tabindex", 0).attr("aria-label", `${opts.label(r)}: ${money(r.world, 2)}`);
      if (animate) p.transition().delay(i * 60).duration(900).ease(d3.easeCubicOut).attrTween("d", () => (t) => bar(Math.max(.01, full * t)));
      svg.append("text").attr("class", r.current ? "lbl" : "lbl lbl--muted").attr("x", x(r.world) + 8).attr("y", by + bw / 2 + 4).text(money(r.world, r.world >= 1e9 ? 2 : 0));
      const hitR = svg.append("rect").attr("x", 0).attr("y", yy - (labelW ? 0 : 20)).attr("width", width).attr("height", rowH + (labelW ? 0 : 20)).attr("fill", "transparent");
      const showTip = () => { const k = el.clientWidth / width; tt.show(x(r.world) * k, by * k, tipRows(opts.label(r), money(r.world, 2), opts.sub(r), r.current ? accent : muted)); };
      hitR.on("pointerenter", showTip).on("pointerleave", () => tt.hide());
      p.on("focus", showTip).on("blur", () => tt.hide());
    });
  }

  // ---------- data tables (the WCAG twin of every chart) ------------------------
  function table(id, head, rows) {
    const host = document.getElementById(id);
    if (!host) return;
    const t = S.h("table", {},
      S.h("thead", {}, S.h("tr", {}, head.map((c) => S.h("th", { scope: "col", class: c.num ? "num" : "", text: c.label })))),
      S.h("tbody", {}, rows.map((r) => S.h("tr", {}, r.map((v, i) => S.h("td", { class: head[i].num ? "num" : "", text: v }))))));
    host.replaceChildren(t);
  }

  S.initCharts = function (data) {
    if (!window.d3) {
      document.querySelectorAll(".chart__svg").forEach((el) => el.append(S.h("p", { class: "note", text: "График не загрузился: библиотека D3 недоступна. Все значения есть в таблице ниже." })));
      document.querySelectorAll(".datatable").forEach((t) => t.classList.add("is-open"));
    }
    const W = data.boxOffice.weekly;
    const q = (id) => document.getElementById(id);
    if (q("chart-cumulative") && window.d3) mount(q("chart-cumulative"), (el, w, a) => cumulative(el, w, a, data, false));
    if (q("chart-mini") && window.d3) mount(q("chart-mini"), (el, w, a) => cumulative(el, w, a, data, true));
    if (q("chart-weekends") && window.d3) mount(q("chart-weekends"), (el, w, a) => weekends(el, w, a, data));
    if (q("chart-franchise") && window.d3) mount(q("chart-franchise"), (el, w, a) => hbars(el, w, a, data.franchise.slice().sort((x, y) => y.world - x.world), {
      aria: "Мировые сборы фильмов о Человеке-пауке", label: (r) => `${r.title.replace("Человек-паук: ", "")} (${r.year})`, sub: (r) => r.actor }));
    if (q("chart-alltime") && window.d3) mount(q("chart-alltime"), (el, w, a) => hbars(el, w, a, data.boxOffice.allTimeTop, {
      aria: "Пять самых кассовых фильмов в истории", label: (r) => `${r.title} (${r.year})`, sub: (r) => (r.current ? "3-е место" : "") }));

    table("t-cumulative", [{ label: "Уик-энд" }, { label: "Даты" }, { label: "За уик-энд", num: true }, { label: "Всего в США", num: true }],
      W.map((r) => [r.week, r.label, money(r.weekend, 1), money(r.cumulative, 1)]));
    table("t-mini", [{ label: "Уик-энд" }, { label: "Всего в США", num: true }], W.map((r) => [r.label, money(r.cumulative, 1)]));
    table("t-weekends", [{ label: "Даты" }, { label: "За уик-энд", num: true }, { label: "Изменение", num: true }],
      W.map((r, i) => [r.label, money(r.weekend, 1), i ? Math.round((r.weekend / W[i - 1].weekend - 1) * 100) + "%" : "—"]));
    table("t-franchise", [{ label: "Фильм" }, { label: "Год", num: true }, { label: "Сборы в мире", num: true }],
      data.franchise.map((r) => [r.title, r.year, money(r.world, 2)]));
    table("t-alltime", [{ label: "Место", num: true }, { label: "Фильм" }, { label: "Сборы в мире", num: true }],
      data.boxOffice.allTimeTop.map((r, i) => [i + 1, `${r.title} (${r.year})`, money(r.world, 2)]));
  };
})();
