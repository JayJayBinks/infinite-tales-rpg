# Infinite Tales RPG - Feature-Übersicht

## 🎮 Hauptfeatures

### 1. **KI-gesteuerte Storytelling-Engine**
- **Dynamische Story-Generierung**: Die gesamte Geschichte wird in Echtzeit von Google Gemini AI generiert
- **Adaptive Erzählweise**: Die Story passt sich den Entscheidungen und Aktionen des Spielers an
- **Multiple Story-Systeme**:
  - **Tale-Modus**: Einzelne, in sich geschlossene Abenteuer
  - **Campaign-Modus**: Strukturierte Kampagnen mit mehreren Kapiteln und Plot-Points
- **Story-Agenten**: Spezialisierte AI-Agenten für verschiedene Aspekte:
  - Story Agent: Hauptgeschichte und Weltenbau
  - Event Agent: Zufällige Ereignisse und Wendungen
  - Summary Agent: Zusammenfassung relevanter Story-Details

### 2. **Charaktersystem**

#### Charaktererstellung
- **Umfassende Charakterbeschreibung**:
  - Name, Klasse, Rasse, Geschlecht
  - Aussehen, Alignment, Persönlichkeit
  - Hintergrundgeschichte und Motivation
- **KI-generierte Charaktere**: Automatische Generierung passend zum gewählten Spielsystem
- **Manuelle Anpassung**: Vollständige Kontrolle über alle Charaktereigenschaften

#### Charakterstatistiken
- **Levelsystem**: Progression von Level 1 aufwärts
- **Attribute**: Dynamisches System mit Werten von -10 bis +10
- **Skills**: Spezialisierte Fähigkeiten mit Progression
- **Ressourcen**: HP, MP und benutzerdefinierte Ressourcen
- **Zauber und Fähigkeiten**: Aktiv nutzbare Skills mit Ressourcenkosten

#### Charakterprogression
- **XP-System**: 
  - SMALL, MEDIUM, HIGH XP-Belohnungen
  - XP-Bedarf steigt mit Level (Base: 100 XP für Level 2)
- **Level-Up mit KI-Unterstützung**:
  - AI schlägt sinnvolle Attributs-Steigerungen vor
  - Neue Fähigkeiten oder Verbesserung bestehender Abilities
  - Ressourcen-Maximum erhöhen
  - Basiert auf Story-Progression und Spielweise
- **Skill-Progression**:
  - Skills verbessern sich durch erfolgreiche Anwendung
  - Fortschrittsbalken für jeden Skill
  - Automatischer Skill-Aufstieg bei Erreichen der Schwelle

#### Party-Management
- **Multi-Character-System**: Verwaltung mehrerer Charaktere
- **NPC-Integration**: NPCs können der Party beitreten
- **Character-Switching**: Wechsel zwischen aktiven Party-Mitgliedern
- **Character-Transformation**: Charaktere können sich verwandeln/verändern

### 3. **Kampfsystem**

#### Combat-Mechanik
- **Rundenbasierter Kampf**
- **NPC-Actions**: KI steuert NPC-Aktionen und Reaktionen
- **Tactical Combat**: 
  - Ziel-Auswahl (Single/Multi-Target)
  - Positionierung und Strategie
- **Initiative-System**: Aktionsreihenfolge
- **Combat Agent**: Spezialisierter AI-Agent für Kampfsituationen

#### Kampf-Features
- **Damage-System**: Würfelbasierte Schadensberechnung
- **Status-Effekte**: Vergiftung, Blutung, Betäubung, etc.
- **Multi-Target-Angriffe**: Mehrere Ziele gleichzeitig
- **Ressourcen-Management im Kampf**: HP, MP, Ausdauer etc.

### 4. **Würfelsystem (Dice Rolling)**

#### 3D-Würfel-Visualisierung
- **3D-Würfel-Animation**: Physikalische Würfel-Simulation
- **Dice-Box Integration**: Realistische Würfelanimationen

#### Würfel-Mechaniken
- **Dice Notation**: Standard-Format (1d20, 3d6+2, etc.)
- **Attribute + Skill Modifiers**: Automatische Berechnung
- **Situational Modifiers**: Bonus/Malus basierend auf Story-Kontext
- **Schwierigkeitsgrade**:
  - Simple
  - Medium
  - Difficult
  - Very Difficult
- **Erfolgs-Levels**:
  - Critical Failure (Würfel = 1)
  - Major Failure
  - Regular Failure
  - Partial Failure
  - Regular Success
  - Major Success
  - Critical Success (Würfel = 20)
- **Karmic Dice**: Optionales System für ausgewogenere Ergebnisse
- **Manual Dice Rolls**: Spieler können eigene Würfe eingeben

### 5. **Action-System**

