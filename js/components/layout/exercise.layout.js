import {
  buildEntries,
  renderExerciseCard,
  renderProgressCard,
  renderExerciseNav,
  renderTask,
  isSolved,
  joinLines,
} from "../ui/exercise.card.js";
import { escapeHtml } from "../ui/slide.card.js";
import { runPython, matchesExpected } from "../../lib/python.runner.js";

const VALID_ID = /^m\d+$/;
const INDENT = "    ";

const state = {
  pack: null,
  modules: [],
  /** One entry per exercise, in order — the page shows exactly one of them. */
  entries: [],
  index: 0,
  /** seats[lesson][task] = { code, run, hint, solution } */
  seats: [],
};

function el(id) {
  return document.getElementById(id);
}

function packId() {
  return new URLSearchParams(window.location.search).get("e") ?? "m1";
}

function startIndex(total) {
  const raw = Number(new URLSearchParams(window.location.search).get("x"));
  if (!Number.isInteger(raw)) return 0;

  // total + 1 slots — the last one is the progress card.
  return Math.min(Math.max(raw - 1, 0), total);
}

function isSummary() {
  return state.index === state.entries.length;
}

function current() {
  return state.entries[state.index];
}

function seatOf(entry) {
  return state.seats[entry.lessonIndex][entry.taskIndex];
}

/* ---------- Saved work ----------
   Typed code survives a refresh; figures are dropped because a few base64
   PNGs would blow the storage quota on their own. */

function storageKey() {
  return `ds-exercise:${state.pack.id}`;
}

function save() {
  try {
    const seats = state.seats.map((lesson) =>
      lesson.map(({ code, run }) => ({
        code,
        run: run ? { ...run, images: [] } : null,
      })),
    );
    localStorage.setItem(storageKey(), JSON.stringify(seats));
  } catch {
    // A full or disabled store is not worth interrupting the lesson for.
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
    if (!Array.isArray(saved)) return;

    saved.forEach((lesson, l) =>
      lesson?.forEach((seat, t) => {
        const target = state.seats[l]?.[t];
        if (!target || typeof seat?.code !== "string") return;

        target.code = seat.code;
        target.run = seat.run ?? null;
      }),
    );
  } catch {
    // Ignore anything that does not parse — the starter code stands.
  }
}

/* ---------- Chrome ---------- */

function showError(message) {
  el("stage").innerHTML = `
    <article class="slide slide--error">
      <h2 class="slide-title">Exercises not available</h2>
      <p class="slide-lead">${escapeHtml(message)}</p>
      <a class="chip doc" href="./index.html">
        <i class="fa-solid fa-arrow-left resource-icon"></i>
        Back to the course outline
      </a>
    </article>
  `;
  el("exerciseKicker").textContent = "not found";
  el("moduleTitle").textContent = "Exercises";
  el("deckBottom").innerHTML = "";
}

function renderModuleSwitch() {
  const at = state.modules.findIndex((m) => m.id === state.pack.id);
  const prev = at > 0 ? state.modules[at - 1] : null;
  const next = at > -1 ? state.modules[at + 1] : null;

  el("moduleSwitch").innerHTML = `
    ${
      prev
        ? `<a class="module-switch" href="./exercise?e=${prev.id}">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous exercises</em>${escapeHtml(prev.title)}</span>
           </a>`
        : ""
    }
    ${
      next
        ? `<a class="module-switch" href="./exercise?e=${next.id}">
             <i class="fa-solid fa-angle-right"></i>
             <span><em>Next exercises</em>${escapeHtml(next.title)}</span>
           </a>`
        : ""
    }
  `;
}

function renderChrome() {
  const { pack } = state;

  document.title = `${pack.title} — Exercises`;
  el("moduleTitle").textContent = pack.title;
  renderModuleSwitch();
}

function solvedTotal() {
  return state.entries.filter((entry) => isSolved(seatOf(entry).run)).length;
}

function renderProgress() {
  const solved = solvedTotal();
  const count = state.entries.length;

  el("progressBar").style.width = `${Math.round((solved / count) * 100)}%`;
  el("progressLabel").textContent = `${solved}/${count} exercises solved`;
}

