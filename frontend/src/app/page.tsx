import Link from 'next/link';
import {
  Play, Sparkles, Target, TrendingUp, Zap, Check, ArrowRight, Upload,
  BrainCircuit, Clock, Hash, Star, PenLine, Megaphone, Wand2,
} from 'lucide-react';

export const metadata = {
  title: 'Hyperyzer — Score your video, get the best hashtags & best time to post',
  description:
    "AI scores your video's hook, retention, and viral potential, then hands you the best hashtags and the best time to post — in seconds. Free to start.",
};

const STEPS = [
  { icon: Upload, title: 'Paste or upload', body: 'Drop in your title + hook, or upload the actual clip — we transcribe it automatically.' },
  { icon: BrainCircuit, title: 'AI builds your report', body: 'Hook, retention & viral scores (0–100), the exact fixes, the best hashtags, and your best time to post.' },
  { icon: TrendingUp, title: 'Post & grow', body: 'Apply the feedback, copy the hashtags, post at the right time, and publish the version that actually performs.' },
];

const FEATURES = [
  { icon: Target, title: 'Hook strength', body: 'Find out if your first 5 seconds create a real curiosity gap — the make-or-break moment.' },
  { icon: TrendingUp, title: 'Retention prediction', body: 'See where pacing will lose viewers before the algorithm ever does.' },
  { icon: Zap, title: 'Viral potential', body: 'Gauge how broad and shareable your premise really is.' },
  { icon: Hash, title: 'Best hashtags', body: 'Get a tuned mix of primary, niche, and broad-reach hashtags for your exact video and platform.' },
  { icon: Clock, title: 'Best time to post', body: 'Ranked posting windows for your audience and platform — so you drop when your viewers are actually online.' },
  { icon: Play, title: 'Real video analysis', body: 'Upload a clip — we extract the audio, transcribe it, and score the hook you actually said.' },
];

const STUDIO_TOOLS = [
  { icon: PenLine, title: 'AI Script Writer', body: 'Go from a one-line idea to a full, ready-to-film short-form script — hook, beats, CTA and caption.' },
  { icon: Megaphone, title: 'Ad & product scripts', body: 'Turn any product into a native, direct-response UGC ad script built to convert.' },
  { icon: Zap, title: 'Hook generator', body: '10–15 scroll-stopping hook variations for any topic, each with why it works.' },
  { icon: Wand2, title: 'One-Click Optimize', body: 'Rewrite a weak script and instantly re-score it — watch the hook, retention and viral scores climb.' },
];

const PRICING = [
  {
    name: 'Free', price: '€0', per: 'to get started', cta: 'Start free', highlight: false,
    points: ['10 starter credits', 'Or bring your own OpenAI key — unlimited', 'Full report: scores, hashtags & timing'],
  },
  {
    name: 'Creator', price: '€14', per: '/mo', cta: 'Choose Creator', highlight: false,
    points: ['150 credits / month', 'Idea = 1 credit · video = 5', 'Saved history & comparisons'],
  },
  {
    name: 'Pro', price: '€39', per: '/mo', cta: 'Go Pro', highlight: true,
    points: ['800 credits / month', '✨ Studio: scripts, ad scripts & hooks', 'One-Click Optimize · priority processing'],
  },
  {
    name: 'Agency', price: '€99', per: '/mo', cta: 'Choose Agency', highlight: false,
    points: ['3,000 credits / month', 'Client profiles, bulk & content calendar', 'Team seats — share one credit pool'],
  },
];

