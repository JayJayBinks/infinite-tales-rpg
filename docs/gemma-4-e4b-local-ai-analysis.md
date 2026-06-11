# Analyse: Infinite Tales RPG mit lokaler KI und Gemma 4 E4B

Stand: 2026-06-11

## Kurzfazit

Gemma 4 E4B ist fuer dieses Spiel technisch sinnvoll einsetzbar, aber nicht als direkter Drop-in-Ersatz fuer Gemini ohne Prompt- und Context-Disziplin. Das Projekt ist schon erstaunlich nah dran: Es hat einen OpenAI-kompatiblen Provider, getrennte Agenten, JSON-Reparatur, Streaming-JSON und eine erste Memory-/Summary-Schicht.

Die groesste Schwachstelle fuer lokale Modelle ist nicht die Kreativitaet, sondern die Kombination aus langen Prompts, striktem JSON, vielen impliziten Regeln und wachsender Story-History. Gemma 4 E4B kann das wahrscheinlich gut genug fuer Solo-/Personal-Use, wenn die Prompts staerker in kleine, deterministische Tasks zerlegt werden und die Haupt-Story-Generierung weniger Kontext bekommt.

Empfohlene Erwartung:

- Fruehe und mittlere Spielsitzungen: gut bis sehr gut, wenn das lokale Setup schnell genug ist.
- Lange Kampagnen: gut nur mit konsequenter Zusammenfassung, relevanter Erinnerung und kleinerem Prompt-Budget.
- JSON-/Tool-Aufgaben: brauchbar, aber validieren und reparieren ist Pflicht.
- Gemini-Qualitaet bei riesigem Kontext: nicht erwarten.

## Was Gemma 4 E4B laut aktueller Modellinfo bedeutet

Gemma 4 E4B ist ein kleines Edge-Modell der Gemma-4-Familie. Laut Google hat Gemma 4 E4B ein 128K-Kontextfenster, Text-/Bild-/Audio-Unterstuetzung bei den kleinen Modellen, native System-Prompt-Unterstuetzung und Function-Calling-Faehigkeiten. Die Speicherangaben von Google fuer Inferenz liegen ungefaehr bei:

| Praezision | ungefaehrer Speicherbedarf |
| --- | ---: |
| BF16 | 17.9 GB |
| SFP8 | 8.9 GB |
| Q4_0 | 4.5 GB |
| Mobile | 2.5 GB |
| Mobile text-only | 2.2 GB |

Wichtig: Diese Zahlen sind nur fuer die Modellgewichte plus Overhead. Der KV-Cache fuer langen Kontext kommt dazu. Ein 128K-Kontextfenster heisst also nicht, dass man es lokal ohne starken Geschwindigkeits- und Speicherverlust voll ausnutzen sollte.

Praktisch fuer dieses Spiel:

- Fuer LM Studio/Ollama-artige Setups ist Q4 wahrscheinlich der Startpunkt.
- 8 GB VRAM koennen reichen, aber langer Kontext wird schnell zaeh.
- 16 GB VRAM sind deutlich angenehmer.
- CPU-only wird funktionieren koennen, aber Spielzuege werden je nach Kontext spuerbar langsam.

Quellen:

- Google AI Developers: https://ai.google.dev/gemma/docs/core
- Hugging Face Model Card: https://huggingface.co/google/gemma-4-E4B
- Ollama Gemma 4: https://ollama.com/library/gemma4

## Aktueller KI-Aufbau im Projekt

Das Projekt verwendet mehrere spezialisierte Agenten:

- `GameAgent`: Haupt-Story, Game-State, Inventar, Ressourcen, NPC-Praesenz.
- `ActionAgent`: Vorschlaege und Bewertung einzelner Aktionen.
- `CombatAgent`: NPC-/Kampfreaktionen und Stats-Updates.
- `SummaryAgent`: History-Zusammenfassung und relevante Rueckgriffe.
- `CharacterAgent`, `CharacterStatsAgent`, `CampaignAgent`, `EventAgent`, `ImagePromptAgent`.
- `JsonFixingInterceptorAgent`: Repariert kaputtes JSON mit einem weiteren LLM-Call.

