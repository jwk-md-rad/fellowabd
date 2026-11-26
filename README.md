# Tijdsbesteding fellow abdomen

Hoe de tijd van de abdomenfellow (0,8-aanstelling, start november 2025) verdeeld is over
abdomenwerk (verslag, MDO, spoed), wetenschap, diensten en afwezigheid, op basis van het
Medspace-rooster. November 2025 – oktober 2026 gerealiseerd, november–december 2026 planning.

Online via GitHub Pages: https://jwk-md-rad.github.io/fellowabd/

## Wachtwoord

De inhoud van de pagina en de data staan **versleuteld** in deze repo (AES-256-GCM, sleutel
afgeleid van het wachtwoord met PBKDF2-SHA256, 600.000 rondes). Zonder wachtwoord zijn de
cijfers, teksten en de CSV niet leesbaar, ook niet in de broncode op GitHub. Na het inloggen
ontsleutelt de browser alles lokaal.

- Het wachtwoord geldt per tabblad; met *Onthouden op dit apparaat* blijft het bewaard.
  *Uitloggen* (bovenaan) wist het weer.
- Ziek staat om privacyredenen samen met verlof; ziekte is niet apart te zien.
- Dit is een kopie van de pagina *Tijdsbesteding fellow* uit
  [AbdAUMC](https://github.com/jwk-md-rad/AbdAUMC), met hetzelfde wachtwoord.

## Structuur

| Pad | Inhoud |
| --- | --- |
| `index.html` | Wachtwoordscherm; de inhoud staat versleuteld in `data/` |
| `data/index.enc.js` | Versleutelde pagina-inhoud en data |
| `src.enc` | Versleutelde kopie van de leesbare bronnen (`src/`) |
| `assets/gate.js` | Ontsleutelt na het inloggen |
| `assets/dash.js` | Kleine data-laag die de CSV inleest en de grafieken tekent |
| `assets/theme.css` | Kleuren en opmaak (licht en donker) |
| `assets/d3.v7.9.0.min.js` | d3 v7.9.0 (ISC-licentie), voor de grafieken |
| `tools/build.mjs` | Bouwt en versleutelt de site (Node 18+, geen extra pakketten) |

## Bijwerken

De leesbare bronnen staan in `src/`, dat **niet** in git staat (zie `.gitignore`).

```sh
# 1. Bronnen terugzetten uit src.enc (vraagt om het wachtwoord)
node tools/build.mjs --unpack

# 2. Pas src/index.html of src/fellow-tijdsbesteding.csv aan

# 3. Opnieuw versleutelen en bouwen (vraagt om het wachtwoord)
node tools/build.mjs

# 4. Committen en pushen (src/ blijft buiten git)
```

Lokaal bekijken: start een webserver in de repo (bijv. `python3 -m http.server`) en open
http://localhost:8000.
