(function () {
  const PLATFORM_SELECTORS = {
    'twitter.com': ['article[data-testid="tweet"]'],
    'x.com': ['article[data-testid="tweet"]'],
    'facebook.com': ['div[role="article"]'],
    'instagram.com': ['article'],
    'youtube.com': ['ytd-comment-thread-renderer', 'ytd-rich-item-renderer'],
    'reddit.com': ['div[data-test-id="comment"]', 'div[data-testid="post-container"]'],
  };

  const processedElements = new WeakSet();
  const pendingRequests = new WeakMap();
  const HOST = window.location.hostname;

  function currentSelectors() {
    return Object.entries(PLATFORM_SELECTORS)
      .filter(([domain]) => HOST === domain || HOST.endsWith(`.${domain}`))
      .flatMap(([, selectors]) => selectors);
  }

  const selectors = currentSelectors();
  if (!selectors.length) {
    return;
  }

  injectStyles();
  scanDocument();
  observeMutations();

  function injectStyles() {
    if (document.head.querySelector('style[data-ai-filter]')) {
      return;
    }
    const style = document.createElement('style');
    style.dataset.aiFilter = 'true';
    style.textContent = `
      .ai-filter-placeholder {
        border: 1px solid rgba(255, 0, 0, 0.25);
        background: rgba(255, 0, 0, 0.08);
        color: #222;
        padding: 12px;
        margin: 8px 0;
        border-radius: 8px;
        font-family: system-ui, sans-serif;
      }
      .ai-filter-placeholder button {
        border: none;
        background: #f03e3e;
        color: #fff;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 8px;
      }
      .ai-filter-placeholder button:hover {
        background: #c92a2a;
      }
    `;
    document.head.appendChild(style);
  }

  function scanDocument() {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        queueEvaluation(element);
      });
    });
  }

  function observeMutations() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (matchesSelectors(node)) {
            queueEvaluation(node);
          }
          selectors.forEach((selector) => {
            node.querySelectorAll?.(selector).forEach((element) => {
              queueEvaluation(element);
            });
          });
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function matchesSelectors(node) {
    return selectors.some((selector) => node.matches?.(selector));
  }

  function queueEvaluation(element) {
    if (processedElements.has(element) || pendingRequests.has(element)) {
      return;
    }
    const text = extractVisibleText(element);
    if (!text) {
      processedElements.add(element);
      return;
    }

    element.dataset.aiFilterState = 'pending';
    const request = classify(text)
      .then((result) => {
        processedElements.add(element);
        element.dataset.aiFilterState = result.should_block ? 'blocked' : 'allowed';
        if (result.should_block) {
          blockElement(element, result);
        }
      })
      .catch(() => {
        element.dataset.aiFilterState = 'error';
      })
      .finally(() => {
        pendingRequests.delete(element);
      });

    pendingRequests.set(element, request);
  }

  function classify(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'classifyText',
          payload: { text },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (!response || !response.success) {
            reject(new Error(response?.error || 'Unknown error'));
            return;
          }
          resolve(response.result);
        }
      );
    });
  }

  function extractVisibleText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('script, style, video, audio, img').forEach((node) => node.remove());
    const text = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
    return text.length >= 3 ? text : '';
  }

  function blockElement(element, result) {
    if (element.dataset.aiFilterBlocked === 'true') {
      return;
    }
    element.dataset.aiFilterBlocked = 'true';
    const placeholder = createPlaceholder(result);
    element.insertAdjacentElement('beforebegin', placeholder);
    element.style.display = 'none';

    placeholder.querySelector('button')?.addEventListener('click', () => {
      element.style.display = '';
      element.dataset.aiFilterBlocked = 'revealed';
      placeholder.remove();
    });
  }

  function createPlaceholder(result) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-filter-placeholder';
    const score = result.score?.toFixed?.(3) ?? 'n/a';
    wrapper.innerHTML = `
      <strong>Harmful content hidden</strong><br />
      Model score: ${score}<br />
      <button type="button">Show anyway</button>
    `;
    return wrapper;
  }
})();
