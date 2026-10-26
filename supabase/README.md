# Passage en production — Supabase

Ce dossier contient le schéma cible de la plateforme. **Le frontend fourni reste volontairement une démo `localStorage`** : il fonctionne sans compte cloud, sans clé et sans coût. Les fichiers ci-dessous décrivent exactement comment le brancher à Supabase pour obtenir une vraie plateforme multi-utilisateurs.

- [`schema.sql`](./schema.sql) — tables, RLS, Storage, triggers et RPC métier.
- `README.md` — ce guide de mise en place et de migration.

---

## 1. Pourquoi ce schéma est nécessaire

La démo actuelle fait confiance au navigateur :

- les comptes et les reçus sont dans `localStorage` ;
- l'expiration est comparée à l'horloge locale ;
- le professeur et l'étudiant doivent utiliser le même navigateur ;
- les mots de passe ne sont pas hachés.

En production, ces responsabilités passent côté serveur :

| Règle | Implémentation Supabase |
| --- | --- |
| Mot de passe haché | Supabase Auth |
| Un compte = un profil | trigger `handle_new_user` |
| Reçu obligatoire | bucket privé + `receipt_path NOT NULL` |
| Validation professeur | RPC `approve_access_request` / `reject_access_request` |
| Échéance à 30 jours | `subject_assignments.expires_at = started_at + interval '30 days'` |
| Blocage après échéance | `has_active_access()` + RLS + RPC |
| Tirage de 20 questions | RPC `start_quiz`, limité au sujet affecté |
| Corrigé après validation | RPC `submit_attempt` puis `get_attempt_review` |
| Sujet suivant au renouvellement | RPC `approve_access_request` |
| Retrait d'un sujet non attribué | RPC `remove_subject` |
| Reçus privés | bucket `receipts` + URL signées |
| Horloge fiable | `now()` PostgreSQL, jamais l'heure du client |

---

## 2. Créer le projet et appliquer le schéma

1. Créer un projet gratuit sur <https://supabase.com>.
2. Ouvrir **SQL Editor**.
3. Coller le contenu complet de [`schema.sql`](./schema.sql), puis **Run**.

