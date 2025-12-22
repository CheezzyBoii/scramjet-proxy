// CloudFront Function for WebSocket Support
// This function should be associated with the Viewer Request event

function handler(event) {
	var request = event.request;
	var headers = request.headers;

	// Preserve WebSocket upgrade headers
	if (
		headers["upgrade"] &&
		headers["upgrade"].value.toLowerCase() === "websocket"
	) {
		// Ensure Connection header is present
		if (!headers["connection"]) {
			headers["connection"] = { value: "upgrade" };
		}

		// Pass through the request unmodified
		return request;
	}

	// For non-WebSocket requests, proceed normally
	return request;
}
