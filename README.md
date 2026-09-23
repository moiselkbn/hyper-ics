# HyperICS

Ajoute ton horaire Hyperplanning à ton calendrier personnel, grâce à un abonnement ICS.

L'Hyperplanning de l'HEFF n'a pas d'export ICS natif. HyperICS récupère les cours, les interprète, puis les sert à chaque élève sous forme de flux ICS, filtré sur les cours qu'il suit réellement. Le flux se branche dans toute application de calendrier qui accepte les abonnements ICS.

> **Statut : MVP en cours de développement.** Début de la bêta restreinte prévu le 25 septembre 2026. Le flux ICS n'est pas encore disponible : voir [État du projet](#état-du-projet).
>
> Projet indépendant, non affilié à l'HEFF ni à Index Éducation (éditeur d'Hyperplanning). Voir [Avertissement](#avertissement).

## Fonctionnement

```
Hyperplanning (accès invité, sans identifiant)
        │  scrap toutes les heures, de 7h à 17h (Europe/Brussels)
        │  déclenché par GitHub Actions, réveillé toutes les 15 min par Upstash QStash
        ▼
Upstash Redis : plannings par promotion, hash des jetons (à venir)
        │  lecture
        ▼
API Vercel (/api)  ──►  front React (choix des cours)
        └──►  flux ICS (à venir) ──► calendrier de l'élève
```

- **Scrap par promotion, pas par élève.** Le planning d'une promotion (1AT, 1EAA…) vient d'Hyperplanning en JSON clair. Aucun identifiant d'élève n'est utilisé ni stocké.
- **Pas de compte.** Un jeton aléatoire de 256 bits dans l'URL du flux identifie l'élève ; seul son hash est stocké (à venir).
- **Flux filtré par cours.** Par défaut, un élève suit tous les cours de sa promotion. Il peut ajouter des cours d'une autre année (cours non validés) ou en décocher, et modifier sa sélection à tout moment.
- **Cours et promotions en plusieurs-à-plusieurs.** Un cours peut être commun à plusieurs promotions et avoir plusieurs occurrences par semaine : il n'est compté qu'une fois.

## Périmètre du MVP

- **Campus Waterside uniquement** : électronique appliquée, techniques graphiques, arts du tissu, publicité, stylisme et modélisme (accessoires de mode : pas encore couvert). Les autres promotions ne sont jamais interrogées.
- **1er quadrimestre uniquement** (semaines 1 à 16), le seul visible dans Hyperplanning. Le 2e est traité après le MVP.

## État du projet

- [x] Scraper HTTP sans dépendance (protocole PRONOTE Campus, réponses JSON en clair), résolution de la salle exacte par semaine
- [x] Synchronisation vers Upstash Redis, déclenchée toutes les 15 min (QStash + cron GitHub)
- [x] API de lecture : promotions et cours, branchée sur le front de bout en bout
- [x] Installation sur l'écran d'accueil (PWA)
- [x] Signalement de bug par mail (Resend)
- [ ] Jeton et flux ICS
- [ ] Sélection enregistrée et modifiable à partir de l'URL du flux
- [ ] Page de suppression des données à partir de l'URL du flux

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
api/          fonctions Vercel : GET /api/promotions, GET /api/lessons, POST /api/report-bug
server/       logique de l'API, testable sans Vercel
scraper/      scrap d'Hyperplanning et synchronisation vers Redis
shared/       code commun au scrap et à l'API (client Redis, noms de clés)
scripts/      outils de développement (serveur d'API local)
src/          front React : écrans, composants, styles
.github/      workflow du scrap
```

Les tests (`*.test.mjs`) sont à côté du code qu'ils vérifient.

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

## API

| Route | Réponse | Erreurs |
| --- | --- | --- |
| `GET /api/promotions` | `{ updatedAt, curricula: [{ id, name, promotions[] }] }` | 503 tant que le premier scrap n'a pas réussi |
| `GET /api/lessons?promotions=3TI Web,2TE` | `{ updatedAt, lessons: [{ id, subject, code, teachers[], promotions[] }] }` | 400 si le paramètre est absent ou invalide ; 404 si une promotion est inconnue |

- `lessons` accepte 2 promotions au maximum : un élève ne chevauche que deux années.
- Un cours est commun à plusieurs promotions seulement si le code **et** la matière sont identiques.
- Les réponses de lecture sont mises en cache (5 min côté CDN) : les données ne changent qu'au rythme du scrap.

## Scrap

Le workflow [`scrap.yml`](.github/workflows/scrap.yml) tourne toutes les heures, de 7h à 17h Europe/Brussels. Déclencheur principal : Upstash QStash, qui appelle toutes les 15 min l'API GitHub (`workflow_dispatch`) — réglé dans sa console, hors dépôt. Le cron GitHub natif (5h–16h UTC) reste en renfort, mais il saute la plupart de ses déclenchements. Dans les deux cas, le script écarte les heures hors de 7h–17h Europe/Brussels (heure d'été comprise) et ne scrape que si le dernier scrap a plus de 50 min. Le workflow peut aussi être lancé à la main depuis l'onglet Actions, avec une option « Simulation » qui n'écrit rien dans Redis.

Il lit deux secrets, à créer dans *Settings → Secrets and variables → Actions* : `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.

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
- **Prévu avec le flux** : uniquement le hash du jeton, la sélection de cours et la date de création. Ni nom, ni e-mail, ni identifiant Hyperplanning.
- **Suppression** : à venir, une page dédiée accessible depuis l'URL du flux effacera ces données.
- Le dépôt est public : aucun secret dans le code, uniquement des variables d'environnement.

## Avertissement

HyperICS n'a pas d'accord officiel de l'HEFF pour récupérer les plannings. C'est pourquoi la bêta est restreinte, les requêtes sont espacées, et ce document détaille ce qui est stocké. En cas de doute, l'horaire d'Hyperplanning fait foi.

## Conventions

- Code et identifiants en anglais, commentaires en français.
- Fichiers et dossiers en kebab-case ; composants, classes et types en PascalCase ; constantes en MAJUSCULES ; classes CSS en BEM.
- Trunk-based. Messages de commit en français, un commit = une idée.
- Ne jamais commiter `.env`, un secret, des données (dumps, exports) ni `node_modules/`.

Maquettes : [Figma](https://www.figma.com/design/WGIxtDqbfaS3B9ttpztTA7/HyperICS?node-id=30-17). Le détail des contraintes du projet est dans [`CLAUDE.md`](CLAUDE.md).
