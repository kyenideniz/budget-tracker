"use client";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { type PushSubscriptionData } from "@/hooks/useUserProfile";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UseNotificationsResult {
  /** Whether Push API is available in this browser/context */
  isSupported: boolean;
  /** Whether the user is currently subscribed to push */
  isSubscribed: boolean;
  /** Subscribe to push notifications */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
}

export function useNotifications(uid: string | null): UseNotificationsResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check support and register service worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setIsSupported(true);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (reg) => {
        setRegistration(reg);
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      })
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration || !uid) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error("VAPID public key not configured");
      return;
    }

    try {
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any,
      });

      // Extract the subscription data for Firestore
      const subJSON = sub.toJSON();
      const subscriptionData: PushSubscriptionData = {
        endpoint: subJSON.endpoint!,
        keys: {
          p256dh: subJSON.keys!.p256dh as string,
          auth: subJSON.keys!.auth as string,
        },
      };

      // Save to Firestore so the server can send pushes to this device
      await setDoc(doc(db, "users", uid, "settings", "pushSubscription"), subscriptionData);

      setIsSubscribed(true);
    } catch (err) {
      console.error("Failed to subscribe to push:", err);
    }
  }, [registration, uid]);

  const unsubscribe = useCallback(async () => {
    if (!registration || !uid) return;

    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      // Remove from Firestore
      await deleteDoc(doc(db, "users", uid, "settings", "pushSubscription"));

      setIsSubscribed(false);
    } catch (err) {
      console.error("Failed to unsubscribe from push:", err);
    }
  }, [registration, uid]);

  return { isSupported, isSubscribed, subscribe, unsubscribe };
}
