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
      title: 'Consecință Industrială: Vibrații în Arbori și Mașini Rotative',
      category: 'pericol',
      simType: 'rotating-machinery',
      theoryHTML: `
        <div class="theory-section">
          <h3>1. Dezechilibrul Rezidual de Masă (Unbalance)</h3>
          <p>În orice utilaj rotativ industrial (turbine cu abur și gaze, compresoare centrifugale, motoare electrice de mare putere, arbori cardanici), oricât de precisă ar fi prelucrarea mecanică, <strong>centrul real de masă \\(G\\)</strong> al rotorului nu coincide perfect cu <strong>centrul geometric al secțiunii \\(C\\)</strong>. Această asimetrie microscopică reprezintă <em>excentricitatea \\(e\\)</em>.</p>
          <p>La viteza unghiulară de rotație \\(\\omega\\), rotația masei excentrice generează o forță perturbatoare centrifugă care crește proporțional cu <strong>pătratul vitezei de rotație (\\(\\omega^2\\))</strong>:</p>
          <div class="equation-card">
            <div class="equation-card__label">Forța Centrifugă de Dezechilibru</div>
            $$F_{\\text{cf}} = m e \\omega^2$$
          </div>
        </div>

        <div class="theory-section">
          <h3>2. Modelul Rotorului Jeffcott / Laval (1919)</h3>
          <p>Modelul matematic de referință (propus de H. H. Jeffcott în 1919 pe baza descoperirilor lui Carl Gustaf de Laval din 1889) descrie un arbore elastic suplu de rigiditate \\(k\\) sprijinit în două lagăre, purtând la mijloc un disc masiv de masă \\(m\\):</p>
          <div class="equation-card">
            <div class="equation-card__label">Ecuația Diferențială a Deformării Laterale (Whirl)</div>
            $$m\\ddot{x} + c\\dot{x} + kx = me\\omega^2 \\cos(\\omega t), \\qquad m\\ddot{y} + c\\dot{y} + ky = me\\omega^2 \\sin(\\omega t)$$
          </div>
          <p>Amplitudinea deplasării radiale \\(r(\\omega)\\) și unghiul de defazaj \\(\\delta(\\omega)\\) dintre vectorul excentricității \\(\\vec{CG}\\) și vectorul deflexiunii \\(\\vec{OC}\\) au soluțiile analitice:</p>
          <div class="equation-card">
            <div class="equation-card__label">Amplitudinea de Încovoiere și Defazajul Rotorului</div>
            $$r(\\omega) = \\frac{e \\left(\\frac{\\omega}{\\omega_0}\\right)^2}{\\sqrt{\\left[1 - \\left(\\frac{\\omega}{\\omega_0}\\right)^2\\right]^2 + \\left(2\\zeta \\frac{\\omega}{\\omega_0}\\right)^2}}, \\qquad \\tan\\delta = \\frac{2\\zeta \\left(\\frac{\\omega}{\\omega_0}\\right)}{1 - \\left(\\frac{\\omega}{\\omega_0}\\right)^2}$$
          </div>
        </div>

        <div class="theory-section">
          <h3>3. Turația Critică de Rezonanță (\\(n_{\\text{cr}}\\) RPM)</h3>
          <p>Turația la care viteza de rotație coincide cu frecvența proprie laterală de încovoiere a arborelui poartă numele de <strong>turație critică</strong>:</p>
          <div class="equation-card">
            <div class="equation-card__label">Calculul Turației Critice Fundamentale</div>
            $$\\omega_{\\text{cr}} = \\omega_0 = \\sqrt{\\frac{k}{m}} \\quad \\Longleftrightarrow \\quad n_{\\text{cr}} = \\frac{30}{\\pi} \\sqrt{\\frac{k}{m}} \\; [\\text{RPM}]$$
          </div>
          <p>La această turație (\\(\\omega = \\omega_0\\)), defazajul devine exact \\(\\delta = 90^\\circ\\), iar amplitudinea de flexiune atinge vârful periculos \\(r_{\\max} = Q \\cdot e = \\frac{e}{2\\zeta}\\). Pentru un oțel cu amortizare redusă (\\(\\zeta = 2\\%\\)), deflexiunea arborelui este de <strong>25 de ori mai mare</strong> decât excentricitatea inițială!</p>
        </div>

        <div class="theory-section">
          <h3>4. Descoperirea Epocală a lui Laval: Fenomenul de Auto-centrare (Self-Centering)</h3>
          <p>În 1889, inginerul suedez Gustaf de Laval a demonstrat un principiu contra-intuitiv care a deschis era turbinelor moderne:</p>
          <ul class="theory-points">
            <li><strong>Sub-critic (\\(\\omega \\ll \\omega_{\\text{cr}}\\)):</strong> \\(\\delta \\approx 0^\\circ\\), punctul greu \\(G\\) fuge spre exterior, mărind raza de rotație.</li>
            <li><strong>La rezonanță (\\(\\omega = \\omega_{\\text{cr}}\\)):</strong> \\(\\delta = 90^\\circ\\), vibrațiile și forțele dinamice în lagăre ating maximul.</li>
            <li><strong>Super-critic (\\(\\omega \\gg \\omega_{\\text{cr}}\\)):</strong> Are loc o <em>inversare completă de fază</em>: \\(\\delta \\to 180^\\circ\\)! Punctul greu \\(G\\) se rotește spre interiorul curburii arborelui. Vectorul \\(\\vec{OG} \\to 0\\) — <strong>centrul de masă al rotorului se așază EXACT pe axa teoretică a lagărelor</strong>, iar vibrația transmisă în fundație tinde la zero!</li>
          </ul>
        </div>

        <div class="theory-section">
          <h3>5. Soluții Inginerești în Industria Energetică și Aeronautică</h3>
          <ul class="theory-points">
            <li><strong>Echilibrarea Dinamică:</strong> Măsurarea fazei vibrațiilor cu senzori piezoelectrice și montarea de contragreutăți de compensare pe rotor.</li>
            <li><strong>Trecerea Rapidă prin Turația Critică (Run-up / Coast-down):</strong> Motoarele cu reacție accelerează rapid prin zona critică pentru a preveni acumularea de energie rezonantă.</li>
            <li><strong>Lagăre cu Amortizor cu Film de Ulei (Squeeze Film Dampers):** Inserarea unui inel de ulei sintetic sub presiune în carcasele rulmenților pentru a mări \\(\\zeta\\) de la \\(2\\%\\) la peste \\(15\\%\\), aplatizând vârful de rezonanță.</li>
          </ul>
        </div>

        <div class="theory-callout">
          <strong>Experiment în Simulare:</strong> Pornește de la 1200 RPM (sub-critic), apoi setează <strong>3000 RPM (Turație Critică)</strong> pentru a observa amplificarea masivă a flexiunii și forțele extreme în rulmenți. Urcă apoi la <strong>6000 RPM (Super-critic)</strong> pentru a vedea cum centrul de masă \\(G\\) se auto-centrează exact pe axul lagărelor, iar rotația devine perfect stabilă!
        </div>
      `,
      simConfig: {
        m: 2.5,
        f0: 50.0,
        rpm: 3000,
        eccentricity: 0.40,
        zeta: 0.04
      }
    },

    // ===================== SLIDE 8 =====================
    {
      id: 8,
      title: 'Sincronizarea Pendulelor lui Huygens (1665)',
      category: 'fundamental',
      simType: 'huygens-pendulums',
      theoryHTML: `
        <h3>1. Descoperirea Istorică: „O Simpatie Ciudată a Ceasurilor” (1665)</h3>
        <p>
          În februarie 1665, fizicianul și matematicianul olandez <strong>Christiaan Huygens</strong> (inventatorul ceasului cu pendul) a observat un fenomen remarcabil în timp ce testa două orologii marine suspendate pe aceeași <strong>grindă de lemn comună</strong> sprijinită pe două scaune.
        </p>
        <p>
          Indiferent de poziția sau faza inițială din care erau pornite cele două pendule (chiar și după ce erau perturbate manual), în decurs de aproximativ 30 de minute acestea intrau invariabil într-o stare de <strong>sincronizare în antifază perfectă (\\(\\Delta\\varphi = 180^\\circ\\))</strong> — oscilând în oglindă, apropiindu-se și depărtându-se simultan unul de celălalt! Huygens a numit fenomenul <em>„sympathie des horloges”</em>, marcând prima observație științifică a sincronizării oscilatorilor cuplați neliniari.
        </p>

        <h3>2. Modelul Mecanic cu 3 Grade de Libertate (3-DOF) și Eșapamentul</h3>
        <p>
          Sistemul este alcătuit din două pendule de masă \\(m\\) și lungime \\(L\\) (unghiuri \\(\\theta_1(t), \\theta_2(t)\\)) atârnate de o grindă comună de masă \\(M\\) care se poate deplasa orizontal cu \\(X(t)\\) (rigiditate \\(K_b\\), amortizare \\(C_b\\)). Fiecare ceas conține un <strong>mecanism de eșapament cu ancoră</strong> care livrează un mic impuls la fiecare ciclu (modelat matematic printr-un termen auto-întreținut Van der Pol):
        </p>
        <div class="theory-equation">
          \\[
          \\ddot{\\theta}_i + \\gamma(\\theta_i^2 - \\theta_0^2)\\dot{\\theta}_i + \\frac{g}{L_i}\\sin\\theta_i + \\frac{\\ddot{X}}{L_i}\\cos\\theta_i = 0, \\quad (i = 1, 2)
          \\]
        </div>
        <div class="theory-equation">
          \\[
          (M + 2m)\\ddot{X} + C_b\\dot{X} + K_b X + mL \\sum_{i=1}^2 \\left(\\ddot{\\theta}_i\\cos\\theta_i - \\dot{\\theta}_i^2\\sin\\theta_i\\right) = 0
          \\]
        </div>
        <p>
          Raportul adimensional de cuplaj este \\(\\mu = \\frac{m}{M}\\): cuplajul are loc exclusiv prin <strong>micro-accelerațiile \\(\\ddot{X}\\) ale grinzii comune</strong>! Dacă grinda este blocată rigid (\\(X \\equiv 0\\)), pendulele sunt decuplate și nu se pot sincroniza.
        </p>

        <h3>3. Bistabilitate Reală: Sincronizare în Antifază (180°) sau în Fază (0°)</h3>
        <p>
          Cercetările moderne de dinamică neliniară asupra pendulelor lui Huygens (Bennett et al., 2002; Kapitaniak et al., 2012) au demonstrat că sistemul real prezintă <strong>bistabilitate</strong> — existența a doi atractori stabili simultani, starea finală depinzând de condițiile inițiale (bazinul de atracție în care este pornit sistemul):
        </p>
        <ul>
          <li>
            <strong>Sincronizare în Fază (\\(\\theta_1 \\approx +\\theta_2,\\; \\Delta\\varphi \\to 0^\\circ\\)):</strong> Dacă pendulele sunt pornite sau perturbate astfel încât diferența inițială de fază este mai mică de \\(90^\\circ\\), pendulele se blochează pas la pas, oscilând în aceeași direcție. În acest regim, forțele orizontale se însumează (\\(F_{\\text{net}} = F_1 + F_2\\)), iar grinda suport oscilează vizibil cu amplitudine maximă.
          </li>
          <li>
            <strong>Sincronizare în Antifază (\\(\\theta_1 \\approx -\\theta_2,\\; \\Delta\\varphi \\to 180^\\circ\\)):</strong> Dacă diferența inițială de fază depășește \\(90^\\circ\\) (mai aproape de antifază), forțele exercitate pe grindă se anulează reciproc:
            \\[
            F_{\\text{net}} = F_1 + F_2 \\approx \\sin\\theta_1 + \\sin(-\\theta_1) = 0 \\implies X(t) \\to 0
            \\]
            Pendulele oscilează în oglindă, iar grinda rămâne perfect calmă.
          </li>
        </ul>
        <p>
          La o pornire cu faze complet aleatorii, sistemul va alege natural starea cea mai apropiată!
        </p>

        <h3>4. Limba lui Arnold și Condiția de Sincronizare</h3>
        <p>
          Dacă între cele două pendule există o diferență de frecvență proprie \\(\\Delta\\omega = |\\omega_1 - \\omega_2|\\) (cauzată de o mică diferență de lungime \\(\\Delta L\\)), blocarea în fază este posibilă doar dacă tăria cuplajului \\(\\mu\\) depășește pragul critic (regiunea <em>Limbii lui Arnold</em>).
        </p>
      `,
      simConfig: {
        couplingMu: 0.12,
        beamDamping: 0.55,
        detuningPct: 0.3
      }
    },

    // ===================== SLIDE 9 =====================
    {
      id: 9,
      title: 'Amortizorul Acordat de Masă (TMD): Taipei 101',
      category: 'inginerie',
      simType: 'tuned-mass-damper',
      theoryHTML: `
        <h3>1. Ce este un Amortizor Acordat de Masă (Tuned Mass Damper)?</h3>
        <p>
          Un <strong>TMD (Tuned Mass Damper)</strong> este un sistem mecanic pasiv avansat de control al vibrațiilor, instalat în structurile elastice înalte (zgârie-nori, turnuri de telecomunicații, poduri suspendate) pentru a proteja integritatea structurală și a preveni răul de mișcare (motion sickness) al ocupanților sub acțiunea vânturilor extreme și seismelor.
        </p>
        <p>
          Cel mai spectaculos și faimos exemplu din lume este cel din zgârie-norul <strong>Taipei 101 din Taiwan (508 m înălțime)</strong>: un pendul gigant de <strong>660 de tone</strong> format din 41 de discuri circulare de oțel masiv placate cu aur (diametru 5,5 m), suspendat la 380 m înălțime între etajele 87 și 92 prin 8 cabluri groase de oțel de 42 mm și ancorat la bază prin 8 pistoane hidraulice radiale cu ulei vâscos.
        </p>

        <h3>2. Ecuațiile Diferențiale Cuplate (Modelul 2-DOF)</h3>
        <p>
          Sistemul este guvernat mecanic de un model cu două grade de libertate (2-DOF): masa principală a clădirii \\(M_1\\) (cu rigiditate modală \\(K_1\\) și amortizare structurală intrinsecă \\(C_1\\)) cuplată cu masa secundară a pendulului \\(m_2\\) prin rigiditatea efectivă de pendul gravitațional \\(k_2 = m_2 g / L\\) și amortizoarele hidraulice \\(c_2\\):
        </p>
        <div class="theory-equation">
          \\[
          M_1 \\ddot{x}_1 + (C_1 + c_2)\\dot{x}_1 + (K_1 + k_2)x_1 - c_2 \\dot{x}_2 - k_2 x_2 = F(t)
          \\]
        </div>
        <div class="theory-equation">
          \\[
          m_2 \\ddot{x}_2 + c_2(\\dot{x}_2 - \\dot{x}_1) + k_2(x_2 - x_1) = 0
          \\]
        </div>
        <p>
          Notând raportul de masă \\(\\mu = \\frac{m_2}{M_1}\\) (la Taipei 101, \\(\\mu \\approx 0{,}024\\), adică pendulul reprezintă \\(2{,}4\\%\\) din masa modală efectivă a primului mod de încovoiere), forța de inerție a pendulului acționează în opoziție de fază cu deformarea turnului, absorbind energia cinetică și disipând-o în căldură prin fluidul hidraulic.
        </p>

        <h3>3. Teorema de Optimizare Den Hartog (1928)</h3>
        <p>
          În anul 1928, renumitul inginer <strong>J. P. Den Hartog</strong> a descoperit condițiile analitice exacte pentru care răspunsul în frecvență al structurii principale este minimizat uniform:
        </p>
        <div class="theory-equation">
          \\[
          f_{\\text{opt}} = \\frac{\\omega_2}{\\omega_1} = \\frac{1}{1 + \\mu}, \\qquad \\zeta_{\\text{opt}} = \\sqrt{\\frac{3\\mu}{8(1 + \\mu)}}
          \\]
        </div>
        <p>
          <strong>Efectul Rezonanței Despicate (Peak Splitting):</strong><br>
          Fără TMD, o clădire elastică zveltă are un factor de calitate uriaș (\\(Q \\approx 40 - 50\\)), rezultând oscilații rezonante periculoase. Conectarea amortizorului acordat optim <em>desparte vârful unic de rezonanță în două cocoașe laterale foarte joase</em>, reducând amplitudinea de balans a turnului cu <strong>până la 70% – 80%</strong>!
        </p>

        <h3>4. Testul Real: Super Taifunul Soudelor (2015)</h3>
        <p>
          Pe 8 august 2015, Taifunul Soudelor a lovit Taipeiul cu rafale record de <strong>234 km/h</strong>. Pendulul de 660 de tone a atins o cursă istorică de <strong>\\(\\pm 100\\text{ cm}\\)</strong>, disipând o putere mecanică uriașă în pistoanele hidraulice și păstrând clădirea în siguranță absolută.
        </p>
      `,
      simConfig: {
        f1: 0.15,
        massRatio: 0.025,
        zeta1: 0.012,
        tmdActive: true
      }
    },

    // ===================== SLIDE 10 =====================
    {
      id: 10,
      title: 'Microscopia de Forță Atomică (AFM): Scanare la Nivel Atomic',
      category: 'avantaj',
      simType: 'afm-microscopy',
      theoryHTML: `
        <h3>1. Revoluția Nanotehnologică: Cum „Simțim” Atomii fără Lumină (1986)</h3>
        <p>
          Microscopul optic convențional este limitat fundamental de <strong>limita de difracție a luminii (criteriul Abbe: \\(\\approx 200\\text{ nm}\\))</strong>. Pentru a „vedea” atomii individuali (diametru de \\(\\approx 0{,}1 - 0{,}2\\text{ nm}\\)), Gerd Binnig, Calvin Quate și Christoph Gerber au inventat în 1986 <strong>Microscopul de Forță Atomică (AFM - Atomic Force Microscope)</strong>, o tehnologie distinsă cu Premiul Nobel ce a inaugurat era nanotehnologiei moderne.
        </p>
        <p>
          AFM nu folosește lentile sau fotoni pentru formarea imaginii, ci o <strong>sondă mecanică nanometrică ultra-ascuțită (cu un singur atom în vârf)</strong>, montată la capătul liber al unei micro-lamele elastice de siliciu (<strong>cantilever</strong>). Cantileverul este menținut în <strong>rezonanță mecanică de înaltă frecvență</strong> (\\(f_0 \\approx 75 - 300\\text{ kHz}\\)), devenind cel mai sensibil transductor de forță cunoscut în știința materialelor.
        </p>

        <h3>2. Ecuația Mecanică a Cantileverului și Forțele van der Waals</h3>
        <p>
          Cantileverul este acționat piezoelectric la baza fixată printr-o forță armonică \\(F_{\\text{piezo}}\\cos(\\omega t)\\). La distanțe sub-nanometrice de suprafața probei (\\(z < 1\\text{ nm}\\)), vârful începe să interacționeze cu atomii probei prin forțe interatomice slabe <strong>van der Waals</strong> (forțe de dispersie London) și forțe electrostatice:
        </p>
        <div class="theory-equation">
          \\[
          m^* \\ddot{z} + \\frac{m^* \\omega_0}{Q} \\dot{z} + k z = F_{\\text{piezo}}\\cos(\\omega t) + F_{\\text{vdW}}(z)
          \\]
        </div>
        <p>
          unde \\(m^*\\) este masa efectivă a lamelei (\\(\\approx 10^{-11}\\text{ kg}\\)), \\(k\\) este rigiditatea elastică (\\(0{,}1 - 40\\text{ N/m}\\)), iar \\(Q\\) este factorul de calitate (\\(300 - 600\\) în aer, \\(> 50\\,000\\) în vid).
        </p>

        <h3>3. Modificarea Rezonanței prin Gradientul de Forță (\\(\\Delta f_0\\))</h3>
        <p>
          Pentru oscilații de mică amplitudine, forța van der Waals poate fi liniarizată în jurul poziției medii. Termenul critic este <strong>gradientul forței (derivata spațială) \\(\\frac{\\partial F_{\\text{vdW}}}{\\partial z}\\)</strong>, care se comportă ca o modificare directă a rigidității resortului:
        </p>
        <div class="theory-equation">
          \\[
          k_{\\text{eff}} = k - \\frac{\\partial F_{\\text{vdW}}}{\\partial z} \\implies \\omega_{\\text{eff}} = \\sqrt{\\frac{k_{\\text{eff}}}{m^*}} = \\omega_0 \\sqrt{1 - \\frac{1}{k}\\frac{\\partial F_{\\text{vdW}}}{\\partial z}}
          \\]
        </div>
        <p>
          Dezvoltând în serie Taylor pentru \\(\\frac{\\partial F}{\\partial z} \\ll k\\), obținem <strong>formula fundamentală a microscopiei AFM de rezonanță</strong>:
        </p>
        <div class="theory-equation">
          \\[
          \\Delta f_0 \\approx -\\frac{f_0}{2 k} \\left( \\frac{\\partial F_{\\text{vdW}}}{\\partial z} \\right)
          \\]
        </div>
        <ul>
          <li>
            <strong>Regim Atractiv (Gradient pozitiv \\(\\frac{\\partial F}{\\partial z} > 0\\)):</strong> Rigiditatea scade (<em>spring softening</em>), frecvența de rezonanță scade (\\(\\Delta f_0 < 0\\)).
          </li>
          <li>
            <strong>Regim Repulsiv (Contact intermitent, \\(\\frac{\\partial F}{\\partial z} < 0\\)):</strong> La atingerea norilor electronici ai atomilor, repulsia Pauli rigidizează sistemul (<em>spring hardening</em>), crescând frecvența (\\(\\Delta f_0 > 0\\)).
          </li>
        </ul>

        <h3>4. Modul Tapping (Amplitudine Modulată) vs Modul Non-Contact</h3>
        <ul>
          <li>
            <strong>Modul Tapping (Intermittent Contact):</strong> Cantileverul oscilează cu o amplitudine mare (\\(10 - 50\\text{ nm}\\)), lovind ușor suprafața la fiecare ciclu. Amplitudinea scade brusc când sonda întâlnește o denivelare atomică. O buclă de reacție piezoelectrică (feedback PID) ridică sau coboară proba pentru a menține amplitudinea constantă — semnalul de comandă Z devenind direct <strong>harta topografică tridimensională</strong>. Acest mod elimină frecarea laterală distructivă, permițând scanarea ADN-ului și a proteinelor vii!
          </li>
          <li>
            <strong>Modul Non-Contact (NC-AFM / Frecvență Modulată):</strong> Vârful nu atinge niciodată proba (oscilează la \\(0{,}5 - 2\\text{ nm}\\) deasupra ei), iar imaginea se obține monitorizând deviația \\(\\Delta f_0\\) cu rezoluție de sub \\(0{,}1\\text{ Hz}\\).
          </li>
        </ul>

        <h3>5. Pârghia Optică (Optical Lever): Detecție Laser Picometrică</h3>
        <p>
          Cum măsurăm o deflecție mecanică de doar câțiva picometri (\\(10^{-12}\\text{ m}\\))? Printr-o <strong>pârghie optică laser</strong>: o diodă laser proiectează un fascicul pe spatele aurit al vârfului cantileverului, de unde se reflectă către o <strong>fotodiodă cuadrantică cu 4 cadrane (A, B, C, D)</strong>.
        </p>
        <p>
          Datorită distanței optice mari (\\(L \\approx 5 - 10\\text{ cm}\\)) comparativ cu lungimea lamelei (\\(l \\approx 100\\;\\mu\\text{m}\\)), deflecția unghiulară este amplificată geometric de peste <strong>\\(1000\\times\\)</strong>:
        </p>
        <div class="theory-equation">
          \\[
          \\Delta y_{\\text{spot}} \\approx 2 L \\cdot \\theta_{\\text{cantilever}} = 3 \\frac{L}{l} \\cdot \\Delta z_{\\text{tip}}
          \\]
        </div>
        <p>
          Diferența de fotocurent \\((A + B) - (C + D)\\) oferă o rezoluție verticală record de <strong>\\(0{,}01\\text{ Å} = 1\\text{ picometru}\\)</strong>, de 100 de ori mai mică decât diametrul unui atom de hidrogen!
        </p>
      `,
      simConfig: {
        f0: 150.0,
        Q: 450,
        k: 40.0,
        freeAmp: 20.0,
        sampleZ: 8.0
      }
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