Das ist fuer lokale KI gut, weil die Aufgaben bereits fachlich getrennt sind. Problematisch ist eher, dass einzelne Calls trotzdem sehr viel State und sehr viele Regeln gleichzeitig bekommen.

Bereits vorhanden und positiv:

- Provider `openai-compatible` existiert.
- Base URL, Model und API-Key werden in den AI-Settings gespeichert.
- Browser-seitige Requests zu lokalen OpenAI-kompatiblen Endpoints sind moeglich.
- Gemini-Modellnamen werden im OpenAI-kompatiblen Provider ignoriert, wenn ein lokales Modell konfiguriert ist.
- Streaming fuer Story-JSON ist implementiert.
- JSON wird bereinigt und bei Bedarf repariert.

Aktuelle lokale Default-Luecke:

- Der OpenAI-kompatible Provider faellt aktuell auf `google/gemma-3-4b` zurueck, wenn kein Modell konfiguriert ist. Fuer Gemma 4 E4B sollte der User explizit z. B. `gemma4:e4b` oder den Modellnamen des lokalen Servers setzen.

## Wie gut funktioniert das Spiel damit?

### Story-Generierung

Wahrscheinlich gut, wenn der Kontext klein bleibt. Die Story-Aufgabe ist kreativ, aber zugleich stark strukturiert: Das Modell muss HTML-Storytext, Plot-Status, XP-Begruendung, Stats-Updates, Inventar-Updates, NPC-Listen, Bildprompt und Memory-Signal in einem JSON liefern.

Das ist fuer ein E4B-Modell die schwerste Runtime-Aufgabe im Spiel. Einzelne Story-Calls koennen funktionieren, aber die Fehlerwahrscheinlichkeit steigt mit:

- langer `historyMessagesState`,
- grossem Inventar,
- vielen NPCs,
- vielen Spells/Abilities,
- Kampfsituationen,
- Custom-System-Prompts,
- zusaetzlicher `additionalStoryInputState`,
- mehrsprachiger Ausgabe.

Bewertung: brauchbar bis gut, wenn Story-Prompt reduziert wird. Riskant, wenn man den aktuellen grossen Hauptprompt weiter wachsen laesst.

### Action-Vorschlaege

Die Action-Agenten sind relativ gut geeignet fuer Gemma 4 E4B. Sie bekommen einen kleineren Ausschnitt des aktuellen States und geben kurze, strukturierte Objekte zurueck. Problematisch sind die vielen Felder pro Action: Difficulty, Skill, Attribute, Ressourcenkosten, Dice-Roll, Interruptibility, Encounter-Probability.

Bewertung: gut, wenn Temperature fuer lokale Modelle niedriger ist und die JSON-Struktur validiert wird.

### Kampf

Kampf ist mittel riskant. Der Combat-Agent muss fuer mehrere NPCs Aktionen erzeugen und gleichzeitig Stats-Updates mit Dice-Notation liefern. Lokale kleine Modelle koennen hier IDs, Zielnamen oder erlaubte Resource-Keys verwechseln.

Bewertung: funktioniert, aber braucht harte Nachvalidierung fuer `sourceId`, `targetId`, `hp`, `mp`, Dice-Notation und Anzahl der Aktionen.

### Memory und lange Kampagnen

Hier entscheidet sich, ob lokale KI gut wirkt. Der Code hat bereits:

- Zusammenfassung ab 24 Messages, mit den letzten 6 Messages im Detail.
- Related-History-Retrieval aus GameActions mit Medium-/High-Impact-Filter.
- Custom Memories mit hoher Prioritaet.

Das ist gut, aber fuer lokale Modelle sollte der Wechsel frueher und konsequenter passieren. Der Hauptprompt sollte nicht darauf warten, dass History "zu lang" wird. Besser ist ein festes Memory-Budget pro Call.

Bewertung: Architektur ist vorhanden, muss fuer lokal aggressiver genutzt werden.

## Hauptprobleme fuer Gemma 4 E4B

### 1. Der Hauptprompt ist zu breit

