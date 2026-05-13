(function () {
  var KEY = "__WEEKEND_THEME_BRIDGE__";
  var VERSION = "theme-bridge-v1";
  var STYLE_TAG_ID = "weekend-project-ds-vars";
  var THEME_SELECTORS = [
    "html:root",
    "html:root[data-theme='fluid']",
    "html:root[data-theme='fluid-dark']",
    "html:root[data-theme='weekend-dark']",
    "html:root[data-theme='weekend-paper']",
  ].join(",");

  var bridge = window[KEY];
  if (!bridge || bridge.version !== VERSION) {
    bridge = {
      version: VERSION,
      state: null,
      guardInstalled: false,
    };
    window[KEY] = bridge;
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function validVariableName(name) {
    return /^--[A-Za-z0-9_-]+$/.test(name);
  }

  function validShape(shape) {
    return shape === "pill" || shape === "rounded";
  }

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (_) {}
  }

  function applyTheme(state) {
    var theme = typeof state.theme === "string" && state.theme ? state.theme : "fluid";
    var dark = state.isDark === true;
    var root = document.documentElement;

    window.__WEEKEND_SHELL_THEME__ = theme;
    if (root.dataset.theme !== theme) root.dataset.theme = theme;
    if (root.classList.contains("dark") !== dark) root.classList.toggle("dark", dark);
    if (root.classList.contains("light") !== !dark) root.classList.toggle("light", !dark);

    dispatch("weekend:theme", { theme: theme });
  }

  function mergedVariables(theme, designSystem) {
    var globalBase = objectOrEmpty(designSystem.globalBase);
    var globalThemes = objectOrEmpty(designSystem.globalThemes);
    var projectBase = objectOrEmpty(designSystem.projectBase);
    var projectThemes = objectOrEmpty(designSystem.projectThemes);

    return Object.assign(
      {},
      globalBase,
      objectOrEmpty(globalThemes[theme]),
      projectBase,
      objectOrEmpty(projectThemes[theme])
    );
  }

  function applyDesignSystem(state) {
    var designSystem = state.designSystem;
    if (!designSystem) {
      var existing = document.getElementById(STYLE_TAG_ID);
      if (existing) existing.remove();
      return;
    }

    var root = document.documentElement;
    var shape = validShape(designSystem.shape) ? designSystem.shape : "pill";
    var variables = mergedVariables(state.theme, designSystem);
    var keys = Object.keys(variables).filter(validVariableName);

    window.__WEEKEND_SHELL_DESIGN_SYSTEM__ = {
      shape: shape,
      variables: variables,
    };

    if (root.dataset.shape !== shape) root.dataset.shape = shape;

    var parent = document.head || document.documentElement;
    var tag = document.getElementById(STYLE_TAG_ID);
    if (keys.length === 0) {
      if (tag) tag.remove();
      dispatch("weekend:design-system", { shape: shape, variables: variables });
      return;
    }

    if (!tag) {
      tag = document.createElement("style");
      tag.id = STYLE_TAG_ID;
      parent.insertBefore(tag, parent.firstChild);
    }

    tag.textContent = THEME_SELECTORS + "{}";
    var sheet = tag.sheet;
    if (!sheet || !sheet.cssRules || !sheet.cssRules.length) return;

    var style = sheet.cssRules[0].style;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      style.setProperty(key, String(variables[key]));
    }

    dispatch("weekend:design-system", { shape: shape, variables: variables });
    dispatch("weekend:design-system-overrides", { variables: variables });
  }

  function enforceState() {
    var state = bridge.state;
    if (!state) return;

    var root = document.documentElement;
    var theme = state.theme;
    var dark = state.isDark === true;
    if (theme && root.dataset.theme !== theme) root.dataset.theme = theme;
    if (root.classList.contains("dark") !== dark) root.classList.toggle("dark", dark);
    if (root.classList.contains("light") !== !dark) root.classList.toggle("light", !dark);

    var designSystem = state.designSystem;
    var shape = designSystem && designSystem.shape;
    if (validShape(shape) && root.dataset.shape !== shape) root.dataset.shape = shape;
  }

  function installGuard() {
    if (bridge.guardInstalled) return;
    bridge.guardInstalled = true;
    try {
      var observer = new MutationObserver(enforceState);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-shape", "class"],
      });
      bridge.guardObserver = observer;
    } catch (_) {}
  }

  bridge.apply = function (state) {
    if (!state || typeof state !== "object") return;
    bridge.state = state;
    applyTheme(state);
    applyDesignSystem(state);
    installGuard();
  };
})();
