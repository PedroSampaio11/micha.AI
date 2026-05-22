import { NextRequest } from 'next/server'
import { MODES, ModeId } from '@/lib/modes'

const GEMINI_URL = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    console.error('[analyze] GOOGLE_AI_API_KEY não configurada')
    return new Response(JSON.stringify({ error: 'Serviço não configurado.' }), { status: 503 })
  }

  try {
    const { imageBase64, mimeType, modeId } = await req.json() as {
      imageBase64: string
      mimeType: string
      modeId: ModeId
    }

    if (!imageBase64 || !modeId) {
      return new Response(JSON.stringify({ error: 'Imagem e modo são obrigatórios.' }), { status: 400 })
    }

    const mode = MODES.find(m => m.id === modeId)
    if (!mode) {
      return new Response(JSON.stringify({ error: 'Modo inválido.' }), { status: 400 })
    }

    const geminiRes = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: mode.systemPrompt }],
        },
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType ?? 'image/jpeg',
                data: imageBase64,
              },
            },
            { text: 'Analise esta imagem e execute sua função conforme as instruções.' },
          ],
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!geminiRes.ok || !geminiRes.body) {
      const errText = await geminiRes.text()
      console.error('[analyze] gemini error:', errText)
      return new Response(JSON.stringify({ error: errText }), { status: geminiRes.status })
    }

    // Gemini SSE: each line is "data: {json}" — extract text and forward as plain stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiRes.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const flush = (raw: string) => {
          const lines = raw.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const json = line.slice(6).trim()
            if (!json || json === '[DONE]') continue
            try {
              const parsed = JSON.parse(json)
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) controller.enqueue(encoder.encode(text))
            } catch { /* skip malformed chunk */ }
          }
        }
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              if (buffer) flush(buffer)
              break
            }
            buffer += decoder.decode(value, { stream: true })
            const cut = buffer.lastIndexOf('\n')
            if (cut === -1) continue
            flush(buffer.slice(0, cut + 1))
            buffer = buffer.slice(cut + 1)
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analyze] erro:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
