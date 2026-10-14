# Energie-Tools

Sammlung kleiner, statischer Web-Rechner rund um Energiewirtschaft. Reines HTML/CSS/Vanilla-JS,
kein Build-Schritt, kein Backend. Deployment per GitHub Actions auf GitHub Pages
(`.github/workflows/deploy-pages.yml`, deployt das Repo-Root bei Push auf `main`).

## Struktur

- `index.html` – Übersichtsseite mit Tool-Kacheln (`.tool-grid` / `.tool-card`)
- `tools/<tool>.html` – je Tool eine Seite (Header, Breadcrumb, `.panel` mit Formular, Ergebnisbereich)
- `assets/js/<tool>.js` – Berechnungslogik + DOM-Anbindung des Tools
- `assets/js/<tool>-*.js` – Stammdaten/Koeffizienten als globale Konstanten (z. B. `slp-profile.js`)
- `assets/css/style.css` – gemeinsames Stylesheet für alle Seiten

## Konventionen

- UI-Texte, Kommentare und Variablenbeschreibungen auf Deutsch; Bezeichner im Code englisch.
- Keine Frameworks, keine externen Abhängigkeiten, keine Bundler. Skripte per `<script src>` einbinden.
- Formeln im JS-Kommentar mit Quelle (Leitfaden/Festlegung, Anlage, Stand) dokumentieren.
- Reine Rechenfunktionen von DOM-Code trennen, damit sie isoliert prüfbar sind.
- Neue Tools: Seite unter `tools/`, Kachel in `index.html` ergänzen (Platzhalter-Kachel bleibt am Ende).

## Bestehende Tools

### SLP-Rechner (`tools/slp-rechner.html`)
h-Wert der BDEW-SigLinDe-Funktion für Gas-Standardlastprofile:
`h(θ) = A / (1 + (B / (θ − θ0))^C) + D + max(mH·θ + bH, mW·θ + bW)`, θ0 = 40 °C.
Koeffizienten aus BDEW-Leitfaden SLP Gas, Anlage 6, in `assets/js/slp-profile.js`.

### Redispatch 2.0 Ausfallarbeitsberechnung (`tools/redispatch-ausfallarbeit.html`)
Ausfallarbeit einer TR je Viertelstunde nach BNetzA-Festlegung **BK6-23-241 „BilAReM“, Anlage Kapitel 3**
(ersetzt BK6-20-059/-060/-061). Das PDF der Festlegung ist bewusst nicht eingecheckt;
bei Änderungen an den Formeln den Originaltext der BNetzA heranziehen.

- `assets/js/redispatch-ausfallarbeit-methoden.js` – reiner Rechenkern ohne DOM (per `module.exports`
  auch in Node testbar). Jede Funktion liefert Wert + Rechenschritte als HTML-Text.
- `assets/js/redispatch-ausfallarbeit.js` – UI: geführte Auswahl, dynamische Eingaben, Ergebnis, Rechenweg, CSV-Export.

Benutzerführung (folgt dem Aufbau des Dokuments):
1. Fall (Aufforderungs-/Duldungsfall), Richtung (negativ/positiv) und Ermittlung der Leistungslimitierung
   (Messung / Referenzprofilverfahren / beidseitige Fixierung) → P_lim nach Kap. 3.1
2. Energieträger: nicht-fluktuierend (3.3), Wind an Land (3.2.2), Wind auf See (3.2.3), Solar (3.2.4).
   Fluktuierende Erzeugung nur bei negativem Redispatch.
3. Abrechnungsvariante: Spitz / vereinfachte Spitz („Spitz light“) / Pauschal; Wind auf See zusätzlich Wind-Bin.
4. Eingaben je Variante, 5. Ergebnis mit Rechenweg je Viertelstunde.

Fachliche Festlegungen im Code:
- W_A,i in kWh = Leistungsdifferenz in kW · ¼ h; negativ: max{0; …}, positiv: min{0; …}.
- Vereinfachte Spitzabrechnung rechnet wie Spitz, nur andere Datenquelle der Wetterdaten.
- Windkennlinie: v auf 0,1 m/s runden, linear interpolieren, außerhalb der Kennlinie 0 kW.
  KF = Mittel P_VZ,ist / Mittel P_VZ,theo über 4 Vergleichs-¼ h; KF · P_theo auf Nennleistung begrenzt.
- Solar Pauschal: Anlagenfaktor-Tabelle nach Uhrzeit UTC+1 (Sommer 01.03.–31.10.).
- Leeres P_bean,i = keine Nichtbeanspruchbarkeit (= P_inst); leeres P_mbA,i entfällt im Minimum.
- Nicht umgesetzt: Kap. 3.4 (Überbauung, Kürzung über mehrere TR einer Netzlokation), Ermittlung der
  KFL_Bin aus SCADA-Daten (wird als Eingabe je ¼ h erwartet).