#### Action-Typen
- **Misc**: Allgemeine Aktionen
- **Attack**: Kampfaktionen
- **Spell**: Zauber wirken
- **Conversation**: Dialoge und Verhandlungen
- **Social Manipulation**: Überzeugung, Täuschung
- **Investigation**: Untersuchen und Erkunden
- **Travel**: Reisen und Fortbewegung
- **Crafting**: Gegenstände herstellen

#### Action-Processing
- **Plausibilitätsprüfung**: AI validiert Aktionen
- **Impossible Actions**: System für unmögliche Aktionen
- **Suggested Actions**: AI schlägt passende Aktionen vor
- **Custom Actions**: Freie Eingabe eigener Aktionen
- **Resource Cost**: Aktionen können Ressourcen kosten
- **Action Difficulty**: Dynamische Schwierigkeitsberechnung
- **Interruption System**: Aktionen können unterbrochen werden

### 6. **Inventarsystem**

#### Item-Management
- **Dynamic Inventory**: Gegenstände werden zur Laufzeit hinzugefügt/entfernt
- **Item Properties**:
  - Name und Beschreibung
  - Effekte (passiv/aktiv)
  - Ressourcenkosten für Nutzung
- **Item Usage**: Aktive Nutzung von Items im Spiel
- **AI-Generated Items**: Story-relevante Items werden von AI erstellt
- **Item Consumption**: Verbrauchbare Items
- **Item Images**: AI-generierte Bilder für Items

#### Crafting
- **Combining Items**: Mehrere Items kombinieren
- **Success/Failure States**:
  - Success: Neues Item, alte Items entfernt
  - Partial Failure: Kein neues Item, alte Items behalten
  - Failure: Kein neues Item, alte Items verloren

### 7. **Kampagnensystem**

#### Campaign-Struktur
- **Multi-Chapter-Campaigns**: Mehrere Kapitel
- **Plot Points**: Strukturierte Handlungspunkte pro Kapitel
- **Campaign Objectives**: Ziele für jedes Kapitel und Plot Point
- **Important NPCs**: Schlüssel-NPCs pro Plot Point
- **GM Notes**: Hinweise für spezielle Herausforderungen/Regeln
- **Chapter Progression**: Automatischer Kapitelfortschritt

#### Campaign-Features
- **World Details**: Detaillierte Weltenbeschreibung
- **Campaign Description**: Übergreifende Kampagnenbeschreibung
- **Location Tracking**: Orte und Schauplätze
- **Campaign Generation**: Vollständige AI-Generierung von Kampagnen

### 8. **KI-Bildgenerierung**

#### Image Generation
- **Story Images**: Begleitende Bilder für Story-Elemente
- **Character Images**: Charakterportraits
- **Item Images**: Bildliche Darstellung von Gegenständen
- **Scene Visualization**: Szenen und Locations
- **Pollinations.ai Integration**: Kostenlose AI-Bildgenerierung
- **Image Prompts**: Spezialisierte Prompts für konsistenten Stil

### 9. **NPC-System**

#### NPC-Management
- **Dynamic NPCs**: NPCs werden zur Laufzeit erstellt
- **NPC Stats**: HP, MP, Rang (Very Weak bis Legendary)
- **NPC Relationships**: Hostile, Friendly, Neutral
- **NPC Knowledge**: System für bekannte Namen/Aliase
- **Party Members**: NPCs können zur Party gehören
- **NPC Resources**: Eigene Ressourcen-Verwaltung

### 10. **Spieleinstellungen**

#### Schwierigkeitsgrad
- **Difficulty Settings**: Anpassbare Schwierigkeitsgrade
- **Karmic Dice**: Toggle für ausgewogenere Würfelergebnisse
- **Dynamic Combat**: Dynamische Kampf-Intensität

#### AI-Konfiguration
- **Custom System Instructions**: Eigene System-Anweisungen
- **Custom Agent Instructions**: Spezifische Anweisungen für verschiedene Agents
  - Action Agent
  - Combat Agent
  - Story Agent
- **Custom Memories**: Spieler-definierte Erinnerungen
- **Custom GM Notes**: Eigene Spielleiter-Notizen
- **Temperature Control**: AI-Kreativität anpassen
- **Fallback LLM**: Alternative AI-Modelle

#### Output-Einstellungen
- **AI Language**: Sprache der AI-Ausgaben
- **Narration Details**: Level of Detail (LOW, MEDIUM, HIGH)
- **Random Events Handling**: Zufallsereignisse (None, Low, Medium, High)

### 11. **Text-to-Speech (TTS)**

- **Story Narration**: Vorlesen der Story-Texte
- **Action Narration**: Vorlesen von Aktionen
- **MSEdge TTS Integration**: Microsoft Edge TTS-Engine
- **Multiple Voices**: Verschiedene Stimmen verfügbar

### 12. **Import/Export**

