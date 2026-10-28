# Déploiement Supabase + Vercel

## État actuel

L’application utilise **Supabase Auth, Postgres et Storage** dès que
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définies. Sans ces variables,
elle retombe sur le stockage local de démonstration.

- Étudiants : <https://medecineqcm.vercel.app>
- Docteur : <https://docteur-sun.vercel.app>
- Projet Supabase : `ttoqcvlharxoyazvgcca`, région Paris (`cdg1`), plan gratuit.
- Compte docteur : `razafimandimby222@gmail.com` (mot de passe dans
  `.secrets/doctor-credentials.txt`, jamais commité).
- Catalogue : **neuf thèmes PACES**, publiés ensemble par le docteur. Chaque
  thème contient au moins 10 questions à une seule bonne réponse.

> Le modèle à neuf thèmes n’a pas encore été appliqué au projet de production.
> Le fichier [`schema.sql`](./schema.sql) doit être exécuté avant de déployer le
> frontend correspondant. Aucune migration SQL n’est lancée automatiquement.

Les deux domaines Vercel sont reliés au même dépôt GitHub et se redéploient à
chaque push sur `main`. Le domaine étudiant est l’origine par défaut ; tout
domaine commençant par `docteur-`, `docteur.`, `sun-`, `sun.`, `prof.` ou
`admin.` ouvre le portail docteur.

## Variables d’environnement

À définir dans **les deux** projets Vercel (Production, Preview et Development) :

```text
VITE_SUPABASE_URL=https://ttoqcvlharxoyazvgcca.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon publique>
```

Pour les emails transactionnels, ajouter dans **les deux** projets, en
**Production** au minimum :

```text
SMTP_USER=razafimandimby222@gmail.com
SMTP_PASS=<mot de passe d'application Google>
DOCTOR_EMAIL=razafimandimby222@gmail.com
STUDENT_APP_URL=https://medecineqcm.vercel.app
DOCTOR_APP_URL=https://docteur-sun.vercel.app
```

`SMTP_PASS` est un secret Vercel : il n'est jamais visible dans le dashboard ni
récupérable par `vercel env pull`. Utiliser un mot de passe d'application Google
(compte Google avec validation en deux étapes), jamais le mot de passe du compte.
Les variables sans préfixe `VITE_` ne sont lues que par la fonction serveur
`api/notify.mjs`.

`.env.example` sert de modèle. Ne jamais exposer ni commiter :

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- les URL Postgres et leurs mots de passe

La clé `anon` est publique par conception ; la sécurité des données repose sur
les politiques RLS et les fonctions RPC.

## Base de données

Le schéma complet est dans [`schema.sql`](./schema.sql). Pour un nouveau projet,
exécuter le fichier entier dans le SQL Editor. Sur le projet existant, le fichier
est idempotent pour les sections ajoutées : colonne `subject_assignments.subject_id`
nullable, colonnes historiques de `access_requests`, colonne
`attempts.question_snapshot`, RPC `publish_theme_pack`, nouvelles signatures de
`start_quiz`/`submit_attempt`, quota de 30 séries, RLS et corrigé limités au
cycle courant. Il crée :

- `profiles`, `access_requests`, `subjects`, `subject_assignments`,
  `questions`, `attempts` ;
- les policies RLS ;
- le bucket privé `receipts` (3 Mo) ;
- les RPC `start_quiz`, `submit_attempt`, `get_attempt_review`,
  `approve_access_request`, `reject_access_request`, `publish_theme_pack`,
  `revoke_access`, `extend_access` ;
- les RPC historiques `publish_subject`, `remove_subject` et
  `assign_subject_to_student`, conservées pour compatibilité mais absentes de
  l’interface docteur.

### Cycles, thèmes et quota

Un cycle est une ligne de `subject_assignments` :

- `subject_id` est **nul** pour les nouveaux cycles : aucun thème n’est imposé,
  l’étudiant choisit librement parmi les neuf thèmes publiés ;
- `started_at` ouvre le cycle, `expires_at` le ferme après 30 jours ;
- le docteur peut prolonger un cycle actif avec `extend_access` : la date de fin
  recule et le compteur de séries **n’est pas** remis à zéro ;
