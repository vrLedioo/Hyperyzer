import Link from 'next/link';
import {
  Play, Sparkles, Target, TrendingUp, Zap, Check, ArrowRight, Upload,
  BrainCircuit, Clock, KeyRound, History, Star,
} from 'lucide-react';

export const metadata = {
  title: 'VidAnalyzer — Score your video hook before you post',
  description:
    "AI scores your video's hook strength, retention, and viral potential in seconds — with the exact fixes to get more views. Free to start.",
};

const STEPS = [
  { icon: Upload, title: 'Paste or upload', body: 'Drop in your title + hook, or upload the actual clip — we transcribe it automatically.' },
  { icon: BrainCircuit, title: 'AI scores it', body: 'Get Hook, Retention, and Viral scores (0–100) in seconds, judged like a real retention strategist.' },
  { icon: TrendingUp, title: 'Fix & post', body: 'Apply the specific, no-fluff feedback and publish the version that actually performs.' },
];

const FEATURES = [
  { icon: Target, title: 'Hook strength', body: 'Find out if your first 5 seconds create a real curiosity gap — the make-or-break moment.' },
  { icon: TrendingUp, title: 'Retention prediction', body: 'See where pacing will lose viewers before the algorithm ever does.' },
  { icon: Zap, title: 'Viral potential', body: 'Gauge how broad and shareable your premise really is.' },
  { icon: Play, title: 'Real video analysis', body: 'Upload a clip — we extract the audio, transcribe it, and score the hook you actually said.' },
  { icon: History, title: 'Saved history', body: 'Every analysis is saved so you can compare ideas and track what works.' },
  { icon: KeyRound, title: 'Bring your own key', body: 'Prefer to run on your own OpenAI key? Do it — unlimited, on us.' },
];

