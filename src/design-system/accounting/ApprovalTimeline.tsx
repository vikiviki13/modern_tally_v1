import React from 'react';
import { CheckCircle2, Clock, XCircle, User } from 'lucide-react';

export interface ApprovalStep {
  id: string;
  role: string;
  approverName?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  timestamp?: string;
  comment?: string;
}

export interface ApprovalTimelineProps {
  steps: ApprovalStep[];
  voucherNumber: string;
  amount: number;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({
  steps,
  voucherNumber,
  amount,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div>
          <h4 className="font-semibold text-slate-100">Multi-Stage Approval Workflow</h4>
          <p className="text-[11px] text-slate-400">
            High-value voucher {voucherNumber} (₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
          </p>
        </div>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800 before:z-0">
        {steps.map((step) => {
          const isApproved = step.status === 'APPROVED';
          const isPending = step.status === 'PENDING';
          const isRejected = step.status === 'REJECTED';

          const icon = isApproved ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 bg-slate-900 z-10" />
          ) : isRejected ? (
            <XCircle className="w-6 h-6 text-rose-400 bg-slate-900 z-10" />
          ) : (
            <Clock className="w-6 h-6 text-amber-400 bg-slate-900 z-10" />
          );

          return (
            <div key={step.id} className="relative z-10 flex items-start gap-3">
              <div className="shrink-0">{icon}</div>
              <div className="flex-1 bg-slate-950/60 p-2.5 rounded border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{step.role}</span>
                  <span
                    className={`font-mono text-[10px] uppercase font-bold tracking-wider ${
                      isApproved
                        ? 'text-emerald-400'
                        : isRejected
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                  <User className="w-3 h-3 text-slate-500" />
                  <span>{step.approverName || 'Pending Assignment'}</span>
                  {step.timestamp && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{step.timestamp}</span>
                    </>
                  )}
                </div>
                {step.comment && (
                  <p className="mt-1 text-[11px] text-slate-300 italic bg-slate-900/80 p-1.5 rounded border border-slate-800">
                    "{step.comment}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
