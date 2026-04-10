import { useState, useEffect } from 'react'
import { api } from '../api.js'

const PERIODS = ['오늘', '이번주', '이번달', '전체']
const CARDS = ['', '삼성카드', '현대카드', '국민카드', '신한카드', '하나카드', '기타']

export default function ExpensesTab({ refreshKey }) {
  const [period, setPeriod] = useState('이번달')
  const [card, setCard] = useState('')
  const [expenses, setExpenses] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchExpenses()
  }, [period, card, refreshKey])

  async function fetchExpenses() {
    setLoading(true)
    setError(null)
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
                {['ID', '날짜', '카테고리', '금액', '카드', '메모'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={{ ...styles.td, color: '#999', fontSize: 12 }}>{row.id}</td>
                  <td style={styles.td}>{row.date}</td>
                  <td style={styles.td}>{row.category}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                    {row.amount.toLocaleString()}원
                  </td>
                  <td style={{ ...styles.td, color: '#666' }}>{row.card || '현금'}</td>
                  <td style={{ ...styles.td, color: '#666' }}>{row.memo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
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
  periodBtnActive: {
    background: '#1a1a2e',
    color: '#fff',
    border: '1px solid #1a1a2e',
  },
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
  totalAmount: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  tableWrap: {
    overflowX: 'auto',
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e0e0e0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    padding: '11px 14px',
    background: '#f8f8f8',
    textAlign: 'left',
    fontWeight: 600,
    color: '#444',
    borderBottom: '1px solid #e0e0e0',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  loading: { textAlign: 'center', color: '#999', padding: 40 },
  empty:   { textAlign: 'center', color: '#999', padding: 40 },
  error:   { color: '#c00', background: '#fde8e8', padding: '10px 14px', borderRadius: 8 },
}
