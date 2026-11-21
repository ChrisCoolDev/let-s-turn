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
