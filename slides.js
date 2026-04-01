/**
 * NormIQ — Slide Renderers + UI Orchestration
 */

const SLIDE_TITLES = [
    'Input Schema & Dependencies',
    'Your Schema at a Glance',
    'Attribute Closure Computation',
    'Candidate Keys & Attributes',
    'Finding the Canonical Cover',
    'First Normal Form (1NF)',
    'Second Normal Form (2NF)',
    'Third Normal Form (3NF)',
    'Boyce-Codd Normal Form (BCNF)',
];

const STEP_LABELS = [
    'Input Schema',
    'Schema Overview',
    'Closure Computation',
    'Candidate Keys',
    'Canonical Cover',
    '1NF Check',
    '2NF Check',
    '3NF Check',
    'BCNF Check'
];

// ─── DOM REFS ─────────────────────────────────
const elHomePage = document.getElementById('homePage');
const elSimulationPage = document.getElementById('simulationPage');
const elSlideContainer = document.getElementById('slideContainer');
const elSidebarSteps = document.getElementById('sidebarSteps');
const elBtnPrevSim = document.getElementById('btnPrevSim');
const elBtnNextSim = document.getElementById('btnNextSim');
const elProgressDots = document.getElementById('progressDots');
const elProgressText = document.getElementById('progressText');
const elNavLinks = document.getElementById('navLinks');
const elNavProgress = document.getElementById('navProgress');
const elBreadcrumb = document.getElementById('breadcrumb');

// ─── PAGE NAVIGATION ──────────────────────────
function showPage(pageId) {
    if (pageId === 'home') {
        elHomePage.classList.remove('hidden');
        elSimulationPage.classList.add('hidden');
        elNavLinks.classList.remove('hidden');
        elNavProgress.classList.add('hidden');
        elBreadcrumb.classList.add('hidden');
        document.querySelector('[data-page="home"]').classList.add('active');
        document.querySelector('[data-page="simulation"]').classList.remove('active');
    } else {
        elHomePage.classList.add('hidden');
        elSimulationPage.classList.remove('hidden');
        elNavLinks.classList.add('hidden');
        elNavProgress.classList.remove('hidden');
        elBreadcrumb.classList.remove('hidden');
        document.querySelector('[data-page="home"]').classList.remove('active');
        document.querySelector('[data-page="simulation"]').classList.add('active');
        updateSlideUI();
    }
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const page = link.getAttribute('data-page');
        if (page) {
            e.preventDefault();
            showPage(page);
        }
    });
});

document.getElementById('btnStartNow').addEventListener('click', () => {
    state.currentSlide = 0;
    showPage('simulation');
});

// ─── HTML HELPERS ─────────────────────────────
function attrTableHTML(attrs, pk = []) {
    return `<table class="attr-table"><thead><tr>${attrs.map(a => `<th class="${pk.includes(a) ? 'pk' : ''}">${a}${pk.includes(a) ? ' 🔑' : ''}</th>`).join('')}</tr></thead><tbody><tr>${attrs.map(() => '<td>—</td>').join('')}</tr></tbody></table>`;
}

function fdListHTML(fds) {
    return `<ul class="fd-list" style="list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;">${fds.map(fd => `<li style="padding:10px;background:rgba(255,255,255,0.03);border-left:3px solid var(--secondary);font-family:var(--font-code);font-size:14px;">${sortedStr(fd.det)} <span style="color:var(--accent)">→</span> ${sortedStr(fd.dep)}</li>`).join('')}</ul>`;
}

