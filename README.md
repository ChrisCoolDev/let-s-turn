# Let's Turn — Duo Word Ladder

Jeu de chaîne de mots coopératif et compétitif (4 et 5 lettres, **Français** & **Anglais**) inspiré de l'esthétique Duolingo, jouable en **PWA** sur mobile et desktop.  
Transforme un mot de départ en mot cible une lettre à la fois (`WINE → WING → SING → ... → SLIM`), débloque des badges, des thèmes visuels et partage des duels par lien ou code salon.

---

## Fonctionnalités principales

- **Moteur Word Ladder + BFS optimal** (`src/engine/wordLadder.ts`, `src/engine/dictionaries.ts`) : validation dictionnaire FR/EN instantanée, calcul du plus court chemin (`optimalPar`), détection de boucle/impasse et indices ciblés.
- **Définitions en direct** (`src/services/wordMeaning.ts`) : lexique local intégré complété par `dictionaryapi.dev` (EN) et `fr.wiktionary.org` (FR) avec mise en cache `localStorage`.
- **Solo & Multijoueur** (`src/services/multiplayer.ts`) :
  - Partenaire automatique intelligent (**Carole**) pour jouer immédiatement en solo ou tester le Défi du jour.
  - Mode 2 joueurs par code ou lien d'invitation (`/join/<CODE>` ou `?join=<CODE>`) avec indicateur de saisie en direct.
  - **Passage automatique du tour (`30s`)** : si le joueur qui a la main met trop de temps à jouer dans une partie à 2 joueurs, le tour passe automatiquement à l'autre joueur.
- **Gamification & Cosmétiques** (`src/engine/gamification.ts`) : XP, niveaux, étoiles, série quotidienne, badges, effets de victoire (`confetti`, `sparkles`, `hearts`, `lightning`), avatars et **5 thèmes** (`classic`, `cyberpunk`, `nyt`, `pastel`, `oled`).
- **PWA installable** (`public/manifest.webmanifest`, `public/sw.js`) : icônes `192x192` / `512x512`, cache offline et support des notifications Web Push.

---

## Stack technique

- **Frontend** : React 18, TypeScript 5, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `canvas-confetti`
- **Backend prévu** : Supabase (PostgreSQL, Anonymous Auth, Row Level Security, Realtime) via `supabase/schema.sql`

---

## Structure du projet

```text
lets-turn/
├── index.html                        # Métadonnées PWA, Google Fonts (Nunito), point d'entrée
├── package.json                      # Scripts dev / build / preview et dépendances
├── vite.config.ts                    # Configuration Vite (port 5173) + Tailwind v4
├── public/
│   ├── manifest.webmanifest          # Manifeste PWA (standalone, portrait)
│   ├── sw.js                         # Service Worker (cache App Shell & notifications push)
│   ├── icon-192.png / icon-512.png   # Icônes PWA
│   └── avatars/                      # Avatars PNG détourés (0..5)
├── supabase/
│   └── schema.sql                    # Schéma SQL complet (tables, index, RLS, Realtime)
└── src/
    ├── App.tsx                       # Orchestration des écrans, tours, timeouts & sync
    ├── index.css                     # Variables CSS des 5 thèmes et styles tactiles 3D
    ├── main.tsx                      # Montage React + enregistrement du Service Worker
    ├── types/game.ts                 # Types TypeScript (Profile, GameRoom, WordMove...)
    ├── engine/
    │   ├── dictionaries.ts           # Dictionnaires FR / EN (4 et 5 lettres)
    │   ├── wordLadder.ts             # Génération de paires, BFS optimal, validation 1 lettre
    │   └── gamification.ts           # XP, niveaux, badges, boutique thèmes/effets
    ├── services/
    │   ├── multiplayer.ts            # Sync locale + Supabase, timer de tour 30s
    │   ├── supabaseClient.ts         # Client Supabase, Anonymous Auth, Realtime & CRUD
    │   ├── supabaseConfig.ts         # Lecture des variables VITE_SUPABASE_URL / ANON_KEY
    │   └── wordMeaning.ts            # Définitions locales + API Wiktionary / DictionaryAPI
    └── components/                   # Écrans Hub, Plateau, Victoire, Collection & Onboarding
```

---

## 1. Installation et lancement en local

### Prérequis

- **Node.js** `>= 18` (recommandé : Node `20 LTS` ou `22`)
- **npm** `>= 9`

### Démarrer le serveur de développement

```bash
npm install
npm run dev
```

L'application est accessible sur `http://localhost:5173` (et sur le réseau local grâce à `server.host: true` dans `vite.config.ts`).

### Vérifier le build de production localement

```bash
npx tsc --noEmit && npm run build
npm run preview
```

> **Synchronisation hybride (Local + Supabase)** : si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont configurées, l'app connecte automatiquement une session anonyme Supabase (`auth.signInAnonymously()`) et synchronise profils, salons, coups, saisie en direct et passages de tour (`30s`) via PostgreSQL + Supabase Realtime, tout en conservant `localStorage` + `BroadcastChannel` comme cache instantané et fallback hors-ligne.

---

## 2. Configurer la base de données Supabase

