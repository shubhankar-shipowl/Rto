import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Scan,
  CheckCircle,
  XCircle,
  AlertCircle,
  Keyboard,
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorPopup } from './ErrorPopup';

interface BarcodeResult {
  barcode: string;
  match: boolean;
  timestamp: Date;
  productName?: string;
  quantity?: number;
  price?: number;
  message: string;
  alreadyScanned?: boolean;
  previousScan?: {
    timestamp: string;
    status: string;
  };
}

interface ScanSummary {
  totalScanned: number;
  matched: number;
  unmatched: number;
  totalAvailable: number;
}

interface BarcodeScannerProps {
  onScanResult: (result: BarcodeResult) => void;
}

// Add a fallback component to prevent blank pages
const BarcodeScannerFallback = () => (
  <div className="space-y-6">
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardContent className="p-8 text-center">
        <div className="text-gray-600 mb-4">
          <Scan className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-semibold">Scanner Loading...</p>
        </div>
        <p className="text-gray-500">
          Please wait while the scanner initializes.
        </p>
      </CardContent>
    </Card>
  </div>
);

// Wrap the main component with error boundary
export const BarcodeScanner: React.FC<BarcodeScannerProps> = (props) => {
  try {
    return <BarcodeScannerMain {...props} />;
  } catch (error) {
    console.error('BarcodeScanner error:', error);
    return <BarcodeScannerFallback />;
  }
};

