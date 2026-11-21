/** "1 member", "3 members". */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`
}

/** "groceries" -> "Groceries". */
export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}
