// Renommages de matière d'une promotion, d'un scrap au suivant.
// L'abonnement d'un élève enregistre ses cours par clé de matière (voir server/subscription.mjs) : si l'école
// corrige un libellé, la clé change et la sélection ne le reconnaît plus (un cours décoché revient, un cours coché
// disparaît). Le planning garde donc `renamedKeys` : ancienne clé -> clé actuelle, que l'API applique à la lecture.
//
// Un renommage n'est retenu que sur preuve : une clé disparue et une clé apparue au même passage, avec un code en
// commun et au moins une occurrence en commun (même semaine, jour et heures). Une paire ambiguë (deux anciennes
// clés pour une nouvelle, ou l'inverse) n'est pas retenue : mieux vaut l'ancien comportement qu'une fausse
// correspondance. Les cours sans code ne sont pas concernés : obligatoires, ils ne passent pas par la sélection.

// Clé -> codes et occurrences (« semaine|jour|début|fin ») de ses créneaux.
function coursesByKey(slots) {
  const courses = new Map();
  for (const slot of slots) {
    if (!slot.key) continue;
    let course = courses.get(slot.key);
    if (!course) {
      course = { codes: new Set(), occurrences: new Set() };
      courses.set(slot.key, course);
    }
    if (slot.code) course.codes.add(slot.code.trim());
    for (const week of slot.weeks) course.occurrences.add(`${week}|${slot.day}|${slot.start}|${slot.end}`);
  }
  return courses;
}

const overlaps = (a, b) => [...a].some((item) => b.has(item));

// `previous` : planning précédent de la promotion (null s'il n'y en a pas) ; `slots` : créneaux du nouveau scrap.
// Renvoie les renommages cumulés : ceux du planning précédent, prolongés jusqu'à la clé actuelle, et ceux de ce
// passage. Une ancienne clé revenue dans le planning n'est plus traduite.
export function trackRenames(previous, slots) {
  const before = coursesByKey(previous?.courses ?? []);
  const now = coursesByKey(slots);
  const appeared = [...now.keys()].filter((key) => !before.has(key));

  const found = new Map();
  for (const [oldKey, old] of before) {
    if (now.has(oldKey)) continue;
    const candidates = appeared.filter((key) => {
      const course = now.get(key);
      return overlaps(old.codes, course.codes) && overlaps(old.occurrences, course.occurrences);
    });
    if (candidates.length === 1) found.set(oldKey, candidates[0]);
  }
  const targets = [...found.values()];
  for (const [oldKey, newKey] of found) {
    if (targets.indexOf(newKey) !== targets.lastIndexOf(newKey)) found.delete(oldKey);
  }

  const renamedKeys = new Map();
  for (const [oldKey, key] of Object.entries(previous?.renamedKeys ?? {})) renamedKeys.set(oldKey, found.get(key) ?? key);
  for (const [oldKey, newKey] of found) renamedKeys.set(oldKey, newKey);
  for (const [oldKey, key] of renamedKeys) {
    if (now.has(oldKey) || key === oldKey) renamedKeys.delete(oldKey);
  }
  return Object.fromEntries(renamedKeys);
}
