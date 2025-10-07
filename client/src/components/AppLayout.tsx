import React, { useState } from "react";
import StatusCard from "./StatusCard";
import UploadSection from "./UploadSection";
import { BarcodeScanner } from "./BarcodeScanner";
import CalendarView from "./CalendarView";
import { ReportTable } from "./ReportTable";
import { useReconciliation } from "../hooks/useReconciliation";

const AppLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "scanner" | "reports"
  >("dashboard");
  const {
    selectedDate,
    setSelectedDate,
    currentMonth,
    getCurrentReconciliation,
    uploadRTOFile,
    scanBarcode,
    getCalendarDays,
    changeMonth,
    exportReport,
  } = useReconciliation();

  const currentRec = getCurrentReconciliation();
  const heroImage =
    "https://d64gsuwffb70l.cloudfront.net/68de1fb5c04711685cc964c9_1759387625699_0e71f469.webp";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div
        className="relative bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] text-white py-16 px-6"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[#1e3a5f] bg-opacity-90"></div>
        <div className="relative max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold mb-4">
            RTO Reconciliation Platform
          </h1>
          <p className="text-xl text-blue-100 mb-6">
            Streamline daily returns with instant barcode verification and
            comprehensive tracking
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={
                activeTab === "dashboard"
                  ? "px-6 py-3 rounded-lg font-semibold transition-all bg-white text-blue-900"
                  : "px-6 py-3 rounded-lg font-semibold transition-all bg-blue-700 hover:bg-blue-600"
              }
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("scanner")}
              className={
                activeTab === "scanner"
                  ? "px-6 py-3 rounded-lg font-semibold transition-all bg-white text-blue-900"
                  : "px-6 py-3 rounded-lg font-semibold transition-all bg-blue-700 hover:bg-blue-600"
              }
            >
              Scanner
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={
                activeTab === "reports"
                  ? "px-6 py-3 rounded-lg font-semibold transition-all bg-white text-blue-900"
                  : "px-6 py-3 rounded-lg font-semibold transition-all bg-blue-700 hover:bg-blue-600"
              }
            >
              Reports
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatusCard
                title="Total Uploaded"
                value={currentRec?.totalUploaded || 0}
                subtitle="RTO items today"
                icon="📦"
                color="blue"
              />
              <StatusCard
                title="Scanned Items"
                value={currentRec?.totalScanned || 0}
                subtitle="Barcodes verified"
                icon="🔍"
                color="green"
                trend={currentRec ? `${currentRec.matched} matched` : undefined}
              />
              <StatusCard
                title="Match Rate"
                value={currentRec ? `${currentRec.matchRate}%` : "0%"}
                subtitle="Accuracy score"
                icon="✓"
                color={
                  currentRec && currentRec.matchRate >= 90 ? "green" : "amber"
                }
              />
              <StatusCard
                title="Unmatched"
                value={currentRec?.unmatched || 0}
                subtitle="Requires attention"
                icon="⚠"
                color={currentRec && currentRec.unmatched > 0 ? "red" : "green"}
              />
            </div>

            {/* Upload and Calendar Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <UploadSection
                  onUpload={uploadRTOFile}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                />
              </div>
              <div>
                <CalendarView
                  month={currentMonth}
                  calendarDays={getCalendarDays()}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  onMonthChange={changeMonth}
                />
              </div>
            </div>
          </>
        )}

        {/* Scanner Tab */}
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarcodeScanner
              onScan={scanBarcode}
              scannedBarcodes={currentRec?.scannedBarcodes || []}
            />
            <div>
              <img
                src="https://d64gsuwffb70l.cloudfront.net/68de1fb5c04711685cc964c9_1759387626566_b82d137d.webp"
                alt="Barcode Scanner"
                className="w-full rounded-lg shadow-md mb-6"
              />
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Scanned:</span>
                    <span className="font-bold">
                      {currentRec?.totalScanned || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Matched:</span>
                    <span className="font-bold text-green-600">
                      {currentRec?.matched || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unmatched:</span>
                    <span className="font-bold text-red-600">
                      {currentRec?.unmatched || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <>
            {currentRec ? (
              <ReportTable
                items={currentRec.rtoItems}
                onExport={exportReport}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No Data Available
                </h3>
                <p className="text-gray-600 mb-6">
                  Upload an RTO Excel file to view reports
                </p>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#1e3a5f] text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">RTO Platform</h3>
              <p className="text-blue-200 text-sm">
                Efficient return reconciliation for modern logistics
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Features</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li>
                  <a href="#" className="hover:text-white">
                    Excel Upload
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Barcode Scanner
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Reports
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Analytics
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li>
                  <a href="#" className="hover:text-white">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    API Docs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li>
                  <a href="#" className="hover:text-white">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-800 mt-8 pt-8 text-center text-sm text-blue-200">
            © 2025 RTO Reconciliation Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
