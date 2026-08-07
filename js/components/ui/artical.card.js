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
                ${module.resources
                  .map(
                    (resource) => `
                        <a
                            class="chip ${resource.type}"
                            href="${resource.url}"
                            target="_blank"
                        >
                            ${resource.label}
                        </a>
                    `,
                  )
                  .join("")}
            </div>
        </article>
    `,
    )
    .join("");
}

export { renderModules };