function renderFooter() {
  const { entries, index } = state;
  const onSummary = isSummary();
  const prev = entries[index - 1];
  const next = onSummary ? null : entries[index + 1];

  el("deckBottom").innerHTML = `
    ${
      index > 0
        ? `<button class="deck-step" type="button" data-step="-1">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous</em>${escapeHtml(
               (onSummary ? entries.at(-1) : prev).task.title,
             )}</span>
           </button>`
        : "<span></span>"
    }
    ${
      next
        ? `<button class="deck-step deck-step--next" type="button" data-step="1">
             <span><em>Next</em>${escapeHtml(next.task.title)}</span>
             <i class="fa-solid fa-angle-right"></i>
           </button>`
        : onSummary
          ? `<a class="deck-step deck-step--next" href="./index.html">
               <span><em>Done</em>Back to the outline</span>
               <i class="fa-solid fa-flag-checkered"></i>
             </a>`
          : `<button class="deck-step deck-step--next" type="button" data-step="1">
               <span><em>Finish</em>Your progress</span>
               <i class="fa-solid fa-flag-checkered"></i>
             </button>`
    }
  `;
}

/* An editor grows with its content — a scrollbar inside a code box hides the
   line the student is looking for. */
function autosize(area) {
  if (!area) return;

  area.style.height = "auto";
  area.style.height = `${area.scrollHeight + 2}px`;
}

function autosizeAll() {
  document.querySelectorAll(".ex-code").forEach(autosize);
}

function renderNav() {
  el("exerciseNav").innerHTML = renderExerciseNav(
    state.entries,
    seatOf,
    state.index,
  );
}

function render() {
  const { pack, entries, index } = state;
  const onSummary = isSummary();
  const entry = onSummary ? null : entries[index];

  el("stage").innerHTML = onSummary
    ? renderProgressCard(pack, entries, seatOf)
    : renderExerciseCard(entry, index, entries.length, seatOf(entry));
  el("stage").scrollTop = 0;

  el("exerciseKicker").textContent = onSummary
    ? `${pack.title} · progress`
    : `${pack.title} · ${entry.lesson.topic}`;
  el("lessonCounter").textContent = onSummary
    ? "progress"
    : `${index + 1} / ${entries.length}`;
  el("prevBtn").disabled = index === 0;
  el("nextBtn").disabled = onSummary;

  renderNav();
  renderProgress();
  renderFooter();
  autosizeAll();

  document
    .querySelector(".nav-slide.active")
    ?.scrollIntoView({ block: "nearest" });

  const url = new URL(window.location.href);
  url.searchParams.set("x", String(index + 1));
  window.history.replaceState({}, "", url);
}

/** Repaints the working half only, so the page keeps its scroll position. */
function repaintTask() {
  const entry = current();
  const node = document.querySelector(".ex-task");
  if (!entry || !node) return;

  node.outerHTML = renderTask(entry.task, seatOf(entry));

  autosize(document.querySelector(".ex-code"));
  renderNav();
  renderProgress();
}

function goTo(index) {
  const clamped = Math.min(Math.max(index, 0), state.entries.length);
  if (clamped === state.index) return;

  state.index = clamped;
  render();
}

/* ---------- Running ---------- */

function setRunState(text) {
  const node = document.querySelector("[data-runstate]");
  if (node) node.textContent = text;
}

async function runTask(button) {
  const entry = current();
  const { task, lesson } = entry;
  const seat = seatOf(entry);

  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running';

  const result = await runPython(seat.code, {
    packages: task.packages ?? lesson.packages ?? [],
    onStatus: setRunState,
  });

  seat.run = {
    ...result,
    matched:
      result.failed || result.error
        ? false
        : matchesExpected(result.out, task.expected),
  };

  repaintTask();
  save();
}

function resetSeat(entry) {
  const seat = seatOf(entry);

  seat.code = joinLines(entry.task.starter);
  seat.run = null;
  seat.hint = false;
  seat.solution = false;
}