`GameAgent.generateStoryProgression` kombiniert aktuell:

- kompletten Story-State,
- Charakterbeschreibung,
- aktuelle Ressourcen,
- komplettes Inventar,
- Custom-Prompts,
- ggf. Combat-Regeln,
- Action-Text,
- Additional Story Input,
- Related History,
- komplette History-Messages,
- JSON-Format fuer den gesamten Game-State.

Gemma 4 E4B kann lange Kontexte verarbeiten, aber kleine lokale Modelle verlieren bei solchen Kombinationsprompts schneller Praezision. Das zeigt sich typischerweise als:

- valides JSON, aber falsche Felder,
- vergessene Nebenwirkungen,
- NPC-IDs leicht veraendert,
- unplausible Fortschritte,
- Wiederholung alter Plotpunkte,
- Story gut, State schlecht.

### 2. `jsonRule` fordert Analyse vor JSON

Der globale `jsonRule` fordert erst `<analysis></analysis>` und danach JSON. Der Parser entfernt diese Bloecke zwar, aber fuer lokale Modelle ist das unguenstig:

- Mehr Tokens pro Call.
- Hoehere Chance, dass Analyse doch Klammern oder JSON-Fragmente enthaelt.
- Hoehere Chance, dass Streaming-Parser erst spaeter brauchbares JSON sieht.
- Unnoetig, wenn das Modell ohnehin Reasoning/Thinking intern oder nicht sichtbar machen soll.

Empfehlung: Fuer lokale OpenAI-kompatible Provider einen anderen JSON-Rule-Modus verwenden:

```text
Return exactly one valid JSON value. No markdown. No XML tags. No analysis text.
```

Wenn Begruendung benoetigt wird, als explizites JSON-Feld wie `reasoning_short` oder `validation_notes`, aber nicht ausserhalb des JSON.

### 3. OpenAI-kompatibler Provider nutzt kein `response_format`

Der Pollinations-Provider setzt `response_format: { type: "json_object" }`, der OpenAI-kompatible Provider aktuell nicht. Viele lokale Server ignorieren das zwar, aber LM Studio, llama.cpp-kompatible Server oder Cloud-kompatible Endpoints koennen davon profitieren.

Empfehlung:

- Optional `response_format: { type: "json_object" }` senden.
- Falls Server das ablehnt, automatisch ohne `response_format` retryen.
- Spaeter: JSON Schema / Grammar-Modus unterstuetzen, wenn Runtime das kann.

### 4. Temperaturen sind fuer lokale JSON-Tasks teilweise zu hoch

Mehrere Initial-/Generierungsflows verwenden `temperature: 2`, z. B. Campaign/Quickstart/Character-Erstellung. Fuer Gemini kann das okay sein, fuer ein kleines lokales Modell ist das fuer JSON und konsistente Felder riskant.

Empfehlung fuer Gemma 4 E4B:

| Task | Temperatur |
| --- | ---: |
| JSON-State, Combat, Action-Evaluation | 0.1 - 0.4 |
| Action-Vorschlaege | 0.4 - 0.8 |
| Story-Prosa im JSON | 0.6 - 0.9 |
| Kampagnen-/World-Generation | 0.8 - 1.1 |
| JSON-Fixing | 0 |

Wenn Kreativitaet gebraucht wird, lieber mehr kleine kreative Kandidaten generieren und danach validieren, statt einen grossen chaotischen JSON-Call mit hoher Temperatur zu fahren.

### 5. History ist Message-basiert, nicht budget-basiert

`SummaryAgent.summarizeStoryIfTooLong` startet ab 24 Messages und behaelt 6 Messages. Das ist simpel und gut, aber nicht gleichbedeutend mit Tokenkontrolle. Eine einzelne Message kann sehr gross werden.

Empfehlung:

- Context-Budget pro Agent definieren, z. B. Zeichen- oder Tokennaeherung.
- Maximal X Zeichen fuer `historyMessages`, X fuer `relatedHistory`, X fuer Inventory/NPC-State.
- Bei Ueberschreitung automatisch komprimieren.
- Debug-Anzeige fuer geschaetzte Promptgroesse je Call.

