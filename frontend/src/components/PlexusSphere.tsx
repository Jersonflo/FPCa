import { useEffect, useRef } from 'react'

/* Un solo requestAnimationFrame para todas las esferas (mejor rendimiento) */
const drawers = new Set<(t: number) => void>()
let rafId = 0
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
function loop(t: number) {
  drawers.forEach((d) => d(t))
  rafId = drawers.size && !reduced ? requestAnimationFrame(loop) : 0
}
function register(d: (t: number) => void) {
  drawers.add(d)
  if (!rafId) rafId = requestAnimationFrame(loop)
  return () => {
    drawers.delete(d)
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [103, 232, 249]
}

type Props = {
  size?: number
  color?: string
  /** cantidad de puntos (más = malla más densa) */
  points?: number
  /** velocidad de giro relativa */
  speed?: number
  /** intensidad del brillo 0..1 */
  energy?: number
  seed?: number
}

/**
 * Esfera de malla "plexus": puntos sobre una esfera conectados por líneas,
 * girando en 3D con perspectiva y brillo aditivo.
 */
export default function PlexusSphere({ size = 150, color = '#22d3ee', points = 56, speed = 1, energy = 1, seed = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Generador pseudoaleatorio con semilla → cada proyecto tiene su propia malla
    let s = seed * 9301 + 49297
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)

    const R = size * 0.3
    const pts: [number, number, number][] = []
    // Distribución de Fibonacci + algo de ruido: cubre la esfera de forma pareja
    for (let i = 0; i < points; i++) {
      const y = 1 - (i / (points - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = i * 2.399963 + rand() * 0.6
      const jitter = 1 + (rand() - 0.5) * 0.22
      pts.push([Math.cos(th) * r * R * jitter, y * R * jitter, Math.sin(th) * r * R * jitter])
    }
    // Las distancias no cambian al rotar → las aristas se calculan una sola vez
    const edges: [number, number, number][] = []
    const maxD = R * 0.72
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2])
        if (d < maxD) edges.push([i, j, 1 - d / maxD])
      }

    const [cr, cg, cb] = hexToRgb(color)
    // Color de líneas: mezcla 60/40 del color del proyecto con azul hielo (más elegante, menos neón)
    const lr = Math.round(cr * 0.6 + 186 * 0.4), lg = Math.round(cg * 0.6 + 215 * 0.4), lb = Math.round(cb * 0.6 + 245 * 0.4)
    const sparks = pts.map(() => rand() < 0.12)
    const LEVELS = 6
    const lineBuckets: number[][] = Array.from({ length: LEVELS }, () => [])
    const dotBuckets: number[][] = Array.from({ length: LEVELS }, () => [])
    const cx = size / 2, cy = size / 2
    const proj = new Array(pts.length)
    const phase = rand() * 10

    const draw = (t: number) => {
      const a = t * 0.00035 * speed + phase
      const b = Math.sin(t * 0.0002 + phase) * 0.5 + 0.35
      const breath = 1 + Math.sin(t * 0.0016 * Math.max(speed, 0.4) + phase) * 0.04 * energy
      const ca = Math.cos(a), sa = Math.sin(a), cbb = Math.cos(b), sb = Math.sin(b)
      for (let i = 0; i < pts.length; i++) {
        const [x, y, z] = pts[i]
        const x1 = x * ca - z * sa, z1 = x * sa + z * ca
        const y1 = y * cbb - z1 * sb, z2 = y * sb + z1 * cbb
        const k = (R * 3.2) / (R * 3.2 + z2)
        proj[i] = [cx + x1 * k * breath, cy + y1 * k * breath, k, z2]
      }

      ctx.clearRect(0, 0, size, size)
      ctx.globalCompositeOperation = 'lighter'

      // Halo exterior muy suave
      const halo = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.6)
      halo.addColorStop(0, `rgba(${cr},${cg},${cb},${0.12 * energy})`)
      halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, size, size)

      // Malla: líneas finas en el color del proyecto mezclado con azul hielo.
      // Se agrupan por nivel de brillo → pocas llamadas a stroke() por cuadro (mucho más fluido)
      ctx.lineWidth = 0.55
      for (const b of lineBuckets) b.length = 0
      for (const [i, j, w] of edges) {
        const p = proj[i], q = proj[j]
        const depth = (p[2] + q[2]) / 2
        const a = w * 0.62 * depth * depth * energy
        const bi = Math.min(LEVELS - 1, Math.floor((a / 0.75) * LEVELS))
        if (bi >= 0) lineBuckets[bi].push(p[0], p[1], q[0], q[1])
      }
      for (let bi = 0; bi < LEVELS; bi++) {
        const list = lineBuckets[bi]
        if (!list.length) continue
        ctx.strokeStyle = `rgba(${lr},${lg},${lb},${((bi + 0.5) / LEVELS) * 0.75})`
        ctx.beginPath()
        for (let k = 0; k < list.length; k += 4) {
          ctx.moveTo(list[k], list[k + 1])
          ctx.lineTo(list[k + 2], list[k + 3])
        }
        ctx.stroke()
      }
      // Nodos: puntos azul hielo (agrupados por brillo); algunos titilan en menta
      for (const b of dotBuckets) b.length = 0
      for (let i = 0; i < proj.length; i++) {
        const p = proj[i]
        const k = p[2]
        const twinkle = sparks[i] ? Math.max(0, Math.sin(t * 0.004 + i)) ** 6 : 0
        const r = 0.6 * k + 0.25 + twinkle * 1.2
        if (twinkle > 0.2) {
          ctx.fillStyle = `rgba(152,255,232,${Math.min(1, (0.35 + 0.6 * k * k) * energy + twinkle * 0.9)})`
          ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2)
          continue
        }
        const alpha = (0.35 + 0.6 * k * k) * energy
        const bi = Math.min(LEVELS - 1, Math.floor(alpha * LEVELS))
        dotBuckets[bi].push(p[0] - r, p[1] - r, r * 2)
      }
      for (let bi = 0; bi < LEVELS; bi++) {
        const list = dotBuckets[bi]
        if (!list.length) continue
        ctx.fillStyle = `rgba(214,232,252,${(bi + 0.5) / LEVELS})`
        ctx.beginPath()
        for (let k = 0; k < list.length; k += 3) ctx.rect(list[k], list[k + 1], list[k + 2], list[k + 2])
        ctx.fill()
      }
      // Núcleo pequeño y suave
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42)
      core.addColorStop(0, `rgba(240,248,255,${0.55 * energy})`)
      core.addColorStop(0.3, `rgba(${lr},${lg},${lb},${0.28 * energy})`)
      core.addColorStop(1, `rgba(${lr},${lg},${lb},0)`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.42 * breath, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    draw(performance.now())
    return register(draw)
  }, [size, color, points, speed, energy, seed])

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />
}
