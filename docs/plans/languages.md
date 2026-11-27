# Plan — Tamalou en neuf langues

Le plan de la piste 8 de `docs/IDEAS.md` (2026-11-27). On ajoute à l'interface l'espagnol, l'italien, le portugais, l'allemand, le japonais et le chinois (simplifié et traditionnel), en plus du français et de l'anglais. Sont traduits : tout le jeu, les règles et leurs écrans, la page d'accueil (première manche guidée et quiz compris), les mentions légales, la page 404, les cartes d'aperçu et le manifeste de l'application installée. Ne changent pas : le français reste la langue principale et la source de tous les textes ; le code, les commits, la mémoire, les ADR et le `CHANGELOG.md` restent en anglais ; la page `/admin/` reste en français (elle n'a qu'un lecteur) ; la console du serveur LAN aussi.

Ce document se lit avant de lancer chaque étape (§ 6). Les choix du propriétaire sont tranchés (§ 7) et consignés dans l'**ADR-0028** (`docs/DECISIONS.md`), qui fait foi.

---

## 1. L'état des lieux

Ce qui aide : presque tout le texte passe déjà par des dictionnaires.

- **Le jeu** : `apps/web/src/i18n/fr.ts` est la source, environ 800 clés. `en.ts` est typé contre lui : une clé qui manque fait échouer le typecheck. `test/i18n.test.ts` vérifie que les clés et les `{placeholders}` sont les mêmes. `t()`, `plural()`, `ordinal()`, `cardName()`, `rankShort()` et `presetText()` font 86 lignes, sans bibliothèque. Les clés `_you` donnent les phrases à la deuxième personne.
- **La page d'accueil** : `src/landing/text.ts` (FR et EN dans un `Record`). Elle est écrite au build par `markup.ts` et relue dans le navigateur pour la manche guidée et le quiz.
- **Les mentions légales** : `src/legal/text.ts`, même forme.
- **Les têtes de pages, les adresses, les cartes d'aperçu** : `build/site.ts` (`PAGES`, `OG_IMAGES`, `CARD_COPY`) et `build/pages.ts`. La 404 (`build/notfound.ts`) est bilingue sur une seule page.
- **Le texte écrit en dur ailleurs** est rare. Il y a les noms des couleurs (`packages/shared/src/cards.ts`), les noms et descriptions des presets (`packages/shared/src/presets.ts`, déjà doublés par les clés `preset_*`), la console du serveur LAN et la page admin (hors périmètre).

Ce qui bloque aujourd'hui : **le code suppose deux langues**.

- `type Lang = 'fr' | 'en'` est redéclaré à cinq endroits (`i18n/index.ts`, `build/site.ts`, `landing/markup.ts`, `legal/markup.ts`, le schéma d'usage `packages/shared/src/usage.ts`).
- Ailleurs, le code teste `lang === 'en' ? 'en' : 'fr'` (`landing/main.tsx`, `legal/main.ts`, `usage.ts`).
- Une page a **un** jumeau (`twin`), alors qu'il en faudra huit.
- Le lien de langue nomme « l'autre » langue. La 404 met les deux langues l'une sous l'autre.
- `plural()` et `ordinal()` codent en dur la règle du français et celle de l'anglais.
- **Les polices** (Bricolage Grotesque, Figtree, JetBrains Mono) n'ont que l'alphabet latin. L'espagnol, l'italien, le portugais et l'allemand passent, puisque le latin étendu y est. Le japonais et le chinois n'ont aucun glyphe dans ces polices.
- Le jeu démarre **toujours en français** quand rien n'est mémorisé, même sur un téléphone réglé en anglais.

Le poids : un dictionnaire du jeu pèse environ 11 Ko compressé. Neuf langues chargées d'office ajouteraient environ 100 Ko au jeu (aujourd'hui environ 230 Ko compressés). D'où le chargement à la demande (§ 2.3).

---

## 2. Les choix techniques

### 2.1 On garde le système maison

**Choix** : `t()` reste, et on l'étend : liste des langues, pluriels par `Intl`, chargement à la demande.

