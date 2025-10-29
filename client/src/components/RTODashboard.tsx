import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RTOUpload } from './RTOUpload';
import { BarcodeScanner } from './BarcodeScanner';
import { ReportTable } from './ReportTable';
import ComplaintManagement from './ComplaintManagement';
import { API_ENDPOINTS } from '../config/api';
import {
  Upload,
  Scan,
  BarChart3,
  FileSpreadsheet,
  CheckCircle,
  CalendarIcon,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/button';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface BarcodeResult {
  barcode: string;
  match: boolean;
  productName?: string;
  quantity?: number;
  price?: number;
  message: string;
  timestamp: Date;
}

export const RTODashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [scanResults, setScanResults] = useState<BarcodeResult[]>([]);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Reports section state
  const [reportsSelectedDate, setReportsSelectedDate] = useState<Date>(() => {
    const today = new Date();
    console.log('🚀 Initializing reports selected date:', today);
    return today;
  });
  const [reportsScanResults, setReportsScanResults] = useState<BarcodeResult[]>(
    [],
  );
  const [reportsLoading, setReportsLoading] = useState(false);
  const [isReportsDatePickerOpen, setIsReportsDatePickerOpen] = useState(false);
  const [reportsTotalAvailable, setReportsTotalAvailable] = useState(0);
  const [reportsUnscannedProducts, setReportsUnscannedProducts] = useState<
    any[]
  >([]);
  const [reportsRTOData, setReportsRTOData] = useState<any[]>([]);
  const [reportsCourierCounts, setReportsCourierCounts] = useState<any[]>([]);
  const [uploadSummary, setUploadSummary] = useState({
    totalRecords: 0,
    scanned: 0,
    matched: 0,
    unmatched: 0,
  });
  const loadingRef = useRef(false);

  // Load existing data for the selected date on component mount and when date changes
  const loadDataForDate = useCallback(async (date: Date) => {
    // Prevent multiple simultaneous calls
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const dateString = date.toISOString().split('T')[0];

      // Load uploaded data for the selected date
      const response = await fetch(API_ENDPOINTS.RTO.DATA(dateString));

      if (response.ok) {
        const data = await response.json();

        if (data && data.uploadInfo) {
          setUploadedData({
            date: data.date,
            totalRecords: data.uploadInfo.totalRecords || 0,
            originalFileName: data.uploadInfo.originalFileName || '',
            uploadDate: data.uploadInfo.uploadDate || new Date().toISOString(),
          });

          // Update upload summary with existing data
          setUploadSummary((prev) => ({
            ...prev,
            totalRecords: data.uploadInfo.totalRecords || 0,
          }));
        } else {
          setUploadedData(null);
          // Reset upload summary when no data
          setUploadSummary((prev) => ({
            ...prev,
            totalRecords: 0,
          }));
        }
      } else {
        setUploadedData(null);
        // Reset upload summary when no data
        setUploadSummary((prev) => ({
          ...prev,
          totalRecords: 0,
        }));
      }

      // Load scan results for the selected date
      const scanResponse = await fetch(API_ENDPOINTS.RTO.SCANS(dateString));

      if (scanResponse.ok) {
        const scanData = await scanResponse.json();

        if (scanData && Array.isArray(scanData)) {
          const mappedScanResults = scanData.map((scan) => ({
            barcode: scan.barcode,
            match: scan.match,
            productName: scan.productName,
            quantity: scan.quantity,
            price: scan.price,
            message: scan.message,
            timestamp: new Date(scan.timestamp),
          }));

          setScanResults(mappedScanResults);

          // Update upload summary with scan results
          const scannedCount = mappedScanResults.length;
          const matchedCount = mappedScanResults.filter(
            (scan) => scan.match,
          ).length;
          const unmatchedCount = scannedCount - matchedCount;

          setUploadSummary((prev) => ({
            ...prev,
            scanned: scannedCount,
            matched: matchedCount,
            unmatched: unmatchedCount,
          }));
        } else {
          setScanResults([]);
          // Reset scan counts when no scan data
          setUploadSummary((prev) => ({
            ...prev,
            scanned: 0,
            matched: 0,
            unmatched: 0,
          }));
        }
      } else {
        setScanResults([]);
        // Reset scan counts when no scan data
        setUploadSummary((prev) => ({
          ...prev,
          scanned: 0,
          matched: 0,
          unmatched: 0,
        }));
      }
    } catch (error) {
      console.error('Error loading data for date:', error);
      setUploadedData(null);
      setScanResults([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Load data when component mounts and when selected date changes
  useEffect(() => {
    loadDataForDate(selectedDate);
  }, [selectedDate, loadDataForDate]);

  // Load overall upload summary on app startup
  const loadOverallUploadSummary = useCallback(
    async (retryCount = 0, forceRefresh = false) => {
      try {
        console.log(
          `📊 Loading overall upload summary (attempt ${
            retryCount + 1
          }, force: ${forceRefresh})`,
        );
        // Always use force=true to bypass cache, especially on VPS/production
        const url = `${API_ENDPOINTS.RTO.SUMMARY}?force=true`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-cache',
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📊 Raw summary data received:', data);

          const summary = {
            totalRecords: data.totalRecords || 0,
            scanned: data.scanned || 0,
            matched: data.matched || 0,
            unmatched: data.unmatched || 0,
          };

          // Always update with fresh data from server
          setUploadSummary(summary);

          // Save to localStorage for persistence
          localStorage.setItem('rto-upload-summary', JSON.stringify(summary));
          console.log('✅ Loaded overall upload summary:', summary);

          // Retry if we got zeros AND there should be data (totalRecords > 0)
          // This helps with timing issues where data hasn't propagated yet
          if (
            retryCount < 2 &&
            summary.scanned === 0 &&
            summary.matched === 0 &&
            summary.unmatched === 0 &&
            summary.totalRecords > 0
          ) {
            console.log(
              `⚠️ Got zeros on attempt ${
                retryCount + 1
              } but totalRecords > 0, retrying...`,
            );
            setTimeout(
              () => loadOverallUploadSummary(retryCount + 1, true),
              1500,
            );
            return; // Exit early to prevent duplicate updates
          }
        } else {
          console.error(
            '❌ Failed to fetch summary:',
            response.status,
            response.statusText,
          );
          if (retryCount < 2) {
            console.log(
              `🔄 Retrying summary fetch (attempt ${retryCount + 1})...`,
            );
            setTimeout(
              () => loadOverallUploadSummary(retryCount + 1, true),
              1500,
            );
          } else {
            // If retry also failed, try to load from localStorage as fallback
            const saved = localStorage.getItem('rto-upload-summary');
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                console.log(
                  '📊 Loading summary from localStorage fallback:',
                  parsed,
                );
                setUploadSummary(parsed);
              } catch (error) {
                console.warn('⚠️ Failed to parse localStorage summary:', error);
              }
            } else {
              console.warn(
                '⚠️ Summary fetch failed after retries, no fallback data available',
              );
            }
          }
        }
      } catch (error) {
        console.error('❌ Error loading overall upload summary:', error);
        if (retryCount < 2) {
          console.log(
            `🔄 Retrying summary fetch after error (attempt ${
              retryCount + 1
            })...`,
          );
          setTimeout(
            () => loadOverallUploadSummary(retryCount + 1, true),
            1500,
          );
        } else {
          // If retry also failed, try to load from localStorage as fallback
          const saved = localStorage.getItem('rto-upload-summary');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              console.log(
                '📊 Loading summary from localStorage fallback:',
                parsed,
              );
              setUploadSummary(parsed);
            } catch (parseError) {
              console.warn(
                '⚠️ Failed to parse localStorage summary:',
                parseError,
              );
            }
          } else {
            console.warn(
              '⚠️ Summary fetch failed after retries, no fallback data available',
            );
          }
        }
      }
    },
    [],
  );

  // Load RTO data for reports section to get total available count and unscanned products
  const loadReportsRTOData = useCallback(async (date: Date) => {
    console.log('🔄 loadReportsRTOData called with date:', date);

    if (!date || isNaN(date.getTime())) {
      console.error('❌ Invalid date provided to loadReportsRTOData:', date);
      setReportsTotalAvailable(0);
      setReportsUnscannedProducts([]);
      return;
    }

    try {
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log('📅 Loading RTO data for reports date:', dateString);

      const response = await fetch(API_ENDPOINTS.RTO.DATA(dateString));

      console.log('🌐 RTO data API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reports RTO data loaded:', data);

        // Count unique waybills from the barcodes array
        if (data.barcodes && Array.isArray(data.barcodes)) {
          const uniqueWaybills = new Set();
          data.barcodes.forEach((item: any) => {
            if (item.barcode) {
              uniqueWaybills.add(item.barcode);
            }
          });
          const totalAvailable = uniqueWaybills.size;
          console.log('📊 Total available waybills:', totalAvailable);
          setReportsTotalAvailable(totalAvailable);

          // Store all products for unscanned calculation
          setReportsRTOData(data.barcodes || []);
        } else {
          console.log('⚠️ No barcodes data found');
          setReportsTotalAvailable(0);
          setReportsRTOData([]);
        }
      } else {
        console.log('⚠️ No RTO data found for date:', dateString);
        setReportsTotalAvailable(0);
        setReportsRTOData([]);
      }
    } catch (error) {
      console.error('❌ Error loading reports RTO data:', error);
      setReportsTotalAvailable(0);
      setReportsRTOData([]);
    }
  }, []);

  // Load courier counts for reports section
  const loadReportsCourierCounts = useCallback(async (date: Date) => {
    console.log('🔄 loadReportsCourierCounts called with date:', date);

    if (!date || isNaN(date.getTime())) {
      console.error(
        '❌ Invalid date provided to loadReportsCourierCounts:',
        date,
      );
      setReportsCourierCounts([]);
      return;
    }

    try {
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log('📅 Loading courier counts for reports date:', dateString);

      const response = await fetch(
        API_ENDPOINTS.RTO.COURIER_COUNTS(dateString),
      );

      console.log('🌐 Courier counts API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reports courier counts loaded:', data);
        setReportsCourierCounts(data.courierCounts || []);
      } else {
        console.log('⚠️ No courier counts found for date:', dateString);
        setReportsCourierCounts([]);
      }
    } catch (error) {
      console.error('❌ Error loading reports courier counts:', error);
      setReportsCourierCounts([]);
    }
  }, []);

  // Load scan results for reports section
  const loadReportsScanResults = useCallback(async (date: Date) => {
    console.log('🔄 loadReportsScanResults called with date:', date);

    if (!date || isNaN(date.getTime())) {
      console.error(
        '❌ Invalid date provided to loadReportsScanResults:',
        date,
      );
      setReportsScanResults([]);
      return;
    }

    console.log('✅ Date is valid, starting to load data...');
    setReportsLoading(true);
    const startTime = performance.now();

    try {
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log('📅 Loading scan results for reports date:', dateString);
      console.time(`API_reportsScanResults_${dateString}`);

      const response = await fetch(API_ENDPOINTS.RTO.SCANS(dateString));

      console.log('🌐 API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reports scan results loaded:', data);
        console.log(
          '📊 Data type:',
          typeof data,
          'Is array:',
          Array.isArray(data),
        );

        // Parse timestamps from strings to Date objects
        const processedData = Array.isArray(data)
          ? data.map((item) => ({
              ...item,
              timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
            }))
          : [];

        console.log('🔄 Processed data with Date objects:', processedData);
        setReportsScanResults(processedData);
      } else {
        console.log('⚠️ No scan results found for date:', dateString);
        setReportsScanResults([]);
      }
    } catch (error) {
      console.error('❌ Error loading reports scan results:', error);
      setReportsScanResults([]);
    } finally {
      console.log('🏁 Loading completed, setting loading to false');
      setReportsLoading(false);
      const endTime = performance.now();
      console.timeEnd(`API_reportsScanResults_${dateString}`);
      console.log(
        `⏱️ Scan results load time: ${(endTime - startTime).toFixed(2)}ms`,
      );
    }
  }, []);

  // Load overall upload summary on app startup - always force refresh
  useEffect(() => {
    // Always force refresh on mount to get fresh data from server
    loadOverallUploadSummary(0, true);
  }, [loadOverallUploadSummary]);

  // Refresh summary when page becomes visible (handles refresh scenarios)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Always refresh when page becomes visible to ensure fresh data
        console.log('🔄 Page became visible, refreshing summary...');
        loadOverallUploadSummary(0, true);
      }
    };

    const handleFocus = () => {
      // Always refresh on focus to ensure fresh data, especially after tab refresh
      console.log('🔄 Window focused, refreshing summary...');
      loadOverallUploadSummary(0, true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadOverallUploadSummary]);

  // Load reports data when reports date changes
  useEffect(() => {
    console.log(
      '🔄 Reports useEffect triggered with date:',
      reportsSelectedDate,
    );
    if (reportsSelectedDate && !isNaN(reportsSelectedDate.getTime())) {
      console.log(
        '✅ Date is valid, calling loadReportsScanResults, loadReportsRTOData, and loadReportsCourierCounts',
      );
      loadReportsScanResults(reportsSelectedDate);
      loadReportsRTOData(reportsSelectedDate);
      loadReportsCourierCounts(reportsSelectedDate);
    } else {
      console.log('❌ Invalid date in useEffect, skipping load');
    }
  }, [
    reportsSelectedDate,
    loadReportsScanResults,
    loadReportsRTOData,
    loadReportsCourierCounts,
  ]);

  // Calculate unscanned products by comparing RTO data with scanned results
  const calculateUnscannedProducts = useCallback(() => {
    if (reportsRTOData.length === 0) {
      console.log('📊 No RTO data to calculate unscanned products');
      setReportsUnscannedProducts([]);
      return;
    }

    // Get scanned barcodes
    const scannedBarcodes = new Set(
      reportsScanResults.map((result) => result.barcode),
    );

    // Find products that haven't been scanned
    const unscanned = reportsRTOData.filter(
      (product) => product.barcode && !scannedBarcodes.has(product.barcode),
    );

    console.log('📊 Calculated unscanned products:', unscanned.length);
    setReportsUnscannedProducts(unscanned);
  }, [reportsRTOData, reportsScanResults]);

  // Calculate unscanned products when data changes
  useEffect(() => {
    calculateUnscannedProducts();
  }, [calculateUnscannedProducts]);

  // Delete unmatched scan result
  const handleDeleteUnmatched = useCallback(
    async (barcode: string) => {
      if (!reportsSelectedDate) {
        console.error('No date selected for deletion');
        return;
      }

      try {
        const year = reportsSelectedDate.getFullYear();
        const month = String(reportsSelectedDate.getMonth() + 1).padStart(
          2,
          '0',
        );
        const day = String(reportsSelectedDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        console.log('🗑️ Deleting unmatched scan:', {
          barcode,
          date: dateString,
        });

        const response = await fetch(API_ENDPOINTS.RTO.DELETE_UNMATCHED_SCAN, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barcode: barcode,
            date: dateString,
          }),
        });

        if (response.ok) {
          console.log('✅ Unmatched scan deleted successfully');
          // Refresh the reports data
          try {
            await loadReportsScanResults(reportsSelectedDate);
            console.log('✅ loadReportsScanResults completed');
          } catch (error) {
            console.error('❌ Error in loadReportsScanResults:', error);
          }

          try {
            await loadReportsRTOData(reportsSelectedDate);
            console.log('✅ loadReportsRTOData completed');
          } catch (error) {
            console.error('❌ Error in loadReportsRTOData:', error);
          }

          try {
            await loadReportsCourierCounts(reportsSelectedDate);
            console.log('✅ loadReportsCourierCounts completed');
          } catch (error) {
            console.error('❌ Error in loadReportsCourierCounts:', error);
          }

          // Also refresh overall summary
          try {
            await loadOverallUploadSummary(0, true);
            console.log('✅ loadOverallUploadSummary completed');
          } catch (error) {
            console.error('❌ Error in loadOverallUploadSummary:', error);
          }
        } else {
          const errorData = await response.json();
          console.error('❌ Failed to delete unmatched scan:', errorData);
          alert(
            `Failed to delete unmatched scan: ${
              errorData.message || 'Unknown error'
            }`,
          );
        }
      } catch (error) {
        console.error('❌ Error deleting unmatched scan:', error);
        // Only show alert for actual deletion errors, not refresh errors
        if (error.message && !error.message.includes('loadReports')) {
          alert('Failed to delete unmatched scan. Please try again.');
        }
      }
    },
    [
      reportsSelectedDate,
      loadReportsScanResults,
      loadReportsRTOData,
      loadReportsCourierCounts,
      loadOverallUploadSummary,
    ],
  );

  // Debug upload summary changes
  useEffect(() => {
    console.log('Upload summary updated:', uploadSummary);
  }, [uploadSummary]);

  const handleUploadSuccess = (data: any) => {
    console.log('Upload success data:', data);
    console.log('Total records from data:', data.totalRecords);
    console.log('Summary from data:', data.summary);

    setUploadedData(data);

    // Clear localStorage cache when new data is uploaded
    localStorage.removeItem('rto-upload-summary');

    // Reload the overall summary to get updated counts - always force refresh
    loadOverallUploadSummary(0, true);

    // Refresh reports data if we're currently viewing reports
    if (reportsSelectedDate && !isNaN(reportsSelectedDate.getTime())) {
      setTimeout(() => {
        loadReportsScanResults(reportsSelectedDate);
        loadReportsRTOData(reportsSelectedDate);
        loadReportsCourierCounts(reportsSelectedDate);
      }, 100);
    }
  };

  const handleScanResult = (result: BarcodeResult) => {
    setScanResults((prev) => [result, ...prev]);

    // Reload the overall summary to get updated counts - always force refresh
    loadOverallUploadSummary(0, true);

    // Refresh reports data if we're currently viewing reports
    if (reportsSelectedDate && !isNaN(reportsSelectedDate.getTime())) {
      setTimeout(() => {
        loadReportsScanResults(reportsSelectedDate);
        loadReportsRTOData(reportsSelectedDate);
        loadReportsCourierCounts(reportsSelectedDate);
      }, 100);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-gray-200/50">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
              <div>
                <span className="text-gray-900 font-semibold text-lg">
                  Loading data...
                </span>
                <p className="text-gray-600 text-sm">
                  Please wait while we fetch your data
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-1.5 shadow-sm">
          <TabsTrigger
            value="upload"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200 font-medium py-2.5"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </TabsTrigger>
          <TabsTrigger
            value="scan"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200 font-medium py-2.5"
          >
            <Scan className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200 font-medium py-2.5"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
          <TabsTrigger
            value="complaints"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200 font-medium py-2.5"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Complaints</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl">
                    <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                  </div>
                  Upload Summary
                </CardTitle>
                <button
                  onClick={() => loadOverallUploadSummary(0, true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Refresh summary data"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>
              <CardDescription className="text-gray-600 text-base">
                {uploadedData
                  ? `Successfully uploaded ${
                      uploadedData.totalRecords ||
                      uploadedData.summary?.totalProducts ||
                      0
                    } total records from Excel file`
                  : 'Upload the RTO Excel sheet. The Excel file must include required columns: WayBill Number and RTS Date.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 text-center hover:shadow-md transition-all duration-200">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {uploadSummary.totalRecords}
                  </div>
                  <div className="text-sm font-semibold text-blue-700">
                    Total Records
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 text-center hover:shadow-md transition-all duration-200">
                  <div className="text-3xl font-bold text-gray-700 mb-2">
                    {uploadSummary.scanned}
                  </div>
                  <div className="text-sm font-semibold text-gray-600">
                    Scanned
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 text-center hover:shadow-md transition-all duration-200">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {uploadSummary.matched}
                  </div>
                  <div className="text-sm font-semibold text-green-700">
                    Matched
                  </div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 text-center hover:shadow-md transition-all duration-200">
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {uploadSummary.unmatched}
                  </div>
                  <div className="text-sm font-semibold text-red-700">
                    Unmatched
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <RTOUpload
            selectedDate={selectedDate}
            onUploadSuccess={handleUploadSuccess}
          />
        </TabsContent>

        <TabsContent value="scan" className="space-y-6">
          <BarcodeScanner onScanResult={handleScanResult} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {(() => {
            try {
              console.log('🎯 Rendering reports section...');
              console.log('📊 Reports state:', {
                reportsSelectedDate,
                reportsScanResults: reportsScanResults?.length || 0,
                reportsLoading,
              });

              return (
                <>
                  {/* Date Picker for Reports */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
                    <CardHeader className="pb-6">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="p-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl">
                          <CalendarIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        Select Date for Reports
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-base">
                        Choose a date to view and export reconciliation reports
                      </CardDescription>
                      <div className="flex justify-end mt-4">
                        <Button
                          onClick={() => {
                            if (
                              reportsSelectedDate &&
                              !isNaN(reportsSelectedDate.getTime())
                            ) {
                              loadReportsScanResults(reportsSelectedDate);
                              loadReportsRTOData(reportsSelectedDate);
                              loadReportsCourierCounts(reportsSelectedDate);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh Data
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <Popover
                          open={isReportsDatePickerOpen}
                          onOpenChange={setIsReportsDatePickerOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal h-12 border-2 border-gray-200 hover:border-blue-400 rounded-lg transition-all duration-200',
                                !reportsSelectedDate && 'text-gray-500',
                              )}
                            >
                              <CalendarIcon className="mr-3 h-5 w-5 text-gray-600" />
                              {reportsSelectedDate &&
                              !isNaN(reportsSelectedDate.getTime())
                                ? format(reportsSelectedDate, 'PPP')
                                : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={reportsSelectedDate}
                              onSelect={(date) => {
                                if (date && !isNaN(date.getTime())) {
                                  console.log('Reports date selected:', date);
                                  setReportsSelectedDate(date);
                                  setIsReportsDatePickerOpen(false);
                                } else {
                                  console.error('Invalid date selected:', date);
                                }
                              }}
                              disabled={(date) => {
                                const today = new Date();
                                today.setHours(23, 59, 59, 999);
                                return date > today;
                              }}
                              initialFocus
                              className="rounded-lg"
                            />
                          </PopoverContent>
                        </Popover>
                        <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                          Selected:{' '}
                          <span className="font-semibold">
                            {reportsSelectedDate &&
                            !isNaN(reportsSelectedDate.getTime())
                              ? format(reportsSelectedDate, 'PPP')
                              : 'No date selected'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
                      <CardHeader className="pb-6">
                        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                          <div className="p-3 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl">
                            <BarChart3 className="h-6 w-6 text-purple-600" />
                          </div>
                          Reconciliation Summary
                        </CardTitle>
                        <CardDescription className="text-gray-600 text-base">
                          View all barcodes and WayBill Numbers reconciled for{' '}
                          <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                            {reportsSelectedDate &&
                            !isNaN(reportsSelectedDate.getTime())
                              ? format(reportsSelectedDate, 'PPP')
                              : 'Selected Date'}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        {reportsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                            <span className="ml-3 text-gray-600">
                              Loading reports data...
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl border border-indigo-200 text-center hover:shadow-md transition-all duration-200">
                              <div className="text-3xl font-bold text-indigo-600 mb-2">
                                {reportsTotalAvailable}
                              </div>
                              <div className="text-sm font-semibold text-indigo-700">
                                Total Available
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 text-center hover:shadow-md transition-all duration-200">
                              <div className="text-3xl font-bold text-gray-700 mb-2">
                                {reportsScanResults.length}
                              </div>
                              <div className="text-sm font-semibold text-gray-600">
                                Total Scanned
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 text-center hover:shadow-md transition-all duration-200">
                              <div className="text-3xl font-bold text-green-600 mb-2">
                                {
                                  reportsScanResults.filter((r) => r.match)
                                    .length
                                }
                              </div>
                              <div className="text-sm font-semibold text-green-700">
                                Matched
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 text-center hover:shadow-md transition-all duration-200">
                              <div className="text-3xl font-bold text-red-600 mb-2">
                                {
                                  reportsScanResults.filter((r) => !r.match)
                                    .length
                                }
                              </div>
                              <div className="text-sm font-semibold text-red-700">
                                Unmatched
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200 text-center hover:shadow-md transition-all duration-200">
                              <div className="text-3xl font-bold text-amber-600 mb-2">
                                {reportsUnscannedProducts.length}
                              </div>
                              <div className="text-sm font-semibold text-amber-700">
                                Unscanned
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
                      <CardHeader className="pb-6">
                        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                          <div className="p-3 bg-gradient-to-r from-orange-100 to-amber-100 rounded-xl">
                            <CheckCircle className="h-6 w-6 text-orange-600" />
                          </div>
                          Recent Activity
                        </CardTitle>
                        <CardDescription className="text-gray-600 text-base">
                          Show unmatched barcodes for selected date and waybill
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        {reportsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-600 border-t-transparent"></div>
                            <span className="ml-3 text-gray-600">
                              Loading activity data...
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {reportsScanResults
                              .slice(0, 10)
                              .map((result, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200"
                                >
                                  <div>
                                    <code className="text-sm font-mono bg-gray-200 px-3 py-1 rounded-lg font-semibold">
                                      {result.barcode}
                                    </code>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {result.timestamp instanceof Date
                                        ? result.timestamp.toLocaleTimeString()
                                        : new Date(
                                            result.timestamp,
                                          ).toLocaleTimeString()}
                                    </div>
                                  </div>
                                  <div
                                    className={
                                      result.match
                                        ? 'px-3 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-800 border border-green-200'
                                        : 'px-3 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-800 border border-red-200'
                                    }
                                  >
                                    {result.match ? 'Matched' : 'Unmatched'}
                                  </div>
                                </div>
                              ))}
                            {reportsScanResults.length === 0 && (
                              <div className="text-center text-gray-500 py-8">
                                <div className="p-4 bg-gray-200 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                  <CheckCircle className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-lg font-medium">
                                  No scans found for this date
                                </p>
                                <p className="text-sm">
                                  No barcode scans were recorded for{' '}
                                  {reportsSelectedDate &&
                                  !isNaN(reportsSelectedDate.getTime())
                                    ? format(reportsSelectedDate, 'PPP')
                                    : 'this date'}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <ReportTable
                    data={reportsScanResults}
                    selectedDate={reportsSelectedDate}
                    totalAvailable={reportsTotalAvailable}
                    unscannedProducts={reportsUnscannedProducts}
                    courierCounts={reportsCourierCounts}
                    rtoData={reportsRTOData}
                    onDeleteUnmatched={handleDeleteUnmatched}
                  />
                </>
              );
            } catch (error) {
              console.error('❌ Error rendering reports section:', error);
              return (
                <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl">
                  <div className="text-red-600 text-lg font-semibold mb-2">
                    Error loading reports section
                  </div>
                  <div className="text-gray-600 mb-4">
                    {error instanceof Error
                      ? error.message
                      : 'Unknown error occurred'}
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Refresh Page
                  </button>
                </div>
              );
            }
          })()}
        </TabsContent>

        <TabsContent value="complaints" className="space-y-6">
          <ComplaintManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};
