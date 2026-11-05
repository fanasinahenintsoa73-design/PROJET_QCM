# Sécurité QCM — conception validée

**Date :** 2026-11-05  
**Statut :** conception validée par le demandeur ; à relire avant le plan d’implémentation.  
**Périmètre :** application étudiante, application docteur, backend Supabase, distribution mobile.

## 1. Objectif

Empêcher au maximum la fuite des questions et réponses, tracer les captures d’écran, permettre au docteur de suspendre un compte en cas de fraude, et compter correctement les séries.

La caméra est **exclue** de la conception.

## 2. Décisions validées

- **Modèle C** : le QCM se fait uniquement dans l’application installée sur Android et iPhone. Le site web ne propose pas le QCM ; il sert au compte, à l’historique et aux informations.
- **Android** : application installée avec `FLAG_SECURE`.
- **iPhone** : application installée sur des iPhone **supervisés/MDM**, avec restriction de capture désactivée par l’école. Si un iPhone n’est pas supervisé, l’application détecte la capture après coup et alerte le docteur ; elle ne peut pas la bloquer.
- **Pas de caméra** : pas de selfie, pas de scan de pièce, pas de surveillance vidéo.
- **Sortie QCM** : message de confirmation ; la série est comptée au lancement et reste comptée en cas d’abandon.
- **Session unique** : un compte ne peut avoir qu’une seule session active ; une nouvelle connexion révoque l’ancienne.
- **Accès avant validation** : déjà bloqué côté serveur par les RLS/RPC ; à vérifier par des tests.
- **Quota** : 30 séries.
- **Photo par un autre téléphone** : non bloquable et non floutable par l’application ; filigrane, dissuasion, et salle surveillée pour les examens à fort enjeu.

## 3. Hypothèses et prérequis

- Les iPhone utilisés pour l’examen sont fournis ou gérés par l’école (Apple Business Manager + MDM).
- Un compte Apple Developer et un compte Google Play/Android sont disponibles.
- L’application mobile peut être distribuée via le MDM (B2B/private) ou les stores.
- Les appareils ne sont pas rootés ou jailbreakés.
- Le QCM nécessite une connexion réseau ; il n’y a pas de mode hors ligne.
- Le site web reste accessible pour le compte et l’historique, mais pas pour lancer ou répondre au QCM.

## 4. Modèle de sécurité

### 4.1 Accès avant validation

- `has_active_access()` et les politiques RLS/RPC empêchent un étudiant sans accès actif de lister les sujets, lancer une série ou lire les questions.
- Les tests doivent couvrir les appels directs à l’API/RPC, pas seulement l’interface.
- Un compte suspendu est bloqué même s’il possède un accès actif.

### 4.2 Session unique

- Un compte = une session active.
- Une nouvelle connexion révoque l’ancienne session.
- Le serveur conserve `active_session_id` ou `session_version`.
- Chaque RPC vérifie la session active.
- Objectif : limiter le partage de compte. Cela ne bloque pas les captures.

### 4.3 QCM uniquement dans l’application

- Le QCM n’est pas accessible depuis Safari, Chrome ou une PWA.
- Le site web ne sert qu’au compte, à l’historique et aux informations.
- Cette règle évite qu’un étudiant contourne l’application mobile en ouvrant le site dans un navigateur.
- Conséquence : il faut prévoir des appareils de prêt pour les étudiants qui n’ont pas de téléphone compatible.

### 4.4 Android

- `FLAG_SECURE` est activé sur les écrans du QCM, et peut l’être sur toute l’application.
- Capture d’écran : écran noir.
- Enregistrement d’écran : noir.
- Aperçu dans les applications récentes : contenu masqué.
- Un Android rooté peut contourner cette protection ; ce cas est hors garantie.

### 4.5 iPhone

- Les iPhone sont supervisés via Apple Business Manager et un MDM.
- Le profil MDM applique la restriction `allowScreenShot = false`.
- L’application est installée via le MDM ou un canal privé.
- L’administration vérifie que l’appareil est supervisé et conforme avant l’examen.
- Si l’application peut lire un indicateur de conformité fourni par le MDM, elle bloque le QCM sur un appareil non conforme. Sinon, l’administration contrôle l’appareil avant l’épreuve.
- **Fallback** : sur un iPhone non supervisé, l’application reçoit la notification de capture après coup, affiche un avertissement et envoie un incident au serveur. Elle ne peut pas empêcher la capture.
- La restriction MDM est appliquée à l’appareil ; elle est acceptable pour des téléphones appartenant à l’école.
- Test pilote obligatoire : tenter une capture sur un iPhone supervisé et vérifier qu’aucune image n’est enregistrée.

### 4.6 Filigrane et photo extérieure

- Un filigrane visible affiche le nom, l’email, la session et la date, en transparence sur les questions.
- Le filigrane ne bloque pas la capture ; il permet d’identifier la fuite.
- Une photo prise par un autre téléphone ne peut être ni détectée, ni bloquée, ni floutée par l’application.
- Mesures complémentaires : questions et options mélangées, temps limité, questions non accompagnées du corrigé, salle surveillée pour les examens à fort enjeu.
- Le filigrane reste utile si une photo extérieure circule.

