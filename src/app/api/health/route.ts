export async function GET() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return Response.json({ ok: false, error: 'GOOGLE_AI_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas: ok' }] }],
        }),
      }
    )
    const data = await res.json() as {
      candidates?: { content: { parts: { text: string }[] } }[]
      error?: { message: string }
    }
    if (!res.ok) {
      return Response.json({ ok: false, status: res.status, error: data?.error?.message ?? JSON.stringify(data) }, { status: 500 })
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return Response.json({ ok: true, model: 'gemini-2.5-flash (v1beta)', response: text, keyPrefix: apiKey.slice(0, 8) + '...' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
