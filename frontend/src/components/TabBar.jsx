import { NavLink } from 'react-router-dom'
import Icon from './Icon'

// Barre d'onglets fixe en bas de l'écran (72 px de haut).
// `tabs` est une liste d'objets : { to, label, icon }
export default function TabBar({ tabs, wide = false }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-10 h-[72px] border-t border-bordure bg-white"
    >
      <div className={'mx-auto flex h-full ' + (wide ? 'max-w-6xl' : 'max-w-[430px]')}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold ' +
              (isActive ? 'text-vert' : 'text-secondaire')
            }
          >
            <Icon name={tab.icon} />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
