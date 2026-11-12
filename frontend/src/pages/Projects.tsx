import { useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { Plus } from 'lucide-react'

type Project = {
  id: string
  name: string
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ARCHIVED'
  color: string
  description?: string
  stack: string[]
  position_x: number
  position_y: number
  accounts: { id: string; platform: string; username?: string }[]
}

const statusColors = {
  ACTIVE: '#10b981',
  INACTIVE: '#6b7280',
  PAUSED: '#f59e0b',
  ARCHIVED: '#ef4444',
}

const statusLabels = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PAUSED: 'Pausado',
  ARCHIVED: 'Archivado',
}

function ProjectNode({ data }: { data: Project }) {
  const statusColor = statusColors[data.status]
  return (
    <div
      className="rounded-xl border-2 p-4 min-w-[180px] shadow-lg cursor-pointer"
      style={{ borderColor: data.color, background: '#1f2937' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ background: statusColor }}
        />
        <span className="font-semibold text-white text-sm truncate">{data.name}</span>
      </div>
      <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: statusColor + '33', color: statusColor }}
      >
        {statusLabels[data.status]}
      </span>
      {data.stack?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.stack.slice(0, 3).map((s) => (
            <span key={s} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {s}
            </span>
          ))}
        </div>
      )}
      {data.accounts?.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          🔗 {data.accounts.length} cuenta{data.accounts.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { project: ProjectNode }

export default function ProjectsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch('/api/projects'),
  })

  useEffect(() => {
    if (!projects) return
    const newNodes: Node[] = projects.map((p: Project, i: number) => ({
      id: p.id,
      type: 'project',
      position: { x: p.position_x || (i % 4) * 250, y: p.position_y || Math.floor(i / 4) * 200 },
      data: p,
    }))
    setNodes(newNodes)
  }, [projects, setNodes])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 animate-pulse">Cargando proyectos...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-white">Proyectos</h2>
          <p className="text-xs text-gray-500">{projects?.length || 0} proyectos registrados</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo proyecto
        </button>
      </div>

      {/* Grafo */}
      <div className="flex-1">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-6xl mb-4">🕸️</div>
            <p className="text-lg font-medium">Sin proyectos aún</p>
            <p className="text-sm mt-1">Crea tu primer proyecto para verlo en el grafo</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-950"
          >
            <Background color="#374151" gap={20} />
            <Controls className="bg-gray-800 border-gray-700" />
            <MiniMap
              nodeColor={(n) => statusColors[(n.data as Project)?.status] || '#6b7280'}
              className="bg-gray-800 border-gray-700"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