### 4.7 Caméra

- Aucune permission caméra n’est demandée.
- Aucun selfie, scan de pièce ou proctoring vidéo.
- Conséquence assumée : un second téléphone n’est pas détecté.

## 5. Parcours étudiant

### 5.1 Connexion

1. L’étudiant ouvre l’application.
2. Le serveur vérifie l’accès actif et l’absence de suspension.
3. Une nouvelle session révoque l’ancienne.
4. Si le compte est suspendu, un message invite à contacter le docteur.

### 5.2 Lancement d’une série

1. L’étudiant choisit une UE et un ou plusieurs chapitres.
2. Le serveur vérifie l’accès, la session, la suspension et le quota.
3. `start_chapter_quiz` crée la série, incrémente le quota et renvoie les questions sans les réponses.
4. Le lancement compte immédiatement une série.

### 5.3 Pendant le QCM

- Les questions sont affichées sans corrigé ni explication.
- Le filigrane est visible.
- Android : `FLAG_SECURE` actif.
- iPhone supervisé : restriction MDM active.
- En cas de perte de réseau, l’application conserve l’état local et reprend la série au retour.

### 5.4 Sortie et abandon

Lors d’un retour ou d’une tentative de sortie, afficher :

> **Voulez-vous vraiment quitter ?**  
> Ce QCM compte une série même si vous revenez.  
> La série en cours est déjà comptée dans votre quota (30).

Boutons : **Rester dans le QCM** / **Quitter et compter**

- **Quitter** : la série passe en `abandoned` ; elle reste comptée ; elle ne peut pas être reprise.
- **Revenir plus tard** : l’étudiant lance une nouvelle série, donc un nouveau comptage.
- **Rester** : le QCM continue ; le temps continue.
- **Refresh** : la même série est reprise depuis le brouillon ; aucun nouveau comptage.
- **Fermeture d’onglet** : le navigateur ne permet qu’un message générique. Dans l’application installée, le message personnalisé est affiché.
- **Fermeture forcée ou coupure** : la série reste comptée ; au retour, le brouillon est repris si la série est toujours en cours.
- Une série abandonnée ne se reprend pas.

### 5.5 Capture sur iPhone

1. L’application détecte la capture après coup.
2. Message :  
   **« Capture détectée. Cette action est enregistrée. Si vous recommencez, votre compte sera suspendu après vérification. »**
3. L’incident est envoyé au serveur : étudiant, date, heure, session, plateforme, nombre de captures.
4. Le docteur voit l’alerte.
5. Première capture : avertissement. Deuxième capture : le docteur peut suspendre le compte.
6. La suspension révoque la session active et bloque la connexion.

## 6. Parcours docteur

- Écran **Incidents de sécurité** : liste des incidents avec étudiant, date, session, plateforme, type et statut.
- Actions : consulter, avertir, suspendre, classer sans suite.
- La suspension demande une durée et un motif.
- La suspension révoque les sessions actives et empêche toute nouvelle connexion.
- L’étudiant voit un message de suspension avec le contact du docteur.
- Aucune capture d’écran n’est stockée ; seules les métadonnées de l’incident le sont.
- Toutes les actions du docteur sont journalisées.

## 7. Règles de comptage

- Quota global : 30 séries.
- Lancement = 1 série comptée.
- Abandon = la série reste comptée.
- Refresh ou reprise de brouillon = même série, pas de nouveau comptage.
- Retour après abandon = nouvelle série, nouveau comptage.
- Série soumise = 1 série comptée.
- Une série abandonnée ne peut pas être reprise.
- Toute exception administrative doit être tracée.

## 8. Données et API (conceptuel)

### Tables / champs

- `profiles` : `active_session_id`, `session_version`, `suspended_until`, `suspension_reason`.
- `quiz_series` : `status` (`in_progress`, `submitted`, `abandoned`, `expired`), `started_at`, `submitted_at`, `abandoned_at`, `chapter_id`, `score`.
- `security_incidents` : `id`, `user_id`, `series_id`, `type`, `platform`, `occurred_at`, `metadata`, `status`, `reviewed_by`, `reviewed_at`.

### RPC / opérations

- `start_chapter_quiz` : vérifie l’accès, la session, la suspension et le quota ; crée la série ; incrémente le quota.
- `abandon_series` : marque la série abandonnée ; ne rembourse pas le quota.
- `register_security_incident` : enregistre une capture ou un événement de conformité.
- `doctor_suspend_student` : suspend le compte, révoque les sessions, journalise l’action.
- `doctor_review_incident` : met à jour le statut de l’incident.
- `doctor_revoke_sessions` : révoque les sessions d’un étudiant.

### RLS

- Étudiant : lecture de ses propres séries et incidents.
- Docteur : lecture de tous les incidents et séries ; écriture des sanctions.
- Insertion d’incident : uniquement depuis une session authentifiée.
- Aucun accès anonyme aux questions, séries ou incidents.

## 9. Cas limites