const FAQ = [
  { q: 'Does it analyze real videos or just text?', a: 'Both. Test an idea by pasting a title + hook, or upload an actual clip — we transcribe the audio and score the real hook you delivered.' },
  { q: 'Do I need an account?', a: 'You can use it free with no account by bringing your own OpenAI key. A free account gives you 3 starter credits and saved history — then top up a credit pack or go unlimited with Pro whenever you want.' },
  { q: 'How fast is it?', a: 'Idea scoring takes a few seconds. Video analysis runs transcription then scoring and is usually done well under a minute.' },
  { q: 'What platforms is it for?', a: 'Anything short-form-first: YouTube, TikTok, Instagram Reels, and Shorts. The hook principles are universal.' },
  { q: 'Is my data private?', a: 'Your analyses are tied to your account and only visible to you. Uploaded videos are deleted after processing.' },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
        <Play className="w-4.5 h-4.5 text-white fill-white ml-0.5" />
      </div>
      <span className="text-lg font-bold text-slate-900 tracking-tight">VidAnalyzer</span>
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
          <Sparkles className="w-3.5 h-3.5 text-pink-500" /> AI hook scoring for creators
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] text-slate-900">
          Know if your video will pop —<br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent"> before you post it.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Paste your hook or upload your clip. VidAnalyzer&apos;s AI scores its hook strength, retention,
          and viral potential in seconds — with the exact tweaks to get more views.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-pink-500 to-orange-500 shadow-[0_10px_30px_rgba(236,72,153,0.3)] hover:shadow-[0_10px_35px_rgba(236,72,153,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            Score my video free <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/app" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-lg font-bold text-slate-700 bg-white/80 border border-black/5 hover:border-pink-300 transition-colors">
            Try it now
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500 font-medium flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-500" /> No credit card · 3 free analyses · or pay $0.99 per use
        </p>

        {/* Score preview */}
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
          <p className="mt-5 text-slate-600 font-medium leading-relaxed text-sm sm:text-base">
            <span className="font-bold text-slate-800">Feedback:</span> Strong curiosity gap and high stakes.
            Cut the first two sentences so the &ldquo;delete the channel&rdquo; threat lands in the first 5 seconds.
          </p>
        </div>
      </section>

      {/* Problem / solution */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-14 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Your hook decides everything.</h2>
        <p className="mt-4 text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Most videos don&apos;t fail because of editing or lighting — they fail in the first 5 seconds.
          You only find out <em>after</em> you&apos;ve spent hours filming. VidAnalyzer tells you{' '}
          <span className="font-bold text-slate-800">before</span> you hit record.
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <p className="text-center text-xs font-bold text-pink-500 uppercase tracking-widest mb-3">How it works</p>
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-12">Three steps to a better hook</h2>
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
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-12">Everything you need to nail the hook</h2>
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

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Simple pricing</h2>
        <p className="text-center text-slate-600 font-medium mb-12">Start free. Upgrade only when it&apos;s paying off.</p>
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {/* Free */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-black/5 shadow-sm p-7 flex flex-col">
            <h3 className="font-bold text-slate-900 text-lg">Free</h3>
            <p className="mt-2 text-4xl font-black">$0</p>
            <p className="text-sm text-slate-500 font-medium mt-1">to get started</p>
            <ul className="mt-6 space-y-3 text-sm font-medium text-slate-700 flex-1">
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> 3 free credits (idea = 1, video = 3)</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Or bring your own OpenAI key — unlimited</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Hook, retention & viral scores</li>
            </ul>
            <Link href="/signup" className="mt-7 text-center py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors">Start free</Link>
          </div>
          {/* Credit pack */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-black/5 shadow-sm p-7 flex flex-col">
            <h3 className="font-bold text-slate-900 text-lg">Credit pack</h3>
            <p className="mt-2 text-4xl font-black">Top up</p>
            <p className="text-sm text-slate-500 font-medium mt-1">pay as you go</p>
            <ul className="mt-6 space-y-3 text-sm font-medium text-slate-700 flex-1">
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Buy a bundle of credits, no subscription</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Idea = 1 credit · video = 3</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Credits never expire</li>
            </ul>
            <Link href="/signup" className="mt-7 text-center py-3 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors">Buy credits</Link>
          </div>
          {/* Pro */}
          <div className="relative bg-gradient-to-b from-pink-500 to-orange-500 rounded-3xl shadow-xl p-7 flex flex-col text-white">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-pink-600 text-xs font-black shadow flex items-center gap-1"><Star className="w-3 h-3 fill-pink-600" /> MOST POPULAR</div>
            <h3 className="font-bold text-lg">Pro</h3>
            <p className="mt-2 text-4xl font-black">$9<span className="text-lg font-bold opacity-80">/mo</span></p>
            <p className="text-sm opacity-90 font-medium mt-1">for serious creators</p>
            <ul className="mt-6 space-y-3 text-sm font-semibold flex-1">
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 shrink-0" /> Unlimited analyses</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 shrink-0" /> Idea + full video analysis</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 shrink-0" /> Saved history & comparisons</li>
              <li className="flex gap-2"><Check className="w-4.5 h-4.5 shrink-0" /> Priority processing</li>
            </ul>
            <Link href="/signup" className="mt-7 text-center py-3 rounded-xl font-bold bg-white text-pink-600 hover:bg-pink-50 transition-colors">Go Pro</Link>
          </div>
        </div>
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
          <p className="mt-4 text-lg text-slate-600 font-medium max-w-xl mx-auto">Find out if your next video has what it takes — in the next 60 seconds.</p>
          <Link href="/signup" className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-pink-500 to-orange-500 shadow-[0_10px_30px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            Analyze my hook free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-10 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <p className="text-sm text-slate-500 font-medium">© {new Date().getFullYear()} VidAnalyzer · AI feedback for creators</p>
        <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-600">
          <Link href="/app" className="hover:text-slate-900">Open app</Link>
          <Link href="/login" className="hover:text-slate-900">Log in</Link>
          <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-900">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
