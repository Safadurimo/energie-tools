// BDEW-Sigmoidfunktion für Gas-Standardlastprofile (h-Wert)
// h(theta) = A / (1 + (B / (theta - theta0))^C) + D
const THETA_0 = 40; // °C, fester Referenzwert laut BDEW-Leitfaden

function calculateHValue(a, b, c, d, theta) {
  return a / (1 + Math.pow(b / (theta - THETA_0), c)) + d;
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
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const a = Number(document.getElementById('param-a').value);
  const b = Number(document.getElementById('param-b').value);
  const c = Number(document.getElementById('param-c').value);
  const d = Number(document.getElementById('param-d').value);
  const theta = Number(document.getElementById('temperatur').value);

  const h = calculateHValue(a, b, c, d, theta);

  resultEl.textContent = Number.isFinite(h)
    ? `h-Wert: ${h.toFixed(4)} kWh/Tag`
    : 'h-Wert konnte nicht berechnet werden (ungültige Eingabe, z. B. θ = θ0 = 40 °C).';
});
