"use client";

import { useEffect, useState } from "react";
import { TokenDisplay } from "@/components/shared/token-display";

interface UserInfo {
  id: string;
  email: string;
  role: string;
  capture_token: string | null;
  created_at: string;
  _count: { content_items: number; rss_feeds: number };
}

export function UsersSection() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
        <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">Users</h3>
        <p className="mt-2 text-sm text-[#7d7569]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      <div className="mb-4">
        <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">Users</h3>
        <p className="mt-1 text-xs text-[#7d7569]">
          Each user has their own library and capture token for the browser extension.
        </p>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-[16px] border border-[#d6c9b214] bg-[#0f141b] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#f2ede5] truncate">
                    {user.email}
                  </span>
                  <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    user.role === "admin"
                      ? "border border-[#b89462]/30 bg-[#b89462]/10 text-[#b89462]"
                      : "border border-[#6e98a0]/30 bg-[#6e98a0]/10 text-[#6e98a0]"
                  }`}>
                    {user.role}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#7d7569]">
                  {user._count.content_items} items, {user._count.rss_feeds} feeds
                </p>
              </div>

              <button
                onClick={() => setExpandedToken(expandedToken === user.id ? null : user.id)}
                className="shrink-0 h-8 rounded-[8px] border border-[#d6c9b214] bg-[#ffffff05] px-3 text-[12px] font-medium text-[#a49b8b] transition-colors hover:text-[#f2ede5] hover:border-[#d6c9b233] cursor-pointer"
              >
                {expandedToken === user.id ? "Hide token" : "Show token"}
              </button>
            </div>

            {expandedToken === user.id && user.capture_token && (
              <div className="mt-3">
                <TokenDisplay token={user.capture_token} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
