import { renderSlide, renderSlideNav, escapeHtml } from "../ui/slide.card.js";

const VALID_ID = /^m\d+$/;

const state = {
  deck: null,
  modules: [],
  index: 0,
};

function el(id) {
  return document.getElementById(id);
}

function moduleId() {
  return new URLSearchParams(window.location.search).get("id") ?? "m1";
}

function startIndex(total) {
  const raw = Number(new URLSearchParams(window.location.search).get("s"));
  if (!Number.isInteger(raw)) return 0;

  return Math.min(Math.max(raw - 1, 0), total - 1);
}

function showError(message) {
  el("stage").innerHTML = `
    <article class="slide slide--error">
      <h2 class="slide-title">Slide deck not available</h2>
      <p class="slide-lead">${escapeHtml(message)}</p>
      <a class="chip doc" href="./index.html">
        <i class="fa-solid fa-arrow-left resource-icon"></i>
        Back to the course outline
      </a>
    </article>
  `;
  el("deckKicker").textContent = "not found";
  el("moduleTitle").textContent = "Slides";
  el("deckBottom").innerHTML = "";
}

function renderModuleSwitch() {
  const at = state.modules.findIndex((m) => m.id === state.deck.id);
  const prev = at > 0 ? state.modules[at - 1] : null;
  const next = at > -1 ? state.modules[at + 1] : null;

  el("moduleSwitch").innerHTML = `
    ${
      prev
        ? `<a class="module-switch" href="./slide?id=${prev.id}">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous module</em>${escapeHtml(prev.title)}</span>
           </a>`
        : ""
    }
    ${
      next
        ? `<a class="module-switch" href="./slide?id=${next.id}">
             <i class="fa-solid fa-angle-right"></i>
             <span><em>Next module</em>${escapeHtml(next.title)}</span>
           </a>`
        : ""
    }
  `;
}

function renderChrome() {
  const { deck } = state;

  document.title = `${deck.title} — Slides`;
  el("moduleTitle").textContent = deck.title;
  el("slideNav").innerHTML = renderSlideNav(deck.slides, state.index);
  renderModuleSwitch();
}

function renderFooter() {
  const { deck, index } = state;
  const prev = deck.slides[index - 1];
  const next = deck.slides[index + 1];

  el("deckBottom").innerHTML = `
    ${
      prev
        ? `<button class="deck-step" type="button" data-step="-1">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous</em>${escapeHtml(prev.title)}</span>
           </button>`
        : "<span></span>"
    }
    ${
      next
        ? `<button class="deck-step deck-step--next" type="button" data-step="1">
             <span><em>Next</em>${escapeHtml(next.title)}</span>
             <i class="fa-solid fa-angle-right"></i>
           </button>`
        : `<a class="deck-step deck-step--next" href="./index.html">
             <span><em>End of deck</em>Back to the outline</span>
             <i class="fa-solid fa-flag-checkered"></i>
           </a>`
    }
  `;
}

/* ---------- Full screen ---------- */

function isPresenting() {
  return document.querySelector(".deck").classList.contains("is-fullscreen");
}

/**
 * Presenting is driven by a class, not by the Fullscreen API alone — the API
 * is refused in some embedded contexts, and the deck should still fill the
 * window there. Native full screen is requested on top when it is allowed.
 */
function setPresenting(on) {
  const deck = document.querySelector(".deck");
  const btn = el("fullscreenBtn");

  deck.classList.toggle("is-fullscreen", on);
  btn.innerHTML = `<i class="fa-solid fa-${on ? "compress" : "expand"}"></i>`;
  btn.title = on ? "Exit presenting (Esc)" : "Present full screen (F)";
}

function toggleFullscreen() {
  const on = !isPresenting();
  setPresenting(on);

  if (on) {
    document
      .querySelector(".deck")
      .requestFullscreen?.()
      .catch((err) => {
        // Still presenting in-window; only the native mode was declined.
        console.warn("Native full screen unavailable:", err.message);
      });
  } else if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}

/* Leaving native full screen (Esc, F11) drops the in-page mode with it. */
function syncFullscreenBtn() {
  if (!document.fullscreenElement && isPresenting()) setPresenting(false);
}

