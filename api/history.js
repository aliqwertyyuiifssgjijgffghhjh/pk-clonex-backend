import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const userId = String(req.query.telegram_user_id || "");

    if (!userId) {
      return res.status(400).json({
        error: "telegram_user_id is required"
      });
    }

    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        title,
        created_at,
        messages (
          id,
          role,
          content,
          created_at
        )
      `)
      .eq("telegram_user_id", userId)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      ok: true,
      conversations: data || []
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
          }
