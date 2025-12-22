# Scramjet AWS Lightsail + CloudFront Deployment Guide

This guide will walk you through deploying Scramjet to AWS Lightsail and connecting it to a CloudFront CDN for optimal performance.

## Prerequisites

- AWS Account with billing enabled
- Domain name (optional but recommended for CloudFront)
- AWS CLI installed (optional, for advanced configuration)
- SSH client

## Part 1: Setting Up AWS Lightsail Instance

### Step 1: Create Lightsail Instance

1. Go to [AWS Lightsail Console](https://lightsail.aws.amazon.com/)
2. Click **"Create instance"**
3. Select **Instance location**: Choose a region close to your target audience
4. Select **Platform**: Linux/Unix
5. Select **Blueprint**: Choose **"OS Only"** → **"Ubuntu 22.04 LTS"** or **"Ubuntu 24.04 LTS"**
6. Select **Instance plan**:
   - Minimum recommended: **$5/month** (512 MB RAM, 1 vCPU, 20 GB SSD)
   - Recommended for production: **$10/month** (1 GB RAM, 1 vCPU, 40 GB SSD)
   - For heavy traffic: **$20/month** or higher
7. Name your instance (e.g., `scramjet-proxy`)
8. Click **"Create instance"**

### Step 2: Configure Networking

1. In your Lightsail instance page, go to **"Networking"** tab
2. Under **"IPv4 Firewall"**, add the following rules:
   - Application: **Custom**, Protocol: **TCP**, Port: **80** (HTTP)
   - Application: **Custom**, Protocol: **TCP**, Port: **443** (HTTPS)
   - Application: **SSH**, Protocol: **TCP**, Port: **22** (SSH)
3. Click **"Create"** for each rule

### Step 3: Create Static IP (Optional but Recommended)

1. Go to **"Networking"** tab in Lightsail
2. Click **"Create static IP"**
3. Select your instance
4. Name it (e.g., `scramjet-static-ip`)
5. Click **"Create"**

## Part 2: Setting Up the Server

### Step 1: Connect to Your Instance

1. In Lightsail console, click **"Connect using SSH"** or use your SSH client:
   ```bash
   ssh -i /path/to/your-key.pem ubuntu@YOUR_INSTANCE_IP
   ```

### Step 2: Update System and Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Install Rust (required for building)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Install build tools
sudo apt install -y build-essential git

# Install wasm-bindgen
cargo install wasm-bindgen-cli --version 0.2.100

# Install wasm-snip (specific fork)
cargo install --git https://github.com/r58Playz/wasm-snip

# Install binaryen (for wasm-opt)
sudo apt install -y binaryen

# Install Nginx (web server and reverse proxy)
sudo apt install -y nginx

# Install Certbot for SSL (optional, for HTTPS)
sudo apt install -y certbot python3-certbot-nginx
```

### Step 3: Clone and Build Scramjet

```bash
# Clone the repository
cd /opt
sudo git clone --recursive https://github.com/MercuryWorkshop/scramjet.git
sudo chown -R $USER:$USER scramjet
cd scramjet

# Install dependencies
pnpm install

# Build the rewriter (WASM)
source "$HOME/.cargo/env"
pnpm rewriter:build

# Build Scramjet
pnpm build

# Verify build
ls -lh dist/
```

### Step 4: Create Production Server Configuration

Create a production server file:

```bash
sudo nano /opt/scramjet/server-production.js
```

Add the following content:

```javascript
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

// Serve static files
fastify.register(fastifyStatic, {
	root: join(process.cwd(), "static"),
	prefix: "/",
});

// Serve dist files
fastify.register(fastifyStatic, {
	root: join(process.cwd(), "dist"),
	prefix: "/dist/",
	decorateReply: false,
});

// Serve transport files
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
		console.log(`Server running on http://0.0.0.0:${PORT}`);
	}
);
```

### Step 5: Create Systemd Service

Create a systemd service to run Scramjet automatically:

```bash
sudo nano /etc/systemd/system/scramjet.service
```

Add:

```ini
[Unit]
Description=Scramjet Proxy Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/scramjet
Environment="PATH=/home/ubuntu/.cargo/bin:/usr/bin:/bin:/usr/local/bin"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server-production.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable scramjet
sudo systemctl start scramjet
sudo systemctl status scramjet
```

### Step 6: Configure Nginx as Reverse Proxy

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/scramjet
```

Add:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Increase buffer sizes for proxy
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Disable buffering for better streaming
    proxy_buffering off;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/scramjet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Set Up SSL with Let's Encrypt (Optional but Recommended)

If you have a domain name:

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts to complete SSL setup.

## Part 3: Connecting to CloudFront

### Step 1: Create CloudFront Distribution

