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
import { Plus, ExternalLink } from 'lucide-react'
import ProjectModal, { type Project } from '../components/ProjectModal'
import PlexusSphere from '../components/PlexusSphere'

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
function OrbitRing({ id, color, active }: { id: string; color: string; active: boolean }) {
  const r = SPHERE / 2 - 6
  const c = 2 * Math.PI * r
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
        strokeDasharray={`${c * 0.62} ${c}`}
        transform={`rotate(-90 ${SPHERE / 2} ${SPHERE / 2})`}
      />
      {/* Satélite en la punta del arco */}
      <circle cx={SPHERE / 2 + r * Math.cos(Math.PI * 2 * 0.62 - Math.PI / 2)} cy={SPHERE / 2 + r * Math.sin(Math.PI * 2 * 0.62 - Math.PI / 2)} r="2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  )
}

// ─── Nodo: esfera plexus + anillo orbital + etiqueta ───────────────
function PlexusNode({ data }: NodeProps<Project & { index: number }>) {
  const st = STATUS[data.status] || STATUS.INACTIVE
  const density = Math.min(96, 48 + (data.stack?.length || 0) * 5 + (data.accounts?.length || 0) * 4)
  const handle = '!w-2 !h-2 !bg-indigo-400 !border-0 !shadow-[0_0_8px_#98ffe8]'

  return (
    <div
      className="group relative flex flex-col items-center cursor-pointer animate-node-in"
      style={{ width: NODE_SIZE, animationDelay: `${0.2 + data.index * 0.14}s` }}
    >
      <Handle type="target" position={Position.Top} className={`${handle} !top-3`} />
      <Handle type="source" position={Position.Bottom} className={`${handle} !bottom-16`} />
      <Handle type="target" position={Position.Left} className={`${handle} !left-3 !top-[85px]`} />
      <Handle type="source" position={Position.Right} className={`${handle} !right-3 !top-[85px]`} />

      <div className="relative transition-transform duration-700 ease-out group-hover:scale-110" style={{ width: SPHERE, height: SPHERE }}>
        <OrbitRing id={data.id} color={st.color} active={data.status === 'ACTIVE'} />
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
      <path d={path} fill="none" stroke={`url(#${gid})`} strokeOpacity={0.12} strokeWidth={selected ? 12 : 8} style={{ filter: 'blur(4px)' }} />
      <path id={id} d={path} fill="none" className="react-flow__edge-path" style={{ stroke: `url(#${gid})`, strokeWidth: selected ? 1.6 : 1, strokeOpacity: selected ? 1 : 0.7 }} />
      <path d={path} fill="none" stroke="#d9e7f7" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="1 9">
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.6s" repeatCount="indefinite" />
      </path>
      {/* Pulso de ida (menta) y de vuelta (lavanda) con estela */}
      {[0, 0.06, 0.12].map((lag, k) => (
        <circle key={k} r={2.6 - k * 0.7} fill="#eafffa" opacity={1 - k * 0.35} style={{ filter: 'drop-shadow(0 0 6px #98ffe8)' }}>
          <animateMotion dur={`${dur}s`} begin={`-${lag * dur}s`} repeatCount="indefinite" path={path} />
        </circle>
      ))}
      <circle r={2} fill="#e4e8ff" style={{ filter: 'drop-shadow(0 0 6px #9aa5f0)' }}>
        <animateMotion dur={`${dur * 1.4}s`} begin={`${dur / 2}s`} repeatCount="indefinite" path={path} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
      </circle>
    </g>
  )
}

