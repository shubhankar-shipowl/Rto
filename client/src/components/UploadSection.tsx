import React, { useState } from "react";

interface UploadSectionProps {
  onUpload: (file: File, date: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const UploadSection: React.FC<UploadSectionProps> = ({
  onUpload,
  selectedDate,
  onDateChange,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      onUpload(file, selectedDate);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      onUpload(file, selectedDate);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Upload RTO Excel File
        </h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={
          dragActive
            ? "border-2 border-dashed rounded-lg p-8 text-center transition-colors border-blue-500 bg-blue-50"
            : "border-2 border-dashed rounded-lg p-8 text-center transition-colors border-gray-300 bg-gray-50"
        }
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg font-semibold text-gray-700 mb-2">
            {fileName || "Drop Excel file here or click to browse"}
          </p>
          <p className="text-sm text-gray-500">
            Supports .xlsx, .xls, .csv formats
          </p>
        </label>
      </div>
    </div>
  );
};

export default UploadSection;
