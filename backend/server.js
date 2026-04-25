import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const pdfParseModule = require("pdf-parse")
const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json({ limit: "20mb" }))

const memStorage = multer({ storage: multer.memoryStorage() })
const diskStorage = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "uploads/"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".webm"
      cb(null, Date.now() + ext)
    }
  })
})

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
})

// ─── Model Router ─────────────────────────────────────────────────────────────
function routeModel(messages, forceModel) {
  if (forceModel) return forceModel

  const last = [...messages].reverse().find(m => m.role === "user")
  const text = (last?.content ?? "").toString().toLowerCase()

  if (/\b(weather|temperature|forecast|rain|sunny|cloudy|humid|hot|cold)\b/.test(text))
    return "llama-3.3-70b-versatile"

  if (/\b(search|find|latest|news|current|today|recent|what happened|who is|look up)\b/.test(text))
    return "llama-3.3-70b-versatile"

  const lastMsg = [...messages].reverse().find(m => m.role === "user")
  const hasImageNow = Array.isArray(lastMsg?.content) &&
    lastMsg.content.some(p => p.type === "image_url")
  if (hasImageNow) return "meta-llama/llama-4-scout-17b-16e-instruct"

  if (/\b(code|function|class|bug|error|implement|algorithm|script|debug|compile)\b/.test(text))
    return "llama-3.3-70b-versatile"

  if (/\b(calculate|math|equation|solve|proof|formula|\d+[\+\-\*\/]\d+)\b/.test(text))
    return "llama-3.3-70b-versatile"

  if (text.length < 80) return "llama-3.1-8b-instant"

  return "llama-3.1-8b-instant"
}

// ─── Tools ────────────────────────────────────────────────────────────────────
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city. Use when user asks about weather.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "City name, e.g. Tokyo" } },
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
        properties: { expression: { type: "string", description: "e.g. '12 * (3 + 4)'" } },
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
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, news, facts, or anything that may have changed recently. Use whenever the user asks about recent events, current status of something, or any topic that benefits from up-to-date information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query, e.g. 'latest AI news 2025'" }
        },
        required: ["query"]
      }
    }
  }
]

// ─── Tool Executors ───────────────────────────────────────────────────────────
async function executeTool(name, args) {
  if (name === "get_weather") {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(args.city)}?format=j1`)
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
    } catch { return JSON.stringify({ error: "Weather data unavailable" }) }
  }

  if (name === "calculate") {
    try {
      const safe = args.expression.replace(/[^0-9+\-*/.() ]/g, "")
      const result = Function('"use strict"; return (' + safe + ')')()
      return JSON.stringify({ expression: args.expression, result })
    } catch { return JSON.stringify({ error: "Invalid expression" }) }
  }

  if (name === "get_current_time") {
    return JSON.stringify({ datetime: new Date().toISOString() })
  }

  if (name === "web_search") {
    try {
      const tavilyKey = process.env.TAVILY_API_KEY
      if (!tavilyKey) return JSON.stringify({ error: "TAVILY_API_KEY not set in .env" })

      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: args.query,
          search_depth: "basic",
          max_results: 5,
          include_answer: true
        })
      })
      const data = await res.json()

      // Return the AI-generated answer + top results
      const results = (data.results || []).slice(0, 4).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 200)
      }))

      return JSON.stringify({
        query: args.query,
        answer: data.answer || null,
        results
      })
    } catch (err) {
      return JSON.stringify({ error: "Web search failed: " + err.message })
    }
  }

  return JSON.stringify({ error: "Unknown tool" })
}

// ─── /chat ────────────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  let { messages, model, temperature, max_tokens, memory } = req.body

  const systemContent = (memory?.length > 0
    ? `You are XingGPT, a helpful AI assistant with vision capabilities.\nHere is what you remember about this user:\n` +
    memory.map(m => `- ${m}`).join("\n") + `\nUse this context naturally when relevant.\n`
    : `You are XingGPT, a helpful and concise AI assistant with vision capabilities.\n`) +
    `You CAN see and analyze images that are sent to you. Describe and analyze images directly without saying you cannot see them.\n` +
    `You have tools available — follow these rules strictly:\n` +
    `- ALWAYS use get_weather for any weather question. Report only what the tool returns.\n` +
    `- ALWAYS use calculate for any math. Never compute mentally.\n` +
    `- ALWAYS use get_current_time when asked about current date/time.\n` +
    `- ALWAYS use web_search for: recent news, current events, latest info, facts you're unsure about, or anything time-sensitive.\n` +
    `- Never say data may be inaccurate when a tool was used — trust the tool result.\n` +
    `- When web_search returns results, cite them naturally in your response.`

  const safeTemp = temperature ?? 0.7
  const safeMaxTokens = max_tokens ?? 1500

  // Only check the LAST user message for image
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user")
  const currentMessageHasImage = Array.isArray(lastUserMessage?.content) &&
    lastUserMessage.content.some(p => p.type === "image_url")

  // Strip images from ALL messages except the current one
  const strippedMessages = messages.map(msg => {
    if (!Array.isArray(msg.content)) return msg
    const isCurrentMsg = msg === lastUserMessage
    if (isCurrentMsg) return msg // keep current message with image intact
    // Remove image_url parts from older messages, keep only text
    const textParts = msg.content.filter(p => p.type === "text")
    if (textParts.length === 0) return { ...msg, content: "[image]" }
    if (textParts.length === 1) return { ...msg, content: textParts[0].text }
    return { ...msg, content: textParts }
  })

  const selectedModel = routeModel(strippedMessages, model)
  console.log(`[Route] ${selectedModel}`)

  const cleanedMessages = [
    { role: "system", content: systemContent },
    ...strippedMessages
  ]
  try {
    const requestParams = {
      model: selectedModel,
      messages: cleanedMessages,
      temperature: safeTemp,
      max_tokens: safeMaxTokens,
      ...(!currentMessageHasImage && { tools, tool_choice: "auto" })
    }

    const response = await groq.chat.completions.create(requestParams)
    const choice = response.choices[0]

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const toolCalls = choice.message.tool_calls
      const toolResults = []
      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments)
        console.log(`[Tool] ${tc.function.name}`, args)
        const result = await executeTool(tc.function.name, args)
        toolResults.push({ tool_call_id: tc.id, role: "tool", content: result })
      }
      const followUp = await groq.chat.completions.create({
        model: selectedModel,
        messages: [...cleanedMessages, choice.message, ...toolResults],
        temperature: safeTemp,
        max_tokens: safeMaxTokens
      })
      return res.json({
        reply: followUp.choices[0]?.message?.content || "⚠️ No response",
        model_used: selectedModel,
        tools_used: toolCalls.map(tc => tc.function.name)
      })
    }

    return res.json({
      reply: choice?.message?.content || "⚠️ Empty response",
      model_used: selectedModel,
      tools_used: []
    })

  } catch (err) {
    console.error("Primary error:", err.message)
    try {
      const fallback = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: cleanedMessages,
        temperature: safeTemp,
        max_tokens: safeMaxTokens
      })
      return res.json({
        reply: fallback.choices[0]?.message?.content || "⚠️ Empty fallback",
        model_used: "llama-3.3-70b-versatile (fallback)",
        tools_used: []
      })
    } catch { return res.status(500).json({ error: "All models failed" }) }
  }
})

