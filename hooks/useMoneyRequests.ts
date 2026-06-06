"use client";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface MoneyRequest {
  id: string;
  requesterUid: string;
  requesterName: string;
  targetUid: string;
  targetName: string;
  amount: number;
  description: string;
  status: "pending" | "settled";
  createdAt: Timestamp | null;
  settledAt?: Timestamp | null;
}

interface UseMoneyRequestsResult {
  /** Pending requests WHERE the current user is the TARGET (they owe money) */
  incomingRequests: MoneyRequest[];
  /** Pending requests WHERE the current user is the REQUESTER (they are owed money) */
  outgoingRequests: MoneyRequest[];
  /** Send a money request to a partner */
  sendRequest: (opts: {
    targetUid: string;
    targetName: string;
    requesterName: string;
    amount: number;
    description: string;
  }) => Promise<void>;
  /** Mark a request as settled — auto-creates budget entries on both sides */
  settleRequest: (
    requestId: string,
    /** callback to add expense on the settler's budget */
    addExpenseForSelf: (amount: number, desc: string) => void,
    /** callback to add income on the requester's budget (cross-user write) */
    addIncomeForRequester: (requesterDataPath: string, monthId: string, amount: number, desc: string) => Promise<void>,
  ) => Promise<void>;
  loading: boolean;
}

export function useMoneyRequests(uid: string | null): UseMoneyRequestsResult {
  const [incomingRequests, setIncomingRequests] = useState<MoneyRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<MoneyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Real-time listener for incoming requests (where I am the target) ─────
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, "moneyRequests"),
      where("targetUid", "==", uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: MoneyRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MoneyRequest[];
      setIncomingRequests(items);
      setLoading(false);
    }, (err) => {
      console.error("Money requests listener error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  // ── Real-time listener for outgoing requests (where I am the requester) ──
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "moneyRequests"),
      where("requesterUid", "==", uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: MoneyRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MoneyRequest[];
      setOutgoingRequests(items);
    });

    return () => unsub();
  }, [uid]);

  // ── Send a new money request ──────────────────────────────────────────────
  const sendRequest = useCallback(
    async (opts: {
      targetUid: string;
      targetName: string;
      requesterName: string;
      amount: number;
      description: string;
    }) => {
      if (!uid) return;

      // 1. Create the request document
      await addDoc(collection(db, "moneyRequests"), {
        requesterUid: uid,
        requesterName: opts.requesterName,
        targetUid: opts.targetUid,
        targetName: opts.targetName,
        amount: opts.amount,
        description: opts.description,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // 2. Send push notification to the target
      try {
        await fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUid: opts.targetUid,
            title: `💸 ${opts.requesterName} requested €${opts.amount.toFixed(2)}`,
            body: opts.description || "Money request",
            url: "/",
          }),
        });
      } catch (err) {
        // Push failure is non-critical — the request still exists in Firestore
        console.error("Push notification failed:", err);
      }
    },
    [uid]
  );

  // ── Settle a request ──────────────────────────────────────────────────────
  const settleRequest = useCallback(
    async (
      requestId: string,
      addExpenseForSelf: (amount: number, desc: string) => void,
      addIncomeForRequester: (requesterDataPath: string, monthId: string, amount: number, desc: string) => Promise<void>,
    ) => {
      const request = incomingRequests.find((r) => r.id === requestId);
      if (!request) return;

      // 1. Mark the request as settled in Firestore
      await updateDoc(doc(db, "moneyRequests", requestId), {
        status: "settled",
        settledAt: serverTimestamp(),
      });

      // 2. Create expense on the settler's (target's) budget
      addExpenseForSelf(request.amount, `Paid: ${request.description}`);

      // 3. Fetch the requester's user profile to find their dataPath
      let requesterDataPath = request.requesterUid;
      try {
        const profileSnap = await getDoc(doc(db, "users", request.requesterUid));
        if (profileSnap.exists()) {
          requesterDataPath = profileSnap.data().dataPath || request.requesterUid;
        }
      } catch (err) {
        console.warn("Failed to fetch requester profile, defaulting dataPath to UID", err);
      }

      // 4. Fetch requester's active month
      let monthId = new Date().toISOString().slice(0, 7);
      try {
        const monthSnap = await getDoc(doc(db, "users", requesterDataPath, "settings", "activeMonth"));
        if (monthSnap.exists()) {
          monthId = monthSnap.data().monthId;
        }
      } catch (err) {
        console.warn("Failed to fetch requester active month, defaulting to current month", err);
      }

      // 5. Add income for the requester using their active month data path
      try {
        await addIncomeForRequester(requesterDataPath, monthId, request.amount, `Received: ${request.description || "Money Request"}`);
      } catch (err) {
        console.error("Failed to add income for requester:", err);
      }

      // 6. Send push notification to the requester that their request was settled
      try {
        await fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUid: request.requesterUid,
            title: `✅ ${request.targetName} paid €${request.amount.toFixed(2)}`,
            body: request.description || "Payment received",
            url: "/",
          }),
        });
      } catch (err) {
        console.error("Settlement push notification failed:", err);
      }
    },
    [incomingRequests]
  );

  return { incomingRequests, outgoingRequests, sendRequest, settleRequest, loading };
}
