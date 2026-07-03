from datetime import datetime, timezone

from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "mousika-local-server",
        "time": datetime.now(timezone.utc).isoformat(),
    }
