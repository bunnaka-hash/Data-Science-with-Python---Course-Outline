import {
  renderQuizCard,
  renderResultCard,
  renderQuizNav,
  scoreLesson,
} from "../ui/quiz.card.js";
import { escapeHtml } from "../ui/slide.card.js";

const VALID_ID = /^m\d+$/;

const state = {
  quiz: null,
  modules: [],
  index: 0,
  /** answers[lesson][question] = array of picked option indexes */
  answers: [],
  /** checked[lesson] = the lesson has been marked */
  checked: [],
};

function el(id) {
  return document.getElementById(id);
}

function quizId() {
  return new URLSearchParams(window.location.search).get("q") ?? "m1";
}

function startIndex(total) {
  const raw = Number(new URLSearchParams(window.location.search).get("l"));
  if (!Number.isInteger(raw)) return 0;

  // total + 1 slots — the last one is the results card.
  return Math.min(Math.max(raw - 1, 0), total);
}

function isResults() {
  return state.index === state.quiz.lessons.length;
}

function showError(message) {
  el("stage").innerHTML = `
    <article class="slide slide--error">
      <h2 class="slide-title">Quiz not available</h2>
      <p class="slide-lead">${escapeHtml(message)}</p>
      <a class="chip doc" href="./index.html">
        <i class="fa-solid fa-arrow-left resource-icon"></i>
        Back to the course outline
      </a>
    </article>
  `;
  el("quizKicker").textContent = "not found";
  el("moduleTitle").textContent = "Quiz";
  el("deckBottom").innerHTML = "";
}

/* ---------- Scoring ---------- */

function totals() {
  const { quiz, answers, checked } = state;

  return quiz.lessons.reduce(
    (acc, lesson, i) => {
      acc.count += lesson.questions.length;
      if (checked[i]) {
        acc.score += scoreLesson(lesson, answers[i]);
        acc.done += 1;
      }
      return acc;
    },
    { score: 0, count: 0, done: 0 },
  );
}

/* ---------- Chrome ---------- */

function renderModuleSwitch() {
  const at = state.modules.findIndex((m) => m.id === state.quiz.id);
  const prev = at > 0 ? state.modules[at - 1] : null;
  const next = at > -1 ? state.modules[at + 1] : null;

  el("moduleSwitch").innerHTML = `
    ${
      prev
        ? `<a class="module-switch" href="./quiz?q=${prev.id}">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous quiz</em>${escapeHtml(prev.title)}</span>
           </a>`
        : ""
    }
    ${
      next
        ? `<a class="module-switch" href="./quiz?q=${next.id}">
             <i class="fa-solid fa-angle-right"></i>
             <span><em>Next quiz</em>${escapeHtml(next.title)}</span>
           </a>`
        : ""
    }
  `;
}

function renderChrome() {
  const { quiz } = state;
  const questions = quiz.lessons.reduce((n, l) => n + l.questions.length, 0);

  document.title = `${quiz.title} — Quiz`;
  el("moduleTitle").textContent = quiz.title;
  renderModuleSwitch();
}

function renderNav() {
  el("quizNav").innerHTML = renderQuizNav(
    state.quiz,
    state.answers,
    state.checked,
    state.index,
  );
}

function renderFooter() {
  const { quiz, index } = state;
  const prev = quiz.lessons[index - 1];
  const onResults = isResults();
  const next = onResults ? null : quiz.lessons[index + 1];

  el("deckBottom").innerHTML = `
    ${
      index > 0
        ? `<button class="deck-step" type="button" data-step="-1">
             <i class="fa-solid fa-angle-left"></i>
             <span><em>Previous</em>${escapeHtml(onResults ? quiz.lessons.at(-1).topic : prev.topic)}</span>
           </button>`
        : "<span></span>"
    }
    ${
      next
        ? `<button class="deck-step deck-step--next" type="button" data-step="1">
             <span><em>Next</em>${escapeHtml(next.topic)}</span>
             <i class="fa-solid fa-angle-right"></i>
           </button>`
        : onResults
          ? `<a class="deck-step deck-step--next" href="./index.html">
               <span><em>Done</em>Back to the outline</span>
               <i class="fa-solid fa-flag-checkered"></i>
             </a>`
          : `<button class="deck-step deck-step--next" type="button" data-step="1">
               <span><em>Finish</em>Your results</span>
               <i class="fa-solid fa-flag-checkered"></i>
             </button>`
    }
  `;
}

function renderProgress() {
  const { quiz } = state;
  const { score, count, done } = totals();
  const percent = Math.round((done / quiz.lessons.length) * 100);

  el("progressBar").style.width = `${percent}%`;
  el("progressLabel").textContent = done
    ? `${done}/${quiz.lessons.length} lessons checked · ${score}/${count} correct`
    : `${quiz.lessons.length} lessons · not started`;
}

