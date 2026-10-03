// Bouton de l'app (zone tactile d'au moins 44 px).
// variant : "primary" (vert plein) ou "secondary" (blanc avec bordure)
const styles = {
  primary: 'bg-vert text-white disabled:opacity-60',
  secondary: 'border border-bordure bg-white text-texte disabled:opacity-60',
}

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={
        'flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] px-4 font-semibold ' +
        styles[variant] +
        ' ' +
        className
      }
      {...props}
    >
      {children}
    </button>
  )
}
