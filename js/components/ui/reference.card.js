import { escapeHtml } from "./slide.card.js";

const KIND_META = {
  video: { icon: "fa-brands fa-youtube", label: "Video", open: "Watch here" },
  book: { icon: "fa-solid fa-book-open", label: "Book", open: "Read here" },
  pdf: { icon: "fa-regular fa-file-pdf", label: "PDF", open: "Read here" },
  slides: {
    icon: "fa-regular fa-credit-card",
    label: "Slides",
    open: "Open here",
  },
  dataset: {
    icon: "fa-solid fa-table",
    label: "Dataset",
    open: "Preview here",
  },
  link: { icon: "fa-solid fa-link", label: "Link", open: "Open here" },
  download: { icon: "fa-solid fa-download", label: "Download", open: "Download here" },
};

const DEFAULT_KIND = {
  icon: "fa-regular fa-file",
  label: "Resource",
  open: "Open here",
};

function kindMeta(kind) {
  return KIND_META[kind] ?? DEFAULT_KIND;
}

/* ---------- Turning a share link into an embeddable one ----------
   Every one of these is the *watch* or *share* URL a teacher would paste;
   none of them can be framed as-is, so each maps to the provider's own
   embed endpoint. Anything not matched here is a plain outbound link. */

const YOUTUBE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;
const DRIVE =
  /drive\.google\.com\/(?:file\/d\/([\w-]+)|open\?(?:.*&)?id=([\w-]+)|uc\?(?:.*&)?id=([\w-]+))/;
const GOOGLE_DOC =
  /docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/;
