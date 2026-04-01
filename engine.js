/**
 * DB NORMALIZATION ENGINE — Core Algorithms
 * Closure, Keys, Canonical Cover, NF checks, Chase, FD Preservation
 */

// ─── STATE ────────────────────────────────────
const state = {
    relationName: '', attributes: [], fds: [],
    candidateKeys: [], primeAttrs: new Set(), nonPrimeAttrs: [],
    closureLog: [], allClosures: [], canonicalCoverSteps: {}, canonicalCover: [],
    is1NF: true, is2NF: true, is3NF: true, isBCNF: true, originalHighestNF: '1NF',
    partialDeps: [], transitiveDeps: [], bcnfViolations: [],
    decomposedTables: [], decompHistory: { nf2: [], nf3: [], bcnf: [] },
    isLossless: null, isFDPreserving: null, chaseSteps: [], fdPresResults: [],
    currentSlide: 0, totalSlides: 9, analyzed: false,
};

// ─── UTILITIES ────────────────────────────────
function isSubset(a, b) { return a.every(x => b.includes(x)); }
function setEqual(a, b) { return a.length === b.length && isSubset(a, b); }
function getUnion(a, b) { return [...new Set([...a, ...b])]; }
function getDiff(a, b) { return a.filter(x => !b.includes(x)); }
function sortedStr(arr) { return [...arr].sort().join(', '); }
function arrKey(arr) { return [...arr].sort().join(','); }
function cloneFDs(fds) { return fds.map(f => ({ det: [...f.det], dep: [...f.dep] })); }

function powerSet(arr) {
    const r = [[]];
    for (const v of arr) { const l = r.length; for (let i = 0; i < l; i++) r.push([...r[i], v]); }
    return r;
}

// ─── CLOSURE ──────────────────────────────────
function computeClosure(attrs, fds, log = false) {
    let closure = [...new Set(attrs)];
    let steps = log ? [`Start: {${sortedStr(attrs)}}⁺ = {${sortedStr(closure)}}`] : [];
    let changed = true;
    while (changed) {
        changed = false;
        for (const fd of fds) {
            if (isSubset(fd.det, closure) && !isSubset(fd.dep, closure)) {
                closure = getUnion(closure, fd.dep);
                changed = true;
                if (log) steps.push(`${sortedStr(fd.det)} → ${sortedStr(fd.dep)} applies → {${sortedStr(closure)}}`);
            }
        }
    }
    return { closure: closure.sort(), steps };
}

function isSuperkey(attrs, allAttrs, fds) {
    return computeClosure(attrs, fds).closure.length === allAttrs.length;
}

// ─── COMPUTE ALL CLOSURES (Slide 2) ──────────
function computeAllClosures(attrs, fds) {
    const results = [];
    // Single attributes
    for (const a of attrs) {
        const { closure, steps } = computeClosure([a], fds, true);
        results.push({ attrs: [a], closure, steps, isKey: closure.length === attrs.length });
    }
    // Pairs
    for (let i = 0; i < attrs.length; i++) {
        for (let j = i + 1; j < attrs.length; j++) {
            const pair = [attrs[i], attrs[j]].sort();
            const { closure, steps } = computeClosure(pair, fds, true);
            if (closure.length > pair.length) { // only show if non-trivial
                results.push({ attrs: pair, closure, steps, isKey: closure.length === attrs.length });
            }
        }
    }
    // Triples (only if attrs <= 8 to avoid explosion)
    if (attrs.length <= 8) {
        for (let i = 0; i < attrs.length; i++)
            for (let j = i + 1; j < attrs.length; j++)
                for (let k = j + 1; k < attrs.length; k++) {
                    const triple = [attrs[i], attrs[j], attrs[k]].sort();
                    const alreadyKey = results.some(r => r.isKey && isSubset(r.attrs, triple));
                    if (alreadyKey) continue;
                    const { closure, steps } = computeClosure(triple, fds, true);
                    if (closure.length > triple.length)
                        results.push({ attrs: triple, closure, steps, isKey: closure.length === attrs.length });
                }
    }
    return results;
}

