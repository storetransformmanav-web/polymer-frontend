// TODO: replace with the signed-in user once features/auth has a real
// session (see LoginForm.jsx's TODO for the other half of this).
// Shared by UserMenu (AppBar dropdown) and Navbar (sidebar footer) —
// both need the same placeholder identity.
export const CURRENT_USER = {
  name: 'Alex Morgan',
  email: 'alex@polymercrm.example',
  role: 'Administrator',
}

export function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
