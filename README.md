# RTO Reconciliation Application

A comprehensive RTO (Regional Transport Office) reconciliation system for managing daily Excel uploads, barcode scanning, and reconciliation reports.

## Features

- **Excel Upload**: Upload daily RTO Excel files with date selection
- **Barcode Scanning**: Scan or manually enter barcodes for reconciliation
- **Calendar Dashboard**: View reconciliation history by date
- **Real-time Matching**: Instant barcode matching against uploaded data
- **Reporting**: Generate reports and export data
- **Data Persistence**: Store all reconciliation data with MongoDB

## Project Structure

```
rto/
├── client/          # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── RTODashboard.tsx    # Main dashboard
│   │   │   ├── RTOUpload.tsx       # Excel upload component
│   │   │   ├── BarcodeScanner.tsx  # Barcode scanning
│   │   │   ├── RTOCalendar.tsx     # Calendar view
│   │   │   └── ReportTable.tsx     # Data reporting
│   │   └── ...
├── server/          # Backend (Node.js + Express + MongoDB)
│   ├── src/
│   │   ├── index.js               # Main server file
│   │   └── database.js            # Database connection
│   ├── models/
│   │   └── RTOData.js             # MongoDB schema
│   ├── controllers/
│   │   └── rtoController.js       # API controllers
│   ├── routes/
│   │   └── rtoRoutes.js           # API routes
│   └── middleware/
│       └── upload.js              # File upload handling
├── package.json     # Root package.json for managing both projects
└── README.md
```

## Prerequisites

- Node.js (v16 or higher)
- npm
- MySQL database access (configured with provided credentials)

## Installation

1. **Clone and install dependencies:**

```bash
npm run install:all
```

2. **Set up MySQL Database:**

   - Database is pre-configured with the following credentials:
   - Host: 31.97.61.5
   - Port: 3306
   - Database: rto_db
   - User: rto
   - Password: Kalbazaar@177

3. **Start the application:**

```bash
npm run dev
```

This will start:

- Frontend on http://localhost:3000 (Vite dev server)
- Backend on http://localhost:5003 (Express server)

## Usage

### 1. Upload RTO Excel File

- Navigate to the Upload tab
- Select the date for the RTO report
- Choose an Excel file (.xlsx or .xls)
- Click "Upload RTO Data"

### 2. Scan Barcodes

- Go to the Scan tab
- Use camera scanning or manual input
- Each barcode is checked against the uploaded data
- View real-time match/unmatch results

### 3. Calendar View

- Check the Calendar tab
- See dates with RTO data (marked with blue dots)
- Click any date to view reconciliation summary

### 4. Reports

- View detailed reconciliation reports
- See matched/unmatched barcodes
- Export data for further analysis

## API Endpoints

### RTO Management

- `POST /api/rto/upload` - Upload Excel file
- `POST /api/rto/scan` - Scan barcode
- `GET /api/rto/report/:date` - Get report for specific date
- `GET /api/rto/calendar` - Get calendar data

### System

- `GET /` - Server status
- `GET /health` - Health check

## Development

### Individual Commands

#### Frontend (Client)

```bash
cd client
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

#### Backend (Server)

```bash
cd server
npm run dev      # Start with nodemon
npm start        # Start production server
npm run setup-db # Check database setup
```

### Environment Variables

Create a `.env` file in the server directory:

```
# Database Configuration
DB_HOST=31.97.61.5
DB_PORT=3306
DB_NAME=rto_db
DB_USER=rto
DB_PASSWORD="Kalbazaar@177"

# Database Connection Pool Settings
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
DB_ACQUIRE_TIMEOUT=60000
DB_CREATE_TIMEOUT=30000
DB_DESTROY_TIMEOUT=5000
DB_REAP_INTERVAL=1000
DB_CREATE_RETRY_INTERVAL=200

# Server Configuration
PORT=5003
NODE_ENV=production
```

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js, MySQL, Sequelize
- **File Processing**: Multer, xlsx
- **Date Handling**: date-fns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
