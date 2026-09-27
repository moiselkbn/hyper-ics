// Surveillance des libellés de promotion d'Hyperplanning, d'un scrap au suivant.
// Une promotion du périmètre qui disparaît laisse ses élèves sur un planning figé : l'API ne la suit d'elle-même que si
// son nouveau libellé ne diffère que par la casse, les espaces ou les tirets (voir server/subscription.mjs,
// withCurrentLabels). Pour tout le reste (vrai changement de nom, nouvelle promotion hors des motifs), il faut
// intervenir à la main : on compare donc la liste complète des libellés, périmètre ou non, à celle du passage
// précédent, et on prévient par mail. Chaque changement n'est signalé qu'une fois : la liste n'est réécrite qu'une
// fois le mail parti.
import { PROMOTION_LABELS_KEY } from '../shared/redis-keys.mjs';
import { isInWatersideScope, simplifyPromotionLabel } from './campus-scope.mjs';

// `previous`, `current` : tous les libellés, du passage précédent et de celui-ci.
// - `vanished` : promotions du périmètre disparues sans correspondance ; leurs élèves restent sur l'ancien planning ;
// - `renamed` : [ancien, nouveau] au même libellé simplifié, déjà suivis par l'API ;
// - `added` : nouvelles promotions du périmètre, proposées d'elles-mêmes dans l'app ;
// - `unknown` : nouveaux libellés hors périmètre, peut-être une promotion renommée ou un cursus sans motif.
// Une promotion disparue hors du périmètre (Droit, Comptabilité…) n'est pas signalée.
export function describePromotionChanges(previous, current) {
  const before = new Set(previous);
  const now = new Set(current);
  const disappeared = previous.filter((label) => !now.has(label) && isInWatersideScope(label));
  const appeared = current.filter((label) => !before.has(label));

  const inScope = current.filter(isInWatersideScope);
  const renamed = [];
  const vanished = [];
  for (const label of disappeared) {
    const matches = inScope.filter((candidate) => simplifyPromotionLabel(candidate) === simplifyPromotionLabel(label));
    if (matches.length === 1) renamed.push([label, matches[0]]);
    else vanished.push(label);
  }
  const targets = new Set(renamed.map(([, label]) => label));
  const fresh = appeared.filter((label) => !targets.has(label));
  return {
    vanished,
    renamed,
    added: fresh.filter(isInWatersideScope),
    unknown: fresh.filter((label) => !isInWatersideScope(label)),
  };
}

const hasChanges = (changes) => Object.values(changes).some((list) => list.length > 0);

// Texte du mail : ce qui demande une intervention d'abord.
export function formatPromotionChanges({ vanished, renamed, added, unknown }) {
  const sections = [];
  if (vanished.length > 0) {
    sections.push(
      [
        'À vérifier : promotions disparues sans correspondance. Leurs élèves restent sur le dernier planning connu,',
        'qui ne se met plus à jour.',
        ...vanished.map((label) => `- ${label}`),
      ].join('\n'),
    );
  }
  if (unknown.length > 0) {
    sections.push(
      [
        'À vérifier : nouveaux libellés hors périmètre, jamais scrapés. Une promotion renommée ou un cursus sans motif',
        '(scraper/campus-scope.mjs) ?',
        ...unknown.map((label) => `- ${label}`),
      ].join('\n'),
    );
  }
  if (renamed.length > 0) {
    sections.push(
      ['Promotions renommées, suivies automatiquement :', ...renamed.map(([from, to]) => `- ${from} -> ${to}`)].join('\n'),
    );
  }
  if (added.length > 0) {
    sections.push(['Nouvelles promotions, proposées dans l’app :', ...added.map((label) => `- ${label}`)].join('\n'));
  }
  return sections.join('\n\n');
}

// `labels` : tous les libellés d'Hyperplanning à ce passage. `notify(subject, text)` : envoi du mail, ou null sans
// moyen d'envoi (la liste est alors mise à jour quand même : le changement reste dans les logs du passage).
// Ne lève jamais d'erreur : la surveillance ne doit pas faire échouer le scrap. Renvoie les changements, ou null.
export async function watchPromotions({ labels, redis, notify, now = new Date(), log = () => {} }) {
  try {
    // Une liste vide est un échec d'Hyperplanning, pas la disparition de toutes les promotions.
    if (labels.length === 0) return null;
    const previous = (await redis.getJson(PROMOTION_LABELS_KEY))?.labels;
    const save = () => redis.setJson(PROMOTION_LABELS_KEY, { updatedAt: now.toISOString(), labels });
    // Premier passage : rien à comparer.
    if (!previous) {
      await save();
      return null;
    }
    const changes = describePromotionChanges(previous, labels);
    if (!hasChanges(changes)) return null;

    const text = formatPromotionChanges(changes);
    log(`Promotions modifiées dans Hyperplanning :\n${text}`);
    if (notify) await notify('Promotions modifiées dans Hyperplanning — HyperICS', text);
    await save();
    return changes;
  } catch (error) {
    // Liste non réécrite : le changement sera signalé de nouveau au prochain passage.
    log(`Surveillance des promotions : ÉCHEC (${error.message})`);
    return null;
  }
}
