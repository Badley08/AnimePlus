# Journal des Versions (CHANGELOG) — Anime Plus

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.3.1-00F0FF?style=for-the-badge&logo=android&logoColor=black" alt="Release v1.3.1" />
  <img src="https://img.shields.io/badge/Build-5-38BDF8?style=for-the-badge" alt="Build 5" />
  <img src="https://img.shields.io/badge/Platform-Android_8.0+-10B981?style=for-the-badge&logo=android&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/License-GNU_GPL_v3.0-blue?style=for-the-badge" alt="License" />
</p>

Ce document recense l'historique exhaustif des modifications, corrections, évolutions architecturales et fonctionnalités apportées à chaque version de l'application **Anime Plus**.

---

## [<img src="https://img.shields.io/badge/v1.3.1_Build_5-2026--11--22-00F0FF?style=flat-square" alt="v1.3.1" />](https://github.com/Badley08/AnimePlus/releases/tag/v1.3.1) — Streaming Netflix, Cloud Sync & Refonte des Sélecteurs

<p>
  <img src="https://img.shields.io/badge/Type-Feature_&_Bugfix-00F0FF?style=flat-square" alt="Feature & Bugfix" />
  <img src="https://img.shields.io/badge/Sources-Anime--Sama_%7C_VoirAnime-A855F7?style=flat-square" alt="Sources" />
  <img src="https://img.shields.io/badge/Player-Shaka_Player_%7C_Media3-38BDF8?style=flat-square" alt="Player" />
  <img src="https://img.shields.io/badge/Cloud-Firebase_Auth_%7C_Firestore_REST-F59E0B?style=flat-square" alt="Cloud" />
</p>

### Streaming & Lecteur Vidéo
- **Bypass Jeton Dynamique Anime-Sama** : Intégration du système du 12/11/2026 d'Anime-Sama. Extraction du jeton de session `epsJeton` et résolution des identifiants `lien:<id>` via `https://anime-sama.to/api/lien.php` avec en-têtes `Origin` et `Referer` obligatoires.
- **Expérience de Visionnage Netflix** :
  - Mémorisation en continu de la progression de lecture au centième de seconde près via l'événement `timeupdate`.
  - Reprise automatique transparente (`onloadedmetadata`) de là où la lecture s'était arrêtée.
  - Carte interactive **« Reprendre la lecture »** intégrée sur la page d'Accueil avec illustration, épisode, pourcentage et reprise directe en un clic.
- **Mode Plein Écran Paysage Optimisé** :
  - Maintien d'une barre supérieure semi-transparente toujours accessible au tap pour révéler la flèche de retour et le bouton de sortie plein écran.
  - Interception système de `window.onBackPressed()` pour sortir d'abord du mode paysage avant de quitter le lecteur ou l'application.