#### Save-Game-System
- **LocalStorage-basiert**: Automatisches Speichern im Browser
- **Export Save Game**: JSON-Export des kompletten Spielstands
- **Import Save Game**: Spielstand wiederherstellen
- **Version Migration**: Automatische Migrations für Updates

#### Settings-Export
- **Export Tale Settings**: Story-Einstellungen exportieren
- **Export Campaign Settings**: Kampagnen-Einstellungen exportieren
- **Import Settings**: Einstellungen importieren
- **PDF Import**: Generierung aus PDF-Dokumenten

### 13. **Erweiterte Features**

#### Truth Oracle System
- **Ground Truth Tracking**: Versteckte "Wahrheiten" der Spielwelt
- **Discoverable Clues**: Hinweise die entdeckt werden können
- **State Simulation**: Simulation von Zuständen

#### History & Summary System
- **Story History**: Zusammenfassung relevanter Story-Details
- **Action History**: Historie der Charakter-Aktionen
- **Related Details**: Kontextabhängige Details

#### Game Master Questions
- **GM Dialog**: Interaktive Fragen an den Spieler
- **Clarifications**: Klärung von Unklarheiten
- **Story Input**: Spieler-Input für Story-Entscheidungen

#### Quickstart
- **Quick Story Generation**: Schnellstart mit vorgenerierter Story
- **Random Generation**: Zufällige Story-Elemente
- **PDF-based Generation**: Story aus PDF-Dokumenten

### 14. **Debugging & Development**

#### Debug-Features
- **Debug State View**: Anzeige aller internen Zustände
- **NPC State Inspector**: NPC-Status einsehen
- **Action History View**: Aktionsverlauf anzeigen
- **Thoughts State**: AI-Gedankenprozesse einsehen
- **Console Logging**: Detailliertes Logging

#### Testing
- **Playwright Tests**: E2E-Tests für alle Hauptfeatures
- **Test Coverage**: 
  - Onboarding
  - Party Lifecycle
  - Campaign Building
  - Game Loop
  - Combat & Inventory
  - Dice Rolls

## 🎯 Technische Features

### Framework & Tech Stack
- **SvelteKit 2.x** mit Svelte 5
- **TypeScript 5.x**
- **Vite 5.x**
- **TailwindCSS** + **DaisyUI**
- **Mobile First**: Optimiert für mobile Geräte

### AI Integration
- **Google Gemini API**: Hauptmodell für Story & Game Logic
- **Streaming Support**: Echtzeit-Textgenerierung
- **JSON Streaming**: Strukturierte Datenausgabe
- **Fallback-Mechanismen**: Alternative Modelle bei Fehlern
- **Cost Tracking**: Überwachung der API-Kosten

### State Management
- **Custom LocalStorage Hook**: Reaktive LocalStorage-Integration
- **State Persistence**: Automatisches Speichern
- **State Migration**: Versioniertes State-Management
- **Error State**: Globales Error-Handling

### Performance
- **Code Splitting**: Optimiertes Laden
- **Lazy Loading**: Dynamisches Laden von Komponenten
- **Image Optimization**: Effiziente Bildverwaltung

## 🚀 Geplante Features (In Development)

### RPG-Mechaniken
- ✅ Character Stats (implementiert)
- ✅ Dice rolls (implementiert)
- ✅ Skills and Abilities (implementiert)
- ✅ Character Progression (implementiert)
- ✅ Combat System (implementiert)

### Zukünftige Erweiterungen
- Multiplayer-Unterstützung
- Erweiterte Crafting-Systeme
- Faction-System
- Quest-Tracking
- Achievement-System
- Character-Builds/Templates
- Erweiterte AI-Modelle

## 📊 Unterstützte Spielsysteme

Das Spiel unterstützt beliebige Pen & Paper Systeme, Beispiele:
- Pathfinder
- Call of Cthulhu
- Star Wars
- Fate Core
- Harry Potter
- Discworld
- World of Darkness
- GURPS
- Mutants & Masterminds
- Dungeons & Dragons
- Und viele mehr...

## 🎨 UI/UX Features

- **Responsive Design**: Funktioniert auf allen Geräten
- **Dark Mode**: DaisyUI Theme-Support
- **Loading Indicators**: Klare Feedback-Mechanismen
- **Modal Dialogs**: Intuitive Benutzerinteraktionen
- **Progress Bars**: Visuelle Fortschrittsanzeige
- **Accessibility**: Tabindex, ARIA-Labels

## 💾 Datenverwaltung

- **Browser-basiert**: Keine Server-Registrierung nötig
- **Privacy-First**: API-Key nur lokal gespeichert
- **Offline-Fähigkeit**: Grundlegende Funktionen offline nutzbar
- **Cross-Device**: Export/Import für Geräte-Wechsel

---

**Version**: 0.13.0  
**Status**: Beta  
**License**: GNU AGPLv3  
**Live-Demo**: https://infinite-tales-rpg.vercel.app/
