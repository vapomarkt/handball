# ThrowOff – Design-Prinzipien & UX-Leitlinien

> **Design-Nordstern:** **„Klarheit in 3 Sekunden – Tiefe auf Abruf.“**
>
> ThrowOff wird nicht am ruhigen Büro-Schreibtisch benutzt, sondern **in der lauten Sporthalle**, **am Spielfeldrand**, **zwischen Tür und Angel auf dem Smartphone** oder **abends auf der Couch**. Jede Ansicht muss sofort verständlich sein – für neue Eltern und Jugendspieler genauso wie für erfahrene Trainer und Vereins-Admins.

Dieses Dokument ist die verbindliche UX- und Design-Referenz für **Web, PWA (`src/`) und Mobile (`apps/mobile/`)**. Jede neue Seite, Komponente oder Funktion muss sich an diesen Prinzipien und Budgets messen lassen.

---

## 1. Die 8 Kernprinzipien

### 1.1 One Screen, One Job (Ein Fokus pro Ansicht)
Jede Seite beantwortet genau **eine** zentrale Nutzerfrage.
- **Dashboard:** *„Was steht als Nächstes an und was braucht meine Reaktion?“*
- **Termine:** *„Wann spielen oder trainieren wir – und bin ich dabei?“*
- **Team:** *„Wer gehört zur Mannschaft?“*
- **Dienste:** *„Welche Aufgaben sind offen oder mir zugewiesen?“*

**Regel:** Keine Sammelbecken-Seiten für fachfremde Module. Wenn zwei Themen unterschiedliche Nutzerziele verfolgen (z. B. *Mannschaftskasse* vs. *Schwarzes Brett* oder *Heimspieltag-Dienste* vs. *Übungsbibliothek*), werden sie klar getrennt statt unter einem irreführenden Navigationspunkt versteckt.

---

### 1.2 Progressive Disclosure (Tiefe auf Abruf statt alles sofort)
Zeige auf der obersten Ebene nur Informationen und Aktionen, die **80 % der Nutzer in 80 % der Fälle** brauchen. Alles andere gehört eine Ebene tiefer (Detail-Sheet, Drawer, `···`-Menü oder Unterseite).
- **Listen & Karten sind zum Scannen da** – nicht zum Bearbeiten sämtlicher Detailfelder.
- **Seltene Admin-/Setup-Aktionen** (z. B. *nuLiga-Spielbericht-Import*, *Halle anlegen*, *Weitere Mannschaft erstellen*, *Harz-Regel umschalten*, *Liga-Sync konfigurieren*) gehören in sekundäre Menüs oder Team-Einstellungen, nicht permanent in den Hauptfluss.
- **Sensible oder ausführliche Daten** (z. B. Pass-Nr., Notfallkontakt, Verletzungshinweis, komplette RSVP-Aufschlüsselung) öffnen sich beim Klick auf die Karte im Detail-Dialog/Sheet – nicht dauerhaft ausgeklappt auf jeder einzelnen Listenkarte.

---

### 1.3 Rollen- & Aufgabenadaptivität
ThrowOff hat vier sehr unterschiedliche Zielgruppen mit eigenem Informationsbedarf:

| Rolle | Primäre Aufgaben (Alltag) | Was bewusst **nicht** im Vordergrund stehen darf |
| --- | --- | --- |
| **Spieler (`PLAYER`)** | Zu-/Absagen (RSVP), nächster Termin & Treffpunkt, eigene Dienste, Team-News | Admin-KPIs, Liga-Sync, Kader-Import, Trainingsplaner-Verwaltung |
| **Eltern (`PARENT`)** | Rückmeldung fürs Kind, Abfahrt/Halle/Fahrgemeinschaft, Trikotwäsche & Dienste | Taktik-Editor, Gegner-Scouting, Vereinsverwaltung, „Offene Profile“ |
| **Trainer / Staff (`COACH`)** | Rückmeldequote, Kaderpflege, Spieltag & Taktik, Trainingsplanung | Vereinsweite Saison-/Logo-Administration im Tagesgeschäft |
| **Vereins-Admin (`CLUB_ADMIN`)** | Vereinslogo, Mannschaften, Saisons, Rollen & Übergaben | Vermischung von Vereins-Setup mit täglichem Mannschaftsbetrieb |