### 6. State und Narration werden im selben Call erzeugt

Die Story-Generierung soll gleichzeitig schoene Prosa und korrekten State liefern. Das ist bequem, aber fuer kleine lokale Modelle nicht optimal.

Besser:

1. `NarrationAgent`: Erzeugt nur Storytext aus Action + kleinem Kontext.
2. `StateDeltaAgent`: Extrahiert daraus nur strukturierte Deltas.
3. Programmlogik validiert und merged Deltas.
4. Optional `ConsistencyAgent`: Prueft nur Fehler, nicht neue Story.

Das waere einer der groessten Qualitaetsgewinne fuer lokale Modelle.

## Konkrete Umbau-Empfehlungen

### Prioritaet 1: Lokalen JSON-Modus einfuehren

Ziel: Weniger Parserfehler und weniger verschwendete Tokens.

Umsetzung:

- `jsonRule` nicht global aendern, sondern provider-/request-abhaengig machen.
- Fuer `openai-compatible` standardmaessig keine `<analysis>`-Tags verlangen.
- `response_format` optional im OpenAI-kompatiblen Provider setzen.
- Retry-Reihenfolge:
  1. normaler JSON-Call,
  2. parse/sanitize,
  3. fixer mit Temperatur 0,
  4. optional zweiter Original-Call mit niedrigerer Temperatur und knapperer Fehlermeldung.

### Prioritaet 2: Haupt-Story-Call in zwei Calls aufteilen

Aktuell erzeugt ein Call Story und kompletten Game-State. Besser:

1. Story-Call:
   - Input: Action, aktueller Ort/Situation, relevante Memory, aktueller Kampfstatus.
   - Output: `{ "story": "...", "scene_tags": [...], "important_changes": [...] }`

2. State-Call:
   - Input: vorheriger State + neue Story + Action-Ergebnis.
   - Output: nur `stats_update`, `inventory_update`, `currently_present_npcs`, `combat`, `memory_importance`.

Vorteile:

- Story darf kreativ sein.
- State-Call kann kalt und deterministisch laufen.
- Fehler sind leichter zu reparieren.
- Streaming bleibt fuer den Story-Call erhalten.

Nachteil:

- Ein Turn braucht einen zusaetzlichen LLM-Call.
- Lokal kann das trotzdem schneller wirken, weil jeder Call kleiner und stabiler ist.

### Prioritaet 3: Canonical State kompakter machen

Der Prompt sendet oft komplette Objekte. Fuer lokale Modelle besser:

- Inventory nicht komplett senden, sondern:
  - aktive/passive relevante Items,
  - Items mit Triggern,
  - Items, die im aktuellen Action-Text genannt werden,
  - plus kurze Item-IDs.
- CharacterDescription in eine kompakte Runtime-Form bringen:
  - Name,
  - Rolle/Klasse,
  - Motive,
  - relevante Traits,
  - keine lange Prosa.
- NPC-State trennen:
  - anwesende NPCs immer,
  - entfernte NPCs nur bei Relevanz.
- Campaign-State nur als aktueller Chapter + aktueller/naechster Plotpunkt, nicht komplette Kampagne.

### Prioritaet 4: Memory als feste Schichten modellieren

Empfohlenes Prompt-Budget pro Story-Call:

1. System-Regeln: kurz und stabil.
2. Current Scene: letzter GameActionState, aber reduziert.
3. Player Action: unveraendert.
4. Canonical Facts: kompakt, z. B. NPCs, Questflags, Ressourcen.
5. Retrieved Memory: maximal 2-4 Eintraege.
6. Recent Turns: maximal 2-3 Turns.

Nicht mehr automatisch die komplette alte `historyMessagesState` an grosse Agenten geben.

### Prioritaet 5: Validierung nach dem Modell staerken

Viele Dinge sollten nicht nur gepromptet, sondern hart validiert werden:

