"use client";

interface WelcomeStepProps {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Logo */}
      <div className="font-heading font-semibold text-[32px] tracking-tight text-[#f0f0f5] flex items-center mb-4">
        feed
        <span className="inline-block w-[7px] h-[7px] rounded-full bg-[var(--accent-thread)] mx-[2px] relative top-[1px]" />
        silo
      </div>

      {/* Headline */}
      <h1 className="font-heading font-extrabold text-4xl md:text-5xl tracking-[-1.8px] text-[#f0f0f5] mb-3">
        Your personal content
        <br />
        intelligence feed
      </h1>

      <p className="text-[hsl(var(--muted-foreground))] text-lg mb-10 max-w-[480px]">
        Capture tweets, threads, and articles from your browser.
        Search, organize, and rediscover what matters.
      </p>

      {/* Bullets */}
      <div className="flex flex-col gap-4 mb-8 text-left max-w-[400px] w-full">
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-tweet)] mt-2 shrink-0" />
          <span className="text-[#f0f0f5]">
            <strong>Capture</strong> — Save tweets, threads, and articles with one click
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-thread)] mt-2 shrink-0" />
          <span className="text-[#f0f0f5]">
            <strong>Search</strong> — Full-text and semantic search across everything
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-article)] mt-2 shrink-0" />
          <span className="text-[#f0f0f5]">
            <strong>Own your data</strong> — Self-hosted, open source, MIT licensed
          </span>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="rounded-[10px] bg-[#111118] border border-[#ffffff0a] p-4 mb-10 max-w-[400px] w-full text-left">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <path d="M8 1L2 4v4c0 3.5 2.6 6.4 6 7 3.4-.6 6-3.5 6-7V4L8 1z" stroke="#00ffc8" strokeWidth="1.2" fill="none" />
            <path d="M6 8l1.5 1.5L10.5 6" stroke="#00ffc8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-medium text-[#f0f0f5]">Your privacy is guaranteed</span>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#8888aa] leading-relaxed">
            100% self-hosted — all data stays on your machine. No cloud accounts, no telemetry, no tracking.
          </p>
          <p className="text-xs text-[#8888aa] leading-relaxed">
            API keys are stored locally and never transmitted to us. We don&apos;t store your data anywhere.
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onContinue}
        className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer"
      >
        Get Started
      </button>

      <p className="text-xs text-[hsl(var(--muted))] mt-6">
        Open source &middot; MIT licensed &middot; zero data collection
      </p>
    </div>
  );
}
