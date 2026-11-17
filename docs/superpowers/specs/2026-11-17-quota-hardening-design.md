# Durcissement du quota de séries partagé

**Spécification de conception**

- **Date :** 17 novembre 2026
- **Statut :** conception approuvée, à relire avant toute implémentation
- **Périmètre :** passe 1 — rendre le compteur de 30 séries impossible à contourner par un lancement concurrent
- **Aucun code n’est implémenté par ce document.**

---

## 1. Objectif

Empêcher qu’un étudiant dépasse la limite de 30 séries en lançant deux séries simultanément (deux onglets, deux appareils, deux requêtes parallèles).

Contrainte absolue : **ne rien casser pour l’étudiant**. Aucun texte, bouton, écran, délai ou déconnexion ne change. Le durcissement est entièrement invisible pour un usage normal. Le seul cas qui voit une différence est l’attaque : au lieu de passer à 31 séries, elle reçoit le message « quota atteint » qui existe déjà.

---

## 2. Le problème

Le quota de 30 séries est actuellement vérifié à **quatre endroits**, avec le même calcul recopié à chaque fois :

| Emplacement | Fichier | Calcul actuel |
|---|---|---|
| `medgame_quota_json()` | `20261116_ticket_renewal.sql` L65 | `count(attempts du cycle) + count(series_consumptions du cycle)` |
| Trigger `enforce_shared_series_quota` (BEFORE INSERT sur `attempts`) | `20261116_ticket_renewal.sql` L107 | `count(attempts) + count(series_consumptions)` |
| `start_quiz()` | `20261120_series_counting_and_medgame_bank.sql` L134 | **`count(attempts) uniquement`** — n’inclut pas MEDGAME |
| `submit_attempt()` | `20261120_series_counting_and_medgame_bank.sql` L268 | `count(attempts)` hors tentative en cours — n’inclut pas MEDGAME |

Deux défauts :

1. **Course de données (le défaut principal).** Aucun de ces endroits ne verrouille avant de compter — sauf `submit_attempt`, qui pose `perform 1 from public.profiles where id = auth.uid() for update` (L251). En isolation `READ COMMITTED`, deux transactions concurrentes peuvent chacune lire « 29 utilisées », conclure qu’il reste de la place, et insérer deux séries : on finit à 31.

2. **Divergence de calcul.** `start_quiz` et `submit_attempt` comptent seulement les `attempts` Pres Concours, alors que `medgame_quota_json` et le trigger comptent aussi les `series_consumptions` MEDGAME. Le trigger rattrape l’insert en最后 ligne, mais le contrôle applicatif et le contrôle base ne racontent pas la même chose.

---

## 3. Design

Trois changements, réunis dans une seule nouvelle migration SQL cible :
`supabase/migrations/20261117_quota_hardening.sql`.

### 3.1 Une seule fonction de comptage

Créer :

```sql
public.series_quota_used(p_user_id uuid, p_skip_attempt_id uuid default null)
returns integer
```

Elle renvoie `count(attempts du cycle courant de p_user_id) + count(series_consumptions non archivées de p_user_id)`, en excluant `p_skip_attempt_id` du décompte des `attempts` si fourni (utile à `submit_attempt` pour ne pas recompter la tentative en cours).

Elle est `stable`, `security definer`, `set search_path = public`, avec les mêmes droits que les fonctions voisines :
`revoke all ... from public, anon` puis `grant execute ... to authenticated`.

Les quatre points de vérification l’appellent au lieu de recopier le calcul :
- `medgame_quota_json()` → `v_used := public.series_quota_used(auth.uid())`
- `enforce_shared_series_quota()` → `v_used := public.series_quota_used(new.user_id)`
- `start_quiz()` → `v_used := public.series_quota_used(auth.uid())`
- `submit_attempt()` → `v_used := public.series_quota_used(auth.uid(), v_attempt_id_en_cours)`

Effet : une seule définition de « série utilisée », plus de divergence Pres Concours / MEDGAME.

### 3.2 Verrou dans `start_quiz`