- `currently_present_npcs` duerfen nur bekannte IDs enthalten oder muessen explizit neu angelegt werden.
- NPC-Stats duerfen nur `hp`/`mp` verwenden.
- Player-Ressourcen muessen bekannte Resource-Keys sein.
- Dice-Notation muss parsebar sein.
- Inventory remove darf nur existierende IDs entfernen.
- `ActionDifficulty` muss Enum sein.
- `resource_cost.resource_key` muss existieren oder `null` sein.

Wenn Validation fehlschlaegt, nicht den ganzen Story-Call wiederholen. Nur einen kleinen Repair-Call fuer das fehlerhafte Delta ausfuehren.

### Prioritaet 6: Lokale Model-Presets

In den Settings waere ein Preset sinnvoll:

- Provider: OpenAI-compatible
- Base URL Ollama: `http://localhost:11434`
- Base URL LM Studio: `http://localhost:1234`
- Model Ollama: `gemma4:e4b`
- Temperatur lokal:
  - Story: 0.7
  - JSON-State: 0.2
  - Repair: 0
- JSON Mode: an, wenn Endpoint unterstuetzt.

Zusaetzlich sollte die UI klar anzeigen:

- "Local model configured"
- "JSON mode enabled/unsupported"
- "Streaming enabled"
- letzter Request: geschaetzte Promptgroesse, Dauer, Parser-Reparatur ja/nein.

## Kleine Prompt-Optimierungen mit grosser Wirkung

### Wiederholte Regeln deduplizieren

Viele Regeln werden in mehreren Agenten wiederholt, z. B. "NPCs and CHARACTER cannot simply be finished off with a single attack", Inventory-Pruefung und Combat-Regeln. Fuer lokale Modelle besser:

- Gemeinsame kurze Regel-IDs definieren.
- Nur fuer den Agent relevante Regeln senden.
- Lange Designphilosophie nicht in jeden Call packen.

### Schemas kuerzer und maschinenlesbarer machen

Aktuelle Schemas enthalten viele natuerliche Erklaerungen und Kommentare. Fuer lokale Modelle besser:

- JSON Schema oder TypeScript-nahe Form verwenden.
- Kommentare aus Runtime-Prompts entfernen.
- Erlaubte Enums separat kurz listen.
- Beispiele nur fuer schwierige Felder, nicht fuer alles.

### Kein "always review all context"

Satzarten wie "Always review context from system instructions and my last message" sind redundant. Das Modell kann dadurch nicht besser lesen, es verbraucht nur Kontext. Besser: Kontext hart reduzieren und klar labeln.

### Englisch fuer interne Felder beibehalten

Das Projekt erzwingt bereits englische JSON-Keys und englische Enums. Das ist richtig. Fuer lokale Modelle noch klarer:

- User-facing story in Zielsprache.
- Interne Felder, IDs, Enums immer Englisch.
- Keine Uebersetzung von IDs, Resource-Keys, Skill-Namen, NPC-Technical-IDs.

## Empfohlene Zielarchitektur fuer lokale KI

```text
Player Action
  -> ActionValidator / Difficulty Agent
  -> Optional GroundTruth Agent
  -> Narration Agent streamed
  -> StateDelta Agent
  -> Programmatic Validator
  -> Small Repair Agent only if needed
  -> Memory Writer
  -> Action Suggestion Agent
```

Der wichtigste Wechsel ist: Das Modell soll nicht mehr alles gleichzeitig machen. Es soll kleine, pruefbare Entscheidungen treffen.

## Bewertung nach Komponenten

| Bereich | aktueller Stand | Gemma 4 E4B Risiko | Empfehlung |
| --- | --- | --- | --- |
| Provider | OpenAI-kompatibel vorhanden | niedrig | Presets + JSON mode |
| Story Streaming | vorhanden | mittel | Story und State trennen |
| JSON Parsing | robustes Sanitizing + Fixer | mittel | keine Analyse vor JSON |
| Action Agent | gut getrennt | mittel | kuerzere Schemas, niedrigere Temperatur |
| Combat Agent | getrennt | hoch | harte ID-/Dice-Validierung |
| Memory | vorhanden | mittel | budgetbasiert und frueher nutzen |
| Campaign | grosse Prompts, hohe Temperatur | hoch | Kapitel einzeln generieren, temp senken |
| Image Prompt | separater Agent | niedrig/mittel | nur bei Bedarf lokal, sonst optional deaktivieren |

