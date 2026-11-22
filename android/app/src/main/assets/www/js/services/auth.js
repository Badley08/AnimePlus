const FirebaseAuthService = (() => {
  const SESSION_KEY = 'ap_firebase_session_v1';
  const API_BASE = 'https://identitytoolkit.googleapis.com/v1';
  const TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
  let currentUser = null;

  function apiKey() {
    const key = window.FirebaseConfig && window.FirebaseConfig.apiKey;
    if (!key) throw new Error('La configuration Firebase est manquante.');
    return key;
  }

  function authError(code) {
    const normalizedCode = String(code || '').split(':')[0];
    const messages = {
      EMAIL_EXISTS: 'Cette adresse e-mail possède déjà un compte. Connecte-toi plutôt.',
      INVALID_EMAIL: 'Cette adresse e-mail est invalide.',
      WEAK_PASSWORD: 'Choisis un mot de passe d’au moins 8 caractères.',
      EMAIL_NOT_FOUND: 'Aucun compte ne correspond à cette adresse e-mail.',
      INVALID_PASSWORD: 'Adresse e-mail ou mot de passe incorrect.',
      INVALID_LOGIN_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
      CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Reconnecte-toi puis réessaie de supprimer le compte.',
      USER_DISABLED: 'Ce compte est désactivé.',
      OPERATION_NOT_ALLOWED: 'L’inscription par e-mail n’est pas activée pour ce projet Firebase.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Trop de tentatives. Réessaie plus tard.',
      API_KEY_INVALID: 'La configuration Firebase est invalide.',
      EXPIRED_OOB_CODE: 'Le lien de réinitialisation a expiré.'
    };
    if (messages[normalizedCode]) return messages[normalizedCode];
    if (normalizedCode === 'NETWORK_REQUEST_FAILED') return 'Connexion au service de comptes impossible. Vérifie ta connexion.';
    return 'Le service de comptes a refusé la demande. Réessaie plus tard.';
  }

  async function request(url, body, contentType = 'application/json') {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: contentType === 'application/json' ? JSON.stringify(body) : body
      });
    } catch (error) {
      throw new Error('Connexion au service de comptes impossible. Vérifie ta connexion.');
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('Réponse invalide du service de comptes.');
    }
    if (!response.ok) {
      const code = data && data.error && data.error.message;
      throw new Error(authError(String(code || '')));
    }
    return data;
  }

  function readSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      if (!session || !session.refreshToken || !session.user || !session.user.email) {
        throw new Error('Session de compte invalide.');
      }
      return session;
    } catch (error) {
      localStorage.removeItem(SESSION_KEY);
      throw new Error('La session enregistrée est invalide. Connecte-toi à nouveau.');
    }
  }

  function makeUser(data, fallback = {}) {
    return {
      uid: data.localId || data.user_id || fallback.uid || '',
      email: data.email || fallback.email || '',
      displayName: data.displayName || fallback.displayName || ''
    };
  }

  function saveSession(data, user, previous = {}) {
    const idToken = data.idToken || data.id_token || previous.idToken || '';
    const refreshToken = data.refreshToken || data.refresh_token || previous.refreshToken || '';
    const expiresIn = Number(data.expiresIn || data.expires_in || 3600);
    if (!idToken || !refreshToken || !user.email) {
      throw new Error('Le service de comptes a renvoyé une session incomplète.');
    }
    currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      idToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      user
    }));
    return user;
  }

  async function signUp(email, password, displayName) {
    const data = await request(
      `${API_BASE}/accounts:signUp?key=${encodeURIComponent(apiKey())}`,
      { email, password, returnSecureToken: true }
    );
    const initialUser = makeUser(data, { email, displayName });
    saveSession(data, initialUser);

    try {
      return { user: await updateProfile(displayName), warning: '' };
    } catch (error) {
      return {
        user: initialUser,
        warning: `Compte créé, mais le nom de profil n’a pas pu être enregistré : ${error.message}`
      };
    }
  }

  async function signIn(email, password) {
    const data = await request(
      `${API_BASE}/accounts:signInWithPassword?key=${encodeURIComponent(apiKey())}`,
      { email, password, returnSecureToken: true }
    );
    const user = makeUser(data);
    saveSession(data, user);
    return user;
  }

  async function updateProfile(displayName) {
    const session = readSession();
    if (!session || !session.idToken) throw new Error('Connecte-toi pour modifier ton profil.');
    const data = await request(
      `${API_BASE}/accounts:update?key=${encodeURIComponent(apiKey())}`,
      { idToken: session.idToken, displayName, returnSecureToken: true }
    );
    const user = makeUser(data, { ...session.user, displayName });
    saveSession(data, user, session);
    return user;
  }

  async function sendPasswordReset(email) {
    try {
      await request(
        `${API_BASE}/accounts:sendOobCode?key=${encodeURIComponent(apiKey())}`,
        { requestType: 'PASSWORD_RESET', email }
      );
    } catch (error) {
      if (error.message.includes('Aucun compte ne correspond')) return;
      throw error;
    }
  }

  async function restoreSession() {
    const session = readSession();
    if (!session) {
      currentUser = null;
      return null;
    }
    if (session.idToken && session.expiresAt > Date.now() + 30_000) {
      currentUser = session.user;
      return currentUser;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken
    }).toString();
    const refreshed = await request(
      `${TOKEN_URL}?key=${encodeURIComponent(apiKey())}`,
      body,
      'application/x-www-form-urlencoded'
    );
    const tokenSession = {
      ...session,
      idToken: refreshed.id_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(tokenSession));

    const profile = await request(
      `${API_BASE}/accounts:lookup?key=${encodeURIComponent(apiKey())}`,
      { idToken: tokenSession.idToken }
    );
    const account = profile.users && profile.users[0];
    if (!account) throw new Error('Le compte distant est introuvable. Connecte-toi à nouveau.');
    return saveSession(refreshed, makeUser(account, session.user), tokenSession);
  }

  async function getIdToken() {
    let session = readSession();
    if (!session) throw new Error('Connecte-toi avant d’envoyer ton avis.');
    if (!session.idToken || session.expiresAt <= Date.now() + 30_000) {
      await restoreSession();
      session = readSession();
    }
    if (!session || !session.idToken) throw new Error('La session du compte est expirée. Connecte-toi à nouveau.');
    return session.idToken;
  }

  function signOut() {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  }

  async function deleteAccount() {
    const idToken = await getIdToken();
    await request(
      `${API_BASE}/accounts:delete?key=${encodeURIComponent(apiKey())}`,
      { idToken }
    );
    signOut();
  }

  return {
    signUp,
    signIn,
    updateProfile,
    sendPasswordReset,
    restoreSession,
    getIdToken,
    deleteAccount,
    signOut,
    getCurrentUser: () => currentUser
  };
})();
