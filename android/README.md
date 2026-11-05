# Application Android MEDQCM

Application installable par lien (APK), sans Play Store.

- Nom affiché sur l'écran d'accueil : **MEDQCM**
- Icône : même logo noir/blanc que le site
- URL chargée : `https://medecineqcm.vercel.app/`
- Lien court d'installation (Vercel) : `https://medecineqcm.vercel.app/medqcm.apk`
- Les captures d'écran et l'enregistrement d'écran affichent un écran noir grâce à `FLAG_SECURE`.
- Le bouton retour Android envoie l'événement `medqcm:request-exit` au site : le QCM affiche « Voulez-vous vraiment quitter ? Ce QCM compte une série même si vous revenez. »

## Construire l'APK

Prérequis : JDK et Android SDK avec `build-tools` et platform `android-35`.

```bash
bash android/build-apk.sh
```

Résultat :

```text
android/output/medqcm.apk
```

Le script utilise le SDK Android local, compile les ressources, le Java, dex, zipalign et signe avec un keystore de debug local (`android/build/debug.keystore`, non commité).

## Installation sur un Android de test

1. Copier ou héberger `android/output/medqcm.apk`.
2. Ouvrir le lien sur le téléphone Android.
3. Autoriser l'installation depuis cette source si le téléphone le demande.
4. Ouvrir l'icône **MEDQCM**.

## Migration Supabase à appliquer

Avant d'utiliser la session unique en production, exécuter :

```text
supabase/migrations/20261106_active_sessions.sql
```

Sans cette migration, l'application fonctionne mais la session unique n'est pas appliquée côté serveur.

Pour que le docteur voie les étoiles/commentaires des étudiants, exécuter aussi :

```text
supabase/migrations/20261106_series_feedback.sql
```

Sans cette migration, les avis restent sur le téléphone de l'étudiant.
