// Oberfläche des Ausfallarbeitsrechners: geführte Auswahl
// (Fall/Richtung → Energieträger → Abrechnungsvariante), danach dynamische Eingaben und Rechenweg.
// Die Berechnung selbst steckt in redispatch-ausfallarbeit-methoden.js.

const FAELLE = [
  { id: 'aufforderung', titel: 'Aufforderungsfall', text: 'Der Anlagenbetreiber setzt die Vorgabe des Netzbetreibers selbst um. P<sub>lim,i</sub> ergibt sich aus Ist-Leistung und Vorgabe (P<sub>max,i</sub> bzw. P<sub>min,i</sub>).' },
  { id: 'duldung', titel: 'Duldungsfall', text: 'Der Netzbetreiber steuert die Anlage selbst, der Anlagenbetreiber duldet den Eingriff. P<sub>lim,i</sub> entspricht der Ist-Leistung P<sub>ist,i</sub>.' },
];

const RICHTUNGEN = [
  { id: 'negativ', titel: 'Negativer Redispatch', text: 'Reduzierung der Erzeugung (Abregelung). Die Ausfallarbeit ist positiv.' },
  { id: 'positiv', titel: 'Positiver Redispatch', text: 'Erhöhung der Erzeugung. Die Ausfallarbeit ist negativ (Mehrarbeit).' },
];

const LIMITIERUNGEN = [
  { id: 'messung', titel: 'Ist-Leistung gemessen', text: 'Regelfall: Viertelstundenmessung vorhanden. P<sub>lim,i</sub> wird aus Fall, Richtung und gemessener Ist-Leistung bestimmt.' },
  { id: 'referenzprofil', titel: 'Referenzprofilverfahren', text: 'Keine viertelstundenscharfe Messung, Bilanzierung über ein Profil. P<sub>lim,i</sub> = vorgegebene Höchst- bzw. Mindesterzeugung.' },
  { id: 'fixierung', titel: 'Beidseitige Fixierung', text: 'Der Netzbetreiber gibt einen festen Leistungswert vor, von dem nicht abgewichen werden darf. P<sub>lim,i</sub> = dieser Vorgabewert.' },
];

const TRAEGER = [
  { id: 'nichtfluktuierend', titel: 'Nicht-fluktuierende Erzeugung', text: 'z. B. KWK-, Biomasse-, Wasserkraft- oder konventionelle Anlagen (Kap. 3.3).' },
  { id: 'wind-land', titel: 'Wind an Land', text: 'Windenergieanlagen an Land (Kap. 3.2.2).', nurNegativ: true },
  { id: 'wind-see', titel: 'Wind auf See', text: 'Windenergieanlagen auf See (Kap. 3.2.3).', nurNegativ: true },
  { id: 'solar', titel: 'Solar', text: 'Solaranlagen (Kap. 3.2.4).', nurNegativ: true },
];

const PAUSCHAL_FLUKTUIEREND = 'Nur für TR, die bereits nach BK6-20-059 der Pauschal-Abrechnung zugeordnet waren, längstens bis 31.12.2028, oder solange keine viertelstundenscharfe Messung vorhanden und vorgeschrieben ist.';

