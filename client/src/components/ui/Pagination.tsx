import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = window.innerWidth < 640 ? 3 : 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= Math.min(maxVisible, totalPages); i++) pages.push(i);
        if (totalPages > maxVisible) pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        const side = Math.floor((maxVisible - 3) / 2);
        for (let i = page - side; i <= page + side; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-2 py-3">
      <span className="text-xs sm:text-sm text-slate-600">
        {page}/{totalPages}
      </span>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hidden sm:block"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getPageNumbers().map((pageNum, index) => (
          typeof pageNum === 'number' ? (
            <button
              key={index}
              onClick={() => onPageChange(pageNum)}
              className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 rounded-lg text-xs sm:text-sm font-medium ${
                page === pageNum
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              {pageNum}
            </button>
          ) : (
            <span key={index} className="px-0.5 sm:px-1 text-slate-400 text-xs">
              {pageNum}
            </span>
          )
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hidden sm:block"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
