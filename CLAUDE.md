# CLAUDE.md

Contexte projet pour Claude Code. Lu automatiquement à chaque session.

## Le projet
HyperICS — webapp SaaS open-source qui lie Hyperplanning au calendrier personnel de l'utilisateur via un abonnement ICS, alimenté par un scrap récurrent.
- Utilisateurs : élèves de l'HEFF, 18-25 ans.
- Statut : MVP.
- Échéance : 25 septembre 2026, début de la phase bêta (premiers utilisateurs réels).
- Contrainte forte : budget nul (aucun service payant, uniquement offres gratuites).

## Stack
- Front : React. Back : Node.js. Hébergement : Vercel (plan Hobby, gratuit).
- Scrap : Playwright lancé par GitHub Actions (cron), pas par Vercel : le cron Vercel Hobby est limité à 1 exécution/jour et 4 h d'Active CPU/mois.
- Stockage : Upstash Redis (offre gratuite), partagé entre le scrap (écriture) et l'API Vercel (lecture). Cours par promotion et hash des jetons y vivent.
- Versions, gestionnaire de paquets, bundler : non définis. Ne jamais choisir ni installer une techno ou une dépendance sans proposer les options et attendre mon choix.
- Le dépôt est public (open-source) : GitHub Actions y est gratuit et illimité.

## Contraintes de l'app
- Hyperplanning de l'HEFF n'a pas d'export ICS natif : l'app récupère les cours par scrap, les interprète, puis les sert à chaque élève en flux ICS.
- Fréquence du scrap : toutes les heures, de 7h à 17h, fuseau Europe/Brussels. Le cron GitHub est en UTC : filtrer l'heure locale dans le script (heure d'été).
- Pas de compte utilisateur (contrainte du MVP). Un jeton unique aléatoire (256 bits) par élève dans l'URL du flux ICS ; stocker uniquement son hash.
- Hyperplanning est en accès public (mode invité), sans identifiant : https://heffpm.hyperplanning.fr/hp/invite. Le scrap ne stocke aucun identifiant d'élève.
- Hyperplanning HEFF est PRONOTE Campus (Index Éducation). Le planning d'une promotion vient d'un POST `/hp/appelfonction/...` (`FonctionEmploiDuTemps`) dont la réponse est du JSON en clair, non chiffré. Le scrap se fait par promotion (1AT, 1EAA…), pas par élève.
- Format constaté (à confirmer en implémentant) : grille de créneaux de 30 min de 8h à 21h (26 par jour), `p` = position dans la semaine, `d` = durée en créneaux, `dom` = semaines concernées (numérotées depuis la rentrée).
- Par défaut, un élève suit tous les cours de sa promotion. Trois profils : (1) standard, cours de son année ; (2) chevauchement, cours de deux années car cours non validés ; (3) très rare, un cours en moins.
- Le flux ICS est donc filtré par cours, pas par promotion : préréglage sur la promotion choisie, puis ajout de cours d'autres années et décochage. La sélection est modifiable à tout moment (obligatoire au MVP). Ne pas figer « un élève = une promotion ».
- Un cours peut avoir plusieurs occurrences par semaine (un seul cours, à dédoublonner) et être commun à plusieurs promotions : modéliser cours et promotions en plusieurs-à-plusieurs.
- Seul le 1er quadrimestre est visible dans Hyperplanning (semaines 1 à 16). Le 2e est traité après le MVP.
- Prévoir une page de suppression des données à partir de l'URL du flux (pas de compte pour le faire).
- Pas d'accord officiel de l'HEFF pour le scrap : bêta restreinte, requêtes espacées, transparence envers les élèves sur ce qui est stocké.

## Design
- Maquettes Figma : https://www.figma.com/design/WGIxtDqbfaS3B9ttpztTA7/HyperICS?node-id=30-17

## Conventions
- Code et identifiants (variables, fonctions, tables, routes) : anglais.
- Commentaires : français.
- Nommage : fichiers et dossiers en kebab-case ; composants, classes et types en PascalCase ; constantes en MAJUSCULES.
- Classes CSS : BEM.

## Git
- Modèle : trunk-based (projet 100 % solo).
- Messages de commit en français.
- Un commit = une idée.
- Aucun `Co-Authored-By` ni mention de Claude dans les commits : je suis l'unique auteur.
- Ne jamais commiter ni pousser sans mon autorisation explicite.
- Ne jamais commiter : `.env` et tout fichier de secrets, les données (dumps, bases, exports), `node_modules/`, tout ce qui peut nuire à la sécurité. Si un autre fichier ou dossier ne doit pas être commité, me le dire en expliquant pourquoi.

## Sécurité
- Projet open-source : tout ce qui est commité est public. Aucun secret, identifiant ou URL sensible dans le code.
- Secrets uniquement via variables d'environnement.

## À ne jamais faire
- Commiter sans mon autorisation.
- Ajouter un service payant.

## Méthode de travail attendue
- Répondre en français, de façon concise.
