import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Drawer, Button, Badge } from '../../design-system';
import {
  User,
  Shield,
  KeyRound,
  LogOut,
  Calendar,
  Building,
  CheckCircle2,
} from 'lucide-react';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileDrawer({ isOpen, onClose }: UserProfileDrawerProps) {
  const { user, tenant, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      onClose();
    } finally {
      setLoggingOut(false);
    }
  };

  const getRoleDescription = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Full ERP Authority: Financial period locking, user provisioning, voucher voiding, audit inspection, and chart of accounts management.';
      case 'AUDITOR':
        return 'Read-Only Statutory Compliance: Unrestricted access to General Ledger, MCA tamper-evident logs, and balance sheets without transactional modification.';
      case 'SR_ACCOUNTANT':
        return 'Senior Financial Posting: Full Day Book creation, Bank Reconciliation (BRS), sales/purchase posting, and ledger reconciliation.';
      case 'SALES':
        return 'Commercial Operations: Quotations, sales tax invoicing, and accounts receivable tracking.';
      case 'WAREHOUSE':
        return 'Inventory & Logistics: Stock journal receipts, delivery notes, and godown transfers.';
      default:
        return 'Standard organization member';
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="User Identity &amp; Security Profile"
      subtitle="Authenticated session and role-based permissions context"
    >
      <div className="space-y-5 text-xs">
        {/* User Card */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-sm">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-100 truncate">{user?.fullName}</h3>
            <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="primary" dot>{user?.role}</Badge>
              <Badge variant="credit">ACTIVE</Badge>
            </div>
          </div>
        </div>

        {/* Tenant Organization Context */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-400" />
            <span>Assigned Organization Tenant</span>
          </h4>
          <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Company:</span>
              <span className="text-slate-200 font-sans font-medium">{tenant?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tenant ID:</span>
              <span className="text-slate-400 truncate max-w-[160px]">{tenant?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GSTIN:</span>
              <span className="text-slate-300">{tenant?.gstin || 'NOT_REGISTERED'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Base Currency:</span>
              <span className="text-slate-300">
                {typeof tenant?.currency === 'object' && tenant.currency ? tenant.currency.code : tenant?.currency || 'INR'} (₹)
              </span>
            </div>
          </div>
        </div>

        {/* Role Permissions Matrix */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Role-Based Access Control (RBAC)</span>
          </h4>
          <p className="text-[11px] text-slate-400 mb-2">
            {getRoleDescription(user?.role)}
          </p>

          <div className="space-y-1 font-mono text-[10px] bg-slate-900/40 p-2 rounded border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>General Ledger Double-Entry Posting: GRANTED</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Tax Invoice &amp; B2B GST Generation: GRANTED</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Bank Reconciliation (BRS) Engine: GRANTED</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Statutory MCA Audit Trail Read: GRANTED</span>
            </div>
          </div>
        </div>

        {/* Session Invariants */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cryptographic Session Guarantee</span>
          </h4>
          <div className="p-2 bg-slate-900 border border-slate-800 rounded space-y-1 text-[11px] text-slate-400">
            <p>&bull; Signed with HMAC-SHA256 secret key</p>
            <p>&bull; scrypt key derivation (N=16384, r=8, p=1)</p>
            <p>&bull; 16-byte random salt per user</p>
            <p>&bull; Constant-time timingSafeEqual comparison</p>
          </div>
        </div>

        {/* Account Created & Last Login */}
        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono space-y-1">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Joined: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div>Last Login: {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Current Session'}</div>
        </div>

        {/* Sign Out Action */}
        <div className="pt-3 border-t border-slate-800">
          <Button
            variant="danger"
            size="sm"
            className="w-full justify-center"
            onClick={handleLogout}
            disabled={loggingOut}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            {loggingOut ? 'Revoking Session...' : 'Sign Out of Account'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
