// Clé d'un cours au sein d'une promotion : le libellé de matière normalisé.
// Le code ne convient pas : un même code peut couvrir deux matières dans une promotion.
export function courseKey(subject) {
  return subject.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}
