# MEDQCM — Anki en jeu : les niveaux (spécification de conception)

Date : 12 novembre 2026
Statut : à valider par le docteur avant passage au plan d'implémentation
Remplace la conception « 2 états / bloc de 5 roulant » (migration `20261111_anki_two_states.sql`)

---

## 1. Pourquoi ce changement

Le mode Anki actuel repose sur deux compteurs (« Nouvelles » / « À réviser ») et un bloc de 5 questions qui se renouvelle tout seul. C'est correct mais opaque : l'étudiant ne voit pas de progression, il ne sait pas ce qu'il a acquis ni ce qui lui reste.

La nouvelle conception transforme le chapitre en **une trajectoire de niveaux de 5 questions**, façon jeu :

- un chapitre de 40 questions = **8 niveaux** ;
- le **niveau 1 est ouvert**, les suivants sont **verrouillés** ;
- on ne passe au niveau suivant que si les **5 questions du niveau sont réussies** ;
- un niveau raté se **refait** (nouveau tirage) ;
- chaque niveau réussi affiche des **étoiles** (1 étoile par bonne réponse, 5 étoiles pour 5/5) ;
- rejouer un niveau réussi = **réviser librement** (les étoiles se mettent à jour si c'est mieux, aucun verrou ne bouge).

Objectif produit : donner au ticket Anki la même sensation de progression que les 30 séries (niveau atteint, score, faux à revoir), mais avec la répétition espacée propre à Anki.

---

## 2. Règles de jeu (le cœur du produit)

### 2.1 Les niveaux

| Règle | Valeur |
|---|---|
| Nombre de niveaux d'un chapitre | `⌈nombre_questions / 5⌉` (40 questions → 8 niveaux) |
| Niveau 1 | ouvert dès que l'étudiant a choisi le chapitre |
| Niveau N déverrouillé | si et seulement si le niveau N-1 est **réussi** (5/5) |
| Contenu d'un niveau | **5 questions tirées au hasard dans tout le chapitre** (tirage sans contrainte : une question déjà réussie peut revenir — c'est la révision intégrée) |
| Réussite d'un niveau | 5 bonnes réponses sur 5 dans une même tentative |
| Étoiles | 1 par bonne réponse (0 à 5) ; on conserve **la meilleure tentative** du niveau |
| Rater un niveau | le niveau suivant reste verrouillé ; l'étudiant rejoue le même niveau (nouveau tirage) |
| Chapitre terminé | tous les niveaux du chapitre sont réussis (5/5) |

Aucun niveau n'est « consommé » : le contenu étant tiré au hasard, on peut rejouer autant de fois que nécessaire.

### 2.2 Ce que le niveau remplace

- Le bloc de 5 roulant, le compteur « Nouvelles », le compteur « À réviser », le bouton « Réviser (N) » et la route `/app/anki/:chapterId/reviser` **disparaissent**.
- Le badge « Niveau X » (niveau = 1 + nombre de bonnes réponses) disparaît : le niveau est désormais un **niveau du jeu**, plus un score.
- Le mois de ticket (1 mois depuis le lancement), le maximum de 5 chapitres et l'onglet Historique (questions vues, avec le nombre de fois raté) **ne changent pas**.

### 2.3 Deux notions à ne pas confondre

- **Niveau** (nouveau) : une étape du chapitre, 5 questions, débloquée par la réussite de la précédente.
- **Note / étoiles** : la performance sur un niveau (0 à 5 étoiles), affichée mais **pas utilisée pour déverrouiller** (seul le 5/5 déverrouille).

---

## 3. Le parcours de l'étudiant

```
Tableau de bord (/app)
   └─ carte du chapitre : UE + nom + rangée de pastilles de niveaux + étoiles + « Jouer le niveau N »
        └─ Carte des niveaux (/app/anki/:chapterId) : trajectoire de nœuds, un par niveau
             └─ Le niveau (/app/anki/:chapterId/niveau/:n) : 5 questions, sans correction
                  └─ Le bilan (/app/anki/:chapterId/niveau/:n/bilan) : verdict + corrections
```

### 3.1 Tableau de bord — la carte du chapitre

