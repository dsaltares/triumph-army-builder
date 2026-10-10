# Glossary — English to Spanish

The rules vocabulary of *Triumph!* and *Fantasy Triumph*, fixed once so two hundred ad-hoc choices cannot be made across
a translation run and then be impossible to unpick. Every Spanish string in `messages/es.json` and
`data/translations/es/` is written against this table, and a term that is not here is not settled.

**The locale is es-ES.** Peninsular Spanish, which is where the wargaming vocabulary below comes
from. A later `es-419` is a retranslation, not a restructure — see ADR 0027.

## How to read it

- **Keep** means the English stays as-is, untranslated. Proper nouns and rules keywords that
  players say in English at the table are kept rather than invented.
- A term in this table is *the* translation. Do not vary it for rhythm.

## Core rules terms

| English | Spanish | Note |
|---|---|---|
| stand | peana | The single most common term in the app. Not *base*, which is the physical object. |
| battle line | línea de batalla | |
| half battle line | media línea de batalla | |
| close order | orden cerrado | |
| open order | orden abierto | |
| invasion rating | índice de invasión | |
| manoeuvre rating | índice de maniobra | en-GB *manoeuvre*, not *maneuver*. |
| topography | topografía | |
| home topography | topografía propia | |
| contingent | contingente | |
| main contingent | contingente principal | |
| optional contingent | contingente opcional | |
| allied contingent | contingente aliado | |
| ally troop option | opción de tropa aliada | |
| troop option | opción de tropa | |
| troop type | tipo de tropa | |
| battle card | carta de batalla | |
| general | general | |
| camp | campamento | |
| fortified camp | campamento fortificado | |
| standard wagon | carro estándar | |
| pack train and herds | recua y rebaños | |
| sub-faction | subfacción | |
| army list | lista de ejército | |
| points | puntos | |
| point cap | límite de puntos | |
| dismount | desmontar | |
| mounted | montada | |
| foot | a pie | |

## Games and Fantasy Triumph

The app builds lists for two games (`docs/DOMAIN.md` §10). The game names are kept: **Triumph!**
and **Fantasy Triumph** are titles, never *Triunfo* or *Triunfo fantástico*.

| English | Spanish | Note |
|---|---|---|
| game | juego | The ruleset a list is built under: Triumph! or Fantasy Triumph. Never *modo*: neither game is a mode of the other. |
| format | formato | A Fantasy Triumph list's points total, home topography and two ratings, chosen and paid for. |
| points total | total de puntos | Fantasy Triumph's, set by the player. Triumph! has a *point cap* (*límite de puntos*) instead. |
| unit | unidad | Named stands of one troop type carrying the same cards. A Triumph! list has troop options, never units. |
| class | clase | The rulebook's word for what the app calls a unit. Use *unit* in the app; *class* appears only where the rules are explained. |
| hero | héroe | A single named figure with its own cards. Never a stand and never the general. |
| hero entry | entrada de héroe | A collection entry holding hero figures, with no troop type. The other kind is a *stand entry* (*entrada de peanas*). |
| army card | carta de ejército | A card bought once for the whole army. |
| event card | carta de evento | A card bought for a unit as a count of copies. |
| stand card | carta de peana | A card bought for a unit and carried by every stand in it. |
| hero card | carta de héroe | A card bought for a hero. |
| Delayed Entry | Entrada retrasada | A card name, translated with the rest of the catalogue in `data/translations/es/games/fantasy/`; written here because the builder's marks name it. |
| dense topography | topografía densa | One of Fantasy Triumph's four home topographies beyond Triumph!'s seven. |
| victory value | valor de victoria | Units plus heroes, without the ratings and army cards. |
| split | dividir | Moving some of a unit's stands into a new unit. |

### Fantasy names of troop types

Fantasy Triumph calls two troop types by other names. They are display names over the same troop
types, so the acronyms (`ARC`, `ELE`) and everything keyed on them stay; a Fantasy Triumph page
shows the Fantasy name, and every other page the Triumph! one.

