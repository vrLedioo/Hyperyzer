'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Play, Sparkles, History, BrainCircuit, CheckCircle2, TrendingUp, Target, Zap,
  Clock, AlertCircle, Key, CreditCard, ChevronRight, LogOut, User as UserIcon,
  Lightbulb, Video, UploadCloud, FileText, Crown, Hash, Copy, Check, Settings,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, API_URL, getToken } from '@/lib/api';

const EXAMPLES = [
  {
    icon: '🎮', shortTitle: 'Minecraft',
    title: 'I Survived 100 Days in Hardcore Minecraft',
    script: "I spawned in a brand new hardcore world with nothing but my fists. My goal? Survive 100 days without taking a single heart of damage. If I fail, I delete the channel. Day 1 started off terrible when I immediately fell into a ravine...",
  },
  {
    icon: '💰', shortTitle: 'Side Hustle',
    title: 'How I Made $500 in 24 Hours (No Skills)',
    script: "Everyone says you need money to make money, but today I'm going to prove them wrong. I have exactly 24 hours to turn $0 into $500 using only free tools on the internet. And no, this isn't dropshipping or crypto. Watch exactly what I do.",
  },
  {
    icon: '✂️', shortTitle: 'Barber Story',
    title: 'Worst Barber in Kosovo?',
    script: "I found the lowest-rated barber shop in all of Pristina. They have 1 star on Google Maps and the reviews say they literally ruined people's lives. Today, I'm going in for a full haircut and beard trim. Let's see how bad it really is.",
  },
];

