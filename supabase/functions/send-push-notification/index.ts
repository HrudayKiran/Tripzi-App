import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface FCMMessage {
  to: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
}

async function sendFCMNotification(token: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  
  if (!fcmServerKey) {
    console.log("FCM_SERVER_KEY not configured, skipping FCM push");
    return false;
  }

  const message: FCMMessage = {
    to: token,
    notification: { title, body },
    data,
  };

  try {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Authorization": `key=${fcmServerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("FCM response:", result);
    
    if (result.success === 1) {
      return true;
    }
    
    if (result.failure === 1 && result.results?.[0]?.error) {
      console.error("FCM error:", result.results[0].error);
    }
    
    return false;
  } catch (error) {
    console.error("FCM send error:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { userId, userIds, title, body, data } = payload;

    console.log("Push notification request received:", { title, body, userId, userIds });

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUserIds = userIds || (userId ? [userId] : []);
    
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "userId or userIds required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, platform, user_id")
      .in("user_id", targetUserIds);

    if (tokenError) {
      console.error("Error fetching tokens:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${tokens?.length || 0} push tokens`);

    let fcmSent = 0;
    let fcmFailed = 0;

    // Send FCM notifications for Android tokens
    if (tokens && tokens.length > 0) {
      const androidTokens = tokens.filter(t => t.platform === "android");
      
      for (const token of androidTokens) {
        const success = await sendFCMNotification(token.token, title, body, data);
        if (success) {
          fcmSent++;
        } else {
          fcmFailed++;
        }
      }
      
      console.log(`FCM results: ${fcmSent} sent, ${fcmFailed} failed`);
    }

    // Create in-app notifications as fallback/supplement
    const notifications = targetUserIds.map(uid => ({
      user_id: uid,
      title,
      message: body,
      type: data?.type || "general",
      related_id: data?.tripId || data?.userId || null,
      is_read: false,
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Error creating in-app notifications:", notifError);
    }

    return new Response(
      JSON.stringify({ 
        message: "Notifications processed",
        inApp: notifications.length,
        fcm: { sent: fcmSent, failed: fcmFailed },
        totalTokens: tokens?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-push-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