**Pourquoi** : il est typé (une clé manquante ne compile pas), minuscule et compris de tous les tests. Les langues visées n'ont que deux formes de pluriel (« un » et « autre »), voire une seule pour le japonais et le chinois. Les messages ICU n'apporteraient donc rien d'indispensable.

**Écartés** :
- i18next et FormatJS : du poids, une migration des 800 clés et de leurs usages, pour des fonctions qu'on n'utilise pas.
- Paraglide : tri des clés au build, élégant, mais c'est une réécriture des appels pour un gain de quelques Ko.
- Une plateforme de traduction (Crowdin, Weblate, Lokalise) : utile le jour où des bénévoles traduiront, à reconsidérer à ce moment-là (Weblate est gratuit pour les projets libres).
- Une API de traduction automatique (DeepL) en CI : une clé, un coût, et un vocabulaire de jeu moins bien tenu qu'avec un glossaire relu par l'agent.

### 2.2 Une seule liste des langues

`packages/shared/src/languages.ts`, pur, lu par le jeu, le build, le schéma d'usage et les tests. Une entrée par langue :

| code | nom affiché | adresse | `lang` HTML | hreflang | `og:locale` |
|---|---|---|---|---|---|
| `fr` | Français | `/` | `fr` | `fr` + `x-default` | `fr_FR` |
| `en` | English | `/en/` | `en` | `en` | `en_US` |
| `es` | Español | `/es/` | `es` | `es` | `es_ES` |
| `it` | Italiano | `/it/` | `it` | `it` | `it_IT` |
| `pt` | Português | `/pt/` | `pt-BR` | `pt` | `pt_BR` |
| `de` | Deutsch | `/de/` | `de` | `de` | `de_DE` |
| `ja` | 日本語 | `/ja/` | `ja` | `ja` | `ja_JP` |
| `zh-Hans` | 简体中文 | `/zh-hans/` | `zh-Hans` | `zh-Hans` | `zh_CN` |
| `zh-Hant` | 繁體中文 | `/zh-hant/` | `zh-Hant` | `zh-Hant` | `zh_TW` |

