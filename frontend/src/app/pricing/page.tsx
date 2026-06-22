import Link from 'next/link';
import { Play, Check, Star } from 'lucide-react';

export const metadata = {
  title: 'Pricing — Hyperyzer',
  description: 'Hyperyzer plans and credit packs. Score your video, get the best hashtags and the best time to post.',
};

const PLANS = [
  {
    name: 'Free', price: '€0', per: 'to get started', highlight: false,
    points: ['10 starter credits', 'Or bring your own OpenAI key — unlimited', 'Full report: scores, hashtags & timing'],
  },
  {
    name: 'Creator', price: '€14', per: '/mo', highlight: false,
    points: ['150 credits / month', 'Idea = 1 credit · video = 5', 'Saved history & comparisons'],
  },
  {
    name: 'Pro', price: '€39', per: '/mo', highlight: true,
    points: [
      '800 credits / month',
      '✨ Studio: AI Script Writer',
      '✨ Ad / product script writer',
      '✨ Hook generator + One-Click Optimize',
      'Priority processing · everything in Creator',
    ],
  },
  {
    name: 'Agency', price: '€99', per: '/mo', highlight: false,
    points: [
      '3,000 credits / month',
      'Everything in Pro, plus:',
      'Client / brand profiles + bulk analyze',
      'Content calendar + white-label export',
      'Team seats — share one credit pool',
    ],
  },
];

const PACKS = [
  { name: 'Starter pack', price: '€9', credits: '50 credits' },
  { name: 'Value pack', price: '€29', credits: '200 credits' },
];

export default function Pricing() {
  return (
    <div className="relative z-10 text-slate-900 max-w-6xl mx-auto px-5 sm:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
        <span className="text-lg font-bold tracking-tight">Hyperyzer</span>
      </Link>

      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Pricing</h1>
      <p className="mt-3 text-slate-600 font-medium max-w-2xl">
        Every analysis returns a full report — hook / retention / viral scores, the best hashtags, and
        the best time to post. An idea report costs <strong>1 credit</strong>; a video report costs
        <strong> 5</strong> (it includes transcription). Start free, upgrade only when it&apos;s paying off.
      </p>
      <p className="mt-3 text-slate-600 font-medium max-w-2xl">
        <strong>Pro & Agency unlock the Studio</strong> — don&apos;t just score your ideas, generate them: full
        scripts from a topic, direct-response ad scripts, scroll-stopping hooks, and one-click rewrites that
        boost your scores. Agency adds client profiles, bulk analysis, a content calendar and team seats.
      </p>

      {/* Plans */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch mt-10">
        {PLANS.map((p) => (
          <div key={p.name} className={`relative rounded-3xl p-7 flex flex-col shadow-sm ${p.highlight ? 'bg-gradient-to-b from-pink-500 to-orange-500 text-white shadow-xl' : 'bg-white/80 backdrop-blur-xl border border-black/5'}`}>
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-pink-600 text-xs font-black shadow flex items-center gap-1"><Star className="w-3 h-3 fill-pink-600" /> MOST POPULAR</div>
            )}
            <h3 className={`font-bold text-lg ${p.highlight ? '' : 'text-slate-900'}`}>{p.name}</h3>
            <p className="mt-2 text-4xl font-black">{p.price}<span className={`text-lg font-bold ${p.highlight ? 'opacity-80' : 'text-slate-400'}`}>{p.per.startsWith('/') ? p.per : ''}</span></p>
            {!p.per.startsWith('/') && <p className={`text-sm font-medium mt-1 ${p.highlight ? 'opacity-90' : 'text-slate-500'}`}>{p.per}</p>}
            <ul className={`mt-6 space-y-3 text-sm flex-1 ${p.highlight ? 'font-semibold' : 'font-medium text-slate-700'}`}>
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-2"><Check className={`w-4.5 h-4.5 shrink-0 ${p.highlight ? '' : 'text-emerald-500'}`} /> {pt}</li>
              ))}
            </ul>
            <Link href="/signup" className={`mt-7 text-center py-3 rounded-xl font-bold transition-colors ${p.highlight ? 'bg-white text-pink-600 hover:bg-pink-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>Get started</Link>
          </div>
        ))}
      </div>

      {/* Packs */}
      <h2 className="text-2xl font-extrabold tracking-tight mt-14">Pay-as-you-go credit packs</h2>
      <p className="mt-2 text-slate-600 font-medium">No subscription needed. Pack credits never expire.</p>
      <div className="grid sm:grid-cols-2 gap-5 mt-6 max-w-2xl">
        {PACKS.map((p) => (
          <div key={p.name} className="bg-white/80 backdrop-blur-xl rounded-3xl border border-black/5 shadow-sm p-7 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
              <p className="text-slate-500 font-medium text-sm mt-1">{p.credits}</p>
            </div>
            <p className="text-3xl font-black">{p.price}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500 font-medium mt-8">
        Payments are processed by Paddle (our Merchant of Record), which handles billing and taxes.
        See our <Link href="/refund" className="text-pink-600 underline">Refund Policy</Link>.
      </p>

      <div className="mt-12 pt-6 border-t border-black/5 text-sm font-bold text-slate-500 flex flex-wrap gap-4">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <Link href="/refund" className="hover:text-slate-900">Refund</Link>
        <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
        <Link href="/terms" className="hover:text-slate-900">Terms</Link>
      </div>
    </div>
  );
}
