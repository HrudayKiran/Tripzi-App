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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { userId, userIds, title, body, data } = payload;

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user IDs
    const targetUserIds = userIds || (userId ? [userId] : []);
    
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "userId or userIds required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch push tokens for target users
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

    if (!tokens || tokens.length === 0) {
      console.log("No push tokens found, creating in-app notifications only");
    }

    // Group tokens by platform for future FCM/APNS integration
    const iosTokens = tokens?.filter(t => t.platform === "ios").map(t => t.token) || [];
    const androidTokens = tokens?.filter(t => t.platform === "android").map(t => t.token) || [];

    console.log("Push notification request:", {
      title,
      body,
      data,
      iosTokens: iosTokens.length,
      androidTokens: androidTokens.length,
    });

    // Create in-app notifications
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
      return new Response(
        JSON.stringify({ error: "Failed to create notifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: For production, integrate with:
    // - Firebase Cloud Messaging (FCM) for Android
    // - Apple Push Notification Service (APNS) for iOS
    // You'll need to add FCM_SERVER_KEY and APNS credentials as secrets
    
    return new Response(
      JSON.stringify({ 
        message: "Notifications created successfully",
        sent: notifications.length,
        pushTokens: tokens?.length || 0
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
