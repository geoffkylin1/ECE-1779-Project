import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { register } from '../api/auth'
import { setToken } from '../api/token'
import { ALREADY_MEMBER_MESSAGE, NOT_FOUND_MESSAGE } from '../components/groups/JoinGroupForm'
import { db, SEED, tokenFor } from '../mocks/db'
import { server } from '../mocks/node'
import { loginAs } from '../test/helpers'
import { renderApp } from '../test/render'
import { INVALID_JOIN_CODE_MESSAGE } from '../lib/validation'
import { EMPTY_GROUPS_MESSAGE } from './GroupsPage'

const APT = SEED.groups.apartment

function renderGroupsAs(userId: number) {
  setToken(tokenFor(userId))
  return renderApp('/groups')
}

/** Wait until the group list has rendered (it has at least one link). */
async function groupLink(name: RegExp | string) {
  return screen.findByRole('link', { name: typeof name === 'string' ? new RegExp(name) : name })
}

describe('My groups list', () => {
  it("Alice sees Apartment 4B with its member count, but not Dave's Trip", async () => {
    renderGroupsAs(SEED.users.alice)

    const card = await groupLink('Apartment 4B')
    expect(card).toHaveAttribute('href', `/groups/${APT.id}`)
    expect(within(card).getByText('3 members')).toBeInTheDocument()
    expect(screen.queryByText("Dave's Trip")).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows the empty state for a freshly registered user', async () => {
    await register({ email: 'new@test.com', password: 'longenough', display_name: 'Newbie' })
    await loginAs('new@test.com', 'longenough')
    renderApp('/groups')

    expect(await screen.findByText(new RegExp(EMPTY_GROUPS_MESSAGE))).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('clicking a group card opens its page', async () => {
    const { user, pathname } = renderGroupsAs(SEED.users.alice)
    await user.click(await groupLink('Apartment 4B'))
    expect(pathname()).toBe(`/groups/${APT.id}`)
    expect(await screen.findByRole('heading', { name: 'Apartment 4B' })).toBeInTheDocument()
  })

  it('shows an error with Retry when loading fails, and recovers', async () => {
    server.use(
      http.get('*/api/groups', () => HttpResponse.json({ detail: 'Database unavailable' }, { status: 500 }), {
        once: true,
      }),
    )
    const { user } = renderGroupsAs(SEED.users.alice)

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await groupLink('Apartment 4B')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Create group', () => {
  it('shows the new join code with a working Copy button and adds the group to the list', async () => {
    const { user } = renderGroupsAs(SEED.users.alice)
    await groupLink('Apartment 4B')

    await user.click(screen.getByRole('button', { name: 'New group' }))
    await user.type(screen.getByLabelText('Group name'), '  Ski Trip  {Enter}')

    const created = db.groups.find((g) => g.name === 'Ski Trip')
    expect(created).toBeDefined()
    expect(created!.join_code).toMatch(/^[A-Z0-9]{8}$/)

    expect(await screen.findByTestId('join-code')).toHaveTextContent(created!.join_code)
    expect(screen.getByText('Share this code with your roommates so they can join.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(created!.join_code)

    // The list was refreshed.
    const card = await groupLink('Ski Trip')
    expect(within(card).getByText('1 member')).toBeInTheDocument()
    expect(card).toHaveAttribute('href', `/groups/${created!.id}`)
  })

  it('validates the name (1-50 characters)', async () => {
    const { user } = renderGroupsAs(SEED.users.alice)
    await user.click(screen.getByRole('button', { name: 'New group' }))

    await user.click(screen.getByRole('button', { name: 'Create group' }))
    expect(screen.getByText('Group name is required')).toHaveAttribute('role', 'alert')

    await user.type(screen.getByLabelText('Group name'), 'x'.repeat(51))
    expect(screen.getByText('Group name must be at most 50 characters')).toBeInTheDocument()
    expect(db.groups).toHaveLength(2) // nothing was created
  })

  it('Cancel closes the form', async () => {
    const { user } = renderGroupsAs(SEED.users.alice)
    await user.click(screen.getByRole('button', { name: 'New group' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument()
  })
})

describe('Join group', () => {
  it('Dave joins Apartment 4B with a lowercase code and lands on its page', async () => {
    const { user, pathname } = renderGroupsAs(SEED.users.dave)
    await groupLink("Dave's Trip")

    const input = screen.getByLabelText('Join code')
    await user.type(input, APT.join_code.toLowerCase())
    expect(input).toHaveValue(APT.join_code) // uppercased as typed
    await user.click(screen.getByRole('button', { name: 'Join group' }))

    expect(await screen.findByRole('heading', { name: 'Apartment 4B' })).toBeInTheDocument()
    expect(pathname()).toBe(`/groups/${APT.id}`)
    // Now listed as a member.
    const membersCard = screen.getByRole('heading', { name: 'Members (4)' }).parentElement!
    expect(within(membersCard).getByText('Dave')).toBeInTheDocument()
  })

  it('normalizes typed and pasted input: strips spaces, uppercases, max 8 chars', async () => {
    const { user } = renderGroupsAs(SEED.users.dave)
    const input = screen.getByLabelText('Join code')

    await user.type(input, ' ab cd efgh12')
    expect(input).toHaveValue('ABCDEFGH')

    await user.clear(input)
    await user.click(input)
    await user.paste('  k7q2zp4m  ')
    expect(input).toHaveValue('K7Q2ZP4M')
  })

  it('shows "No group found with that code" for a bad code', async () => {
    const { user, pathname } = renderGroupsAs(SEED.users.dave)
    await user.type(screen.getByLabelText('Join code'), 'NOPE0000{Enter}')

    expect(await screen.findByText(NOT_FOUND_MESSAGE)).toHaveAttribute('role', 'alert')
    expect(pathname()).toBe('/groups')
  })

  it('shows the 409 message with a link when already a member', async () => {
    const { user } = renderGroupsAs(SEED.users.alice)
    await groupLink('Apartment 4B') // list loaded, so the group can be found

    await user.type(screen.getByLabelText('Join code'), `${APT.join_code}{Enter}`)

    const alert = await screen.findByText(new RegExp(ALREADY_MEMBER_MESSAGE))
    expect(alert).toHaveAttribute('role', 'alert')
    expect(within(alert).getByRole('link', { name: 'Open Apartment 4B' })).toHaveAttribute(
      'href',
      `/groups/${APT.id}`,
    )
  })

  it('shows the API detail for a 422, without Pydantic\'s "Value error, " prefix', async () => {
    server.use(
      http.post(
        '*/api/groups/join',
        () => HttpResponse.json({ detail: 'Value error, Join code must be 8 letters or digits' }, { status: 422 }),
        { once: true },
      ),
    )
    const { user } = renderGroupsAs(SEED.users.dave)
    await user.type(screen.getByLabelText('Join code'), 'ABCD1234{Enter}')
    expect(await screen.findByText('Join code must be 8 letters or digits')).toHaveAttribute('role', 'alert')
    expect(screen.queryByText(/Value error/)).not.toBeInTheDocument()
  })

  it.each([
    ['too short', 'ABC'],
    ['7 characters', 'K7Q2ZP4'],
    ['punctuation', 'K7Q2-P4M'],
  ])('blocks a code that is not 8 letters/digits (%s) without calling the API', async (_, typed) => {
    let called = false
    server.use(
      http.post('*/api/groups/join', () => {
        called = true
      }),
    )
    const { user, pathname } = renderGroupsAs(SEED.users.dave)
    await user.type(screen.getByLabelText('Join code'), `${typed}{Enter}`)

    expect(screen.getByText(INVALID_JOIN_CODE_MESSAGE)).toHaveAttribute('role', 'alert')
    expect(called).toBe(false)
    expect(pathname()).toBe('/groups')

    // Editing clears the message.
    await user.clear(screen.getByLabelText('Join code'))
    expect(screen.queryByText(INVALID_JOIN_CODE_MESSAGE)).not.toBeInTheDocument()
  })

  it('asks for a code when submitted empty', async () => {
    const { user } = renderGroupsAs(SEED.users.dave)
    await user.click(screen.getByRole('button', { name: 'Join group' }))
    expect(screen.getByText('Enter a join code')).toHaveAttribute('role', 'alert')
  })
})
