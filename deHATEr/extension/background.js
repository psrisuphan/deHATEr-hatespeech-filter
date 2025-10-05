const DEFAULT_CONFIG = {
  apiBaseUrl: 'http://127.0.0.1:8000',
  age: null,
};

async function getConfig() {
  const stored = await chrome.storage.sync.get(['apiBaseUrl', 'age']);
  return {
    ...DEFAULT_CONFIG,
    ...stored,
  };
}

async function classifyText(text) {
  const { apiBaseUrl, age } = await getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, age }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`API error ${response.status}: ${detail}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['apiBaseUrl'], (stored) => {
    if (!stored.apiBaseUrl) {
      chrome.storage.sync.set({ apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.type === 'getConfig') {
    getConfig()
      .then((config) => sendResponse({ success: true, config }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'classifyText') {
    classifyText(message.payload?.text)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return undefined;
});
