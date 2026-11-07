import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

/**
 * Presse-and-hold : la confirmation ne se déclenche qu'après avoir maintenu
 * l'appui pendant `duration` ms sans relâcher (souris, tactile ou clavier).
 * `progress` (0 à 1) sert à afficher une progression visuelle.
 *
 * Au tactile, la capture du pointeur permet de tolérer les petits
 * déplacements du doigt : seul un relâchement ou une interruption
 * (défilement pris en charge par le navigateur) annule.
 */
export function usePressAndHold(duration = 3000) {
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const startedAt = useRef(0)

  const cancel = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    setProgress(0)
  }, [])

  useEffect(() => {
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }, [])

  const start = useCallback(
    (onComplete: () => void, event?: PointerEvent<HTMLElement>) => {
      if (raf.current !== null) return
      if (event) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* capture non disponible : le maintien reste vérifié au relâchement */
        }
      }
      startedAt.current = performance.now()
      const tick = () => {
        const elapsed = performance.now() - startedAt.current
        setProgress(Math.min(1, elapsed / duration))
        if (elapsed >= duration) {
          cancel()
          onComplete()
          return
        }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    [duration, cancel],
  )

  return { progress, start, cancel }
}
