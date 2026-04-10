# nodes.py — LangGraph 노드 함수, 분기 함수, 헬퍼 함수

import os
from datetime import date
from typing import Optional

from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.types import Command, interrupt

from .db import get_conn
from .state import (
    AccountBookState,
    ExpenseOutput,
    IntentOutput,
    SearchFilterOutput,
    UpdateCommandOutput,
)

# ── LLM 초기화 ────────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
intent_llm  = llm.with_structured_output(IntentOutput)
expense_llm = llm.with_structured_output(ExpenseOutput)
search_llm  = llm.with_structured_output(SearchFilterOutput)
update_llm  = llm.with_structured_output(UpdateCommandOutput)


# ── 헬퍼 함수 ─────────────────────────────────────────────────

def _today() -> str:
    return date.today().isoformat()


def extract_search_filters(text: str, mode: str = "search") -> dict:
    prompt = (
        f"오늘 날짜는 {_today()}이야.\n"
        "아래 요청에서 검색 조건을 추출해줘.\n"
        "'이번주'는 이번 주 월요일부터 오늘까지, '이번달'은 이번 달 1일부터 오늘까지.\n"
        "기간 언급이 없으면 start_date, end_date는 null로.\n"
        f"현재 작업 모드: {mode}\n\n"
        f"요청: {text}"
    )
    filters: SearchFilterOutput = search_llm.invoke(prompt)
    return filters.model_dump()


def query_expenses(filters: dict) -> list:
    sql = "SELECT id, date, amount, category, card, memo FROM expenses WHERE 1=1"
    params: list = []
    if filters.get("start_date"):
        sql += " AND date >= ?"
        params.append(filters["start_date"])
    if filters.get("end_date"):
        sql += " AND date <= ?"
        params.append(filters["end_date"])
    if filters.get("card"):
        sql += " AND card = ?"
        params.append(filters["card"])
    if filters.get("category"):
        sql += " AND category = ?"
        params.append(filters["category"])
    if filters.get("min_amount") is not None:
        sql += " AND amount >= ?"
        params.append(filters["min_amount"])
    if filters.get("max_amount") is not None:
        sql += " AND amount <= ?"
        params.append(filters["max_amount"])
    sql += " ORDER BY date DESC, id DESC"

    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def format_expense_line(row: dict, index: Optional[int] = None) -> str:
    prefix = f"{index}. " if index is not None else ""
    return (
        f"{prefix}{row['date']} | {row['category']:<4} | {row['amount']:,}원 | "
        f"{row.get('card') or '현금'}"
    )


# ── 노드 함수 ─────────────────────────────────────────────────

def intent_node(state: AccountBookState) -> dict:
    text = state["messages"][-1].content
    prompt = (
        f"오늘 날짜는 {_today()}이야.\n"
        "사용자 입력을 아래 기준으로 분류해줘.\n\n"
        "input: 지출을 기록하거나 저장하려는 요청\n"
        "  예) '오늘 삼성카드 15000원 카페', '어제 밥 먹었어 32000원', '오늘 카페 갔어'\n\n"
        "search: 내역 조회, 확인, 얼마인지 묻는 요청\n"
        "  예) '오늘 지출내역', '이번주 삼성카드 내역', '지난달 식비 얼마야'\n\n"
        "update: 기존 내역을 고치거나 수정하려는 요청\n"
        "  예) '카페 내역 수정하고 싶어', '방금 입력한 내역 금액 바꿔줘'\n\n"
        "조회 의도가 분명하면 search, 수정 의도가 분명하면 update, 그 외 지출 기록처럼 보이면 input으로 분류해.\n\n"
        f"입력: {text}"
    )
    result: IntentOutput = intent_llm.invoke(prompt)
    return {"intent": result.intent}


def parse_node(state: AccountBookState) -> dict:
    text = state["messages"][-1].content
    prompt = (
        f"오늘 날짜는 {_today()}이야.\n"
        "아래 지출 내용을 분석해서 날짜, 금액, 카테고리, 카드사, 메모를 추출해줘.\n"
        "카테고리는 내용을 보고 네가 판단해서 적절한 이름으로 정해.\n"
        "'오늘', '어제' 같은 표현은 실제 날짜로 변환해줘.\n\n"
        f"지출 내용: {text}"
    )
    result: ExpenseOutput = expense_llm.invoke(prompt)
    return {"parsed_data": result.model_dump()}