/* ---------- Print / save as PDF ---------- */

/**
 * Renders every slide into the hidden print sheet — one page each.
 * Built on demand so normal browsing only ever holds one slide in the DOM.
 */
function buildPrintSheet() {
  const { deck } = state;
  if (!deck) return;

  const total = deck.slides.length;

  el("printSheet").innerHTML = deck.slides
    .map(
      (slide, index) => `
        <div class="print-page">
          ${renderSlide(slide, index, deck)}
          <div class="print-foot">
            <span>Module ${escapeHtml(deck.number)} · ${escapeHtml(deck.title)}</span>
            <span>${index + 1} / ${total}</span>
          </div>
        </div>
      `,
    )
    .join("");
}

function printDeck() {
  buildPrintSheet();
  window.print();
}

function render() {
  const { deck, index } = state;
  const slide = deck.slides[index];
  const total = deck.slides.length;

  el("stage").innerHTML = renderSlide(slide, index, deck);
  el("stage").scrollTop = 0;

  el("deckKicker").textContent = `${deck.title} · ${slide.topic ?? ""}`.trim();
  el("slideCounter").textContent = `${index + 1} / ${total}`;
  el("prevBtn").disabled = index === 0;
  el("nextBtn").disabled = index === total - 1;

  el("progressBar").style.width = `${((index + 1) / total) * 100}%`;
  el("progressLabel").textContent = `${Math.round(((index + 1) / total) * 100)}% complete`;

  document.querySelectorAll(".nav-slide").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.index) === index);
  });

  document
    .querySelector(".nav-slide.active")
    ?.scrollIntoView({ block: "nearest" });

  renderFooter();

  const url = new URL(window.location.href);
  url.searchParams.set("s", String(index + 1));
  window.history.replaceState({}, "", url);
}

function goTo(index) {
  const clamped = Math.min(Math.max(index, 0), state.deck.slides.length - 1);
  if (clamped === state.index) return;

  state.index = clamped;
  render();
}

function bindEvents() {
  el("prevBtn").addEventListener("click", () => goTo(state.index - 1));
  el("nextBtn").addEventListener("click", () => goTo(state.index + 1));

  el("slideNav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-slide");
    if (btn) goTo(Number(btn.dataset.index));
  });

  el("deckBottom").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (btn) goTo(state.index + Number(btn.dataset.step));
  });

  el("fullscreenBtn").addEventListener("click", toggleFullscreen);
  el("printBtn").addEventListener("click", printDeck);

  document.addEventListener("fullscreenchange", syncFullscreenBtn);

  // Also covers Ctrl+P and the browser's own print menu.
  window.addEventListener("beforeprint", buildPrintSheet);

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const moves = {
      ArrowRight: () => goTo(state.index + 1),
      ArrowLeft: () => goTo(state.index - 1),
      PageDown: () => goTo(state.index + 1),
      PageUp: () => goTo(state.index - 1),
      " ": () => goTo(state.index + 1),
      Home: () => goTo(0),
      End: () => goTo(state.deck.slides.length - 1),
      f: toggleFullscreen,
      F: toggleFullscreen,
      Escape: () => {
        // Native full screen swallows Esc itself; this covers in-page mode.
        if (isPresenting() && !document.fullscreenElement) setPresenting(false);
      },
    };

    const move = moves[e.key];
    if (!move) return;

    e.preventDefault();
    move();
  });
}

async function loadSlide() {
  const id = moduleId();

  if (!VALID_ID.test(id)) {
    showError(`"${id}" is not a valid module id. Try ./slide?id=m1`);
    return;
  }

  try {
    const [deckRes, modulesRes] = await Promise.all([
      fetch(`./public/documents/${id}.json`),
      fetch("./public/json/modules.json"),
    ]);

    if (!deckRes.ok) {
      throw new Error(`No slide deck exists for module "${id}" yet.`);
    }

    state.deck = await deckRes.json();
    state.modules = modulesRes.ok ? await modulesRes.json() : [];

    if (!state.deck.slides?.length) {
      throw new Error(`The deck for "${id}" has no slides.`);
    }

    state.index = startIndex(state.deck.slides.length);

    renderChrome();
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

export { loadSlide };
