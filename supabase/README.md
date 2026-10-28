# Déploiement Supabase + Vercel

## État actuel

L’application utilise désormais **Supabase Auth, Postgres et Storage** dès que
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définies. Sans ces variables,
elle retombe sur le stockage local de démonstration.

- Étudiants : <https://medecineqcm.vercel.app>
- Docteur : <https://docteur-sun.vercel.app>
- Projet Supabase : `ttoqcvlharxoyazvgcca`, région Paris (`cdg1`), plan gratuit.
- Compte docteur : `razafimandimby222@gmail.com` (mot de passe dans
  `.secrets/doctor-credentials.txt`, jamais commité).
- Sujet publié : « Sujet 1 — Fondamentaux & Cardiologie », 32 questions.

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
exécuter le fichier entier dans le SQL Editor. Sur le projet existant, les
sections ajoutées pour le choix du sujet (colonnes de `access_requests`, RPC
`choose_renewal_subject`, policy `subjects_offered_for_choice`) et pour le
corrigé figé (colonne `attempts.question_snapshot`, RPC `submit_attempt` et
`get_attempt_review` mises à jour, validation de `publish_subject`) doivent être
appliquées avant de déployer le frontend. Sur le projet de production, ces
sections ont été appliquées le 28 octobre 2026. Il crée :

- `profiles`, `access_requests`, `subjects`, `subject_assignments`,
  `questions`, `attempts` ;
- les policies RLS ;
- le bucket privé `receipts` (3 Mo) ;
- les RPC `start_quiz`, `submit_attempt`, `get_attempt_review`,
  `approve_access_request`, `choose_renewal_subject`, `reject_access_request`,
  `publish_subject`, `remove_subject`, `assign_subject_to_student`,
  `revoke_access`, `extend_access`.

Lors d’un renouvellement, `approve_access_request` ne crée plus d’affectation :
il enregistre le sujet en cours et le sujet suivant dans `access_requests`, puis
l’étudiant doit appeler `choose_renewal_subject` pour ouvrir son cycle de 30
jours. Le même sujet peut être réaffecté ; l’historique des tentatives est
conservé.

Les corrigés ne sont jamais envoyés avant la soumission : `start_quiz` renvoie
les énoncés sans `correct_answers`, et le score est calculé côté Postgres.

Chaque question est enregistrée avec sa bonne réponse et son explication.
`publish_subject` refuse un sujet si une question n’a pas de corrigé complet.
Au moment de la soumission, `submit_attempt` fige une copie des questions et du
corrigé dans `attempts.question_snapshot` : modifier le sujet plus tard ne change
donc ni les anciens scores ni la correction déjà consultée.

## Emails transactionnels

La fonction [`api/notify.mjs`](../api/notify.mjs) envoie deux emails :

1. **Nouvelle demande** — après le dépôt du reçu, le docteur reçoit un email
   avec le nom, l'email, la date et un lien signé vers le reçu (7 jours). Le
   bouton ouvre directement le dossier dans l'espace docteur.
2. **Accès activé** — après validation (ou attribution manuelle d'un sujet),
   l'étudiant reçoit ses dates de cycle, le titre du sujet et le lien de
   connexion.

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
3. Le parcours complet a été testé sur le projet : inscription, dépôt du reçu,
   validation docteur, démarrage du QCM, soumission et correction. Le compte et
   le reçu de test ont été supprimés.

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

## Sécurité

- Les reçus sont dans un bucket privé et lus via des URL signées.
- Les policies RLS limitent chaque étudiant à ses propres lignes.
- Les fonctions métier sont `security definer` avec `search_path = public`,
  `execute` révoqué pour `public`/`anon` et accordé à `authenticated`.
- Le mot de passe du docteur est conservé dans
  `.secrets/doctor-credentials.txt`, hors dépôt. Le mot de passe actuel a été
  choisi lors de la mise en service et doit être remplacé avant de partager
  l'URL du portail docteur. Puis supprimez ce fichier.
- Ne jamais coller de jeton, mot de passe ou clé `service_role` dans une
  conversation.
