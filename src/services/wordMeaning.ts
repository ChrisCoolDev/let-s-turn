import { isValidWord } from '../engine/wordLadder';
import type { Locale } from '../i18n';
import type { Language, WordLength } from '../types/game';

export interface WordMeaningResult {
  word: string;
  valid: boolean;
  definition: string | null;
  source: 'local' | 'api' | 'dictionary' | 'invalid';
}

const CACHE_KEY = 'lets_turn_meaning_cache_v2';

// Définitions instantanées pour les chaînes phares et mots très fréquents
const LOCAL_MEANINGS: Record<string, string> = {
  // EN 4
  'EN:WINE': 'Vin (boisson issue du raisin)',
  'EN:WING': "Aile (d'oiseau, d'avion ou bâtiment)",
  'EN:SING': 'Chanter, fredonner une mélodie',
  'EN:SANG': 'A chanté (passé du verbe sing)',
  'EN:SAND': 'Sable (plage, désert)',
  'EN:SAID': 'A dit / déclaré (passé de say)',
  'EN:SLID': 'A glissé (passé de slide)',
  'EN:SLIM': 'Mince, fin, élancé',
  'EN:SINE': 'Sinus (fonction mathématique)',
  'EN:SANE': "Sain d'esprit, lucide, raisonnable",
  'EN:SINK': 'Évier / couler au fond',
  'EN:SILK': 'Soie (tissu précieux)',
  'EN:COLD': 'Froid, glacial',
  'EN:CORD': 'Corde, cordon, fil électrique',
  'EN:WORD': 'Mot, parole',
  'EN:WARD': 'Salle / quartier / protéger',
  'EN:WARM': 'Chaud, tiède, chaleureux',
  'EN:FIRE': 'Feu, flamme / licencier',
  'EN:FORE': 'Avant, partie antérieure',
  'EN:FORD': 'Gué (passage dans une rivière)',
  'EN:FOLD': 'Plier / pli',
  'EN:GOLD': 'Or (métal précieux)',
  'EN:LOVE': 'Amour, aimer',
  'EN:HOVE': 'Soulevé / apparu (passé de heave)',
  'EN:HAVE': 'Avoir, posséder',
  'EN:HATE': 'Haine, détester',
  'EN:STAR': 'Étoile, vedette',
  'EN:SOAR': "S'élever, planer haut",
  'EN:BOAR': 'Sanglier',
  'EN:BOOR': 'Personne rustre, maladroite',
  'EN:MOOR': 'Lande / amarrer un bateau',
  'EN:MOON': 'Lune',
  'EN:MILK': 'Lait',
  'EN:MILE': 'Mille (unité de distance)',
  'EN:MALE': 'Mâle, masculin',
  'EN:MAKE': 'Faire, fabriquer',
  'EN:CAKE': 'Gâteau',
  'EN:WORK': 'Travail, travailler',
  'EN:CORK': 'Liège, bouchon',
  'EN:CORE': 'Cœur, noyau central',
  'EN:COME': 'Venir, arriver',
  'EN:HOME': 'Maison, foyer',
  'EN:BOOK': 'Livre / réserver',
  'EN:ROOK': 'Tour (échecs) / freux',
  'EN:ROOD': 'Croix / ancienne mesure agraire',
  'EN:ROAD': 'Route, chemin',
  'EN:READ': 'Lire',
  'EN:HEAD': 'Tête / diriger',
  'EN:BEAD': 'Perle, goutte',
  'EN:BEAT': 'Battre / rythme',
  'EN:BOAT': 'Bateau, embarcation',
  'EN:BOOT': 'Botte / coffre / démarrer',
  'EN:FOOT': 'Pied / base',
  'EN:DARK': 'Sombre, obscurité',
  'EN:DARE': 'Oser, défier',
  'EN:DAME': 'Dame',
  'EN:LAME': 'Boiteux / ringard',
  'EN:LAMP': 'Lampe',
  'EN:WOLF': 'Loup',
  'EN:GOLF': 'Golf',
  'EN:GOOF': 'Gaffe, gaffer',
  'EN:GOON': 'Brute, homme de main',
  'EN:LOON': 'Plongeon (oiseau) / hurluberlu',
  'EN:LION': 'Lion',
  'EN:TREE': 'Arbre',
  'EN:FREE': 'Libre, gratuit',
  'EN:FEET': 'Pieds (pluriel de foot)',
  'EN:FEAT': 'Exploit, prouesse',
  'EN:FEAR': 'Peur, craindre',
  'EN:LEAF': 'Feuille',
  'EN:GAME': 'Jeu, partie',
  'EN:PLAY': 'Jouer / pièce de théâtre',
  'EN:LINE': 'Ligne, file',
  'EN:LIME': 'Citron vert / chaux',
  'EN:PINE': 'Pin (arbre) / languir',
  'EN:MINE': 'Mine / le mien',
  'EN:NINE': 'Neuf (9)',
  'EN:FINE': 'Bien, fin, amende',
  'EN:RING': 'Bague, anneau, sonner',
  'EN:KING': 'Roi',
  'EN:PING': 'Signal bref (ping)',
  'EN:SONG': 'Chanson',
  'EN:LONG': 'Long, durable',
  'EN:WINS': 'Gagne, victoires',
  'EN:SINS': 'Péchés, fautes',
  'EN:PINK': 'Rose (couleur)',
  'EN:BLUE': 'Bleu',
  'EN:RAIN': 'Pluie',
  'EN:SNOW': 'Neige',

  // EN 5
  'EN:HEART': 'Cœur',
  'EN:HEARS': 'Entend (présent de hear)',
  'EN:SEARS': 'Saisit / brûle en surface',
  'EN:SCARS': 'Cicatrices',
  'EN:SCARE': 'Effrayer, frayeur',
  'EN:SHARE': 'Partager, part',
  'EN:STARS': 'Étoiles',
  'EN:STARE': 'Fixer du regard',
  'EN:START': 'Commencer, départ',
  'EN:SMART': 'Intelligent, malin',
  'EN:STONE': 'Pierre, caillou',
  'EN:STOLE': 'A volé (passé de steal) / étole',
  'EN:STILE': 'Échalier (passage de clôture)',
  'EN:SMILE': 'Sourire',
  'EN:TRAIN': 'Train / entraîner',
  'EN:BRAIN': 'Cerveau',
  'EN:BRAID': 'Tresse, tresser',
  'EN:BRAND': 'Marque',
  'EN:BLAND': 'Fade, neutre',
  'EN:BLANK': 'Vide, vierge',
  'EN:PLANK': 'Planche',
  'EN:PLANE': 'Avion / plan',

  // FR 4
  'FR:VENT': 'Air en mouvement, souffle naturel',
  'FR:SENT': 'Perçoit une odeur ou un sentiment',
  'FR:SONT': 'Verbe être (3e pers. pluriel)',
  'FR:SONG': 'Chanson (emprunt courant)',
  'FR:SANG': 'Liquide vital rouge circulant dans les veines',
  'FR:LOUP': 'Mammifère carnivore sauvage',
  'FR:COUP': 'Choc, action rapide ou tentative',
  'FR:COUR': 'Espace découvert entouré de murs',
  'FR:JOUR': 'Clarté du soleil, période de 24h',
  'FR:ROSE': 'Fleur parfumée / couleur rose',
  'FR:LOSE': 'Défaite / malchance (familier)',
  'FR:LISE': 'Verbe lire (subjonctif) / prénom',
  'FR:LIME': 'Outil pour polir / agrume vert',
  'FR:PAIN': 'Aliment de base à base de farine',
  'FR:BAIN': 'Immersion dans l’eau',
  'FR:MAIN': 'Extrémité du bras',
  'FR:FOUR': 'Appareil clos pour cuire',
  'FR:BOIS': 'Matière des arbres / petite forêt',
  'FR:FOIS': 'Occasion, occurrence',
  'FR:FOUS': 'Pluriel de fou / verbe foutre',
  'FR:FEUS': 'Défunts (littéraire)',
  'FR:FEUX': 'Flammes, lumières (pluriel de feu)',
  'FR:DAME': 'Femme / pièce du jeu d’échecs',
  'FR:RAME': 'Aviron / feuille de papier',
  'FR:ROME': 'Capitale de l’Italie',
  'FR:ROIS': 'Souverains (pluriel de roi)',
  'FR:MARE': 'Petite étendue d’eau stagnante',
  'FR:MURE': 'Fruit de la ronce / arrivé à maturité',
  'FR:LURE': 'Ville française / ancienne forme de leurre',
  'FR:LUNE': 'Satellite naturel de la Terre',
  'FR:TOUR': 'Édifice élevé / promenade / mouvement circulaire',
  'FR:TOUT': 'Entièreté, chaque chose',
  'FR:PONT': 'Ouvrage franchissant un obstacle',
  'FR:GARE': 'Station de trains',
  'FR:CAFE': 'Boisson stimulante / bistrot',
  'FR:CHAT': 'Félin domestique',
  'FR:SOIR': 'Fin de journée',

  // FR 5
  'FR:TERRE': 'Planète / sol cultivable',
  'FR:PERCE': 'Fait un trou (verbe percer)',
  'FR:PERLE': 'Petite sphère nacrée',
  'FR:MERLE': 'Oiseau chanteur noir à bec jaune',
  'FR:PLAGE': 'Étendue de sable au bord de la mer',
  'FR:PLACE': 'Espace public / endroit / emploi',
  'FR:GLACE': 'Eau gelée / miroir / sorbet',
  'FR:CARTE': 'Document géographique / carte à jouer',
  'FR:PORTE': 'Ouverture permettant d’entrer ou sortir',
  'FR:TABLE': 'Meuble à plateau horizontal',
  'FR:SABLE': 'Grains minéraux fins',
  'FR:LIVRE': 'Ouvrage imprimé / unité de masse',
  'FR:FRIME': 'Apparence trompeuse, frimer',
  'FR:CRIME': 'Infraction grave punie par la loi',
  'FR:CRANE': 'Boîte osseuse de la tête',
};

