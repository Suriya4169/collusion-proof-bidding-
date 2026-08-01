// Seedable Random Number Generator (Mulberry32)
function createRandom(seed) {
    let s = seed;
    return function() {
        let t = s += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Fixed Policy Weights for Legal Cases
const LEGAL_WEIGHTS = {
    minor_civil: 0.2,
    tax_violation: 0.3,
    labour_law: 0.5,
    environmental: 0.8,
    blacklisting: 0.8,
    corruption_fraud: 1.0
};

// Global State
let biddersState = [];
let selectedBidderId = null;
let simulationLogs = [];

// Parameter Defaults
let currentSeed = 42;
let currentCount = 20;
let currentAlpha = 1.0;
let currentBeta = 1.0;
let currentLambda = 0.8;

// Weights & Thresholds State (Synchronized dynamically)
let configWeights = { w1: 0.2, w2: 0.2, w3: 0.2, w4: 0.2, w5: 0.2 };
let configThresholds = { perf: 0.4, tech: 0.3, finance: 0.3, legal: 0.3 };

// DOM Elements
const tabItems = document.querySelectorAll(".nav-item");
const tabViews = document.querySelectorAll(".tab-view");
const activeTabTitle = document.getElementById("active-tab-title");

// Top-bar metrics
const topSeedDisplay = document.getElementById("top-seed-display");
const topBiddersDisplay = document.getElementById("top-bidders-display");

// Tab 1: Dashboard DOMs
const elStatDbCount = document.getElementById("stat-db-count");
const elStatDbPrice = document.getElementById("stat-db-price");
const elWinnerName = document.getElementById("winner-name-display");
const elWinnerScore = document.getElementById("winner-score-display");
const dashboardTableTbody = document.getElementById("dashboard-table-tbody");
const btnQuickReset = document.getElementById("btn-quick-reset");

// Tab 2: Bidders Database DOMs
const searchBiddersInput = document.getElementById("search-bidders-input");
const biddersTableTbody = document.getElementById("bidders-table-tbody");

// Tab 3: Config DOMs
const cfgWSliders = {
    w1: document.getElementById("cfg-w1"),
    w2: document.getElementById("cfg-w2"),
    w3: document.getElementById("cfg-w3"),
    w4: document.getElementById("cfg-w4"),
    w5: document.getElementById("cfg-w5")
};
const cfgWVals = {
    w1: document.getElementById("val-cfg-w1"),
    w2: document.getElementById("val-cfg-w2"),
    w3: document.getElementById("val-cfg-w3"),
    w4: document.getElementById("val-cfg-w4"),
    w5: document.getElementById("val-cfg-w5")
};
const cfgWeightSum = document.getElementById("cfg-weight-sum");
const cfgWeightSumBox = document.getElementById("cfg-weight-sum-box");

const cfgTSliders = {
    perf: document.getElementById("cfg-t-perf"),
    tech: document.getElementById("cfg-t-tech"),
    finance: document.getElementById("cfg-t-finance"),
    legal: document.getElementById("cfg-t-legal")
};
const cfgTVals = {
    perf: document.getElementById("val-cfg-t-perf"),
    tech: document.getElementById("val-cfg-t-tech"),
    finance: document.getElementById("val-cfg-t-finance"),
    legal: document.getElementById("val-cfg-t-legal")
};

const elCfgSeed = document.getElementById("cfg-seed");
const elCfgCount = document.getElementById("cfg-count");
const elCfgAlpha = document.getElementById("cfg-alpha");
const elCfgBeta = document.getElementById("cfg-beta");
const elCfgLambda = document.getElementById("cfg-lambda");
const btnCfgSave = document.getElementById("btn-cfg-save");

// Tab 4: Simulator DOMs
const simSelectBidder = document.getElementById("sim-select-bidder");
const simBidderDetailsCard = document.getElementById("sim-bidder-details-card");
const btnSimSuccess = document.getElementById("btn-sim-success");
const btnSimFailure = document.getElementById("btn-sim-failure");
const simLogsTbody = document.getElementById("sim-logs-tbody");

// Drawer DOMs
const inspectorDrawer = document.getElementById("inspector-drawer");
const drawerCloseBtn = document.getElementById("drawer-close-btn");
const drawerContent = document.getElementById("drawer-content");

// Initial Startup
function init() {
    setupNavigation();
    setupEventListeners();
    generateAndRender();
}

// Left Sidebar Tab Navigation Routing
function setupNavigation() {
    tabItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tab = item.getAttribute("data-tab");
            
            // Toggle sidebar active item
            tabItems.forEach(el => el.classList.remove("active"));
            item.classList.add("active");
            
            // Switch Active Header Text
            let title = "Dashboard";
            if (tab === "bidders") title = "Bidders Database";
            else if (tab === "config") title = "Parameters Config";
            else if (tab === "simulator") title = "Simulation Sandbox";
            activeTabTitle.innerText = title;
            
            // Switch Tab View display
            tabViews.forEach(view => {
                view.classList.remove("active");
                if (view.id === `view-${tab}`) {
                    view.classList.add("active");
                }
            });
            
            closeInspector();
        });
    });
}

