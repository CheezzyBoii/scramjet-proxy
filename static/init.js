// Initialize the Dashboard on the main page
window.addEventListener("load", async () => {
	const root = document.getElementById("app");

	try {
		root.replaceWith(h(Dashboard));
	} catch (e) {
		root.replaceWith(document.createTextNode("" + e));
		throw e;
	}

	// Console branding
	function b64(buffer) {
		let binary = "";
		const bytes = new Uint8Array(buffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	try {
		const arraybuffer = await (
			await fetch("/assets/scramjet.png")
		).arrayBuffer();
		console.log(
			"%cb",
			`
			background-image: url(data:image/png;base64,${b64(arraybuffer)});
			color: transparent;
			padding-left: 200px;
			padding-bottom: 100px;
			background-size: contain;
			background-position: center center;
			background-repeat: no-repeat;
		`
		);
	} catch (e) {
		console.log("The Cheesy Proxy - Built on top of Scramjet");
	}
});
