export interface CurrentUser {
  name: string
  email: string
  role: string
}

// TODO: replace with the signed-in user once features/auth has a real
// session (see LoginForm.tsx's TODO for the other half of this).
// Shared by UserMenu (AppBar dropdown) and Navbar (sidebar footer) —
// both need the same placeholder identity.
export const CURRENT_USER: CurrentUser = {
  name: 'Alex Morgan',
  email: 'alex@polymercrm.example',
  role: 'Administrator',
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
