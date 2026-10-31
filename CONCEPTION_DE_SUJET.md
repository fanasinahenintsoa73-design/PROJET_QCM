# Conception — UE, chapitres et sujets

**Version :** 2.0  
**Date :** 31 octobre 2026  
**Statut :** conception validée et implémentée  
**Portée :** espace étudiant, espace docteur, données Supabase et mode démonstration

---

## 1. Objectif

Organiser les QCM selon trois niveaux :

1. **UE** — unité d'enseignement ;
2. **Chapitre** — subdivision d'une UE ;
3. **Sujet** — un fichier QCM avec son fichier de correction, rattaché à un chapitre.

L'étudiant choisit une UE, coche un ou plusieurs chapitres, puis lance une série de
**10 questions tirées uniquement dans les chapitres cochés**. Les questions des différents
chapitres sont mélangées et une même question ne revient pas deux fois dans la série.

Le quota reste **global** : **30 séries lancées par cycle**, toutes UE et tous chapitres
confondus.

---

## 2. Vocabulaire

| Terme | Définition |
|---|---|
| **UE** | Unité d'enseignement. Les 9 UE sont fixes. |
| **Chapitre** | Subdivision d'une UE. Un chapitre appartient à une seule UE. |
| **Sujet** | Ensemble « fichier QCM + fichier correction » rattaché à un chapitre. Un chapitre peut contenir plusieurs sujets. |
| **Série** | 10 questions distinctes tirées dans les chapitres cochés. |
| **Cycle** | Période de 30 séries lancées. Le renouvellement ouvre un nouveau cycle. |

Le terme **EC** est supprimé du vocabulaire et de l'interface. Il est remplacé par
**chapitre**.

---

## 3. Les 9 UE et leurs chapitres

Les 9 UE sont fixes : aucune UE n'est supprimée et aucune 10e UE n'est créée.

### 3.1 Liste officielle

1. **UE1 — Biologie cellulaire S1 et S2** — 9 chapitres :
   Méthodes d’étude, Membrane biologique, Noyau interphasique, Mitochondrie, Lysosome,
   Cytosquelette, Synthèse protéique (Protéine), Appareil de Golgi, Réticulum endoplasmique.
2. **UE2 — Étude des tissus S1 et S2** — 2 chapitres :
   Épithélium de revêtement, Épithélium glandulaire.
3. **UE3 — Structure et fonction des biomolécules** — 7 chapitres :
   Protides, Chimie, Lipides, Glucides, Enzymes, Coenzymes, Acides Nucléiques.
4. **UE4 — Physiologie S1 et S2** — 10 chapitres :
   Uro-Rénale, Respiratoire, Digestif, Hormonal, Thermorégulation, Cardiaque, Vasculaire,
   Intégratif, Neurophysiologie, Sang.
5. **UE5 — Anatomie viscérale** — 5 chapitres :
   Digestif, Urologie, Système Nerveux, Thorax, Cœur.
6. **UE6 — Biochimie** — 1 chapitre : Biochimie.
7. **UE7 — Initiation à la connaissance des médicaments** — 1 chapitre :
   Initiation à la connaissance des médicaments.
8. **UE8 — Français médical** — 1 chapitre : Français médical.
9. **UE9 — Unités d’enseignements spécifiques** — 5 chapitres :
   Médecine Humaine, Vétérinaire, Pharmacie, Sage-femme, Infirmière.

Total : **41 chapitres** fournis.

### 3.2 Règles de catalogue

- Les chapitres fournis sont conservés exactement tels quels, même lorsqu'un nom est
  identique dans deux UE (par exemple « Digestif » en Anatomie et en Physiologie).
- Aucun dédoublonnage entre UE.
- Des chapitres peuvent être ajoutés plus tard dans une UE sans supprimer l'existant.
- Chaque UE possède au moins un chapitre. Pour les UE6, UE7 et UE8, le chapitre unique
  porte le nom de l'UE et reste sélectionnable comme les autres.
- Les noms des UE sont affichés en entier, avec la numérotation UE1 à UE9 ; aucune
  abréviation n'est utilisée dans l'interface étudiante.
