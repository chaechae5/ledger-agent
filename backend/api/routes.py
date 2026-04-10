# routes.py — FastAPI 라우터: /chat, /chat/resume, /expenses, /health

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agent.db import get_all_expenses, get_expense_by_id, update_expense_direct
from agent.graph import resume_agent, run_agent

router = APIRouter()

# interrupt가 발생했음을 나타내는 힌트 문자열 목록
INTERRUPT_HINTS = (
    "몇 번을 수정할까요?",
    "어떤 내용을 수정할까요?",
    "어떻게 할까요?",
    "언제 항목을 수정할까요?",
)


def _is_pending(response: str) -> bool:
    return any(hint in response for hint in INTERRUPT_HINTS)


# ── 요청/응답 스키마 ───────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str


class ChatResponse(BaseModel):
    response: str
    is_pending: bool
    search_result: list


class ExpenseUpdateRequest(BaseModel):
    date: Optional[str] = None
    amount: Optional[int] = None
    category: Optional[str] = None
    card: Optional[str] = None
    memo: Optional[str] = None


# ── 엔드포인트 ────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    response, search_result = run_agent(req.message, req.session_id)
    return ChatResponse(
        response=response,
        is_pending=_is_pending(response),
        search_result=search_result,
    )


@router.post("/chat/resume", response_model=ChatResponse)
def chat_resume(req: ChatRequest):
    response, search_result = resume_agent(req.message, req.session_id)
    return ChatResponse(
        response=response,
        is_pending=_is_pending(response),
        search_result=search_result,
    )


@router.get("/expenses")
def list_expenses(period: Optional[str] = None, card: Optional[str] = None):
    expenses = get_all_expenses(period=period, card=card)
    total = sum(e["amount"] for e in expenses)
    return {"expenses": expenses, "total": total}


@router.put("/expenses/{expense_id}")
def update_expense(expense_id: int, req: ExpenseUpdateRequest):
    existing = get_expense_by_id(expense_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")

    updated = update_expense_direct(expense_id, req.model_dump())
    return {"success": True, "expense": updated}
