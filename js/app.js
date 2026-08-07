async function loadModules() {
  try {
    const response = await fetch("./public/json/modules.json");

    if (!response.ok) {
      throw new Error("Cannot load modules.json");
    }

    const modules = await response.json();
    renderSidebar(modules);
    renderModules(modules);
  } catch (err) {
    console.error(err);
  }
}

function initSidebar() {
  const links = document.querySelectorAll(".nav-link");

  const sections = [...links].map((link) =>
    document.getElementById(link.dataset.target),
  );

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = document.querySelector(
          `.nav-link[data-target="${entry.target.id}"]`,
        );

        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          link?.classList.add("active");
        }
      });
    },
    {
      rootMargin: "-20% 0px -70% 0px",
    },
  );

  sections.forEach((section) => {
    if (section) io.observe(section);
  });

  const search = document.getElementById("navSearch");

  if (search) {
    search.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();

      links.forEach((link) => {
        link.style.display = link.textContent.toLowerCase().includes(q)
          ? "flex"
          : "none";
      });
    });
  }
}

function renderSidebar(modules) {
  const navGroup = document.getElementById("navGroup");

  navGroup.innerHTML = modules
    .map(
      (module) => `
        <a
            class="nav-link"
            data-target="${module.id}"
            href="#${module.id}"
        >
            <span class="tag">${module.number}</span>
            ${module.title}
        </a>
    `,
    )
    .join("");
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

loadModules();