Le schéma PostgreSQL complet est déjà prêt dans [`supabase/schema.sql`](supabase/schema.sql).

### Étape A — Créer le projet Supabase

1. Connecte-toi sur [supabase.com](https://supabase.com) et clique sur **New project**.
2. Choisis une organisation, nomme le projet (ex. `lets-turn-prod`), génère un mot de passe fort et sélectionne la région la plus proche de tes utilisateurs (ex. `West EU (Ireland)` ou `Central EU (Frankfurt)`).
3. Attends que l'instance PostgreSQL soit provisionnée (~1–2 minutes).

### Étape B — Activer l'authentification anonyme (Anonymous Sign-Ins)

Les règles RLS (Row Level Security) de `supabase/schema.sql` reposent sur `auth.uid()` pour les utilisateurs authentifiés sans création de compte manuelle :

1. Dans le menu latéral Supabase, va dans **Authentication → Sign In / Providers** (ou **Authentication → Settings** selon la version du dashboard).
2. Active **Allow anonymous sign-ins** (`Anonymous Sign-Ins`).
3. Enregistre les modifications.

### Étape C — Exécuter le schéma SQL

1. Va dans **SQL Editor → New query**.
2. Copie-colle l'intégralité du fichier [`supabase/schema.sql`](supabase/schema.sql) et clique sur **Run**.

Ce script crée :

- Les extensions et 3 tables :
  - `public.profiles` : profil du joueur (`id` lié à `auth.users`, `xp`, `stars`, `streak`, `unlocked_badges`, `unlocked_themes`, `active_theme`, `push_subscription`).
  - `public.rooms` : salons (`code`, `language`, `word_length`, `mode`, `start_word`, `target_word`, `current_word`, `optimal_par`, `optimal_path`, `host_player_id`, `partner_player_id`, `current_turn_player_id`, `status`, etc.).
  - `public.moves` : historique ordonné des coups (`room_code`, `step_number`, `word`, `changed_index`, `from_char`, `to_char`, `player_id`).
- Les index `idx_moves_room_code_step` et `idx_rooms_players`.
- Les politiques **RLS** permettant aux joueurs authentifiés (y compris anonymes) de lire et mettre à jour leurs propres profils et les salons auxquels ils participent.
- L'activation **Supabase Realtime** (`alter publication supabase_realtime add table public.rooms;`, `public.moves`).

### Étape D — Vérifier Realtime et les URLs autorisées

1. Dans **Database → Publications** (ou **Replication**), vérifie que la publication **`supabase_realtime`** inclut bien les tables `rooms` et `moves`.
2. Dans **Authentication → URL Configuration**, renseigne ton URL de production dans **Site URL** (ex. `https://lets-turn.vercel.app`) et ajoute `http://localhost:5173/**` ainsi que `https://ton-domaine/**` dans **Redirect URLs**.

### Étape E — Récupérer les clés API et configurer `.env.local` (ou `env.local`)

1. Va dans **Project Settings → API**.
2. Copie :
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Project API key `anon` (`public`)** _(ne jamais mettre la clé `service_role` dans le frontend Vite !)_.
3. Place ces variables dans `.env.local` ou `env.local` à la racine du projet (`vite.config.ts` charge automatiquement `env.local` en fallback, et les deux fichiers sont ignorés par `.gitignore`) :

```env
VITE_SUPABASE_URL="https://VOTRE-PROJET.supabase.co"
VITE_SUPABASE_ANON_KEY="VOTRE-CLE-ANON-PUBLIQUE"
```

### Étape F — Intégration SDK Supabase (déjà câblée)

- `@supabase/supabase-js` est installé dans `package.json`.
- [`src/services/supabaseClient.ts`](src/services/supabaseClient.ts) gère le client singleton, `ensureSupabaseSession()` (authentification anonyme), le CRUD `profiles` / `rooms` / `moves`, la prise de siège partenaire à l'ouverture d'un lien `/join/<CODE>`, et la synchronisation **Supabase Realtime** (`postgres_changes` + canal `broadcast` pour `isTyping`, `turnStartedAt` et `lastTurnPass`).
- [`src/services/multiplayer.ts`](src/services/multiplayer.ts) et [`src/App.tsx`](src/App.tsx) orchestrent la migration transparente du `playerId` local vers `auth.uid()` et gardent le mode hors-ligne opérationnel si Supabase est injoignable.

---

## 3. Déployer en production

### Étape 1 — Vérifier `.gitignore` et le build

Un fichier [`.gitignore`](.gitignore) est déjà présent à la racine (`node_modules/`, `dist/`, `*.tsbuildinfo`, `.DS_Store`, `.env`, `.env.local`, `.env.*.local`, `env.local`).

Vérifie ensuite que le build passe sans erreur :

```bash
npx tsc --noEmit && npm run build
```

Les fichiers statiques prêts à déployer sont générés dans `dist/`.

### Point critique : Routing SPA pour les liens `/join/<CODE>` et Service Worker PWA

L'application partage des liens d'invitation du type `https://ton-domaine.com/join/WINE-42` (traités côté client dans `src/App.tsx`).  
Sur un hébergeur statique, un accès direct à `/join/WINE-42` renverra une erreur **404** si le serveur n'est pas configuré pour rediriger toutes les routes vers `/index.html`.  
De plus, `public/sw.js` doit être servi sans cache HTTP long pour que les mises à jour PWA se propagent immédiatement.

---

### Option 1 — Déployer sur Vercel (recommandé)

1. Crée un fichier `vercel.json` à la racine du projet :

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [
        { "key": "Content-Type", "value": "application/manifest+json" }
      ]
    }
  ]
}
```

2. Déploie via l'interface [vercel.com](https://vercel.com) (import du repo Git) **ou** en CLI :

```bash
npm i -g vercel
vercel
```

3. Paramètres de build sur Vercel :
   - **Framework Preset** : `Vite`
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
4. Dans **Project Settings → Environment Variables**, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, puis lance un déploiement production (`vercel --prod`).

---

### Option 2 — Déployer sur Netlify

1. Crée un fichier `netlify.toml` à la racine :

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

2. Connecte ton dépôt sur [app.netlify.com](https://app.netlify.com) ou déploie avec la CLI :

```bash
npm i -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

3. Ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans **Site configuration → Environment variables**, puis redéploie pour qu'elles soient injectées au moment du `vite build`.

---

### Option 3 — Déployer sur Cloudflare (Pages ou Workers Static Assets)

Le fichier [`public/_headers`](public/_headers) est déjà configuré (copié automatiquement dans `dist/_headers`) pour empêcher le cache HTTP sur `/sw.js`, `/index.html` et `/manifest.webmanifest` tout en mettant en cache long les fichiers hashés `/assets/*`.

#### Voie A — Cloudflare Pages (recommandée pour une SPA Vite)

1. Dans **Cloudflare Dashboard → Workers & Pages → Create**, clique sur l'onglet **Pages** (en bas ou dans le sélecteur **Looking to deploy Pages?**) puis **Connect to Git**.
2. Configure le build :
   - **Framework preset** : `Vite`
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
3. **Routing `/join/<CODE>`** : tant qu'il n'y a pas de fichier `404.html` dans `dist/`, Cloudflare Pages passe automatiquement en mode SPA et sert `/index.html` (`200 OK`) pour `/join/WINE-42`. _(Ne pas créer de `_redirects` avec `/* /index.html 200` sur Cloudflare Pages.)_
4. Dans **Settings → Environment variables**, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Production et Preview), puis relance un déploiement.

#### Voie B — Cloudflare Workers Static Assets (`wrangler deploy` ou import Git en mode Workers)

Si Cloudflare crée un projet **Workers** plutôt que **Pages**, ajoute un fichier `wrangler.jsonc` à la racine pour activer le fallback SPA :

```jsonc
{
  "name": "lets-turn",
  "compatibility_date": "2026-11-18",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Puis déploie avec `npm run build && npx wrangler deploy` (et pense à ajouter `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` dans les variables de build du Worker).

---

## 4. Checklist de vérification après déploiement

- [ ] **HTTPS actif** : indispensable pour l'installation PWA (`manifest.webmanifest`), le Service Worker (`sw.js`), le bouton de partage natif (`navigator.share`) et les notifications.
- [ ] **Deep link `/join/WINE-42`** : ouvrir `https://ton-domaine/join/WINE-42` directement dans un nouvel onglet charge bien la partie (pas de 404).
- [ ] **Onboarding & Thèmes** : tester le changement de thème (Classique, Néon Cyberpunk, Papier Journal NYT, Pastel Rose, Mode Sombre OLED) dans le Vestiaire.
- [ ] **Définitions de mots** : vérifier dans la console réseau qu'aucune politique CSP ne bloque `api.dictionaryapi.dev` ni `fr.wiktionary.org`.
- [ ] **Supabase (si activé)** : vérifier dans **Authentication → Users** qu'un utilisateur anonyme est créé à la première visite et que les lignes apparaissent bien dans `profiles`, `rooms` et `moves`.

---

## Dépannage rapide

| Symptôme                                                | Cause probable                                                                      | Solution                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `404 Not Found` en ouvrant `/join/XXXX`                 | Réécriture SPA absente sur l'hébergeur                                              | Sur Cloudflare Pages : vérifier l'absence de `404.html`. Sur Workers : ajouter `not_found_handling: "single-page-application"`. Sinon `vercel.json` / `netlify.toml`. |
| Erreur RLS `new row violates row-level security policy` | Utilisateur non authentifié (`auth.uid()` null) ou **Anonymous Sign-Ins** désactivé | Activer **Allow anonymous sign-ins** dans Supabase et appeler `signInAnonymously()` avant d'écrire en base                 |
| Coups de l'adversaire visibles seulement après F5       | **Realtime** non activé sur `rooms` / `moves`                                       | Exécuter les deux `alter publication supabase_realtime add table ...` de `supabase/schema.sql`                             |
| Variables `VITE_SUPABASE_*` `undefined` en prod         | Ajoutées après le build                                                             | Les variables `VITE_*` sont injectées à la compilation : relancer un déploiement (`Redeploy`) après les avoir enregistrées |