Ajouter, dans `start_quiz()`, **avant** le comptage du quota (juste après la résolution de l’assignment) :

```sql
perform 1 from public.profiles where id = auth.uid() for update;
```

`submit_attempt()` possède déjà ce verrou (L251). Le verrou sérialise les lancements concurrents d’un même étudiant : le premier réserve la ligne, compte, insère, valide ; le deuxième attend, puis relit le compte à 30 et lève `SERIES_LIMIT_REACHED`.

Le trigger `enforce_shared_series_quota` reste en place comme dernière ligne de défense pour toute insertion qui ne passerait pas par `start_quiz`.

### 3.3 Test de concurrence séparé

Créer `supabase/tests/quota_concurrency.sql`, exécuté **manuellement** après application de la migration (jamais exécuté automatiquement en production : il crée et supprime des données de test).

Scénario :
1. Créer un étudiant fictif avec ticket actif et 29 séries déjà utilisées.
2. Deux connexions appellent `start_quiz` en parallèle.
3. Résultat attendu : **une** réussite (30 séries), **un** échec `SERIES_LIMIT_REACHED`, et `count(...) = 30` pas 31.
4. Nettoyage des données de test.

Sans le verrou, le test échoue (31). Avec le verrou, il passe. Le fichier reste jouable autant de fois que nécessaire.

---

## 4. Fichiers concernés

| Action | Fichier |
|---|---|
| Créer | `supabase/migrations/20261117_quota_hardening.sql` |
| Créer | `supabase/tests/quota_concurrency.sql` |

Aucun fichier `src/` n’est modifié. L’application Android n’est pas modifiée (elle charge le site en direct). Aucune donnée de production n’est touchée par le test.

---

## 5. Comportement observable

| Situation | Avant | Après |
|---|---|---|
| Étudiant honnête, 0–29 séries | Lancé normalement | Lancé normalement — **aucun changement** |
| Étudiant honnête à la 30e | Message « quota atteint » | Message « quota atteint » — **aucun changement** |
| Deux lancements simultanés à 29 | Risque de passer à 31 | Un passe à 30, l’autre reçoit « quota atteint » |
| Quota MEDGAME + Pres Concours | Contrôle applicatif incohérent | Contrôle applicatif cohérent avec la base |

---

## 6. Risques et atténuation

- **Verrou sur `profiles`** : déjà utilisé en production par `submit_attempt`, donc motif éprouvé. Le verrou est pris sur une ligne existante (le profil de l’étudiant connecté), brève, et relâché à la fin de la transaction — aucun impact perceptible.
- **`for update` sur une ligne inexistante** : le profil existe toujours pour un étudiant connecté ; si toutefois la ligne manquait, `perform ... for update` ne verrouille rien (pas d’erreur) et le trigger reste la protection finale.
- **Centralisation** : en remplaçant les quatre calculs, il faut conserver l’exclusion de la tentative en cours dans `submit_attempt` via `p_skip_attempt_id`, sinon la 30e série pourrait être bloquée à tort.
- **Déploiement** : la migration ne modifie pas le schéma des tables, seulement des fonctions — aucun impact sur les données existantes.

---

## 7. Vérification

1. Appliquer la migration sur un environnement de test.
2. `npm run lint` et `npm run build` (vérification de non-régression, même si `src/` n’est pas touché).
3. Jouer `supabase/tests/quota_concurrency.sql` : attendre 1 réussite, 1 `SERIES_LIMIT_REACHED`, `count = 30`.
4. Contrôler qu’un étudiant normal peut toujours lancer 30 séries et que la 31e est refusée avec le message existant.
5. Commit / push / déploiement : **uniquement sur demande explicite**, avec staging explicite des seuls fichiers de cette passe.

---

## 8. Hors périmètre (passe 2, non retenue ici)

- Audit complet des fonctions `security definer` et de leur `search_path`.
- Limitation des tentatives sur le code de ticket (brute force).
- Vérification du serveur démo `/api/db` (127.0.0.1, développement uniquement).
- Renforcement des policies d’accès au contenu du cours.
