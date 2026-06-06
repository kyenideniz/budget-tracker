import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Configure VAPID credentials
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:budget@tracker.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(request: NextRequest) {
  try {
    // Validate VAPID config
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json(
        { error: "VAPID keys not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { targetUid, title, body: msgBody, url } = body;

    if (!targetUid || !title) {
      return NextResponse.json(
        { error: "Missing targetUid or title" },
        { status: 400 }
      );
    }

    // Look up the target user's push subscription from Firestore
    const subSnap = await getDoc(
      doc(db, "users", targetUid, "settings", "pushSubscription")
    );

    if (!subSnap.exists()) {
      return NextResponse.json(
        { error: "Target user has no push subscription", sent: false },
        { status: 200 } // Not an error — they just haven't enabled notifications
      );
    }

    const subData = subSnap.data();

    // Build the web-push subscription object
    const pushSubscription = {
      endpoint: subData.endpoint,
      keys: {
        p256dh: subData.keys.p256dh,
        auth: subData.keys.auth,
      },
    };

    // Send the push notification
    const payload = JSON.stringify({
      title,
      body: msgBody || "",
      icon: "/apple-touch-icon.png",
      url: url || "/",
      tag: `budget-${Date.now()}`,
    });

    await webpush.sendNotification(pushSubscription, payload);

    return NextResponse.json({ sent: true });
  } catch (error: unknown) {
    console.error("Push notification error:", error);

    // Handle expired/invalid subscriptions
    if (error && typeof error === "object" && "statusCode" in error) {
      const webPushError = error as { statusCode: number };
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        return NextResponse.json(
          { error: "Subscription expired", sent: false },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