- Les identifiants techniques des UE et des chapitres restent inchangés.

---

## 4. Parcours étudiant

### 4.1 Tableau de bord

Le tableau de bord affiche les **9 UE** sous forme de cartes.

Chaque carte indique :

- le nom de l'UE ;
- sa description ;
- le nombre de chapitres ;
- le nombre de questions disponibles ;
- un lien vers la sélection des chapitres.

Une UE dont les chapitres ne totalisent pas au moins 10 questions est affichée comme
indisponible.

### 4.2 Sélection des chapitres

L'étudiant ouvre une UE puis voit ses chapitres dans l'ordre **alphabétique**.

- Chaque chapitre est une **case à cocher**.
- Il peut sélectionner **un chapitre, plusieurs chapitres ou tous les chapitres** de l'UE.
- Un bouton permet de tout sélectionner ou de tout décocher.
- Le nombre de sujets, de questions et le total sélectionné sont affichés.
- Le bouton **Lancer la série** est désactivé si :
  - aucun chapitre n'est coché ;
  - la sélection contient moins de 10 questions.

Message si aucun chapitre n'est coché :

> Veuillez sélectionner au moins un chapitre avant de lancer la série.

### 4.3 Tirage des questions

- Une série contient exactement **10 questions**.
- Les questions sont tirées **uniquement dans les sujets des chapitres cochés**.
- Les questions des différents chapitres sont **mélangées**.
- Une même question ne peut pas apparaître deux fois dans la même série.
- Entre deux séries, les mêmes questions peuvent réapparaître.
- La sélection ne vaut que pour la série en cours ; elle est refaite avant chaque série.
- Les questions proviennent de **tous les sujets disponibles** des chapitres cochés.

### 4.4 Lancement et reprise

- La série est créée en base dès le clic sur **Lancer la série**, avec le statut
  `in_progress`.
- Un rafraîchissement de la page reprend le brouillon existant au lieu de créer une
  deuxième série.
- La reprise fonctionne même lorsque le quota est déjà à 30/30, puisque la série a déjà
  été comptée.

### 4.5 Sortie d'une série

- Quitter une série compte **1 série**, même si elle est quittée immédiatement.
- Le brouillon passe au statut `abandoned`.
- Les réponses non envoyées ne sont pas corrigées.
- Une confirmation est demandée avant de quitter.

---

## 5. Quota et cycle

- Le quota est **global** : **30 séries**, toutes UE et tous chapitres confondus.
- Toute série **lancée** compte, qu'elle soit terminée ou abandonnée.
- L'ancienne règle « une série quittée après 3 questions ne compte pas » est supprimée.
- À 30/30, le QCM est bloqué.
- Le renouvellement remet le quota à **0/30**.
- Le nouveau cycle possède son propre historique ; l'historique du cycle précédent est
  conservé pour le docteur mais masqué à l'étudiant.
- Les tentatives terminées servent aux statistiques (moyenne, meilleur score, historique).
- Les brouillons et les séries abandonnées comptent dans le quota mais pas dans les
  statistiques de réussite.

---

## 6. Parcours docteur — page « Sujets »

### 6.1 Formulaire d'ajout / modification

Champs, dans cet ordre :

1. **UE** — liste déroulante des 9 UE.
2. **Chapitre** — liste déroulante filtrée selon l'UE, triée alphabétiquement.
3. **Titre du sujet** — libellé libre.
4. **Description** — facultative.
5. **Fichier QCM**.
6. **Fichier correction**.
7. **Bouton Enregistrer**.

Règles d'interface :

- Le chapitre ne peut être choisi qu'après une UE.
- Quand l'UE change, le chapitre sélectionné est réinitialisé.
- Toutes les UE proposent au moins un chapitre ; les UE6, UE7 et UE8 n'en proposent
  qu'un seul, portant le nom de l'UE.
- Plusieurs sujets peuvent être enregistrés dans le même chapitre.
- Le bouton Enregistrer reste désactivé tant que l'UE, le chapitre, le titre et les deux
  fichiers ne sont pas valides.
