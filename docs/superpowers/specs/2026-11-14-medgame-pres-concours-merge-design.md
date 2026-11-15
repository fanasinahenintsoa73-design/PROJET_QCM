# Fusion MEDGAME — Pres Concours

**Spécification de conception**

- **Date :** 14 novembre 2026
- **Statut :** conception approuvée, à relire avant toute implémentation
- **Périmètre :** fusion du mode Pres Concours (30 séries) et du mode MEDGAME, quota partagé, nouvelles sections de contenu, admin à ticket unique
- **Aucun code n’est implémenté par ce document.**

---

## 1. Objectif

Fusionner les deux modes d’entraînement actuels en une seule expérience étudiante, sans toucher :

- à l’écran docteur ;
- à l’interface de connexion ;
- à la saisie du ID et du numéro d’enregistrement ;
- à l’interface visuelle du mode Pres Concours ;
- à l’onglet Avis, aux notes et aux étoiles ;
- aux photos manga et au design général.

Après connexion, l’étudiant dispose de **4 options** :

1. **Pres Concours** — l’interface actuelle des 30 séries.
2. **MEDGAME** — un mode de jeu par niveaux, avec le même quota de séries.
3. **Supports du cours** — documents déposés par l’admin.
4. **Sujets concours 2014–2026** — sujets d’examen déposés par l’admin.

Les deux premiers modes partagent **un seul quota de 30 séries**. Les deux derniers sont **indépendants du quota** et restent accessibles même quand les 30 séries sont épuisées.

---

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Ticket | Un seul type de ticket, 30 séries, aucune expiration |
| Quota | Pres Concours + MEDGAME partagent les mêmes 30 séries |
| Pres Concours | Interface, historique, notes, étoiles et Avis inchangés |
| Consommation Pres Concours | 1 série au lancement, comme aujourd’hui |
| MEDGAME | 1 run jusqu’à l’échec = 1 série |
| Réussite MEDGAME | Terminer tous les niveaux sans échec = 1 série |
| Abandon MEDGAME | 1 série consommée |
| Reprise après abandon | Consomme une nouvelle série au démarrage de la reprise |
| Niveau MEDGAME | Bloc de 5 questions, réussite à 5/5 |
| Échec MEDGAME | Une seule mauvaise réponse termine le run |
| Longueur d’un run | Jusqu’à l’échec, sans plafond |
| Chapitres | Au moins un, plusieurs ou tous les chapitres d’une UE |
| Tirage | Global, aléatoire, sans équilibre par chapitre |
| Répétition | Une question ne revient pas dans le même run |
| Progression | Les niveaux réussis restent acquis |
| Reprise après échec | Reprend au niveau échoué, même parcours |
| Historique MEDGAME | Aucun |
| Historique Pres Concours | Conservé |
| Supports / sujets | Consultables dans l’application, sans téléchargement |
| Ancien ticket Anki | Supprimé, converti en ticket unique |
| Ancienne progression MEDGAME | Archivée, redémarrage au niveau 1 |
| Design | Inchangé, photos manga conservées |

---

## 3. Parcours étudiant

### 3.1 Connexion et choix du mode

Le parcours existant reste identique :

```text
Écran docteur
   ↓
Accéder
   ↓
Login
   ↓
ID + numéro d’enregistrement
   ↓
Compte étudiant
   ↓
4 options
```

Les 4 options sont présentées sous forme de cartes, avec le style et les photos manga actuels. Chaque carte permet de revenir au choix des 4 options.

### 3.2 Pres Concours

Pres Concours conserve l’interface actuelle :

- choix de l’UE et des chapitres ;
- série de 30 questions ;
- consommation d’une série au lancement ;
- résultats ;
- historique Pres Concours ;
- notes, étoiles et Avis.

Le compteur affiché devient le **compteur partagé** des 30 séries. Le design du compteur ne change pas ; seul le calcul reflète les consommations des deux modes.

### 3.3 MEDGAME