**Regel:** Neue Nutzer – insbesondere Spieler und Eltern – erleben eine ruhige, reduzierte Oberfläche. Profi-Funktionen (Taktikboard, Scouting, Liga-Sync, Importe) bleiben für Staff leicht erreichbar, ohne Gelegenheitsnutzer zu erschlagen.

---

### 1.4 Strenge Aktions-Hierarchie (Maximal 1 Primäraktion)
Wenn alles hervorgehoben ist, ist nichts hervorgehoben. Jeder Screen hat eine eindeutige visuelle Rangfolge:

1. **Primäraktion (`variant="default"`, `bg-primary`):** Maximal **1×** pro sichtbarem Bereich für die wichtigste Hauptaktion (z. B. `+ Termin` oder `Zusagen`).
2. **Sekundäraktion (`variant="outline"` oder `secondary`):** Maximal **1×** direkt daneben, nur wenn sie im Alltag gleichwertig häufig genutzt wird.
3. **Tertiär- & Expertenaktionen (`ghost` / `DropdownMenu` `···`):** Alle weiteren Aktionen (Importieren, Teilen, Exportieren, Einstellungen) wandern in ein klares `···`-Menü oder einen Split-Button.
4. **Destruktive Aktionen (`destructive`):** Niemals direkt neben Primäraktionen oder ungeschützt auf Listenkarten. Immer ins Overflow-Menü oder den Detail-Dialog – und immer mit einem eigenen Bestätigungsdialog (oder Undo-Toast), **niemals** mit `window.confirm()`.

---

### 1.5 Schlanke Navigation ohne Doppelstrukturen
Nutzer sollen sofort wissen, wo sie sind und wie sie weiterkommen – ohne doppelte Wege oder verschachtelte Navigationsstapel.
- **Mobile Bottom-Tab-Bar:** Maximal **4 bis 5 Tabs** (Apple HIG / Material 3 Standard). Bei mehr Bereichen wird ein sauberer `Mehr`-Tab (mit Profil, Kasse, Verwaltung, Einstellungen) verwendet statt 6 gequetschter Spalten mit 10px-Labels.
- **Kein Navigations-Duplikat im Inhalt:** Wenn `Termine`, `Team` und der `Team-Switcher` bereits dauerhaft in Header/Sidebar/Tab-Bar stehen, werden sie auf dem Dashboard nicht zusätzlich als Button-Leiste oder komplette Teamliste wiederholt.
- **Maximal 2 Steuerungsebenen pro Seite:** Vermeide den Dreifach-Stapel aus *Seiten-Tabs + Filter-Buttons + Checkboxen/Toggles*. Filter werden bei mehr als 4 Optionen als horizontal scrollbare Chip-Leiste oder kompaktes Filter-Popover umgesetzt – niemals als mehrzeilige Button-Wand.

---

### 1.6 Visuelle Ruhe, Whitespace & Signal-to-Noise
Hochwertige Apps wirken ruhig, weil sie mit wenigen, klaren Signalen arbeiten:
- **Markenfarbe (`--primary` / `#d95d24`) ist Signal-Farbe, keine Deko:** Reserviert für den aktiven Fokus (Primary CTA, aktiver Nav-Zustand, dringender Handlungsbedarf). **Nicht** gleichzeitig für alle aktiven Tabs, Filter-Pills, Badges und Icons nutzen.
- **Tabs sind Navigation, keine Buttons:** Tabs innerhalb einer Seite nutzen einen ruhigen **Segmented Control** (dezenter `bg-muted`-Container mit aktiver weißer/Card-Fläche) oder eine **Underline-Tab-Bar** – keine grellen, umrandeten Button-Reihen.
- **Keine Badge-Flut:** Maximal **2–3 Badges pro Karte**. Redundante Informationen (z. B. Rolle „Spieler“ bei jedem Spieler im Kader, oder „Heimspiel“ + „Punktspiel“ + „Status“ + „Ergebnis“ + „Harz“ gleichzeitig) werden reduziert, priorisiert oder als ruhige Metazeile mit `·`-Trenner dargestellt.
- **Großzügiger Weißraum:** Lieber mehr Abstand zwischen Gruppen (`space-y-6` / `gap-4`) und weniger Rahmen in Rahmen (keine verschachtelten Karten in Karten mit grauen Innenboxen).

