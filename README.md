# 🔬 Rezonanța Mecanică — Consecințe și Avantaje

> Proiect interactiv de fizică cu simulări în timp real

**Autor:** Buruiana Bogdan-Ioan

## 📋 Descriere

Aplicație web educațională interactivă care prezintă fenomenul de **rezonanță mecanică** prin 15 slide-uri, fiecare conținând:

- **Partea stângă:** Teorie fizică detaliată cu formule matematice (LaTeX/KaTeX)
- **Partea dreaptă:** Simulare interactivă pe HTML5 Canvas

## 🎯 Tematici Acoperite

| # | Slide | Categorie |
|---|-------|-----------|
| 1 | Oscilații Forțate și Rezonanță | Fundamente |
| 2 | Curba de Răspuns și Defazajul | Fundamente |
| 3 | Factorul de Calitate Q | Fundamente |
| 4 | Podul Tacoma Narrows (1940) | Consecință / Pericol |
| 5 | Pasarela Millennium, Londra | Consecință / Pericol |
| 6 | Seisme și Clădiri | Consecință / Pericol |
| 7 | Vibrații în Mașini Rotative | Consecință / Pericol |
| 8 | Rezonanța la Sol a Elicopterelor | Consecință / Pericol |
| 9 | Amortizorul Acordat de Masă (TMD) | Inginerie / Soluție |
| 10 | Instrumente Muzicale | Avantaj |
| 11 | Oscilatori cu Cuarț | Avantaj |
| 12 | Ultrasunete și Litotripsie | Avantaj |
| 13 | Senzori MEMS și AFM | Avantaj |
| 14 | Energy Harvesting | Avantaj |
| 15 | Concluzii și Simulator Universal | Sinteză |

## 🚀 Utilizare

### Vizualizare directă
Deschide `index.html` în orice browser modern (Chrome, Firefox, Edge, Safari).

### GitHub Pages
Proiectul este gata pentru deploy pe GitHub Pages — toate căile sunt relative.

## ⌨️ Comenzi rapide

| Tastă | Acțiune |
|-------|---------|
| `→` / `Space` | Slide următor |
| `←` | Slide anterior |
| `Home` | Primul slide |
| `End` | Ultimul slide |
| `Esc` | Închide setările |

## 🛠️ Tehnologii

- **HTML5 Canvas** — Simulări fizice în timp real la 60 FPS
- **KaTeX** — Randare LaTeX pentru formule matematice
- **Vanilla JavaScript** — Zero dependențe de build
- **CSS Custom Properties** — Sistem de design scalabil
- **Hi-DPI Support** — Scalare automată pentru ecrane Retina/4K

## 📐 Fizica din Slide 1

Simularea rezolvă numeric ecuația oscilatorului forțat amortizat:

$$m\ddot{x} + b\dot{x} + kx = F_0 \cos(\omega t)$$

Cu integrare **Runge-Kutta 4** pentru stabilitate maximă.
