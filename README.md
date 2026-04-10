# Ledger Agent

> LangGraph + FastAPI 기반 AI 가계부 서비스 | 2026

자연어로 가계부를 입력하고 조회·수정할 수 있는 AI Agent 기반 가계부 서비스.

```
사용자: "오늘 삼성카드 15000원 카페"
에이전트: "✅ 저장 완료
           날짜: 2026-04-10 | 금액: 15,000원 | 카테고리: 카페 | 카드: 삼성카드"

사용자: "이번주 삼성카드 사용내역"
에이전트: "📋 이번주 삼성카드 내역
           04-08 | 편의점  |  3,200원 | 삼성카드
           04-10 | 카페    | 15,000원 | 삼성카드
           ────────────────────────────────────
           합계: 18,200원"

사용자: "카페 내역 수정하고 싶어"
에이전트: "아래 중 몇 번을 수정할까요?
           1. 2026-04-10 | 카페 | 15,000원 | 삼성카드"
```

---

## 목차

1. [아키텍처](#아키텍처)
2. [기술 스택](#기술-스택)
3. [디렉토리 구조](#디렉토리-구조)
4. [실행 방법](#실행-방법)
5. [API 엔드포인트](#api-엔드포인트)
6. [에이전트 설계](#에이전트-설계)
   - [그래프 흐름](#그래프-흐름)
   - [State 설계](#state-설계)
   - [노드 설계](#노드-설계)
7. [DB 설계](#db-설계)
8. [기능 정의](#기능-정의)
9. [개발 로드맵](#개발-로드맵)

---

## 아키텍처

```
[React 프론트엔드]
       ↕ HTTP
[FastAPI 백엔드]
       ↕
[LangGraph Agent]  ←→  GPT-4o-mini
       ↕
   [SQLite DB]
```

---

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| AI Agent | LangGraph, LangChain | 조건 분기·State 관리·interrupt |
| LLM | GPT-4o-mini | 자연어 파싱 정확도, 비용 효율 |
| 백엔드 | FastAPI, uvicorn | 빠른 개발, 자동 API 문서 |
| DB | SQLite | 로컬, 별도 설치 불필요 |
| 프론트엔드 | React, Vite | 채팅 UI, 내역 조회/수정 |
| 컨테이너 | Docker, Docker Compose | 환경 통일, 간편한 배포 |

---

## 디렉토리 구조

```
ledge-agent/
├── backend/                    # FastAPI 백엔드
│   ├── agent/
│   │   ├── db.py               # DB 연결, CRUD (get_conn, init_db, seed_sample_data 등)
│   │   ├── state.py            # LangGraph State, Pydantic 스키마
│   │   ├── nodes.py            # 노드 함수, 분기 함수, 헬퍼
│   │   └── graph.py            # 그래프 조립, run_agent, resume_agent
│   ├── api/
│   │   ├── main.py             # FastAPI 앱, CORS, lifespan
│   │   └── routes.py           # 엔드포인트 정의
│   ├── Dockerfile
│   ├── .env.example
│   └── requirements.txt
├── frontend/                   # React 프론트엔드
│   ├── src/
│   │   ├── api.js              # fetch 래퍼 (chat, resume, getExpenses, updateExpense)
│   │   ├── App.jsx             # 탭 3개 레이아웃
│   │   └── components/
│   │       ├── ChatTab.jsx     # 채팅 UI, interrupt 흐름 처리
│   │       ├── ExpensesTab.jsx # 기간/카드 필터 + 테이블
│   │       └── EditTab.jsx     # ID 조회 → 폼 수정 → PUT 저장
│   └── Dockerfile
├── docker-compose.yml
├── ledger_agent.ipynb          # 초기 프로토타입 노트북
├── run_server.py               # 로컬 백엔드 실행 스크립트
├── start_frontend.sh           # 로컬 프론트엔드 실행 스크립트
├── .env                        # OPENAI_API_KEY
└── README.md
```

---

## 실행 방법

### Docker (권장)

```bash
cp backend/.env.example .env
# .env에 OPENAI_API_KEY 입력

docker compose up --build
```

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:5173 |
| 백엔드 API | http://localhost:8000 |
| API 문서 (Swagger) | http://localhost:8000/docs |

SQLite DB는 호스트의 `backend/ledger_agent.db`에 볼륨 마운트되어 컨테이너 재시작 후에도 데이터가 유지됩니다.

### 로컬 실행

**백엔드**

```bash
pip install -r backend/requirements.txt
python run_server.py
```

**프론트엔드**

```bash
cd frontend
npm install
npm run dev
```

### 환경 변수

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 (필수) |

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/health` | 헬스체크 |
| `POST` | `/chat` | 새 메시지 전송 |
| `POST` | `/chat/resume` | interrupt 재개 |
| `GET` | `/expenses` | 내역 조회 |
| `PUT` | `/expenses/{id}` | 내역 직접 수정 |

### POST /chat

```jsonc
// Request
{ "message": "오늘 카페 15000원 삼성카드", "session_id": "uuid" }

// Response
{ "response": "✅ 저장 완료 ...", "is_pending": false, "search_result": [] }
```

`is_pending: true`이면 에이전트가 추가 입력을 기다리는 상태입니다.
다음 메시지는 반드시 `POST /chat/resume`으로 전송해야 합니다.

### GET /expenses

```
GET /expenses?period=이번주&card=삼성카드

// Response
{ "expenses": [...], "total": 18200 }
```

`period` 옵션: `오늘` / `이번주` / `이번달` / `전체`(기본값)

### interrupt 힌트

아래 문자열 중 하나라도 응답에 포함되면 `is_pending: true`로 반환합니다.

```python
INTERRUPT_HINTS = (
    '몇 번을 수정할까요?',
    '어떤 내용을 수정할까요?',
    '어떻게 할까요?',
    '언제 항목을 수정할까요?',
)
```

---

## 에이전트 설계

### 그래프 흐름

```
사용자 입력
    ↓
[intent_node] — LLM이 input / search / update 분류
    ↙                  ↓                     ↘
[parse_node]      [search_node]      [update_search_node]
자연어 파싱          DB 조회            수정 후보 조회
    ↓                  ↓              (기간 없으면 interrupt)
[validate_node]   [output_node]              ↓
금액 누락 확인                     [choose_update_target_node]
    ↓                              번호 선택 (interrupt)
  ┌───┬──────────┐                         ↓
  ↓   ↓          ↓               [confirm_update_content_node]
save  intent   search             수정 내용 입력 (interrupt)
_node _node    _node                         ↓
  ↓     ↓        ↓              [parse_update_command_node]
       [output_node]             수정 명령 파싱
                                             ↓
                                  [apply_update_node]
                                  DB 수정 (UPDATE + SELECT)
                                             ↓
                                       [output_node]
```

### State 설계

```python
class AccountBookState(TypedDict):
    messages:              Annotated[list, add_messages]  # 대화 히스토리 (누적)
    intent:                Optional[str]   # "input" | "search" | "update"
    parsed_data:           Optional[dict]  # ExpenseOutput — 파싱된 지출 데이터
    search_filters:        Optional[dict]  # SearchFilterOutput — 검색 조건
    search_result:         Optional[list]  # DB 조회 결과
    selected_update_index: Optional[int]   # 사용자가 선택한 수정 대상 번호 (1-indexed)
    update_command:        Optional[dict]  # UpdateCommandOutput — 수정할 필드/값
    updated_row:           Optional[dict]  # 수정 후 SELECT 결과
    response:              Optional[str]   # 최종 응답 텍스트
```

| 필드 | 역할 |
|------|------|
| `messages` | `add_messages`로 누적. 대화 히스토리 전체 보존 |
| `intent` | 분기 함수가 읽어 다음 노드 결정 |
| `parsed_data` | `parse_node → validate_node → save_node` 전달 |
| `search_filters` | `search_node` / `update_search_node`가 추출한 조회 조건 보관 |
| `search_result` | `search_node → output_node`, `update_search_node → choose_update_target_node` 전달 |
| `selected_update_index` | `choose_update_target_node → apply_update_node` 전달 |
| `update_command` | `parse_update_command_node → apply_update_node` 전달 |
| `updated_row` | `apply_update_node → output_node` 전달 |
| `response` | 에러 메시지 등 중간 응답 텍스트. `output_node`가 최종 값으로 덮어씀 |

### 노드 설계

#### intent_node — 의도 분류

LLM이 입력을 `input` / `search` / `update` 중 하나로 분류.

| 입력 예시 | intent |
|-----------|--------|
| "오늘 삼성카드 15000원 카페" | `input` |
| "이번주 삼성카드 내역" | `search` |
| "지난달 식비 얼마야" | `search` |
| "카페 내역 수정하고 싶어" | `update` |

#### parse_node — 자연어 파싱

LLM이 지출 내용에서 날짜·금액·카테고리·카드사·메모를 추출. `"오늘"`, `"어제"` 같은 상대 날짜는 실제 날짜(YYYY-MM-DD)로 변환.

#### validate_node — 금액 누락 확인 (interrupt)

금액이 파싱되지 않으면 사용자에게 재입력 또는 조회 전환을 묻는다.

- 금액 있음 → `save_node`
- 사용자가 조회 원함 → `search_node`
- 사용자가 다시 입력 → `intent_node` 재시작

#### update_search_node — 수정 후보 조회

수정 요청에서 **검색 조건만** 추출 (수정할 새 값은 검색 조건에 포함하지 않음). 날짜 언급이 없으면 interrupt로 기간을 재질문.

> **예시:** `"카페 15000원→10000원으로"` → 검색 조건: `카페`, `15000원` / 수정 값: `10000원`

#### choose_update_target_node — 수정 대상 선택 (interrupt)

조회된 후보를 번호와 함께 보여주고 몇 번 항목을 수정할지 받는다.
유효한 번호가 입력되면 `confirm_update_content_node`로 이동하고,
후보가 없거나 잘못된 번호가 입력되면 `response`에 에러 메시지를 담아 `output_node`로 바로 이동한다.

#### confirm_update_content_node — 수정 내용 확인 (interrupt)

선택한 내역을 다시 보여주고 어떤 필드를 바꿀지 받는다.

#### parse_update_command_node — 수정 명령 파싱

`"금액 만원으로"`, `"카테고리 식비로"` 같은 답변에서 변경할 필드와 값을 추출. 한국어 금액 표현(`만원`→10000, `오만원`→50000 등)도 숫자로 변환.

#### apply_update_node — DB 수정

`UPDATE expenses SET ... WHERE id = ?` 실행 후 `SELECT`로 실제 반영된 값을 확인해 반환. `updated_row`가 `None`이거나 수정할 값이 없으면 명확한 에러 메시지 반환.

#### search_node — 내역 조회

자연어에서 검색 조건(기간, 카드사, 카테고리, 금액 범위)을 추출해 DB 조회.

| 지원 조건 | 입력 예시 |
|-----------|----------|
| 기간 | 오늘, 어제, 이번주, 이번달, 지난달 |
| 카드사 | 삼성카드, 현대카드, 신한카드 등 |
| 카테고리 | 식비, 카페, 교통 등 |
| 금액 범위 | 1만원 이상, 5만원 이하 |

#### output_node — 응답 생성

intent에 따라 저장 확인 / 수정 완료 / 조회 결과를 사용자 친화적 텍스트로 포맷팅.

---

## DB 설계

```sql
CREATE TABLE expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT    NOT NULL,   -- 날짜 (YYYY-MM-DD)
    amount     INTEGER NOT NULL,   -- 금액 (원 단위)
    category   TEXT    NOT NULL,   -- 카테고리
    card       TEXT,               -- 카드사 (없으면 NULL → 현금)
    memo       TEXT,               -- 메모
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

**샘플 데이터 (초기 시드)**

| date | amount | category | card | memo |
|------|--------|----------|------|------|
| 2026-04-10 | 15,000 | 카페 | 삼성카드 | 카페 |
| 2026-04-09 | 23,000 | 식비 | 현대카드 | 점심 |
| 2026-04-08 | 3,200 | 편의점 | 삼성카드 | 편의점 |

---

## 기능 정의

### 현재 구현 (1단계)

| 기능 | 입력 예시 | 동작 |
|------|-----------|------|
| 지출 입력 | "오늘 삼성카드 15000원 카페" | 자연어 파싱 후 DB 저장 |
| 내역 조회 | "이번주 삼성카드 사용내역" | 조건 추출 후 DB 조회 |
| 내역 수정 (채팅) | "카페 내역 수정하고 싶어" | interrupt 3단계로 DB 수정 |
| 내역 직접 수정 | PUT /expenses/{id} | 폼으로 필드 직접 수정 |

### 확장 아이디어 (2단계 이후)

| 기능 | 설명 | LangGraph 개념 |
|------|------|----------------|
| 예산 초과 알림 | 카테고리별 월 예산 설정, 초과 시 경고 | 조건 분기 추가 |
| 소비 패턴 분석 | "이번 달 소비 어때?" → LLM 인사이트 | 분석 노드 추가 |
| 정기 지출 감지 | 반복 결제 패턴 감지 후 사용자 확인 | Human-in-the-Loop |
| 영수증 이미지 입력 | 사진 업로드 → Vision LLM 텍스트 추출 | 멀티모달 |
| DB 교체 | SQLite → PostgreSQL | 프로덕션 전환 |

---

## 개발 로드맵

### 1단계 ✅ — LangGraph Agent

- [x] SQLite DB 생성 및 테이블 설계
- [x] State 정의 (`AccountBookState`)
- [x] 모든 노드 구현 (intent, parse, validate, save, search, update 흐름 전체)
- [x] checkpointer (InMemorySaver) 기반 세션 관리
- [x] interrupt + Command(resume) 기반 대화형 수정 흐름

### 2단계 ✅ — FastAPI 백엔드

- [x] 노트북 코드 → Python 패키지 분리 (`agent/`, `api/`)
- [x] FastAPI 엔드포인트 구현 (chat, resume, expenses CRUD)
- [x] session_id 기반 대화 세션 관리
- [x] CORS 설정

### 3단계 ✅ — React 웹 프론트엔드

- [x] 채팅 탭 (interrupt 흐름, is_pending 감지, 세션 초기화)
- [x] 내역 조회 탭 (기간/카드 필터, 테이블, 합계)
- [x] 수정 탭 (ID 조회 → 폼 자동 채움 → PUT 저장)

### 4단계 ✅ — Docker

- [x] 백엔드 Dockerfile (python:3.11-slim)
- [x] 프론트엔드 Dockerfile (node:18-alpine)
- [x] docker-compose.yml (서비스 연결, DB 볼륨 마운트)

### 5단계 — Expo 모바일 앱

- [ ] React Native 기반 화면 전환
- [ ] 탭 네비게이션 (@react-navigation/bottom-tabs)
- [ ] Expo Go 배포

### 6단계 — 기능 고도화

- [ ] 예산 초과 알림 노드
- [ ] 월별 소비 리포트
- [ ] 정기 지출 감지
- [ ] 영수증 이미지 입력 (Vision LLM)
- [ ] PostgreSQL 전환
- [ ] 카드 결제일 설정 및 카드 결제 금액 집계

---
