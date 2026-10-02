# Architecture de HyperICS

Ce document explique **comment le code est organisé, qui fait quoi et pourquoi**. Il s'adresse à quelqu'un qui découvre le projet et veut y contribuer.

- Pour présenter le projet, installer l'environnement ou lire la liste des routes : [`README.md`](README.md).
- Pour le détail des décisions et des contraintes métier : [`CLAUDE.md`](CLAUDE.md).

Les noms de fichiers cités existent dans le dépôt : ouvre-les en lisant, les commentaires y sont nombreux (en français) et expliquent chaque cas particulier.

---

## 1. Le problème et l'idée

Les élèves de l'HEFF consultent leur horaire sur Hyperplanning, qui **n'a pas d'export ICS** : impossible de le brancher sur Google Agenda ou Calendrier (Apple). HyperICS comble ce vide :

1. un programme (le **scrap**) lit régulièrement les plannings publics d'Hyperplanning ;
2. il les range dans une base ;
3. une petite API les sert à chaque élève sous forme d'un **flux ICS** (un lien auquel son calendrier s'abonne), filtré sur les cours qu'il suit vraiment.

Deux contraintes dictent presque toutes les décisions techniques :

- **Budget nul** : uniquement des offres gratuites (Vercel Hobby, GitHub Actions, Upstash). D'où le scrap hors de Vercel, des clients écrits à la main au lieu de bibliothèques, et le souci d'économiser les commandes Redis.
- **Pas de compte utilisateur** : l'élève est identifié par un **jeton secret** dans l'URL de son flux. Cela évite de gérer des mots de passe, et de stocker des données personnelles.

---

## 2. Vue d'ensemble

```
                 ┌───────────────────────────────┐
                 │  Hyperplanning (accès invité) │
                 └───────────────▲───────────────┘
                                 │ HTTP, JSON en clair, requêtes espacées
                 ┌───────────────┴───────────────┐
 QStash (15 min) │  scraper/  (GitHub Actions)   │  écrit
 ──────────────► │  Node pur, 1 passage ≈ 1 h    │ ───────┐
                 └───────────────────────────────┘        │
                                                          ▼
                                            ┌──────────────────────────┐
                                            │   Upstash Redis          │
                                            │   schedule-index         │
                                            │   schedule:<promotion>   │
                                            │   subscription:<hash>    │
                                            │   feed-reads:<hash>      │
                                            │   promotion-labels       │
                                            └─────────▲───────┬────────┘
                                              écrit   │       │ lit
                              (abonnements, lectures) │       │
                 ┌────────────────────────────────────┴───────▼────────┐
                 │  api/ + server/  (fonctions Vercel, région fra1)     │
                 └───────▲───────────────────────────────────┬──────────┘
                         │ /api/…                            │ /f/<jeton> (ICS)
                 ┌───────┴──────────┐                ┌───────▼───────────────┐
                 │  src/  (React)   │                │ Calendrier de l'élève │
                 │  /  et /m/<jeton>│                │ (Apple, Google…)      │
                 └──────────────────┘                └───────────────────────┘
```

