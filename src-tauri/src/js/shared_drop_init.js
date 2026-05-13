window.__WEEKEND_SHARED_DROP_WINDOW__ = true;
document.documentElement.style.backgroundColor = "transparent";
const applyWeekendSharedDropTransparency = () => {
  if (!document.body) {
    return;
  }
  document.body.style.backgroundColor = "transparent";
  document.body.style.background = "transparent";
};
applyWeekendSharedDropTransparency();
window.addEventListener("DOMContentLoaded", applyWeekendSharedDropTransparency, { once: true });
if (window.location.hash !== "#/shared-drop") {
  window.location.hash = "#/shared-drop";
}
