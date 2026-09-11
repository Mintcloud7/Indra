import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { FailedJob } from '../../api/types';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FailedJobsPage() {
  const [jobs, setJobs] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<FailedJob[]>('/integrations/failed-jobs')
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <h1 className="text-2xl font-bold text-slate-900">Failed Jobs</h1>
      </div>

      {loading ? (
        <Loading text="Loading failed jobs..." />
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No Failed Jobs</h3>
          <p className="text-sm text-slate-500">All integration jobs are running successfully.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{job.type}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{job.provider || 'zahir'}</span>
                  <span className="text-xs text-slate-500">#{typeof job.id === 'string' ? job.id.slice(0, 8) : job.id}</span>
                </div>
                <span className="text-xs text-slate-500">{formatDate(job.createdAt || job.failedAt)}</span>
              </div>
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 font-mono">{job.lastError || job.error}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
