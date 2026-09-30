import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authClient } from '../../services/authClient';
import { Modal, Button, Badge } from '../../design-system';
import { Building2, Check, ArrowRight, Shield } from 'lucide-react';
import { TenantDTO } from '../../../shared/types/auth';

interface CompanySwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOnboarding?: () => void;
}

export function CompanySwitcherModal({ isOpen, onClose, onOpenOnboarding }: CompanySwitcherModalProps) {
  const { tenant, switchTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTenants();
    }
  }, [isOpen]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await authClient.getTenants();
      setTenants(res.tenants);
    } catch (e) {
      console.error('Failed to load tenants', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTenant = async (targetId: string) => {
    if (targetId === tenant?.id) return;
    setSwitchingId(targetId);
    try {
      await switchTenant(targetId);
      onClose();
    } catch (e) {
      console.error('Failed to switch company', e);
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Switch Company / Tenant Organization"
      subtitle="Multi-tenant context isolation ensures strict financial data boundary"
    >
      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading organizations...</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {tenants.map((t) => {
              const isCurrent = t.id === tenant?.id;
              const isSwitching = switchingId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => !isCurrent && handleSelectTenant(t.id)}
                  className={`p-3 rounded border transition-all ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-xs'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded ${isCurrent ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-slate-100">{t.name}</h4>
                          {isCurrent && <Badge variant="primary" dot>ACTIVE</Badge>}
                        </div>
                        <p className="text-[11px] text-slate-400">{t.legalName}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-mono">
                          <span>GSTIN: {t.gstin || 'UNREGISTERED'}</span>
                          <span>&bull;</span>
                          <span>State: {t.stateCode}</span>
                          <span>&bull;</span>
                          <span>Currency: {typeof t.currency === 'object' && t.currency ? t.currency.code : t.currency}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={isSwitching}
                          rightIcon={<ArrowRight className="w-3 h-3" />}
                        >
                          {isSwitching ? 'Switching...' : 'Switch'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              onClose();
              if (onOpenOnboarding) onOpenOnboarding();
            }}
            leftIcon={<Building2 className="w-3.5 h-3.5 text-indigo-400" />}
          >
            + Onboard New Company
          </Button>

          <Button variant="ghost" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
