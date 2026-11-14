import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api, toDateKey, formatCOP } from '../lib/api'
import {
  CATEGORY_SUGGESTIONS, TX_TYPES, monthsUntil,
  type Budget, type FinanceCard, type Goal, type Transaction, type TxType,
} from '../lib/finance'
import { Modal, Field, Input, Select, Button } from './ui'

/** Input de dinero: muestra separadores de miles mientras escribes */
function MoneyInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const shown = value ? Number(value).toLocaleString('es-CO') : ''
  return (
    <Input
      autoFocus={autoFocus}
      inputMode="numeric"
      value={shown}
      placeholder="0"
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
    />
  )
}

function useSaver(onDone: () => void) {
  const [saving, setSaving] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true)
    try {
      await fn()
      onDone()
    } catch (err) {
      alert(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }
  return { saving, run }
}

// ─── Transacción ─────────────────────────────────────────────────
export function TransactionModal({
  tx, cards, defaultDate, onClose, onSaved,
}: { tx?: Transaction | null; cards: FinanceCard[]; defaultDate?: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<TxType>(tx?.type || 'VARIABLE')
  const [amount, setAmount] = useState(tx ? String(Math.round(tx.amount)) : '')
  const [description, setDescription] = useState(tx?.description || '')
  const [category, setCategory] = useState(tx?.category || '')
  const [date, setDate] = useState(tx?.date?.slice(0, 10) || defaultDate || toDateKey(new Date()))
  const [cardId, setCardId] = useState(tx?.card_id || '')
  const { saving, run } = useSaver(() => { onSaved(); onClose() })

  const valid = Number(amount) > 0 && description.trim() && category.trim()
  const save = () =>
    run(() => {
      const body = { type, amount: Number(amount), description: description.trim(), category: category.trim(), date, card_id: cardId || null }
      return tx ? api.put(`/api/finance/transactions/${tx.id}`, body) : api.post('/api/finance/transactions', body)
    })
  const remove = () => {
    if (tx && confirm('¿Eliminar esta transacción?')) run(() => api.del(`/api/finance/transactions/${tx.id}`))
  }

  return (
    <Modal
      title={tx ? 'Editar movimiento' : 'Registrar movimiento'}
      onClose={onClose}
      footer={
        <>
          {tx && <Button variant="danger" onClick={remove} className="mr-auto"><Trash2 size={15} /></Button>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!valid || saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TX_TYPES) as TxType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`text-xs py-2 px-2 rounded-lg border transition-colors ${
              type === t ? 'text-white' : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
            style={type === t ? { borderColor: TX_TYPES[t].color, background: TX_TYPES[t].color + '20' } : {}}
          >
            {TX_TYPES[t].label}
          </button>
        ))}
      </div>
      <Field label="Monto (COP)"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
      <Field label="Descripción">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Almuerzo, pago arriendo…" />
      </Field>
      <Field label="Categoría">
        <Input list="tx-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Escribe o elige" />
        <datalist id="tx-categories">
          {CATEGORY_SUGGESTIONS[type].map((c) => <option key={c} value={c} />)}
        </datalist>
        <div className="flex flex-wrap gap-1 mt-2">
          {CATEGORY_SUGGESTIONS[type].slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`text-[11px] px-2 py-0.5 rounded-full ${category === c ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Cuenta / tarjeta">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">— Efectivo / otra —</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

// ─── Tarjeta / cuenta ────────────────────────────────────────────
export function CardModal({ card, onClose, onSaved }: { card?: FinanceCard | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(card?.name || '')
  const [bank, setBank] = useState(card?.bank || '')
  const [lastFour, setLastFour] = useState(card?.last_four || '')
  const [type, setType] = useState<FinanceCard['type']>(card?.type || 'DEBIT')
  const [balance, setBalance] = useState(card ? String(Math.round(card.balance || 0)) : '')
  const [limit, setLimit] = useState(card?.credit_limit ? String(Math.round(card.credit_limit)) : '')
  const [color, setColor] = useState(card?.color || '#6366f1')
  const { saving, run } = useSaver(() => { onSaved(); onClose() })

  const save = () =>
    run(() => {
      const body = {
        name, bank, last_four: lastFour, type, color,
        balance: Number(balance) || 0,
        credit_limit: type === 'CREDIT' ? Number(limit) || null : null,
      }
      return card ? api.put(`/api/finance/cards/${card.id}`, body) : api.post('/api/finance/cards', body)
    })
  const remove = () => {
    if (card && confirm(`¿Eliminar "${card.name}"? Las transacciones se conservan.`)) run(() => api.del(`/api/finance/cards/${card.id}`))
  }

  return (
    <Modal
      title={card ? 'Editar cuenta' : 'Nueva cuenta o tarjeta'}
      onClose={onClose}
      footer={
        <>
          {card && <Button variant="danger" onClick={remove} className="mr-auto"><Trash2 size={15} /></Button>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!name.trim() || !bank.trim() || saving}>Guardar</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nómina, Nu…" /></Field>
        <Field label="Banco"><Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Bancolombia" /></Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as FinanceCard['type'])}>
            <option value="DEBIT">Débito / ahorros</option>
            <option value="CREDIT">Crédito</option>
          </Select>
        </Field>
        <Field label="Últimos 4 (opcional)">
          <Input maxLength={4} inputMode="numeric" value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={type === 'CREDIT' ? 'Deuda actual' : 'Saldo actual'}><MoneyInput value={balance} onChange={setBalance} /></Field>
        {type === 'CREDIT' && <Field label="Cupo total"><MoneyInput value={limit} onChange={setLimit} /></Field>}
      </div>
      <Field label="Color">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 bg-transparent cursor-pointer" />
      </Field>
    </Modal>
  )
}

// ─── Meta de ahorro ──────────────────────────────────────────────
export function GoalModal({
  goal, suggestedEmergency, onClose, onSaved,
}: { goal?: Goal | null; suggestedEmergency?: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(goal?.name || '')
  const [target, setTarget] = useState(goal ? String(Math.round(goal.target)) : '')
  const [current, setCurrent] = useState(goal ? String(Math.round(goal.current || 0)) : '')
  const [deadline, setDeadline] = useState(goal?.deadline?.slice(0, 10) || '')
  const [color, setColor] = useState(goal?.color || '#10b981')
  const { saving, run } = useSaver(() => { onSaved(); onClose() })

  const save = () =>
    run(() => {
      const body = { name, target: Number(target), current: Number(current) || 0, deadline: deadline || null, color }
      return goal ? api.put(`/api/finance/goals/${goal.id}`, body) : api.post('/api/finance/goals', body)
    })
  const remove = () => {
    if (goal && confirm(`¿Eliminar la meta "${goal.name}"?`)) run(() => api.del(`/api/finance/goals/${goal.id}`))
  }

  const missing = Math.max(0, Number(target) - (Number(current) || 0))
  const perMonth = deadline && missing > 0 ? missing / monthsUntil(deadline) : 0

  return (
    <Modal
      title={goal ? 'Editar meta' : 'Nueva meta de ahorro'}
      onClose={onClose}
      footer={
        <>
          {goal && <Button variant="danger" onClick={remove} className="mr-auto"><Trash2 size={15} /></Button>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!name.trim() || !(Number(target) > 0) || saving}>Guardar</Button>
        </>
      }
    >
      <Field label="Nombre"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Fondo de emergencia, viaje, portátil…" /></Field>
      {!goal && suggestedEmergency ? (
        <button
          type="button"
          onClick={() => { setName('Fondo de emergencia'); setTarget(String(Math.round(suggestedEmergency))) }}
          className="text-xs text-indigo-400 hover:text-indigo-300 text-left"
        >
          💡 Sugerencia: fondo de emergencia de {formatCOP(suggestedEmergency)} (6 meses de tus gastos promedio)
        </button>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta (COP)"><MoneyInput value={target} onChange={setTarget} /></Field>
        <Field label="Ya tengo"><MoneyInput value={current} onChange={setCurrent} /></Field>
        <Field label="Fecha límite (opcional)"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 bg-transparent cursor-pointer" /></Field>
      </div>
      {perMonth > 0 && (
        <p className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
          Necesitas ahorrar <span className="text-white font-medium">{formatCOP(perMonth)}</span> al mes para lograrlo a tiempo.
        </p>
      )}
    </Modal>
  )
}

// ─── Aportar a meta ──────────────────────────────────────────────
export function ContributeModal({ goal, cards, onClose, onSaved }: { goal: Goal; cards: FinanceCard[]; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('')
  const [withdraw, setWithdraw] = useState(false)
  const [record, setRecord] = useState(true)
  const [cardId, setCardId] = useState('')
  const { saving, run } = useSaver(() => { onSaved(); onClose() })

  const save = () =>
    run(() =>
      api.post(`/api/finance/goals/${goal.id}/contribute`, {
        amount: (withdraw ? -1 : 1) * Number(amount),
        record: !withdraw && record,
        card_id: cardId || null,
      })
    )

  return (
    <Modal
      title={`${withdraw ? 'Retirar de' : 'Aportar a'} "${goal.name}"`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!(Number(amount) > 0) || saving}>{withdraw ? 'Retirar' : 'Aportar'}</Button>
        </>
      }
    >
      <p className="text-xs text-gray-400">Llevas {formatCOP(goal.current)} de {formatCOP(goal.target)}</p>
      <Field label="Monto"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={withdraw} onChange={(e) => setWithdraw(e.target.checked)} className="accent-indigo-500" />
        Es un retiro (saqué plata de esta meta)
      </label>
      {!withdraw && (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} className="accent-indigo-500" />
            Registrarlo también como ahorro de este mes
          </label>
          {record && cards.length > 0 && (
            <Field label="Desde la cuenta">
              <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
                <option value="">— Ninguna —</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
        </>
      )}
    </Modal>
  )
}

// ─── Presupuestos ────────────────────────────────────────────────
export function BudgetsModal({
  budgets, spentByCategory, onClose, onSaved,
}: { budgets: Budget[]; spentByCategory: Record<string, number>; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const usedCategories = Object.keys(spentByCategory).filter((c) => !budgets.some((b) => b.category === c))
  const suggestions = [...new Set([...usedCategories, ...CATEGORY_SUGGESTIONS.FIXED, ...CATEGORY_SUGGESTIONS.VARIABLE])]

  const add = async () => {
    if (!category.trim() || !(Number(amount) > 0)) return
    setBusy(true)
    try {
      await api.put('/api/finance/budgets', { category: category.trim(), amount: Number(amount) })
      setCategory('')
      setAmount('')
      onSaved()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (b: Budget) => {
    await api.del(`/api/finance/budgets/${b.id}`)
    onSaved()
  }

  return (
    <Modal title="Presupuesto mensual por categoría" onClose={onClose} footer={<Button onClick={onClose}>Listo</Button>}>
      <p className="text-xs text-gray-400">
        Define cuánto quieres gastar como máximo cada mes por categoría. El tablero te avisa cuando te acercas al límite.
      </p>
      <div className="space-y-1.5">
        {budgets.map((b) => (
          <div key={b.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm">
            <span className="text-white">{b.category}</span>
            <span className="flex items-center gap-3">
              <span className="text-gray-300">{formatCOP(b.amount)}</span>
              <button onClick={() => remove(b)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
        {budgets.length === 0 && <p className="text-xs text-gray-500">Aún no tienes presupuestos.</p>}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <Field label="Categoría">
          <Input list="budget-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Restaurantes" />
          <datalist id="budget-cats">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Máximo al mes"><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Button onClick={add} disabled={busy}>Agregar</Button>
      </div>
      <p className="text-[11px] text-gray-500">Si la categoría ya existe, se actualiza el monto.</p>
    </Modal>
  )
}