const FAQ = [
  { q: 'What do I actually get back?', a: 'A full report: hook, retention and viral scores (0–100), harsh actionable feedback, the best hashtags to use (primary, niche and broad), and the best times to post for your platform and audience.' },
  { q: 'Does it analyze real videos or just text?', a: 'Both. Test an idea by pasting a title + hook, or upload an actual clip — we transcribe the audio and analyze the real hook you delivered.' },
  { q: 'Can it write scripts, not just score them?', a: 'Yes — on Pro and Agency. The Studio generates full short-form scripts from an idea, direct-response ad scripts, batches of hooks, and rewrites your script to maximize its scores. Agency adds a content calendar, client brand profiles, bulk analysis, and team seats. Output works in your language too.' },
  { q: 'How do credits work?', a: 'An idea report costs 1 credit and a video report costs 5 (it includes transcription). Free accounts get 10 starter credits; subscriptions refill a monthly bucket; or top up anytime with a credit pack.' },
  { q: 'Do I need an account?', a: 'You can use it free with no account by bringing your own OpenAI key. A free account gives you 10 starter credits and saved history — then subscribe or buy a credit pack whenever you want.' },
  { q: 'What platforms is it for?', a: 'Anything short-form-first: YouTube, TikTok, Instagram Reels, and Shorts. The hook, hashtag, and timing advice adapts to the platform you pick.' },
  { q: 'Are the hashtags and posting times guaranteed?', a: 'They’re AI-generated, platform-tuned recommendations — strong starting points, not guarantees of views. Always sanity-check against your own analytics.' },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
        <Play className="w-4.5 h-4.5 text-white fill-white ml-0.5" />
      </div>
      <span className="text-lg font-bold text-slate-900 tracking-tight">Hyperyzer</span>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative z-10 text-slate-900">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">Log in</Link>
          <Link href="/signup" className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm">Start free</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 border border-black/5 shadow-sm text-xs font-bold text-slate-600 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-pink-500" /> AI growth toolkit for creators
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] text-slate-900">
          Make every video hit —<br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent"> before you post it.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Hyperyzer scores your hook, retention, and viral potential, then hands you the
          best hashtags and the best time to post — in seconds, with the exact fixes to get more views.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-pink-500 to-orange-500 shadow-[0_10px_30px_rgba(236,72,153,0.3)] hover:shadow-[0_10px_35px_rgba(236,72,153,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            Analyze my video free <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/app" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-lg font-bold text-slate-700 bg-white/80 border border-black/5 hover:border-pink-300 transition-colors">
            Try it now
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500 font-medium flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-500" /> No credit card · 10 free credits to start
        </p>

        {/* Report preview */}
        <div className="mt-14 max-w-3xl mx-auto bg-white/80 backdrop-blur-xl rounded-3xl border border-black/5 shadow-xl p-6 sm:p-8 text-left">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <p className="font-bold text-slate-800 truncate pr-3">&ldquo;I Survived 100 Days in Hardcore Minecraft&rdquo;</p>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-lg border border-pink-200"><Sparkles className="w-3 h-3" /> AI</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[{ l: 'Hook', v: 88, c: 'pink' }, { l: 'Retention', v: 74, c: 'emerald' }, { l: 'Viral', v: 91, c: 'orange' }].map((s) => (
              <div key={s.l} className="bg-slate-50/80 rounded-2xl p-4 border border-black/5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.l}</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{s.v}<span className="text-base text-slate-400">/100</span></p>
                <div className="mt-2 h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.c === 'pink' ? 'bg-pink-500' : s.c === 'emerald' ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${s.v}%` }} />
                </div>
              </div>
            ))}
          </div>
          {/* Hashtags + best time teaser */}
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-black/5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Hash className="w-3 h-3" /> Best hashtags</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['#minecraft', '#hardcore', '#100days', '#gaming', '#fyp'].map((t) => (
                  <span key={t} className="text-xs font-bold text-pink-700 bg-pink-100/80 border border-pink-200 px-2 py-0.5 rounded-md">{t}</span>
                ))}
              </div>
            </div>
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-black/5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3 h-3" /> Best time to post</p>
              <p className="text-sm font-bold text-slate-800 mt-2">Tue & Thu, 6–9 PM</p>
              <p className="text-xs text-slate-500 font-medium">When your audience is most active (ET).</p>
            </div>
          </div>
          <p className="mt-5 text-slate-600 font-medium leading-relaxed text-sm sm:text-base">
            <span className="font-bold text-slate-800">Feedback:</span> Strong curiosity gap and high stakes.
            Cut the first two sentences so the &ldquo;delete the channel&rdquo; threat lands in the first 5 seconds.
          </p>
        </div>
      </section>

      {/* Problem / solution */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-14 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Your hook, hashtags, and timing decide everything.</h2>
        <p className="mt-4 text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Most videos don&apos;t fail on editing — they fail in the first 5 seconds, with the wrong tags,
          posted at the wrong time. You only find out <em>after</em> you&apos;ve spent hours filming.
          Hyperyzer tells you <span className="font-bold text-slate-800">before</span> you hit post.
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <p className="text-center text-xs font-bold text-pink-500 uppercase tracking-widest mb-3">How it works</p>
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-12">Three steps to a better video</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.title} className="bg-white/80 backdrop-blur-xl rounded-3xl border border-black/5 shadow-sm p-7 relative">
              <div className="absolute -top-3 -left-1 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-black flex items-center justify-center shadow-md">{i + 1}</div>
              <s.icon className="w-8 h-8 text-pink-500 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-slate-600 font-medium leading-relaxed text-sm">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-12">Everything you need to grow</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-black/5 shadow-sm p-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/10 to-orange-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-pink-500" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-slate-600 font-medium text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Studio (creation tools) */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <p className="text-center text-xs font-bold text-pink-500 uppercase tracking-widest mb-3">Pro &amp; Agency · The Studio</p>
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Don&apos;t just score it — create it</h2>
        <p className="text-center text-slate-600 font-medium max-w-2xl mx-auto mb-12 leading-relaxed">
          Hyperyzer isn&apos;t only a grader. The Studio is your AI scriptwriting team: go from a raw idea to a
          ready-to-film script, a converting ad, or a month of content — then optimize it until the scores are green.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STUDIO_TOOLS.map((f) => (
            <div key={f.title} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-black/5 shadow-sm p-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/10 to-orange-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-pink-500" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-slate-600 font-medium text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-500 font-medium text-sm mt-8">
          Agency adds <span className="font-bold text-slate-700">client brand profiles</span>, <span className="font-bold text-slate-700">bulk analysis</span>, a <span className="font-bold text-slate-700">content calendar</span>, and <span className="font-bold text-slate-700">team seats</span> — plus output in <span className="font-bold text-slate-700">any language</span>.
        </p>
        <div className="text-center mt-7">
          <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold text-white bg-gradient-to-r from-pink-500 to-orange-500 shadow-[0_8px_24px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            Unlock the Studio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Simple, scalable pricing</h2>
        <p className="text-center text-slate-600 font-medium mb-12">Start free. Upgrade only when it&apos;s paying off.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {PRICING.map((p) => (
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
              <Link href="/signup" className={`mt-7 text-center py-3 rounded-xl font-bold transition-colors ${p.highlight ? 'bg-white text-pink-600 hover:bg-pink-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 font-medium mt-6">
          No subscription? Buy pay-as-you-go credit packs instead — <span className="font-bold text-slate-700">50 credits for €9</span> or <span className="font-bold text-slate-700">200 for €29</span>. Pack credits never expire.
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-10">Questions, answered</h2>
        <div className="space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-black/5 p-6">
              <h3 className="font-bold text-slate-900 mb-2 flex items-start gap-2"><span className="text-pink-500">Q.</span>{f.q}</h3>
              <p className="text-slate-600 font-medium text-sm leading-relaxed pl-6">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-16 text-center">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-black/5 shadow-xl p-10 sm:p-14">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Stop guessing. Start scoring.</h2>
          <p className="mt-4 text-lg text-slate-600 font-medium max-w-xl mx-auto">Get your scores, hashtags, and best time to post — in the next 60 seconds.</p>
          <Link href="/signup" className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-pink-500 to-orange-500 shadow-[0_10px_30px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            Analyze my video free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-10 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <p className="text-sm text-slate-500 font-medium">© {new Date().getFullYear()} Hyperyzer · AI growth toolkit for creators</p>
        <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-600">
          <Link href="/app" className="hover:text-slate-900">Open app</Link>
          <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          <Link href="/refund" className="hover:text-slate-900">Refund</Link>
        </div>
      </footer>
    </div>
  );
}