## Messplan fuer echte Aussagekraft

Um wirklich zu wissen, ob Gemma 4 E4B gut genug ist, sollte man ein kleines Benchmark-Script oder einen Debug-Modus bauen.

Metriken pro Agent:

- Prompt-Laenge in Zeichen und geschaetzten Tokens.
- Antwortdauer.
- Tokens pro Sekunde, falls Endpoint das liefert.
- JSON beim ersten Versuch valide: ja/nein.
- JSON nach Sanitizing valide: ja/nein.
- Fixer benoetigt: ja/nein.
- Schema-Validation bestanden: ja/nein.
- Anzahl korrigierter Felder.

Testfaelle:

1. Neue Tale generieren.
2. Erste Story starten.
3. Normale Aktion ausfuehren.
4. Aktion mit Dice-Roll und Inventar-Effekt.
5. Kampf mit 3 NPCs.
6. Lange History mit 30+ Turns.
7. Custom Memory, die altem Verlauf widerspricht.
8. Level-up.
9. Kampagnenkapitel-Wechsel.
10. GM-Frage beantworten.

Akzeptanzkriterien fuer "funktioniert gut":

- Mindestens 90-95 Prozent JSON first-pass oder nach Sanitizing.
- Keine haeufigen falschen NPC-/Resource-IDs.
- Story-Call unter ca. 10-20 Sekunden auf Zielhardware.
- Action-Vorschlaege unter ca. 5-10 Sekunden.
- Lange Kampagnen bleiben konsistent, ohne komplette History zu senden.

## Umsetzungsvorschlag in Phasen

### Phase 1: Schnell und risikoarm

- Local preset fuer Gemma 4 E4B hinzufuegen.
- OpenAI-kompatiblen Provider optional mit `response_format` ausstatten.
- Lokalen JSON-Rule ohne `<analysis>` nutzen.
- Temperature fuer lokale JSON-Tasks senken.
- Prompt-/Response-Metriken loggen.

### Phase 2: Context kontrollieren

- Budgetierte Prompt-Builder pro Agent einfuehren.
- Compact Character/Inventory/NPC/Campaign Views bauen.
- `historyMessagesState` nicht pauschal an lokale Hauptagenten senden.
- Summary frueher und nicht nur message-count-basiert ausloesen.

### Phase 3: Story und State trennen

- Story-Streaming-Call nur fuer Narration.
- StateDelta-Agent danach.
- Validator + Repair nur fuer Delta.
- ImagePrompt optional aus Story-Delta ableiten, nicht nochmal grosse History senden.

### Phase 4: Lokale Qualitaet absichern

- Agent-Benchmark-Suite.
- Schema-Validation pro Agent.
- Automatischer Fallback: kleiner Repair, dann optional groesseres/cloud Modell.
- UI-Diagnose fuer lokale Inferenz.

## Konkrete Antwort auf die Frage

Ja, das Spiel kann mit Gemma 4 E4B lokal gut funktionieren, wenn es als lokales, strukturiertes Agentensystem behandelt wird. Der aktuelle Code ist bereits in der richtigen Richtung, aber die Haupt-Story-Generierung ist noch zu gross und zu gemischt fuer dauerhaft stabile lokale Qualitaet.

Die wichtigste Optimierung ist nicht "mehr Kontext", sondern weniger und besserer Kontext:

- Prompts kleiner machen.
- Aufgaben trennen.
- State statt Prosa schicken.
- Relevante Memory statt kompletter History nutzen.
- JSON strikt und ohne Analyse-Text ausgeben lassen.
- Modelloutputs hart validieren.

Mit diesen Umbauten ist Gemma 4 E4B wahrscheinlich eine gute lokale Option fuer Infinite Tales RPG. Ohne diese Umbauten wird es anfangs funktionieren, aber bei laengeren Kampagnen, Kampfsituationen und komplexen Inventar-/NPC-Zustaenden zunehmend fragil.
