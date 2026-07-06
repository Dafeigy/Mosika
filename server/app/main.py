from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.app.api.health import router as health_router
from server.app.api.internal import router as internal_router
from server.app.api.tasks import router as tasks_router
from server.app.core.config import settings


app = FastAPI(title=settings.app_title, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(internal_router)
app.include_router(tasks_router)
