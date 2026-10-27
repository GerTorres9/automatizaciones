import { spawn } from "node:child_process";

// 1. Configurar puerto dinámico de Render y variables base de n8n
process.env.N8N_PORT = process.env.PORT || process.env.N8N_PORT || "5678";
process.env.N8N_LISTEN_ADDRESS = "0.0.0.0";
process.env.N8N_PROTOCOL = process.env.N8N_PROTOCOL || "https";
process.env.N8N_PROXY_HOPS = process.env.N8N_PROXY_HOPS || "1";

// 2. Autoconfigurar PostgreSQL persistente si se define DATABASE_URL (Neon, Supabase o Render Postgres)
const rawDatabaseUrl = (process.env.DATABASE_URL || "").trim();
if (rawDatabaseUrl && !process.env.DB_TYPE) {
  try {
    const dbUrl = new URL(rawDatabaseUrl);
    process.env.DB_TYPE = "postgresdb";
    process.env.DB_POSTGRESDB_HOST = dbUrl.hostname;
    process.env.DB_POSTGRESDB_PORT = dbUrl.port || "5432";
    process.env.DB_POSTGRESDB_DATABASE =
      dbUrl.pathname.replace(/^\/+/, "") || "postgres";
    process.env.DB_POSTGRESDB_USER = decodeURIComponent(dbUrl.username);
    process.env.DB_POSTGRESDB_PASSWORD = decodeURIComponent(dbUrl.password);
    process.env.DB_POSTGRESDB_SSL_ENABLED = "true";
    process.env.DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED = "false";
    console.log(
      `[DB Persistente] PostgreSQL configurado automáticamente -> ${dbUrl.hostname}/${process.env.DB_POSTGRESDB_DATABASE}`
    );
  } catch (err) {
    console.error("[DB Persistente] Error al leer DATABASE_URL:", err.message);
  }
}

// 3. Autodetectar la URL pública de Render (RENDER_EXTERNAL_URL)
const rawExternalUrl =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.WEBHOOK_URL ||
  "https://n8n-automation-l4lw.onrender.com";
const cleanExternalUrl = rawExternalUrl.replace(/\/+$/, "");

if (cleanExternalUrl) {
  process.env.WEBHOOK_URL = process.env.WEBHOOK_URL || `${cleanExternalUrl}/`;
  process.env.N8N_EDITOR_BASE_URL =
    process.env.N8N_EDITOR_BASE_URL || `${cleanExternalUrl}/`;
}

const basePingUrl =
  process.env.KEEP_ALIVE_URL || `${cleanExternalUrl}/healthz`;

// Intervalo de 240s (4 minutos) con cache-buster para atravesar Cloudflare hasta Render
const intervalSeconds = Number(process.env.KEEP_ALIVE_INTERVAL_SECONDS) || 240;

console.log("==========================================================");
console.log(` Iniciando n8n en puerto : ${process.env.N8N_PORT}`);
console.log(` Base de datos activa    : ${process.env.DB_TYPE || "sqlite (efímera en Render Free)"}`);
console.log(` URL Pública / Webhooks  : ${process.env.WEBHOOK_URL}`);
console.log(` Helper Keep-Alive 24/7  : Cada ${intervalSeconds}s -> ${basePingUrl}`);
console.log("==========================================================");

// 4. Helper Keep-Alive 24/7 nativo en Node.js con anti-caché Cloudflare
async function pingHealthcheck() {
  const urlWithNoCache = `${basePingUrl}${basePingUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
  try {
    const response = await fetch(urlWithNoCache, {
      headers: {
        "User-Agent": "n8n-Render-KeepAlive-Helper/2.0",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    console.log(
      `[Keep-Alive 24/7] Ping OK (${response.status}) -> ${basePingUrl} @ ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error(
      `[Keep-Alive 24/7] Aviso en ping -> ${basePingUrl}: ${error.message}`
    );
  }
}

setTimeout(() => {
  pingHealthcheck();
  setInterval(pingHealthcheck, intervalSeconds * 1000);
}, 35_000);

// 5. Iniciar n8n como proceso principal y reenviar señales del sistema
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
