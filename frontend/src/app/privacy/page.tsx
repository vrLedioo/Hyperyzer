import Link from 'next/link';
import { Play } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — VidAnalyzer',
  description: 'How VidAnalyzer collects, uses, and protects your data.',
};

export default function Privacy() {
  return (
    <div className="relative z-10 text-slate-900 max-w-3xl mx-auto px-5 sm:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
        <span className="text-lg font-bold tracking-tight">VidAnalyzer</span>
      </Link>

      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <strong>Template notice:</strong> This policy is a good-faith starting point, not legal
        advice. Replace the bracketed details and have it reviewed by a qualified lawyer before you
        rely on it for a live, paid service.
      </div>

      <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
      <p className="text-slate-500 font-medium mt-1">Last updated: June 2026</p>

      <div className="prose-sm mt-8 space-y-6 text-slate-700 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-2 [&_li]:ml-5 [&_li]:list-disc [&_a]:text-pink-600 [&_a]:underline">
        <p>
          VidAnalyzer (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides an AI tool that scores video
          ideas and uploaded videos for hook, retention, and viral potential. This policy explains
          what we collect and how we use it. Operator: [your name / business], [country —
          e.g. Kosovo]. Contact: <a href="mailto:[your-email@example.com]">[your-email@example.com]</a>.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account data:</strong> your email address and a securely hashed password.</li>
          <li><strong>Content you submit:</strong> video titles, scripts/hooks, and any videos you
            upload — plus the transcripts and scores we generate from them.</li>
          <li><strong>Usage data:</strong> basic technical logs needed to run and secure the service.</li>
          <li><strong>Payment data:</strong> handled entirely by our payment provider (Lemon Squeezy)
            — we do not receive or store your card details.</li>
          <li><strong>Your own API key (optional):</strong> if you choose &ldquo;bring your own
            key&rdquo;, your OpenAI key is used only to process that request and is not stored.</li>
        </ul>

        <h2>How we use your data</h2>
        <ul>
          <li>To provide the analysis service and your account features (history, credits, plan).</li>
          <li>To process payments and prevent abuse/fraud.</li>
          <li>To operate, secure, and improve the service.</li>
        </ul>

        <h2>Third-party processors</h2>
        <ul>
          <li><strong>OpenAI</strong> — your titles, scripts, and video transcripts are sent to
            OpenAI to generate scores and (for uploads) transcriptions.</li>
          <li><strong>Lemon Squeezy</strong> — our Merchant of Record; processes payments and handles
            tax/VAT.</li>
          <li><strong>Hosting</strong> — our app and database run on cloud infrastructure
            (e.g. Render, Vercel).</li>
        </ul>

        <h2>Video uploads</h2>
        <p>
          Uploaded video files are used only to extract audio for transcription and are deleted from
          our servers after processing. The resulting transcript and scores are saved to your account
          so you can review them.
        </p>

        <h2>Data retention</h2>
        <p>
          We keep your account and analysis history until you delete your account or ask us to remove
          it. Contact us to request deletion.
        </p>

        <h2>Your rights</h2>
        <p>
          Depending on your location (including under the GDPR), you may have the right to access,
          correct, export, or delete your personal data, and to object to certain processing. To
          exercise these rights, contact <a href="mailto:[your-email@example.com]">[your-email@example.com]</a>.
        </p>

        <h2>Cookies &amp; local storage</h2>
        <p>
          We use your browser&rsquo;s local storage to keep you signed in (an authentication token).
          This is essential to the service. We do not use third-party advertising or tracking cookies.
        </p>

        <h2>Children</h2>
        <p>The service is not intended for anyone under 16. Do not use it if you are under 16.</p>

        <h2>Changes</h2>
        <p>We may update this policy; material changes will be reflected by the &ldquo;Last updated&rdquo; date above.</p>

        <h2>Contact</h2>
        <p>Questions? <a href="mailto:[your-email@example.com]">[your-email@example.com]</a>.</p>
      </div>

      <div className="mt-12 pt-6 border-t border-black/5 text-sm font-bold text-slate-500 flex gap-4">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <Link href="/terms" className="hover:text-slate-900">Terms</Link>
      </div>
    </div>
  );
}
