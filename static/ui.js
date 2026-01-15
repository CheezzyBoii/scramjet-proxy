const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		scramitize: false,
		cleanErrors: true,
		sourcemaps: true,
	},
});

scramjet.init();
navigator.serviceWorker.register("./sw.js");

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const flex = css`
	display: flex;
`;
const col = css`
	flex-direction: column;
`;

connection.setTransport(store.transport, [{ wisp: store.wispurl }]);

// History utilities
const HISTORY_KEY = "scramjet_history";
function loadHistory() {
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		const arr = raw ? JSON.parse(raw) : [];
		// dedupe by normalized url, keep first occurrence (newest-first)
		const seen = new Set();
		const result = [];
		for (const it of arr) {
			try {
				const n = normalizeUrl(it.url || "");
				if (seen.has(n)) continue;
				seen.add(n);
				result.push(it);
			} catch (_) {
				if (!seen.has(it.url)) {
					seen.add(it.url);
					result.push(it);
				}
			}
		}
		return result;
	} catch (e) {
		return [];
	}
}
function normalizeUrl(u) {
	try {
		let url = new URL(u);
		// remove hash
		url.hash = "";
		// normalize pathname: remove trailing slash except for root
		if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
			url.pathname = url.pathname.replace(/\/+$/, "");
		}
		return url.origin + url.pathname + url.search;
	} catch (e) {
		return u;
	}
}

function History() {
	this.css = `
    transition: opacity 0.4s ease;
    :modal[open] { animation: fade 0.4s ease normal; }
    :modal::backdrop { backdrop-filter: blur(3px); }
    .hist-list { max-height: 40vh; overflow: auto; }
    .hist-item { padding: 8px; border-bottom: 1px solid #333; cursor: pointer; display:flex; flex-direction: column; gap:4px; }
    .hist-item:hover { background-color: rgba(255, 140, 0, 0.1); }
    .hist-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 480px; }
    .hist-url { color: #ff8c00; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 480px; }
    .hist-meta { color: #999; font-size: 0.8em; }
    .buttons { gap: 0.5em; }
    .buttons button { border: 1px solid #ff8c00; background-color: #1a1a1a; border-radius: 0.75em; color: #fff; padding: 0.45em; transition: all 0.2s ease; }
    .buttons button:hover { background-color: rgba(255, 140, 0, 0.15); }
  `;

	function handleClose(modal) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 200);
	}

	return html`
		<dialog
			class="history"
			style="background-color: #0d0d0d; color: white; border-radius: 8px; width: 520px; border: 1px solid #ff8c00;"
		>
			<h3 style="color: #ff8c00; margin-top: 0;">History</h3>
			<div class="hist-list"></div>
			<div class=${[flex, "buttons", "centered"]} style="margin-top:8px;">
				<button class="clear">Clear history</button>
				<button class="close">Close</button>
			</div>
		</dialog>
	`;
}

// Render history into any open history dialog
function renderHistoryDialog() {
	const listEl = document.querySelector(".history .hist-list");
	if (!listEl) return;
	const entries = loadHistory();
	if (!entries.length) {
		listEl.innerHTML = '<div style="padding:8px;color:gray">No history</div>';
		return;
	}
	listEl.innerHTML = entries
		.map((e) => {
			const d = new Date(e.ts);
			const time = d.toLocaleString();
			let title = e.title;
			try {
				if (!title) {
					// use hostname as fallback title
					title = new URL(e.url).hostname;
				}
			} catch (_) {
				title = e.url;
			}

			return `
        <div class="hist-item" data-url="${escapeHtml(e.url)}">
          <div class="hist-title">${escapeHtml(title)}</div>
          <div class="hist-url">${escapeHtml(e.url)}</div>
          <div class="hist-meta">${time}</div>
        </div>`;
		})
		.join("");

	// attach click handlers
	listEl.querySelectorAll(".hist-item").forEach((el) => {
		el.addEventListener("click", (ev) => {
			const url = el.getAttribute("data-url");
			// move this entry to top with updated timestamp (use normalized comparison)
			const entries = loadHistory();
			const norm = normalizeUrl(url);
			const i = entries.findIndex((en) => normalizeUrl(en.url) === norm);
			if (i !== -1) {
				const item = entries.splice(i, 1)[0];
				item.ts = Date.now();
				entries.unshift(item);
				saveHistory(entries);
			}
			document.dispatchEvent(
				new CustomEvent("history:navigate", { detail: url })
			);
		});
	});
}

