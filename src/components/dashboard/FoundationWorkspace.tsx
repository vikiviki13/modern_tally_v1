import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authClient } from '../../services/authClient';
import { Card, Button, Badge, Alert } from '../../design-system';
import {
  ShieldCheck,
  Building2,
  Key,
  Play,
  CheckCircle2,
  XCircle,
  FileCode,
  Users,
  Lock,
  ArrowRight,
  Database,
  Layers,
  Terminal,
  Sliders,
} from 'lucide-react';

interface TestResultItem {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

interface FoundationWorkspaceProps {
  onOpenCompanySwitcher: () => void;
  onOpenProfileDrawer: () => void;
  onNavigateToCompanySettings?: () => void;
}

export function FoundationWorkspace({
  onOpenCompanySwitcher,
  onOpenProfileDrawer,
  onNavigateToCompanySettings,
}: FoundationWorkspaceProps) {
  const { user, tenant, token, logout } = useAuth();

  // Test suite state
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    passed: boolean;
    total: number;
    passedCount: number;
    results: TestResultItem[];
  } | null>(null);

  // Decoded token inspection
  const decodedClaims = React.useMemo(() => {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const claims = JSON.parse(atob(parts[1]));
        return claims;
      }
    } catch {
      return null;
    }
    return null;
  }, [token]);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const summary = await authClient.runTestSuite();
      setTestResults(summary);
    } catch (e) {
      console.error('Failed to run test suite', e);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero: Foundation & Multi-Tenant Company Context */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-600/15 border border-indigo-500/30 rounded text-indigo-400 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">{tenant?.name}</h2>
                <Badge variant="primary" dot>TENANT ACTIVE</Badge>
                <Badge variant="credit">{typeof tenant?.currency === 'object' && tenant.currency ? tenant.currency.code : tenant?.currency || 'INR'}</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{tenant?.legalName}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                <span>GSTIN: <strong className="text-slate-200">{tenant?.gstin || 'UNREGISTERED'}</strong></span>
                <span>&bull;</span>
                <span>State Code: <strong className="text-slate-200">{tenant?.stateCode}</strong></span>
                <span>&bull;</span>
                <span>Tenant ID: <strong className="text-slate-300">{tenant?.id?.slice(0, 8)}...</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToCompanySettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToCompanySettings}
                leftIcon={<Sliders className="w-3.5 h-3.5 text-indigo-400" />}
              >
                Financial Config
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCompanySwitcher}
              leftIcon={<Building2 className="w-3.5 h-3.5" />}
            >
              Switch Company
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenProfileDrawer}
              leftIcon={<Users className="w-3.5 h-3.5" />}
            >
              Role &amp; Profile
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Three Pillar Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: Cryptographic Authentication */}
        <Card
          title="Cryptographic Security"
          subtitle="Password protection &amp; key derivation"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Hashing Algorithm:</span>
              <span className="font-mono text-indigo-300">scrypt (64-byte key)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Salt Entropy:</span>
              <span className="font-mono text-indigo-300">16 bytes random</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Comparison:</span>
              <span className="font-mono text-indigo-300">timingSafeEqual</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Plaintext Storage:</span>
              <span className="font-mono text-emerald-400">ZERO (Strictly Prohibited)</span>
            </div>
          </div>
        </Card>

        {/* Pillar 2: Active User Identity */}
        <Card
          title="Session &amp; Authority"
          subtitle="Role-Based Access Control context"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Active User:</span>
              <span className="font-semibold text-slate-200">{user?.fullName}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Work Email:</span>
              <span className="font-mono text-slate-300 truncate max-w-[150px]">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Assigned Role:</span>
              <Badge variant="primary" dot>{user?.role}</Badge>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Status:</span>
              <span className="font-mono text-emerald-400">Authenticated &bull; Active</span>
            </div>
          </div>
        </Card>

        {/* Pillar 3: Multi-Tenant Architecture */}
        <Card
          title="Data Isolation"
          subtitle="PostgreSQL RLS &amp; tenant boundary"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Isolation Layer:</span>
              <span className="font-mono text-indigo-300">Tenant-Scoped Database</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Session Guard:</span>
              <span className="font-mono text-indigo-300">Bearer Token Claims</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Audit Compliance:</span>
              <span className="font-mono text-indigo-300">MCA 2013 Audit Log</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Cross-Tenant Leakage:</span>
              <span className="font-mono text-emerald-400">Zero Invariant</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Interactive Automated Test Matrix Runner */}
      <Card
        title="Automated Test Suite Runner"
        subtitle="Execute Phase 04 test matrix directly against the backend auth &amp; security engine"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 rounded border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>14 Comprehensive Verification Invariants</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tests registration, duplicate email rejection, weak password rejection, timing-safe verification, HMAC-SHA256 signatures, tampered tokens, suspended accounts, password reset, and session invalidation.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleRunTests}
              disabled={isRunningTests}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              {isRunningTests ? 'Running Test Suite...' : 'Execute Test Suite (14 Tests)'}
            </Button>
          </div>

          {/* Test results table */}
          {testResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">Execution Result:</span>
                  {testResults.passed ? (
                    <Badge variant="credit" dot>ALL {testResults.total} TESTS PASSED (100%)</Badge>
                  ) : (
                    <Badge variant="debit" dot>{testResults.passedCount}/{testResults.total} PASSED</Badge>
                  )}
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  Pass Rate: {Math.round((testResults.passedCount / testResults.total) * 100)}%
                </span>
              </div>

              <div className="border border-slate-800 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Invariant Name</th>
                      <th className="py-2 px-3 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {testResults.results.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-900/30">
                        <td className="py-2 px-3 whitespace-nowrap">
                          {r.passed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-indigo-300 text-[11px] whitespace-nowrap">
                          {r.category}
                        </td>
                        <td className="py-2 px-3 text-slate-200 text-[11px]">
                          {r.name}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400 text-[11px] tabular-nums">
                          {r.durationMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Active JWT Session Token Inspector */}
      <Card
        title="Session Token Cryptographic Claims"
        subtitle="Decoded JWT payload demonstrating stateless verification with database revocation fallback"
      >
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 bg-slate-900 rounded border border-slate-800">
            <div className="text-[11px] text-slate-400 mb-2 font-sans font-medium flex items-center justify-between">
              <span>Decoded Payload Claims:</span>
              <span className="text-emerald-400 font-mono text-[10px]">&bull; HMAC-SHA256 SIGNED</span>
            </div>
            <pre className="text-indigo-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(decodedClaims, null, 2)}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-[11px] text-slate-400 font-sans">
              Bearer token is sent on every request via the <code className="text-slate-200">Authorization: Bearer</code> header.
            </div>

            <Button
              variant="outline"
              size="xs"
              onClick={logout}
              leftIcon={<Lock className="w-3 h-3 text-rose-400" />}
            >
              Test Logout &amp; Token Revocation
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
