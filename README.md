# XingGPT

A simple full-stack AI chatbot application using a custom LLM API.

## Features

* Chat interface with AI (LLM via API)
* Real-time response streaming
* Stop generation feature
* Clean UI with background styling
* Separation between frontend and backend

## Tech Stack

* Frontend: React (Vite)
* Backend: Node.js (Express)
* AI Model: Groq API (LLM)

## Project Structure

```
my-own-gpt/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env (not included)
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
```

## Installation

### 1. Clone Repository

```
git clone https://github.com/your-username/my-own-gpt.git
cd my-own-gpt
```

### 2. Setup Backend

```
cd backend
npm install
```

Create `.env` file:

```
API_KEY=your_api_key_here
```

Run backend:

```
node server.js
```

---

### 3. Setup Frontend

```
cd ../frontend
npm install
npm run dev
```

---

## Usage

1. Open browser at:

```
http://localhost:5173
```

2. Type your prompt
3. Get AI-generated response

---

## Security Notes

* Do NOT expose your `.env` file
* API keys must be kept private
* Use `.env.example` for sharing format only

---

## Future Improvements

* Deploy to cloud (Vercel / Render)
* Add authentication
* Save chat history
* Improve UI/UX

---

## Author

五惺惺