- **MDM absent ou non conforme** : le QCM est bloqué sur iPhone si la conformité ne peut pas être vérifiée ; sinon, mode détection avec alerte.
- **Android rooté** : `FLAG_SECURE` peut être contourné ; hors garantie.
- **Perte de réseau** : reprise de la même série ; pas de nouveau comptage.
- **Coupure pendant la soumission** : vérifier l’idempotence de la soumission.
- **Double clic sur lancer** : une seule série doit être créée.
- **Deux appareils** : la nouvelle connexion révoque l’ancienne.
- **Faux positif de capture** : le docteur décide après vérification.
- **Compte suspendu** : toutes les RPC refusent l’accès.
- **Accessibilité** : la restriction MDM peut gêner certains usages ; prévoir un appareil de prêt ou une procédure d’exception.
- **Confidentialité** : le MDM est réservé aux appareils de l’école ; ne pas l’imposer à un iPhone personnel sans consentement.

## 10. Prérequis opérationnels

- Apple Business Manager et un MDM (Jamf, Intune, Mosyle ou équivalent).
- iPhone supervisés ; restriction de capture appliquée ; application distribuée par le MDM.
- Android : application distribuée par le Play Store, Managed Google Play ou un canal privé.
- Compte Apple Developer Program et Google Play Console.
- Parc d’appareils de prêt pour les étudiants sans téléphone compatible.
- Pilote avec au moins un Android et un iPhone supervisé avant le déploiement général.
- Procédure de support pour les appareils non conformes.

## 11. Critères d’acceptation

- [ ] Un étudiant sans accès actif ne peut pas lancer de QCM, même par appel direct.
- [ ] Une deuxième connexion révoque la première session.
- [ ] Un compte suspendu ne peut plus se connecter ni reprendre une série.
- [ ] Sur Android, une capture d’écran du QCM produit une image noire.
- [ ] Sur iPhone supervisé, une capture d’écran est bloquée par le MDM.
- [ ] Sur iPhone non supervisé, une capture déclenche un incident et une alerte au docteur.
- [ ] Le docteur peut suspendre un compte depuis un incident.
- [ ] Le retour QCM affiche le message et l’abandon reste compté.
- [ ] Un refresh reprend la même série sans nouveau comptage.
- [ ] Une série abandonnée ne peut pas être reprise.
- [ ] Le QCM n’est pas accessible depuis le site web.
- [ ] Aucune permission caméra n’est demandée.
- [ ] Les tests RLS/RPC couvrent les accès non autorisés.

## 12. Déploiement

1. **Phase 0 — Prérequis** : MDM, Apple Business Manager, comptes développeur, appareils de test, distribution.
2. **Phase 1 — Revue du spec** : validation par le demandeur.
3. **Phase 2 — Plan d’implémentation** : découpage en tâches avec critères de test.
4. **Phase 3 — Backend** : session unique, suspension, incidents, abandon, vérifications RLS/RPC.
5. **Phase 4 — Application mobile** : Android `FLAG_SECURE`, iPhone détection + conformité MDM, distribution.
6. **Phase 5 — Interface docteur** : incidents, suspension, journal.
7. **Phase 6 — Tests et pilote** : Android, iPhone supervisé, iPhone non supervisé, réseau, abandon, quota.
8. **Phase 7 — Déploiement** : appareils de prêt, communication, support.
9. **Phase 8 — Contenu** : créer ou rattacher les sujets par chapitre ; les deux anciens sujets sans chapitre doivent être traités avant l’ouverture des quiz par chapitre.

## 13. Risques résiduels

- Photo prise par un autre téléphone : non bloquable ; salle surveillée nécessaire pour les examens à fort enjeu.
- MDM mal configuré ou appareil non supervisé : la capture iPhone reste possible.
- Android rooté ou iPhone jailbreaké : contournement possible.
- Faux positifs de détection : suspension injustifiée si le docteur ne vérifie pas.
- Distribution de l’application : refus de store, mise à jour, appareils incompatibles.
- Modèle C : les étudiants doivent utiliser un appareil de l’école ou un appareil compatible ; prévoir des prêts.
- Confidentialité du MDM : acceptable seulement sur des appareils gérés.
- Absence de caméra : aucun proctoring vidéo.

## 14. Questions ouvertes

- Quel MDM et combien d’iPhone seront gérés ?
- Quelle distribution pour l’application : store public, B2B privé ou MDM ?
- Quelle durée de suspension et quelle procédure d’appel ?
- Le docteur reçoit-il les alertes en temps réel ou un résumé quotidien ?
- Peut-on réinitialiser un quota en cas de problème technique ? Avec quelle trace ?
- Combien d’appareils de prêt faut-il prévoir ?
- Le site web doit-il rester accessible pour le compte et l’historique, ou être totalement fermé ?
- Les examens à fort enjeu imposent-ils une salle surveillée ?

## 15. Prochaines étapes

1. Relire et valider ce spec.
2. Écrire le plan d’implémentation détaillé.
3. Mettre en place le pilote MDM.
4. Implémenter le backend, l’application mobile et l’interface docteur.
5. Tester les critères d’acceptation.
6. Préparer les sujets par chapitre et le déploiement.