// Bind interactive event callbacks
function setupEventListeners() {
    // Config apply changes button
    btnCfgSave.addEventListener("click", () => {
        currentSeed = parseInt(elCfgSeed.value) || 42;
        currentCount = parseInt(elCfgCount.value) || 20;
        currentAlpha = parseFloat(elCfgAlpha.value) || 1.0;
        currentBeta = parseFloat(elCfgBeta.value) || 1.0;
        currentLambda = parseFloat(elCfgLambda.value) || 0.8;
        
        generateAndRender();
        alert("Configuration updated and dataset regenerated successfully!");
    });

    // Reset parameters on Dashboard
    btnQuickReset.addEventListener("click", () => {
        resetToDefaults();
        generateAndRender();
    });

    // Search input keyup
    searchBiddersInput.addEventListener("input", renderBiddersRawList);

    // Weights Slider Event Listeners (Proportional Adjustment)
    Object.keys(cfgWSliders).forEach(key => {
        cfgWSliders[key].addEventListener("input", (e) => {
            adjustWeightsConfig(key, parseFloat(e.target.value));
            calculateAndRender();
        });
    });

    // Threshold Sliders Event Listeners
    Object.keys(cfgTSliders).forEach(key => {
        cfgTSliders[key].addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            configThresholds[key] = val;
            cfgTVals[key].innerText = val.toFixed(2);
            calculateAndRender();
        });
    });

    // Simulation Dropdown Target Select change
    simSelectBidder.addEventListener("change", renderSimulatorDetailsCard);

    // Sandbox Simulator Success Button
    btnSimSuccess.addEventListener("click", () => {
        triggerSimulationOutcome(1.0);
    });

    // Sandbox Simulator Failure Button
    btnSimFailure.addEventListener("click", () => {
        triggerSimulationOutcome(0.0);
    });

    // Close Inspector
    drawerCloseBtn.addEventListener("click", closeInspector);
}

// Reset configuration parameter inputs to spec defaults
function resetToDefaults() {
    configWeights = { w1: 0.2, w2: 0.2, w3: 0.2, w4: 0.2, w5: 0.2 };
    configThresholds = { perf: 0.4, tech: 0.3, finance: 0.3, legal: 0.3 };
    
    currentSeed = 42;
    currentCount = 20;
    currentAlpha = 1.0;
    currentBeta = 1.0;
    currentLambda = 0.8;

    // Apply to DOM sliders
    Object.keys(cfgWSliders).forEach(k => {
        cfgWSliders[k].value = 0.2;
        cfgWVals[k].innerText = "0.20";
    });
    cfgWeightSum.innerText = "1.00";
    cfgWeightSumBox.className = "sum-box";

    Object.keys(cfgTSliders).forEach(k => {
        cfgTSliders[k].value = configThresholds[k];
        cfgTVals[k].innerText = configThresholds[k].toFixed(2);
    });

    elCfgSeed.value = currentSeed;
    elCfgCount.value = currentCount;
    elCfgAlpha.value = currentAlpha;
    elCfgBeta.value = currentBeta;
    elCfgLambda.value = currentLambda;
}

// Adjust weights proportionally on slider drag to lock sum to 1.0
function adjustWeightsConfig(changedKey, value) {
    cfgWVals[changedKey].innerText = value.toFixed(2);
    configWeights[changedKey] = value;
    
    const keys = Object.keys(cfgWSliders);
    const otherKeys = keys.filter(k => k !== changedKey);
    
    const sumOthers = otherKeys.reduce((acc, k) => acc + parseFloat(cfgWSliders[k].value), 0);
    const targetRemaining = 1.0 - value;
    
    if (sumOthers > 0) {
        otherKeys.forEach(k => {
            const currentVal = parseFloat(cfgWSliders[k].value);
            const proportion = currentVal / sumOthers;
            const newVal = targetRemaining * proportion;
            cfgWSliders[k].value = newVal;
            cfgWVals[k].innerText = newVal.toFixed(2);
            configWeights[k] = newVal;
        });
    } else {
        const equalVal = targetRemaining / otherKeys.length;
        otherKeys.forEach(k => {
            cfgWSliders[k].value = equalVal;
            cfgWVals[k].innerText = equalVal.toFixed(2);
            configWeights[k] = equalVal;
        });
    }
    
    const total = keys.reduce((acc, k) => acc + parseFloat(cfgWSliders[k].value), 0);
    cfgWeightSum.innerText = total.toFixed(2);
    
    if (Math.abs(total - 1.0) > 0.01) {
        cfgWeightSumBox.className = "sum-box error";
    } else {
        cfgWeightSumBox.className = "sum-box";
    }
}

