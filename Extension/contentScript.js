(() => {
  "use strict";

  if (window.top !== window.self) {
    return;
  }

  const MAX_CONCURRENT_REQUESTS = 3;
  const TEXT_MIN_LENGTH = 20;
  const TEXT_MAX_LENGTH = 1500;

  const SELECTORS = [
    "div[data-testid='post_message']",
    "div[data-ad-preview='message']",
    "div[role='article']",
    "article div[data-testid='tweetText']",
    "div[data-testid='tweetText']",
    "div[data-testid='comment']",
    "div[role='dialog'] article",
    "div[dir='auto'][lang]",
    "span[dir='auto'][lang]",
    "yt-formatted-string#content-text",
    "ytd-comment-thread-renderer #content-text",
    "ytd-rich-item-renderer #content-text",
    "div[data-e2e='aweme_item_text']",
    "div[data-e2e='comment-content']",
    "div[data-testid='post']",
    "div[data-testid='reply']"
  ];

  const IGNORE_SELF_OR_ANCESTOR = [
    "form",
    "nav",
    "header",
    "footer",
    "aside",
    "[role='search']",
    "[role='navigation']",
    "[aria-label='Search']",
    "[data-testid='primaryColumn'] form",
    "[aria-label='Search and explore']"
  ];

  const IGNORE_INTERACTIVE_DESCENDANT = "input, textarea, select, button, [role='textbox'], [role='combobox'], [contenteditable='true']";

  const state = {
    enabled: false,
    age: null,
    initialized: false
  };

  let elementState = new WeakMap();
  const blockedElements = new Map();
  const resultCache = new Map();
  const requestQueue = [];
  let activeRequests = 0;

  const ensureStyles = () => {
    if (document.getElementById("hate-blocker-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "hate-blocker-style";
    style.textContent = `
      .hate-blocker-placeholder {
        border: 1px solid rgba(220, 53, 69, 0.4);
        background: rgba(220, 53, 69, 0.12);
        color: #4d0000;
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        padding: 12px 14px;
        border-radius: 8px;
        margin: 8px 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 720px;
      }

      .hate-blocker-placeholder button {
        align-self: flex-start;
        background: #4d0000;
        color: #fff;
        border: none;
        border-radius: 16px;
        padding: 6px 16px;
        font-size: 14px;
        cursor: pointer;
      }

      .hate-blocker-placeholder button:hover {
        background: #360000;
      }

      .hate-blocker-placeholder button:focus {
        outline: 2px solid rgba(77, 0, 0, 0.35);
        outline-offset: 2px;
      }

      .hate-blocker-placeholder small {
        opacity: 0.8;
      }
    `;

    document.head.appendChild(style);
  };

  const shouldIgnoreElement = (element) => {
    if (!element || !(element instanceof HTMLElement)) {
      return true;
    }

    if (element.dataset && element.dataset.hateBlocker === "placeholder") {
      return true;
    }

    if (element.closest && element.closest(".hate-blocker-placeholder")) {
      return true;
    }

    if (IGNORE_SELF_OR_ANCESTOR.some((selector) => element.matches(selector) || element.closest(selector))) {
      return true;
    }

    if (element.matches(IGNORE_INTERACTIVE_DESCENDANT) || element.querySelector(IGNORE_INTERACTIVE_DESCENDANT)) {
      return true;
    }

    return false;
  };

  const updateSettings = (incoming) => {
    const prevEnabled = state.enabled;
    state.enabled = Boolean(incoming.enabled);
    state.age = Number.isFinite(incoming.age) ? incoming.age : null;

    if (!state.enabled) {
      clearPendingWork();
      restoreBlockedElements();
    } else if (!prevEnabled && state.enabled) {
      ensureInitialized();
      scheduleScan(document.body);
    }
  };

  const clearPendingWork = () => {
    requestQueue.length = 0;
  };

  const restoreBlockedElements = () => {
    blockedElements.forEach(({ placeholder, originalDisplay }, element) => {
      if (placeholder.isConnected) {
        placeholder.remove();
      }

      if (element && element.style) {
        element.style.display = originalDisplay;
      }
    });

    blockedElements.clear();
    elementState = new WeakMap();
  };

  const ensureInitialized = () => {
    if (state.initialized || !document.body) {
      return;
    }

    state.initialized = true;

    const observer = new MutationObserver((mutations) => {
      if (!state.enabled) {
        return;
      }

      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scheduleScan(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            scheduleElement(node.parentElement);
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleScan(document.body);
  };

  const scheduleScan = (root) => {
    if (!state.enabled) {
      return;
    }

    if (!(root instanceof HTMLElement)) {
      return;
    }

    if (root !== document.body && root !== document.documentElement) {
      scheduleElement(root);
    }

    SELECTORS.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => {
        scheduleElement(element);
      });
    });
  };

  const scheduleElement = (element) => {
    if (!state.enabled) {
      return;
    }

    if (!(element instanceof HTMLElement)) {
      return;
    }

    if (blockedElements.has(element)) {
      return;
    }

    if (elementState.has(element)) {
      return;
    }

    if (shouldIgnoreElement(element)) {
      elementState.set(element, { status: "ignored" });
      return;
    }

    const extractedText = extractText(element);

    if (!extractedText) {
      elementState.set(element, { status: "empty" });
      return;
    }

    elementState.set(element, { status: "queued" });
    enqueue({ element, text: extractedText });
  };

  const extractText = (element) => {
    const raw = element.innerText || element.textContent || "";
    const normalized = raw.replace(/\s+/g, " ").trim();

    if (normalized.length < TEXT_MIN_LENGTH) {
      return "";
    }

    return normalized.slice(0, TEXT_MAX_LENGTH);
  };

  const enqueue = (task) => {
    requestQueue.push(task);
    drainQueue();
  };

  const drainQueue = () => {
    if (!state.enabled) {
      return;
    }

    while (state.enabled && activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
      const task = requestQueue.shift();

      if (!task) {
        continue;
      }

      const { element, text } = task;

      if (!element.isConnected) {
        continue;
      }

      activeRequests += 1;

      classifyText(text)
        .then((result) => {
          if (!state.enabled) {
            return;
          }

          if (!element.isConnected) {
            return;
          }

          if (!result || typeof result.should_block === "undefined") {
            elementState.set(element, { status: "error" });
            return;
          }

          if (result.should_block) {
            applyBlock(element, result);
            elementState.set(element, { status: "blocked" });
          } else {
            elementState.set(element, { status: "clean" });
          }
        })
        .catch((error) => {
          console.warn("HateThaiSent: inference failed", error);
          elementState.set(element, { status: "error" });
        })
        .finally(() => {
          activeRequests = Math.max(0, activeRequests - 1);
          if (state.enabled) {
            drainQueue();
          }
        });
    }
  };

  const classifyText = (text) => {
    if (resultCache.has(text)) {
      return resultCache.get(text);
    }

    const request = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "classify-text",
          payload: {
            text,
            age: state.age
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response || !response.ok) {
            const errorMessage = response && response.error ? response.error : "Empty response from background";
            reject(new Error(errorMessage));
            return;
          }

          resolve(response.data);
        }
      );
    }).catch((error) => {
      resultCache.delete(text);
      throw error;
    });

    resultCache.set(text, request);
    return request;
  };

  const applyBlock = (element, result) => {
    if (blockedElements.has(element)) {
      return;
    }

    ensureStyles();

    const placeholder = document.createElement("div");
    placeholder.className = "hate-blocker-placeholder";
    placeholder.dataset.hateBlocker = "placeholder";

    const scorePercentage = typeof result.score === "number" ? Math.round(result.score * 100) : null;
    const metaLine = scorePercentage !== null ? `Model confidence: ${scorePercentage}%` : "Model flagged this content.";

    const revealButton = document.createElement("button");
    revealButton.type = "button";
    revealButton.textContent = "Show message";

    const meta = document.createElement("small");
    meta.textContent = metaLine;

    const title = document.createElement("strong");
    title.textContent = "Potential hate speech hidden";

    placeholder.appendChild(title);
    placeholder.appendChild(meta);
    placeholder.appendChild(revealButton);

    const originalDisplay = element.style.display;
    element.style.display = "none";
    element.insertAdjacentElement("beforebegin", placeholder);

    const toggleVisibility = () => {
      const isHidden = element.style.display === "none";
      if (isHidden) {
        element.style.display = originalDisplay || "";
        revealButton.textContent = "Hide message";
      } else {
        element.style.display = "none";
        revealButton.textContent = "Show message";
      }
    };

    revealButton.addEventListener("click", toggleVisibility);

    blockedElements.set(element, { placeholder, originalDisplay });
  };

  const bootstrap = () => {
    chrome.storage.local.get({ enabled: false, age: null }, (stored) => {
      updateSettings(stored);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      const updates = {};

      if (Object.prototype.hasOwnProperty.call(changes, "enabled")) {
        updates.enabled = changes.enabled.newValue;
      }

      if (Object.prototype.hasOwnProperty.call(changes, "age")) {
        updates.age = changes.age.newValue;
      }

      if (Object.keys(updates).length > 0) {
        updateSettings({ ...state, ...updates });
      }
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensureInitialized, { once: true });
    } else {
      ensureInitialized();
    }
  };

  bootstrap();
})();
