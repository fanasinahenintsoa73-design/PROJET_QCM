# MEDQCM L1 — Design System (light clinical notebook)

Répertoire : `C:\PROJET_QCM` — version locale/démo.

## Intent verbeux (conservé)
> « oui backend partagé mais deux domaine different, et sur le design aussi ameliore car il esont tres moche; faire evc de boutton peu pas plusieurs et exclure le baground noir en couleur; utilise le skill impeccable qui exlure le redondence et aislop; faire l interface très claire »

## Direction visuelle
- **Notion** : carnet clinique léger, papier + encre, aucun fond noir.
- **Fond** : `canvas` `#F5F7F3` (gris très clair) ; surfaces `#FFFFFF` ; lignes `#D7DED8`.
- **Typographie d'affichage** : Source Serif 4 (variable 400/600, self-hosté `public/fonts/`) ; UI : Inter.
- **Accent** : `#0B6B4F` (vert profond clinique) ; pas de noir excepté le texte `ink` `#15201B`.
- **Formes** : `rounded-md2` (`18px`) / `rounded-lg2` (`26px`) / pill ; pas de cartes noires, pas de barre noire.
- **Actions** : une seule action principale par écran ; boutons secondaires en texte avec soulignement ; pas de duplicatas d'appel.

## Composants clés
- **Button** : primaire `bg-accent`, secondaire blanc/bordure, ghost, danger, lien (`ButtonLink`).
- **Logo** : carré vert `#0B6B4F` avec plus blanc + serif MEDQCM ; variantes dark/compact.
- **StatusPill** : fond doux (`accent-soft`, `danger-soft`) + point coloré ; pas d'uppercase.
- **Modal / Toast** : fond `bg-surface` + bordure `line` + ombre douce ; overlay `bk-ink/30` (uniquement le voile, pas le panneau).
- **Formulaire** : champ blanc 50 px, bordure `line`, focus vert, erreur `danger-soft`.

## Deux domaines, pas d'interface partagée
- **Étudiant** : host `etudiant.*` → routes `/`, `/inscription`, `/connexion`, `/app`…
- **Docteur** : host `docteur.*` → `/`, `/admin`…
- **Session** : origin-scoped (`localStorage` par domaine) ; pas de navigation croisée entre domaines.
- **Login docteur** : identité visible **Dr Sun RAZAFIMANDIMBY** + **Docteur · Espace praticien**.

## Données (démo seulement)
- Backend : `server/index.mjs` sur `127.0.0.1:3001` ; stockage `server/data/db.json` ; sync client `startSync()` (polling 4 s, push 450 ms).
- **Sécurité** : démo stocke mots de passe en clair + reçus. Production doit utiliser `supabase/schema.sql` (Auth, RLS, Storage bucket privé) — **non connecté à ce jour**.

## Décisions retenues
- Un sujet actif par étudiant ; cycle 30 jours ; renouvellement : sujet jamais assigné le plus ancien, non archivé.
- QCM : checklist, scoring exact-match, correction après soumission uniquement.
- Réception : photo/PDF, 3 Mo, validation manuelle du docteur.
- Design : Impeccable appliqué (pas de redondance, pas de faux texte, pas d'images de stock).

## Vérifications faites
- `npm run build` OK (tsc + Vite 6.4.5).
- `curl /api/health` OK.
- Détecteur Impeccable : `[]` sur Landing/Dashboard/Pending/Signup/Quiz.
- Desktop/mobile screenshots reviewés : pas de fond noir, hiérarchie claire.

## Prochaines étapes (hors ce fichier)
1. Migration Supabase (`supabase/schema.sql`) avant production.
2. Nettoyage final `RenewalPage`/admin si nécessaire (couleurs remplaçées, mais disposition ancienne peut rester).
3. Déployer sur des domaines réels (`etudiant.*`, `docteur.*`) avec HTTPS.
