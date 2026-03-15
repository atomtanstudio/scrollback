interface StatPillsProps {
  stats: { total: number; tweets: number; threads: number; articles: number; rss: number; art: number };
}

export function StatPills({ stats }: StatPillsProps) {
  const pills = [
    { label: "Tweets", count: stats.tweets, color: "bg-[var(--accent-tweet)]" },
    { label: "Threads", count: stats.threads, color: "bg-[var(--accent-thread)]" },
    { label: "Articles", count: stats.articles, color: "bg-[var(--accent-article)]" },
    { label: "RSS", count: stats.rss, color: "bg-[var(--accent-article)]" },
    { label: "Art", count: stats.art, color: "bg-[var(--accent-art)]" },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {pills.map((pill) => (
        <div
          key={pill.label}
          className="flex items-center gap-2 rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-4 py-2 text-[13px] text-[#a49b8b]"
        >
          <span className={`w-2 h-2 rounded-full ${pill.color}`} />
          <span className="font-semibold text-[#f2ede5]">
            {pill.count.toLocaleString()}
          </span>
          {pill.label}
        </div>
      ))}
    </div>
  );
}
