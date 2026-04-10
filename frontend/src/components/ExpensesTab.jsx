import { useState, useEffect } from 'react'
import { api } from '../api.js'

const PERIODS = ['오늘', '이번주', '이번달', '전체']
const CARDS = ['', '삼성카드', '현대카드', '국민카드', '신한카드', '하나카드', '기타']

const EMPTY_FORM = { date: '', amount: '', category: '', card: '', memo: '' }

export default function ExpensesTab({ refreshKey }) {
  const [period, setPeriod]       = useState('이번달')
  const [card, setCard]           = useState('')
  const [expenses, setExpenses]   = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  const [selectedId, setSelectedId] = useState(null)   // 선택된 행 ID
  const [editMode, setEditMode]     = useState(false)   // 수정 폼 표시 여부
  const [editForm, setEditForm]     = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false) // 삭제 확인 표시 여부

  useEffect(() => {
    fetchExpenses()
  }, [period, card, refreshKey])

  // 목록 리프레시 시 선택 초기화
  async function fetchExpenses() {
    setLoading(true)
    setError(null)
    setSelectedId(null)
    setEditMode(false)
    setDeleteConfirm(false)
    try {
      const data = await api.getExpenses(period, card || undefined)
      setExpenses(data.expenses)
      setTotal(data.total)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // 행 클릭 → 선택/해제 토글
  function handleRowClick(row) {
    if (selectedId === row.id) {
      clearSelection()
    } else {
      setSelectedId(row.id)
      setEditMode(false)
      setDeleteConfirm(false)
      setEditForm({
        date:     row.date     ?? '',
        amount:   row.amount   ?? '',
        category: row.category ?? '',
        card:     row.card     ?? '',
        memo:     row.memo     ?? '',
      })
    }
  }

  function clearSelection() {
    setSelectedId(null)
    setEditMode(false)
    setDeleteConfirm(false)
    setEditForm(EMPTY_FORM)
  }

  // 수정 저장
  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    try {
      await api.updateExpense(selectedId, {
        ...editForm,
        amount: editForm.amount ? Number(editForm.amount) : undefined,
      })
      await fetchExpenses()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // 삭제 실행
  async function handleDelete() {
    if (!selectedId) return
    setSaving(true)
    try {
      await api.deleteExpense(selectedId)
      await fetchExpenses()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const selectedRow = expenses.find((e) => e.id === selectedId)

  return (
    <div style={styles.wrap}>
      {/* 필터 */}
      <div style={styles.filterRow}>
        <div style={styles.btnGroup}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{ ...styles.periodBtn, ...(period === p ? styles.periodBtnActive : {}) }}
            >
              {p}
            </button>
          ))}
        </div>
        <select value={card} onChange={(e) => setCard(e.target.value)} style={styles.select}>
          <option value="">전체 카드</option>
          {CARDS.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 합계 */}
      <div style={styles.totalBar}>
        <span>{period} {card ? `· ${card}` : ''} 합계</span>
        <span style={styles.totalAmount}>{total.toLocaleString()}원</span>
      </div>

      {/* 에러 */}
      {error && <div style={styles.error}>{error}</div>}

      {/* 테이블 */}
      {loading ? (
        <div style={styles.loading}>불러오는 중...</div>
      ) : expenses.length === 0 ? (
        <div style={styles.empty}>내역이 없습니다.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['날짜', '카테고리', '금액', '카드', '메모'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => {
                const isSelected = row.id === selectedId
                return (
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row)}
                    style={{
                      ...styles.tr,
                      background: isSelected ? '#eef2ff' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}>{row.category}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                      {row.amount.toLocaleString()}원
                    </td>
                    <td style={{ ...styles.td, color: '#666' }}>{row.card || '현금'}</td>
                    <td style={{ ...styles.td, color: '#666' }}>{row.memo || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 액션 패널 (행 선택 시 표시) ── */}
      {selectedRow && (
        <div style={styles.actionPanel}>
          {/* 선택 정보 + 버튼 */}
          <div style={styles.actionBar}>
            <span style={styles.actionLabel}>
              선택: <b>{selectedRow.date}</b> · {selectedRow.category} ·{' '}
              <b>{selectedRow.amount.toLocaleString()}원</b>
            </span>
            <div style={styles.actionBtns}>
              <button
                onClick={() => { setEditMode((v) => !v); setDeleteConfirm(false) }}
                style={{ ...styles.editBtn, ...(editMode ? styles.editBtnActive : {}) }}
              >
                ✏️ 수정
              </button>
              <button
                onClick={() => { setDeleteConfirm((v) => !v); setEditMode(false) }}
                style={{ ...styles.deleteBtn, ...(deleteConfirm ? styles.deleteBtnActive : {}) }}
              >
                🗑 삭제
              </button>
              <button onClick={clearSelection} style={styles.cancelBtn}>✕</button>
            </div>
          </div>

          {/* 수정 폼 */}
          {editMode && (
            <div style={styles.editForm}>
              <div style={styles.formGrid}>
                <label style={styles.label}>날짜
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>금액
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    style={styles.input}
                    placeholder="원"
                  />
                </label>
                <label style={styles.label}>카테고리
                  <input
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>카드
                  <select
                    value={editForm.card}
                    onChange={(e) => setEditForm((f) => ({ ...f, card: e.target.value }))}
                    style={styles.input}
                  >
                    <option value="">현금</option>
                    {CARDS.filter(Boolean).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label style={{ ...styles.label, gridColumn: '1 / -1' }}>메모
                  <input
                    value={editForm.memo}
                    onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                    style={styles.input}
                  />
                </label>
              </div>
              <div style={styles.formActions}>
                <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setEditMode(false)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          )}

          {/* 삭제 확인 */}
          {deleteConfirm && (
            <div style={styles.deleteConfirm}>
              <span>정말 삭제할까요? 이 작업은 되돌릴 수 없어요.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDelete} disabled={saving} style={styles.deleteConfirmBtn}>
                  {saving ? '삭제 중...' : '삭제'}
                </button>
                <button onClick={() => setDeleteConfirm(false)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  filterRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  btnGroup: { display: 'flex', gap: 6 },
  periodBtn: {
    padding: '7px 14px',
    border: '1px solid #ccc',
    borderRadius: 20,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    color: '#555',
    transition: 'all 0.15s',
  },
  periodBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  select: {
    padding: '7px 12px',
    border: '1px solid #ccc',
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    cursor: 'pointer',
  },
  totalBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    padding: '12px 18px',
    fontSize: 14,
    color: '#555',
  },
  totalAmount: { fontSize: 20, fontWeight: 700, color: '#1a1a2e' },
  tableWrap: {
    overflowX: 'auto',
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e0e0e0',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    padding: '11px 14px',
    background: '#f8f8f8',
    textAlign: 'left',
    fontWeight: 600,
    color: '#444',
    borderBottom: '1px solid #e0e0e0',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  loading: { textAlign: 'center', color: '#999', padding: 40 },
  empty:   { textAlign: 'center', color: '#999', padding: 40 },
  error:   { color: '#c00', background: '#fde8e8', padding: '10px 14px', borderRadius: 8 },

  // 액션 패널
  actionPanel: {
    background: '#fff',
    border: '1px solid #c7d2fe',
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#eef2ff',
    gap: 12,
    flexWrap: 'wrap',
  },
  actionLabel: { fontSize: 14, color: '#3730a3' },
  actionBtns: { display: 'flex', gap: 8, alignItems: 'center' },
  editBtn: {
    padding: '6px 14px',
    border: '1px solid #6366f1',
    borderRadius: 7,
    background: '#fff',
    color: '#6366f1',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  editBtnActive: { background: '#6366f1', color: '#fff' },
  deleteBtn: {
    padding: '6px 14px',
    border: '1px solid #ef4444',
    borderRadius: 7,
    background: '#fff',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  deleteBtnActive: { background: '#ef4444', color: '#fff' },
  cancelBtn: {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: 7,
    background: '#f9fafb',
    color: '#555',
    cursor: 'pointer',
    fontSize: 13,
  },

  // 수정 폼
  editForm: { padding: '16px' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px 16px',
    marginBottom: 14,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    color: '#555',
    fontWeight: 500,
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: 7,
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  formActions: { display: 'flex', gap: 8 },
  saveBtn: {
    padding: '8px 20px',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },

  // 삭제 확인
  deleteConfirm: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: '#fff5f5',
    borderTop: '1px solid #fecaca',
    fontSize: 14,
    color: '#b91c1c',
    gap: 12,
    flexWrap: 'wrap',
  },
  deleteConfirmBtn: {
    padding: '7px 18px',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
}
