import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
})

app.post("/chat", async (req, res) => {

  const {messages, model, temperature, max_tokens} = req.body

  try {

  const selectedModel = model || "llama-3.1-8b-8192"

  const response = await client.chat.completions.create({
    model: selectedModel,
    messages: messages,
    temperature: temperature,
    max_tokens: max_tokens
  })

  const text = response.choices[0].message.content

  res.json({
    reply: text
  })

} catch (err) {

  console.log("Main model failed, trying fallback...")

  try {

    const fallbackResponse = await client.chat.completions.create({
      model: "mixtral-8x7b-32768", // fallback model
      messages: messages,
      temperature: temperature,
      max_tokens: max_tokens
    })

    const text = fallbackResponse.choices[0].message.content

    res.json({
      reply: text
    })

  } catch (fallbackErr) {

    console.error("Both models failed:", fallbackErr)

    res.status(500).json({
      error: "All models failed"
    })

  }

}

})

app.listen(3001, ()=>{
  console.log("Backend running on port 3001")
})