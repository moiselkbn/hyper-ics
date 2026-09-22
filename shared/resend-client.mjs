// Client Resend via son API REST, sans dépendance.
// Offre gratuite : sans domaine vérifié, seule l'adresse du compte Resend peut recevoir un mail,
// d'où `to` fixé une fois pour toutes ici (BUG_REPORT_EMAIL) plutôt que passé à chaque envoi.
const REQUEST_TIMEOUT_MS = 10_000;

export function createResendClient({
  apiKey = process.env.RESEND_API_KEY,
  to = process.env.BUG_REPORT_EMAIL,
  fetchImpl = fetch, // injectable pour les tests
} = {}) {
  if (!apiKey || !to) {
    throw new Error('RESEND_API_KEY et BUG_REPORT_EMAIL doivent être définies');
  }

  return {
    async send(subject, text) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'HyperICS <onboarding@resend.dev>', to, subject, text }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Resend : HTTP ${response.status}`);
    },
  };
}
