"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam ? "Invalid email or password" : "");
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Use fetch with redirect:follow — browser will follow the 302 and apply Set-Cookie
    try {
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
        }),
        credentials: "include",
      });

      // After following redirects, check the final URL for errors
      const finalUrl = res.url;
      if (finalUrl.includes("error=")) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      // Check if session was actually set
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      const session = await sessionRes.json();

      if (session?.user) {
        window.location.href = callbackUrl;
      } else {
        setError("Invalid email or password");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] bg-[var(--surface)] border border-[hsl(var(--border))] rounded-[14px] p-8">
      {/* Logo */}
      <div className="text-center mb-6">
        <span className="font-heading font-extrabold text-2xl tracking-tight text-[#f0f0f5]">
          feed
          <span className="text-[var(--accent-thread)]">.</span>
          silo
        </span>
      </div>

      {/* Heading */}
      <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[#f0f0f5] text-center mb-6">
        Login
      </h1>

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
        </div>

        {error && (
          <p className="text-[#ff4444] text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password || !csrfToken}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default mt-2"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
