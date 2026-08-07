import {
  buildItems,
  renderReferenceNav,
  renderWatchCard,
} from "../ui/reference.card.js";
import { escapeHtml } from "../ui/slide.card.js";

const VALID_ID = /^m\d+$/;

const state = {
  pack: null,
  entries: [],
  index: 0,
};

function el(id) {
  return document.getElementById(id);
}

function packId() {
  return new URLSearchParams(window.location.search).get("r") ?? "m1";
}

function startIndex(total) {
  const raw = Number(new URLSearchParams(window.location.search).get("v"));
  if (!Number.isInteger(raw)) return 0;

  return Math.min(Math.max(raw - 1, 0), total - 1);
}

function showError(message) {
  el("stage").innerHTML = `
    <article class="slide slide--error">
      <h2 class="slide-title">Nothing to play</h2>
      <p class="slide-lead">${escapeHtml(message)}</p>
      <a class="chip doc" href="./index.html">
        <i class="fa-solid fa-arrow-left resource-icon"></i>
        Back to the course outline
      </a>
    </article>
  `;
  el("watchKicker").textContent = "not found";
  el("moduleTitle").textContent = "Watch";
  el("deckBottom").innerHTML = "";
  el("watchNav").innerHTML = "";
}

function renderFooter() {
  const { entries, index, pack } = state;
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
        : `<a class="deck-step deck-step--next" href="./reference?r=${escapeHtml(pack.id)}">
             <span><em>End of the list</em>All references</span>
             <i class="fa-solid fa-list"></i>
           </a>`
    }
  `;
}

function render() {
  const { pack, entries, index } = state;
  const entry = entries[index];
  const total = entries.length;

  el("stage").innerHTML = renderWatchCard(entry, index, total, pack);
  el("stage").scrollTop = 0;

  el("watchKicker").textContent = `${pack.title} · ${entry.group.topic}`;
  el("watchCounter").textContent = `${index + 1} / ${total}`;
  el("prevBtn").disabled = index === 0;
  el("nextBtn").disabled = index === total - 1;

  el("progressBar").style.width = `${((index + 1) / total) * 100}%`;
  el("progressLabel").textContent = `${index + 1} of ${total} resources`;

  el("watchNav").innerHTML = renderReferenceNav(entries, index);
  document
    .querySelector("#watchNav .nav-slide.active")
    ?.scrollIntoView({ block: "nearest" });

  renderFooter();

  const url = new URL(window.location.href);
  url.searchParams.set("v", String(index + 1));
  window.history.replaceState({}, "", url);
}

function goTo(index) {
  const clamped = Math.min(Math.max(index, 0), state.entries.length - 1);
  if (clamped === state.index) return;

  state.index = clamped;
  render();
}

function bindEvents() {
  el("prevBtn").addEventListener("click", () => goTo(state.index - 1));
  el("nextBtn").addEventListener("click", () => goTo(state.index + 1));

  el("watchNav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-slide");
    if (btn) goTo(Number(btn.dataset.index));
  });

  el("deckBottom").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (btn) goTo(state.index + Number(btn.dataset.step));
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, iframe")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const moves = {
      ArrowRight: () => goTo(state.index + 1),
      ArrowLeft: () => goTo(state.index - 1),
      Home: () => goTo(0),
      End: () => goTo(state.entries.length - 1),
    };

    const move = moves[e.key];
    if (!move) return;

    e.preventDefault();
    move();
  });
}

async function loadWatch() {
  const id = packId();

  if (!VALID_ID.test(id)) {
    showError(`"${id}" is not a valid module id. Try ./watch?r=m1&v=1`);
    return;
  }

  try {
    const res = await fetch(`./public/references/${id}.json`);

    if (!res.ok) {
      throw new Error(`No references exist for module "${id}" yet.`);
    }

    const text = (await res.text()).trim();
    if (!text) {
      throw new Error(`The reference file for "${id}" is empty.`);
    }

    state.pack = JSON.parse(text);

    // Deliberately unfiltered: `?v=` is an index into the library's own flat
    // list, so dropping link-less items here would shift every later link.
    state.entries = buildItems(state.pack);

    if (!state.entries.length) {
      throw new Error(`Module "${id}" has no resources yet.`);
    }

    state.index = startIndex(state.entries.length);

    document.title = `${state.pack.title} — Watch`;
    el("moduleTitle").textContent = state.pack.title;
    el("backToRefs").href = `./reference?r=${state.pack.id}`;

    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

export { loadWatch };