Le parcours MEDGAME est le suivant :

1. L’étudiant choisit une UE.
2. Il choisit **au moins un chapitre** de cette UE.
3. Il peut choisir plusieurs chapitres, ou tous les chapitres. La limite de 5 chapitres est supprimée.
4. Le système construit un parcours fixe à partir des chapitres choisis.
5. L’étudiant lance le niveau en cours.
6. Chaque niveau contient 5 questions.
7. Une seule mauvaise réponse termine le run.
8. Un niveau réussi fait passer au niveau suivant.
9. Le run continue jusqu’à l’échec, l’abandon, ou l’épuisement de la banque de questions.
10. À la fin, une série est consommée.

L’étudiant voit :

- la carte des niveaux ;
- le niveau en cours ;
- les questions ;
- la correction immédiate après le niveau ;
- le résultat de fin de run ;
- le compteur partagé restant.

Il ne voit **aucun historique MEDGAME**.

### 3.4 Supports du cours

L’étudiant peut :

- consulter la liste des supports ;
- filtrer par UE puis par chapitre ;
- ouvrir un support PDF ou image dans l’application.

Il ne peut pas :

- télécharger le fichier ;
- obtenir un lien public direct ;
- accéder au fichier sans être authentifié.

### 3.5 Sujets concours 2014–2026

L’étudiant peut :

- consulter la liste des sujets ;
- filtrer par année puis par UE ou matière ;
- ouvrir un sujet PDF ou image dans l’application.

Il ne peut pas télécharger le fichier.

### 3.6 Quota épuisé

Quand les 30 séries sont consommées :

- Pres Concours est bloqué ;
- MEDGAME est bloqué ;
- Supports du cours reste accessible ;
- Sujets concours reste accessible ;
- un message indique que le docteur doit générer un nouveau ticket.

---

## 4. Moteur MEDGAME

### 4.1 Vocabulaire

| Terme | Définition |
|---|---|
| **Parcours** | Ensemble fixe : UE, chapitres choisis, banque de questions mélangée, découpage en niveaux |
| **Run** | Une tentative de jeu sur un parcours ; un run consommé = une série |
| **Niveau** | Bloc de 5 questions, ou bloc final de 1 à 4 questions |
| **Série** | Unité du quota partagé ; Pres Concours et MEDGAME en consomment |
| **Banque** | Questions issues des chapitres choisis, mélangées une fois pour le parcours |

### 4.2 Sélection des chapitres

- Une UE est obligatoire.
- Au moins un chapitre est obligatoire.
- Plusieurs chapitres sont autorisés.
- Tous les chapitres de l’UE sont autorisés.
- La sélection est fixée pour le parcours.
- Changer de chapitres crée un nouveau parcours et remet la progression à zéro.

### 4.3 Construction du parcours

1. Récupérer toutes les questions des chapitres sélectionnés.
2. Mélanger la banque une seule fois.
3. Découper en niveaux de 5 questions.
4. Si le total n’est pas un multiple de 5, le dernier niveau contient le reste.
5. Chaque question ne peut apparaître qu’une fois dans le run.

Exemple :

```text
43 questions
= 8 niveaux de 5
+ 1 niveau de 3
= 9 niveaux
```

Le dernier niveau de 3 questions exige 3/3.

### 4.4 Règles de niveau

- Un niveau standard contient 5 questions.
- La réussite exige **5/5**.
- Une seule mauvaise réponse échoue le niveau.
- Un échec termine immédiatement le run.
- Un niveau réussi débloque le niveau suivant.
- La correction est affichée après le niveau.
- Les questions du niveau sont corrigées ensemble, pas question par question.

### 4.5 Règles de run

Un run peut se terminer de trois façons :

| Fin | Consommation | Progression |
|---|---:|---|
| Échec à un niveau | 1 série | Niveaux réussis conservés |
| Réussite de tous les niveaux | 1 série | Parcours terminé |
| Abandon | 1 série | Niveau en cours conservé |

