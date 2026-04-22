# XingGPT

A personal AI agent I built from scratch — started as a basic chatbot for Homework 01, then expanded into a full agent with memory, vision, tools, web search, PDF summarization, and audio transcription.

---

## Project Structure

```
XingGPT/
│
├── backend/
│   ├── server.js            # Express server — handles routing, tools, memory
│   ├── package.json
│   ├── package-lock.json
│   └── .env                 # Not included — store your API keys here
│
├── frontend/
│   ├── public/
│   │   └── bg.png
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## What it does

### Core chat
- Multi-session chat UI with rename, delete, and localStorage persistence
- Simulated streaming (character by character) for a live feel
- Stop generation mid-response
- Creative / Balanced / Logical temperature modes

### Long-term memory
The AI actually remembers things about you across sessions. After each conversation, the backend runs a second LLM call to extract user facts (your name, preferences, goals, etc.) as bullet points. These get saved to localStorage and injected as a system prompt next time you chat. You can view, delete, or clear them from the sidebar.

### Multimodal (vision)
Attach an image to any message. It gets base64-encoded and sent to a vision model (LLaVA). The AI can describe, analyze, or answer questions about it.

### Auto model routing
The backend decides which model to use based on what you asked — no manual switching needed. Weather and search queries go to the 70b model since it handles tool calling better. Images go to the vision model. Short simple questions go to the fast 8b model. If anything fails, it automatically falls back to 70b-versatile.

### Tool use
The AI can call tools on its own when it decides they're relevant:
- `get_weather` — live data from wttr.in
- `calculate` — safe math evaluator
- `get_current_time` — returns current datetime
- `web_search` — searches the web via Tavily API and returns real-time results

### PDF summarization
Upload any PDF. The backend extracts the text using `pdf-parse`, feeds it to the LLM, and returns a structured summary with page count.

### Audio transcription
Two ways to use it — upload an audio file (mp3, wav, m4a, etc.) or record directly from your microphone. Audio goes to Groq's Whisper API (`whisper-large-v3`) and the transcript appears in chat.

### Chat export
Download any conversation as a plain `.txt` file.

---

## Backend API

| Endpoint | Method | What it does |
|---|---|---|
| `/chat` | POST | Main chat — routes model, runs tools, injects memory |
| `/extract-memory` | POST | Extracts user facts from conversation for memory |
| `/summarize-pdf` | POST | Receives PDF, extracts text, returns summary |
| `/transcribe-audio` | POST | Receives audio file, returns transcript via Whisper |

### Model routing

| Trigger | Model |
|---|---|
| Image in message | `llava-v1.5-7b-4096-preview` |
| Weather / search keywords | `llama-3.3-70b-versatile` |
| Code / math keywords | `llama-3.3-70b-versatile` |
| Short query (< 80 chars) | `llama-3.1-8b-instant` |
| Default | `llama-3.1-8b-instant` |
| Fallback on any error | `llama-3.3-70b-versatile` |

---

## Setup

### 1. Clone

```bash
git clone https://github.com/your-username/xinggpt.git
cd xinggpt
```

### 2. Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
GROQ_API_KEY=your_groq_key
TAVILY_API_KEY=your_tavily_key
```

Get your keys:
- Groq: https://console.groq.com
- Tavily (free tier, 1000 searches/month): https://tavily.com

Create the uploads temp folder:

```bash
mkdir -p uploads
```

Start:

```bash
node server.js
```

### 3. Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## How to use each feature

| Feature | How |
|---|---|
| Memory | Chat normally — facts auto-extracted. Click Brain icon in sidebar to manage. |
| Image | Click image icon → pick file → ask anything about it |
| PDF | Click file icon → pick PDF → summary appears in chat |
| Record audio | Click mic icon → speak → click stop → transcript appears |
| Upload audio | Click music icon → pick file → transcript appears |
| Weather | Ask "what's the weather in [city]?" |
| Calculator | Ask "what is 512 * 33?" |
| Web search | Ask "latest news about X" or anything time-sensitive |
| Export | Click Export button at the bottom of any chat |

---

## Security

- API keys are in `.env` and never sent to the frontend
- `.env` is listed in `.gitignore`
- Images are encoded as base64 — never written to disk
- Audio files are written to `/uploads` temporarily and deleted immediately after transcription

---

## Dependencies

### Backend
```
express, cors, dotenv, openai, multer, pdf-parse, form-data
```

### Frontend
```
react, react-dom, react-markdown, vite
```

---

## Author

五惺惺