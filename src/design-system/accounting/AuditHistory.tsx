import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Badge } from '../core/Badge';

export interface AuditRecord {
  id: string;
  action: 'INSERT' | 'UPDATE' | 'VOID' | 'REVERSE';
  timestamp: string;
  userName: string;
  userRole: string;
  ipAddress: string;
  summary: string;
  oldState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  diff?: Record<string, { from: unknown; to: unknown }>;
}

export interface AuditHistoryProps {
  voucherNumber: string;
  logs: AuditRecord[];
}

export const AuditHistory: React.FC<AuditHistoryProps> = ({ voucherNumber, logs }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded p-4 text-xs font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Statutory Audit Trail (MCA Companies Act 2013)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Immutable, append-only transaction history for Voucher #{voucherNumber}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 border border-emerald-900/50 rounded text-emerald-400 text-[11px] font-mono">
          <Lock className="w-3 h-3" />
          <span>Tamper-Evident Protected</span>
        </div>
      </div>

      <div className="divide-y divide-slate-800/60">
        {logs.map((log) => {
          const isExpanded = expandedLogId === log.id;
          const actionColors: Record<string, 'credit' | 'debit' | 'warning' | 'info'> = {
            INSERT: 'credit',
            UPDATE: 'warning',
            VOID: 'debit',
            REVERSE: 'debit',
          };

          return (
            <div key={log.id} className="py-2.5">
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center justify-between cursor-pointer hover:bg-slate-850/40 p-1.5 rounded transition-colors select-none"
              >
                <div className="flex items-center gap-2.5">
                  <button type="button" className="text-slate-400 p-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Badge variant={actionColors[log.action] || 'info'}>{log.action}</Badge>
                  <span className="font-medium text-slate-200">{log.summary}</span>
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span className="text-slate-300 font-medium">
                    {log.userName} ({log.userRole})
                  </span>
                  <span className="font-mono text-slate-500">{log.ipAddress}</span>
                  <span className="font-mono text-slate-400">{log.timestamp}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 ml-7 p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[11px]">
                  {log.diff ? (
                    <div>
                      <div className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">
                        Field Modifications:
                      </div>
                      <div className="space-y-1">
                        {Object.entries(log.diff).map(([field, delta]) => (
                          <div
                            key={field}
                            className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded border border-slate-800/80"
                          >
                            <span className="text-indigo-300 font-semibold w-32">{field}:</span>
                            <span className="text-rose-400 line-through">
                              {JSON.stringify(delta.from)}
                            </span>
                            <span className="text-slate-500">→</span>
                            <span className="text-emerald-300 font-bold">
                              {JSON.stringify(delta.to)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      Initial transaction record committed into General Ledger with complete
                      balanced double-entry lines.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
