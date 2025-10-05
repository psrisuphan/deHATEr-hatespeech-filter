# 4j3k AI Content Filter Extension

This Manifest V3 extension scans supported social media pages, sends visible posts/comments to the local FastAPI inference server, and hides entries the model flags as harmful.

## Prerequisites

1. Start the API server from the project root:
   ```bash
   pip install fastapi uvicorn[standard]
   python api_server.py
   ```
2. Ensure the server is reachable (default `http://127.0.0.1:8000`).

## Load the Extension (Chrome/Edge)

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `extension/` folder in this project.
4. The extension icon should appear – it runs automatically on supported domains.

## Configure the API URL or Age Policy

1. On the extensions page, click **Details** for **4j3k AI Content Filter**.
2. Open **Extension options**.
3. Set the API Base URL (e.g. `http://127.0.0.1:8000`) and optional user age, then save.

## Supported Platforms

The content script watches for new posts/comments on:
- twitter.com / x.com
- facebook.com
- instagram.com
- youtube.com (feed items & comments)
- reddit.com

When the model returns `should_block: true`, the original element is hidden and replaced with a placeholder. Users can reveal the content by clicking **Show anyway**.

## Extending Coverage

Edit `contentScript.js` to tweak selectors or add new domains. The observer will automatically pick up elements matching any selector and forward their text to the API.

## Troubleshooting

- Use the browser console (content script) or `chrome://extensions/?errors=` to inspect runtime errors.
- Ensure CORS on the API allows the browser origin (FastAPI defaults work for same-origin localhost calls).
- If the API is remote, add its URL pattern to `host_permissions` in `manifest.json`.

