# HyperICS

Ajoute ton horaire Hyperplanning à ton calendrier personnel, grâce à un abonnement ICS.

L'Hyperplanning de l'HEFF n'a pas d'export ICS natif. HyperICS récupère les cours, les interprète, puis les sert à chaque élève sous forme de flux ICS, filtré sur les cours qu'il suit réellement. Le flux se branche dans toute application de calendrier qui accepte les abonnements ICS.

> **Statut : MVP fonctionnel, bêta restreinte.** L'abonnement (flux ICS) fonctionne ; depuis sa page, l'élève suit l'état de son calendrier, modifie sa sélection ou supprime son calendrier : voir [État du projet](#état-du-projet).
>
> Projet indépendant, non affilié à l'HEFF ni à Index Éducation (éditeur d'Hyperplanning). Voir [Avertissement](#avertissement).

## Fonctionnement

```
Hyperplanning (accès invité, sans identifiant)
        │  scrap toutes les heures, de 7h à 17h (Europe/Brussels)
        │  déclenché par GitHub Actions, réveillé toutes les 15 min par Upstash QStash
        ▼
Upstash Redis : plannings par promotion, abonnements (hash du jeton)
        │  lecture
        ▼
API Vercel (/api)  ──►  front React (choix des cours, page de l'élève /m/<jeton>)
        └──►  flux ICS (/f/<jeton>) ──► calendrier de l'élève
```

- **Scrap par promotion, pas par élève.** Le planning d'une promotion (1AT, 1EAA…) vient d'Hyperplanning en JSON clair. Aucun identifiant d'élève n'est utilisé ni stocké.
- **Pas de compte.** Un jeton aléatoire de 256 bits identifie l'abonnement de l'élève, dans l'adresse de sa page (`/m/<jeton>`, le lien à garder) et de son flux (`/f/<jeton>`, lu par son calendrier) ; seul son hash est stocké.
- **Flux filtré par cours.** Par défaut, un élève suit tous les cours de sa promotion. Il peut ajouter des cours d'une autre année (cours non validés) ou en décocher, et modifier sa sélection à tout moment.
- **Flux toujours à jour.** Le flux est un abonnement, pas un fichier importé : il est recalculé à chaque rafraîchissement du calendrier à partir du dernier scrap. Nouvelles semaines, changements d'horaire ou de salle arrivent seuls, et un cours publié plus tard entre dans le flux de la promotion suivie (dans la seconde promotion d'un élève en chevauchement, seuls les cours cochés comptent).
- **Cours et promotions en plusieurs-à-plusieurs.** Un cours peut être commun à plusieurs promotions et avoir plusieurs occurrences par semaine : il n'est compté qu'une fois.

## Périmètre du MVP

- **Campus Waterside uniquement** : électronique appliquée, techniques graphiques, arts du tissu, publicité, stylisme et modélisme. Accessoires de mode est hors du MVP (aucune promotion identifiée dans Hyperplanning). Les autres promotions ne sont jamais interrogées.
- **1er quadrimestre uniquement** (semaines 1 à 16), le seul visible dans Hyperplanning. Le 2e est traité après le MVP.

## État du projet

- [x] Scraper HTTP sans dépendance (protocole PRONOTE Campus, réponses JSON en clair), résolution de la salle exacte par semaine
- [x] Synchronisation vers Upstash Redis, déclenchée toutes les 15 min (QStash + cron GitHub)
- [x] API de lecture : promotions et cours, branchée sur le front de bout en bout
- [x] Installation sur l'écran d'accueil (PWA)
- [x] Signalement de bug par mail (Resend)
- [x] Abonnement : jeton, flux ICS (fuseau Europe/Brussels, salle et prof de chaque séance), page de l'élève, ajout guidé par plateforme (iOS, Android, Mac/PC)
- [x] Sélection modifiable depuis la page de l'élève
- [x] Suppression des données depuis la page de l'élève
- [x] État du calendrier sur la page de l'élève : pas encore ajouté, ajout commencé, connecté (d'après les lectures du flux par Apple et par Google), avec les cours du jour
- [x] Suivi des changements d'Hyperplanning : promotion renommée, matière renommée, planning revenu vide, mail quand une promotion disparaît ou apparaît

Limites connues du flux : les annulations et les mémos d'Hyperplanning sont ignorés ; aucune mise à jour après 17h ; Google Agenda se rafraîchit en 8 à 24 h ; l'affichage dans Samsung Agenda n'a jamais été vérifié.

## Technique

Tout tient dans les offres gratuites (budget nul).

| Rôle | Choix |
| --- | --- |
| Front | React, TypeScript, Vite |
| API | Fonctions Vercel (Node.js, sans dépendance) |
| Scrap | Node.js en HTTP pur (`fetch` et `crypto`), lancé par GitHub Actions |
| Déclenchement du scrap | Upstash QStash, toutes les 15 min (cron GitHub en renfort) |
| Stockage | Upstash Redis, via son API REST |