Un run peut dépasser 30 questions. La limite de 30 s’applique au **quota de séries**, pas au nombre de questions d’un run.

### 4.6 Épuisement de la banque

Si la banque est épuisée sans échec :

- le run est terminé avec succès ;
- une série est consommée ;
- le parcours est marqué comme terminé ;
- l’étudiant peut choisir un nouveau parcours.

### 4.7 Reprise après échec

Après un échec :

- les niveaux déjà réussis restent acquis ;
- le parcours et l’ordre des questions restent identiques ;
- le prochain run reprend au niveau échoué ;
- les questions du niveau échoué sont rejouées à l’identique ;
- le run suivant est un nouveau run : il consomme une série à sa fin (échec, réussite ou abandon).

Un échec suivi d’une reprise consomme donc **2 séries au total** : 1 pour le run échoué, 1 pour le run suivant.

### 4.8 Abandon

#### Abandon volontaire

Toute sortie de l’écran MEDGAME est considérée comme un abandon :

- retour au choix des 4 options ;
- retour à l’écran précédent ;
- fermeture de l’application ;
- changement d’écran.

Une **confirmation** est affichée avant l’abandon volontaire.

#### Interruption involontaire

En cas de :

- mise en arrière-plan de l’application ;
- perte de réseau ;
- appel téléphonique ;
- verrouillage du téléphone ;

l’étudiant dispose de **2 minutes** pour revenir. Si il revient dans les 2 minutes, la reprise est gratuite. Au-delà de 2 minutes, le run est marqué abandonné et une série est consommée.

#### Reprise après abandon

Si l’étudiant reprend un run abandonné :

- une **nouvelle série** est consommée au démarrage de la reprise ;
- le parcours et le niveau restent les mêmes ;
- aucune série supplémentaire n’est consommée à la fin de cette reprise.

Un abandon suivi d’une reprise consomme donc **2 séries au total** : 1 pour l’abandon, 1 pour la reprise.

#### Heartbeat et balayage serveur

Le client envoie un heartbeat toutes les **20 à 30 secondes**. Un balayage serveur marque comme abandonné tout run sans activité depuis plus de 2 minutes, même si l’étudiant ne revient pas. La consommation est alors enregistrée côté serveur.

### 4.9 Une seule tentative active

Un étudiant ne peut avoir qu’un seul run MEDGAME actif à la fois.

S’il ouvre MEDGAME sur un autre appareil :

- il reprend le run actif ;
- il ne peut pas lancer un deuxième run en parallèle.

### 4.10 Machine à états

```text
non démarré
   ↓
en cours ──────────────┐
   │                    │
   ├── échec → échoué   │
   ├── tous niveaux → réussi
   └── abandon → abandonné
                         │
                         ├── reprise dans les 2 min → en cours (gratuit)
                         └── reprise après 2 min → nouveau run (nouvelle série)
```

---

## 5. Quota partagé

### 5.1 Principe

Un ticket contient **30 séries**. Chaque consommation, quel que soit le mode, décrémente le même compteur.

Exemple :

```text
13 séries Pres Concours
+ 17 séries MEDGAME
= 30 séries consommées
```

### 5.2 Consommation Pres Concours

Pres Concours conserve le comportement actuel :

- une série est consommée au lancement ;
- elle reste consommée même si l’étudiant abandonne ;
- l’historique et les résultats restent inchangés.

### 5.3 Consommation MEDGAME

| Événement | Moment de consommation |
|---|---|
| Échec | À la fin du run, quand l’échec est enregistré |
| Réussite complète | À la fin du run |
| Abandon volontaire | À la confirmation de l’abandon |
| Abandon involontaire après 2 min | À l’expiration de la grâce |
| Reprise après abandon | Au démarrage de la reprise |
| Reprise dans les 2 min | Aucune consommation |

### 5.4 Atomicité

Le compteur est vérifié et décrémenté côté serveur, dans une transaction.

