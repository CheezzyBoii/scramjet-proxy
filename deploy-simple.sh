#!/bin/bash

# Scramjet Simple Deployment Script
# This script assumes you have already:
# - Cloned the repository
# - Installed dependencies with `pnpm install`
# - Built the project with `pnpm rewriter:build && pnpm build`

set -e

echo "=========================================="
echo "Scramjet Simple Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root"
    exit 1
fi

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_info "Detected repository path: $SCRIPT_DIR"

# Verify prerequisites
print_info "Verifying prerequisites..."

if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    print_error "package.json not found. Are you in the correct directory?"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    print_error "node_modules not found. Please run 'pnpm install' first."
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/dist" ]; then
    print_error "dist directory not found. Please run 'pnpm build' first."
    exit 1
fi

print_success "Prerequisites verified"

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    print_info "Installing Nginx..."
    sudo apt update
    sudo apt install -y nginx
    print_success "Nginx installed"
else
    print_success "Nginx already installed"
fi

print_info "Step 1: Creating production server configuration..."
cat > "$SCRIPT_DIR/server-production.js" << 'EOF'
// Production server
import { createBareServer } from "@nebula-services/bare-server-node";
import { createServer } from "http";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

// Transports
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";

const bare = createBareServer("/bare/", {
    logErrors: false,
    blockLocal: true,
});

const fastify = Fastify({
    serverFactory: (handler) => {
        return createServer()
            .on("request", (req, res) => {
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

                if (bare.shouldRoute(req)) {
                    bare.routeRequest(req, res);
                } else {
                    handler(req, res);
                }
            })
            .on("upgrade", (req, socket, head) => {
                if (bare.shouldRoute(req)) {
                    bare.routeUpgrade(req, socket, head);
                } else {
                    wisp.routeRequest(req, socket, head);
                }
            });
    },
});

const PORT = process.env.PORT || 3000;

fastify.register(fastifyStatic, {
    root: join(process.cwd(), "static"),
    prefix: "/",
});

fastify.register(fastifyStatic, {
    root: join(process.cwd(), "dist"),
    prefix: "/dist/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: baremuxPath,
    prefix: "/baremux/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: epoxyPath,
    prefix: "/epoxy/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: libcurlPath,
    prefix: "/libcurl/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: bareModulePath,
    prefix: "/baremod/",
    decorateReply: false,
});

fastify.listen(
    {
        port: PORT,
        host: "0.0.0.0",
    },
    (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
    }
);
EOF
print_success "Production server configuration created"

print_info "Step 2: Creating systemd service..."
sudo tee /etc/systemd/system/scramjet.service > /dev/null << EOF
[Unit]
Description=Scramjet Proxy Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR
Environment="PATH=$HOME/.cargo/bin:/usr/bin:/bin:/usr/local/bin"
Environment="NODE_ENV=production"
ExecStart=$(which node) server-production.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable scramjet
print_success "Systemd service created and enabled"

print_info "Step 3: Configuring Nginx..."
sudo tee /etc/nginx/sites-available/scramjet > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffering off;
    proxy_request_buffering off;

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    location / {
        proxy_pass http://localhost:3000;
    }
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffering off;
    proxy_request_buffering off;

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    location / {
        proxy_pass http://localhost:3000;
    }
}
EOF

print_info "Step 3a: Generating SSL certificates for Nginx..."
sudo mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/cert.pem ]; then
    sudo openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
        -keyout /etc/nginx/ssl/key.pem -out /etc/nginx/ssl/cert.pem -days 365
    print_success "SSL certificates generated"
else
    print_success "SSL certificates already exist"
fi

sudo ln -sf /etc/nginx/sites-available/scramjet /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
print_success "Nginx configured and restarted"

print_info "Step 4: Starting Scramjet service..."
sudo systemctl start scramjet
sleep 3
if sudo systemctl is-active --quiet scramjet; then
    print_success "Scramjet service started successfully"
else
    print_error "Scramjet service failed to start. Check logs with: sudo journalctl -u scramjet -n 50"
    exit 1
fi

echo ""
echo "=========================================="
print_success "Deployment Complete!"
echo "=========================================="
echo ""
print_info "Service Status:"
sudo systemctl status scramjet --no-pager -l
echo ""
print_info "Next Steps:"
echo "  1. Get your server's IP address: curl ifconfig.me"
echo "  2. Test in browser:"
echo "     - HTTP:  http://YOUR_IP"
echo "     - HTTPS: https://YOUR_IP (self-signed cert, browser will warn)"
echo "  3. Configure CloudFront (see AWS_DEPLOYMENT_GUIDE.md)"
echo "  4. For production with proper SSL, set up with: sudo certbot --nginx -d your-domain.com"
echo "     (This will replace the self-signed certificate with a Let's Encrypt certificate)"
echo ""
print_info "Useful Commands:"
echo "  - View logs: sudo journalctl -u scramjet -f"
echo "  - Restart service: sudo systemctl restart scramjet"
echo "  - Stop service: sudo systemctl stop scramjet"
echo "  - Update Scramjet: cd $SCRIPT_DIR && git pull && pnpm install && pnpm rewriter:build && pnpm build && sudo systemctl restart scramjet"
echo ""
print_success "Happy proxying! 🚀"
