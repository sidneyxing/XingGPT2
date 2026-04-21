# XingGPT v2

A full-stack AI agent application powered by Groq LLM API, featuring long-term memory, multimodal vision, intelligent model routing, and built-in tool use.

---

## Project Structure

```plaintext
XingGPT/
│
├── backend/
│   ├── server.js            # Backend server, routing, tools & memory extraction
│   ├── package.json
│   ├── package-lock.json
│   └── .env (not included)  # Store API key securely
│
├── frontend/
│   ├── public/
│   │   └── bg.png           # Background image
│   │
│   ├── src/
│   │   ├── App.jsx          # Chat UI, memory, multimodal & tool display
│   │   ├── App.css          # Styling
│   │   └── main.jsx         # Entry point
│   │
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

---

## Key Features

### v1
* AI chat interface using Groq LLM API
* Simulated streaming response rendering
* Stop generation functionality
* Chat history persistence (localStorage)
* Multiple chat sessions with rename/delete
* Backend-controlled model selection with automatic fallback
* Secure API key handling via `.env`

### v2 (New)
* **Long-term Memory** — AI remembers facts about you across sessions
* **Multimodal (Vision)** — attach and analyze images in chat
* **Auto Model Routing** — backend selects the best model per query type
* **Tool Use** — AI can call built-in tools automatically:
  * `get_weather` — live weather by city
  * `calculate` — safe math expression evaluator
  * `get_current_time` — current date and time
* **Model & Tool Badge** — shows which model and tools were used per reply
* **Memory Panel** — view, delete, and clear remembered facts in the sidebar

---

## Backend Overview

Built with **Node.js (Express)**. Acts as middleware between the frontend and the Groq API.

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/chat` | POST | Main chat endpoint — handles routing, tools, memory injection |
| `/extract-memory` | POST | Summarizes a conversation into user facts for long-term memory |

### Model Routing Logic

The backend automatically selects a model based on the message content:

| Condition | Model Selected |
|---|---|
| Message contains an image | `llava-v1.5-7b-4096-preview` |
| Code / debugging keywords | `llama-3.3-70b-versatile` |
| Math / calculation keywords | `llama-3.3-70b-versatile` |
| Short query (< 80 chars) | `llama-3.1-8b-instant` |
| Default / balanced | `llama-3.1-8b-instant` |
| Any failure | `llama-3.3-70b-versatile` (fallback) |

### Tool Use

Tools follow the OpenAI function-calling format. When the model decides to call a tool, the backend executes it and sends results back in a second pass before returning the final reply.

### Long-term Memory

After each conversation turn, `/extract-memory` uses an LLM to extract user-specific facts (name, preferences, goals, etc.) as bullet points. These are stored in the frontend's `localStorage` and injected as a system prompt on every future request.

---

## Frontend Overview

Built with **React (Vite)**.

### `src/App.jsx`
* Manages chat state and multi-session history
* Sends memory array alongside messages on every request
* Handles image file selection and base64 encoding for vision requests
* Displays model badge and tool badges per reply
* Renders memory panel in sidebar (view / delete individual facts / clear all)

### `src/App.css`
* All existing styles preserved
* New: memory panel, image preview strip, attach button, status bar badges

### `main.jsx`
* React entry point (unchanged)

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/my-own-gpt.git
cd my-own-gpt
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create `.env` file:

```env
GROQ_API_KEY=your_api_key_here
```

Run backend:

```bash
node server.js
```

### 3. Setup Frontend

```bash
cd ../frontend
npm install react-markdown
npm run dev
```

---

## Usage

Open:

```
http://localhost:5173
```

### New features

| Feature | How to use |
|---|---|
| **Memory** | Chat normally — facts are auto-extracted. Click 🧠 in the sidebar to view or delete them. |
| **Image input** | Click 🖼️ next to the input box, select an image, then send. |
| **Weather** | Ask *"What's the weather in Tokyo?"* |
| **Calculator** | Ask *"What is 347 × 29?"* |
| **Current time** | Ask *"What time is it?"* |
| **Model badge** | Shown below the chat after each reply — indicates which model and tools were used. |

---

## Security Notes

* `.env` is excluded from GitHub
* API keys are never exposed to the frontend
* Each user must provide their own Groq API key
* Image data is encoded as base64 and never stored server-side

---

## Error Handling

* Automatic fallback to `llama-3.3-70b-versatile` if primary model fails
* Vision requests skip tool calling (not supported by vision models)
* Memory extraction failures are silent and non-blocking
* Frontend displays error bubble on any network failure

---

## Author

五惺惺