#!/bin/bash

echo "🚀 RTO Application - Complete Production Setup & Start"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start after $((max_attempts * 2)) seconds"
    return 1
}

# Start of the script
print_step "Starting RTO Application Production Setup..."

# Check if we're in the right directory
if [ ! -f "ecosystem.config.js" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check required tools
print_step "Checking required tools..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

if ! command_exists pm2; then
    print_warning "PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        print_error "Failed to install PM2. Please install it manually: npm install -g pm2"
        exit 1
    fi
    print_success "PM2 installed successfully!"
fi

print_success "All required tools are available!"

# Create necessary directories
print_step "Creating necessary directories..."
mkdir -p logs
mkdir -p server/uploads
mkdir -p client/dist

# Set proper permissions
chmod 755 logs
chmod 755 server/uploads
chmod 755 client/dist

print_success "Directories created and permissions set!"

# Install dependencies
print_step "Installing dependencies..."

print_status "Installing root dependencies..."
if [ -f "package.json" ]; then
    npm install --production
    if [ $? -ne 0 ]; then
        print_error "Failed to install root dependencies"
        exit 1
    fi
fi

print_status "Installing backend dependencies..."
if [ -d "server" ] && [ -f "server/package.json" ]; then
    cd server
    npm install --production
    if [ $? -ne 0 ]; then
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    cd ..
fi

print_status "Installing frontend dependencies..."
if [ -d "client" ] && [ -f "client/package.json" ]; then
    cd client
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    cd ..
fi

print_success "All dependencies installed successfully!"

# Build frontend
print_step "Building frontend for production..."

if [ -d "client" ]; then
    cd client
    print_status "Building React application..."
    npm run build
    if [ $? -ne 0 ]; then
        print_error "Frontend build failed"
        exit 1
    fi
    cd ..
    print_success "Frontend built successfully!"
else
    print_warning "Client directory not found, skipping frontend build"
fi

# Stop any existing processes
print_step "Stopping existing processes..."
pm2 stop ecosystem.config.js 2>/dev/null || true
pm2 delete ecosystem.config.js 2>/dev/null || true
print_success "Existing processes stopped!"

# Start the application with PM2
print_step "Starting RTO Application with PM2..."
pm2 start ecosystem.config.js --env production

if [ $? -ne 0 ]; then
    print_error "Failed to start application with PM2"
    exit 1
fi

print_success "Application started with PM2!"

# Wait for services to be ready
print_step "Waiting for services to be ready..."

# Wait for backend
if wait_for_service "http://localhost:5003/api/rto/summary" "Backend API"; then
    print_success "Backend is ready and responding!"
else
    print_warning "Backend may not be fully ready yet"
fi

# Wait for frontend
if wait_for_service "http://localhost:4173" "Frontend"; then
    print_success "Frontend is ready and responding!"
else
    print_warning "Frontend may not be fully ready yet"
fi

# Save PM2 configuration
print_step "Saving PM2 configuration..."
pm2 save
print_success "PM2 configuration saved!"

# Setup PM2 startup script
print_step "Setting up PM2 startup script..."
pm2 startup >/dev/null 2>&1 || true
print_success "PM2 startup script configured!"

# Display final status
echo ""
echo "🎉 RTO Application Production Setup Complete!"
echo "=============================================="
echo ""

# Show PM2 status
print_status "Current PM2 Status:"
pm2 status

echo ""
print_success "🚀 Application URLs:"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:4173"
echo -e "  ${GREEN}Backend API:${NC} http://localhost:5003"
echo -e "  ${GREEN}API Summary:${NC} http://localhost:5003/api/rto/summary"
echo -e "  ${GREEN}Combined Process:${NC} Single PM2 process manages both frontend and backend"
echo ""

print_status "📊 Quick Health Check:"
# Test backend API
if curl -s http://localhost:5003/api/rto/summary >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Backend API:${NC} Working"
else
    echo -e "  ${RED}❌ Backend API:${NC} Not responding"
fi

# Test frontend
if curl -s http://localhost:4173 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Frontend:${NC} Working"
else
    echo -e "  ${RED}❌ Frontend:${NC} Not responding"
fi

echo ""
print_status "🔧 Useful Commands:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs            - View logs"
echo "  pm2 logs rto-application - View combined application logs"
echo "  pm2 restart rto-application - Restart the application"
echo "  pm2 stop rto-application - Stop the application"
echo "  pm2 monit           - Monitor application in real-time"
echo ""

print_status "📁 Log Files:"
echo "  Combined logs: ./logs/combined-*.log"
echo "  PM2 logs: pm2 logs"
echo ""

print_success "🎯 Your RTO Application is now running in production mode!"
print_status "Open http://localhost:4173 in your browser to access the application."
