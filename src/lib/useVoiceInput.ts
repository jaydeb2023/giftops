'use client'
// src/lib/useVoiceInput.ts
//
// Voice input that works like the Grok / ChatGPT mic:
//   tap mic → records with a live waveform → ✕ cancels, ✓ transcribes →
//   the text lands in the input box for the user to check and send.
//
// Audio is transcribed by /api/transcribe (Whisper) instead of the browser's
// built-in engine, which is what mangled words like "কাতলা মাছ এড কর".
// Nothing here ever writes data: it only produces text for the input box.
import { useCallback, useEffect, useRef, useState } from 'react'

export type VoicePhase = 'idle' | 'recording' | 'transcribing'
export type VoiceLang = 'bn' | 'en'

export const VOICE_MAX_SECONDS = 60
const MIN_RECORDING_MS = 500     // shorter than this = accidental tap
const SPEECH_RMS = 0.02          // a sample louder than this counts as "someone is talking"
const MIN_SPEECH_MS = 250        // …and we need at least this much of it, else it's just room noise
const TICK_MS = 70
export const WAVE_POINTS = 36
const UPLOAD_TIMEOUT_MS = 25_000

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function pickMimeType(): string {
  const MR: any = typeof window !== 'undefined' ? (window as any).MediaRecorder : undefined
  if (!MR || typeof MR.isTypeSupported !== 'function') return ''
  return MIME_CANDIDATES.find(t => MR.isTypeSupported(t)) || ''
}

const extFor = (mime: string) => (/mp4|m4a|aac/i.test(mime) ? 'm4a' : /ogg/i.test(mime) ? 'ogg' : 'webm')

export interface UseWhisperVoiceOptions {
  /** Called with the transcribed text. */
  onText: (text: string) => void
  /** Called with a short, user-facing (Bengali) message when something goes wrong. */
  onError?: (message: string) => void
  /** Shop vocabulary (product / customer names) to help spell local words. Called when recording starts. */
  getHint?: () => Promise<string[]> | string[]
  /** Extra form fields for the server (e.g. the agent type, so it can use that shop's vocabulary). */
  getExtra?: () => Record<string, string>
  lang: VoiceLang
  endpoint?: string
}

