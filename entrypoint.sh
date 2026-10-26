#!/bin/sh
set -e

# 1. Adaptar el puerto dinámico asignado por Render
export N8N_PORT="${PORT:-5678}"
export N8N_LISTEN_ADDRESS="0.0.0.0"
export N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
export N8N_PROXY_HOPS="${N8N_PROXY_HOPS:-1}"

# 2. Detectar automáticamente la URL pública de Render (RENDER_EXTERNAL_URL)
if [ -n "$RENDER_EXTERNAL_URL" ]; then
    CLEAN_URL=$(echo "$RENDER_EXTERNAL_URL" | sed 's:/*$::')
    export WEBHOOK_URL="${WEBHOOK_URL:-${CLEAN_URL}/}"
    export N8N_EDITOR_BASE_URL="${N8N_EDITOR_BASE_URL:-${CLEAN_URL}/}"
    TARGET_PING_URL="${KEEP_ALIVE_URL:-${CLEAN_URL}/healthz}"
elif [ -n "$WEBHOOK_URL" ]; then
    CLEAN_URL=$(echo "$WEBHOOK_URL" | sed 's:/*$::')
    TARGET_PING_URL="${KEEP_ALIVE_URL:-${CLEAN_URL}/healthz}"
else
    TARGET_PING_URL="${KEEP_ALIVE_URL:-http://127.0.0.1:${N8N_PORT}/healthz}"
fi

# Intervalo por defecto: 600 segundos (10 minutos, antes del límite de 15 min de Render)
INTERVALO_SEGUNDOS="${KEEP_ALIVE_INTERVAL_SECONDS:-600}"

echo "=========================================================="
echo " Iniciando n8n en puerto ${N8N_PORT}"
echo " URL de Webhooks : ${WEBHOOK_URL:-local}"
echo " Helper 24/7     : Activo cada ${INTERVALO_SEGUNDOS}s -> ${TARGET_PING_URL}"
echo "=========================================================="

# 3. Proceso Helper Keep-Alive 24/7 en segundo plano
(
    # Esperar a que n8n termine de inicializar antes del primer ping
    sleep 45
    while true; do
        node -e "
          const url = process.env.TARGET_PING_URL || '${TARGET_PING_URL}';
          fetch(url, { headers: { 'User-Agent': 'n8n-KeepAlive-Helper/1.0' } })
            .then(res => console.log('[Keep-Alive 24/7] Ping exitoso ->', url, 'Status:', res.status, new Date().toISOString()))
            .catch(err => console.error('[Keep-Alive 24/7] Error en ping ->', url, err.message));
        "
        sleep "${INTERVALO_SEGUNDOS}"
    done
) &

# 4. Iniciar n8n como proceso principal
exec n8n start
