// AgentLogPanel.jsx — LangGraph 노드 실행 로그 시각화 패널

// ── 노드 메타 정보 ─────────────────────────────────────────────
const NODE_META = {
  intent_node:                  { label: '의도 분류',       color: '#7c3aed', bg: '#f3e8ff', icon: '🔍' },
  parse_node:                   { label: '자연어 파싱',     color: '#2563eb', bg: '#eff6ff', icon: '📝' },
  validate_node:                { label: '금액 검증',       color: '#d97706', bg: '#fffbeb', icon: '✔️' },
  save_node:                    { label: 'DB 저장',         color: '#059669', bg: '#ecfdf5', icon: '💾' },
  search_node:                  { label: '내역 조회',       color: '#0891b2', bg: '#ecfeff', icon: '🔎' },
  update_search_node:           { label: '수정 후보 조회',  color: '#0891b2', bg: '#ecfeff', icon: '🔎' },
  choose_update_target_node:    { label: '수정 대상 선택',  color: '#d97706', bg: '#fffbeb', icon: '👆' },
  confirm_update_content_node:  { label: '수정 내용 확인',  color: '#d97706', bg: '#fffbeb', icon: '✏️' },
  parse_update_command_node:    { label: '수정 명령 파싱',  color: '#2563eb', bg: '#eff6ff', icon: '📝' },
  apply_update_node:            { label: 'DB 수정',         color: '#059669', bg: '#ecfdf5', icon: '✅' },
  output_node:                  { label: '응답 생성',       color: '#6b7280', bg: '#f9fafb', icon: '💬' },
  __interrupt__:                { label: '입력 대기',       color: '#dc2626', bg: '#fef2f2', icon: '⏸' },
}

// ── 노드별 핵심 출력 요약 ──────────────────────────────────────
function getSummary(node, output) {
  if (!output || Object.keys(output).length === 0) return null

  switch (node) {
    case 'intent_node':
      return output.intent
        ? <span>intent: <b style={{ color: intentColor(output.intent) }}>{output.intent}</b></span>
        : null

    case 'parse_node': {
      const d = output.parsed_data || {}
      const parts = [
        d.date,
        d.amount != null ? `${Number(d.amount).toLocaleString()}원` : null,
        d.category,
        d.card,
      ].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }

    case 'validate_node':
      if (output.intent === 'search') return '→ 조회로 전환'
      if (output.parsed_data === null) return '→ 재입력 요청'
      return null

    case 'search_node':
    case 'update_search_node': {
      const count = output.search_result?.length
      const period = output.search_filters?.period_label
      const parts = [
        period ? `기간: ${period}` : null,
        count != null ? `${count}건 조회` : null,
      ].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }

    case 'choose_update_target_node':
      if (output.selected_update_index)
        return `${output.selected_update_index}번 선택`
      if (output.response) return <span style={{ color: '#dc2626' }}>{output.response}</span>
      return null

    case 'parse_update_command_node': {
      const cmd = output.update_command || {}
      const changes = Object.entries(cmd)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
      return changes.length ? changes.join(', ') : null
    }

    case 'apply_update_node': {
      const row = output.updated_row
      if (row) {
        return `${row.date} · ${row.category} · ${Number(row.amount).toLocaleString()}원`
      }
      if (output.response) return <span style={{ color: '#dc2626' }}>{output.response}</span>
      return null
    }

    case 'output_node': {
      const firstLine = (output.response || '').split('\n')[0]
      return firstLine ? firstLine.slice(0, 50) + (firstLine.length > 50 ? '…' : '') : null
    }

    case '__interrupt__':
      return output.message
        ? (output.message.slice(0, 70) + (output.message.length > 70 ? '…' : ''))
        : null

    default:
      return null
  }
}

function intentColor(intent) {
  if (intent === 'input')  return '#059669'
  if (intent === 'search') return '#2563eb'
  if (intent === 'update') return '#d97706'
  return '#6b7280'
}

// ── 개별 로그 엔트리 ───────────────────────────────────────────
function LogEntry({ log, isLast }) {
  const meta = NODE_META[log.node] || { label: log.node, color: '#6b7280', bg: '#f9fafb', icon: '▸' }
  const summary = getSummary(log.node, log.output)

  return (
    <div style={styles.entryWrap}>
      {/* 스텝 라인 */}
      <div style={styles.timeline}>
        <div style={{ ...styles.dot, background: meta.color }} />
        {!isLast && <div style={{ ...styles.line, background: meta.color + '40' }} />}
      </div>

      {/* 카드 */}
      <div style={{ ...styles.card, borderLeft: `3px solid ${meta.color}`, background: meta.bg }}>
        <div style={styles.cardHeader}>
          <span style={styles.icon}>{meta.icon}</span>
          <span style={{ ...styles.nodeLabel, color: meta.color }}>{meta.label}</span>
          <span style={styles.step}>#{log.step}</span>
        </div>
        {summary && (
          <div style={styles.summary}>{summary}</div>
        )}
      </div>
    </div>
  )
}

// ── 메인 패널 ──────────────────────────────────────────────────
export default function AgentLogPanel({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <span>🤖 실행 로그</span>
          <span style={styles.devBadge}>DEV</span>
        </div>
        <div style={styles.empty}>
          메시지를 보내면<br />노드 실행 흐름이<br />여기에 표시돼요
        </div>
      </div>
    )
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span>🤖 실행 로그</span>
        <span style={styles.devBadge}>DEV</span>
      </div>
      <div style={styles.logList}>
        {logs.map((log, i) => (
          <LogEntry key={i} log={log} isLast={i === logs.length - 1} />
        ))}
      </div>
    </div>
  )
}

// ── 스타일 ─────────────────────────────────────────────────────
const styles = {
  panel: {
    width: 260,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    height: 'calc(100vh - 130px)',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#1a1a2e',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  devBadge: {
    fontSize: 10,
    background: '#f59e0b',
    color: '#1a1a2e',
    borderRadius: 4,
    padding: '2px 6px',
    fontWeight: 800,
    letterSpacing: 1,
  },
  logList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 1.8,
    padding: 20,
  },
  entryWrap: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 6,
    width: 12,
    flexShrink: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 12,
    marginTop: 2,
  },
  card: {
    flex: 1,
    borderRadius: 8,
    padding: '6px 10px',
    marginBottom: 6,
    fontSize: 12,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  icon: {
    fontSize: 12,
  },
  nodeLabel: {
    fontWeight: 700,
    flex: 1,
  },
  step: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: 500,
  },
  summary: {
    marginTop: 4,
    color: '#374151',
    fontSize: 11,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
}
