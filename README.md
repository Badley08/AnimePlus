# Anime Plus

<p align="center">
  <img src="app/assets/logo.svg" alt="Anime Plus Logo" width="120" height="120" />
</p>

<p align="center">
  <b>Application Android hybride moderne de streaming d'animes, synchronisation cloud et compression vidéo matérielle hors-ligne.</b>
</p>

<p align="center">
  <a href="https://github.com/Badley08/AnimePlus/releases/latest">
    <img src="https://img.shields.io/badge/Release-v1.3.1-00F0FF?style=for-the-badge&logo=android&logoColor=black" alt="Latest Release" />
  </a>
  <img src="https://img.shields.io/badge/Build-5-38BDF8?style=for-the-badge" alt="Build 5" />
  <img src="https://img.shields.io/badge/Platform-Android_8.0+_(API_26--37)-10B981?style=for-the-badge&logo=android&logoColor=white" alt="Android Platform" />
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GNU_GPL_v3.0-blue?style=for-the-badge" alt="GNU GPL v3.0" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Kotlin-2.4.21-7F52FF?style=flat-square&logo=kotlin&logoColor=white" alt="Kotlin" />
  <img src="https://img.shields.io/badge/Gradle-9.6.0-02303A?style=flat-square&logo=gradle&logoColor=white" alt="Gradle" />
  <img src="https://img.shields.io/badge/Java_JDK-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white" alt="Java JDK 21" />
  <img src="https://img.shields.io/badge/Media3-Transformer_1.3.1-FF007F?style=flat-square" alt="Media3 Transformer" />
  <img src="https://img.shields.io/badge/Player-Shaka_Player_&_HLS.js-00E5FF?style=flat-square" alt="Shaka Player" />
  <img src="https://img.shields.io/badge/Database-Firestore_REST_Cloud_Sync-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firestore" />
  <img src="https://img.shields.io/badge/Auth-Firebase_Auth_REST-FFA000?style=flat-square&logo=firebase&logoColor=black" alt="Firebase Auth" />
  <img src="https://img.shields.io/badge/UI_Design-Cyber_Glassmorphism-A855F7?style=flat-square" alt="Cyberpunk UI" />
</p>

---

## Sommaire

