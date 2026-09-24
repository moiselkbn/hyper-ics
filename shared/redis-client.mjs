// Client Upstash Redis via l'API REST, sans dépendance.
// Chaque commande est une requête HTTPS : POST ["GET", "clé"] avec un jeton Bearer.
// L'adresse et le jeton viennent uniquement des variables d'environnement.
const REQUEST_TIMEOUT_MS = 10_000;

export function createRedisClient({
  url = process.env.UPSTASH_REDIS_REST_URL,
  token = process.env.UPSTASH_REDIS_REST_TOKEN,
  fetchImpl = fetch, // injectable pour les tests
} = {}) {
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN doivent être définies');
  }

  // Les messages d'erreur ne contiennent ni le jeton ni les clés (qui embarquent des hash d'élèves).
  async function command(...args) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      throw new Error(`Redis ${args[0]} : ${body.error ?? `HTTP ${response.status}`}`);
    }
    return body.result;
  }

  return {
    // Valeur brute, ou null si la clé n'existe pas.
    get: (key) => command('GET', key),
    set: (key, value) => command('SET', key, value),
    // Une valeur par clé, dans le même ordre ; null pour une clé absente.
    mget: async (keys) => (keys.length === 0 ? [] : command('MGET', ...keys)),
    // Nombre de clés supprimées (0 ou 1).
    del: (key) => command('DEL', key),

    // Toutes les valeurs du modèle sont du JSON stocké sous forme de texte.
    getJson: async (key) => parseJson(await command('GET', key)),
    // `expiresInSeconds` : Redis efface la clé tout seul après ce délai (SET … EX).
    setJson: (key, value, expiresInSeconds) =>
      expiresInSeconds
        ? command('SET', key, JSON.stringify(value), 'EX', expiresInSeconds)
        : command('SET', key, JSON.stringify(value)),
    mgetJson: async (keys) => (keys.length === 0 ? [] : (await command('MGET', ...keys)).map(parseJson)),
  };
}

const parseJson = (text) => (text === null ? null : JSON.parse(text));