const VERFAHREN = {
  nichtfluktuierend: [
    { id: 'spitz', titel: 'Spitzabrechnung', kap: '3.3.1', text: 'Differenz zwischen geplanter Fahrweise laut Ex-ante-Planungsdaten und Leistungslimitierung. Pflicht im Planwertmodell.' },
    { id: 'pauschal', titel: 'Pauschal-Abrechnung', kap: '3.3.2', text: 'Fortschreibung der letzten vollständig gemessenen Viertelstunde vor der Maßnahme. Regelfall im Prognosemodell.' },
  ],
  'wind-land': [
    { id: 'spitz', titel: 'Spitzabrechnung', kap: '3.2.2.1', text: 'Gemessene Windgeschwindigkeit an Gondel/Nabe der TR, zertifizierte Leistungskennlinie und Korrekturfaktor aus dem Vergleichszeitraum.' },
    { id: 'vereinfacht', titel: 'Vereinfachte Spitzabrechnung (Spitz light)', kap: '3.2.2.2', text: 'Wie Spitzabrechnung, die Windgeschwindigkeit stammt aber von einem meteorologischen Dienstleister oder einer Referenzanlage. Gilt, wenn keine Variante festgelegt wurde.' },
    { id: 'pauschal', titel: 'Pauschal-Abrechnung', kap: '3.2.2.3', text: `Fortschreibung des letzten vollständig gemessenen Leistungsmittelwerts vor der Maßnahme. ${PAUSCHAL_FLUKTUIEREND}` },
  ],
  'wind-see': [
    { id: 'spitz', titel: 'Spitzabrechnung', kap: '3.2.3.1', text: 'Wie Wind an Land: gemessene Windgeschwindigkeit, Leistungskennlinie, Korrekturfaktor aus dem Vergleichszeitraum.' },
    { id: 'windbin', titel: 'Spitzabrechnung mit Wind-Bin-Verfahren', kap: '3.2.3.2', text: 'Korrekturfaktor je Windgeschwindigkeits-Bin: KF<sub>Bin</sub> = KFL<sub>Bin</sub> · KF<sub>V</sub>. Wahl bis 30.11. für das Folgejahr.' },
    { id: 'vereinfacht', titel: 'Vereinfachte Spitzabrechnung (Spitz light)', kap: '3.2.3.1', text: 'Windgeschwindigkeit mindestens je Cluster, z. B. von einer Referenz-TR oder einem FINO-Messmast.' },
  ],
  solar: [
    { id: 'spitz', titel: 'Spitzabrechnung', kap: '3.2.4.1', text: 'Einstrahlungsmessung an der Anlage, skaliert über einen Vergleichszeitraum (Kalendertag ohne Maßnahme).' },
    { id: 'vereinfacht', titel: 'Vereinfachte Spitzabrechnung (Spitz light)', kap: '3.2.4.2', text: 'Wie Spitzabrechnung mit Einstrahlwerten eines meteorologischen Dienstleisters (z. B. Heliosat-2), umgerechnet in die Modulebene.' },
    { id: 'pauschal', titel: 'Pauschal-Abrechnung', kap: '3.2.4.3', text: `Anlagenfaktor nach Jahres- und Uhrzeit × installierte Leistung. ${PAUSCHAL_FLUKTUIEREND}` },
  ],
};

const SERIEN_FELDER = {
  pIst: { sym: 'P<sub>ist,i</sub>', titel: 'Ist-Leistung', einheit: 'kW' },
  pMax: { sym: 'P<sub>max,i</sub>', titel: 'Höchsterzeugung lt. Abruf', einheit: 'kW' },
  pMin: { sym: 'P<sub>min,i</sub>', titel: 'Mindesterzeugung lt. Abruf', einheit: 'kW' },
  pPlan: { sym: 'P<sub>plan,i</sub>', titel: 'geplante Leistung (Ex-ante)', einheit: 'kW' },
  v: { sym: 'v<sub>i</sub>', titel: 'Windgeschwindigkeit', einheit: 'm/s' },
  kflBin: { sym: 'KFL<sub>Bin,i</sub>', titel: 'Leistungsfaktor des Bins', einheit: '–' },
  g: { sym: 'G<sub>i</sub>', titel: 'Einstrahlleistung', einheit: 'kW/m²' },
  pmbA: { sym: 'P<sub>mbA,i</sub>', titel: 'marktbedingte Anpassung (optional)', einheit: 'kW', optional: true },
  pBean: { sym: 'P<sub>bean,i</sub>', titel: 'beanspruchbare Leistung (optional)', einheit: 'kW', optional: true },
};

const PARAM_FELDER = {
  pInst: { sym: 'P<sub>inst</sub>', titel: 'Installierte Leistung / Nennleistung der TR', einheit: 'kW' },
  p0: { sym: 'P<sub>0</sub>', titel: 'Letzter vollständig gemessener Leistungsmittelwert vor der Maßnahme (uneingeschränkte Einspeisung)', einheit: 'kW' },
  pWR: { sym: 'P<sub>WR</sub>', titel: 'Wechselrichterleistung der TR', einheit: 'kW' },
  pVzIst: { sym: 'P<sub>VZ,ist</sub>', titel: 'Durchschnittliche Ist-Einspeisung im Vergleichszeitraum (nur ¼ h mit ≥ 10 % der Nennleistung)', einheit: 'kW' },
  gVz: { sym: 'G<sub>VZ</sub>', titel: 'Durchschnittliche Einstrahlleistung im Vergleichszeitraum', einheit: 'kW/m²' },
  kfv: { sym: 'KF<sub>V</sub>', titel: 'Verlustfaktor parkinterne Verluste (E<sub>Einsp</sub> / ΣE<sub>WEA</sub>, 12 Monate)', einheit: '–' },
};

const state = {
  fall: null,
  richtung: null,
  traeger: null,
  verfahren: null,
  limitierung: 'messung',
  beginn: '2026-04-14T11:00',
  anzahl: 4,
  params: {},
  serien: {},
  kennlinie: '',
  vz: [{}, {}, {}, {}],
};

const el = (id) => document.getElementById(id);

