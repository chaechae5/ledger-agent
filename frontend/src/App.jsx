import { useState } from 'react'
import ChatTab from './components/ChatTab.jsx'
import ExpensesTab from './components/ExpensesTab.jsx'
import EditTab from './components/EditTab.jsx'

const TABS = ['채팅', '내역 조회', '수정']

export default function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [refreshExpenses, setRefreshExpenses] = useState(0)

  const triggerRefresh = () => setRefreshExpenses((n) => n + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 헤더 */}
      <header style={styles.header}>
        <span style={styles.logo}>💰 Ledger Agent</span>
      </header>

      {/* 탭 */}
      <nav style={styles.tabBar}>
        {TABS.map((label, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              ...styles.tabBtn,
              ...(activeTab === i ? styles.tabBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* 탭 콘텐츠 */}
      <main style={{ ...styles.main, maxWidth: activeTab === 0 ? 1100 : 800 }}>
        {activeTab === 0 && <ChatTab />}
        {activeTab === 1 && <ExpensesTab refreshKey={refreshExpenses} />}
        {activeTab === 2 && <EditTab onSaved={triggerRefresh} />}
      </main>
    </div>
  )
}

const styles = {
  header: {
    background: '#1a1a2e',
    color: '#fff',
    padding: '14px 24px',
    fontSize: 18,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logo: { letterSpacing: '-0.5px' },
  tabBar: {
    display: 'flex',
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '0 16px',
  },
  tabBtn: {
    padding: '12px 20px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#666',
    borderBottom: '3px solid transparent',
    transition: 'all 0.15s',
  },
  tabBtnActive: {
    color: '#1a1a2e',
    borderBottom: '3px solid #1a1a2e',
  },
  main: {
    flex: 1,
    padding: '24px',
    maxWidth: 800,
    width: '100%',
    margin: '0 auto',
  },
}
