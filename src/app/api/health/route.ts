export async function GET() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return Response.json({ ok: false, error: 'GOOGLE_AI_API_KEY não configurada' }, { status: 503 })
  }

  try {
    // List all available models for this API key
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
    )
    const data = await res.json() as {
      models?: { name: string; supportedGenerationMethods?: string[] }[]
      error?: { message: string }
    }

    if (!res.ok) {
      return Response.json({ ok: false, error: data?.error?.message ?? JSON.stringify(data) }, { status: 500 })
    }

    const models = (data.models ?? [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name)

    return Response.json({ ok: true, keyPrefix: apiKey.slice(0, 8) + '...', availableModels: models })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
