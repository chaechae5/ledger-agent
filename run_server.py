"""Dev server runner — backend/을 작업 디렉토리로 설정 후 uvicorn 실행"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 루트의 .env를 먼저 로드 (chdir 전에 경로 확정)
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

os.chdir(Path(__file__).parent / "backend")
sys.path.insert(0, str(Path(__file__).parent / "backend"))

import uvicorn

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
