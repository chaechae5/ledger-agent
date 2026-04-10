import { useState } from 'react'
import { api } from '../api.js'

const EMPTY_FORM = { date: '', amount: '', category: '', card: '', memo: '' }

export default function EditTab({ onSaved }) {
  const [idInput, setIdInput] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [saveResult, setSaveResult] = useState(null)

  async function loadExpense() {
    const id = parseInt(idInput)
    if (!id) return
    setFetchError(null)
    setSaveResult(null)
    setLoaded(false)

    try {
      // GET /expenses?period=전체 후 id로 찾기
      const data = await api.getExpenses()
      const found = data.expenses.find((e) => e.id === id)
      if (!found) throw new Error(`ID ${id} 내역을 찾을 수 없습니다.`)
      setForm({
        date: found.date ?? '',
        amount: String(found.amount ?? ''),
        category: found.category ?? '',
        card: found.card ?? '',
        memo: found.memo ?? '',
      })
      setLoaded(true)
    } catch (e) {
      setFetchError(e.message)
    }
  }

  function handleChange(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function save() {
    const id = parseInt(idInput)
    if (!id || !loaded) return
    setSaving(true)
    setSaveResult(null)

    try {
      const payload = {
        date: form.date || null,
        amount: form.amount ? parseInt(form.amount) : null,
        category: form.category || null,
        card: form.card || null,
        memo: form.memo || null,
      }
      const res = await api.updateExpense(id, payload)
      setSaveResult({ ok: true, expense: res.expense })
      onSaved()
    } catch (e) {
      setSaveResult({ ok: false, message: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>내역 직접 수정</h2>

      {/* ID 조회 */}
      <div style={styles.idRow}>
        <input
          type="number"
          placeholder="수정할 ID 입력"
          value={idInput}
          onChange={(e) => { setIdInput(e.target.value); setLoaded(false); setSaveResult(null) }}
          style={styles.idInput}
          min={1}
        />
        <button onClick={loadExpense} disabled={!idInput} style={styles.loadBtn}>
          불러오기
        </button>
      </div>

      {fetchError && <div style={styles.error}>{fetchError}</div>}

      {/* 수정 폼 */}
      {loaded && (
        <div style={styles.card}>
          <div style={styles.formGrid}>
            {[
              { label: '날짜', field: 'date', type: 'date' },
              { label: '금액 (원)', field: 'amount', type: 'number' },
              { label: '카테고리', field: 'category', type: 'text' },
              { label: '카드사', field: 'card', type: 'text' },
              { label: '메모', field: 'memo', type: 'text' },
            ].map(({ label, field, type }) => (
              <div key={field} style={styles.fieldWrap}>
                <label style={styles.label}>{label}</label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={handleChange(field)}
                  style={styles.input}
                />
              </div>
            ))}
          </div>

          <button onClick={save} disabled={saving} style={styles.saveBtn}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {/* 저장 결과 */}
      {saveResult && (
        <div style={{ ...styles.result, background: saveResult.ok ? '#e8f5e9' : '#fde8e8', border: `1px solid ${saveResult.ok ? '#a5d6a7' : '#ef9a9a'}` }}>
          {saveResult.ok ? (
            <>
              <strong>✅ 저장 완료</strong>
              <pre style={styles.pre}>
                {`날짜: ${saveResult.expense.date}
금액: ${saveResult.expense.amount?.toLocaleString()}원
카테고리: ${saveResult.expense.category}
카드: ${saveResult.expense.card || '미지정'}
메모: ${saveResult.expense.memo || '-'}`}
              </pre>
            </>
          ) : (
            <span>❌ {saveResult.message}</span>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a2e' },
  idRow: { display: 'flex', gap: 8 },
  idInput: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #ccc',
    borderRadius: 8,
    fontSize: 14,
  },
  loadBtn: {
    padding: '10px 18px',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  card: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 12 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    padding: '9px 12px',
    border: '1px solid #ccc',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '11px',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 700,
  },
  result: {
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 14,
  },
  pre: { fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, lineHeight: 1.7 },
  error: { color: '#c00', background: '#fde8e8', padding: '10px 14px', borderRadius: 8, fontSize: 14 },
}