function onStageClick(e) {
  const goto = e.target.closest("[data-goto]");
  if (goto) {
    goTo(Number(goto.dataset.goto));
    return;
  }

  const trigger = e.target.closest("[data-action]");
  if (!trigger) return;

  const { action } = trigger.dataset;

  if (action === "reset-all") {
    state.entries.forEach(resetSeat);
    save();
    render();
    return;
  }

  if (isSummary()) return;

  const entry = current();
  const seat = seatOf(entry);

  const moves = {
    run: () => runTask(trigger),
    reset: () => {
      seat.code = joinLines(entry.task.starter);
      seat.run = null;
      repaintTask();
      save();
    },
    hint: () => {
      seat.hint = !seat.hint;
      repaintTask();
    },
    solution: () => {
      seat.solution = !seat.solution;
      repaintTask();
    },
    "use-solution": () => {
      seat.code = joinLines(entry.task.solution);
      repaintTask();
      save();
    },
  };

  moves[action]?.();
}

function onEditorInput(e) {
  const area = e.target.closest(".ex-code");
  if (!area || isSummary()) return;

  seatOf(current()).code = area.value;
  autosize(area);
  save();
}

/** Tab indents instead of leaving the editor, and Ctrl+Enter runs. */
function onEditorKeydown(e) {
  const area = e.target.closest(".ex-code");
  if (!area) return;

  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.querySelector('[data-action="run"]')?.click();
    return;
  }

  if (e.key !== "Tab") return;
  e.preventDefault();

  const { selectionStart: from, selectionEnd: to, value } = area;

  if (e.shiftKey) {
    const lineStart = value.lastIndexOf("\n", from - 1) + 1;
    if (value.startsWith(INDENT, lineStart)) {
      area.value =
        value.slice(0, lineStart) + value.slice(lineStart + INDENT.length);
      area.selectionStart = area.selectionEnd = Math.max(
        lineStart,
        from - INDENT.length,
      );
    }
  } else {
    area.value = value.slice(0, from) + INDENT + value.slice(to);
    area.selectionStart = area.selectionEnd = from + INDENT.length;
  }

  area.dispatchEvent(new Event("input", { bubbles: true }));
}

function bindEvents() {
  el("prevBtn").addEventListener("click", () => goTo(state.index - 1));
  el("nextBtn").addEventListener("click", () => goTo(state.index + 1));

  el("exerciseNav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-slide");
    if (btn) goTo(Number(btn.dataset.index));
  });

  el("deckBottom").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (btn) goTo(state.index + Number(btn.dataset.step));
  });

  el("stage").addEventListener("click", onStageClick);
  el("stage").addEventListener("input", onEditorInput);
  el("stage").addEventListener("keydown", onEditorKeydown);

  window.addEventListener("resize", autosizeAll);

  document.addEventListener("keydown", (e) => {
    // Never steal a key from the editor.
    if (e.target.matches("input, textarea, button, a")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const moves = {
      ArrowRight: () => goTo(state.index + 1),
      ArrowLeft: () => goTo(state.index - 1),
      Home: () => goTo(0),
      End: () => goTo(state.entries.length),
    };

    const move = moves[e.key];
    if (!move) return;

    e.preventDefault();
    move();
  });
}

async function loadExercises() {
  const id = packId();

  if (!VALID_ID.test(id)) {
    showError(`"${id}" is not a valid module id. Try ./exercise?e=m1`);
    return;
  }

  try {
    const [packRes, modulesRes] = await Promise.all([
      fetch(`./public/exercise/${id}.json`),
      fetch("./public/json/modules.json"),
    ]);

    if (!packRes.ok) {
      throw new Error(`No exercises exist for module "${id}" yet.`);
    }

    state.pack = await packRes.json();
    state.modules = modulesRes.ok ? await modulesRes.json() : [];

    if (!state.pack.lessons?.length) {
      throw new Error(`The exercises for "${id}" have no lessons.`);
    }

    state.entries = buildEntries(state.pack);

    if (!state.entries.length) {
      throw new Error(`The exercises for "${id}" have no tasks.`);
    }

    state.seats = state.pack.lessons.map((lesson) =>
      lesson.tasks.map((task) => ({
        code: joinLines(task.starter),
        run: null,
        hint: false,
        solution: false,
      })),
    );
    restore();
    state.index = startIndex(state.entries.length);

    renderChrome();
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

export { loadExercises };
