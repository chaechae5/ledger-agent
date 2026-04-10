# main.py — FastAPI 앱 진입점: CORS 설정, DB 초기화, 라우터 등록
# 실행: uvicorn api.main:app --reload

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from agent.db import seed_sample_data
from api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_sample_data(reset=False)
    yield


app = FastAPI(title="Ledger Agent API", lifespan=lifespan)

# CORS — 개발 환경 전체 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
