import { useEffect, useRef, useState } from 'react'

type Props = {
  min: number
  max: number
  valueMin: number
  valueMax: number
  onChange: (vMin: number, vMax: number) => void
  intervalMs?: number
}

export default function YearRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  intervalMs = 500
}: Props) {
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const current = valueMax
      if (current >= max) {
        setPlaying(false)
        return
      }
      onChange(valueMin, current + 1)
    }, intervalMs)
    return () => clearInterval(id)
  }, [playing, valueMax, valueMin, max, onChange, intervalMs])

  const togglePlay = () => {
    if (!playing && valueMax >= max) {
      onChange(valueMin, valueMin)
    }
    setPlaying(p => !p)
  }

  const reset = () => {
    setPlaying(false)
    onChange(min, max)
  }

  const trackRange = max - min || 1
  const leftPct = ((valueMin - min) / trackRange) * 100
  const rightPct = ((valueMax - min) / trackRange) * 100

  const handleMin = (v: number) => {
    const next = Math.min(v, valueMax)
    onChange(next, valueMax)
  }
  const handleMax = (v: number) => {
    const next = Math.max(v, valueMin)
    onChange(valueMin, next)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{valueMin}</span>
        <span>{valueMax}</span>
      </div>

      <div className="relative h-6">
        <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded bg-gray-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-gray-900"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={valueMin}
          onChange={e => handleMin(Number.parseInt(e.target.value, 10))}
          className="year-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={valueMax}
          onChange={e => handleMax(Number.parseInt(e.target.value, 10))}
          className="year-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={togglePlay}
          className="flex-1 px-2 py-1 rounded text-xs bg-gray-900 text-white hover:bg-gray-700"
        >
          {playing ? '⏸ Pausa' : '▶ Play'}
        </button>
        <button
          onClick={reset}
          className="px-2 py-1 rounded text-xs border border-gray-300 hover:bg-gray-100"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