Trois « mondes » qui ne se parlent **que par Redis** (le scrap écrit, l'API lit) :

| Monde | Dossier | Tourne où | Rôle |
| --- | --- | --- | --- |
| Collecte | `scraper/` | GitHub Actions | Lire Hyperplanning, interpréter, écrire dans Redis |
| Service | `api/`, `server/` | Vercel | Lire Redis, servir l'API JSON et le flux ICS |
| Interface | `src/` | Navigateur de l'élève | Choisir ses cours, suivre l'état de son calendrier |

`shared/` contient ce que le scrap et l'API ont en commun (client Redis, noms de clés, jeton), pour qu'ils ne divergent jamais.

---

## 3. Le scrap (`scraper/`)

### Pourquoi hors de Vercel ?

Le cron de Vercel Hobby est limité à une exécution par jour et à 4 h de calcul par mois. Le scrap tourne donc dans **GitHub Actions** (gratuit et illimité pour un dépôt public), défini dans [`.github/workflows/scrap.yml`](.github/workflows/scrap.yml).

### Qui le déclenche ?

Le cron natif de GitHub saute la plupart de ses déclenchements. Le déclencheur principal est donc **Upstash QStash** (réglé dans sa console, hors dépôt), qui appelle toutes les 15 minutes l'API GitHub (`workflow_dispatch`). Le cron GitHub reste en renfort.

Appeler toutes les 15 min ne veut pas dire scraper toutes les 15 min. Deux gardes, dans [`scrap-window.mjs`](scraper/scrap-window.mjs), filtrent :
- `--only-in-hours` : rien en dehors de 7h–17h, heure de Bruxelles (heure d'été comprise) ;
- `--skip-if-fresh` : rien si le dernier scrap réussi a moins de 50 min.

Résultat : environ un scrap par heure, et un déclenchement raté est rattrapé par le suivant.

### Comment parler à Hyperplanning ?

L'Hyperplanning de l'HEFF est **PRONOTE Campus** (Index Éducation), en accès invité (sans identifiant). Le protocole a été reconstitué : pas de navigateur, juste `fetch` et `crypto`.

- [`hyperplanning-client.mjs`](scraper/hyperplanning-client.mjs) : ouvre une session invité, numérote les échanges comme le serveur l'attend (numéro chiffré en AES dans l'URL), liste les promotions, récupère le planning brut d'une promotion. Il espace les requêtes de 1,5 s et s'identifie par un `User-Agent` explicite : on ne veut pas surcharger l'école.
- [`scrap-session.mjs`](scraper/scrap-session.mjs) : une requête abandonnée désynchronise la session (« La page a expiré ! »). Ce module la **rouvre** et retente (3 réouvertures au plus par passage). Les identifiants de promotion changeant à chaque session, la promotion est retrouvée par son **libellé**.
- [`parse-schedule.mjs`](scraper/parse-schedule.mjs) : traduit le format de PRONOTE en cours lisibles. Le planning est une grille de créneaux de 30 min (de 8h à 21h, 26 par jour) : `p` = jour × 26 + créneau, `d` = durée en créneaux, `dom` = semaines concernées.

### Que fait-on de ce qu'on a lu ?

[`scrap-to-redis.mjs`](scraper/scrap-to-redis.mjs) est le **chef d'orchestre** (le point d'entrée du workflow) :

1. applique les gardes d'heure et de fraîcheur ;
2. ouvre une session, liste toutes les promotions ;
3. ne garde que celles du **périmètre du MVP** (campus Waterside), avec [`campus-scope.mjs`](scraper/campus-scope.mjs) ;
4. appelle `syncSchedules` pour écrire les plannings ;
5. appelle `watchPromotions` pour détecter une promotion disparue ou apparue.

Le mode `--dry-run` remplace Redis par une base en mémoire : on peut tester sans rien écrire.

[`campus-scope.mjs`](scraper/campus-scope.mjs) porte aussi la liste des cursus (`CURRICULA`, avec des motifs sur les libellés) et la table `PROMOTION_RENAMES` à remplir à la main quand l'école renomme une promotion.

### Les garde-fous de [`sync-schedules.mjs`](scraper/sync-schedules.mjs)

Le principe : **ne jamais écraser un bon planning par un résultat douteux**, car une erreur viderait le calendrier de toute une promotion.

- Une promotion en échec garde son ancien planning.
- Un planning revenu **vide** n'est écrit qu'au 3e passage vide consécutif (`EMPTY_SCHEDULE_CONFIRMATIONS`).
- L'index (`schedule-index`) n'avance sa date que si au moins la moitié des promotions a réussi.
- Les écritures se font promotion par promotion, l'index en dernier.

### Deux difficultés propres aux données

