import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-1">Error</h3>
      <p className="text-sm text-slate-500 mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
