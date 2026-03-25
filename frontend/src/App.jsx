import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"

function App(){

const [input,setInput] = useState("")
const [chats,setChats] = useState([{id:1,title:"New Chat",messages:[]}])
const [currentChat,setCurrentChat] = useState(1)

const [aiMode,setAiMode] = useState("balanced")
const [sending,setSending] = useState(false)
const [typing,setTyping] = useState(false)

const [editingChat,setEditingChat] = useState(null)
const [editText,setEditText] = useState("")
const [menu,setMenu] = useState(null)

const bottomRef = useRef(null)

const activeChat = chats.find(c=>c.id===currentChat) || chats[0]

const [abortController,setAbortController] = useState(null)
const sendingRef = useRef(false)

function regenerateResponse(){

  if(sending) return

  const messages = activeChat.messages

  // ambil last user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user")

  if(!lastUserMessage) return

  // hapus last assistant message
  setChats(prev =>
    prev.map(chat=>{
      if(chat.id===currentChat){

        const filtered = [...chat.messages]

        if(filtered[filtered.length-1]?.role === "assistant"){
          filtered.pop()
        }

        return {...chat, messages: filtered}
      }
      return chat
    })
  )

  // kirim ulang
  setTimeout(()=>{
    setInput(lastUserMessage.content)
    sendMessage()
  },100)

}

function getTemperature(){

if(aiMode==="creative") return 1
if(aiMode==="logical") return 0.2
return 0.7

}

async function sendMessage(){

if(sending) return
if(!input.trim()) return

const userMessage={role:"user",content:input}

const controller = new AbortController()
setAbortController(controller)

setSending(true)
sendingRef.current = true

setTyping(true)
setInput("")

setChats(prev =>
prev.map(chat=>{
if(chat.id===currentChat){
return {...chat,messages:[...chat.messages,userMessage]}
}
return chat
})
)

if(activeChat.messages.length===0){

setChats(prev =>
prev.map(chat=>{
if(chat.id===currentChat){
return {...chat,title:input.slice(0,30)}
}
return chat
})
)

}

try{

const response=await fetch("http://localhost:3001/chat",{

method:"POST",
headers:{"Content-Type":"application/json"},
signal: controller.signal,
body:JSON.stringify({

messages:[...activeChat.messages,userMessage],
temperature:getTemperature(),
max_tokens:1500

})

})

const data=await response.json()

const text=data.reply || "⚠️ No response from AI"

let streamed=""

for(let i=0;i<text.length;i++){

if(!sendingRef.current) break

streamed+=text[i]

setChats(prev =>
prev.map(chat=>{
if(chat.id===currentChat){

const messages=[...chat.messages]

if(messages[messages.length-1]?.role==="assistant"){

messages[messages.length-1].content=streamed

}else{

messages.push({role:"assistant",content:streamed})

}

return {...chat,messages}

}

return chat
})
)

await new Promise(r=>setTimeout(r,8))

}

}catch(err){

  if(err.name === "AbortError"){
    console.log("Request stopped by user")
  }else{
    console.error(err)

    // ✅ tampilkan error ke chat UI
    setChats(prev =>
      prev.map(chat=>{
        if(chat.id===currentChat){
          return {
            ...chat,
            messages:[
              ...chat.messages,
              {
                role:"assistant",
                content:"⚠️ Something went wrong. Please try again."
              }
            ]
          }
        }
        return chat
      })
    )

  }

  // ✅ pastikan state reset
  sendingRef.current = false
  setTyping(false)
  setSending(false)

}

setTyping(false)
setSending(false)
sendingRef.current = false

}

function handleKey(e){

if(e.key==="Enter" && !e.shiftKey){

e.preventDefault()
sendMessage()

}

}

function newChat(){

const id=Date.now()

setChats([...chats,{id,title:"New Chat",messages:[]}])
setCurrentChat(id)

}

function startRename(chat){

setEditingChat(chat.id)
setEditText(chat.title)

}

function saveRename(chatId){

setChats(prev =>
prev.map(chat=>{
if(chat.id===chatId){
return {...chat,title:editText}
}
return chat
})
)

setEditingChat(null)

}

function stopGenerating(){
  if(abortController){
    abortController.abort()
  }

  sendingRef.current = false
  setTyping(false)
  setSending(false)
}

function deleteChat(chatId){

setChats(prev => prev.filter(chat => chat.id !== chatId))

if(chatId === currentChat){

const remaining = chats.filter(chat => chat.id !== chatId)

if(remaining.length > 0){
setCurrentChat(remaining[0].id)
}else{
const newId = Date.now()
setChats([{id:newId,title:"New Chat",messages:[]}])
setCurrentChat(newId)
}

}

}

function copyMessage(text){

navigator.clipboard.writeText(text)

}

useEffect(()=>{
bottomRef.current?.scrollIntoView({behavior:"smooth"})
},[activeChat?.messages])

useEffect(()=>{
  const saved = localStorage.getItem("chats")
  if(saved){
    setChats(JSON.parse(saved))
  }
},[])

useEffect(()=>{
  localStorage.setItem("chats", JSON.stringify(chats))
},[chats])

useEffect(()=>{
  const savedCurrent = localStorage.getItem("currentChat")
  if(savedCurrent){
    setCurrentChat(Number(savedCurrent))
  }
},[])

useEffect(()=>{
  localStorage.setItem("currentChat", currentChat)
},[currentChat])

useEffect(()=>{

function closeMenu(){
setMenu(null)
}

window.addEventListener("click",closeMenu)

return ()=>window.removeEventListener("click",closeMenu)

},[])

return(

<div className="layout">

<div className="sidebar">

<div className="logo">XingGPT</div>

<button className="newChat" onClick={newChat}>
+ New Chat
</button>

{chats.map(chat=>(

<div
key={chat.id}
className={chat.id===currentChat?"chatItem active":"chatItem"}
onClick={()=>setCurrentChat(chat.id)}
onContextMenu={(e)=>{

e.preventDefault()

setMenu({
x:e.pageX,
y:e.pageY,
chat
})

}}
>

{editingChat===chat.id ? (

<input
value={editText}
autoFocus
onChange={e=>setEditText(e.target.value)}
onBlur={()=>saveRename(chat.id)}
onKeyDown={(e)=>{
if(e.key==="Enter") saveRename(chat.id)
if(e.key==="Escape") setEditingChat(null)
}}
className="renameInput"
/>

) : (

<span onDoubleClick={()=>startRename(chat)}>
{chat.title}
</span>

)}

</div>

))}

</div>

<div className="chatArea">

{activeChat.messages.length===0 &&(

<div className="welcome">

<h1 className="welcomeTitle">XingGPT</h1>

<p className="welcomeText">
Welcome to XingGPT  
How can I assist you today?
</p>

</div>

)}

<div className="chat">

{activeChat.messages.map((m,i)=>(

<div
key={i}
className={m.role==="user"?"userBubble":"aiBubble"}
>

<div className="copyBtn" onClick={()=>copyMessage(m.content)}>
Copy
</div>

<ReactMarkdown>
{m.content}
</ReactMarkdown>

</div>

))}

{typing &&(

<div className="aiBubble typing">

XingGPT is thinking...

</div>

)}

<div ref={bottomRef}></div>

</div>

<div className="modeSelector">

<button className="mode" onClick={regenerateResponse}>
  ↻ Regenerate
</button>

<button
className={aiMode==="creative"?"mode active":"mode"}
onClick={()=>setAiMode("creative")}
>
Creative
</button>

<button
className={aiMode==="balanced"?"mode active":"mode"}
onClick={()=>setAiMode("balanced")}
>
Balanced
</button>

<button
className={aiMode==="logical"?"mode active":"mode"}
onClick={()=>setAiMode("logical")}
>
Logical
</button>

</div>

<div className="inputWrapper">

<input
value={input}
onChange={e=>setInput(e.target.value)}
onKeyDown={handleKey}
placeholder="Ask XingGPT anything..."
/>

<button
className="sendBtn"
onClick={sending ? stopGenerating : sendMessage}>
    {sending ? "■" : "➤"}
</button>

</div>

</div>

{menu && (

<div
className="contextMenu"
style={{
top:menu.y,
left:menu.x
}}
>

<div
className="menuItem"
onClick={()=>{
startRename(menu.chat)
setMenu(null)
}}
>
Rename
</div>

<div
className="menuItem delete"
onClick={()=>{
deleteChat(menu.chat.id)
setMenu(null)
}}
>
Delete
</div>

</div>

)}

</div>

)

}

export default App