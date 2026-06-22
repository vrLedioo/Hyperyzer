'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Play, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerify(false);
    setResent(false);
    setLoading(true);
    try {
      await login(email, password);
      // Honor a ?next= redirect (e.g. accepting a team invite), but only for
      // same-site relative paths to avoid an open redirect.
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') ? next : '/app');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      if (err?.status === 403) setNeedsVerify(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResent(true);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email }),
      });
    } catch {
      /* generic response; ignore */
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-3xl border border-black/5 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hyperyzer</h1>
        </div>

        <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Welcome back</h2>
        <p className="text-slate-500 mb-6 font-medium">Log in to access your history and plan.</p>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-red-800 text-sm font-medium">
            {error}
            {needsVerify && (
              <button
                onClick={handleResend}
                disabled={resent}
                className="block mt-2 text-pink-600 font-bold hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
              >
                {resent ? 'Verification email re-sent ✓' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/60 border-2 border-slate-200 focus:border-pink-500 focus:bg-white outline-none font-semibold text-slate-900 transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/60 border-2 border-slate-200 focus:border-pink-500 focus:bg-white outline-none font-semibold text-slate-900 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.4)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? 'Logging in…' : <>Log in <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-sm text-center mt-4">
          <Link href="/forgot-password" className="text-slate-400 hover:text-pink-600 font-medium transition-colors">
            Forgot password?
          </Link>
        </p>

        <p className="text-sm text-slate-500 mt-4 text-center font-medium">
          No account?{' '}
          <Link href="/signup" className="text-pink-600 font-bold hover:underline">Sign up free</Link>
        </p>
        <p className="text-sm text-slate-400 mt-2 text-center">
          <Link href="/" className="hover:text-slate-600">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