- Le fichier sélectionné peut être retiré avec l'icône **X**.
- Si un fichier existant est retiré lors d'une modification, l'enregistrement est bloqué
  tant qu'un fichier de remplacement n'est pas fourni.
- Le formulaire ne permet pas d'enregistrer un chapitre qui n'appartient pas à l'UE
  choisie.

### 6.2 Validation à l'enregistrement

Le serveur vérifie :

- que l'UE et le chapitre sont fournis ;
- que le titre est non vide ;
- que le fichier QCM et le fichier correction sont présents ;
- que le QCM contient au moins **10 questions utilisables** ;
- que chaque question possède une seule bonne réponse ;
- que les options sont cohérentes (A à E, sans doublon de lettre) ;
- que la correction correspond aux questions du QCM ;
- que l'identifiant du chapitre est enregistré avec le sujet.

### 6.3 Historique des sujets

L'historique affiche :

- l'**UE** ;
- le **chapitre** ;
- le titre du sujet ;
- la description ;
- le nombre de questions ;
- la date d'enregistrement ;
- les noms des fichiers ;
- l'action **modifier** avec l'icône crayon.

Les anciens sujets sans chapitre restent visibles dans l'historique. Le crayon permet de
les recharger dans le formulaire : le docteur choisit une UE et un chapitre pour les
rattacher, puis enregistre. Leur titre, description, fichiers et questions sont conservés.

---

## 7. Modèle de données

### 7.1 Catalogue

- Les 9 UE et les 41 chapitres sont définis dans `src/lib/themes.ts` (`PACE_THEMES`).
- Les identifiants de chapitre sont stables, par exemple :
  - `anatomie_viscerale__digestif`
  - `physio__cardiaque`
  - `biocel__mitochondrie`
- Un sujet porte `chapter_id` (colonne `subjects.chapter_id`).
- L'UE d'un sujet est déduite de son chapitre via `findThemeForChapter`.
- Plusieurs sujets peuvent partager le même `chapter_id`.

### 7.2 Tentatives

La table `attempts` reçoit :

- `ue_id text` — UE de la série ;
- `chapter_ids text[]` — chapitres cochés ;
- `status text` — `in_progress`, `completed` ou `abandoned` ;
- `completed_at timestamptz` — date de fin ou d'abandon.

`subject_id` reste renseigné avec le sujet de la première question, pour la compatibilité
avec les anciennes tentatives et l'historique.

### 7.3 RPC Supabase

- `start_chapter_quiz(p_ue_id, p_chapter_ids, p_count)` :
  vérifie l'accès et le quota, reprend un brouillon identique, tire les questions,
  crée le brouillon et renvoie les questions sans corrigé.
- `submit_chapter_attempt(p_attempt_id, p_answers)` :
  vérifie le propriétaire et le statut, calcule le score depuis le snapshot, marque la
  série comme terminée.
- `abandon_series(p_attempt_id)` :
  marque un brouillon comme abandonné ; la série reste comptée.
- `save_chapter_subject(...)` :
  crée ou met à jour un sujet rattaché à un chapitre, remplace les questions et renvoie
  le sujet enregistré.
- `get_attempt_review(p_attempt_id)` :
  refuse les brouillons et les séries abandonnées, renvoie UE, chapitres, statut et
  corrigé.

### 7.4 Compatibilité

- Les anciennes tentatives sans `ue_id`, `chapter_ids` ou `status` sont traitées comme
  des tentatives terminées.
- Les anciens sujets sans `chapter_id` restent lisibles.
- Le résultat d'une ancienne tentative utilise le sujet comme libellé de secours.
- Le bouton « Refaire une série » renvoie vers la sélection des chapitres lorsqu'une UE
  est connue ; sinon il conserve l'ancien lien par sujet.

---

## 8. Sécurité et intégrité

- Les questions et leurs corrigés ne sont jamais envoyés au navigateur avant la
  soumission.
