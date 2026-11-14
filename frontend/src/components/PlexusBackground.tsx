import { useEffect, useRef } from 'react'

/**
 * Fondo cinematográfico: una "cinta" de miles de partículas que ondula y se
 * retuerce en 3D (azul → lavanda, con chispas magenta), más polvo estelar.
 * Cuando la cinta queda de canto, los puntos se concentran y brillan como
 * una hebra de luz.
 *
 * Rendimiento: canvas 2D, puntos agrupados por color/alfa (pocas llamadas de
 * dibujo), menos puntos en pantallas pequeñas, pausa en pestaña oculta y un
 * solo cuadro estático con "reducir movimiento".
 */
type Props = {
  /** 0..1 — qué tan visible es la cinta (en la app va más tenue que en el login) */
  intensity?: number
  /** Posición horizontal del centro de la cinta (0 = izquierda, 1 = derecha) */
  anchor?: number
}

const COLORS = [
  [111, 150, 255], // azul
  [140, 160, 255], // azul lavanda
  [170, 150, 255], // lavanda
  [152, 255, 232], // menta (borde)
  [255, 92, 150], // chispa magenta
] as const
const ALPHAS = [0.12, 0.28, 0.5, 0.85]

export default function PlexusBackground({ intensity = 0.6, anchor = 0.72 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let w = 0, h = 0, raf = 0
    let U = 0, V = 0
    let tone: Uint8Array = new Uint8Array(0)
    let dust: { x: number; y: number; r: number; tw: number; s: number }[] = []
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const small = w < 768
      U = small ? 90 : 170 // puntos a lo largo de la cinta
      V = small ? 22 : 34 // puntos a lo ancho
      // Tono fijo por punto: mayoría azul/lavanda, bordes menta, algunas chispas magenta
      tone = new Uint8Array(U * V)
      for (let i = 0; i < U; i++)
        for (let j = 0; j < V; j++) {
          const edge = j === 0 || j === V - 1
          const r = Math.random()
          tone[i * V + j] = r < 0.012 ? 4 : edge && r < 0.5 ? 3 : Math.floor((j / V) * 3)
        }
      dust = Array.from({ length: small ? 40 : 90 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        tw: Math.random() * Math.PI * 2,
        s: Math.random() * 0.15 + 0.03,
      }))
    }

    // Cubetas: [color][alfa] → lista de rects; se dibuja cada cubeta con un solo fill()
    const buckets: number[][][] = COLORS.map(() => ALPHAS.map(() => []))

    const draw = (time: number) => {
      const t = time * 0.001
      ctx.clearRect(0, 0, w, h)
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04

      for (const c of buckets) for (const a of c) a.length = 0

      const small = w < 768
      const baseX = w * (small ? 0.55 : anchor) + mouse.x * 18
      const ribbonW = Math.min(w, 1400) * (small ? 0.34 : 0.2)

      for (let i = 0; i < U; i++) {
        const u = i / (U - 1)
        // Columna vertebral: baja desde arriba con una curva en S suave
        const y = (u * 1.35 - 0.18) * h + mouse.y * 12
        const cx = baseX + Math.sin(u * 2.6 + t * 0.18) * w * 0.12 + Math.sin(u * 6.5 - t * 0.35) * 18
        const twist = u * 6.8 + t * 0.32
        const ct = Math.cos(twist), st = Math.sin(twist)
        const width = ribbonW * (0.55 + 0.45 * Math.sin(u * 3.1 + t * 0.15 + 1))
        // Más brillo donde la cinta está de canto (cos≈0) → hebra luminosa
        const edgeGlow = 1 - Math.abs(ct)

        for (let j = 0; j < V; j++) {
          const v = (j / (V - 1)) * 2 - 1
          const x = cx + v * width * ct
          const z = v * width * st
          const yy = y + z * 0.22
          const front = (st * v + 1) / 2 // 0 atrás, 1 adelante
          let level = 0.15 + front * 0.45 + edgeGlow * 0.4
          level *= intensity
          const ai = level > 0.62 ? 3 : level > 0.4 ? 2 : level > 0.22 ? 1 : 0
          const ti = tone[i * V + j]
          const size = 0.7 + front * 1.1
          buckets[ti][ai].push(x, yy, size)
        }
      }

      ctx.globalCompositeOperation = 'lighter'
      for (let c = 0; c < COLORS.length; c++) {
        const [r, g, b] = COLORS[c]
        for (let a = 0; a < ALPHAS.length; a++) {
          const list = buckets[c][a]
          if (!list.length) continue
          ctx.fillStyle = `rgba(${r},${g},${b},${ALPHAS[a] * (c === 4 ? 1.2 : 1)})`
          ctx.beginPath()
          for (let k = 0; k < list.length; k += 3) ctx.rect(list[k], list[k + 1], list[k + 2], list[k + 2])
          ctx.fill()
        }
      }

      // Polvo estelar titilando
      for (const d of dust) {
        d.y -= d.s
        if (d.y < -5) d.y = h + 5
        const a = (0.25 + 0.35 * Math.sin(t * 1.3 + d.tw)) * Math.max(intensity, 0.5)
        ctx.fillStyle = `rgba(186,215,245,${Math.max(0, a)})`
        ctx.fillRect(d.x + mouse.x * 6, d.y, d.r, d.r)
      }
      ctx.globalCompositeOperation = 'source-over'
      if (!reduced) raf = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / w - 0.5
      mouse.ty = e.clientY / h - 0.5
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(draw)
    }

    resize()
    draw(performance.now())
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intensity, anchor])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 w-full h-full -z-10" />
}