function escapeHtml(str) {
	return String(str).replace(
		/[&<>\"]/g,
		(s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[s]
	);
}
function saveHistory(arr) {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
	} catch (e) {}
}
function addHistory(url) {
	if (!url) return;
	const entries = loadHistory();
	const norm = normalizeUrl(url);
	// remove existing entry for same normalized url to avoid duplicates
	const idx = entries.findIndex((e) => e && normalizeUrl(e.url) === norm);
	if (idx !== -1) entries.splice(idx, 1);
	// insert new entry; title may be undefined (will be resolved in render)
	entries.unshift({ url, norm, title: undefined, ts: Date.now() });
	// keep reasonable length
	if (entries.length > 200) entries.length = 200;
	saveHistory(entries);
}
function clearHistory() {
	saveHistory([]);
}

function Config() {
	this.css = `
    transition: opacity 0.4s ease;
    :modal[open] { animation: fade 0.4s ease normal; }
    :modal::backdrop { backdrop-filter: blur(3px); }

    .buttons {
      display: flex;
      gap: 0.5em;
      align-self: end;
    }

    .buttons button {
      border: 1px solid #ff8c00;
      background-color: #1a1a1a;
      border-radius: 0.75em;
      color: #ff8c00;
      padding: 0.45em;
      transition: all 0.2s ease;
      cursor: pointer;
      font-family: inherit;
    }

    .buttons button:hover {
      background-color: rgba(255, 140, 0, 0.15);
    }

    .buttons button.active {
      background-color: #ff8c00;
      color: #000;
    }

    .input_row {
      display: flex;
      flex-direction: column;
      gap: 0.2em;
    }

    .input_row label {
      font-size: 0.7rem;
      color: #ff8c00;
    }

    .input_row input {
      background-color: #1a1a1a;
      border: 1px solid #ff8c00;
      border-radius: 0.3em;
      color: #ff8c00;
      padding: 0.3em;
      outline: none;
      font-family: inherit;
    }

    .input_row input:focus {
      border-color: #ffa500;
      box-shadow: 0 0 8px rgba(255, 140, 0, 0.3);
    }

    .transport-display {
      color: #ff8c00;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      margin: 0.5em 0;
    }

    .centered {
      justify-content: center;
    }
  `;

	function handleModalClose(modal) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 250);
	}

	function setTransport(path, opts) {
		connection.setTransport(path, opts);
		store.transport = path;
		// Update active button styling
		const buttons = document.querySelectorAll(".transport-btn");
		buttons.forEach((btn) => {
			btn.classList.remove("active");
			if (btn.dataset.transport === path) {
				btn.classList.add("active");
			}
		});
	}

	return html`
      <dialog class="cfg" style="background-color: #0d0d0d; color: #ff8c00; border-radius: 8px;">
        <div style="align-self: end">
          <div class=${[flex, "buttons"]}>
            <button class=${use(store.transport) === "/baremod/index.mjs" ? "active" : ""}
                    on:click=${() => setTransport("/baremod/index.mjs", [])}>
              use bare server 3
            </button>
            <button class=${use(store.transport) === "/libcurl/index.mjs" ? "active" : ""}
                    on:click=${() => setTransport("/libcurl/index.mjs", [{ wisp: store.wispurl }])}>
              use libcurl.js
            </button>
            <button class=${use(store.transport) === "/epoxy/index.mjs" ? "active" : ""}
                    on:click=${() => setTransport("/epoxy/index.mjs", [{ wisp: store.wispurl }])}>
              use epoxy
            </button>
          </div>
        </div>
        <div class=${[flex, col, "input_row"]}>
          <label for="wisp_url_input">Wisp URL:</label>
          <input id="wisp_url_input" bind:value=${use(store.wispurl)} spellcheck="false"></input>
        </div>
        <div class=${[flex, col, "input_row"]}>
          <label for="bare_url_input">Bare URL:</label>
          <input id="bare_url_input" bind:value=${use(store.bareurl)} spellcheck="false"></input>
        </div>
        <div class="transport-display">${use(store.transport)}</div>
        <div class=${[flex, "buttons", "centered"]}>
          <button on:click=${() => handleModalClose(this.root)}>close</button>
        </div>
      </dialog>
  `;
}

