// Search and visible application hints derived from Namura's application catalog.
// Not a VIN-level fitment guarantee. Supplier product titles/SKUs stay unchanged.
export const NAMURA_FITMENT = {
  "NA-80005K": {
    "models": "Can-Am Outlander 800 / Outlander Max 800 (2006–2015); Renegade 800 (2007–2015); Commander 800R (2011–2020); Defender HD8 (2016–2021); Maverick Trail 800R (2018–2021).",
    "spec": "Can-Am 800 twin-cylinder top-end kit; 90.958 mm standard bore."
  },
  "NA-80010K": {
    "models": "Can-Am Outlander 1000 / Renegade 1000; Commander 1000; Defender HD10 1000; Maverick Trail 1000; Maverick Sport 1000; Defender HD9 900. Verify production year and variant before ordering.",
    "spec": "Can-Am 900/1000 twin-cylinder top-end kit; 90.96 mm standard bore."
  },
  "NA-80010-6K": {
    "models": "Can-Am Outlander 1000 / Renegade 1000; Commander 1000; Defender HD10 1000; Maverick Trail 1000; Maverick Sport 1000; Defender HD9 900. Verify production year and variant before ordering.",
    "spec": "Can-Am 900/1000 twin-cylinder top-end kit; 92.46 mm, +1.50 mm oversize."
  },
  "NA-50019K": {
    "models": "Polaris Sportsman 570 (2014–2024); Ranger 570 (2014–2024); RZR 570 (2012–2023); ACE 570 (2015–2019).",
    "spec": "Polaris 570 top-end kit; 98.94 mm standard bore."
  },
  "NA-50019-2K": {
    "models": "Polaris Sportsman 570 (2014–2024); Ranger 570 (2014–2024); RZR 570 (2012–2023); ACE 570 (2015–2019).",
    "spec": "Polaris 570 top-end kit; 99.44 mm, +0.50 mm oversize."
  },
  "NA-50019-4K": {
    "models": "Polaris Sportsman 570 (2014–2024); Ranger 570 (2014–2024); RZR 570 (2012–2023); ACE 570 (2015–2019).",
    "spec": "Polaris 570 top-end kit; 99.94 mm, +1.00 mm oversize."
  },
  "NA-50019-6K": {
    "models": "Polaris Sportsman 570 (2014–2024); Ranger 570 (2014–2024); RZR 570 (2012–2023); ACE 570 (2015–2019).",
    "spec": "Polaris 570 top-end kit; 100.44 mm, +1.50 mm oversize."
  },
  "NA-50098-BK": {
    "models": "Polaris Ranger 500 (2017–2022).",
    "spec": "Polaris Ranger 500 top-end kit; manufacturer's application listing shows 92.96 mm, +0.01 mm."
  },
  "NA-50098-CK": {
    "models": "Polaris Ranger 500 (2017–2022).",
    "spec": "Polaris Ranger 500 top-end kit; manufacturer's application listing shows 92.97 mm, +0.02 mm."
  },
  "NA-50011K": {
    "models": "Polaris Sportsman 550 (2009–2014).",
    "spec": "Polaris Sportsman 550 top-end kit; 96.57 mm standard bore."
  },
  "NA-50011-2K": {
    "models": "Polaris Sportsman 550 (2009–2014).",
    "spec": "Polaris Sportsman 550 top-end kit; 97.07 mm, +0.50 mm oversize."
  },
  "NA-50011-4K": {
    "models": "Polaris Sportsman 550 (2009–2014).",
    "spec": "Polaris Sportsman 550 top-end kit; 97.57 mm, +1.00 mm oversize."
  },
  "NA-50011-6K": {
    "models": "Polaris Sportsman 550 (2009–2014).",
    "spec": "Polaris Sportsman 550 top-end kit; 98.07 mm, +1.50 mm oversize."
  },
  "NA-50080K": {
    "models": "Polaris Sportsman 800 EFI (2005–2010); Ranger 800 (2010); RZR 800 EFI / RZR 800 S EFI (2008–2010).",
    "spec": "Polaris 800 twin-cylinder top-end kit, standard bore. Not interchangeable with K1 versions."
  },
  "NA-50080K1": {
    "models": "Polaris Ranger 800 EFI (2011–2014); Ranger 800 6x6 (2011–2016); Ranger 800 Crew (2011–2014).",
    "spec": "Polaris Ranger 800 twin-cylinder top-end kit; standard bore, K1-specific gasket application."
  },
  "NA-50012-BK": {
    "models": "Polaris Sportsman 850; Scrambler 850. Confirm model year and cylinder size before ordering.",
    "spec": "Polaris 850 twin-cylinder top-end kit; +0.01 mm oversize."
  },
  "NA-50012-2K": {
    "models": "Polaris Sportsman 850; Scrambler 850. Confirm model year and cylinder size before ordering.",
    "spec": "Polaris 850 twin-cylinder top-end kit; 87.43 mm, +0.50 mm oversize."
  },
  "NA-50012-4K": {
    "models": "Polaris Sportsman 850; Scrambler 850. Confirm model year and cylinder size before ordering.",
    "spec": "Polaris 850 twin-cylinder top-end kit; 87.93 mm, +1.00 mm oversize."
  },
  "NA-50091K": {
    "models": "Polaris Ranger XP 900 (2014–2019); Ranger XP 1000 (2017–2025); General 1000 (2016–2025); RZR XP 1000 / RZR 1000 (various 2014–2023 applications). Check exact year and engine serial number.",
    "spec": "Polaris 900/1000 twin-cylinder top-end kit; 92.95 mm standard bore."
  },
  "NA-50093K": {
    "models": "Polaris Sportsman XP 1000; Scrambler XP 1000 (various 2014–2022 models). Verify fitment by year.",
    "spec": "Polaris Sportsman / Scrambler 1000 twin-cylinder top-end kit; 90.42 mm standard bore."
  },
  "CA-50000": {
    "models": "Polaris Sportsman 700 / Ranger 700. Year and cylinder variant must be confirmed before ordering.",
    "spec": "Namura 80 mm cylinder only, not a complete engine."
  }
};

export function namuraPartNumber(title='') {
  return String(title).toUpperCase().match(/\b(?:NA|CA)-[0-9]{5}(?:-[0-9A-Z]+|[A-Z][0-9]*)?\b/)?.[0] || '';
}
export function namuraFitment(title='') {
  const part=namuraPartNumber(title);
  return part&&NAMURA_FITMENT[part]?{part,...NAMURA_FITMENT[part]}:null;
}