- **La salle exacte** ([`resolve-rooms.mjs`](scraper/resolve-rooms.mjs)) : si la salle d'un créneau change en cours d'année, Hyperplanning renvoie les deux salles pour toutes les semaines, sans dire laquelle s'applique où. On interroge alors des sous-plages de semaines par **recherche dichotomique**. C'est lent, donc budgété (5 min par passage), repris du passage précédent tant que rien ne change, et revérifié une fois par jour.
- **Les renommages** : l'école corrige parfois un libellé. [`track-renames.mjs`](scraper/track-renames.mjs) repère une matière renommée (preuve : même code et même occurrence) pour que l'élève garde sa sélection ; [`watch-promotions.mjs`](scraper/watch-promotions.mjs) compare la liste des promotions d'un passage à l'autre et **envoie un mail** (Resend) à chaque changement.

---

## 4. Redis : le point de rencontre

Redis (Upstash, région Frankfurt, comme Vercel `fra1`) est la seule liaison entre le scrap et l'API. Il est utilisé via son **API REST** par [`shared/redis-client.mjs`](shared/redis-client.mjs) (une requête HTTPS par commande, sans dépendance). Toutes les valeurs sont du JSON stocké en texte.

Les noms de clés sont centralisés dans [`shared/redis-keys.mjs`](shared/redis-keys.mjs) :

| Clé | Écrite par | Contenu |
| --- | --- | --- |
| `schedule-index` | scrap | Liste des promotions (libellé, cursus, `hasCourses`) et date du dernier scrap réussi |
| `schedule:<promotion>` | scrap | Planning complet d'une promotion : créneaux, semaine 1, `renamedKeys`… |
| `promotion-labels` | scrap | Tous les libellés d'Hyperplanning au dernier scrap (pour repérer un changement) |
| `subscription:<hash du jeton>` | API | Sélection de cours d'un élève (ou `{ deletedAt }` après suppression) |
| `feed-reads:<hash du jeton>` | API | Première et dernière lecture du flux par Apple et par Google |

Les clés `token:*` de la première version de l'abonnement sont orphelines (inutilisées).

---

## 5. L'API (`api/` et `server/`)

### Pourquoi deux dossiers ?

- [`api/`](api) : de **minuscules fonctions Vercel** (`export function GET(request)`). Chacune ne fait que brancher une fonction de `server/` sur un vrai client Redis.
- [`server/`](server) : **toute la logique**, sans dépendance à Vercel, donc **testable** : on lui passe un faux Redis dans les tests.

Cette séparation est la règle à retenir : *une nouvelle règle métier va dans `server/`, jamais dans `api/`*.

### Les routes

| Route | Fichier de logique | Rôle |
| --- | --- | --- |
| `GET /api/promotions` | [`promotions.mjs`](server/promotions.mjs) | Promotions regroupées par cursus |
| `GET /api/lessons` | [`lessons.mjs`](server/lessons.mjs) | Cours de 1 ou 2 promotions |
| `POST/GET/PUT/DELETE /api/subscription` | [`subscription.mjs`](server/subscription.mjs) | Cycle de vie d'un abonnement |
| `GET /f/<jeton>` | [`feed.mjs`](server/feed.mjs) + [`ics.mjs`](server/ics.mjs) | Le flux ICS |
| `GET /api/manifest` | [`manifest.mjs`](server/manifest.mjs) | Manifest d'app (icône d'écran d'accueil) |
| `POST /api/report-bug` | [`report-bug.mjs`](server/report-bug.mjs) | Mail de signalement de bug |

[`vercel.json`](vercel.json) réécrit `/f/<jeton>` vers `/api/feed?token=…` et sert la page de l'élève `/m/<jeton>` depuis `index.html`. [`http.mjs`](server/http.mjs) fournit les réponses communes (en-têtes de cache, erreurs) et `respond`, qui convertit toute erreur en réponse JSON.

### Le cœur : fusionner les cours ([`lessons.mjs`](server/lessons.mjs))

