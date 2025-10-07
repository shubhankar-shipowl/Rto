# RTO Application - Complete Production Setup Guide

## 🚀 One-Command Production Setup

The `start-production.sh` script is a complete solution that handles everything needed to run your RTO application in production mode.

### **What the Script Does:**

1. ✅ **Environment Checks** - Verifies Node.js, npm, and PM2 are installed
2. ✅ **Auto-Install PM2** - Installs PM2 globally if not present
3. ✅ **Directory Setup** - Creates all necessary directories with proper permissions
4. ✅ **Dependency Installation** - Installs all dependencies (root, backend, frontend)
5. ✅ **Frontend Build** - Builds React application for production
6. ✅ **Process Management** - Stops existing processes and starts fresh
7. ✅ **Service Health Checks** - Waits for services to be ready
8. ✅ **PM2 Configuration** - Saves PM2 config and sets up startup script
9. ✅ **Status Reporting** - Shows comprehensive status and health checks

## 🎯 **Quick Start**

### **Single Command Setup:**

```bash
./start-production.sh
```

That's it! The script will handle everything automatically.

## 📋 **Prerequisites**

The script will check and install these automatically:

- ✅ **Node.js** (required)
- ✅ **npm** (required)
- ✅ **PM2** (auto-installed if missing)

## 🔧 **What Happens When You Run the Script**

### **Step 1: Environment Validation**

```
[STEP] Checking required tools...
[SUCCESS] All required tools are available!
```

### **Step 2: Directory Setup**

```
[STEP] Creating necessary directories...
[SUCCESS] Directories created and permissions set!
```

### **Step 3: Dependency Installation**

```
[STEP] Installing dependencies...
[INFO] Installing root dependencies...
[INFO] Installing backend dependencies...
[INFO] Installing frontend dependencies...
[SUCCESS] All dependencies installed successfully!
```

### **Step 4: Frontend Build**

```
[STEP] Building frontend for production...
[INFO] Building React application...
[SUCCESS] Frontend built successfully!
```

### **Step 5: Process Management**

```
[STEP] Stopping existing processes...
[SUCCESS] Existing processes stopped!
[STEP] Starting RTO Application with PM2...
[SUCCESS] Application started with PM2!
```

### **Step 6: Health Checks**

```
[STEP] Waiting for services to be ready...
[INFO] Waiting for Backend API to be ready...
[SUCCESS] Backend is ready and responding!
[INFO] Waiting for Frontend to be ready...
[SUCCESS] Frontend is ready and responding!
```

### **Step 7: Final Configuration**

```
[STEP] Saving PM2 configuration...
[SUCCESS] PM2 configuration saved!
[STEP] Setting up PM2 startup script...
[SUCCESS] PM2 startup script configured!
```

## 📊 **Final Output**

After successful completion, you'll see:

```
🎉 RTO Application Production Setup Complete!
==============================================

[INFO] Current PM2 Status:
┌────┬─────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name            │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼─────────────────┼─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┤
│ 0  │ rto-backend     │ default     │ 1.0.0   │ fork    │ 12345    │ 1m     │ 0    │ online    │ 0%       │ 15.3mb   │ user     │ disabled │
│ 1  │ rto-frontend    │ default     │ N/A     │ fork    │ 12346    │ 1m     │ 0    │ online    │ 0%       │ 12.5mb   │ user     │ disabled │
└────┴─────────────────┴─────────────┴─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┘

[SUCCESS] 🚀 Application URLs:
  Frontend: http://localhost:4173
  Backend API: http://localhost:5003
  API Summary: http://localhost:5003/api/rto/summary

[INFO] 📊 Quick Health Check:
  ✅ Backend API: Working
  ✅ Frontend: Working

[INFO] 🔧 Useful Commands:
  pm2 status          - Check application status
  pm2 logs            - View logs
  pm2 logs rto-backend - View backend logs
  pm2 logs rto-frontend - View frontend logs
  pm2 restart all     - Restart all applications
  pm2 stop all        - Stop all applications
  pm2 monit           - Monitor applications in real-time

[INFO] 📁 Log Files:
  Backend logs: ./logs/backend-*.log
  Frontend logs: ./logs/frontend-*.log
  PM2 logs: pm2 logs

[SUCCESS] 🎯 Your RTO Application is now running in production mode!
[INFO] Open http://localhost:4173 in your browser to access the application.
```

## 🛠️ **Manual Commands (If Needed)**

If you prefer to run steps manually:

```bash
# 1. Install dependencies
npm install --production
cd server && npm install --production && cd ..
cd client && npm install && cd ..

# 2. Build frontend
cd client && npm run build && cd ..

# 3. Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **Permission Denied:**

   ```bash
   chmod +x start-production.sh
   ```

2. **Node.js Not Found:**

   ```bash
   # Install Node.js from https://nodejs.org/
   # Or use nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   ```

3. **PM2 Installation Failed:**

   ```bash
   sudo npm install -g pm2
   ```

4. **Port Already in Use:**

   ```bash
   # Check what's using the port
   lsof -i :5003
   lsof -i :4173

   # Kill the process
   kill -9 <PID>
   ```

5. **Database Connection Issues:**
   - Check your `.env` file for correct database credentials
   - Ensure MySQL is running and accessible

### **Debug Commands:**

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs

# Check specific service logs
pm2 logs rto-backend
pm2 logs rto-frontend

# Monitor in real-time
pm2 monit

# Restart services
pm2 restart all

# Stop all services
pm2 stop all
```

## 🌐 **Access Your Application**

Once the script completes successfully:

- **Frontend**: http://localhost:4173
- **Backend API**: http://localhost:5003
- **API Summary**: http://localhost:5003/api/rto/summary

## 📁 **File Structure After Setup**

```
/Users/shubhankarhaldar/Desktop/rto/
├── start-production.sh          # Complete production setup script
├── ecosystem.config.js          # PM2 configuration
├── nginx.conf                   # Nginx configuration (for VPS)
├── nginx-local.conf             # Local Nginx configuration
├── logs/                        # Application logs
│   ├── backend-combined.log
│   ├── backend-out.log
│   ├── backend-error.log
│   ├── frontend-combined.log
│   ├── frontend-out.log
│   └── frontend-error.log
├── server/
│   ├── uploads/                 # File uploads directory
│   └── ...
├── client/
│   ├── dist/                    # Built frontend
│   └── ...
└── ...
```

## 🚀 **For VPS Deployment**

1. **Upload your code to VPS:**

   ```bash
   scp -r . root@your-vps-ip:/var/www/rto/
   ```

2. **SSH into VPS and run:**

   ```bash
   ssh root@your-vps-ip
   cd /var/www/rto
   ./start-production.sh
   ```

3. **Configure Nginx (if needed):**
   ```bash
   cp nginx.conf /etc/nginx/sites-available/rto
   ln -s /etc/nginx/sites-available/rto /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```

## ✅ **Success Indicators**

Your setup is successful when you see:

- ✅ All PM2 processes show "online" status
- ✅ Backend API responds at http://localhost:5003/api/rto/summary
- ✅ Frontend loads at http://localhost:4173
- ✅ No errors in PM2 logs
- ✅ Health check shows "Working" for both services

---

**🎯 The `start-production.sh` script is your one-stop solution for complete RTO application production setup!**
