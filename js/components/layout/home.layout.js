import { renderSidebar, initSidebar } from "../ui/sidebar.navigation.js";
import { renderModules } from "../ui/artical.card.js";

async function loadModules() {
  try {
    const response = await fetch("./public/json/modules.json");

    if (!response.ok) {
      throw new Error("Cannot load modules.json");
    }

    const modules = await response.json();
    renderSidebar(modules);
    renderModules(modules);
    initSidebar();
  } catch (err) {
    console.error(err);
  }
}

export { loadModules };