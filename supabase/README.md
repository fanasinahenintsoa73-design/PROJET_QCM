# Déploiement Supabase + Vercel

## État actuel

L’application utilise désormais **Supabase Auth, Postgres et Storage** dès que
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définies. Sans ces variables,
elle retombe sur le stockage local de démonstration.

- Étudiants : <https://medicineqcm.vercel.app>
- Docteur : <https://docteur-sun.vercel.app>
- Projet Supabase : `ttoqcvlharxoyazvgcca`, région Paris (`cdg1`), plan gratuit.
- Compte docteur : `prof@medqcm.fr` (mot de passe généré, voir
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

`.env.example` sert de modèle. Ne jamais exposer ni commiter :

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- les URL Postgres et leurs mots de passe

La clé `anon` est publique par conception ; la sécurité des données repose sur
les politiques RLS et les fonctions RPC.

## Base de données

Le schéma complet est dans [`schema.sql`](./schema.sql). Il a été appliqué au
projet Supabase. Pour un nouveau projet, exécuter le fichier entier dans le SQL
Editor. Il crée :

- `profiles`, `access_requests`, `subjects`, `subject_assignments`,
  `questions`, `attempts` ;
- les policies RLS ;
- le bucket privé `receipts` (3 Mo) ;
- les RPC `start_quiz`, `submit_attempt`, `get_attempt_review`,
  `approve_access_request`, `reject_access_request`, `publish_subject`,
  `remove_subject`, `assign_subject_to_student`, `revoke_access`,
  `extend_access`.

Les corrigés ne sont jamais envoyés avant la soumission : `start_quiz` renvoie
les énoncés sans `correct_answers`, et le score est calculé côté Postgres.

## Étapes manuelles restantes dans Supabase

1. **Authentication → Sign In / Providers → Email** : désactiver
   **Confirm email**, puis enregistrer. Le flux d’inscription actuel dépose le
   reçu immédiatement après `signUp` ; sans session, ce dépôt est impossible.
2. **Authentication → URL Configuration** :
   - Site URL : `https://medicineqcm.vercel.app`
   - Redirect URLs : `https://medicineqcm.vercel.app/**` et
     `https://docteur-sun.vercel.app/**`
3. Vérifier que le bucket `receipts` est bien **privé**.

Ces deux réglages ne sont pas modifiables avec la clé `anon` ni avec les clés
du projet ; ils nécessitent le dashboard Supabase ou un jeton de gestion.

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
- Le mot de passe du docteur doit être changé après la première connexion.
- Ne jamais coller de jeton, mot de passe ou clé `service_role` dans une
  conversation.
