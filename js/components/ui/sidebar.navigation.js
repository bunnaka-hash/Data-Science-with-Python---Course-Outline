export function initSidebar() {
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

export function renderSidebar(modules) {
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