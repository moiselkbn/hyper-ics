// Copier ou partager un lien de l'abonnement. Chaque fonction renvoie le message à afficher à l'élève.
export const LINK_COPIED = 'Lien copié.';
const COPY_FAILED = 'Impossible de copier, sélectionne le lien à la main.';

export async function copyText(text: string, copied = LINK_COPIED): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
    return copied;
  } catch {
    return COPY_FAILED;
  }
}

// Sur mobile, ouvre la feuille de partage native (Messages, Mail, WhatsApp…) ; sans support (la plupart
// des navigateurs desktop), on retombe sur la copie. Renvoie '' si partagé ou annulé.
export async function shareOrCopy(url: string): Promise<string> {
  if (!navigator.share) return copyText(url);
  try {
    await navigator.share({ url, title: 'Mon calendrier HyperICS' });
  } catch {
    // Annulé par l'élève : rien à faire.
  }
  return '';
}
