# MEDQCM L1

Application d'entraînement QCM pour la 1ʳᵉ année de médecine. Un sujet par cycle,
des séries de 10 questions tirées au sort, correction après envoi, 30 jours d'accès. Le docteur
valide les dossiers et publie les sujets.

- **Étudiants** : <https://medicineqcm.vercel.app>
- **Docteur** : <https://docteur-sun.vercel.app>

Les deux portails partagent la même base Supabase mais restent deux origines
séparées : aucune navigation de l'un vers l'autre.

## Parcours

1. L'étudiant crée son compte, joint son reçu de paiement et envoie sa demande.
2. Le docteur reçoit un email, ouvre le reçu et valide le dossier.
3. L'étudiant reçoit un email d'activation avec ses dates et son sujet.
4. Il travaille le sujet pendant 30 jours, en séries de 10 questions.
5. Le score et le corrigé ne sont disponibles qu'après l'envoi de la série.

## Stack

- React 18, TypeScript, Vite 6, Tailwind CSS
- Supabase : Auth, Postgres, RLS, Storage privé, fonctions RPC
- Vercel : hébergement des deux portails et fonction `api/notify.mjs`
- Gmail SMTP via `nodemailer` pour les emails transactionnels

Le schéma complet, les policies RLS et les instructions de déploiement sont dans
[`supabase/README.md`](./supabase/README.md) et
[`supabase/schema.sql`](./supabase/schema.sql).

## Développement local

Prérequis : Node.js 18+ et npm.

```bash
npm install
npm run dev
```

Ouvrir <http://localhost:5173>. Pour tester les deux portails :

- étudiant : <http://etudiant.localhost:5173>
- docteur : <http://docteur.localhost:5173>

Sans variables Supabase, l'application bascule sur un stockage local de
démonstration. Comptes de démo :

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Docteur | `prof@medqcm.fr` | `prof1234` |
| Étudiant | `jean.dupont@email.com` | `etudiant1234` |

Commandes :

```bash
npm run build     # vérification TypeScript + build de production
npm run lint      # vérification TypeScript seule
npm run preview   # prévisualiser le build
npm run server    # API JSON locale de démonstration
```

## Variables d'environnement

Copier `.env.example` vers `.env.local`. Seules les variables `VITE_` sont
exposées au navigateur :

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Les emails utilisent des variables **serveur**, à définir dans Vercel, jamais
avec un préfixe `VITE_` :

```text
SMTP_USER=...
SMTP_PASS=...
DOCTOR_EMAIL=...
STUDENT_APP_URL=https://medicineqcm.vercel.app
DOCTOR_APP_URL=https://docteur-sun.vercel.app
```

`SMTP_PASS` est un mot de passe d'application Google, pas le mot de passe du
compte. Il reste un secret Vercel et n'est jamais commité.

## Sécurité

- Les reçus sont dans un bucket privé, lus par URL signée.
- Les corrigés ne sont jamais envoyés avant la soumission ; le score est calculé
  côté Postgres.
- Les policies RLS limitent chaque étudiant à ses propres données.
- Le mot de passe du docteur doit être changé avant de partager l'URL publique.
- Ne jamais commiter `.env.local`, `.secrets/`, une clé `service_role`, un mot de
  passe SMTP ou un jeton d'accès.
