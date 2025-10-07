import { useState, useEffect } from 'react';
import { DailyReconciliation, ScannedBarcode, CalendarDay } from '../types';
import { generateMockRTOItems, mockReconciliations } from '../data/mockData';

export const useReconciliation = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reconciliations, setReconciliations] = useState<Record<string, DailyReconciliation>>(mockReconciliations);

  const getCurrentReconciliation = (): DailyReconciliation | null => {
    return reconciliations[selectedDate] || null;
  };

  const uploadRTOFile = (file: File, date: string) => {
    const rtoItems = generateMockRTOItems(date, 15);
    
    const newReconciliation: DailyReconciliation = {
      date,
      totalUploaded: rtoItems.length,
      totalScanned: 0,
      matched: 0,
      unmatched: 0,
      matchRate: 0,
      rtoItems,
      scannedBarcodes: []
    };

    setReconciliations(prev => ({ ...prev, [date]: newReconciliation }));
    setSelectedDate(date);
  };

  const scanBarcode = (barcode: string): ScannedBarcode => {
    const current = reconciliations[selectedDate];
    if (!current) {
      return {
        id: `scan-${Date.now()}`,
        barcode,
        scannedAt: new Date().toISOString(),
        matched: false
      };
    }

    const matchedItem = current.rtoItems.find(item => item.barcode === barcode);
    const scanned: ScannedBarcode = {
      id: `scan-${Date.now()}`,
      barcode,
      scannedAt: new Date().toISOString(),
      matched: !!matchedItem,
      rtoItem: matchedItem
    };

    const updated = {
      ...current,
      scannedBarcodes: [...current.scannedBarcodes, scanned],
      totalScanned: current.totalScanned + 1,
      matched: matchedItem ? current.matched + 1 : current.matched,
      unmatched: matchedItem ? current.unmatched : current.unmatched + 1
    };
    updated.matchRate = Math.round((updated.matched / updated.totalScanned) * 100);

    setReconciliations(prev => ({ ...prev, [selectedDate]: updated }));
    return scanned;
  };

  const getCalendarDays = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: CalendarDay[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: '', hasData: false });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = reconciliations[date];
      days.push({
        date,
        hasData: !!rec,
        summary: rec ? { totalScanned: rec.totalScanned, matchRate: rec.matchRate } : undefined
      });
    }

    return days;
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  const exportReport = (format: 'excel' | 'pdf') => {
    const current = getCurrentReconciliation();
    if (!current) return;
    
    alert(`Exporting ${format.toUpperCase()} report for ${selectedDate}\nTotal Items: ${current.totalUploaded}\nScanned: ${current.totalScanned}\nMatch Rate: ${current.matchRate}%`);
  };

  return {
    selectedDate,
    setSelectedDate,
    currentMonth,
    reconciliations,
    getCurrentReconciliation,
    uploadRTOFile,
    scanBarcode,
    getCalendarDays,
    changeMonth,
    exportReport
  };
};