// Generate dataset
function generateAndRender() {
    const random = createRandom(currentSeed);
    const bidders = [];
    
    // Top-bar updates
    topSeedDisplay.innerText = currentSeed;
    topBiddersDisplay.innerText = currentCount;
    
    // 1. Edge Case: Brand-new bidder (Performance = 0.5 under uniform prior S=0, F=0)
    bidders.push({
        bidder_id: "B_brand_new",
        price: { bid_amount: 400000.0 },
        performance: { successful_projects: 0, failed_projects: 0 },
        legal: { minor_civil: 0, tax_violation: 0, labour_law: 0, environmental: 0, blacklisting: 0, corruption_fraud: 0 },
        financial: { liquidity: 0.7, credit_rating: 0.7, profitability: 0.5 },
        technical: { qualified_employees: 15, equipment_availability: 0.6, technology_maturity: 3.0, relevant_experience_years: 1.0 }
    });
    
    // 2. Edge Case: Legal test bidder (2 civil, 1 tax -> Legal_Trust = e^-0.7)
    bidders.push({
        bidder_id: "B_legal_test",
        price: { bid_amount: 450000.0 },
        performance: { successful_projects: 15, failed_projects: 1 },
        legal: { minor_civil: 2, tax_violation: 1, labour_law: 0, environmental: 0, blacklisting: 0, corruption_fraud: 0 },
        financial: { liquidity: 0.8, credit_rating: 0.8, profitability: 0.6 },
        technical: { qualified_employees: 25, equipment_availability: 0.8, technology_maturity: 6.0, relevant_experience_years: 8.0 }
    });
    
    // 3. Edge Case: Cheapest but weakest on technical/financial
    bidders.push({
        bidder_id: "B_cheap_but_weak",
        price: { bid_amount: 150000.0 },
        performance: { successful_projects: 10, failed_projects: 2 },
        legal: { minor_civil: 0, tax_violation: 0, labour_law: 0, environmental: 0, blacklisting: 0, corruption_fraud: 0 },
        financial: { liquidity: 0.1, credit_rating: 0.1, profitability: 0.05 },
        technical: { qualified_employees: 1, equipment_availability: 0.1, technology_maturity: 1.0, relevant_experience_years: 0.5 }
    });
    
    // 4. Edge Case: Fails a minimum threshold (S=1, F=15 -> Perf score ~0.11)
    bidders.push({
        bidder_id: "B_fails_threshold",
        price: { bid_amount: 250000.0 },
        performance: { successful_projects: 1, failed_projects: 15 },
        legal: { minor_civil: 0, tax_violation: 0, labour_law: 0, environmental: 0, blacklisting: 0, corruption_fraud: 0 },
        financial: { liquidity: 0.9, credit_rating: 0.9, profitability: 0.8 },
        technical: { qualified_employees: 80, equipment_availability: 0.95, technology_maturity: 9.0, relevant_experience_years: 15.0 }
    });
    
    // Generate randomized database remaining entries
    for (let i = 5; i <= currentCount; i++) {
        const bid_amount = Math.round(220000 + random() * 530000);
        const successful_projects = Math.floor(5 + random() * 45);
        const failed_projects = Math.floor(random() * 6);
        
        const minor_civil = random() < 0.2 ? (random() < 0.7 ? 1 : 2) : 0;
        const tax_violation = random() < 0.1 ? 1 : 0;
        
        bidders.push({
            bidder_id: `B${String(i).padStart(3, '0')}`,
            price: { bid_amount: bid_amount },
            performance: { successful_projects: successful_projects, failed_projects: failed_projects },
            legal: { minor_civil, tax_violation, labour_law: 0, environmental: 0, blacklisting: 0, corruption_fraud: 0 },
            financial: {
                liquidity: Math.round((0.4 + random() * 0.55) * 100) / 100,
                credit_rating: Math.round((0.5 + random() * 0.45) * 100) / 100,
                profitability: Math.round((0.2 + random() * 0.6) * 100) / 100
            },
            technical: {
                qualified_employees: Math.floor(10 + random() * 90),
                equipment_availability: Math.round((0.6 + random() * 0.4) * 100) / 100,
                technology_maturity: Math.floor(3 + random() * 8),
                relevant_experience_years: Math.floor(2 + random() * 19)
            }
        });
    }
    
    biddersState = bidders;
    
    // Populate dropdown selection on simulator tab
    populateSimulatorDropdown();
    
    calculateAndRender();
}

// Populate the target selection list in Simulator view
function populateSimulatorDropdown() {
    const prevSelectedVal = simSelectBidder.value;
    simSelectBidder.innerHTML = "";
    
    biddersState.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.bidder_id;
        opt.text = b.bidder_id;
        simSelectBidder.appendChild(opt);
    });
    
    if (prevSelectedVal && biddersState.some(b => b.bidder_id === prevSelectedVal)) {
        simSelectBidder.value = prevSelectedVal;
    }
    
    renderSimulatorDetailsCard();
}

// Render Simulator Details Card showing raw inputs
function renderSimulatorDetailsCard() {
    const targetId = simSelectBidder.value;
    const bidder = biddersState.find(b => b.bidder_id === targetId);
    if (!bidder) {
        simBidderDetailsCard.innerHTML = `<div style="grid-column: span 2; text-align:center;">No bidder selected.</div>`;
        return;
    }
    
    simBidderDetailsCard.innerHTML = `
        <div><span>Bidder ID:</span> <strong>${bidder.bidder_id}</strong></div>
        <div><span>Bid Amount:</span> $${bidder.price.bid_amount.toLocaleString()}</div>
        <div><span>Successes (S_i):</span> <strong style="color:var(--success); font-family:var(--font-mono);">${bidder.performance.successful_projects}</strong></div>
        <div><span>Failures (F_i):</span> <strong style="color:var(--danger); font-family:var(--font-mono);">${bidder.performance.failed_projects}</strong></div>
        <div><span>Legal Cases:</span> ${bidder.legal.minor_civil + bidder.legal.tax_violation} cases</div>
        <div><span>Profitability:</span> ${(bidder.financial.profitability * 100).toFixed(0)}%</div>
        <div><span>Employees:</span> ${bidder.technical.qualified_employees}</div>
        <div><span>Experience:</span> ${bidder.technical.relevant_experience_years} yrs</div>
    `;
}

