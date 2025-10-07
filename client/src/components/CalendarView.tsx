import React from "react";
import { CalendarDay } from "../types";

interface CalendarViewProps {
  month: Date;
  calendarDays: CalendarDay[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onMonthChange: (direction: "prev" | "next") => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  month,
  calendarDays,
  selectedDate,
  onDateSelect,
  onMonthChange,
}) => {
  const monthName = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Reconciliation Calendar
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onMonthChange("prev")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ←
          </button>
          <span className="font-semibold text-gray-700 min-w-[150px] text-center">
            {monthName}
          </span>
          <button
            onClick={() => onMonthChange("next")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-gray-600 text-sm py-2"
          >
            {day}
          </div>
        ))}

        {calendarDays.map((day, idx) => (
          <button
            key={idx}
            onClick={() => day.hasData && onDateSelect(day.date)}
            disabled={!day.hasData}
            className={
              day.date === selectedDate
                ? "p-3 rounded-lg text-sm transition-all bg-blue-600 text-white font-bold"
                : day.hasData
                ? "p-3 rounded-lg text-sm transition-all bg-green-50 hover:bg-green-100 border border-green-200"
                : "p-3 rounded-lg text-sm transition-all bg-gray-50 text-gray-400 cursor-not-allowed"
            }
          >
            <div className="font-semibold">{new Date(day.date).getDate()}</div>
            {day.summary && (
              <div className="text-xs mt-1">{day.summary.matchRate}%</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarView;
