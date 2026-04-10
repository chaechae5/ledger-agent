# 가계부 에이전트 — 설계 판단 근거

> 개발 중 "왜 이렇게 했지?" 싶을 때 참고하는 문서

---

## 목차

1. [State 설계 판단](#1-state-설계-판단)
2. [노드 설계 판단](#2-노드-설계-판단)
3. [DB 설계 판단](#3-db-설계-판단)
4. [아키텍처 전환 판단](#4-아키텍처-전환-판단)

---

## 1. State 설계 판단

---

### intent를 State에 저장

노드끼리는 직접 값을 전달할 수 없고 **State를 통해서만 소통**하는 구조.
`intent_node`가 판단한 결과를 분기 함수(`route_intent`)가 꺼내 써야 하므로 State에 저장.

```
노드 A → 노드 B 직접 전달 ❌
노드 A → State 저장 → 노드 B가 State에서 꺼냄 ✅
```

```python
def intent_node(state):
    return {"intent": "input"}  # State에 올림

def route_intent(state):
    return state["intent"]      # 꺼내서 분기
```

---

### parsed_data를 State에 저장

`parse_node`가 파싱한 결과를 `save_node`가 꺼내서 DB에 저장해야 함.
두 노드 사이 직접 통신이 불가능하므로 State가 중간 저장소 역할.

```
[parse_node] → State["parsed_data"] → [save_node]
```

---

### search_result를 State에 저장

`search_node`가 조회한 결과를 `output_node`가 꺼내서 포맷팅해야 함.
동일하게 노드 간 직접 전달이 불가능하므로 State 경유.

```
[search_node] → State["search_result"] → [output_node]
```

---

## 2. 노드 설계 판단

---

### intent 판단을 별도 노드로 분리

의도 파악 / 파싱 / 저장을 한 노드에 몰아넣으면 역할이 불명확해지고 테스트·유지보수가 어려움.
**단일 책임 원칙** — 노드 하나는 하나의 역할만 담당.

```
# ❌ 하나의 노드에 다 넣으면
def big_node(state):
    intent = 판단()
    if intent == "input":
        parsed = 파싱()
        저장(parsed)
    # → 수정 시 사이드 이펙트 발생, 테스트 어려움

# ✅ 역할별로 분리하면
intent_node → parse_node → validate_node → save_node    (입력 경로)
intent_node → search_node → output_node                 (조회 경로)
intent_node → update_search_node → choose_update_target_node
            → confirm_update_content_node
            → parse_update_command_node → apply_update_node → output_node
# → 각 노드 독립적으로 테스트 가능
```

---

### validate_node를 중간 검증 노드로 분리

예전에는 금액이 없으면 `intent_node`에서 곧바로 `search`로 분류했지만,
이 방식은 사용자가 단순히 금액을 빼먹은 입력까지 조회로 오해할 수 있었음.

그래서 `parse_node` 뒤에 `validate_node`를 두고,
금액이 없을 때만 `interrupt`로 사람에게 다시 묻도록 설계.

```
intent_node → parse_node → validate_node
                           ├─ 금액 있음 → save_node
                           ├─ 다시 입력 → intent_node
                           └─ 조회 전환 → search_node
```

이렇게 하면 의도 분류와 누락값 검증 책임이 분리되고,
애매한 경우에만 Human-in-the-Loop를 추가할 수 있음.

---

### 수정은 조회와 적용을 분리

수정 요청은 곧바로 DB를 바꾸면 위험하므로,
먼저 후보를 조회하고 번호 선택과 수정 내용 입력을 분리한 뒤에만 `UPDATE`를 실행하도록 설계.

```
update_search_node        → 수정 후보 조회
choose_update_target_node → 사람에게 번호 확인
confirm_update_content_node → 수정 내용만 확인
parse_update_command_node → "금액 20000원" 구조화
apply_update_node         → 실제 DB 반영
```

이렇게 하면 잘못된 대상 수정 가능성을 더 줄일 수 있고,
`search_result`와 `selected_update_index`를 State에 보관해서 단계별 확인을 안전하게 이어갈 수 있음.

---

### output_node를 별도 노드로 분리

`save_node`와 `search_node` 두 경로 모두 최종적으로 사용자에게 응답을 줘야 함.
응답 포맷팅 로직을 각 노드에 중복으로 넣지 않고 **하나의 노드에서 통합 처리**.
수정이 필요할 때 `output_node` 한 곳만 고치면 됨.

```
[save_node]   ─┐
                ├──→ [output_node] → 사용자 응답
[search_node] ─┘
```

---

## 3. DB 설계 판단

---

### SQLite 선택

1단계 목표는 LangGraph 구조 익히기. DB가 복잡해지면 본질에서 벗어남.
SQLite는 **파일 하나로 동작**하고 별도 서버 설치가 불필요해서 빠르게 시작 가능.
2단계 이후 PostgreSQL 등으로 교체하더라도 쿼리 로직은 거의 동일하게 재사용 가능.

```
1단계: SQLite      (로컬 파일, 설치 불필요)
    ↓
2단계: PostgreSQL  (서버, 멀티유저 지원)
```

---

---

## 4. 아키텍처 전환 판단

---

### Gradio → FastAPI + React 전환

초기에는 Gradio로 간단한 웹 UI를 붙였으나, LangGraph `interrupt` 흐름과 동기화가 불안정했다.
Gradio는 **stateless** 웹 UI인 반면 LangGraph는 **stateful** 구조여서,
interrupt 이후 상태를 프론트가 직접 가지고 있어야 했고 세션 충돌이 발생했다.

```
Gradio (stateless) ↔ LangGraph (stateful) → 상태 동기화 충돌
    ↓
FastAPI가 session_id 기반으로 상태 관리
React는 단순 HTTP 요청/응답만 담당
```

FastAPI로 전환하면 `session_id` → `thread_id` 매핑으로 서버에서 상태를 관리하므로
프론트는 `is_pending` 플래그만 보고 다음 요청을 `/chat` 또는 `/chat/resume`로 분기하면 된다.

---

### InMemorySaver 선택 (checkpointer)

LangGraph의 checkpointer를 `InMemorySaver`로 사용했다.
SQLite 기반 `SqliteSaver`도 선택지였으나, 이 프로젝트의 목적은 LangGraph 구조 학습이고
프로세스 재시작 시 대화 세션이 유지되지 않아도 무방한 1단계 단계이기 때문에 인메모리를 선택.

```
InMemorySaver  → 가벼움, 재시작 시 세션 소멸
SqliteSaver    → 재시작 후 세션 복구 가능, 추후 필요 시 교체
```

---

### INTERRUPT_HINTS 문자열 매칭으로 is_pending 판단

`is_pending` 플래그를 결정하는 방식으로 두 가지를 고려했다.

1. **LangGraph `__interrupt__` 키 확인** — `graph.py`의 `_parse_result`에서 이미 사용 중
2. **응답 텍스트의 힌트 문자열 매칭** (`routes.py`의 `INTERRUPT_HINTS`)

`_parse_result` 단계에서는 `__interrupt__`로 interrupt 여부를 감지해 응답 텍스트를 뽑는다.
그런데 API 응답에 `is_pending` 필드를 추가로 내려줘야 할 때,
응답 텍스트가 확정된 이후 단계에서 텍스트 기반으로 한 번 더 판단하는 것이 구조적으로 단순하다.

```python
# _parse_result: __interrupt__ 키로 interrupt 텍스트 추출
if "__interrupt__" in result:
    response = result["__interrupt__"][0].value  # interrupt 메시지

# routes.py: 추출된 텍스트로 is_pending 판단
def _is_pending(response: str) -> bool:
    return any(hint in response for hint in INTERRUPT_HINTS)
```

힌트 문자열은 각 노드의 `interrupt()` 호출 메시지에서 유래하므로,
노드 메시지를 바꾸면 반드시 `INTERRUPT_HINTS`도 함께 업데이트해야 한다.

---

### update_search_node 내부에서 날짜 interrupt 처리

날짜 없는 수정 요청에 대한 period interrupt를 별도 노드로 분리하지 않고
`update_search_node` 내부에서 처리했다.

```
별도 노드 방식:
update_search_node → (날짜 없음) → ask_period_node → update_search_node 재진입

내부 처리 방식:
update_search_node 내부에서 interrupt() 호출 후 period 재파싱 → 바로 DB 조회
```

수정 검색에서만 발생하는 조건이고 해당 노드 범위를 벗어나지 않으므로
별도 노드를 추가하면 그래프 복잡도만 늘어난다.
단, `update_search_node`가 두 번 interrupt를 발생시킬 수 있다는 점을 인지해야 한다.
(첫 번째: 날짜 질문, 두 번째: `choose_update_target_node`의 번호 선택)

---

*설계 결정 사항이 추가될 때마다 이 문서에 업데이트*