// ─── CANDIDATE KEYS ──────────────────────────
function findCandidateKeys(attrs, fds) {
    const inLeft = new Set(), inRight = new Set();
    fds.forEach(fd => { fd.det.forEach(a => inLeft.add(a)); fd.dep.forEach(a => inRight.add(a)); });
    const leftOnly = new Set(), neither = new Set(), both = new Set();
    attrs.forEach(a => {
        const l = inLeft.has(a), r = inRight.has(a);
        if (l && !r) leftOnly.add(a); else if (!l && !r) neither.add(a); else if (l && r) both.add(a);
    });
    const essential = [...leftOnly, ...neither];
    const log = [];
    const { closure: essClosure, steps: essSteps } = computeClosure(essential, fds, true);
    log.push({ attrs: [...essential], closure: essClosure, steps: essSteps, isKey: essClosure.length === attrs.length });
    if (essClosure.length === attrs.length) return { keys: [essential.sort()], log };

    const middleAttrs = [...both];
    const keys = [];
    const subsets = powerSet(middleAttrs).sort((a, b) => a.length - b.length);
    for (const sub of subsets) {
        const test = [...essential, ...sub].sort();
        const { closure, steps } = computeClosure(test, fds, true);
        const isKey = closure.length === attrs.length;
        log.push({ attrs: test, closure, steps, isKey });
        if (isKey) {
            let minimal = true;
            for (const k of keys) { if (isSubset(k, test)) { minimal = false; break; } }
            if (minimal) keys.push(test);
        }
    }
    return { keys, log };
}

// ─── CANONICAL COVER (Slide 4) ───────────────
function computeCanonicalCover(originalFds) {
    const steps = {};
    let fds = cloneFDs(originalFds);

    // Step 1: Decompose RHS to single attributes
    let decomposed = [];
    for (const fd of fds) {
        for (const a of fd.dep) {
            decomposed.push({ det: [...fd.det], dep: [a] });
        }
    }

    // Step 1b: Union rule — combine same LHS
    const grouped = {};
    for (const fd of decomposed) {
        const k = arrKey(fd.det);
        if (!grouped[k]) grouped[k] = { det: [...fd.det], dep: [] };
        grouped[k].dep = getUnion(grouped[k].dep, fd.dep);
    }
    let unified = Object.values(grouped);
    steps.union = { before: cloneFDs(originalFds), after: cloneFDs(unified) };

    // Step 2: Remove extraneous LHS attributes
    const lhsChecks = [];
    for (let i = 0; i < unified.length; i++) {
        const fd = unified[i];
        if (fd.det.length <= 1) continue;
        for (let j = fd.det.length - 1; j >= 0; j--) {
            const attr = fd.det[j];
            const reduced = fd.det.filter((_, idx) => idx !== j);
            const { closure } = computeClosure(reduced, unified);
            const extraneous = isSubset(fd.dep, closure);
            lhsChecks.push({ fd: `${sortedStr(fd.det)} → ${sortedStr(fd.dep)}`, attr, closureStr: sortedStr(closure), extraneous });
            if (extraneous) fd.det = reduced;
        }
    }
    steps.lhs = lhsChecks;

    // Re-merge after LHS changes
    const reGrouped = {};
    for (const fd of unified) {
        const k = arrKey(fd.det);
        if (!reGrouped[k]) reGrouped[k] = { det: [...fd.det], dep: [] };
        reGrouped[k].dep = getUnion(reGrouped[k].dep, fd.dep);
    }
    unified = Object.values(reGrouped);

    // Step 3: Remove extraneous RHS attributes
    const rhsChecks = [];
    for (let i = 0; i < unified.length; i++) {
        const fd = unified[i];
        for (let j = fd.dep.length - 1; j >= 0; j--) {
            const attr = fd.dep[j];
            const tempFds = cloneFDs(unified);
            tempFds[i] = { det: [...fd.det], dep: fd.dep.filter((_, idx) => idx !== j) };
            // Remove empty FDs
            const cleaned = tempFds.filter(f => f.dep.length > 0);
            const { closure } = computeClosure(fd.det, cleaned);
            const extraneous = closure.includes(attr);
            rhsChecks.push({ fd: `${sortedStr(fd.det)} → ${sortedStr(fd.dep)}`, attr, closureStr: sortedStr(closure), extraneous });
            if (extraneous) fd.dep.splice(j, 1);
        }
    }
    unified = unified.filter(f => f.dep.length > 0);
    steps.rhs = rhsChecks;

    // Step 4: Remove redundant FDs
    const redundancyChecks = [];
    for (let i = unified.length - 1; i >= 0; i--) {
        const fd = unified[i];
        const remaining = [...unified.slice(0, i), ...unified.slice(i + 1)];
        const { closure } = computeClosure(fd.det, remaining);
        const redundant = isSubset(fd.dep, closure);
        redundancyChecks.push({ fd: `${sortedStr(fd.det)} → ${sortedStr(fd.dep)}`, closureStr: sortedStr(closure), redundant });
        if (redundant) unified.splice(i, 1);
    }
    steps.redundancy = redundancyChecks;
    steps.final = cloneFDs(unified);

    return { cover: unified, steps };
}

// ─── DECOMPOSITION & PROJECTION ──────────────
function projectFDs(attrs, fds) {
    return fds.filter(fd => isSubset(fd.det, attrs) && isSubset(fd.dep, attrs));
}

