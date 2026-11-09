/* ============================================================
   SLIDES-DATA.JS — Content Definitions for All 15 Slides
   Slide 1: Complete theory + equations
   Slides 2-15: Structured placeholders with topic outlines
   ============================================================ */

(function () {
  'use strict';

  /**
   * Category types: 'fundamente', 'pericol', 'inginerie', 'avantaj', 'sinteza'
   * simType: 'forced-oscillation' (Slide 1), 'placeholder' (Slides 2-15)
   */
  const SlidesData = [

    // ===================== SLIDE 1 =====================
    {
      id: 1,
      title: 'Introducere: Oscilații Forțate și Rezonanță',
      category: 'fundamente',
      simType: 'forced-oscillation',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Conceptul Fizic de Oscilație Forțată</h3>
          <p>Un oscilator mecanic real pierde energie prin frecare. Pentru a menține oscilațiile,
          asupra sistemului (masă \\(m\\), arc \\(k\\), amortizor \\(b\\)) trebuie aplicată o
          <em>forță exterioară periodică</em> de pulsație \\(\\omega\\):</p>
          <div class="equation-card">
            <div class="equation-card__label">Ecuația Diferențială de Mișcare</div>
            $$m \\frac{d^2 x}{dt^2} + b \\frac{dx}{dt} + k x = F_0 \\cos(\\omega t)$$
          </div>
          <p>Împărțind la masa \\(m\\), obținem forma canonică utilizată în fizică și inginerie:</p>
          <div class="equation-card">
            <div class="equation-card__label">Forma Canonică</div>
            $$\\ddot{x} + 2\\gamma \\dot{x} + \\omega_0^2 x = f_0 \\cos(\\omega t)$$
          </div>
          <p>unde:
            <br>• \\(\\omega_0 = \\sqrt{k/m}\\) — <strong>pulsația proprie</strong> a oscilatorului liber
            <br>• \\(\\gamma = b/(2m)\\) — <strong>factorul de amortizare</strong>
            <br>• \\(f_0 = F_0 / m\\) — accelerația imprimată de forța perturbatoare
          </p>
        </div>

        <div class="theory-section">
          <h3>2. Soluția Staționară și Amplitudinea</h3>
          <p>După stingerea regimului tranzitoriu inițial, mișcarea devine strict armonică,
          cu pulsația forței excitante \\(\\omega\\), dar cu o întârziere (defazaj \\(\\delta\\)):</p>
          <div class="equation-card">
            <div class="equation-card__label">Mișcarea Staționară</div>
            $$x(t) = A(\\omega) \\cos(\\omega t - \\delta)$$
          </div>
          <p>Amplitudinea oscilațiilor depinde critic de apropierea dintre \\(\\omega\\) și \\(\\omega_0\\):</p>
          <div class="equation-card">
            <div class="equation-card__label">Amplitudinea de Răspuns</div>
            $$A(\\omega) = \\frac{F_0 / m}{\\sqrt{(\\omega_0^2 - \\omega^2)^2 + (2\\gamma\\omega)^2}}$$
          </div>
        </div>

        <div class="theory-section">
          <h3>3. Defazajul Forță-Mișcare (\\(\\delta\\))</h3>
          <p>Unghiul de defazaj indică întârzierea deplasării masei față de forța perturbatoare:</p>
          <div class="equation-card">
            <div class="equation-card__label">Legea Defazajului</div>
            $$\\tan\\delta = \\frac{2\\gamma\\omega}{\\omega_0^2 - \\omega^2} = \\frac{b\\omega}{k - m\\omega^2}$$
          </div>
          <ul class="theory-points">
            <li><strong>Regim Sub-rezonant (\\(\\omega \\ll \\omega_0\\)):</strong> \\(\\delta \\to 0^\\circ\\). Masa se mișcă sincron cu forța (forța elastică domină).</li>
            <li><strong>REZONANȚĂ EXACTĂ (\\(\\omega = \\omega_0\\)):</strong> \\(\\delta = 90^\\circ\\) (\\(\\pi/2\\text{ rad}\\)). Forța este în fază cu viteza \\(\\dot{x}(t)\\) \\(\\Rightarrow\\) <em>puterea transmisă sistemului este maximă</em>!</li>
            <li><strong>Regim Supra-rezonant (\\(\\omega \\gg \\omega_0\\)):</strong> \\(\\delta \\to 180^\\circ\\) (\\(\\pi\\text{ rad}\\)). Masa se mișcă în opoziție cu forța (inerția domină).</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>4. Factorul de Calitate (\\(Q\\)) și Amplificarea</h3>
          <p>Factorul de calitate \\(Q\\) descrie acuitatea rezonanței și capacitatea de stocare a energiei:</p>
          <div class="equation-card">
            <div class="equation-card__label">Factorul de Calitate Q</div>
            $$Q = \\frac{\\omega_0}{2\\gamma} = \\frac{\\sqrt{k m}}{b}$$
          </div>
          <p>La rezonanță, amplitudinea atinge un vârf uriaș, egal cu deformarea statică multiplicată cu \\(Q\\):</p>
          <div class="equation-card">
            <div class="equation-card__label">Amplificarea la Rezonanță</div>
            $$A_{max} \\approx Q \\cdot x_{static} = Q \\cdot \\frac{F_0}{k}$$
          </div>
        </div>

        <div class="theory-callout">
          <strong>Regulă de Aur a Ingineriei:</strong> Dacă un sistem are un factor de calitate ridicat (de exemplu \\(Q = 50\\)),
          o forță perturbatoare minusculă poate produce deformări de <strong>50 de ori mai mari</strong> decât în regim static,
          provocând ruperea structurii sau prăbușirea clădirilor!
        </div>
      `,
      simConfig: {
        mass: 1.0,
        springK: 16.0,
        damping: 0.35,
        driveAmplitude: 0.40,
        driveOmega: 4.0,
        dt: 0.016
      }
    },

    // ===================== SLIDE 2 =====================
    {
      id: 2,
      title: 'Fizica Matematică: Curba de Răspuns și Defazajul',
      category: 'fundamente',
      simType: 'phase-response',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Reprezentarea Fazorială (Diagrama Fresnel)</h3>
          <p>Pentru a rezolva elegant ecuația oscilatorului forțat \\(m\\ddot{x} + b\\dot{x} + kx = F_0\\cos(\\omega t)\\),
          asociem mărimilor armonice <strong>vectori rotativi (fazori)</strong> în planul complex:
          deplasarea \\(\\underline{x} = A e^{i(\\omega t - \\delta)}\\), viteza \\(\\underline{v} = i\\omega \\underline{x}\\)
          (avansată cu \\(90^\\circ\\) față de \\(x\\)) și accelerația \\(\\underline{a} = -\\omega^2 \\underline{x}\\)
          (în opoziție de fază cu \\(x\\)).</p>
          <div class="equation-card">
            <div class="equation-card__label">Echilibrul Fazorial al Forțelor</div>
            $$\\underbrace{(k - m\\omega^2)A}_{\\text{Componentă Reactivă}} + \\; i \\underbrace{(b\\omega A)}_{\\text{Componentă Disipativă}} = F_0 e^{i\\delta}$$
          </div>
          <p>Cele trei forțe interne — elastică (\\(kA\\)), inerțială (\\(m\\omega^2 A\\)) și de amortizare (\\(b\\omega A\\), perpendiculară pe deplasare) — formează un <strong>triunghi dreptunghic</strong> a cărui ipotenuză este chiar forța motoare \\(F_0\\)!</p>
        </div>

        <div class="theory-section">
          <h3>2. Rezonanța de Amplitudine vs Rezonanța de Viteză</h3>
          <p>Derivând expresia amplitudinii \\(A(\\omega)\\) în raport cu \\(\\omega\\) și anulând derivata, obținem pulsația la care amplitudinea este strict maximă:</p>
          <div class="equation-card">
            <div class="equation-card__label">Pulsația de Rezonanță în Amplitudine</div>
            $$\\omega_r = \\sqrt{\\omega_0^2 - 2\\gamma^2} = \\omega_0 \\sqrt{1 - 2\\zeta^2}$$
          </div>
          <p>Observăm că \\(\\omega_r < \\omega_0\\), iar dacă amortizarea este prea mare (\\(\\gamma > \\omega_0 / \\sqrt{2}\\)), vârful de rezonanță în amplitudine dispare complet! În schimb, <strong>viteza de oscilație</strong> \\(v_{max}(\\omega) = \\omega A(\\omega)\\) are întotdeauna maximul exact la \\(\\omega_v = \\omega_0\\), indiferent de amortizare.</p>
        </div>

        <div class="theory-section">
          <h3>3. Cele 3 Regimuri ale Defazajului \\(\\delta(\\omega)\\)</h3>
          <div class="equation-card">
            <div class="equation-card__label">Ecuația Unghiului de Defazaj</div>
            $$\\tan\\delta = \\frac{2\\gamma\\omega}{\\omega_0^2 - \\omega^2}, \\quad \\delta \\in [0, \\pi]$$
          </div>
          <ul class="theory-points">
            <li><strong>1. Regimul Cvasistatic / Controlat de Elasticitate (\\(\\omega \\ll \\omega_0\\)):</strong>
              \\(\\delta \\approx 0^\\circ\\). Termenul \\(kA\\) domină; masa urmărește fidel și sincron forța aplicată: \\(x(t) \\approx \\frac{F_0}{k}\\cos(\\omega t)\\).</li>
            <li><strong>2. Regimul Rezonant / Controlat de Amortizare (\\(\\omega = \\omega_0\\)):</strong>
              \\(\\delta = 90^\\circ\\) (\\(\\pi/2\\text{ rad}\\)). Forța inerțială \\(m\\omega_0^2 A\\) anulează exact forța elastică \\(kA\\)! Întreaga forță motoare \\(F_0\\) echilibrează doar frecarea \\(b\\omega_0 A\\), iar <em>vectorul viteză \\(\\vec{v}\\) este perfect aliniat cu forța \\(\\vec{F}_0\\)</em>.</li>
            <li><strong>3. Regimul Inerțial / Controlat de Masă (\\(\\omega \\gg \\omega_0\\)):</strong>
              \\(\\delta \\to 180^\\circ\\) (\\(\\pi\\text{ rad}\\)). Forța variază atât de rapid încât masa nu mai poate ține pasul și oscilează în antifază cu amplitudine mică: \\(x(t) \\approx -\\frac{F_0}{m\\omega^2}\\cos(\\omega t)\\).</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>4. Puterea Absorbită și Impedanța Mecanică</h3>
          <p>Puterea instantanee \\(P(t) = F(t) \\cdot v(t)\\) arată de ce defazajul de \\(90^\\circ\\) este critic. Cum \\(v(t) = -\\omega A \\sin(\\omega t - \\delta)\\), puterea medie absorbită pe o perioadă este:</p>
          <div class="equation-card">
            <div class="equation-card__label">Puterea Medie Transferată</div>
            $$\\langle P(\\omega) \\rangle = \\frac{1}{2} F_0 \\omega A(\\omega) \\sin\\delta = \\frac{F_0^2 \\gamma \\omega^2}{m\\left[(\\omega_0^2 - \\omega^2)^2 + 4\\gamma^2\\omega^2\\right]}$$
          </div>
          <p>La \\(\\delta = 90^\\circ\\) (\\(\\sin\\delta = 1\\)), \\(F(t)\\) și \\(v(t)\\) au <strong>același semn în fiecare clipă</strong>: sursa doar pompează energie în sistem fără ca oscilatorul să returneze energie sursei!</p>
        </div>

        <div class="theory-callout">
          <strong>Observă în simulare:</strong> Urmărește graficul puterii instantanee \\(P(t) = F(t)v(t)\\).
          În afara rezonanței, \\(P(t)\\) alternează între valori pozitive și negative (putere reactivă).
          Exact la rezonanță (\\(\\delta = 90^\\circ\\)), curba \\(P(t)\\) este <strong>100% pozitivă</strong>!
        </div>
      `,
      simConfig: {
        omega0: 4.0,
        gamma: 0.35,
        F0: 2.0,
        omega: 4.0
      }
    },

    // ===================== SLIDE 3 =====================
    {
      id: 3,
      title: 'Factorul de Calitate Q și Amortizarea',
      category: 'fundamente',
      simType: 'quality-factor',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Definiția Fizică și Energetică a lui \\(Q\\)</h3>
          <p><strong>Factorul de calitate \\(Q\\)</strong> (Quality Factor) este parametrul adimensional fundamental
          care măsoară cât de „pur" sau „selectiv" este un rezonator mecanic, raportând energia maximă stocată
          în oscilator la energia pierdută prin disipare termică într-un singur ciclu:</p>
          <div class="equation-card">
            <div class="equation-card__label">Definiția Energetică și Parametrică</div>
            $$Q = 2\\pi \\frac{E_{\\text{stocată}}}{\\Delta E_{\\text{disipată / ciclu}}} = \\frac{\\omega_0}{2\\gamma} = \\frac{\\sqrt{k m}}{b} = \\frac{1}{2\\zeta}$$
          </div>
          <p>Unde \\(\\zeta = \\frac{\\gamma}{\\omega_0} = \\frac{b}{2\\sqrt{km}}\\) este <em>gradul de amortizare critică</em> (damping ratio).</p>
        </div>

        <div class="theory-section">
          <h3>2. Lățimea Benzii de Rezonanță (\\(\\Delta\\omega\\) la \\(-3\\text{ dB}\\))</h3>
          <p>Lățimea vârfului de rezonanță se măsoară între pulsațiile \\(\\omega_1\\) și \\(\\omega_2\\) la care
          puterea absorbită scade la jumătate din puterea maximă (\\(P = P_{max}/2\\)), ceea ce corespunde
          unei amplitudini egale cu \\(A_{max} / \\sqrt{2} \\approx 0{,}707 \\cdot A_{max}\\) (nivelul \\(-3\\text{ dB}\\)):</p>
          <div class="equation-card">
            <div class="equation-card__label">Relația Bandă de Trecere — Factor Q</div>
            $$\\Delta\\omega = \\omega_2 - \\omega_1 = 2\\gamma = \\frac{b}{m} \\quad \\Longrightarrow \\quad Q = \\frac{\\omega_0}{\\Delta\\omega}$$
          </div>
          <p>Cu cât amortizarea \\(\\gamma\\) este mai mică, cu atât banda \\(\\Delta\\omega\\) este mai îngustă, iar rezonatorul este mai <strong>selectiv în frecvență</strong>.</p>
        </div>

        <div class="theory-section">
          <h3>3. Regimurile de Amortizare</h3>
          <ul class="theory-points">
            <li><strong>Rezonator de Înaltă Calitate (\\(Q \\gg 1\\), \\(\\zeta \\ll 0{,}5\\)):</strong>
              Curbă de rezonanță extrem de ascuțită. Sistemul amplifică de \\(Q\\) ori deplasarea statică, dar răspunde doar într-o fereastră îngustă de frecvențe (ex: cristal de cuarț \\(Q \\sim 10^5\\), diapazon din oțel \\(Q \\sim 10^3\\)).</li>
            <li><strong>Subamortizare Moderată (\\(0{,}5 < Q < 5\\)):</strong>
              Vârf de rezonanță vizibil, dar larg. Specific structurilor de beton/oțel (\\(Q \\approx 10 - 25\\)) sau componentelor auto.</li>
            <li><strong>Amortizare Critică și Supraamortizare (\\(Q \\le 0{,}5\\), \\(\\zeta \\ge 1\\)):</strong>
              Fără amplificare rezonantă (\\(A(\\omega) \\le A(0)\\) pentru orice \\(\\omega\\)). Energia este disipată instantaneu fără oscilații parazite.</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>4. Compromisul Ingineresc: Selectivitate vs Stabilitate</h3>
          <p>În practică, inginerii proiectează factorul \\(Q\\) în funcție de scop:</p>
          <ul class="theory-points">
            <li><strong>Când dorim \\(Q\\) MAXIM:</strong> Ceasuri atomice și cu cuarț, filtre RF, senzori MEMS, instrumente muzicale (sunet clar și prelung).</li>
            <li><strong>Când dorim \\(Q\\) MINIM:</strong> Amortizoare auto, fundații antiseismice, amortizoare TMD pe zgârie-nori (prevenirea acumulării distructive de energie).</li>
          </ul>
        </div>

        <div class="theory-callout">
          <strong>Experiment în Simulare:</strong> Apasă pe butonul <em>„🌊 Baleiaj Frecvență (Auto-Sweep)"</em> pentru a mătura automat frecvența de la mică la mare și compară cum reacționează simultan cele 3 oscilatoare cu factori \\(Q\\) diferiți!
        </div>
      `,
      simConfig: {
        omega0: 4.0,
        omega: 4.0,
        qHigh: 12.0,
        qMed: 3.5,
        qLow: 0.7
      }
    },

    // ===================== SLIDE 4 =====================
    {
      id: 4,
      title: 'Podul Tacoma Narrows (1940)',
      category: 'pericol',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🌉</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Cazul emblematic al rezonanței distructive: prăbușirea podului Tacoma Narrows.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Rezonanța aeroelastică și desprinderea vârtejurilor Kármán</li>
            <li>Frecvența vântului coincisă cu modul de torsiune</li>
            <li>Tranziția de la oscilație verticală la mod torsional divergent</li>
            <li>Lecții de inginerie extrase din acest dezastru</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🌉', placeholderTitle: 'Simulator Torsiune Pod', placeholderDesc: 'Flux de vânt reglabil cu demonstrarea tranziției distructive de la oscilație stabilă la colaps torsional.' }
    },

    // ===================== SLIDE 5 =====================
    {
      id: 5,
      title: 'Pasarela Millennium, Londra (2000)',
      category: 'pericol',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🚶</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Sincronizarea laterală pietonală și rezonanța feedback-ului pozitiv.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Synchronous Lateral Excitation (SLE)</li>
            <li>Pasul pietonilor (~1 Hz) vs frecvența proprie laterală</li>
            <li>Feedback pozitiv: pietoni adaptează mersul la balansul podului</li>
            <li>Soluția inginerească: amortizoare vâscoase adăugate</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🚶', placeholderTitle: 'Simulator Pietoni pe Pod Suspendat', placeholderDesc: 'Număr reglabil de pietoni care își sincronizează pasul, generând creșterea exponențială a oscilației laterale.' }
    },

    // ===================== SLIDE 6 =====================
    {
      id: 6,
      title: 'Seisme și Clădiri de Înălțimi Diferite',
      category: 'pericol',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🏢</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            De ce cutremurele afectează selectiv clădirile în funcție de înălțime.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Undele seismice ca forță excitatoare cu spectru de frecvențe</li>
            <li>Relația \\(T \\approx 0.1 \\times N\\) (perioada proprie vs nr. etaje)</li>
            <li>Fenomenul selectiv: clădirile medii rezonează, celelalte nu</li>
            <li>Proiectare anti-seismică și izolare la bază</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🏢', placeholderTitle: 'Simulator Cutremur cu 3 Clădiri', placeholderDesc: 'Trei clădiri cu înălțimi diferite pe platformă seismică vibratoare. Frecvența variabilă arată rezonanța selectivă.' }
    },

    // ===================== SLIDE 7 =====================
    {
      id: 7,
      title: 'Vibrații în Arbori și Mașini Rotative',
      category: 'pericol',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">⚙️</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Viteze critice de rotație și rezonanța arborilor dezechilibrați.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Rotorul Laval / Jeffcott și dezechilibrul de masă</li>
            <li>Viteze critice de rotație: \\(n_{cr} = \\frac{30}{\\pi}\\omega_0\\) RPM</li>
            <li>Forțele centrifuge de rezonanță și oboseala materialelor</li>
            <li>Echilibrarea dinamică ca soluție industrială</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '⚙️', placeholderTitle: 'Rotor Rotativ cu Masă Excentrică', placeholderDesc: 'Creșterea turației RPM cu vizualizarea amplitudinii vibrației la trecerea prin viteza critică.' }
    },

    // ===================== SLIDE 8 =====================
    {
      id: 8,
      title: 'Rezonanța la Sol a Elicopterelor',
      category: 'pericol',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🚁</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Cuplajul dinamic dintre rotorul elicopterului și trenul de aterizare.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Ground Resonance: mișcarea avans/întârziere a palelor</li>
            <li>Cuplajul cu amortizoarele trenului de aterizare</li>
            <li>Dezechilibrarea palelor generând oscilație violentă a fuselajului</li>
            <li>Soluții: amortizoare în articulațiile palelor, decuplare frecvențe</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🚁', placeholderTitle: 'Simulator Ground Resonance', placeholderDesc: 'Pale articulate ale rotorului pe tren elastic. Vizualizarea oscilației violente la dezechilibrare.' }
    },

    // ===================== SLIDE 9 =====================
    {
      id: 9,
      title: 'Amortizorul Acordat de Masă (TMD)',
      category: 'inginerie',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🏗️</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Tuned Mass Damper: soluția inginerească anti-rezonanță.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Principiul TMD: masă secundară acordată pe \\(\\omega_0\\) a structurii</li>
            <li>Exemplul Taipei 101: pendul de 660 tone</li>
            <li>Modelul matematic cu 2 grade de libertate</li>
            <li>Compararea structurii cu/fără TMD activat</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🏗️', placeholderTitle: 'Simulator TMD (Taipei 101)', placeholderDesc: 'Clădire supusă vântului/cutremurului cu buton de activare/dezactivare pendul TMD. Comparare directă a amplitudinii.' }
    },

    // ===================== SLIDE 10 =====================
    {
      id: 10,
      title: 'Instrumente Muzicale și Rezonatoare Acustice',
      category: 'avantaj',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🎵</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Rezonanța ca amplificator natural al sunetului în instrumente muzicale.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Cutii de rezonanță: vioară, chitară, pian</li>
            <li>Tuburi acustice: flaut, orgă, clarinete</li>
            <li>Unde staționare, moduri proprii, noduri și ventre</li>
            <li>Rezonanța Helmholtz și aplicații în boxe audio</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🎵', placeholderTitle: 'Simulator Tub Acustic & Corp Rezonanță', placeholderDesc: 'Generare de armonici fundamentale și superioare cu vizualizarea undelor staționare sonore.' }
    },

    // ===================== SLIDE 11 =====================
    {
      id: 11,
      title: 'Cronometrie: Oscilatori cu Cuarț',
      category: 'avantaj',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">⌚</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Efectul piezoelectric și stabilitatea incredibilă a cristalului de cuarț.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Efectul piezoelectric direct și invers</li>
            <li>Frecvența de rezonanță: \\(32{,}768\\text{ kHz} = 2^{15}\\text{ Hz}\\)</li>
            <li>Divizare binară pentru obținerea pulsului de 1 secundă</li>
            <li>Factorul Q extrem de ridicat al cuarțului (\\(Q > 10^4\\))</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '⌚', placeholderTitle: 'Simulator Oscilator Piezoelectric', placeholderDesc: 'Cristal de cuarț în formă de diapazon supus tensiunii electrice alternative, filtrare la 32.768 kHz.' }
    },

    // ===================== SLIDE 12 =====================
    {
      id: 12,
      title: 'Ultrasunete și Litotripsie',
      category: 'avantaj',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🏥</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Rezonanța transductoarelor piezoelectrice: de la curățare la chirurgie.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Cavitația ultrasonică: formarea și implozia micro-bulelor</li>
            <li>Litotripsie: distrugerea calculilor renali neinvaziv</li>
            <li>Bisturiul ultrasonic în chirurgie</li>
            <li>Curățarea ultrasonică industrială</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🏥', placeholderTitle: 'Simulator Cavitație și Litotripsie', placeholderDesc: 'Undă ultrasonică focalizată pe o țintă cu vizualizarea imploziei micro-bulelor de cavitație.' }
    },

    // ===================== SLIDE 13 =====================
    {
      id: 13,
      title: 'Senzori MEMS și Microscopul AFM',
      category: 'avantaj',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🔍</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Micro-giroscoape rezonante și microscopia de forță atomică.
          </div>
          <ul class="theory-placeholder__topics">
            <li>MEMS: Micro-Electro-Mechanical Systems din smartphone-uri</li>
            <li>Giroscoape capacitive rezonante: detectarea rotației</li>
            <li>AFM Tapping Mode: cantilever rezonant cu ac nanometric</li>
            <li>Detectarea modificării frecvenței la proximitatea atomilor</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🔍', placeholderTitle: 'Simulator Microscop AFM', placeholderDesc: 'Cantilever rezonant baleiind o suprafață atomică, detectând variația frecvenței la apropierea de atomi.' }
    },

    // ===================== SLIDE 14 =====================
    {
      id: 14,
      title: 'Recoltarea de Energie (Energy Harvesting)',
      category: 'avantaj',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">⚡</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Conversia vibrațiilor mecanice ambientale în energie electrică utilă.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Surse de vibrații: poduri, motoare, căi ferate, corpul uman</li>
            <li>Micro-grinzi piezoelectrice acordate pe frecvența sursei</li>
            <li>Modelul oscilator rezonant → convertor de energie</li>
            <li>Aplicații: senzori wireless autonomi, IoT, implante medicale</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '⚡', placeholderTitle: 'Simulator Energy Harvester', placeholderDesc: 'Grilă piezoelectrică acordabilă pe frecvența vibrației externe, cu afișarea energiei generate și stocate.' }
    },

    // ===================== SLIDE 15 =====================
    {
      id: 15,
      title: 'Concluzii: Matrice Comparativă și Simulator Universal',
      category: 'sinteza',
      simType: 'placeholder',
      theoryHTML: `
        <div class="theory-placeholder">
          <div class="theory-placeholder__icon">🎯</div>
          <div class="theory-placeholder__text">
            <strong>Slide în pregătire</strong><br>
            Sinteză finală: avantaje vs dezavantaje, criterii de proiectare.
          </div>
          <ul class="theory-placeholder__topics">
            <li>Matrice comparativă: consecințe distructive vs aplicații utile</li>
            <li>Criterii inginerești: când evităm vs amplificăm rezonanța</li>
            <li>Sandbox complet: configurare liberă masă-arc-amortizor-forță</li>
            <li>Generare automată de raport de rezonanță</li>
          </ul>
        </div>
      `,
      simConfig: { placeholderIcon: '🎯', placeholderTitle: 'Banc de Testare Universal', placeholderDesc: 'Sandbox complet: configurare masă-arc-amortizor-forță cu generare automată de raport de rezonanță.' }
    }
  ];

  // Category display info
  SlidesData.getCategoryInfo = function (cat) {
    const map = {
      'fundamente':  { label: 'Fundamente',           cssClass: '' },
      'pericol':     { label: 'Dezavantaj / Pericol',  cssClass: 'slide__category--danger' },
      'inginerie':   { label: 'Inginerie / Soluție',   cssClass: 'slide__category--engineering' },
      'avantaj':     { label: 'Avantaj / Aplicație',    cssClass: 'slide__category--advantage' },
      'sinteza':     { label: 'Sinteză & Test',         cssClass: 'slide__category--engineering' }
    };
    return map[cat] || map['fundamente'];
  };

  window.SlidesData = SlidesData;
})();
