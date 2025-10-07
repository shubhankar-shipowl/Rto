# Nginx Testing Guide for RTO Application

## 🚀 Quick Start Testing

### **1. Local Testing (macOS)**

```bash
# Install Nginx
brew install nginx

# Start Nginx
sudo brew services start nginx

# Test our configuration
./test-nginx.sh
```

### **2. VPS Testing (Production)**

```bash
# SSH into VPS
ssh root@your-vps-ip

# Install Nginx
apt update && apt install nginx -y

# Configure for RTO app
cp nginx.conf /etc/nginx/sites-available/rto
ln -s /etc/nginx/sites-available/rto /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
```

## 🔍 Manual Testing Commands

### **1. Check Nginx Status**

```bash
# Check if Nginx is running
systemctl status nginx

# Check Nginx processes
ps aux | grep nginx

# Check Nginx version
nginx -v
```

### **2. Test Nginx Configuration**

```bash
# Test configuration syntax
nginx -t

# Test with specific config file
nginx -t -c /etc/nginx/nginx.conf
```

### **3. Test HTTP Responses**

```bash
# Test basic Nginx response
curl -I http://localhost:80

# Test with verbose output
curl -v http://localhost:80

# Test specific endpoints
curl http://localhost:80/api/rto/summary
```

### **4. Check Nginx Logs**

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log

# Check specific site logs
tail -f /var/log/nginx/rto_access.log
tail -f /var/log/nginx/rto_error.log
```

## 🛠️ Troubleshooting Common Issues

### **Issue 1: Nginx Not Starting**

```bash
# Check for port conflicts
sudo lsof -i :80
sudo lsof -i :443

# Check configuration
nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### **Issue 2: 502 Bad Gateway**

```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs rto-backend

# Test backend directly
curl http://localhost:5003/api/rto/summary
```

### **Issue 3: 404 Not Found**

```bash
# Check if frontend is running
pm2 status

# Check frontend logs
pm2 logs rto-frontend

# Test frontend directly
curl http://localhost:4173
```

### **Issue 4: Permission Denied**

```bash
# Check file permissions
ls -la /var/www/rto/

# Fix permissions
sudo chown -R www-data:www-data /var/www/rto/
sudo chmod -R 755 /var/www/rto/
```

## 📊 Performance Testing

### **1. Load Testing with Apache Bench**

```bash
# Install Apache Bench
# macOS: brew install httpd
# Ubuntu: apt install apache2-utils

# Test frontend
ab -n 100 -c 10 http://localhost:80/

# Test API
ab -n 100 -c 10 http://localhost:80/api/rto/summary
```

### **2. Monitor Nginx Performance**

```bash
# Real-time monitoring
htop

# Check Nginx status
systemctl status nginx

# Monitor connections
netstat -tulpn | grep :80
```

## 🔧 Configuration Validation

### **1. Validate Our Nginx Config**

```bash
# Test our specific configuration
nginx -t -c /path/to/nginx.conf

# Check for syntax errors
nginx -T
```

### **2. Test All Endpoints**

```bash
# Frontend
curl -I http://localhost:80/

# Backend API
curl -I http://localhost:80/api/rto/summary
curl -I http://localhost:80/api/rto/upload
curl -I http://localhost:80/api/rto/scan

# File uploads
curl -I http://localhost:80/uploads/
```

## 🌐 External Testing

### **1. Test from External IP**

```bash
# Replace with your VPS IP
curl -I http://YOUR_VPS_IP:80/

# Test API from external
curl http://YOUR_VPS_IP:80/api/rto/summary
```

### **2. Test with Different User Agents**

```bash
# Test with different browsers
curl -H "User-Agent: Mozilla/5.0" http://localhost:80/
curl -H "User-Agent: Chrome/91.0" http://localhost:80/
```

## 📈 Monitoring Commands

### **1. Real-time Monitoring**

```bash
# Monitor Nginx access logs
tail -f /var/log/nginx/access.log | grep -E "(GET|POST|PUT|DELETE)"

# Monitor error logs
tail -f /var/log/nginx/error.log

# Monitor system resources
htop
```

### **2. Check Nginx Status Module**

```bash
# Enable status module in nginx.conf
# location /nginx_status {
#     stub_status on;
#     access_log off;
# }

# Test status
curl http://localhost:80/nginx_status
```

## 🚨 Emergency Commands

### **1. Stop/Start/Restart Nginx**

```bash
# Stop Nginx
sudo systemctl stop nginx

# Start Nginx
sudo systemctl start nginx

# Restart Nginx
sudo systemctl restart nginx

# Reload configuration
sudo systemctl reload nginx
```

### **2. Emergency Debugging**

```bash
# Check all running processes
ps aux | grep nginx

# Check open ports
netstat -tulpn | grep nginx

# Check system resources
free -h
df -h
```

## ✅ Success Indicators

Your Nginx is working correctly if:

1. ✅ `nginx -t` returns "syntax is ok"
2. ✅ `systemctl status nginx` shows "active (running)"
3. ✅ `curl -I http://localhost:80` returns "200 OK"
4. ✅ `curl http://localhost:80/api/rto/summary` returns JSON data
5. ✅ No errors in `/var/log/nginx/error.log`
6. ✅ Access logs show successful requests

## 🎯 Next Steps

Once Nginx is working:

1. **Set up SSL certificate** for HTTPS
2. **Configure domain name** pointing to your VPS
3. **Set up monitoring** with tools like UptimeRobot
4. **Configure log rotation** to prevent disk space issues
5. **Set up firewall** rules for security

---

**Note**: Replace `localhost` with your actual VPS IP address when testing from external sources.
