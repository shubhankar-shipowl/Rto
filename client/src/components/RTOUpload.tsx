import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface RTOUploadProps {
  selectedDate?: Date;
  onUploadSuccess: (data: any) => void;
}

export const RTOUpload: React.FC<RTOUploadProps> = ({
  selectedDate,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];

      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setUploadResult(null);
      } else {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        event.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('date', new Date().toISOString().split('T')[0]);

      const response = await fetch(API_ENDPOINTS.RTO.UPLOAD, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        onUploadSuccess(result);
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById(
          'file-upload',
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
          <div className="p-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          </div>
          Upload RTO Excel File
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Upload the RTO Excel sheet. The Excel file must include required
          columns: WayBill Number and RTS Date. All records from the file will
          be processed and grouped by their RTS Date.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* File Upload */}
        <div className="space-y-4">
          <Label
            htmlFor="file-upload"
            className="text-sm font-semibold text-gray-700"
          >
            Choose Excel File
          </Label>
          <div className="relative">
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="h-14 border-2 border-dashed border-gray-300 hover:border-blue-400 focus:border-blue-500 rounded-xl transition-all duration-200 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20"
            />
            <Upload className="absolute right-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400" />
          </div>
          {file && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <span className="text-sm text-green-700 font-semibold">
                  Selected: {file.name}
                </span>
                <p className="text-xs text-green-600">
                  Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {isUploading ? (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span className="text-lg">Uploading...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5" />
              <span className="text-lg">Upload RTO Data</span>
            </div>
          )}
        </Button>

        {/* Upload Result */}
        {uploadResult && (
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-green-800">
                Upload Successful!
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white/60 p-3 rounded-lg">
                <p className="text-xs text-green-600 font-medium">Date</p>
                <p className="text-sm font-semibold text-green-800">
                  {uploadResult.date}
                </p>
              </div>
              <div className="bg-white/60 p-3 rounded-lg">
                <p className="text-xs text-green-600 font-medium">
                  Total Records
                </p>
                <p className="text-sm font-semibold text-green-800">
                  {uploadResult.totalRecords}
                </p>
              </div>
              <div className="bg-white/60 p-3 rounded-lg">
                <p className="text-xs text-green-600 font-medium">File</p>
                <p className="text-sm font-semibold text-green-800 truncate">
                  {file?.name}
                </p>
              </div>
            </div>
            {uploadResult.barcodes && uploadResult.barcodes.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-green-800 mb-3">
                  Sample Data Preview:
                </p>
                <div className="bg-white/60 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <div className="space-y-2">
                    {uploadResult.barcodes
                      .slice(0, 5)
                      .map((item: any, index: number) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                            {item.barcode}
                          </span>
                          <span className="text-slate-600 truncate ml-2">
                            {item.productName}
                          </span>
                        </div>
                      ))}
                    {uploadResult.barcodes.length > 5 && (
                      <p className="text-xs text-slate-500 text-center">
                        ... and {uploadResult.barcodes.length - 5} more items
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
