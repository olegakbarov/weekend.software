(async function () {
  const __weekend_request_id = __WEEKEND_REQUEST_ID_JSON__;
  const __weekend_callback_token = __WEEKEND_CALLBACK_TOKEN_JSON__;
  const __weekend_sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const __weekend_has_low_level_ipc = () => {
    const i = window.__TAURI_INTERNALS__;
    return Boolean(
      i &&
        typeof i.ipc === "function" &&
        typeof i.transformCallback === "function" &&
        typeof i.unregisterCallback === "function"
    );
  };
  const __weekend_wait_for_ipc = async (timeoutMs = 2000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      if (
        window.__TAURI_INTERNALS__ &&
        (typeof window.__TAURI_INTERNALS__.invoke === "function" ||
          __weekend_has_low_level_ipc())
      ) {
        return;
      }
      await __weekend_sleep(25);
    }
    throw new Error("Tauri IPC bridge unavailable");
  };
  const __weekend_invoke = async (cmd, payload) => {
    const i = window.__TAURI_INTERNALS__;
    if (i && typeof i.invoke === "function") {
      try {
        return await i.invoke(cmd, payload);
      } catch (__weekend_invoke_err) {
        if (!__weekend_has_low_level_ipc()) {
          throw __weekend_invoke_err;
        }
      }
    }
    if (!__weekend_has_low_level_ipc()) {
      throw new Error("Tauri low-level IPC unavailable");
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
        i.ipc({
          cmd,
          callback,
          error,
          payload,
        });
      } catch (sendError) {
        try {
          i.unregisterCallback(callback);
          i.unregisterCallback(error);
        } catch (_) {}
        reject(sendError);
      }
    });
  };
  const __weekend_send = async (payload) => {
    await __weekend_wait_for_ipc();
    await __weekend_invoke("browser_eval_result", {
      requestId: __weekend_request_id,
      callbackToken: __weekend_callback_token,
      payload: JSON.stringify(payload),
    });
  };
  try {
    let __weekend_result = await (async function () {
      __WEEKEND_USER_SCRIPT__
    })();
    if (__weekend_result === undefined) __weekend_result = null;
    await __weekend_send({ ok: true, value: __weekend_result });
  } catch (__weekend_err) {
    try {
      await __weekend_send({ ok: false, error: String(__weekend_err) });
    } catch (__weekend_send_err) {
      console.error("[Weekend Software] eval callback failed", __weekend_send_err);
    }
  }
})();
