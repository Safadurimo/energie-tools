// SigLinDe-Koeffizienten (A, B, C, D, theta0=40°C fest, mH/bH/mW/bW) der BDEW/FfE-Standardlastprofile Gas,
// Anlage 6 "Leitfaden Abwicklung von Standardlastprofilen Gas" (Stand 27.03.2026).
// Ausprägung 34 = aktuelle Generation, 33 = vorherige Generation.
// mH/bH (Heizgas-Gerade) und mW/bW (Warmwasser-Gerade) sind bei HKO 0, da dieses Profil
// reinen Kochgasverbrauch ohne Heizanteil abbildet (nur Sigmoid-Teil).
const SLP_PROFILES = [
  { group: 'Haushalt', code: 'DE_HEF34', label: 'HEF34 – Haushalt < 50.000 kWh/a (aktuell)', a: 1.3819663, b: -37.4124155, c: 6.1723179, d: 0.0396284, mh: -0.0672159, bh: 1.1167138, mw: -0.0019982, bw: 0.1355070 },
  { group: 'Haushalt', code: 'DE_HEF33', label: 'HEF33 – Haushalt < 50.000 kWh/a (vorherige Generation)', a: 1.6209544, b: -37.1833141, c: 5.6727847, d: 0.0716431, mh: -0.0495700, bh: 0.8401015, mw: -0.0022090, bw: 0.1074468 },
  { group: 'Haushalt', code: 'DE_HMF34', label: 'HMF34 – Haushalt ≥ 50.000 kWh/a (aktuell)', a: 1.0443538, b: -35.0333754, c: 6.2240634, d: 0.0502917, mh: -0.0535830, bh: 0.9995901, mw: -0.0021758, bw: 0.1633299 },
  { group: 'Haushalt', code: 'DE_HMF33', label: 'HMF33 – Haushalt ≥ 50.000 kWh/a (vorherige Generation)', a: 1.2328655, b: -34.7213605, c: 5.8164304, d: 0.0873352, mh: -0.0409284, bh: 0.7672920, mw: -0.0022320, bw: 0.1199207 },
  { group: 'Haushalt', code: 'DE_HKO03', label: 'HKO03 – Kochgas', a: 0.4040932, b: -24.4392968, c: 6.5718175, d: 0.7107710, mh: 0, bh: 0, mw: 0, bw: 0 },

  { group: 'Gewerbe', code: 'DE_GKO34', label: 'GKO34 – Gebietskörperschaften, Kreditinst. u. Versich. (aktuell)', a: 1.4256684, b: -36.6590504, c: 7.6083226, d: 0.0371116, mh: -0.0809359, bh: 1.2364527, mw: -0.0007628, bw: 0.1002979 },
  { group: 'Gewerbe', code: 'DE_GKO33', label: 'GKO33 – Gebietskörperschaften, Kreditinst. u. Versich. (vorherige Generation)', a: 1.3554515, b: -35.1412563, c: 7.1303395, d: 0.0990619, mh: -0.0526487, bh: 0.8626086, mw: -0.0008808, bw: 0.0964014 },
  { group: 'Gewerbe', code: 'DE_GHA34', label: 'GHA34 – Einzelhandel, Großhandel (aktuell)', a: 1.8398455, b: -37.8282037, c: 8.1593369, d: 0.0259710, mh: -0.1069262, bh: 1.4552240, mw: -0.0004920, bw: 0.0691851 },
  { group: 'Gewerbe', code: 'DE_GHA33', label: 'GHA33 – Einzelhandel, Großhandel (vorherige Generation)', a: 1.9724775, b: -36.9650065, c: 7.2256947, d: 0.0345782, mh: -0.0742174, bh: 1.0448869, mw: -0.0008295, bw: 0.0461795 },
  { group: 'Gewerbe', code: 'DE_GMK34', label: 'GMK34 – Metall, Kfz (aktuell)', a: 1.3284913, b: -35.8715062, c: 7.5186829, d: 0.0175540, mh: -0.0758983, bh: 1.1942555, mw: -0.0008980, bw: 0.0603337 },
  { group: 'Gewerbe', code: 'DE_GMK33', label: 'GMK33 – Metall, Kfz (vorherige Generation)', a: 1.4202419, b: -34.8806130, c: 6.5951899, d: 0.0385317, mh: -0.0521084, bh: 0.8647919, mw: -0.0014369, bw: 0.0637602 },
  { group: 'Gewerbe', code: 'DE_GBD34', label: 'GBD34 – sonst. betriebl. Dienstleistungen (aktuell)', a: 1.5175792, b: -37.5000000, c: 6.8000000, d: 0.0295801, mh: -0.0788559, bh: 1.2161250, mw: -0.0013134, bw: 0.0968721 },
  { group: 'Gewerbe', code: 'DE_GBD33', label: 'GBD33 – sonst. betriebl. Dienstleistungen (vorherige Generation)', a: 1.4633682, b: -36.1794117, c: 5.9265162, d: 0.0808835, mh: -0.0475800, bh: 0.8230754, mw: -0.0019273, bw: 0.1077046 },
  { group: 'Gewerbe', code: 'DE_GGA34', label: 'GGA34 – Beherbergung (aktuell)', a: 1.1848320, b: -36.0000000, c: 7.7368518, d: 0.0793107, mh: -0.0687383, bh: 1.1308570, mw: -0.0006587, bw: 0.1910301 },
  { group: 'Gewerbe', code: 'DE_GGA33', label: 'GGA33 – Beherbergung (vorherige Generation)', a: 1.1582082, b: -36.2878584, c: 6.5885126, d: 0.2235680, mh: -0.0410335, bh: 0.7526451, mw: -0.0009088, bw: 0.1916641 },
  { group: 'Gewerbe', code: 'DE_GBH34', label: 'GBH34 – Gaststätten (aktuell)', a: 0.9872585, b: -35.2532124, c: 6.0587001, d: 0.0793512, mh: -0.0495013, bh: 0.9637999, mw: -0.0022304, bw: 0.2288398 },
  { group: 'Gewerbe', code: 'DE_GBH33', label: 'GBH33 – Gaststätten (vorherige Generation)', a: 0.9874283, b: -35.2532124, c: 6.1544406, d: 0.2265716, mh: -0.0339020, bh: 0.6938234, mw: -0.0012849, bw: 0.2029732 },
  { group: 'Gewerbe', code: 'DE_GBA34', label: 'GBA34 – Bäckereien (aktuell)', a: 0.3537640, b: -33.3500000, c: 5.7212303, d: 0.3033305, mh: -0.0177463, bh: 0.6825699, mw: -0.0013912, bw: 0.5434624 },
  { group: 'Gewerbe', code: 'DE_GBA33', label: 'GBA33 – Bäckereien (vorherige Generation)', a: 0.2770087, b: -33.0000000, c: 5.7212303, d: 0.4865118, mh: -0.0094849, bh: 0.4630237, mw: -0.0007134, bw: 0.3867447 },
  { group: 'Gewerbe', code: 'DE_GWA34', label: 'GWA34 – Wäschereien (aktuell)', a: 0.3925339, b: -35.3000000, c: 4.8662747, d: 0.3045099, mh: -0.0167993, bh: 0.6710889, mw: -0.0020301, bw: 0.5614623 },
  { group: 'Gewerbe', code: 'DE_GWA33', label: 'GWA33 – Wäschereien (vorherige Generation)', a: 0.3337838, b: -36.0237912, c: 4.8662747, d: 0.4912280, mh: -0.0092263, bh: 0.4595757, mw: -0.0009676, bw: 0.3964291 },
  { group: 'Gewerbe', code: 'DE_GGB34', label: 'GGB34 – Gartenbau (aktuell)', a: 1.6266812, b: -37.8825368, c: 6.9836070, d: 0.0297136, mh: -0.0854333, bh: 1.2709629, mw: -0.0011319, bw: 0.0928124 },
  { group: 'Gewerbe', code: 'DE_GGB33', label: 'GGB33 – Gartenbau (vorherige Generation)', a: 1.8213778, b: -37.5000000, c: 6.3462148, d: 0.0678118, mh: -0.0607666, bh: 0.9308159, mw: -0.0013967, bw: 0.0850399 },
  { group: 'Gewerbe', code: 'DE_GPD34', label: 'GPD34 – Papier und Druck (aktuell)', a: 1.8834609, b: -37.0000000, c: 10.2405021, d: 0.0275470, mh: -0.1253100, bh: 1.6275999, mw: -0.0001105, bw: 0.0635119 },
  { group: 'Gewerbe', code: 'DE_GPD33', label: 'GPD33 – Papier und Druck (vorherige Generation)', a: 1.7110739, b: -35.8000000, c: 8.4000000, d: 0.0702546, mh: -0.0745381, bh: 1.0463005, mw: -0.0003672, bw: 0.0621882 },
  { group: 'Gewerbe', code: 'DE_GMF34', label: 'GMF34 – haushaltsähnliche Gewerbebetriebe (aktuell)', a: 1.0443538, b: -35.0333754, c: 6.2240634, d: 0.0502917, mh: -0.0535830, bh: 0.9995901, mw: -0.0021758, bw: 0.1633299 },
  { group: 'Gewerbe', code: 'DE_GMF33', label: 'GMF33 – haushaltsähnliche Gewerbebetriebe (vorherige Generation)', a: 1.2328655, b: -34.7213605, c: 5.8164304, d: 0.0873352, mh: -0.0409284, bh: 0.7672920, mw: -0.0022320, bw: 0.1199207 },
  { group: 'Gewerbe', code: 'DE_GHD34', label: 'GHD34 – Summenlastprofil Gewerbe/Handel/Dienstl. (aktuell)', a: 1.2569600, b: -36.6078453, c: 7.3211870, d: 0.0776960, mh: -0.0696826, bh: 1.1379702, mw: -0.0008522, bw: 0.1921068 },
  { group: 'Gewerbe', code: 'DE_GHD33', label: 'GHD33 – Summenlastprofil Gewerbe/Handel/Dienstl. (vorherige Generation)', a: 1.3010623, b: -35.6816144, c: 6.6857976, d: 0.1409267, mh: -0.0473428, bh: 0.8141691, mw: -0.0010601, bw: 0.1325092 },
];
