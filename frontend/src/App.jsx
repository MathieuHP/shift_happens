import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ComingSoon from './components/ComingSoon'
import Home from './screens/Home'

// Les onglets du bas, pour chaque rôle.
const extraTabs = [
  { to: '/extra/dispos', label: 'Dispos', icon: 'calendar' },
  { to: '/extra/shifts', label: 'Shifts', icon: 'briefcase' },
  { to: '/extra/gains', label: 'Gains', icon: 'wallet' },
]

const gerantTabs = [
  { to: '/gerant', label: 'Ce soir', icon: 'moon' },
  { to: '/gerant/planning', label: 'Planning', icon: 'grid' },
  { to: '/gerant/equipe', label: 'Équipe', icon: 'users' },
  { to: '/gerant/paiements', label: 'Paiements', icon: 'card' },
]

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route element={<Layout tabs={extraTabs} />}>
        <Route path="/extra/dispos" element={<ComingSoon title="Disponibilités" />} />
        <Route path="/extra/shifts" element={<ComingSoon title="Shifts ouverts" />} />
        <Route path="/extra/gains" element={<ComingSoon title="Gains" />} />
      </Route>

      <Route element={<Layout tabs={gerantTabs} />}>
        <Route path="/gerant" element={<ComingSoon title="Ce soir" />} />
        <Route path="/gerant/planning" element={<ComingSoon title="Planning de la semaine" />} />
        <Route path="/gerant/equipe" element={<ComingSoon title="Équipe" />} />
        <Route path="/gerant/paiements" element={<ComingSoon title="Paiements" />} />
      </Route>
    </Routes>
  )
}
