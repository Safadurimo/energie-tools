// Rechenkern Ausfallarbeit Redispatch 2.0 nach BNetzA-Festlegung BK6-23-241
// "Bilanzieller Ausgleich von Redispatch-Maßnahmen (BilAReM)", Anlage Kapitel 3.
// Alle Leistungswerte sind Viertelstundenmittelwerte in kW, die Ausfallarbeit W_A,i in kWh je
// Viertelstunde (Leistung × 1/4 h). Negativer Redispatch → W_A ≥ 0, positiver Redispatch → W_A ≤ 0.
// Jede Funktion liefert neben dem Wert die Rechenschritte als HTML-Text für die Anzeige des Rechenwegs.
// Kein DOM-Zugriff in dieser Datei.

const VIERTELSTUNDE_H = 0.25;

const SYM = {
  wa: 'W<sub>A,i</sub>',
  plim: 'P<sub>lim,i</sub>',
  pist: 'P<sub>ist,i</sub>',
  pmax: 'P<sub>max,i</sub>',
  pmin: 'P<sub>min,i</sub>',
  pmba: 'P<sub>mbA,i</sub>',
  pbean: 'P<sub>bean,i</sub>',
  pinst: 'P<sub>inst</sub>',
  p0: 'P<sub>0</sub>',
  pplan: 'P<sub>plan,i</sub>',
  ptheo: 'P<sub>theo,i</sub>',
  kf: 'KF',
  kfbin: 'KF<sub>Bin</sub>',
  kflbin: 'KFL<sub>Bin</sub>',
  kfv: 'KF<sub>V</sub>',
  pvzist: 'P<sub>VZ,ist</sub>',
  pvztheo: 'P<sub>VZ,theo</sub>',
  gi: 'G<sub>i</sub>',
  gvz: 'G<sub>VZ</sub>',
  pwr: 'P<sub>WR</sub>',
  af: 'AF',
  pmoegl: 'P<sub>mögl,i</sub>',
};

const zahlFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 });

function fmt(n) {
  return Number.isFinite(n) ? zahlFormat.format(n) : '–';
}

// Klammert negative Zahlen, damit eingesetzte Werte in Formeln lesbar bleiben.
function fmtTerm(n) {
  return n < 0 ? `(${fmt(n)})` : fmt(n);
}

