// Dashboard Component with Left Sidebar
function Dashboard() {
	this.css = `
    width: 100vw;
    height: 100vh;
    display: flex;
    background-color: #0a0a0a;
    color: #e0def4;
    overflow: hidden;

    .sidebar {
      width: 100px;
      height: 100%;
      background: linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%);
      border-right: 2px solid #ff8c00;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
    }

    .icon-btn {
      width: 65px;
      height: 65px;
      background-color: #1a1a1a;
      border: 2px solid rgba(255, 140, 0, 0.4);
      border-radius: 0.8rem;
      color: #fff;
      font-size: 2rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 0;
    }

    .icon-btn img {
      width: 40px;
      height: 40px;
      filter: brightness(0) saturate(100%) invert(100%);
      transition: filter 0.2s ease;
    }

    .icon-btn:hover img {
      filter: brightness(0) saturate(100%) invert(65%) sepia(85%) saturate(1500%) hue-rotate(0deg) brightness(100%);
    }

    .icon-btn.active img {
      filter: brightness(0) saturate(100%) invert(100%);
    }

    .icon-btn:hover {
      background: linear-gradient(135deg, rgba(255, 140, 0, 0.15) 0%, rgba(255, 165, 0, 0.1) 100%);
      border-color: #ff8c00;
      box-shadow: 0 0 16px rgba(255, 140, 0, 0.4);
      transform: scale(1.05);
    }

    .icon-btn.active {
      background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%);
      border-color: #ffa500;
      box-shadow: 0 0 20px rgba(255, 140, 0, 0.6);
    }

    .icon-btn-tooltip {
      position: absolute;
      left: 85px;
      background-color: #1a1a1a;
      border: 1px solid #ff8c00;
      border-radius: 0.4rem;
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 1000;
    }

    .icon-btn:hover .icon-btn-tooltip {
      opacity: 1;
    }

    .main-content {
      flex: 1;
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .content-area {
      flex: 1;
      overflow: hidden;
      padding: 0;
      display: flex;
    }

    .content-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .landing-container {
      max-width: 800px;
      margin: 0 auto;
      text-align: center;
      padding: 3rem 2rem;
    }

    .landing-container h1 {
      font-size: 4rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }

    .landing-container p {
      font-size: 1.3rem;
      color: #999;
      margin-bottom: 2.5rem;
      line-height: 1.6;
    }

    .proxy-btn {
      padding: 1.2rem 3rem;
      background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%);
      border: none;
      border-radius: 0.6rem;
      color: #fff;
      font-size: 1.2rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: inherit;
      box-shadow: 0 4px 20px rgba(255, 140, 0, 0.4);
    }

    .proxy-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(255, 140, 0, 0.6);
    }

    .proxy-btn:active {
      transform: translateY(-1px);
    }

    .settings-container {
      max-width: 600px;
    }

    .settings-container h2 {
      color: #ff8c00;
      margin-bottom: 2rem;
      font-size: 2rem;
    }
  `;

	this.activeView = "landing";

	const switchView = (view) => {
		this.activeView = view;
		const iframe = document.querySelector(".content-iframe");
		if (iframe) {
			if (view === "landing") {
				iframe.src = "/dashboard.html";
			} else if (view === "games") {
				iframe.src = "/g.html";
			} else if (view === "tools") {
				iframe.src = "/tools.html";
			} else if (view === "settings") {
				iframe.src = "/settings.html";
			}
		}
		this.update();
	};

	return html`
		<div>
			<div class="sidebar">
				<!-- Home Icon -->
				<button
					class="icon-btn ${this.activeView === "landing" ? "active" : ""}"
					on:click=${() => switchView("landing")}
				>
					<img src="/devtoolsimgs/d.svg" alt="Home" />
					<span class="icon-btn-tooltip">Home</span>
				</button>

				<!-- Proxy Icon -->
				<button
					onclick="window.open('/playground.html', '_blank')"
					class="icon-btn"
				>
					<img src="/devtoolsimgs/p.svg" alt="Proxy" />
					<span class="icon-btn-tooltip">Proxy</span>
				</button>

				<!-- Games Icon -->
				<button
					class="icon-btn ${this.activeView === "games" ? "active" : ""}"
					on:click=${() => switchView("games")}
				>
					<img src="/devtoolsimgs/g.svg" alt="Games" />
					<span class="icon-btn-tooltip">Games</span>
				</button>

				<!-- Tools Icon -->
				<button
					class="icon-btn ${this.activeView === "tools" ? "active" : ""}"
					on:click=${() => switchView("tools")}
				>
					<img src="/devtoolsimgs/t.svg" alt="Tools" />
					<span class="icon-btn-tooltip">Tools</span>
				</button>

				<!-- Settings Icon -->
				<button
					class="icon-btn ${this.activeView === "settings" ? "active" : ""}"
					on:click=${() => switchView("settings")}
				>
					<img src="/devtoolsimgs/s.svg" alt="Settings" />
					<span class="icon-btn-tooltip">Settings</span>
				</button>
				<!-- Discord Icon -->
				<button
					class="icon-btn"
					onclick="window.open('https://dsc.gg/cheesy-proxy', '_blank')"
				>
					<img src="/devtoolsimgs/dc.svg" alt="Discord" />
					<span class="icon-btn-tooltip">Discord</span>
				</button>
			</div>

			<!-- Main Content Area -->
			<div class="main-content">
				<div class="content-area">
					<iframe class="content-iframe" src="/dashboard.html"></iframe>
				</div>
			</div>
		</div>
	`;
}
