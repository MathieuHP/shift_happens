import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo-shift-happens.png'
import { EMPLOYEES, getCurrentEmployeeId, setCurrentEmployeeId } from '../config'

// Page d'accueil : pas d'authentification, on choisit juste son rôle.
const buttonStyle =
  'flex min-h-[56px] items-center justify-center rounded-[14px] px-4 text-lg font-semibold'

export default function Home() {
  const [employeeId, setEmployeeId] = useState(getCurrentEmployeeId())

  function handleChange(event) {
    setEmployeeId(event.target.value)
    setCurrentEmployeeId(event.target.value)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-4">
      {/* Logo de l'app (carré vert foncé, texte rose) */}
      <img
        src={logo}
        alt="Shift Happens"
        width="176"
        height="177"
        className="mx-auto mb-8 h-44 w-44 rounded-[28px]"
      />

      <h1 className="font-titre text-4xl font-bold">Coli Brasserie</h1>
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

      {/* Pas d'authentification : on choisit le compte de démo utilisé côté extra / employé */}
      <label className="mt-8 block text-sm font-medium text-secondaire" htmlFor="employee">
        Compte de démo (côté extra)
      </label>
      <select
        id="employee"
        value={employeeId}
        onChange={handleChange}
        className="mt-1 min-h-[44px] w-full rounded-[14px] border border-bordure bg-white px-3"
      >
        {EMPLOYEES.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name} — {employee.label}
          </option>
        ))}
      </select>
    </main>
  )
}
