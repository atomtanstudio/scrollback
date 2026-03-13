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
      <div className="flex flex-col gap-4 mb-10 text-left max-w-[400px] w-full">
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

      {/* CTA */}
      <button
        onClick={onContinue}
        className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer"
      >
        Get Started
      </button>

      <p className="text-xs text-[hsl(var(--muted))] mt-6">
        Open source, MIT licensed, your data stays yours
      </p>
    </div>
  );
}
