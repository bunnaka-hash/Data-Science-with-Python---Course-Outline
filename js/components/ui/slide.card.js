const LAYOUT_META = {
  title: { icon: "fa-regular fa-circle-play", label: "Start here" },
  content: { icon: "fa-regular fa-lightbulb", label: "Concept" },
  code: { icon: "fa-solid fa-code", label: "Code" },
  exercise: { icon: "fa-regular fa-pen-to-square", label: "Practice" },
  recap: { icon: "fa-regular fa-circle-check", label: "Recap" },
};

const DEFAULT_LAYOUT = { icon: "fa-regular fa-file-lines", label: "Slide" };

function layoutMeta(layout) {
  return LAYOUT_META[layout] ?? DEFAULT_LAYOUT;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Runs on escaped text, so strings are matched as &quot;…&quot;. Apostrophes are
   left as-is — an escaped &#39; would collide with the comment pattern. */
const PY_TOKEN =
  /(&quot;[^\n]*?&quot;|'[^'\n]*'|#[^\n]*|\b(?:def|return|import|from|as|with|class|lambda|if|elif|else|for|while|in|not|and|or|try|except|print|True|False|None)\b|\b\d+(?:\.\d+)?\b)/g;

const SH_TOKEN = /(#[^\n]*|\b(?:pip|python|source|jupyter|deactivate)\b)/g;

function tokenClass(token) {
  if (token.startsWith("#")) return "c-comment";
  if (token.startsWith("&quot;") || token.startsWith("'")) return "c-str";
  if (/^\d/.test(token)) return "c-num";
  return "c-kw";
}

function highlight(body, lang) {
  const escaped = escapeHtml(body);
  const pattern = lang === "python" ? PY_TOKEN : SH_TOKEN;

  return escaped.replace(
    pattern,
    (token) => `<span class="${tokenClass(token)}">${token}</span>`,
  );
}

function renderCode(code) {
  if (!code) return "";

  const lang = code.lang ?? "python";
  const body = Array.isArray(code.body) ? code.body.join("\n") : (code.body ?? "");

  return `
    <div class="slide-code">
      <div class="slide-code-head">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="slide-code-lang">${escapeHtml(lang)}</span>
      </div>
      <pre><code>${highlight(body, lang)}</code></pre>
    </div>
  `;
}

function renderBullets(bullets) {
  if (!bullets?.length) return "";

  return `
    <ul class="slide-points">
      ${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
    </ul>
  `;
}

function renderNote(note) {
  if (!note) return "";

  return `
    <aside class="slide-note">
      <i class="fa-regular fa-lightbulb"></i>
      <p>${escapeHtml(note)}</p>
    </aside>
  `;
}

function renderObjectives(objectives) {
  if (!objectives?.length) return "";

  return `
    <div class="slide-objectives">
      <h4>Learning objectives</h4>
      <ol>
        ${objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}
      </ol>
    </div>
  `;
}

function renderSlide(slide, index, deck) {
  const meta = layoutMeta(slide.layout);
  const isTitle = slide.layout === "title";
  const hasCode = Boolean(slide.code);
  // Two columns only when there is something to sit beside the code —
  // a code-only slide gets the full width instead of an empty left half.
  const isSplit = hasCode && Boolean(slide.bullets?.length) && !isTitle;
  const prose =
    renderBullets(slide.bullets) +
    (isTitle ? renderObjectives(deck.objectives) : "");

  return `
    <article
      class="slide slide--${escapeHtml(slide.layout ?? "content")}${isSplit ? " is-split" : ""}"
      data-index="${index}"
    >
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="${meta.icon}"></i>
          ${escapeHtml(slide.topic ?? meta.label)}
        </span>
        ${isTitle ? `<span class="slide-module-tag">Module ${escapeHtml(deck.number)}</span>` : ""}
      </header>

      <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
      ${slide.lead ? `<p class="slide-lead">${escapeHtml(slide.lead)}</p>` : ""}

      <div class="slide-body">
        ${
          prose.trim()
            ? `<div class="slide-col">${prose}</div>`
            : ""
        }
        ${hasCode ? `<div class="slide-col slide-col--code">${renderCode(slide.code)}</div>` : ""}
      </div>

      ${renderNote(slide.note)}
    </article>
  `;
}

/** Sidebar table of contents — slides grouped under their topic heading. */
function renderSlideNav(slides, activeIndex) {
  const groups = [];

  slides.forEach((slide, index) => {
    const topic = slide.topic ?? "Slides";
    const last = groups.at(-1);

    if (last?.topic === topic) {
      last.items.push({ slide, index });
    } else {
      groups.push({ topic, items: [{ slide, index }] });
    }
  });

  return groups
    .map(
      (group) => `
        <div class="nav-topic">
          <span class="nav-topic-label">${escapeHtml(group.topic)}</span>
          ${group.items
            .map(
              ({ slide, index }) => `
                <button
                  class="nav-slide${index === activeIndex ? " active" : ""}"
                  type="button"
                  data-index="${index}"
                >
                  <span class="tag">${String(index + 1).padStart(2, "0")}</span>
                  <span class="nav-slide-title">${escapeHtml(slide.title)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");
}

export { renderSlide, renderSlideNav, renderCode, escapeHtml };
