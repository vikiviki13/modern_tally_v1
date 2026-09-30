import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authClient } from '../../services/authClient';
import { Button, Input, Alert, Card, Badge } from '../../design-system';
import {
  Lock,
  Mail,
  Building2,
  User,
  ShieldCheck,
  KeyRound,
  FileCheck2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

type AuthTab = 'login' | 'register' | 'forgot-password';

export function AuthView() {
  const { login, register, error, clearError, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('admin@apexerp.com');
  const [loginPassword, setLoginPassword] = useState('Admin@123456');
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regOrgName, setRegOrgName] = useState('');
  const [regLegalName, setRegLegalName] = useState('');
  const [regGstin, setRegGstin] = useState('');
  const [regStateCode, setRegStateCode] = useState('27');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login({
        email: loginEmail,
        password: loginPassword,
        rememberMe,
      });
    } catch {
      // Handled by context
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await register({
        organizationName: regOrgName,
        legalName: regLegalName || undefined,
        gstin: regGstin || undefined,
        stateCode: regStateCode,
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
      });
    } catch {
      // Handled by context
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetSuccessMessage(null);
    try {
      const res = await authClient.requestPasswordReset({ email: resetEmail });
      setResetSuccessMessage(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setResetStep('confirm');
      }
    } catch (err: unknown) {
      setResetSuccessMessage(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await authClient.confirmPasswordReset({
        token: resetToken,
        newPassword: resetNewPassword,
      });
      setResetSuccessMessage(res.message);
      setTimeout(() => {
        setActiveTab('login');
        setLoginEmail(resetEmail);
        setLoginPassword(resetNewPassword);
        setResetStep('request');
      }, 1500);
    } catch (err: unknown) {
      setResetSuccessMessage(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setLoginEmail('admin@apexerp.com');
    setLoginPassword('Admin@123456');
    clearError();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand identity header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-600/10 border border-indigo-500/30 mb-3 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            LedgerPulse ERP
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Cloud Accounting &amp; Operating System
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="primary" dot>PHASE 04 SECURE AUTH</Badge>
            <Badge variant="info">MCA 2013 READY</Badge>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800 mb-6 bg-slate-900/50 p-1 rounded">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              clearError();
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'login'
                ? 'bg-slate-800 text-slate-100 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              clearError();
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'register'
                ? 'bg-slate-800 text-slate-100 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Organization
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('forgot-password');
              clearError();
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'forgot-password'
                ? 'bg-slate-800 text-slate-100 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Reset
          </button>
        </div>

        {/* Error / Alert notification banner */}
        {error && (
          <div className="mb-4">
            <Alert variant="error">
              <span className="font-semibold text-rose-300">Authentication Error:</span> {error}
            </Alert>
          </div>
        )}

        {/* TAB 1: LOGIN */}
        {activeTab === 'login' && (
          <Card
            title="Sign In to Your Workspace"
            subtitle="Access your chart of accounts and multi-tenant ledger"
          >
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="name@company.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                leftElement={<Mail className="w-3.5 h-3.5 text-slate-500" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                leftElement={<Lock className="w-3.5 h-3.5 text-slate-500" />}
                required
              />

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Stay signed in for 7 days</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab('forgot-password')}
                  className="text-indigo-400 hover:text-indigo-300 text-xs"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                disabled={isLoading}
              >
                {isLoading ? 'Verifying Credentials...' : 'Sign In to LedgerPulse'}
              </Button>

              {/* Quick Fill Test Admin Credentials */}
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="w-full py-1.5 px-2 bg-slate-900/80 hover:bg-slate-800 text-[11px] text-slate-300 rounded border border-slate-700/60 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>One-Click Fill Initial Admin (Rohit Varma, FCA)</span>
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* TAB 2: REGISTER */}
        {activeTab === 'register' && (
          <Card
            title="Create Organization &amp; Super Admin"
            subtitle="Initializes tenant isolation and default chart of accounts"
          >
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <Input
                label="Organization / Company Name"
                placeholder="e.g. Acme Precision Tools"
                value={regOrgName}
                onChange={(e) => setRegOrgName(e.target.value)}
                leftElement={<Building2 className="w-3.5 h-3.5 text-slate-500" />}
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="GSTIN (Optional)"
                  placeholder="27AAACT2727Q1ZB"
                  value={regGstin}
                  onChange={(e) => setRegGstin(e.target.value.toUpperCase())}
                />
                <Input
                  label="State Code"
                  placeholder="27 (Maharashtra)"
                  value={regStateCode}
                  onChange={(e) => setRegStateCode(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Super Admin Full Name"
                placeholder="e.g. Anand Mahindra"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                leftElement={<User className="w-3.5 h-3.5 text-slate-500" />}
                required
              />

              <Input
                label="Work Email"
                type="email"
                placeholder="cfo@company.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                leftElement={<Mail className="w-3.5 h-3.5 text-slate-500" />}
                required
              />

              <Input
                label="Password (min 8 characters)"
                type="password"
                placeholder="••••••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                leftElement={<Lock className="w-3.5 h-3.5 text-slate-500" />}
                helperText="Secured via scrypt cryptographic key derivation with 64-byte key length."
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center mt-2"
                disabled={isLoading}
              >
                {isLoading ? 'Creating Tenant...' : 'Initialize Organization'}
              </Button>
            </form>
          </Card>
        )}

        {/* TAB 3: FORGOT PASSWORD */}
        {activeTab === 'forgot-password' && (
          <Card
            title="Password Reset Architecture"
            subtitle="Generates an unguessable 32-byte security reset token"
          >
            {resetSuccessMessage && (
              <div className="mb-3">
                <Alert variant="info">{resetSuccessMessage}</Alert>
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <Input
                  label="Registered Work Email"
                  type="email"
                  placeholder="name@company.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  leftElement={<Mail className="w-3.5 h-3.5 text-slate-500" />}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Generating Token...' : 'Generate Reset Token'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetConfirm} className="space-y-3">
                <Input
                  label="Reset Token (Issued)"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  leftElement={<KeyRound className="w-3.5 h-3.5 text-slate-500" />}
                  required
                />

                <Input
                  label="New Password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  leftElement={<Lock className="w-3.5 h-3.5 text-slate-500" />}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Updating Hash...' : 'Update Password & Invalidate Sessions'}
                </Button>
              </form>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setResetSuccessMessage(null);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                <span>Back to Sign In</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>
        )}

        {/* Security Specifications Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>scrypt + salt password derivation &bull; No plain text storage</span>
          </p>
          <p>
            HMAC-SHA256 session tokens with tenant-scoped cryptographic claims
          </p>
        </div>
      </div>
    </div>
  );
}
