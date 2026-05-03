from __future__ import annotations

import os
import time
from base64 import b64encode
from typing import Literal

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-4B")
MODEL_ALIASES = [
    alias.strip()
    for alias in os.getenv("EMBEDDING_MODEL_ALIASES", "text-embedding-3-large").split(",")
    if alias.strip()
]
DEVICE = os.getenv("EMBEDDING_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
DTYPE = os.getenv("EMBEDDING_DTYPE", "float16")
BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "4"))
MAX_SEQ_LENGTH = int(os.getenv("EMBEDDING_MAX_SEQ_LENGTH", "8192"))
DEFAULT_DIMENSIONS = int(os.getenv("EMBEDDING_DEFAULT_DIMENSIONS", "1536"))

app = FastAPI(title="GBrain Embeddings Sidecar")
_model: SentenceTransformer | None = None
_loaded_at: float | None = None


class EmbeddingRequest(BaseModel):
    model: str | None = None
    input: str | list[str]
    dimensions: int | None = Field(default=None, ge=1)
    encoding_format: Literal["float", "base64"] = "float"
    input_type: Literal["document", "query"] | None = None
    prompt_name: str | None = None
    prompt: str | None = None
    normalize: bool = True


def _torch_dtype() -> torch.dtype:
    if DTYPE in {"float16", "fp16", "half"}:
        return torch.float16
    if DTYPE in {"bfloat16", "bf16"}:
        return torch.bfloat16
    return torch.float32


def get_model() -> SentenceTransformer:
    global _model, _loaded_at
    if _model is not None:
        return _model

    kwargs = {
        "model_kwargs": {"torch_dtype": _torch_dtype()},
        "processor_kwargs": {"padding_side": "left"},
    }
    _model = SentenceTransformer(MODEL_NAME, device=DEVICE, **kwargs)
    if MAX_SEQ_LENGTH > 0:
        _model.max_seq_length = MAX_SEQ_LENGTH
    _loaded_at = time.time()
    return _model


def requested_texts(value: str | list[str]) -> list[str]:
    texts = [value] if isinstance(value, str) else value
    if not texts:
        raise HTTPException(status_code=400, detail="input must not be empty")
    if not all(isinstance(text, str) for text in texts):
        raise HTTPException(status_code=400, detail="input must be a string or string array")
    return texts


def encode_kwargs(model: SentenceTransformer, request: EmbeddingRequest) -> dict[str, str]:
    if request.prompt:
        return {"prompt": request.prompt}
    if request.prompt_name:
        return {"prompt_name": request.prompt_name}
    prompts = getattr(model, "prompts", {}) or {}
    if request.input_type == "query" and "query" in prompts:
        return {"prompt_name": "query"}
    return {}


def truncate_dimensions(embeddings: np.ndarray, dimensions: int) -> np.ndarray:
    native_dimensions = embeddings.shape[1]
    if dimensions > native_dimensions:
        raise HTTPException(
            status_code=400,
            detail=f"requested dimensions {dimensions} exceed native dimensions {native_dimensions}",
        )
    if dimensions == native_dimensions:
        return embeddings

    truncated = embeddings[:, :dimensions].astype(np.float32, copy=False)
    norms = np.linalg.norm(truncated, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return truncated / norms


def format_embedding(vector: np.ndarray, encoding_format: str) -> list[float] | str:
    vector = np.asarray(vector, dtype=np.float32)
    if encoding_format == "base64":
        return b64encode(vector.tobytes()).decode("ascii")
    return vector.tolist()


@app.get("/healthz")
def healthz() -> dict[str, object]:
    return {
        "ok": True,
        "model": MODEL_NAME,
        "aliases": MODEL_ALIASES,
        "loaded": _model is not None,
        "loaded_at": _loaded_at,
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "default_dimensions": DEFAULT_DIMENSIONS,
    }


@app.get("/v1/models")
def models() -> dict[str, object]:
    model_ids = [MODEL_NAME, *MODEL_ALIASES]
    return {
        "object": "list",
        "data": [
            {
                "id": model_id,
                "object": "model",
                "owned_by": "local",
            }
            for model_id in dict.fromkeys(model_ids)
        ],
    }


@app.post("/v1/embeddings")
def embeddings(request: EmbeddingRequest) -> dict[str, object]:
    model = get_model()
    texts = requested_texts(request.input)
    dimensions = request.dimensions or DEFAULT_DIMENSIONS

    try:
        vectors = model.encode(
            texts,
            batch_size=BATCH_SIZE,
            convert_to_numpy=True,
            normalize_embeddings=request.normalize,
            show_progress_bar=False,
            **encode_kwargs(model, request),
        )
    except Exception as error:  # pragma: no cover - preserves upstream model detail.
        raise HTTPException(status_code=500, detail=str(error)) from error

    array = np.asarray(vectors, dtype=np.float32)
    if array.ndim == 1:
        array = array.reshape(1, -1)
    array = truncate_dimensions(array, dimensions)

    return {
        "object": "list",
        "model": request.model or MODEL_NAME,
        "data": [
            {
                "object": "embedding",
                "index": index,
                "embedding": format_embedding(vector, request.encoding_format),
            }
            for index, vector in enumerate(array)
        ],
        "usage": {
            "prompt_tokens": 0,
            "total_tokens": 0,
        },
    }
