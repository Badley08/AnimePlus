# Anime Plus

Application Android privée pour organiser, rechercher, lire et compresser ses épisodes d'anime, avec un transfert direct entre téléphones prévu dans une version ultérieure.

**Idée par Strong. Développement par Karlito.**

> Anime Plus n'est ni à vendre ni à louer. Elle n'est pas publiée sur le Play Store et ne doit pas être partagée en dehors de ses deux utilisateurs.

---

## 1\. Objectifs

- Une application simple, rapide et sans publicité.  
- Retrouver un épisode en quelques secondes.  
- Réduire l'espace occupé par les vidéos grâce à la compression locale.  
- Fonctionner d'abord en local, sans dépendre d'Internet pour la lecture et l'organisation.

## 2\. Contenu et légalité

Anime Plus ne contient aucun connecteur vers des sites de streaming non autorisés.

- **Vidéos** : fichiers que l'utilisateur possède déjà sur son téléphone, importés via le sélecteur de fichiers Android (Storage Access Framework).  
- **Informations** : métadonnées (titre, synopsis, affiche, saisons, nombre d'épisodes) récupérées via une API publique comme AniList ou Jikan.  
- **Association** : l'utilisateur relie ses fichiers à une fiche, manuellement ou par détection du nom de fichier.

## 3\. Périmètre du MVP

Priorités de la première version :

1. Bibliothèque locale et lecteur vidéo.  
2. Recherche et fiches anime.  
3. Compression vidéo.

Reporté à plus tard : transfert Wi-Fi entre téléphones.

## 4\. Fonctionnalités

### 4.1 Verrouillage

- Écran de mot de passe au lancement, avec un mot de passe partagé entre les deux utilisateurs.  
- Retour clair : message d'erreur et vibration si le mot de passe est faux, animation de succès puis entrée animée s'il est correct.  
- Le mot de passe n'est jamais stocké en clair : on conserve un hash salé (SHA-256) dans le stockage sécurisé du téléphone.  
- Ce verrou est un filtre pour deux personnes, pas une protection forte.

### 4.2 Recherche

La recherche fonctionne par suggestions, jamais par résultats affichés automatiquement.

1. Champ vide : recherches récentes.  
2. Pendant la saisie : liste de suggestions avec le texte tapé mis en évidence, le type (film ou série), le nombre de saisons et d'épisodes, l'année et le genre.  
3. L'utilisateur touche la suggestion voulue pour ouvrir la fiche.  
4. Aucune suggestion : message explicite avec un conseil.

### 4.3 Fiche anime : saison puis épisode

La sélection distingue toujours la saison de l'épisode.

- Série à plusieurs saisons : puces « Saison 1, Saison 2, ... » puis liste des épisodes de la saison choisie.  
- Série à une saison : liste directe des épisodes.  
- Film : un seul élément « Film complet », sans saisons ni épisodes.  
- Chaque épisode affiche sa durée, sa taille, son état (original ou compressé) et deux actions : lire et compresser.

### 4.4 Lecteur

- Lecture et pause, barre de progression, reprise là où on s'est arrêté.  
- Basé sur ExoPlayer/Media3 via `react-native-video`.

### 4.5 Compression

Réalisée par **Media3 Transformer** dans un module natif Android : accélérée par le matériel, sans binaire FFmpeg à embarquer.

| Préréglage | Taille indicative par épisode de 24 min |
| :---- | :---- |
| 480p | environ 60 Mo |
| 720p | environ 90 Mo |
| 1080p | environ 180 Mo |

- Les tailles sont indicatives et dépendent de la vidéo d'origine.  
- Progression visible, annulation possible.  
- Le fichier original n'est jamais supprimé automatiquement : la suppression demande une confirmation manuelle.  
- FFmpeg (fork maintenu de `ffmpeg-kit` ou build personnalisé) reste une option si un besoin précis dépasse Media3.

### 4.6 Bibliothèque

- Grille des anime avec nombre d'épisodes et taille occupée.  
- Filtres : tout, favoris, à compresser.  
- Favoris, historique des recherches, progression de lecture.

### 4.7 Transfert entre téléphones (plus tard)

- Méthode principale : **Wi-Fi Direct**.  
- Méthode de secours : **LocalOnlyHotspot** avec QR code.  
- Le module `transfer` expose une interface commune pour pouvoir changer de méthode sans toucher au reste.  
- Vérification d'intégrité SHA-256, transfert par blocs et reprise après interruption.  
- La suppression de la copie de l'expéditeur demande toujours une confirmation.

### 4.8 Réglages et à propos

- Qualité de compression par défaut, dossier des vidéos, verrouillage.  
- Écran « À propos » : version, crédits (Idée par Strong, Dev par Karlito) et mention « ni à vendre ni à louer ».

## 5\. Modèle de données

```
Anime    id, titre, année, genre, synopsis, affiche, type (série | film), favori
Season   id, anime_id, numéro
Episode  id, season_id, numéro, durée, chemin_fichier, taille, compressé, position_lecture
Search   id, texte, date
```

Un film est un `Anime` de type `film` avec une saison et un épisode implicites.

## 6\. Technologies

| Technologie | Utilisation |
| :---- | :---- |
| React Native CLI (bare, sans Expo) | Application |
| TypeScript | Langage |
| React Navigation | Onglets du bas et pile d'écrans |
| `react-native-svg` | Logo et icônes vectorielles |
| SQLite (`op-sqlite` ou `react-native-sqlite-storage`) | Base locale |
| `react-native-video` (ExoPlayer/Media3) | Lecture |
| Module natif Kotlin avec Media3 Transformer | Compression |
| `react-native-document-picker` | Import des fichiers |
| API AniList ou Jikan | Métadonnées |
| Zustand | État de l'interface |

Version minimale : Android 8.0 (API 26).

## 7\. Structure du projet

```
AnimePlus/
├── src/
│   ├── components/   Logo and reusable UI
│   ├── screens/      Feature screens and unavailable-state screens
│   ├── media/        File import, player, and compression interfaces
│   ├── storage/      Local library state and search history
│   ├── transfer/     Transfer interface and Wi-Fi Direct adapter boundary
│   ├── services/     Remote catalog and release services
│   └── data/         Offline fallback catalog
└── android/
    └── .../compression/   Module natif Media3 Transformer
```

## 8\. Design

- Thème sombre uniquement, accent bleu électrique (`#2F6BFF`).  
- Conçu pour le mobile : onglets en bas, zones tactiles d'au moins 44 px, zones sûres respectées.  
- Maquette interactive de référence : `anime-plus-mvp.html` (tokens de couleurs, écrans, animations et données fictives).

## 9\. Principes

1. **Fiabilité** : ne jamais sacrifier les fichiers de l'utilisateur.  
2. **Simplicité** : une interface claire, des actions explicites.  
3. **Autonomie** : tout fonctionne en local autant que possible.  
4. **Performance** : éviter les traitements et requêtes inutiles.  
5. **Respect des droits** : contenus personnels de l'utilisateur et API publiques uniquement.

## 10\. État du projet

L'application TypeScript est initialisée dans ce dépôt avec React Native CLI bare, sans Expo. L'identifiant Android est `com.karlitodev.animeplus`.

- [x] Interface TypeScript : accueil, recherche, bibliothèque, fiche et réglages  
- [ ] Catalogue distant avec validation de données réelles  
- [x] Vérification des nouvelles releases GitHub depuis les réglages  
- [x] Workflow GitHub Actions de build Android et publication des APK tagués  
- [x] Workflow GitHub Actions de rafraîchissement du catalogue  
- [ ] Import SAF et association des fichiers locaux (interface préparée, pont natif à ajouter)  
- [ ] Lecteur Media3 et reprise de lecture (interface préparée, pont natif à ajouter)  
- [ ] Compression Media3 (interface préparée, module natif à ajouter)  
- [ ] Tests sur plusieurs téléphones  
- [ ] Transfert Wi-Fi

Les interfaces TypeScript de `src/media/`, `src/storage/` et `src/transfer/` délimitent les contrats de l'application. Elles signalent explicitement les fonctionnalités qui nécessitent encore un module Android natif au lieu de simuler une réussite. Cela permet de développer l'interface sans générer localement un APK. Aucun contenu de démonstration n'est inclus dans le catalogue ou dans le fallback hors connexion.

### Développement et build

Le build Android est volontairement exécuté par GitHub Actions, pas en local :

1. Créer un tag `vX.Y.Z` et le pousser.  
2. Le workflow `Build Android` génère l'APK release et le publie dans GitHub Releases.  
3. Dans l'application : **Réglages → Rechercher une mise à jour**.

Le workflow `Refresh metadata catalog` est planifié chaque lundi. Le script `scripts/scrape_catalog.py` utilise l'API publique Jikan pour collecter des métadonnées uniquement, ne télécharge aucune vidéo et ne contourne aucun anti-bot. Le catalogue est vide tant que le workflow n'a pas réussi une synchronisation. Les conditions d'utilisation de l'API doivent être revues avant toute utilisation réelle.

Les releases Android sont minifiées avec R8, obfusquées et construites avec la réduction des ressources activée dans GitHub Actions. Cela augmente le coût du reverse engineering sans constituer une protection absolue : les secrets ne doivent jamais être embarqués dans l'application.

---

**Anime Plus. Chercher. Regarder. Compresser. Partager.**