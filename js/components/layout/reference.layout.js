import {
  buildItems,
  destinationFor,
  embedFor,
  renderReferenceCard,
  renderReferenceNav,
  renderWatchCard,
} from "../ui/reference.card.js";
import { escapeHtml } from "../ui/slide.card.js";

const VALID_ID = /^m\d+$/;

/**
 * One page, two views. `?r=` picks the module and `?v=` picks a resource:
 * with no `?v=` the page is the library, with one it is the player. Moving
 * between them is a re-render plus a history entry — never a page load — so
 * the sidebar, the fetch and the scroll position all survive the switch.
 */
const state = {
  pack: null,
  modules: [],
  /** One entry per resource, flattened across groups — `?v=` indexes this. */
  entries: [],
  /** null in the library, the resource index in the player. */
  index: null,
  /** "all" or one of the kinds present in the pack. */
  filter: "all",
};

function el(id) {
  return document.getElementById(id);
}

function isPlaying() {
  return state.index !== null;
}

/* ---------- The url is the view ---------- */

function packId() {
  return new URLSearchParams(window.location.search).get("r") ?? "m1";
}

/** The `?v=` currently in the address bar, clamped, or null for the library. */
function indexFromUrl(total) {
  const raw = Number(new URLSearchParams(window.location.search).get("v"));
  if (!Number.isInteger(raw) || raw < 1) return null;

  return Math.min(raw - 1, total - 1);
}

/**
 * Rewrites `?v=` without touching the path, so the same code works whether
 * the page is served as /reference or /reference.html.
 */
function pushUrl(index, replace = false) {
  const url = new URL(window.location.href);

  if (index === null) url.searchParams.delete("v");
  else url.searchParams.set("v", String(index + 1));

  const move = replace ? "replaceState" : "pushState";
  window.history[move]({ v: index }, "", url);
}

/* ---------- Chrome ---------- */

function showError(message) {
  el("stage").innerHTML = `
    <article class="slide slide--error">
      <h2 class="slide-title">References not available</h2>
      <p class="slide-lead">${escapeHtml(message)}</p>
      <a class="chip doc" href="./index.html">
        <i class="fa-solid fa-arrow-left resource-icon"></i>
        Back to the course outline
      </a>
    </article>
  `;
  el("referenceKicker").textContent = "not found";
  el("moduleTitle").textContent = "References";
  el("deckControls").innerHTML = "";
  el("deckBottom").innerHTML = "";
  el("referenceNav").innerHTML = "";
}

function renderModuleSwitch() {
  const at = state.modules.findIndex((m) => m.id === state.pack.id);
  const prev = at > 0 ? state.modules[at - 1] : null;
  const next = at > -1 ? state.modules[at + 1] : null;

  el("moduleSwitch").innerHTML = `
    ${
      prev
        ? `<a class="module-switch" href="./reference?r=${prev.id}">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous references</em>${escapeHtml(prev.title)}</span>
           </a>`
        : ""
    }
    ${
      next
        ? `<a class="module-switch" href="./reference?r=${next.id}">
             <i class="fa-solid fa-angle-right"></i>
             <span><em>Next references</em>${escapeHtml(next.title)}</span>
           </a>`
        : ""
    }
  `;
}

/** Only the kinds actually present get a filter — an empty tab is noise. */
function filtersHtml() {
  const kinds = [...new Set(state.entries.map((e) => e.item.kind ?? "link"))];

  return [
    { key: "all", label: `All ${state.entries.length}` },
    ...kinds.map((kind) => ({
      key: kind,
      label: `${kind} ${state.entries.filter((e) => (e.item.kind ?? "link") === kind).length}`,
    })),
  ]
    .map(
      ({ key, label }) => `
        <button
          class="ref-filter${state.filter === key ? " active" : ""}"
          type="button"
          data-filter="${escapeHtml(key)}"
        >${escapeHtml(label)}</button>
      `,
    )
    .join("");
}

/** The deck controls belong to the view, so they are rebuilt with it. */
function renderControls() {
  const { entries, index } = state;

  el("deckControls").innerHTML = isPlaying()
    ? `
      <button class="deck-btn" type="button" data-step="-1"
              title="Previous resource (←)" ${index === 0 ? "disabled" : ""}>
        <i class="fa-solid fa-angle-left"></i>
      </button>
      <span class="deck-counter">${index + 1} / ${entries.length}</span>
      <button class="deck-btn" type="button" data-step="1"
              title="Next resource (→)" ${index === entries.length - 1 ? "disabled" : ""}>
        <i class="fa-solid fa-angle-right"></i>
      </button>

      <span class="deck-divider"></span>

      <button class="deck-btn" type="button" data-action="library"
              title="Back to the library (Esc)">
        <i class="fa-solid fa-list"></i>
      </button>
    `
    : `
      <div class="ref-filters">${filtersHtml()}</div>
      <span class="deck-divider"></span>
      <span class="deck-counter">${entries.length} item${entries.length === 1 ? "" : "s"}</span>
    `;
}

