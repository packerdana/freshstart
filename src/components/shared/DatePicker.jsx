import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { getLocalDateString } from '../../utils/time';

export default function DatePicker({ selectedDate, onChange, label = "Select Date", maxDate = new Date() }) {
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    onChange(newDate);
  };

  const formattedDate = selectedDate ? format(new Date(selectedDate), 'MMMM d, yyyy') : 'Today';
  const maxDateString = format(maxDate, 'yyyy-MM-dd');

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        <input
          type="date"
          value={selectedDate || getLocalDateString()}
          onChange={handleDateChange}
          max={maxDateString}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Viewing: {formattedDate}
      </p>
    </div>
  );
}
