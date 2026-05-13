window.addEventListener(
  "keydown",
  function (event) {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key === "r" &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      window.location.reload();
    }
  },
  true
);
