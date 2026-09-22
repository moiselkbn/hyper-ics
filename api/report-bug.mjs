// Fonction Vercel : POST /api/report-bug. La logique est dans server/ ; ce fichier ne fait que la brancher sur Resend.
import { createResendClient } from '../shared/resend-client.mjs';
import { respond } from '../server/http.mjs';
import { reportBug } from '../server/report-bug.mjs';

export const POST = (request) => respond(() => reportBug(createResendClient(), request));