const PLATFORMS = [
  { value: '', label: 'Auto-detect platform' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Instagram Reels', label: 'Instagram Reels' },
  { value: 'YouTube Shorts', label: 'YouTube Shorts' },
  { value: 'YouTube (long-form)', label: 'YouTube (long-form)' },
];

const PAY_TOKEN_KEY = 'va_pay_token';

interface Hashtags { primary: string[]; niche: string[]; broad: string[] }
interface TimeSlot { day: string; time: string; why: string }
interface BestTimes { timezone_note?: string; summary?: string; slots?: TimeSlot[] }

interface AnalysisResult {
  hook_score: number;
  retention_score: number;
  viral_score: number;
  feedback: string;
  hashtags?: Hashtags;
  best_times?: BestTimes;
  transcript?: string | null;
  pay_token_consumed?: boolean;
}

interface HistoryItem {
  id: number;
  kind: string;
  title: string;
  platform?: string | null;
  transcript?: string | null;
  hook_score: number;
  retention_score: number;
  viral_score: number;
  feedback: string;
  hashtags?: Hashtags;
  best_times?: BestTimes;
  created_at: string;
}

interface PlanOut { key: string; name: string; price_eur: number; monthly_credits: number; priority: boolean; team: boolean; tagline: string; available: boolean }
interface PackOut { key: string; name: string; price_eur: number; credits: number; available: boolean }

interface AppConfig {
  payment_provider: string;
  billing_enabled: boolean;
  subscription_enabled: boolean;
  credits_purchase_enabled: boolean;
  pay_per_use_enabled: boolean;
  byok_enabled: boolean;
  server_llm_ready: boolean;
  ai_provider: string;
  pay_per_use_cents: number;
  free_credits_on_signup: number;
  idea_credit_cost: number;
  video_credit_cost: number;
  plans: PlanOut[];
  packs: PackOut[];
}

type Mode = 'idea' | 'video';

function scoreLabel(viral: number): { label: string; color: string } {
  if (viral >= 75) return { label: '🔥 Viral', color: 'text-rose-700 bg-rose-100/80 border-rose-200' };
  if (viral >= 55) return { label: '🚀 Strong', color: 'text-emerald-700 bg-emerald-100/80 border-emerald-200' };
  return { label: '⚠️ Average', color: 'text-amber-700 bg-amber-100/80 border-amber-200' };
}

function hasHashtags(h?: Hashtags): boolean {
  return !!h && ((h.primary?.length || 0) + (h.niche?.length || 0) + (h.broad?.length || 0) > 0);
}
function hasTimes(t?: BestTimes): boolean {
  return !!t && ((t.slots?.length || 0) > 0 || !!t.summary);
}

export default function Home() {
  const { user, logout, refresh } = useAuth();

  const [mode, setMode] = useState<Mode>('idea');
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [platform, setPlatform] = useState('');
  const [audience, setAudience] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [userApiKey, setUserApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const charCount = script.length;
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round((wordCount / 150) * 60);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    try {
      const items = await api<HistoryItem[]>('/api/history');
      setHistory(items);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Load server capabilities (to adapt billing UI). Retry once on transient failure.
  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0): Promise<void> => {
      try {
        const cfg = await api<AppConfig>('/api/config', { auth: false });
        if (!cancelled) setConfig(cfg);
      } catch (e) {
        if (attempt < 1) return load(attempt + 1);
        console.error('Failed to load /api/config:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Handle payment redirects (pay-per-use + subscription + credit packs).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cleanUrl = () => window.history.replaceState({}, '', window.location.pathname);

    if (params.get('payment') === 'success' && params.get('session_id')) {
      const sessionId = params.get('session_id')!;
      cleanUrl();
      (async () => {
        try {
          const res = await api<{ pay_token: string }>('/api/checkout/verify', {
            method: 'POST', auth: false,
            body: JSON.stringify({ session_id: sessionId }),
          });
          localStorage.setItem(PAY_TOKEN_KEY, res.pay_token);
          setNotice('Payment confirmed — you have 1 analysis ready. Submit below.');
        } catch (e: any) {
          setError(e.message || 'Could not verify payment.');
        }
      })();
    } else if (params.get('payment') === 'cancelled') {
      cleanUrl();
      setNotice('Payment cancelled.');
    } else if (params.get('subscribed') === 'success') {
      cleanUrl();
      setNotice('Subscription active — your monthly credits are loaded! ✨');
      refresh();
      setTimeout(() => refresh(), 4000);
    } else if (params.get('subscribed') === 'cancelled') {
      cleanUrl();
      setNotice('Subscription checkout cancelled.');
    } else if (params.get('credits') === 'success') {
      cleanUrl();
      setNotice('Payment received — your credits will appear in a moment. ✨');
      refresh();
      setTimeout(() => refresh(), 4000);
    }
  }, [refresh]);

  const consumePayTokenIfAny = () => localStorage.getItem(PAY_TOKEN_KEY) || undefined;

  const afterSuccess = async (payTokenConsumed: boolean) => {
    if (payTokenConsumed) localStorage.removeItem(PAY_TOKEN_KEY);
    await Promise.all([refresh(), loadHistory()]);
  };

  const handleAnalyzeIdea = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !script.trim()) return;
    setIsLoading(true); setError(''); setNotice('');
    if (result) { setResult(null); await new Promise((r) => setTimeout(r, 250)); }
    try {
      const data = await api<AnalysisResult>('/api/analyze-idea', {
        method: 'POST',
        body: JSON.stringify({
          title, script,
          platform: platform || undefined,
          audience: audience || undefined,
          user_api_key: userApiKey || undefined,
          pay_token: consumePayTokenIfAny(),
        }),
      });
      setResult(data);
      await afterSuccess(!!data.pay_token_consumed);
    } catch (err: any) {
      setError(err.message || 'An error occurred while connecting to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleAnalyzeVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !videoFile) return;
    setIsLoading(true); setError(''); setNotice(''); setResult(null);
    setStatusLabel('Uploading…');
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('file', videoFile);
      if (platform) form.append('platform', platform);
      if (audience) form.append('audience', audience);
      if (userApiKey) form.append('user_api_key', userApiKey);
      const payTok = consumePayTokenIfAny();
      if (payTok) form.append('pay_token', payTok);

      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/analyze-video`, { method: 'POST', body: form, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Upload failed (${res.status})`);
      }
      const { job_id } = await res.json();

      // Poll for completion.
      let payConsumed = false;
      await new Promise<void>((resolve, reject) => {
        pollRef.current = setInterval(async () => {
          try {
            const job = await api<any>(`/api/jobs/${job_id}`);
            if (job.status === 'transcribing') setStatusLabel('Transcribing audio…');
            else if (job.status === 'scoring') setStatusLabel('Building your report…');
            else if (job.status === 'done') {
              clearInterval(pollRef.current!);
              payConsumed = !!job.pay_token_consumed;
              setResult({
                hook_score: job.hook_score, retention_score: job.retention_score,
                viral_score: job.viral_score, feedback: job.feedback,
                hashtags: job.hashtags, best_times: job.best_times, transcript: job.transcript,
              });
              resolve();
            } else if (job.status === 'error') {
              clearInterval(pollRef.current!);
              reject(new Error(job.error || 'Video analysis failed.'));
            }
          } catch (err) {
            clearInterval(pollRef.current!);
            reject(err);
          }
        }, 2000);
      });
      await afterSuccess(payConsumed);
    } catch (err: any) {
      setError(err.message || 'An error occurred during video analysis.');
    } finally {
      setIsLoading(false);
      setStatusLabel('');
    }
  };

  const handlePayPerUse = async () => {
    try {
      const data = await api<{ url: string }>('/api/checkout/pay-per-use', { method: 'POST', auth: false });
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Could not initiate payment.');
    }
  };

  const handleBuyCredits = async (pack: string) => {
    if (!user) { window.location.href = '/signup'; return; }
    try {
      const data = await api<{ url: string }>('/api/checkout/credits', {
        method: 'POST', body: JSON.stringify({ pack }),
      });
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Could not start checkout.');
    }
  };

  const handleSubscribe = async (plan: string) => {
    if (!user) { window.location.href = '/signup'; return; }
    try {
      const data = await api<{ url: string }>('/api/checkout/subscription', {
        method: 'POST', body: JSON.stringify({ plan }),
      });
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Could not start subscription.');
    }
  };

  const loadExample = (index: number) => { setTitle(EXAMPLES[index].title); setScript(EXAMPLES[index].script); };
  const restoreFromHistory = (item: HistoryItem) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setIsLoading(false); setStatusLabel(''); setError('');
    setResult({
      hook_score: item.hook_score, retention_score: item.retention_score,
      viral_score: item.viral_score, feedback: item.feedback,
      hashtags: item.hashtags, best_times: item.best_times,
      transcript: item.transcript ?? undefined,
    });
  };

  const canSubmit = mode === 'idea' ? !!(title.trim() && script.trim()) : !!(title.trim() && videoFile);
  const cost = mode === 'idea' ? config?.idea_credit_cost : config?.video_credit_cost;
  const availablePlans = (config?.plans || []).filter((p) => p.available);
  const availablePacks = (config?.packs || []).filter((p) => p.available);
  const planName = (() => {
    if (!user || user.plan === 'free') return null;
    const p = config?.plans.find((x) => x.key === user.plan);
    return p?.name || user.plan.charAt(0).toUpperCase() + user.plan.slice(1);
  })();

  return (
    <div className="flex h-screen w-full relative z-10 p-4 md:p-6 lg:p-8 gap-6 text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white/40 backdrop-blur-xl rounded-3xl hidden lg:flex flex-col overflow-hidden border border-black/5 shadow-sm">
        <div className="p-8 pb-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight group-hover:text-pink-600 transition-colors">Hyperyzer</h1>
          </Link>
        </div>

        <nav className="px-4 space-y-1">
          <button
            onClick={() => { setMode('idea'); setResult(null); setError(''); }}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold w-full transition-all cursor-pointer ${mode === 'idea' ? 'text-slate-900 bg-white/80 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
          >
            <Lightbulb className={`w-5 h-5 ${mode === 'idea' ? 'text-pink-500' : ''}`} />
            <span>Idea Tester</span>
          </button>
          <button
            onClick={() => { setMode('video'); setResult(null); setError(''); }}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold w-full transition-all cursor-pointer ${mode === 'video' ? 'text-slate-900 bg-white/80 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
          >
            <Video className={`w-5 h-5 ${mode === 'video' ? 'text-pink-500' : ''}`} />
            <span>Video Upload</span>
          </button>
          <Link
            href="/studio"
            className="flex items-center gap-3 px-5 py-3 rounded-xl font-bold w-full transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-white/50"
          >
            <Sparkles className="w-5 h-5 text-pink-500" />
            <span>Studio</span>
            <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-pink-500 bg-pink-100 px-1.5 py-0.5 rounded">Pro</span>
          </Link>
        </nav>

        <div className="mt-8 px-6 flex-1 overflow-hidden flex flex-col">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Recent Analyses
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            {!user ? (
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                <Link href="/login" className="text-pink-600 font-bold hover:underline">Log in</Link> to save and revisit your analyses.
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 font-medium">No analyses yet. Run your first one!</p>
            ) : (
              history.map((item) => {
                const { label, color } = scoreLabel(item.viral_score);
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/50 cursor-pointer transition-colors border border-transparent hover:border-black/5"
                    onClick={() => restoreFromHistory(item)}>
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-semibold text-slate-700 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{item.kind}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border shrink-0 ${color}`}>{label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Account */}
        <div className="px-4 pt-2">
          {user ? (
            <div className="p-3 bg-white/80 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate">{user.email}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {planName ? `✨ ${planName} · ` : ''}{user.total_credits} credit{user.total_credits === 1 ? '' : 's'}
                </p>
              </div>
              <Link href="/account" title="Account settings" className="text-slate-400 hover:text-pink-600 transition-colors">
                <Settings className="w-4 h-4" />
              </Link>
              <button onClick={logout} title="Log out" className="text-slate-400 hover:text-pink-600 transition-colors cursor-pointer">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" className="flex-1 text-center py-2 rounded-xl bg-white/80 border border-slate-200 text-sm font-bold text-slate-700 hover:border-pink-300 transition-colors">Log in</Link>
              <Link href="/signup" className="flex-1 text-center py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors">Sign up</Link>
            </div>
          )}
        </div>

        {/* Billing */}
        <div className="p-4 m-4 bg-white/80 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Billing Options</p>

          <button onClick={() => setShowApiKeyInput(!showApiKeyInput)} className="flex items-center justify-between w-full p-2 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 group-hover:text-pink-600">
              <Key className="w-4 h-4" /> Use own OpenAI Key
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showApiKeyInput ? 'rotate-90' : ''}`} />
          </button>

          {showApiKeyInput && (
            <input type="password" placeholder="sk-..." value={userApiKey} onChange={(e) => setUserApiKey(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-pink-500 outline-none" />
          )}

          {config?.billing_enabled && <div className="h-px w-full bg-slate-100"></div>}

          {/* Anonymous one-off (Stripe only) */}
          {config?.pay_per_use_enabled && (
            <button onClick={handlePayPerUse} className="flex items-center gap-2 w-full p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-sm font-semibold justify-center cursor-pointer">
              <CreditCard className="w-4 h-4" /> Pay per use (${(config.pay_per_use_cents / 100).toFixed(2)})
            </button>
          )}

          {/* Subscription plans (Lemon Squeezy) */}
          {config?.subscription_enabled && availablePlans.map((p) => (
            <button key={p.key} onClick={() => handleSubscribe(p.key)}
              className={`flex items-center justify-between gap-2 w-full p-2 rounded-lg transition-all text-sm font-semibold cursor-pointer ${user?.plan === p.key ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default' : 'bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-95 text-white'}`}
              disabled={user?.plan === p.key}>
              <span className="flex items-center gap-2"><Crown className="w-4 h-4" /> {p.name}</span>
              <span>{user?.plan === p.key ? 'Current' : `€${p.price_eur}/mo`}</span>
            </button>
          ))}

          {/* Credit packs (Lemon Squeezy) */}
          {config?.credits_purchase_enabled && availablePacks.map((p) => (
            <button key={p.key} onClick={() => handleBuyCredits(p.key)}
              className="flex items-center justify-between gap-2 w-full p-2 bg-white border border-slate-200 hover:border-pink-300 text-slate-800 rounded-lg transition-colors text-sm font-semibold cursor-pointer">
              <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> {p.credits} credits</span>
              <span>€{p.price_eur}</span>
            </button>
          ))}

          {!config?.billing_enabled && (
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              {config?.ai_provider === 'local' ? 'Running on a free local AI model. ' : ''}
              {user ? 'Use your account credits, or add your own OpenAI key above.' : 'Sign up for free credits, or add your own OpenAI key above.'}
            </p>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-full overflow-hidden max-w-[1200px] mx-auto">
        <header className="mb-6 px-2 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {mode === 'idea' ? 'Test Your Video Idea' : 'Analyze Your Video'}
            </h2>
            <p className="text-slate-600 mt-1 text-lg font-medium">
              {mode === 'idea'
                ? 'Scores, hashtags & best time to post — from your title and hook.'
                : 'Upload a clip — we transcribe it and build your full report.'}
            </p>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 flex-1 min-h-0">
          {/* Input */}
          <div className="flex-[1.1] min-h-0 flex flex-col relative max-w-2xl">
            <div className="flex-1 bg-white rounded-[24px] p-6 md:p-8 flex flex-col border border-black/5 shadow-xl overflow-y-auto custom-scrollbar">
              {notice && (
                <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-lg text-emerald-800 text-sm font-medium">{notice}</div>
              )}

              {/* Targeting (shared by both modes) */}
              <div className="mb-5 grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="platform" className="block text-sm font-bold text-slate-800 mb-2">Platform</label>
                  <select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50/50 border-2 border-slate-200 focus:border-pink-500 focus:bg-white text-slate-900 font-semibold transition-all outline-none cursor-pointer">
                    {PLATFORMS.map((p) => <option key={p.label} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="audience" className="block text-sm font-bold text-slate-800 mb-2">
                    Target audience <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input id="audience" type="text" value={audience} onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. Gen Z gamers, US"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50/50 border-2 border-slate-200 focus:border-pink-500 focus:bg-white text-slate-900 placeholder-slate-400 font-semibold transition-all outline-none" />
                </div>
              </div>

              {mode === 'idea' ? (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Try an example</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {EXAMPLES.map((ex, i) => (
                        <button key={i} onClick={() => loadExample(i)} type="button"
                          className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-pink-300 hover:bg-pink-50 text-sm font-semibold text-slate-700 transition-colors shadow-sm cursor-pointer">
                          <span>{ex.icon}</span><span>{ex.shortTitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleAnalyzeIdea} className="flex-1 flex flex-col">
                    <div className="group mb-5">
                      <label htmlFor="title" className="block text-sm font-bold text-slate-800 mb-2">Video Title</label>
                      <input type="text" id="title" required value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50/50 border-2 border-slate-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 focus:bg-white text-slate-900 placeholder-slate-400 font-semibold transition-all outline-none"
                        placeholder="e.g. I Survived 100 Days in Minecraft..." />
                    </div>

                    <div className="group flex-1 flex flex-col min-h-[140px]">
                      <label htmlFor="script" className="block text-sm font-bold text-slate-800 mb-2">Video Hook / Script</label>
                      <textarea id="script" required value={script} onChange={(e) => setScript(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50/50 border-2 border-slate-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 focus:bg-white text-slate-900 placeholder-slate-400 font-medium leading-relaxed resize-none flex-1 outline-none transition-all"
                        placeholder="Paste the first 30-60 seconds of your script here..." />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 px-1 gap-2">
                        <div className="flex items-center gap-3">
                          <p className={`text-xs font-bold ${charCount > 1500 ? 'text-red-500' : charCount > 0 ? 'text-pink-500' : 'text-slate-400'}`}>{charCount} / 1500 chars</p>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />Est. time: {estimatedSeconds}s</p>
                        </div>
                        {estimatedSeconds > 0 && (
                          <p className={`text-xs font-bold flex items-center gap-1 ${estimatedSeconds >= 20 && estimatedSeconds <= 60 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {estimatedSeconds >= 20 && estimatedSeconds <= 60 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}Optimal hook: 20-60 sec
                          </p>
                        )}
                      </div>
                    </div>

                    <SubmitButton isLoading={isLoading} disabled={!canSubmit} label="Analyze Idea" statusLabel={statusLabel} />
                    {user && !userApiKey && cost != null && (
                      <p className="text-center text-xs text-slate-400 font-medium mt-2">
                        Uses {cost} credit{cost === 1 ? '' : 's'} · you have {user.total_credits}
                      </p>
                    )}
                  </form>
                </>
              ) : (
                <form onSubmit={handleAnalyzeVideo} className="flex-1 flex flex-col">
                  <div className="group mb-5">
                    <label htmlFor="vtitle" className="block text-sm font-bold text-slate-800 mb-2">Video Title</label>
                    <input type="text" id="vtitle" required value={title} onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50/50 border-2 border-slate-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 focus:bg-white text-slate-900 placeholder-slate-400 font-semibold transition-all outline-none"
                      placeholder="Give your video a title..." />
                  </div>

                  <label className="flex-1 min-h-[180px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-pink-400 hover:bg-pink-50/40 transition-colors text-center p-6">
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                    {videoFile ? (
                      <>
                        <FileText className="w-10 h-10 text-pink-500 mb-3" />
                        <p className="font-bold text-slate-800 break-all">{videoFile.name}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB · click to change</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                        <p className="font-bold text-slate-700">Click to upload a video</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">MP4, MOV, WebM · we extract audio &amp; transcribe it</p>
                      </>
                    )}
                  </label>

                  <SubmitButton isLoading={isLoading} disabled={!canSubmit} label="Analyze Video" statusLabel={statusLabel} />
                  {user && !userApiKey && cost != null && (
                    <p className="text-center text-xs text-slate-400 font-medium mt-2">
                      Uses {cost} credits · you have {user.total_credits}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-[0.9] min-h-0 flex flex-col">
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            <div className="flex-1 bg-slate-50/80 rounded-[24px] p-6 md:p-8 flex flex-col relative overflow-y-auto custom-scrollbar border border-black/[0.06] shadow-inner">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Your Report</h3>
                {result ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-100 rounded-lg text-pink-700 text-xs font-bold uppercase tracking-wider shadow-sm border border-pink-200"><Sparkles className="w-3 h-3" /> AI Generated</div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-200/60 rounded-lg text-slate-500 text-xs font-bold uppercase tracking-wider"><Clock className="w-3 h-3" /> Awaiting Input</div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 mb-6 relative">
                <ScoreCard label="Hook Strength" value={result?.hook_score} color="pink" Icon={Target} />
                <ScoreCard label="Retention Predict" value={result?.retention_score} color="emerald" Icon={TrendingUp} delay="delay-150" />
                <ScoreCard label="Viral Potential" value={result?.viral_score} color="orange" Icon={Zap} delay="delay-300" />
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[2px] rounded-2xl z-10 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 relative">
                      <div className="absolute inset-0 rounded-full border-[3px] border-slate-200"></div>
                      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-pink-500 animate-spin"></div>
                    </div>
                    {statusLabel && <p className="text-sm font-bold text-slate-600">{statusLabel}</p>}
                  </div>
                )}
              </div>

              <div className={`border-2 p-6 rounded-2xl transition-all duration-500 flex flex-col ${result ? 'bg-white border-pink-100 shadow-sm' : 'bg-transparent border-slate-200/60 border-dashed flex-1'}`}>
                <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 transition-colors ${result ? 'text-slate-900' : 'text-slate-400'}`}>
                  <BrainCircuit className={`w-5 h-5 ${result ? 'text-pink-500' : 'text-slate-400'}`} /> Detailed Feedback
                </h4>
                {isLoading ? (
                  <div className="flex-1 flex flex-col space-y-3 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded-md w-full"></div>
                    <div className="h-4 bg-slate-200 rounded-md w-5/6"></div>
                  </div>
                ) : result ? (
                  <p className="text-slate-700 leading-relaxed text-lg font-medium">{result.feedback}</p>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3"><Sparkles className="w-6 h-6 text-slate-300" /></div>
                    <p className="text-slate-400 font-medium max-w-[250px]">
                      {mode === 'idea' ? 'Paste your script and click analyze to get scores, hashtags & timing.' : 'Upload a video and click analyze to transcribe and build your report.'}
                    </p>
                  </div>
                )}
              </div>

              {result && hasHashtags(result.hashtags) && <HashtagsCard hashtags={result.hashtags!} />}
              {result && hasTimes(result.best_times) && <BestTimesCard times={result.best_times!} />}

              {result?.transcript && (
                <div className="mt-4 bg-white border-2 border-slate-100 p-6 rounded-2xl">
                  <h4 className="text-lg font-bold mb-3 flex items-center gap-2 text-slate-900"><FileText className="w-5 h-5 text-pink-500" /> Transcript</h4>
                  <p className="text-slate-600 leading-relaxed text-sm font-medium whitespace-pre-wrap">{result.transcript}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}

function SubmitButton({ isLoading, disabled, label, statusLabel }: { isLoading: boolean; disabled: boolean; label: string; statusLabel: string }) {
  return (
    <button type="submit" disabled={isLoading || disabled}
      className="w-full relative overflow-hidden bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-3.5 px-8 rounded-xl shadow-[0_8px_20px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.4)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-lg mt-5 group cursor-pointer">
      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
      {isLoading ? (
        <div className="flex items-center gap-2 relative z-10"><span className="tracking-wide">{statusLabel || 'Analyzing'}</span>
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1.5 h-4 bg-white rounded-full animate-pulse"></div>
            <div className="w-1.5 h-6 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 relative z-10"><Sparkles className="w-5 h-5 text-white/90" /><span>{label}</span></div>
      )}
    </button>
  );
}

function ScoreCard({ label, value, color, Icon, delay = '' }: { label: string; value?: number; color: 'pink' | 'emerald' | 'orange'; Icon: any; delay?: string }) {
  const has = value !== undefined && value !== null;
  const border = { pink: 'border-pink-200', emerald: 'border-emerald-200', orange: 'border-orange-200' }[color];
  const bar = { pink: 'bg-pink-500', emerald: 'bg-emerald-500', orange: 'bg-orange-500' }[color];
  return (
    <div className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden ${has ? `bg-white ${border} shadow-sm` : 'bg-slate-100/50 border-slate-200/60'}`}>
      <div className="absolute top-0 right-0 p-3 opacity-[0.03]"><Icon className="w-16 h-16" /></div>
      <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-black transition-colors ${has ? 'text-slate-900' : 'text-slate-300'}`}>{has ? value : '--'}</span>
        <span className={`font-bold transition-colors ${has ? 'text-slate-400' : 'text-slate-300'}`}>/100</span>
      </div>
      <div className="mt-3 w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all duration-1000 ${delay} ease-out ${has ? bar : 'bg-transparent'}`} style={{ width: `${has ? value : 0}%` }}></div>
      </div>
    </div>
  );
}

function TagGroup({ title, tags }: { title: string; tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="text-xs font-bold text-pink-700 bg-pink-100/80 border border-pink-200 px-2 py-0.5 rounded-md">{t}</span>
        ))}
      </div>
    </div>
  );
}

function HashtagsCard({ hashtags }: { hashtags: Hashtags }) {
  const [copied, setCopied] = useState(false);
  const all = [...(hashtags.primary || []), ...(hashtags.niche || []), ...(hashtags.broad || [])];
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(all.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="mt-4 bg-white border-2 border-slate-100 p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold flex items-center gap-2 text-slate-900"><Hash className="w-5 h-5 text-pink-500" /> Best Hashtags</h4>
        <button onClick={copyAll} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
          {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
        </button>
      </div>
      <TagGroup title="Primary" tags={hashtags.primary} />
      <TagGroup title="Niche" tags={hashtags.niche} />
      <TagGroup title="Broad reach" tags={hashtags.broad} />
    </div>
  );
}

function BestTimesCard({ times }: { times: BestTimes }) {
  return (
    <div className="mt-4 bg-white border-2 border-slate-100 p-6 rounded-2xl">
      <h4 className="text-lg font-bold mb-2 flex items-center gap-2 text-slate-900"><Clock className="w-5 h-5 text-pink-500" /> Best Time to Post</h4>
      {times.summary && <p className="text-slate-600 font-medium text-sm leading-relaxed mb-4">{times.summary}</p>}
      <div className="space-y-2">
        {(times.slots || []).map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 text-white text-xs font-black flex items-center justify-center">{i + 1}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{[s.day, s.time].filter(Boolean).join(' · ')}</p>
              {s.why && <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{s.why}</p>}
            </div>
          </div>
        ))}
      </div>
      {times.timezone_note && <p className="text-xs text-slate-400 font-medium mt-3 italic">{times.timezone_note}</p>}
    </div>
  );
}
