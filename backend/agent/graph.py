# graph.py — StateGraph 조립, 컴파일, run_agent / resume_agent 실행 함수

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from .nodes import (
    apply_update_node,
    choose_update_target_node,
    confirm_update_content_node,
    intent_node,
    output_node,
    parse_node,
    parse_update_command_node,
    route_after_choose,
    route_after_validate,
    route_intent,
    save_node,
    search_node,
    update_search_node,
    validate_node,
)
from .state import AccountBookState

# ── 그래프 조립 ────────────────────────────────────────────────
graph_builder = StateGraph(AccountBookState)

graph_builder.add_node("intent_node", intent_node)
graph_builder.add_node("parse_node", parse_node)
graph_builder.add_node("validate_node", validate_node)
graph_builder.add_node("save_node", save_node)
graph_builder.add_node("search_node", search_node)
graph_builder.add_node("update_search_node", update_search_node)
graph_builder.add_node("choose_update_target_node", choose_update_target_node)
graph_builder.add_node("confirm_update_content_node", confirm_update_content_node)
graph_builder.add_node("parse_update_command_node", parse_update_command_node)
graph_builder.add_node("apply_update_node", apply_update_node)
graph_builder.add_node("output_node", output_node)

graph_builder.add_edge(START, "intent_node")

graph_builder.add_conditional_edges(
    "intent_node",
    route_intent,
    {
        "parse_node": "parse_node",
        "search_node": "search_node",
        "update_search_node": "update_search_node",
    },
)
graph_builder.add_edge("parse_node", "validate_node")
graph_builder.add_conditional_edges(
    "validate_node",
    route_after_validate,
    {
        "save_node": "save_node",
        "intent_node": "intent_node",
        "search_node": "search_node",
    },
)
graph_builder.add_edge("save_node", "output_node")
graph_builder.add_edge("search_node", "output_node")

graph_builder.add_conditional_edges(
    "update_search_node",
    lambda _: "choose_update_target_node",
    {"choose_update_target_node": "choose_update_target_node"},
)
graph_builder.add_conditional_edges(
    "choose_update_target_node",
    route_after_choose,
    {
        "output_node": "output_node",
        "confirm_update_content_node": "confirm_update_content_node",
    },
)
graph_builder.add_edge("confirm_update_content_node", "parse_update_command_node")
graph_builder.add_edge("parse_update_command_node", "apply_update_node")
graph_builder.add_edge("apply_update_node", "output_node")
graph_builder.add_edge("output_node", END)

# ── 컴파일 ────────────────────────────────────────────────────
_memory = InMemorySaver()
ledger_agent = graph_builder.compile(checkpointer=_memory)


# ── 헬퍼 ──────────────────────────────────────────────────────

def _sanitize_delta(delta: dict) -> dict:
    """State delta를 JSON 직렬화 가능하게 변환. messages는 요약 형태로."""
    result = {}
    for key, value in delta.items():
        if value is None:
            continue
        if key == "messages":
            if isinstance(value, list) and value:
                result["messages"] = [
                    {
                        "type": type(m).__name__,
                        "content": str(getattr(m, "content", m))[:80],
                    }
                    for m in value
                ]
        elif isinstance(value, (str, int, float, bool, list, dict)):
            result[key] = value
    return result


def _collect_logs(stream_iter) -> tuple[str, list, list]:
    """스트림을 소비하며 (응답 텍스트, search_result, 실행 로그) 수집."""
    logs: list[dict] = []
    response = ""
    search_result: list = []

    for chunk in stream_iter:
        try:
            if "__interrupt__" in chunk:
                items = chunk["__interrupt__"]
                # items는 tuple 또는 list일 수 있음
                first = items[0] if items else None
                value = getattr(first, "value", str(first)) if first else ""
                logs.append({
                    "step": len(logs) + 1,
                    "node": "__interrupt__",
                    "output": {"message": str(value)[:200]},
                })
                response = str(value)
            else:
                for node_name, delta in chunk.items():
                    sanitized = _sanitize_delta(delta if isinstance(delta, dict) else {})
                    logs.append({
                        "step": len(logs) + 1,
                        "node": node_name,
                        "output": sanitized,
                    })
                    if sanitized.get("response"):
                        response = sanitized["response"]
                    if "search_result" in sanitized and sanitized["search_result"] is not None:
                        search_result = sanitized["search_result"]
        except Exception:
            # 파싱 실패한 청크는 로그에서 무시하고 계속 진행
            continue

    return response, search_result, logs


# ── 실행 함수 ─────────────────────────────────────────────────

def run_agent(user_input: str, session_id: str = "default") -> tuple[str, list, list]:
    """새 메시지를 처리한다. (응답 텍스트, search_result, logs) 반환."""
    config = {"configurable": {"thread_id": session_id}}
    initial_state: AccountBookState = {
        "messages": [HumanMessage(content=user_input)],
        "intent": None,
        "parsed_data": None,
        "search_filters": None,
        "search_result": None,
        "selected_update_index": None,
        "update_command": None,
        "updated_row": None,
        "response": None,
    }
    try:
        stream_iter = ledger_agent.stream(initial_state, config=config, stream_mode="updates")
        return _collect_logs(stream_iter)
    except Exception as e:
        return f"[에이전트 오류] {e}", [], []


def resume_agent(user_input: str, session_id: str = "default") -> tuple[str, list, list]:
    """interrupt 이후 사용자 응답을 이어받아 재개한다. (응답 텍스트, search_result, logs) 반환."""
    config = {"configurable": {"thread_id": session_id}}
    try:
        stream_iter = ledger_agent.stream(
            Command(resume=user_input), config=config, stream_mode="updates"
        )
        return _collect_logs(stream_iter)
    except Exception as e:
        return f"[에이전트 오류] {e}", [], []
