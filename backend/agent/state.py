# state.py — LangGraph State 정의 및 LLM 구조화 출력 스키마

from typing import Annotated, Optional, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


# ── Pydantic 스키마 ────────────────────────────────────────────

class IntentOutput(BaseModel):
    intent: str = Field(description="'input', 'search', 'update' 중 하나")


class ExpenseOutput(BaseModel):
    date: str = Field(
        description="지출 날짜 (YYYY-MM-DD 형식). '오늘', '어제' 같은 상대 표현도 실제 날짜로 변환"
    )
    amount: int = Field(description="지출 금액 (숫자만, 원 단위)")
    category: str = Field(
        description="지출 카테고리. 예: 식비, 카페, 편의점, 교통, 쇼핑, 의료, 운동, 문화 등 자유롭게 판단"
    )
    card: Optional[str] = Field(description="사용한 카드사. 언급 없으면 null")
    memo: str = Field(description="지출 메모. 카테고리나 가게명 등 간단하게")


class SearchFilterOutput(BaseModel):
    period_label: str = Field(
        description="기간 레이블. 예: 오늘, 어제, 이번주, 이번달, 지난달, 전체"
    )
    start_date: Optional[str] = Field(description="조회 시작일 (YYYY-MM-DD). 없으면 null")
    end_date: Optional[str] = Field(description="조회 종료일 (YYYY-MM-DD). 없으면 null")
    card: Optional[str] = Field(description="필터할 카드사. 언급 없으면 null")
    category: Optional[str] = Field(description="필터할 카테고리. 언급 없으면 null")
    min_amount: Optional[int] = Field(description="최소 금액 필터. 없으면 null")
    max_amount: Optional[int] = Field(description="최대 금액 필터. 없으면 null")


class UpdateCommandOutput(BaseModel):
    date:     Optional[str] = Field(description="바꿀 날짜. 없으면 null")
    amount:   Optional[int] = Field(
        description="바꿀 금액. 숫자로 변환해줘. '만원'→10000, '오만원'→50000, '만오천원'→15000. 없으면 null"
    )
    category: Optional[str] = Field(description="바꿀 카테고리. 없으면 null")
    card:     Optional[str] = Field(description="바꿀 카드사. 없으면 null")
    memo:     Optional[str] = Field(description="바꿀 메모. 없으면 null")


# ── LangGraph State ────────────────────────────────────────────

class AccountBookState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    intent: Optional[str]                  # 'input' | 'search' | 'update'
    parsed_data: Optional[dict]            # ExpenseOutput
    search_filters: Optional[dict]         # SearchFilterOutput
    search_result: Optional[list]          # DB 조회 결과
    selected_update_index: Optional[int]   # 선택한 수정 대상 번호 (1-indexed)
    update_command: Optional[dict]         # UpdateCommandOutput
    updated_row: Optional[dict]            # 수정 후 row
    response: Optional[str]               # 최종 응답 텍스트