Règles :

- verrouiller le ticket de l’étudiant ;
- compter les consommations existantes ;
- refuser si le total atteint 30 ;
- insérer la consommation ;
- utiliser une clé d’idempotence unique pour éviter le double comptage.

Aucune consommation ne doit dépendre uniquement du client.

### 5.5 Ticket épuisé

Quand les 30 séries sont consommées :

- le ticket passe à l’état épuisé ;
- Pres Concours et MEDGAME sont bloqués ;
- les supports et sujets restent accessibles ;
- le docteur génère un nouveau ticket.

---

## 6. Modèle de données

Cette section décrit les tables et relations. Elle ne contient pas de migration SQL.

### 6.1 `tickets`

Un ticket unique par étudiant.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `student_id` | uuid | Étudiant |
| `total_series` | int | 30 |
| `status` | text | `active`, `exhausted` |
| `created_by` | uuid | Admin |
| `created_at` | timestamptz | Création |
| `exhausted_at` | timestamptz | Épuisement |

Contraintes :

- un seul ticket `active` par étudiant ;
- aucune date d’expiration ;
- `total_series = 30`.

### 6.2 `series_consumptions`

Journal des consommations.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `ticket_id` | uuid | Ticket |
| `student_id` | uuid | Étudiant |
| `mode` | text | `pres_concours`, `medgame` |
| `reason` | text | `launch`, `failure`, `completion`, `abandonment`, `resume_after_abandonment` |
| `reference_id` | uuid | Tentative Pres Concours ou run MEDGAME |
| `idempotency_key` | text | Clé unique |
| `created_at` | timestamptz | Date |

Contraintes :

- `idempotency_key` unique ;
- un run MEDGAME ne peut produire qu’une seule consommation ;
- une tentative Pres Concours ne peut produire qu’une seule consommation ;
- le total utilisé = `count(*)` pour le ticket.

### 6.3 `medgame_progress`

Parcours fixe d’un étudiant.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `student_id` | uuid | Étudiant |
| `ticket_id` | uuid | Ticket |
| `ue_id` | uuid | UE |
| `chapter_ids` | uuid[] | Chapitres choisis |
| `question_bank` | jsonb | Questions mélangées |
| `level_count` | int | Nombre de niveaux |
| `current_level` | int | Niveau en cours |
| `status` | text | `active`, `completed`, `archived` |
| `created_at` | timestamptz | Création |
| `updated_at` | timestamptz | Mise à jour |

Contraintes :

- un seul parcours `active` par étudiant ;
- `chapter_ids` non vide ;
- `current_level` entre 1 et `level_count`.

### 6.4 `medgame_runs`

Une tentative de jeu.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `progress_id` | uuid | Parcours |
| `ticket_id` | uuid | Ticket |
| `student_id` | uuid | Étudiant |
| `status` | text | `in_progress`, `failed`, `completed`, `abandoned` |
| `started_at` | timestamptz | Début |
| `last_activity_at` | timestamptz | Heartbeat |
| `ended_at` | timestamptz | Fin |
| `consumption_id` | uuid | Consommation liée |
| `resumed_from_run_id` | uuid | Run abandonné repris |

Contraintes :

- un seul run `in_progress` par étudiant ;
- un run terminé ne peut plus recevoir de réponses ;
- un run ne peut avoir qu’une consommation.

### 6.5 `medgame_run_answers`

Réponses d’un run.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `run_id` | uuid | Run |
| `question_id` | uuid | Question |
| `level_index` | int | Niveau |
| `question_index` | int | Position |
| `selected_answer` | text | Réponse |
| `is_correct` | boolean | Correction |
| `answered_at` | timestamptz | Date |

Contraintes :

- une réponse par question et par run ;
- les réponses servent à la correction immédiate ;
- les réponses ne sont pas affichées dans un historique MEDGAME.

