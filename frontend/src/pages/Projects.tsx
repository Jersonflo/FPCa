import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { Plus, ExternalLink, Activity, Layers } from 'lucide-react'
import ProjectModal, { type Project } from '../components/ProjectModal'

const statusColors = {
  ACTIVE: '#10b981',
  INACTIVE: '#6b7280',
  PAUSED: '#f59e0b',
  COMPLETED: '#3b82f6',
  ARCHIVED: '#ef4444',
}

const statusLabels = {
  ACTIVE: 'Activo / Online',
  INACTIVE: 'Inactivo',
  PAUSED: 'Pausado',
  COMPLETED: 'Terminado',
  ARCHIVED: 'Archivado',
}

// Nodo Personalizado del Grafo
function CustomProjectNode({ data }: { data: Project & { onEdit: (p: Project) => void } }) {
  const statusColor = statusColors[data.status] || '#6b7280'

  return (
    <div
      onClick={() => data.onEdit(data)}
      className="group relative rounded-2xl border-2 p-4 min-w-[210px] max-w-[280px] shadow-xl cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-indigo-500/10"
      style={{
        borderColor: data.color || '#6366f1',
        background: '#111827',
      }}
    >
      {/* Handles para conectar con otros nodos */}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500 border-2 border-gray-900" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-gray-900" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-gray-900" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-gray-900" />

      {/* Cabecera del Nodo */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 truncate">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              background: statusColor,
              boxShadow: data.status === 'ACTIVE' ? `0 0 10px ${statusColor}` : 'none',
            }}
          />
          <span className="font-bold text-white text-sm truncate">{data.name}</span>
        </div>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Badge de Estado */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-block"
          style={{ background: statusColor + '25', color: statusColor }}
        >
          {statusLabels[data.status]}
        </span>
      </div>

      {/* Descripción corta */}
      {data.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-2">{data.description}</p>
      )}

      {/* Stack Tecnológico */}
      {data.stack?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {data.stack.slice(0, 3).map((s) => (
            <span key={s} className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
              {s}
            </span>
          ))}
          {data.stack.length > 3 && (
            <span className="text-[10px] text-gray-500">+{data.stack.length - 3}</span>
          )}
        </div>
      )}

      {/* Cuentas vinculadas */}
      {data.accounts?.length > 0 && (
        <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
          <span>🔗 {data.accounts.length} cuenta{data.accounts.length > 1 ? 's' : ''}</span>
          <span className="text-gray-500 truncate max-w-[100px]">
            {data.accounts.map((a) => a.platform).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

const nodeTypes = { project: CustomProjectNode }

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Filtros
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch('/api/projects'),
  })

  const projects: Project[] = useMemo(() => data?.projects || (Array.isArray(data) ? data : []), [data])
  const connections = useMemo(() => data?.connections || [], [data])

  // Guardar posicion al terminar de mover un nodo
  const onNodeDragStop = useCallback(
    async (_: any, node: Node) => {
      try {
        await apiFetch(`/api/projects/${node.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            position_x: Math.round(node.position.x),
            position_y: Math.round(node.position.y),
          }),
        })
      } catch (err) {
        console.error('Error al actualizar posición:', err)
      }
    },
    []
  )

  // Conectar 2 nodos
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds))
      try {
        await apiFetch('/api/projects/connections', {
          method: 'POST',
          body: JSON.stringify({
            source_id: params.source,
            target_id: params.target,
          }),
        })
      } catch (err) {
        console.error('Error al guardar conexión:', err)
      }
    },
    [setEdges]
  )

  // Mapear nodos y aristas al cargar
  useEffect(() => {
    if (!projects) return

    const filtered = filterStatus === 'ALL'
      ? projects
      : projects.filter((p) => p.status === filterStatus)

    const newNodes: Node[] = filtered.map((p, i) => ({
      id: p.id,
      type: 'project',
      position: {
        x: p.position_x ?? (i % 3) * 320 + 80,
        y: p.position_y ?? Math.floor(i / 3) * 240 + 80,
      },
      data: {
        ...p,
        onEdit: (proj: Project) => {
          setSelectedProject(proj)
          setIsModalOpen(true)
        },
      },
    }))

    const newEdges: Edge[] = connections.map((c: any) => ({
      id: `e-${c.source_id}-${c.target_id}`,
      source: c.source_id,
      target: c.target_id,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }))

    setNodes(newNodes)
    setEdges(newEdges)
  }, [projects, connections, filterStatus, setNodes, setEdges])

  const openNewProject = () => {
    setSelectedProject(null)
    setIsModalOpen(true)
  }

  // Contadores
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length
  const pausedCount = projects.filter((p) => p.status === 'PAUSED').length
  const inactiveCount = projects.filter((p) => p.status === 'INACTIVE').length

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-800 bg-gray-900/60 backdrop-blur-xs">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="text-indigo-400" size={20} /> Red de Proyectos
          </h2>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {activeCount} Online/Activos
            </span>
            <span>·</span>
            <span>{pausedCount} Pausados</span>
            <span>·</span>
            <span>{inactiveCount} Inactivos</span>
          </div>
        </div>

        {/* Filtros y Botón */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-xs text-white rounded-lg px-2.5 py-2 focus:outline-hidden"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">🟢 Solo Activos</option>
            <option value="PAUSED">🟡 Solo Pausados</option>
            <option value="INACTIVE">⚪ Solo Inactivos</option>
            <option value="COMPLETED">🔵 Solo Terminados</option>
            <option value="ARCHIVED">🔴 Solo Archivados</option>
          </select>

          <button
            onClick={openNewProject}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus size={16} /> Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Canvas / Red Neuronal */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Activity className="animate-spin mr-2" size={20} /> Cargando red de proyectos...
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center">
            <div className="text-6xl mb-4">🕸️</div>
            <p className="text-lg font-semibold text-gray-300">Aún no tienes proyectos mapeados</p>
            <p className="text-sm mt-1 max-w-sm">
              Crea tu primer nodo para llevar el control de tus proyectos online, cuentas asociadas y arquitectura.
            </p>
            <button
              onClick={openNewProject}
              className="mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl transition-all shadow-lg"
            >
              <Plus size={16} /> Crear mi primer nodo
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
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-950"
          >
            <Background color="#1f2937" gap={24} size={1.5} />
            <Controls className="bg-gray-900 border-gray-800 text-white fill-white" />
            <MiniMap
              nodeColor={(n) => statusColors[(n.data as Project)?.status] || '#6b7280'}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              maskColor="rgba(0, 0, 0, 0.7)"
            />
          </ReactFlow>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
        />
      )}
    </div>
  )
}