Un cours est l'objet le plus délicat du projet. Les règles :

- **Dans une promotion**, un cours = sa **matière** (clé produite par [`shared/course-key.mjs`](shared/course-key.mjs)), pas son code : un même code peut couvrir deux matières, et certains cours n'ont pas de code. Plusieurs occurrences par semaine restent un seul cours.
- **Entre promotions**, deux cours n'en font qu'un si le code **et** la matière sont identiques, **ou** si la même matière a lieu au même moment. Un élève ne peut pas être à deux endroits à la fois : l'afficher deux fois serait une erreur.
- Cours et promotions sont donc en **relation plusieurs-à-plusieurs**.

Ce dédoublonnage est fait **une seule fois**, ici, et réutilisé par l'API, le flux ICS et la section « Aujourd'hui ». Ne le réimplémente jamais ailleurs.

### L'abonnement ([`subscription.mjs`](server/subscription.mjs))

- **Le jeton** ([`shared/token.mjs`](shared/token.mjs)) : 256 bits aléatoires, en base64url. Il n'est renvoyé qu'**une fois**, à la création. Seul son **hash SHA-256** est stocké : une fuite de la base ne donne accès à aucun flux.
- **La sélection** est stockée par promotion en **clés de matière** (pas en identifiants de cours, qui changent quand un cours reçoit un code), selon deux modes :
  - `all-except` : tous les cours de la promotion, **y compris ceux publiés plus tard**, sauf ceux décochés (la promotion propre de l'élève) ;
  - `only` : seulement les cours cochés (la seconde promotion d'un élève en chevauchement).
- `chooseModes` décide du mode : avec deux promotions, celle dont l'élève a gardé au moins la moitié des cours est la sienne.
- **Résistance aux changements d'Hyperplanning** : `withCurrentKeys` suit une matière renommée, `withCurrentLabels` une promotion renommée, et une promotion qui disparaît de Redis est ignorée plutôt que de casser tout le flux.
- **Suppression** : `DELETE` remplace l'abonnement par `{ deletedAt }` pendant 7 jours (clé expirante). Le flux sert alors un **calendrier vide**, pour que les cours disparaissent aussi de l'application de l'élève ; la clé expire ensuite d'elle-même.

### Le flux ICS ([`feed.mjs`](server/feed.mjs), [`ics.mjs`](server/ics.mjs))

À chaque lecture, le flux est **recalculé** à partir du dernier scrap : une nouvelle semaine, un changement de salle ou d'horaire arrive au prochain rafraîchissement du calendrier, sans rien faire côté élève. `ics.mjs` écrit le format ICS à la main (RFC 5545) : un événement par occurrence, fuseau Europe/Brussels déclaré dans le flux, lignes repliées à 75 octets, texte échappé.

Le flux n'est volontairement **pas mis en cache** pendant la bêta : chaque lecture laisse une ligne de log (méthode, statut, application reconnue, jamais le jeton).

### L'état « connecté » ([`feed-reads.mjs`](server/feed-reads.mjs), [`today.mjs`](server/today.mjs))

Pour dire à l'élève si son calendrier est bien branché, on note qui lit son flux. L'application est reconnue à son `user-agent` (jamais stocké), et seules les dates de première et dernière lecture sont gardées. Les règles viennent de constats sur le terrain :

- **Apple** lit le flux *avant* que l'élève confirme l'ajout : il faut une lecture au moins 10 min après la première pour dire « connecté » (sinon « ajout commencé »).
- **Google** ne lit qu'après confirmation : connecté dès la première lecture.
- Sans lecture depuis 24 h (Apple) ou 48 h (Google), l'état passe à `stale`.

Les lectures sont stockées **à part** de l'abonnement, pour qu'une lecture du flux n'écrase jamais une modification de la sélection faite au même moment. `today.mjs` calcule les cours du jour sur la page de l'élève, avec les mêmes cours que le flux.

---

## 6. Le front (`src/`)

React 19 + TypeScript, construit par Vite. Pas de routeur : [`App.tsx`](src/App.tsx) tient un état `screen` et affiche l'écran correspondant.

### Les deux parcours

- **Création** (accueil `/`) : `landing` → `class-choice` (promotion) → `lesson-choice` (cours) → `selection-review` (récapitulatif) → `generation` (envoi à l'API) → `feed-ready`.
- **Retour** (`/m/<jeton>`) : la **page de l'élève**, le lien à garder. Elle affiche l'état du calendrier, les cours du jour, la sélection modifiable (qui repasse par les écrans de choix, puis un `PUT`), et la suppression.

### Les dossiers

| Dossier | Contenu |
| --- | --- |
| `screens/` | Un composant par écran du parcours |
| `components/` | Composants réutilisables (accordéon, carte d'ajout au calendrier, statut, modales…) |
| `data/` | Logique pure côté client : sélection des cours, états du calendrier, liens, partage |
| `api/` | `client.ts` (appels à l'API), `use-remote.ts` (état chargement/erreur/prêt d'une requête) |
| `hooks/` | `use-install-prompt`, `use-today` |
| `styles/` | `tokens.css` (couleurs, espacements), `base.css` |

Chaque composant a son fichier `.css` voisin, en nommage **BEM**.

### Deux détails à connaître

- **Le jeton ne vit que dans l'URL** (`/m/<jeton>`) : c'est tout le « compte » de l'élève. Perdre le lien, c'est perdre l'accès (d'où l'insistance de l'interface sur sa conservation).
- **Safari lit le manifest une seule fois**, au chargement. Le `<link rel="manifest">` est donc créé dans le `<head>` de `index.html`, avant tout rendu, avec le manifest propre à `/m/<jeton>` ; sans cela, l'icône d'écran d'accueil rouvrirait l'accueil au lieu de la page de l'élève.

---

## 7. Parcours d'une donnée : du cours au calendrier

Suivons un cours, « Anglais Q5 », de l'école au téléphone d'un élève.

1. **Collecte.** QStash réveille GitHub Actions. Le scrap ouvre une session invité, retrouve « 3TI Web » par son libellé et demande son planning.
2. **Interprétation.** `parse-schedule` transforme `p`/`d`/`dom` en jour, heures et semaines ; `resolve-rooms` affine la salle semaine par semaine.
3. **Stockage.** `sync-schedules` écrit le tout dans `schedule:3TI Web`, avec la clé `courseKey("Anglais Q5")`.
4. **Choix.** L'élève ouvre le site : `/api/promotions` liste les promotions, `/api/lessons` ses cours (fusionnés avec ceux d'une éventuelle seconde promotion). Il décoche ce qu'il ne suit pas.
5. **Abonnement.** `POST /api/subscription` stocke la sélection (clés de matière) sous le hash du jeton, et renvoie le jeton une fois. Le front redirige vers `/m/<jeton>`.
6. **Branchement.** L'élève clique « Ajouter » : son application s'abonne à `/f/<jeton>` (lien `webcal://` sur iOS, site de Google Agenda sur Android).
7. **Lecture.** À chaque rafraîchissement, `getFeedIcs` lit l'abonnement et les plannings, filtre les cours suivis, et `buildIcs` produit le flux. La lecture est notée (`feed-reads`).
8. **Mise à jour.** Une heure plus tard, un nouveau scrap réécrit le planning ; au prochain rafraîchissement, le calendrier de l'élève change tout seul.

---

## 8. Décisions structurantes (le « pourquoi »)

| Décision | Raison |
| --- | --- |
| Scrap par **promotion**, pas par élève | Aucun identifiant d'élève n'est utilisé ni stocké ; moins de requêtes vers l'école |
| Flux **filtré par cours**, pas par promotion | Certains élèves suivent des cours de deux années (cours non validés) ou un cours en moins |
| Clés de **matière**, pas identifiants de cours | Un identifiant change quand un cours reçoit un code ; la clé reste stable |
| Hash du jeton seul stocké | Une fuite de la base ne donne accès à aucun flux |
| Scrap sur **GitHub Actions**, déclenché par QStash | Limites du cron Vercel Hobby ; cron GitHub peu fiable |
| `server/` séparé de `api/` | Logique testable sans Vercel |
| Aucune dépendance pour Redis, Resend, Hyperplanning | Budget nul, surface d'attaque réduite, `fetch` suffit |
| Flux recalculé à chaque lecture | Les changements arrivent sans action de l'élève |
| Planning jamais écrasé par un résultat douteux | Une erreur viderait le calendrier de toute une promotion |
| Requêtes espacées, `User-Agent` explicite | Pas d'accord officiel de l'HEFF : on reste discret et transparent |

---

## 9. Contribuer

### Lancer en local

```bash
npm install
cp .env.example .env     # puis renseigner Upstash (voir README)
npm run dev:api          # API locale sur :3001 (scripts/dev-api.mjs)
npm run dev              # front Vite, qui relaie /api et /f/ vers :3001
```

`scripts/dev-api.mjs` imite le routage de Vercel : `/api/<nom>` appelle la fonction exportée par `api/<nom>.mjs`. Pas besoin de `vercel dev`.

> **Attention :** `.env` pointe sur l'Upstash de **production**. `npm run stats` y est en lecture seule, mais tout autre script qui écrit (le scrap, notamment) écrit en production. Pour tester le scrap sans risque : `node scraper/scrap-to-redis.mjs --dry-run`.

### Vérifier

| Commande | Effet |
| --- | --- |
| `npm test` | Tests natifs de Node (`node --test`), sur `scraper/`, `shared/`, `server/` |
| `npm run typecheck` | TypeScript, sur le front |
| `npm run build` | Types, puis build de production dans `dist/` |

Les tests (`*.test.mjs`) sont **à côté du code qu'ils vérifient**. Les dépendances externes (Redis, `fetch`, horloge) sont **injectables** (paramètres `redis`, `fetchImpl`, `now`, `clock`) : c'est ce qui rend les tests simples, garde le même style dans le nouveau code.

### Où ajouter quoi ?

| Je veux… | Je touche… |
| --- | --- |
| Gérer une nouvelle promotion ou un nouveau cursus | `scraper/campus-scope.mjs` (`CURRICULA`, `PROMOTION_RENAMES`) |
| Réagir à un changement de format d'Hyperplanning | `scraper/hyperplanning-client.mjs`, `scraper/parse-schedule.mjs` |
| Changer une règle de fusion ou de dédoublonnage des cours | `server/lessons.mjs` (et ses tests) |
| Changer ce que contient le flux ICS | `server/ics.mjs` |
| Ajouter une route d'API | un fichier de logique dans `server/`, un fichier fin dans `api/` |
| Ajouter une clé Redis | `shared/redis-keys.mjs` d'abord, puis le code qui l'utilise |
| Modifier un écran | `src/screens/` et `src/components/` |

### Conventions

Code et identifiants en anglais, commentaires en français ; fichiers en kebab-case, composants et types en PascalCase, constantes en MAJUSCULES, classes CSS en BEM. Détail dans [`README.md`](README.md#conventions).

### Pièges connus

- **Les identifiants de promotion changent à chaque session** Hyperplanning : toujours retrouver une promotion par son libellé.
- **Un code de cours ne suffit jamais** à identifier un cours (codes partagés, cours sans code) : utiliser la clé de matière.
- **Ne jamais mettre le jeton en clair** dans un log, une clé Redis ou une erreur. Le client Redis veille déjà à ne mettre ni jeton ni clé dans ses messages d'erreur.
- **Limites connues du flux** : annulations et mémos d'Hyperplanning ignorés, aucune mise à jour après 17h, Google Agenda se rafraîchit en 8 à 24 h.
