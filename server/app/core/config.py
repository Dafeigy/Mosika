from pydantic import BaseModel


class Settings(BaseModel):
    app_title: str = "Mousika Local Server"
    app_version: str = "0.1.0"
    allowed_origins: list[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
    ]


settings = Settings()
