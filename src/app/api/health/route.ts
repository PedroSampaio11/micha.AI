import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return Response.json({ ok: false, error: 'GOOGLE_AI_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const genai = new GoogleGenerativeAI(apiKey)
    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent('Responda apenas: ok')
    const text = result.response.text()
    return Response.json({ ok: true, response: text, keyPrefix: apiKey.slice(0, 8) + '...' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