def validate_node(state: AccountBookState) -> dict:
    data = state["parsed_data"] or {}
    if data.get("amount"):
        return {}

    user_reply = interrupt(
        "금액을 찾을 수 없어요. 어떻게 할까요?\n"
        "1. 금액 다시 입력: '15000원 카페'\n"
        "2. 조회로 전환: '이번주 내역 조회해줘'"
    )
    reply = str(user_reply).strip()
    lowered = reply.lower()

    if reply == "2" or "조회" in reply or "내역" in reply or "search" in lowered:
        return {
            "intent": "search",
            "parsed_data": None,
            "search_filters": None,
            "search_result": None,
            "selected_update_index": None,
            "update_command": None,
            "updated_row": None,
        }

    return {
        "messages": [HumanMessage(content=reply)],
        "intent": None,
        "parsed_data": None,
        "response": None,
    }


def save_node(state: AccountBookState) -> dict:
    data = state["parsed_data"] or {}
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO expenses (date, amount, category, card, memo) VALUES (?, ?, ?, ?, ?)",
            (
                data.get("date"),
                data.get("amount"),
                data.get("category"),
                data.get("card"),
                data.get("memo"),
            ),
        )
        conn.commit()
    return {}


def search_node(state: AccountBookState) -> dict:
    text = state["messages"][-1].content
    filters = extract_search_filters(text, mode="search")
    rows = query_expenses(filters)
    return {"search_filters": filters, "search_result": rows, "response": None}


def extract_update_search_filters(text: str) -> dict:
    prompt = (
        f"오늘 날짜는 {_today()}이야.\n"
        "아래는 수정 요청이야. 수정할 내역을 찾기 위한 검색 조건만 추출해줘.\n\n"
        "## 중요 규칙\n"
        "- 수정할 새 값(새 금액, 새 카테고리 등)은 절대 검색 조건에 포함하지 마.\n"
        "- '15000원→10000원으로' 에서 검색 조건은 15000원, 수정할 값은 10000원\n"
        "- '카페 10000원으로 수정' 에서 검색 조건은 카페, 수정할 값은 10000원\n"
        "- 금액 필터(min_amount, max_amount)는 명확히 검색 범위로 언급된 경우에만 사용\n"
        "- 기간 언급 없으면 start_date, end_date는 null\n\n"
        f"수정 요청: {text}"
    )
    return search_llm.invoke(prompt).model_dump()


def update_search_node(state: AccountBookState) -> dict:
    text = state["messages"][-1].content
    filters = extract_update_search_filters(text)

    if not filters.get("start_date") and not filters.get("end_date"):
        user_reply = interrupt(
            "언제 항목을 수정할까요?\n"
            "예: '오늘', '어제', '이번주', '2026-04-09'"
        )
        period_prompt = (
            f"오늘 날짜는 {_today()}이야.\n"
            "아래 기간 표현에서 start_date와 end_date를 추출해줘.\n"
            f"기간 표현: {str(user_reply).strip()}"
        )
        period_filters = search_llm.invoke(period_prompt).model_dump()
        filters["start_date"] = period_filters.get("start_date")
        filters["end_date"] = period_filters.get("end_date")
        filters["period_label"] = period_filters.get("period_label", str(user_reply).strip())

    rows = query_expenses(filters)
    return {
        "search_filters": filters,
        "search_result": rows,
        "selected_update_index": None,
        "update_command": None,
        "updated_row": None,
        "response": None,
    }


def choose_update_target_node(state: AccountBookState) -> dict:
    results = state.get("search_result") or []
    if not results:
        return {"response": "수정할 내역을 찾지 못했어요."}

    lines = ["아래 중 몇 번을 수정할까요?"]
    for idx, row in enumerate(results, start=1):
        lines.append(format_expense_line(row, idx))
    lines.append("예: '1번'")

    user_reply = interrupt("\n".join(lines))
    reply = str(user_reply).strip()
    digits = "".join(ch for ch in reply if ch.isdigit())
    selected_index = int(digits) if digits else None

    if selected_index is None or selected_index < 1 or selected_index > len(results):
        return {"response": "수정할 번호를 이해하지 못했어요. 다시 수정 요청을 시작해주세요."}

    return {
        "selected_update_index": selected_index,
        "response": None,
    }


