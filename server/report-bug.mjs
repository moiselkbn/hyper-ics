// POST /api/report-bug : envoie un signalement de bug par mail.
// La logique est ici ; api/report-bug.mjs ne fait que la brancher sur Resend.
import { HttpError, jsonNoStore, readJsonBody } from './http.mjs';

const MAX_LENGTH = 2000;

export async function reportBug(resend, request) {
  const body = await readJsonBody(request);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!description) throw new HttpError(400, 'Description manquante');
  if (description.length > MAX_LENGTH) throw new HttpError(400, `${MAX_LENGTH} caractères maximum`);

  await resend.send('Signalement de bug — HyperICS', description);
  return jsonNoStore({ ok: true });
}
