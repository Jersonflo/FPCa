import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Controls,
  MiniMap,
  addEdge,
  getBezierPath,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { Plus, ExternalLink, Server } from 'lucide-react'
import ProjectModal, { type Project } from '../components/ProjectModal'
import PlexusSphere from '../components/PlexusSphere'
import { moneyOf, compactCOP } from '../lib/projects'
import { platformOf, type PlatformAccount, type PlatformDef, type PlatformHub, type ProjectLink } from '../lib/platforms'
import { HubNode, AccountNode, TetherEdge, LinkEdge, HUB_SIZE, HUB_DISK, ACC_SIZE, ACC_DISK } from '../components/NetworkNodes'
import AccountModal from '../components/AccountModal'

type Status = Project['status']

const STATUS: Record<Status, { label: string; plural: string; color: string; speed: number; energy: number }> = {
  ACTIVE: { label: 'Activo', plural: 'activos', color: '#98ffe8', speed: 1.1, energy: 1 },
  PAUSED: { label: 'Pausado', plural: 'pausados', color: '#f5c97a', speed: 0.35, energy: 0.6 },
  COMPLETED: { label: 'Terminado', plural: 'terminados', color: '#9aa5f0', speed: 0.55, energy: 0.85 },
  INACTIVE: { label: 'Inactivo', plural: 'inactivos', color: '#6b7a93', speed: 0.2, energy: 0.4 },
  ARCHIVED: { label: 'Archivado', plural: 'archivados', color: '#e0457b', speed: 0.1, energy: 0.25 },
}

const NODE_SIZE = 190
const SPHERE = 170

// Semilla estable a partir del id → cada proyecto tiene una malla única
const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7)

