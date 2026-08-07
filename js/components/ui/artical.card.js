const RESOURCE_META = {
  slide: { icon: "fa-regular fa-credit-card", missing: "add Canva link" },
  doc: { icon: "fa-regular fa-file", missing: "add doc link" },
  file: { icon: "fa-regular fa-folder", missing: "add file link" },
};

const DEFAULT_META = { icon: "fa-regular fa-file", missing: "add link" };

function renderResource(resource) {
  const meta = RESOURCE_META[resource.type] ?? DEFAULT_META;
  const isMissing = !resource.url || resource.url === "#";

  return `
    <a
        class="chip ${resource.type}${isMissing ? " is-missing" : ""}"
        href="${resource.url || "#"}"
        ${isMissing ? "" : 'target="_blank" rel="noopener"'}
    >
        <i class="${meta.icon} resource-icon"></i>
        ${resource.label}
        ${isMissing ? `<span class="missing">${meta.missing}</span>` : ""}
    </a>
  `;
}

function renderModules(modules) {
  const container = document.getElementById("modules");

  container.innerHTML = modules
    .map(
      (module) => `
        <article class="module" id="${module.id}">
            <div class="module-head">
                <span class="module-num">${module.number}</span>

                <div>
                    <h3>${module.title}</h3>
                    <p class="desc">${module.description}</p>
                </div>
            </div>

            <ul class="topics">
                ${module.topics.map((topic) => `<li>${topic}</li>`).join("")}
            </ul>

            <div class="resources">
                ${module.resources.map(renderResource).join("")}
            </div>
        </article>
    `,
    )
    .join("");
}

export { renderModules };