1. Go to [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **"Create Distribution"**
3. Configure the distribution:

   **Origin Settings:**
   - **Origin Domain**: Enter your Lightsail instance IP or domain (e.g., `1.2.3.4` or `scramjet.example.com`)
   - **Protocol**: HTTPS only (if you set up SSL) or HTTP only
   - **HTTP Port**: 80
   - **HTTPS Port**: 443
   - **Origin Protocol Policy**: HTTP Only (or HTTPS Only if using SSL)

   **Default Cache Behavior:**
   - **Viewer Protocol Policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP Methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - **Cache Policy**: CachingDisabled (important for proxy functionality)
   - **Origin Request Policy**: AllViewer

   **Function Associations (Important for WebSocket support):**
   - Click **"Add function association"**
   - **Event type**: Viewer request
   - Create a CloudFront Function (see Step 2)

   **Settings:**
   - **Alternate Domain Names (CNAMEs)**: Your custom domain (e.g., `proxy.yourdomain.com`)
   - **Custom SSL Certificate**: Request or import a certificate for your domain
   - **Supported HTTP Versions**: HTTP/2, HTTP/1.1, HTTP/1.0
   - **Default Root Object**: `index.html`

4. Click **"Create Distribution"**

### Step 2: Create CloudFront Function for WebSocket Support

1. In CloudFront Console, go to **"Functions"**
2. Click **"Create function"**
3. Name it: `scramjet-websocket-support`
4. Add the following code:

```javascript
function handler(event) {
	var request = event.request;
	var headers = request.headers;

	// Pass through WebSocket upgrade requests
	if (
		headers["upgrade"] &&
		headers["upgrade"].value.toLowerCase() === "websocket"
	) {
		return request;
	}

	return request;
}
```

5. Click **"Save"** and then **"Publish"**
6. Go back to your CloudFront distribution and associate this function with Viewer Request

### Step 3: Configure DNS

1. Go to your domain registrar or Route 53
2. Create a CNAME record:
   - **Name**: `proxy` (or your subdomain)
   - **Type**: CNAME
   - **Value**: Your CloudFront distribution domain (e.g., `d1234567890.cloudfront.net`)
   - **TTL**: 300 seconds

### Step 4: Update Nginx Configuration for CloudFront

Update your Nginx config to work with CloudFront:

```bash
sudo nano /etc/nginx/sites-available/scramjet
```

Update to:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Real IP from CloudFront
    set_real_ip_from 0.0.0.0/0;
    real_ip_header X-Forwarded-For;

    # Increase limits
    client_max_body_size 100M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # WebSocket and proxy headers
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;

    # Disable buffering
    proxy_buffering off;
    proxy_request_buffering off;

    # Timeouts for long connections
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

Restart Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Part 4: Testing and Verification

### Test Locally

```bash
curl http://YOUR_LIGHTSAIL_IP
```

### Test CloudFront

Wait 5-10 minutes for CloudFront to deploy, then:

```bash
curl https://proxy.yourdomain.com
```

### Monitor Logs

```bash
# Scramjet logs
sudo journalctl -u scramjet -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Part 5: Performance Optimization

### Enable Gzip Compression

Add to Nginx config:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
```

### CloudFront Caching for Static Assets

In CloudFront, create a new Cache Behavior:

- **Path Pattern**: `/dist/*`
- **Cache Policy**: CachingOptimized
- **Compress Objects**: Yes

### Monitoring

Set up CloudWatch alarms for:

- HTTP 4xx/5xx errors
- Request count
- Origin latency

## Part 6: Updating Scramjet

To update your deployment:

```bash
cd /opt/scramjet
sudo -u ubuntu git pull
source "$HOME/.cargo/env"
pnpm install
pnpm rewriter:build
pnpm build
sudo systemctl restart scramjet
```

## Troubleshooting

### Issue: Service won't start

```bash
sudo journalctl -u scramjet -n 50 --no-pager
```

### Issue: WebSocket connection fails

- Ensure CloudFront allows WebSocket connections
- Check Nginx WebSocket configuration
- Verify firewall rules allow port 443

### Issue: High memory usage

- Upgrade Lightsail instance
- Implement Node.js memory limits in systemd service:
  ```ini
  Environment="NODE_OPTIONS=--max-old-space-size=512"
  ```

### Issue: CloudFront shows errors

- Check origin health in CloudFront console
- Verify Origin Protocol Policy matches your setup
- Check CloudFront error pages configuration

## Security Considerations

1. **Enable SSL/TLS**: Always use HTTPS in production
2. **Firewall**: Only allow necessary ports (80, 443, 22)
3. **Keep Updated**: Regularly update system packages and dependencies
4. **Rate Limiting**: Consider implementing rate limiting in Nginx
5. **DDoS Protection**: CloudFront provides basic DDoS protection

## Cost Estimation

**Monthly Costs (USD):**

- Lightsail Instance ($5-$20): Your chosen plan
- Static IP: Free (first one)
- CloudFront:
  - First 1 TB: $0.085/GB
  - Data transfer out: Variable by region
  - HTTPS requests: $0.0075 per 10,000 requests
- Route 53 (if used): $0.50 per hosted zone + query charges

**Example**: For moderate traffic (100 GB/month, 1M requests):

- Lightsail: $10
- CloudFront: ~$15-20
- **Total**: ~$25-30/month

## Support

For issues with:

- **Scramjet**: [GitHub Issues](https://github.com/MercuryWorkshop/scramjet/issues)
- **AWS Lightsail**: [AWS Support](https://console.aws.amazon.com/support/)
- **This Guide**: Check troubleshooting section above

## Additional Resources

- [Scramjet Documentation](https://github.com/MercuryWorkshop/scramjet)
- [AWS Lightsail Documentation](https://docs.aws.amazon.com/lightsail/)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Note**: This is a community guide. Always refer to official documentation for the most up-to-date information.
