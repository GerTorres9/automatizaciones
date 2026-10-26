import { spawn } from "node:child_process";

// 1. Configurar puerto dinámico de Render y variables base de n8n
process.env.N8N_PORT = process.env.PORT || process.env.N8N_PORT || "5678";
process.env.N8N_LISTEN_ADDRESS = "0.0.0.0";
process.env.N8N_PROTOCOL = process.env.N8N_PROTOCOL || "https";
process.env.N8N_PROXY_HOPS = process.env.N8N_PROXY_HOPS || "1";

// 2. Autodetectar la URL pública que inyecta Render (RENDER_EXTERNAL_URL)
const rawExternalUrl = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL || "";
const cleanExternalUrl = rawExternalUrl.replace(/\/+$/, "");

if (cleanExternalUrl) {
  process.env.WEBHOOK_URL = process.env.WEBHOOK_URL || `${cleanExternalUrl}/`;
  process.env.N8N_EDITOR_BASE_URL = process.env.N8N_EDITOR_BASE_URL || `${cleanExternalUrl}/`;
}

const targetPingUrl =
  process.env.KEEP_ALIVE_URL ||
  (cleanExternalUrl
    ? `${cleanExternalUrl}/healthz`
    : `http://127.0.0.1:${process.env.N8N_PORT}/healthz`);

const intervalSeconds = Number(process.env.KEEP_ALIVE_INTERVAL_SECONDS) || 600;

console.log("==========================================================");
console.log(` Iniciando n8n en puerto : ${process.env.N8N_PORT}`);
console.log(` URL Pública / Webhooks  : ${process.env.WEBHOOK_URL || "local"}`);
console.log(` Helper Keep-Alive 24/7  : Cada ${intervalSeconds}s -> ${targetPingUrl}`);
console.log("==========================================================");

// 3. Helper Keep-Alive 24/7 nativo en Node.js (sin procesos extra ni binarios de shell)
async function pingHealthcheck() {
  try {
    const response = await fetch(targetPingUrl, {
      headers: { "User-Agent": "n8n-Render-KeepAlive-Helper/1.0" },
    });
    console.log(
      `[Keep-Alive 24/7] Ping OK (${response.status}) -> ${targetPingUrl} @ ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error(
      `[Keep-Alive 24/7] Aviso en ping -> ${targetPingUrl}: ${error.message}`
    );
  }
}

setTimeout(() => {
  pingHealthcheck();
  setInterval(pingHealthcheck, intervalSeconds * 1000);
}, 45_000);

// 4. Iniciar n8n como proceso principal y reenviar señales del sistema
const n8nProcess = spawn("/usr/local/bin/n8n", ["start"], {
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!n8nProcess.killed) {
      n8nProcess.kill(signal);
    }
  });
}

n8nProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});
