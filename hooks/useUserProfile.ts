"use client";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { type FixedExpenses } from "@/lib/constants";

export interface UserProfile {
  displayName: string;
  /** Bank account names, e.g. ["KBC", "TEB"] or ["Revolut"] */
  accounts: string[];
  /** Per-user fixed expenses (housing + subscriptions). Falls back to defaults if not set. */
  fixedExpenses?: FixedExpenses;
  /**
   * Legacy Firestore data path (e.g. "kerem-efe").
   * If set, all budget data lives at users/{dataPath}/...
   * instead of users/{uid}/...
   * This ensures existing data is NOT migrated — it stays in place.
   */
  dataPath?: string;
}

const DEFAULT_PROFILE: Omit<UserProfile, "displayName"> = {
  accounts: ["KBC", "TEB"],
};

interface UseUserProfileResult {
  profile: UserProfile | null;
  /** true while the profile is loading from Firestore */
  profileLoading: boolean;
  /** true if this is the user's first login (no profile exists yet) */
  isNewUser: boolean;
  saveProfile: (p: UserProfile) => Promise<void>;
}

export function useUserProfile(uid: string | null): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const ref = doc(db, "users", uid, "settings", "profile");
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          setIsNewUser(false);
        } else {
          // No profile yet → show setup wizard
          setProfile(null);
          setIsNewUser(true);
        }
      })
      .catch(console.error)
      .finally(() => setProfileLoading(false));
  }, [uid]);

  const saveProfile = useCallback(
    async (p: UserProfile) => {
      if (!uid) return;
      const ref = doc(db, "users", uid, "settings", "profile");
      await setDoc(ref, p);
      setProfile(p);
      setIsNewUser(false);
    },
    [uid]
  );

  return { profile, profileLoading, isNewUser, saveProfile };
}
