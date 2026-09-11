import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  variant: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export default function Badge({ variant, children, className, size = 'sm' }: BadgeProps) {
  const variants: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700',
    ASSIGNED: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-orange-100 text-orange-700',
    ON_HOLD: 'bg-red-100 text-red-700',
    CLOSED: 'bg-green-100 text-green-700',
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-slate-100 text-slate-700',
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-green-100 text-green-700',
    RECEIPT: 'bg-blue-100 text-blue-700',
    ISSUE: 'bg-orange-100 text-orange-700',
    TRANSFER: 'bg-purple-100 text-purple-700',
    IN: 'bg-green-100 text-green-700',
    OUT: 'bg-orange-100 text-orange-700',
    ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
    RETURN: 'bg-blue-100 text-blue-700',
    DAILY: 'bg-blue-100 text-blue-700',
    WEEKLY: 'bg-purple-100 text-purple-700',
    MONTHLY: 'bg-green-100 text-green-700',
    QUARTERLY: 'bg-orange-100 text-orange-700',
    YEARLY: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
    admin: 'bg-red-100 text-red-700',
    manager: 'bg-blue-100 text-blue-700',
    technician: 'bg-green-100 text-green-700',
    viewer: 'bg-slate-100 text-slate-700',
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={twMerge(
        clsx('inline-flex items-center rounded-full font-medium', variants[variant] || 'bg-slate-100 text-slate-700', sizes[size], className)
      )}
    >
      {children}
    </span>
  );
}
