import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest } from 'next/server'
import { MODES, ModeId } from '@/lib/modes'

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

    const genai = new GoogleGenerativeAI(apiKey)
    const model = genai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: mode.systemPrompt,
    })

    const streamResult = await model.generateContentStream([
      {
        inlineData: {
          data: imageBase64,
          mimeType: (mimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
        },
      },
      'Analise esta imagem e execute sua função conforme as instruções.',
    ])

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            const text = chunk.text()
            if (text) controller.enqueue(encoder.encode(text))
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
    return new Response(JSON.stringify({ error: 'Erro ao processar. Tente novamente.' }), { status: 500 })
  }
}
