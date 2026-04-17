# 🌷 Paulina Match

App web progresiva (PWA) de coach personal de dating consciente.
Pensada para una sola usuaria (Paulina) — no es una app multi-usuario.

## Qué hace (v1)

- **Chat de onboarding con Claude** (~20-30 min): una entrevista cálida donde
  Claude la conoce a fondo: valores, historia, patrones, dealbreakers, green flags.
- **Perfil estructurado automático**: al terminar, Claude guarda un retrato
  psicológico y genera una "tarjeta para compartir" que Paulina puede
  enviar a amigos/familia por WhatsApp para que le presenten gente.
- **Se instala en el móvil como app** (PWA).

## Próximas fases

- Fichas de candidatos con análisis de compatibilidad.
- Reflexión post-cita guiada.
- Detector de patrones a lo largo del tiempo.

---

## 🛠️ Setup paso a paso

Tiempo estimado: 30-45 minutos la primera vez.

### 1. Crea una cuenta de Anthropic y consigue una API key

1. Entra en https://console.anthropic.com
2. Crea cuenta y añade $5-10 USD de crédito (pestaña *Billing*).
3. Ve a *API Keys* → **Create Key**. Copia la key (empieza por `sk-ant-...`).
4. Guárdala en un sitio seguro — la usarás en el paso 3.

### 2. Crea un proyecto de Supabase

1. Entra en https://supabase.com → **New project**.
2. Nombre sugerido: `paulina-match`. Región: la más cercana (Frankfurt o N. Virginia).
3. Elige una contraseña fuerte para la BD (guárdala).
4. Espera 1-2 min a que el proyecto se aprovisione.

Cuando esté listo:

**a) Ejecuta el esquema SQL**
- Ve a *SQL Editor* → **New query**.
- Abre `supabase/schema.sql` de este repo, copia todo el contenido, pégalo y dale a **Run**.
- Debería decir "Success. No rows returned."

**b) Consigue las keys**
- Ve a *Project Settings* → *API*.
- Copia dos valores:
  - **Project URL** (tipo `https://xxxxx.supabase.co`)
  - **anon public key** (empieza por `eyJ...`)

**c) Configura la autenticación**
- *Authentication* → *Providers* → asegúrate de que **Email** está habilitado.
- *Authentication* → *URL Configuration* → añade en *Site URL* y *Redirect URLs*
  la URL donde vayas a alojar la app (si no la tienes aún, pon `http://localhost:8000`
  para probar en local y después añades la definitiva).

### 3. Despliega la Edge Function (`chat`)

La Edge Function es la que habla con Claude con tu API key segura (nunca expuesta al navegador).

**Opción A — Desde Supabase Dashboard (más fácil, sin instalar nada)**

1. En Supabase, ve a *Edge Functions* → **Create a new function**.
2. Nombre: `chat`.
3. Copia el contenido de `supabase/functions/chat/index.ts` y pégalo en el editor.
4. Deploy.
5. Ve a *Edge Functions* → *Manage secrets* (o *Project Settings* → *Edge Functions*).
   Añade estos tres secrets:
   - `ANTHROPIC_API_KEY` → tu key de Anthropic (`sk-ant-...`)
   - `SUPABASE_URL` → tu Project URL (la misma de arriba)
   - `SUPABASE_ANON_KEY` → tu anon public key

> Nota: Supabase suele inyectar `SUPABASE_URL` y `SUPABASE_ANON_KEY` automáticamente.
> Si te dice que ya existen, solo añade `ANTHROPIC_API_KEY`.

**Opción B — Con la CLI de Supabase** (si prefieres terminal):
```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
supabase functions deploy chat
```

### 4. Configura el frontend

Abre `index.html` y reemplaza estas dos líneas (cerca del tope del `<script>`):

```js
const SUPABASE_URL = 'REEMPLAZAR_CON_TU_URL'
const SUPABASE_ANON_KEY = 'REEMPLAZAR_CON_TU_ANON_KEY'
```

Con los valores de Supabase del paso 2b.

### 5. Prueba en local

Desde la carpeta `paulina-match/`:
```bash
python3 -m http.server 8000
```
Abre http://localhost:8000 en el móvil o navegador. Registra el email de Paulina,
revisa su correo y pincha el enlace mágico.

### 6. Despliega a la web (para que Paulina la use desde el móvil)

Opciones (gratis y fáciles):

