import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"

// ─── Memory helpers ────────────────────────────────────────────────────────
const MEMORY_KEY = "xinggpt_memory"
function loadMemory() {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY)) || [] } catch { return [] }
}
function saveMemory(facts) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(facts))
}

// ─── Image → base64 ────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result) // data:image/...;base64,...
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function App() {
  const [input, setInput] = useState("")
  const [chats, setChats] = useState([{ id: 1, title: "New Chat", messages: [] }])
  const [currentChat, setCurrentChat] = useState(1)
  const [aiMode, setAiMode] = useState("balanced")
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [editingChat, setEditingChat] = useState(null)
  const [editText, setEditText] = useState("")
  const [menu, setMenu] = useState(null)
  const [memory, setMemory] = useState(loadMemory)
  const [showMemory, setShowMemory] = useState(false)
  const [imageFile, setImageFile] = useState(null)   // File object
  const [imagePreview, setImagePreview] = useState(null) // data URL for preview
  const [lastModelUsed, setLastModelUsed] = useState(null)
  const [lastToolsUsed, setLastToolsUsed] = useState([])

  const bottomRef = useRef(null)
  const sendingRef = useRef(false)
  const abortRef = useRef(null)
  const fileInputRef = useRef(null)

  const activeChat = chats.find(c => c.id === currentChat) || chats[0]

  // ── Persist chats ──
  useEffect(() => {
    const saved = localStorage.getItem("chats")
    if (saved) setChats(JSON.parse(saved))
    const savedCurrent = localStorage.getItem("currentChat")
    if (savedCurrent) setCurrentChat(Number(savedCurrent))
  }, [])
  useEffect(() => { localStorage.setItem("chats", JSON.stringify(chats)) }, [chats])
  useEffect(() => { localStorage.setItem("currentChat", String(currentChat)) }, [currentChat])

  // ── Close context menu on click ──
  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  // ── Auto scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeChat?.messages])

  function getTemperature() {
    if (aiMode === "creative") return 1
    if (aiMode === "logical") return 0.2
    return 0.7
  }

  // ── Handle image pick ──
  async function handleImagePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const preview = await fileToBase64(file)
    setImagePreview(preview)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Send message ──
  async function sendMessage() {
    if (sending) return
    if (!input.trim() && !imageFile) return

    const controller = new AbortController()
    abortRef.current = controller

    // Build content: text + optional image
    let userContent
    if (imageFile) {
      const b64 = await fileToBase64(imageFile)
      userContent = [
        { type: "text", text: input || "What's in this image?" },
        { type: "image_url", image_url: { url: b64 } }
      ]
    } else {
      userContent = input
    }

    const userMessage = { role: "user", content: userContent }
    const displayText = input || "📎 Image uploaded"

    setSending(true)
    sendingRef.current = true
    setTyping(true)
    setInput("")
    removeImage()

    // Add user message to chat
    setChats(prev => prev.map(chat => {
      if (chat.id !== currentChat) return chat
      const updated = { ...chat, messages: [...chat.messages, userMessage] }
      if (chat.messages.length === 0) updated.title = displayText.slice(0, 30)
      return updated
    }))

    try {
      const response = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...activeChat.messages, userMessage],
          temperature: getTemperature(),
          max_tokens: 1500,
          memory: memory
        })
      })

      const data = await response.json()
      const text = data.reply || "⚠️ No response from AI"

      if (data.model_used) setLastModelUsed(data.model_used)
      if (data.tools_used) setLastToolsUsed(data.tools_used)

      // Stream effect
      let streamed = ""
      for (let i = 0; i < text.length; i++) {
        if (!sendingRef.current) break
        streamed += text[i]
        setChats(prev => prev.map(chat => {
          if (chat.id !== currentChat) return chat
          const msgs = [...chat.messages]
          if (msgs[msgs.length - 1]?.role === "assistant") {
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: streamed }
          } else {
            msgs.push({ role: "assistant", content: streamed })
          }
          return { ...chat, messages: msgs }
        }))
        await new Promise(r => setTimeout(r, 6))
      }

      // After chat ends, extract memory in background
      extractMemoryFromChat([...activeChat.messages, userMessage, { role: "assistant", content: text }])

    } catch (err) {
      if (err.name !== "AbortError") {
        setChats(prev => prev.map(chat => {
          if (chat.id !== currentChat) return chat
          return { ...chat, messages: [...chat.messages, { role: "assistant", content: "⚠️ Something went wrong. Please try again." }] }
        }))
      }
    }

    setTyping(false)
    setSending(false)
    sendingRef.current = false
  }

  // ── Background memory extraction ──
  async function extractMemoryFromChat(messages) {
    try {
      const res = await fetch("http://localhost:3001/extract-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      if (data.facts && data.facts.length > 0) {
        setMemory(prev => {
          const merged = [...new Set([...prev, ...data.facts])].slice(-20) // keep last 20
          saveMemory(merged)
          return merged
        })
      }
    } catch { /* silent */ }
  }

  function stopGenerating() {
    abortRef.current?.abort()
    sendingRef.current = false
    setTyping(false)
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function newChat() {
    const id = Date.now()
    setChats(prev => [...prev, { id, title: "New Chat", messages: [] }])
    setCurrentChat(id)
  }

  function startRename(chat) { setEditingChat(chat.id); setEditText(chat.title) }
  function saveRename(chatId) {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editText } : c))
    setEditingChat(null)
  }

  function deleteChat(chatId) {
    const remaining = chats.filter(c => c.id !== chatId)
    if (chatId === currentChat) {
      if (remaining.length > 0) setCurrentChat(remaining[0].id)
      else { const nid = Date.now(); setChats([{ id: nid, title: "New Chat", messages: [] }]); setCurrentChat(nid); return }
    }
    setChats(remaining)
  }

  function copyMessage(text) { navigator.clipboard.writeText(typeof text === "string" ? text : JSON.stringify(text)) }

  function clearMemory() {
    setMemory([])
    saveMemory([])
  }

  // ── Render message content (text or multimodal array) ──
  function renderContent(content) {
    if (typeof content === "string") return <ReactMarkdown>{content}</ReactMarkdown>
    if (Array.isArray(content)) {
      return content.map((part, i) => {
        if (part.type === "text") return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
        if (part.type === "image_url") return (
          <img key={i} src={part.image_url.url} alt="uploaded"
            style={{ maxWidth: "100%", borderRadius: 8, marginTop: 6 }} />
        )
        return null
      })
    }
    return null
  }

  const modelColor = (m) => {
    if (!m) return "#7c3aed"
    if (m.includes("70b")) return "#059669"
    if (m.includes("vision") || m.includes("llava")) return "#0891b2"
    return "#7c3aed"
  }

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="logo">XingGPT</div>

        <button className="newChat" onClick={newChat}>+ New Chat</button>

        {/* Memory panel toggle */}
        <button className="memoryBtn" onClick={() => setShowMemory(v => !v)}>
          🧠 Memory {memory.length > 0 ? `(${memory.length})` : ""}
        </button>

        {showMemory && (
          <div className="memoryPanel">
            <div className="memoryTitle">Long-term Memory</div>
            {memory.length === 0
              ? <div className="memoryEmpty">No memories yet. Chat more!</div>
              : memory.map((fact, i) => (
                <div key={i} className="memoryFact">
                  • {fact}
                  <span className="memoryDel" onClick={() => {
                    const updated = memory.filter((_, j) => j !== i)
                    setMemory(updated); saveMemory(updated)
                  }}>✕</span>
                </div>
              ))
            }
            {memory.length > 0 && (
              <button className="clearMemory" onClick={clearMemory}>Clear All</button>
            )}
          </div>
        )}

        <div className="chatList">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={chat.id === currentChat ? "chatItem active" : "chatItem"}
              onClick={() => setCurrentChat(chat.id)}
              onContextMenu={e => { e.preventDefault(); setMenu({ x: e.pageX, y: e.pageY, chat }) }}
            >
              {editingChat === chat.id ? (
                <input value={editText} autoFocus className="renameInput"
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => saveRename(chat.id)}
                  onKeyDown={e => { if (e.key === "Enter") saveRename(chat.id); if (e.key === "Escape") setEditingChat(null) }}
                />
              ) : (
                <span onDoubleClick={() => startRename(chat)}>{chat.title}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="chatArea">
        {activeChat.messages.length === 0 && (
          <div className="welcome">
            <h1 className="welcomeTitle">XingGPT</h1>
            <p className="welcomeText">
              Now with 🧠 Memory · 🖼️ Vision · ⚡ Auto-routing · 🔧 Tools
            </p>
          </div>
        )}

        <div className="chat">
          {activeChat.messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "userBubble" : "aiBubble"}>
              <button className="copyBtn" onClick={() => copyMessage(m.content)}>Copy</button>
              {renderContent(m.content)}
            </div>
          ))}

          {typing && <div className="aiBubble typing">XingGPT is thinking...</div>}
          <div ref={bottomRef} />
        </div>

        {/* Model / Tools status bar */}
        {(lastModelUsed || lastToolsUsed.length > 0) && (
          <div className="statusBar">
            {lastModelUsed && (
              <span className="modelBadge" style={{ background: modelColor(lastModelUsed) }}>
                ⚡ {lastModelUsed}
              </span>
            )}
            {lastToolsUsed.map(t => (
              <span key={t} className="toolBadge">🔧 {t}</span>
            ))}
          </div>
        )}

        {/* Mode selector */}
        <div className="modeSelector">
          <button className={aiMode === "creative" ? "mode active" : "mode"} onClick={() => setAiMode("creative")}>Creative</button>
          <button className={aiMode === "balanced" ? "mode active" : "mode"} onClick={() => setAiMode("balanced")}>Balanced</button>
          <button className={aiMode === "logical" ? "mode active" : "mode"} onClick={() => setAiMode("logical")}>Logical</button>
        </div>

        {/* Image preview strip */}
        {imagePreview && (
          <div className="imagePreview">
            <img src={imagePreview} alt="preview" />
            <button onClick={removeImage} className="removeImg">✕</button>
          </div>
        )}

        {/* Input row */}
        <div className="inputWrapper">
          <input
            type="file" accept="image/*" ref={fileInputRef}
            style={{ display: "none" }} onChange={handleImagePick}
          />
          <button className="attachBtn" onClick={() => fileInputRef.current?.click()} title="Attach image">
            🖼️
          </button>
          <input
            className="textInput"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={imageFile ? "Ask about the image..." : "Ask XingGPT anything..."}
          />
          <button className="sendBtn" onClick={sending ? stopGenerating : sendMessage}>
            {sending ? "■" : "➤"}
          </button>
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div className="contextMenu" style={{ top: menu.y, left: menu.x }}>
          <div className="menuItem" onClick={() => { startRename(menu.chat); setMenu(null) }}>Rename</div>
          <div className="menuItem delete" onClick={() => { deleteChat(menu.chat.id); setMenu(null) }}>Delete</div>
        </div>
      )}
    </div>
  )
}