### 6.6 `course_supports`

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `ue_id` | uuid | UE |
| `chapter_id` | uuid | Chapitre |
| `title` | text | Titre |
| `description` | text | Description |
| `storage_path` | text | Fichier privé |
| `mime_type` | text | PDF ou image |
| `created_by` | uuid | Admin |
| `created_at` | timestamptz | Création |
| `updated_at` | timestamptz | Mise à jour |

### 6.7 `exam_subjects`

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | Identifiant |
| `year` | int | 2014 à 2026 |
| `ue_id` | uuid | UE ou matière |
| `title` | text | Titre |
| `description` | text | Description |
| `storage_path` | text | Fichier privé |
| `mime_type` | text | PDF ou image |
| `created_by` | uuid | Admin |
| `created_at` | timestamptz | Création |
| `updated_at` | timestamptz | Mise à jour |

### 6.8 Tables Pres Concours

Les tables actuelles du mode Pres Concours restent en place :

- tentatives ;
- réponses ;
- résultats ;
- historique ;
- notes et étoiles ;
- Avis.

Elles ne sont pas fusionnées avec les tables MEDGAME.

---

## 7. Sécurité et RLS

### 7.1 Étudiant

Un étudiant peut :

- lire son ticket ;
- lire ses consommations ;
- lire son parcours MEDGAME ;
- lire ses runs et ses réponses ;
- lire les supports et sujets ;
- créer ses propres runs et réponses selon les règles.

Un étudiant ne peut pas :

- lire le ticket d’un autre étudiant ;
- lire les réponses d’un autre étudiant ;
- modifier une consommation ;
- modifier un support ou un sujet ;
- accéder à un fichier sans authentification ;
- télécharger un support ou un sujet.

### 7.2 Admin

L’admin peut :

- générer les tickets ;
- consulter les quotas ;
- gérer les supports ;
- gérer les sujets ;
- consulter les Avis ;
- gérer les thèmes et questions.

### 7.3 Fichiers

- stockage privé ;
- URL signée de courte durée ;
- affichage inline dans l’application ;
- pas de bouton de téléchargement ;
- pas de lien public.

Limite technique : un utilisateur déterminé peut toujours capturer un contenu affiché. La conception empêche le téléchargement direct, pas la capture d’écran.

---

## 8. API et opérations serveur

Cette section décrit les opérations, pas leur code.

### 8.1 Quota

- `get_student_quota()` : total, utilisé, restant, état du ticket.
- `consume_series(ticket_id, mode, reason, reference_id, idempotency_key)` : opération atomique.

### 8.2 Pres Concours

- `start_pres_concours_attempt()` : conserve le comportement actuel et consomme une série au lancement.
- Les résultats et l’historique restent ceux du mode actuel.

### 8.3 MEDGAME

- `create_medgame_progress(ue_id, chapter_ids)` : valide la sélection et construit la banque.
- `start_medgame_run(progress_id)` : vérifie le quota, reprend ou démarre un run.
- `submit_medgame_level(run_id, level_index, answers)` : corrige, avance ou échoue.
- `heartbeat_medgame_run(run_id)` : met à jour l’activité.
- `abandon_medgame_run(run_id)` : marque l’abandon et consomme.
- `resume_medgame_run(run_id)` : applique la grâce de 2 minutes ou crée un nouveau run.
- `get_medgame_state(student_id)` : parcours, run actif, niveau, quota.

### 8.4 Contenu

- `list_course_supports(ue_id, chapter_id)`.
- `list_exam_subjects(year, ue_id)`.
- `get_content_view_url(content_id)` : URL signée courte, affichage inline.
- `admin_create_course_support(...)`.
- `admin_create_exam_subject(...)`.
- `admin_update_content(...)`.
- `admin_delete_content(...)`.

### 8.5 Admin tickets

- `admin_generate_tickets(student_ids, count)` : conserve l’interface actuelle, sans option Anki.
- Un seul ticket actif par étudiant.
- Si un étudiant a déjà un ticket actif, la génération est refusée pour cet étudiant avec un message clair.
- Le nombre de tickets correspond au nombre d’étudiants sélectionnés.

