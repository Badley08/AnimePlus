# 📋 Feuille de Route AnimePlus v1.3.1 (Build 5)

- [x] **1. Architecture & Fichiers Clés Android**
  - [x] Document `TASK.md` de suivi des tâches
  - [x] Mise à jour des versions dans `build.gradle` (versionCode 5, versionName "1.3.1")
  - [x] Correction de l'icône de l'application Android (`ic_launcher` et `ic_launcher_round` dans `mipmap-anydpi-v26`) et `keep.xml`
  - [x] Définition propre du label d'application (`Anime Plus`) avec règles de conservation
  - [x] Désactivation explicite du flag `debuggable` (`debuggable = false`)

- [x] **2. Authentification Réelle & Sauvegarde Cloud (Sync Historique & Reprise)**
  - [x] Inscription & Connexion réelles via Firebase Auth REST API (email/mdp, réinitialisation, suppression de compte)
  - [x] Inscription par étapes (Étape 1: Compte -> Étape 2: Mot de passe -> Étape 3: Emblème Font Awesome & Source)
  - [x] Vraie synchronisation Cloud (`CloudSync` via Firestore REST API) : Historique de visionnage, Favoris et Reprise de lecture
  - [x] Plus de 35 emblèmes Font Awesome (zéro emoji)

- [x] **3. Expérience de Streaming Netflix (Reprise après arrêt & Historique)**
  - [x] Reprise fluide de lecture (seconde exacte et pourcentage mémorisés en continu avec `timeupdate`)
  - [x] Bloc "Reprendre la lecture" fonctionnel sur l'Accueil avec reprise directe au clic
  - [x] Réparation de l'onglet **Historique** dans la Bibliothèque (`#lib-tab-hist` & `#lib-tab-favs`) avec cartes détaillées, barre de progression et reprise au clic

- [x] **4. Résolution des Boutons & Filtres (Accueil, Recherche, Setup & Paramètres)**
  - [x] Boutons catégories Accueil : `VF UNIQUEMENT`, `SHONEN`, `ACTION`, `SEINEN`, `ISEKAI`, `TOUS` avec filtrage immédiat du rail de tendances
  - [x] Filtres de Recherche : `Tous`, `Anime-Sama`, `VoirAnime`, `VF Uniquement` avec filtrage immédiat des résultats
  - [x] Boutons sources Anime-Sama et VoirAnime au design compact et épuré
  - [x] Sélecteurs de sources (Setup & Paramètres) et de qualité : basculement visuel immédiat (.active / .btn-primary-glow) et persistance automatique dans Storage

- [x] **5. Réparation Lecteur Vidéo & Proxy**
  - [x] Correction du flux Anime-Sama : injection du jeton `epsJeton` et résolution des identifiants `lien:<id>` via `api/lien.php`
  - [x] Serveur proxy local opérationnel sur les ports 8888 et 8787 avec en-têtes `Origin` et `X-Requested-With` pour Anime-Sama
  - [x] Mode Plein Écran Paysage : barre supérieure semi-transparente toujours accessible au tap, bouton retour et gestion `onBackPressed` pour quitter le plein écran sans fermer l'app

- [x] **6. Téléchargements In-App**
  - [x] Moteur de téléchargement in-app avec `AndroidDownload.downloadAndCompress`, notifications de progression et téléchargement direct fallback

- [x] **7. Mises à Jour & Release Notes v1.3.1 Sans Emoji**
  - [x] Vérification des MAJ in-app affichant les notes de version directement dans l'application
  - [x] Release notes élégantes 100% Font Awesome (aucun emoji)

- [x] **8. Interface d'Avis / Évaluation In-App (?/10)**
  - [x] Modal de retour utilisateur avec note sur 10 étoiles, ressenti et commentaires envoyés sur Firestore

- [x] **9. Système d'Animations & Option Paramètres**
  - [x] Animations d'interface fluides (GSAP & transitions CSS)
  - [x] Option dans Paramètres pour activer / désactiver toutes les animations (`reduce-motion`)

- [x] **10. Compilation Release v1.3.1 & Déploiement GitHub**
  - [x] Synchronisation complète des assets vers `android/app/src/main/assets/www/`
  - [x] Compilation APK Release v1.3.1 (Build 5) avec Gradle 9.6.0 (`AnimePlus-v1.3.1.apk`)
  - [x] Documentation complète : README.md avec shields GitHub, CHANGELOG.md sans emoji, LICENSE GNU GPL 3.0
  - [x] Publication de la release v1.3.1 sur GitHub avec l'APK et les release notes
