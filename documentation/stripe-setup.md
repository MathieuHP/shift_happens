# Stripe — mise en place et test (mode test)

Deux usages de Stripe, séparés :
1. **Abonnement du restaurant** (50 €/mois) : Checkout + webhook + portail client.
2. **Paiement des shifts aux extras** : Stripe Connect, virement de la plateforme vers le compte Stripe de l'extra quand le gérant valide.

⚠️ **Mode test uniquement.** Le paiement des shifts n'est pas de la paie légale : le droit belge encadre la date et le mode de paiement des salaires (voir `ROADMAP.md`, section « Parked »). Ne jamais brancher de vraie clé (`sk_live_…`) sans revue juridique et payroll.

## Variables (`backend/.env.local`, jamais dans git)
| Variable | Rôle |
|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète de test (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature des webhooks (`stripe listen --print-secret` en local) |
| `STRIPE_PRICE_ID` | Prix mensuel (50 € : `price_1UMSzzDZiVJq8dTqqM1xg2Dp`, produit `shiftsaver-subscription`) |
| `FRONTEND_URL` | Retours Checkout / onboarding (défaut `http://localhost:5173`) |
| `REQUIRE_SUBSCRIPTION` | `true` = bloque les nouveaux signalements et recherches tant que l'abonnement n'est pas actif (défaut : off) |
| `ALLOW_EARLY_PAYOUT` | `true` = démo : on peut valider/payer un shift avant sa fin |

Les données locales (abonnement, paiements) sont dans `backend/.data/` (ignoré par git).

## Tester l'abonnement en local
```bash
npm run backend:dev
stripe listen --forward-to localhost:3000/api/billing/webhook   # laisser tourner
```
Puis dans l'app : Gérant → Paiements → **S'abonner** → carte de test `4242 4242 4242 4242`. Le statut passe à « actif » **uniquement** quand le webhook arrive (le retour de la page Stripe ne suffit pas).
Sans navigateur : créer un client et un abonnement avec `metadata[restaurant_id]=coli-brasserie` via la CLI ; le webhook met le statut à jour.

Routes : `POST /api/billing/checkout`, `GET /api/billing/status`, `POST /api/billing/portal`, `POST /api/billing/webhook`.
Événements gérés : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `transfer.reversed`. Les événements rejoués sont ignorés, et l'état de l'abonnement est relu chez Stripe (source de vérité) à chaque événement.
Règle d'accès : `trialing` et `active` donnent accès, tout le reste le bloque.

## Paiement des shifts (Connect)
Flux : le shift est couvert par un remplaçant → une ligne « à valider » apparaît (heures × taux) → le gérant clique **Valider et payer** → virement Stripe (`transfers.create`, clé d'idempotence `payable-<id>`) vers le compte lié de l'extra → l'extra reçoit l'argent dans son solde Stripe puis un virement bancaire selon son calendrier.

Routes : `GET /api/payables`, `POST /api/payables/{id}/pay`, `POST /api/payables/pay-all`, `GET|POST /api/payout-account`, `GET /api/earnings`.

### Prérequis pour tester les virements
1. **Un sandbox Stripe** (Dashboard → Sandboxes), pas le « mode test » partagé : Stripe refuse de créer un lien d'inscription Connect (compte v2) dans le mode test partagé (« Please switch to an account created in a sandbox »). Mettre les clés du sandbox dans `.env.local`. Les comptes v1 sont refusés pour les nouvelles intégrations ; on utilise l'API Accounts v2 (configuration `recipient`).
2. **Activer Connect** dans le sandbox si le Dashboard le demande.
3. **Alimenter le solde de la plateforme** (argent de test) :
   ```bash
   stripe payment_intents create --amount 100000 --currency eur --payment-method pm_card_bypassPendingBalance --confirm \
     -d "automatic_payment_methods[enabled]=true" -d "automatic_payment_methods[allow_redirects]=never"
   ```
4. L'extra ouvre **Gains → Configurer mon compte de paiement** (e-mail demandé, puis formulaire Stripe ; en mode test, utiliser les données de test proposées par Stripe).

Un virement n'est créé que si le compte de l'extra est validé par Stripe (`stripe_transfers` actif). Sinon le gérant voit « n'a pas encore configuré / validé son compte de paiement ».

### Ce qui est vérifié
- Tests unitaires avec faux client Stripe (`backend/tests/billing.test.ts`, `payouts.test.ts`) : doublons, ordre des événements, jamais deux virements, erreurs Stripe.
- Test réel en mode test partagé : Checkout, signature du webhook, abonnement actif puis annulé, portail client, création d'un compte lié.
- **Non vérifié en réel** : l'inscription hébergée et le virement vers un compte lié (nécessitent le sandbox ci-dessus).