Ou en local avec [`psql`](https://www.postgresql.org/download/) :

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
```

Le schéma crée :

- `profiles` — identité, rôle, statut, `activated_at`, `expires_at` ;
- `access_requests` — premier paiement ou renouvellement, reçu, validation ;
- `subjects` — sujets en file, `published_at`, `archived`, sans échéance globale ;
- `subject_assignments` — cycle de 30 jours d'un étudiant sur un sujet ;
- `questions` — énoncés, options, réponses exactes, explications ;
- `attempts` — séries, réponses, score ;
- le bucket privé `receipts` ;
- les RPC de lecture et d'écriture.

Le script suppose un projet neuf. Si vous l'exécutez sur une base déjà partiellement migrée, adaptez les `create type`, les policies et le trigger.

---

## 3. Authentification et comptes

### Inscription

Le client appelle :

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      first_name: 'Amina',
      last_name: 'Benali',
    },
  },
})
```

Le trigger `handle_new_user` crée automatiquement le profil `pending`.

### Confirmation email

- En développement, vous pouvez désactiver **Confirm email** pour tester immédiatement.
- En production, gardez la confirmation activée. L'étudiant devra confirmer son adresse avant de déposer son reçu, ou vous devrez prévoir un écran de reprise après confirmation.

### Créer le professeur

1. **Authentication → Users → Add user** : créer l'adresse du professeur, avec un mot de passe solide.
2. Dans le SQL Editor :

```sql
update public.profiles
set role = 'professor',
    status = 'active',
    activated_at = now(),
    expires_at = now() + interval '100 years'
where email = 'professeur@exemple.fr';
```

3. Vérifier :

```sql
select id, email, role, status, expires_at
from public.profiles
where role = 'professor';
```

Il n'existe volontairement **aucune interface d'inscription professeur** dans l'application. Un professeur est promu manuellement, avec la clé `service_role` ou depuis le dashboard Supabase, jamais depuis le navigateur.

---

## 4. Reçus de paiement

Le bucket `receipts` est créé **privé**. Chemin recommandé :

```text
receipts/{userId}/{uuid}.jpg
receipts/{userId}/{uuid}.pdf
```

### Dépôt côté étudiant

```ts
const path = `${user.id}/${crypto.randomUUID()}.${extension}`

const { error: uploadError } = await supabase.storage
  .from('receipts')
  .upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

if (uploadError) throw uploadError

const { error: requestError } = await supabase
  .from('access_requests')
  .insert({
    user_id: user.id,
    type: 'initial', // ou 'renewal'
    receipt_path: path,
    receipt_name: file.name,
    receipt_mime: file.type,
  })
```

La policy vérifie que le chemin commence par `auth.uid()`, que la demande est `pending` et que le reçu est non vide.

### Lecture côté professeur

Lister les demandes :

```ts
const { data: requests, error } = await supabase
  .from('access_requests')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: true })
```

Créer une URL signée courte pour afficher le reçu :

```ts
const { data, error } = await supabase.storage
  .from('receipts')
  .createSignedUrl(request.receipt_path, 120) // 2 minutes
```

Ne jamais rendre le bucket public. Aucun `service_role` dans le frontend.

### Validation

```ts
const { data, error } = await supabase.rpc('approve_access_request', {
  p_request_id: requestId,
})

// data = { requestId, userId, subjectId, assignmentId, startedAt, expiresAt }
```

Le serveur :

1. vérifie que l'appelant est professeur ;
2. vérifie que la demande est encore `pending` et qu'aucun cycle actif n'existe ;
3. choisit le premier sujet de la file que l'étudiant n'a jamais consommé ;
4. crée une affectation de 30 jours et passe le profil en `active` ;
5. approuve la demande et remplace toute autre demande en attente.

Si aucun sujet n'est disponible, la RPC échoue avec `NO_SUBJECT_AVAILABLE` et **la demande reste en attente** : aucun jour d'accès n'est consommé sans contenu.

Refus avec motif :

```ts
await supabase.rpc('reject_access_request', {
  p_request_id: requestId,
  p_note: 'Reçu illisible, merci de renvoyer une photo nette.',
})
```

---

## 5. File de sujets et Excel

Le frontend continue à parser les deux fichiers Excel avec `src/lib/excel.ts`, puis convertit les lignes vers le JSON attendu par `publish_subject` :

```ts
const questions = rows.map((row) => ({
  number: row.number,
  matiere: row.matiere,
  statement: row.statement,
  options: row.options,
  correctAnswers: row.correctAnswers,
  explanation: row.explanation,
}))

const { data: subjectId, error } = await supabase.rpc('publish_subject', {
  p_title: title,
  p_description: description,
  p_month_label: monthLabel,
  p_questions: questions,
})
```

La fonction :

1. refuse un appelant non professeur ;
2. crée un sujet `published_at = now()`, sans échéance globale ;
3. insère les questions liées par leur numéro ;
4. renvoie l'identifiant du nouveau sujet.

Le sujet entre dans la file. Il n'archive plus les précédents : chaque étudiant garde son sujet et son historique. À l'acceptation ou au renouvellement, `approve_access_request` choisit le premier sujet publié que l'étudiant n'a pas encore consommé.

Un sujet non attribué peut être retiré avec `remove_subject`. La fonction refuse la suppression s'il existe une affectation ou une tentative : il faut alors l'archiver pour le masquer de la file sans casser l'historique.

Les contraintes SQL refusent : options A–D vides, réponse hors A–D, nombre de réponses invalide, doublon de numéro dans le même sujet, sujet vide.

---

## 6. Lancer et corriger une série

### Démarrer

```ts
const { data, error } = await supabase.rpc('start_quiz', { p_count: 20 })

// data.assignmentExpiresAt : fin du cycle de 30 jours
// data.subject : id, title, description, monthLabel, questionCount
// data.questions : 20 questions SANS correctAnswers ni explanation
```

Si `error.message` contient `ACCESS_EXPIRED` ou `NO_ACTIVE_SUBJECT`, rediriger respectivement vers `/expiration` ou vers l’écran « prochain sujet ».

### Enregistrer

```ts
const answers = {
  'uuid-question-1': ['A'],
  'uuid-question-2': ['A', 'C'],
}

const { data, error } = await supabase.rpc('submit_attempt', {
  p_question_ids: questionIds,
  p_answers: answers,
})

// data = { attemptId, score, total, subjectId }
```

Le score est calculé **côté serveur** : une réponse est juste uniquement si l'ensemble coché est exactement égal à l'ensemble attendu. Pas de point négatif, pas de validation partielle.

### Corrigé

```ts
const { data, error } = await supabase.rpc('get_attempt_review', {
  p_attempt_id: attemptId,
})
```

La fonction vérifie que la tentative appartient à l'étudiant (ou que l'appelant est professeur), puis renvoie énoncés, options, réponses exactes, réponses données et explications.

**Important :** ne jamais exposer une policy de lecture directe de `questions` aux étudiants. Les corrigés ne doivent être accessibles qu'après `submit_attempt`, via la RPC. C'est le rôle des policies actuelles.

---

## 7. Expiration

L'accès est actif si et seulement si le profil est `active` **et** qu'une affectation non expirée existe :

```sql
p.status = 'active'
and a.started_at <= now()
and a.expires_at > now()
```

