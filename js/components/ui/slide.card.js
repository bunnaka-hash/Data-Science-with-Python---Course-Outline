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

/** The institute cell of the footline. Decks may override it. */
const INSTITUTE = "STJ";

/**
 * The Beamer headline: structure-blue bar carrying the frame title, with
 * the topic trailing in the grey remainder. A title slide names its module
 * here instead, so the big title in the body is not simply repeated.
 */
function renderHeadline(slide, deck, isTitle) {
  const frameTitle = isTitle
    ? `Module ${deck.number ?? ""}`.trim()
    : slide.title;

  return `
    <div class="beamer-head">
      <span class="beamer-frametitle">${escapeHtml(frameTitle)}</span>
      <span class="beamer-headfill">${escapeHtml(slide.topic ?? "")}</span>
    </div>
  `;
}

/** The Beamer footline: deck · institute · page, in equal thirds. */
function renderFootline(index, deck) {
  const total = deck.slides?.length ?? 0;

  return `
    <div class="beamer-foot">
      <span class="beamer-foot-cell beamer-foot-cell--deck">${escapeHtml(deck.title)}</span>
      <span class="beamer-foot-cell beamer-foot-cell--institute">${escapeHtml(deck.institute ?? INSTITUTE)}</span>
      <span class="beamer-foot-cell beamer-foot-cell--page">
        ${index + 1}<span class="sep">&nbsp;/&nbsp;</span><span class="total">${total}</span>
      </span>
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
      class="slide beamer slide--${escapeHtml(slide.layout ?? "content")}${isSplit ? " is-split" : ""}"
      data-index="${index}"
    >
      ${renderHeadline(slide, deck, isTitle)}

      <div class="beamer-body">
        <header class="slide-head">
          <!-- The topic already sits in the headline, so the kicker
               carries the layout instead of repeating it. -->
          <span class="slide-kicker">
            <i class="${meta.icon}"></i>
            ${escapeHtml(meta.label)}
          </span>
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
      </div>

      ${renderFootline(index, deck)}
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
