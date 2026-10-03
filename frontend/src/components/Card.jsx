// Carte blanche avec bordure et coins arrondis. `className` permet d'ajuster (ex : bordure orange).
export default function Card({ className = '', children }) {
  return (
    <div className={'rounded-[14px] border border-bordure bg-white p-4 ' + className}>
      {children}
    </div>
  )
}