function renderFooter() {
  const { pack, entries, index } = state;

  if (!isPlaying()) {
    el("deckBottom").innerHTML = `
      <a class="deck-step" href="./slide?id=${escapeHtml(pack.id)}">
        <i class="fa-solid fa-angle-left"></i>
        <span><em>Back to</em>The slides</span>
      </a>
      <a class="deck-step deck-step--next" href="./exercise?e=${escapeHtml(pack.id)}">
        <span><em>Practise</em>The exercises</span>
        <i class="fa-solid fa-angle-right"></i>
      </a>
    `;
    return;
  }

  const prev = entries[index - 1];
  const next = entries[index + 1];

  el("deckBottom").innerHTML = `
    ${
      prev
        ? `<button class="deck-step" type="button" data-step="-1">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous</em>${escapeHtml(prev.item.title)}</span>
           </button>`
        : "<span></span>"
    }
    ${
      next
        ? `<button class="deck-step deck-step--next" type="button" data-step="1">
             <span><em>Next</em>${escapeHtml(next.item.title)}</span>
             <i class="fa-solid fa-angle-right"></i>
           </button>`
        : `<button class="deck-step deck-step--next" type="button" data-action="library">
             <span><em>End of the list</em>All references</span>
             <i class="fa-solid fa-list"></i>
           </button>`
    }
  `;
}

/** Filtering hides rows rather than re-rendering, so anchors stay valid. */
function applyFilter() {
  document.querySelectorAll(".ref-item").forEach((row) => {
    row.hidden = state.filter !== "all" && row.dataset.kind !== state.filter;
  });

  // A section whose every row is filtered out should go with them.
  document.querySelectorAll(".ref-group").forEach((section) => {
    section.hidden = !section.querySelector(".ref-item:not([hidden])");
  });

  renderControls();
}

function renderSidebar() {
  const { pack, entries, index } = state;
  const watchable = entries.filter((e) => embedFor(e.item)).length;

  el("moduleTitle").textContent = pack.title;
  el("referenceNav").innerHTML = renderReferenceNav(entries, index ?? -1);

  if (isPlaying()) {
    el("progressBar").style.width = `${((index + 1) / entries.length) * 100}%`;
    el("progressLabel").textContent = `${index + 1} of ${entries.length} resources`;
    document
      .querySelector("#referenceNav .nav-slide.active")
      ?.scrollIntoView({ block: "nearest" });
  } else {
    el("progressBar").style.width = entries.length
      ? `${Math.round((watchable / entries.length) * 100)}%`
      : "0%";
    el("progressLabel").textContent = `${watchable} of ${entries.length} play in page`;
  }

  renderModuleSwitch();
}

function render() {
  const { pack, entries, index } = state;
  const playing = isPlaying();

  el("stage").innerHTML = playing
    ? renderWatchCard(entries[index], index, entries.length, pack)
    : renderReferenceCard(pack, entries);
  el("stage").scrollTop = 0;

  document.title = playing
    ? `${entries[index].item.title} — ${pack.title}`
    : `${pack.title} — References`;
  el("referenceKicker").textContent = playing
    ? `${pack.title} · ${entries[index].group.topic}`
    : `${pack.title} · references`;

  el("stage").classList.toggle("is-playing", playing);

  renderSidebar();
  renderControls();
  renderFooter();

  if (!playing) applyFilter();
}

/** Switches view in place. `index` of null is the library. */
function goTo(index, { push = true } = {}) {
  const clamped =
    index === null
      ? null
      : Math.min(Math.max(index, 0), state.entries.length - 1);

  if (clamped === state.index) return;

  state.index = clamped;
  if (push) pushUrl(clamped);
  render();
}

/** Jumps the library to a resource and flags it, without changing view. */
function revealItem(index) {
  const row = document.querySelectorAll(".ref-item")[index];
  if (!row) return;

  // A filtered-out row cannot be scrolled to — widen the view first.
  if (row.hidden) {
    state.filter = "all";
    applyFilter();
  }

  row.scrollIntoView({ block: "center", behavior: "smooth" });
  row.classList.add("is-flagged");
  setTimeout(() => row.classList.remove("is-flagged"), 1200);

  document.querySelectorAll("#referenceNav .nav-slide").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.index) === index);
  });
}