// Compute scores for the pool
function calculateAndRender() {
    if (!biddersState.length) return;
    
    const prices = biddersState.map(b => b.price.bid_amount);
    const B_min = Math.min(...prices);
    
    const e_max = Math.max(...biddersState.map(b => b.technical.qualified_employees));
    const m_max = Math.max(...biddersState.map(b => b.technical.equipment_availability));
    const t_max = Math.max(...biddersState.map(b => b.technical.technology_maturity));
    const x_max = Math.max(...biddersState.map(b => b.technical.relevant_experience_years));
    
    // Financial products pool calculations
    const finProducts = biddersState.map(b => b.financial.liquidity * b.financial.credit_rating * b.financial.profitability);
    const minFinProd = Math.min(...finProducts);
    const maxFinProd = Math.max(...finProducts);
    const diffFinProd = maxFinProd - minFinProd;
    
    // Evaluate scores for all bidders
    const evaluatedBidders = biddersState.map(b => {
        const priceScore = B_min / b.price.bid_amount;
        const perfScore = (b.performance.successful_projects + currentAlpha) / (b.performance.successful_projects + b.performance.failed_projects + currentAlpha + currentBeta);
        
        let risk = 0.0;
        Object.keys(LEGAL_WEIGHTS).forEach(cat => {
            risk += (b.legal[cat] || 0) * LEGAL_WEIGHTS[cat];
        });
        const legalScore = Math.exp(-risk);
        
        const prod = b.financial.liquidity * b.financial.credit_rating * b.financial.profitability;
        const financialScore = diffFinProd === 0 ? 1.0 : (prod - minFinProd) / diffFinProd;
        
        const e_ratio = e_max > 0 ? b.technical.qualified_employees / e_max : 0.0;
        const m_ratio = m_max > 0 ? b.technical.equipment_availability / m_max : 0.0;
        const t_ratio = t_max > 0 ? b.technical.technology_maturity / t_max : 0.0;
        const x_ratio = x_max > 0 ? b.technical.relevant_experience_years / x_max : 0.0;
        const techScore = Math.pow(e_ratio, 0.3) * Math.pow(m_ratio, 0.2) * Math.pow(t_ratio, 0.2) * Math.pow(x_ratio, 0.3);
        
        // Confidences
        const c_price = 1.0;
        const c_perf = parseFloat(b.performance.successful_projects + b.performance.failed_projects);
        const c_legal = parseFloat(b.legal.minor_civil + b.legal.tax_violation);
        const c_finance = 1.0;
        const c_tech = 1.0;
        
        const sumC = c_price + c_perf + c_legal + c_finance + c_tech;
        const fusedTrust = sumC === 0 ? 
            (priceScore + perfScore + legalScore + financialScore + techScore) / 5 :
            ((c_price * priceScore) + (c_perf * perfScore) + (c_legal * legalScore) + (c_finance * financialScore) + (c_tech * techScore)) / sumC;
            
        const passedConstraints = (
            perfScore >= configThresholds.perf &&
            techScore >= configThresholds.tech &&
            financialScore >= configThresholds.finance &&
            legalScore >= configThresholds.legal
        );
        
        const compositeScore = passedConstraints ? (
            configWeights.w1 * priceScore +
            configWeights.w2 * perfScore +
            configWeights.w3 * legalScore +
            configWeights.w4 * financialScore +
            configWeights.w5 * techScore
        ) : null;
        
        return {
            ...b,
            scores: {
                price: priceScore,
                performance: perfScore,
                legal: legalScore,
                financial: financialScore,
                technical: techScore,
                fused: fusedTrust
            },
            composite: compositeScore,
            passed: passedConstraints,
            confidences: {
                price: c_price,
                performance: c_perf,
                legal: c_legal,
                financial: c_finance,
                technical: c_tech
            }
        };
    });
    
    // Sort and Rank
    const survivors = evaluatedBidders.filter(b => b.passed);
    survivors.sort((a, b) => b.composite - a.composite);
    const excluded = evaluatedBidders.filter(b => !b.passed);
    excluded.sort((a, b) => a.bidder_id.localeCompare(b.bidder_id));
    
    const rankedBidders = [...survivors, ...excluded];
    
    // Update Stats on Dashboard View
    elStatDbCount.innerText = evaluatedBidders.length;
    elStatDbPrice.innerText = `$${B_min.toLocaleString()}`;
    
    let winner = null;
    if (survivors.length > 0) {
        winner = survivors[0];
        elWinnerName.innerText = winner.bidder_id;
        elWinnerScore.innerText = `Composite Score: Z = ${winner.composite.toFixed(4)}`;
    } else {
        elWinnerName.innerText = "None";
        elWinnerScore.innerText = "All bidders failed thresholds";
    }
    
    // Render Dashboard Datatable
    renderDashboardRankingsTable(rankedBidders, winner, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd);
    
    // Render Bidders Database view
    renderBiddersRawList(evaluatedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd);
    
    // Update inspector drawer if open
    if (selectedBidderId) {
        updateInspector(evaluatedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd);
    }
}

