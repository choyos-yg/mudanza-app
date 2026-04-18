// Edge Function: chat de onboarding con Claude
// Recibe el mensaje de la usuaria, carga su historial, llama a Claude,
// guarda la respuesta y, si Claude decide que el perfil está completo,
// lo estructura y guarda en user_profile.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const SYSTEM_PROMPT = `Eres una coach de relaciones cálida, perceptiva y con muy buena escucha. Estás hablando con Paulina, 28 años, que busca pareja seria pero con calma. Las apps tradicionales no le han funcionado y quiere un enfoque más consciente y diferente.

Tu misión: una entrevista conversacional de onboarding para conocerla a fondo. NO es un cuestionario rígido — es una charla. Una pregunta por mensaje, con calma.

Temas a cubrir (en orden natural, fluyendo según lo que ella comparta):
1. Contexto actual: cómo es su vida hoy, qué la hace feliz, qué la agota.
2. Valores profundos: qué admira en la gente, qué no negocia.
3. Historia relacional: qué ha funcionado, qué no, qué aprendió.
4. Qué busca AHORA: tipo de relación, ritmo, cómo imagina compartir la vida.
5. Dealbreakers honestos: el NO rotundo.
6. Green flags: cualidades que la enamoran de verdad (no las de manual).
7. Comunicación y afecto: cómo le gusta dar y recibir.
8. Miedos y esperanzas sobre este momento de buscar pareja.

Tono:
- Cercana, curiosa, cálida. Como una amiga sabia que tuviera todo el tiempo del mundo.
- Español natural, tuteo.
- UNA pregunta por mensaje. 2-4 frases máximo.
- Valida antes de profundizar ("qué bonito", "tiene mucho sentido", "gracias por compartir eso").
- Cuando algo resuene, profundiza suavemente ("cuéntame más de eso", "¿qué sentiste?").
- No juzgues. No des consejos. No moralices. Esto es para entenderla, no para arreglar nada.
- Si responde corto, no la presiones — reformula o cambia de ángulo.

Cierre:
- Cuando sientas que tienes un retrato completo y honesto (mínimo ~20 intercambios reales, cubriendo los 8 temas), usa la tool \`save_profile\` con el perfil estructurado. Después, despídete cálidamente explicando qué viene ahora.
- No uses la tool antes de tiempo — es mejor preguntar una más que quedarse corta.

Primera interacción:
- Saluda por su nombre, presenta brevemente qué vamos a hacer (una charla tranquila para conocerla, ~20-30 min, sin prisa), y empieza con algo ligero del presente.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autenticada (no auth header)' }, 401)

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'No autenticada (token vacio)' }, 401)

    const payload = parseJwtPayload(token)
    if (!payload || payload.role !== 'authenticated' || !payload.sub) {
      return json({ error: 'No autenticada', detail: 'invalid jwt payload' }, 401)
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return json({ error: 'Sesion expirada' }, 401)
    }
    const user = { id: payload.sub as string, email: payload.email as string | undefined }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = await req.json().catch(() => ({}))
    const userMessage: string | undefined = body.message

    const { data: history } = await supabase
      .from('onboarding_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    const messages: { role: 'user' | 'assistant'; content: string }[] =
      (history || []).map((m: any) => ({ role: m.role, content: m.content }))

    if (userMessage && userMessage.trim()) {
      await supabase.from('onboarding_messages').insert({
        user_id: user.id,
        role: 'user',
        content: userMessage,
      })
      messages.push({ role: 'user', content: userMessage })
    }

    const apiMessages = messages.length === 0
      ? [{ role: 'user' as const, content: '[inicio de la conversación — saluda a Paulina y empieza]' }]
      : messages

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
        tools: [{
          name: 'save_profile',
          description: 'Guarda el perfil estructurado cuando el onboarding esté completo y tengas un retrato fiel de Paulina.',
          input_schema: {
            type: 'object',
            properties: {
              values_core: {
                type: 'array',
                items: { type: 'string' },
                description: 'Valores fundamentales (3-7). Lo que la define.',
              },
              relationship_goals: {
                type: 'object',
                description: 'Qué busca: tipo de relación, ritmo, visión de pareja.',
                properties: {
                  type: { type: 'string' },
                  pace: { type: 'string' },
                  vision: { type: 'string' },
                },
              },
              dealbreakers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Los NO rotundos.',
              },
              green_flags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Cualidades que la enamoran de verdad.',
              },
              past_patterns: {
                type: 'string',
                description: 'Patrones relacionales pasados, qué ha aprendido.',
              },
              communication_style: {
                type: 'string',
                description: 'Cómo le gusta comunicarse, resolver conflictos, recibir afecto.',
              },
              life_stage: {
                type: 'string',
                description: 'Dónde está en la vida ahora: trabajo, ciudad, energía.',
              },
              share_card_text: {
                type: 'string',
                description: 'Descripción cálida y específica en 1er persona (80-120 palabras) que Paulina pueda compartir con amigos/familia para que le presenten gente: quién es, qué busca, qué la hace especial. Español natural, sin clichés.',
              },
            },
            required: ['values_core', 'dealbreakers', 'green_flags', 'share_card_text'],
          },
        }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('Claude API error:', errText)
      return json({ error: 'Error hablando con Claude', detail: errText }, 500)
    }

    const claudeData = await claudeRes.json()
    let assistantText = ''
    let profileSaved = false

    for (const block of claudeData.content || []) {
      if (block.type === 'text') assistantText += block.text
      if (block.type === 'tool_use' && block.name === 'save_profile') {
        await supabase.from('user_profile').update({
          values_core: block.input.values_core,
          relationship_goals: block.input.relationship_goals,
          dealbreakers: block.input.dealbreakers,
          green_flags: block.input.green_flags,
          past_patterns: block.input.past_patterns,
          communication_style: block.input.communication_style,
          life_stage: block.input.life_stage,
          share_card_text: block.input.share_card_text,
          onboarding_status: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id)
        profileSaved = true
      }
    }

    if (assistantText) {
      await supabase.from('onboarding_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: assistantText,
      })
    }

    return json({ reply: assistantText, profile_saved: profileSaved })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}