function performDecomposition() {
    const { attributes: attrs, fds, candidateKeys } = state;
    let tables = [{ name: state.relationName, attrs: [...attrs], pk: candidateKeys[0] || attrs, fds: [...fds] }];

    // 2NF
    if (!state.is2NF) {
        const newT = []; let rem = [...attrs]; const used = new Set();
        for (const pd of state.partialDeps) {
            const k = arrKey([...pd.det, ...pd.dep]); if (used.has(k)) continue; used.add(k);
            const a = getUnion(pd.det, pd.dep);
            newT.push({ name: `${pd.det.join('_')}_Details`, attrs: a, pk: pd.det, fds: projectFDs(a, fds) });
            rem = getDiff(rem, getDiff(pd.dep, pd.det));
        }
        newT.push({ name: `${state.relationName}_Base`, attrs: rem, pk: candidateKeys[0] || rem, fds: projectFDs(rem, fds) });
        state.decompHistory.nf2 = newT; tables = newT;
    } else { state.decompHistory.nf2 = tables; }

    // 3NF
    if (!state.is3NF) {
        const newT = [];
        for (const t of tables) {
            const viol = t.fds.filter(fd => {
                if (isSubset(fd.dep, fd.det)) return false;
                return !isSuperkey(fd.det, t.attrs, t.fds) && !fd.dep.every(a => state.primeAttrs.has(a));
            });
            if (viol.length > 0) {
                let rem = [...t.attrs];
                for (const v of viol) {
                    const a = getUnion(v.det, v.dep);
                    newT.push({ name: `${v.det.join('_')}_Ref`, attrs: a, pk: v.det, fds: projectFDs(a, fds) });
                    rem = getDiff(rem, getDiff(v.dep, v.det));
                }
                newT.push({ name: `${t.name}_Core`, attrs: rem, pk: t.pk.filter(a => rem.includes(a)).length > 0 ? t.pk.filter(a => rem.includes(a)) : rem, fds: projectFDs(rem, fds) });
            } else { newT.push(t); }
        }
        state.decompHistory.nf3 = newT; tables = newT;
    } else { state.decompHistory.nf3 = tables; }

    // BCNF
    if (!state.isBCNF) {
        const newT = [];
        for (const t of tables) {
            const viol = t.fds.filter(fd => !isSubset(fd.dep, fd.det) && !isSuperkey(fd.det, t.attrs, t.fds));
            if (viol.length > 0) {
                let rem = [...t.attrs];
                for (const v of viol) {
                    const a = getUnion(v.det, v.dep);
                    newT.push({ name: `${v.det.join('_')}_BCNF`, attrs: a, pk: v.det, fds: projectFDs(a, fds) });
                    rem = getDiff(rem, getDiff(v.dep, v.det));
                }
                newT.push({ name: `${t.name}_Rem`, attrs: rem, pk: rem, fds: projectFDs(rem, fds) });
            } else { newT.push(t); }
        }
        state.decompHistory.bcnf = newT; tables = newT;
    } else { state.decompHistory.bcnf = tables; }

    state.decomposedTables = tables;
}

// ─── CHASE ALGORITHM ─────────────────────────
function checkLosslessJoin() {
    const { decomposedTables: tables, attributes: attrs, fds } = state;
    if (tables.length <= 1) { state.isLossless = true; state.chaseSteps = []; return; }
    let tableau = tables.map((t, i) => {
        const row = {};
        attrs.forEach((a, j) => { row[a] = t.attrs.includes(a) ? { type: 'a', val: `a${j+1}` } : { type: 'b', val: `b${i+1}${j+1}` }; });
        return row;
    });
    const steps = [{ label: 'Initial Tableau', tableau: JSON.parse(JSON.stringify(tableau)) }];
    let changed = true, iter = 0;
    while (changed && iter < 50) {
        changed = false; iter++;
        for (const fd of fds) {
            const groups = {};
            tableau.forEach((row, ri) => { const k = fd.det.map(a => row[a].val).join('|'); if (!groups[k]) groups[k] = []; groups[k].push(ri); });
            for (const k of Object.keys(groups)) {
                const ri = groups[k]; if (ri.length < 2) continue;
                for (const da of fd.dep) {
                    const vals = ri.map(r => tableau[r][da]);
                    const best = vals.find(v => v.type === 'a') || vals[0];
                    for (const r of ri) { if (tableau[r][da].val !== best.val) { tableau[r][da] = { ...best }; changed = true; } }
                }
            }
        }
        if (changed) steps.push({ label: `After iteration ${iter}`, tableau: JSON.parse(JSON.stringify(tableau)) });
    }
    state.isLossless = tableau.some(row => attrs.every(a => row[a].type === 'a'));
    state.chaseSteps = steps;
}

