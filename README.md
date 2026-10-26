# n8n en Render (Plan Gratuito) + Helper Keep-Alive 24/7

Este repositorio despliega **n8n** en el plan gratuito de **Render** utilizando Docker e incluye un sistema **Keep-Alive 24/7 de doble capa** para evitar que el servicio se duerma tras los 15 minutos de inactividad de Render.

---

## Arquitectura del Keep-Alive 24/7

1. **Capa 1 — Helper Interno Automático (`entrypoint.sh`):**
   - Al arrancar el contenedor, el script detecta automáticamente la variable `RENDER_EXTERNAL_URL` que inyecta Render (`https://tu-servicio.onrender.com`).
   - Configura automáticamente `WEBHOOK_URL`, `N8N_EDITOR_BASE_URL` y el puerto dinámico `$PORT`.
   - Levanta un proceso ligero en segundo plano que cada **10 minutos (`600s`)** realiza una petición HTTP hacia `https://tu-servicio.onrender.com/healthz` para mantener el tráfico activo sin que tengas que configurar nada.

2. **Capa 2 — Despertador Externo en GitHub Actions (`.github/workflows/keep-alive.yml`):**
   - Si Render reinicia sus servidores por mantenimiento de madrugada y el contenedor queda apagado, este workflow de GitHub Actions le envía un ping externo cada 10 minutos a `/healthz` para volver a encenderlo automáticamente.

3. **Bonus Opcional (`workflow-keep-alive-n8n.json`):**
   - Flujo listo para importar dentro de tu interfaz de n8n si además quieres monitorear los pings desde tus ejecuciones de n8n.

---

## Guía Paso a Paso para Desplegar en Render

### Paso 1: Subir este repositorio a GitHub
Sube este proyecto a un repositorio en tu cuenta de GitHub (por ejemplo `GerTorres9/n8n-render`).

### Paso 2: Desplegar en Render (con `render.yaml` o Web Service)
Tienes dos formas de crearlo en [dashboard.render.com](https://dashboard.render.com):

- **Opción A — Automática con Blueprint (Recomendada):**
  1. Haz clic en **New +** → **Blueprint**.
  2. Selecciona tu repositorio `n8n-render`.
  3. Render leerá `render.yaml`, seleccionará el plan **Free**, generará tu llave secreta `N8N_ENCRYPTION_KEY` y configurará la zona horaria `America/Mexico_City` automáticamente. Haz clic en **Apply**.

- **Opción B — Manual como Web Service:**
  1. Haz clic en **New +** → **Web Service** y selecciona el repositorio `n8n-render`.
  2. En **Runtime** elige **Docker** y en **Instance Type** elige **Free**.
  3. En **Environment Variables** agrega:
     - `N8N_ENCRYPTION_KEY` = *(cualquier cadena larga aleatoria, ej. `mi_clave_secreta_segura_2026`)*
     - `GENERIC_TIMEZONE` = `America/Mexico_City`
     - `TZ` = `America/Mexico_City`

### Paso 3: Activar el Despertador Externo en GitHub (Opcional pero recomendado)
Una vez que Render te dé tu URL (ej. `https://n8n-automation-xxxx.onrender.com`):
1. En tu repositorio de GitHub ve a **Settings** → **Secrets and variables** → **Actions**.
2. Selecciona la pestaña **Variables** → **New repository variable**.
3. Nombre: `N8N_RENDER_URL`
4. Valor: `https://n8n-automation-xxxx.onrender.com` (tu URL de Render).

---

## (Recomendado) Cómo hacer que tus Workflows nunca se borren al reiniciar

En el plan gratuito de Render el disco local del contenedor es efímero. Para que tus workflows, usuarios y credenciales queden guardados permanentemente gratis:

1. Crea un proyecto gratuito en **[Supabase](https://supabase.com)** o **[Neon.tech](https://neon.tech)**.
2. En el panel de tu servicio en Render ve a **Environment** y agrega estas variables con los datos de tu base PostgreSQL (usando el *Transaction/Session Pooler IPv4* en Supabase):

```env
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=aws-0-us-west-1.pooler.supabase.com
DB_POSTGRESDB_PORT=6543
DB_POSTGRESDB_DATABASE=postgres
DB_POSTGRESDB_USER=postgres.tu_id_proyecto
DB_POSTGRESDB_PASSWORD=tu_password_de_supabase
DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
```