**GitHub Pages** (más simple si ya está en GitHub):
1. Si esto aún está en el repo `mudanza-app` como subcarpeta, tendrás que extraerlo
   o mover el contenido al repo que uses para Pages.
2. Settings → Pages → *Source*: branch + carpeta.
3. Usa la URL que te dé GitHub.

**Vercel** (más flexible):
1. Importa el repo en https://vercel.com.
2. *Root directory*: `paulina-match`.
3. *Framework preset*: Other.
4. Deploy.

**IMPORTANTE después de desplegar:**
Vuelve a Supabase → *Authentication* → *URL Configuration* y añade tu URL
pública (Vercel/Pages) a *Site URL* y *Redirect URLs*. Si no, el enlace
mágico del email no funcionará.

### 7. Instalar como app en el móvil

Paulina abre la URL en Safari (iPhone) o Chrome (Android):
- **iPhone**: botón compartir → "Añadir a pantalla de inicio".
- **Android**: menú (⋮) → "Instalar app" o "Añadir a pantalla principal".

Funciona offline para leer conversaciones pasadas (la primera carga necesita red).

---

## 🎨 Personalización

### Cambiar el icono
Reemplaza `icon-192.png` e `icon-512.png` por los tuyos (mismos tamaños).
Puedes generarlos en https://realfavicongenerator.net o similar.

### Ajustar el tono del coach
El "carácter" de Claude vive en `supabase/functions/chat/index.ts`, en la
constante `SYSTEM_PROMPT`. Puedes editarlo para cambiar el tono, añadir temas
o cambiar el idioma. Después redeploya la función.

### Añadir nombre/edad manualmente
Las columnas `display_name`, `age`, `location` en `user_profile` existen pero
no se usan todavía en la UI. Puedes llenarlas desde el *Table Editor* de Supabase
o añadir una pantalla de ajustes.

---

## 🔐 Privacidad

- Solo Paulina ve sus propios datos — Row Level Security en Supabase lo garantiza.
- La API key de Anthropic nunca sale del servidor (vive en Supabase Edge Functions).
- El email magic link no guarda contraseñas.
- Si quieres borrar todo: *Project Settings* → *General* → *Delete project*.

---

## 🚀 Extraer a su propio repositorio

Cuando quieras sacar `paulina-match/` a un repo independiente:

```bash
# Desde el repo actual
cd ..
git subtree split --prefix=paulina-match -b paulina-match-only
# Crea un repo nuevo en GitHub (ej. paulina-match)
cd /tmp && mkdir paulina-match && cd paulina-match && git init
git pull /ruta/a/mudanza-app paulina-match-only
git remote add origin https://github.com/TU_USUARIO/paulina-match.git
git push -u origin main
```

---

## 📐 Arquitectura

```
                                                      
    Navegador                                          
    (iOS/Android                                      
     Chrome/Safari)                                   
         |                                             
         v                                             
    index.html (PWA)                                   
    - Login magic link                                 
    - Chat UI                                          
    - Perfil                                           
         |                                             
         |--- auth + BD ---> Supabase (Postgres + RLS) 
         |                                             
         \--- POST /chat ---> Edge Function "chat"     
                                  |                    
                                  \---> Claude API     
                                        (Anthropic)    
```

**Quién escribe dónde:**
- Frontend lee/escribe en Supabase con la `anon key` (protegido por RLS).
- Edge Function lee/escribe en Supabase con la sesión de la usuaria.
- Edge Function llama a Claude con la `ANTHROPIC_API_KEY` (server-side).

---

## ❓ Troubleshooting

**"No me llega el email del magic link"**
- Revisa spam.
- Verifica que la URL actual esté en *Authentication > URL Configuration*.
- Supabase free tier envía ~3-4 emails/hora; si estás probando mucho, espera.

**"Error 401 al enviar mensaje"**
- La sesión caducó → salir y volver a entrar.
- El bearer token no se está mandando → revisa la consola del navegador.

**"Error hablando con Claude"**
- Revisa los logs de la Edge Function en Supabase.
- Verifica que `ANTHROPIC_API_KEY` esté en los secrets.
- Verifica saldo en console.anthropic.com.

**"El perfil nunca se guarda"**
- Claude decide cuándo — necesita unos 20+ intercambios con información sustancial.
- Si quieres forzarlo, añade al final del `SYSTEM_PROMPT`:
  `"Después de 15 mensajes usa save_profile aunque la info sea parcial."`