const BarcodeScannerMain: React.FC<BarcodeScannerProps> = ({
  onScanResult,
}) => {
  console.log('BarcodeScanner component rendering');

  // Always start with current date, completely ignore prop on initial render
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const currentDate = new Date();
    console.log('Scanner initializing with current date:', currentDate);
    return currentDate;
  });
  const [barcode, setBarcode] = useState('');
  const [scanResults, setScanResults] = useState<BarcodeResult[]>([]);
  const [scanSummary, setScanSummary] = useState<ScanSummary>({
    totalScanned: 0,
    matched: 0,
    unmatched: 0,
    totalAvailable: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPopup, setErrorPopup] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info' | 'success';
    previousScan?: {
      timestamp: string;
      status: string;
    };
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });
  const [isManualMode, setIsManualMode] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [lastLoadedDate, setLastLoadedDate] = useState<string | null>(null);
  const [scanDebounceTimer, setScanDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [courierCounts, setCourierCounts] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);

  // Load scan data for selected date
  const loadScanData = useCallback(async (date: Date) => {
    console.log('🚀 loadScanData called with date:', date);
    console.log('🚀 Date object details:', {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      date: date.getDate(),
      day: date.getDay(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    if (loadingRef.current) {
      console.log('⏳ Already loading, skipping...');
      return;
    }

    if (!date) {
      console.log('❌ No date provided, skipping load');
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log('📅 Original date:', date);
      console.log('📅 Formatted date string:', dateString);
      console.log('📅 ISO string:', date.toISOString());
      console.log('📅 Local date string:', date.toLocaleDateString());
      console.log('📅 Last loaded date:', lastLoadedDate);

      // Check if we're loading the same date again
      if (lastLoadedDate === dateString) {
        console.log('⚠️ Same date already loaded, skipping...');
        return;
      }

      setLastLoadedDate(dateString);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000),
      );

      // Fetch both RTO data and scan results with aggressive cache busting
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const [rtoResponse, scanResponse] = (await Promise.race([
        Promise.all([
          fetch(
            `${API_ENDPOINTS.RTO.DATA(
              dateString,
            )}?t=${timestamp}&r=${randomId}&nocache=1`,
            {
              method: 'GET',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Pragma: 'no-cache',
                Expires: '0',
              },
            },
          ),
          fetch(
            `${API_ENDPOINTS.RTO.SCANS(
              dateString,
            )}?t=${timestamp}&r=${randomId}&nocache=1`,
            {
              method: 'GET',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Pragma: 'no-cache',
                Expires: '0',
              },
            },
          ),
        ]),
        timeoutPromise,
      ])) as [Response, Response];

      console.log('🌐 RTO response status:', rtoResponse.status);
      console.log('🌐 Scan response status:', scanResponse.status);
      console.log(
        '🌐 Requested URL:',
        `${API_ENDPOINTS.RTO.DATA(dateString)}?t=${timestamp}`,
      );

      let totalAvailable = 0;
      let scanResults = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      // Get total available items from RTO data
      if (rtoResponse.ok) {
        const rtoData = await rtoResponse.json();
        console.log('🔍 RTO Data received:', rtoData);
        console.log('📊 Total products in response:', rtoData.barcodes?.length);

        if (rtoData.barcodes && Array.isArray(rtoData.barcodes)) {
          // Count unique waybills instead of total products
          const uniqueWaybills = new Set();
          const allBarcodes = [];

          rtoData.barcodes.forEach((item: any, index: number) => {
            allBarcodes.push(item.barcode);
            if (item.barcode) {
              uniqueWaybills.add(item.barcode);
            }
          });

          totalAvailable = uniqueWaybills.size;
          console.log('📋 All barcodes:', allBarcodes);
          console.log('🔢 Unique waybills:', Array.from(uniqueWaybills));
          console.log('✅ Final count:', totalAvailable);
        } else {
          totalAvailable = 0;
        }
        console.log(
          `🎯 RESULT for ${dateString}: ${totalAvailable} unique waybills from ${rtoData.barcodes?.length} products`,
        );
      } else {
        console.log('❌ RTO data not found for date:', dateString);
        totalAvailable = 0;
      }

      // Get scan results
      if (scanResponse.ok) {
        scanResults = await scanResponse.json();
        matchedCount = scanResults.filter((item: any) => item.match).length;
        unmatchedCount = scanResults.length - matchedCount;
        console.log('Scan results for', dateString, ':', scanResults.length);
      } else {
        console.log('No scan results for date:', dateString);
        scanResults = [];
      }

      const summary = {
        totalScanned: scanResults.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        totalAvailable: totalAvailable,
      };

      setScanSummary(summary);
      setScanResults(scanResults);
      setForceUpdate((prev) => prev + 1); // Force re-render
      console.log('Loaded data for', dateString, ':', summary);
    } catch (error) {
      console.error('Error loading scan data:', error);
      setError('Failed to load scan data. Please try again.');
      setScanResults([]);
      setScanSummary({
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
        totalAvailable: 0,
      });
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Load courier counts for selected date
  const loadCourierCounts = useCallback(async (date: Date) => {
    console.log('🔄 loadCourierCounts called with date:', date);

    if (!date || isNaN(date.getTime())) {
      console.error('❌ Invalid date provided to loadCourierCounts:', date);
      setCourierCounts([]);
      return;
    }

    try {
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log('📅 Loading courier counts for scanner date:', dateString);

      const response = await fetch(
        API_ENDPOINTS.RTO.COURIER_COUNTS(dateString),
      );

      console.log('🌐 Courier counts API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Scanner courier counts loaded:', data);
        setCourierCounts(data.courierCounts || []);
      } else {
        console.log('⚠️ No courier counts found for date:', dateString);
        setCourierCounts([]);
      }
    } catch (error) {
      console.error('❌ Error loading scanner courier counts:', error);
      setCourierCounts([]);
    }
  }, []);

  // Load data when selectedDate changes
  useEffect(() => {
    console.log('🔄 useEffect triggered - selectedDate:', selectedDate);
    if (selectedDate) {
      console.log('📅 Selected date changed, loading data for:', selectedDate);
      console.log(
        '📅 Date string will be:',
        selectedDate.toISOString().split('T')[0],
      );

      // Reset state before loading new data
      console.log('🔄 Resetting state before loading new data');
      setScanSummary({
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
        totalAvailable: 0,
      });
      setScanResults([]);
      setError(null);

      loadScanData(selectedDate);
      loadCourierCounts(selectedDate);
    }
  }, [selectedDate, loadScanData, loadCourierCounts]); // Add loadCourierCounts to dependencies

  // Debug: Track scanSummary changes
  useEffect(() => {
    console.log('📊 scanSummary updated:', scanSummary);
  }, [scanSummary]);

  // Scanner is now completely independent - no prop synchronization
  // Users can select dates using the scanner's own date picker

  // Auto-focus on component mount
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    focusInput();
    const timeoutId = setTimeout(focusInput, 100);
    return () => clearTimeout(timeoutId);
  }, [isManualMode]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (scanDebounceTimer) {
        clearTimeout(scanDebounceTimer);
      }
    };
  }, [scanDebounceTimer]);

  // Optimized manual scan with debouncing and caching
  const handleManualScan = useCallback(async () => {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;

    // Check if already scanned locally (optimization)
    const alreadyScanned = scanResults.some(
      (result) => result.barcode === trimmedBarcode,
    );
    if (alreadyScanned) {
      setErrorPopup({
        isOpen: true,
        title: 'Barcode Already Scanned',
        message: `The barcode "${trimmedBarcode}" has already been scanned for this date.`,
        type: 'warning',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use cached date string to avoid recalculation
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log('🔍 Scanning barcode:', trimmedBarcode);
      console.log('🔍 Using date string:', dateString);

      // Add timeout for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(API_ENDPOINTS.RTO.SCAN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode: trimmedBarcode, date: dateString }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      console.log('🔍 Scan response:', data);
      console.log('🔍 Response status:', response.status);

      if (!response.ok) {
        if (data.alreadyScanned) {
          const duplicateResult: BarcodeResult = {
            barcode: barcode.trim(),
            match: false,
            timestamp: new Date(),
            productName: data.previousScan?.productName || 'N/A',
            message: `Already scanned on ${new Date(
              data.previousScan?.timestamp,
            ).toLocaleDateString()}`,
            alreadyScanned: true,
            previousScan: {
              timestamp: data.previousScan?.timestamp || 'N/A',
              status: data.previousScan?.status || 'N/A',
            },
          };
          setScanResults((prev) => [duplicateResult, ...prev]);
          onScanResult(duplicateResult);
          setErrorPopup({
            isOpen: true,
            title: 'Barcode Already Scanned',
            message: `The barcode "${barcode.trim()}" has already been scanned for ${dateString}.`,
            type: 'warning',
            previousScan: {
              timestamp: data.previousScan?.timestamp || 'N/A',
              status: data.previousScan?.status || 'N/A',
            },
          });
        } else {
          throw new Error(data.error || 'Failed to scan barcode');
        }
      } else {
        const newResult: BarcodeResult = {
          barcode: barcode.trim(),
          match: data.match,
          timestamp: new Date(),
          productName: data.productName,
          quantity: data.quantity,
          price: data.price,
          message: data.match ? 'Matched successfully' : 'No match found',
        };
        setScanResults((prev) => [newResult, ...prev]);
        onScanResult(newResult);

        // Update summary counts
        setScanSummary((prev) => ({
          ...prev,
          totalScanned: prev.totalScanned + 1,
          matched: prev.matched + (data.match ? 1 : 0),
          unmatched: prev.unmatched + (data.match ? 0 : 1),
        }));

        // Refresh scan data to get latest results
        setTimeout(() => {
          loadScanData(selectedDate);
          loadCourierCounts(selectedDate);
        }, 100);
      }
    } catch (err) {
      console.error('Scan error:', err);

      if (err.name === 'AbortError') {
        setErrorPopup({
          isOpen: true,
          title: 'Request Timeout',
          message: 'Scan request timed out. Please try again.',
          type: 'error',
        });
      } else {
        setErrorPopup({
          isOpen: true,
          title: 'Scan Error',
          message: `Error scanning barcode: ${
            err instanceof Error ? err.message : String(err)
          }`,
          type: 'error',
        });
      }
    } finally {
      setIsLoading(false);
      setBarcode('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [barcode, selectedDate, scanResults]);

  // Debounced scan function to prevent rapid scanning
  const debouncedScan = useCallback(
    (barcodeValue: string) => {
      if (scanDebounceTimer) {
        clearTimeout(scanDebounceTimer);
      }

      const timer = setTimeout(() => {
        if (barcodeValue.trim()) {
          handleManualScan();
        }
      }, 300); // 300ms debounce

      setScanDebounceTimer(timer);
    },
    [scanDebounceTimer, handleManualScan],
  );

  // Handle key press for manual mode
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcode.trim()) {
      e.preventDefault();
      debouncedScan(barcode);
    }
  };

  const displayDate = selectedDate || new Date();
  const hasData = scanSummary.totalAvailable > 0 || scanResults.length > 0;

  console.log('BarcodeScanner render state:', {
    isLoading,
    error,
    selectedDate: displayDate,
    scanSummary,
    hasData,
    scanResultsLength: scanResults.length,
  });

  // Clear error and input, reload data, and refocus input
  const handleRetry = useCallback(() => {
    setError(null);
    setErrorPopup({ isOpen: false, title: '', message: '', type: 'error' });
    setBarcode('');
    setScanResults([]);
    setScanSummary({
      totalScanned: 0,
      matched: 0,
      unmatched: 0,
      totalAvailable: 0,
    });
    loadScanData(selectedDate);
    // Refocus after UI re-renders
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 0);
  }, [selectedDate, loadScanData]);

  // Handle error popup close
  const handleErrorPopupClose = useCallback(() => {
    setErrorPopup({ isOpen: false, title: '', message: '', type: 'error' });
    setBarcode('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle error popup retry
  const handleErrorPopupRetry = useCallback(() => {
    setErrorPopup({ isOpen: false, title: '', message: '', type: 'error' });
    setBarcode('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Show loading state
  if (isLoading && !error) {
    return (
      <div className="space-y-6">
        <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading scan data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-white border border-red-200 rounded-lg shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="text-red-600 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p className="text-lg font-semibold">Error Loading Data</p>
            </div>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button
              onClick={handleRetry}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
            <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl">
              <Scan className="h-6 w-6 text-green-600" />
            </div>
            Barcode Scanner
          </CardTitle>
          <CardDescription className="text-gray-600 text-base">
            Scan or enter a product barcode. The app checks for a match with
            waybill entries for the selected 'RTS Date'.
            <br />
            <span className="font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg inline-block mt-2">
              Selected Date: {displayDate.toLocaleDateString()}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Date Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700">
              Select Date for Scanning
            </Label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-12 border-2 border-gray-200 hover:border-gray-400 rounded-lg transition-all duration-200',
                    !selectedDate && 'text-gray-500',
                  )}
                >
                  <CalendarIcon className="mr-3 h-5 w-5 text-gray-600" />
                  {displayDate ? format(displayDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-lg shadow-xl border-0">
                <Calendar
                  mode="single"
                  selected={displayDate}
                  onSelect={(date) => {
                    console.log('🗓️ Date selected in picker:', date);
                    if (date) {
                      console.log('🗓️ Setting selected date to:', date);
                      console.log(
                        '🗓️ Date string will be:',
                        date.toISOString().split('T')[0],
                      );
                      setSelectedDate(date);
                      setIsDatePickerOpen(false);
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
            <p className="text-sm text-gray-600">
              Choose the date for which you want to scan barcodes. Only present
              and past dates are allowed.
            </p>
          </div>

          {/* Scan Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 text-center hover:shadow-md transition-all duration-200">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {scanSummary.totalAvailable}
              </div>
              <div className="text-sm font-semibold text-blue-700">
                Total Available
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-all duration-200">
              <div className="text-3xl font-bold text-gray-700 mb-2">
                {scanSummary.totalScanned}
              </div>
              <div className="text-sm font-semibold text-gray-600">
                Total Scanned
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 text-center hover:shadow-md transition-all duration-200">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {scanSummary.matched}
              </div>
              <div className="text-sm font-semibold text-green-700">
                Matched
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-6 text-center hover:shadow-md transition-all duration-200">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {scanSummary.unmatched}
              </div>
              <div className="text-sm font-semibold text-red-700">
                Unmatched
              </div>
            </div>
          </div>

          {/* Courier Distribution Section */}
          {courierCounts.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-purple-200 w-full">
              <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Courier Distribution
              </h3>
              <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                {courierCounts.map((courier, index) => (
                  <div
                    key={index}
                    className="bg-white border border-purple-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 flex-1 min-w-[200px] max-w-[300px] sm:min-w-[180px] sm:max-w-[250px]"
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-purple-700 mb-2 truncate">
                          {courier.courier}
                        </div>
                        <div className="text-3xl font-bold text-purple-600 mb-2">
                          {courier.count}
                        </div>
                      </div>
                      <div className="text-sm text-purple-500 bg-purple-50 px-2 py-1 rounded-lg text-center">
                        {scanSummary.totalAvailable > 0
                          ? Math.round(
                              (courier.count / scanSummary.totalAvailable) *
                                100,
                            )
                          : 0}
                        %
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Data Message */}
          {!hasData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-yellow-800 font-semibold">
                    No Data Available
                  </p>
                  <p className="text-yellow-700 text-sm">
                    No RTO data found for {displayDate.toLocaleDateString()}.
                    Please upload an Excel file for this date or select a
                    different date.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scanner Controls */}
          <div className="flex gap-3">
            <Button
              onClick={() => setIsManualMode(!isManualMode)}
              variant={isManualMode ? 'default' : 'outline'}
              className={
                isManualMode
                  ? 'h-10 px-4 rounded-lg transition-all duration-200 bg-gray-900 text-white'
                  : 'h-10 px-4 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400'
              }
            >
              <Keyboard className="mr-2 h-5 w-5" />
              {isManualMode ? 'Scanner Mode' : 'Manual Input'}
            </Button>
          </div>

          {/* Scanner Instructions */}
          <Alert className="bg-blue-50 border border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Scanner Ready!</strong> Connect your physical barcode
              scanner to this computer. The input field below is automatically
              focused and ready for scanning.
              {isManualMode
                ? ' Switch to Scanner Mode for physical scanner use.'
                : ' Use Manual Input mode to type barcodes manually.'}
            </AlertDescription>
          </Alert>

          {/* Scanner Input */}
          <div className="space-y-2">
            <Label htmlFor="barcode-input" className="text-gray-700">
              {isManualMode ? 'Manual Input' : 'Scanner Input'}
            </Label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                id="barcode-input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  isManualMode
                    ? 'Type barcode manually...'
                    : 'Scan barcode with physical scanner...'
                }
                className="flex-1 text-lg font-mono border border-gray-300 focus:border-gray-500 rounded-lg"
                autoFocus
              />
              <Button
                onClick={handleManualScan}
                disabled={isLoading || barcode.trim() === ''}
                className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Process
              </Button>
            </div>
            {!isManualMode && (
              <p className="text-sm text-gray-600">
                💡 Physical scanners typically send data with Enter key - no
                need to click Process
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResults.length > 0 && (
        <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-gray-600" />
              </div>
              Recent Scans
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {scanResults.map((result, index) => {
                const isDuplicate = result.message?.includes('Already scanned');
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg hover:shadow-md transition-all duration-200 ${
                      isDuplicate
                        ? 'bg-yellow-50 border border-yellow-200'
                        : result.match
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-sm font-mono bg-gray-100 px-3 py-1 rounded-lg font-semibold">
                          {result.barcode}
                        </code>
                        {isDuplicate ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        ) : result.match ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      {result.productName && (
                        <p className="text-sm text-gray-600 font-medium">
                          {result.productName}
                          {result.quantity && ` (Qty: ${result.quantity})`}
                          {result.price && ` - ₹${result.price}`}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          isDuplicate ? 'text-yellow-600' : 'text-gray-500'
                        }`}
                      >
                        {result.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        isDuplicate
                          ? 'secondary'
                          : result.match
                          ? 'default'
                          : 'destructive'
                      }
                      className={
                        isDuplicate
                          ? 'px-3 py-1 rounded-lg font-semibold bg-yellow-100 text-yellow-800 border-yellow-200'
                          : result.match
                          ? 'px-3 py-1 rounded-lg font-semibold bg-green-100 text-green-800 border-green-200'
                          : 'px-3 py-1 rounded-lg font-semibold bg-red-100 text-red-800 border-red-200'
                      }
                    >
                      {isDuplicate
                        ? 'Duplicate'
                        : result.match
                        ? 'Matched'
                        : 'Unmatched'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Popup */}
      <ErrorPopup
        isOpen={errorPopup.isOpen}
        onClose={handleErrorPopupClose}
        onRetry={handleErrorPopupRetry}
        title={errorPopup.title}
        message={errorPopup.message}
        type={errorPopup.type}
        previousScan={errorPopup.previousScan}
        showRetry={true}
      />
    </div>
  );
};
