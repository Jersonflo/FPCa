import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import {
  CreditCard, TrendingUp, TrendingDown, Target, Plus, ChevronLeft, ChevronRight,
  PiggyBank, Wallet, Settings2, AlertTriangle,
} from 'lucide-react'
import { api, formatCOP, formatDate } from '../lib/api'
import {
  CHART_COLORS, MONTHS_SHORT, TX_TYPES, monthsUntil,
  type Budget, type FinanceCard, type Goal, type Stats, type Transaction, type TrendPoint, type TxType,
} from '../lib/finance'
import { Card, ProgressBar } from '../components/ui'
import { BudgetsModal, CardModal, ContributeModal, GoalModal, TransactionModal } from '../components/FinanceModals'

const compact = (v: number) =>
  new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

const tooltipStyle = {
  contentStyle: { background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#e5e7eb' },
}

type ModalState =
  | { kind: 'tx'; tx?: Transaction }
  | { kind: 'card'; card?: FinanceCard }
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'contribute'; goal: Goal }
  | { kind: 'budgets' }
  | null

export default function FinancePage() {
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [modal, setModal] = useState<ModalState>(null)
  const [typeFilter, setTypeFilter] = useState<TxType | ''>('')

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const { data: stats } = useQuery<Stats>({
    queryKey: ['finance', 'stats', year, month],
    queryFn: () => api.get(`/api/finance/stats/${year}/${month}`),
  })
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', year, month],
    queryFn: () => api.get(`/api/finance/transactions?month=${month}&year=${year}`),
  })
  const { data: trend = [] } = useQuery<TrendPoint[]>({
    queryKey: ['finance', 'trend', year, month],
    queryFn: () => api.get(`/api/finance/trend?months=6&year=${year}&month=${month}`),
  })
  const { data: cards = [] } = useQuery<FinanceCard[]>({ queryKey: ['finance', 'cards'], queryFn: () => api.get('/api/finance/cards') })
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ['finance', 'goals'], queryFn: () => api.get('/api/finance/goals') })
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ['finance', 'budgets'], queryFn: () => api.get('/api/finance/budgets') })

  const refresh = () => qc.invalidateQueries({ queryKey: ['finance'] })

  const byCategory = stats?.byCategory || {}
  const pieData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const trendData = trend.map((t) => ({
    name: MONTHS_SHORT[t.month - 1],
    Ingresos: t.income,
    Gastos: t.expenses,
    Ahorro: t.savings,
  }))

  // Gasto promedio mensual (meses con movimientos) → base del fondo de emergencia
  const avgExpenses = useMemo(() => {
    const withData = trend.filter((t) => t.expenses > 0)
    return withData.length ? withData.reduce((s, t) => s + t.expenses, 0) / withData.length : 0
  }, [trend])

  const visibleTx = typeFilter ? transactions.filter((t) => t.type === typeFilter) : transactions
  const totalDebt = cards.filter((c) => c.type === 'CREDIT').reduce((s, c) => s + Number(c.balance || 0), 0)
  const totalCash = cards.filter((c) => c.type === 'DEBIT').reduce((s, c) => s + Number(c.balance || 0), 0)
  const budgetRows = budgets
    .map((b) => ({ ...b, spent: byCategory[b.category] || 0 }))
    .sort((a, b) => b.spent / b.amount - a.spent / a.amount)
  const overBudget = budgetRows.filter((b) => b.spent > b.amount).length

  const rule = stats?.rule_50_30_20
  const ruleRows = [
    { label: 'Necesidades (fijos)', value: rule?.needs || 0, target: 50, amount: stats?.fixed || 0, color: TX_TYPES.FIXED.color, max: true },
    { label: 'Gustos (variables)', value: rule?.wants || 0, target: 30, amount: stats?.variable || 0, color: TX_TYPES.VARIABLE.color, max: true },
    { label: 'Ahorro', value: rule?.savings || 0, target: 20, amount: stats?.savings || 0, color: TX_TYPES.SAVINGS.color, max: false },
  ]

  const rawLabel = new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  const defaultTxDate = isCurrentMonth ? undefined : `${year}-${String(month).padStart(2, '0')}-01`

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300" aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-[150px] text-center">
            <h2 className="text-lg font-semibold text-white leading-tight">Finanzas</h2>
            <p className="text-xs text-gray-500">{monthLabel}</p>
          </div>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300" aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
              className="text-xs text-indigo-400 hover:text-indigo-300 ml-1"
            >
              Hoy
            </button>
          )}
        </div>
        <button
          onClick={() => setModal({ kind: 'tx' })}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg"
        >
          <Plus size={16} /> Registrar movimiento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Ingresos', value: stats?.income || 0, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Gastos', value: stats?.total_expenses || 0, icon: TrendingDown, color: 'text-red-400' },
          { label: 'Ahorrado', value: stats?.savings || 0, icon: PiggyBank, color: 'text-cyan-400' },
          { label: 'Disponible', value: stats?.net_balance || 0, icon: Wallet, color: (stats?.net_balance || 0) < 0 ? 'text-red-400' : 'text-indigo-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`flex items-center gap-2 mb-1 ${color}`}>
              <Icon size={16} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className={`font-semibold text-sm ${value < 0 ? 'text-red-400' : 'text-white'}`}>{formatCOP(value)}</p>
          </div>
        ))}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-1 text-yellow-400">
            <Target size={16} />
            <span className="text-xs text-gray-400">Tasa de ahorro</span>
          </div>
          <p className="font-semibold text-sm text-white">
            {stats?.savings_rate ?? 0}%
            <span className="text-[11px] font-normal text-gray-500 ml-1">
              {(stats?.savings_rate ?? 0) >= 20 ? '· ¡Bien!' : '· meta: 20%'}
            </span>
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Regla 50/30/20 */}
        <Card title="Regla 50 / 30 / 20">
          {!stats?.income ? (
            <p className="text-xs text-gray-500 py-6 text-center">Registra tus ingresos del mes para ver cómo repartes tu plata.</p>
          ) : (
            <div className="space-y-4">
              {ruleRows.map((r) => {
                const off = r.max ? r.value > r.target : r.value < r.target
                return (
                  <div key={r.label}>
                    <div className="flex justify-between gap-2 text-xs mb-1">
                      <span className="text-gray-300">{r.label}</span>
                      <span className={`shrink-0 ${off ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {r.value}% <span className="text-gray-500">/ {r.max ? 'máx' : 'mín'} {r.target}%</span>
                      </span>
                    </div>
                    <div className="relative">
                      <ProgressBar value={r.value} color={r.color} />
                      <span className="absolute top-[-2px] h-3 w-px bg-white/60" style={{ left: `${r.target}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{formatCOP(r.amount)}</p>
                  </div>
                )
              })}
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Guía sencilla: máximo 50% de tus ingresos en necesidades, 30% en gustos y al menos 20% a ahorro o deudas.
              </p>
            </div>
          )}
        </Card>

        {/* Gastos por categoría */}
        <Card title="Gastos por categoría">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip formatter={(v) => formatCOP(Number(v) || 0)} {...tooltipStyle} itemStyle={{ color: '#e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[230px] flex items-center justify-center text-gray-500 text-sm">Sin gastos este mes</div>
          )}
        </Card>

        {/* Presupuestos */}
        <Card
          title={
            <span className="flex items-center gap-2">
              Presupuesto del mes
              {overBudget > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-red-400"><AlertTriangle size={11} /> {overBudget} excedido{overBudget > 1 ? 's' : ''}</span>
              )}
            </span>
          }
          action={
            <button onClick={() => setModal({ kind: 'budgets' })} className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
              <Settings2 size={13} /> Editar
            </button>
          }
        >
          {budgetRows.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-gray-500 mb-2">Ponle un tope mensual a tus categorías (restaurantes, ropa…).</p>
              <button onClick={() => setModal({ kind: 'budgets' })} className="text-xs text-indigo-400 hover:text-indigo-300">+ Crear presupuesto</button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[230px] overflow-y-auto pr-1">
              {budgetRows.map((b) => {
                const pct = Math.round((b.spent / b.amount) * 100)
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{b.category}</span>
                      <span className={pct > 100 ? 'text-red-400' : pct > 80 ? 'text-amber-400' : 'text-gray-400'}>{pct}%</span>
                    </div>
                    <ProgressBar value={pct} color={pct > 80 ? '#f59e0b' : '#10b981'} over={pct > 100} />
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {formatCOP(b.spent)} de {formatCOP(b.amount)}
                      {b.spent <= b.amount && ` · quedan ${formatCOP(b.amount - b.spent)}`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Tendencia */}
      <Card title="Últimos 6 meses">
        {trendData.some((t) => t.Ingresos || t.Gastos || t.Ahorro) ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickFormatter={compact} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => formatCOP(Number(v) || 0)} cursor={{ fill: '#ffffff08' }} {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ahorro" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-sm text-center py-10">Cuando registres movimientos verás aquí tu evolución mes a mes.</p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Metas */}
        <Card title="Metas de ahorro" action={<button onClick={() => setModal({ kind: 'goal' })} className="text-xs text-indigo-400 hover:text-indigo-300">+ Nueva meta</button>}>
          <div className="space-y-4">
            {goals.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">Sin metas definidas</p>
                {avgExpenses > 0 && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Recomendado empezar por un fondo de emergencia de ~{formatCOP(avgExpenses * 6)}.
                  </p>
                )}
              </div>
            )}
            {goals.map((goal) => {
              const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0
              const missing = Math.max(0, goal.target - goal.current)
              const perMonth = goal.deadline && missing > 0 ? missing / monthsUntil(goal.deadline) : 0
              return (
                <div key={goal.id} className="group">
                  <div className="flex justify-between items-center text-sm mb-1 gap-2">
                    <button onClick={() => setModal({ kind: 'goal', goal })} className="text-white hover:text-indigo-300 truncate text-left">
                      {pct >= 100 && '🎉 '}{goal.name}
                    </button>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-400 text-xs">{pct}%</span>
                      <button
                        onClick={() => setModal({ kind: 'contribute', goal })}
                        className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-0.5 rounded"
                      >
                        + Aportar
                      </button>
                    </span>
                  </div>
                  <ProgressBar value={pct} color={goal.color || '#10b981'} />
                  <div className="flex justify-between text-[11px] text-gray-500 mt-1 gap-2">
                    <span>{formatCOP(goal.current)} de {formatCOP(goal.target)}</span>
                    {goal.deadline && (
                      <span className="text-right">
                        {formatDate(goal.deadline, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {perMonth > 0 && <> · {formatCOP(perMonth)}/mes</>}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Cuentas */}
        <Card title="Cuentas y tarjetas" action={<button onClick={() => setModal({ kind: 'card' })} className="text-xs text-indigo-400 hover:text-indigo-300">+ Agregar</button>}>
          {cards.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              <div className="bg-gray-800/60 rounded-lg p-2">
                <span className="text-gray-400">En cuentas</span>
                <p className="text-white font-medium">{formatCOP(totalCash)}</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-2">
                <span className="text-gray-400">Deuda en tarjetas</span>
                <p className={`font-medium ${totalDebt > 0 ? 'text-red-400' : 'text-white'}`}>{formatCOP(totalDebt)}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {cards.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin cuentas registradas</p>}
            {cards.map((card) => {
              const usage = card.type === 'CREDIT' && card.credit_limit ? Math.round((card.balance / card.credit_limit) * 100) : null
              return (
                <button
                  key={card.id}
                  onClick={() => setModal({ kind: 'card', card })}
                  className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700/80 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard size={18} style={{ color: card.color || '#6366f1' }} />
                      <div>
                        <p className="text-sm text-white">{card.name}</p>
                        <p className="text-xs text-gray-400">
                          {card.bank}{card.last_four && ` •••• ${card.last_four}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">{formatCOP(card.balance)}</p>
                      <p className="text-xs text-gray-500">{card.type === 'CREDIT' ? 'Deuda' : 'Saldo'}</p>
                    </div>
                  </div>
                  {usage !== null && (
                    <div className="mt-2">
                      <ProgressBar value={usage} color={usage > 30 ? '#f59e0b' : '#10b981'} over={usage > 90} />
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Usas {usage}% del cupo {usage > 30 && '· ideal: menos del 30%'}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Movimientos */}
      <Card
        title={`Movimientos (${visibleTx.length})`}
        action={
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TxType | '')}
            className="bg-gray-800 border border-gray-700 text-xs text-white rounded-lg px-2 py-1 focus:outline-hidden"
          >
            <option value="">Todos</option>
            {(Object.keys(TX_TYPES) as TxType[]).map((t) => <option key={t} value={t}>{TX_TYPES[t].short}</option>)}
          </select>
        }
      >
        <div className="divide-y divide-gray-800">
          {visibleTx.map((t) => (
            <button key={t.id} onClick={() => setModal({ kind: 'tx', tx: t })} className="w-full flex items-center justify-between py-2.5 text-left hover:bg-gray-800/40 -mx-2 px-2 rounded">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: TX_TYPES[t.type].color }} />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{t.description}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {t.category} · {formatDate(t.date)}{t.cards?.name && ` · ${t.cards.name}`}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium shrink-0 ml-2" style={{ color: t.type === 'INCOME' ? '#34d399' : t.type === 'SAVINGS' ? '#22d3ee' : '#f87171' }}>
                {TX_TYPES[t.type].sign}{formatCOP(t.amount)}
              </span>
            </button>
          ))}
          {visibleTx.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Sin movimientos este mes</p>}
        </div>
      </Card>

      {/* Modales */}
      {modal?.kind === 'tx' && (
        <TransactionModal tx={modal.tx} cards={cards} defaultDate={defaultTxDate} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.kind === 'card' && <CardModal card={modal.card} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.kind === 'goal' && (
        <GoalModal goal={modal.goal} suggestedEmergency={avgExpenses * 6 || undefined} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal?.kind === 'contribute' && <ContributeModal goal={modal.goal} cards={cards} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.kind === 'budgets' && (
        <BudgetsModal budgets={budgets} spentByCategory={byCategory} onClose={() => setModal(null)} onSaved={refresh} />
      )}
    </div>
  )
}