def confirm_update_content_node(state: AccountBookState) -> dict:
    results = state.get("search_result") or []
    selected_index = state.get("selected_update_index")
    if selected_index is None or selected_index < 1 or selected_index > len(results):
        return {"response": "수정 대상 번호가 없어요. 다시 수정 요청을 시작해주세요."}

    target = results[selected_index - 1]
    user_reply = interrupt(
        "어떤 내용을 수정할까요?\n"
        f"선택한 내역: {format_expense_line(target, selected_index)}\n"
        "예: 금액 20000원, 카테고리 식비"
    )
    return {
        "messages": [HumanMessage(content=str(user_reply).strip())],
        "response": None,
    }


def parse_update_command_node(state: AccountBookState) -> dict:
    text = state["messages"][-1].content
    results = state.get("search_result") or []
    candidates = "\n".join(
        format_expense_line(row, idx) for idx, row in enumerate(results, start=1)
    )
    prompt = (
        f"오늘 날짜는 {_today()}이야.\n"
        "아래 수정 요청에서 바꿀 필드와 값을 추출해줘.\n"
        "바꾸지 않는 필드는 null로 둬.\n"
        "'오늘', '어제' 같은 날짜 표현은 실제 날짜로 변환해줘.\n\n"
        f"수정 후보:\n{candidates}\n\n"
        f"선택된 번호: {state.get('selected_update_index')}\n"
        f"사용자 답변: {text}"
    )
    result: UpdateCommandOutput = update_llm.invoke(prompt)
    return {"update_command": result.model_dump(), "response": None}


def apply_update_node(state: AccountBookState) -> dict:
    command = state.get("update_command") or {}
    results = state.get("search_result") or []
    index = state.get("selected_update_index") or 0

    if index < 1 or index > len(results):
        return {"response": "수정할 번호를 이해하지 못했어요. 다시 수정 요청을 시작해주세요."}

    target = results[index - 1]
    updates = {
        key: value
        for key, value in command.items()
        if key in {"date", "amount", "category", "card", "memo"} and value is not None
    }
    if not updates:
        return {"response": '바꿀 값을 찾지 못했어요.\n예: "금액 10000원으로", "카테고리 식비로"'}

    assignments = ", ".join(f"{key} = ?" for key in updates)
    params = list(updates.values()) + [target["id"]]

    with get_conn() as conn:
        conn.execute(f"UPDATE expenses SET {assignments} WHERE id = ?", params)
        conn.commit()
        row = conn.execute(
            "SELECT id, date, amount, category, card, memo FROM expenses WHERE id = ?",
            (target["id"],),
        ).fetchone()

    if row is None:
        return {"response": "수정 후 내역을 찾지 못했어요."}

    return {
        "updated_row": dict(row),
        "response": None,
    }


def output_node(state: AccountBookState) -> dict:
    if state["intent"] == "input":
        data = state["parsed_data"] or {}
        response = (
            "✅ 저장 완료\n"
            f"날짜: {data.get('date')}\n"
            f"금액: {data.get('amount', 0):,}원\n"
            f"카테고리: {data.get('category')}\n"
            f"카드: {data.get('card') or '미지정'}\n"
            f"메모: {data.get('memo')}"
        )
    elif state["intent"] == "update":
        if state.get("response"):
            response = state["response"]
        else:
            row = state.get("updated_row") or {}
            response = (
                "✅ 수정 완료\n"
                f"날짜: {row.get('date')}\n"
                f"금액: {row.get('amount', 0):,}원\n"
                f"카테고리: {row.get('category')}\n"
                f"카드: {row.get('card') or '미지정'}\n"
                f"메모: {row.get('memo')}"
            )
    else:
        filters = state.get("search_filters") or {}
        results = state.get("search_result") or []
        if not results:
            response = "조회된 내역이 없어요."
        else:
            header = f"📋 {filters.get('period_label', '조건')} 내역"
            lines = [header]
            total = 0
            for row in results:
                total += row["amount"]
                lines.append(format_expense_line(row))
            lines.append("-" * 44)
            lines.append(f"합계: {total:,}원")
            response = "\n".join(lines)

    return {"response": response, "messages": [AIMessage(content=response)]}


# ── 분기 함수 ──────────────────────────────────────────────────

def route_intent(state: AccountBookState) -> str:
    if state["intent"] == "input":
        return "parse_node"
    if state["intent"] == "update":
        return "update_search_node"
    return "search_node"


def route_after_validate(state: AccountBookState) -> str:
    if state.get("intent") == "search":
        return "search_node"
    if (state.get("parsed_data") or {}).get("amount"):
        return "save_node"
    return "intent_node"


def route_after_choose(state: AccountBookState) -> str:
    return "output_node" if state.get("response") else "confirm_update_content_node"