function zahl(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------------------------------------
// Ableitungen aus der Auswahl
// ---------------------------------------------------------------------------------------------

function cfg() {
  return { fall: state.fall, richtung: state.richtung, limitierung: state.limitierung, traeger: state.traeger, verfahren: state.verfahren };
}

function benoetigt() {
  const neg = state.richtung === 'negativ';
  const vorgabe = neg ? 'pMax' : 'pMin';
  let serien;
  if (state.limitierung !== 'messung') serien = [vorgabe];
  else if (state.fall === 'duldung') serien = ['pIst'];
  else serien = ['pIst', vorgabe];

  const b = { params: [], serien, kennlinie: false, vz: false };
  const t = state.traeger;
  const v = state.verfahren;
  if (t === 'nichtfluktuierend') {
    if (v === 'spitz') b.serien.push('pPlan');
    else { b.params.push('p0'); b.serien.push('pBean'); }
  } else if (t.startsWith('wind')) {
    if (v === 'pauschal') {
      b.params.push('p0', 'pInst');
      b.serien.push('pmbA', 'pBean');
    } else {
      b.params.push('pInst');
      if (v === 'windbin') b.params.push('kfv');
      b.kennlinie = true;
      b.vz = v !== 'windbin';
      b.serien.push('v');
      if (v === 'windbin') b.serien.push('kflBin');
      b.serien.push('pmbA', 'pBean');
    }
  } else if (t === 'solar') {
    b.params.push('pInst', 'pWR');
    if (v !== 'pauschal') { b.params.push('pVzIst', 'gVz'); b.serien.push('g'); }
    b.serien.push('pmbA', 'pBean');
  }
  return b;
}

function plimFormel() {
  const neg = state.richtung === 'negativ';
  if (state.limitierung !== 'messung') return neg ? 'P<sub>lim,i</sub> = P<sub>max,i</sub>' : 'P<sub>lim,i</sub> = P<sub>min,i</sub>';
  if (state.fall === 'duldung') return 'P<sub>lim,i</sub> = P<sub>ist,i</sub>';
  return neg ? 'P<sub>lim,i</sub> = max{P<sub>ist,i</sub>; P<sub>max,i</sub>}' : 'P<sub>lim,i</sub> = min{P<sub>ist,i</sub>; P<sub>min,i</sub>}';
}

function waFormel() {
  const neg = state.richtung === 'negativ';
  const t = state.traeger;
  const v = state.verfahren;
  if (t === 'nichtfluktuierend' && v === 'spitz') {
    return neg ? 'W<sub>A,i</sub> = max{0; (P<sub>plan,i</sub> − P<sub>lim,i</sub>) · ¼ h}' : 'W<sub>A,i</sub> = min{0; (P<sub>plan,i</sub> − P<sub>lim,i</sub>) · ¼ h}';
  }
  if (t === 'nichtfluktuierend') {
    return neg ? 'W<sub>A,i</sub> = max{0; (min(P<sub>0</sub>; P<sub>bean,i</sub>) − P<sub>lim,i</sub>) · ¼ h}' : 'W<sub>A,i</sub> = min{0; (P<sub>0</sub> − min(P<sub>lim,i</sub>; P<sub>bean,i</sub>)) · ¼ h}';
  }
  if (t.startsWith('wind') && v === 'pauschal') {
    return 'W<sub>A,i</sub> = max{0; [min(P<sub>0</sub>; P<sub>inst</sub>; P<sub>mbA,i</sub>; P<sub>bean,i</sub>) − P<sub>lim,i</sub>] · ¼ h}';
  }
  if (t.startsWith('wind') && v === 'windbin') {
    return 'W<sub>A,i</sub> = max{0; (min(KF<sub>Bin</sub> · P<sub>theo,i</sub>; P<sub>mbA,i</sub>; P<sub>bean,i</sub>) − P<sub>lim,i</sub>) · ¼ h}<br>KF<sub>Bin</sub> = KFL<sub>Bin</sub> · KF<sub>V</sub>, &nbsp; P<sub>theo,i</sub> = Leistungskennlinie(v<sub>i</sub>)';
  }
  if (t.startsWith('wind')) {
    return 'W<sub>A,i</sub> = max{0; (min(KF · P<sub>theo,i</sub>; P<sub>mbA,i</sub>; P<sub>bean,i</sub>) − P<sub>lim,i</sub>) · ¼ h}<br>KF = P<sub>VZ,ist</sub> / P<sub>VZ,theo</sub>, &nbsp; P<sub>theo,i</sub> = Leistungskennlinie(v<sub>i</sub>)';
  }
  if (v === 'pauschal') {
    return 'W<sub>A,i</sub> = max{0; [min(AF · P<sub>inst</sub>; P<sub>WR</sub>; P<sub>mbA,i</sub>; P<sub>bean,i</sub>) − P<sub>lim,i</sub>] · ¼ h}';
  }
  return 'W<sub>A,i</sub> = max{0; (min(P<sub>VZ,ist</sub> · G<sub>i</sub> / G<sub>VZ</sub>; P<sub>WR</sub>; P<sub>mbA,i</sub>; P<sub>bean,i</sub>) − P<sub>lim,i</sub>) · ¼ h}';
}

// Viertelstunden ab Beginn; Zeiten werden über UTC-Felder geführt, damit keine Zeitumstellung dazwischenfunkt.
function viertelstunden() {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(state.beginn || '');
  if (!m) return [];
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const p2 = (n) => String(n).padStart(2, '0');
  const fmtZeit = (d) => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  return Array.from({ length: state.anzahl }, (_, i) => {
    const von = new Date(start + i * 900000);
    const bis = new Date(start + (i + 1) * 900000);
    return { zeit: von, label: `${p2(von.getUTCDate())}.${p2(von.getUTCMonth() + 1)}. ${fmtZeit(von)}–${fmtZeit(bis)}` };
  });
}

// ---------------------------------------------------------------------------------------------
// Rendering der Auswahlschritte
// ---------------------------------------------------------------------------------------------

function renderAuswahl(container, optionen, gewaehlt, name, onSelect, gesperrt = () => null) {
  container.innerHTML = '';
  for (const opt of optionen) {
    const grund = gesperrt(opt);
    const label = document.createElement('label');
    label.className = 'choice' + (gewaehlt === opt.id ? ' choice--active' : '') + (grund ? ' choice--disabled' : '');
    label.innerHTML = `
      <input type="radio" name="${name}" value="${opt.id}" ${gewaehlt === opt.id ? 'checked' : ''} ${grund ? 'disabled' : ''}>
      <span class="choice__title">${opt.titel}${opt.kap ? ` <span class="choice__kap">Kap. ${opt.kap}</span>` : ''}</span>
      <span class="choice__text">${grund || opt.text}</span>`;
    label.querySelector('input').addEventListener('change', () => onSelect(opt.id));
    container.appendChild(label);
  }
}

function renderSchritte() {
  renderAuswahl(el('choice-fall'), FAELLE, state.fall, 'fall', (id) => { state.fall = id; aenderungAuswahl(); });
  renderAuswahl(el('choice-richtung'), RICHTUNGEN, state.richtung, 'richtung', (id) => {
    state.richtung = id;
    if (id === 'positiv' && state.traeger && state.traeger !== 'nichtfluktuierend') {
      state.traeger = null;
      state.verfahren = null;
    }
    aenderungAuswahl();
  });
  renderAuswahl(el('choice-limitierung'), LIMITIERUNGEN, state.limitierung, 'limitierung', (id) => { state.limitierung = id; aenderungAuswahl(); });
  el('limitierung-formel').innerHTML = state.fall && state.richtung
    ? `<div class="formula-box__label">Wert der Leistungslimitierung (Kap. 3.1)</div><div class="formula">${plimFormel()}</div>`
    : '';
  el('limitierung-formel').hidden = !(state.fall && state.richtung);

  const schritt1Fertig = state.fall && state.richtung;
  const offen = [!state.fall && 'Fall (Aufforderungs- oder Duldungsfall)', !state.richtung && 'Richtung des Redispatch'].filter(Boolean);
  el('fall-offen').hidden = !offen.length;
  el('fall-offen').textContent = offen.length ? `Bitte noch wählen: ${offen.join(' und ')} – danach geht es mit dem Energieträger weiter.` : '';
  el('step-traeger').hidden = !schritt1Fertig;
  if (schritt1Fertig) {
    renderAuswahl(el('choice-traeger'), TRAEGER, state.traeger, 'traeger', (id) => {
      state.traeger = id;
      if (!VERFAHREN[id].some((v) => v.id === state.verfahren)) state.verfahren = null;
      aenderungAuswahl();
    }, (opt) => (opt.nurNegativ && state.richtung === 'positiv' ? 'Kapitel 3.2 gilt nur für negativen Redispatch – bei positivem Redispatch nicht anwendbar.' : null));
  }

  const schritt2Fertig = schritt1Fertig && state.traeger;
  el('step-verfahren').hidden = !schritt2Fertig;
  if (schritt2Fertig) {
    const fluktuierend = state.traeger !== 'nichtfluktuierend';
    el('verfahren-ref').textContent = fluktuierend
      ? 'Kapitel 3.2.1 – Abrechnungsvarianten bei Anlagen mit fluktuierender Erzeugung'
      : 'Kapitel 3.3 – Abrechnungsvarianten bei Anlagen mit nicht-fluktuierender Erzeugung';
    renderAuswahl(el('choice-verfahren'), VERFAHREN[state.traeger], state.verfahren, 'verfahren', (id) => { state.verfahren = id; aenderungAuswahl(); });
    el('verfahren-hinweis').innerHTML = fluktuierend
      ? '<p class="hint">Die Variante legt der Anlagenbetreiber je TR bis zum 30.11. für das Folgejahr fest. TR im Planwertmodell sind der Spitz- oder vereinfachten Spitzabrechnung zuzuordnen.</p>'
      : '<p class="hint">TR im Planwertmodell: Spitzabrechnung. TR im Prognosemodell: Pauschal-Abrechnung (auf Wunsch des Anlagenbetreibers Spitzabrechnung bei korrekten Ex-ante-Planungsdaten).</p>';
  }

  const schritt3Fertig = schritt2Fertig && state.verfahren;
  el('step-eingaben').hidden = !schritt3Fertig;
  if (schritt3Fertig) renderEingaben();
}

function aenderungAuswahl() {
  el('step-ergebnis').hidden = true;
  renderSchritte();
}

// ---------------------------------------------------------------------------------------------
// Rendering der Eingaben
// ---------------------------------------------------------------------------------------------

function feldHtml(key, def, wert) {
  return `
    <div class="form-row">
      <label for="param-${key}">${def.sym} – ${def.titel} <span class="unit">[${def.einheit}]</span></label>
      <input type="text" inputmode="decimal" id="param-${key}" data-param="${key}" value="${escapeHtml(wert)}">
    </div>`;
}

function renderEingaben() {
  const b = benoetigt();
  el('formel').innerHTML = `
    <div class="formula-box__label">Angewendete Formeln</div>
    <div class="formula">${plimFormel()}</div>
    <div class="formula">${waFormel()}</div>`;

  let html = `
    <h3 class="step__subtitle">Zeitraum der Redispatch-Maßnahme</h3>
    <div class="form-grid">
      <div class="form-row">
        <label for="in-beginn">Beginn der ersten Viertelstunde${state.traeger === 'solar' && state.verfahren === 'pauschal' ? ' <span class="unit">(UTC+1, also MEZ – im Sommer 1 h vor MESZ)</span>' : ''}</label>
        <input type="datetime-local" id="in-beginn" step="900" value="${escapeHtml(state.beginn)}">
      </div>
      <div class="form-row">
        <label for="in-anzahl">Anzahl Viertelstunden</label>
        <input type="number" id="in-anzahl" min="1" max="2976" step="1" value="${state.anzahl}">
      </div>
    </div>`;

  if (b.params.length) {
    html += '<h3 class="step__subtitle">Anlagenparameter</h3><div class="form-grid">';
    for (const key of b.params) {
      const def = key === 'pInst' && state.traeger === 'solar'
        ? { ...PARAM_FELDER.pInst, titel: 'Installierte Nennleistung (Summe der Modulnennleistungen)' }
        : PARAM_FELDER[key];
      html += feldHtml(key, def, state.params[key]);
    }
    html += '</div>';
  }

  if (b.kennlinie) {
    html += `
      <h3 class="step__subtitle">Zertifizierte Leistungskennlinie der WEA</h3>
      <p class="hint">Je Zeile ein Wertepaar „Windgeschwindigkeit in m/s; Leistung in kW“. Zwischenwerte werden linear interpoliert, die Windgeschwindigkeit auf 0,1 m/s gerundet. Außerhalb der Kennlinie wird 0 kW angesetzt.</p>
      <textarea id="in-kennlinie" rows="8" placeholder="3;0&#10;4;80&#10;5;220">${escapeHtml(state.kennlinie)}</textarea>`;
  }

  if (b.vz) {
    html += `
      <h3 class="step__subtitle">Vergleichszeitraum für den Korrekturfaktor KF</h3>
      <p class="hint">Die zeitlich nächsten vier vollständig gemessenen, zusammenhängenden Viertelstunden vor oder nach der Maßnahme mit uneingeschränkter Einspeisung und mindestens 10 % der Nennleistung (bei gleichem Abstand: davor; nicht aus dem Folgemonat).</p>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Vergleichs-¼ h</th><th>v <span class="unit">[m/s]</span></th><th>P<sub>VZ,ist</sub> <span class="unit">[kW]</span></th></tr></thead>
        <tbody>${state.vz.map((q, i) => `
          <tr><td>${i + 1}</td>
            <td><input type="text" inputmode="decimal" data-vz="${i}" data-feld="v" value="${escapeHtml(q.v)}"></td>
            <td><input type="text" inputmode="decimal" data-vz="${i}" data-feld="pIst" value="${escapeHtml(q.pIst)}"></td></tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  html += `
    <h3 class="step__subtitle">Werte je Viertelstunde der Maßnahme</h3>
    <p class="hint">Alle Leistungen als Viertelstundenmittelwerte. Spalten lassen sich direkt aus Excel einfügen (Strg+V in die erste Zelle). Optionale Spalten leer lassen, wenn keine marktbedingte Anpassung bzw. keine Nichtbeanspruchbarkeit vorliegt (dann gilt P<sub>bean,i</sub> = P<sub>inst</sub>).</p>
    <div class="table-wrap" id="serien-wrap">${serienTabelle(b)}</div>`;

  el('eingaben').innerHTML = html;
}

function serienTabelle(b) {
  const qs = viertelstunden();
  const kopf = b.serien.map((k) => `<th title="${escapeHtml(SERIEN_FELDER[k].titel)}">${SERIEN_FELDER[k].sym}<br><span class="unit">${SERIEN_FELDER[k].titel} [${SERIEN_FELDER[k].einheit}]</span></th>`).join('');
  const zeilen = qs.map((q, i) => `
    <tr><td class="nowrap">${q.label}</td>${b.serien.map((k) => `
      <td><input type="text" inputmode="decimal" data-serie="${k}" data-idx="${i}" value="${escapeHtml((state.serien[k] || [])[i])}"></td>`).join('')}</tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Viertelstunde</th>${kopf}</tr></thead><tbody>${zeilen}</tbody></table>`;
}

function renderSerien() {
  el('serien-wrap').innerHTML = serienTabelle(benoetigt());
}

// ---------------------------------------------------------------------------------------------
// Eingabe-Events (Delegation, damit beim Tippen nichts neu gerendert wird)
// ---------------------------------------------------------------------------------------------

el('eingaben').addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.param) state.params[t.dataset.param] = t.value;
  else if (t.dataset.serie) (state.serien[t.dataset.serie] ||= [])[+t.dataset.idx] = t.value;
  else if (t.dataset.vz) state.vz[+t.dataset.vz][t.dataset.feld] = t.value;
  else if (t.id === 'in-kennlinie') state.kennlinie = t.value;
});

