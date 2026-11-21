import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { setToken } from '../../api/token'
import { parseCents } from '../../lib/money'
import { db, SEED, tokenFor } from '../../mocks/db'
import { server } from '../../mocks/node'
import { renderApp } from '../../test/render'
import { NO_PARTICIPANTS_MESSAGE } from './AddExpenseForm'
import { NO_MATCHING_EXPENSES_MESSAGE, NO_MATCHING_SETTLEMENTS_MESSAGE } from './HistoryCard'
import { SAME_PERSON_MESSAGE } from './SettlementForm'

const APT = SEED.groups.apartment
const { alice, bob, carol } = SEED.users

/** Render Apartment 4B as `userId` and wait for balances and the expense list. */
async function renderApartmentAs(userId: number = alice) {
  setToken(tokenFor(userId))
  const result = renderApp(`/groups/${APT.id}`)
  await screen.findByTestId(`balance-${alice}`)
  await screen.findByRole('list', { name: 'expenses' })
  // The "You" badge needs /auth/me.
  await waitFor(() => expect(screen.getByTestId(`balance-${userId}`)).toHaveAttribute('aria-current', 'true'))
  return result
}

function balanceText(userId: number): string {
  return within(screen.getByTestId(`balance-${userId}`)).getByTestId('balance-status').textContent ?? ''
}

/** "gets back $1.00" -> 100, "owes $1.00" -> -100, "settled up" -> 0 */
function signedCents(status: string): number {
  if (status === 'settled up') return 0
  const cents = parseCents(status.replace(/^(gets back|owes) \$/, '').replace(/,/g, ''))
  return status.startsWith('owes') ? -cents : cents
}

async function openExpenseForm(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: '+ Add expense' }))
  return screen.getByRole('form', { name: 'Add expense' })
}

async function openSettlementForm(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: '+ Record settlement' }))
  return screen.getByRole('form', { name: 'Record settlement' })
}

function expenseRows() {
  return screen.queryAllByTestId('expense-row')
}

describe('Balances', () => {
  it('render with correct signs, highlight the current user, and sum to zero', async () => {
    await renderApartmentAs(alice)

    expect(balanceText(alice)).toBe('gets back $973.16')
    expect(balanceText(bob)).toBe('owes $469.67')
    expect(balanceText(carol)).toBe('owes $503.49')

    // Colour by sign.
    expect(within(screen.getByTestId(`balance-${alice}`)).getByTestId('balance-status')).toHaveClass('text-emerald-700')
    expect(within(screen.getByTestId(`balance-${bob}`)).getByTestId('balance-status')).toHaveClass('text-red-600')

    const total = [alice, bob, carol].map((id) => signedCents(balanceText(id))).reduce((a, b) => a + b, 0)
    expect(total).toBe(0)

    const me = screen.getByTestId(`balance-${alice}`)
    expect(me).toHaveAttribute('aria-current', 'true')
    expect(within(me).getByText('You')).toBeInTheDocument()
    expect(screen.getByTestId(`balance-${bob}`)).not.toHaveAttribute('aria-current')

    // Only debtors get a Settle up button.
    expect(screen.queryByRole('button', { name: 'Settle up for Alice' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settle up for Bob' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settle up for Carol' })).toBeInTheDocument()
  })

  it('shows "settled up" in grey for a zero balance', async () => {
    const { user } = await renderApartmentAs(alice)
    await user.click(screen.getByRole('button', { name: 'Settle up for Bob' }))
    await user.click(screen.getByRole('button', { name: 'Record settlement' }))

    await waitFor(() => expect(balanceText(bob)).toBe('settled up'))
    expect(within(screen.getByTestId(`balance-${bob}`)).getByTestId('balance-status')).toHaveClass('text-gray-500')
    expect(screen.queryByRole('button', { name: 'Settle up for Bob' })).not.toBeInTheDocument()
  })
})

