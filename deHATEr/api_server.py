"""FastAPI server that exposes the TransformerAgeAwareClassifier via HTTP."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, validator

from predict import TransformerAgeAwareClassifier

logger = logging.getLogger(__name__)


class PredictRequest(BaseModel):
    text: str = Field(..., description="Input text to classify")
    age: Optional[int] = Field(None, ge=0, le=130, description="Optional user age")

    @validator("text")
    def _validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("text must not be empty")
        return value


class PredictResponse(BaseModel):
    score: float
    should_block: bool
    age_policy: dict


def _resolve_model_path() -> Path:
    model_env = os.getenv("MODEL_PATH", "models/wangchanberta-hatespeech")
    model_path = Path(model_env)
    if not model_path.exists():
        raise FileNotFoundError(f"MODEL_PATH '{model_path}' not found")
    return model_path


def _resolve_device() -> Optional[str]:
    device_env = os.getenv("MODEL_DEVICE")
    return device_env if device_env else None


app = FastAPI(title="4j3k Extension Inference API", version="0.1.0")


@app.on_event("startup")
def _load_model() -> None:
    model_path = _resolve_model_path()
    device = _resolve_device()
    logger.info("Loading model from %s", model_path)
    app.state.classifier = TransformerAgeAwareClassifier(model_path, device=device)
    logger.info("Model loaded; serving requests")


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    classifier = getattr(app.state, "classifier", None)
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not ready")

    try:
        result = classifier.classify(request.text, request.age)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Model inference failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return PredictResponse(**result)


@app.get("/healthz")
def healthcheck() -> dict:
    classifier = getattr(app.state, "classifier", None)
    status = "ready" if classifier is not None else "loading"
    return {"status": status}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api_server:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "0") == "1",
    )