// ─── FD PRESERVATION ─────────────────────────
function checkFDPreservation() {
    const { decomposedTables: tables, fds, attributes } = state;
    const results = []; let all = true;
    for (const fd of fds) {
        const fdStr = `${sortedStr(fd.det)} → ${sortedStr(fd.dep)}`;
        let found = false, foundIn = '';
        for (const t of tables) {
            if (isSubset(fd.det, t.attrs) && isSubset(fd.dep, t.attrs)) { found = true; foundIn = t.name; break; }
        }
        if (!found) {
            let cl = [...fd.det]; let ch = true;
            while (ch) { ch = false; for (const t of tables) { const lf = projectFDs(t.attrs, fds); const { closure } = computeClosure(cl.filter(a => t.attrs.includes(a)), lf); const nu = getUnion(cl, closure.filter(a => attributes.includes(a))); if (nu.length > cl.length) { cl = nu; ch = true; } } }
            if (isSubset(fd.dep, cl)) { found = true; foundIn = '(via closure)'; }
        }
        if (!found) all = false;
        results.push({ fd: fdStr, preserved: found, table: foundIn });
    }
    state.isFDPreserving = all; state.fdPresResults = results;
}

// ─── MAIN ANALYSIS ───────────────────────────
function parseAndAnalyze() {
    const sEl = document.getElementById('schemaInput');
    const fEl = document.getElementById('fdInput');
    if (!sEl || !fEl) return;
    const schemaText = sEl.value.trim();
    const fdText = fEl.value.trim();
    if (!schemaText) throw new Error('Please enter a relation schema');
    
    const schemaMatch = schemaText.match(/^([a-zA-Z0-9_\-]+)\s*\((.+)\)$/);
    if (!schemaMatch) throw new Error('Invalid schema format. Use R(A, B, C, ...)');
    
    const name = schemaMatch[1];
    const attrs = schemaMatch[2].split(',').map(a => a.trim()).filter(a => a);
    if (!name) throw new Error('Relation name is required.');
    if (attrs.length < 2) throw new Error('At least 2 attributes required.');
    if (!fdText) throw new Error('Functional dependencies are required.');

    const fds = [];
    for (let line of fdText.split('\n')) {
        line = line.trim(); if (!line) continue;
        const parts = line.split(/->|→/);
        if (parts.length !== 2) throw new Error(`Invalid FD: "${line}".`);
        const det = parts[0].split(',').map(a => a.trim()).filter(a => a);
        const dep = parts[1].split(',').map(a => a.trim()).filter(a => a);
        for (const a of [...det, ...dep]) { if (!attrs.includes(a)) throw new Error(`Attribute "${a}" not in schema.`); }
        fds.push({ det, dep });
    }

    state.relationName = name; state.attributes = attrs; state.fds = fds;

    // All closures (Slide 2)
    state.allClosures = computeAllClosures(attrs, fds);

    // Candidate keys (Slide 3)
    const { keys, log } = findCandidateKeys(attrs, fds);
    state.candidateKeys = keys; state.closureLog = log;
    const primeSet = new Set(); keys.forEach(k => k.forEach(a => primeSet.add(a)));
    state.primeAttrs = primeSet; state.nonPrimeAttrs = attrs.filter(a => !primeSet.has(a));

    // Canonical cover (Slide 4)
    const { cover, steps: ccSteps } = computeCanonicalCover(fds);
    state.canonicalCover = cover; state.canonicalCoverSteps = ccSteps;

    // NF checks
    state.is1NF = keys.length > 0;

    state.partialDeps = [];
    for (const fd of fds) for (const key of keys) {
        if (isSubset(fd.det, key) && fd.det.length < key.length) {
            const np = fd.dep.filter(a => !primeSet.has(a));
            if (np.length > 0) state.partialDeps.push({ det: fd.det, dep: np, key });
        }
    }
    state.is2NF = state.partialDeps.length === 0;

    state.transitiveDeps = [];
    for (const fd of fds) {
        if (isSubset(fd.dep, fd.det)) continue;
        if (!isSuperkey(fd.det, attrs, fds) && !fd.dep.every(a => primeSet.has(a)))
            state.transitiveDeps.push({ det: fd.det, dep: fd.dep });
    }
    state.is3NF = state.transitiveDeps.length === 0;

    state.bcnfViolations = [];
    for (const fd of fds) {
        if (isSubset(fd.dep, fd.det)) continue;
        if (!isSuperkey(fd.det, attrs, fds)) state.bcnfViolations.push({ det: fd.det, dep: fd.dep });
    }
    state.isBCNF = state.bcnfViolations.length === 0;

    state.originalHighestNF = state.isBCNF ? 'BCNF' : state.is3NF ? '3NF' : state.is2NF ? '2NF' : state.is1NF ? '1NF' : 'Not in 1NF';

    performDecomposition(); checkLosslessJoin(); checkFDPreservation();
    state.analyzed = true;
}
