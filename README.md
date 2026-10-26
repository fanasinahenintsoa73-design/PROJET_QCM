# MEDQCM L1 — Parcours par sujets

> L'entraînement QCM des futurs médecins. Un sujet à la fois, 20 questions tirées au sort, un corrigé médical détaillé, 30 jours d'accès. Le docteur prépare une file de sujets ; le suivant est attribué automatiquement au renouvellement.

Application web responsive pour la 1ʳᵉ année de médecine : dépôt d'un justificatif de paiement, validation par le docteur, séries illimitées pendant 30 jours à partir de l'acceptation, attribution automatique du prochain sujet au renouvellement et blocage à l'échéance.

Le design suit le système éditorial **Nike** décrit dans [`DESIGN-nike.md`](./DESIGN-nike.md) : typographie Bebas Neue + Inter, noir `#111`, blanc, soft-cloud `#f5f5f5`, panneaux typographiques, pilules, zéro ombre, zéro dégradé. **Aucune photographie décorative.**

---

## ⚠️ État du projet : démonstration locale

Cette version est **entièrement fonctionnelle dans le navigateur**, mais elle ne contient **pas encore de backend cloud**. C'est un choix imposé par l'absence de clés Supabase et d'un hébergement déjà authentifié.

| Sujet | Aujourd'hui (démo) | Cible production |
| --- | --- | --- |
| Comptes / mots de passe | `localStorage` du navigateur, mot de passe stocké en clair | Supabase Auth, mots de passe hachés |
| Reçus de paiement | data URL compressée dans `localStorage` | Supabase Storage, bucket privé |
| Base QCM | `localStorage` | PostgreSQL + RLS |
| Vérification des 30 jours | horloge du navigateur | contrôle serveur de l'affectation (`subject_assignments.expires_at > now()`) |
| Validation docteur | même navigateur, autre onglet | demandes partagées + attribution automatique du sujet suivant |
| Paiement | reçu joint manuellement, aucun encaissement | même principe, éventuellement Stripe |
| Hébergement | prêt pour Vercel, pas déployé ici | Vercel |

**Conséquence :** deux navigateurs différents ne partagent pas les mêmes données. Les écrans « étudiant » et « docteur » fonctionnent ensemble dans **deux onglets du même navigateur**. Pour une mise en production multi-utilisateurs, suivez [`supabase/README.md`](./supabase/README.md) et le schéma [`supabase/schema.sql`](./supabase/schema.sql).

Aucune donnée bancaire n'est saisie dans l'application. Le reçu reste une preuve de paiement jointe au dossier.

---

## Démarrage

Prérequis : **Node.js 18+** (testé avec Node 24) et npm.

```bash
npm install
npm run dev
```

Ouvrir <http://localhost:5173>.

```bash
npm run build     # typecheck TypeScript + build de production dans dist/
npm run preview   # prévisualiser le build
npm run lint      # typecheck seul
```

---

## Comptes de démonstration

La page **Connexion** est désormais l'entrée réservée à l'administrateur : elle n'affiche plus de comptes de démonstration ni de lien d'inscription. Les comptes étudiants restent dans les données pour l'interconnexion, mais leur interface de connexion sera ajoutée dans une phase ultérieure.

| Rôle | Nom | Email | Mot de passe | État initial |
| --- | --- | --- | --- | --- |
| Docteur | Sun RAZAFIMANDIMBY | `prof@medqcm.fr` | `prof1234` | Espace de pilotage |
| Étudiant actif | Jean Dupont | `jean.dupont@email.com` | `etudiant1234` | Actif, sujet 1, ~12 jours restants |
| En attente | Amina Benali | `amina.benali@email.com` | `etudiant1234` | Justificatif à vérifier ; recevra le sujet 1 |
| Expiré | Lucas Martin | `lucas.martin@email.com` | `etudiant1234` | Sujet 1 échu, renouvellement possible |
| Renouvellement | Sarah Lemoine | `sarah.lemoine@email.com` | `etudiant1234` | Sujet 1 échu + demande en attente ; recevra le sujet 2 |
| Refusé | Thomas Petit | `thomas.petit@email.com` | `etudiant1234` | Justificatif refusé |
| Bientôt expiré | Clara Fontaine | `clara.fontaine@email.com` | `etudiant1234` | Actif, sujet 1, ~3 jours restants |

> Le compte `yanis.haddad@email.com` (actif ~25 jours, sujet 1) complète le jeu de données de suivi. Les sujets 2 et 3 sont déjà en file pour tester le renouvellement automatique.

