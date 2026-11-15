# Atlas — Guía de Configuración

Dashboard privado para organizarte: **Proyectos** (grafo), **Tareas** (tablero tipo Trello),
**Calendario** (Google Calendar + fechas límite de tus tareas) y **Finanzas** (movimientos,
presupuestos, regla 50/30/20, metas de ahorro y cuentas).

Son **dos proyectos en Vercel** a partir del mismo repositorio:

| Parte     | Carpeta     | Qué es                                   |
|-----------|-------------|------------------------------------------|
| Frontend  | `frontend/` | React + Vite (la página)                 |
| Backend   | `backend/`  | API Fastify (función serverless en Vercel) |

> ⚠️ Si solo despliegas el frontend, nada funciona: el login y los datos viven en el backend.

---

## 1. 🗄️ Supabase

1. Crea un proyecto en **[supabase.com](https://supabase.com)**.
2. Guarda la **Project URL** y la key **`service_role`** (Project Settings → API).
   Es secreta: solo va en el backend.
3. Ve a **SQL Editor**, pega el contenido de `backend/supabase-schema.sql` y ejecútalo.
   - Si ya tenías la base creada, basta con ejecutar las migraciones nuevas, por ejemplo `backend/supabase-migration-2026-11-15.sql` (dinero por proyecto) y `backend/supabase-migration-2026-11-16.sql` (plataformas y cuentas como nodos).
   Puedes ejecutarlo de nuevo cada vez que se actualice: no borra datos.
   Además activa *Row Level Security* para que nadie pueda leer tus tablas con la key pública.

---

## 2. 🌐 Google Cloud Console (gratis)

1. **[console.cloud.google.com](https://console.cloud.google.com)** → crea un proyecto.
2. **APIs y servicios → Biblioteca** → habilita **Google Calendar API**.
3. **Pantalla de consentimiento OAuth**: tipo *Externo* y agrega tu correo en *Usuarios de prueba*.
   - Mientras la app esté en modo *Prueba*, Google vence el permiso cada 7 días y tendrás que volver a iniciar sesión.
     Para evitarlo, dale a **Publicar app** (por ser de uso personal no necesitas verificación; Google mostrará un aviso que puedes aceptar).
4. **Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web**.
5. En **URIs de redireccionamiento autorizados** agrega LOS DOS:
   ```
   http://localhost:3001/auth/google/callback
   https://TU-BACKEND.vercel.app/auth/google/callback
   ```
6. Copia el **Client ID** y el **Client Secret**.

---

## 3. 💻 Correr en local

### Backend → `backend/.env` (copia `backend/.env.example`)
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
ALLOWED_EMAILS=tu-correo@gmail.com
JWT_SECRET=<mínimo 32 caracteres aleatorios>
FRONTEND_URL=http://localhost:5173
```
Generar el `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Frontend → `frontend/.env`
```env
VITE_API_URL=http://localhost:3001
```

### Iniciar
```bash
cd backend && npm install && npm run dev
```
```bash
cd frontend && npm install && npm run dev
```
Abre **http://localhost:5173**

---

## 4. 🚀 Desplegar en Vercel

### 4.1 Backend (proyecto nuevo)
1. Vercel → **Add New → Project** → importa este repositorio.
2. **Root Directory: `backend`**. Framework: *Other* (lo toma de `backend/vercel.json`).
3. En **Environment Variables** agrega las mismas del `.env` del backend, cambiando:
   - `GOOGLE_REDIRECT_URI=https://TU-BACKEND.vercel.app/auth/google/callback`
   - `FRONTEND_URL=https://TU-FRONTEND.vercel.app` (puedes agregar `,http://localhost:5173` al final)
4. Deploy. Comprueba que `https://TU-BACKEND.vercel.app/health` responde `{"status":"ok"}`.

### 4.2 Frontend
1. En tu proyecto de Vercel del frontend: **Root Directory: `frontend`** (framework Vite).
2. Variable de entorno: `VITE_API_URL=https://TU-BACKEND.vercel.app` (sin `/` al final).
3. **Redeploy**. Las variables `VITE_*` se leen al compilar, así que cada vez que cambies una hay que volver a desplegar.

### Si algo falla
| Síntoma | Causa probable |
|---|---|
| El botón de Google lleva a `localhost` | Falta `VITE_API_URL` en el frontend o no se volvió a desplegar |
| Google dice `redirect_uri_mismatch` | El URI del paso 2.5 no coincide exactamente con `GOOGLE_REDIRECT_URI` |
| Error de CORS en la consola | `FRONTEND_URL` del backend no coincide con la URL real del frontend |
| "Esta cuenta no tiene acceso" | Tu correo no está en `ALLOWED_EMAILS` |
| `/health` da error 500 | Falta una variable de entorno en el backend (revisa los logs de Vercel) |

---

## 5. 🔒 Seguridad

- Solo los correos en `ALLOWED_EMAILS` pueden entrar; todas las rutas `/api/*` exigen sesión.
- Los tokens de Google se guardan en la tabla `google_tokens` (servidor), no en el navegador.
- La key `service_role` de Supabase solo existe en el backend; el frontend no habla con Supabase.
- La sesión dura 7 días; al expirar te devuelve al login.

---

## 6. 📂 Estructura

```
frontend/src/
├── pages/        Projects · Tasks · Calendar · Finance · Login
├── components/   Layout, ui (modal, inputs), ProjectModal, TaskModal, EventModal, FinanceModals
└── lib/          api.ts (cliente HTTP + formatos), tasks.ts, finance.ts
backend/
├── api/index.ts  Entrada serverless para Vercel
├── src/app.ts    App Fastify (auth global, CORS, errores)
├── src/index.ts  Servidor local
├── src/lib/      config (variables), supabase, google (tokens)
├── src/routes/   auth · projects · tasks · calendar · finance
└── supabase-schema.sql
```
