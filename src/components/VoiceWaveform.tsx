'use client'
// src/components/VoiceWaveform.tsx — the live bars + timer shown while recording.
import { WAVE_POINTS, VOICE_MAX_SECONDS } from '@/lib/useVoiceInput'

export default function VoiceWaveform({ levels, seconds }: { levels: number[]; seconds: number }) {
  // pad on the left so the bars always fill the same width and scroll like a real meter
  const padded = [...Array(Math.max(0, WAVE_POINTS - levels.length)).fill(0), ...levels].slice(-WAVE_POINTS)
  const m = Math.floor(seconds / 60), s = String(seconds % 60).padStart(2, '0')
  const nearLimit = seconds >= VOICE_MAX_SECONDS - 10
  return (
    <div className="flex-1 flex items-center gap-2 min-w-0" role="status" aria-live="polite" aria-label="রেকর্ড হচ্ছে">
      <div className="flex-1 flex items-center justify-center gap-[3px] h-8 overflow-hidden" aria-hidden="true">
        {padded.map((v, i) => {
          const h = Math.max(0.1, Math.min(1, v * 7))   // speech RMS is ~0.02–0.3
          return <span key={i} className={`w-[3px] rounded-full ${v > 0.02 ? 'bg-indigo-500' : 'bg-gray-300'}`} style={{ height: `${Math.round(h * 100)}%`, transition: 'height 70ms linear' }} />
        })}
      </div>
      <span className={`text-xs font-mono tabular-nums flex-shrink-0 ${nearLimit ? 'text-red-500' : 'text-gray-500'}`}>{m}:{s}</span>
    </div>
  )
}
