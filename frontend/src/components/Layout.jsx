import { Outlet, useLocation } from 'react-router-dom'
import TabBar from './TabBar'

// Cadre commun à tous les écrans : contenu centré + barre d'onglets en bas.
// Mobile : largeur max 430 px. Seul l'écran Planning est large.
export default function Layout({ tabs }) {
  const { pathname } = useLocation()
  const isWide = pathname === '/gerant/planning'

  return (
    <>
      <main
        className={
          'mx-auto w-full px-4 pt-6 pb-[96px] ' +
          (isWide ? 'max-w-6xl' : 'max-w-[430px]')
        }
      >
        <Outlet />
      </main>
      <TabBar tabs={tabs} wide={isWide} />
    </>
  )
}
