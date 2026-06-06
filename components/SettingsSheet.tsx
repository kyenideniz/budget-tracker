"use client";
import { useEffect, useState } from "react";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  partnerUid: string;
  onPartnerUidChange: (uid: string) => void;
  notificationsSupported: boolean;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onSignOut: () => void;
}

export default function SettingsSheet({
  open,
  onClose,
  uid,
  partnerUid,
  onPartnerUidChange,
  notificationsSupported,
  notificationsEnabled,
  onToggleNotifications,
  onSignOut,
}: SettingsSheetProps) {
  const [localPartnerUid, setLocalPartnerUid] = useState(partnerUid);

  // Sync external changes
  useEffect(() => {
    setLocalPartnerUid(partnerUid);
  }, [partnerUid]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Commit partner UID on blur
  const handlePartnerBlur = () => {
    const trimmed = localPartnerUid.trim();
    if (trimmed !== partnerUid) {
      onPartnerUidChange(trimmed);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={handleBackdrop}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-10 shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mb-4" />

        {/* Title */}
        <h2 className="text-lg font-black text-zinc-900 mb-6">
          ⚙️ Settings
        </h2>

        {/* ── Section 1: Partner Link ── */}
        <div className="mb-5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">
            Partner UID
          </label>
          <input
            type="text"
            value={localPartnerUid}
            onChange={(e) => setLocalPartnerUid(e.target.value)}
            onBlur={handlePartnerBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Paste partner's User ID"
            className="w-full bg-zinc-100 rounded-xl px-4 py-3 font-mono text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-300 placeholder:text-zinc-400"
          />
          <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
            Paste your partner&apos;s User ID to enable money requests
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-100 my-5" />

        {/* ── Section 2: Notifications ── */}
        <div className="mb-5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">
            Push Notifications
          </label>

          {notificationsSupported ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-700 font-medium">
                {notificationsEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                onClick={onToggleNotifications}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 active:scale-95 ${
                  notificationsEnabled
                    ? "bg-emerald-500"
                    : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    notificationsEnabled
                      ? "translate-x-5"
                      : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Not available in this browser
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-100 my-5" />

        {/* ── Section 3: Account ── */}
        <div className="mb-6">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">
            Your User ID
          </label>
          <p className="text-xs text-zinc-400 font-mono select-all bg-zinc-50 rounded-xl px-4 py-3 break-all border border-zinc-100">
            {uid}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1.5">
            Share this with your partner so they can link with you
          </p>
        </div>

        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className="w-full bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-600 font-black py-3 rounded-2xl text-sm transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
