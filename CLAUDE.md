# CLAUDE.md

## 프로젝트 개요
- AI Agent 기반 자연어 가계부 서비스
- LangGraph + FastAPI + React Native(Expo)

## 기술 스택
- Backend: FastAPI, LangGraph, SQLite
- Frontend: Expo (React Native)
- LLM: GPT-4o-mini

## 코딩 컨벤션
- Python: snake_case
- 함수 상단에 역할 주석 필수
- 타입 힌트 필수

## 커밋 메시지
- 한글로 작성
- 예: "feat: 수정 플로우 interrupt 추가"
- 예: "fix: update_search_node 필터 버그 수정"
- Co-Authored-By 제거

## 주의사항
- .env 파일 절대 커밋 금지
- OPENAI_API_KEY는 환경변수로만 관리

## 디렉토리 구조
- backend/agent/ → LangGraph 노드, 그래프
- backend/api/   → FastAPI 엔드포인트
- frontend/      → Expo 앱