/** Anillo fino con degradado que gira lento alrededor de la esfera (estilo "dato destacado") */
function OrbitRing({ id, color, active, progress }: { id: string; color: string; active: boolean; progress: number | null }) {
  const r = SPHERE / 2 - 6
  const c = 2 * Math.PI * r
  // Con monto negociado, el arco muestra el % cobrado; si no, es decorativo
  const frac = progress !== null ? Math.max(0.015, progress / 100) : 0.62
  return (
    <svg
      width={SPHERE}
      height={SPHERE}
      className={`absolute inset-0 pointer-events-none ${active ? 'animate-ring' : ''}`}
      style={{ animationDuration: active ? '18s' : undefined }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b7cff" stopOpacity="0.9" />
          <stop offset="0.6" stopColor={color} stopOpacity="0.8" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx={SPHERE / 2} cy={SPHERE / 2} r={r} fill="none" stroke="rgba(186,215,245,0.06)" strokeWidth="1" />
      <circle
        cx={SPHERE / 2}
        cy={SPHERE / 2}
        r={r}
        fill="none"
        stroke={`url(#ring-${id})`}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        transform={`rotate(-90 ${SPHERE / 2} ${SPHERE / 2})`}
      />
      {/* Satélite en la punta del arco */}
      <circle cx={SPHERE / 2 + r * Math.cos(Math.PI * 2 * frac - Math.PI / 2)} cy={SPHERE / 2 + r * Math.sin(Math.PI * 2 * frac - Math.PI / 2)} r="5" fill={color} opacity="0.2" />
      <circle cx={SPHERE / 2 + r * Math.cos(Math.PI * 2 * frac - Math.PI / 2)} cy={SPHERE / 2 + r * Math.sin(Math.PI * 2 * frac - Math.PI / 2)} r="2" fill={color} />
    </svg>
  )
}

// ─── Nodo: esfera plexus + anillo orbital + etiqueta ───────────────
function PlexusNode({ data }: NodeProps<Project & { index: number }>) {
  const st = STATUS[data.status] || STATUS.INACTIVE
  const density = Math.min(96, 48 + (data.stack?.length || 0) * 5 + (data.accounts?.length || 0) * 4)
  const handle = '!w-2 !h-2 !bg-indigo-400 !border-0 !shadow-[0_0_8px_#98ffe8]'
  const money = moneyOf(data)

  return (
    <div
      className="group relative flex flex-col items-center cursor-pointer animate-node-in"
      style={{ width: NODE_SIZE, animationDelay: `${0.2 + data.index * 0.14}s` }}
    >
      <Handle id="c" type="target" position={Position.Top} isConnectable={false} style={{ top: SPHERE / 2, left: '50%', opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 }} />
      <Handle type="target" position={Position.Top} className={`${handle} !top-3`} />
      <Handle type="source" position={Position.Bottom} className={`${handle} !bottom-16`} />
      <Handle type="target" position={Position.Left} className={`${handle} !left-3 !top-[85px]`} />
      <Handle type="source" position={Position.Right} className={`${handle} !right-3 !top-[85px]`} />

      <div className="relative transition-transform duration-700 ease-out group-hover:scale-110" style={{ width: SPHERE, height: SPHERE }}>
        <OrbitRing id={data.id} color={st.color} active={data.status === 'ACTIVE' && money.pct === null} progress={money.pct} />
        <PlexusSphere
          size={SPHERE}
          color={data.color || '#7fb2ff'}
          points={density}
          speed={st.speed}
          energy={st.energy}
          seed={seedOf(data.id)}
        />
      </div>

      {/* Etiqueta */}
      <div className="mt-1 text-center max-w-[220px]">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[15px] text-gray-100 font-medium tracking-tight truncate">{data.name}</span>
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-500 hover:text-indigo-400 shrink-0"
              title="Abrir sitio"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <span
            className={`w-1 h-1 rounded-full ${data.status === 'ACTIVE' ? 'animate-pulse' : ''}`}
            style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }}
          />
          <span className="label-caps !text-[9px]" style={{ color: st.color }}>{st.label}</span>
        </div>
        {(money.received > 0 || money.agreed !== null) && (
          <p className="text-[11px] text-gray-400 mt-1 tabular-nums">
            <span className="text-gray-200">{compactCOP(money.received)}</span>
            {money.agreed !== null && <span className="text-gray-500"> / {compactCOP(money.agreed)}</span>}
          </p>
        )}

        {/* Detalles al pasar el mouse */}
        {(data.stack?.length > 0 || data.accounts?.length > 0) && (
          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500">
            <div className="overflow-hidden">
              <div className="flex flex-wrap justify-center gap-1 pt-2">
                {data.stack?.slice(0, 4).map((s) => (
                  <span key={s} className="text-[10px] border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
              {data.accounts?.length > 0 && (
                <p className="text-[10px] text-gray-500 pt-1.5">{data.accounts.map((a) => a.platform).join(' · ')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Conexión: hebra de luz con pulsos viajando ────────────────────
function SynapseEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.4 })
  const dur = 3.2 + (id.length % 5) * 0.4
  const gid = `syn-${id}`
  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0" stopColor="#7fb2ff" />
          <stop offset="0.5" stopColor="#9aa5f0" />
          <stop offset="1" stopColor="#98ffe8" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#${gid})`} strokeOpacity={0.08} strokeWidth={selected ? 12 : 8} strokeLinecap="round" />
      <path id={id} d={path} fill="none" className="react-flow__edge-path" style={{ stroke: `url(#${gid})`, strokeWidth: selected ? 1.6 : 1, strokeOpacity: selected ? 1 : 0.7 }} />
      <path d={path} fill="none" stroke="#d9e7f7" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="1 9">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.6s" repeatCount="indefinite" />
      </path>
      {/* Pulso de ida (menta) y de vuelta (lavanda) con estela */}
      {/* Pulsos con halo de círculos translúcidos (sin filtros: mucho más fluido) */}
      <g>
        <circle r={7} fill="#98ffe8" opacity={0.14} />
        <circle r={2.6} fill="#eafffa" />
        <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} />
      </g>
      <g>
        <circle r={1.6} fill="#98ffe8" opacity={0.5} />
        <animateMotion dur={`${dur}s`} begin={`-${0.07 * dur}s`} repeatCount="indefinite" path={path} />
      </g>
      <g>
        <circle r={6} fill="#9aa5f0" opacity={0.14} />
        <circle r={2} fill="#e4e8ff" />
        <animateMotion dur={`${dur * 1.4}s`} begin={`${dur / 2}s`} repeatCount="indefinite" path={path} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
      </g>
    </g>
  )
}

const nodeTypes = { project: PlexusNode, hub: HubNode, account: AccountNode }
const edgeTypes = { synapse: SynapseEdge, tether: TetherEdge, link: LinkEdge }

const ACC = 'acc:'
const HUB = 'hub:'
const LAYER_KEY = 'atlas.showPlatforms'

type Conn = { source_id: string; target_id: string }
type NetworkData = {
  projects: Project[]
  connections: Conn[]
  accounts?: PlatformAccount[]
  links?: ProjectLink[]
  hubs?: PlatformHub[]
  platformsReady?: boolean
}

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const rf = useRef<ReactFlowInstance | null>(null)
  const introDone = useRef(false)
  const [rfReady, setRfReady] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [accountModal, setAccountModal] = useState<{ account?: PlatformAccount; platform?: string } | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [showPlatforms, setShowPlatforms] = useState(() => {
    try {
      return localStorage.getItem(LAYER_KEY) !== '0'
    } catch {
      return true
    }
  })

  const { data, isLoading } = useQuery<NetworkData>({
    queryKey: ['projects'],
    queryFn: () => apiFetch('/api/projects'),
  })

  const projects: Project[] = useMemo(() => data?.projects || [], [data])
  const connections = useMemo(() => data?.connections || [], [data])
  const accounts = useMemo(() => data?.accounts || [], [data])
  const links = useMemo(() => data?.links || [], [data])
  const hubs = useMemo(() => data?.hubs || [], [data])
  const platformsReady = data?.platformsReady !== false

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['projects'] }), [queryClient])

  const toggleLayer = () => {
    setShowPlatforms((v) => {
      try {
        localStorage.setItem(LAYER_KEY, v ? '0' : '1')
      } catch {
        /* sin almacenamiento: solo en memoria */
      }
      return !v
    })
  }

  // Guardar posición según el tipo de nodo
  const onNodeDragStop = useCallback(async (_: unknown, node: Node) => {
    const pos = { position_x: Math.round(node.position.x), position_y: Math.round(node.position.y) }
    try {
      if (node.id.startsWith(HUB)) {
        await apiFetch(`/api/platforms/hubs/${node.id.slice(HUB.length)}`, { method: 'PUT', body: JSON.stringify(pos) })
      } else if (node.id.startsWith(ACC)) {
        await apiFetch(`/api/platforms/accounts/${node.id.slice(ACC.length)}`, { method: 'PUT', body: JSON.stringify(pos) })
      } else {
        await apiFetch(`/api/projects/${node.id}`, { method: 'PUT', body: JSON.stringify(pos) })
      }
    } catch (err) {
      console.error('Error al guardar posición:', err)
    }
  }, [])

  // Conectar: cuenta ↔ proyecto crea un enlace; proyecto ↔ proyecto crea una conexión
  const onConnect = useCallback(
    async (params: Connection) => {
      const { source, target } = params
      if (!source || !target || source === target) return
      const isAcc = (id: string) => id.startsWith(ACC)
      const isProject = (id: string) => !id.startsWith(ACC) && !id.startsWith(HUB)
      try {
        if (isAcc(source) && isProject(target)) {
          await apiFetch('/api/platforms/links', { method: 'POST', body: JSON.stringify({ project_id: target, account_id: source.slice(ACC.length) }) })
        } else if (isAcc(target) && isProject(source)) {
          await apiFetch('/api/platforms/links', { method: 'POST', body: JSON.stringify({ project_id: source, account_id: target.slice(ACC.length) }) })
        } else if (isProject(source) && isProject(target)) {
          setEdges((eds) => addEdge({ ...params, type: 'synapse' }, eds))
          await apiFetch('/api/projects/connections', { method: 'POST', body: JSON.stringify({ source_id: source, target_id: target }) })
        } else {
          return
        }
        refresh()
      } catch (err) {
        console.error('Error al conectar:', err)
      }
    },
    [setEdges, refresh]
  )

  // Clic en una línea → quitarla (las de plataforma → cuenta son fijas)
  const onEdgeClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      if (edge.type === 'tether') return
      const nameOf = (id: string) =>
        id.startsWith(ACC) ? accounts.find((a) => ACC + a.id === id)?.name : projects.find((p) => p.id === id)?.name
      if (!confirm(`¿Quitar la conexión ${nameOf(edge.source)} → ${nameOf(edge.target)}?`)) return
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
      if (edge.type === 'link') {
        await apiFetch(`/api/platforms/links?project_id=${edge.target}&account_id=${edge.source.slice(ACC.length)}`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/projects/connections?source_id=${edge.source}&target_id=${edge.target}`, { method: 'DELETE' })
      }
      refresh()
    },
    [projects, accounts, setEdges, refresh]
  )

  // Clic en un nodo → la cámara viaja hacia él y abre su detalle
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const w = node.width || NODE_SIZE
      rf.current?.setCenter(node.position.x + w / 2, node.position.y + (node.height || SPHERE) / 3, { zoom: 1.5, duration: 750 })
      setTimeout(() => {
        if (node.id.startsWith(HUB)) {
          setAccountModal({ platform: node.id.slice(HUB.length) })
        } else if (node.id.startsWith(ACC)) {
          setAccountModal({ account: accounts.find((a) => ACC + a.id === node.id) })
        } else {
          setSelectedProject(projects.find((p) => p.id === node.id) || null)
          setIsModalOpen(true)
        }
      }, 650)
    },
    [projects, accounts]
  )

  useEffect(() => {
    const filtered = filterStatus === 'ALL' ? projects : projects.filter((p) => p.status === filterStatus)
    const projectNodes: Node[] = filtered.map((p, i) => ({
      id: p.id,
      type: 'project',
      position: { x: p.position_x ?? (i % 3) * 320 + 80, y: p.position_y ?? Math.floor(i / 3) * 300 + 80 },
      data: { ...p, index: i },
    }))
    const visible = new Set(filtered.map((p) => p.id))
    const newEdges: Edge[] = connections
      .filter((c) => visible.has(c.source_id) && visible.has(c.target_id))
      .map((c) => ({ id: `e-${c.source_id}-${c.target_id}`, source: c.source_id, target: c.target_id, type: 'synapse' }))

    const platformNodes: Node[] = []
    if (showPlatforms && accounts.length) {
      // Ubicación inicial (si aún no las has movido): plataformas en un anillo alrededor
      // de los proyectos y sus cuentas en abanico hacia el centro → forma de red neuronal
      const pts = projectNodes.map((n) => ({ x: n.position.x + NODE_SIZE / 2, y: n.position.y + SPHERE / 2 }))
      const cx = pts.length ? pts.reduce((s, p) => s + p.x, 0) / pts.length : 0
      const cy = pts.length ? pts.reduce((s, p) => s + p.y, 0) / pts.length : 0
      const spanX = pts.length ? Math.max(...pts.map((p) => Math.abs(p.x - cx))) : 0
      const spanY = pts.length ? Math.max(...pts.map((p) => Math.abs(p.y - cy))) : 0

      const byPlatform = new Map<string, PlatformAccount[]>()
      for (const a of accounts) byPlatform.set(a.platform, [...(byPlatform.get(a.platform) || []), a])
      const hubPos = new Map(hubs.map((h) => [h.platform, { x: h.position_x, y: h.position_y }]))
      const H = byPlatform.size
      const rx = spanX + 560
      const ry = spanY + 380

      let hubIndex = 0
      byPlatform.forEach((list, key) => {
        const def = platformOf(key)
        const theta = Math.PI + (H === 1 ? 0 : (hubIndex / H) * Math.PI * 2) + 0.35
        const hcx = cx + Math.cos(theta) * rx
        const hcy = cy + Math.sin(theta) * ry
        const hp = hubPos.get(key) || { x: hcx - HUB_SIZE / 2, y: hcy - HUB_DISK / 2 }
        platformNodes.push({ id: HUB + key, type: 'hub', position: hp, data: { platform: def, count: list.length, index: hubIndex } })

        // Dirección hacia el centro de la red
        const hubC = { x: hp.x + HUB_SIZE / 2, y: hp.y + HUB_DISK / 2 }
        const toCenter = Math.atan2(cy - hubC.y, cx - hubC.x)
        list.forEach((a, j) => {
          const spread = list.length > 1 ? (j / (list.length - 1) - 0.5) * 1.3 : 0
          const ang = toCenter + spread
          const pos = a.position_x != null && a.position_y != null
            ? { x: a.position_x, y: a.position_y }
            : { x: hubC.x + Math.cos(ang) * 210 - ACC_SIZE / 2, y: hubC.y + Math.sin(ang) * 210 - ACC_DISK / 2 }
          const uses = links.filter((l) => l.account_id === a.id).length
          platformNodes.push({ id: ACC + a.id, type: 'account', position: pos, data: { account: a, platform: def, uses, index: j } })
          newEdges.push({ id: `t-${key}-${a.id}`, source: HUB + key, sourceHandle: 'c', target: ACC + a.id, targetHandle: 'c', type: 'tether', data: { color: def.color } })
        })
        hubIndex++
      })

      for (const l of links) {
        const acc = accounts.find((a) => a.id === l.account_id)
        if (!acc || !visible.has(l.project_id)) continue
        newEdges.push({
          id: `l-${l.account_id}-${l.project_id}`,
          source: ACC + l.account_id,
          sourceHandle: 'c',
          target: l.project_id,
          targetHandle: 'c',
          type: 'link',
          data: { color: platformOf(acc.platform).color },
        })
      }
    }

    setNodes([...platformNodes, ...projectNodes])
    setEdges(newEdges)
  }, [projects, connections, accounts, links, hubs, filterStatus, showPlatforms, setNodes, setEdges])

  // Intro cinematográfica: arranca lejos y la cámara se acerca a la red
  useEffect(() => {
    if (introDone.current || !rfReady || nodes.length === 0) return
    introDone.current = true
    const t = setTimeout(() => rf.current?.fitView({ padding: 0.25, duration: 1800, maxZoom: 1.1 }), 80)
    return () => clearTimeout(t)
  }, [rfReady, nodes.length])

  const backToOverview = () => rf.current?.fitView({ padding: 0.25, duration: 900, maxZoom: 1.1 })

  const closeModal = () => {
    setIsModalOpen(false)
    backToOverview()
  }

  const openNewProject = () => {
    setSelectedProject(null)
    setIsModalOpen(true)
  }

  const totals = useMemo(() => {
    let received = 0, pending = 0
    for (const p of projects) {
      const m = moneyOf(p)
      received += m.received
      pending += m.pending || 0
    }
    return { received, pending }
  }, [projects])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    projects.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1))
    return c
  }, [projects])

  const platformCount = new Set(accounts.map((a) => a.platform)).size
  const isEmpty = projects.length === 0 && accounts.length === 0

  return (
    <div className="h-full flex flex-col">
      {/* Header flotante */}
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 md:px-8 md:pt-8">
        <div className="animate-rise">
          <p className="label-caps mb-2">Tu ecosistema</p>
          <h2 className="text-gradient">Red de <span className="text-accent-gradient font-normal">proyectos</span></h2>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {(Object.keys(STATUS) as Status[])
              .filter((s) => counts[s])
              .map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? 'ALL' : s)}
                  className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    filterStatus === s ? 'border-gray-700 bg-white/[0.07] text-gray-100' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[s].color, boxShadow: `0 0 6px ${STATUS[s].color}` }} />
                  {counts[s]} {counts[s] === 1 ? STATUS[s].label.toLowerCase() : STATUS[s].plural}
                </button>
              ))}
            {accounts.length > 0 && (
              <button
                onClick={toggleLayer}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  showPlatforms ? 'border-gray-700 bg-white/[0.07] text-gray-100' : 'border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-100'
                }`}
                title={showPlatforms ? 'Ocultar plataformas' : 'Mostrar plataformas'}
              >
                <Server size={11} className={showPlatforms ? 'text-indigo-400' : ''} />
                {platformCount} plataforma{platformCount === 1 ? '' : 's'} · {accounts.length} cuenta{accounts.length === 1 ? '' : 's'}
              </button>
            )}
            {filterStatus !== 'ALL' && (
              <button onClick={() => setFilterStatus('ALL')} className="text-[11px] text-indigo-400 hover:text-indigo-300">
                Ver todos
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end gap-6 animate-rise">
          {(totals.received > 0 || totals.pending > 0) && (
            <div className="hidden lg:flex items-end gap-6 pr-6 border-r border-gray-800">
              <div>
                <p className="label-caps !text-[9px]">Cobrado</p>
                <p className="text-xl font-light tracking-tight text-gray-100 tabular-nums">{compactCOP(totals.received)}</p>
              </div>
              <div>
                <p className="label-caps !text-[9px]">Por cobrar</p>
                <p className="text-xl font-light tracking-tight text-[#f5c97a] tabular-nums">{compactCOP(totals.pending)}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {platformsReady && (
              <button
                onClick={() => setAccountModal({})}
                className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-gray-800 text-gray-200 text-sm font-medium px-4 py-2.5 rounded-full transition-all"
              >
                <Server size={15} /> Plataforma
              </button>
            )}
            <button
              onClick={openNewProject}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium px-5 py-2.5 rounded-full transition-all"
            >
              <Plus size={16} /> Proyecto
            </button>
          </div>
        </div>
      </div>

      {!platformsReady && (
        <p className="mx-5 md:mx-8 -mt-1 mb-2 text-xs text-[#f5c97a] bg-[#f5c97a]/10 border border-[#f5c97a]/20 rounded-2xl px-4 py-2">
          Para ver plataformas y cuentas como nodos, ejecuta <code>backend/supabase-migration-2026-11-16.sql</code> en Supabase.
        </p>
      )}

      {/* Lienzo */}
      <div className="flex-1 relative min-h-[420px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <PlexusSphere size={140} speed={2} />
            <span className="text-sm">Conectando la red…</span>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 animate-rise">
            <PlexusSphere size={240} speed={0.8} color="#7fb2ff" />
            <p className="text-3xl font-light tracking-tight text-gray-100 mt-2">Tu red está esperando su primera neurona</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">
              Crea un proyecto y conéctalo con las plataformas que usa (Supabase, Vercel, GitHub…).
            </p>
            <button
              onClick={openNewProject}
              className="mt-6 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium px-6 py-2.5 rounded-full"
            >
              <Plus size={16} /> Crear mi primer proyecto
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onInit={(inst) => {
              rf.current = inst
              setRfReady(true)
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 0.2 }}
            minZoom={0.12}
            maxZoom={2.5}
            nodeDragThreshold={4}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) =>
                n.type === 'hub' ? (n.data as { platform: PlatformDef }).platform.color : n.type === 'account' ? 'rgba(186,215,245,0.25)' : 'rgba(186,215,245,0.5)'
              }
              nodeBorderRadius={50}
              maskColor="rgba(10, 13, 21, 0.7)"
              className="hidden md:block"
            />
          </ReactFlow>
        )}
        {!isEmpty && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-gray-500 hidden md:block text-center">
            Arrastra desde el punto de una cuenta o el borde de una esfera hasta un proyecto para conectarlos · clic en una línea para quitarla
          </p>
        )}
      </div>

      {isModalOpen && (
        <ProjectModal
          project={selectedProject}
          platformAccounts={platformsReady ? accounts : undefined}
          links={links}
          onClose={closeModal}
          onSuccess={refresh}
        />
      )}
      {accountModal && (
        <AccountModal
          account={accountModal.account}
          defaultPlatform={accountModal.platform}
          projects={projects}
          links={links}
          onClose={() => {
            setAccountModal(null)
            backToOverview()
          }}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
