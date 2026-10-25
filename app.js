const I18N = {
  cs: {
    mark: "zdarma",
    tagline: "Vernisáže, klubové noci, koncerty, přednášky a jiné akce v Praze, na které se nic neplatí. Aktualizováno každé ráno.",
    when: { today: "dnes", tomorrow: "zítra", weekend: "víkend", week: "7 dní", all: "vše" },
    cats: { all: "vše", opening: "vernisáže", club: "klub", music: "hudba", talk: "přednášky", art: "umění",
            stage: "divadlo", film: "film", city: "město", kids: "děti" },
    search: "hledat…",
    sources: "Zdroje:",
    disclaimer: "Před cestou si vše ověřte u pořadatele.",
    updated: "Aktualizováno",
    count: n => `${n} ${n === 1 ? "akce" : n >= 2 && n <= 4 ? "akce" : "akcí"}`,
    none: "Nic tu není. Zkuste jiný den.",
    ongoing: "Probíhá", until: "do",
    free: "zdarma", likely: "asi zdarma", donation: "dobrovolné",
    details: "detail", map: "mapa", allDay: "—",
  },
  en: {
    mark: "free",
    tagline: "Openings, club nights, concerts, talks and other things in Prague that cost nothing. Updated every morning.",
    when: { today: "today", tomorrow: "tomorrow", weekend: "weekend", week: "7 days", all: "all" },
    cats: { all: "all", opening: "openings", club: "club", music: "music", talk: "talks", art: "art",
            stage: "stage", film: "film", city: "city", kids: "kids" },
    search: "search…",
    sources: "Sources:",
    disclaimer: "Always check with the organiser before you go.",
    updated: "Updated",
    count: n => `${n} event${n === 1 ? "" : "s"}`,
    none: "Nothing here. Try another day.",
    ongoing: "Ongoing", until: "until",
    free: "free", likely: "free?", donation: "donation",
    details: "details", map: "map", allDay: "—",
  },
};
const WHEN = ["today", "tomorrow", "weekend", "week", "all"];
const CATS = ["all", "opening", "club", "music", "talk", "art", "stage", "film", "city", "kids"];
const ONGOING_DAYS = 3;

const state = {
  lang: localStorage.getItem("lang") || (navigator.language.startsWith("cs") ? "cs" : "en"),
  when: "week",
  cat: "all",
  q: "",
  events: [],
};

const $ = sel => document.querySelector(sel);
const t = key => I18N[state.lang][key];
const pick = obj => (obj && (obj[state.lang] || obj.cs || obj.en || Object.values(obj)[0])) || "";
const locale = () => (state.lang === "cs" ? "cs-CZ" : "en-GB");

// Dates are "YYYY-MM-DD" strings in Prague time throughout.
const ymd = d => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
function addDays(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = day => new Date(day + "T12:00:00Z").getUTCDay(); // 0 = Sunday
const fmt = (day, opts) => new Date(day + "T12:00:00Z").toLocaleDateString(locale(), { timeZone: "UTC", ...opts });

function range(when) {
  const today = ymd(new Date());
  switch (when) {
    case "today": return [today, today];
    case "tomorrow": return [addDays(today, 1), addDays(today, 1)];
    case "weekend": {
      const wd = weekday(today);
      const sat = wd === 0 ? addDays(today, -1) : addDays(today, 6 - wd);
      return [wd === 0 || wd === 6 ? today : sat, addDays(sat, 1)];
    }
    case "week": return [today, addDays(today, 6)];
    default: return [today, "9999-12-31"];
  }
}

// One item per date an event happens in range, or one "ongoing" item for long runs.
function occurrences(events, [from, to]) {
  const now = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Prague" }).replace(" ", "T").slice(0, 16);
  const out = [];
  for (const ev of events) {
    for (const d of ev.dates) {
      const s = d.start.slice(0, 10), e = d.end.slice(0, 10);
      if (e < from || s > to) continue;
      if (d.end !== d.start && d.end < now) continue; // already over today
      if (e > addDays(s, ONGOING_DAYS - 1)) {
        out.push({ day: "ongoing", ev, date: d });
        break;
      }
      out.push({ day: s < from ? from : s, ev, date: d });
    }
  }
  return out;
}

function matchesCat(ev) {
  if (state.cat === "all") return ev.cat !== "kids"; // kids' events would drown everything else
  return ev.cat === state.cat;
}
function matchesQuery(ev) {
  if (!state.q) return true;
  const hay = [...Object.values(ev.name), ...Object.values(ev.summary || {}), ev.venue, ev.area]
    .join(" ").toLocaleLowerCase();
  return state.q.toLocaleLowerCase().split(/\s+/).every(w => hay.includes(w));
}

function time(date) {
  const s = date.start.slice(11, 16), e = date.end.slice(11, 16);
  if (s === "00:00") return t("allDay");
  return s;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v; else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null && c !== "") node.append(c);
  return node;
}

