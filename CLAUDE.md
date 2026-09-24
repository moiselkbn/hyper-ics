# CLAUDE.md

Contexte projet pour Claude Code. Lu automatiquement à chaque session.

## Le projet
HyperICS — webapp SaaS open-source qui lie Hyperplanning au calendrier personnel de l'utilisateur via un abonnement ICS, alimenté par un scrap récurrent.
- Utilisateurs : élèves de l'HEFF, 18-25 ans.
- Statut : MVP.
- Échéance : 25 septembre 2026, début de la phase bêta (premiers utilisateurs réels).
- Contrainte forte : budget nul (aucun service payant, uniquement offres gratuites).

## Stack
- Front : React 19 + TypeScript, bundler Vite, gestionnaire de paquets npm. Code dans `src/`.
- API : fonctions Vercel dans `api/` (JS `.mjs`, sans dépendance, `export function GET(request)`), logique testable dans `server/`, code partagé dans `shared/`. Hébergement : Vercel (plan Hobby, gratuit), région `fra1` (comme la base Upstash), projet lié au dépôt : chaque push sur `main` déploie en production.
- Scrap : Node pur (`fetch` + `crypto`, sans Playwright ni dépendance), dans `scraper/`, lancé par GitHub Actions, pas par Vercel : le cron Vercel Hobby est limité à 1 exécution/jour et 4 h d'Active CPU/mois. Déclenché par Upstash QStash (offre gratuite), qui appelle toutes les 15 min l'API GitHub (`workflow_dispatch`) ; le cron GitHub natif reste en renfort, mais il saute la plupart de ses déclenchements. Réglage QStash fait dans sa console, hors dépôt.
- Stockage : Upstash Redis (offre gratuite, région Frankfurt), partagé entre le scrap (écriture) et l'API Vercel (lecture). Clés `schedule-index` (liste des promotions, avec `hasCourses`), `schedule:<promotion>` (planning) et `subscription:<hash du jeton>` (abonnement d'un élève), voir `shared/redis-keys.mjs`. Les clés `token:*` de la première version de l'abonnement sont orphelines.
- Dev local : `npm run dev` (Vite) + `npm run dev:api` (`scripts/dev-api.mjs`, proxy Vite), pas de `vercel dev`. Tests : `npm test` (`node --test`), types : `npm run typecheck`, build : `npm run build`.
- Scrap à la main : `node --env-file=.env scraper/scrap-to-redis.mjs` (`--dry-run` : sans Redis) ; le workflow se lance aussi depuis l'onglet Actions. `.env` (ignoré par git, modèle `.env.example`) : `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`, mêmes noms dans les secrets GitHub et les variables Vercel.
- Ne jamais choisir ni installer une nouvelle techno ou dépendance sans proposer les options et attendre mon choix.
- Le dépôt est public (open-source) : GitHub Actions y est gratuit et illimité.

