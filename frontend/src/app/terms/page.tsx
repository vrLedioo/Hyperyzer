import Link from 'next/link';
import { Play } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — VidAnalyzer',
  description: 'The terms for using VidAnalyzer.',
};

export default function Terms() {
  return (
    <div className="relative z-10 text-slate-900 max-w-3xl mx-auto px-5 sm:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
        <span className="text-lg font-bold tracking-tight">VidAnalyzer</span>
      </Link>

      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <strong>Template notice:</strong> These terms are a good-faith starting point, not legal
        advice. Replace the bracketed details and have them reviewed by a qualified lawyer before
        relying on them for a live, paid service.
      </div>

      <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
      <p className="text-slate-500 font-medium mt-1">Last updated: June 2026</p>

      <div className="prose-sm mt-8 space-y-6 text-slate-700 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-2 [&_li]:ml-5 [&_li]:list-disc [&_a]:text-pink-600 [&_a]:underline">
        <p>
          These Terms govern your use of VidAnalyzer (the &ldquo;Service&rdquo;), operated by
          [your name / business], [country — e.g. Kosovo]. By using the Service you agree to these Terms.
        </p>

        <h2>The Service</h2>
        <p>
          VidAnalyzer uses AI to score video ideas and uploaded videos for hook strength, retention,
          and viral potential, and to give feedback. <strong>Scores and feedback are AI-generated
          estimates for guidance only — they are not predictions or guarantees of views, revenue, or
          performance.</strong>
        </p>

        <h2>Accounts</h2>
        <p>
          You are responsible for keeping your login secure and for activity under your account.
          Provide accurate information when registering.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Only upload content you own or have the right to use.</li>
          <li>Do not upload unlawful, infringing, or abusive content.</li>
          <li>Do not attempt to disrupt, overload, reverse-engineer, or abuse the Service.</li>
        </ul>

        <h2>Credits, plans &amp; payments</h2>
        <ul>
          <li>Free accounts receive a limited number of starter credits. An idea analysis costs 1
            credit; a video analysis costs more (it includes transcription).</li>
          <li>You can buy credit packs or subscribe to an unlimited plan. Subscriptions renew
            automatically until cancelled.</li>
          <li>Payments are processed by <strong>Lemon Squeezy</strong>, which acts as the Merchant of
            Record (seller) and handles applicable taxes. Their terms also apply to the transaction.</li>
          <li>If you use your own OpenAI key (&ldquo;BYOK&rdquo;), you are solely responsible for any
            costs your key incurs.</li>
        </ul>

        <h2>Refunds</h2>
        <p>
          Refunds are handled in line with Lemon Squeezy&rsquo;s policy and any statutory consumer
          rights that apply to you. Contact us for refund requests.
        </p>

        <h2>Intellectual property</h2>
        <p>
          You keep all rights to the content you submit and the videos you upload. We own the Service
          itself and its software. You grant us a limited licence to process your content solely to
          provide the Service.
        </p>

        <h2>Disclaimer &amp; limitation of liability</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum
          extent permitted by law, we are not liable for indirect or consequential losses, or for
          decisions you make based on the Service&rsquo;s output. Our total liability is limited to the
          amount you paid us in the prior 3 months.
        </p>

        <h2>Termination</h2>
        <p>
          You may stop using the Service and delete your account at any time. We may suspend or
          terminate access for breach of these Terms.
        </p>

        <h2>Governing law</h2>
        <p>These Terms are governed by the laws of [your jurisdiction — e.g. Kosovo].</p>

        <h2>Changes</h2>
        <p>We may update these Terms; the &ldquo;Last updated&rdquo; date reflects the latest version.</p>

        <h2>Contact</h2>
        <p><a href="mailto:[your-email@example.com]">[your-email@example.com]</a></p>
      </div>

      <div className="mt-12 pt-6 border-t border-black/5 text-sm font-bold text-slate-500 flex gap-4">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
      </div>
    </div>
  );
}