// Render Dashboard Rankings Datatable
function renderDashboardRankingsTable(rankedBidders, winner, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd) {
    dashboardTableTbody.innerHTML = "";
    
    rankedBidders.forEach((b, idx) => {
        const isWinner = winner && b.bidder_id === winner.bidder_id;
        const tr = document.createElement("tr");
        
        if (isWinner) tr.classList.add("winner-row");
        if (!b.passed) tr.classList.add("excluded-row");
        if (selectedBidderId === b.bidder_id) tr.classList.add("selected-row");
        
        tr.innerHTML = `
            <td><strong>${idx + 1}</strong></td>
            <td>
                <strong>${b.bidder_id}</strong>
                ${isWinner ? ' <span class="badge badge-warning">🏆 Winner</span>' : ''}
            </td>
            <td class="text-right">${b.scores.price.toFixed(4)}</td>
            <td class="text-right">${b.scores.performance.toFixed(4)}</td>
            <td class="text-right">${b.scores.legal.toFixed(4)}</td>
            <td class="text-right">${b.scores.financial.toFixed(4)}</td>
            <td class="text-right">${b.scores.technical.toFixed(4)}</td>
            <td class="text-right" style="color:var(--accent); font-weight:600;">${b.scores.fused.toFixed(4)}</td>
            <td class="text-right" style="font-weight:700;">${b.composite !== null ? b.composite.toFixed(4) : '<span style="color:var(--text-muted);">Excluded</span>'}</td>
            <td>
                <span class="badge ${b.passed ? 'badge-success' : 'badge-danger'}">
                    ${b.passed ? 'Passed' : 'Failed'}
                </span>
            </td>
        `;
        
        tr.addEventListener("click", () => {
            selectBidder(b.bidder_id, rankedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd);
        });
        
        dashboardTableTbody.appendChild(tr);
    });
}

// Render Raw Bidders Database List
function renderBiddersRawList(evaluatedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd) {
    // If called by event listener, retrieve evaluated list first
    let list = biddersState;
    if (Array.isArray(evaluatedBidders)) {
        list = evaluatedBidders;
    } else {
        // Find them manually from the calculation pass
        calculateAndRender();
        return;
    }
    
    biddersTableTbody.innerHTML = "";
    
    // Apply search query filters
    const searchVal = searchBiddersInput.value.toLowerCase().trim();
    const filteredList = list.filter(b => b.bidder_id.toLowerCase().includes(searchVal));
    
    if (filteredList.length === 0) {
        biddersTableTbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted" style="padding:40px;">No matching bidders found in database.</td></tr>`;
        return;
    }
    
    filteredList.forEach(b => {
        const tr = document.createElement("tr");
        if (selectedBidderId === b.bidder_id) tr.classList.add("selected-row");
        
        tr.innerHTML = `
            <td><strong>${b.bidder_id}</strong></td>
            <td class="text-right">$${b.price.bid_amount.toLocaleString()}</td>
            <td class="text-right">${b.performance.successful_projects} / ${b.performance.failed_projects}</td>
            <td class="text-right">${b.legal.minor_civil} civ / ${b.legal.tax_violation} tax</td>
            <td class="text-right">${b.financial.liquidity.toFixed(2)}</td>
            <td class="text-right">${b.financial.credit_rating.toFixed(2)}</td>
            <td class="text-right">${b.financial.profitability.toFixed(2)}</td>
            <td class="text-right">${b.technical.qualified_employees}</td>
            <td class="text-right">${(b.technical.equipment_availability * 100).toFixed(0)}%</td>
            <td class="text-right">${b.technical.technology_maturity.toFixed(1)}</td>
            <td class="text-right">${b.technical.relevant_experience_years.toFixed(0)} yrs</td>
            <td><button class="btn-outline" style="padding:4px 8px; font-size:11px;">Inspect Calculations</button></td>
        `;
        
        tr.addEventListener("click", () => {
            selectBidder(b.bidder_id, list, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd);
        });
        
        biddersTableTbody.appendChild(tr);
    });
}

// Target select bidder detail drawer launcher
function selectBidder(bidderId, calculatedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd) {
    selectedBidderId = bidderId;
    
    // Highlight table rows across both views
    const dRows = dashboardTableTbody.querySelectorAll("tr");
    dRows.forEach(r => {
        r.classList.remove("selected-row");
        if (r.querySelector("td:nth-child(2)").innerText.includes(bidderId)) {
            r.classList.add("selected-row");
        }
    });

    const bRows = biddersTableTbody.querySelectorAll("tr");
    bRows.forEach(r => {
        r.classList.remove("selected-row");
        if (r.querySelector("strong").innerText.trim() === bidderId) {
            r.classList.add("selected-row");
        }
    });
    
    inspectorDrawer.classList.add("open");
    updateInspector(calculatedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd);
}

