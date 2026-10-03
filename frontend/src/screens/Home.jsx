import { Link } from 'react-router-dom'

// Page d'accueil : pas d'authentification, on choisit juste son rôle.
const buttonStyle =
  'flex min-h-[56px] items-center justify-center rounded-[14px] px-4 text-lg font-semibold'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-4">
      <h1 className="font-titre text-4xl font-bold">Chez Odile</h1>
      <p className="mt-2 mb-8 text-secondaire">Qui êtes-vous ?</p>

      <div className="flex flex-col gap-3">
        <Link to="/gerant" className={buttonStyle + ' bg-vert text-white'}>
          Je suis gérant
        </Link>
        <Link
          to="/extra/dispos"
          className={buttonStyle + ' border border-bordure bg-white text-texte'}
        >
          Je suis extra
        </Link>
      </div>
    </main>
  )
}
