import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={twMerge(clsx('bg-white rounded-xl border border-slate-200 shadow-sm', className))}>
      {children}
    </div>
  );
}

export default Card;

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={twMerge(clsx('px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200', className))}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={twMerge(clsx('px-4 sm:px-6 py-3 sm:py-4', className))}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={twMerge(clsx('text-lg font-semibold text-slate-900', className))}>
      {children}
    </h3>
  );
}