// Update detail calculations on slide panel drawer
function updateInspector(calculatedBidders, B_min, e_max, m_max, t_max, x_max, minFinProd, maxFinProd, diffFinProd) {
    const bidder = calculatedBidders.find(b => b.bidder_id === selectedBidderId);
    if (!bidder) return;
    
    // Current variables
    const alpha = currentAlpha;
    const beta = currentBeta;
    const lambdaVal = currentLambda;
    
    const riskSum = (bidder.legal.minor_civil * 0.2) + (bidder.legal.tax_violation * 0.3);
    const finProd = bidder.financial.liquidity * bidder.financial.credit_rating * bidder.financial.profitability;
    
    const e_ratio = e_max > 0 ? bidder.technical.qualified_employees / e_max : 0.0;
    const m_ratio = m_max > 0 ? bidder.technical.equipment_availability / m_max : 0.0;
    const t_ratio = t_max > 0 ? bidder.technical.technology_maturity / t_max : 0.0;
    const x_ratio = x_max > 0 ? bidder.technical.relevant_experience_years / x_max : 0.0;

    drawerContent.innerHTML = `
        <!-- Title Banner -->
        <div class="inspector-section">
            <h4 style="border:none; padding:0; color:var(--accent); font-size:15px; font-weight:700;">Bidder Profile: ${bidder.bidder_id}</h4>
            <p class="math-subtext">Detailed mathematical verification and scores mapping.</p>
        </div>

        <!-- Raw inputs grid -->
        <div class="inspector-section">
            <h4>Raw Bidder Inputs</h4>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div><span>Bid Price:</span> <strong>$${bidder.price.bid_amount.toLocaleString()}</strong></div>
                <div><span>Projects (S/F):</span> <strong>${bidder.performance.successful_projects} / ${bidder.performance.failed_projects}</strong></div>
                <div><span>Liquidity:</span> <strong>${bidder.financial.liquidity.toFixed(2)}</strong></div>
                <div><span>Credit Rating:</span> <strong>${bidder.financial.credit_rating.toFixed(2)}</strong></div>
                <div><span>Profitability:</span> <strong>${bidder.financial.profitability.toFixed(2)}</strong></div>
                <div><span>Employees:</span> <strong>${bidder.technical.qualified_employees}</strong></div>
                <div><span>Eq. Avail:</span> <strong>${(bidder.technical.equipment_availability * 100).toFixed(0)}%</strong></div>
                <div><span>Maturity:</span> <strong>${bidder.technical.technology_maturity.toFixed(1)}</strong></div>
                <div><span>Experience:</span> <strong>${bidder.technical.relevant_experience_years.toFixed(0)} yrs</strong></div>
            </div>
            <div style="font-size:11px; color:var(--text-sub); margin-top:2px;">
                <strong>Cases:</strong> Civil: ${bidder.legal.minor_civil} | Tax: ${bidder.legal.tax_violation} | Labour: ${bidder.legal.labour_law} | Env: ${bidder.legal.environmental}
            </div>
        </div>

        <!-- Price agent score -->
        <div class="inspector-section">
            <h4>1. Price Agent score (P_i)</h4>
            <div class="math-formula">P_i = B_min / B_i</div>
            <div class="math-step">
                B_min = $${B_min.toLocaleString()}<br>
                B_i = $${bidder.price.bid_amount.toLocaleString()}<br>
                <strong>Price Score = ${B_min} / ${bidder.price.bid_amount} = ${bidder.scores.price.toFixed(6)}</strong>
            </div>
        </div>

        <!-- Performance agent score -->
        <div class="inspector-section">
            <h4>2. Performance score (Perf_i)</h4>
            <div class="math-formula">Perf_i = (S_i + &alpha;) / (S_i + F_i + &alpha; + &beta;)</div>
            <div class="math-step">
                Successful Projects (S_i) = ${bidder.performance.successful_projects}<br>
                Failed Projects (F_i) = ${bidder.performance.failed_projects}<br>
                Beta Prior: &alpha; = ${alpha.toFixed(1)}, &beta; = ${beta.toFixed(1)}<br>
                <strong>Perf Score = (${bidder.performance.successful_projects} + ${alpha.toFixed(1)}) / (${bidder.performance.successful_projects} + ${bidder.performance.failed_projects} + ${alpha.toFixed(1)} + ${beta.toFixed(1)}) = ${bidder.scores.performance.toFixed(6)}</strong>
            </div>
        </div>

        <!-- Legal risk score -->
        <div class="inspector-section">
            <h4>3. Legal Trust score (L_i)</h4>
            <div class="math-formula">Risk_i = sum(cases_c &times; weight_c)<br>L_i = e^(-Risk_i)</div>
            <div class="math-step">
                Minor civil (wt: 0.20): ${bidder.legal.minor_civil}<br>
                Tax violation (wt: 0.30): ${bidder.legal.tax_violation}<br>
                Risk = (${bidder.legal.minor_civil} &times; 0.2) + (${bidder.legal.tax_violation} &times; 0.3) = ${riskSum.toFixed(2)}<br>
                <strong>Legal Score = e^(-${riskSum.toFixed(2)}) = ${bidder.scores.legal.toFixed(6)}</strong>
            </div>
        </div>

        <!-- Financial Score -->
        <div class="inspector-section">
            <h4>4. Financial score (F_i)</h4>
            <div class="math-formula">Prod_i = Liquidity &times; Credit &times; Profitability<br>F_i = (Prod_i - min_Prod) / (max_Prod - min_Prod)</div>
            <div class="math-step">
                Prod_i = ${bidder.financial.liquidity} &times; ${bidder.financial.credit_rating} &times; ${bidder.financial.profitability} = ${finProd.toFixed(6)}<br>
                Pool limits: min = ${minFinProd.toFixed(6)}, max = ${maxFinProd.toFixed(6)}<br>
                <strong>Financial Score = (${finProd.toFixed(6)} - ${minFinProd.toFixed(6)}) / ${diffFinProd.toFixed(6)} = ${bidder.scores.financial.toFixed(6)}</strong>
            </div>
        </div>

        <!-- Technical Cobb-Douglas score -->
        <div class="inspector-section">
            <h4>5. Technical score (Tech_i)</h4>
            <div class="math-formula">Tech_i = E_i^0.3 &times; M_i^0.2 &times; T_i^0.2 &times; X_i^0.3</div>
            <div class="math-step">
                Qualified employee ratio (E_i): ${e_ratio.toFixed(4)} (Employees: ${bidder.technical.qualified_employees} / max: ${e_max})<br>
                Equipment ratio (M_i): ${m_ratio.toFixed(4)}<br>
                Tech maturity ratio (T_i): ${t_ratio.toFixed(4)}<br>
                Relevant experience ratio (X_i): ${x_ratio.toFixed(4)}<br>
                <strong>Tech Score = (${e_ratio.toFixed(4)})^0.3 &times; (${m_ratio.toFixed(4)})^0.2 &times; (${t_ratio.toFixed(4)})^0.2 &times; (${x_ratio.toFixed(4)})^0.3 = ${bidder.scores.technical.toFixed(6)}</strong>
            </div>
        </div>

        <!-- Bayesian Fusion -->
        <div class="inspector-section">
            <h4>6. Bayesian Trust Fusion (T_i)</h4>
            <div class="math-formula">T_i = sum(C_j &times; T_ij) / sum(C_j)</div>
            <div class="math-step" style="display:flex; flex-direction:column; gap:4px;">
                <div class="row-inline"><span>Price (C = 1.0)</span><strong>Score: ${bidder.scores.price.toFixed(4)}</strong></div>
                <div class="row-inline"><span>Perf (C = ${bidder.confidences.performance.toFixed(1)})</span><strong>Score: ${bidder.scores.performance.toFixed(4)}</strong></div>
                <div class="row-inline"><span>Legal (C = ${bidder.confidences.legal.toFixed(1)})</span><strong>Score: ${bidder.scores.legal.toFixed(4)}</strong></div>
                <div class="row-inline"><span>Finance (C = 1.0)</span><strong>Score: ${bidder.scores.financial.toFixed(4)}</strong></div>
                <div class="row-inline"><span>Tech (C = 1.0)</span><strong>Score: ${bidder.scores.technical.toFixed(4)}</strong></div>
                <div class="row-inline" style="border-top:1px solid var(--border-color); padding-top:4px; margin-top:4px;">
                    <span>Total Confidence Sum</span><strong>${bidder.confidences.price + bidder.confidences.performance + bidder.confidences.legal + bidder.confidences.financial + bidder.confidences.technical}</strong>
                </div>
                <strong>Fused Trust Score = ${bidder.scores.fused.toFixed(6)}</strong>
            </div>
        </div>

        <!-- Threshold Evaluation -->
        <div class="inspector-section">
            <h4>7. Subject Constraints Check</h4>
            <div class="math-step">
                Perf (${bidder.scores.performance.toFixed(3)}) &ge; ${configThresholds.perf.toFixed(2)} &rarr; ${bidder.scores.performance >= configThresholds.perf ? '<span style="color:var(--success); font-weight:700;">PASS</span>' : '<span style="color:var(--danger); font-weight:700;">FAIL</span>'}<br>
                Tech (${bidder.scores.technical.toFixed(3)}) &ge; ${configThresholds.tech.toFixed(2)} &rarr; ${bidder.scores.technical >= configThresholds.tech ? '<span style="color:var(--success); font-weight:700;">PASS</span>' : '<span style="color:var(--danger); font-weight:700;">FAIL</span>'}<br>
                Finance (${bidder.scores.financial.toFixed(3)}) &ge; ${configThresholds.finance.toFixed(2)} &rarr; ${bidder.scores.financial >= configThresholds.finance ? '<span style="color:var(--success); font-weight:700;">PASS</span>' : '<span style="color:var(--danger); font-weight:700;">FAIL</span>'}<br>
                Legal (${bidder.scores.legal.toFixed(3)}) &ge; ${configThresholds.legal.toFixed(2)} &rarr; ${bidder.scores.legal >= configThresholds.legal ? '<span style="color:var(--success); font-weight:700;">PASS</span>' : '<span style="color:var(--danger); font-weight:700;">FAIL</span>'}<br>
                <div style="margin-top:6px; font-weight:700;">
                    Overall Constraints Status: ${bidder.passed ? '<span style="color:var(--success)">PASSED ALL</span>' : '<span style="color:var(--danger)">FAILED & EXCLUDED</span>'}
                </div>
                ${bidder.passed ? `Weighted Objective Score Z = <strong>${bidder.composite.toFixed(6)}</strong>` : 'Weighted Objective Score Z = <strong>Excluded (N/A)</strong>'}
            </div>
        </div>
    `;
}