- Le score est calculé côté serveur à partir du snapshot.
- Un étudiant ne peut pas soumettre la tentative d'un autre utilisateur.
- Un brouillon ne peut être corrigé qu'une seule fois.
- Les RPC Supabase sont `security definer`, révoquées pour `public` et `anon`, et
  accordées à `authenticated`.
- Le quota est compté côté serveur ; le client ne peut pas le contourner.
- Les anciennes tentatives conservent leur snapshot de questions et de corrigé.

---

## 9. Cas particuliers

| Cas | Comportement |
|---|---|
| UE à chapitre unique (UE6, UE7, UE8) | Le chapitre porte le nom de l'UE et se sélectionne comme les autres. |
| Chapitre sans sujet | Affiché avec 0 question ; il ne peut pas être la seule sélection. |
| Sélection < 10 questions | Bouton désactivé et message. |
| Aucun chapitre coché | Message : « Veuillez sélectionner au moins un chapitre avant de lancer la série. » |
| Chapitre inconnu | Erreur `INVALID_CHAPTER`, retour à la sélection. |
| Série quittée | Statut `abandoned`, 1 série consommée. |
| Rafraîchissement | Reprise du brouillon, pas de nouvelle série. |
| 30/30 | QCM bloqué, renouvellement proposé. |
| Ancien sujet sans chapitre | Lisible et modifiable en le rattachant à une UE et un chapitre. |
| Ancienne tentative | Affichage de secours par sujet, sans UE/chapitres. |

---

## 10. Fichiers concernés

### Étudiant

- `src/pages/DashboardPage.tsx` — cartes des 9 UE, statistiques, historique.
- `src/pages/ChapterSelectionPage.tsx` — checklist des chapitres.
- `src/pages/QuizPage.tsx` — série multi-chapitres, reprise et abandon.
- `src/pages/ResultPage.tsx` — résultat, UE/chapitres, export CSV.

### Docteur

- `src/pages/admin/AdminSubjectPage.tsx` — formulaire UE + chapitre, plusieurs sujets
  par chapitre, historique.
- `src/pages/admin/AdminDashboardPage.tsx` — compteurs de sujets.

### Données et API

- `src/lib/themes.ts` — UE, chapitres, helpers.
- `src/lib/subjects.ts` — résolution des sujets par chapitre.
- `src/lib/db.ts` — mode démonstration.
- `src/lib/supabaseData.ts` — RPC Supabase.
- `src/lib/api.ts` — façade démo/Supabase.
- `src/types.ts` — `Subject.chapterId`, `Attempt.ueId/chapterIds/status`.
- `src/lib/seed.ts` — catalogue de démonstration par chapitre.
- `supabase/schema.sql` — colonnes, index et RPC chapitres.

---

## 11. Critères d'acceptation

- [x] Les 9 UE sont affichées dans l'ordre officiel.
- [x] Les chapitres sont triés alphabétiquement dans chaque UE.
- [x] L'étudiant peut cocher un, plusieurs ou tous les chapitres.
- [x] La série contient 10 questions distinctes, mélangées entre les chapitres cochés.
- [x] Une série lancée compte immédiatement dans le quota.
- [x] Une série quittée est marquée abandonnée et reste comptée.
- [x] Un rafraîchissement reprend la série en cours sans créer de doublon.
- [x] Le docteur peut créer plusieurs sujets dans un même chapitre.
- [x] Le docteur choisit l'UE puis le chapitre dans le formulaire.
- [x] Les anciennes tentatives et les anciens sujets restent lisibles.
- [x] Le quota reste global à 30 séries.
- [x] Le renouvellement repart à 0/30 et conserve l'historique côté docteur.

---

## 12. Points en attente

1. Décider si l'étudiant doit pouvoir choisir un sujet précis à l'intérieur d'un chapitre,
   ou si le tirage doit continuer à utiliser tous les sujets des chapitres cochés.
2. Décider du sort des anciens sujets sans chapitre : les rattacher manuellement ou les
   laisser en lecture seule.
3. Créer en production des sujets rattachés aux chapitres : les deux sujets existants
   n'ont pas encore de `chapter_id`.