/* ---------- Render ---------- */

function render() {
  const { quiz, index } = state;
  const onResults = isResults();

  el("stage").innerHTML = onResults
    ? renderResultCard(quiz, state.answers, state.checked)
    : renderQuizCard(
        quiz.lessons[index],
        index,
        quiz,
        state.answers[index],
        state.checked[index],
      );
  el("stage").scrollTop = 0;

  el("quizKicker").textContent = onResults
    ? `${quiz.title} · results`
    : `${quiz.title} · ${quiz.lessons[index].topic}`;
  el("lessonCounter").textContent = onResults
    ? "results"
    : `${index + 1} / ${quiz.lessons.length}`;
  el("prevBtn").disabled = index === 0;
  el("nextBtn").disabled = onResults;

  renderNav();
  renderProgress();
  renderFooter();

  document
    .querySelector(".nav-slide.active")
    ?.scrollIntoView({ block: "nearest" });

  const url = new URL(window.location.href);
  url.searchParams.set("l", String(index + 1));
  window.history.replaceState({}, "", url);
}

function goTo(index) {
  const clamped = Math.min(Math.max(index, 0), state.quiz.lessons.length);
  if (clamped === state.index) return;

  state.index = clamped;
  render();
}

/* ---------- Answering ---------- */

function pick(qIndex, optionIndex, multi, on) {
  const picked = state.answers[state.index][qIndex];

  if (!multi) {
    state.answers[state.index][qIndex] = [optionIndex];
    return;
  }

  const at = picked.indexOf(optionIndex);
  if (on && at === -1) picked.push(optionIndex);
  if (!on && at > -1) picked.splice(at, 1);
}

function onAnswerChange(e) {
  const input = e.target.closest(".quiz-options input");
  if (!input || isResults()) return;

  const qIndex = Number(input.closest(".quiz-q").dataset.q);
  pick(qIndex, Number(input.value), input.type === "checkbox", input.checked);
}

function resetLesson(index) {
  state.answers[index] = state.quiz.lessons[index].questions.map(() => []);
  state.checked[index] = false;
}

function onStageClick(e) {
  const goto = e.target.closest("[data-goto]");
  if (goto) {
    goTo(Number(goto.dataset.goto));
    return;
  }

  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  const moves = {
    check: () => {
      state.checked[state.index] = true;
      render();
    },
    retry: () => {
      resetLesson(state.index);
      render();
    },
    next: () => goTo(state.index + 1),
    reset: () => {
      state.quiz.lessons.forEach((_, i) => resetLesson(i));
      state.index = 0;
      render();
    },
  };

  moves[action]?.();
}

function bindEvents() {
  el("prevBtn").addEventListener("click", () => goTo(state.index - 1));
  el("nextBtn").addEventListener("click", () => goTo(state.index + 1));

  el("quizNav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-slide");
    if (btn) goTo(Number(btn.dataset.index));
  });

  el("deckBottom").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (btn) goTo(state.index + Number(btn.dataset.step));
  });

  el("stage").addEventListener("change", onAnswerChange);
  el("stage").addEventListener("click", onStageClick);

  document.addEventListener("keydown", (e) => {
    // Arrow keys belong to the radio group while an option has focus.
    if (e.target.matches("input, textarea, button, a")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const moves = {
      ArrowRight: () => goTo(state.index + 1),
      ArrowLeft: () => goTo(state.index - 1),
      Home: () => goTo(0),
      End: () => goTo(state.quiz.lessons.length),
    };

    const move = moves[e.key];
    if (!move) return;

    e.preventDefault();
    move();
  });
}

async function loadQuiz() {
  const id = quizId();

  if (!VALID_ID.test(id)) {
    showError(`"${id}" is not a valid module id. Try ./quiz?q=m1`);
    return;
  }

  try {
    const [quizRes, modulesRes] = await Promise.all([
      fetch(`./public/quiz/${id}.json`),
      fetch("./public/json/modules.json"),
    ]);

    if (!quizRes.ok) {
      throw new Error(`No quiz exists for module "${id}" yet.`);
    }

    state.quiz = await quizRes.json();
    state.modules = modulesRes.ok ? await modulesRes.json() : [];

    if (!state.quiz.lessons?.length) {
      throw new Error(`The quiz for "${id}" has no lessons.`);
    }

    state.answers = state.quiz.lessons.map((lesson) =>
      lesson.questions.map(() => []),
    );
    state.checked = state.quiz.lessons.map(() => false);
    state.index = startIndex(state.quiz.lessons.length);

    renderChrome();
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

export { loadQuiz };