function wantsNewTab(e) {
  return e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;
}

/** Opens an external destination, honouring a modifier-click all the same. */
function followExternal(row) {
  if (row.dataset.href) window.open(row.dataset.href, "_blank", "noopener");
}

function onStageClick(e) {
  // The library button lives inside the player card.
  if (e.target.closest('[data-action="library"]')) {
    e.preventDefault();
    goTo(null);
    return;
  }

  // In-site destinations swap the view instead of loading a page — unless a
  // new tab was asked for, in which case the real href does its own job.
  const view = e.target.closest("[data-view]");
  if (view && !wantsNewTab(e)) {
    e.preventDefault();
    goTo(Number(view.dataset.view));
    return;
  }

  // Anchors and buttons navigate themselves.
  if (e.target.closest("a, button")) return;

  const row = e.target.closest(".ref-item[data-href]");
  if (!row) return;

  if (row.dataset.view !== undefined && wantsNewTab(e)) {
    window.open(row.dataset.href, "_blank", "noopener");
  } else {
    followExternal(row);
  }
}

function onNavClick(index) {
  const entry = state.entries[index];
  const to = destinationFor(entry.item, index, state.pack.id);

  if (to?.external) {
    window.open(to.href, "_blank", "noopener");
    return;
  }
  // A resource with no link at all is worth pointing at rather than playing.
  if (!to && !isPlaying()) {
    revealItem(index);
    return;
  }

  goTo(index);
}

function bindEvents() {
  el("referenceNav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-slide");
    if (btn) onNavClick(Number(btn.dataset.index));
  });

  el("stage").addEventListener("click", onStageClick);

  // The row is exposed as a link, so it has to answer Enter like one.
  el("stage").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const row = e.target.closest(".ref-item[data-href]");
    if (!row) return;

    e.preventDefault();
    if (row.dataset.view !== undefined) goTo(Number(row.dataset.view));
    else followExternal(row);
  });

  el("deckControls").addEventListener("click", (e) => {
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      state.filter = filter.dataset.filter;
      applyFilter();
      return;
    }

    const step = e.target.closest("[data-step]");
    if (step && isPlaying()) {
      goTo(state.index + Number(step.dataset.step));
      return;
    }

    if (e.target.closest('[data-action="library"]')) goTo(null);
  });

  el("deckBottom").addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]");
    if (step && isPlaying()) {
      goTo(state.index + Number(step.dataset.step));
      return;
    }

    if (e.target.closest('[data-action="library"]')) goTo(null);
  });

  // Back and forward move between the library and the player.
  window.addEventListener("popstate", () => {
    const next = indexFromUrl(state.entries.length);
    if (next === state.index) return;

    state.index = next;
    render();
  });

  document.addEventListener("keydown", (e) => {
    // The target is not always an element — a keypress with nothing focused
    // arrives on the document, which has no matches().
    if (e.target instanceof Element && e.target.matches("input, textarea, iframe")) {
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!isPlaying()) return;

    const moves = {
      ArrowRight: () => goTo(state.index + 1),
      ArrowLeft: () => goTo(state.index - 1),
      Escape: () => goTo(null),
    };

    const move = moves[e.key];
    if (!move) return;

    e.preventDefault();
    move();
  });
}

async function loadReferences() {
  const id = packId();

  if (!VALID_ID.test(id)) {
    showError(`"${id}" is not a valid module id. Try ./reference?r=m1`);
    return;
  }

  try {
    const [packRes, modulesRes] = await Promise.all([
      fetch(`./public/references/${id}.json`),
      fetch("./public/json/modules.json"),
    ]);

    if (!packRes.ok) {
      throw new Error(`No references exist for module "${id}" yet.`);
    }

    const text = (await packRes.text()).trim();
    if (!text) {
      throw new Error(
        `The reference file for "${id}" is empty. Add resources to public/references/${id}.json`,
      );
    }

    state.pack = JSON.parse(text);
    state.modules = modulesRes.ok ? await modulesRes.json() : [];
    state.entries = buildItems(state.pack);

    if (!state.entries.length) {
      state.index = null;
    } else {
      state.index = indexFromUrl(state.entries.length);
      // A `?v=` that was out of range is corrected in place, so a reload and
      // the back button both land on what is actually on screen.
      pushUrl(state.index, true);
    }

    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

export { loadReferences };
