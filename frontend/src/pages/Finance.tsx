import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { CreditCard, TrendingUp, TrendingDown, Target, Plus } from 'lucide-react'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const now = new Date()
const currentMonth = now.getMonth() + 1
const currentYear = now.getFullYear()

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

export default function FinancePage() {
  const { data: stats } = useQuery({
    queryKey: ['finance-stats', currentYear, currentMonth],
    queryFn: () => apiFetch(`/api/finance/stats/${currentYear}/${currentMonth}`),
  })

  const { data: cards = [] } = useQuery({
    queryKey: ['cards'],
    queryFn: () => apiFetch('/api/finance/cards'),
  })

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => apiFetch('/api/finance/goals'),
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentYear, currentMonth],
    queryFn: () => apiFetch(`/api/finance/transactions?month=${currentMonth}&year=${currentYear}`),
  })

  const pieData = stats
    ? Object.entries(stats.byCategory || {}).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="p-4 md:p-6 overflow-y-auto pb-20 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Finanzas</h2>
          <p className="text-xs text-gray-500">
            {now.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Registrar gasto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Ingresos', value: stats?.income || 0, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Gastos totales', value: stats?.total_expenses || 0, icon: TrendingDown, color: 'text-red-400' },
          { label: 'Balance neto', value: stats?.net_balance || 0, icon: TrendingUp, color: 'text-indigo-400' },
          { label: 'Ahorro', value: stats?.savings || 0, icon: Target, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`flex items-center gap-2 mb-1 ${color}`}>
              <Icon size={16} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className="text-white font-semibold text-sm">{formatCOP(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Gráfico de torta por categoría */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-white mb-4">Gastos por categoría</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCOP(Number(v) || 0)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
              Sin datos este mes
            </div>
          )}
        </div>

        {/* Tarjetas */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Tarjetas y cuentas</h3>
            <button className="text-xs text-indigo-400 hover:text-indigo-300">+ Agregar</button>
          </div>
          <div className="space-y-2">
            {cards.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin tarjetas registradas</p>
            ) : (
              cards.map((card: { id: string; name: string; bank: string; last_four: string; type: string; balance: number; color: string }) => (
                <div key={card.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} style={{ color: card.color || '#6366f1' }} />
                    <div>
                      <p className="text-sm text-white">{card.name}</p>
                      <p className="text-xs text-gray-400">{card.bank} •••• {card.last_four}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">{formatCOP(card.balance)}</p>
                    <p className="text-xs text-gray-500">{card.type === 'CREDIT' ? 'Crédito' : 'Débito'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Metas de ahorro */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Metas de ahorro</h3>
          <button className="text-xs text-indigo-400 hover:text-indigo-300">+ Nueva meta</button>
        </div>
        <div className="space-y-3">
          {goals.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Sin metas definidas</p>
          ) : (
            goals.map((goal: { id: string; name: string; target: number; current: number; deadline?: string; color: string }) => {
              const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{goal.name}</span>
                    <span className="text-gray-400">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: goal.color || '#10b981' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatCOP(goal.current)} de {formatCOP(goal.target)}</span>
                    {goal.deadline && <span>Límite: {new Date(goal.deadline).toLocaleDateString('es-CO')}</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Últimas transacciones */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-white mb-4">Últimas transacciones</h3>
        <div className="space-y-2">
          {transactions.slice(0, 10).map((t: {
            id: string; description: string; amount: number; date: string;
            type: string; category: string
          }) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div>
                <p className="text-sm text-white">{t.description}</p>
                <p className="text-xs text-gray-500">{t.category} · {new Date(t.date).toLocaleDateString('es-CO')}</p>
              </div>
              <span className={`text-sm font-medium ${t.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                {t.type === 'INCOME' ? '+' : '-'}{formatCOP(t.amount)}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">Sin transacciones este mes</p>
          )}
        </div>
      </div>
    </div>
  )
}

