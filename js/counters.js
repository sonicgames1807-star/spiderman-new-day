/* KPI counters: count 0 -> value once, when the plate first enters the viewport.
   Screen readers get the final value up front via aria-label (set in data.js). */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  function run(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const to = +el.dataset.count;
    const digits = el.dataset.digits != null ? +el.dataset.digits : undefined;
    const kind = el.dataset.fmt || "money";
    const parts = el.hasAttribute("data-parts") ? window.Site.fmt.moneyParts(to, digits) : null;
    const render = (v) => {
      if (parts) return "$" + new Intl.NumberFormat("ru-RU", { minimumFractionDigits: parts.digits, maximumFractionDigits: parts.digits }).format(v / parts.div);
      if (kind === "int") return window.Site.fmt.int(v);
      if (kind === "plain") return String(Math.round(v));
      return window.Site.fmt.money(v, { digits, fixed: true });
    };
    const final = () => (parts ? render(to) : kind === "money" ? window.Site.fmt.money(to, { digits }) : render(to));
    if (reduce) { el.textContent = final(); return; }
    const dur = 1900;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur)); // rAF time can be a hair before t0
      el.textContent = t < 1 ? render(to * easeOutExpo(t)) : final();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  window.Site = window.Site || {};
  window.Site.initCounters = function (root = document) {
    const els = [...root.querySelectorAll("[data-count]")];
    if (!("IntersectionObserver" in window)) return els.forEach(run);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  };
})();
