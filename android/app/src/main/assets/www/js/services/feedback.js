const FeedbackService = (() => {
  async function submit({ rating, feeling, comment, version }) {
    const user = FirebaseAuthService.getCurrentUser();
    if (!user || !user.uid) throw new Error('Connecte-toi avant d’envoyer ton avis.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      throw new Error('Choisis une note de 1 à 10.');
    }
    if (!['satisfied', 'okay', 'frustrated', 'confused'].includes(feeling)) {
      throw new Error('Choisis ton ressenti pour continuer.');
    }

    const config = window.FirebaseConfig;
    if (!config || !config.projectId) throw new Error('La configuration Firebase est manquante.');
    const token = await FirebaseAuthService.getIdToken();
    const documentId = `${user.uid}_${version}`;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents:commit`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          writes: [{
            update: {
              name: `projects/${config.projectId}/databases/(default)/documents/feedback/${documentId}`,
              fields: {
                uid: { stringValue: user.uid },
                rating: { integerValue: String(rating) },
                feeling: { stringValue: feeling },
                comment: { stringValue: String(comment || '').trim().slice(0, 1000) },
                appVersion: { stringValue: version }
              }
            },
            updateTransforms: [{
              fieldPath: 'createdAt',
              setToServerValue: 'REQUEST_TIME'
            }],
            currentDocument: { exists: false }
          }]
        })
      });
    } catch (error) {
      throw new Error('Connexion à Firestore impossible. Vérifie ta connexion.');
    }

    let result = {};
    try {
      result = await response.json();
    } catch (error) {
      if (response.ok) throw new Error('Réponse invalide du service de retours.');
    }
    if (response.status === 409 || (result.error && result.error.status === 'ALREADY_EXISTS')) {
      return { alreadySubmitted: true };
    }
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('L’envoi est refusé par Firestore. Vérifie que la base et ses règles sont déployées.');
      }
      if (response.status === 401) throw new Error('La session du compte est expirée. Reconnecte-toi.');
      throw new Error('Impossible d’envoyer ton avis. Réessaie plus tard.');
    }
    return { alreadySubmitted: false };
  }

  async function deleteForCurrentUser() {
    const user = FirebaseAuthService.getCurrentUser();
    if (!user || !user.uid) throw new Error('Connecte-toi avant de supprimer ton compte.');
    const config = window.FirebaseConfig;
    if (!config || !config.projectId) throw new Error('La configuration Firebase est manquante.');
    const token = await FirebaseAuthService.getIdToken();
    const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)`;
    let response;
    try {
      response = await fetch(`${root}/documents:runQuery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'feedback' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'uid' },
                op: 'EQUAL',
                value: { stringValue: user.uid }
              }
            }
          }
        })
      });
    } catch (error) {
      throw new Error('Connexion à Firestore impossible. Vérifie ta connexion.');
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Impossible de supprimer les avis. Déploie les règles Firestore permettant à chaque utilisateur de supprimer ses propres avis.');
      }
      if (response.status === 401) throw new Error('La session du compte est expirée. Reconnecte-toi.');
      throw new Error('Impossible de retrouver les avis associés à ce compte.');
    }

    let entries;
    try {
      entries = await response.json();
    } catch (error) {
      throw new Error('Réponse invalide du service Firestore.');
    }
    if (!Array.isArray(entries)) throw new Error('Réponse invalide du service Firestore.');

    const expectedPrefix = `projects/${config.projectId}/databases/(default)/documents/feedback/`;
    for (const entry of entries) {
      if (entry && entry.error) throw new Error('Firestore n’a pas pu lire tous les avis associés à ce compte.');
      const name = entry && entry.document && entry.document.name;
      if (!name) continue;
      if (!name.startsWith(expectedPrefix)) throw new Error('Firestore a renvoyé un avis inattendu.');
      const documentUid = entry.document.fields && entry.document.fields.uid && entry.document.fields.uid.stringValue;
      if (documentUid !== user.uid) throw new Error('Firestore a renvoyé un avis qui n’appartient pas à ce compte.');
      const documentId = name.slice(expectedPrefix.length);
      if (!documentId || documentId.includes('/')) throw new Error('Firestore a renvoyé un identifiant d’avis invalide.');

      let deleteResponse;
      try {
        deleteResponse = await fetch(`${root}/documents/feedback/${encodeURIComponent(documentId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        throw new Error('Connexion à Firestore impossible pendant la suppression des avis.');
      }
      if (!deleteResponse.ok) {
        if (deleteResponse.status === 403) {
          throw new Error('Firestore a refusé la suppression des avis. Vérifie ses règles puis réessaie.');
        }
        if (deleteResponse.status === 401) throw new Error('La session du compte est expirée. Reconnecte-toi.');
        throw new Error('Impossible de supprimer les avis associés à ce compte.');
      }
    }
  }

  return { submit, deleteForCurrentUser };
})();
