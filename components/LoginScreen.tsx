"use client";
import { useState } from "react";
import { signIn } from "@/lib/auth";

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      onSuccess();
    } catch {
      setError("Wrong email or password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      {/* Logo / brand */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl">
          <span className="text-2xl">💸</span>
        </div>
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Budget Tracker</h1>
        <p className="text-zinc-400 text-xs font-medium mt-1">Sign in to your account</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3"
      >
        <div className="space-y-3">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-100 rounded-2xl px-5 py-4 text-base text-zinc-900 font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 transition-all"
          />
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-100 rounded-2xl px-5 py-4 text-base text-zinc-900 font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 transition-all"
          />
        </div>

        {error && (
          <p className="text-rose-500 text-xs font-bold text-center px-2">{error}</p>
        )}

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 text-white font-black text-sm rounded-2xl py-4 mt-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg"
        >
          {loading ? "Signing in…" : "Sign In →"}
        </button>
      </form>

      <p className="text-zinc-300 text-[10px] mt-10 text-center font-medium">
        Private app — contact the owner to get access.
      </p>
    </div>
  );
}
