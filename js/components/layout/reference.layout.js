import {
  buildItems,
  embedFor,
  renderReferenceCard,
  renderReferenceNav,
} from "../ui/reference.card.js";
import { escapeHtml } from "../ui/slide.card.js";

const VALID_ID = /^m\d+$/;

const state = {
  pack: null,
  modules: [],
  /** One entry per resource, flattened across groups — `?v=` indexes this. */
  entries: [],
  /** "all" or one of the kinds present in the pack. */
  filter: "all",
};

function el(id) {
  return document.getElementById(id);
}

function packId() {
  return new URLSearchParams(window.location.search).get("r") ?? "m1";
}

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
function renderFilters() {
  const kinds = [...new Set(state.entries.map((e) => e.item.kind ?? "link"))];

  el("referenceFilters").innerHTML = [
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

/** Filtering hides rows rather than re-rendering, so anchors stay valid. */
function applyFilter() {
  document.querySelectorAll(".ref-item").forEach((row) => {
    const show = state.filter === "all" || row.dataset.kind === state.filter;
    row.hidden = !show;
  });

  // A section whose every row is filtered out should go with them.
  document.querySelectorAll(".ref-group").forEach((section) => {
    const visible = section.querySelectorAll(".ref-item:not([hidden])").length;
    section.hidden = visible === 0;
  });

  renderFilters();
}

function renderChrome() {
  const { pack, entries } = state;
  const watchable = entries.filter((e) => embedFor(e.item)).length;

  document.title = `${pack.title} — References`;
  el("moduleTitle").textContent = pack.title;
  el("referenceKicker").textContent = `${pack.title} · references`;
  el("referenceCounter").textContent = `${entries.length} item${entries.length === 1 ? "" : "s"}`;

  el("progressBar").style.width = entries.length
    ? `${Math.round((watchable / entries.length) * 100)}%`
    : "0%";
  el("progressLabel").textContent = `${watchable} of ${entries.length} play in page`;

  renderModuleSwitch();
}

function renderFooter() {
  const { pack } = state;

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
}

function render() {
  const { pack, entries } = state;

  el("stage").innerHTML = renderReferenceCard(pack, entries);
  el("referenceNav").innerHTML = renderReferenceNav(entries, -1);

  renderChrome();
  renderFilters();
  renderFooter();
  applyFilter();
}

/** Jumps the page to a resource and flags it, without leaving the library. */
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

function bindEvents() {
  el("referenceNav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-slide");
    if (btn) revealItem(Number(btn.dataset.index));
  });

  el("referenceFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;

    state.filter = btn.dataset.filter;
    applyFilter();
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

    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

export { loadReferences };
