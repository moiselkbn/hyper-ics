// POST /api/report-bug : envoie un signalement de bug par mail.
// La logique est ici ; api/report-bug.mjs ne fait que la brancher sur Resend.
import { HttpError, jsonNoStore } from './http.mjs';

const MAX_LENGTH = 2000;

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Corps JSON invalide');
  }
}

export async function reportBug(resend, request) {
  const body = await readBody(request);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!description) throw new HttpError(400, 'Description manquante');
  if (description.length > MAX_LENGTH) throw new HttpError(400, `${MAX_LENGTH} caractères maximum`);

  await resend.send('Signalement de bug — HyperICS', description);
  return jsonNoStore({ ok: true });
}