- [Présentation du Projet](#-présentation-du-projet)
- [Fonctionnalités Majeures](#-fonctionnalités-majeures)
- [Architecture Technique](#-architecture-technique)
- [Bypass & Intégration Sources](#-bypass--intégration-sources)
- [Expérience de Visionnage Netflix & Cloud Sync](#-expérience-de-visionnage-netflix--cloud-sync)
- [Installation & Téléchargement](#-installation--téléchargement)
- [Guide de Compilation](#-guide-de-compilation)
- [Feuille de Route & Historique](#-feuille-de-route--historique)
- [Licence & Mentions](#-licence--mentions)

---

## Présentation du Projet

**Anime Plus** est une plateforme multimédia Android indépendante conçue pour offrir une expérience de streaming d'animes fluide, rapide et exempte de publicités invasives.

L'application combine la puissance d'un moteur natif Android écrit en **Kotlin** (accélération matérielle, compression vidéo H.264 par Media3, téléchargements en tâche de fond) et la flexibilité d'une interface utilisateur web moderne en **HTML5 / CSS3 / JavaScript** animée avec **GSAP** et **Shaka Player**.

> **Projet Open Source** sous licence **GNU General Public License v3.0**.  
> **Conception & Idée originale** : **Strong**  
> **Architecture & Développement** : **Karlito**

---

## Fonctionnalités Majeures

### Catalogue & Recherche Instantanée
- **Sources Multiples Agrégées** : Accès transparent aux catalogues d'**Anime-Sama** et **VoirAnime** avec dédoublonnage intelligent.
- **Indexation Directe Sitemaps XML** : Recherche instantanée parmi plus de 10 000 animes sans latence.
- **Filtres Thématiques** : Filtrage immédiat par catégorie (**VF Uniquement**, **Shônen**, **Action**, **Seinen**, **Isekai**, **Tous**) et par source de diffusion.

### Expérience de Streaming Netflix
- **Reprise de Lecture Automatique** : Mémorisation de la position de visionnage à la seconde exacte lors du changement d'écran ou de l'arrêt de lecture.
- **Bannière Accueil « Reprendre la lecture »** : Accès direct en un clic au dernier épisode en cours avec vignette, numéro d'épisode et jauge de progression.
- **Lecteur Vidéo Plein Écran Paysage** :
  - Barre supérieure semi-transparente toujours accessible au tap.
  - Flèche de retour intégrée.
  - Interception système de la touche Retour (`window.onBackPressed()`) permettant de quitter d'abord le mode paysage sans interrompre la session.

### Authentification & Synchronisation Cloud
- **Comptes Utilisateurs Réels** : Connexion et inscription en ligne via Firebase Auth REST API (zéro simulation locale).
- **Assistant d'Inscription en 3 Étapes** :
  1. *Identifiants* : Adresse email et pseudonyme.
  2. *Sécurité* : Mot de passe chiffré avec confirmation.
  3. *Personnalisation* : Sélection parmi **36 emblèmes vectoriels Font Awesome** et choix de la source préférée.
- **Cloud Sync Firestore** : Sauvegarde et synchronisation automatique de l'historique de visionnage, des épisodes terminés et des animes favoris.
- **Gestion de Profil Complète** : Modification du nom, de l'emblème, réinitialisation de mot de passe par email et suppression définitive du compte.

### Mode Hors-Ligne & Compression Vidéo
- **Moteur de Téléchargement Dédié** : Téléchargement chunked via OkHttp en tâche de fond.
- **Compression Matérielle Intelligente** : Réduction drastique de l'espace de stockage grâce à `androidx.media3:media3-transformer` avec profils **480p**, **720p** et **1080p**.

### Interface & Accessibilité
- **Palette Graphique Cyber Glassmorphism** : Thème sombre électrique ultra-réactif avec dégradés néon et effets de verre acrylique.
- **Sélecteurs Visuels Réactifs** : Boutons de sources et de qualité avec états actifs lumineux immédiats.
- **Gestion des Animations** : Bascule dans les paramètres permettant de désactiver l'ensemble des animations (`reduce-motion`).
- **Mises à Jour & Retours In-App** : Consultation des notes de version directement dans l'application et formulaire d'évaluation (?/10) connecté à Firestore.

---

## Architecture Technique

```
┌────────────────────────────────────────────────────────┐
│                   Anime Plus App                       │
├───────────────────────────┬────────────────────────────┤
│     Couche Native         │      Couche Présentation   │
│       (Kotlin)            │      (HTML5 / CSS / JS)    │
├───────────────────────────┼────────────────────────────┤
│ • Android Activity Bridge │ • Shaka Player & HLS       │
│ • Media3 Transformer      │ • GSAP UI Animations       │
│ • OkHttp Background Engine│ • Firebase Auth REST       │
│ • LocalProxyServer (8888) │ • Firestore REST CloudSync │
│ • Hardware Acceleration   │ • Local Storage Fallback   │
└───────────────────────────┴────────────────────────────┘
```

### Arborescence Clé du Dépôt

```
AnimePlus/
├── android/                             # Projet Android Natif
│   ├── app/
│   │   ├── src/main/java/.../           # Code Kotlin (MainActivity, WebAppInterface, LocalProxyServer)
│   │   ├── src/main/assets/www/         # Assets WebView synchronisés (HTML/CSS/JS)
│   │   ├── src/main/res/                # Ressources Android, Adaptive Icons & keep.xml
│   │   └── build.gradle                 # Configuration Gradle (compileSdk 37, minSdk 26)
│   ├── animeplus-release.jks            # Keystore de signature release
│   └── settings.gradle                  # Gestion des plugins et dépendances
├── app/                                 # Sources Web & Client Hybride
│   ├── css/modern-ui.css                # Feuille de styles Cyberpunk & Glassmorphism
│   ├── js/scrapping/scrapping.js        # Moteur de scraping, bypass jeton Anime-Sama & VoirAnime
│   ├── js/services/storage.js           # Gestionnaire de persistance locale & historique
│   ├── js/services/cloud-sync.js        # Synchronisation Cloud Firestore REST API
│   ├── proxy.js                         # Serveur Proxy CORS local Node.js
│   └── index.html                       # Application Single-Page principale
├── TASK.md                              # Suivi de la feuille de route
├── CHANGELOG.md                         # Journal des versions et des modifications
├── LICENSE                              # Licence GNU General Public License v3.0
└── README.md                            # Documentation complète du projet
```

---

## Bypass & Intégration Sources

### Système Anime-Sama (Mise à jour 12/11/2026)
Anime-Sama utilise désormais une sécurisation dynamique basée sur des jetons éphémères (`epsJeton`) et des identifiants de liens obfusqués :
1. Extraction du jeton de session `epsJeton` et de la variable `epsMeta` depuis le script de la page de saison.
2. Résolution des flux protégés `lien:<id>` via requête HTTP POST/GET vers `https://anime-sama.to/api/lien.php?j=<jeton>&l=<id>`.
3. Injection automatique des en-têtes de sécurité requis (`Origin: https://anime-sama.to`, `Referer: https://anime-sama.to/`, `X-Requested-With: XMLHttpRequest`) à travers le proxy local.

---

## Installation & Téléchargement

L'APK précompilé et signé est disponible directement sur la page des [Releases GitHub](https://github.com/Badley08/AnimePlus/releases/latest).

### Téléchargement Rapide :
- Fichier : **`AnimePlus-v1.3.1.apk`**
- Version : **1.3.1 (Build 5)**
- Compatibilité : **Android 8.0 Oreo (API 26) à Android 15 (API 37)**
- Signature : **APK v1, v2 & v3 (Release signée avec keystore officiel)**

---

## Guide de Compilation

### Prérequis
- **Java Development Kit (JDK)** : Version 17 ou 21 (OpenJDK / JetBrains Runtime)
- **Gradle** : Version 9.6.0 ou supérieure
- **Android SDK** : Build-Tools 35.0.0, Compile SDK 37

### Commandes de Compilation

1. **Cloner le projet** :
   ```bash
   git clone https://github.com/Badley08/AnimePlus.git
   cd AnimePlus
   ```

2. **Synchroniser les assets web vers Android** :
   ```powershell
   Copy-Item -Recurse -Force app/* android/app/src/main/assets/www/
   ```

3. **Compiler l'APK Release signé** :
   ```powershell
   gradle.bat -p android assembleRelease
   ```

4. **Retrouver l'APK généré** :
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

---

## Tags & Mots-clés

`anime` • `streaming` • `android` • `kotlin` • `javascript` • `anime-sama` • `voiranime` • `shaka-player` • `hls` • `media3` • `firestore` • `firebase-auth` • `video-player` • `cyberpunk-ui` • `open-source`

---

## Licence & Mentions

Distribué sous la licence **GNU General Public License v3.0**. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.

<p align="center">
  <b>Anime Plus</b> — Développé avec passion par <b>Karlito</b> • Idée originale par <b>Strong</b>.
</p>