- UE en petites capitales au-dessus du nom du chapitre (comme aujourd'hui).
- **Rangée de pastilles** : une pastille par niveau (8 pour 40 questions). Pastille pleine et numérotée = réussi ; pastille cerclée = ouvert ; pastille grisée = verrouillé.
- **Étoiles totales** du chapitre (somme des meilleures étoiles) et mention « X / Y niveaux ».
- Action principale : **« Jouer le niveau N »** où N = premier niveau ni réussi ni verrouillé.
- Lien secondaire (texte) : « Carte des niveaux ».
- Disparition des deux compteurs « Nouvelles » / « À réviser ».

### 3.2 La carte des niveaux

Trajectoire **verticale continue** (pas une grille de cartes détachées) : les niveaux s'enchaînent le long d'un rail, ce qui donne l'impression d'une progression et non d'une liste.

Chaque nœud montre : son numéro, son état (réussi / ouvert / verrouillé) et ses étoiles.

- Nœud réussi : coche verte + étoiles obtenues.
- Nœud ouvert : anneau accent + halo vert.
- Nœud verrouillé : cadenas, grisé.
- Action principale : « Jouer le niveau N ».
- Action secondaire : « Réviser : rejouer un niveau » (ouvre la liste des niveaux réussis pour en rejouer un librement).

### 3.3 Le niveau (5 questions, sans correction)

Fonctionne comme les séries de 30 questions : on répond aux 5 d'affilée, **sans** feedback intermédiaire.

- Une question à la fois, options A→E, pas d'indice et pas de « Afficher la réponse ».
- Barre de progression : les 5 pastilles de questions, puis « 3 / 5 » et un compteur « Question 3 sur 5 ».
- Bouton principal désactivé tant que les 5 questions ne sont pas répondues : **« Soumettre le niveau »**.
- Le bouton **retour** du navigateur est intercepté : on demande confirmation (« Tu quittes le niveau ? Tes réponses ne seront pas enregistrées. »).

### 3.4 Le bilan du niveau

Verdict en haut, corrections en dessous.

- **5/5** : « Félicitations ! » + 5 étoiles + « Niveau 4 débloqué » (ou « Chapitre terminé ! » pour le dernier niveau).
- **Moins de 5/5** : « 3 étoiles · À refaire » + « Il te faut 5 bonnes réponses pour débloquer le niveau 4. »
- Puis, pour les 5 questions, un bloc par question : **question / ta réponse / réponse correcte / explication** (format déjà utilisé par l'historique et par le bilan des séries).
- Actions : « Rejouer le niveau » (principal) et « Carte des niveaux » (secondaire, en texte).

---

## 4. Direction visuelle

Le mode Anki devient un **jeu**, mais dans le monde visuel du projet (contrainte `DESIGN.md` + skill `impeccable`).

**Garder** : fond `canvas #F5F7F3`, surfaces blanches, lignes `#D7DED8`, texte `ink #15201B`, accent vert `#0B6B4F` (accent-soft `#E4F0EA`, accent-deep `#084C39`), display **Source Serif 4**, UI **Inter**, rayons 18/26 px, aucune carte noire, aucune barre noire, une seule action principale par écran.

**Ajouter** :
- une couleur réservée aux étoiles (or `#B98A2E`) — le seul or de l'interface ;
- des pastilles de niveaux (carrés 8-10 px) ;
- un halo discret sur le niveau ouvert.

**Interdits** (règles du projet + skill `impeccable`) :
- pas de grille de cartes flottantes pour les niveaux (on veut une trajectoire, pas des îlots) ;
- pas de redondance (n'afficher les étoiles qu'une fois par écran) ;
- pas de confettis, pas de badges « trophée », pas d'or doré brillant, pas d'animation autre que les transitions de 150–250 ms (déverrouillage, remplissage des étoiles) ;
- pas de son.

---

## 5. Données

### 5.1 Nouvelle table

```sql
create table if not exists public.anki_level_progress (
  ticket_code  text    not null references public.tickets(code) on delete cascade,
  chapter_id   text    not null,
  level        integer not null,
  best_stars   smallint not null default 0,
  attempts     integer not null default 0,
  passed_at    timestamptz,
  primary key (ticket_code, chapter_id, level)
);
```

- `level` = numéro du niveau (1 → N).
- `best_stars` = meilleure tentative (0 à 5).
- `passed_at` non nul ⇔ niveau réussi (5/5) ⇒ **le niveau suivant est déverrouillé**.

### 5.2 Trois nouvelles fonctions SQL (`security definer`, filtrées sur le ticket de `auth.uid()`)

| Fonction | Entrées | Sortie | Rôle |
|---|---|---|---|
| `anki_levels(p_chapter_id text)` | chapitre | `level int, total_levels int, status text, best_stars int, attempts int, passed_at timestamptz` | état de la trajectoire : `passed` / `unlocked` / `locked` |
| `anki_level_questions(p_chapter_id text, p_level int)` | chapitre, niveau | 5 questions (énoncé, options, réponse, explication) | tirage aléatoire dans tout le chapitre |
| `anki_record_level(p_chapter_id text, p_level int, p_answers jsonb)` | chapitre, niveau, réponses | `stars int, correct int, total int, passed bool, next_unlocked bool, best_stars int, total_levels int` | enregistre la tentative, met à jour étoiles/tentatives, déverrouille |

Contraintes :
- `anki_levels` : `total_levels = ceil(nb_questions_chapitre / 5)` ; `status = 'passed'` si `passed_at` non nul ; `'unlocked'` si niveau 1 ou niveau précédent passé ; sinon `'locked'`.
- `anki_record_level` : `best_stars = greatest(best_stars, stars)` ; `passed_at = now()` si `stars = 5` ; incrémente `attempts` ; n'écrit **jamais** sur un niveau verrouillé (erreur « Ce niveau est verrouillé »).
- Le tirage des 5 questions est **sans doublon** ; si le chapitre a moins de 5 questions, le niveau en contient moins.

### 5.3 Historique des questions (inchangé)

Le bilan d'un niveau alimente la même table `anki_history` / `anki_review_cards` que l'historique actuel, pour que :
- l'onglet **Historique** du tableau de bord reste identique (1 bloc par chapitre, en-tête « N questions · M fois ratée(s) », une question = un bloc Question/Réponse/Explication) ;
- la vue du docteur (nombre de questions vues, « fois ratée ») reste alimentée.

L'ancien moteur par question (`anki_question_progress.state`) **n'est plus utilisé pour l'affichage** : les compteurs « Nouvelles / À réviser » disparaissent. Les lignes existantes sont conservées (aucune perte d'historique).

### 5.4 Portail docteur

La progression d'un ticket Anki passe de « chapitres / questions vues » à **« niveaux réussis / total niveaux »** :
`En cours · 2/8` (niveaux réussis sur total). Un ticket dont tous les niveaux sont réussis affiche `Terminé`.

---

## 6. Migration des étudiants en cours

- Les données existantes (historique, questions vues, cartes) sont **conservées**.
- Les niveaux démarrent **vides** : tout le monde repart au **niveau 1** de chaque chapitre choisi. C'est le choix le plus simple et le plus juste (la progression par niveaux n'a pas d'historique antérieur) ; il n'y a pas de conversion automatique possible.
- Les étudiants qui n'ont jamais lancé leur ticket ne sont pas affectés.

---

## 7. Textes « Comment ça marche » (page d'accueil)

Réécriture complète, dans le même format court que l'existant (un principe + 4 étapes + 2 encadrés + les états + un exemple + le niveau + le résultat) :

- **Principe** : « Un chapitre = des niveaux de 5 questions. Tu les réussis, tu passes au niveau suivant. »
- **Choisis** : « Un chapitre, dans l'UE que tu veux. 5 chapitres maximum. »
- **Joue** : « 5 questions à la fois, tirées au hasard dans le chapitre. Tu réponds aux 5, puis tu soumets. »
- **Réussis** : « 5 bonnes réponses : le niveau suivant se débloque. Sinon, tu refais le niveau. »
- **Révise** : « Un niveau réussi se rejoue quand tu veux : c'est ta révision. »
- **Encadré « Soumettre »** : « Tu réponds aux 5 questions, puis tu soumets : le bilan arrive avec les corrections. »
- **Encadré « Rejouer »** : « Un niveau réussi se rejoue librement. Tes étoiles s'améliorent si tu fais mieux. »
- **États** : « Ouvert · le premier niveau est libre » / « Verrouillé · il s'ouvre quand le précédent est réussi » / « Réussi · 5/5, le suivant s'ouvre ».
- **Exemple** : « Tu rates 1 question au niveau 2 : 4 étoiles, le niveau 3 reste verrouillé. Tu rejoues, tu fais 5/5 : le niveau 3 s'ouvre. »
- **Résultat** : « Le chapitre se termine quand tous les niveaux sont réussis. Ensuite tu peux rejouer n'importe quel niveau pour réviser. »

Les textes sont validés avant d'être écrits dans le code.

---

## 8. Cas limites et erreurs

| Situation | Comportement |
|---|---|
| Chapitre sans questions | aucun niveau, message « Ce chapitre n'a pas encore de questions. » |
| Chapitre avec moins de 5 questions | un seul niveau, plus court que 5 |
| Réponse réseau coupée pendant la soumission | message d'erreur + « Réessayer » ; le niveau n'est pas validé |
| L'étudiant quitte la page en plein niveau | rien n'est enregistré ; il rejoue le niveau |
| Deux onglets ouverts sur le même niveau | `best_stars = max(...)`, aucun conflit |
| Ticket Anki expiré | navigation bloquée avec « Ton ticket Anki a expiré. Contacte le docteur. » |
| Niveau rejoué après réussite | étoiles mises à jour si meilleures, **aucun** verrou modifié |

---

## 9. Ce qui change dans le code (pour le plan)

**Base (migration `supabase/migrations/20261112_anki_levels.sql`)** : table `anki_level_progress`, 3 RPC, ajustement de `anki_chapters()` (retour des niveaux), extension de `anki_record_answer` (alimenter l'historique depuis un bilan de niveau).

**Front** :
- `src/types.ts` : `AnkiLevel`, `AnkiLevelState`, `AnkiLevelResult`.
- `src/lib/api.ts`, `src/lib/supabaseData.ts` : 3 nouvelles fonctions ; le moteur démo `src/lib/db.ts` doit refléter le même modèle (clé de stockage `medqcm.anki.v3`).
- `src/App.tsx` : routes `/app/anki/:chapterId` (carte des niveaux), `/app/anki/:chapterId/niveau/:level` (niveau), `/app/anki/:chapterId/niveau/:level/bilan` (bilan) ; suppression de `/app/anki/:chapterId/reviser`.
- `src/components/anki/AnkiDashboard.tsx` : nouvelle carte chapitre (rangée de niveaux, étoiles, « Jouer le niveau N ») ; suppression des compteurs Nouvelles/À réviser et du bouton « Réviser (N) ».
- Nouveaux composants : `src/components/anki/LevelMap.tsx`, `src/components/anki/LevelRunner.tsx`, `src/components/anki/LevelBilan.tsx`.
- `src/pages/AnkiQuizPage.tsx` : le composant `mode: 'revision'` devient inutile → à supprimer ou à repurposer en niveau unique.
- `src/pages/AnkiHomePage.tsx` : textes « Comment ça marche » (section 7).
- `src/pages/admin/AdminTicketsPage.tsx` : progression Anki en « niveaux réussis / total ».

**Ordre de livraison** : migration SQL (appliquée en prod) → couche de données → écrans (carte des niveaux, niveau, bilan) → tableau de bord → textes → vérifs → commit/push → APK (optionnel).

---

## 10. Vérifications attendues

1. Niveau 1 : 3/5 → pas de déblocage, 3 étoiles, rejouer possible.
2. Rejouer niveau 1 : 5/5 → niveau 2 déverrouillé, 5 étoiles conservées.
3. Niveau 2 : 4/5 → niveau 3 **toujours verrouillé**, 4 étoiles.
4. Après rechargement de page : niveaux, étoiles et verrous conservés.
5. Rejouer un niveau réussi : les étoiles montent si c'est mieux, aucun verrou ne saute.
6. Les 8 niveaux d'un chapitre de 40 questions s'affichent, et le dernier niveau clôt le chapitre.
7. L'historique continue d'alimenter l'onglet Historique (questions vues, fois ratées).
8. Le portail docteur affiche « En cours · X/Y » en niveaux.
9. Rendu mobile 360 px : la trajectoire de niveaux reste lisible.