function decompCardsHTML(tables) {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:16px;margin-top:16px;">${tables.map(t => {
        return `<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:16px;">
            <div style="color:var(--primary);font-weight:bold;margin-bottom:8px;">${t.name}</div>
            <div style="font-family:var(--font-code);font-size:13px;color:var(--text-secondary)">(${t.attrs.join(', ')})</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">PK: {${t.pk.join(', ')}}</div>
        </div>`;
    }).join('')}</div>`;
}

// ═══ SLIDE RENDERERS ══════════════════════════

function renderSlide(n) {
    const renderers = [rS0, rS1, rS2, rS3, rS4, rS5, rS6, rS7, rS8];
    return renderers[n]();
}

// Slide 0 — Input Stage
function rS0() {
    return `
    <div class="slide-card fade-in">
        <h2 class="slide-title">🚀 ${SLIDE_TITLES[0]}</h2>
        <div class="input-grid">
            <div class="input-group">
                <label class="input-label">RELATION SCHEMA</label>
                <input type="text" id="schemaInput" class="fancy-input" placeholder="e.g. R(A, B, C, D, E)" value="${state.relationName ? state.relationName + '(' + state.attributes.join(', ') + ')' : ''}">
                <div class="input-helper">Format: RelationName(Attr1, Attr2, ...)</div>
            </div>
            <div class="input-group">
                <label class="input-label">FUNCTIONAL DEPENDENCIES</label>
                <textarea id="fdInput" class="fancy-textarea" placeholder="A -> B, C\nB -> D\nA, C -> E">${state.fds.map(f => f.det.join(', ') + ' -> ' + f.dep.join(', ')).join('\n')}</textarea>
                <div class="input-helper">One FD per line. Use "->" or "→".</div>
            </div>
        </div>
        <div class="input-actions">
            <div class="select-wrapper">
                <select id="exampleSelect" class="fancy-select">
                    <option value="" disabled selected>Select an example...</option>
                    <option value="student">Student Enrollment</option>
                    <option value="order">Order Management</option>
                    <option value="employee">Employee Department</option>
                </select>
            </div>
            <button class="btn-secondary" id="btnLoadEx">↓ Load Example</button>
            <button class="btn-secondary" id="btnClearInp">× Clear</button>
        </div>
        <div id="inputError" class="error-bar hidden"></div>
    </div>`;
}

// Slide 1 — Schema Overview
function rS1() {
    const pk = state.candidateKeys[0] || [];
    return `<div class="slide-card fade-in"><h2 class="slide-title">📋 ${SLIDE_TITLES[1]}</h2>
    <div class="slide-section"><h4>📌 Relation</h4><div class="schema-box"><span class="rel-name">${state.relationName}</span>(${state.attributes.map(a => pk.includes(a) ? `<span class="pk-attr">${a}</span>` : a).join(', ')})</div></div>
    <div class="slide-section"><h4>📐 Functional Dependencies</h4>${fdListHTML(state.fds)}</div>
    <div class="slide-section"><h4>📊 Schema Structure</h4>${attrTableHTML(state.attributes, pk)}</div>
    <div class="definition-box" style="margin-top:2rem"><strong>💡 Tip:</strong> Attributes in <span style="color:#F2CC60;text-decoration:underline">gold underline</span> are candidate key members.</div></div>`;
}

// Slide 2 — Attribute Closures (Interactive)
function rS2() {
    return `<div class="slide-card fade-in"><h2 class="slide-title">🔍 ${SLIDE_TITLES[2]}</h2>
    <div class="definition-box"><strong>Definition:</strong> The closure of attribute set X (written X⁺) is the set of all attributes functionally determined by X.</div>
    <div class="slide-section">
        <h4 style="margin-bottom:1rem">Select attributes to compute their closure</h4>
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px;padding:20px;background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;">
            ${state.attributes.map(a => `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="closure-cb" value="${a}"> <span style="font-family:var(--font-code)">${a}</span></label>`).join('')}
        </div>
        <div style="display:flex;gap:16px;margin-bottom:24px">
            <button class="btn-primary" style="padding:10px 20px" onclick="computeInteractiveClosure()">Compute Closure</button>
        </div>
        <div id="interactiveClosureResult" style="padding:20px;background:rgba(0,0,0,0.2);border-radius:12px;font-family:var(--font-code);min-height:50px;">Results will appear here...</div>
    </div></div>`;
}

// Slide 3 — Candidate Keys + Prime/Non-Prime
function rS3() {
    const keys = state.candidateKeys;
    return `
    <div class="slide-card fade-in">
        <h2 class="slide-title">🔑 ${SLIDE_TITLES[3]}</h2>
        <div class="slide-section">
            <h4>🅰️ Candidate Key Detection</h4>
            <div style="overflow-x:auto">${attrTableHTML(state.attributes, keys[0])}</div>
            <p style="margin-top:20px;font-size:15px;"><strong>Detected Keys:</strong> ${keys.map(k => `<span style="font-family:var(--font-code);color:var(--primary)">{${sortedStr(k)}}</span>`).join(', ')}</p>
        </div>
        <div class="slide-section">
            <h4>🅱️ Prime vs Non-Prime Attributes</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div style="padding:16px;background:rgba(63, 185, 80, 0.05);border:1px solid rgba(63,185,80,0.2);border-radius:12px;">
                    <div style="color:#3FB950;font-weight:bold;margin-bottom:10px;">PRIME</div>
                    <div style="font-family:var(--font-code)">${[...state.primeAttrs].join(', ')}</div>
                </div>
                <div style="padding:16px;background:rgba(56, 139, 253, 0.05);border:1px solid rgba(56,139,253,0.2);border-radius:12px;">
                    <div style="color:var(--secondary);font-weight:bold;margin-bottom:10px;">NON-PRIME</div>
                    <div style="font-family:var(--font-code)">${state.nonPrimeAttrs.join(', ')}</div>
                </div>
            </div>
        </div>
    </div>`;
}

// Slide 4 — Canonical Cover
function rS4() {
    const s = state.canonicalCoverSteps;
    return `
    <div class="slide-card fade-in">
        <h2 class="slide-title">📐 ${SLIDE_TITLES[4]}</h2>
        <div class="definition-box"><strong>Canonical Cover:</strong> A minimal set of functional dependencies equivalent to the original set.</div>
        <div class="slide-section">
            <h4>Step 1 — Union Rule</h4>
            <p>Combine FDs with same LHS: ${s.union.after.map(f => sortedStr(f.det) + ' → ' + sortedStr(f.dep)).join(', ')}</p>
        </div>
        <div class="slide-section">
            <h4>Final Minimal Cover (Fc)</h4>
            <div style="padding:24px;background:var(--bg-accent);border:1px solid var(--secondary);border-radius:12px;font-family:var(--font-code);color:var(--primary);font-size:18px;">
                { ${s.final.map(f => sortedStr(f.det) + ' → ' + sortedStr(f.dep)).join(', ')} }
            </div>
        </div>
        <div class="verdict pass">✅ Minimal equivalent FD set established</div>
    </div>`;
}

// Slide 5-8 (NF Checks) Simplified for brevity but keeping logic
function rS5() {
    return `<div class="slide-card fade-in"><h2 class="slide-title">1️⃣ ${SLIDE_TITLES[5]}</h2>
    <div class="definition-box"><strong>1NF:</strong> Atomic values, no repeating groups, unique key identifier.</div>
    <div class="verdict ${state.is1NF ? 'pass' : 'fail'}">${state.is1NF ? '✅ Relation is in 1NF' : '❌ Relation violates 1NF'}</div></div>`;
}
function rS6() {
    return `<div class="slide-card fade-in"><h2 class="slide-title">2️⃣ ${SLIDE_TITLES[6]}</h2>
    <div class="definition-box"><strong>2NF:</strong> In 1NF + no partial dependencies on any candidate key.</div>
    ${state.partialDeps.length ? `<div class="slide-section"><h4>Partial Dependencies Found</h4>${fdListHTML(state.partialDeps)}</div>` : ''}
    <div class="verdict ${state.is2NF ? 'pass' : 'fail'}">${state.is2NF ? '✅ Relation is in 2NF' : '❌ Partial dependencies found — decomposition required'}</div>
    ${state.decompHistory.nf2.length > 0 ? decompCardsHTML(state.decompHistory.nf2) : ''}
    </div>`;
}
function rS7() {
    return `<div class="slide-card fade-in"><h2 class="slide-title">3️⃣ ${SLIDE_TITLES[7]}</h2>
    <div class="definition-box"><strong>3NF:</strong> In 2NF + no transitive dependencies (Non-prime attrs depend only on the key).</div>
    ${state.transitiveDeps.length ? `<div class="slide-section"><h4>Transitive Dependencies Found</h4>${fdListHTML(state.transitiveDeps)}</div>` : ''}
    <div class="verdict ${state.is3NF ? 'pass' : 'fail'}">${state.is3NF ? '✅ Relation is in 3NF' : '❌ Transitive dependencies found — decomposition required'}</div>
    ${state.decompHistory.nf3.length > 0 ? decompCardsHTML(state.decompHistory.nf3) : ''}
    </div>`;
}
function rS8() {
    return `<div class="slide-card fade-in"><h2 class="slide-title">🅱️ ${SLIDE_TITLES[8]}</h2>
    <div class="definition-box"><strong>BCNF:</strong> For every X → Y, X must be a superkey. No exceptions.</div>
    ${state.bcnfViolations.length ? `<div class="slide-section"><h4>BCNF Violations Found</h4>${fdListHTML(state.bcnfViolations)}</div>` : ''}
    <div class="verdict ${state.isBCNF ? 'pass' : 'fail'}">${state.isBCNF ? '✅ Relation is in BCNF' : '❌ BCNF violations found — decomposition required'}</div>
    ${state.decompHistory.bcnf.length > 0 ? decompCardsHTML(state.decompHistory.bcnf) : ''}
    </div>`;
}

// ─── INTERACTIVE ENGINE WRAPPERS ──────────────

window.computeInteractiveClosure = function () {
    const checkboxes = document.querySelectorAll('.closure-cb:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value).sort();
    const resultEl = document.getElementById('interactiveClosureResult');
    if (selected.length === 0) {
        resultEl.innerHTML = `<span style="color:#F85149">Please select at least one attribute.</span>`;
        return;
    }
    const { closure, steps } = computeClosure(selected, state.fds, true);
    resultEl.innerHTML = `<div style="color:var(--primary);margin-bottom:10px;">{${selected.join(', ')}}⁺ = {${closure.join(', ')}}</div>
    <div style="font-size:12px;color:var(--text-muted);">${steps.join('<br>')}</div>`;
};

// ─── UI UPDATES ───────────────────────────────

function updateSlideUI() {
    const n = state.currentSlide;
    elSlideContainer.innerHTML = renderSlide(n);
    elProgressText.textContent = `Slide ${n} of 8 — ${STEP_LABELS[n]}`;
    
    // Sidebar update
    elSidebarSteps.innerHTML = STEP_LABELS.map((label, i) => {
        let icon = i < n ? '✅' : (i === n ? '▶' : '○');
        let cls = i === n ? 'active' : (i < n && state.analyzed ? 'completed' : '');
        return `<li class="step-item ${cls}" onclick="goToSlide(${i})">
            <span class="step-icon">${icon}</span>
            <span class="step-text">${label}</span>
        </li>`;
    }).join('');
    
    // Dots update
    elProgressDots.innerHTML = STEP_LABELS.map((_, i) => `<div class="dot ${i === n ? 'active' : ''}"></div>`).join('');
    
    // Buttons update
    elBtnPrevSim.disabled = n === 0;
    elBtnNextSim.textContent = n === 8 ? '🏁 Finish' : (n === 0 ? '▶ Run Normalization' : 'Next Slide →');
    
    // Event listeners for Slide 0
    if (n === 0) {
        setupSlide0Events();
    }
}

function goToSlide(n) {
    if (n === 0 || state.analyzed) {
        state.currentSlide = n;
        updateSlideUI();
    }
}

function setupSlide0Events() {
    const btnLoad = document.getElementById('btnLoadEx');
    const btnClear = document.getElementById('btnClearInp');
    const selEx = document.getElementById('exampleSelect');
    
    btnLoad?.addEventListener('click', () => {
        const val = selEx.value;
        if (EXAMPLES[val]) {
            document.getElementById('schemaInput').value = EXAMPLES[val].schema;
            document.getElementById('fdInput').value = EXAMPLES[val].fds;
        }
    });
    
    btnClear?.addEventListener('click', () => {
        document.getElementById('schemaInput').value = '';
        document.getElementById('fdInput').value = '';
    });
}

elBtnPrevSim.addEventListener('click', () => goToSlide(state.currentSlide - 1));
elBtnNextSim.addEventListener('click', () => {
    if (state.currentSlide === 0) {
        // Run analysis
        try {
            parseAndAnalyze();
            state.analyzed = true;
            goToSlide(1);
        } catch (e) {
            const errEl = document.getElementById('inputError');
            if (errEl) {
                errEl.textContent = '❌ ' + e.message;
                errEl.classList.remove('hidden');
            }
        }
    } else {
        goToSlide(state.currentSlide + 1);
    }
});

const EXAMPLES = {
    student: {
        schema: "StudentEnrollment(StudentID, StudentName, CourseID, CourseName, Instructor, Department, Grade)",
        fds: "StudentID -> StudentName\nCourseID -> CourseName, Instructor, Department\nStudentID, CourseID -> Grade\nInstructor -> Department"
    },
    order: {
        schema: "Orders(OrderID, CustomerID, CustomerName, Date, ProductID, ProductName, Quantity, Price)",
        fds: "OrderID -> CustomerID, CustomerName, Date\nCustomerID -> CustomerName\nProductID -> ProductName, Price\nOrderID, ProductID -> Quantity"
    },
    employee: {
        schema: "Employee(EmpID, EmpName, DeptCode, DeptName, ProjectID, Role, Salary)",
        fds: "EmpID -> EmpName, DeptCode, Salary\nDeptCode -> DeptName\nEmpID, ProjectID -> Role"
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Particle background
    const container = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 20 + 's';
        p.style.opacity = Math.random();
        container.appendChild(p);
    }
    
    showPage('home');
});