`has_active_access()` vérifie cette jointure `profiles` + `subject_assignments`. Elle est utilisée :

- dans `start_quiz` ;
- dans `submit_attempt` ;
- indirectement par les écrans qui lisent le profil.

Côté client, les garde-fous React restent utiles pour l'UX, mais **la sécurité repose sur ces contrôles serveur**. Un utilisateur qui modifie le JavaScript ou le stockage local ne peut pas obtenir de questions fraîches ni enregistrer de score après l'échéance.

Pour une coupure à la seconde près, les RPC vérifient `now()` à chaque appel. Un rafraîchissement des écrans toutes les 15–30 secondes suffit pour l'affichage.

---

## 8. Variables d'environnement

Créer `.env.local` (jamais commité) :

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Sur Vercel, ajouter les deux variables dans **Project Settings → Environment Variables** pour Preview et Production.

Ne jamais utiliser :

```bash
SUPABASE_SERVICE_ROLE_KEY=... # interdit dans le frontend
```

La clé `anon` est publique par nature ; la sécurité vient des policies RLS et des RPC.

---

## 9. Brancher le frontend (plan de migration)

La couche locale est centralisée dans `src/lib/db.ts` et `src/lib/auth.tsx`. Pour éviter de réécrire tous les écrans :

1. Conserver les types de `src/types.ts` (camelCase).
2. Créer un adaptateur `src/lib/cloud/` qui expose les mêmes fonctions que `db.ts` :
   - `login` → `supabase.auth.signInWithPassword` ;
   - `registerStudent` → `signUp` + upload + insert ;
   - `getActiveAssignment` → `subject_assignments` active + `subjects` ;
   - `getNextSubjectForUser` → premier sujet de la file non consommé ;
   - `getSubjectQuestions` → RPC `start_quiz` ;
   - `saveAttempt` → RPC `submit_attempt` ;
   - `getAttempt` → RPC `get_attempt_review` ;
   - `approveRequest` / `rejectRequest` → RPC ;
   - `publishSubject` → RPC `publish_subject` ;
   - `removeSubject` → RPC `remove_subject`.
3. Ajouter un adaptateur de mapping `snake_case` (SQL) ↔ `camelCase` (React).
4. Brancher `AuthProvider` sur `supabase.auth.onAuthStateChange`.
5. Remplacer `access.ts` par un appel au profil serveur + RPC de contrôle.
6. Supprimer les imports de `seed.ts` et les boutons de démonstration.
7. Tester les RLS avec deux comptes étudiants et un professeur.

Une implémentation typique du client :

```ts
// npm i @supabase/supabase-js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
)
```

Les formulaires d'inscription et de renouvellement peuvent conserver leur UI et leur validation : seule la persistance change.

---

## 10. Vérifications SQL utiles

```sql
-- File de sujets
select id, title, published_at, question_count
from public.subjects
where not archived
order by published_at asc;

-- Affectations actives (un étudiant = un sujet)
select p.email, s.title, a.started_at, a.expires_at
from public.subject_assignments a
join public.profiles p on p.id = a.user_id
join public.subjects s on s.id = a.subject_id
where a.expires_at > now()
order by a.expires_at asc;

-- Accès expirés
select email, expires_at
from public.profiles
where status = 'active' and expires_at <= now();

-- Demandes en attente et reçus
select ar.id, p.first_name, p.last_name, p.email,
       ar.type, ar.receipt_path, ar.created_at
from public.access_requests ar
join public.profiles p on p.id = ar.user_id
where ar.status = 'pending'
order by ar.created_at;

-- Vérifier qu'un étudiant ne peut pas lire les corrigés directement
-- (à exécuter dans le SQL Editor en simulant un JWT étudiant,
-- ou via le client avec la clé anon et une session étudiante)
select * from public.questions limit 1; -- doit renvoyer 0 ligne ou une erreur
```

---

## 11. Sécurité, conformité et limites

Avant une mise en production réelle :

- activer la confirmation email, une politique de mot de passe et la limitation des tentatives de connexion ;
- ajouter un rate limit sur les RPC (Edge Function / Upstash / Cloudflare) ;
- journaliser les validations et refus (qui, quand, quel reçu) ;
- chiffrer et purger les reçus selon une durée de conservation définie ;
- recueillir le consentement RGPD et prévoir l'export/suppression des données ;
- sauvegarder la base et tester la restauration ;
- vérifier que la clé `service_role` n'est utilisée que dans un environnement serveur ;
- faire relire les explications médicales avant publication ;
- prévoir un vrai flux de paiement si l'objectif est de percevoir des sommes automatiquement (le reçu joint reste une preuve manuelle).

Le schéma est un point de départ solide, pas une certification de conformité. Faites auditer les RLS et le parcours de paiement avant d'accueillir de vrais étudiants.
