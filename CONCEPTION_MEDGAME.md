# MEDGAME — bilan de conception

*(version simple, pour le docteur — 12 novembre 2026)*

---

## 1. L'idée en une phrase

Un chapitre devient **une trajectoire de niveaux de 5 questions** : on les réussit un par un, et le suivant s'ouvre. Un chapitre de 40 questions = **8 niveaux**.

Le mode s'appelle **MEDGAME**. Le jeu s'explique par lui-même : les numéros, les étoiles et les cadenas disent où on en est.

---

## 2. Les règles du jeu

| | |
|---|---|
| **Combien de niveaux ?** | Nombre de questions ÷ 5, arrondi au-dessus. 40 questions → **8 niveaux**. |
| **Le premier niveau** | Ouvert dès le choix du chapitre. |
| **Le suivant** | S'ouvre **seulement si le précédent est réussi à 5/5**. |
| **Le contenu d'un niveau** | **5 questions tirées au hasard dans tout le chapitre**. |
| **Si on refait le niveau** | Nouveau tirage : **on ne rejoue jamais les 5 questions de la tentative précédente**. Une question déjà réussie peut revenir (c'est la révision). |
| **Les étoiles** | **1 étoile par bonne réponse** (3/5 = ★★★). On garde la meilleure tentative. |
| **Raté** | Le niveau suivant reste fermé : on **refait** le niveau. |
| **Rejouer un niveau réussi** | Libre : c'est la révision. Les étoiles montent si on fait mieux, **aucun verrou ne bouge**. |
| **Chapitre terminé** | Tous les niveaux réussis. |

---

## 3. Le parcours de l'étudiant

1. **La page d'accueil MEDGAME** — on choisit son chapitre (le message « Confirmer / Annuler » reste) et un bouton **« Voir mon jeu »** mène au jeu.
2. **Le jeu** — **seulement les chapitres choisis**. Chaque chapitre montre sa rangée de **blocs de niveaux** : on clique un bloc, le niveau s'ouvre. On peut aussi cliquer le nom du chapitre pour voir tous ses niveaux.
3. **La page du chapitre** — la **carte des niveaux** : les cadres sont grands, on voit les réussis (coche), l'ouvert et les verrouillés (cadenas). On clique un cadre → le niveau.
4. **Le niveau** — les **5 questions d'affilée, sans correction** (comme les séries de 30 questions). On répond aux 5, puis on clique **« Soumettre le niveau »**.
5. **Le bilan** — le verdict (réussi ou à refaire) avec les étoiles, puis les **corrections question par question** : ta réponse en vert si juste, en rouge si faux ; la bonne réponse toujours en vert ; l'explication en dessous. Puis « Rejouer le niveau ».

---

## 4. Ce qui change, ce qui reste

**Disparaît**
- l'onglet **Historique** (les questions vues ne sont plus affichées) ;
- le compteur « Nouvelles », le compteur « À réviser », le bouton « Réviser (N) », la page « Réviser » ;
- le badge « Niveau X » (le nombre de bonnes réponses) : le niveau est désormais une étape du jeu ;
- le bloc de 5 questions qui se renouvelle tout seul ;
- le long texte « Comment ça marche » de la page d'accueil (le jeu se lit sur les cadres).

**Ne change pas**
- le mois de ticket (1 mois à partir de la première connexion) ;
- le maximum de 5 chapitres ;
- tout le mode « 30 séries » ;
- **le portail du docteur n'est pas touché** : les tickets Anki restent des tickets Anki, rien n'y change.

**Pour les étudiants qui ont déjà commencé** : leur historique est conservé, mais **tout le monde repart au niveau 1** (les niveaux n'existaient pas avant, il n'y a rien à convertir).

---

## 5. L'habillage

Le mode devient un jeu, mais **dans la charte du projet** : mêmes couleurs (vert, blanc, fond clair), mêmes polices (Serif pour les titres, Inter pour le texte), mêmes formes arrondies. Seul ajout : **l'or, réservé aux étoiles**.

Pas de confettis, pas de trophées, pas de sons, pas de cartes flottantes : les niveaux forment une **trajectoire continue**, pas une grille de cases.

---

## 6. Les limites connues

- Un chapitre de moins de 5 questions = un seul niveau, plus court.
- Couper internet au moment de « Soumettre » → message d'erreur, rien n'est enregistré, on réessaie.
- Quitter la page en plein niveau → rien n'est enregistré, on rejoue.
- La correction se fait **côté serveur** : on ne peut pas tricher sur les étoiles.

---

## 7. Les étapes

1. La mécanique en base de données (niveaux, étoiles, déblocage).
2. Les écrans (carte des niveaux, le niveau, le bilan).
3. Le tableau de bord MEDGAME et la page d'accueil (nom MEDGAME, « Voir mon jeu », suppression de l'historique).
4. Les vérifications et la mise en ligne.

La spécification technique détaillée est dans `docs/superpowers/specs/2026-11-12-medgame-design.md`.
