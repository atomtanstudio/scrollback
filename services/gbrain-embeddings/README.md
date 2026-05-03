# GBrain Embeddings Sidecar

OpenAI-compatible embedding service for the FeedSilo/OpenClaw memory surface.

This is meant to run on a GPU box, such as the Legion WSL2 environment, while
Postgres and the FeedSilo data stay on Unraid. FeedSilo can point
`OPENAI_BASE_URL` at this service when generating 1536-dimensional agent memory
vectors.

## Model

Default model:

```sh
Qwen/Qwen3-Embedding-4B
```

Qwen3-Embedding-4B exposes up to 2560 dimensions and supports smaller output
dimensions, so FeedSilo can request `1536` while still leaving room to increase
later.

## Install

Inside WSL:

```sh
mkdir -p ~/services/gbrain-embeddings
cd ~/services/gbrain-embeddings
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip wheel setuptools
python -m pip install fastapi uvicorn sentence-transformers torch \
  --index-url https://download.pytorch.org/whl/cu128 \
  --extra-index-url https://pypi.org/simple
```

## Run

```sh
cd ~/services/gbrain-embeddings
. .venv/bin/activate
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-4B \
EMBEDDING_DEVICE=cuda \
EMBEDDING_DTYPE=float16 \
EMBEDDING_MAX_SEQ_LENGTH=8192 \
EMBEDDING_BATCH_SIZE=4 \
uvicorn server:app --host 0.0.0.0 --port 8001
```

## Smoke Test

```sh
curl http://127.0.0.1:8001/healthz
curl http://127.0.0.1:8001/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"Qwen/Qwen3-Embedding-4B","input":"agent memory search","dimensions":1536}'
```

For direct search clients that can send non-OpenAI extra fields, pass
`"input_type":"query"` to apply the model's query instruction prompt.