Chaque entrée porte aussi : la locale `Intl` (pluriels, dates, ordinaux), la pile de polices, et le statut `ready` (une langue n'apparaît dans le sélecteur qu'une fois complète et relue par l'agent). Les cinq `type Lang` redéclarés disparaissent au profit de celui-ci.

### 2.3 Le chargement à la demande

Le français et l'anglais restent dans le paquet du jeu : le français est la source, l'anglais le repli. Les autres langues deviennent des fichiers séparés (`import()`), que le service worker met en cache comme le reste, si bien que le jeu marche hors ligne dans toutes les langues.

Au démarrage, si la langue retenue n'est ni le français ni l'anglais, le jeu attend son dictionnaire avant de se dessiner. C'est instantané depuis le cache, et une fraction de seconde la première fois. `setLang()` devient asynchrone : il charge, puis redessine.

Pour l'accueil et les mentions : chaque page statique est écrite au build dans sa langue et ne charge que les textes de sa langue (aujourd'hui, `LANDING` embarque le français et l'anglais dans les deux pages).

### 2.4 Pluriels, ordinaux, dates

- `plural()` passe par `Intl.PluralRules(locale)`. Les clés `_one` et `_other` suffisent pour les neuf langues. Le japonais et le chinois ne répondent que `other`. Le français compte toujours 0 au singulier, puisque c'est la règle d'`Intl` pour `fr`.
- `ordinal()` devient une clé par langue (« 1er », « 2e », « 1.º », « 1.», « 1位 », « 第1名 »…) plutôt que du code par langue.
- Les dates de « Mes parties » utilisent déjà `Intl.DateTimeFormat(lang)`. Il suffit de leur passer la locale de la liste.

### 2.5 Choisir sa langue

- **Le sélecteur** : la pastille globe de l'en-tête reste, avec le nom de la langue écrit dans cette langue, comme décidé le 2026-11-27. Avec neuf langues, elle ouvre une **liste** où chaque langue est écrite dans sa propre écriture. Les drapeaux restent écartés : un drapeau nomme un pays, pas une langue. Le menu déroulant avait été écarté parce qu'il cachait deux choix seulement ; à neuf, il devient le bon outil. Dans les Réglages du jeu, les boutons radio deviennent cette même liste.
- **La détection** (retenue) : à la première visite du jeu, sans choix mémorisé, il prend la première langue de `navigator.languages` qu'il connaît (`zh-TW`, `zh-HK` → traditionnel ; `zh`, `zh-CN`, `zh-SG` → simplifié ; `pt-*` → portugais), et le français à défaut. Un choix fait à la main l'emporte toujours. Les pages d'accueil **ne redirigent pas** : une redirection selon la langue du navigateur gêne les robots des moteurs de recherche et surprend quand on ouvre un lien partagé. À la place, l'accueil français affiche un bandeau discret « Disponible en español » quand le navigateur parle une autre langue disponible.
- `?lang=xx` force toujours une langue, ce qui sert aux tests et aux captures.

### 2.6 Adresses et référencement

- Une page d'accueil et une page de mentions par langue : `/es/`, `/es/legal/`, et ainsi de suite. `/mentions-legales/` et `/en/legal/` gardent leur adresse.
- `twin` devient la liste complète des versions : chaque page déclare les neuf `hreflang`, plus `x-default` sur la racine française. Le sitemap les reprend (`xhtml:link`), et `llms.txt` liste les pages par langue.
- Le jeu (`play/`) reste **une seule** page pour toutes les langues : il n'est pas indexé comme contenu, et les liens de salle (`#room=`) doivent marcher pour tout le monde.
- Titre et description de chaque accueil : écrits pour la recherche dans la langue, pas traduits mot à mot. Pour le japonais et le chinois, le nom en caractères latins reste, et une transcription vient en appui (**à vérifier** par un natif : タマルー ?).

### 2.7 Polices et typographie du japonais et du chinois

- **Aucune police web CJK.** Une police japonaise ou chinoise complète pèse plusieurs Mo par graisse. Chaque système en fournit une bonne : PingFang et Hiragino sur Apple, Noto CJK sur Android, Yu Gothic et Microsoft JhengHei/YaHei sur Windows. Les piles de polices passent par `:lang()` : `:lang(ja)` → Hiragino Sans, Yu Gothic, Noto Sans JP ; `:lang(zh-Hans)` → PingFang SC, Microsoft YaHei, Noto Sans SC ; `:lang(zh-Hant)` → PingFang TC, Microsoft JhengHei, Noto Sans TC. Les chiffres et les lettres latines gardent nos polices, placées en tête de pile.
- **L'attribut `lang` exact est indispensable.** Le même caractère se dessine différemment en japonais, en chinois simplifié et en chinois traditionnel. Avec un mauvais `lang`, un Japonais lit des glyphes chinois.
- Des réglages sous `:lang(ja)` et `:lang(zh)` : `letter-spacing: 0` et pas de `text-transform` ; `line-break: strict` ; `word-break: auto-phrase` en japonais, sinon une ligne peut couper au milieu d'un mot ; pas d'italique (l'`<em>` du titre d'accueil prend une autre mise en valeur) ; jamais de texte sous 12 px.
- **L'allemand** est la langue la plus longue, environ 30 % de plus que l'anglais. C'est elle qui teste la barre d'action sur une ligne, les boutons et les tuiles des règles sur téléphone. Il faut prévoir des `hyphens: auto` là où un mot composé peut déborder.

### 2.8 Ce qui n'est pas dans les dictionnaires du jeu

- **Les mentions légales** : traduites intégralement, avec une phrase en tête : « Traduction fournie pour information ; la version française fait foi. » L'éditeur, l'hébergeur et le droit applicable restent français. Le test qui confronte la liste des événements mesurés au code s'applique à chaque langue.
- **La 404** : le français et l'anglais restent écrits dans la page. Un petit script, autorisé par empreinte dans la politique de sécurité comme les autres, ajoute la langue du visiteur si on la connaît.
- **Les cartes d'aperçu** : une par langue (`og-es-v2.png`…), dessinées par `scripts/card.mjs`. Pour le japonais et le chinois, le conteneur doit avoir les polices Noto CJK installées le temps du dessin. Les PNG sont commis, comme aujourd'hui.
- **Le manifeste** : un manifeste par langue, avec le même `id` et la même adresse de départ, pour les noms des raccourcis (« Partie solo », « À plusieurs ») et la description. Chaque accueil lie le sien ; le jeu change le lien du manifeste selon la langue avant une installation.
- **Les captures de la boîte d’installation** (par défaut) : en français et en anglais seulement au départ, puisque ce sont huit images par langue. On les ajoutera par langue si les installations le justifient.
- **Les noms des bots** : une liste par langue, des prénoms du pays, aussi désuets et drôles que les français (Dagobert, Hortense…).
- **Les lettres des figures** : ce sont celles imprimées sur les jeux vendus dans le pays (§ 4).

### 2.9 Statistiques d'usage et tables mixtes

- Le schéma d'usage (`packages/shared/src/usage.ts`) accepte les neuf codes, pris dans la liste, et `/admin/` répartit les parties par langue. Le Worker et le site partent ensemble de `main`, donc pas de décalage. Un vieux client continue d'envoyer `fr` ou `en`.
- **Une salle en ligne peut mélanger les langues sans rien changer** : le serveur n'envoie que des événements et des vues, et chaque appareil les raconte dans sa langue. Seuls les noms des bots et des presets choisis par le maître de jeu restent dans sa langue à lui, ce qui est acceptable.

---

## 3. La façon de traduire : un skill et des garde-fous

### 3.1 Les fichiers

- `apps/web/src/i18n/<code>.ts` pour le jeu, `src/landing/text/<code>.ts` et `src/legal/text/<code>.ts` pour les pages, tous typés contre la source française. Une clé manquante ne compile pas.
- `docs/i18n/glossary.md` : un tableau par terme du jeu (Tamalou, pioche, défausse, défausse rapide, pouvoir, regarder, échanger, maître de jeu, manche, partie, pénalité, salle, bot, Valet/Dame/Roi, Joker…), avec son équivalent dans chaque langue. Le mot « Tamalou » et le cri « Tamalou ! » ne se traduisent jamais.
- `docs/i18n/<code>.md` : le guide de style de chaque langue (§ 4) : le registre, la ponctuation, les guillemets, les lettres des figures, les pièges connus.
- `apps/web/src/i18n/lock.json` : pour chaque langue et chaque clé, l'empreinte du texte français à partir duquel elle a été traduite. C'est ce qui permet de savoir qu'une traduction est **périmée** quand le français a changé.

### 3.2 Les commandes

- `pnpm i18n:status` liste, par langue, les clés manquantes, les clés périmées (français changé depuis) et les clés identiques au français (souvent un oubli, sauf exceptions listées : « Tamalou », « Joker », « Bot {n} »…).
- `pnpm i18n:stamp <code>` enregistre dans `lock.json` les empreintes des clés qui viennent d'être traduites.
- `pnpm i18n:shots <code>` fait les captures de chaque écran à la taille d'un téléphone et d'un ordinateur, dans les deux thèmes, pour repérer un débordement ou un texte coupé. Il réutilise la mécanique de `scripts/screenshots.ts` : accueil, lancement, règles, table, fin de manche, journal, salon.

### 3.3 Le skill `/translate`

`.claude/skills/translate/SKILL.md`, dans le dépôt, donc disponible dans toutes les sessions, en local comme dans le cloud. Il se lance avec `/translate` (toutes les langues) ou `/translate de`. Il fait, dans l'ordre :

1. `pnpm i18n:status` pour savoir quoi traduire.
2. La lecture du glossaire et du guide de style de la langue.
3. La traduction des clés manquantes et périmées, avec leur contexte : le nom de la clé, le texte français, l'endroit où elle s'affiche (trouvé dans le code) et la place disponible. Si la grammaire d'une langue ne rentre pas dans le gabarit français (accord avec un nom placé en `{placeholder}`, cas de l'allemand), le skill **ajoute une variante de clé** pour toutes les langues plutôt que de forcer une tournure bancale, comme les clés `_you` l'ont fait.
4. **Une relecture indépendante** : un sous-agent qui n'a pas vu la traduction se faire retraduit vers le français les clés traduites, et signale chaque écart de sens, de registre ou de terme du glossaire. Le skill corrige, puis recommence jusqu'à ce qu'il n'y ait plus d'écart.
5. `pnpm i18n:stamp`, puis les tests, puis `pnpm i18n:shots` sur les écrans touchés, et un regard sur les captures.
6. Le chinois traditionnel part du simplifié converti par OpenCC, en variante Taïwan avec son vocabulaire (`opencc-js`, outil de développement, jamais embarqué), puis l'agent relit la conversion : elle se trompe sur certains mots, et certaines tournures diffèrent.

