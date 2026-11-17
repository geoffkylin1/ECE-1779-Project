/** "1 member", "3 members". */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`
}
