// Dev server imports
import { createBareServer } from "@nebula-services/bare-server-node";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import rspackConfig from "./rspack.config.js";
import { rspack } from "@rspack/core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

//transports
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
// @ts-ignore - module exists but lacks type declarations
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
// @ts-ignore - module exists but lacks type declarations
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import {
	chmodSync,
	mkdirSync,
	writeFileSync,
	existsSync,
	readFileSync,
} from "fs";
import { execSync } from "node:child_process";

// Function to generate self-signed certificates for development
function ensureSelfSignedCerts() {
	const certDir = join(fileURLToPath(new URL(".", import.meta.url)), "certs");
	const keyPath = join(certDir, "key.pem");
	const certPath = join(certDir, "cert.pem");

	if (existsSync(keyPath) && existsSync(certPath)) {
		console.log("SSL certificates already exist");
		return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
	}

	console.log("Generating self-signed SSL certificates...");
	try {
		if (!existsSync(certDir)) {
			mkdirSync(certDir, { recursive: true });
		}

		// Generate self-signed certificate using openssl
		execSync(
			`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' ` +
				`-keyout "${keyPath}" -out "${certPath}" -days 365`,
			{ stdio: "inherit" }
		);

		console.log("SSL certificates generated successfully");
		return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
	} catch (error) {
		console.error("Failed to generate SSL certificates:", error.message);
		console.log("HTTPS server will not be started");
		return null;
	}
}

const bare = createBareServer("/bare/", {
	logErrors: true,
	blockLocal: false,
});

wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;

// Create request handler function that will be reused for both HTTP and HTTPS
const createRequestHandler = (handler) => {
	return (req, res) => {
		res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
		res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

		if (bare.shouldRoute(req)) {
			bare.routeRequest(req, res);
		} else {
			handler(req, res);
		}
	};
};

// Create upgrade handler function that will be reused for both HTTP and HTTPS
const createUpgradeHandler = () => {
	return (req, socket, head) => {
		if (bare.shouldRoute(req)) {
			bare.routeUpgrade(req, socket, head);
		} else {
			wisp.routeRequest(req, socket, head);
		}
	};
};

// Create HTTP server (port 80)
const httpFastify = Fastify({
	// @ts-ignore - serverFactory type mismatch between http versions
	serverFactory: (handler) => {
		return createServer()
			.on("request", createRequestHandler(handler))
			.on("upgrade", createUpgradeHandler());
	},
});

// Register static file routes for HTTP server
httpFastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./static"),
	decorateReply: false,
});
httpFastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./dist"),
	prefix: "/scram/",
	decorateReply: false,
});
httpFastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./assets"),
	prefix: "/assets/",
	decorateReply: false,
});
httpFastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});
httpFastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});
httpFastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});
httpFastify.register(fastifyStatic, {
	root: bareModulePath,
	prefix: "/baremod/",
	decorateReply: false,
});

httpFastify.setNotFoundHandler((request, reply) => {
	console.error("PAGE PUNCHED THROUGH SW - " + request.url);
	reply.code(593).send("punch through");
});

const HTTP_PORT = 80;
const HTTPS_PORT = 443;

// Start HTTP server
httpFastify.listen({
	port: HTTP_PORT,
	host: "0.0.0.0",
});
console.log(`HTTP server listening on http://localhost:${HTTP_PORT}/`);

// Try to start HTTPS server
const sslCerts = ensureSelfSignedCerts();
if (sslCerts) {
	const httpsFastify = Fastify({
		// @ts-ignore - serverFactory type mismatch between http versions
		serverFactory: (handler) => {
			return createHttpsServer({
				key: sslCerts.key,
				cert: sslCerts.cert,
			})
				.on("request", createRequestHandler(handler))
				.on("upgrade", createUpgradeHandler());
		},
	});

	// Register static file routes for HTTPS server
	httpsFastify.register(fastifyStatic, {
		root: join(fileURLToPath(new URL(".", import.meta.url)), "./static"),
		decorateReply: false,
	});
	httpsFastify.register(fastifyStatic, {
		root: join(fileURLToPath(new URL(".", import.meta.url)), "./dist"),
		prefix: "/scram/",
		decorateReply: false,
	});
	httpsFastify.register(fastifyStatic, {
		root: join(fileURLToPath(new URL(".", import.meta.url)), "./assets"),
		prefix: "/assets/",
		decorateReply: false,
	});
	httpsFastify.register(fastifyStatic, {
		root: baremuxPath,
		prefix: "/baremux/",
		decorateReply: false,
	});
	httpsFastify.register(fastifyStatic, {
		root: epoxyPath,
		prefix: "/epoxy/",
		decorateReply: false,
	});
	httpsFastify.register(fastifyStatic, {
		root: libcurlPath,
		prefix: "/libcurl/",
		decorateReply: false,
	});
	httpsFastify.register(fastifyStatic, {
		root: bareModulePath,
		prefix: "/baremod/",
		decorateReply: false,
	});

	httpsFastify.setNotFoundHandler((request, reply) => {
		console.error("PAGE PUNCHED THROUGH SW - " + request.url);
		reply.code(593).send("punch through");
	});

	httpsFastify.listen({
		port: HTTPS_PORT,
		host: "0.0.0.0",
	});
	console.log(`HTTPS server listening on https://localhost:${HTTPS_PORT}/`);
}
if (!process.env.CI) {
	try {
		writeFileSync(
			".git/hooks/pre-commit",
			"pnpm format\ngit update-index --again"
		);
		chmodSync(".git/hooks/pre-commit", 0o755);
	} catch {}

	const compiler = rspack(rspackConfig);
	compiler.watch({}, (err, stats) => {
		console.log(
			stats
				? stats.toString({
						preset: "minimal",
						colors: true,
						version: false,
					})
				: ""
		);
	});
}
