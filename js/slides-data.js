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
      title: 'Consecință Catastrofală: Podul Tacoma Narrows (1940)',
      category: 'pericol',
      simType: 'tacoma-narrows',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Realitatea Fizică: Fluturele Aeroelastic (Aeroelastic Flutter)</h3>
          <p>Pe 7 noiembrie 1940, sub un vânt de \\(68\\text{ km/h}\\) (\\(19\\text{ m/s}\\)), prăbușirea podului Tacoma Narrows nu a fost o simplă rezonanță forțată, ci o <strong>vibrație auto-excitată (fluture aeroelastic)</strong> declanșată în etape:</p>
          <ul class="theory-points">
            <li><strong>Separarea Fluxului și Vârtejurile:</strong> Când vântul a lovit <em>grinzile pline din plăci de oțel</em> (solid plate girders, înalte de \\(2{,}4\\text{ m}\\)), curentul de aer nu a putut trece prin structură și s-a separat violent, creând vârtejuri alternante deasupra și dedesubtul tablierului:
              $$f_s = \\frac{\\text{St} \\cdot v}{D}$$
            </li>
            <li><strong>Ora 10:00 AM — Alunecarea Colierului Central:</strong> Un colier de prindere (cable band) al cablului principal de la mijlocul podului a alunecat din cauza tensiunii, aruncând podul în dezechilibru asimetric și <strong>declanșând modul de răsucire (torsional)</strong> în două jumătăți care oscilau în antifază!</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>2. Mecanismul Auto-Excitației: Vântul Pompează Energie</h3>
          <p>Pe măsură ce tablierul se înclina cu unghiul \\(\\theta\\), acesta modifica continuu unghiul de atac sub care vântul lovea podul, alterând portanța (lift) și rezistența aerodinamică (drag).</p>
          <div class="equation-card">
            <div class="equation-card__label">Ecuația Torsiunii Auto-Excitate</div>
            $$I \\ddot{\\theta} + c_\\theta \\dot{\\theta} + k_\\theta(\\theta) = M_{\\text{aero}}(\\theta, \\dot{\\theta}, v)$$
          </div>
          <p>Această forță aerodinamică împingea podul <strong>exact în direcția în care acesta deja se răsucea</strong> (\\(M_{\\text{aero}} \\cdot \\dot{\\theta} \\gt 0\\)). În loc să amortizeze mișcarea, vântul <strong>pompa activ energie în torsiune la fiecare ciclu</strong>:</p>
          <div class="equation-card">
            <div class="equation-card__label">Amortizarea Efectivă Negativă (Flutter)</div>
            $$c_{\\text{eff}}(v) = c_\\theta - \\frac{1}{2}\\rho v B^3 A_1^* \\lt 0 \\quad \\Longrightarrow \\quad E_{\\text{ciclu}} = \\oint M_{\\text{aero}} \\, d\\theta \\gt 0$$
          </div>
        </div>

        <div class="theory-section">
          <h3>3. Cronologia Colapsului (Ora 10:00 AM – 11:09 AM)</h3>
          <ul class="theory-points">
            <li><strong>Răsucire Violentă până la \\(\\pm 45^\\circ\\):</strong> Podul a început să se răsucească extrem de violent, înclinându-se alternativ la stânga și la dreapta cu <strong>până la \\(45^\\circ\\)</strong> (cu o diferență de nivel de peste \\(8{,}5\\text{ m}\\) între trotuare).</li>
            <li><strong>Forfecarea Cablurilor Verticale (Suspenders):</strong> Solicitarea extremă a forfecat rapid cablurile verticale de suspensie care susțineau carosabilul de cablurile principale.</li>
            <li><strong>Cedarea în Cascadă (Unul câte Unul):</strong> Pe măsură ce cablurile verticale pocneau și se rupeau <em>unul câte unul</em>, greutatea nesusținută a carosabilului din beton și oțel a devenit prea mare pentru cablurile rămase.</li>
            <li><strong>Ora 11:00 AM — Prăbușirea Secțiunii de 600 de Picioare (183 m):</strong> O secțiune masivă de \\(600\\text{ ft}\\) (\\(\\approx 183\\text{ m}\\)) din deschiderea centrală s-a smuls complet și s-a prăbușit în apele strâmtorii Tacoma Narrows.</li>
            <li><strong>Ora 11:09 AM — Colapsul Total:</strong> La scurt timp după aceea, dezechilibrul șocului a rupt în lanț restul cablurilor verticale, iar întregul rest al deschiderii principale s-a prăbușit în apă.</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>4. Soluția Inginerească: Cum Evităm Fluturele Aeroelastic</h3>
          <p>La reconstrucția din 1950, grinzile pline au fost înlocuite cu <strong>grinzi deschise cu zăbrele (truss)</strong> prin care vântul trece fără să se separe în vârtejuri portante, iar la podurile moderne se folosesc <strong>casete aerodinamice profilate</strong> care stabilizează activ tablierul.</p>
        </div>

        <div class="theory-callout">
          <strong>Experiment în Simulare:</strong> Urmărește atât <em>vederea 3D pe lungimea podului</em> (cu cele 24 de segmente și cablurile verticale care se rup unul câte unul), cât și <em>tunelul aerodinamic în secțiune</em> (jos-stânga), unde vezi cum vârtejurile și portanța împing tablierul exact în direcția în care se rotește până la \\(\\pm 45^\\circ\\)!
        </div>
      `,
      simConfig: {
        windSpeed: 19.0,
        kTheta: 1.0,
        cTheta: 0.03,
        deckType: 'h-girder'
      }
    },

    // ===================== SLIDE 5 =====================
    {
      id: 5,
      title: 'Consecință: Pasarela Millennium din Londra (2000)',
      category: 'pericol',
      simType: 'millennium-bridge',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Evenimentul din 10 Iunie 2000: „The Wobbly Bridge”</h3>
          <p>Pe 10 iunie 2000, cu ocazia noului mileniu, la Londra s-a inaugurat <strong>Pasarela Millennium</strong> peste râul Tamisa — un pod suspendat pietonal extrem de suplu și modern, cu cabluri laterale tensionate (deschidere totală de \\(320\\text{ m}\\)).</p>
          <p>În primele 48 de ore, podul a fost traversat de circa <strong>90.000 de oameni</strong>, ajungând la densități de până la 2.000 de persoane simultan pe tablier. Imediat, puntea a început să se <strong>balanseze lateral violent</strong>, cu amplitudini de până la \\(\\pm 70\\text{ mm}\\) – \\(100\\text{ mm}\\) la frecvența de \\(\\approx 0{,}8 - 1{,}0\\text{ Hz}\\). Oamenii se dezechilibrau, mergeau legănat ca pinguinii și se agățau disperați de balustrade. Podul a fost închis de urgență după doar 2 zile!</p>
        </div>

        <div class="theory-section">
          <h3>2. Demontarea Mitului: De ce NU a fost Marș Militar?</h3>
          <p>De la prăbușirea podului suspendat Broughton (1831), regulamentele militare impun trupelor să <em>rupă pasul de marș</em> la traversarea oricărui pod. Pe Pasarela Millennium însă, pietonii au urcat complet dezorganizați, pășind la întâmplare și cu faze aleatorii.</p>
          <p>Analizele conduse de fizicianul Steven Strogatz (Universitatea Cornell) și echipa de ingineri de la Arup (publicate în revista <em>Nature</em>, 2005) au dovedit că fenomenul a fost o <strong>tranziție spontană de sincronizare (Synchronous Lateral Excitation)</strong> cu feedback biomecanic pozitiv.</p>
        </div>

        <div class="theory-section">
          <h3>3. Mecanismul Biomecanic: Forța Laterală a Pasului Uman</h3>
          <p>În timpul mersului obișnuit, o persoană face pași înainte la o frecvență verticală de \\(f_{\\text{vert}} \\approx 2{,}0\\text{ Hz}\\) (doi pași pe secundă). Însă, pentru a înainta, corpul uman își transferă alternativ centrul de greutate de pe piciorul stâng pe cel drept. Fiecare pas generează o <strong>forță reactivă orizontală laterală</strong> cu frecvența egală cu exact <em>jumătatea frecvenței verticale</em>:</p>
          <div class="equation-card">
            <div class="equation-card__label">Frecvența și Forța Laterală a Mersului Uman</div>
            $$f_{\\text{lateral}} = \\frac{1}{2} f_{\\text{vertical}} \\approx 0{,}8 - 1{,}0\\text{ Hz}, \\qquad F_{\\text{lat}} \\approx (0{,}04 - 0{,}05) \\cdot G_{\\text{corp}} \\approx 25 - 35\\text{ N}$$
          </div>
          <p>Deschiderea sudică și cea centrală ale pasarelei aveau frecvențe proprii laterale de flexiune de \\(f_0 \\approx 0{,}77\\text{ Hz}\\) și \\(f_0 \\approx 1{,}03\\text{ Hz}\\) — suprapuse perfect peste ritmul lateral al pasului uman — având o amortizare internă extrem de slabă (\\(\\zeta \\approx 0{,}5\\%\\), \\(Q \\approx 100\\)).</p>
        </div>

        <div class="theory-section">
          <h3>4. Bucla de Reacție Pozitivă și Modelul Kuramoto</h3>
          <p>Sincronizarea s-a produs printr-o reacție în lanț auto-amplificată:</p>
          <ul class="theory-points">
            <li><strong>Balansul incipient:</strong> Chiar și din pași aleatorii, coincidența statistică creează o mișcare laterală microscopică a punții (\\(Y \\sim 2-5\\text{ mm}\\)).</li>
            <li><strong>Instinctul de echilibru (Waddling Gait):</strong> Când podeaua fuge de sub picioare, pietonul își depărtează instinctiv tălpile și își adaptează pasul pentru a călca <em>în aceeași direcție în care se mișcă podul</em>.</li>
            <li><strong>Cuplajul coerent:</strong> Pășind în faza mișcării, pietonii nu mai anulează reciproc forțele, ci împing simultan în puntea podului!</li>
            <li><strong>Ecuația Kuramoto de Fază:</strong> Faza fiecărui pieton \\(\\theta_i(t)\\) este atrasă de faza mișcării podului \\(\\Phi_{\\text{pod}}\\):
              $$\\frac{d\\theta_i}{dt} = \\Omega_i + K \\cdot \\min\\left(1, \\frac{|\\dot{Y}|}{v_0}\\right) \\sin(\\Phi_{\\text{pod}} - \\theta_i)$$
            </li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>5. Pragul Critic de Pietoni (\\(N_{\\text{crit}}\\))</h3>
          <p>Bilanțul energetic dintre energia injectată de mulțime și disiparea structurală arată că fenomenul apare doar dacă numărul de pietoni \\(N\\) depășește un <strong>prag critic strict</strong>:</p>
          <div class="equation-card">
            <div class="equation-card__label">Pragul Critic Strogatz-Arup</div>
            $$N_{\\text{crit}} = \\frac{8 \\zeta M \\omega_0}{\\pi k_{\\text{walk}}} \\approx 160 \\text{ pietoni}$$
          </div>
          <p>Sub \\(N_{\\text{crit}}\\), mișcarea rămâne stabilă și insesizabilă. Când densitatea mulțimii a depășit 160 de persoane pe deschiderea sudică, podul a trecut printr-o <em>tranziție de fază colectivă</em> spre oscilație divergentă!</p>
        </div>

        <div class="theory-section">
          <h3>6. Soluția Inginerească: Amortizoare Vâscoase (2001–2002)</h3>
          <p>În loc să demoleze sau să rigidizeze inestetic structura suplă, consorțiul Arup a instalat dedesubtul tablierului:</p>
          <ul class="theory-points">
            <li><strong>37 de amortizoare cu fluid vâscos (Viscous Dampers):</strong> pistoane hidraulice montate pe console chevron care disipă energia cinetică laterală prin frecarea uleiului sintetic sub presiune;</li>
            <li><strong>52 de amortizoare acordate de masă (TMD-uri):</strong> contragreutăți oscilante pe arcuri.</li>
          </ul>
          <p>Amortizarea efectivă \\(\\zeta\\) a crescut de la \\(0{,}5\\%\\) la peste <strong>\\(20 - 22\\%\\)</strong>, mărind \\(N_{\\text{crit}}\\) la peste 2.500 de persoane. Pasarela s-a redeschis în februarie 2002 și rămâne perfect stabilă până în prezent.</p>
        </div>

        <div class="theory-callout">
          <strong>Experiment în Simulare:</strong> Crește numărul de pietoni de la 50 la 250 pentru a depăși pragul critic \\(N_{\\text{crit}} \\approx 160\\) și urmărește cum parametrul de ordine Kuramoto \\(R\\) crește spre 80-90%! Apoi apasă butonul <em>„🛡️ Soluția 2002: Amortizoare Vâscoase”</em> pentru a vedea cum balansul se stinge instantaneu.
        </div>
      `,
      simConfig: {
        f0: 0.90,
        N: 180,
        couplingK: 2.2
      }
    },

    // ===================== SLIDE 6 =====================
    {
      id: 6,
      title: 'Consecință Seismică: Seisme și Clădiri de Înălțimi Diferite',
      category: 'pericol',
      simType: 'seismic-buildings',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Paradoxul Cutremurelor: De ce Cad Selectiv Clădirile?</h3>
          <p>În timpul unui cutremur major, scoarța terestră oscilează orizontal cu un spectru de frecvențe bine definit. Un fenomen aparent paradoxal observat de seismologi este <strong>selectivitatea distrugerii</strong>: pe aceeași stradă, o clădire modernă cu 10 etaje se poate prăbuși complet, în timp ce o casă veche cu 2 etaje și un zgârie-nori cu 30 de etaje rămân aproape intacte!</p>
          <p>Explicația fizică este <strong>rezonanța mecanică selectivă</strong> dintre frecvența dominantă a undelor seismice din sol (\\(f_{\\text{seism}}\\)) și frecvența proprie de oscilație a clădirii (\\(f_0\\)).</p>
        </div>

        <div class="theory-section">
          <h3>2. Regula Inginerească: Înălțimea vs. Perioada Proprie (\\(T_0 \\approx 0{,}1 \\cdot N\\))</h3>
          <p>Din punct de vedere mecanic, o clădire se comportă ca o grindă elastică în consolă (cantilever) încastrată în fundație. În ingineria seismică, perioada fundamentală de oscilație \\(T_0\\) (în secunde) este direct proporțională cu numărul de etaje \\(N\\):</p>
          <div class="equation-card">
            <div class="equation-card__label">Relația Fundamentală Perioadă Proprie — Număr de Etaje</div>
            $$T_0 \\approx 0{,}1 \\cdot N \\; [\\text{s}] \\quad \\Longleftrightarrow \\quad f_0 = \\frac{1}{T_0} \\approx \\frac{10}{N} \\; [\\text{Hz}]$$
          </div>
          <ul class="theory-points">
            <li><strong>Clădire Joasă (\\(N = 3\\) etaje — Rigidă):</strong> \\(T_0 \\approx 0{,}3\\text{ s}\\), \\(f_0 \\approx 3{,}33\\text{ Hz}\\). Rezonează la trepidații rapide, de înaltă frecvență (cutremure de suprafață apropiate de epicentru).</li>
            <li><strong>Clădire Medie (\\(N = 10\\) etaje — Standard):</strong> \\(T_0 \\approx 1{,}0\\text{ s}\\), \\(f_0 \\approx 1{,}00\\text{ Hz}\\). Vulnerabilă la unde seismice cu perioadă medie.</li>
            <li><strong>Clădire Înaltă / Zgârie-Nori (\\(N = 20\\) etaje — Flexibilă):</strong> \\(T_0 \\approx 2{,}0\\text{ s}\\), \\(f_0 \\approx 0{,}50\\text{ Hz}\\). Rezonează la oscilații lente, de perioadă lungă, propagate la distanță mare sau amplificate de soluri aluvionare moi.</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>3. Ecuația Mișcării Relative la Baza Clădirii</h3>
          <p>Dacă solul se deplasează orizontal după legea \\(x_g(t) = X_g \\cos(\\omega t)\\), deplasarea relativă a vârfului clădirii față de fundație \\(u(t) = x(t) - x_g(t)\\) este guvernată de forța de inerție seismică \\(F_{\\text{ef}}(t) = -m \\ddot{x}_g(t)\\):</p>
          <div class="equation-card">
            <div class="equation-card__label">Ecuația Seismică și Factorul de Amplificare (Drift)</div>
            $$m\\ddot{u} + c\\dot{u} + ku = -m\\ddot{x}_g(t) = m \\omega^2 X_g \\cos(\\omega t)$$
            $$\\frac{U_{\\max}}{X_g} = \\frac{(\\omega / \\omega_0)^2}{\\sqrt{\\left[1 - (\\omega / \\omega_0)^2\\right]^2 + \\left(2\\zeta \\frac{\\omega}{\\omega_0}\\right)^2}}$$
          </div>
          <p>Pentru clădirile din beton armat, amortizarea structurală este mică (\\(\\zeta \\approx 5\\%\\)), ceea ce produce la rezonanță (\\(\\omega = \\omega_0\\)) o amplificare de \\(Q = \\frac{1}{2\\zeta} \\approx 10\\times\\) a mișcării solului!</p>
        </div>

        <div class="theory-section">
          <h3>4. Studii de Caz Istorice: Ciudad de México (1985) și Vrancea (1977)</h3>
          <ul class="theory-points">
            <li><strong>Ciudad de México (19 septembrie 1985, \\(M_w = 8{,}0\\)):</strong> Construit pe albia secată a lacului Texcoco, stratul de argilă moale a intrat în rezonanță la perioada de <strong>\\(T \\approx 2{,}0\\text{ s}\\) (\\(f \\approx 0{,}5\\text{ Hz}\\))</strong>. Clădirile joase (2–4 etaje) și turnurile de peste 35 de etaje au scăpat neatinse, însă sute de clădiri între <strong>8 și 20 de etaje</strong> (\\(T_0 \\approx 1{,}0 - 2{,}0\\text{ s}\\)) au intrat în rezonanță dublă și s-au prăbușit!</li>
            <li><strong>Vrancea — București (4 martie 1977, \\(M_w = 7{,}4\\)):</strong> Cutremurul subcrustal adânc (\\(94\\text{ km}\\)) a generat la București o undă cu perioadă lungă (<strong>\\(T \\approx 1{,}2 - 1{,}5\\text{ s}\\), \\(f \\approx 0{,}7 - 0{,}9\\text{ Hz}\\)</strong>), afectând selectiv blocurile înalte cu 8–12 etaje și parter flexibil.</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>5. Soluția Inginerească: Izolarea Seismică a Bazei (Base Isolation)</h3>
          <p>Prin decuplarea clădirii de fundație cu ajutorul <strong>reazemelor elastomerice cu miez de plumb (LRB)</strong>, perioada proprie a întregii structuri este mutată la \\(T_{\\text{izolat}} \\approx 3{,}5 - 4{,}5\\text{ s}\\) (\\(f_0 \\approx 0{,}24\\text{ Hz}\\)), mult sub spectrul seismic. În acest regim supra-rezonant (\\(\\omega \\gg \\omega_0\\)), solul oscilează sub reazeme, iar clădirea rămâne aproape staționară prin inerție!</p>
        </div>

        <div class="theory-callout">
          <strong>Experiment în Simulare:</strong> Apasă pe butoanele <em>„🏛️ Cutremur Local (3.33 Hz)”</em>, <em>„🇷🇴 Vrancea 1977 (1.00 Hz)”</em> și <em>„🇲🇽 Mexico 1985 (0.50 Hz)”</em> sau activează <em>„🌊 Baleiaj Spectru”</em> pentru a vedea cum fiecare clădire intră pe rând în rezonanță! Apoi apasă <em>„🛡️ Izolare la Bază (LRB)”</em> pentru a proteja toate clădirile simultan.
        </div>
      `,
      simConfig: {
        fSeism: 1.00,
        pga: 0.35,
        zeta: 0.05
      }
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