### Synchronisation Cloud & Comptes Utilisateurs
- **Inscription & Connexion Réelles** : Authentification en ligne gérée via Firebase Auth REST API (email/mot de passe, réinitialisation de mot de passe par lien email, suppression définitive de compte).
- **Parcours d'Inscription par Étapes** : Assistant moderne guidé en 3 étapes :
  1. Identifiants de connexion (Email, Nom d'utilisateur).
  2. Mot de passe avec confirmation et validation en direct.
  3. Choix de l'emblème parmi 36 icônes vectorielles et sélection de la source préférée.
- **Cloud Sync Firestore** : Synchronisation temps réel de l'historique complet des épisodes visionnés, de la progression de lecture et des animes favoris.
- **Double Onglet Bibliothèque** :
  - Onglet **Favoris** (`#lib-tab-favs`) : Liste des séries enregistrées.
  - Onglet **Historique** (`#lib-tab-hist`) : Suivi des animes regardés avec progression en pourcentage et reprise instantanée.

### Interface, Sélecteurs & Expérience Utilisateur
- **Sélecteurs Interactifs Réactifs** :
  - Correction de l'état actif (`.active` / `.on` en cyan lumineux) pour le choix des sources : **Toutes**, **Anime-Sama** et **VoirAnime**.
  - Prise en charge uniforme dans la création de profil, la modification de compte et les réglages de l'application.
  - Sélecteur de qualité de téléchargement et de streaming (**480p**, **720p**, **1080p**) avec retour visuel immédiat et persistance `Storage`.
- **Filtres de Catalogue et de Recherche** :
  - Accueil : Boutons de catégories instantanés (**Tous**, **VF Uniquement**, **Shônen**, **Action**, **Seinen**, **Isekai**).
  - Recherche : Filtres immédiats par source (**Tous**, **Anime-Sama**, **VoirAnime**, **VF**).
- **Mises à Jour In-App** : Consultation des notes de version directement depuis l'application via GitHub API sans redirection externe.
- **Évaluation Utilisateur (?/10)** : Modal intégrée pour recueillir l'avis et la note des utilisateurs, transmise directement à Firestore.
- **Accessibilité & Animations** : Option dans les paramètres pour activer ou désactiver l'ensemble des animations de l'interface (`reduce-motion`).

### Packaging & Sécurité Android
- **Icônes Adaptatives Android** : Création des ressources vectorielles `ic_launcher.xml` et `ic_launcher_round.xml` dans `mipmap-anydpi-v26`.
- **Règles de Conservation R8 / ProGuard** : Ajout de `keep.xml` pour préserver les ressources d'icônes et assets Web.
- **Sécurité Build** : Flag `debuggable` explicitement positionné à `false`.

---

## [<img src="https://img.shields.io/badge/v1.1.0-2026--11--14-38BDF8?style=flat-square" alt="v1.1.0" />](https://github.com/Badley08/AnimePlus/releases/tag/v1.1.0) — Indexation Sitemaps & Recherche Instantanée

<p>
  <img src="https://img.shields.io/badge/Type-Enhancement-38BDF8?style=flat-square" alt="Enhancement" />
  <img src="https://img.shields.io/badge/Scraping-Sitemaps_XML-10B981?style=flat-square" alt="Sitemaps XML" />
  <img src="https://img.shields.io/badge/Search-Client--Side_Cache-6366F1?style=flat-square" alt="Search Cache" />
</p>

### Scraping & Indexation
- **Indexation Directe Sitemaps** : Analyse et mise en cache des catalogues complets issus des sitemaps XML d'Anime-Sama et de VoirAnime.
- **Moteur de Recherche Instantané** : Recherche instantanée côté client sur plus de 10 000 titres sans latence réseau.
- **Normalisation des Noms d'Animes** : Algorithme de nettoyage des titres pour un dédoublonnage intelligent entre plusieurs catalogues.

### Réseau & Proxy
- **Routage Proxy Robuste** : Amélioration du pipeline proxy local Node.js (`proxy.js`) avec fallbacks automatisés en cas de blocage CORS.
- **Protection Anti-Redirection Iframe** : Isolation stricte de l'iframe de lecture avec attributs sandbox sécurisés pour bloquer les redirections intrusives.

---

## [<img src="https://img.shields.io/badge/v1.0.0--beta-2026--11--09-10B981?style=flat-square" alt="v1.0.0-beta" />](https://github.com/Badley08/AnimePlus/releases/tag/v1.0.0-beta) — Architecture Hybride WebView & Kotlin Natif

<p>
  <img src="https://img.shields.io/badge/Type-Initial_Release-10B981?style=flat-square" alt="Initial Release" />
  <img src="https://img.shields.io/badge/Architecture-Kotlin_+_WebView-8B5CF6?style=flat-square" alt="Architecture" />
  <img src="https://img.shields.io/badge/Compression-Media3_Transformer-EC4899?style=flat-square" alt="Media3 Transformer" />
</p>

### Moteur Android & Compression
- **Socle Android Hybride** : Développement du conteneur Kotlin accéléré matériellement pour processeurs mobiles à ressources modérées.
- **Compression Vidéo Matérielle** : Implémentation du module `androidx.media3:media3-transformer` avec profils d'encodage H.264 (480p, 720p, 1080p).
- **Gestionnaire de Téléchargement** : Téléchargement chunked via OkHttp avec pont de communication JavaScript bidirectionnel (`WebAppInterface`).

### Interface Utilisateur Fondatrice
- **Design Cyberpunk & Dark Mode** : Palette graphique électrique (`#00F0FF`, `#070B14`, `#121826`) optimisée pour dalles OLED.
- **Écran de Verrouillage (Gate)** : Authentification locale par mot de passe partagé sécurisé en SHA-256 avec animations haptiques.
- **Composants Fondamentaux** : Splash screen animé, fiche détaillée, sélecteur d'épisodes et de lecteurs, favoris locaux.

---

<p align="center">
  <b>Anime Plus</b> — Projet Open-Source sous licence <a href="LICENSE">GNU GPL v3.0</a>.<br />
  Développé par <b>Karlito</b> • Idée originale par <b>Strong</b>.
</p>
