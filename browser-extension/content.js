(() => {
  if (globalThis.dripListenerInstalled) return;
  globalThis.dripListenerInstalled = true;
  let pending = null;
  let timer = null;
  let statusHost = null;
  function showStatus(text, cancel = false) {
    if (statusHost) statusHost.remove();
    statusHost = document.createElement("div");
    statusHost.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:2147483647";
    const root = statusHost.attachShadow({ mode: "closed" });
    const box = document.createElement("div");
    box.style.cssText =
      "font:14px system-ui;color:#e3e3e3;background:#27292b;border:1px solid #424547;border-radius:18px;padding:18px;max-width:280px;box-shadow:0 6px 24px #0005";
    box.setAttribute("role", "status");
    const label = document.createElement("div");
    label.textContent = text;
    box.append(label);
    const button = document.createElement("button");
    button.textContent = cancel ? "Cancel" : "Dismiss";
    button.style.cssText =
      "background:none;border:0;color:#a8c7fa;padding:12px 0 0;cursor:pointer;font:inherit";
    button.onclick = async () => {
      try {
        if (cancel && pending) await send({ type: "cancel", id: pending.id });
        clearTimeout(timer);
        pending = null;
        statusHost.remove();
      } catch (failure) {
        showStatus(failure.message);
      }
    };
    box.append(button);
    root.append(box);
    document.documentElement.append(statusHost);
  }
  async function send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response.ok) throw new Error(response.error);
    return response.result;
  }
  async function poll() {
    const current = pending;
    if (!current) return;
    try {
      if (Date.now() >= current.expiresAt || location.origin !== current.origin)
        throw new Error("Drip request expired. Request a new code.");
      const result = await send({ type: "poll", id: current.id });
      if (pending !== current) return;
      if (result.status === "ready") {
        if (result.validUntil <= Date.now() + 1000)
          throw new Error("The code expired. Request a new code.");
        globalThis.dripAutofill.fill(
          current.fields,
          result.code,
          current.origin,
        );
        pending = null;
        showStatus("Code filled. Continue on this website.");
      } else if (["rejected", "delivered"].includes(result.status)) {
        throw new Error(
          result.status === "rejected"
            ? "Request declined in Drip."
            : "This request has already been used. Request a new code.",
        );
      } else {
        timer = setTimeout(poll, 1000);
      }
    } catch (failure) {
      pending = null;
      showStatus(failure.message);
    }
  }
  async function start() {
    if (pending) return { ok: true };
    const fields = globalThis.dripAutofill.fields();
    if (fields.some((input) => input.value))
      throw new Error("Clear the verification field before requesting a code.");
    clearTimeout(timer);
    const result = await send({ type: "request" });
    pending = { ...result, fields, origin: location.origin };
    showStatus(
      "Open Drip → Browser extension. Complete your clothing check to fill this code.",
      true,
    );
    void poll();
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type !== "start") return;
    start().then(respond, (failure) =>
      respond({ ok: false, error: failure.message }),
    );
    return true;
  });
  if (
    ["http://localhost:3020", "http://127.0.0.1:3020"].includes(location.origin)
  ) {
    let requestedField = null;
    async function watchDemo() {
      const field = document.querySelector(
        'input[autocomplete="one-time-code"]',
      );
      try {
        if (
          field &&
          field !== requestedField &&
          !field.value &&
          !field.disabled &&
          field.getClientRects().length
        ) {
          const state = await send({ type: "demo-status" });
          if (!state.demo) return;
          if (state.paired) {
            requestedField = field;
            await start();
          } else
            showStatus(
              "Open Drip on your phone to connect this demo automatically.",
            );
        }
      } catch (failure) {
        showStatus(failure.message);
      }
      setTimeout(watchDemo, 1500);
    }
    void watchDemo();
  }
})();
