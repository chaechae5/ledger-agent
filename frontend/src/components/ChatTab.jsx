import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api } from '../api.js'

const INTERRUPT_HINTS = [
  '몇 번을 수정할까요?',
  '어떤 내용을 수정할까요?',
  '어떻게 할까요?',
  '언제 항목을 수정할까요?',
]

function getSessionId() {
  let id = localStorage.getItem('ledger_session_id')
  if (!id) {
    id = uuidv4()
    localStorage.setItem('ledger_session_id', id)
  }
  return id
}

function isPendingResponse(text) {
  return INTERRUPT_HINTS.some((hint) => text.includes(hint))
}

export default function ChatTab() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: '안녕하세요! 지출 기록, 조회, 수정을 도와드립니다.' },
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)   // interrupt 대기 중
  const [loading, setLoading] = useState(false)
  const sessionId = useRef(getSessionId())
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const fn = pending ? api.resume : api.chat
      const res = await fn(text, sessionId.current)
      setPending(res.is_pending)
      setMessages((m) => [...m, { role: 'ai', text: res.response }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: `오류: ${e.message}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function resetSession() {
    localStorage.removeItem('ledger_session_id')
    sessionId.current = getSessionId()
    setPending(false)
    setMessages([{ role: 'ai', text: '새 세션을 시작합니다.' }])
  }

  return (
    <div style={styles.wrap}>
      {/* 메시지 목록 */}
      <div style={styles.messageList}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#1a1a2e' : m.error ? '#fde8e8' : '#fff',
              color: m.role === 'user' ? '#fff' : '#1a1a1a',
              border: m.role === 'user' ? 'none' : '1px solid #e0e0e0',
            }}
          >
            <pre style={styles.pre}>{m.text}</pre>
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.bubble, background: '#fff', border: '1px solid #e0e0e0', alignSelf: 'flex-start' }}>
            <span style={styles.dots}>...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* interrupt 안내 */}
      {pending && (
        <div style={styles.pendingBanner}>
          답변을 기다리고 있어요. 위 질문에 답해주세요.
        </div>
      )}

      {/* 입력창 */}
      <div style={styles.inputRow}>
        <textarea
          style={styles.textarea}
          rows={2}
          placeholder={pending ? '질문에 답변해주세요...' : '메시지를 입력하세요... (Enter 전송)'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <div style={styles.btnCol}>
          <button onClick={send} disabled={loading || !input.trim()} style={styles.sendBtn}>
            전송
          </button>
          <button onClick={resetSession} style={styles.resetBtn} title="세션 초기화">
            ↺
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 130px)',
    gap: 12,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '4px 0',
  },
  bubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.6,
  },
  pre: {
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  dots: { fontSize: 20, letterSpacing: 2 },
  pendingBanner: {
    background: '#fff8e1',
    border: '1px solid #ffe082',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    color: '#7a6000',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #ccc',
    fontSize: 14,
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
  },
  btnCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sendBtn: {
    padding: '8px 16px',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    opacity: 1,
  },
  resetBtn: {
    padding: '6px',
    background: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    color: '#555',
  },
}