// Close the side calculations inspector drawer
function closeInspector() {
    selectedBidderId = null;
    inspectorDrawer.classList.remove("open");
    
    // Clear selection CSS styles
    const dRows = dashboardTableTbody.querySelectorAll("tr");
    dRows.forEach(r => r.classList.remove("selected-row"));

    const bRows = biddersTableTbody.querySelectorAll("tr");
    bRows.forEach(r => r.classList.remove("selected-row"));
}

// Trigger Sandbox project outcomes success/failure simulation log
function triggerSimulationOutcome(observed) {
    const targetId = simSelectBidder.value;
    const bidder = biddersState.find(b => b.bidder_id === targetId);
    if (!bidder) return;
    
    // Extract pre-update trust score
    // We run the calculations first to extract current fused trust
    // Find bidder in evaluated bidders list
    const prices = biddersState.map(b => b.price.bid_amount);
    const B_min = Math.min(...prices);
    const e_max = Math.max(...biddersState.map(b => b.technical.qualified_employees));
    const m_max = Math.max(...biddersState.map(b => b.technical.equipment_availability));
    const t_max = Math.max(...biddersState.map(b => b.technical.technology_maturity));
    const x_max = Math.max(...biddersState.map(b => b.technical.relevant_experience_years));
    const finProducts = biddersState.map(b => b.financial.liquidity * b.financial.credit_rating * b.financial.profitability);
    const minFinProd = Math.min(...finProducts);
    const maxFinProd = Math.max(...finProducts);
    const diffFinProd = maxFinProd - minFinProd;
    
    // Calculate current fused trust for the bidder
    const priceScore = B_min / bidder.price.bid_amount;
    const perfScore = (bidder.performance.successful_projects + currentAlpha) / (bidder.performance.successful_projects + bidder.performance.failed_projects + currentAlpha + currentBeta);
    
    let risk = 0.0;
    Object.keys(LEGAL_WEIGHTS).forEach(cat => {
        risk += (bidder.legal[cat] || 0) * LEGAL_WEIGHTS[cat];
    });
    const legalScore = Math.exp(-risk);
    const prod = bidder.financial.liquidity * bidder.financial.credit_rating * bidder.financial.profitability;
    const financialScore = diffFinProd === 0 ? 1.0 : (prod - minFinProd) / diffFinProd;
    
    const e_ratio = e_max > 0 ? bidder.technical.qualified_employees / e_max : 0.0;
    const m_ratio = m_max > 0 ? bidder.technical.equipment_availability / m_max : 0.0;
    const t_ratio = t_max > 0 ? bidder.technical.technology_maturity / t_max : 0.0;
    const x_ratio = x_max > 0 ? bidder.technical.relevant_experience_years / x_max : 0.0;
    const techScore = Math.pow(e_ratio, 0.3) * Math.pow(m_ratio, 0.2) * Math.pow(t_ratio, 0.2) * Math.pow(x_ratio, 0.3);
    
    const c_price = 1.0;
    const c_perf = parseFloat(bidder.performance.successful_projects + bidder.performance.failed_projects);
    const c_legal = parseFloat(bidder.legal.minor_civil + bidder.legal.tax_violation);
    const c_finance = 1.0;
    const c_tech = 1.0;
    
    const sumC = c_price + c_perf + c_legal + c_finance + c_tech;
    const oldFused = sumC === 0 ? 
        (priceScore + perfScore + legalScore + financialScore + techScore) / 5 :
        ((c_price * priceScore) + (c_perf * perfScore) + (c_legal * legalScore) + (c_finance * financialScore) + (c_tech * techScore)) / sumC;
        
    // Execute Dynamic trust update simulation
    // S_i / F_i increments represent data history which updates the performance and fused trust
    if (observed === 1.0) {
        bidder.performance.successful_projects += 1;
    } else {
        bidder.performance.failed_projects += 1;
    }
    
    // Calculate new fused trust score after incrementing projects
    const new_c_perf = parseFloat(bidder.performance.successful_projects + bidder.performance.failed_projects);
    const new_perfScore = (bidder.performance.successful_projects + currentAlpha) / (bidder.performance.successful_projects + bidder.performance.failed_projects + currentAlpha + currentBeta);
    const new_sumC = c_price + new_c_perf + c_legal + c_finance + c_tech;
    const newFused = ((c_price * priceScore) + (new_c_perf * new_perfScore) + (c_legal * legalScore) + (c_finance * financialScore) + (c_tech * techScore)) / new_sumC;
    
    // Log simulation steps
    const step = simulationLogs.length + 1;
    simulationLogs.unshift({
        step: step,
        bidder_id: targetId,
        outcome: observed === 1.0 ? "SUCCESS" : "FAILURE",
        s: bidder.performance.successful_projects,
        f: bidder.performance.failed_projects,
        old_fused: oldFused,
        new_fused: newFused
    });
    
    // Re-run global calculations
    calculateAndRender();
    
    // Render sandbox details and logs
    renderSimulatorDetailsCard();
    renderSimulatorLogsTable();
}

// Render Sandbox Logs Datatable
function renderSimulatorLogsTable() {
    if (simulationLogs.length === 0) {
        simLogsTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">No simulations logged yet. Use the control card on the left to start.</td></tr>`;
        return;
    }
    
    simLogsTbody.innerHTML = "";
    simulationLogs.forEach(log => {
        const tr = document.createElement("tr");
        
        tr.innerHTML = `
            <td><strong>#${log.step}</strong></td>
            <td><strong>${log.bidder_id}</strong></td>
            <td>
                <span class="badge ${log.outcome === 'SUCCESS' ? 'badge-success' : 'badge-danger'}">
                    ${log.outcome}
                </span>
            </td>
            <td class="text-right">${log.s}</td>
            <td class="text-right">${log.f}</td>
            <td class="text-right">${log.old_fused.toFixed(4)}</td>
            <td class="text-right" style="color:var(--accent); font-weight:600;">${log.new_fused.toFixed(4)}</td>
        `;
        
        simLogsTbody.appendChild(tr);
    });
}

// Kickstart script on DOM loaded
window.addEventListener("DOMContentLoaded", init);
