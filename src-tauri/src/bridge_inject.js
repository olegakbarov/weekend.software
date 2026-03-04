// Weekend Software Bridge Extension — injected into browser-pane webviews.
// Versioned, idempotent, and observer-driven (no global monkey patches unless enabled).
(function () {
  const BRIDGE_VERSION = "bridge-v2";
  const BRIDGE_KEY = "__WEEKEND_BRIDGE__";
  const BRIDGE_STATE_KEY = "__WEEKEND_BRIDGE_STATE__";
  const WRAP_MARKER = "__weekendBridgeWrapped__";

  const hasLowLevelIpc = () => {
    const i = window.__TAURI_INTERNALS__;
    return Boolean(
      i &&
        typeof i.ipc === "function" &&
        typeof i.transformCallback === "function" &&
        typeof i.unregisterCallback === "function"
    );
  };

  const invoke = async (cmd, payload) => {
    const i = window.__TAURI_INTERNALS__;
    if (i && typeof i.invoke === "function") {
      try {
        return await i.invoke(cmd, payload);
      } catch (invokeError) {
        if (!hasLowLevelIpc()) throw invokeError;
      }
    }
    if (!hasLowLevelIpc()) {
      throw new Error("Tauri IPC unavailable");
    }
    return await new Promise((resolve, reject) => {
      const callback = i.transformCallback((response) => {
        try {
          i.unregisterCallback(error);
        } catch (_) {}
        resolve(response);
      }, true);
      const error = i.transformCallback((invokeError) => {
        try {
          i.unregisterCallback(callback);
        } catch (_) {}
        reject(invokeError);
      }, true);
      try {
        i.ipc({ cmd, callback, error, payload });
      } catch (sendError) {
        try {
          i.unregisterCallback(callback);
          i.unregisterCallback(error);
        } catch (_) {}
        reject(sendError);
      }
    });
  };

  const waitForIpc = async (timeoutMs = 2500) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const internals = window.__TAURI_INTERNALS__;
      if (
        internals &&
        (typeof internals.invoke === "function" || hasLowLevelIpc())
      ) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("Tauri IPC bridge unavailable");
  };

  const existing = window[BRIDGE_KEY];
  if (
    existing &&
    typeof existing === "object" &&
    existing.version === BRIDGE_VERSION
  ) {
    if (typeof existing.notifyReady === "function") {
      void existing.notifyReady();
    }
    return;
  }
  if (existing && typeof existing.teardownAll === "function") {
    try {
      existing.teardownAll();
    } catch (_) {}
  }

  const state = window[BRIDGE_STATE_KEY] || {};
  state.version = BRIDGE_VERSION;
  state.teardowns =
    state.teardowns && typeof state.teardowns === "object"
      ? state.teardowns
      : {};
  state.config = state.config && typeof state.config === "object" ? state.config : {};

  const pushEvent = (category, data) => {
    const payload = { category, data: JSON.stringify(data) };
    void invoke("browser_push_event", payload).catch(() => undefined);
  };

  let readyInFlight = null;
  const notifyReady = () => {
    if (readyInFlight) return readyInFlight;
    readyInFlight = (async () => {
      try {
        await waitForIpc();
        await invoke("browser_bridge_ready", {
          version: BRIDGE_VERSION,
          url: window.location.href,
        });
      } finally {
        readyInFlight = null;
      }
    })();
    return readyInFlight;
  };

  const removeObserver = (name) => {
    const teardown = state.teardowns[name];
    if (typeof teardown !== "function") return;
    try {
      teardown();
    } catch (_) {}
    delete state.teardowns[name];
  };

  const observers = {
    console: () => {
      const levels = ["log", "warn", "error", "info", "debug"];
      const original = {};
      const wrapped = {};

      levels.forEach((level) => {
        const current = console[level];
        if (typeof current !== "function") return;
        original[level] = current;
        if (current[WRAP_MARKER]) {
          return;
        }
        const wrappedFn = function (...args) {
          pushEvent("console", {
            level,
            args: args.map((arg) => {
              try {
                return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
              } catch (_) {
                return String(arg);
              }
            }),
          });
          return current.apply(console, args);
        };
        wrappedFn[WRAP_MARKER] = true;
        wrapped[level] = wrappedFn;
        console[level] = wrappedFn;
      });

      return () => {
        levels.forEach((level) => {
          if (console[level] === wrapped[level] && typeof original[level] === "function") {
            console[level] = original[level];
          }
        });
      };
    },

    errors: () => {
      const onError = (event) => {
        pushEvent("error", {
          message: event.message || String(event),
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      };
      const onUnhandled = (event) => {
        pushEvent("error", {
          message: String(event.reason),
          type: "unhandledrejection",
        });
      };
      window.addEventListener("error", onError, true);
      window.addEventListener("unhandledrejection", onUnhandled, true);
      return () => {
        window.removeEventListener("error", onError, true);
        window.removeEventListener("unhandledrejection", onUnhandled, true);
      };
    },

    navigation: () => {
      let lastUrl = location.href;
      const check = () => {
        if (location.href === lastUrl) return;
        pushEvent("navigation", { from: lastUrl, to: location.href });
        lastUrl = location.href;
      };

      const onPopstate = () => check();
      window.addEventListener("popstate", onPopstate);

      const origPush = history.pushState;
      const origReplace = history.replaceState;
      const wrappedPush = function () {
        const result = origPush.apply(this, arguments);
        check();
        return result;
      };
      const wrappedReplace = function () {
        const result = origReplace.apply(this, arguments);
        check();
        return result;
      };
      wrappedPush[WRAP_MARKER] = true;
      wrappedReplace[WRAP_MARKER] = true;
      if (!origPush[WRAP_MARKER]) {
        history.pushState = wrappedPush;
      }
      if (!origReplace[WRAP_MARKER]) {
        history.replaceState = wrappedReplace;
      }

      return () => {
        window.removeEventListener("popstate", onPopstate);
        if (history.pushState === wrappedPush) {
          history.pushState = origPush;
        }
        if (history.replaceState === wrappedReplace) {
          history.replaceState = origReplace;
        }
      };
    },

    clicks: () => {
      const handler = (event) => {
        const target = event.target;
        if (!target || !target.tagName) return;
        pushEvent("click", {
          tag: target.tagName,
          id: target.id || undefined,
          className: target.className || undefined,
          text: (target.textContent || "").slice(0, 100),
          x: event.clientX,
          y: event.clientY,
        });
      };
      document.addEventListener("click", handler, true);
      return () => document.removeEventListener("click", handler, true);
    },

    inputs: () => {
      const handler = (event) => {
        const target = event.target;
        if (!target || !target.tagName) return;
        const tag = target.tagName.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && tag !== "select") return;
        pushEvent("input", {
          tag: target.tagName,
          id: target.id || undefined,
          name: target.name || undefined,
          type: target.type || undefined,
          value: (target.value || "").slice(0, 200),
        });
      };
      document.addEventListener("input", handler, true);
      document.addEventListener("change", handler, true);
      return () => {
        document.removeEventListener("input", handler, true);
        document.removeEventListener("change", handler, true);
      };
    },

    dom_mutations: () => {
      const observer = new MutationObserver((mutations) => {
        const sample = mutations.slice(0, 20).map((mutation) => ({
          type: mutation.type,
          target: mutation.target.nodeName,
          addedNodes: mutation.addedNodes.length,
          removedNodes: mutation.removedNodes.length,
          attributeName: mutation.attributeName || undefined,
        }));
        pushEvent("dom_mutation", { count: mutations.length, sample });
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
      return () => observer.disconnect();
    },

    network: () => {
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
      const wrappedOpen = function (method, url) {
        this._weekend = { method, url: String(url) };
        return origOpen.apply(this, arguments);
      };
      const wrappedSend = function () {
        const info = this._weekend;
        if (info) {
          this.addEventListener("loadend", () => {
            pushEvent("network", {
              type: "xhr",
              method: info.method,
              url: info.url,
              status: this.status,
            });
          });
        }
        return origSend.apply(this, arguments);
      };
      wrappedOpen[WRAP_MARKER] = true;
      wrappedSend[WRAP_MARKER] = true;
      if (!origOpen[WRAP_MARKER]) {
        XMLHttpRequest.prototype.open = wrappedOpen;
      }
      if (!origSend[WRAP_MARKER]) {
        XMLHttpRequest.prototype.send = wrappedSend;
      }

      const origFetch = window.fetch;
      let wrappedFetch = null;
      if (typeof origFetch === "function" && !origFetch[WRAP_MARKER]) {
        wrappedFetch = function (input, init) {
          const url =
            typeof input === "string"
              ? input
              : input instanceof Request
                ? input.url
                : String(input);
          const method = (init && init.method) || "GET";
          return origFetch.apply(this, arguments).then(
            (response) => {
              pushEvent("network", {
                type: "fetch",
                method,
                url,
                status: response.status,
              });
              return response;
            },
            (error) => {
              pushEvent("network", {
                type: "fetch",
                method,
                url,
                error: String(error),
              });
              throw error;
            }
          );
        };
        wrappedFetch[WRAP_MARKER] = true;
        window.fetch = wrappedFetch;
      }

      return () => {
        if (XMLHttpRequest.prototype.open === wrappedOpen) {
          XMLHttpRequest.prototype.open = origOpen;
        }
        if (XMLHttpRequest.prototype.send === wrappedSend) {
          XMLHttpRequest.prototype.send = origSend;
        }
        if (wrappedFetch && window.fetch === wrappedFetch) {
          window.fetch = origFetch;
        }
      };
    },

    element_grab: () => {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;border-radius:3px;background:rgba(59,130,246,0.08);transition:all 60ms ease-out;display:none;";
      document.documentElement.appendChild(overlay);

      let currentTarget = null;

      const computeSelector = (el) => {
        if (el.id) return "#" + el.id;
        const parts = [];
        let node = el;
        while (node && node !== document.documentElement) {
          let sel = node.tagName.toLowerCase();
          if (node.id) {
            parts.unshift("#" + node.id);
            break;
          }
          const parent = node.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(
              (c) => c.tagName === node.tagName
            );
            if (siblings.length > 1) {
              sel += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
            }
          }
          parts.unshift(sel);
          node = parent;
        }
        return parts.join(" > ");
      };

      const onMouseOver = (event) => {
        const target = event.target;
        if (!target || !target.tagName || target === document.documentElement) return;
        currentTarget = target;
        const rect = target.getBoundingClientRect();
        overlay.style.left = rect.left + "px";
        overlay.style.top = rect.top + "px";
        overlay.style.width = rect.width + "px";
        overlay.style.height = rect.height + "px";
        overlay.style.display = "block";
      };

      const onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const target = currentTarget || event.target;
        if (!target || !target.tagName) return;

        const tag = target.tagName.toLowerCase();
        const id = target.id || "";
        const className =
          typeof target.className === "string" ? target.className : "";
        const text = (target.textContent || "").trim().slice(0, 200);
        const selector = computeSelector(target);
        const outerHTML = (target.outerHTML || "").slice(0, 500);

        pushEvent("element_grab", { tag, id, className, text, selector, outerHTML });

        // Auto-disable after selection
        configure({ ...state.config, element_grab: false });
      };

      document.addEventListener("mouseover", onMouseOver, true);
      document.addEventListener("click", onClick, true);

      return () => {
        document.removeEventListener("mouseover", onMouseOver, true);
        document.removeEventListener("click", onClick, true);
        overlay.style.display = "none";
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        currentTarget = null;
      };
    },

    custom: () => {
      return () => {};
    },
  };

  const normalizeConfig = (raw) => ({
    console: Boolean(raw && raw.console),
    errors: Boolean(raw && raw.errors),
    navigation: Boolean(raw && raw.navigation),
    clicks: Boolean(raw && raw.clicks),
    inputs: Boolean(raw && raw.inputs),
    dom_mutations: Boolean(raw && raw.dom_mutations),
    network: Boolean(raw && raw.network),
    element_grab: Boolean(raw && raw.element_grab),
    custom: Boolean(raw && raw.custom),
  });

  const configure = (rawConfig) => {
    const config = normalizeConfig(rawConfig);
    Object.keys(observers).forEach((name) => {
      if (config[name]) {
        if (!state.teardowns[name]) {
          state.teardowns[name] = observers[name]();
        }
      } else {
        removeObserver(name);
      }
    });
    state.config = config;
    return {
      ok: true,
      version: BRIDGE_VERSION,
      activeObservers: Object.keys(state.teardowns),
    };
  };

  const teardownAll = () => {
    Object.keys(state.teardowns).forEach(removeObserver);
  };

  const emit = (name, data) => {
    pushEvent("custom", { name, data });
  };

  const api = {
    version: BRIDGE_VERSION,
    configure,
    emit,
    pushEvent,
    notifyReady,
    teardownAll,
  };

  window[BRIDGE_STATE_KEY] = state;
  window[BRIDGE_KEY] = api;

  configure(state.config);
  void notifyReady();
})();