describe('Add expense', () => {
  it('splits $100.00 three ways as 33.34/33.33/33.33, then lists it and updates balances', async () => {
    const { user } = await renderApartmentAs(alice)
    const form = await openExpenseForm(user)

    // Defaults: payer = current user, every member participates.
    expect(within(form).getByLabelText('Paid by')).toHaveValue(String(alice))
    for (const name of ['Alice', 'Bob', 'Carol']) {
      expect(within(form).getByRole('checkbox', { name })).toBeChecked()
    }

    await user.type(within(form).getByLabelText('Amount'), '100.00')
    await user.selectOptions(within(form).getByLabelText('Category'), 'dining')
    await user.type(within(form).getByLabelText('Note (optional)'), 'Pizza night')

    const preview = within(form).getByRole('region', { name: 'Split preview' })
    expect(within(preview).getAllByTestId('preview-share').map((li) => li.textContent)).toEqual([
      'Alice$33.34',
      'Bob$33.33',
      'Carol$33.33',
    ])
    expect(within(preview).getByTestId('preview-total')).toHaveTextContent('Shares add up to$100.00 ✓')

    await user.click(within(form).getByRole('button', { name: 'Add expense' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('Added $100.00 dining expense.')
    // Form reset.
    expect(within(form).getByLabelText('Amount')).toHaveValue('')
    expect(within(form).getByLabelText('Note (optional)')).toHaveValue('')

    // Listed, with payer name and shares.
    const row = await waitFor(() => {
      const found = expenseRows().find((r) => r.textContent?.includes('Pizza night'))
      expect(found).toBeDefined()
      return found!
    })
    expect(row).toHaveTextContent('Paid by Alice')
    expect(row).toHaveTextContent('Dining')
    expect(row).toHaveTextContent('$100.00')
    expect(row).toHaveTextContent('Shares (3)')
    expect(expenseRows()).toHaveLength(5)

    // Balances refetched: Alice +66.66, Bob and Carol -33.33.
    await waitFor(() => expect(balanceText(alice)).toBe('gets back $1,039.82'))
    expect(balanceText(bob)).toBe('owes $503.00')
    expect(balanceText(carol)).toBe('owes $536.82')
  })

  it('validates: amount 0, amount "1.234", and no participants', async () => {
    const { user } = await renderApartmentAs(alice)
    const form = await openExpenseForm(user)
    const amount = within(form).getByLabelText('Amount')
    const submit = within(form).getByRole('button', { name: 'Add expense' })

    await user.click(submit)
    expect(within(form).getByText('Amount is required')).toHaveAttribute('role', 'alert')

    await user.type(amount, '0')
    await user.click(submit)
    expect(within(form).getByText('Amount must be greater than 0')).toBeInTheDocument()
    expect(amount).toHaveAttribute('aria-invalid', 'true')

    await user.clear(amount)
    await user.type(amount, '1.234')
    await user.click(submit)
    expect(within(form).getByText('Use at most 2 decimal places')).toBeInTheDocument()

    await user.clear(amount)
    await user.type(amount, '100000000')
    await user.click(submit)
    expect(within(form).getByText('Amount must be at most 99,999,999.99')).toBeInTheDocument()

    await user.clear(amount)
    await user.type(amount, '12')
    await user.click(within(form).getByRole('button', { name: 'Select none' }))
    for (const name of ['Alice', 'Bob', 'Carol']) {
      expect(within(form).getByRole('checkbox', { name })).not.toBeChecked()
    }
    expect(within(form).getByText('Choose who shares this expense.')).toBeInTheDocument()
    await user.click(submit)
    expect(within(form).getByText(NO_PARTICIPANTS_MESSAGE)).toHaveAttribute('role', 'alert')

    await user.click(within(form).getByRole('button', { name: 'Select all' }))
    expect(within(form).getByRole('checkbox', { name: 'Bob' })).toBeChecked()
    expect(within(form).queryByText(NO_PARTICIPANTS_MESSAGE)).not.toBeInTheDocument()

    expect(db.expenses).toHaveLength(5) // nothing was sent
  })

  it('works with a payer who is not a participant', async () => {
    const { user } = await renderApartmentAs(alice)
    const form = await openExpenseForm(user)

    await user.selectOptions(within(form).getByLabelText('Paid by'), 'Carol')
    await user.click(within(form).getByRole('checkbox', { name: 'Carol' }))
    await user.type(within(form).getByLabelText('Amount'), '60')

    const preview = within(form).getByRole('region', { name: 'Split preview' })
    expect(within(preview).getAllByTestId('preview-share').map((li) => li.textContent)).toEqual([
      'Alice$30.00',
      'Bob$30.00',
    ])

    await user.click(within(form).getByRole('button', { name: 'Add expense' }))
    await within(form).findByRole('status')

    const created = db.expenses.at(-1)!
    expect(created.payer_id).toBe(carol)
    expect(created.shares.map((s) => s.user_id)).toEqual([alice, bob])
    expect(created.created_by).toBe(alice)

    // Carol paid 60 and owes no share: -503.49 + 60.00.
    await waitFor(() => expect(balanceText(carol)).toBe('owes $443.49'))
  })

  it('shows a server error (400) from the API', async () => {
    server.use(
      http.post('*/api/groups/:groupId/expenses', () =>
        HttpResponse.json({ detail: 'Payer is not a member of this group' }, { status: 400 }), { once: true },
      ),
    )
    const { user } = await renderApartmentAs(alice)
    const form = await openExpenseForm(user)
    await user.type(within(form).getByLabelText('Amount'), '5')
    await user.click(within(form).getByRole('button', { name: 'Add expense' }))
    expect(await within(form).findByText('Payer is not a member of this group')).toHaveAttribute('role', 'alert')
    expect(within(form).getByLabelText('Amount')).toHaveValue('5') // kept for retry
  })
})

describe('Record settlement', () => {
  it('updates balances and the settlements list', async () => {
    const { user } = await renderApartmentAs(alice)
    const form = await openSettlementForm(user)

    await user.selectOptions(within(form).getByLabelText('From (who paid)'), 'Bob')
    await user.selectOptions(within(form).getByLabelText('To (who received)'), 'Alice (You)')
    await user.type(within(form).getByLabelText('Amount'), '100')
    await user.type(within(form).getByLabelText('Note (optional)'), 'cash')
    await user.click(within(form).getByRole('button', { name: 'Record settlement' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('Recorded: Bob paid Alice $100.00.')
    await waitFor(() => expect(balanceText(bob)).toBe('owes $369.67'))
    expect(balanceText(alice)).toBe('gets back $873.16')

    await user.click(screen.getByRole('tab', { name: 'Settlements' }))
    const rows = await screen.findAllByTestId('settlement-row')
    expect(rows).toHaveLength(2)
    expect(rows.some((r) => r.textContent?.includes('Bob paid Alice $100.00'))).toBe(true)
  })

  it('blocks from == to', async () => {
    const { user } = await renderApartmentAs(alice)
    const form = await openSettlementForm(user)

    await user.selectOptions(within(form).getByLabelText('From (who paid)'), 'Bob')
    await user.selectOptions(within(form).getByLabelText('To (who received)'), 'Bob')
    await user.type(within(form).getByLabelText('Amount'), '10')
    await user.click(within(form).getByRole('button', { name: 'Record settlement' }))

    expect(within(form).getByText(SAME_PERSON_MESSAGE)).toHaveAttribute('role', 'alert')
    expect(db.settlements).toHaveLength(1)

    // Fixing either side clears the error.
    await user.selectOptions(within(form).getByLabelText('From (who paid)'), 'Carol')
    expect(within(form).queryByText(SAME_PERSON_MESSAGE)).not.toBeInTheDocument()
  })

  it('validates the amount', async () => {
    const { user } = await renderApartmentAs(alice)
    const form = await openSettlementForm(user)
    await user.type(within(form).getByLabelText('Amount'), '0.001')
    await user.click(within(form).getByRole('button', { name: 'Record settlement' }))
    expect(within(form).getByText('Use at most 2 decimal places')).toBeInTheDocument()
    expect(db.settlements).toHaveLength(1)
  })
})

describe('Settle up', () => {
  it('prefills the settlement form: debtor pays the largest creditor the smaller amount', async () => {
    const { user } = await renderApartmentAs(alice)

    await user.click(screen.getByRole('button', { name: 'Settle up for Bob' }))
    let form = screen.getByRole('form', { name: 'Record settlement' })
    expect(within(form).getByLabelText('From (who paid)')).toHaveValue(String(bob))
    expect(within(form).getByLabelText('To (who received)')).toHaveValue(String(alice))
    expect(within(form).getByLabelText('Amount')).toHaveValue('469.67')
    expect(within(form).getByLabelText('Amount')).toHaveFocus()

    // A second Settle up replaces the prefill.
    await user.click(screen.getByRole('button', { name: 'Settle up for Carol' }))
    form = screen.getByRole('form', { name: 'Record settlement' })
    expect(within(form).getByLabelText('From (who paid)')).toHaveValue(String(carol))
    expect(within(form).getByLabelText('Amount')).toHaveValue('503.49')
  })

  it('caps the amount at what the creditor is owed', async () => {
    // Alice is owed 973.16 in total; make Bob owe more than that.
    const { user } = await renderApartmentAs(alice)
    const form = await openExpenseForm(user)
    await user.selectOptions(within(form).getByLabelText('Paid by'), 'Carol')
    await user.click(within(form).getByRole('button', { name: 'Select none' }))
    await user.click(within(form).getByRole('checkbox', { name: 'Bob' }))
    await user.type(within(form).getByLabelText('Amount'), '2000')
    await user.click(within(form).getByRole('button', { name: 'Add expense' }))
    // Carol: -503.49 + 2000 = 1496.51 (now the largest). Bob: -2469.67.
    await waitFor(() => expect(balanceText(carol)).toBe('gets back $1,496.51'))

    await user.click(screen.getByRole('button', { name: 'Settle up for Bob' }))
    const settle = screen.getByRole('form', { name: 'Record settlement' })
    expect(within(settle).getByLabelText('To (who received)')).toHaveValue(String(carol))
    expect(within(settle).getByLabelText('Amount')).toHaveValue('1496.51')
  })
})

describe('History filters', () => {
  it('category and date filters change the expense list; Clear filters restores it', async () => {
    const { user } = await renderApartmentAs(alice)
    expect(expenseRows()).toHaveLength(4)

    await user.selectOptions(screen.getByLabelText('Category'), 'groceries')
    await waitFor(() => expect(expenseRows()).toHaveLength(1))
    expect(expenseRows()[0]).toHaveTextContent('Costco run')

    await user.selectOptions(screen.getByLabelText('Category'), 'transport')
    expect(await screen.findByText(NO_MATCHING_EXPENSES_MESSAGE)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(expenseRows()).toHaveLength(4))
    expect(screen.getByLabelText('Category')).toHaveValue('')

    await user.type(screen.getByLabelText('From date'), '2026-11-10')
    await waitFor(() => expect(expenseRows()).toHaveLength(3))
    await user.type(screen.getByLabelText('To date'), '2026-11-14')
    await waitFor(() => expect(expenseRows()).toHaveLength(1))
    expect(expenseRows()[0]).toHaveTextContent('Hydro')

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(expenseRows()).toHaveLength(4))
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
  })

  it('shows names (not ids), newest first, and expandable shares', async () => {
    const { user } = await renderApartmentAs(alice)
    const rows = expenseRows()
    expect(rows.map((r) => r.textContent?.match(/Paid by (\w+)/)?.[1])).toEqual(['Carol', 'Alice', 'Bob', 'Alice'])
    expect(rows[0]).toHaveTextContent('No note') // the dining expense has note: null

    await user.click(within(rows[1]).getByText('Shares (3)'))
    expect(within(rows[1]).getByText('Alice').nextSibling).toHaveTextContent('$33.34')
  })

  it('applies the date filter to settlements client-side', async () => {
    const { user } = await renderApartmentAs(alice)
    await user.click(screen.getByRole('tab', { name: 'Settlements' }))
    expect(screen.getByRole('tab', { name: 'Settlements' })).toHaveAttribute('aria-selected', 'true')

    const row = await screen.findByTestId('settlement-row')
    expect(row).toHaveTextContent('Bob paid Alice $33.33')
    expect(row).toHaveTextContent('Nov 16, 2026 · e-transfer')
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('From date'), '2026-11-17')
    expect(await screen.findByText(NO_MATCHING_SETTLEMENTS_MESSAGE)).toBeInTheDocument()
  })
})
