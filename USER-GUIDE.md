## RTO Reconciliation System — User Guide

This guide explains how to use the RTO Reconciliation System end-to-end: signing in, uploading Excel data, scanning waybills, reading reports, and managing complaints.

### 1) Accessing the App

- Open the web app URL provided by your admin.
- Sign in as an administrator (ask your admin for credentials). The username is shown in the header after login.

### 2) Navigation Overview

The app has four tabs in the top navigation:

- Upload: Upload the Excel file and view the Upload Summary.
- Scan: Scan or enter waybills to reconcile against the uploaded data.
- Reports: View daily reconciliation metrics, recent activity, and export data.
- Complaints: Track and update complaint statuses.

### 3) Upload

Use when you receive a new RTO Excel file.

- Click Upload.
- Click the upload area in the RTO Upload card and select the Excel file.
- Required columns: WayBill Number (or equivalent, like Waybill/AWB/Tracking ID) and RTS Date.
- After upload, the Upload Summary shows:
  - Total Records: Count of unique waybills across uploaded dates.
  - Scanned / Matched / Unmatched: Global totals across all days.
- Tip: If numbers seem stale, click Refresh in the Upload Summary. The app also refreshes data automatically on page focus.

### 4) Scan

Use to reconcile waybills.

- Click Scan.
- Date selection:
  - The scanner starts with today’s date. To scan for a different RTS date, open the date picker and select the correct date.
- Scanning options:
  - Barcode scanner: Focus the barcode input and scan.
  - Manual entry: Toggle manual mode, type the waybill, and press Enter.
- Result statuses:
  - Matched: Waybill exists in uploaded data for the selected date (or is marked as from a different date when applicable).
  - Unmatched: Waybill not found in uploaded data.
- The global counters (Scanned/Matched/Unmatched) update automatically.

### 5) Reports

Use to analyze daily reconciliation and export data.

- Click Reports.
- Choose a date using the date picker at the top.
- Summary cards show:
  - Total Available: Unique waybills available for that date.
  - Total Scanned: Count of scans made for that date.
  - Matched / Unmatched: Split of scanned results.
  - Unscanned: Items in the upload not yet scanned.
- Recent Activity lists the latest scans with their status and timestamps.
- The table lets you:
  - Filter/search.
  - Delete unmatched entries for the selected date (admin action).
  - Export when available.
- Use Refresh Data to force a full refresh for the selected date.

### 6) Complaints

Use to track customer complaints related to shipments.

- Click Complaints.
- View all complaints, update statuses, and mark mail-done/resolved as needed.

### 7) Data Hygiene & Resets

- Uploading a new Excel file for a date replaces that date’s product list but preserves scan history and counters.
- Deleting an unmatched scan in Reports immediately updates daily and global summaries.

### 8) Best Practices

- Always confirm the date before scanning (scanner uses today by default).
- If you switch tabs, the app auto-refreshes summary data when the tab becomes visible.
- If network interruptions occur, use the Refresh buttons in Upload/Reports.

### 9) Troubleshooting

- Counters showing 0 in production:
  - Click Refresh on the Upload tab. The app requests fresh totals from the server and bypasses cache.
- Scan not updating totals:
  - Ensure you’re scanning for the correct RTS date.
  - Check connectivity; totals sync from the server.
- Upload rejected:
  - Ensure your file has a waybill column (e.g., WayBill Number/AWB/Tracking ID) and an RTS Date column.
- Browser support:
  - Use a modern Chromium-based browser.

### 10) Data Privacy & Safety

- Uploaded files are processed server-side; avoid re-uploading the same file unless replacing a date intentionally.
- Do not share administrator credentials.

### 11) FAQ

- Q: Do I need to refresh after every scan?
  - A: No. Counters and reports update automatically; refresh is only needed if you suspect stale data.
- Q: What if I scanned a waybill for the wrong date?
  - A: Delete the unmatched entry from Reports for that date, then select the correct date and rescan.
- Q: Can I upload data for multiple dates in one file?
  - A: Yes. The system groups rows by RTS Date and stores them per day.

If you need help or see unexpected behavior, contact your system administrator and include the time, action you performed, and any visible error message.
