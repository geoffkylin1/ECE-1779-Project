import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setToken } from '../api/token'
import { SEED, tokenFor } from '../mocks/db'
import { renderApp } from '../test/render'
import { GROUP_NOT_FOUND_MESSAGE, NOT_MEMBER_MESSAGE } from './GroupDetailPage'

const APT = SEED.groups.apartment

function renderDetailAs(userId: number, path: string) {
  setToken(tokenFor(userId))
  return renderApp(path)
}

describe('GroupDetailPage', () => {
  it('shows the group name, join code and members for a member', async () => {
    renderDetailAs(SEED.users.alice, `/groups/${APT.id}`)

    expect(await screen.findByRole('heading', { name: 'Apartment 4B' })).toBeInTheDocument()
    expect(screen.getByTestId('join-code')).toHaveTextContent(APT.join_code)
    const membersCard = screen.getByRole('heading', { name: 'Members (3)' }).parentElement!
    expect(within(membersCard).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Alice',
      'Bob',
      'Carol',
    ])
    expect(screen.getByRole('link', { name: /Back to groups/ })).toHaveAttribute('href', '/groups')
  })

  it('Dave visiting Apartment 4B directly sees "You are not a member of this group"', async () => {
    renderDetailAs(SEED.users.dave, `/groups/${APT.id}`)

    expect(await screen.findByRole('heading', { name: NOT_MEMBER_MESSAGE })).toBeInTheDocument()
    expect(screen.queryByTestId('join-code')).not.toBeInTheDocument()
    expect(screen.queryByText(APT.join_code)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to groups/ })).toBeInTheDocument()
  })

  it('shows "Group not found" for a group that does not exist', async () => {
    renderDetailAs(SEED.users.alice, '/groups/999')
    expect(await screen.findByRole('heading', { name: GROUP_NOT_FOUND_MESSAGE })).toBeInTheDocument()
  })

  it('shows "Group not found" for a non-numeric id without calling the API', async () => {
    renderDetailAs(SEED.users.alice, '/groups/abc')
    expect(await screen.findByRole('heading', { name: GROUP_NOT_FOUND_MESSAGE })).toBeInTheDocument()
  })

  it('Back to groups returns to the list', async () => {
    const { user, pathname } = renderDetailAs(SEED.users.alice, `/groups/${APT.id}`)
    await screen.findByRole('heading', { name: 'Apartment 4B' })
    await user.click(screen.getByRole('link', { name: /Back to groups/ }))
    expect(pathname()).toBe('/groups')
  })
})