```
api/          fonctions Vercel : promotions, lessons, subscription, feed, manifest, report-bug
server/       logique de l'API, testable sans Vercel
scraper/      scrap d'Hyperplanning et synchronisation vers Redis
shared/       code commun au scrap et à l'API (client Redis, noms de clés)
scripts/      outils de développement (serveur d'API local, statistiques des abonnements)
src/          front React : écrans, composants, styles
.github/      workflow du scrap
```

Les tests (`*.test.mjs`) sont à côté du code qu'ils vérifient.

Pour comprendre comment les pièces s'articulent (qui fait quoi, pourquoi, parcours d'une donnée du scrap au calendrier), lis [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Démarrage

Développé avec Node.js 26 et npm 11.

```bash
git clone https://github.com/moiselkbn/hyper-ics.git
cd hyper-ics
npm install
cp .env.example .env
```

Renseigne ensuite `.env` (fichier ignoré par git) :

| Variable | Rôle |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | URL REST de la base Upstash (console Upstash, onglet REST API) |
| `UPSTASH_REDIS_REST_TOKEN` | Jeton REST de la même base |
| `RESEND_API_KEY` | Facultative : clé Resend, pour le mail de signalement de bug et le mail du scrap quand la liste des promotions change |
| `BUG_REPORT_EMAIL` | Facultative : adresse qui reçoit ces mails (sans domaine vérifié, celle du compte Resend lui-même) |
| `HYPERPLANNING_BASE_URL` | Facultative : remplace l'adresse d'Hyperplanning utilisée par le scrap |

Remplis la base une première fois (quelques minutes, requêtes espacées) :

```bash
node --env-file=.env scraper/scrap-to-redis.mjs
```

Puis, dans deux terminaux :

```bash
npm run dev:api
```

```bash
npm run dev
```

`dev:api` lance l'API en local sur `http://localhost:3001` ; Vite lui renvoie les requêtes `/api`. Le front (`npm run dev`) l'appelle directement ; pour tester l'API seule : `curl http://localhost:3001/api/promotions`.

| Commande | Effet |
| --- | --- |
| `npm test` | Tests (lanceur natif de Node) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build` | Vérification des types, puis build de production dans `dist/` |
| `npm run stats` | Statistiques des abonnements (totaux, en lecture seule). Attention : `.env` pointe sur la base de production |

## API

| Route | Réponse | Erreurs |
| --- | --- | --- |
| `GET /api/promotions` | `{ updatedAt, curricula: [{ id, name, promotions[] }] }` | 503 tant que le premier scrap n'a pas réussi |
| `GET /api/lessons?promotions=3TI Web,2TE` | `{ updatedAt, lessons: [{ id, key, subject, code, teachers[], mandatory, promotions[] }] }` | 400 si le paramètre est absent ou invalide ; 404 si une promotion est inconnue |
| `POST /api/subscription` | Corps `{ promotions: [{ label, checked[], unchecked[] }] }` (clés de matière) → `{ token }` | 400 si la sélection est invalide ; 404 si une promotion est inconnue |
| `GET /api/subscription?token=…` | `{ promotions: [{ label, mode, keys[] }], calendars: [{ app, state, lastReadAt }], createdAt, updatedAt, today }` : la sélection enregistrée, recochée quand l'élève la modifie (sans les promotions sorties de l'index) ; l'état du calendrier par application (`started`, `connected` ou `stale`) ; les dates de l'abonnement ; les cours du jour, les mêmes que dans le flux | 400 sans jeton ; 404 si l'abonnement n'existe pas |
| `PUT /api/subscription?token=…` | Même corps que le POST → `{ ok }` : remplace la sélection, même jeton | Mêmes erreurs que POST et GET |
| `DELETE /api/subscription?token=…` | `{ ok }` : efface la sélection ; pendant 7 jours, le flux sert un calendrier vide, puis la clé expire | 400 sans jeton ; 404 si l'abonnement n'existe pas ou est déjà supprimé |
| `GET /f/<jeton>` (`/api/feed?token=…`) | Flux ICS (`text/calendar`), aussi en `HEAD` | 400 sans jeton ; 404 si l'abonnement n'existe pas |
| `POST /api/report-bug` | Corps `{ description }` (2000 caractères au plus) → `{ ok }` : envoie un mail de signalement via Resend | 400 si la description est absente ou trop longue |
| `GET /api/manifest?token=…` | Manifest de l'app qui s'ouvre sur `/m/<jeton>` (icône d'écran d'accueil) | 400 si le jeton est mal formé |

- `lessons` et `subscription` acceptent 2 promotions au maximum : un élève ne chevauche que deux années.
- Un cours est commun à plusieurs promotions seulement si le code **et** la matière sont identiques.
- Un abonnement enregistre, par promotion, un mode et des clés de matière (`key`), pas des identifiants de cours : la clé ne change pas quand un cours reçoit un code. Mode `all-except` (la promotion de l'élève : tous ses cours, présents et à venir, sauf les décochés) ou `only` (seconde promotion d'un élève en chevauchement : seulement les cours cochés). Les cours sans code sont toujours dans le flux.
- Redis garde, par abonnement : `subscription:<hash du jeton>` (la sélection) et `feed-reads:<hash du jeton>` (voir « Données et vie privée »). Les autres clés : `schedule-index` (liste des promotions), `schedule:<promotion>` (planning) et `promotion-labels` (libellés d'Hyperplanning au dernier scrap).
- L'état du calendrier vient des lectures du flux, reconnues à l'user-agent : Apple lit le flux avant même la confirmation de l'élève, il faut donc une 2e lecture au moins 10 min plus tard pour le dire « connecté » ; Google, dès la 1re. Sans lecture depuis 24 h (Apple) ou 48 h (Google), l'état passe à `stale`.
- Les réponses de lecture sont mises en cache (5 min côté CDN) : les données ne changent qu'au rythme du scrap. Le flux ne l'est pas pendant la bêta, pour que chaque interrogation apparaisse dans les logs (méthode, statut, user-agent, jamais le jeton).

## Scrap

Le workflow [`scrap.yml`](.github/workflows/scrap.yml) tourne toutes les heures, de 7h à 17h Europe/Brussels. Déclencheur principal : Upstash QStash, qui appelle toutes les 15 min l'API GitHub (`workflow_dispatch`) — réglé dans sa console, hors dépôt. Le cron GitHub natif (5h–16h UTC) reste en renfort, mais il saute la plupart de ses déclenchements. Dans les deux cas, le script écarte les heures hors de 7h–17h Europe/Brussels (heure d'été comprise) et ne scrape que si le dernier scrap a plus de 50 min. Le workflow peut aussi être lancé à la main depuis l'onglet Actions, avec une option « Simulation » qui n'écrit rien dans Redis.

Il lit quatre secrets, à créer dans *Settings → Secrets and variables → Actions* : `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` (obligatoires), `RESEND_API_KEY` et `BUG_REPORT_EMAIL` (facultatifs : sans eux, le mail qui signale une promotion disparue ou apparue est sauté).

Le scrap suit aussi les changements d'Hyperplanning : un planning revenu vide ne remplace l'ancien qu'au 3e scrap vide consécutif, une matière renommée garde la sélection de l'élève, et une promotion renommée est retrouvée malgré la casse, les espaces ou les tirets (ou par la table `PROMOTION_RENAMES` de `scraper/campus-scope.mjs`, à remplir à la main).

En local :

```bash
# Simulation : interroge Hyperplanning, écrit dans une base en mémoire
node scraper/scrap-to-redis.mjs --dry-run

# Planning d'une promotion, en JSON sur la sortie standard
node scraper/scrap-promotion.mjs "3TI Web"

# Planning de tout le périmètre (le dossier data/ est ignoré par git)
mkdir -p data && node scraper/scrap-campus.mjs > data/planning.json
```

Précautions envers Hyperplanning : 1,5 s entre deux requêtes, une seule session par passage, jamais deux scraps en parallèle, un `User-Agent` qui identifie le projet. Un planning n'est jamais écrasé par une réponse invalide.

## Données et vie privée

- **Plannings** : Redis contient les plannings des promotions du périmètre (matières, codes, horaires, enseignants, salles, semaines), des données déjà publiques dans Hyperplanning. Aucune donnée d'élève.
- **Par abonnement** : uniquement le hash du jeton, les promotions choisies avec, pour chacune, les matières cochées ou décochées, et les dates de création et de mise à jour. À part, sous le même hash : pour Apple et pour Google, la date de la première et de la dernière lecture du flux, qui sert à afficher l'état du calendrier sur la page de l'élève. Ni nom, ni e-mail, ni identifiant Hyperplanning.
- **Jeton en clair** : jamais stocké en base, et absent de la ligne de log de l'application (méthode, statut, user-agent). Mais l'adresse du flux, `/f/<jeton>`, reste visible pendant une durée limitée dans les journaux de requêtes de Vercel, l'hébergeur ; la page de l'élève le dit (« Tes données »).
- **Suppression** : depuis sa page, l'élève efface son abonnement. Promotions, matières, dates et lectures du flux disparaissent tout de suite ; il ne reste que le hash du jeton et la date de suppression, effacés par Redis après 7 jours. Pendant ce délai, le flux sert un calendrier vide, pour que les cours disparaissent aussi de son application de calendrier.
- Le dépôt est public : aucun secret dans le code, uniquement des variables d'environnement.

## Avertissement

HyperICS n'a pas d'accord officiel de l'HEFF pour récupérer les plannings. C'est pourquoi la bêta est restreinte, les requêtes sont espacées, et ce document détaille ce qui est stocké. En cas de doute, l'horaire d'Hyperplanning fait foi.

## Licence

Code sous licence [MIT](LICENSE).

## Conventions

- Code et identifiants en anglais, commentaires en français.
- Fichiers et dossiers en kebab-case ; composants, classes et types en PascalCase ; constantes en MAJUSCULES ; classes CSS en BEM.
- Trunk-based. Messages de commit en français, un commit = une idée.
- Ne jamais commiter `.env`, un secret, des données (dumps, exports) ni `node_modules/`.

Maquettes : [Figma](https://www.figma.com/design/WGIxtDqbfaS3B9ttpztTA7/HyperICS?node-id=30-17). Le détail des contraintes du projet est dans [`CLAUDE.md`](CLAUDE.md).
