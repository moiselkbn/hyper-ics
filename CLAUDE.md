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
- Stockage : Upstash Redis (offre gratuite, région Frankfurt), partagé entre le scrap (écriture) et l'API Vercel (lecture). Clés `schedule-index` (liste des promotions, avec `hasCourses`), `schedule:<promotion>` (planning), `subscription:<hash du jeton>` (abonnement d'un élève) et `promotion-labels` (tous les libellés d'Hyperplanning au dernier scrap, pour signaler par mail une promotion disparue ou apparue), voir `shared/redis-keys.mjs`. Les clés `token:*` de la première version de l'abonnement sont orphelines.
- Dev local : `npm run dev` (Vite) + `npm run dev:api` (`scripts/dev-api.mjs`, proxy Vite), pas de `vercel dev`. Tests : `npm test` (`node --test`), types : `npm run typecheck`, build : `npm run build`.
- Scrap à la main : `node --env-file=.env scraper/scrap-to-redis.mjs` (`--dry-run` : sans Redis) ; le workflow se lance aussi depuis l'onglet Actions. `.env` (ignoré par git, modèle `.env.example`) : `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`, mêmes noms dans les secrets GitHub et les variables Vercel.
- Ne jamais choisir ni installer une nouvelle techno ou dépendance sans proposer les options et attendre mon choix.
- Le dépôt est public (open-source) : GitHub Actions y est gratuit et illimité.

## Contraintes de l'app
- Hyperplanning de l'HEFF n'a pas d'export ICS natif : l'app récupère les cours par scrap, les interprète, puis les sert à chaque élève en flux ICS.
- Fréquence du scrap : toutes les heures, de 7h à 17h, fuseau Europe/Brussels. Déclenché toutes les 15 min (QStash, cron GitHub en renfort) ; le script filtre l'heure locale (`--only-in-hours`) et ne scrape que si le dernier scrap a plus de 50 min (`--skip-if-fresh`).
- Périmètre du MVP : uniquement les promotions du campus Waterside (34 sur 64). Les autres ne sont jamais scrapées. Accessoires de mode est hors MVP (aucun libellé identifié dans Hyperplanning, décision du 2026-09-29). Filtre et cursus (filières) dans `scraper/campus-scope.mjs`.
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

## Avancement (2026-09-30)
- Fait : scrap vers Redis déclenché toutes les 15 min (QStash + cron GitHub), résolution de la salle exacte par semaine, API de lecture déployée sur Vercel, front branché sur l'API de bout en bout (classes, cours, récapitulatif, génération), bouton d'installation sur l'écran d'accueil (PWA), dernier écran remanié pour mettre en avant la conservation du lien (encart dédié, bouton « Partager le lien » branché sur l'API Web Share avec repli sur la copie), bouton « Signaler un bug » (mail via Resend).
- Abonnement v2 (2026-09-24, la v1 retirée le 23 reste dans c7e97b5..2c09dd5) : `server/subscription.mjs` (POST/GET/PUT/DELETE `/api/subscription`), flux `/f/<jeton>` (`server/feed.mjs`, `server/ics.mjs`), page de l'élève `/m/<jeton>` (le lien à garder, avec son propre manifest pour l'icône d'écran d'accueil), onglets iOS (`webcal://`) / Android (site de Google Agenda dans le navigateur, voir plus bas) / Mac-PC (Apple, Google Agenda `cid=webcal://…`). Outlook abandonné pour la bêta (décision du 2026-09-30) : la cible n'en fait pas son agenda et son compte Outlook est le compte scolaire Microsoft 365 de l'HEFF, que le lien `outlook.live.com` ne visait pas. Sélection stockée par promotion en clés de matière : `all-except` pour la promotion de l'élève (nouveaux cours inclus), `only` pour la seconde promotion d'un élève en chevauchement. Flux sans cache pendant la bêta, une ligne de log par interrogation (user-agent, jamais le jeton). Sélection modifiable depuis la page (bouton « Modifier » à la place de « Retour ») : relue par GET, recochée, enregistrée par PUT sous le même jeton, puis écran « C'est à jour ! » avec l'ajout au calendrier replié (l'ajouter deux fois doublerait les cours). Suppression depuis la page (lien discret en bas, confirmation) : DELETE remplace l'abonnement par `{ deletedAt }` expirant après 7 jours (`SET … EX`), le flux sert alors un calendrier vide pour vider l'application de l'élève, GET/PUT/DELETE répondent 404 ; écran final avec le retrait de l'abonnement par application. Validé sur Mac et deux iPhone (ajout, modification, suppression).
- Suivi des changements d'Hyperplanning (2026-09-27) : un planning revenu vide ne remplace l'ancien qu'au 3e scrap vide consécutif (`EMPTY_SCHEDULE_CONFIRMATIONS`, `scraper/sync-schedules.mjs`) ; une matière renommée garde la sélection de l'élève (`renamedKeys` dans `schedule:<promotion>`, `scraper/track-renames.mjs`) ; une promotion renommée est suivie malgré la casse, les espaces ou les tirets, ou par la table `PROMOTION_RENAMES` à remplir à la main (`scraper/campus-scope.mjs`) ; mail à chaque promotion disparue ou apparue (`scraper/watch-promotions.mjs`, secrets GitHub `RESEND_API_KEY` et `BUG_REPORT_EMAIL`, absents pour l'instant : l'envoi est alors sauté) ; la salle résolue par semaine est revérifiée chaque jour (`scraper/resolve-rooms.mjs`).
- Icône d'écran d'accueil (2026-09-29) : elle rouvre la page de l'élève sur iOS et Android. Safari lit le manifest une seule fois, au chargement, et ignore tout changement ultérieur : la balise est donc créée dans `index.html` avec le manifest de `/m/<jeton>`, et la fin de la création recharge vraiment la page (`openPage`, `src/data/subscription-links.ts`). Validé sur iPhone (simulateur et réel) et émulateur Android (Chrome). Une icône ajoutée avant ce correctif rouvre l'accueil : la supprimer et la rajouter.
- Google Agenda sur Android (2026-09-30) : Chrome confie à l'appli Google Agenda tout lien `calendar.google.com` ouvert juste après un toucher (~5 s) ; l'appli demande « Ajouter l'agenda ? » mais n'ajoute rien. Le bouton lance donc un compte à rebours de 6 s puis ouvre le site dans l'onglet (`GoogleAndroidButton`, `src/screens/feed-ready.tsx`), qui abonne vraiment le compte. Chrome connecté à Google : direct ; non connecté : connexion, puis l'appli intercepte la suite, il faut revenir dans Chrome et recharger (conseil sous le bouton, avec l'envoi du lien vers un ordinateur en secours) ; Samsung Internet : direct, même avec la connexion. « Synchroniser » est décoché d'office dans l'appli : à activer (écrit sous le bouton). Validé sur l'aperçu Vercel depuis l'émulateur (Chrome, Samsung Internet, icône d'écran d'accueil).
- Reste : recette sur PC (Google Agenda) et libellés de désabonnement de l'écran de suppression ; secrets `RESEND_API_KEY` et `BUG_REPORT_EMAIL` à ajouter dans GitHub ; nettoyage des abonnements de test des aperçus et réactivation de la protection des aperçus Vercel.
- Trous connus du flux : annulations (`ListeAnnulationsCours`) et mémos d'Hyperplanning ignorés ; un cours sans code qui reçoit un code sort de la sélection `only` ; aucune mise à jour après 17h ; Google Agenda se rafraîchit en 8 à 24 h ; affichage dans Samsung Agenda jamais vérifié (pas de vrai Samsung).

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