- sans cycle actif, `extend_access` ouvre un nouveau cycle complet, sans thème.

À la validation d’une demande initiale ou d’un renouvellement,
`approve_access_request` crée immédiatement un cycle sans thème et remet le
compteur à zéro. Un renouvellement peut clore un cycle encore actif uniquement
lorsque l’étudiant a déjà soumis ses 30 séries ; sinon la validation est refusée.

Le quota est de **30 séries soumises par cycle**, à 10 questions chacune :

- une série abandonnée avant soumission ne compte pas ;
- `start_quiz` et `submit_attempt` refusent le 31e envoi avec le code
  `SERIES_LIMIT_REACHED` ;
- l’échéance des 30 jours reste une contrainte indépendante ;
- `submit_attempt` verrouille la ligne du profil pour sérialiser deux envois
  concurrents et ne jamais dépasser 30.

L’historique étudiant est limité au cycle courant. Les tentatives des cycles
précédents restent en base pour l’audit et la consultation par le docteur : la
policy `attempts_select_own_current_cycle_or_professor` et
`get_attempt_review` les refusent à l’étudiant (`ATTEMPT_OUT_OF_CYCLE`).

### RPC étudiant

```sql
-- Lancer une série de 10 questions d’un thème choisi.
select public.start_quiz('<subject_id>'::uuid, 10);

-- Soumettre les réponses ; le score est calculé côté Postgres.
select public.submit_attempt(
  '<subject_id>'::uuid,
  array['<question_id>'::uuid, ...],
  '{"<question_id>": ["A"], ...}'::jsonb
);

-- Relire le corrigé d’une tentative du cycle courant.
select public.get_attempt_review('<attempt_id>'::uuid);
```

`start_quiz` renvoie les énoncés **sans** `correct_answers` ni explication. Il
refuse un thème inconnu (`THEME_NOT_FOUND`) ou contenant moins de 10 questions à
une seule bonne réponse (`THEME_UNAVAILABLE`). `submit_attempt` exige exactement
10 questions distinctes du thème, une seule lettre A-D par réponse, et fige le
corrigé dans `attempts.question_snapshot` : modifier le pack plus tard ne change
ni les scores ni les corrections déjà consultées.

### Publication du pack des neuf thèmes

L’interface docteur n’accepte plus qu’**un seul classeur `.xlsx`** contenant une
feuille par thème. Le modèle téléchargeable (`MEDQCM-modele-9-themes.xlsx`) et
l’import utilisent les colonnes suivantes, dans chaque feuille :

| Colonne | Contenu |
| --- | --- |
| `N° Question` | entier unique dans la feuille, à partir de 1 |
| `Énoncé` | texte non vide |
| `Option A` … `Option D` | quatre propositions non vides |
| `Réponse exacte` | une seule lettre `A`, `B`, `C` ou `D` |
| `Explication médicale` | texte non vide |

Les feuilles sont reconnues de façon souple : titre complet, nom abrégé du
modèle (limité à 31 caractères par Excel), accents et ponctuation ignorés,
préfixe `Thème 1 —` toléré. Chaque thème doit être présent **exactement une
fois**, avec **au moins 10 questions valides**. Un seul problème bloque tout le
pack : rien n’est écrit, aucun thème n’est partiellement remplacé.

La publication appelle `publish_theme_pack(p_pack jsonb)`. Le tableau doit
contenir exactement les neuf titres officiels :

1. Biologie cellulaire S1 et S2
2. Étude des tissus S1 et S2
3. Structure et fonction des biomolécules
4. Physiologie S1 et S2
5. Anatomie viscérale
6. Biomathématiques, Biophysique, Statistiques
7. Initiation à la connaissance des médicaments
8. Français médical
9. Unités d’enseignements spécifiques

Chaque entrée porte `title`, `description`, `monthLabel` et `questions`
(`number`, `matiere`, `statement`, `options`, `correctAnswers`, `explanation`).
La fonction valide tout le pack, puis, dans une seule transaction :

- crée le sujet du thème s’il n’existe pas, sinon le met à jour ;
- remplace les questions du thème et met à jour `question_count` ;
- archive les anciens sujets hors pack au lieu de les supprimer, afin de
  préserver l’historique des tentatives ;
- renvoie les identifiants publiés et la date de publication.

