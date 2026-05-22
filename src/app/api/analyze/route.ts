import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { MODES, ModeId } from '@/lib/modes'

const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, modeId } = await req.json() as {
      imageBase64: string
      mimeType: string
      modeId: ModeId
    }

    if (!imageBase64 || !modeId) {
      return NextResponse.json({ error: 'Imagem e modo são obrigatórios.' }, { status: 400 })
    }

    const mode = MODES.find(m => m.id === modeId)
    if (!mode) {
      return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
    }

    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: mode.systemPrompt,
    })

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: (mimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        },
      },
      'Analise esta imagem e execute sua função conforme as instruções.',
    ])

    const text = result.response.text()
    return NextResponse.json({ result: text })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar a imagem. Tente novamente.' },
      { status: 500 }
    )
  }
}