---

### 1.7 Mobile-First & Daumenzone (Hallen-Tauglichkeit)
Der Haupt-Anwendungsfall ist das Smartphone mit einer Hand:
- **Touch-Targets:** Interaktive Elemente mindestens **44×44 px** (ausreichend Abstand zwischen benachbarten Buttons, kein versehentliches Antippen).
- **Wichtigstes zuerst (Above the Fold):** Auf einem 390px-Smartphone muss der eigentliche Inhalt (z. B. der nächste Termin oder der erste Spieler) sofort sichtbar sein – ohne erst durch 3 Header-Zeilen, 2 Banner, 4 Tabs und 8 Filter-Buttons zu scrollen.
- **Klare Typografie-Hierarchie:** Maximal **3 Textebenen pro Karte**:
  1. Titel / Name (primär, fett)
  2. Kern-Metadaten in einer ruhigen Zeile (Zeit · Ort oder Position · Status)
  3. Optional ein prägnanter Zustand oder 1-Klick-Interaktion (z. B. RSVP)
- **Konsistenz zwischen Web & Expo Mobile:** Dieselbe Informationsarchitektur, dieselben Begriffe und dieselbe visuelle Priorisierung in `src/` und `apps/mobile/`.

---

### 1.8 Geführter Einstieg, ehrliche Zustände & knappe Sprache
Neue Nutzer sollen sich ab der ersten Sekunde sicher fühlen:
- **Knappe Microcopy:** Kurze, präzise Titel (`Kader` statt `Kader · männliche D-Jugend` mit Eyebrow `Verein · Saison` und 2-zeiliger Feature-Aufzählung). Das aktive Team steht bereits prominent im Header/Switcher.
- **Hilfreiche Empty States:** Ein leerer Zustand zeigt 1 ruhiges Icon, 1 klaren Satz zum Nutzen und **genau 1** Primäraktion (z. B. *„Kader importieren“* + dezenter Textlink *„oder manuell anlegen“*).
- **Ruhige Ladezustände:** Konsistente Skeleton-Platzhalter statt springender `"Lade…"`-Textzeilen.
- **Sofortiges Feedback:** Optimistische UI-Updates bei häufigen Aktionen (z. B. RSVP-Klick, Abstimmung) und dezente Toasts statt blockierender Banner oder Browser-Alerts.

---

## 2. Messbare UX-Budgets (Verbindliche Leitplanken)

Um schleichende Überladung („Feature Creep“) frühzeitig zu stoppen, gelten für jede Seite und Komponente folgende **Maximalwerte**:

| Bereich | Verbindliches Budget | Begründung |
| --- | --- | --- |
| **Primär-CTAs (`bg-primary`)** | **Max. 1** pro sichtbarem Viewport | Eindeutiger visueller Fokus; keine konkurrierenden Call-to-Actions |
| **Aktionen im Page-Header** | **Max. 2** (1× Primary + optional 1× Secondary oder `···`-Menü) | Kein Button-Stau auf kleinen Viewports |
| **Zeilen im Page-Header** | **Max. 2** (Titel + optional 1 knappe Kontextzeile) | Inhalt beginnt sofort *Above the Fold* |
| **Mobile Bottom-Tabs** | **Max. 5** (ideal: 4–5) | Daumentauglich, lesbare Labels, HIG-/Material-konform |
| **Inline-Tabs pro Seite** | **Max. 3–4** (als Segmented Control / Underline) | Bei mehr Ansichten: eigene Route oder Untermenü |
| **Sichtbare Filter-Buttons** | **Max. 4–5** in einer Zeile (sonst horizontal scrollbar oder Filter-Popover) | Keine mehrzeiligen Filter-Blöcke vor der Liste |
| **Badges pro Karte** | **Max. 2–3** (nur abweichende/handlungsrelevante Zustände) | Verhindert „Badge-Suppe“; Normalzustände brauchen kein Badge |
| **Sichtbare Aktionen pro Listenkarte** | **Max. 1–2** (häufigste Kernaktion + `···`-Menü; Karte selbst öffnet Details) | Saubere, scanbare Listen statt überladener Werkzeugleisten |
| **Textebenen pro Listenkarte** | **Max. 3** (Titel, Metazeile, Status/Kernaktion) | Erfassbarkeit in < 3 Sekunden |
| **Inline-Detailboxen in Listen** | **0** (Details gehören in Sheet/Dialog oder Aufklapp-Sektion) | Keine „Box-in-Box“-Optik |