el('eingaben').addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'in-beginn') {
    state.beginn = t.value;
    renderSerien();
  } else if (t.id === 'in-anzahl') {
    state.anzahl = Math.min(2976, Math.max(1, Math.round(Number(t.value)) || 1));
    t.value = state.anzahl;
    renderSerien();
  }
});

// Mehrzeiliges Einfügen aus einer Tabellenkalkulation füllt nach unten und nach rechts auf.
el('eingaben').addEventListener('paste', (e) => {
  const t = e.target;
  if (!t.dataset.serie) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!/[\n\t]/.test(text.trim())) return;
  e.preventDefault();
  const zeilen = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((z) => z.split('\t'));
  const spalten = benoetigt().serien;
  const startSpalte = spalten.indexOf(t.dataset.serie);
  const startZeile = +t.dataset.idx;
  zeilen.forEach((zeile, dz) => {
    zeile.forEach((wert, ds) => {
      const key = spalten[startSpalte + ds];
      if (key) (state.serien[key] ||= [])[startZeile + dz] = wert.trim();
    });
  });
  if (startZeile + zeilen.length > state.anzahl) {
    state.anzahl = Math.min(2976, startZeile + zeilen.length);
    el('in-anzahl').value = state.anzahl;
  }
  renderSerien();
});

