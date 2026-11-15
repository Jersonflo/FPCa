import { Handle, Position, getBezierPath, getStraightPath, type EdgeProps, type NodeProps } from 'reactflow'
import BrandLogo from './BrandLogo'
import type { PlatformAccount, PlatformDef } from '../lib/platforms'

/* Tamaños (se usan también para centrar la cámara y ubicar nodos nuevos) */
export const HUB_SIZE = 150
export const HUB_DISK = 96
export const ACC_SIZE = 120
export const ACC_DISK = 62

/** Handle invisible en el centro del nodo: las líneas "salen" del núcleo */
const center = { top: '50%', left: '50%', opacity: 0, width: 1, height: 1, border: 0, minWidth: 0, minHeight: 0 }

// ─── Nodo de PLATAFORMA (uno por servicio: Supabase, Vercel, GitHub…) ─────
export function HubNode({ data }: NodeProps<{ platform: PlatformDef; count: number; index: number }>) {
  const { platform, count } = data
  const c = platform.color
  return (
    <div className="group flex flex-col items-center cursor-pointer animate-node-in" style={{ width: HUB_SIZE, animationDelay: `${0.3 + data.index * 0.1}s` }}>
      <div className="relative flex items-center justify-center" style={{ width: HUB_DISK + 40, height: HUB_DISK + 40, marginTop: -20 }}>
        <Handle id="c" type="source" position={Position.Top} isConnectable={false} style={{ ...center, top: '50%' }} />
        {/* Halo y anillos */}
        <span className="absolute inset-0 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-70" style={{ background: `radial-gradient(circle, ${c}55 0%, transparent 65%)` }} />
        <svg className="absolute inset-0 animate-ring" style={{ animationDuration: '30s' }} viewBox="0 0 136 136" aria-hidden>
          <circle cx="68" cy="68" r="64" fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 7" />
        </svg>
        <svg className="absolute inset-0 animate-ring" style={{ animationDuration: '18s', animationDirection: 'reverse' }} viewBox="0 0 136 136" aria-hidden>
          <circle cx="68" cy="68" r="56" fill="none" stroke={c} strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="60 300" strokeLinecap="round" />
        </svg>
        {/* Disco con el logo */}
        <div
          className="relative rounded-full flex items-center justify-center glass transition-transform duration-500 group-hover:scale-105"
          style={{ width: HUB_DISK, height: HUB_DISK, boxShadow: `inset 0 0 30px -8px ${c}66, 0 0 40px -12px ${c}` }}
        >
          <span style={{ filter: `drop-shadow(0 0 10px ${c}aa)` }}>
            <BrandLogo platform={platform} size={40} />
          </span>
        </div>
      </div>
      <p className="text-[15px] font-medium tracking-tight text-gray-100 -mt-2">{platform.name}</p>
      <p className="label-caps !text-[9px] mt-0.5" style={{ color: c }}>
        {count} cuenta{count === 1 ? '' : 's'}
      </p>
    </div>
  )
}

// ─── Nodo de CUENTA (ej. Supabase "personal") ─────────────────────────────
export function AccountNode({ data }: NodeProps<{ account: PlatformAccount; platform: PlatformDef; uses: number; index: number }>) {
  const { account, platform, uses } = data
  const c = platform.color
  return (
    <div className="group flex flex-col items-center cursor-pointer animate-node-in" style={{ width: ACC_SIZE, animationDelay: `${0.5 + data.index * 0.06}s` }}>
      <div className="relative" style={{ width: ACC_DISK, height: ACC_DISK }}>
        <Handle id="c" type="target" position={Position.Top} isConnectable={false} style={center} />
        <Handle id="c" type="source" position={Position.Bottom} isConnectable={false} style={center} />
        {/* Punto para arrastrar hacia un proyecto */}
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !border-0 !-right-1"
          style={{ background: c, boxShadow: `0 0 10px ${c}` }}
        />
        <div
          className="w-full h-full rounded-full glass flex items-center justify-center transition-all duration-500 group-hover:scale-110"
          style={{ border: `1px solid ${c}55`, boxShadow: `0 0 26px -10px ${c}` }}
        >
          <BrandLogo platform={platform} size={24} />
        </div>
        {uses > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium flex items-center justify-center text-[#0b1424]"
            style={{ background: c }}
            title={`${uses} proyecto${uses === 1 ? '' : 's'}`}
          >
            {uses}
          </span>
        )}
      </div>
      <p className="text-[13px] text-gray-100 font-medium mt-2 truncate max-w-full">{account.name}</p>
      {account.username && <p className="text-[10px] text-gray-500 truncate max-w-full">{account.username}</p>}
    </div>
  )
}

// ─── Línea plataforma → cuenta (fija, con un pulso lento) ─────────────────
export function TetherEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<{ color: string }>) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const c = data?.color || '#9aa5f0'
  return (
    <g>
      <path id={id} d={path} fill="none" stroke={c} strokeOpacity={0.28} strokeWidth={1} />
      {/* Pulso con halo hecho de un círculo translúcido (sin filtros = mucho más fluido) */}
      <g>
        <circle r={5} fill={c} opacity={0.18} />
        <circle r={1.8} fill={c} />
        <animateMotion dur="4.5s" repeatCount="indefinite" path={path} />
      </g>
    </g>
  )
}

// ─── Línea cuenta → proyecto (se puede eliminar con clic) ─────────────────
export function LinkEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<{ color: string }>) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.3 })
  const c = data?.color || '#9aa5f0'
  const gid = `lg-${id}`
  const dur = 3 + (id.length % 4) * 0.5
  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0" stopColor={c} />
          <stop offset="1" stopColor="#bad7f5" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#${gid})`} strokeOpacity={0.07} strokeWidth={selected ? 10 : 6} strokeLinecap="round" />
      <path d={path} fill="none" className="react-flow__edge-path" style={{ stroke: `url(#${gid})`, strokeWidth: selected ? 1.5 : 1, strokeOpacity: selected ? 1 : 0.55, strokeDasharray: '4 5' }}>
        <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.4s" repeatCount="indefinite" />
      </path>
      <g>
        <circle r={6} fill={c} opacity={0.16} />
        <circle r={2.2} fill={c} />
        <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} />
      </g>
    </g>
  )
}
