window.__WEEKEND_SHARED_DROP_WINDOW__ = true;
Object.assign(document.documentElement.style, {
  backgroundColor: "transparent",
});
const applyWeekendSharedDropTransparency = () => {
  if (!document.body) {
    return;
  }
  Object.assign(document.body.style, {
    background: "transparent",
    backgroundColor: "transparent",
  });
};
applyWeekendSharedDropTransparency();
window.addEventListener("DOMContentLoaded", applyWeekendSharedDropTransparency, { once: true });
if (window.location.hash !== "#/shared-drop") {
  window.location.hash = "#/shared-drop";
}
