import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Moon, Phone, Sun, User } from 'lucide-react';
import { ChurchLogoBadge } from './ChurchLogoBadge';
import { IOSInstallBanner } from './PWAInstallUI';
import { DEPARTMENT_NAMES } from '../data/bibleData';
import {
  registerFellowshipAccount,
  signInWithCredentials,
  signInWithGoogleAccount,
} from '../services/fellowshipService';
import type { FellowshipAccount, LanguageCode, UserRole } from '../types/fellowship';

interface AuthScreenProps {
  onAuthenticated: (account: FellowshipAccount) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  isDark,
  onToggleTheme,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'ADMINISTRATOR'>>('MEMBER');
  const [department, setDepartment] = useState(DEPARTMENT_NAMES[0]);
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('EN');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const account = await signInWithCredentials(identifier, password);
      onAuthenticated(account);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const account = await registerFellowshipAccount({
        fullName,
        email,
        phoneNumber,
        password: regPassword,
        role,
        department,
        preferredLanguage,
      });
      onAuthenticated(account);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const account = await signInWithGoogleAccount();
      onAuthenticated(account);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] flex items-center justify-center text-[#334155] dark:text-[#94A3B8] hover:text-[#E11D48] transition-colors shadow-xs"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-5">
        {/* Centered ChurchEmblemHeader */}
        <header className="flex flex-col items-center text-center space-y-3">
          <ChurchLogoBadge size={88} variant="circle" className="shadow-md" />
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              THE GIDEONITES
            </h1>
            <p className="text-sm font-semibold text-[#E11D48]">The Youth Alive Fellowship</p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              ECWA • Standing in the Gap • Raising Kingdom Giants
            </p>
          </div>
        </header>

        {/* Auth Card */}
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-sm overflow-hidden">
          {/* Sign In / Register Toggle Tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 bg-[#F1F5F9] dark:bg-[#1F2937] p-1.5 gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
                mode === 'signin'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/30 px-3.5 py-2.5 text-xs font-medium text-[#9F1239] dark:text-[#FECDD3]"
              >
                {errorMsg}
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label
                    htmlFor="signin-identifier"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1.5"
                  >
                    Email or Phone Number
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="signin-identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="name@youthalive.org or 080..."
                      className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signin-password"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full min-h-[44px] pl-10 pr-11 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] disabled:opacity-60 text-white text-sm font-bold shadow-sm transition-colors"
                >
                  {loading ? 'Signing In...' : 'Sign In to Fellowship'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Samuel Adeyemi"
                      className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                    >
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="08012345678"
                        className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                  >
                    Password (min. 6 characters)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-role"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                    >
                      Fellowship Role
                    </label>
                    <select
                      id="reg-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as Exclude<UserRole, 'ADMINISTRATOR'>)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                    >
                      <option value="MEMBER">Youth Member</option>
                      <option value="EXECUTIVE">Youth Executive</option>
                      <option value="GUEST">Guest</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="reg-lang"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                    >
                      Preferred Language
                    </label>
                    <select
                      id="reg-lang"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                    >
                      <option value="EN">English (EN)</option>
                      <option value="YO">Yorùbá (YO)</option>
                      <option value="HA">Hausa (HA)</option>
                      <option value="IG">Igbo (IG)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-dept"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#94A3B8] mb-1"
                  >
                    Ministry Department
                  </label>
                  <select
                    id="reg-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  >
                    {DEPARTMENT_NAMES.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {role === 'EXECUTIVE' && (
                  <p className="text-xs text-[#F59E0B] font-medium">
                    Note: Youth Executive registrations require Administrator approval in the Command Centre.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] disabled:opacity-60 text-white text-sm font-bold shadow-sm transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Create Fellowship Account'}
                </button>
              </form>
            )}

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E8F0] dark:border-[#374151]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-[#111827] px-3 text-xs text-[#64748B]">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full min-h-[46px] rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] hover:bg-[#F8FAFC] dark:hover:bg-[#334155] text-[#0F172A] dark:text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>

        <IOSInstallBanner />
      </div>
    </div>
  );
};
