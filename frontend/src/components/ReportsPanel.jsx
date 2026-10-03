import { useEffect, useState } from 'react'
import { approveReplacement, findReplacement, getReports, getSettings, rejectReplacement, saveSettings } from '../api'
import Badge from './Badge'
import Button from './Button'
import Card from './Card'
import { formatDay } from '../format'

// Panneau du gérant : absences et retards signalés, recherche de remplaçant, confirmation.
export default function ReportsPanel() {
  const [reports, setReports] = useState(null) // null = chargement
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Charge les signalements puis les rafraîchit toutes les 4 secondes
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [reportsData, settings] = await Promise.all([getReports(), getSettings()])
        if (cancelled) return
        setReports(reportsData.items)
        setApprovalRequired(settings.manager_approval_required)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    const timer = setInterval(load, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [reloadKey])

  // Lance une action sur un signalement (trouver un remplaçant, confirmer, refuser)
  async function run(reportId, action) {
    setBusyId(reportId)
    setError('')
    try {
      await action(reportId)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.message)
    }
    setBusyId(null)
  }

  async function toggleApproval() {
    const next = !approvalRequired
    setApprovalRequired(next) // on met à jour l'écran tout de suite
    try {
      await saveSettings({ manager_approval_required: next })
    } catch (err) {
      setApprovalRequired(!next)
      setError(err.message)
    }
  }

  return (
    <section>
      <h2 className="mb-2 font-titre text-lg font-bold">Absences et retards</h2>

      {/* Réglage : confirmer chaque remplaçant ou laisser faire (autopilot) */}
      <Card className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Confirmer chaque remplaçant</p>
          <p className="text-sm text-secondaire">
            {approvalRequired ? 'Vous validez avant l\'affectation.' : 'Autopilot : le premier qui accepte est affecté.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={approvalRequired}
          aria-label="Confirmer chaque remplaçant"
          onClick={toggleApproval}
          className={
            'flex h-11 w-[72px] shrink-0 items-center rounded-full p-1 ' +
            (approvalRequired ? 'justify-end bg-vert' : 'justify-start bg-gris-clair')
          }
        >
          <span className="h-9 w-9 rounded-full bg-white shadow" />
        </button>
      </Card>

      {error && <p role="alert" className="mb-3 text-orange">{error}</p>}
      {reports === null && !error && <p className="text-secondaire">Chargement…</p>}
      {reports !== null && reports.length === 0 && <p className="text-secondaire">Aucun signalement.</p>}

      <ul className="flex flex-col gap-3">
        {reports?.map((report) => (
          <li key={report.id}>
            <ReportCard report={report} busy={busyId === report.id} onRun={run} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReportCard({ report, busy, onRun }) {
  const isAlert = report.status === 'unresolved'

  return (
    <Card className={isAlert ? 'border-2 border-orange bg-orange-clair' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-titre text-lg font-bold">{report.employee_name}</p>
          {report.shift && (
            <p className="text-sm text-secondaire">
              {report.shift.role} · <span className="capitalize">{formatDay(report.shift.date)}</span> ·{' '}
              {report.shift.start} – {report.shift.end}
            </p>
          )}
        </div>
        <Badge color={report.kind === 'absence' ? 'orange' : 'jaune'}>
          {report.kind === 'absence' ? 'Absence' : 'Retard'}
        </Badge>
      </div>

      {report.kind === 'delay' && report.eta && <p className="mt-1 text-sm">Arrivée estimée vers {report.eta}</p>}

      <StatusLine report={report} />

      {(report.status === 'open' || report.status === 'delay_noted') && (
        <Button className="mt-3 w-full" disabled={busy} onClick={() => onRun(report.id, findReplacement)}>
          Trouver un remplaçant
        </Button>
      )}
      {isAlert && (
        <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={() => onRun(report.id, findReplacement)}>
          Réessayer la recherche
        </Button>
      )}
      {report.status === 'pending_approval' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => onRun(report.id, rejectReplacement)}>
            Refuser
          </Button>
          <Button disabled={busy} onClick={() => onRun(report.id, approveReplacement)}>
            Confirmer
          </Button>
        </div>
      )}
    </Card>
  )
}

// Phrase qui résume où en est le signalement
function StatusLine({ report }) {
  const lines = {
    open: 'Aucun remplaçant cherché pour l\'instant.',
    delay_noted: 'Retard noté. Aucune recherche lancée.',
    searching: `Recherche en cours : ${report.offers_sent} offre(s) envoyée(s), ${report.offers_declined} refus.`,
    pending_approval: `${report.replacement_name} a accepté. À vous de confirmer.`,
    resolved: `Couvert par ${report.replacement_name}.`,
    unresolved: 'Aucun remplaçant trouvé. Il faut agir.',
  }
  const color = report.status === 'resolved' ? 'text-vert-texte font-medium' : report.status === 'unresolved' ? 'text-orange-texte font-semibold' : 'text-secondaire'
  return <p className={'mt-2 text-sm ' + color}>{lines[report.status]}</p>
}
