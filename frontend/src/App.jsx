import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"

// ─── Memory helpers ────────────────────────────────────────────────────────
const MEMORY_KEY = "xinggpt_memory"
function loadMemory() {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY)) || [] } catch { return [] }
}
function saveMemory(facts) { localStorage.setItem(MEMORY_KEY, JSON.stringify(facts)) }

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ─── SVG Icon components ──────────────────────────────────────────────────
const Icon = {
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Brain: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 5 2.5 2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1-2.5 5H7a2.5 2.5 0 0 1-2.5-5 2.5 2.5 0 0 1 0-5A2.5 2.5 0 0 1 9.5 2"/>
    </svg>
  ),
  Image: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  File: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Mic: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  ),
  MicOff: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  ),
  Music: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  Send: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Stop: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
  ),
  Copy: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Download: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Search: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Zap: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Tool: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  Rename: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  Spinner: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        style={{animation:'spin 1s linear infinite', transformOrigin:'center'}}/>
    </svg>
  ),
}

// Feature chips for welcome screen
const features = [
  { icon: <Icon.Brain />, label: "Memory" },
  { icon: <Icon.Image />, label: "Vision" },
  { icon: <Icon.Zap />, label: "Auto-routing" },
  { icon: <Icon.Tool />, label: "Tools" },
  { icon: <Icon.Search />, label: "Web Search" },
  { icon: <Icon.File />, label: "PDF" },
  { icon: <Icon.Mic />, label: "Audio" },
]

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
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [lastModelUsed, setLastModelUsed] = useState(null)
  const [lastToolsUsed, setLastToolsUsed] = useState([])
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [pdfStatus, setPdfStatus] = useState(null)
  const [audioStatus, setAudioStatus] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const audioChunksRef = useRef([])

  const bottomRef = useRef(null)
  const sendingRef = useRef(false)
  const abortRef = useRef(null)
  const imageInputRef = useRef(null)
  const pdfInputRef = useRef(null)
  const audioInputRef = useRef(null)

  const activeChat = chats.find(c => c.id === currentChat) || chats[0]

  // ── Persist ──
  useEffect(() => {
    const saved = localStorage.getItem("chats")
    if (saved) setChats(JSON.parse(saved))
    const savedCurrent = localStorage.getItem("currentChat")
    if (savedCurrent) setCurrentChat(Number(savedCurrent))
  }, [])
  useEffect(() => { localStorage.setItem("chats", JSON.stringify(chats)) }, [chats])
  useEffect(() => { localStorage.setItem("currentChat", String(currentChat)) }, [currentChat])
  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeChat?.messages])

  // Add CSS spinner keyframe dynamically
  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  function getTemperature() {
    if (aiMode === "creative") return 1
    if (aiMode === "logical") return 0.2
    return 0.7
  }

  // ── Push helpers ──
  function pushMessage(role, content) {
    setChats(prev => prev.map(chat => {
      if (chat.id !== currentChat) return chat
      const messages = [...chat.messages, { role, content }]
      const title = chat.messages.length === 0 && typeof content === "string"
        ? content.slice(0, 30) : chat.title
      return { ...chat, messages, title }
    }))
  }

  async function pushAssistantStreamed(text) {
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
  }

  // ── Image ──
  async function handleImagePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(await fileToBase64(file))
  }
  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  // ── PDF ──
  async function handlePdfPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (pdfInputRef.current) pdfInputRef.current.value = ""
    setPdfStatus("loading")
    pushMessage("user", `Summarize PDF: **${file.name}**`)
    setSending(true); sendingRef.current = true; setTyping(true)
    try {
      const form = new FormData()
      form.append("pdf", file)
      const res = await fetch("http://localhost:3001/summarize-pdf", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "PDF processing failed")
      await pushAssistantStreamed(`**PDF Summary** (${data.pages} pages${data.truncated ? ", truncated" : ""})\n\n${data.summary}`)
      setPdfStatus("done")
    } catch (err) {
      pushMessage("assistant", `PDF Error: ${err.message}`)
      setPdfStatus("error")
    }
    setTyping(false); setSending(false); sendingRef.current = false
  }

  // ── Audio ──
  async function transcribeAudioFile(file) {
    setAudioStatus("processing")
    pushMessage("user", `Transcribe audio: **${file.name}**`)
    setSending(true); sendingRef.current = true; setTyping(true)
    try {
      const form = new FormData()
      form.append("audio", file)
      const res = await fetch("http://localhost:3001/transcribe-audio", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Transcription failed")
      await pushAssistantStreamed(`**Transcript:**\n\n${data.transcript}`)
      setAudioStatus("done")
    } catch (err) {
      pushMessage("assistant", `Audio Error: ${err.message}`)
      setAudioStatus("error")
    }
    setTyping(false); setSending(false); sendingRef.current = false
  }

  async function handleAudioFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (audioInputRef.current) audioInputRef.current.value = ""
    await transcribeAudioFile(file)
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorder?.stop()
      setIsRecording(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        audioChunksRef.current = []
        recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          await transcribeAudioFile(new File([blob], "recording.webm", { type: "audio/webm" }))
        }
        recorder.start()
        setMediaRecorder(recorder)
        setIsRecording(true)
      } catch (err) { alert("Microphone access denied: " + err.message) }
    }
  }

  // ── Send chat ──
  async function sendMessage() {
    if (sending) return
    if (!input.trim() && !imageFile) return

    const controller = new AbortController()
    abortRef.current = controller

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
    const displayText = input || "Image uploaded"

    setSending(true); sendingRef.current = true; setTyping(true)
    setInput(""); removeImage()

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
        body: JSON.stringify({ messages: [...activeChat.messages, userMessage], temperature: getTemperature(), max_tokens: 1500, memory })
      })
      const data = await response.json()
      const text = data.reply || "No response from AI"

      if (data.model_used) setLastModelUsed(data.model_used)
      if (data.tools_used) setLastToolsUsed(data.tools_used)

      await pushAssistantStreamed(text)
      extractMemoryFromChat([...activeChat.messages, userMessage, { role: "assistant", content: text }])
    } catch (err) {
      if (err.name !== "AbortError") pushMessage("assistant", "Something went wrong. Please try again.")
    }

    setTyping(false); setSending(false); sendingRef.current = false
  }

  async function extractMemoryFromChat(messages) {
    try {
      const res = await fetch("http://localhost:3001/extract-memory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      if (data.facts?.length > 0) {
        setMemory(prev => {
          const merged = [...new Set([...prev, ...data.facts])].slice(-20)
          saveMemory(merged)
          return merged
        })
      }
    } catch { }
  }

  function stopGenerating() {
    abortRef.current?.abort()
    mediaRecorder?.stop()
    sendingRef.current = false
    setTyping(false); setSending(false); setIsRecording(false)
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
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

  function copyMessage(content, idx) {
    const text = typeof content === "string" ? content : JSON.stringify(content)
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1800)
  }

  function clearMemory() { setMemory([]); saveMemory([]) }

  // ── Chat export ──
  function exportChat() {
    if (!activeChat.messages.length) return
    const lines = [`XingGPT — ${activeChat.title}`, `Exported: ${new Date().toLocaleString()}`, "=".repeat(50), ""]
    activeChat.messages.forEach(m => {
      const role = m.role === "user" ? "You" : "XingGPT"
      const content = typeof m.content === "string" ? m.content : "[Image/Media]"
      lines.push(`[${role}]`)
      lines.push(content)
      lines.push("")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeChat.title.replace(/[^a-z0-9]/gi, "_")}_export.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function renderContent(content) {
    if (typeof content === "string") return <ReactMarkdown>{content}</ReactMarkdown>
    if (Array.isArray(content)) return content.map((part, i) => {
      if (part.type === "text") return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
      if (part.type === "image_url") return (
        <img key={i} src={part.image_url.url} alt="uploaded"
          style={{ maxWidth: "100%", borderRadius: 8, marginTop: 6, display: "block" }} />
      )
      return null
    })
    return null
  }

  const modelColor = m => {
    if (!m) return "#7c3aed"
    if (m.includes("70b")) return "#059669"
    if (m.includes("llava") || m.includes("vision")) return "#0891b2"
    return "#7c3aed"
  }

  return (
    <div className="layout">
      {/* ════ SIDEBAR ════ */}
      <div className="sidebar">
        <div className="logo">XingGPT</div>

        <button className="newChat" onClick={newChat}>
          <Icon.Plus /> New Chat
        </button>

        <button className="memoryBtn" onClick={() => setShowMemory(v => !v)}>
          <Icon.Brain />
          Memory
          {memory.length > 0 && <span className="memoryCount">{memory.length}</span>}
        </button>

        {showMemory && (
          <div className="memoryPanel">
            <div className="memoryTitle">Long-term Memory</div>
            {memory.length === 0
              ? <div className="memoryEmpty">No memories yet. Chat more!</div>
              : memory.map((fact, i) => (
                <div key={i} className="memoryFact">
                  {fact}
                  <span className="memoryDel" onClick={() => {
                    const updated = memory.filter((_, j) => j !== i)
                    setMemory(updated); saveMemory(updated)
                  }}>✕</span>
                </div>
              ))
            }
            {memory.length > 0 && <button className="clearMemory" onClick={clearMemory}>Clear all</button>}
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

      {/* ════ CHAT AREA ════ */}
      <div className="chatArea">

        {activeChat.messages.length === 0 && (
          <div className="welcome">
            <div className="welcomeGlow" />
            <h1 className="welcomeTitle">XingGPT</h1>
            <p className="welcomeCaption">Your intelligent AI agent</p>
            <div className="welcomeFeatures">
              {features.map(f => (
                <div key={f.label} className="featureChip">
                  {f.icon} {f.label}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="chat">
          {activeChat.messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "userBubble" : "aiBubble"}>
              <button className="copyBtn" onClick={() => copyMessage(m.content, i)}>
                {copiedIdx === i ? <Icon.Check /> : <Icon.Copy />}
                {copiedIdx === i ? "Copied" : "Copy"}
              </button>
              {renderContent(m.content)}
            </div>
          ))}

          {typing && (
            <div className="typing">
              <div className="typingDot" />
              <div className="typingDot" />
              <div className="typingDot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Status bar */}
        {(lastModelUsed || lastToolsUsed.length > 0) && (
          <div className="statusBar">
            {lastModelUsed && (
              <span className="modelBadge" style={{ background: modelColor(lastModelUsed) }}>
                <Icon.Zap /> {lastModelUsed}
              </span>
            )}
            {[...new Set(lastToolsUsed)].map(t => (
              <span key={t} className="toolBadge">
                <Icon.Tool />
                {t}{lastToolsUsed.filter(x => x === t).length > 1 ? ` ×${lastToolsUsed.filter(x => x === t).length}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Bottom controls row */}
        <div className="bottomControls">
          <div className="modeSelector">
            {["creative", "balanced", "logical"].map(m => (
              <button key={m} className={aiMode === m ? "mode active" : "mode"} onClick={() => setAiMode(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {activeChat.messages.length > 0 && (
            <button className="exportBtn" onClick={exportChat}>
              <Icon.Download /> Export
            </button>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="imagePreview">
            <img src={imagePreview} alt="preview" />
            <button onClick={removeImage} className="removeImg">✕</button>
          </div>
        )}

        {/* Input row */}
        <div className="inputWrapper">
          <input type="file" accept="image/*" ref={imageInputRef} style={{ display: "none" }} onChange={handleImagePick} />
          <input type="file" accept=".pdf" ref={pdfInputRef} style={{ display: "none" }} onChange={handlePdfPick} />
          <input type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg" ref={audioInputRef} style={{ display: "none" }} onChange={handleAudioFilePick} />

          <button className="attachBtn" onClick={() => imageInputRef.current?.click()} title="Attach image" disabled={sending}>
            <Icon.Image />
          </button>
          <button className="attachBtn" onClick={() => pdfInputRef.current?.click()} title="Summarize PDF" disabled={sending}>
            {pdfStatus === "loading" ? <Icon.Spinner /> : <Icon.File />}
          </button>
          <button
            className={`attachBtn ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop recording" : "Record voice"}
            disabled={sending && !isRecording}
          >
            {isRecording ? <Icon.MicOff /> : audioStatus === "processing" ? <Icon.Spinner /> : <Icon.Mic />}
          </button>
          <button className="attachBtn" onClick={() => audioInputRef.current?.click()} title="Upload audio file" disabled={sending}>
            {audioStatus === "processing" ? <Icon.Spinner /> : <Icon.Music />}
          </button>

          <input
            className="textInput"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              isRecording ? "Recording... click mic to stop" :
              imageFile ? "Ask about the image..." :
              "Ask XingGPT anything..."
            }
            disabled={isRecording}
          />

          <button className="sendBtn" onClick={sending ? stopGenerating : sendMessage} title={sending ? "Stop" : "Send"}>
            {sending ? <Icon.Stop /> : <Icon.Send />}
          </button>
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div className="contextMenu" style={{ top: menu.y, left: menu.x }} onClick={e => e.stopPropagation()}>
          <div className="menuItem" onClick={() => { startRename(menu.chat); setMenu(null) }}>
            <Icon.Rename /> Rename
          </div>
          <div className="menuItem delete" onClick={() => { deleteChat(menu.chat.id); setMenu(null) }}>
            <Icon.Trash /> Delete
          </div>
        </div>
      )}
    </div>
  )
}