const PDF = /\.pdf($|[?#])/i;

/**
 * The embed for an item, or null when it can only be opened in a new tab.
 * An item may opt out with `"embed": false` — some publishers refuse to be
 * framed, and a blank iframe is worse than an honest outbound link.
 */
function embedFor(item) {
  if (!item?.url || item.embed === false) return null;

  const url = item.url;
  let m;

  if ((m = url.match(YOUTUBE))) {
    return {
      src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`,
      media: "video",
      provider: "YouTube",
    };
  }
  if ((m = url.match(VIMEO))) {
    return {
      src: `https://player.vimeo.com/video/${m[1]}`,
      media: "video",
      provider: "Vimeo",
    };
  }
  if ((m = url.match(DRIVE))) {
    return {
      src: `https://drive.google.com/file/d/${m[1] ?? m[2] ?? m[3]}/preview`,
      media: "doc",
      provider: "Google Drive",
    };
  }
  if ((m = url.match(GOOGLE_DOC))) {
    return {
      src: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`,
      media: "doc",
      provider: "Google Docs",
    };
  }
  if (PDF.test(url)) {
    return { src: url, media: "doc", provider: "PDF" };
  }

  return null;
}

/* ---------- Where a resource opens ----------
   Reading is a different act from watching: an article or a book is read at
   its own pace, in its own tab, alongside the course. So these kinds leave
   the site even when they *could* be framed. A single item can overrule the
   default either way with `"embed": true` or `"embed": false`. */

const OPEN_EXTERNALLY = new Set(["book", "link"]);

function opensExternally(item) {
  // An explicit flag on the item always wins over the kind default.
  if (typeof item.embed === "boolean") return !item.embed;

  return OPEN_EXTERNALLY.has(item.kind);
}

/**
 * The one destination for a resource — used for both the row click and its
 * button, so the whole row behaves as the button says it will.
 *
 * An in-site destination carries `view`: the library swaps to the player in
 * place rather than loading a page. `href` is still a real, working URL, so
 * middle-click and "open in new tab" keep doing what a link should.
 * Returns null for an item that has no link yet.
 */
function destinationFor(item, index, packId) {
  if (!item.url) return null;

  const embed = embedFor(item);

  return opensExternally(item) || !embed
    ? { href: item.url, external: true, view: null }
    : {
        href: `./reference?r=${packId}&v=${index + 1}`,
        external: false,
        view: index,
      };
}

/** The bare host, for showing students where a link actually goes. */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * One flat, ordered list across every group — this is what `?v=` indexes,
 * so a link to a resource keeps pointing at it even if a later group grows.
 */
function buildItems(pack) {
  return (pack.groups ?? []).flatMap((group, groupIndex) =>
    (group.items ?? []).map((item, itemIndex) => ({
      group,
      groupIndex,
      item,
      itemIndex,
    })),
  );
}

function renderMeta(item) {
  const bits = [
    item.by &&
      `<span><i class="fa-regular fa-user"></i>${escapeHtml(item.by)}</span>`,
    item.duration &&
      `<span><i class="fa-regular fa-clock"></i>${escapeHtml(item.duration)}</span>`,
    item.pages &&
      `<span><i class="fa-regular fa-bookmark"></i>${escapeHtml(item.pages)}</span>`,
    // Relative and malformed urls have no host to show.
    hostOf(item.url ?? "") &&
      `<span><i class="fa-solid fa-globe"></i>${escapeHtml(hostOf(item.url))}</span>`,
  ].filter(Boolean);

  return bits.length ? `<div class="ref-meta">${bits.join("")}</div>` : "";
}


function renderItem(entry, index, packId) {
  const { item } = entry;
  const meta = kindMeta(item.kind);
  const to = destinationFor(item, index, packId);

  return `
    <li
      class="ref-item${to ? "" : " is-missing"}"
      data-kind="${escapeHtml(item.kind ?? "link")}"
      ${to ? `data-href="${escapeHtml(to.href)}"` : ""}
      ${to?.external ? "data-external" : ""}
      ${to?.view !== null && to ? `data-view="${to.view}"` : ""}
      ${to ? 'role="link" tabindex="0"' : ""}
    >
      <span class="ref-icon"><i class="${meta.icon}"></i></span>

      <div class="ref-body">
        <div class="ref-head">
          <h4 class="ref-title">${escapeHtml(item.title)}</h4>
          <span class="ref-kind">${escapeHtml(meta.label)}</span>
        </div>
        ${item.note ? `<p class="ref-note">${escapeHtml(item.note)}</p>` : ""}
        ${renderMeta(item)}
      </div>

      <div class="ref-actions">
        ${
          to
            ? `<a
                 class="ref-btn"
                 href="${escapeHtml(to.href)}"
                 ${to.view !== null ? `data-view="${to.view}"` : ""}
                 ${to.external ? 'target="_blank" rel="noopener"' : ""}
                 ${to.external ? `title="Opens ${escapeHtml(hostOf(item.url))} in a new tab"` : ""}
               >
                 <i class="fa-solid fa-${to.external ? "arrow-up-right-from-square" : "play"}"></i>
                 ${escapeHtml(meta.open)}
               </a>`
            : `<span class="ref-todo">add link</span>`
        }
      </div>
    </li>
  `;
}
              
/**
 * Regroups the flat list back into its sections, carrying each item's flat
 * index along. The sidebar and the library both lay out by group but link
 * by flat index, so both build from this.
 */
function groupEntries(entries) {
  const groups = [];

  entries.forEach((entry, index) => {
    const last = groups.at(-1);

    if (last?.groupIndex === entry.groupIndex) {
      last.items.push({ entry, index });
    } else {
      groups.push({
        groupIndex: entry.groupIndex,
        group: entry.group,
        topic: entry.group.topic,
        items: [{ entry, index }],
      });
    }
  });

  return groups;
}

/** The library — every group, every resource, on one page. */
function renderReferenceCard(pack, entries) {
  const groups = groupEntries(entries);

  return `
    <article class="slide ref-card">
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="fa-solid fa-book"></i>
          Reference library
        </span>
        <span class="slide-module-tag">Module ${escapeHtml(pack.number)}</span>
      </header>

      <h2 class="slide-title">${escapeHtml(pack.title)}</h2>
      ${pack.intro ? `<p class="slide-lead">${escapeHtml(pack.intro)}</p>` : ""}

      ${groups
        .map(
          (group) => `
            <section class="ref-group" id="group-${group.groupIndex}">
              <div class="ref-group-head">
                <h3>${escapeHtml(group.topic)}</h3>
                <span class="ref-count">${group.items.length}</span>
              </div>
              ${group.group.blurb ? `<p class="ref-group-blurb">${escapeHtml(group.group.blurb)}</p>` : ""}
              <ul class="ref-list">
                ${group.items
                  .map(({ entry, index }) => renderItem(entry, index, pack.id))
                  .join("")}
              </ul>
            </section>
          `,
        )
        .join("")}

      ${
        entries.length
          ? ""
          : `<p class="ref-empty">
               No references have been added for this module yet.
             </p>`
      }
    </article>
  `;
}

/** Sidebar — resources grouped exactly as the page lays them out. */
function renderReferenceNav(entries, activeIndex) {
  return groupEntries(entries)
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
                  <span class="tag"><i class="${kindMeta(entry.item.kind).icon}"></i></span>
                  <span class="nav-slide-title">${escapeHtml(entry.item.title)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");
}

/**
 * The viewer — the resource playing in place. Providers are framed with a
 * tight sandbox and referrer policy so a course page never leaks more than
 * it must; `allow` carries only what a player genuinely needs.
 */
function renderWatchCard(entry, index, total, pack) {
  const { item, group } = entry;
  const meta = kindMeta(item.kind);
  const embed = embedFor(item);

  return `
    <article class="slide watch-card">
      <header class="slide-head">
        <span class="slide-kicker">
          <i class="${meta.icon}"></i>
          ${escapeHtml(group.topic)}
        </span>
        <span class="slide-module-tag">${index + 1} of ${total}</span>
      </header>

      ${
        embed
          ? `<div class="watch-frame watch-frame--${embed.media}">
               <iframe
                 src="${escapeHtml(embed.src)}"
                 title="${escapeHtml(item.title)}"
                 loading="lazy"
                 referrerpolicy="strict-origin-when-cross-origin"
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                 allowfullscreen
               ></iframe>
             </div>`
          : item.url
            ? `<div class="watch-blocked">
                 <i class="fa-solid fa-arrow-up-right-from-square"></i>
                 <div>
                   <strong>This one opens in a new tab.</strong>
                   <span>${escapeHtml(hostOf(item.url) || "The source")} cannot be embedded, so it will not play inside the course page.</span>
                 </div>
               </div>`
            : `<div class="watch-blocked is-empty">
                 <i class="fa-regular fa-clock"></i>
                 <div>
                   <strong>No link yet.</strong>
                   <span>Add a <code>url</code> for this resource in
                   <code>public/references/${escapeHtml(pack.id)}.json</code>.</span>
                 </div>
               </div>`
      }

      <h2 class="slide-title">${escapeHtml(item.title)}</h2>
      ${item.note ? `<p class="slide-lead">${escapeHtml(item.note)}</p>` : ""}

      ${renderMeta(item)}

      <div class="watch-actions">
        ${
          item.url
            ? `<a class="ref-btn ref-btn--ghost" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
                 <i class="fa-solid fa-arrow-up-right-from-square"></i>
                 Open on ${escapeHtml(embed?.provider ?? hostOf(item.url) ?? "the source")}
               </a>`
            : ""
        }
        <button class="ref-btn ref-btn--ghost" type="button" data-action="library">
          <i class="fa-solid fa-list"></i>
          All references
        </button>
      </div>
    </article>
  `;
}

export {
  buildItems,
  destinationFor,
  embedFor,
  hostOf,
  kindMeta,
  renderReferenceCard,
  renderReferenceNav,
  renderWatchCard,
};
