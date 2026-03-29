import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — FeedSilo",
  description: "Privacy policy for FeedSilo and the FeedSilo Capture browser extension.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[#c4bdb2]">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#f2ede5] mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-[#7d7569] mb-10">Last updated: March 27, 2026</p>

      <div className="space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">Overview</h2>
          <p>
            FeedSilo is a self-hosted knowledge base for saving content from X/Twitter. The
            FeedSilo Capture browser extension helps you capture tweets, threads, and articles
            directly into your own FeedSilo instance. Your data stays on your own server — we do
            not operate a centralized service that collects or stores your captured content.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">
            Data the Extension Collects
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[#f2ede5]">Tweet and article content</strong> — When you
              capture a tweet, thread, or article, the extension reads the content visible on the
              page (text, media URLs, author info) and sends it to the FeedSilo server URL you
              configured.
            </li>
            <li>
              <strong className="text-[#f2ede5]">Connection settings</strong> — Your server URL
              and pairing token are stored locally in the browser via{" "}
              <code className="text-[#b89462]">chrome.storage.local</code>. These are never sent
              to any third party.
            </li>
            <li>
              <strong className="text-[#f2ede5]">Optional X API bearer token</strong> — If you
              provide one, it is stored locally and sent only to your configured FeedSilo server
              or to the X/Twitter API on your behalf.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">
            How Data Is Used
          </h2>
          <p>
            All captured data is sent exclusively to the FeedSilo server URL that you configure in
            the extension. We do not collect, transmit, or have access to any of your data. The
            extension does not include analytics, telemetry, or tracking of any kind.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">
            Third-Party Services
          </h2>
          <p>
            The extension makes requests to{" "}
            <code className="text-[#b89462]">cdn.syndication.twimg.com</code> (Twitter/X
            syndication API) to resolve media URLs, article content, and video variants for
            captured tweets. No personal data is sent in these requests beyond the tweet ID.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">
            Data Storage and Security
          </h2>
          <p>
            Extension settings are stored locally in your browser. Captured content is stored on
            your self-hosted FeedSilo server. Since FeedSilo is self-hosted, you are responsible
            for the security and backup of your own server and data.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">
            Permissions
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[#f2ede5]">x.com / twitter.com</strong> — Required to read
              tweet content on the page and inject the capture UI.
            </li>
            <li>
              <strong className="text-[#f2ede5]">cdn.syndication.twimg.com</strong> — Required to
              resolve media and article data from the Twitter syndication API.
            </li>
            <li>
              <strong className="text-[#f2ede5]">Your server URL (optional permission)</strong> —
              Granted when you configure your server, so the extension can send captured content
              to your FeedSilo instance.
            </li>
            <li>
              <strong className="text-[#f2ede5]">storage</strong> — To persist your connection
              settings locally.
            </li>
            <li>
              <strong className="text-[#f2ede5]">alarms</strong> — To keep the background service
              worker active during capture sessions.
            </li>
            <li>
              <strong className="text-[#f2ede5]">scripting</strong> — To inject capture scripts
              into X/Twitter tabs.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">
            Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. Changes will be posted on this
            page with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-[#f2ede5] mb-3">Contact</h2>
          <p>
            If you have questions about this privacy policy, contact us at{" "}
            <a
              href="mailto:hello@feedsilo.app"
              className="text-[#b89462] hover:text-[#f0cf9f] transition-colors"
            >
              hello@feedsilo.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