function istWert(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

// Minimum über die vorhandenen Terme; nicht belegte optionale Terme (null) entfallen.
function minimum(ergebnisSym, terme, einheit = 'kW') {
  const genutzt = terme.filter((t) => istWert(t.wert));
  const wert = Math.min(...genutzt.map((t) => t.wert));
  if (genutzt.length === 1) {
    return { wert, schritt: `${ergebnisSym} = ${genutzt[0].sym} = ${fmt(wert)} ${einheit}` };
  }
  const syms = genutzt.map((t) => t.sym).join('; ');
  const werte = genutzt.map((t) => fmt(t.wert)).join('; ');
  return { wert, schritt: `${ergebnisSym} = min{${syms}} = min{${werte}} = ${fmt(wert)} ${einheit}` };
}

// ---------------------------------------------------------------------------------------------
// Kapitel 3.1 – Wert der Leistungslimitierung
// ---------------------------------------------------------------------------------------------

function bestimmePlim(cfg, r) {
  const negativ = cfg.richtung === 'negativ';
  // Referenzprofilverfahren (keine ¼-h-Messung) und beidseitige Fixierung: Vorgabe des NB gilt als erreicht,
  // unabhängig von Aufforderungs- oder Duldungsfall.
  if (cfg.limitierung === 'referenzprofil' || cfg.limitierung === 'fixierung') {
    const wert = negativ ? r.pMax : r.pMin;
    const sym = negativ ? SYM.pmax : SYM.pmin;
    const grund = cfg.limitierung === 'referenzprofil' ? 'Referenzprofilverfahren' : 'beidseitige Fixierung';
    return { wert, schritt: `${SYM.plim} = ${sym} = ${fmt(wert)} kW <span class="calc-note">(${grund}, Kap. 3.1)</span>` };
  }
  if (cfg.fall === 'duldung') {
    return { wert: r.pIst, schritt: `${SYM.plim} = ${SYM.pist} = ${fmt(r.pIst)} kW <span class="calc-note">(Duldungsfall, Kap. 3.1)</span>` };
  }
  if (negativ) {
    const wert = Math.max(r.pIst, r.pMax);
    return { wert, schritt: `${SYM.plim} = max{${SYM.pist}; ${SYM.pmax}} = max{${fmt(r.pIst)}; ${fmt(r.pMax)}} = ${fmt(wert)} kW <span class="calc-note">(Aufforderungsfall, negativer Redispatch)</span>` };
  }
  const wert = Math.min(r.pIst, r.pMin);
  return { wert, schritt: `${SYM.plim} = min{${SYM.pist}; ${SYM.pmin}} = min{${fmt(r.pIst)}; ${fmt(r.pMin)}} = ${fmt(wert)} kW <span class="calc-note">(Aufforderungsfall, positiver Redispatch)</span>` };
}

// ---------------------------------------------------------------------------------------------
// Ausfallarbeit aus möglicher Leistung und Leistungslimitierung
// ---------------------------------------------------------------------------------------------

function arbeitNegativ(minuend, minuendSym, plim) {
  const wert = Math.max(0, (minuend - plim) * VIERTELSTUNDE_H);
  return { wert, schritt: `${SYM.wa} = max{0; (${minuendSym} − ${SYM.plim}) · ¼ h} = max{0; (${fmt(minuend)} − ${fmtTerm(plim)}) kW · 0,25 h} = <strong>${fmt(wert)} kWh</strong>` };
}

function arbeitPositiv(minuend, minuendSym, subtrahend, subtrahendSym) {
  const wert = Math.min(0, (minuend - subtrahend) * VIERTELSTUNDE_H);
  return { wert, schritt: `${SYM.wa} = min{0; (${minuendSym} − ${subtrahendSym}) · ¼ h} = min{0; (${fmt(minuend)} − ${fmtTerm(subtrahend)}) kW · 0,25 h} = <strong>${fmt(wert)} kWh</strong>` };
}

// Beanspruchbare Leistung: P_inst abzüglich Nichtbeanspruchbarkeit, höchstens P_inst.
// Leere Eingabe bedeutet: keine Nichtbeanspruchbarkeit → P_bean,i = P_inst.
function beanspruchbar(pBean, pInst) {
  if (!istWert(pBean)) {
    return { wert: pInst, schritt: `${SYM.pbean} = ${SYM.pinst} = ${fmt(pInst)} kW <span class="calc-note">(keine Nichtbeanspruchbarkeit angegeben)</span>` };
  }
  if (pBean > pInst) {
    return { wert: pInst, schritt: `${SYM.pbean} = ${fmt(pBean)} kW &gt; ${SYM.pinst} → begrenzt auf ${fmt(pInst)} kW` };
  }
  return { wert: pBean, schritt: `${SYM.pbean} = ${fmt(pBean)} kW` };
}

function begrenzeAufNennleistung(produkt, produktSym, pInst) {
  if (produkt > pInst) {
    return { wert: pInst, schritt: `${produktSym} = ${fmt(produkt)} kW &gt; Nennleistung ${fmt(pInst)} kW → nicht plausibel, Begrenzung auf ${fmt(pInst)} kW` };
  }
  return { wert: produkt, schritt: null };
}

// ---------------------------------------------------------------------------------------------
// Windenergie: Leistungskennlinie und Korrekturfaktor (Kap. 3.2.2.1, 3.2.3.2)
// ---------------------------------------------------------------------------------------------

// Erwartet Zeilen "v;P" (m/s; kW), Dezimalkomma oder -punkt; Trennzeichen ; Tab oder Leerzeichen.
function parseKennlinie(text) {
  const punkte = [];
  const fehler = [];
  String(text || '').split(/\r?\n/).forEach((zeile, idx) => {
    const t = zeile.trim();
    if (!t) return;
    const teile = t.split(/[;\t]|\s+/).filter(Boolean).map((s) => Number(s.replace(',', '.')));
    if (teile.length !== 2 || !teile.every(Number.isFinite)) {
      fehler.push(`Kennlinie Zeile ${idx + 1}: „${t}“ ist kein Wertepaar v;P.`);
      return;
    }
    punkte.push({ v: teile[0], p: teile[1] });
  });
  punkte.sort((a, b) => a.v - b.v);
  if (punkte.length < 2 && fehler.length === 0) fehler.push('Die Leistungskennlinie braucht mindestens zwei Wertepaare.');
  return { punkte, fehler };
}

// Theoretische Leistung aus der Kennlinie; Zwischenwerte linear interpoliert (Kap. 3.2.2.1).
// Windgeschwindigkeit wird auf die geforderte Auflösung von 0,1 m/s gerundet.
// Außerhalb der Kennlinie (unter Einschalt-/über Abschaltgeschwindigkeit) liefert die Anlage 0 kW.
function leistungAusKennlinie(kennlinie, vRoh, sym = SYM.ptheo) {
  const v = Math.round(vRoh * 10) / 10;
  const vText = `v = ${fmt(v)} m/s`;
  const erster = kennlinie[0];
  const letzter = kennlinie[kennlinie.length - 1];
  if (v < erster.v || v > letzter.v) {
    return { wert: 0, schritt: `${sym} = 0 kW <span class="calc-note">(${vText} liegt außerhalb der Kennlinie ${fmt(erster.v)}–${fmt(letzter.v)} m/s)</span>` };
  }
  for (let k = 0; k < kennlinie.length; k++) {
    if (kennlinie[k].v === v) {
      return { wert: kennlinie[k].p, schritt: `${sym} = LK(${fmt(v)} m/s) = ${fmt(kennlinie[k].p)} kW <span class="calc-note">(Stützpunkt der Kennlinie)</span>` };
    }
  }
  const k = kennlinie.findIndex((pt) => pt.v > v);
  const a = kennlinie[k - 1];
  const b = kennlinie[k];
  const wert = a.p + ((v - a.v) / (b.v - a.v)) * (b.p - a.p);
  return {
    wert,
    schritt: `${sym} = LK(${fmt(v)} m/s) = ${fmt(a.p)} + (${fmt(v)} − ${fmt(a.v)}) / (${fmt(b.v)} − ${fmt(a.v)}) · (${fmt(b.p)} − ${fmt(a.p)}) = ${fmt(wert)} kW <span class="calc-note">(lineare Interpolation)</span>`,
  };
}

// KF = P_VZ,ist / P_VZ,theo über die vier Viertelstunden des Vergleichszeitraums.
function korrekturfaktorWind(kennlinie, vz, pInst) {
  const schritte = [];
  const hinweise = [];
  const theo = vz.map((q, idx) => {
    const lk = leistungAusKennlinie(kennlinie, q.v, `P<sub>VZ,theo,${idx + 1}</sub>`);
    schritte.push(`Viertelstunde ${idx + 1}: ${lk.schritt}; gemessen P<sub>VZ,ist,${idx + 1}</sub> = ${fmt(q.pIst)} kW`);
    if (q.pIst < 0.1 * pInst) {
      hinweise.push(`Vergleichszeitraum Viertelstunde ${idx + 1}: Die gemessene Leistung ${fmt(q.pIst)} kW liegt unter 10 % der Nennleistung (${fmt(0.1 * pInst)} kW). Diese Viertelstunde ist nach Kap. 3.2.2.1 nicht zulässig.`);
    }
    return lk.wert;
  });
  const pVzIst = vz.reduce((s, q) => s + q.pIst, 0) / vz.length;
  const pVzTheo = theo.reduce((s, x) => s + x, 0) / theo.length;
  schritte.push(`${SYM.pvzist} = (${vz.map((q) => fmt(q.pIst)).join(' + ')}) / ${vz.length} = ${fmt(pVzIst)} kW`);
  schritte.push(`${SYM.pvztheo} = (${theo.map(fmt).join(' + ')}) / ${theo.length} = ${fmt(pVzTheo)} kW`);
  if (!(pVzTheo > 0)) {
    throw new Error('Die theoretische Leistung im Vergleichszeitraum ist 0 kW – der Korrekturfaktor KF ist nicht bestimmbar. Bitte Windgeschwindigkeiten im Vergleichszeitraum und Leistungskennlinie prüfen.');
  }
  const wert = pVzIst / pVzTheo;
  schritte.push(`${SYM.kf} = ${SYM.pvzist} / ${SYM.pvztheo} = ${fmt(pVzIst)} / ${fmt(pVzTheo)} = <strong>${fmt(wert)}</strong>`);
  return { wert, schritte, hinweise };
}

// ---------------------------------------------------------------------------------------------
// Solar: Anlagenfaktor der Pauschal-Abrechnung (Kap. 3.2.4.3), Uhrzeit in UTC+1
// ---------------------------------------------------------------------------------------------

const ANLAGENFAKTOR = {
  sommer: [
    { von: 0, bis: 6 * 60, af: 0 },
    { von: 6 * 60, bis: 9 * 60, af: 0.2456 },
    { von: 9 * 60, bis: 15 * 60, af: 0.6189 },
    { von: 15 * 60, bis: 19 * 60, af: 0.2456 },
    { von: 19 * 60, bis: 24 * 60, af: 0 },
  ],
  winter: [
    { von: 0, bis: 9 * 60, af: 0 },
    { von: 9 * 60, bis: 10 * 60, af: 0.2796 },
    { von: 10 * 60, bis: 14 * 60, af: 0.503 },
    { von: 14 * 60, bis: 16 * 60 + 45, af: 0.2796 },
    { von: 16 * 60 + 45, bis: 24 * 60, af: 0 },
  ],
};

function hhmm(minuten) {
  const h = Math.floor(minuten / 60) % 24;
  const m = minuten % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// zeit: Date, dessen UTC-Felder die Ortszeit UTC+1 tragen (Beginn der Viertelstunde).
function anlagenfaktorSolar(zeit) {
  const monat = zeit.getUTCMonth() + 1;
  const jahreszeit = monat >= 3 && monat <= 10 ? 'sommer' : 'winter';
  const minuten = zeit.getUTCHours() * 60 + zeit.getUTCMinutes();
  const band = ANLAGENFAKTOR[jahreszeit].find((b) => minuten >= b.von && minuten < b.bis);
  const label = jahreszeit === 'sommer' ? 'Sommer (01.03.–31.10.)' : 'Winter (01.11.–28./29.02.)';
  return {
    wert: band.af,
    schritt: `${SYM.af} = ${fmt(band.af)} <span class="calc-note">(${label}, Zeitfenster ${hhmm(band.von)}–${hhmm(band.bis)} UTC+1)</span>`,
  };
}

// ---------------------------------------------------------------------------------------------
// Abrechnungsvarianten
// Jede Variante: spalten (Zwischenwerte für die Ergebnistabelle), vorbereiten (einmalige Schritte),
// zeile (Berechnung einer Viertelstunde).
// ---------------------------------------------------------------------------------------------

function windTheoretisch(ctx, r, schritte) {
  const lk = leistungAusKennlinie(ctx.kennlinie, r.v);
  schritte.push(`Theoretische Leistung aus Windgeschwindigkeit und Leistungskennlinie: ${lk.schritt}`);
  let kf = ctx.kf;
  let kfSym = SYM.kf;
  if (ctx.windBin) {
    kf = r.kflBin * ctx.kfv;
    kfSym = SYM.kfbin;
    schritte.push(`${SYM.kfbin} = ${SYM.kflbin} · ${SYM.kfv} = ${fmt(r.kflBin)} · ${fmt(ctx.kfv)} = ${fmt(kf)}`);
  }
  const produkt = kf * lk.wert;
  schritte.push(`${kfSym} · ${SYM.ptheo} = ${fmt(kf)} · ${fmt(lk.wert)} = ${fmt(produkt)} kW`);
  const begrenzt = begrenzeAufNennleistung(produkt, `${kfSym} · ${SYM.ptheo}`, ctx.pInst);
  if (begrenzt.schritt) schritte.push(begrenzt.schritt);
  return { ptheo: lk.wert, kf, korrigiert: begrenzt.wert, kfSym };
}

const VARIANTEN = {
  'nichtfluktuierend/spitz': {
    spalten: [{ key: 'pplan', label: SYM.pplan }],
    vorbereiten: () => ({ schritte: [], hinweise: [] }),
    zeile(cfg, ctx, r, plim, schritte) {
      schritte.push(`Geplante Leistung laut Ex-ante-Planungsdaten: ${SYM.pplan} = ${fmt(r.pPlan)} kW`);
      const wa = cfg.richtung === 'negativ'
        ? arbeitNegativ(r.pPlan, SYM.pplan, plim)
        : arbeitPositiv(r.pPlan, SYM.pplan, plim, SYM.plim);
      schritte.push(wa.schritt);
      return { zwischen: { pplan: r.pPlan }, wa: wa.wert };
    },
  },

  'nichtfluktuierend/pauschal': {
    spalten: [{ key: 'pmoegl', label: 'min-Term' }],
    vorbereiten: (cfg, p) => ({ schritte: [`Letzter vollständig gemessener Leistungsmittelwert vor der Maßnahme: ${SYM.p0} = ${fmt(p.p0)} kW`], hinweise: [] }),
    zeile(cfg, ctx, r, plim, schritte) {
      const bean = istWert(r.pBean) ? r.pBean : null;
      if (cfg.richtung === 'negativ') {
        const m = minimum(SYM.pmoegl, [{ sym: SYM.p0, wert: ctx.p0 }, { sym: SYM.pbean, wert: bean }]);
        schritte.push(m.schritt);
        const wa = arbeitNegativ(m.wert, SYM.pmoegl, plim);
        schritte.push(wa.schritt);
        return { zwischen: { pmoegl: m.wert }, wa: wa.wert };
      }
      const m = minimum('P<sub>lim,bean,i</sub>', [{ sym: SYM.plim, wert: plim }, { sym: SYM.pbean, wert: bean }]);
      schritte.push(m.schritt);
      const wa = arbeitPositiv(ctx.p0, SYM.p0, m.wert, 'min{P<sub>lim,i</sub>; P<sub>bean,i</sub>}');
      schritte.push(wa.schritt);
      return { zwischen: { pmoegl: m.wert }, wa: wa.wert };
    },
  },

  'wind/spitz': {
    spalten: [
      { key: 'ptheo', label: SYM.ptheo },
      { key: 'korrigiert', label: 'KF · P<sub>theo,i</sub>' },
      { key: 'pmoegl', label: SYM.pmoegl },
    ],
    vorbereiten(cfg, p) {
      if (p.windBin) {
        return {
          schritte: [`Wind-Bin-Verfahren: Der Korrekturfaktor wird je Viertelstunde aus dem Leistungsfaktor des zutreffenden Bins ${SYM.kflbin} und dem Verlustfaktor ${SYM.kfv} = ${fmt(p.kfv)} gebildet (Kap. 3.2.3.2).`],
          hinweise: p.kfv > 0 && p.kfv < 1 ? [] : [`Der Verlustfaktor KF<sub>V</sub> muss im offenen Intervall ]0; 1[ liegen (eingegeben: ${fmt(p.kfv)}).`],
        };
      }
      const kf = korrekturfaktorWind(p.kennlinie, p.vz, p.pInst);
      return { kf: kf.wert, schritte: ['Korrekturfaktor aus dem Vergleichszeitraum (vier Viertelstunden ungeregelter Einspeisung vor bzw. nach der Maßnahme):', ...kf.schritte], hinweise: kf.hinweise };
    },
    zeile(cfg, ctx, r, plim, schritte) {
      const w = windTheoretisch(ctx, r, schritte);
      const bean = beanspruchbar(r.pBean, ctx.pInst);
      schritte.push(bean.schritt);
      const m = minimum(SYM.pmoegl, [
        { sym: `${w.kfSym} · ${SYM.ptheo}`, wert: w.korrigiert },
        { sym: SYM.pmba, wert: r.pmbA },
        { sym: SYM.pbean, wert: bean.wert },
      ]);
      schritte.push(m.schritt);
      const wa = arbeitNegativ(m.wert, SYM.pmoegl, plim);
      schritte.push(wa.schritt);
      return { zwischen: { ptheo: w.ptheo, korrigiert: w.korrigiert, pmoegl: m.wert }, wa: wa.wert };
    },
  },

  'wind/pauschal': {
    spalten: [{ key: 'pmoegl', label: SYM.pmoegl }],
    vorbereiten: (cfg, p) => ({ schritte: [`Fortgeschriebener letzter vollständig gemessener Leistungsmittelwert vor der Maßnahme: ${SYM.p0} = ${fmt(p.p0)} kW`], hinweise: [] }),
    zeile(cfg, ctx, r, plim, schritte) {
      const bean = beanspruchbar(r.pBean, ctx.pInst);
      schritte.push(bean.schritt);
      const m = minimum(SYM.pmoegl, [
        { sym: SYM.p0, wert: ctx.p0 },
        { sym: SYM.pinst, wert: ctx.pInst },
        { sym: SYM.pmba, wert: r.pmbA },
        { sym: SYM.pbean, wert: bean.wert },
      ]);
      schritte.push(m.schritt);
      const wa = arbeitNegativ(m.wert, SYM.pmoegl, plim);
      schritte.push(wa.schritt);
      return { zwischen: { pmoegl: m.wert }, wa: wa.wert };
    },
  },

  'solar/spitz': {
    spalten: [
      { key: 'ptheo', label: 'P<sub>VZ,ist</sub> · G<sub>i</sub>/G<sub>VZ</sub>' },
      { key: 'pmoegl', label: SYM.pmoegl },
    ],
    vorbereiten: (cfg, p) => ({
      schritte: [`Vergleichszeitraum: ${SYM.pvzist} = ${fmt(p.pVzIst)} kW bei ${SYM.gvz} = ${fmt(p.gVz)} kW/m² → spezifische Leistung ${SYM.pvzist} / ${SYM.gvz} = ${fmt(p.pVzIst / p.gVz)} kW je kW/m²`],
      hinweise: [],
    }),
    zeile(cfg, ctx, r, plim, schritte) {
      const produkt = (ctx.pVzIst * r.g) / ctx.gVz;
      const produktSym = `${SYM.pvzist} · ${SYM.gi} / ${SYM.gvz}`;
      schritte.push(`Theoretische Leistung aus Einstrahlung: ${produktSym} = ${fmt(ctx.pVzIst)} · ${fmt(r.g)} / ${fmt(ctx.gVz)} = ${fmt(produkt)} kW`);
      const begrenzt = begrenzeAufNennleistung(produkt, produktSym, ctx.pInst);
      if (begrenzt.schritt) schritte.push(begrenzt.schritt);
      const bean = beanspruchbar(r.pBean, ctx.pInst);
      schritte.push(bean.schritt);
      const m = minimum(SYM.pmoegl, [
        { sym: produktSym, wert: begrenzt.wert },
        { sym: SYM.pwr, wert: ctx.pWR },
        { sym: SYM.pmba, wert: r.pmbA },
        { sym: SYM.pbean, wert: bean.wert },
      ]);
      schritte.push(m.schritt);
      const wa = arbeitNegativ(m.wert, SYM.pmoegl, plim);
      schritte.push(wa.schritt);
      return { zwischen: { ptheo: begrenzt.wert, pmoegl: m.wert }, wa: wa.wert };
    },
  },

  'solar/pauschal': {
    spalten: [
      { key: 'af', label: SYM.af },
      { key: 'ptheo', label: 'AF · P<sub>inst</sub>' },
      { key: 'pmoegl', label: SYM.pmoegl },
    ],
    vorbereiten: () => ({ schritte: [], hinweise: [] }),
    zeile(cfg, ctx, r, plim, schritte) {
      const af = anlagenfaktorSolar(r.zeit);
      schritte.push(`Anlagenfaktor nach Tabelle Kap. 3.2.4.3: ${af.schritt}`);
      const ptheo = af.wert * ctx.pInst;
      schritte.push(`${SYM.af} · ${SYM.pinst} = ${fmt(af.wert)} · ${fmt(ctx.pInst)} = ${fmt(ptheo)} kW`);
      const bean = beanspruchbar(r.pBean, ctx.pInst);
      schritte.push(bean.schritt);
      const m = minimum(SYM.pmoegl, [
        { sym: `${SYM.af} · ${SYM.pinst}`, wert: ptheo },
        { sym: SYM.pwr, wert: ctx.pWR },
        { sym: SYM.pmba, wert: r.pmbA },
        { sym: SYM.pbean, wert: bean.wert },
      ]);
      schritte.push(m.schritt);
      const wa = arbeitNegativ(m.wert, SYM.pmoegl, plim);
      schritte.push(wa.schritt);
      return { zwischen: { af: af.wert, ptheo, pmoegl: m.wert }, wa: wa.wert };
    },
  },
};

// Vereinfachte Spitzabrechnung rechnet wie die Spitzabrechnung; nur die Datenquelle der Wetterdaten
// unterscheidet sich (Kap. 3.2.2.2, 3.2.4.2). Wind auf See nutzt die Regeln für Wind an Land (Kap. 3.2.3.1).
function varianteFuer(cfg) {
  const traeger = cfg.traeger.startsWith('wind') ? 'wind' : cfg.traeger;
  const verfahren = cfg.verfahren === 'vereinfacht' || cfg.verfahren === 'windbin' ? 'spitz' : cfg.verfahren;
  return VARIANTEN[`${traeger}/${verfahren}`];
}

// cfg:    { fall, richtung, limitierung ('messung' | 'referenzprofil' | 'fixierung'), traeger, verfahren }
// params: { pInst, p0, pWR, pVzIst, gVz, kfv, kennlinie: [{v,p}], vz: [{v,pIst}], windBin }
// zeilen: [{ label, zeit, pIst, pMax, pMin, pmbA, pBean, v, g, pPlan, kflBin }]
function berechneAusfallarbeit(cfg, params, zeilen) {
  const variante = varianteFuer(cfg);
  const vorbereitung = variante.vorbereiten(cfg, params);
  const ctx = { ...params, kf: vorbereitung.kf };
  const ergebnisZeilen = zeilen.map((r) => {
    const schritte = [];
    const plim = bestimmePlim(cfg, r);
    schritte.push(`Wert der Leistungslimitierung: ${plim.schritt}`);
    const z = variante.zeile(cfg, ctx, r, plim.wert, schritte);
    return { label: r.label, plim: plim.wert, zwischen: z.zwischen, wa: z.wa, schritte };
  });
  const summe = ergebnisZeilen.reduce((s, z) => s + z.wa, 0);
  return {
    spalten: variante.spalten,
    vorbereitung: vorbereitung.schritte,
    hinweise: vorbereitung.hinweise,
    zeilen: ergebnisZeilen,
    summe,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { berechneAusfallarbeit, bestimmePlim, leistungAusKennlinie, parseKennlinie, korrekturfaktorWind, anlagenfaktorSolar, fmt, SYM };
}
