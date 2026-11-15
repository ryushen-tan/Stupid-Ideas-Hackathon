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
    throw new Error(failure.error ?? `Drip returned ${response.status}.`);
  }
  return response.status === 204 ? null : response.json();
}

async function handle(message, sender) {
  await storageReady;
  if (sender.url === chrome.runtime.getURL("popup.html")) {
    if (message.type === "connect") {
      const url = new URL(message.url);
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
      });
      return { pairCode: result.pairCode, expiresAt: result.expiresAt };
    }
    if (message.type === "status") {
      const { connection } = await chrome.storage.local.get("connection");
      if (!connection) return { connected: false };
      const status = await relay("/status");
      return {
        connected: true,
        paired: status.paired,
        pairCode: status.paired ? null : connection.pairCode,
        url: connection.url,
      };
    }
    if (message.type === "disconnect") {
      await relay("/connection", { method: "DELETE" });
      await chrome.storage.local.remove("connection");
      await chrome.storage.session.clear();
      return { disconnected: true };
    }
    if (message.type === "forget") {
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