| Code | Triumph! | Fantasy Triumph | Spanish |
|---|---|---|---|
| ARC | Archers | Shooters | Tiradores |
| ELE | Elephants | Behemoths | Behemots |

## Troop types — translated, acronyms kept

All 26 troop type names are translated. Their **acronyms** (`displayCode`: `BLV`, `SPR`, `KNT`…)
are not — those are the short codes the app packs into share codes and prints in tight columns,
and they stay stable across locales.

| English | Spanish |
|---|---|
| Bow Levy | Leva de arco |
| Rabble | Chusma |
| Horde | Horda |
| Archers | Arqueros |
| Light Foot | Infantería ligera |
| Light Spear | Lanza ligera |
| Raiders | Saqueadores |
| Skirmishers | Hostigadores |
| Warband | Banda de guerra |
| Artillery | Artillería |
| Elite Foot | Infantería de élite |
| Heavy Foot | Infantería pesada |
| Pavisiers | Paveseros |
| Pikes | Picas |
| Spear | Lanza |
| War Wagons | Carros de guerra |
| Warriors | Guerreros |
| Bad Horse | Caballería mediocre |
| Battle Taxi | Carro de transporte |
| Chariots | Carros |
| Elite Cavalry | Caballería de élite |
| Horse Bow | Arqueros a caballo |
| Javelin Cavalry | Caballería de jabalina |
| Knights | Caballeros |
| Cataphracts | Catafractos |
| Elephants | Elefantes |

Their **descriptions** are prose and are translated too.

## Battle cards — translated, names and rules text

All 27 battle card names are translated, and so is their rules text. Validation findings, the PDF
sheet and the reference page all read a card's name from the bundle (`displayName`, `listName`).
The curated costs in `data/curation/battle-card-costs.json` carry the English name only so that
`yarn validate:snapshot` notices an upstream rename. Translate the card once, in
`data/translations/<locale>/battle-cards.json` — never type a card name twice.

## Army list names — translated

Army list names are translated. They are historical, so the rule is *use the established Spanish
historical form*, not a literal rendering:

- **Peoples and places** take their Spanish exonym where one exists: `Sumerian` → `sumerios`,
  `Carthaginian` → `cartagineses`, `Achaemenid` → `aqueménidas`, `Hittite` → `hititas`,
  `Mycenaean` → `micénicos`. Where Spanish has no established form, transliterate rather than
  invent.
- **Common nouns** carry their settled historical translation: `Early` → `temprano/a`, `Later` →
  `tardío/a`, `Revolt` → `revuelta`, `Empire` → `imperio`, `Kingdom` → `reino`, `Dynasty` →
  `dinastía`, `Alliance` → `alianza`, `Confederation` → `confederación`, `City-States` →
  `ciudades-estado`, `Era` → `era`, `War` → `guerra`.
- Spanish does not capitalise peoples or common nouns, so a name comes out in sentence case, with
  only the first word capitalised unless a proper place name follows — the sample pack's
  `Mammoth Clans` is `Clanes del mamut`, and its `Sylvan Courts` is `Cortes silvanas`.

## The legal pages stay in English

Privacy, terms and cookies are **not** translated. They carry legal weight, and a machine
translation of a policy is a different kind of risk from a machine translation of a unit name — a
mistranslated retention period or lawful basis is a false statement about what the app does. They
stay English until a human who can be accountable for the wording reviews a Spanish version.

Everything around them is translated: the nav and footer links to them read Spanish, and the pages
themselves do not.

## Eras

| English | Spanish |
|---|---|
| BC | a.C. |
| AD | d.C. |

## Voice

The app's English voice is sentence case, and Spanish keeps that: only the first word and proper
nouns are capitalised, including in headings and buttons. Spanish does not capitalise nationalities
(`sumerios`, not `Sumerios`) except where they are part of a kept army list name.

Address the player as **tú**, never *usted* — the English voice is direct and unceremonious, and
*usted* would make the app sound like a bank.

`·` separates facts on one line and `–` spans a range, as in English. A human-facing date is
`formatDate`, which is `20 de septiembre de 2026` under es-ES.