const LOCAL_MEANINGS_EN: Record<string, string> = {
  // EN 4
  'EN:WINE': 'Alcoholic drink made from fermented grapes',
  'EN:WING': 'Limb or airfoil used for flying',
  'EN:SING': 'Make musical sounds with the voice',
  'EN:SANG': 'Past tense of sing',
  'EN:SAND': 'Loose granular grains on beaches or deserts',
  'EN:SAID': 'Past tense of say',
  'EN:SLID': 'Past tense of slide',
  'EN:SLIM': 'Slender, thin, gracefully narrow',
  'EN:SINE': 'Trigonometric ratio function',
  'EN:SANE': 'Of sound mind, rational, reasonable',
  'EN:SINK': 'Washbasin / go down below a surface',
  'EN:SILK': 'Fine, soft natural fiber from silkworms',
  'EN:COLD': 'Of a low temperature, chilly',
  'EN:CORD': 'Thin flexible string, rope, or cable',
  'EN:WORD': 'Single distinct unit of language',
  'EN:WARD': 'Hospital room / city district / guard',
  'EN:WARM': 'Moderately hot, cozy, friendly',
  'EN:FIRE': 'Combustion / flames / dismiss from a job',
  'EN:FORE': 'Front part / warning shout in golf',
  'EN:FORD': 'Shallow place to cross a river',
  'EN:FOLD': 'Bend something over onto itself',
  'EN:GOLD': 'Precious yellow metal',
  'EN:LOVE': 'Deep affection / care deeply for',
  'EN:HOVE': 'Past tense of heave / came into view',
  'EN:HAVE': 'Possess, own, or hold',
  'EN:HATE': 'Intense dislike or hostility',
  'EN:STAR': 'Luminous celestial body / celebrity',
  'EN:SOAR': 'Fly or rise high in the air',
  'EN:BOAR': 'Wild pig',
  'EN:BOOR': 'Rough, ill-mannered person',
  'EN:MOOR': 'Open uncultivated upland / secure a boat',
  'EN:MOON': "Earth's natural satellite",
  'EN:MILK': 'White nutrient-rich liquid',
  'EN:MILE': 'Unit of linear distance (1,609 m)',
  'EN:MALE': 'Of the sex that produces sperm / masculine',
  'EN:MAKE': 'Form, produce, or create',
  'EN:CAKE': 'Sweet baked dessert',
  'EN:WORK': 'Mental or physical effort / job',
  'EN:CORK': 'Buoyant bark material / bottle stopper',
  'EN:CORE': 'Central or most important part',
  'EN:COME': 'Move toward the speaker / arrive',
  'EN:HOME': 'Place where one lives',
  'EN:BOOK': 'Bound written work / reserve in advance',
  'EN:ROOK': 'Chess castle piece / crow-like bird',
  'EN:ROOD': 'Cross or crucifix / old land measure',
  'EN:ROAD': 'Wide way leading from one place to another',
  'EN:READ': 'Look at and understand written words',
  'EN:HEAD': 'Upper part of the body / leader',
  'EN:BEAD': 'Small pierced piece for threading / drop',
  'EN:BEAT': 'Strike repeatedly / musical pulse',
  'EN:BOAT': 'Small vessel for travelling on water',
  'EN:BOOT': 'Sturdy footwear / car trunk / start up',
  'EN:FOOT': 'Lower extremity of the leg / 12 inches',
  'EN:DARK': 'With little or no light',
  'EN:DARE': 'Have the courage to do something',
  'EN:DAME': 'Titled woman / lady',
  'EN:LAME': 'Unable to walk properly / unconvincing',
  'EN:LAMP': 'Device for giving light',
  'EN:WOLF': 'Wild carnivorous pack canine',
  'EN:GOLF': 'Club-and-ball sport played on a course',
  'EN:GOOF': 'Foolish mistake / blunder',
  'EN:GOON': 'Thug / silly person',
  'EN:LOON': 'Diving waterbird / eccentric person',
  'EN:LION': 'Large tawny wild cat',
  'EN:TREE': 'Woody perennial plant with a trunk',
  'EN:FREE': 'Not confined / costing nothing',
  'EN:FEET': 'Plural of foot',
  'EN:FEAT': 'Achievement requiring great courage or skill',
  'EN:FEAR': 'Unpleasant emotion caused by danger',
  'EN:LEAF': 'Flattened green organ of a plant',
  'EN:GAME': 'Activity played for fun or competition',
  'EN:PLAY': 'Engage in activity for enjoyment / drama',
  'EN:LINE': 'Long narrow mark / row of people',
  'EN:LIME': 'Small green citrus fruit / calcium oxide',
  'EN:PINE': 'Evergreen conifer tree / yearn deeply',
  'EN:MINE': 'Excavation for minerals / belonging to me',
  'EN:NINE': 'The number 9',
  'EN:FINE': 'Of high quality / monetary penalty',
  'EN:RING': 'Circular band / chime sound',
  'EN:KING': 'Male sovereign ruler',
  'EN:PING': 'Short high-pitched ringing sound / network check',
  'EN:SONG': 'Short poem or set of words set to music',
  'EN:LONG': 'Measuring a great distance or time',
  'EN:WINS': 'Achieves victory in a contest',
  'EN:SINS': 'Offenses or misdeeds',
  'EN:PINK': 'Pale red color',
  'EN:BLUE': 'Color of a clear sky',
  'EN:RAIN': 'Condensed moisture falling as drops',
  'EN:SNOW': 'Frozen water crystals falling from clouds',

  // EN 5
  'EN:HEART': 'Muscular organ that pumps blood / core',
  'EN:HEARS': 'Perceives sound (present tense of hear)',
  'EN:SEARS': 'Scorches or burns the surface',
  'EN:SCARS': 'Marks left after a wound heals',
  'EN:SCARE': 'Cause sudden fear or alarm',
  'EN:SHARE': 'Have or give a portion with others',
  'EN:STARS': 'Luminous celestial bodies / celebrities',
  'EN:STARE': 'Look fixedly with eyes wide open',
  'EN:START': 'Begin or set in motion',
  'EN:SMART': 'Intelligent, quick-witted, neat',
  'EN:STONE': 'Hard solid mineral matter / rock',
  'EN:STOLE': 'Past tense of steal / long scarf',
  'EN:STILE': 'Steps allowing people over a fence',
  'EN:SMILE': 'Pleased or amused facial expression',
  'EN:TRAIN': 'Linked railway carriages / teach a skill',
  'EN:BRAIN': 'Organ of thought inside the skull',
  'EN:BRAID': 'Interwoven strands of hair or cord',
  'EN:BRAND': 'Trademark name / burning piece of wood',
  'EN:BLAND': 'Lacking strong flavor or character',
  'EN:BLANK': 'Empty, unmarked, expressionless',
  'EN:PLANK': 'Long flat piece of sawn timber',
  'EN:PLANE': 'Aircraft / flat surface / woodworking tool',

  // FR 4
  'FR:VENT': 'French word: wind, moving air',
  'FR:SENT': 'French word: feels / smells (verb sentir)',
  'FR:SONT': 'French word: are (3rd pers. plural of être)',
  'FR:SONG': 'French word: song (common loanword)',
  'FR:SANG': 'French word: blood',
  'FR:LOUP': 'French word: wolf',
  'FR:COUP': 'French word: blow, move, turn, attempt',
  'FR:COUR': 'French word: courtyard / royal court',
  'FR:JOUR': 'French word: day, daylight',
  'FR:ROSE': 'French word: rose flower / pink color',
  'FR:LOSE': 'French word: bad luck / defeat (slang)',
  'FR:LISE': 'French word: subjunctive of lire (to read)',
  'FR:LIME': 'French word: nail or metal file / lime fruit',
  'FR:PAIN': 'French word: bread',
  'FR:BAIN': 'French word: bath',
  'FR:MAIN': 'French word: hand',
  'FR:FOUR': 'French word: oven',
  'FR:BOIS': 'French word: wood / small forest',
  'FR:FOIS': 'French word: time, occasion',
  'FR:FOUS': 'French word: plural of fou (crazy)',
  'FR:FEUS': 'French word: deceased (literary plural)',
  'FR:FEUX': 'French word: fires, lights (plural of feu)',
  'FR:DAME': 'French word: lady / queen in chess',
  'FR:RAME': 'French word: oar / ream of paper',
  'FR:ROME': 'French word: Rome (capital of Italy)',
  'FR:ROIS': 'French word: kings (plural of roi)',
  'FR:MARE': 'French word: pond, pool',
  'FR:MURE': 'French word: blackberry / ripe (fem.)',
  'FR:LURE': 'French word: town of Lure / old form of lure',
  'FR:LUNE': 'French word: moon',
  'FR:TOUR': 'French word: tower / turn / tour',
  'FR:TOUT': 'French word: everything, all',
  'FR:PONT': 'French word: bridge / ship deck',
  'FR:GARE': 'French word: train station',
  'FR:CAFE': 'French word: coffee / café',
  'FR:CHAT': 'French word: cat',
  'FR:SOIR': 'French word: evening',

  // FR 5
  'FR:TERRE': 'French word: earth, ground, planet',
  'FR:PERCE': 'French word: pierces (verb percer)',
  'FR:PERLE': 'French word: pearl, bead',
  'FR:MERLE': 'French word: blackbird',
  'FR:PLAGE': 'French word: beach',
  'FR:PLACE': 'French word: square / spot / seat',
  'FR:GLACE': 'French word: ice / ice cream / mirror',
  'FR:CARTE': 'French word: card / map / menu',
  'FR:PORTE': 'French word: door / carries (verb porter)',
  'FR:TABLE': 'French word: table',
  'FR:SABLE': 'French word: sand',
  'FR:LIVRE': 'French word: book / pound',
  'FR:FRIME': 'French word: showing off, pretense',
  'FR:CRIME': 'French word: crime, felony',
  'FR:CRANE': 'French word: skull / brag (slang)',
};