export function useWhisperVoice({ onText, onError, getHint, getExtra, lang, endpoint = '/api/transcribe' }: UseWhisperVoiceOptions) {
  const [supported, setSupported] = useState(false)
  const [phase, setPhaseState] = useState<VoicePhase>('idle')
  const [levels, setLevels] = useState<number[]>([])
  const [seconds, setSeconds] = useState(0)

  const phaseRef = useRef<VoicePhase>('idle')
  const setPhase = (p: VoicePhase) => { phaseRef.current = p; setPhaseState(p) }

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef('')
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const speechMsRef = useRef(0)
  const hintRef = useRef<Promise<string[]>>(Promise.resolve([]))
  const startingRef = useRef(false)
  const gateRef = useRef<GainNode | null>(null)
  const floorRef = useRef(0.01)
  const holdUntilRef = useRef(0)
  const mountedRef = useRef(true)

  // Always call the latest callbacks / language without re-creating start/accept.
  const cb = useRef({ onText, onError, lang, endpoint, getExtra })
  cb.current = { onText, onError, lang, endpoint, getExtra }

  useEffect(() => {
    mountedRef.current = true
    const ok = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
      && typeof (window as any).MediaRecorder !== 'undefined'
    setSupported(ok)
    return () => { mountedRef.current = false; teardown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function teardown() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    try { if (recorderRef.current && recorderRef.current.state !== 'inactive') { recorderRef.current.ondataavailable = null; recorderRef.current.onstop = null; recorderRef.current.stop() } } catch { /* already stopped */ }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach(t => { try { t.stop() } catch { /* ignore */ } })
    streamRef.current = null
    try { ctxRef.current?.close() } catch { /* ignore */ }
    ctxRef.current = null
  }

  const fail = (msg: string) => { if (mountedRef.current) cb.current.onError?.(msg) }

  const reset = () => {
    teardown()
    chunksRef.current = []
    if (mountedRef.current) { setLevels([]); setSeconds(0); setPhase('idle') } else phaseRef.current = 'idle'
  }

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle' || startingRef.current) return
    startingRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, noiseSuppression: true, autoGainControl: true,
          channelCount: 1, sampleRate: { ideal: 48000 },
          // Chrome / Android extras: stronger hum + background-noise removal
          ...({ googNoiseSuppression: true, googHighpassFilter: true, googEchoCancellation: true, googAutoGainControl: true } as any),
        },
      })
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream

      // ── Noise filtering BEFORE the audio is recorded ──
      // mic → high-pass 100 Hz (fans, hum, wind) → low-pass 7 kHz (hiss) → [level meter]
      //     → compressor (evens out near / far voices) → noise gate (quiet the room between words)
      //     → make-up gain → recorder.  If WebAudio is unavailable we record the raw mic.
      let analyser: AnalyserNode | null = null
      let buf: Uint8Array | null = null
      let recStream: MediaStream = stream
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext
        if (AC) {
          const ctx: AudioContext = new AC()
          ctxRef.current = ctx
          if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
          const src = ctx.createMediaStreamSource(stream)
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 100; hp.Q.value = 0.7
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = 0.7
          analyser = ctx.createAnalyser(); analyser.fftSize = 512
          const comp = ctx.createDynamicsCompressor()
          comp.threshold.value = -34; comp.knee.value = 20; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2
          const gate = ctx.createGain(); gate.gain.value = 1
          const makeup = ctx.createGain(); makeup.gain.value = 1.6
          const dest = ctx.createMediaStreamDestination()
          src.connect(hp); hp.connect(lp)
          lp.connect(analyser)
          lp.connect(comp); comp.connect(gate); gate.connect(makeup); makeup.connect(dest)
          gateRef.current = gate
          floorRef.current = 0.01
          holdUntilRef.current = 0
          recStream = dest.stream
          buf = new Uint8Array(analyser.fftSize)
        }
      } catch { analyser = null; recStream = stream; gateRef.current = null }

      const mime = pickMimeType()
      mimeRef.current = mime
      const rec = new MediaRecorder(recStream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      recorderRef.current = rec
      if (rec.mimeType) mimeRef.current = rec.mimeType

      speechMsRef.current = 0
      startedAtRef.current = Date.now()
      hintRef.current = Promise.resolve(getHint ? getHint() : []).catch(() => [] as string[])
      rec.start(1000)
      setLevels([]); setSeconds(0); setPhase('recording')

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current
        let rms = 0
        if (analyser && buf) {
          analyser.getByteTimeDomainData(buf as any)
          let sum = 0
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
          rms = Math.sqrt(sum / buf.length)
        }
        if (rms > SPEECH_RMS) speechMsRef.current += TICK_MS
        // Adaptive noise gate: learn the room's noise floor (capped, so loud speech never raises it
        // enough to cut the voice), open on speech, hold 350 ms so word endings are never clipped.
        const gate = gateRef.current
        if (gate && ctxRef.current) {
          floorRef.current = Math.min(0.015, rms, floorRef.current * 1.01 + 0.0002)
          const now = Date.now()
          if (rms > Math.max(floorRef.current * 2.2, 0.012)) holdUntilRef.current = now + 350
          gate.gain.setTargetAtTime(now < holdUntilRef.current ? 1 : 0.2, ctxRef.current.currentTime, 0.04)
        }
        if (mountedRef.current) {
          setLevels(prev => [...prev.slice(-(WAVE_POINTS - 1)), rms])
          setSeconds(Math.floor(elapsed / 1000))
        }
        if (elapsed >= VOICE_MAX_SECONDS * 1000) void accept()
      }, TICK_MS)
    } catch (e: any) {
      reset()
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') fail('Microphone permission দিন।')
      else if (e?.name === 'NotFoundError') fail('মাইক্রোফোন পাওয়া যায়নি।')
      else fail('মাইক্রোফোন চালু করা যায়নি।')
    } finally {
      startingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getHint])

  /** ✕ — throw the recording away. */
  const cancel = useCallback(() => { if (phaseRef.current === 'recording') reset() }, [])

  /** ✓ — stop, transcribe, hand the text to onText. */
  const accept = useCallback(async () => {
    if (phaseRef.current !== 'recording') return
    setPhase('transcribing')
    const rec = recorderRef.current
    const mime = mimeRef.current
    const elapsed = Date.now() - startedAtRef.current
    const spoke = speechMsRef.current

    const blob: Blob = await new Promise(resolve => {
      const done = () => resolve(new Blob(chunksRef.current, { type: mime || 'audio/webm' }))
      if (!rec || rec.state === 'inactive') return done()
      rec.onstop = done
      try { rec.stop() } catch { done() }
    })
    teardown()
    if (mountedRef.current) setLevels([])

    // Nothing said → don't even upload (this is what stops Whisper inventing text from silence).
    if (elapsed < MIN_RECORDING_MS || spoke < MIN_SPEECH_MS) {
      reset(); fail('কিছু শোনা যায়নি — মাইকের কাছে আবার বলুন।'); return
    }

    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
    try {
      const hints = (await hintRef.current).slice(0, 40)
      const fd = new FormData()
      fd.append('audio', blob, `voice.${extFor(blob.type || mime)}`)
      fd.append('lang', cb.current.lang)
      fd.append('hint', hints.join('|'))
      try { for (const [k, v] of Object.entries(cb.current.getExtra?.() || {})) fd.append(k, String(v)) } catch { /* optional */ }
      const res = await fetch(cb.current.endpoint, { method: 'POST', body: fd, signal: ctrl.signal, credentials: 'same-origin' })
      if (res.status === 401) { fail('আবার লগইন করুন।'); return }
      if (res.status === 429) { fail('একটু পরে আবার চেষ্টা করুন।'); return }
      if (res.status === 413) { fail('রেকর্ডিং অনেক বড় — ছোট করে বলুন।'); return }
      if (!res.ok) { fail('ভয়েস বুঝতে পারিনি — আবার চেষ্টা করুন বা টাইপ করুন।'); return }
      const data = await res.json()
      const text = String(data?.text || '').trim()
      if (!text) { fail('কিছু বুঝতে পারিনি — আবার বলুন।'); return }
      if (mountedRef.current) cb.current.onText(text)
    } catch {
      fail('নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন বা টাইপ করুন।')
    } finally {
      clearTimeout(timeout)
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    supported,
    phase,
    listening: phase === 'recording',
    transcribing: phase === 'transcribing',
    levels,
    seconds,
    start,
    accept,
    cancel,
  }
}
