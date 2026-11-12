# Dashboard Personal — Guía de Configuración

## 1. 🌐 Google Cloud Console (GRATIS)

> La Google Calendar API es **100% gratuita** hasta 1,000,000 de peticiones/día. No necesitas tarjeta de crédito para usarla en este proyecto.

### Pasos para crear el proyecto:

1. Ve a → **[console.cloud.google.com](https://console.cloud.google.com)**
2. Haz clic en **"Crear proyecto"** → pon un nombre (ej: `dashboard-personal`)
3. En el menú lateral: **APIs y servicios → Biblioteca**
4. Busca **"Google Calendar API"** → clic → **Habilitar**
5. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**
6. Tipo de aplicación: **"Aplicación web"**
7. Agrega estos URIs de redireccionamiento autorizados:
   ```
   http://localhost:3001/auth/google/callback
   ```
8. Copia el **Client ID** y **Client Secret**

---

## 2. 🗄️ Supabase (GRATIS)

1. Ve a → **[supabase.com](https://supabase.com)** → Crea un proyecto nuevo
2. Guarda tu **Project URL** y las dos keys: `anon` (pública) y `service_role` (secreta)
3. Ve a **SQL Editor** y pega + ejecuta el contenido de:
   ```
   backend/supabase-schema.sql
   ```

---

## 3. ⚙️ Configurar variables de entorno

### Backend → `backend/.env`
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key

GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

JWT_SECRET=una-cadena-aleatoria-larga-y-segura

PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Frontend → `frontend/.env`
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

---

## 4. 🚀 Correr el proyecto

### Terminal 1 — Backend
```bash
cd backend
npm run dev
```

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
```

Abre → **http://localhost:5173**

---

## 5. 📂 Estructura del proyecto

```
dashboard-personal/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx       ← Login con Google
│       │   ├── Projects.tsx    ← Grafo de nodos
│       │   ├── Calendar.tsx    ← Calendario Google
│       │   └── Finance.tsx     ← Dashboard finanzas
│       ├── components/
│       │   └── Layout.tsx      ← Nav sidebar + mobile
│       └── lib/
│           └── api.ts          ← Cliente HTTP
└── backend/
    ├── src/
    │   ├── index.ts            ← Servidor Fastify
    │   ├── lib/supabase.ts     ← Cliente Supabase
    │   └── routes/
    │       ├── auth.ts         ← Google OAuth2
    │       ├── projects.ts     ← CRUD proyectos
    │       ├── calendar.ts     ← Google Calendar API
    │       └── finance.ts      ← Finanzas + stats
    └── supabase-schema.sql     ← Tablas de la DB
```

