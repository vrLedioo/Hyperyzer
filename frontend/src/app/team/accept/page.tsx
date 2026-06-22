'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Play, CheckCircle, AlertCircle, Loader2, Users } from 'lucide-react';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function AcceptInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const token = params.get('token') ?? '';

  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return;
    // Not logged in: send them to log in (or sign up with the invited email), then back here.
    if (!getToken() || !user) {
      const next = encodeURIComponent(`/team/accept?token=${token}`);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (!token) {
      ran.current = true;
      setStatus('error');
      setMessage('Missing invite token. Use the link from your invitation email.');
      return;
    }
    ran.current = true;
    setStatus('working');
    (async () => {
      try {
        const res = await api<{ message: string }>('/api/team/accept', {
          method: 'POST', body: JSON.stringify({ token }),
        });
        await refresh();
        setStatus('success');
        setMessage(res.message || 'You’ve joined the team.');
        setTimeout(() => router.push('/studio'), 1600);
      } catch (e: any) {
        setStatus('error');
        setMessage(e.message || 'This invite link is invalid or has expired.');
      }
    })();
  }, [loading, user, token, router, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-3xl border border-black/5 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md"><Play className="w-5 h-5 text-white fill-white ml-0.5" /></div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hyperyzer</h1>
        </div>

        {(status === 'idle' || status === 'working') && (
          <div className="text-center py-4">
            <Loader2 className="w-14 h-14 text-pink-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Joining the team…</h2>
          </div>
        )}
        {status === 'success' && (
          <div className="text-center py-4">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">You&apos;re in! <Users className="inline w-6 h-6 text-pink-500" /></h2>
            <p className="text-slate-500 font-medium">{message}</p>
          </div>
        )}
        {status === 'error' && (
          <>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Couldn&apos;t join the team</h2>
            <div className="my-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-red-800 text-sm font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{message}
            </div>
            <p className="text-sm text-slate-400 mt-6 text-center"><Link href="/app" className="hover:text-slate-600">Go to the app</Link></p>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamAcceptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-slate-400 font-semibold">Loading…</div></div>}>
      <AcceptInner />
    </Suspense>
  );
}
