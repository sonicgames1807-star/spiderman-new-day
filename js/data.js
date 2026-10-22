/* Data layer: loads data/data.json (or the inlined copy from data/data.js when
   the site is opened from file://), formats numbers the Russian way and fills
   every [data-bind] in the markup. No figure is hard-coded in HTML. */
(function () {
  const NBSP = " ";

  const fmt = {
    int(n) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); },
    // "$2,48 млрд", "$944,5 млн", "$360 млн"
    money(n, opts = {}) {
      const abs = Math.abs(n);
      let v, unit;
      if (abs >= 1e9) { v = n / 1e9; unit = "млрд"; }
      else if (abs >= 1e6) { v = n / 1e6; unit = "млн"; }
      else return "$" + fmt.int(n);
      const digits = opts.digits != null ? opts.digits : (unit === "млрд" ? 2 : (v < 100 ? 1 : 0));
      let s = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: opts.fixed ? digits : 0, maximumFractionDigits: digits }).format(v);
      return "$" + s + NBSP + unit;
    },
    // "$2,48" + "млрд": the unit is set apart so the number can be large
    moneyParts(n, digits) {
      const abs = Math.abs(n);
      const [div, unit] = abs >= 1e9 ? [1e9, "млрд"] : abs >= 1e6 ? [1e6, "млн"] : [1, ""];
      const d = digits != null ? digits : (unit === "млрд" ? 2 : (n / div < 100 ? 1 : 0));
      const num = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n / div);
      return { num: "$" + num, unit, div, digits: d };
    },
    date(iso) {
      const d = new Date(iso + "T12:00:00");
      return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d).replace(" г.", "");
    },
    dateShort(iso) {
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y}`;
    },
    pct(n) { return (n > 0 ? "+" : "") + Math.round(n) + "%"; }
  };

  // Russian typography: nbsp before a dash, after one-letter words, between a number and its unit
  function typo(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/ — /g, NBSP + "— ")
      .replace(/(^|[\s(«])([ВвКкСсУуОоИиАаЯя]) /g, "$1$2" + NBSP)
      .replace(/(\d) (млн|млрд|дн|дня|дней|минут|раз|стран|рецензи|%)/g, "$1" + NBSP + "$2");
  }

  function get(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[isFinite(k) ? +k : k]), obj);
  }

  // "Box Office Mojo, The Numbers · 20.09.2026" with real links
  function sourceNode(keys, data, withDate) {
    const p = document.createElement("p");
    p.className = "src";
    const list = (keys || []).map((k) => data.meta.sources[k]).filter(Boolean);
    if (!list.length && !withDate) return p;
    p.append(list.length ? "Источник: " : "");
    const seen = new Set();
    list.forEach((s) => {
      if (seen.has(s.url)) return;
      if (seen.size) p.append(", ");
      seen.add(s.url);
      const a = document.createElement("a");
      a.href = s.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = s.name;
      p.append(a);
    });
    if (withDate) p.append((list.length ? " / " : "") + "данные на " + fmt.dateShort(withDate));
    return p;
  }

  function bind(root, data) {
    root.querySelectorAll("[data-bind]").forEach((el) => {
      const v = get(data, el.dataset.bind);
      if (v == null) return;
      const f = el.dataset.fmt;
      let out = v;
      if (f === "money") out = fmt.money(v, { digits: el.dataset.digits != null ? +el.dataset.digits : undefined });
      else if (f === "int") out = fmt.int(v);
      else if (f === "date") out = fmt.date(v);
      else if (f === "dateShort") out = fmt.dateShort(v);
      // counters read the raw value from data-count and animate themselves
      if (el.hasAttribute("data-count")) {
        el.dataset.count = v;
        el.setAttribute("aria-label", fmt.money(v, { digits: el.dataset.digits != null ? +el.dataset.digits : undefined }));
      }
      el.textContent = typo(String(out));
    });
    root.querySelectorAll("[data-src]").forEach((el) => {
      const keys = el.dataset.src.split(",").map((s) => s.trim()).filter(Boolean);
      const node = sourceNode(keys, data, el.dataset.asof ? get(data, el.dataset.asof) || el.dataset.asof : null);
      el.replaceWith(node);
    });
  }

  async function load() {
    if (window.SITE_DATA) return window.SITE_DATA;
    const res = await fetch("data/data.json");
    if (!res.ok) throw new Error("data.json: " + res.status);
    return res.json();
  }

  window.Site = window.Site || {};
  Object.assign(window.Site, { fmt, get, sourceNode, bind, NBSP, typo });
  window.Site.ready = load().then((data) => {
    window.Site.data = data;
    bind(document, data);
    return data;
  });
})();