function BrowserApp() {
	this.css = `
    width: 100%;
    height: 100%;
    color: #e0def4;
    display: flex;
    flex-direction: column;
    padding: clamp(0.3em, 0.6vw, 0.8em);
    padding-top: 0;
    box-sizing: border-box;

    a {
      color: #ff8c00;
    }

    input,
    button {
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont,
        sans-serif;
    }

    /* Responsive breakpoints for better scalability */
    @media (max-width: 768px) {
      padding: 0.3em;
    }

    @media (min-width: 1920px) {
      padding: 1em;
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 10, 10, 0.95);
      backdrop-filter: blur(3px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .loading-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .loader {
      width: 55px;
      aspect-ratio: 1;
      --g1:conic-gradient(from 90deg at top 3px left 3px,#0000 90deg,#ff8c00 0);
      --g2:conic-gradient(from -90deg at bottom 3px right 3px,#0000 90deg,#ff8c00 0);
      background:
        var(--g1),var(--g1),var(--g1),var(--g1), 
        var(--g2),var(--g2),var(--g2),var(--g2);
      background-position: 0 0,100% 0,100% 100%,0 100%;
      background-size: 25px 25px;
      background-repeat: no-repeat;
      animation: l11 1.5s infinite;
    }

    @keyframes l11 {
      0%   {background-size:35px 15px,15px 15px,15px 35px,35px 35px}
      25%  {background-size:35px 35px,15px 35px,15px 15px,35px 15px}
      50%  {background-size:15px 35px,35px 35px,35px 15px,15px 15px}
      75%  {background-size:15px 15px,35px 15px,35px 35px,15px 35px}
      100% {background-size:35px 15px,15px 15px,15px 35px,35px 35px}
    }
    .version {
    }
    h1 {
      font-family: "Inter Tight", "Inter", system-ui, -apple-system, BlinkMacSystemFont,
      sans-serif;
      margin-bottom: 0;
      color: #ff8c00;
    }
    iframe {
      background-color: #fff;
      border: none;
      box-shadow: none;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      width: 100%;
      display: block;
    }

    /* catch any wrapper or internal borders */
    iframe, iframe * {
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
    }

    input.bar {
      font-family: "Inter";
      padding: clamp(0.3em, 0.5vw, 0.6em);
      padding-left: clamp(0.4em, 0.8vw, 1em);
      border: none;
      outline: none;
      color: #fff;
      height: clamp(2em, 3vw, 3.5em);
      font-size: clamp(0.875rem, 1vw, 1.125rem);
      border-radius: clamp(0.3em, 0.5vw, 0.6em);
      flex: 1;

      background-color: #1a1a1a;
      border: 1px solid #ff8c00;
      transition: all 0.2s ease;
    }
    input.bar:focus {
      border-color: #ffa500;
      box-shadow: 0 0 8px rgba(255, 140, 0, 0.3);
    }
    .input_row > label {
      font-size: 0.7rem;
      color: #ff8c00;
    }
    p {
      margin: 0;
      margin-top: 0.2em;
    }

    .nav {
      padding-top: clamp(0.4em, 0.8vh, 0.8em);
      padding-bottom: clamp(0.4em, 0.8vh, 0.8em);
      gap: clamp(0.3em, 0.6vw, 0.8em);
      border-bottom: 1px solid #ff8c00;
    }
    spacer {
      margin-left: 10em;
    }

    .nav button {
      color: #fff;
      outline: none;
      border: 1px solid #ff8c00;
      border-radius: clamp(0.3em, 0.5vw, 0.5em);
      background-color: #1a1a1a;
      padding: clamp(0.3em, 0.6vw, 0.8em) clamp(0.5em, 0.8vw, 1em);
      font-size: clamp(0.875rem, 1vw, 1.125rem);
      min-height: clamp(2em, 3vw, 3.5em);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .nav button:hover {
      background-color: rgba(255, 140, 0, 0.15);
      box-shadow: 0 0 8px rgba(255, 140, 0, 0.2);
    }
  `;
	this.url = store.url;

	const frame = scramjet.createFrame();

	this.mount = () => {
		// Get custom title and favicon from settings
		const customTitle = localStorage.getItem("custom-title") || "Cheese Proxy";
		const customFavicon = localStorage.getItem("custom-favicon") || "";

		// Set document title
		document.title = customTitle;

		// Remove any existing favicon links
		document
			.querySelectorAll("link[rel='icon']")
			.forEach((link) => link.remove());

		// Set favicon if custom one is provided
		if (customFavicon) {
			const faviconLink = document.createElement("link");
			faviconLink.rel = "icon";
			faviconLink.href = customFavicon + "?t=" + Date.now(); // Cache buster
			document.head.appendChild(faviconLink);
		}

		let body = btoa(
			`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${customTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      color: #e0def4;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      min-width: 100vw;
      overflow: hidden;
    }
    .container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 3em;
      text-align: center;
    }
    h1 {
      font-size: 4em;
      font-weight: 800;
      background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5em;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 1.2em;
      color: #999;
      margin-bottom: 2em;
    }
    .buttons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1em;
      margin-top: 1em;
    }
    .site-btn {
      padding: 1em 2em;
      background-color: #1a1a1a;
      border: 2px solid #ff8c00;
      color: #fff;
      font-size: 1.1em;
      font-weight: 600;
      border-radius: 0.5em;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      text-decoration: none;
      display: inline-block;
    }
    .site-btn:hover {
      background: linear-gradient(135deg, rgba(255, 140, 0, 0.2) 0%, rgba(255, 165, 0, 0.1) 100%);
      box-shadow: 0 0 20px rgba(255, 140, 0, 0.4);
      transform: translateY(-2px);
    }
    .site-btn:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cheese Proxy</h1>
    <p>Type a URL in the omnibox above or choose a popular site</p>
    <div class="buttons-grid">
      <button class="site-btn" onclick="window.parent.postMessage({type:'loadUrl',url:'https://crazygames.com'},'*')">Crazy Games</button>
      <button class="site-btn" onclick="window.parent.postMessage({type:'loadUrl',url:'https://google.com'},'*')">Google</button>
      <button class="site-btn" onclick="window.parent.postMessage({type:'loadUrl',url:'https://github.com'},'*')">GitHub</button>
      <button class="site-btn" onclick="window.parent.postMessage({type:'loadUrl',url:'https://youtube.com'},'*')">YouTube</button>
    </div>
  </div>
</body>
</html>`
		);
		frame.go(`data:text/html;base64,${body}`);
	};

	// Listen for messages from the welcome page
	window.addEventListener("message", (e) => {
		if (e.data && e.data.type === "loadUrl" && e.data.url) {
			let url = e.data.url;

			// Sanitize URL - remove /scramjet/ path prefix if present
			try {
				const decodedUrl = decodeURIComponent(url);
				const pathPrefixMatch = decodedUrl.match(/\/scramjet\/(https?:\/\/)/i);
				if (pathPrefixMatch) {
					url = decodedUrl.substring(decodedUrl.indexOf(pathPrefixMatch[1]));
				}
			} catch (err) {
				// Use original URL if decode fails
			}

			this.url = url;
			showLoading();
			return handleSubmit();
		}
	});

	frame.addEventListener("urlchange", (e) => {
		if (!e.url) return;

		let cleanUrl = e.url;

		// Remove /scramjet/ path prefix if it exists in the URL
		// Handle both encoded and decoded versions
		try {
			const decodedUrl = decodeURIComponent(cleanUrl);
			const pathPrefixMatch = decodedUrl.match(/\/scramjet\/(https?:\/\/)/i);
			if (pathPrefixMatch) {
				cleanUrl = decodedUrl.substring(decodedUrl.indexOf(pathPrefixMatch[1]));
			}
		} catch (e) {
			// If decoding fails, use original
		}

		this.url = cleanUrl;
		if (cleanUrl && cleanUrl.startsWith("http")) addHistory(cleanUrl);
		showLoading();
	});

	const handleSubmit = () => {
		this.url = this.url.trim();

		// Remove any encoded path prefixes like /scramjet/ that may have been added
		// Decode the URL first to check for encoded versions
		let decodedUrl = this.url;
		try {
			decodedUrl = decodeURIComponent(this.url);
		} catch (e) {
			// If decoding fails, use original URL
		}

		// Check if URL contains a path prefix followed by the actual URL (e.g., /scramjet/https://...)
		const pathPrefixMatch = decodedUrl.match(/\/scramjet\/(https?:\/\/)/i);
		if (pathPrefixMatch) {
			// Extract just the actual URL part
			this.url = decodedUrl.substring(decodedUrl.indexOf(pathPrefixMatch[1]));
		}

		// Also remove any double-encoded URLs
		if (this.url.includes("%3A%2F%2F")) {
			try {
				this.url = decodeURIComponent(this.url);
			} catch (e) {
				// Keep original if decode fails
			}
		}

		if (!this.url.startsWith("http")) {
			this.url = "https://" + this.url;
		}

		addHistory(this.url);
		showLoading();

		return frame.go(this.url);
	};

	const cfg = h(Config);
	const hist = h(History);
	document.body.appendChild(cfg);
	document.body.appendChild(hist);

	// Create loading overlay with global styles
	const loadingOverlay = document.createElement("div");
	loadingOverlay.className = "loading-overlay";
	loadingOverlay.innerHTML = '<div class="loader"></div>';
	document.body.appendChild(loadingOverlay);

	// Add global styles for loading overlay if not already added
	if (!document.getElementById("loading-overlay-styles")) {
		const styleEl = document.createElement("style");
		styleEl.id = "loading-overlay-styles";
		styleEl.textContent = `
			.loading-overlay {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(10, 10, 10, 0.95);
				backdrop-filter: blur(3px);
				display: flex;
				justify-content: center;
				align-items: center;
				z-index: 100000;
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.3s ease;
			}

			.loading-overlay.active {
				opacity: 1;
				pointer-events: auto;
			}

			.loader {
				width: 55px;
				aspect-ratio: 1;
				--g1:conic-gradient(from 90deg at top 3px left 3px,#0000 90deg,#ff8c00 0);
				--g2:conic-gradient(from -90deg at bottom 3px right 3px,#0000 90deg,#ff8c00 0);
				background:
					var(--g1),var(--g1),var(--g1),var(--g1), 
					var(--g2),var(--g2),var(--g2),var(--g2);
				background-position: 0 0,100% 0,100% 100%,0 100%;
				background-size: 25px 25px;
				background-repeat: no-repeat;
				animation: l11 1.5s infinite;
			}

			@keyframes l11 {
				0%   {background-size:35px 15px,15px 15px,15px 35px,35px 35px}
				25%  {background-size:35px 35px,15px 35px,15px 15px,35px 15px}
				50%  {background-size:15px 35px,35px 35px,35px 15px,15px 15px}
				75%  {background-size:15px 15px,35px 15px,35px 35px,15px 35px}
				100% {background-size:35px 15px,15px 15px,15px 35px,35px 35px}
			}
		`;
		document.head.appendChild(styleEl);
	}

	let loadingTimeout = null;

	const showLoading = () => {
		// Clear any existing timeout
		if (loadingTimeout) clearTimeout(loadingTimeout);

		loadingOverlay.classList.add("active");

		// Auto-hide after 1.5 seconds
		loadingTimeout = setTimeout(() => {
			loadingOverlay.classList.remove("active");
			loadingTimeout = null;
		}, 1000);
	};

	const hideLoading = () => {
		// Clear timeout if it exists
		if (loadingTimeout) clearTimeout(loadingTimeout);

		loadingOverlay.classList.remove("active");
		loadingTimeout = null;
	};

	// Overlay for modal blur
	let __scramjet_modal_overlay = null;
	function createBlurOverlay() {
		if (__scramjet_modal_overlay) return __scramjet_modal_overlay;
		const o = document.createElement("div");
		o.id = "scramjet-modal-overlay";
		Object.assign(o.style, {
			position: "fixed",
			inset: "0",
			zIndex: 99990,
			backdropFilter: "blur(3px)",
			background: "rgba(0,0,0,0.15)",
		});
		document.body.appendChild(o);
		__scramjet_modal_overlay = o;
		return o;
	}
	function removeBlurOverlay() {
		if (!__scramjet_modal_overlay) return;
		try {
			__scramjet_modal_overlay.remove();
		} catch (_) {}
		__scramjet_modal_overlay = null;
	}
	function showHistoryModal() {
		renderHistoryDialog();
		createBlurOverlay();
		const dialogEl = document.querySelector(".history");
		if (dialogEl) {
			dialogEl.style.zIndex = "99999";
			try {
				dialogEl.showModal();
			} catch (e) {
				console.error("showModal failed:", e);
			}
		}
	}

	// Wire up history dialog controls
	document.addEventListener("history:navigate", (e) => {
		const url = e.detail;
		if (!url) return;
		frame.go(url);
		// close dialog
		const dialogEl = document.querySelector(".history");
		if (dialogEl) {
			try {
				dialogEl.close();
			} catch {}
		}
	});

	// Clear and close handlers when dialog exists
	function bindHistoryControls() {
		const root = document.querySelector(".history");
		if (!root) return;
		const clearBtn = root.querySelector(".clear");
		const closeBtn = root.querySelector(".close");
		if (clearBtn)
			clearBtn.onclick = () => {
				clearHistory();
				renderHistoryDialog();
			};
		if (closeBtn)
			closeBtn.onclick = () => {
				try {
					root.close();
				} catch {}
			};
		// remove overlay when dialog closes
		if (!root.__boundClose) {
			root.addEventListener("close", () => removeBlurOverlay());
			root.__boundClose = true;
		}
	}

	// Ensure controls are bound when dialog is opened
	const obs = new MutationObserver(() => bindHistoryControls());
	obs.observe(document.body, { childList: true, subtree: true });
	this.githubURL = `https://github.com/MercuryWorkshop/scramjet/commit/${$scramjetVersion.build}`;

	return html`
      <div>
      <div class=${[flex, "nav"]}>

        <img src="./devtoolsimgs/Logo.png" style="height: clamp(1.5em, 2.5vw, 3em); margin-right: clamp(0.3em, 0.6vw, 0.8em); cursor: pointer; transition: transform 0.2s ease;" onclick="window.location.href='./'" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Back to Dashboard" />

        <button on:click=${() => {
					showLoading();
					frame.back();
				}}>&lt;-</button>
        <button on:click=${() => {
					showLoading();
					frame.forward();
				}}>-&gt;</button>
        <button on:click=${() => {
					showLoading();
					frame.reload();
				}}>&#x21bb;</button>
        <button on:click=${() => (window.eruditState ? (eruda.hide(), (window.eruditState = false)) : (eruda.show(), (window.eruditState = true)))} style="display: flex; align-items: center; justify-content: center; padding: clamp(0.3em, 0.6vw, 0.8em);"><img src="/devtoolsimgs/dev-tools.svg" alt="console" style="width: clamp(18px, 1.5vw, 28px); height: clamp(18px, 1.5vw, 28px);"></button>
        <input class="bar" autocomplete="off" autocapitalize="off" autocorrect="off" 
        bind:value=${use(this.url)} on:input=${(e) => {
					this.url = e.target.value;
				}} on:keyup=${(e) => e.keyCode == 13 && (store.url = this.url) && handleSubmit()}></input>

		<button on:click=${() => window.open(scramjet.encodeUrl(this.url))} style="display: flex; align-items: center; justify-content: center; padding: clamp(0.3em, 0.6vw, 0.8em);"><img src="/devtoolsimgs/open-link.svg" alt="open link" style="width: clamp(18px, 1.5vw, 28px); height: clamp(18px, 1.5vw, 28px);"></button>
        <button on:click=${() => cfg.showModal()}>config</button>
        <button on:click=${() => {
					showHistoryModal();
				}}>history</button>
      </div>
      ${frame.frame}
    </div>
    `;
}
