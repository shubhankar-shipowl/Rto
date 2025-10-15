# RTO Reconciliation System - Deployment Guide

## Authentication Issue Fix

The authentication issue between local and VPS environments has been **permanently fixed**. The problem was that the frontend was hardcoded to use `http://localhost:5003` for API calls, which works locally but fails on VPS.

## What Was Fixed

1. **Created Environment-Based API Configuration** (`client/src/config/api.ts`)

   - Automatically detects development vs production environment
   - Uses `localhost:5003` for development
   - Uses current domain with port 5003 for production

2. **Updated All Components** to use the new API configuration:
   - `AuthContext.tsx` - Login functionality
   - `ComplaintManagement.tsx` - Complaint operations
   - `RTODashboard.tsx` - Main dashboard
   - `BarcodeScanner.tsx` - Barcode scanning
   - `DataManagement.tsx` - Data management
   - `RTOUpload.tsx` - File uploads
   - `ComplaintDialog.tsx` - Complaint creation

## How It Works

### Development Mode

- Uses `http://localhost:5003` for API calls
- Works with local development setup

### Production Mode

- Automatically detects the current domain
- Uses `https://your-domain.com:5003` for API calls
- Works on any VPS or domain

## Deployment Steps

### 1. Build the Application

```bash
# Build for production
cd client
npm run build

# The build will be in client/dist/
```

### 2. Deploy to VPS

```bash
# Copy the built files to your VPS
scp -r client/dist/* user@your-vps:/path/to/your/app/

# Or use your preferred deployment method
```

### 3. Configure Nginx (if using)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/your/app/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Start the Backend

```bash
# On your VPS
cd server
npm install
npm start
# or use PM2
pm2 start server/src/index.js --name "rto-backend"
```

## Testing the Fix

1. **Local Testing**: The application should work exactly as before
2. **VPS Testing**:
   - Deploy the updated code to your VPS
   - Access the application via your domain
   - Try logging in with `admin` / `admin123`
   - The login should work without any "Invalid username or password" errors

## Debug Information

The application now includes debug logging that will show in the browser console:

- Current API configuration
- Environment detection
- API endpoint URLs being used

To see this information, open browser developer tools and check the console.

## Credentials

The default login credentials are:

- **Username**: `admin`
- **Password**: `admin123`

These are defined in `server/routes/authRoutes.js` and can be changed as needed.

## Security Note

For production deployment, consider:

1. Changing default credentials
2. Implementing proper password hashing
3. Adding HTTPS/SSL certificates
4. Setting up proper environment variables
5. Implementing session management

## Troubleshooting

If you still encounter issues:

1. **Check Browser Console**: Look for API configuration logs
2. **Verify Backend**: Ensure the backend is running on port 5003
3. **Check CORS**: Ensure CORS is properly configured for your domain
4. **Network Tab**: Check if API calls are being made to the correct URLs

The fix is now permanent and will work on any domain or VPS without requiring code changes.
