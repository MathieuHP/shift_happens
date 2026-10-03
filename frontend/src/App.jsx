import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ComingSoon from './components/ComingSoon'
import Home from './screens/Home'
import ExtraDispos from './screens/ExtraDispos'
import ExtraShifts from './screens/ExtraShifts'
import ExtraGains from './screens/ExtraGains'
import GerantTonight from './screens/GerantTonight'
import GerantPlanning from './screens/GerantPlanning'

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
        <Route path="/extra/dispos" element={<ExtraDispos />} />
        <Route path="/extra/shifts" element={<ExtraShifts />} />
        <Route path="/extra/gains" element={<ExtraGains />} />
      </Route>

      <Route element={<Layout tabs={gerantTabs} />}>
        <Route path="/gerant" element={<GerantTonight />} />
        <Route path="/gerant/planning" element={<GerantPlanning />} />
        <Route path="/gerant/equipe" element={<ComingSoon title="Équipe" />} />
        <Route path="/gerant/paiements" element={<ComingSoon title="Paiements" />} />
      </Route>
    </Routes>
  )
}
