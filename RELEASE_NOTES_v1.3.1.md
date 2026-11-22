## Anime Plus v1.3.1 (Build 5) — Streaming Netflix, Cloud Sync & Optimisations

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.3.1-00F0FF?style=for-the-badge&logo=android&logoColor=black" alt="Release v1.3.1" />
  <img src="https://img.shields.io/badge/Build-5-38BDF8?style=for-the-badge" alt="Build 5" />
  <img src="https://img.shields.io/badge/Platform-Android_8.0+-10B981?style=for-the-badge&logo=android&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/License-GNU_GPL_v3.0-blue?style=for-the-badge" alt="License" />
</p>

### Nouveautés & Évolutions Majeures

#### Streaming & Lecteur Vidéo
- **Support du Nouveau Système Anime-Sama** : Prise en charge du système du 12/11/2026 avec extraction de `epsJeton` et résolution des liens `lien:<id>` via `api/lien.php`.
- **Expérience de Lecture Type Netflix** :
  - Reprise de lecture instantanée mémorisée au centième de seconde près via `timeupdate`.
  - Carte interactive **« Reprendre la lecture »** sur l'Accueil avec progression en pourcentage.
- **Mode Plein Écran Paysage Optimisé** :
  - Barre supérieure semi-transparente toujours accessible au tap.
  - Flèche de retour et bouton de sortie plein écran.
  - Gestion de `window.onBackPressed()` pour sortir d'abord du paysage sans quitter l'application.

#### Authentification & Synchronisation Cloud
- **Comptes Utilisateurs Réels** : Connexion, inscription et réinitialisation de mot de passe via Firebase Auth REST API.
- **Assistant d'Inscription par Étapes** : Parcours guidé en 3 étapes avec sélection parmi 36 emblèmes Font Awesome.
- **Cloud Sync Firestore** : Synchronisation continue de l'historique de visionnage, de la reprise et des favoris.
- **Double Onglet Bibliothèque** : Onglet **Favoris** et onglet **Historique** avec barres d'avancement.
- **Suppression Définitive de Compte** : Option sécurisée pour supprimer son profil et ses avis.

#### Interface, Sélecteurs & Réglages
- **Sélecteurs Visuels Réactifs** : Bascule immédiate de l'accentuation active (.active / glow) pour les sources (Accueil, Setup, Paramètres) et la qualité (480p, 720p, 1080p).
- **Filtres Thématiques** : Filtres d'Accueil (VF Uniquement, Shônen, Action, Seinen, Isekai, Tous) et filtres de recherche.
- **Vérification des MAJ In-App** : Affichage direct des notes de version depuis GitHub sans redirection.
- **Évaluation Utilisateur (?/10)** : Interface intégrée pour noter l'application et envoyer son avis sur Firestore.
- **Accessibilité** : Option pour désactiver l'ensemble des animations (`reduce-motion`).

#### Android & Packaging
- Icônes adaptatives Android (`ic_launcher` et `ic_launcher_round` dans `mipmap-anydpi-v26`).
- Règles de conservation R8 (`keep.xml`).
- Désactivation explicite du flag `debuggable` (`debuggable = false`).
- Compilation optimisée avec Gradle 9.6.0.

---

### Informations sur l'APK
- **Fichier** : `AnimePlus-v1.3.1.apk`
- **Taille** : ~6.5 Mo
- **Architecture** : Universelle (armeabi-v7a, arm64-v8a, x86, x86_64)
- **Signature** : APK Signature Scheme v1, v2 & v3 (Release signée avec keystore officiel)