// ---------------------------------------------------------------------------------------------
// Einlesen, Prüfen, Berechnen
// ---------------------------------------------------------------------------------------------

function einlesen() {
  const b = benoetigt();
  const fehler = [];
  const params = { windBin: state.verfahren === 'windbin' };

  for (const key of b.params) {
    const n = zahl(state.params[key]);
    if (n === null || Number.isNaN(n)) fehler.push(`${PARAM_FELDER[key].sym} (${PARAM_FELDER[key].titel}) fehlt oder ist keine Zahl.`);
    params[key] = n;
  }
  if (b.params.includes('pInst') && params.pInst <= 0) fehler.push('P<sub>inst</sub> muss größer als 0 sein.');
  if (b.params.includes('gVz') && params.gVz <= 0) fehler.push('G<sub>VZ</sub> muss größer als 0 sein.');

  if (b.kennlinie) {
    const kl = parseKennlinie(state.kennlinie);
    fehler.push(...kl.fehler);
    params.kennlinie = kl.punkte;
  }

  if (b.vz) {
    params.vz = state.vz.map((q, i) => {
      const v = zahl(q.v);
      const pIst = zahl(q.pIst);
      if (v === null || Number.isNaN(v) || pIst === null || Number.isNaN(pIst)) fehler.push(`Vergleichszeitraum Viertelstunde ${i + 1}: Windgeschwindigkeit und P<sub>VZ,ist</sub> angeben.`);
      return { v, pIst };
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(state.beginn || '')) fehler.push('Beginn der Maßnahme fehlt.');
  const qs = viertelstunden();
  const zeilen = qs.map((q, i) => {
    const r = { label: q.label, zeit: q.zeit };
    for (const key of b.serien) {
      const n = zahl((state.serien[key] || [])[i]);
      const def = SERIEN_FELDER[key];
      if (Number.isNaN(n) || (n === null && !def.optional)) fehler.push(`${q.label}: ${def.sym} (${def.titel}) fehlt oder ist keine Zahl.`);
      r[key] = n;
    }
    return r;
  });

  return { params, zeilen, fehler };
}

function berechnen() {
  const { params, zeilen, fehler } = einlesen();
  el('step-ergebnis').hidden = false;
  if (fehler.length) {
    const max = 12;
    el('ergebnis').innerHTML = `<div class="message message--error"><strong>Bitte Eingaben ergänzen:</strong><ul>${fehler.slice(0, max).map((f) => `<li>${f}</li>`).join('')}${fehler.length > max ? `<li>… und ${fehler.length - max} weitere</li>` : ''}</ul></div>`;
    el('step-ergebnis').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  let erg;
  try {
    erg = berechneAusfallarbeit(cfg(), params, zeilen);
  } catch (err) {
    el('ergebnis').innerHTML = `<div class="message message--error">${err.message}</div>`;
    return;
  }
  renderErgebnis(erg);
  el('step-ergebnis').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function auswahlText() {
  const titel = (liste, id) => liste.find((x) => x.id === id).titel;
  return [titel(FAELLE, state.fall), titel(RICHTUNGEN, state.richtung), titel(LIMITIERUNGEN, state.limitierung), titel(TRAEGER, state.traeger), titel(VERFAHREN[state.traeger], state.verfahren)].join(' · ');
}

function renderErgebnis(erg) {
  if (!Number.isFinite(erg.summe)) {
    el('ergebnis').innerHTML = '<div class="message message--error">Die Berechnung liefert keinen gültigen Wert. Bitte Eingaben prüfen (z. B. theoretische Leistung im Vergleichszeitraum = 0).</div>';
    return;
  }
  const kopf = erg.spalten.map((s) => `<th>${s.label} <span class="unit">[${s.key === 'af' ? '–' : 'kW'}]</span></th>`).join('');
  const zeilen = erg.zeilen.map((z) => `
    <tr><td class="nowrap">${z.label}</td><td>${fmt(z.plim)}</td>${erg.spalten.map((s) => `<td>${fmt(z.zwischen[s.key])}</td>`).join('')}<td class="strong">${fmt(z.wa)}</td></tr>`).join('');

  const summenTerme = erg.zeilen.length <= 12 ? ` = ${erg.zeilen.map((z) => (z.wa < 0 ? `(${fmt(z.wa)})` : fmt(z.wa))).join(' + ')}` : '';

  el('ergebnis').innerHTML = `
    <div class="result-box">
      <div class="result-box__label">Ausfallarbeit gesamt (${erg.zeilen.length} Viertelstunden)</div>
      <div class="result-box__value">${fmt(erg.summe)} kWh <span class="result-box__sub">= ${fmt(erg.summe / 1000)} MWh</span></div>
      <div class="result-box__path">${auswahlText()}</div>
    </div>

    ${erg.hinweise.length ? `<div class="message message--warn"><strong>Hinweise:</strong><ul>${erg.hinweise.map((h) => `<li>${h}</li>`).join('')}</ul></div>` : ''}

    <h3 class="step__subtitle">Übersicht je Viertelstunde</h3>
    <div class="table-wrap"><table class="data-table data-table--result">
      <thead><tr><th>Viertelstunde</th><th>P<sub>lim,i</sub> <span class="unit">[kW]</span></th>${kopf}<th>W<sub>A,i</sub> <span class="unit">[kWh]</span></th></tr></thead>
      <tbody>${zeilen}</tbody>
      <tfoot><tr><td colspan="${erg.spalten.length + 2}">Summe</td><td class="strong">${fmt(erg.summe)}</td></tr></tfoot>
    </table></div>
    <button type="button" class="button--secondary" id="csv-export">Ergebnis als CSV herunterladen</button>

    <h3 class="step__subtitle">Rechenweg</h3>
    ${erg.vorbereitung.length ? `<div class="calc-block"><div class="calc-block__title">Vorab: einmalig zu bestimmende Größen</div><ol class="calc-steps">${erg.vorbereitung.map((s) => `<li>${s}</li>`).join('')}</ol></div>` : ''}
    ${erg.zeilen.map((z, i) => `
      <details class="calc-block" ${i === 0 ? 'open' : ''}>
        <summary>Viertelstunde ${z.label}: W<sub>A,i</sub> = ${fmt(z.wa)} kWh</summary>
        <ol class="calc-steps">${z.schritte.map((s) => `<li>${s}</li>`).join('')}</ol>
      </details>`).join('')}
    <div class="calc-block">
      <div class="calc-block__title">Summe über die Maßnahme</div>
      <ol class="calc-steps"><li>W<sub>A</sub> = Σ W<sub>A,i</sub>${summenTerme} = <strong>${fmt(erg.summe)} kWh</strong></li></ol>
    </div>`;

  el('csv-export').addEventListener('click', () => csvExport(erg));
}

function csvExport(erg) {
  const ohneHtml = (s) => s.replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<[^>]+>/g, '');
  const zahlCsv = (n) => (Number.isFinite(n) ? String(Math.round(n * 10000) / 10000).replace('.', ',') : '');
  const kopf = ['Viertelstunde', 'P_lim,i [kW]', ...erg.spalten.map((s) => ohneHtml(s.label)), 'W_A,i [kWh]'];
  const zeilen = erg.zeilen.map((z) => [z.label, zahlCsv(z.plim), ...erg.spalten.map((s) => zahlCsv(z.zwischen[s.key])), zahlCsv(z.wa)]);
  zeilen.push(['Summe', '', ...erg.spalten.map(() => ''), zahlCsv(erg.summe)]);
  const csv = '﻿' + [kopf, ...zeilen].map((z) => z.join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ausfallarbeit.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------------------------------------
// Beispielwerte (frei erfunden, nur zum Ausprobieren des Rechenwegs)
// ---------------------------------------------------------------------------------------------

const BEISPIEL_KENNLINIE = '3;0\n4;80\n5;220\n6;420\n7;700\n8;1050\n9;1480\n10;1950\n11;2450\n12;2850\n13;3000\n25;3000';

function beispielLaden() {
  const neg = state.richtung === 'negativ';
  const t = state.traeger;
  const v = state.verfahren;
  const s = {};
  state.anzahl = 4;
  state.params = {};
  state.vz = [{}, {}, {}, {}];

  if (t === 'nichtfluktuierend') {
    state.beginn = '2026-04-14T11:00';
    s.pIst = neg ? ['1010', '1000', '995', '1000'] : ['2190', '2200', '2210', '2200'];
    s.pMax = ['1000', '1000', '1000', '1000'];
    s.pMin = ['2200', '2200', '2200', '2200'];
    s.pPlan = ['1800', '1800', '1750', '1750'];
    s.pBean = ['', '', '1600', '1600'];
    state.params = { p0: '1800' };
  } else if (t.startsWith('wind')) {
    state.beginn = '2026-01-20T03:00';
    s.pIst = ['480', '500', '510', '495'];
    s.pMax = ['500', '500', '500', '500'];
    s.v = ['9,4', '9,8', '10,23', '13,6'];
    s.kflBin = ['0,97', '0,96', '0,96', '0,99'];
    s.pmbA = ['', '', '', ''];
    s.pBean = ['', '', '2500', '2500'];
    state.params = { pInst: '3000', p0: '1400', kfv: '0,98' };
    state.kennlinie = BEISPIEL_KENNLINIE;
    state.vz = [{ v: '9,1', pIst: '1350' }, { v: '9,3', pIst: '1420' }, { v: '9', pIst: '1290' }, { v: '8,8', pIst: '1210' }];
  } else {
    state.beginn = '2026-06-10T12:00';
    s.pIst = ['300', '300', '295', '300'];
    s.pMax = ['300', '300', '300', '300'];
    s.g = ['0,78', '0,81', '0,83', '0,8'];
    s.pmbA = ['', '', '', '450'];
    s.pBean = ['', '', '', ''];
    state.params = { pInst: '750', pWR: '700', pVzIst: '520', gVz: '0,72' };
  }
  if (v === 'pauschal' && t === 'solar') state.beginn = '2026-06-10T08:30';
  state.serien = s;
  el('step-ergebnis').hidden = true;
  renderEingaben();
}

el('beispiel-laden').addEventListener('click', beispielLaden);
el('berechnen').addEventListener('click', berechnen);

renderSchritte();