const memoryCache = new Map<string, string>();

function loadPersistentCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function savePersistentCache(key: string, value: string): void {
  try {
    const current = loadPersistentCache();
    current[key] = value;
    // Cap size at 300 entries
    const keys = Object.keys(current);
    if (keys.length > 300) {
      delete current[keys[0]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore quota errors
  }
}

export function getImmediateWordMeaning(
  word: string,
  lang: Language,
  uiLocale: Locale = 'fr'
): WordMeaningResult {
  const clean = word.trim().toUpperCase();
  const length = clean.length;
  if (length !== 4 && length !== 5) {
    return { word: clean, valid: false, definition: null, source: 'invalid' };
  }

  const valid = isValidWord(clean, lang, length as WordLength);
  if (!valid) {
    return { word: clean, valid: false, definition: null, source: 'invalid' };
  }

  const lookupKey = `${lang}:${clean}`;
  const localMap = uiLocale === 'en' ? LOCAL_MEANINGS_EN : LOCAL_MEANINGS;
  if (localMap[lookupKey]) {
    return {
      word: clean,
      valid: true,
      definition: localMap[lookupKey],
      source: 'local',
    };
  }

  const cacheKey = `${uiLocale}:${lookupKey}`;
  if (memoryCache.has(cacheKey)) {
    return {
      word: clean,
      valid: true,
      definition: memoryCache.get(cacheKey) ?? null,
      source: 'api',
    };
  }

  const persisted = loadPersistentCache();
  if (persisted[cacheKey]) {
    memoryCache.set(cacheKey, persisted[cacheKey]);
    return {
      word: clean,
      valid: true,
      definition: persisted[cacheKey],
      source: 'api',
    };
  }

  return {
    word: clean,
    valid: true,
    definition: null,
    source: 'dictionary',
  };
}

export async function fetchWordMeaning(
  word: string,
  lang: Language,
  signal?: AbortSignal,
  uiLocale: Locale = 'fr'
): Promise<WordMeaningResult> {
  const immediate = getImmediateWordMeaning(word, lang, uiLocale);
  if (!immediate.valid || immediate.definition) {
    return immediate;
  }

  const clean = immediate.word;
  const cacheKey = `${uiLocale}:${lang}:${clean}`;

  try {
    if (lang === 'EN') {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${clean.toLowerCase()}`,
        { signal }
      );
      if (res.ok) {
        const data = (await res.json()) as Array<{
          meanings?: Array<{
            partOfSpeech?: string;
            definitions?: Array<{ definition?: string }>;
          }>;
        }>;
        const firstMeaning = data?.[0]?.meanings?.[0];
        const def = firstMeaning?.definitions?.[0]?.definition;
        if (def) {
          const pos = firstMeaning?.partOfSpeech ? `(${firstMeaning.partOfSpeech}) ` : '';
          const formatted = `${pos}${def}`.slice(0, 110);
          memoryCache.set(cacheKey, formatted);
          savePersistentCache(cacheKey, formatted);
          return { word: clean, valid: true, definition: formatted, source: 'api' };
        }
      }
    } else if (uiLocale === 'fr') {
      const res = await fetch(
        `https://fr.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(
          clean.toLowerCase()
        )}`,
        { signal }
      );
      if (res.ok) {
        const data = (await res.json()) as { extract?: string };
        if (data?.extract) {
          const firstSentence = data.extract.split('\n')[0].trim().slice(0, 110);
          if (firstSentence) {
            memoryCache.set(cacheKey, firstSentence);
            savePersistentCache(cacheKey, firstSentence);
            return { word: clean, valid: true, definition: firstSentence, source: 'api' };
          }
        }
      }
    }
  } catch {
    // Offline or network blocked: fallback gracefully to dictionary validation
  }

  const fallbackDefinition =
    uiLocale === 'en'
      ? lang === 'EN'
        ? 'Valid English dictionary word'
        : 'Valid French dictionary word'
      : lang === 'EN'
      ? 'Mot anglais courant valide du dictionnaire'
      : 'Mot français courant valide du dictionnaire';

  return {
    word: clean,
    valid: true,
    definition: fallbackDefinition,
    source: 'dictionary',
  };
}
