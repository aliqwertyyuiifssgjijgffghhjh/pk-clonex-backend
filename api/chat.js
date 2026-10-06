import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      telegram_user_id,
      conversation_id,
      message
    } = req.body || {};

    if (!telegram_user_id || !message) {
      return res.status(400).json({
        error: "telegram_user_id and message are required"
      });
    }

    const userId = String(telegram_user_id);

    // Create user if it doesn't exist
    const { error: userError } = await supabase
      .from("users")
      .upsert(
        {
          telegram_user_id: userId
        },
        {
          onConflict: "telegram_user_id"
        }
      );

    if (userError) throw userError;

    // Create a new conversation if needed
    let chatId = conversation_id;

    if (!chatId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          telegram_user_id: userId,
          title: message.slice(0, 60)
        })
        .select("id")
        .single();

      if (error) throw error;

      chatId = data.id;
    }

    // Save user's message
    const { error: saveUserError } = await supabase
      .from("messages")
      .insert({
        conversation_id: chatId,
        telegram_user_id: userId,
        role: "user",
        content: message
      });

    if (saveUserError) throw saveUserError;

    // Get conversation history
    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", chatId)
      .order("created_at", {
        ascending: true
      })
      .limit(50);

    if (historyError) throw historyError;

    /*
     * All AI configuration comes from Vercel Environment Variables.
     *
     * GROQ_API_KEY
     * GROQ_MODEL
     * GROQ_SYSTEM_INSTRUCTION
     */

    const systemInstruction =
      process.env.GROQ_SYSTEM_INSTRUCTION ||
      "You are a helpful AI assistant for Pk CloneX Team.";

    const model =
      process.env.GROQ_MODEL ||
      "llama-3.3-70b-versatile";

    // Call Groq
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemInstruction
            },
            ...(history || []).map((msg) => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          temperature: 0.7
        })
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();

      console.error("Groq error:", errorText);

      return res.status(502).json({
        error: "AI service error"
      });
    }

    const groqData = await groqResponse.json();

    const reply =
      groqData?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    // Save AI response
    const { error: saveAssistantError } = await supabase
      .from("messages")
      .insert({
        conversation_id: chatId,
        telegram_user_id: userId,
        role: "assistant",
        content: reply
      });

    if (saveAssistantError) throw saveAssistantError;

    return res.status(200).json({
      ok: true,
      conversation_id: chatId,
      reply
    });

  } catch (error) {
    console.error("Backend error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
          }