> **Ausnahme-Regel:** Jede bewusste Überschreitung eines Budgets muss im PR / Commit kurz begründet werden (z. B. spezialisierter Taktikboard-Canvas für Trainer).

---

## 3. Komponenten- & Interaktions-Standards

### 3.1 Einheitliche Page-Header
- **Kompakt & konsistent:** `<h1>` mit kurzem Seitentitel (z. B. `Termine`, `Kader`, `Dienste`), optional 1 kurze Kontextzeile nur bei echtem Mehrwert.
- **Kein wiederholter Club-/Saison-Eyebrow** auf jeder Unterseite (steht bereits im App-Shell-Header/Switcher).
- **Keine Settings-Toggles im Header** (z. B. Harz-Einstellung gehört in Team-Einstellungen).

### 3.2 Tabs & Filter
- **Einheitliche `<Tabs>`-Komponente** statt unterschiedlich gestylter `<button>`- oder `<Button>`-Varianten pro Seite:
  - *Segmented Control* (`bg-muted p-1 rounded-xl`, aktiver Tab `bg-card text-foreground shadow-xs`) oder *Underline-Tabs* (`border-b-2 border-primary text-foreground`).
  - Tabs nutzen **nie** vollflächiges `bg-primary`, damit der eigentliche Primary CTA visuell klar führt.
- **Filter:** Wenn mehr als 4 Werte existieren (z. B. 7 Handball-Positionen), ein kompaktes `<Select>` / Filter-Popover mit Zähler-Badge (`Filter (1)`) oder eine einzeilige horizontal scrollbare Leiste (`overflow-x-auto no-scrollbar`) einsetzen.

### 3.3 Karten & Listen
- **Klickbare Karte = Detailansicht:** Die gesamte Karte öffnet Details (wie bereits mit `Card interactive` vorbereitet). Dadurch entfallen separate „Details“- oder „Bearbeiten“-Buttons auf der Karte.
- **Normalzustand = unsichtbar:** Zeige Badges nur für **Abweichungen oder Relevanz** (z. B. `Verletzt`, `Abwesend`, `Harzverbot`, `Abgesagt`, `Noch ohne Login` für Staff) – nicht für jeden Standardzustand (`Spieler`, `Fit`, `Aktiv`) auf jeder einzelnen Zeile.
- **Overflow-Menü (`···`):** Sekundäre und destruktive Karten-Aktionen (Einladungslink, Eltern-Link, Bearbeiten, Löschen) werden in einem konsistenten `DropdownMenu` gebündelt.

### 3.4 Dialoge, Sheets & Bestätigungen
- **Mobile-first Sheets/Dialoge:** Auf Smartphones fühlen sich Bottom-Sheets/Dialoge mit klarer Fußzeile (1× Abbrechen, 1× Speichern) natürlich an.
- **Keine `window.confirm()` / `window.alert()`:** Einheitliche Confirm-Dialoge mit klarem Verb (z. B. *„Termin löschen“* statt *„OK“*) und rotem `destructive`-Button.

---

## 4. Umgesetzte Zielarchitektur in ThrowOff

Die folgenden Leitplanken sind in der App-Architektur (Web, PWA & Mobile) verbindlich umgesetzt und müssen bei künftigen Erweiterungen erhalten bleiben:

| Bereich / Datei | Verbindliche UX-Architektur |
| --- | --- |
| **UI-Fundament**<br>`src/components/ui/` | Einheitliche Primitives: ruhige `<Tabs>` (`segmented`/`underline`, nie `bg-primary`), `<DropdownMenu>` (`···`), `<ConfirmDialog>` (0 `window.confirm()`), `<PageHeader>`, `<EmptyState>`, `<CardListSkeleton>` und einzeilige `<FilterChips>`. |
| **App-Shell & Navigation**<br>`src/components/layout/app-shell.tsx` | **Max. 5 Mobile-Tabs** (`Start`, `Termine`, `Team`, `Dienste`, `Mehr`-Sheet); 2-Elemente-Mobile-Header (Team-Switcher-Menü + Profil); *„Weitere Mannschaft anlegen“* im Team-Switcher-Menü statt als permanenter Sidebar-Button. |
| **Dashboard**<br>`src/app/(app)/dashboard/page.tsx` | Rollenadaptives Fokus-Dashboard ohne doppelte Nav-Buttons oder doppelte Teamliste; Hero *„Nächster Termin“* mit 1-Klick-RSVP (separates Punktspiel nur, falls abweichend); kompakte 3er-Kennzahlenleiste exklusiv für Staff. |
| **Team / Kader**<br>`src/app/(app)/team/page.tsx` | Max. 2 Header-Aktionen (`Spieler hinzufügen` + `···`-Menü für Einladungen, nuLiga-Import & Harz-Regel); Suche + Positions-Dropdown in 1 Zeile; scanbare Kaderzeilen (max. 2–3 Abweichungs-Badges, 0 Inline-Detailboxen); geschützte Profildaten im `MemberDetailDialog`. |
| **Termine**<br>`src/app/(app)/termine/page.tsx` | Ruhige Segmented-Tabs (`Statistik` & `Liga-Sync` exklusiv für Staff); einzeilige `FilterChips`; max. 2–3 Badges pro Event-Karte; Löschen über `···`-Menü + `ConfirmDialog`. |
| **Dienste**<br>`src/app/(app)/dienste/page.tsx` | Fachlich sauber fokussiert auf `Dienste` & `Arbeitsstunden-Konto`; max. 2–3 Badges pro Dienstkarte; ruhige sekundäre Übernehmen-Buttons statt konkurrierender Primär-CTAs. |
| **Taktik & Training**<br>`src/app/(app)/taktik/page.tsx` | Fachlich vereint: `Playbook` & `Matchplan`/`Scouting` für alle (read-only für Spieler/Eltern), `Trainingsplaner` & `Übungsbibliothek` exklusiv für Staff. |
| **Pinnwand & Kasse / Verwaltung / Profil**<br>`kasse`, `verwaltung`, `profil` | Einheitliche `<Tabs>` und `<PageHeader>`, max. 1 Primär-CTA pro aktivem Tab, strukturierte Sektionen statt langer Scroll-Wände, 0 `window.confirm()`. |
| **Mobile-Parität**<br>`apps/mobile/app/(tabs)/` | 5 konsistente Tabs (`Start`, `Termine`, `Team`, `Playbook`, `Dienste`), lokalisierte Kategorie-Labels, ausgeblendete Standardzustände (`Spieler`/`Fit`) und sekundäre Listen-Buttons. |

---

## 5. UX-Review-Checkliste (Vor jedem UI-Commit)

Prüfe bei jeder neuen oder überarbeiteten Ansicht diese 8 Fragen:

1. **3-Sekunden-Test:** Ist sofort klar, was der Hauptzweck dieser Seite ist und welche Aktion die wichtigste ist?
2. **Ein Primär-CTA:** Gibt es pro sichtbarem Bereich höchstens **einen** vollflächigen `bg-primary`-Button?
3. **Rollen-Check:** Sieht ein neuer Spieler oder ein Elternteil hier nichts, was ihn überfordert oder gar nicht betrifft?
4. **Progressive Disclosure:** Kann mindestens ein Element, Button oder Feld in ein `···`-Menü, ein Detail-Sheet oder die Einstellungen wandern?
5. **Badge-Diät:** Hat jede Karte höchstens 2–3 Badges – und zeigt sie nur echte Signale statt Standardzustände?
6. **Above the Fold (390 px):** Ist der erste echte Inhalt auf dem Smartphone sofort sichtbar, ohne an Tabs/Filtern/Bannern vorbeizuscrollen?
7. **Konsistenz:** Werden einheitliche UI-Primitives (Tabs, Dialoge, Menüs, Buttons) verwendet – ohne `window.confirm()` und ohne doppelte Navigation?
8. **Weniger ist mehr:** Welches Element können wir noch entfernen, ohne dass der Nutzer etwas vermisst?