---

## 9. Interface et expérience

### 9.1 Étudiant

- 4 cartes d’options.
- Retour possible depuis chaque option.
- Compteur partagé visible dans Pres Concours et MEDGAME.
- Pres Concours inchangé.
- MEDGAME avec carte des niveaux et photos manga.
- Confirmation avant abandon.
- Message de grâce de 2 minutes.
- Message de quota épuisé.
- Supports et sujets consultables même sans quota.

### 9.2 Admin

- Interface de génération de tickets conservée.
- Option Anki supprimée.
- Champ nombre de tickets conservé.
- Onglet « Supports du cours ».
- Onglet « Sujets concours 2014–2026 ».
- Avis inchangé.
- Thèmes et questions inchangés.

### 9.3 Design

- Photos manga conservées.
- Palette, typographie et composants existants conservés.
- Pas de refonte visuelle.
- Les nouveaux écrans reprennent les composants existants.

---

## 10. Migration

### 10.1 Tickets

- Les anciens tickets `series` deviennent le ticket unique.
- Les anciens tickets `anki` sont convertis en ticket unique.
- Un seul ticket actif par étudiant.
- Aucune expiration.

### 10.2 Quota initial

Pour un étudiant migré :

- le nombre de séries déjà consommées en Pres Concours dans le cycle actuel est repris ;
- les anciennes consommations MEDGAME ne sont pas converties en séries ;
- le solde est plafonné à 30 ;
- si le solde atteint 30, le ticket est épuisé.

### 10.3 Progression MEDGAME

- L’ancienne progression `anki_history` et `anki_question_progress` est archivée.
- Les étudiants MEDGAME repartent au niveau 1.
- Aucun historique MEDGAME n’est affiché.
- L’historique Pres Concours reste intact.

### 10.4 Contenus

- Les tables de supports et de sujets sont nouvelles.
- Les fichiers sont stockés dans un bucket privé.
- Les anciens contenus éventuels sont migrés manuellement par l’admin.

### 10.5 Rollback

- Conserver les anciennes tables et colonnes pendant la période de transition.
- Prévoir un drapeau de fonctionnalité pour revenir à l’ancien affichage.
- Ne supprimer les anciennes données qu’après validation.

---

## 11. Gestion des erreurs et cas limites

| Cas | Comportement |
|---|---|
| Aucun ticket actif | Pres Concours et MEDGAME bloqués ; supports et sujets accessibles |
| Quota épuisé | Pres Concours et MEDGAME bloqués ; supports et sujets accessibles |
| Aucun chapitre sélectionné | Démarrage refusé avec message |
| Banque vide | Démarrage refusé avec message |
| Banque de 1 à 4 questions | Un seul niveau avec toutes les questions ; réussite exigée à 100 % |
| Banque de 5 questions | Un seul niveau de 5 |
| Dernier niveau incomplet | Le reste forme un niveau ; réussite à 100 % |
| Mauvaise réponse | Correction immédiate, fin du run, consommation |
| Réseau perdu | Grâce de 2 minutes |
| Application fermée | Grâce de 2 minutes, puis abandon |
| Retour après 2 minutes | Nouveau run, nouvelle série |
| Double soumission | Idempotence, aucune double consommation |
| Deux appareils | Un seul run actif ; reprise sur le second appareil |
| Run déjà terminé | Toute nouvelle réponse est refusée |
| Fichier absent | Message d’erreur, pas de crash |
| Fichier non PDF/image | Téléversement refusé |
| Support sans UE/chapitre | Téléversement refusé |
| Sujet sans année/UE | Téléversement refusé |

---

## 12. Tests

### 12.1 Quota

