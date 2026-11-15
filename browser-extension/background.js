const storageReady = chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS",
});

async function relay(path, options = {}) {
  await storageReady;
  const { connection } = await chrome.storage.local.get("connection");
  if (!connection) throw new Error("Connect your app first.");
  const response = await fetch(`${connection.url}/api/browser${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${connection.token}`,
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const failure = await response.json();
    const error = new Error(
      failure.error ?? `Drip returned ${response.status}.`,
    );
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function connect(address) {
  const url = new URL(address);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Enter the server address only.");
  const response = await fetch(`${url.origin}/api/browser/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "My browser" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error((await response.json()).error);
  const result = await response.json();
  await chrome.storage.local.set({
    connection: { url: url.origin, ...result },
    serverUrl: url.origin,
    autoConnectDisabled: false,
  });
  return { pairCode: result.pairCode, expiresAt: result.expiresAt };
}

let statusRequest;
function connectionStatus() {
  if (statusRequest) return statusRequest;
  statusRequest = (async () => {
    const {
      connection,
      serverUrl = "http://localhost:4310",
      autoConnectDisabled = false,
    } = await chrome.storage.local.get([
      "connection",
      "serverUrl",
      "autoConnectDisabled",
    ]);
    if (autoConnectDisabled && !connection)
      return { connected: false, demo: false };
    const url = connection ? connection.url : serverUrl;
    const response = await fetch(`${url}/api/browser/demo`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok)
      throw new Error(`Cannot check Drip demo mode (${response.status}).`);
    const { enabled } = await response.json();
    let status;
    if (connection) {
      try {
        status = await relay("/status");
      } catch (failure) {
        if (!enabled || failure.status !== 401) throw failure;
      }
    }
    if (enabled && status && !status.paired && !status.demo) {
      await relay("/connection", { method: "DELETE" });
      status = null;
    }
    if (!status && enabled && !autoConnectDisabled) {
      await connect(url);
      status = await relay("/status");
    }
    if (!status) return { connected: false, demo: false };
    const current = (await chrome.storage.local.get("connection")).connection;
    return {
      connected: true,
      paired: status.paired,
      demo: enabled && Boolean(status.demo),
      pairCode: status.paired || enabled ? null : current.pairCode,
      url,
    };
  })().finally(() => {
    statusRequest = null;
  });
  return statusRequest;
}

async function handle(message, sender) {
  await storageReady;
  if (sender.url === chrome.runtime.getURL("popup.html")) {
    if (message.type === "connect") return connect(message.url);
    if (message.type === "status") return connectionStatus();
    if (message.type === "disconnect") {
      await relay("/connection", { method: "DELETE" });
      await chrome.storage.local.set({ autoConnectDisabled: true });
      await chrome.storage.local.remove("connection");
      await chrome.storage.session.clear();
      return { disconnected: true };
    }
    if (message.type === "forget") {
      await chrome.storage.local.set({ autoConnectDisabled: true });
      await chrome.storage.local.remove("connection");
      await chrome.storage.session.clear();
      return { disconnected: true };
    }
    throw new Error("Unknown extension action.");
  }
  if (!sender.tab || sender.frameId !== 0 || !sender.documentId)
    throw new Error("Use the main verification page.");
  const origin = new URL(sender.url).origin;
  if (!/^https?:/.test(origin))
    throw new Error("Open a website verification page.");
  if (message.type === "demo-status") {
    if (!["http://localhost:3020", "http://127.0.0.1:3020"].includes(origin))
      throw new Error(
        "Automatic connection is only available on the local demo website.",
      );
    return connectionStatus();
  }
  const key = `request:${sender.tab.id}:${sender.documentId}`;
  if (message.type === "request") {
    const existing = (await chrome.storage.session.get(key))[key];
    if (existing) await relay(`/requests/${existing.id}`, { method: "DELETE" });
    const pending = await relay("/requests", {
      method: "POST",
      body: JSON.stringify({ origin }),
    });
    await chrome.storage.session.set({ [key]: { ...pending, origin } });
    return pending;
  }
  const pending = (await chrome.storage.session.get(key))[key];
  if (!pending || pending.id !== message.id || pending.origin !== origin)
    throw new Error("This page no longer has an active request.");
  if (message.type === "cancel") {
    await relay(`/requests/${pending.id}`, { method: "DELETE" });
    await chrome.storage.session.remove(key);
    return { cancelled: true };
  }
  if (message.type !== "poll") throw new Error("Unknown page action.");
  const result = await relay(`/requests/${pending.id}`);
  if (result.status === "ready") {
    await chrome.storage.session.remove(key);
    if (result.origin !== origin || result.validUntil <= Date.now() + 1000)
      throw new Error(
        "The code expired or the website changed. Request a new code.",
      );
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(
    (result) => respond({ ok: true, result }),
    (failure) => respond({ ok: false, error: failure.message }),
  );
  return true;
});
