'use client'

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { MODES, Mode } from '@/lib/modes'

// ── helpers ──────────────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      blocks.push(<h2 key={i}>{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      blocks.push(<h3 key={i}>{line.slice(4)}</h3>)
    } else if (line === '---') {
      blocks.push(<hr key={i} />)
    } else if (line.startsWith('```')) {
      // collect code block
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i])
        i++
      }
      blocks.push(<div key={i} className="prompt-block">{code.join('\n')}</div>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [line.slice(2)]
      while (i + 1 < lines.length && (lines[i + 1].startsWith('- ') || lines[i + 1].startsWith('* '))) {
        i++
        items.push(lines[i].slice(2))
      }
      blocks.push(
        <ul key={i}>
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: boldify(item) }} />
          ))}
        </ul>
      )
    } else if (line.trim()) {
      blocks.push(
        <p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />
      )
    }
    i++
  }
  return blocks
}

function boldify(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function extractPrompts(text: string): string[] {
  const matches = [...text.matchAll(/```([\s\S]*?)```/g)]
  return matches.map(m => m[1].trim()).filter(Boolean)
}

// ── mode icons ────────────────────────────────────────────────────────────────

const MODE_ICONS: Record<string, React.ReactNode> = {
  tradutor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  interiores: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  externas: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  serie: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  mood: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
}

const MODE_COLORS: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  tradutor:  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',  iconBg: 'bg-amber-100' },
  interiores:{ bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   iconBg: 'bg-blue-100' },
  externas:  { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700',iconBg: 'bg-emerald-100' },
  serie:     { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700', iconBg: 'bg-violet-100' },
  mood:      { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',   iconBg: 'bg-rose-100' },
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setError('Envie uma imagem JPG, PNG ou WebP.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Máximo 10MB.'); return }
    setError(null); setResult('')
    setImageFile(file)
    const r = new FileReader()
    r.onload = e => setImagePreview(e.target?.result as string)
    r.readAsDataURL(file)
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  const resizeImage = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = e => {
        const img = new Image()
        img.onload = () => {
          const MAX = 1600
          let { width, height } = img
          if (width > MAX || height > MAX) {
            const r = Math.min(MAX / width, MAX / height)
            width = Math.round(width * r); height = Math.round(height * r)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width; canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return rej(new Error('canvas'))
          ctx.drawImage(img, 0, 0, width, height)
          const url = canvas.toDataURL('image/jpeg', 0.88)
          res({ base64: url.split(',')[1], mimeType: 'image/jpeg' })
        }
        img.src = e.target?.result as string
      }
      reader.onerror = rej
      reader.readAsDataURL(file)
    })

  const analyze = async () => {
    if (!imageFile || !selectedMode) return
    setIsLoading(true); setError(null); setResult('')
    try {
      const { base64, mimeType } = await resizeImage(imageFile)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, modeId: selectedMode.id }),
      })
      if (!res.ok || !res.body) { setError('Erro ao analisar. Tente novamente.'); return }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setResult(full)
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet.')
    } finally {
      setIsLoading(false)
    }
  }

  const copyText = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  const colors = selectedMode ? MODE_COLORS[selectedMode.id] : null
  const prompts = result ? extractPrompts(result) : []

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold tracking-tight">P</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">Promptadores</span>
            <span className="text-slate-300 text-sm">·</span>
            <span className="text-slate-400 text-xs">Arquitetura de Interiores</span>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Powered by Gemini</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-6">

        {/* ── mode selector ── */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Selecione o modo</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {MODES.map(mode => {
              const c = MODE_COLORS[mode.id]
              const active = selectedMode?.id === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => { setSelectedMode(mode); setResult(''); setError(null) }}
                  className={`
                    relative text-left px-3.5 py-3.5 rounded-xl border transition-all duration-150
                    ${active
                      ? `${c.bg} ${c.border} shadow-sm`
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-colors ${active ? c.iconBg : 'bg-slate-100'}`}>
                    <span className={active ? c.text : 'text-slate-500'}>{MODE_ICONS[mode.id]}</span>
                  </div>
                  <p className={`text-xs font-semibold leading-snug ${active ? c.text : 'text-slate-700'}`}>
                    {mode.name}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── upload + analyze ── */}
        {selectedMode && (
          <section className="animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* mode header */}
              <div className={`px-5 py-3.5 flex items-center gap-2.5 border-b ${colors!.border} ${colors!.bg}`}>
                <span className={`${colors!.text} opacity-80`}>{MODE_ICONS[selectedMode.id]}</span>
                <div>
                  <p className={`text-sm font-semibold ${colors!.text}`}>{selectedMode.name}</p>
                  <p className="text-xs text-slate-500">{selectedMode.description}</p>
                </div>
              </div>

              <div className="p-5">
                {/* drop zone */}
                <div
                  onDrop={onDrop}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150
                    ${isDragging ? 'border-slate-400 bg-slate-50 scale-[0.995]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain rounded-[10px]" />
                      <div className="absolute inset-0 rounded-[10px] bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm">
                          Trocar imagem
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-600">Arraste a imagem aqui</p>
                      <p className="text-xs text-slate-400 mt-1">ou <span className="underline underline-offset-2">clique para selecionar</span></p>
                      <p className="text-xs text-slate-300 mt-2">JPG · PNG · WebP · máx 10MB</p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  onClick={analyze}
                  disabled={!imageFile || isLoading}
                  className={`
                    mt-4 w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150
                    ${!imageFile || isLoading
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] shadow-sm'
                    }
                  `}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Analisando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      Analisar Imagem
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── result ── */}
        {(result || (isLoading && selectedMode)) && (
          <section className="animate-slide-up">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* result header */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <span className="text-sm font-semibold text-slate-800">
                    {isLoading ? 'Gerando...' : 'Resultado'}
                  </span>
                </div>
                {result && !isLoading && (
                  <button
                    onClick={() => copyText(result, -1)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {copied === -1
                      ? <><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg><span className="text-emerald-600">Copiado</span></>
                      : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>Copiar tudo</>
                    }
                  </button>
                )}
              </div>

              {/* quick copy prompts */}
              {prompts.length > 0 && !isLoading && (
                <div className={`px-5 py-3 border-b ${colors?.border ?? 'border-slate-100'} ${colors?.bg ?? 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-400 mb-2">
                    {prompts.length === 1 ? 'Prompt pronto:' : `${prompts.length} prompts prontos:`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prompts.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => copyText(p, i)}
                        className={`
                          flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                          ${copied === i
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : `bg-white ${colors?.border ?? 'border-slate-200'} ${colors?.text ?? 'text-slate-700'} hover:shadow-sm`
                          }
                        `}
                      >
                        {copied === i ? (
                          <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Copiado!</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
                          {prompts.length === 1 ? 'Copiar Prompt' : `Prompt ${i + 1}`}</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* result body */}
              <div className="px-5 py-5">
                {result ? (
                  <div className={`prose-result ${isLoading ? 'streaming-cursor' : ''}`}>
                    {renderMarkdown(result)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`h-3 bg-slate-100 rounded animate-pulse`} style={{ width: `${[85, 70, 90, 65, 80][i]}%` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

      </main>

      <footer className="max-w-4xl mx-auto px-5 py-6">
        <p className="text-xs text-slate-300 text-center">Promptadores v2 · Freepik Nano Banana</p>
      </footer>
    </div>
  )
}