// ─── /extract-memory ──────────────────────────────────────────────────────────
app.post("/extract-memory", async (req, res) => {
  const { messages } = req.body
  if (!messages?.length) return res.json({ facts: [] })
  try {
    const prompt =
      `From the following conversation, extract 3-6 short factual bullet points about the USER ` +
      `(preferences, name, job, goals, etc.) useful to remember for future conversations. ` +
      `Only include things explicitly said by the user. ` +
      `Respond with ONLY a JSON array of strings, nothing else.\n\nConversation:\n` +
      messages.map(m => `${m.role}: ${typeof m.content === "string" ? m.content : "[image]"}`).join("\n")

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 300
    })
    const raw = response.choices[0]?.message?.content || "[]"
    const facts = JSON.parse(raw.replace(/```json|```/g, "").trim())
    return res.json({ facts: Array.isArray(facts) ? facts : [] })
  } catch (err) {
    console.error("Memory error:", err.message)
    return res.json({ facts: [] })
  }
})

// ─── /summarize-pdf ───────────────────────────────────────────────────────────
app.post("/summarize-pdf", memStorage.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" })
  try {
    const data = await pdfParse(Buffer.from(req.file.buffer))
    const rawText = data.text?.trim()
    if (!rawText || rawText.length < 50)
      return res.status(422).json({ error: "Could not extract text. PDF may be image-based." })

    const truncated = rawText.slice(0, 12000)
    const wasTruncated = rawText.length > 12000

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes documents clearly." },
        {
          role: "user", content:
            `Summarize this PDF. Include: main topic, key points, and important conclusions.\n\n` +
            (wasTruncated ? `(Truncated to fit context)\n\n` : "") +
            `---\n${truncated}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })

    return res.json({
      summary: response.choices[0]?.message?.content || "Could not generate summary",
      pages: data.numpages || "?",
      chars: rawText.length,
      truncated: wasTruncated
    })
  } catch (err) {
    return res.status(500).json({ error: "Failed to process PDF: " + err.message })
  }
})

// ─── /transcribe-audio ────────────────────────────────────────────────────────
app.post("/transcribe-audio", diskStorage.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded" })
  const filePath = req.file.path
  const originalName = req.file.originalname || "recording.webm"

  try {
    const Groq = (await import("groq-sdk")).default
    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const transcription = await groqClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3",
      response_format: "json",
      language: "en"
    })

    fs.unlinkSync(filePath)
    return res.json({ transcript: transcription.text || "" })

  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    console.error("Audio error:", err.message)
    return res.status(500).json({ error: "Transcription failed: " + err.message })
  }
})

app.listen(3001, () => console.log("✅ XingGPT backend on port 3001"))