function freeLabel(ev) {
  if (ev.free === true) return t("free");
  if (ev.free === "likely") return t("likely");
  if (ev.free === "donation") return t("donation");
  return ev.note || "";
}

function row({ ev, date, day }) {
  const when = day === "ongoing" ? `${t("until")} ${fmt(date.end.slice(0, 10), { day: "numeric", month: "numeric" })}` : time(date);
  const place = [ev.venue, ev.area].filter(Boolean).join(", ");
  const mapUrl = ev.lat
    ? `https://mapy.cz/zakladni?q=${ev.lat},${ev.lng}&z=17`
    : ev.venue ? `https://mapy.cz/zakladni?q=${encodeURIComponent(ev.venue + ", Praha")}` : null;
  const url = pick(ev.url);
  const summary = pick(ev.summary);
  return el("details", {},
    el("summary", {},
      el("span", { class: "t" }, when),
      el("span", { class: "n" }, pick(ev.name)),
      el("span", { class: "v" }, place),
      el("span", { class: "c" }, el("em", {}, freeLabel(ev)), t("cats")[ev.cat] || ""),
    ),
    el("div", { class: "more" },
      summary ? el("p", {}, summary) : null,
      el("p", { class: "links" },
        url ? el("a", { href: url, target: "_blank", rel: "noopener" }, `${t("details")} ↗`) : null,
        mapUrl ? el("a", { href: mapUrl, target: "_blank", rel: "noopener" }, `${t("map")} ↗`) : null,
        el("span", {}, [ev.source, ...(ev.also || [])].join(" · ")),
      ),
    ),
  );
}

function buttons(container, keys, labels, current, onPick, counts) {
  container.replaceChildren(...keys.map(k => {
    const b = el("button", { class: k === current ? "on" : null }, labels[k]);
    if (counts && counts[k] != null) b.append(el("sup", {}, String(counts[k])));
    b.addEventListener("click", () => onPick(k));
    return b;
  }));
}

function render() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === state.lang));
  document.title = `${t("mark")}/praha`;
  $("#q").placeholder = t("search");

  const inRange = occurrences(state.events.filter(matchesQuery), range(state.when));
  const counts = { all: new Set(inRange.filter(i => i.ev.cat !== "kids").map(i => i.ev.id)).size };
  for (const c of CATS.slice(1)) counts[c] = new Set(inRange.filter(i => i.ev.cat === c).map(i => i.ev.id)).size;

  buttons($("#when"), WHEN, t("when"), state.when, k => { state.when = k; render(); });
  const shownCats = CATS.filter(c => c === "all" || c === state.cat || counts[c] > 0);
  buttons($("#cats"), shownCats, t("cats"), state.cat, k => { state.cat = k; render(); }, counts);

  const items = inRange.filter(i => matchesCat(i.ev));
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.day)) groups.set(it.day, []);
    groups.get(it.day).push(it);
  }
  const days = [...groups.keys()].filter(d => d !== "ongoing").sort();
  if (groups.has("ongoing")) days.push("ongoing");

  const today = ymd(new Date());
  $("#list").replaceChildren(...days.map(day => {
    const its = groups.get(day).sort((a, b) => a.date.start.localeCompare(b.date.start));
    const head = day === "ongoing"
      ? el("h2", {}, el("b", {}, t("ongoing")))
      : el("h2", {},
          el("b", {}, fmt(day, { day: "numeric", month: "numeric" }).replace(/\s/g, "")),
          el("span", {}, day === today ? t("when").today : fmt(day, { weekday: "long" })));
    return el("section", { class: "day" }, head, el("div", {}, ...its.map(row)));
  }));
  if (!days.length) $("#list").append(el("p", { class: "empty" }, t("none")));

  $("#count").textContent = t("count")(new Set(items.map(i => i.ev.id)).size);
  if (state.generated) {
    $("#updated").textContent = `${t("updated")} ${new Date(state.generated).toLocaleString(locale(),
      { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  }
}

async function init() {
  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
    state.lang = b.dataset.lang;
    localStorage.setItem("lang", state.lang);
    render();
  }));
  $("#q").addEventListener("input", e => { state.q = e.target.value.trim(); render(); });

  const res = await fetch("data/events.json", { cache: "no-cache" });
  const data = await res.json();
  state.events = data.events;
  state.generated = data.generated;
  render();
}

init();
