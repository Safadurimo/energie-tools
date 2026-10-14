// SigLinDe-Funktion für Gas-Standardlastprofile (h-Wert)
// h(theta) = A / (1 + (B / (theta - theta0))^C) + D + max(mH*theta + bH, mW*theta + bW)
// Sigmoid-Teil bildet die Heizkurve ab, der lineare max()-Teil (Heizgas-/Warmwasser-Gerade)
// sorgt für den Sockelverbrauch bei warmer Witterung. Ohne ihn liefert die Formel bei 8 °C
// (Referenztemperatur, an der h = 1 gelten soll) einen deutlich zu niedrigen Wert.
const THETA_0 = 40; // °C, fester Referenzwert laut BDEW-Leitfaden

function calculateHValue(a, b, c, d, mh, bh, mw, bw, theta) {
  const sigmoid = a / (1 + Math.pow(b / (theta - THETA_0), c)) + d;
  const linear = Math.max(mh * theta + bh, mw * theta + bw);
  return sigmoid + linear;
}

const form = document.getElementById('slp-form');
const resultEl = document.getElementById('result');
const profileSelect = document.getElementById('profile-select');

const groups = {};
for (const profile of SLP_PROFILES) {
  if (!groups[profile.group]) {
    groups[profile.group] = document.createElement('optgroup');
    groups[profile.group].label = profile.group;
    profileSelect.appendChild(groups[profile.group]);
  }
  const option = document.createElement('option');
  option.value = profile.code;
  option.textContent = profile.label;
  groups[profile.group].appendChild(option);
}

profileSelect.addEventListener('change', () => {
  const profile = SLP_PROFILES.find((p) => p.code === profileSelect.value);
  if (!profile) return;
  document.getElementById('param-a').value = profile.a;
  document.getElementById('param-b').value = profile.b;
  document.getElementById('param-c').value = profile.c;
  document.getElementById('param-d').value = profile.d;
  document.getElementById('param-mh').value = profile.mh;
  document.getElementById('param-bh').value = profile.bh;
  document.getElementById('param-mw').value = profile.mw;
  document.getElementById('param-bw').value = profile.bw;
  berechnen();
});

const FELDER = [
  { id: 'param-a', name: 'Parameter A' },
  { id: 'param-b', name: 'Parameter B' },
  { id: 'param-c', name: 'Parameter C' },
  { id: 'param-d', name: 'Parameter D' },
  { id: 'param-mh', name: 'Parameter mH' },
  { id: 'param-bh', name: 'Parameter bH' },
  { id: 'param-mw', name: 'Parameter mW' },
  { id: 'param-bw', name: 'Parameter bW' },
  { id: 'temperatur', name: 'Temperatur θ' },
];

// Rechnet bei jeder Eingabe neu; solange Werte fehlen, wird angezeigt welche.
function berechnen() {
  const werte = {};
  const fehlend = [];
  for (const feld of FELDER) {
    const input = document.getElementById(feld.id);
    const leer = input.value.trim() === '';
    input.classList.toggle('is-missing', leer);
    if (leer) fehlend.push(feld.name);
    werte[feld.id] = Number(input.value);
  }

  if (fehlend.length) {
    resultEl.className = 'message message--warn';
    const tipp = fehlend.some((name) => name.startsWith('Parameter')) ? ' Tipp: Ein SLP-Profil oben füllt die Parameter A bis bW aus.' : '';
    resultEl.textContent = `Für das Ergebnis fehlt noch: ${fehlend.join(', ')}.${tipp}`;
    return;
  }

  const h = calculateHValue(
    werte['param-a'], werte['param-b'], werte['param-c'], werte['param-d'],
    werte['param-mh'], werte['param-bh'], werte['param-mw'], werte['param-bw'],
    werte.temperatur,
  );

  resultEl.className = Number.isFinite(h) ? 'result-box' : 'message message--error';
  resultEl.innerHTML = Number.isFinite(h)
    ? `<div class="result-box__label">h-Wert</div><div class="result-box__value">${h.toFixed(4)} <span class="result-box__sub">kWh/Tag</span></div>`
    : 'h-Wert konnte nicht berechnet werden (ungültige Eingabe, z. B. θ = θ0 = 40 °C).';
}

form.addEventListener('input', berechnen);
form.addEventListener('submit', (event) => event.preventDefault());
berechnen();