Une règle nouvelle dans `CLAUDE.md` : **une pull request qui change un texte français lance `/translate` avant son commit** (retenue, ADR-0028). Les tests rendent l'oubli visible : une clé périmée fait échouer `pnpm check`.

### 3.4 La relecture par des natifs

L'agent traduit bien ces langues, mais le ton d'un jeu entre amis, l'humour des bots et le vocabulaire des joueurs d'un pays demandent un natif, et le propriétaire n'en a pas sous la main. La relecture indépendante du skill en tient lieu. Le guide de chaque langue garde la liste de ce qu'un natif aura relu, le jour où l'un d'eux se manifestera.

Un lien « Signaler une traduction » dans les Réglages, qui ouvre un e-mail prérempli vers l'adresse de contact, recueille les corrections sans compte (retenu, ADR-0028 : il n'y a pas de relecteur natif).

---

## 4. Les langues une à une

Les valeurs ci-dessous sont celles par défaut, à vérifier par un natif. Elles vont dans `docs/i18n/<code>.md`.

| langue | registre | guillemets, ponctuation | lettres V/D/R | à surveiller |
|---|---|---|---|---|
| espagnol | tú, neutre (ni vosotros ni vocabulaire trop local) | « » ou “ ”, ¡…! ¿…? | J Q K | « carta » et non « naipe » |
| italien | tu | « » | J Q K | les élisions (l'asso, un'altra) dans les gabarits |
| portugais (Brésil) | você | “ ” | J Q K | le brésilien, pas le portugais d'Europe (ADR-0028) |
| allemand | du | „ … “ | B D K | la longueur, les noms composés, les cas autour d'un `{placeholder}` |
| japonais | polie et courte (です/ます), phrases nominales sur les boutons | 「」, 。、！？ en pleine chasse | J Q K | pas d'espaces, `auto-phrase`, l'onomatopée du cri « Tamalou ! » |
| chinois simplifié | 你 | “ ”, ，。！？ en pleine chasse | J Q K | site sans licence ICP : joignable depuis la Chine mais lent, pas de promotion là-bas |
| chinois traditionnel | 你, vocabulaire de Taïwan | 「」, ，。！？ | J Q K | OpenCC + relecture (Taïwan et Hong Kong diffèrent un peu) |

