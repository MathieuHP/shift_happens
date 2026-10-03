// Toutes les icônes de l'app, en SVG inline (pas d'emoji).
// Usage : <Icon name="check" />  — la couleur suit celle du texte (currentColor).
const paths = {
  check: <path d="M5 13l4 4L19 7" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  wave: <path d="M3 12c2.5-4 4.5-4 6 0s3.5 4 6 0 3-4 6 0" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 012-2h13v4" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <circle cx="16.5" cy="13.5" r="1" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  phone: <path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1.9.3 1.7.6 2.5a2 2 0 01-.5 2.1L8 9.4a16 16 0 006.6 6.6l1.1-1.1a2 2 0 012.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0122 16.9z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      <path d="M16 4.5a3.5 3.5 0 010 7M18 14.3c2 .7 3.5 2.6 3.5 5.7" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
}

export default function Icon({ name, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
