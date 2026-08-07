import { escapeHtml, renderCode } from "./slide.card.js";

/** Briefs and steps may mark inline code with `backticks`. */
function inline(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function joinLines(value) {
  return Array.isArray(value) ? value.join("\n") : (value ?? "");
}

/** A task counts as solved once its output matches what the brief asked for. */
function isSolved(run) {
  return run?.matched === true;
}

/**
 * One page is one exercise, so the lessons are flattened into a single
 * ordered list. Each entry keeps its lesson, which is what the sidebar
 * groups by and what tells the runner which packages to load.
 */
function buildEntries(pack) {
  return pack.lessons.flatMap((lesson, lessonIndex) =>
    lesson.tasks.map((task, taskIndex) => ({
      lesson,
      lessonIndex,
      task,
      taskIndex,
    })),
  );
}

function renderSteps(steps) {
  if (!steps?.length) return "";

  return `
    <ul class="ex-steps">
      ${steps.map((step) => `<li>${inline(step)}</li>`).join("")}
    </ul>
  `;
}

function renderStatus(run) {
  if (!run) return "";

  if (run.error || run.failed) {
    return `<span class="ex-status is-error">
              <i class="fa-solid fa-triangle-exclamation"></i> Error
            </span>`;
  }
  if (run.matched === true) {
    return `<span class="ex-status is-pass">
              <i class="fa-solid fa-check"></i> Output matches
            </span>`;
  }
  if (run.matched === false) {
    return `<span class="ex-status is-near">
              <i class="fa-solid fa-arrows-left-right"></i> Different output
            </span>`;
  }
  return `<span class="ex-status is-ran">
            <i class="fa-solid fa-play"></i> Ran
          </span>`;
}

function renderExpected(task, run) {
  // Only worth showing once their own attempt disagrees with it.
  if (!task.expected?.length || run?.matched !== false) return "";

  return `
    <div class="ex-expected">
      <span class="ex-panel-label">Expected output</span>
      <pre>${escapeHtml(joinLines(task.expected))}</pre>
    </div>
  `;
}

function renderOutput(task, run) {
  if (!run) return "";

  const body = run.error
    ? `<pre class="is-error">${escapeHtml(run.error)}</pre>`
    : `<pre class="${run.failed ? "is-error" : ""}">${
        escapeHtml(run.out) ||
        '<span class="ex-empty">no output — nothing was printed</span>'
      }</pre>`;

  return `
    <div class="ex-output">
      <div class="ex-output-head">
        <span class="ex-panel-label">Output</span>
        ${renderStatus(run)}
      </div>
      ${body}
      ${
        run.images?.length
          ? `<div class="ex-figures">
               ${run.images
                 .map(
                   (data) =>
                     `<img alt="Chart produced by your code" src="data:image/png;base64,${data}" />`,
                 )
                 .join("")}
             </div>`
          : ""
      }
      ${renderExpected(task, run)}
    </div>
  `;
}

/**
 * The working half of the page — everything from the steps down. Kept as one
 * node so a run can repaint it without touching the rest of the card.
 */
function renderTask(task, seat) {
  const { code, run, hint, solution } = seat;

  return `
    <div class="ex-task${isSolved(run) ? " is-solved" : ""}" data-task="0">
      ${
        isSolved(run)
          ? `<p class="ex-solved">
               <i class="fa-solid fa-check"></i>
               Solved — your output matches the brief.
             </p>`
          : ""
      }

      ${renderSteps(task.steps)}

      ${
        task.expected?.length
          ? `<div class="ex-target">
               <span class="ex-panel-label">Your program should print</span>
               <pre>${escapeHtml(joinLines(task.expected))}</pre>
             </div>`
          : ""
      }

      <div class="ex-editor">
        <div class="ex-editor-head">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="ex-editor-lang">python</span>
          <button class="ex-mini" type="button" data-action="reset" title="Back to the starter code">
            <i class="fa-solid fa-rotate-left"></i> Reset
          </button>
        </div>
        <textarea
          class="ex-code"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          rows="1"
          aria-label="Python editor for ${escapeHtml(task.title)}"
        >${escapeHtml(code)}</textarea>
      </div>

      <div class="ex-toolbar">
        <button class="ex-btn" type="button" data-action="run">
          <i class="fa-solid fa-play"></i> Run code
        </button>
        ${
          task.hint
            ? `<button class="ex-btn ex-btn--ghost" type="button" data-action="hint">
                 <i class="fa-regular fa-lightbulb"></i> ${hint ? "Hide hint" : "Hint"}
               </button>`
            : ""
        }
        ${
          task.solution?.length
            ? `<button class="ex-btn ex-btn--ghost" type="button" data-action="solution">
                 <i class="fa-regular fa-eye"></i> ${solution ? "Hide solution" : "Reveal solution"}
               </button>`
            : ""
        }
        <span class="ex-runstate" data-runstate></span>
      </div>

      ${
        hint && task.hint
          ? `<p class="ex-hint">
               <i class="fa-regular fa-lightbulb"></i>
               <span>${inline(task.hint)}</span>
             </p>`
          : ""
      }

      ${renderOutput(task, seat.run)}

      ${
        solution && task.solution?.length
          ? `<div class="ex-solution">
               <div class="ex-solution-head">
                 <span class="ex-panel-label">One way to solve it</span>
                 <button class="ex-mini" type="button" data-action="use-solution">
                   <i class="fa-solid fa-arrow-turn-up"></i> Load into the editor
                 </button>
               </div>
               ${renderCode({ lang: "python", body: task.solution })}
               ${task.explain ? `<p class="ex-solution-note">${inline(task.explain)}</p>` : ""}
             </div>`
          : ""
      }
    </div>
  `;
}

/** One exercise — the whole page. */
function renderExerciseCard(entry, index, total, seat) {
  const { lesson, lessonIndex, task } = entry;

  return `
    <article class="slide ex-card" data-index="${index}">
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="fa-regular fa-pen-to-square"></i>
          ${escapeHtml(lesson.topic)}
        </span>
        <span class="slide-module-tag">Exercise ${index + 1} of ${total}</span>
      </header>

      <h2 class="slide-title">${escapeHtml(task.title)}</h2>
      <p class="slide-lead">${inline(task.brief)}</p>

      <div class="ex-lesson-meta">
        <span>
          <i class="fa-regular fa-folder-open"></i>
          Lesson ${lessonIndex + 1} · ${escapeHtml(lesson.title)}
        </span>
        ${
          (task.packages ?? lesson.packages)?.length
            ? `<span>
                 <i class="fa-solid fa-cube"></i>
                 uses ${(task.packages ?? lesson.packages).map(escapeHtml).join(", ")}
               </span>`
            : ""
        }
      </div>

      ${renderTask(task, seat)}
    </article>
  `;
}

/** The closing card — every exercise and whether it is solved. */
function renderProgressCard(pack, entries, seatOf) {
  const rows = entries.map((entry, index) => ({
    entry,
    index,
    solved: isSolved(seatOf(entry).run),
  }));

  const solved = rows.filter((row) => row.solved).length;
  const count = rows.length;
  const percent = Math.round((solved / count) * 100);
  const firstOpen = rows.find((row) => !row.solved);

  return `
    <article class="slide ex-card ex-summary">
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="fa-solid fa-flag-checkered"></i>
          Progress
        </span>
        <span class="slide-module-tag">Module ${escapeHtml(pack.number)}</span>
      </header>

      <h2 class="slide-title">${escapeHtml(pack.title)} — your workbook</h2>
      <p class="slide-lead">
        ${
          solved === count
            ? "Every exercise in this module runs and matches its expected output."
            : `${count - solved} exercise${count - solved > 1 ? "s" : ""} still to go. An exercise counts as solved once its output matches the brief.`
        }
      </p>

      <div class="ex-total">
        <div class="ex-total-figure">
          <span>${solved}<em>/${count}</em></span>
          <small>${percent}% complete</small>
        </div>
        <div class="ex-total-bar"><div style="width:${percent}%"></div></div>
      </div>

      <ul class="ex-breakdown">
        ${rows
          .map(
            (row) => `
              <li class="${row.solved ? "is-done" : ""}">
                <span class="tag">${String(row.index + 1).padStart(2, "0")}</span>
                <span class="ex-breakdown-title">
                  ${escapeHtml(row.entry.task.title)}
                  <em>${escapeHtml(row.entry.lesson.topic)}</em>
                </span>
                <span class="ex-breakdown-score">
                  ${row.solved ? "solved" : "open"}
                </span>
                <button class="ex-breakdown-go" type="button" data-goto="${row.index}">
                  ${row.solved ? "Review" : "Open"}
                  <i class="fa-solid fa-angle-right"></i>
                </button>
              </li>
            `,
          )
          .join("")}
      </ul>

      <div class="ex-actions">
        ${
          firstOpen
            ? `<button class="ex-btn" type="button" data-goto="${firstOpen.index}">
                 <i class="fa-solid fa-play"></i> Next unsolved exercise
               </button>`
            : ""
        }
        <button class="ex-btn ex-btn--ghost" type="button" data-action="reset-all">
          <i class="fa-solid fa-rotate-left"></i> Reset every exercise
        </button>
        <a class="ex-btn ex-btn--ghost" href="./slide?id=${escapeHtml(pack.id)}">
          <i class="fa-regular fa-credit-card"></i> Back to the slides
        </a>
      </div>
    </article>
  `;
}

/** Sidebar — every exercise, grouped under the lesson it belongs to. */
function renderExerciseNav(entries, seatOf, activeIndex) {
  const groups = [];

  entries.forEach((entry, index) => {
    const last = groups.at(-1);

    if (last?.lessonIndex === entry.lessonIndex) {
      last.items.push({ entry, index });
    } else {
      groups.push({
        lessonIndex: entry.lessonIndex,
        topic: entry.lesson.topic,
        items: [{ entry, index }],
      });
    }
  });

  const lessons = groups
    .map(
      (group) => `
        <div class="nav-topic">
          <span class="nav-topic-label">${escapeHtml(group.topic)}</span>
          ${group.items
            .map(
              ({ entry, index }) => `
                <button
                  class="nav-slide${index === activeIndex ? " active" : ""}"
                  type="button"
                  data-index="${index}"
                >
                  <span class="tag">${String(index + 1).padStart(2, "0")}</span>
                  <span class="nav-slide-title">${escapeHtml(entry.task.title)}</span>
                  ${
                    isSolved(seatOf(entry).run)
                      ? `<span class="nav-score is-perfect"><i class="fa-solid fa-check"></i></span>`
                      : ""
                  }
                </button>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");

  return `
    ${lessons}
    <div class="nav-topic">
      <span class="nav-topic-label">Finish</span>
      <button
        class="nav-slide${activeIndex === entries.length ? " active" : ""}"
        type="button"
        data-index="${entries.length}"
      >
        <span class="tag"><i class="fa-solid fa-flag-checkered"></i></span>
        <span class="nav-slide-title">Your progress</span>
      </button>
    </div>
  `;
}

export {
  buildEntries,
  renderExerciseCard,
  renderProgressCard,
  renderExerciseNav,
  renderTask,
  isSolved,
  joinLines,
};
