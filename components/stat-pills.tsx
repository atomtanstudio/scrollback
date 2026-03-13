interface StatPillsProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function StatPills({ stats }: StatPillsProps) {
  const pills = [
    { label: "Tweets", count: stats.tweets, color: "bg-[var(--accent-tweet)]" },
    { label: "Threads", count: stats.threads, color: "bg-[var(--accent-thread)]" },
    { label: "Articles", count: stats.articles, color: "bg-[var(--accent-article)]" },
    { label: "Art", count: stats.art, color: "bg-[var(--accent-art)]" },
  ];

  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {pills.map((pill) => (
        <div
          key={pill.label}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111118] border border-[#ffffff12] text-[13px] text-[#8888aa]"
        >
          <span className={`w-2 h-2 rounded-full ${pill.color}`} />
          <span className="font-semibold text-[#f0f0f5]">{pill.count.toLocaleString()}</span>
          {pill.label}
        </div>
      ))}
    </div>
  );
}
