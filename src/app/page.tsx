'use client'

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { MODES, Mode, ModeId } from '@/lib/modes'

function parseResultToHtml(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<code>$1</code>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function extractPrompts(text: string): string[] {
  const matches = text.match(/```([\s\S]*?)```/g) ?? []
  return matches.map(m => m.replace(/```/g, '').trim()).filter(Boolean)
}

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, envie um arquivo de imagem (JPG, PNG ou WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('A imagem deve ter menos de 10MB.')
      return
    }
    setError(null)
    setResult(null)
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const resizeAndConvert = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const MAX = 1920
          let { width, height } = img
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas error'))
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
        }
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleAnalyze = async () => {
    if (!imageFile || !selectedMode) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const { base64, mimeType } = await resizeAndConvert(imageFile)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, modeId: selectedMode.id }),
      })
      const data = await res.json() as { result?: string; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Erro desconhecido.')
      } else {
        setResult(data.result ?? '')
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // fallback silent
    }
  }

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode)
    setResult(null)
    setError(null)
  }

  const prompts = result ? extractPrompts(result) : []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-none">Promptadores</h1>
            <p className="text-xs text-gray-500 mt-0.5">Análise de imagens para arquitetura</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <section>
          <p className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
            Selecione o modo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleModeSelect(mode)}
                className={`
                  text-left p-4 rounded-xl border-2 transition-all
                  ${selectedMode?.id === mode.id
                    ? `${mode.accentBg} ${mode.accentBorder} shadow-sm`
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                <p className={`text-sm font-semibold leading-tight mb-1 ${selectedMode?.id === mode.id ? mode.accent : 'text-gray-800'}`}>
                  {mode.name}
                </p>
                <p className="text-xs text-gray-500 leading-snug">{mode.description}</p>
              </button>
            ))}
          </div>
        </section>

        {selectedMode && (
          <section className="mt-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className={`px-6 py-4 ${selectedMode.accentBg} border-b ${selectedMode.accentBorder}`}>
                <h2 className={`font-semibold ${selectedMode.accent}`}>{selectedMode.name}</h2>
                <p className="text-sm text-gray-600 mt-0.5">{selectedMode.description}</p>
              </div>

              <div className="p-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${isDragging ? 'border-gray-400 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" className="w-full max-h-72 object-contain rounded-xl" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 rounded-xl transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                        <span className="bg-white/90 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow">Trocar imagem</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-700">Arraste a imagem aqui</p>
                      <p className="text-xs text-gray-400 mt-1">ou clique para selecionar</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — máx. 10MB</p>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                    {error}
                  </p>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={!imageFile || isLoading}
                  className={`
                    mt-4 w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all
                    ${!imageFile || isLoading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.99] shadow-sm'
                    }
                  `}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analisando...
                    </span>
                  ) : 'Analisar Imagem'}
                </button>
              </div>
            </div>
          </section>
        )}

        {result && (
          <section className="mt-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Resultado</h3>
                <button
                  onClick={() => handleCopy(result, -1)}
                  className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition-colors"
                >
                  {copiedIndex === -1 ? (
                    <><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-600">Copiado!</span></>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>Copiar tudo</>
                  )}
                </button>
              </div>

              {prompts.length > 0 && (
                <div className={`px-6 py-3 ${selectedMode?.accentBg ?? 'bg-gray-50'} border-b ${selectedMode?.accentBorder ?? 'border-gray-100'}`}>
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {prompts.length === 1 ? 'Prompt pronto para copiar:' : `${prompts.length} prompts prontos para copiar:`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleCopy(prompt, i)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all border ${copiedIndex === i ? 'bg-green-50 border-green-300 text-green-700' : `bg-white ${selectedMode?.accentBorder ?? 'border-gray-200'} ${selectedMode?.accent ?? 'text-gray-700'} hover:shadow-sm`}`}
                      >
                        {copiedIndex === i ? 'Copiado!' : prompts.length === 1 ? 'Copiar Prompt' : `Copiar Prompt ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-6 py-5">
                <div
                  className="result-content text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: parseResultToHtml(result) }}
                />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-6 mt-4">
        <p className="text-xs text-gray-400 text-center">Promptadores v2 — Arquitetura de Interiores</p>
      </footer>
    </div>
  )
}
