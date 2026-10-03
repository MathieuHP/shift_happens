// Petite étiquette colorée (statut). color : "vert", "orange", "jaune" ou "gris".
const colors = {
  vert: 'bg-vert-clair text-vert-texte',
  orange: 'bg-orange-clair text-orange-texte',
  jaune: 'bg-jaune-clair text-jaune-texte',
  gris: 'bg-gris-clair text-gris-texte',
}

export default function Badge({ color = 'gris', children }) {
  return (
    <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-semibold ' + colors[color]}>
      {children}
    </span>
  )
}
