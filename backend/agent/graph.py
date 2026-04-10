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


# ── 실행 함수 ─────────────────────────────────────────────────

def _parse_result(result: dict) -> tuple[str, list]:
    """그래프 결과에서 (응답 텍스트, search_result) 반환."""
    if "__interrupt__" in result:
        response = result["__interrupt__"][0].value
    else:
        response = result.get("response") or ""
    search_result = result.get("search_result") or []
    return response, search_result


def run_agent(user_input: str, session_id: str = "default") -> tuple[str, list]:
    """새 메시지를 처리한다. (응답 텍스트, search_result) 반환."""
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
    result = ledger_agent.invoke(initial_state, config=config)
    return _parse_result(result)


def resume_agent(user_input: str, session_id: str = "default") -> tuple[str, list]:
    """interrupt 이후 사용자 응답을 이어받아 재개한다. (응답 텍스트, search_result) 반환."""
    config = {"configurable": {"thread_id": session_id}}
    result = ledger_agent.invoke(Command(resume=user_input), config=config)
    return _parse_result(result)
