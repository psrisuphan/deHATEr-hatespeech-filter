const API_URL = "http://127.0.0.1:8000/predict";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "classify-text" || !message.payload) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message.payload),
    credentials: "omit",
    signal: controller.signal
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      sendResponse({ ok: true, data });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message || String(error) });
    })
    .finally(() => {
      clearTimeout(timeout);
    });

  return true;
});
