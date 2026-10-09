// =====================================================================
// panels.js — opens and closes the slide-up Projects panel
//
// How it works:
// The "Projects" link points to "#projects". Clicking it changes the end
// of the web address (the "hash") to #projects. We listen for that
// change and slide up the panel with id="panel-projects".
// Any other hash (like the "#" on the Back link) closes it.
//
// Why use the hash? It means the browser's Back button closes the panel,
// and a link like yoursite.com/#projects opens straight to Projects.
// =====================================================================

// Every panel on the page (elements with class="section")
const panels = document.querySelectorAll(".section");

function showPanel() {
  // location.hash is e.g. "#projects"; slice(1) drops the "#" → "projects"
  const name = location.hash.slice(1);

  // Find the matching panel, e.g. id="panel-projects" (null if none matches)
  const target = document.getElementById("panel-" + name);

  // Add "is-open" to the matching panel and remove it from all others.
  // The CSS (section 7 of style.css) does the actual sliding.
  panels.forEach((panel) => panel.classList.toggle("is-open", panel === target));

  // Tell the CSS a panel is open, so it can fade the home screen behind it
  document.body.classList.toggle("panel-open", Boolean(target));

  // Always start the panel scrolled to the top
  if (target) target.scrollTop = 0;
}

// Run showPanel whenever the hash changes (link clicks, Back button)
window.addEventListener("hashchange", showPanel);

// Pressing Esc clears the hash, which closes the panel
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && location.hash) location.hash = "";
});

// Run once on page load, in case the address already ends in #projects
showPanel();
