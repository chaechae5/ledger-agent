# db.py — SQLite 연결, 초기화, 샘플 데이터 시드, CRUD 헬퍼

import sqlite3
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "ledger_agent.db"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(reset: bool = False) -> None:
    with get_conn() as conn:
        if reset:
            conn.execute("DROP TABLE IF EXISTS expenses")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                amount INTEGER NOT NULL,
                category TEXT NOT NULL,
                card TEXT,
                memo TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
            """
        )
        conn.commit()


def seed_sample_data(reset: bool = False) -> None:
    init_db(reset=reset)
    sample_rows = [
        ("2026-04-10", 15000, "카페", "삼성카드", "카페"),
        ("2026-04-09", 23000, "식비", "현대카드", "점심"),
        ("2026-04-08", 3200, "편의점", "삼성카드", "편의점"),
    ]
    with get_conn() as conn:
        existing = conn.execute("SELECT COUNT(*) AS cnt FROM expenses").fetchone()["cnt"]
        if existing == 0:
            conn.executemany(
                "INSERT INTO expenses (date, amount, category, card, memo) VALUES (?, ?, ?, ?, ?)",
                sample_rows,
            )
            conn.commit()


def get_all_expenses(period: Optional[str] = None, card: Optional[str] = None) -> list[dict]:
    from datetime import date, timedelta

    today = date.today()
    sql = "SELECT id, date, amount, category, card, memo FROM expenses WHERE 1=1"
    params: list = []

    if period == "오늘":
        sql += " AND date = ?"
        params.append(today.isoformat())
    elif period == "이번주":
        monday = today - timedelta(days=today.weekday())
        sql += " AND date >= ? AND date <= ?"
        params.extend([monday.isoformat(), today.isoformat()])
    elif period == "이번달":
        first = today.replace(day=1)
        sql += " AND date >= ? AND date <= ?"
        params.extend([first.isoformat(), today.isoformat()])
    # "전체" or None → no filter

    if card:
        sql += " AND card = ?"
        params.append(card)

    sql += " ORDER BY date DESC, id DESC"

    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def get_expense_by_id(expense_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, date, amount, category, card, memo FROM expenses WHERE id = ?",
            (expense_id,),
        ).fetchone()
    return dict(row) if row else None


def update_expense_direct(expense_id: int, fields: dict) -> Optional[dict]:
    allowed = {"date", "amount", "category", "card", "memo"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_expense_by_id(expense_id)

    assignments = ", ".join(f"{k} = ?" for k in updates)
    params = list(updates.values()) + [expense_id]

    with get_conn() as conn:
        conn.execute(f"UPDATE expenses SET {assignments} WHERE id = ?", params)
        conn.commit()
        row = conn.execute(
            "SELECT id, date, amount, category, card, memo FROM expenses WHERE id = ?",
            (expense_id,),
        ).fetchone()
    return dict(row) if row else None