- 13 Pres Concours + 17 MEDGAME = 30.
- 30 Pres Concours = 30.
- 30 MEDGAME = 30.
- Une consommation Pres Concours au lancement.
- Une consommation MEDGAME à l’échec.
- Une consommation MEDGAME à la réussite.
- Une consommation MEDGAME à l’abandon.
- Reprise après abandon = nouvelle série.
- Reprise dans les 2 minutes = gratuite.
- Aucun double comptage.
- Quota épuisé = blocage des deux modes.
- Supports et sujets accessibles après épuisement.

### 12.2 MEDGAME

- Sélection d’un chapitre.
- Sélection de plusieurs chapitres.
- Sélection de tous les chapitres.
- Tirage global.
- Aucune répétition.
- Niveau 5/5.
- Niveau 4/5 = échec.
- Dernier niveau de 3 questions = 3/3.
- Banque de 43 questions = 9 niveaux.
- Banque épuisée = réussite.
- Échec = progression conservée.
- Reprise au niveau échoué.
- Même parcours et mêmes questions.
- Abandon volontaire avec confirmation.
- Abandon involontaire avec grâce.
- Un seul run actif.
- Aucun historique MEDGAME.

### 12.3 Contenus

- Admin upload PDF.
- Admin upload image.
- Classement par UE/chapitre.
- Classement par année/UE.
- Consultation étudiant.
- Absence de bouton de téléchargement.
- Accès refusé sans authentification.
- Fichier privé.
- Suppression admin.

### 12.4 Admin

- Génération d’un ticket unique.
- Suppression de l’option Anki.
- Nombre de tickets.
- Refus si ticket actif.
- Onglets supports et sujets.
- Avis inchangé.
- Design inchangé.

### 12.5 Migration

- Ancien ticket series converti.
- Ancien ticket anki converti.
- Ancienne progression archivée.
- Historique Pres Concours conservé.
- Quota initial correct.
- RLS isolée.

---

## 13. Critères d’acceptation

La conception est acceptée si :

1. L’étudiant voit 4 options après connexion.
2. Chaque option permet de revenir au choix.
3. Pres Concours est visuellement inchangé.
4. Pres Concours conserve son historique.
5. MEDGAME n’affiche aucun historique.
6. Pres Concours et MEDGAME partagent le même compteur de 30 séries.
7. Un run MEDGAME jusqu’à l’échec consomme une série.
8. Une réussite complète consomme une série.
9. Un abandon consomme une série.
10. Une reprise après abandon consomme une nouvelle série.
11. Une reprise dans les 2 minutes est gratuite.
12. Les niveaux réussis restent acquis.
13. Le dernier niveau incomplet exige 100 %.
14. Les supports et sujets sont consultables sans téléchargement.
15. L’admin gère un seul ticket.
16. L’admin dispose des onglets supports et sujets.
17. Les photos manga et le design sont conservés.
18. Aucune régression sur le login, le ID, le numéro d’enregistrement et l’écran docteur.

---

## 14. Hors périmètre

- Aucune implémentation dans ce document.
- Aucune modification de l’écran docteur.
- Aucune modification de l’interface de login.
- Aucune modification du ID ou du numéro d’enregistrement.
- Aucune refonte du design.
- Aucune modification de l’onglet Avis, des notes ou des étoiles.
- Aucun historique MEDGAME.
- Aucun téléchargement des supports ou sujets.
- Aucune modification de l’hébergement.

---

## 15. Résumé

La fusion repose sur trois idées :

1. **Un seul quota de 30 séries** pour Pres Concours et MEDGAME.
2. **Un seul ticket** généré par l’admin, sans expiration.
3. **Deux expériences distinctes** : Pres Concours garde son interface et son historique ; MEDGAME devient un mode par niveaux, sans historique, avec un run qui continue jusqu’à l’échec.

Les supports du cours et les sujets concours sont des contenus consultables, indépendants du quota, gérés par l’admin.

Le design, les photos manga, le login, le ID, le numéro d’enregistrement, l’écran docteur et l’onglet Avis restent inchangés.
