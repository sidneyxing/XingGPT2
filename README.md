# XingGPT

A full-stack AI chatbot application using a custom LLM API (Groq), with backend-controlled model selection and automatic fallback handling.

---

## Project Structure

```plaintext
XingGPT/
│
├── backend/
│   ├── server.js            # Backend server & API logic
│   ├── package.json
│   ├── package-lock.json
│   └── .env (not included)  # Store API key securely
│
├── frontend/
│   ├── public/
│   │   └── bg.png           # Background image
│   │
│   ├── src/
│   │   ├── App.jsx          # Chat UI & logic
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

* AI Chat interface using Groq LLM API
* Real-time response rendering (simulated streaming)
* Stop generation functionality
* Chat history persistence (localStorage)
* Multiple chat sessions
* Backend-controlled model selection
* Automatic fallback if primary model fails
* Secure API key handling using `.env`

---

## Backend Overview

The backend is built with **Node.js (Express)** and acts as a middleware between the frontend and the LLM API.

### Responsibilities:

* Handle `/chat` requests
* Send prompts to Groq API
* Return AI responses
* Manage model selection internally
* Provide fallback mechanism if model fails

---

## Model Handling

The model is **NOT controlled by the frontend UI**.

### Behavior:

* Backend uses a **default model**
* If the request fails, it automatically switches to a **fallback model**

---

## Frontend Overview

Built using **React (Vite)**.

### `public/`

* Static assets
* `bg.png` used as background

### `src/`

* `App.jsx`

  * Handles user input
  * Sends requests to backend
  * Displays AI responses
  * Manages chat state

* `App.css`

  * UI styling and layout

* `main.jsx`

  * React entry point

### `index.html`

* Root HTML container (`#root`)

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/my-own-gpt.git
cd my-own-gpt
```

---

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

---

### 3. Setup Frontend

```bash
cd ../frontend
npm install
npm run dev
```

---

## Usage

Open:

```
http://localhost:5173
```

Type a message and receive AI-generated responses.

---

## Security Notes

* `.env` is excluded from GitHub
* API keys are never exposed in the frontend
* Each user must provide their own API key

---

## Error Handling

* Backend returns `500` if all models fail
* Includes fallback retry mechanism
* Prevents app crash on API failure

---

## Author

五惺惺
