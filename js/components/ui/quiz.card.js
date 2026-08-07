import { escapeHtml, renderCode } from "./slide.card.js";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function inline(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function isMulti(question) {
  return Array.isArray(question.answer);
}

function answerSet(question) {
  return new Set(isMulti(question) ? question.answer : [question.answer]);
}

function isCorrect(question, picked) {
  const want = answerSet(question);
  return picked.length === want.size && picked.every((i) => want.has(i));
}

function scoreLesson(lesson, answers) {
  return lesson.questions.reduce(
    (total, question, i) => total + (isCorrect(question, answers[i] ?? []) ? 1 : 0),
    0,
  );
}

function optionState(question, optionIndex, picked, checked) {
  if (!checked) return "";

  const isAnswer = answerSet(question).has(optionIndex);
  if (isAnswer) return " is-correct";

  return picked.includes(optionIndex) ? " is-wrong" : "";
}

function renderOption(question, qIndex, optionIndex, picked, checked) {
  const multi = isMulti(question);

  return `
    <label class="quiz-option${optionState(question, optionIndex, picked, checked)}">
      <input
        type="${multi ? "checkbox" : "radio"}"
        name="q${qIndex}"
        value="${optionIndex}"
        ${picked.includes(optionIndex) ? "checked" : ""}
        ${checked ? "disabled" : ""}
      />
      <span class="quiz-mark">${LETTERS[optionIndex] ?? optionIndex + 1}</span>
      <span class="quiz-option-text">${inline(question.options[optionIndex])}</span>
    </label>
  `;
}

function renderVerdict(question, picked) {
  if (!picked.length) {
    return `<span class="quiz-verdict is-skipped">
              <i class="fa-regular fa-circle"></i> Not answered
            </span>`;
  }

  return isCorrect(question, picked)
    ? `<span class="quiz-verdict is-correct">
         <i class="fa-solid fa-check"></i> Correct
       </span>`
    : `<span class="quiz-verdict is-wrong">
         <i class="fa-solid fa-xmark"></i> Not quite
       </span>`;
}

function renderQuestion(question, qIndex, picked, checked) {
  const multi = isMulti(question);

  return `
    <li class="quiz-q" data-q="${qIndex}">
      <div class="quiz-q-head">
        <span class="quiz-q-num">Q${qIndex + 1}</span>
        <p class="quiz-q-prompt">${inline(question.prompt)}</p>
        ${checked ? renderVerdict(question, picked) : ""}
      </div>

      ${multi && !checked ? `<span class="quiz-q-hint">Select all that apply</span>` : ""}
      ${question.code ? renderCode(question.code) : ""}

      <div class="quiz-options">
        ${question.options
          .map((_, i) => renderOption(question, qIndex, i, picked, checked))
          .join("")}
      </div>

      ${
        checked && question.explain
          ? `<p class="quiz-explain">
               <i class="fa-regular fa-lightbulb"></i>
               <span>${inline(question.explain)}</span>
             </p>`
          : ""
      }
    </li>
  `;
}

function renderBanner(lesson, answers) {
  const count = lesson.questions.length;
  const score = scoreLesson(lesson, answers);
  const percent = Math.round((score / count) * 100);
  const tone = percent === 100 ? " is-perfect" : percent >= 60 ? " is-good" : " is-low";

  return `
    <div class="quiz-result${tone}">
      <span class="quiz-result-score">${score}<em>/${count}</em></span>
      <div>
        <strong>${percent === 100 ? "Perfect — every answer correct." : `${percent}% on this lesson.`}</strong>
        <p>Review the explanations below, then move on when the reasoning makes sense.</p>
      </div>
    </div>
  `;
}

/** One lesson of the quiz — its questions and the check / retry actions. */
function renderQuizCard(lesson, index, quiz, answers, checked) {
  const total = quiz.lessons.length;

  return `
    <article class="slide quiz-card" data-index="${index}">
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="fa-regular fa-circle-question"></i>
          ${escapeHtml(lesson.topic)}
        </span>
        <span class="slide-module-tag">
          Lesson ${index + 1} of ${total}
        </span>
      </header>

      <h2 class="slide-title">${escapeHtml(lesson.title)}</h2>
      ${lesson.lead ? `<p class="slide-lead">${escapeHtml(lesson.lead)}</p>` : ""}

      ${checked ? renderBanner(lesson, answers) : ""}

      <ol class="quiz-list">
        ${lesson.questions
          .map((question, i) => renderQuestion(question, i, answers[i] ?? [], checked))
          .join("")}
      </ol>

      <div class="quiz-actions">
        ${
          checked
            ? `<button class="quiz-btn quiz-btn--ghost" type="button" data-action="retry">
                 <i class="fa-solid fa-rotate-left"></i> Try again
               </button>
               <button class="quiz-btn" type="button" data-action="next">
                 ${index + 1 < total ? "Next lesson" : "See your results"}
                 <i class="fa-solid fa-angle-right"></i>
               </button>`
            : `<button class="quiz-btn" type="button" data-action="check">
                 <i class="fa-regular fa-circle-check"></i> Check answers
               </button>`
        }
      </div>
    </article>
  `;
}

/** The closing card — overall score plus a per-lesson breakdown. */
function renderResultCard(quiz, answers, checked) {
  const rows = quiz.lessons.map((lesson, i) => ({
    lesson,
    index: i,
    done: checked[i],
    score: scoreLesson(lesson, answers[i]),
    count: lesson.questions.length,
  }));

  const score = rows.reduce((n, row) => n + (row.done ? row.score : 0), 0);
  const count = rows.reduce((n, row) => n + row.count, 0);
  const percent = Math.round((score / count) * 100);
  const passing = quiz.passing ?? 70;
  const passed = percent >= passing;
  const remaining = rows.filter((row) => !row.done).length;

  return `
    <article class="slide quiz-card quiz-summary">
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="fa-regular fa-circle-check"></i>
          Results
        </span>
        <span class="slide-module-tag">Module ${escapeHtml(quiz.number)}</span>
      </header>

      <h2 class="slide-title">${escapeHtml(quiz.title)} — your score</h2>
      <p class="slide-lead">
        ${
          remaining
            ? `${remaining} lesson${remaining > 1 ? "s" : ""} still unchecked. Your score counts only the lessons you have checked so far.`
            : passed
              ? "You cleared the passing mark for this module."
              : `The passing mark for this module is ${passing}%. Revisit the lessons below and try them again.`
        }
      </p>

      <div class="quiz-total${passed ? " is-pass" : " is-fail"}">
        <div class="quiz-total-figure">
          <span>${percent}<em>%</em></span>
          <small>${score} of ${count} correct</small>
        </div>
        <div class="quiz-total-bar">
          <div style="width:${percent}%"></div>
          <span class="quiz-total-mark" style="left:${passing}%" title="Pass mark ${passing}%"></span>
        </div>
      </div>

      <ul class="quiz-breakdown">
        ${rows
          .map(
            (row) => `
              <li class="${row.done ? "" : "is-pending"}">
                <span class="tag">${String(row.index + 1).padStart(2, "0")}</span>
                <span class="quiz-breakdown-title">
                  ${escapeHtml(row.lesson.topic)}
                  <em>${escapeHtml(row.lesson.title)}</em>
                </span>
                <span class="quiz-breakdown-score">
                  ${row.done ? `${row.score}/${row.count}` : "not checked"}
                </span>
                <button class="quiz-breakdown-go" type="button" data-goto="${row.index}">
                  ${row.done ? "Review" : "Start"}
                  <i class="fa-solid fa-angle-right"></i>
                </button>
              </li>
            `,
          )
          .join("")}
      </ul>

      <div class="quiz-actions">
        <button class="quiz-btn quiz-btn--ghost" type="button" data-action="reset">
          <i class="fa-solid fa-rotate-left"></i> Reset the whole quiz
        </button>
        <a class="quiz-btn quiz-btn--ghost" href="./slide?id=${escapeHtml(quiz.id)}">
          <i class="fa-regular fa-credit-card"></i> Back to the slides
        </a>
      </div>
    </article>
  `;
}

/** Sidebar contents — one entry per lesson, plus the results entry. */
function renderQuizNav(quiz, answers, checked, activeIndex) {
  const lessons = quiz.lessons
    .map((lesson, index) => {
      const done = checked[index];
      const score = done ? scoreLesson(lesson, answers[index]) : 0;
      const count = lesson.questions.length;

      return `
        <button
          class="nav-slide${index === activeIndex ? " active" : ""}"
          type="button"
          data-index="${index}"
        >
          <span class="tag">${String(index + 1).padStart(2, "0")}</span>
          <span class="nav-slide-title">${escapeHtml(lesson.topic)}</span>
          <span class="nav-score${done ? (score === count ? " is-perfect" : "") : " is-pending"}">
            ${done ? `${score}/${count}` : count}
          </span>
        </button>
      `;
    })
    .join("");

  const resultIndex = quiz.lessons.length;

  return `
    <div class="nav-topic">
      <span class="nav-topic-label">Lessons</span>
      ${lessons}
    </div>
    <div class="nav-topic">
      <span class="nav-topic-label">Finish</span>
      <button
        class="nav-slide${activeIndex === resultIndex ? " active" : ""}"
        type="button"
        data-index="${resultIndex}"
      >
        <span class="tag"><i class="fa-solid fa-flag-checkered"></i></span>
        <span class="nav-slide-title">Your results</span>
      </button>
    </div>
  `;
}

export { renderQuizCard, renderResultCard, renderQuizNav, scoreLesson, isCorrect };