---

## 5. Les tests

- Les dictionnaires : mêmes clés et mêmes placeholders dans les neuf langues, pour le jeu, l'accueil et les mentions. Aucune clé périmée par rapport à `lock.json`. Aucune clé identique au français hors liste d'exceptions.
- La typographie : le japonais et le chinois sans ponctuation ASCII `,.!?` dans les phrases, l'allemand avec ses guillemets.
- Les pages : chaque page déclare les neuf `hreflang`, et les déclarations sont réciproques. Le sitemap les reprend. Chaque langue a sa carte d'aperçu, son manifeste et son `lang` exact.
- `plural()`, `ordinal()`, `cardName()`, `rankShort()` : un cas par langue.
- La détection : `zh-TW` → traditionnel, `pt-PT` → portugais, `ko` → français, et un choix mémorisé passe avant la détection.
- **Une pseudo-langue de développement** (`?lang=xx-long`, jamais proposée aux joueurs) : chaque texte français, accentué et allongé de 40 % entre crochets. Elle trouve d'un coup d'œil tout texte qui ne passe pas par `t()`, et tout bouton qui déborde, avant même la première vraie traduction.

---

## 6. Le découpage en étapes

Une étape = une session = une pull request. Chacune se termine par quelque chose que le propriétaire essaie sur son téléphone.

