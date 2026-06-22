'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Play, Sparkles, PenLine, Megaphone, Zap, Wand2, CalendarDays, Layers,
  Users, Briefcase, Lock, AlertCircle, ArrowLeft, Printer, Loader2, Trash2, Plus,
  Copy, Check,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const PLATFORMS = [
  { value: '', label: 'Auto-detect platform' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Instagram Reels', label: 'Instagram Reels' },
  { value: 'YouTube Shorts', label: 'YouTube Shorts' },
  { value: 'YouTube (long-form)', label: 'YouTube (long-form)' },
];

const LANGUAGES = [
  { value: '', label: 'Match input' },
  { value: 'English', label: 'English' },
  { value: 'Albanian', label: 'Shqip' },
  { value: 'Spanish', label: 'Español' },
  { value: 'Portuguese', label: 'Português' },
  { value: 'French', label: 'Français' },
  { value: 'German', label: 'Deutsch' },
  { value: 'Italian', label: 'Italiano' },
  { value: 'Turkish', label: 'Türkçe' },
  { value: 'Arabic', label: 'العربية' },
  { value: 'Hindi', label: 'हिन्दी' },
  { value: 'Indonesian', label: 'Bahasa Indonesia' },
];

// Per-tool accent — gives the rail + header colour variety instead of one
// monotone gradient everywhere. Class strings are literal so Tailwind keeps them.
const ACCENTS: Record<string, { text: string; bg: string }> = {
  script: { text: 'text-pink-600', bg: 'bg-pink-100' },
  ad_script: { text: 'text-orange-600', bg: 'bg-orange-100' },
  hooks: { text: 'text-violet-600', bg: 'bg-violet-100' },
  optimize: { text: 'text-emerald-600', bg: 'bg-emerald-100' },
  calendar: { text: 'text-sky-600', bg: 'bg-sky-100' },
  bulk: { text: 'text-amber-600', bg: 'bg-amber-100' },
  clients: { text: 'text-teal-600', bg: 'bg-teal-100' },
  teams: { text: 'text-indigo-600', bg: 'bg-indigo-100' },
};

interface Tool {
  key: string;
  feature: string;
  label: string;
  blurb: string;
  icon: any;
  tier: 'Pro' | 'Agency';
}

const TOOLS: Tool[] = [
  { key: 'script', feature: 'script', label: 'Script Writer', blurb: 'Turn an idea into a full short-form script.', icon: PenLine, tier: 'Pro' },
  { key: 'ad_script', feature: 'ad_script', label: 'Ad Script', blurb: 'Direct-response ad script for a product.', icon: Megaphone, tier: 'Pro' },
  { key: 'hooks', feature: 'hooks', label: 'Hook Generator', blurb: '10-15 scroll-stopping hooks for a topic.', icon: Zap, tier: 'Pro' },
  { key: 'optimize', feature: 'optimize', label: 'One-Click Optimize', blurb: 'Rewrite a script and re-score it.', icon: Wand2, tier: 'Pro' },
  { key: 'calendar', feature: 'calendar', label: 'Content Calendar', blurb: 'A week/month of ideas + hooks.', icon: CalendarDays, tier: 'Agency' },
  { key: 'bulk', feature: 'bulk', label: 'Bulk Analyze', blurb: 'Score many ideas at once.', icon: Layers, tier: 'Agency' },
  { key: 'clients', feature: 'clients', label: 'Clients', blurb: 'Brand profiles for your accounts.', icon: Briefcase, tier: 'Agency' },
  { key: 'teams', feature: 'teams', label: 'Team', blurb: 'Invite members to share credits.', icon: Users, tier: 'Agency' },
];

type FormState = Record<string, string>;
const EMPTY_FORM: FormState = {
  idea: '', product: '', benefit: '', offer: '', topic: '', title: '', script: '',
  niche: '', days: '7', platform: '', audience: '', tone: '', language: '', clientId: '', bulkText: '',
};

interface Client { id: number; name: string; audience: string; niche: string; tone: string }
interface TeamMember { membership_id: number; email: string; role: string; status: string }
interface Team { team_id: number; name: string; role: string; owner_email: string; seat_limit: number; seats_used: number; members: TeamMember[] }

export default function StudioPage() {
  const { user, loading, refresh } = useAuth();
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [tool, setTool] = useState('script');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<Team | null>(null);

  const features = user?.studio_features || [];
  const unlocked = (f: string) => features.includes(f);
  const current = TOOLS.find((t) => t.key === tool)!;
  const accent = ACCENTS[tool] ?? ACCENTS.script;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api<{ studio_costs: Record<string, number> }>('/api/config', { auth: false })
      .then((c) => setCosts(c.studio_costs || {}))
      .catch(() => {});
  }, []);

  const loadClients = useCallback(async () => {
    if (!unlocked('clients')) return;
    try { setClients(await api<Client[]>('/api/studio/clients')); } catch { /* ignore */ }
  }, [features.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeam = useCallback(async () => {
    if (!unlocked('teams')) return;
    try { setTeam(await api<Team>('/api/team')); } catch { setTeam(null); }
  }, [features.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadClients(); loadTeam(); }, [loadClients, loadTeam]);

  const switchTool = (k: string) => { setTool(k); setResult(null); setError(''); };

  async function run() {
    setBusy(true); setError(''); setResult(null);
    const clientId = form.clientId ? Number(form.clientId) : undefined;
    const language = form.language || undefined;
    try {
      let res: any;
      if (tool === 'script') {
        res = await api('/api/studio/script', { method: 'POST', body: JSON.stringify({
          idea: form.idea, platform: form.platform || undefined, audience: form.audience || undefined,
          tone: form.tone || undefined, language, client_id: clientId }) });
      } else if (tool === 'ad_script') {
        res = await api('/api/studio/ad-script', { method: 'POST', body: JSON.stringify({
          product: form.product, benefit: form.benefit || undefined, offer: form.offer || undefined,
          platform: form.platform || undefined, audience: form.audience || undefined,
          tone: form.tone || undefined, language, client_id: clientId }) });
      } else if (tool === 'hooks') {
        res = await api('/api/studio/hooks', { method: 'POST', body: JSON.stringify({
          topic: form.topic, platform: form.platform || undefined,
          audience: form.audience || undefined, language, client_id: clientId }) });
      } else if (tool === 'optimize') {
        res = await api('/api/studio/optimize', { method: 'POST', body: JSON.stringify({
          title: form.title, script: form.script, platform: form.platform || undefined,
          audience: form.audience || undefined, language }) });
      } else if (tool === 'calendar') {
        res = await api('/api/studio/calendar', { method: 'POST', body: JSON.stringify({
          niche: form.niche, days: Number(form.days) || 7, platform: form.platform || undefined,
          audience: form.audience || undefined, language, client_id: clientId }) });
      } else if (tool === 'bulk') {
        const items = form.bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
          .map((line) => ({ title: line, script: line }));
        if (!items.length) throw new Error('Add at least one idea (one per line).');
        res = await api('/api/studio/bulk', { method: 'POST', body: JSON.stringify({
          items, platform: form.platform || undefined, audience: form.audience || undefined, language }) });
      }
      setResult(res?.output ?? res);
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  // ---- Clients management ----
  const [newClient, setNewClient] = useState({ name: '', audience: '', niche: '', tone: '' });
  async function createClient() {
    if (!newClient.name.trim()) return;
    try {
      await api('/api/studio/clients', { method: 'POST', body: JSON.stringify(newClient) });
      setNewClient({ name: '', audience: '', niche: '', tone: '' });
      await loadClients();
    } catch (e: any) { setError(e.message); }
  }
  async function deleteClient(id: number) {
    try { await api(`/api/studio/clients/${id}`, { method: 'DELETE' }); await loadClients(); }
    catch (e: any) { setError(e.message); }
  }

  // ---- Team management ----
  const [inviteEmail, setInviteEmail] = useState('');
  const [teamNotice, setTeamNotice] = useState('');
  async function invite() {
    if (!inviteEmail.trim()) return;
    setTeamNotice('');
    try {
      const t = await api<Team>('/api/team/invite', { method: 'POST', body: JSON.stringify({ email: inviteEmail }) });
      setTeam(t); setInviteEmail(''); setTeamNotice('Invite sent.');
    } catch (e: any) { setError(e.message); }
  }
  async function removeMember(id: number) {
    try { const t = await api<Team>(`/api/team/members/${id}`, { method: 'DELETE' }); setTeam(t); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center relative z-10"><Loader2 className="w-8 h-8 text-pink-500 animate-spin" /></div>;
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-black/5 shadow-xl p-8 text-center max-w-sm">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Studio</h1>
          <p className="text-slate-500 font-medium mb-5">Log in to use the creation tools.</p>
          <Link href="/login" className="inline-block bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10 text-slate-900 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/app" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md"><Play className="w-4 h-4 text-white fill-white ml-0.5" /></div>
          <span className="text-lg font-bold tracking-tight group-hover:text-pink-600 transition-colors">Hyperyzer Studio</span>
        </Link>
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <span className="px-3 py-1 rounded-lg bg-white/70 border border-black/5">{user.pool_credits ?? user.total_credits} credits</span>
          <Link href="/app" className="flex items-center gap-1 hover:text-pink-600"><ArrowLeft className="w-4 h-4" /> Analyzer</Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tool nav */}
        <aside className="lg:w-64 shrink-0 space-y-1.5 lg:sticky lg:top-6 self-start stagger">
          {TOOLS.map((t) => {
            const ok = unlocked(t.feature);
            const active = t.key === tool;
            const Icon = t.icon;
            const tAccent = ACCENTS[t.key] ?? ACCENTS.script;
            return (
              <button key={t.key} onClick={() => switchTool(t.key)}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-200 cursor-pointer ${active ? 'bg-white shadow-[0_6px_20px_rgba(15,23,42,0.07)]' : 'hover:bg-white/60'}`}>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${active ? tAccent.bg : 'bg-white/0 group-hover:bg-white/70'}`}>
                  <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${active ? tAccent.text : 'text-slate-400 group-hover:text-slate-600'}`} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm text-slate-800">{t.label}</span>
                  <span className="block text-[11px] text-slate-400 font-semibold">{t.tier}{costs[t.key] ? ` · ${costs[t.key]} cr` : ''}</span>
                </span>
                {!ok && <Lock className="w-3.5 h-3.5 text-slate-300" />}
              </button>
            );
          })}
        </aside>

        {/* Main panel */}
        <main className="flex-1 min-w-0">
          <div key={tool} className="glass-panel rounded-3xl p-6 md:p-8 animate-fade-in">
            <div className="flex items-center gap-3.5 mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accent.bg}`}>
                <current.icon className={`w-6 h-6 ${accent.text}`} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">{current.label}</h1>
                <p className="text-slate-500 font-medium text-sm">{current.blurb}</p>
              </div>
            </div>

            {!unlocked(current.feature) ? (
              <LockedNotice tool={current} />
            ) : (
              <>
                {error && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-red-800 text-sm font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                  </div>
                )}

                {tool === 'clients' ? (
                  <ClientsManager clients={clients} newClient={newClient} setNewClient={setNewClient} onCreate={createClient} onDelete={deleteClient} />
                ) : tool === 'teams' ? (
                  <TeamManager team={team} user={user} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
                    onInvite={invite} onRemove={removeMember} notice={teamNotice} />
                ) : (
                  <>
                    <ToolForm tool={tool} form={form} set={set} clients={clients} canClient={unlocked('clients')} />
                    <button onClick={run} disabled={busy}
                      className="glass-button mt-5 w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2 cursor-pointer">
                      {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating…</> : <><Sparkles className="w-5 h-5" /> Generate{costs[tool] ? ` · ${costs[tool]} credits` : ''}</>}
                    </button>
                    {result && <ResultView kind={tool} data={result} canPrint={unlocked('whitelabel_pdf')} />}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function LockedNotice({ tool }: { tool: Tool }) {
  return (
    <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
      <div className="w-12 h-12 rounded-full bg-slate-200/70 flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6 text-slate-400" /></div>
      <h3 className="text-lg font-bold text-slate-800">{tool.label} is a {tool.tier} feature</h3>
      <p className="text-slate-500 font-medium mt-1 max-w-sm mx-auto">
        Upgrade to {tool.tier} to unlock {tool.label.toLowerCase()} and the rest of the Studio.
      </p>
      <Link href="/pricing" className="inline-block mt-5 bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">
        See plans →
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-800 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl glass-input outline-none font-semibold text-slate-900';

function Targeting({ form, set, withTone, clients, canClient }: any) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-3">
      <Field label="Platform">
        <select value={form.platform} onChange={(e) => set('platform', e.target.value)} className={inputCls + ' cursor-pointer'}>
          {PLATFORMS.map((p) => <option key={p.label} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Audience (optional)">
        <input value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g. Gen Z gamers, US" className={inputCls} />
      </Field>
      <Field label="Output language">
        <select value={form.language} onChange={(e) => set('language', e.target.value)} className={inputCls + ' cursor-pointer'}>
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </Field>
      {withTone && (
        <Field label="Tone (optional)">
          <input value={form.tone} onChange={(e) => set('tone', e.target.value)} placeholder="e.g. punchy, expert" className={inputCls} />
        </Field>
      )}
      {canClient && clients.length > 0 && (
        <Field label="Brand profile (optional)">
          <select value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="">No profile</option>
            {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}

function ToolForm({ tool, form, set, clients, canClient }: any) {
  if (tool === 'script') return (<><Field label="Your video idea"><textarea value={form.idea} onChange={(e) => set('idea', e.target.value)} rows={4} placeholder="e.g. A day in the life of a solo SaaS founder in Kosovo" className={inputCls + ' resize-none'} /></Field><Targeting form={form} set={set} withTone clients={clients} canClient={canClient} /></>);
  if (tool === 'ad_script') return (<><Field label="Product"><input value={form.product} onChange={(e) => set('product', e.target.value)} placeholder="What are you advertising?" className={inputCls} /></Field><div className="grid sm:grid-cols-2 gap-3 mt-3"><Field label="Key benefit (optional)"><input value={form.benefit} onChange={(e) => set('benefit', e.target.value)} className={inputCls} /></Field><Field label="Offer / price (optional)"><input value={form.offer} onChange={(e) => set('offer', e.target.value)} className={inputCls} /></Field></div><Targeting form={form} set={set} withTone clients={clients} canClient={canClient} /></>);
  if (tool === 'hooks') return (<><Field label="Topic"><input value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="What's the video about?" className={inputCls} /></Field><Targeting form={form} set={set} clients={clients} canClient={canClient} /></>);
  if (tool === 'optimize') return (<><Field label="Title"><input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Current title" className={inputCls} /></Field><div className="mt-3"><Field label="Script / hook to improve"><textarea value={form.script} onChange={(e) => set('script', e.target.value)} rows={5} placeholder="Paste your current hook/script…" className={inputCls + ' resize-none'} /></Field></div><Targeting form={form} set={set} clients={clients} canClient={false} /></>);
  if (tool === 'calendar') return (<><div className="grid sm:grid-cols-3 gap-3"><div className="sm:col-span-2"><Field label="Niche"><input value={form.niche} onChange={(e) => set('niche', e.target.value)} placeholder="e.g. home fitness for busy parents" className={inputCls} /></Field></div><Field label="Days"><input type="number" min={1} max={30} value={form.days} onChange={(e) => set('days', e.target.value)} className={inputCls} /></Field></div><Targeting form={form} set={set} withTone clients={clients} canClient={canClient} /></>);
  if (tool === 'bulk') return (<><Field label="Ideas (one per line)"><textarea value={form.bulkText} onChange={(e) => set('bulkText', e.target.value)} rows={6} placeholder={'How I made $500 in a day\nWorst barber in Kosovo?\n…'} className={inputCls + ' resize-none'} /></Field><Targeting form={form} set={set} clients={clients} canClient={false} /></>);
  return null;
}

function Pill({ children }: { children: any }) {
  return <span className="text-xs font-bold text-pink-700 bg-pink-100/80 border border-pink-200 px-2 py-0.5 rounded-md">{children}</span>;
}

function resultToText(kind: string, d: any): string {
  if (kind === 'hooks') return (d.hooks || []).map((h: any, i: number) => `${i + 1}. ${h.text}`).join('\n');
  if (kind === 'optimize') return d.rewritten_script || '';
  if (kind === 'calendar') {
    return [d.summary, '', ...(d.posts || []).map((p: any) =>
      `${p.day} — ${p.idea}${p.hook ? `\n  Hook: ${p.hook}` : ''}${p.best_time ? `\n  Best time: ${p.best_time}` : ''}`)]
      .filter(Boolean).join('\n');
  }
  if (kind === 'bulk') {
    return (d.items || []).filter((it: any) => it.ok)
      .map((it: any) => `${it.title} — viral ${it.viral_score}, hook ${it.hook_score}, retention ${it.retention_score}`).join('\n');
  }
  // script / ad_script
  const L: string[] = [];
  if (d.title) L.push(d.title, '');
  if (d.hook) L.push(`HOOK: ${d.hook}`, '');
  (d.beats || []).forEach((b: any, i: number) => {
    L.push(`${b.label || `Beat ${i + 1}`}: ${b.say}`);
    if (b.visual) L.push(`  [visual: ${b.visual}]`);
  });
  if (d.cta) L.push('', `CTA: ${d.cta}`);
  if (d.caption) L.push('', `Caption: ${d.caption}`);
  if (d.hashtags?.length) L.push('', d.hashtags.join(' '));
  return L.join('\n');
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
      }}
      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors no-print">
      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> {label}</>}
    </button>
  );
}

function ResultView({ kind, data, canPrint }: { kind: string; data: any; canPrint: boolean }) {
  return (
    <div className="print-area mt-6 pt-6 border-t border-slate-200/60 animate-fade-in-up">
      {/* Only visible in the printed/exported PDF — a clean branded header. */}
      <div className="hidden print:block mb-5 pb-3 border-b border-slate-200">
        <p className="text-xl font-bold text-slate-900">Hyperyzer</p>
        <p className="text-xs text-slate-500 mt-0.5">Generated with Hyperyzer Studio</p>
      </div>
      <div className="flex items-center justify-between mb-4 no-print">
        <h3 className="text-lg font-extrabold flex items-center gap-2"><Sparkles className="w-5 h-5 text-pink-500" /> Result</h3>
        <div className="flex items-center gap-2">
          <CopyButton text={resultToText(kind, data)} />
          {canPrint && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Export PDF
            </button>
          )}
        </div>
      </div>

      {(kind === 'script' || kind === 'ad_script') && (
        <div className="space-y-4 stagger">
          {data.title && <p className="text-xl font-extrabold text-slate-900">{data.title}</p>}
          {data.angle && <p className="text-sm font-semibold text-slate-500">Angle: {data.angle}</p>}
          {data.hook && <div className="bg-pink-50 border border-pink-100 rounded-xl p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-pink-400 mb-1">Hook</p><p className="font-semibold text-slate-800">{data.hook}</p></div>}
          {(data.beats || []).map((b: any, i: number) => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{b.label || `Beat ${i + 1}`}</p>
              <p className="font-medium text-slate-800">{b.say}</p>
              {b.visual && <p className="text-xs text-slate-500 mt-1 italic">🎬 {b.visual}</p>}
            </div>
          ))}
          {data.cta && <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">CTA</p><p className="font-semibold text-slate-800">{data.cta}</p></div>}
          {data.caption && <p className="text-sm text-slate-600"><span className="font-bold">Caption: </span>{data.caption}</p>}
          {data.hashtags?.length > 0 && <div className="flex flex-wrap gap-1.5">{data.hashtags.map((h: string) => <Pill key={h}>{h}</Pill>)}</div>}
        </div>
      )}

      {kind === 'hooks' && (
        <ol className="space-y-2 stagger">
          {(data.hooks || []).map((h: any, i: number) => (
            <li key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="font-semibold text-slate-800">{i + 1}. {h.text}</p>
              {h.why && <p className="text-xs text-slate-500 mt-0.5">{h.why}</p>}
            </li>
          ))}
        </ol>
      )}

      {kind === 'optimize' && (
        <div className="space-y-4 stagger">
          <div className="grid grid-cols-2 gap-3">
            <ScoreBlock title="Before" s={data.before} muted />
            <ScoreBlock title="After" s={data.after} />
          </div>
          {data.rewritten_title && <p className="text-lg font-extrabold text-slate-900">{data.rewritten_title}</p>}
          {data.rewritten_script && <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 whitespace-pre-wrap text-slate-800 font-medium">{data.rewritten_script}</div>}
          {data.changes?.length > 0 && <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">{data.changes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>}
        </div>
      )}

      {kind === 'calendar' && (
        <div className="space-y-3 stagger">
          {data.summary && <p className="text-slate-600 font-medium">{data.summary}</p>}
          {(data.posts || []).map((p: any, i: number) => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between"><p className="font-bold text-slate-800">{p.day}</p>{p.best_time && <span className="text-xs font-semibold text-slate-500">{p.best_time}</span>}</div>
              <p className="text-slate-700 font-medium mt-1">{p.idea}</p>
              {p.hook && <p className="text-sm text-pink-700 mt-1">Hook: {p.hook}</p>}
              {p.format && <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wide">{p.format}</p>}
            </div>
          ))}
        </div>
      )}

      {kind === 'bulk' && (
        <div className="space-y-2 stagger">
          <p className="text-sm text-slate-500 font-semibold">Charged {data.charged_credits} credits for {data.succeeded} successful analyses.</p>
          {(data.items || []).map((it: any, i: number) => (
            <div key={i} className={`rounded-xl p-3 border ${it.ok ? 'bg-slate-50 border-slate-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800 truncate mr-3">{it.title}</p>
                {it.ok ? <span className="text-sm font-bold text-slate-700 shrink-0">🔥 {it.viral_score} viral</span> : <span className="text-xs font-bold text-red-600 shrink-0">failed</span>}
              </div>
              {it.ok && <p className="text-xs text-slate-500 mt-1">Hook {it.hook_score} · Retention {it.retention_score}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBlock({ title, s, muted }: { title: string; s: any; muted?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${muted ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-200'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</p>
      <div className="space-y-1 text-sm font-semibold text-slate-700">
        <p>Hook: {s?.hook_score ?? '—'}</p>
        <p>Retention: {s?.retention_score ?? '—'}</p>
        <p>Viral: {s?.viral_score ?? '—'}</p>
      </div>
    </div>
  );
}

function ClientsManager({ clients, newClient, setNewClient, onCreate, onDelete }: any) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name"><input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Client / brand name" className={inputCls} /></Field>
        <Field label="Audience"><input value={newClient.audience} onChange={(e) => setNewClient({ ...newClient, audience: e.target.value })} className={inputCls} /></Field>
        <Field label="Niche"><input value={newClient.niche} onChange={(e) => setNewClient({ ...newClient, niche: e.target.value })} className={inputCls} /></Field>
        <Field label="Tone"><input value={newClient.tone} onChange={(e) => setNewClient({ ...newClient, tone: e.target.value })} className={inputCls} /></Field>
      </div>
      <button onClick={onCreate} className="flex items-center gap-2 bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-slate-800 cursor-pointer"><Plus className="w-4 h-4" /> Add profile</button>
      <div className="space-y-2">
        {clients.length === 0 && <p className="text-slate-400 font-medium text-sm">No brand profiles yet.</p>}
        {clients.map((c: Client) => (
          <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="min-w-0"><p className="font-bold text-slate-800">{c.name}</p><p className="text-xs text-slate-500 truncate">{[c.audience, c.niche, c.tone].filter(Boolean).join(' · ')}</p></div>
            <button onClick={() => onDelete(c.id)} className="text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamManager({ team, user, inviteEmail, setInviteEmail, onInvite, onRemove, notice }: any) {
  const isOwner = !user.team_role || user.team_role === 'owner';
  return (
    <div className="space-y-5">
      {notice && <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-lg text-emerald-800 text-sm font-medium">{notice}</div>}
      {isOwner ? (
        <>
          <div className="flex gap-2">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@email.com" className={inputCls} />
            <button onClick={onInvite} className="bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold px-5 rounded-xl shrink-0 cursor-pointer">Invite</button>
          </div>
          {team && <p className="text-sm text-slate-500 font-semibold">{team.seats_used} / {team.seat_limit} seats used</p>}
          <div className="space-y-2">
            {(team?.members || []).map((m: TeamMember) => (
              <div key={m.membership_id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div><p className="font-semibold text-slate-800">{m.email}</p><p className="text-xs text-slate-400 font-semibold uppercase">{m.status}</p></div>
                <button onClick={() => onRemove(m.membership_id)} className="text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {(!team || team.members.length === 0) && <p className="text-slate-400 font-medium text-sm">No members yet. Invite your team to share this plan&apos;s credits.</p>}
          </div>
        </>
      ) : (
        <p className="text-slate-600 font-medium">You&apos;re a member of <strong>{team?.name || 'a team'}</strong> (owner: {team?.owner_email}). You share the team&apos;s credit pool.</p>
      )}
    </div>
  );
}
