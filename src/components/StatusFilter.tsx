import React from 'react';

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({ value, onChange }) => {
  return (
    <div className="mb-4">
      <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">Lọc theo trạng thái:</label>
      <select
        id="status-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        <option value="all">Tất cả</option>
        <option value="active">Đang hoạt động</option>
        <option value="dropped">Bị loại bỏ</option>
      </select>
    </div>
  );
};
