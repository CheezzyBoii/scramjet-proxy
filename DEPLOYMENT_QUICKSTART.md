# 🚀 Scramjet Deployment - Quick Start Guide

## ✅ Build Completed Successfully!

Your Scramjet proxy has been built and is ready for deployment. The build artifacts are located in the `dist/` directory.

### Built Files:

- `dist/scramjet.bundle.js` - Main bundle (1.4 MB)
- `dist/scramjet.all.js` - Complete bundle (176 KB)
- `dist/scramjet.wasm.wasm` - WASM rewriter (868 KB)
- `dist/scramjet.sync.js` - Synchronization module
- All necessary map files for debugging

---

## 📚 Deployment Options

### Option 1: Automated Deployment (Recommended)

Use the provided deployment script on your AWS Lightsail instance:

```bash
# Upload the script to your Lightsail instance
scp deploy-to-lightsail.sh ubuntu@YOUR_LIGHTSAIL_IP:~/

# SSH into your instance
ssh ubuntu@YOUR_LIGHTSAIL_IP

# Run the deployment script
chmod +x deploy-to-lightsail.sh
./deploy-to-lightsail.sh
```

The script will automatically:

- Install all dependencies (Node.js, Rust, build tools)
- Clone and build Scramjet
- Set up Nginx as a reverse proxy
- Create and start a systemd service
- Configure firewall rules

### Option 2: Manual Deployment

Follow the comprehensive guide in `AWS_DEPLOYMENT_GUIDE.md` for step-by-step instructions.

---

## 🌐 AWS Lightsail Setup

### 1. Create Lightsail Instance

1. Go to https://lightsail.aws.amazon.com/
2. Create new instance with Ubuntu 22.04 LTS or 24.04 LTS
3. Choose instance plan (minimum $5/month, recommended $10/month)
4. Configure networking: Open ports 80, 443, and 22

### 2. Run Deployment

Upload and execute the `deploy-to-lightsail.sh` script (see Option 1 above)

### 3. Test Your Deployment

```bash
# Get your instance IP
curl ifconfig.me

# Test in browser
http://YOUR_INSTANCE_IP
```

---

## ☁️ CloudFront Integration

### Quick Setup:

1. **Create CloudFront Distribution**
   - Origin: Your Lightsail IP or domain
   - Protocol: HTTP/HTTPS
   - Cache Policy: CachingDisabled (important!)
   - Origin Request Policy: AllViewer

2. **Configure DNS**
   - Create CNAME: proxy.yourdomain.com → d1234.cloudfront.net
   - Wait 5-10 minutes for propagation

3. **Enable SSL**
   - Request ACM certificate in CloudFront
   - Add your custom domain to CloudFront distribution
   - Enable "Redirect HTTP to HTTPS"

### Detailed CloudFront Guide:

See the "Part 3: Connecting to CloudFront" section in `AWS_DEPLOYMENT_GUIDE.md`

---

## 🔒 Security Recommendations

1. **Enable HTTPS**

   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

2. **Configure Firewall**
   - Only allow ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
   - Use AWS Lightsail firewall rules

3. **Keep System Updated**

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Monitor Logs**

   ```bash
   # Scramjet service logs
   sudo journalctl -u scramjet -f

   # Nginx logs
   sudo tail -f /var/log/nginx/access.log
   ```

---

## 📊 Performance Optimization

### For Lightsail:

- Use at least $10/month plan for production
- Enable swap if using smaller instances
- Monitor CPU and memory usage

### For CloudFront:

- Create separate cache behavior for `/dist/*` files
- Enable compression for static assets
- Use CloudWatch for monitoring

---

## 🛠️ Useful Commands

### Service Management:

```bash
# Start service
sudo systemctl start scramjet

# Stop service
sudo systemctl stop scramjet

# Restart service
sudo systemctl restart scramjet

# View status
sudo systemctl status scramjet

# View logs
sudo journalctl -u scramjet -f
```

### Update Scramjet:

```bash
cd /opt/scramjet
git pull
source "$HOME/.cargo/env"
pnpm install
pnpm rewriter:build
pnpm build
sudo systemctl restart scramjet
```

### Nginx:

```bash
# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

---

## 💰 Cost Estimate

### Monthly Costs (USD):

| Service                    | Cost              |
| -------------------------- | ----------------- |
| Lightsail ($5-$20)         | $10 (recommended) |
| CloudFront (100GB traffic) | ~$15-20           |
| Route 53 (optional)        | $0.50             |
| **Total**                  | **~$25-30/month** |

_Costs vary based on traffic and region_

---

## 🆘 Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u scramjet -n 50 --no-pager

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart service
sudo systemctl restart scramjet
```

### CloudFront Shows 502 Errors

- Verify Lightsail instance is running
- Check Nginx is running: `sudo systemctl status nginx`
- Verify Origin settings in CloudFront match your setup
- Check security groups allow traffic from CloudFront

### WebSocket Connections Fail

- Ensure Nginx WebSocket configuration is correct
- Verify CloudFront allows WebSocket upgrades
- Check firewall rules

---

## 📖 Documentation Files

- **`AWS_DEPLOYMENT_GUIDE.md`** - Comprehensive deployment guide with detailed instructions
- **`deploy-to-lightsail.sh`** - Automated deployment script
- **`README.md`** - Project documentation

---

## 🎯 Next Steps

1. ✅ Build completed (You're here!)
2. 📦 Deploy to Lightsail using `deploy-to-lightsail.sh`
3. 🌐 Set up CloudFront distribution
4. 🔒 Configure SSL/TLS certificates
5. 📊 Set up monitoring and alerts
6. 🚀 Go live!

---

## 📞 Support & Resources

- **Scramjet GitHub**: https://github.com/MercuryWorkshop/scramjet
- **Issues**: https://github.com/MercuryWorkshop/scramjet/issues
- **AWS Lightsail Docs**: https://docs.aws.amazon.com/lightsail/
- **CloudFront Docs**: https://docs.aws.amazon.com/cloudfront/

---

## ⚠️ Important Notes

1. **Datacenter IPs**: Some sites (especially YouTube) may not work reliably on datacenter IPs due to bot detection. Consider using residential IPs or VPN routing.

2. **CAPTCHA Support**: For reliable CAPTCHA support, avoid datacenter IPs and heavy traffic on a single IP.

3. **Compliance**: Ensure your use complies with AWS Terms of Service and applicable laws.

4. **Rate Limiting**: Consider implementing rate limiting to prevent abuse.

5. **Backups**: Regularly backup your configuration and data.

---

**Good luck with your deployment! 🎉**

If you need help, refer to `AWS_DEPLOYMENT_GUIDE.md` for detailed instructions or open an issue on GitHub.