const nodeTypes = { project: PlexusNode }
const edgeTypes = { synapse: SynapseEdge }

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const rf = useRef<ReactFlowInstance | null>(null)
  const introDone = useRef(false)
  const [rfReady, setRfReady] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch('/api/projects'),
  })

  const projects: Project[] = useMemo(() => data?.projects || (Array.isArray(data) ? data : []), [data])
  const connections = useMemo(() => data?.connections || [], [data])

  const onNodeDragStop = useCallback(async (_: unknown, node: Node) => {
    try {
      await apiFetch(`/api/projects/${node.id}`, {
        method: 'PUT',
        body: JSON.stringify({ position_x: Math.round(node.position.x), position_y: Math.round(node.position.y) }),
      })
    } catch (err) {
      console.error('Error al actualizar posición:', err)
    }
  }, [])

  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return
      setEdges((eds) => addEdge({ ...params, type: 'synapse' }, eds))
      try {
        await apiFetch('/api/projects/connections', {
          method: 'POST',
          body: JSON.stringify({ source_id: params.source, target_id: params.target }),
        })
      } catch (err) {
        console.error('Error al guardar conexión:', err)
      }
    },
    [setEdges]
  )

  // Clic en una conexión → eliminarla
  const onEdgeClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      const s = projects.find((p) => p.id === edge.source)?.name
      const t = projects.find((p) => p.id === edge.target)?.name
      if (!confirm(`¿Eliminar la conexión ${s} → ${t}?`)) return
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
      await apiFetch(`/api/projects/connections?source_id=${edge.source}&target_id=${edge.target}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    [projects, setEdges, queryClient]
  )

  // Clic en un nodo → la cámara viaja hacia él y luego se abre el detalle
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<Project>) => {
    const cx = node.position.x + NODE_SIZE / 2
    const cy = node.position.y + SPHERE / 2
    rf.current?.setCenter(cx, cy, { zoom: 1.6, duration: 750 })
    setTimeout(() => {
      setSelectedProject(projects.find((p) => p.id === node.id) || null)
      setIsModalOpen(true)
    }, 680)
  }, [projects])

  useEffect(() => {
    const filtered = filterStatus === 'ALL' ? projects : projects.filter((p) => p.status === filterStatus)
    setNodes(
      filtered.map((p, i) => ({
        id: p.id,
        type: 'project',
        position: { x: p.position_x ?? (i % 3) * 300 + 80, y: p.position_y ?? Math.floor(i / 3) * 280 + 80 },
        data: { ...p, index: i },
      }))
    )
    const visible = new Set(filtered.map((p) => p.id))
    setEdges(
      connections
        .filter((c: { source_id: string; target_id: string }) => visible.has(c.source_id) && visible.has(c.target_id))
        .map((c: { source_id: string; target_id: string }) => ({
          id: `e-${c.source_id}-${c.target_id}`,
          source: c.source_id,
          target: c.target_id,
          type: 'synapse',
        }))
    )
  }, [projects, connections, filterStatus, setNodes, setEdges])

  // Intro cinematográfica: arranca lejos y la cámara se acerca a la red
  useEffect(() => {
    if (introDone.current || !rfReady || nodes.length === 0) return
    introDone.current = true
    // Espera a que React Flow mida los nodos antes de mover la cámara
    const t = setTimeout(() => rf.current?.fitView({ padding: 0.35, duration: 1800, maxZoom: 1.1 }), 80)
    return () => clearTimeout(t)
  }, [rfReady, nodes.length])

  const closeModal = () => {
    setIsModalOpen(false)
    rf.current?.fitView({ padding: 0.35, duration: 900, maxZoom: 1.1 })
  }

  const openNewProject = () => {
    setSelectedProject(null)
    setIsModalOpen(true)
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    projects.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1))
    return c
  }, [projects])

  return (
    <div className="h-full flex flex-col">
      {/* Header flotante */}
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 md:px-8 md:pt-8">
        <div className="animate-rise">
          <p className="label-caps mb-2">Tu ecosistema</p>
          <h2 className="text-gradient">Red de <em className="italic">proyectos</em></h2>
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
            {filterStatus !== 'ALL' && (
              <button onClick={() => setFilterStatus('ALL')} className="text-[11px] text-indigo-400 hover:text-indigo-300">
                Ver todos
              </button>
            )}
          </div>
        </div>

        <button
          onClick={openNewProject}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium px-5 py-2.5 rounded-full transition-all animate-rise"
        >
          <Plus size={16} /> Nuevo proyecto
        </button>
      </div>

      {/* Lienzo */}
      <div className="flex-1 relative min-h-[420px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <PlexusSphere size={140} speed={2} />
            <span className="text-sm">Conectando la red…</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 animate-rise">
            <PlexusSphere size={240} speed={0.8} color="#7fb2ff" />
            <p className="font-serif text-3xl text-gray-100 mt-2">Tu red está esperando su primera neurona</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">
              Crea un proyecto y conéctalo con otros para ver cómo se relaciona todo lo que construyes.
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
            minZoom={0.15}
            maxZoom={2.5}
            nodeDragThreshold={4}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              nodeColor={() => 'rgba(186,215,245,0.45)'}
              nodeBorderRadius={50}
              maskColor="rgba(10, 13, 21, 0.7)"
              className="hidden md:block"
            />
          </ReactFlow>
        )}
        {projects.length > 1 && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-gray-500 hidden md:block">
            Arrastra desde el borde de una esfera a otra para conectarlas · clic en una conexión para quitarla
          </p>
        )}
      </div>

      {isModalOpen && (
        <ProjectModal
          project={selectedProject}
          onClose={closeModal}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
        />
      )}
    </div>
  )
}