Un pack invalide lève `INVALID_THEME_PACK` et la transaction est annulée.

## Emails transactionnels

La fonction [`api/notify.mjs`](../api/notify.mjs) envoie deux emails :

1. **Nouvelle demande** — après le dépôt du reçu, le docteur reçoit un email
   avec le nom, l'email, la date et un lien signé vers le reçu (7 jours). Le
   bouton ouvre directement le dossier dans l'espace docteur.
2. **Accès activé** — après validation (ou attribution manuelle), l'étudiant
   reçoit ses dates de cycle, le rappel des neuf thèmes et des 30 séries, et le
   lien de connexion.

La fonction vérifie le jeton Supabase de l'appelant, son rôle et l'appartenance
de la demande. Elle utilise Gmail SMTP (`smtp.gmail.com:465`). Les envois sont
attendus avant la fin de l'action, mais une panne SMTP n'annule jamais
l'inscription ou la validation déjà enregistrée.

Tester après déploiement sur **Production**, car les secrets SMTP ne sont pas
récupérables localement :

1. créer un compte étudiant de test avec un reçu ;
2. vérifier l'email reçu par le docteur ;
3. approuver la demande dans l'espace docteur ;
4. vérifier l'email reçu par l'étudiant ;
5. supprimer le compte, la demande, le reçu et l'essai éventuel.

## Configuration Supabase vérifiée

1. **Confirm email** est désactivé (`mailer_autoconfirm: true`). Le flux
   d’inscription dépose le reçu immédiatement après `signUp` ; sans session, ce
   dépôt serait impossible.
2. Le bucket `receipts` est privé.
3. Le parcours complet a été testé sur l’ancien modèle : inscription, dépôt du
   reçu, validation docteur, démarrage du QCM, soumission et correction. Le
   parcours neuf thèmes doit être revalidé après application du schéma.

Pour un nouveau projet Supabase, refaire ces réglages dans le dashboard :
**Authentication → Sign In / Providers → Email** (désactiver Confirm email),
puis **Authentication → URL Configuration** :

- Site URL : `https://medecineqcm.vercel.app`
- Redirect URLs : `https://medecineqcm.vercel.app/**` et
  `https://docteur-sun.vercel.app/**`

Ces réglages ne sont pas modifiables avec la clé `anon` ni avec les clés du
projet ; ils nécessitent le dashboard Supabase ou un jeton de gestion.

## Créer un professeur

Créer l’utilisateur dans **Authentication → Users**, puis promouvoir son profil
dans le SQL Editor :

```sql
update public.profiles
set role = 'professor',
    status = 'active',
    activated_at = now(),
    expires_at = now() + interval '100 years'
where email = 'professeur@exemple.fr';
```

Aucune interface d’inscription professeur n’existe côté public.

## Commandes locales

```bash
npm install
npm run dev        # frontend Vite
npm run build      # vérification TypeScript + build
npm run server     # API JSON de démonstration (inutile avec Supabase)
```

Pour tester le portail docteur en local : `http://docteur.localhost:5173`.
Pour le portail étudiant : `http://etudiant.localhost:5173`.

La démo locale utilise `localStorage` (`medqcm.db.v3`) et non Supabase. Elle est
préremplie avec les neuf thèmes, 90 questions et un étudiant au quota atteint
pour vérifier le blocage et le renouvellement.

## Sécurité

- Les reçus sont dans un bucket privé et lus via des URL signées.
- Les policies RLS limitent chaque étudiant à ses propres lignes et à son cycle
  courant ; le professeur voit tout.
- Les questions ne sont jamais lisibles directement par un étudiant : les
  corrigés passent uniquement par `start_quiz` et `get_attempt_review`.
- Les fonctions métier sont `security definer` avec `search_path = public`,
  `execute` révoqué pour `public`/`anon` et accordé à `authenticated`.
- Le mot de passe du docteur est conservé dans
  `.secrets/doctor-credentials.txt`, hors dépôt. Le mot de passe actuel a été
  choisi lors de la mise en service et doit être remplacé avant de partager
  l'URL du portail docteur. Puis supprimez ce fichier.
- Ne jamais coller de jeton, mot de passe ou clé `service_role` dans une
  conversation.
