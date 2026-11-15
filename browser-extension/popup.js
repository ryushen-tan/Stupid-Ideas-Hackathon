const elements = Object.fromEntries(
  [
    "connect",
    "server",
    "pair",
    "pairing",
    "pair-code",
    "ready",
    "website",
    "fill",
    "status",
    "disconnect",
    "forget",
  ].map((id) => [id, document.getElementById(id)]),
);
let timer;
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response.ok) throw new Error(response.error);
  return response.result;
}
async function refresh() {
  const state = await send({ type: "status" });
  elements.connect.hidden = state.connected;
  elements.pairing.hidden = !state.connected || state.paired;
  elements.ready.hidden = !state.paired;
  elements.disconnect.hidden = !state.connected;
  if (state.pairCode) elements["pair-code"].textContent = state.pairCode;
  if (state.url) elements.server.value = state.url;
  if (state.paired) {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    elements.website.textContent =
      tab?.url && /^https?:/.test(tab.url)
        ? new URL(tab.url).origin
        : "Open a website’s verification page.";
  } else if (state.connected)
    timer = setTimeout(() => refresh().catch(fail), 1500);
}
function fail(failure) {
  elements.status.textContent = failure.message;
  elements.forget.hidden = false;
}
elements.pair.onclick = async () => {
  elements.pair.disabled = true;
  elements.status.textContent = "";
  try {
    const url = new URL(elements.server.value.trim());
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Use an HTTP or HTTPS server address.");
    const granted = await chrome.permissions.request({
      origins: [`${url.origin}/*`],
    });
    if (!granted)
      throw new Error("Allow the connection to your Drip server to pair.");
    await send({ type: "connect", url: url.href });
    await refresh();
  } catch (failure) {
    fail(failure);
  } finally {
    elements.pair.disabled = false;
  }
};
elements.fill.onclick = async () => {
  elements.fill.disabled = true;
  elements.status.textContent = "";
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url))
      throw new Error("Open the website’s verification page first.");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["autofill.js", "content.js"],
    });
    const response = await chrome.tabs.sendMessage(tab.id, { type: "start" });
    if (!response.ok) throw new Error(response.error);
    window.close();
  } catch (failure) {
    fail(failure);
  } finally {
    elements.fill.disabled = false;
  }
};
elements.disconnect.onclick = async () => {
  try {
    clearTimeout(timer);
    await send({ type: "disconnect" });
    await refresh();
  } catch (failure) {
    fail(failure);
  }
};
elements.forget.onclick = async () => {
  try {
    clearTimeout(timer);
    await send({ type: "forget" });
    elements.status.textContent = "";
    elements.forget.hidden = true;
    await refresh();
  } catch (failure) {
    fail(failure);
  }
};
void refresh().catch(fail);
