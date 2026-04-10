// api.js — FastAPI 백엔드 호출 함수

const BASE_URL = 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text}`)
  }
  return res.json()
}

export const api = {
  chat: (message, session_id) =>
    request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, session_id }),
    }),

  resume: (message, session_id) =>
    request('/chat/resume', {
      method: 'POST',
      body: JSON.stringify({ message, session_id }),
    }),

  getExpenses: (period, card) => {
    const params = new URLSearchParams()
    if (period && period !== '전체') params.set('period', period)
    if (card) params.set('card', card)
    const qs = params.toString()
    return request(`/expenses${qs ? `?${qs}` : ''}`)
  },

  getExpense: (id) => request(`/expenses/${id}`),

  updateExpense: (id, data) =>
    request(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