**Réinitialiser la démo :** dans la console (le panneau « Accès de démonstration » n'est plus affiché sur `/connexion`) :

```js
localStorage.removeItem('medqcm.db.v2')
localStorage.removeItem('medqcm.session.v1')
location.reload()
```

---

## Parcours fonctionnel

### Étudiant

> L'interface étudiante est préparée dans le code mais n'est pas encore exposée. La connexion actuelle est réservée à l'administrateur ; la page d'inscription sera réintroduite avec l'interface étudiante.

1. **Inscription** (phase étudiante à venir) : nom, prénom, email, mot de passe **et reçu de paiement obligatoire** (photo ou PDF, 3 Mo max). Une attestation doit être cochée.
2. **Attente** (`/en-attente`) : le QCM est inaccessible. Message de vérification sous 24 h, suivi en 3 étapes et aperçu du reçu.
3. **Activation** : le docteur ouvre le reçu et clique sur **Accepter**. L'application attribue automatiquement le premier sujet non encore fait par l'étudiant, puis ouvre un cycle de **30 jours à partir de cette acceptation**.
4. **Tableau de bord** (`/app`) : sujet attribué, jours restants, score moyen, meilleur score, séries et questions vues, dernières séries.
5. **Série** (`/app/entrainement`) : 20 questions tirées au hasard dans la banque du sujet attribué, cases A–D, plusieurs réponses possibles, une seule validation à la fin. Barre de progression, navigation précédent/suivant, quitter avec confirmation.
6. **Résultat** (`/app/resultat/:id`) : score /20, réponses exactes en vert, erreurs en rouge, réponses attendues, explication médicale détaillée pour chaque question, **export CSV** téléchargeable et bouton **Refaire une autre série**.
7. **Historique** (`/app/historique`) : toutes les séries, filtres par sujet, moyenne, record, accès au corrigé.
8. **Expiration** (`/expiration`) : à l'échéance, tout chargement de question est interrompu. Le prochain sujet du parcours est annoncé.
9. **Renouvellement** (`/reinscription`) : nouveau reçu obligatoire, nouvelle attestation, puis validation. À l'acceptation, le sujet suivant non encore fait est attribué automatiquement, sans action de « relance » du docteur.

### Docteur

- **Vue d'ensemble** (`/admin`) : demandes en attente, étudiants actifs, accès expirant sous 7 jours, taille de la file de sujets, cycles ouverts et suivi des échéances.
- **Demandes** (`/admin/demandes`) : tableau avec nom, email, date, type, justificatif, statut et actions. Aperçu du reçu (image ou PDF), approbation ou refus motivé. L'acceptation attribue immédiatement le prochain sujet non fait.
- **File de sujets** (`/admin/sujet`) : import de **deux fichiers Excel ou PDF**, appariement automatique par numéro, aperçu, titre/mois/description, puis **Enregistrer le sujet**. Chaque sujet propose deux actions : **Attribuer** à un étudiant (accès QCM immédiat de 30 jours) et **Retirer** de la file. Un sujet déjà attribué ou avec un historique ne peut plus être retiré.
- **Étudiants** (`/admin/etudiants`) : recherche, filtres (actifs, bientôt expirés, expirés, en attente, suspendus), fiche détaillée, sujet affecté, séries et moyenne, suspension motivée.

### Règles d'accès

| État | Redirection |
| --- | --- |
| Non connecté | `/connexion` |
| Étudiant en attente | `/en-attente` — QCM impossible |
| Étudiant refusé ou expiré | `/expiration` — renouvellement requis |
| Étudiant actif | `/app` |
| Docteur connecté | `/admin` |
| File de sujets vide | L'acceptation d'une demande est bloquée avec un message demandant d'ajouter un sujet |

La vérification d'expiration tourne :
- toutes les **30 s** et au retour de focus dans le contexte d'authentification ;
- toutes les **15 s** pendant une série ;
- à chaque changement de question et à chaque chargement d'écran protégé.

Dans cette démo, cette logique s'exécute côté client. Elle répond au besoin fonctionnel, mais **n'est pas une barrière de sécurité** : un utilisateur peut modifier `localStorage`. La version Supabase vérifie l'échéance côté serveur dans les fonctions RPC et les policies RLS.

---

## Reçus de paiement

- Formats acceptés : JPG, PNG, WebP, GIF, HEIC/HEIF (via le sélecteur image), PDF.
- Taille maximale : **3 Mo**.
- Les images sont redimensionnées à 1600 px max et réencodées en JPEG pour limiter le poids.
- **Aucune validation sans reçu.**
- Le reçu est visible par l'étudiant et par le docteur. Il n'est pas affiché publiquement.
- En démo, le reçu est stocké dans le navigateur. Si le quota `localStorage` est dépassé, l'application affiche un message explicite et invite à utiliser un fichier plus léger.

Le bouton **Utiliser un reçu de démonstration** génère un faux reçu SVG local, sans paiement réel.

---

## Import des sujets (Excel ou PDF)

Deux fichiers `.xlsx`, `.xls` ou `.pdf` sont nécessaires. Les PDF doivent être des **PDF texte** contenant un tableau avec les mêmes colonnes que les fichiers Excel ; les PDF scannés en image ne sont pas pris en charge.

**Fichier 1 — Questions**

| N° Question | Matière | Énoncé | Option A | Option B | Option C | Option D |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Anatomie | Question… | Réponse A | Réponse B | Réponse C | Réponse D |

**Fichier 2 — Corrections**

| N° Question | Réponse exacte [ex B] | Explication médicale |
| --- | --- | --- | --- |
| 1 | B | Explication détaillée… |

- Les en-têtes sont normalisés (accents, casse, espaces).
- Plusieurs réponses exactes sont possibles : `A`, `B`, `A;C`, `AC`, etc.
- Chaque question du fichier Corrigés doit correspondre à un numéro du fichier Questions. Les numéros en double, les corrigés manquants et les options vides sont refusés avec un message précis.
- Des modèles téléchargeables sont proposés dans l'écran **File de sujets**.
- **Enregistrement** : après avoir sélectionné les deux fichiers, vérifiez le message `N questions appariées` et l'aperçu, renseignez le titre et le mois, puis cliquez sur **Enregistrer le sujet** et confirmez. Les deux fichiers sont enregistrés ensemble comme un seul sujet ; aucun accès étudiant n'est encore ouvert.
- À l'enregistrement : le sujet reçoit `publishedAt = maintenant` et entre dans la file. Les sujets ne portent plus d'échéance globale : l'échéance de 30 jours appartient à l'affectation de chaque étudiant.
- **Attribution automatique** : à l'acceptation d'une demande, le premier sujet non encore fait par l'étudiant lui est attribué pour 30 jours.
- **Attribution manuelle** : sur la carte d'un sujet, **Attribuer** ouvre la liste des étudiants. L'étudiant choisi reçoit immédiatement ce sujet et un accès QCM de 30 jours. Un seul cycle actif est autorisé par étudiant ; si une demande est en attente, elle est validée. Le sujet reste disponible dans la file pour d'autres étudiants.

---

## Stack et structure

- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS 3.4**
- **React Router 6**
- **SheetJS (`xlsx`)** pour l'import/export Excel
- **PDF.js (`pdfjs-dist`)** pour l'extraction des tableaux PDF, chargée à la demande
- **lucide-react** pour les icônes
- Polices auto-hébergées : Bebas Neue et Inter (`public/fonts`)
- Aucune photographie décorative : les visuels sont typographiques et construits en CSS

```text
src/
├── App.tsx                 # routes et garde-fous
├── main.tsx
├── index.css               # tokens, typographie, composants de base
├── components/
│   ├── AdminLayout.tsx
│   ├── AuthShell.tsx
│   ├── Footer.tsx
│   ├── Headers.tsx
│   ├── Layouts.tsx         # layouts + RequireStudent/Admin/...
│   ├── Logo.tsx
│   ├── landing/            # FAQ, aperçu de série
│   └── ui/                 # Button, Field, Modal, Receipt, Toast…
├── lib/
│   ├── access.ts           # état d'accès dérivé de l'échéance
│   ├── auth.tsx            # session + horloge d'expiration
│   ├── db.ts               # persistance localStorage, file de sujets, affectations
│   ├── excel.ts            # parsing et modèles Excel
│   ├── pdf.ts              # extraction des tableaux PDF (à la demande)
│   ├── seed.ts             # données et comptes de démonstration
│   ├── demoReceipt.ts
│   └── utils.ts
├── pages/
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── PendingPage.tsx
│   ├── ExpirationPage.tsx
│   ├── RenewalPage.tsx
│   ├── DashboardPage.tsx
│   ├── QuizPage.tsx
│   ├── ResultPage.tsx
│   ├── HistoryPage.tsx
│   ├── NotFoundPage.tsx
│   └── admin/
├── types.ts
supabase/
├── README.md
└── schema.sql
public/
├── fonts/
└── favicon.svg
vercel.json
```

### Modèle de données local

`src/types.ts` définit `User`, `AccessRequest`, `Subject`, `SubjectAssignment`, `Question`, `Attempt`. La base est stockée sous la clé **`medqcm.db.v2`** et la session sous `medqcm.session.v1`. Chaque écriture déclenche un événement `medqcm:change`, ce qui permet la synchronisation entre onglets via `storage`.

Une `SubjectAssignment` relie un étudiant à un sujet pour un cycle de 30 jours (`startedAt`, `expiresAt`, `requestId`). Les sujets ne portent plus d'échéance globale. À l'acceptation, l'application choisit le premier sujet publié que l'étudiant n'a pas encore consommé ; si la file est vide, l'acceptation est refusée.

La version Supabase reprend ce modèle avec : `profiles`, `access_requests`, `subjects`, `subject_assignments`, `questions`, `attempts`.

---

## Déploiement Vercel

Le projet est prêt à être déployé comme site statique + SPA. `vercel.json` contient déjà le rewrite vers `index.html`, les en-têtes de cache des assets et la configuration Vite.

### Depuis l'interface Vercel

1. Pousser le dossier dans un dépôt GitHub/GitLab.
2. **Add New → Project**, importer le dépôt.
3. Framework : **Vite** (détecté). Build : `npm run build`. Output : `dist`.
4. Déployer.

### Avec la CLI

```bash
npm i -g vercel
vercel login
vercel          # preview
vercel --prod   # production
```

Aucun variable d'environnement n'est requise pour la démo. Pour brancher Supabase, ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans **Project Settings → Environment Variables**.

> Un déploiement n'a pas été effectué depuis cet environnement : aucune session Vercel ni jeton `VERCEL_TOKEN` n'était disponible. Le projet est néanmoins buildé et prêt pour `vercel --prod`.

---

## Passage en production Supabase

Voir le guide complet : [`supabase/README.md`](./supabase/README.md).

Résumé :

1. Créer un projet Supabase.
2. Exécuter `supabase/schema.sql` dans le SQL Editor.
3. Créer les utilisateurs Auth ; le trigger crée automatiquement leur profil.
4. Passer le compte docteur en `role = 'professor'`.
5. Uploader les reçus dans le bucket privé `receipts` au chemin `{userId}/...`.
6. Brancher le client Supabase et remplacer l'adaptateur `src/lib/db.ts`.
7. Déployer sur Vercel avec les variables d'environnement.

Le schéma fournit :

- les tables, contraintes, index et policies RLS ;
- un bucket Storage privé pour les reçus, accessible au propriétaire et au docteur ;
- les RPC `start_quiz`, `submit_attempt`, `get_attempt_review` pour ne jamais exposer les corrigés avant la validation ;
- les RPC `approve_access_request` (attribution du prochain sujet), `reject_access_request`, `publish_subject` (ajout à la file) et `remove_subject` pour appliquer les règles métier côté serveur ;
- un contrôle d'échéance basé sur `now()` serveur.

Points de sécurité à traiter avant une vraie mise en ligne :

- activer la confirmation email Supabase et une politique de mot de passe ;
- configurer les sauvegardes et la rétention des reçus ;
- ajouter un vrai flux d'abonnement/paiement si nécessaire ;
- ajouter un rate limit sur les RPC et un journal d'audit des validations ;
- vérifier le cadre RGPD (consentement, durée de conservation, droit à l'effacement) ;
- ne jamais exposer la clé `service_role` dans le frontend.

---

## Limites connues de la démo

- Données locales par navigateur, non partagées entre appareils.
- Mots de passe en clair dans `localStorage` : **ne jamais utiliser tel quel avec de vraies données**.
- Reçus et résultats limités par le quota du navigateur.
- Aucun email transactionnel : l'activation est visible en temps réel par synchronisation d'onglets.
- Aucun paiement réel : le reçu est joint manuellement.
- La banque de démonstration contient trois sujets de 32 questions ; l'import Excel ou PDF permet d'en publier autant que nécessaire (par exemple 3 × 100 questions).
- L'expiration et l'attribution sont simulées côté client. La version Supabase verrouille les RPC côté serveur.

---

## Crédits

- Typographies : **Bebas Neue** et **Inter**, Google Fonts (SIL Open Font License).
- Aucune photographie : identité visuelle entièrement typographique.
- Design de référence : `DESIGN-nike.md`, système éditorial Nike.
- Projet indépendant, sans affiliation avec Nike.
