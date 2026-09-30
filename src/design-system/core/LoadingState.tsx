import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  submessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Calculating ledger balances...',
  submessage,
}) => {
  return (
    <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-xs font-medium text-slate-200">{message}</p>
      {submessage && <p className="text-[11px] text-slate-500 mt-1">{submessage}</p>}
    </div>
  );
};
