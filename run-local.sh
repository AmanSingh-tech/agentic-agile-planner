#!/usr/bin/env bash
# Starts the full stack locally: pgvector, Ollama models, both agents and (optionally) the frontend.
# Override any variable inline, e.g.  OLLAMA_CHAT_MODEL=qwen2.5 AGENT_PORT=8081 ./run-local.sh
set -euo pipefail
cd "$(dirname "$0")"

export OLLAMA_CHAT_MODEL="${OLLAMA_CHAT_MODEL:-qwen2.5}"
AGENT_PORT="${AGENT_PORT:-8081}"
ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-8080}"
DB_PORT="${DB_PORT:-5434}"
LOG_DIR="${LOG_DIR:-logs}"
mkdir -p "$LOG_DIR"

echo "==> pgvector on port $DB_PORT"
if ! docker ps --format '{{.Names}}' | grep -q '^agile-planner-pgvector$'; then
  DB_PORT="$DB_PORT" docker-compose up -d pgvector 2>/dev/null || DB_PORT="$DB_PORT" docker compose up -d pgvector
fi

echo "==> Ollama models ($OLLAMA_CHAT_MODEL, nomic-embed-text)"
# Keep models loaded between calls — reloading the embedding model can take 30s+ on CPU
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-30m}"
curl -sf http://localhost:11434/api/version >/dev/null || { nohup ollama serve >"$LOG_DIR/ollama.log" 2>&1 & sleep 3; }
ollama pull "$OLLAMA_CHAT_MODEL"
ollama pull nomic-embed-text

echo "==> Building"
./mvnw -q -DskipTests install

echo "==> Requirement Analysis Agent on port $AGENT_PORT"
PORT="$AGENT_PORT" DB_URL="jdbc:postgresql://localhost:$DB_PORT/vectordb" \
  nohup java -jar requirement-analysis-agent/target/requirement-analysis-agent-2.0.0-SNAPSHOT.jar \
  >"$LOG_DIR/requirement-agent.log" 2>&1 &
until curl -sf "http://localhost:$AGENT_PORT/.well-known/agent-card.json" >/dev/null; do sleep 1; done

echo "==> Orchestrator Agent on port $ORCHESTRATOR_PORT"
PORT="$ORCHESTRATOR_PORT" AGENT_URLS="http://localhost:$AGENT_PORT" \
  nohup java -jar orchestrator-agent/target/orchestrator-agent-2.0.0-SNAPSHOT.jar \
  >"$LOG_DIR/orchestrator.log" 2>&1 &
until curl -sf "http://localhost:$ORCHESTRATOR_PORT/orchestrator-agent/orchestrator/agents" >/dev/null; do sleep 1; done

echo
echo "Backend ready: http://localhost:$ORCHESTRATOR_PORT/orchestrator-agent"
echo "Logs in $LOG_DIR/. Frontend: cd frontend && npm install && npm run dev"