| étape | contenu | fin de l'étape | ce que tu essaies |
|---|---|---|---|
| **L0 — Les fondations** | La liste des langues, le chargement à la demande, `Intl`, le sélecteur en liste, la détection, les adresses et `hreflang` généralisés, le schéma d'usage, la 404, les polices CJK par `:lang()`, la pseudo-langue, `lock.json` et les trois commandes `i18n:*`, les tests. On livre **avec le français et l'anglais seulement**. Les textes de l'accueil et des mentions sont séparés par langue. | `pnpm check` vert. La pseudo-langue ne montre aucun texte en dur. Les captures du jeu en pseudo-langue passent sans débordement. | Le sélecteur, et un téléphone réglé en anglais qui ouvre le jeu en anglais. |
| **L1 — Le skill et une première langue** | `/translate`, le glossaire, les guides de style, puis **l'espagnol en entier** : jeu, accueil, mentions, carte d'aperçu, manifeste, noms des bots. Le skill est corrigé sur ce que l'espagnol révèle. | L'espagnol est complet, relu par le sous-agent, ses captures sont propres. | Une partie en espagnol, l'accueil `/es/`. Si possible, un ami hispanophone. |
| **L2 — L'italien, le portugais, l'allemand** | Les trois d'un coup, avec le skill tel qu'il est. L'allemand sert de test de longueur, donc il y aura des retouches de mise en page. | Les mêmes critères, pour trois langues. | La table et les règles en allemand sur ton téléphone (les débordements). |
| **L3 — Le japonais et le chinois** | Les réglages typographiques CJK, le japonais, le chinois simplifié, puis le traditionnel par OpenCC et relecture. Les cartes d'aperçu sont dessinées avec Noto CJK. | Les mêmes critères. Des captures sur Chromium et, si possible, un vrai iPhone et un Android. | Une partie en japonais et en chinois : les caractères, les retours à la ligne, la lisibilité des petits textes. |
| **L4 — Après** (optionnel) | Une page « Règles du Tamalou » par langue pour le référencement (piste 9 de `IDEAS.md`), les captures d'installation par langue, et Weblate si des bénévoles se proposent. | — | — |

**Où on en est (2026-11-27)** : L0 est faite. Ce qu'elle a posé, et ce qu'une langue rendue prête demande encore (ses deux pages HTML, sa carte d'aperçu, ses exceptions « identique au français »), est dans `docs/memory/languages.md`. Écart au plan : `lock.json` couvre aussi les textes de l'accueil et des mentions, pas seulement le jeu.

Chaque étape ajoute ses lignes au `CHANGELOG.md`. Les nouvelles langues méritent une version MINOR, la prochaine en Q. Le propriétaire décide quand la publier, par exemple après L2, ou après L3 pour annoncer les neuf langues d'un coup.

---

## 7. Les réponses du propriétaire (2026-11-27)

Elles sont consignées dans l'ADR-0028, qui fait foi.

1. **Portugais** : celui du Brésil.
2. **Chinois** : les deux, simplifié et traditionnel.
3. **Détection** : oui, le jeu s'ouvre dans la langue du téléphone à la première visite.
4. **Synchronisation** : stricte. Toute modification d'un texte français met à jour les huit autres langues dans la même pull request.
5. **Natifs** : aucun relecteur natif. La relecture indépendante du skill (§ 3.3) en tient lieu, et le lien « Signaler une traduction » est retenu par défaut (le propriétaire peut le retirer).
