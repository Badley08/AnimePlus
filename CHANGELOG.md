# Journal des Modifications (CHANGELOG) - Anime Plus

## [v1.0.0] - Architecture Hybride WebView & Kotlin Natif

### ⚡ Moteur & Performance Android
- **Projet Natif Kotlin** : Création de la base Android avec accélération matérielle, ciblé pour une réactivité maximale sur processeurs d'entrée de gamme (Tecno, MediaTek, vieux Snapdragon).
- **Module de Compression Vidéo Natif** : Intégration de `androidx.media3:media3-transformer` avec profil H.264 matériel (préréglages 480p, 720p, 1080p).
- **Téléchargement d'arrière-plan** : Moteur de stream chunked OkHttp avec callbacks directs JavaScript.
- **Vérificateur GitHub Releases** : Dialogue de mise à jour automatique avec lecture du changelog.

### 🎨 Interface Webview (HTML5 / CSS3 / JavaScript / GSAP)
- **Architecture par Composants** :
  - `Splash.js` : Animation du logo AnimePlus avec tracé GSAP (`strokeDashoffset`).
  - `Gate.js` : Écran de sécurité avec hashage SHA-256 (WebCrypto / fallback Kotlin), secousse en cas d'erreur et impulsion haptique.
  - `Home.js` : Reprise de lecture en un clic avec barre de progression + rails récents et favoris.
  - `Search.js` : Moteur de recherche réactif avec debounce et historique local.
  - `Detail.js` : Fiche anime complète, bascule fluide Saisons/Épisodes et actions (Lecture / Téléchargement).
  - `Player.js` : Lecteur vidéo intégré `<video>` avec barre de défilement, affichage du temps et sauvegarde de progression en temps réel.
  - `Library.js` : Gestion des favoris et des téléchargements hors-ligne.
  - `Settings.js` : Réglages de la qualité par défaut, source de scraping et recherche de mise à jour APK.
- **Thème sombre épuré** : Tokens CSS bleus électriques respectés selon la maquette MVP originale (`#2F6BFF` et `#070B16`).

