import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: "20mb" }))

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
})

// ─── Model Router ────────────────────────────────────────────────────────────
// Picks the best model based on the last user message content
function routeModel(messages, forceModel) {
  if (forceModel) return forceModel

  const last = [...messages].reverse().find(m => m.role === "user")
  const text = (last?.content ?? "").toString().toLowerCase()

  // Vision request → use llama vision model
  const hasImage = messages.some(m =>
    Array.isArray(m.content) &&
    m.content.some(p => p.type === "image_url")
  )
  if (hasImage) return "llava-v1.5-7b-4096-preview"

  // Code / technical → fast capable model
  if (/\b(code|function|class|bug|error|implement|algorithm|script|debug|compile)\b/.test(text))
    return "llama-3.3-70b-versatile"

  // Math / logic
  if (/\b(calculate|math|equation|solve|proof|formula|\d+[\+\-\*\/]\d+)\b/.test(text))
    return "llama-3.3-70b-versatile"

  // Quick factual or short reply → fast small model
  if (text.length < 80)
    return "llama-3.1-8b-instant"

  // Default balanced
  return "llama-3.1-8b-instant"
}

// ─── Built-in Tools ───────────────────────────────────────────────────────────
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city. Use when user asks about weather.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name, e.g. Tokyo" }
        },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Evaluate a math expression safely. Use for arithmetic.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "e.g. '12 * (3 + 4)'" }
        },
        required: ["expression"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time.",
      parameters: { type: "object", properties: {} }
    }
  }
]

// ─── Tool Executors ───────────────────────────────────────────────────────────
async function executeTool(name, args) {
  if (name === "get_weather") {
    try {
      const res = await fetch(
        `https://wttr.in/${encodeURIComponent(args.city)}?format=j1`
      )
      const data = await res.json()
      const cur = data.current_condition[0]
      return JSON.stringify({
        city: args.city,
        temp_c: cur.temp_C,
        feels_like_c: cur.FeelsLikeC,
        description: cur.weatherDesc[0].value,
        humidity: cur.humidity + "%",
        wind_kmph: cur.windspeedKmph
      })
    } catch {
      return JSON.stringify({ error: "Weather data unavailable" })
    }
  }

  if (name === "calculate") {
    try {
      // Safe eval: only allow numbers and operators
      const safe = args.expression.replace(/[^0-9+\-*/.() ]/g, "")
      // eslint-disable-next-line no-eval
      const result = Function('"use strict"; return (' + safe + ')')()
      return JSON.stringify({ expression: args.expression, result })
    } catch {
      return JSON.stringify({ error: "Invalid expression" })
    }
  }

  if (name === "get_current_time") {
    return JSON.stringify({ datetime: new Date().toISOString() })
  }

  return JSON.stringify({ error: "Unknown tool" })
}

// ─── /chat endpoint ───────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  let { messages, model, temperature, max_tokens, memory } = req.body

  // Inject long-term memory as system prompt if provided
  const systemMessages = []
  if (memory && memory.length > 0) {
    systemMessages.push({
      role: "system",
      content:
        `You are XingGPT, a helpful AI assistant. ` +
        `Here is what you remember about this user from past conversations:\n` +
        memory.map(m => `- ${m}`).join("\n") +
        `\nUse this context naturally when relevant.`
    })
  } else {
    systemMessages.push({
      role: "system",
      content: "You are XingGPT, a helpful and concise AI assistant."
    })
  }

  const allMessages = [...systemMessages, ...messages]
  const selectedModel = routeModel(messages, model)
  const safeTemp = temperature ?? 0.7
  const safeMaxTokens = max_tokens ?? 1500

  console.log(`[Route] Model selected: ${selectedModel}`)

  // Vision requests skip tool calling (Groq vision models don't support it)
  const hasImage = messages.some(m =>
    Array.isArray(m.content) &&
    m.content.some(p => p.type === "image_url")
  )

  try {
    const requestParams = {
      model: selectedModel,
      messages: allMessages,
      temperature: safeTemp,
      max_tokens: safeMaxTokens
    }

    if (!hasImage) {
      requestParams.tools = tools
      requestParams.tool_choice = "auto"
    }

    const response = await groq.chat.completions.create(requestParams)

    const choice = response.choices[0]

    // ── Tool call handling ──
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const toolCalls = choice.message.tool_calls
      const toolResults = []

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments)
        console.log(`[Tool] Calling ${tc.function.name}`, args)
        const result = await executeTool(tc.function.name, args)
        toolResults.push({
          tool_call_id: tc.id,
          role: "tool",
          content: result
        })
      }

      // Second pass with tool results
      const followUp = await groq.chat.completions.create({
        model: selectedModel,
        messages: [
          ...allMessages,
          choice.message,
          ...toolResults
        ],
        temperature: safeTemp,
        max_tokens: safeMaxTokens
      })

      const finalText = followUp.choices[0]?.message?.content || "⚠️ No response"
      return res.json({
        reply: finalText,
        model_used: selectedModel,
        tools_used: toolCalls.map(tc => tc.function.name)
      })
    }

    // ── Normal response ──
    const text = choice?.message?.content || "⚠️ Empty response from AI"
    return res.json({
      reply: text,
      model_used: selectedModel,
      tools_used: []
    })

  } catch (err) {
    console.error("Primary model error:", err.message)

    // Fallback to 70b
    try {
      const fallback = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: safeTemp,
        max_tokens: safeMaxTokens
      })
      const text = fallback.choices[0]?.message?.content || "⚠️ Empty fallback"
      return res.json({ reply: text, model_used: "llama-3.3-70b-versatile (fallback)", tools_used: [] })
    } catch (fallbackErr) {
      console.error("Fallback error:", fallbackErr.message)
      return res.status(500).json({ error: "All models failed" })
    }
  }
})

// ─── /extract-memory endpoint ─────────────────────────────────────────────────
// Summarizes a conversation into bullet-point facts to store as long-term memory
app.post("/extract-memory", async (req, res) => {
  const { messages } = req.body
  if (!messages || messages.length === 0) return res.json({ facts: [] })

  try {
    const prompt = `From the following conversation, extract 3-6 short factual bullet points about the USER (preferences, name, job, goals, etc.) that would be useful to remember for future conversations. Only include things explicitly said by the user. Respond with ONLY a JSON array of strings, nothing else.\n\nConversation:\n` +
      messages.map(m => `${m.role}: ${typeof m.content === "string" ? m.content : "[image]"}`).join("\n")

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 300
    })

    const raw = response.choices[0]?.message?.content || "[]"
    const clean = raw.replace(/```json|```/g, "").trim()
    const facts = JSON.parse(clean)
    return res.json({ facts: Array.isArray(facts) ? facts : [] })
  } catch (err) {
    console.error("Memory extraction error:", err.message)
    return res.json({ facts: [] })
  }
})

app.listen(3001, () => console.log("✅ XingGPT backend on port 3001"))