## Contraintes de l'app
- Hyperplanning de l'HEFF n'a pas d'export ICS natif : l'app récupère les cours par scrap, les interprète, puis les sert à chaque élève en flux ICS.
- Fréquence du scrap : toutes les heures, de 7h à 17h, fuseau Europe/Brussels. Déclenché toutes les 15 min (QStash, cron GitHub en renfort) ; le script filtre l'heure locale (`--only-in-hours`) et ne scrape que si le dernier scrap a plus de 50 min (`--skip-if-fresh`).
- Périmètre du MVP : uniquement les promotions du campus Waterside (34 sur 64). Les autres ne sont jamais scrapées. Filtre et cursus (filières) dans `scraper/campus-scope.mjs`.
- Pas de compte utilisateur (contrainte du MVP). Un jeton unique aléatoire (256 bits) par élève dans l'URL du flux ICS ; stocker uniquement son hash.
- Hyperplanning est en accès public (mode invité), sans identifiant : https://heffpm.hyperplanning.fr/hp/invite. Le scrap ne stocke aucun identifiant d'élève.
- Hyperplanning HEFF est PRONOTE Campus (Index Éducation). Le planning d'une promotion vient d'un POST `/hp/appelfonction/...` (`FonctionEmploiDuTemps`) dont la réponse est du JSON en clair, non chiffré. Le scrap se fait par promotion (1AT, 1EAA…), pas par élève.
- Format confirmé : grille de créneaux de 30 min de 8h à 21h (26 par jour), `p` = jour × 26 + créneau, `d` = durée en créneaux, `dom` = semaines concernées (semaine 1 = lundi 14/09/2026). Les identifiants de promotion changent à chaque session : retrouver une promotion par son libellé.
- Un cours n'a pas toujours de code (ateliers, réunions, certaines promotions) et un même code peut couvrir deux matières : dans une promotion, un cours est identifié par son libellé de matière, pas par son code. Deux cours identiques au même moment ne doivent jamais apparaître en double.
- Entre promotions, deux cours n'en font qu'un si le code ET la matière sont identiques, ou si la même matière a lieu au même moment (au moins une occurrence identique : semaine, jour, heures). Dédoublonné une fois pour toutes dans `server/lessons.mjs`, réutilisé par l'API et par le flux ICS (`server/feed.mjs`).
- La salle d'un créneau peut changer en cours d'année : une requête sur tout le quadrimestre renvoie alors les deux salles pour toutes les semaines, sans dire laquelle s'applique où. Affiné par recherche dichotomique sur des sous-plages de semaines (`scraper/resolve-rooms.mjs`).
- Affichage : la matière (pas le code) ; un seul prof, suivi de « +n » s'il y en a d'autres ; « Aucun cours publié » pour une promotion sans cours (`hasCourses` dans l'index) ; cursus dans l'ordre de `CURRICULA` ; deux promotions au plus, d'années différentes (décret paysage).
- Par défaut, un élève suit tous les cours de sa promotion. Trois profils : (1) standard, cours de son année ; (2) chevauchement, cours de deux années car cours non validés ; (3) très rare, un cours en moins.
- Le flux ICS est donc filtré par cours, pas par promotion : préréglage sur la promotion choisie, puis ajout de cours d'autres années et décochage. La sélection est modifiable à tout moment (obligatoire au MVP). Ne pas figer « un élève = une promotion ».
- Un cours peut avoir plusieurs occurrences par semaine (un seul cours, à dédoublonner) et être commun à plusieurs promotions : modéliser cours et promotions en plusieurs-à-plusieurs.
- Seul le 1er quadrimestre est visible dans Hyperplanning (semaines 1 à 16). Le 2e est traité après le MVP.
- Prévoir une page de suppression des données à partir de l'URL du flux (pas de compte pour le faire).
- Pas d'accord officiel de l'HEFF pour le scrap : bêta restreinte, requêtes espacées, transparence envers les élèves sur ce qui est stocké.

## Avancement (2026-09-24)
- Fait : scrap vers Redis déclenché toutes les 15 min (QStash + cron GitHub), résolution de la salle exacte par semaine, API de lecture déployée sur Vercel, front branché sur l'API de bout en bout (classes, cours, récapitulatif, génération), bouton d'installation sur l'écran d'accueil (PWA), dernier écran remanié pour mettre en avant la conservation du lien (encart dédié, bouton « Partager le lien » branché sur l'API Web Share avec repli sur la copie), bouton « Signaler un bug » (mail via Resend).
- Abonnement v2 (2026-09-24, la v1 retirée le 23 reste dans c7e97b5..2c09dd5) : `server/subscription.mjs` (POST/GET/PUT/DELETE `/api/subscription`), flux `/f/<jeton>` (`server/feed.mjs`, `server/ics.mjs`), page de l'élève `/m/<jeton>` (le lien à garder, avec son propre manifest pour l'icône d'écran d'accueil), onglets iOS (`webcal://`) / Android (ajout depuis un ordinateur, Google Agenda n'accepte pas l'ajout par URL sur mobile) / Mac-PC (Apple, Google Agenda `cid=webcal://…`, Outlook). Sélection stockée par promotion en clés de matière : `all-except` pour la promotion de l'élève (nouveaux cours inclus), `only` pour la seconde promotion d'un élève en chevauchement. Flux sans cache pendant la bêta, une ligne de log par interrogation (user-agent, jamais le jeton). Sélection modifiable depuis la page (bouton « Modifier » à la place de « Retour ») : relue par GET, recochée, enregistrée par PUT sous le même jeton, puis écran « C'est à jour ! » avec l'ajout au calendrier replié (l'ajouter deux fois doublerait les cours). Suppression depuis la page (lien discret en bas, confirmation) : DELETE remplace l'abonnement par `{ deletedAt }` expirant après 7 jours (`SET … EX`), le flux sert alors un calendrier vide pour vider l'application de l'élève, GET/PUT/DELETE répondent 404 ; écran final avec le retrait de l'abonnement par application. Recette sur appareils en cours.
- Reste avant la bêta : recette de l'abonnement sur appareils (dont les libellés de désabonnement de l'écran de suppression), motif de reconnaissance pour le cursus « Accessoires de mode » (aucun libellé identifié pour l'instant).

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
