const CONFIG = window.COGS_CONFIG || {};
const SUPABASE_URL = CONFIG.supabaseUrl || "";
const SUPABASE_ANON_KEY = CONFIG.supabaseAnonKey || "";
const supabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const els = {
  app: document.getElementById("app"),
  authPanel: document.getElementById("authPanel"),
  setupPanel: document.getElementById("setupPanel"),
  sessionBadge: document.getElementById("sessionBadge"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  globalSearch: document.getElementById("globalSearch"),
  workbookFile: document.getElementById("workbookFile"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  importStatus: document.getElementById("importStatus"),
  workspace: document.getElementById("workspace"),
  moduleTabs: document.querySelectorAll(".moduleTab"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  modalContent: document.getElementById("modalContent"),
  modalCloseBtn: document.getElementById("modalCloseBtn")
};

const COST_GROUPS = [
  ["Oils", "A", "B", "C"],
  ["Butters", "E", "F", "G"],
  ["Emulsifiers", "I", "J", "K"],
  ["Surfactants", "M", "N", "O"],
  ["Humectants", "Q", "R", "S"],
  ["Powder Additives", "U", "V", "W"],
  ["Extracts Oil Soluble", "Y", "Z", "AA"],
  ["Extracts Water Soluble", "AC", "AD", "AE"],
  ["Proteins", "AG", "AH", "AI"],
  ["Bases", "AK", "AL", "AM"],
  ["Wax", "AO", "AP", "AQ"],
  ["Exfoliants", "AS", "AT", "AU"],
  ["Water Based Additives", "AW", "AX", "AY"],
  ["Preservatives", "BA", "BB", "BC"],
  ["Other", "BE", "BF", "BG"],
  ["Salts", "BH", "BI", "BJ"],
  ["Packaging", "BK", null, null, "BL"],
  ["Accessories", "BO", null, null, "BP"],
  ["Kits", "BQ", null, null, "BR"],
  ["Essential Oils and Fragrance", "BW", "BX", "BY"],
  ["Simmer Pot Ingredients", "CV", null, null, "CW"],
  ["Room Spray Ingredients", "DD", "DE", null, "DE"]
];

const FORMULA_GROUPS = [
  ["Bath Additives", "BT"],
  ["Hair Formulations", "BZ"],
  ["Soap Formulations", "CH"],
  ["Face Formulations", "CL"],
  ["Lip Products", "CP"],
  ["Moisturizers and Body", "CR"],
  ["Simmer Pots", "CV"],
  ["All-Purpose Cleaner", "CY"],
  ["Room Spray", "DB"],
  ["Shower Steamers", "DG"],
  ["Natural Cream Deodorant", "DK"],
  ["Gift Sets", "DP"]
].map(([name, col]) => ({ name, col, index: colToNumber(col) }));

const state = {
  user: null,
  view: "dashboard",
  query: "",
  activeCostGroup: "",
  activeFormulaGroup: "",
  selectedItemId: "",
  selectedFormulaId: "",
  categories: [],
  items: [],
  formulas: [],
  lines: [],
  cells: [],
  priceHistory: []
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4
  }).format(amount);
}

function number(value, digits = 4) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toFixed(digits).replace(/\.?0+$/, "");
}

function whole(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function dateShort(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnit(unit) {
  const value = String(unit || "").toLowerCase().trim();
  if (["g", "gm", "gram", "grams"].includes(value)) return "g";
  if (["oz", "ounce", "ounces"].includes(value)) return "oz";
  if (["each", "ea", "unit", "units", "tube", "jar", "bottle", "bag", "box", "set"].includes(value)) return "unit";
  return value || "unit";
}

function colToNumber(col) {
  return String(col).split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function numberToCol(num) {
  let col = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    num = Math.floor((num - rem) / 26);
  }
  return col;
}

function splitCellRef(ref) {
  const match = String(ref || "").match(/^([A-Z]+)(\d+)$/);
  return match ? { col: match[1], colIndex: colToNumber(match[1]), row: Number(match[2]) } : null;
}

function sourceCellList(group) {
  return [group[1], group[2], group[3], group[4]].filter(Boolean).join(", ");
}

function formulaRefs(expression) {
  return Array.from(new Set(String(expression || "").match(/\b[A-Z]{1,3}\d+\b/g) || []));
}

function getCategoryName(id) {
  return state.categories.find((category) => category.id === id)?.name || "Uncategorized";
}

function itemGroupName(item) {
  return getCategoryName(item.category_id);
}

function getItemCosts(item, overrides = {}) {
  const override = overrides.items?.[item.id] || {};
  return {
    cost_per_oz: override.cost_per_oz ?? item.cost_per_oz,
    cost_per_gram: override.cost_per_gram ?? item.cost_per_gram,
    cost_per_unit: override.cost_per_unit ?? item.cost_per_unit
  };
}

function hasCost(item) {
  const costs = getItemCosts(item);
  return [costs.cost_per_oz, costs.cost_per_gram, costs.cost_per_unit].some((value) => Number(value) > 0);
}

function bestCostLabel(item) {
  const costs = getItemCosts(item);
  if (Number(costs.cost_per_unit) > 0) return `${money(costs.cost_per_unit)} / unit`;
  if (Number(costs.cost_per_gram) > 0) return `${money(costs.cost_per_gram)} / g`;
  if (Number(costs.cost_per_oz) > 0) return `${money(costs.cost_per_oz)} / oz`;
  return "Missing";
}

function matchesQuery(value) {
  if (!state.query) return true;
  return String(value || "").toLowerCase().includes(state.query.toLowerCase());
}

function showStatus(message, type = "info") {
  els.importStatus.textContent = message;
  els.importStatus.className = `statusBanner ${type === "error" ? "error" : ""}`;
  els.importStatus.style.display = "block";
}

function hideStatus() {
  els.importStatus.style.display = "none";
}

async function login() {
  if (!supabaseClient) return;
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    return;
  }
  await checkSession();
}

async function logout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  state.user = null;
  els.authPanel.style.display = "block";
  els.app.style.display = "none";
  els.sessionBadge.textContent = "Not connected";
}

async function checkSession() {
  if (!supabaseClient) {
    els.setupPanel.style.display = "block";
    els.authPanel.style.display = "none";
    els.app.style.display = "none";
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    els.authPanel.style.display = "block";
    els.app.style.display = "none";
    els.sessionBadge.textContent = "Not connected";
    return;
  }

  state.user = session.user;
  els.authPanel.style.display = "none";
  els.app.style.display = "block";
  els.sessionBadge.textContent = session.user.email || "Logged in";
  await loadWorkspace();
}

async function loadWorkspace() {
  hideStatus();
  const [categories, items, formulas, lines, cells, history] = await Promise.all([
    supabaseClient.from("cogs_categories").select("*").order("sort_order").order("name"),
    supabaseClient.from("cogs_cost_items").select("*").order("name"),
    supabaseClient.from("cogs_formulas").select("*").order("category").order("name"),
    supabaseClient.from("cogs_formula_lines").select("*").order("sort_order"),
    supabaseClient.from("cogs_workbook_cells").select("*"),
    supabaseClient.from("cogs_price_history").select("*").order("changed_at", { ascending: false }).limit(50)
  ]);

  const error = [categories, items, formulas, lines, cells, history].find((result) => result.error)?.error;
  if (error) {
    showStatus(`Unable to load COGS tables: ${error.message}. Run the Supabase migration first.`, "error");
    return;
  }

  state.categories = categories.data || [];
  state.items = items.data || [];
  state.formulas = formulas.data || [];
  state.lines = lines.data || [];
  state.cells = cells.data || [];
  state.priceHistory = history.data || [];

  if (!state.selectedItemId && state.items[0]) state.selectedItemId = state.items[0].id;
  if (!state.selectedFormulaId && state.formulas[0]) state.selectedFormulaId = state.formulas[0].id;
  render();
}

function render() {
  els.moduleTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.view);
  });

  if (state.view === "dashboard") renderDashboard();
  if (state.view === "costs") renderCostLibrary();
  if (state.view === "formulas") renderFormulaBook();
  if (state.view === "updates") renderPriceUpdates();
  if (state.view === "exceptions") renderExceptions();
  bindDynamicControls();
}

function dashboardStats() {
  const issues = getIssues();
  const missingCosts = state.items.filter((item) => !hasCost(item));
  const formulaTotals = state.formulas.map((formula) => formulaBreakdown(formula));
  const costTotal = formulaTotals.reduce((sum, formula) => sum + formula.total, 0);
  const formulasWithDiff = formulaTotals.filter((formula) => Math.abs(formula.delta) > 0.01);

  return {
    issues,
    missingCosts,
    formulaTotals,
    costTotal,
    formulasWithDiff
  };
}

function renderDashboard() {
  const stats = dashboardStats();
  const topFormulas = [...stats.formulaTotals]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const issuePreview = stats.issues.slice(0, 6);

  els.workspace.innerHTML = `
    <section class="dashboardGrid">
      <div class="metricCard">
        <span class="kicker">Cost items</span>
        <strong>${whole(state.items.length)}</strong>
        <span>${whole(state.categories.length)} workbook groups</span>
      </div>
      <div class="metricCard">
        <span class="kicker">Formulas</span>
        <strong>${whole(state.formulas.length)}</strong>
        <span>${whole(state.lines.length)} parsed formula refs</span>
      </div>
      <div class="metricCard">
        <span class="kicker">Needs attention</span>
        <strong>${whole(stats.issues.length)}</strong>
        <span>${whole(stats.missingCosts.length)} missing material costs</span>
      </div>
      <div class="metricCard">
        <span class="kicker">Formula COGS total</span>
        <strong>${money(stats.costTotal)}</strong>
        <span>${whole(stats.formulasWithDiff.length)} differ from workbook values</span>
      </div>
    </section>

    <section class="workbookMap">
      <div class="panel">
        <div class="panelHeader">
          <div>
            <div class="kicker">Spreadsheet cost columns</div>
            <h2>Cost Library</h2>
          </div>
          <button class="smallBtn" type="button" data-action="go-view" data-view="costs">Open</button>
        </div>
        <div class="groupGrid">
          ${COST_GROUPS.map((group) => groupCardHtml({
            name: group[0],
            meta: `${sourceCellList(group)} columns`,
            count: state.items.filter((item) => itemGroupName(item) === group[0]).length,
            action: "pick-cost-group",
            attr: "data-cost-group",
            value: group[0]
          })).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panelHeader">
          <div>
            <div class="kicker">Spreadsheet formula columns</div>
            <h2>Formula Book</h2>
          </div>
          <button class="smallBtn" type="button" data-action="go-view" data-view="formulas">Open</button>
        </div>
        <div class="groupGrid">
          ${FORMULA_GROUPS.map((group) => groupCardHtml({
            name: group.name,
            meta: `${group.col}+ formula block`,
            count: state.formulas.filter((formula) => formula.category === group.name).length,
            action: "pick-formula-group",
            attr: "data-formula-group",
            value: group.name
          })).join("")}
        </div>
      </div>
    </section>

    <section class="twoColumn">
      <div class="panel">
        <div class="panelHeader">
          <div>
            <div class="kicker">Highest calculated COGS</div>
            <h2>Formula Watchlist</h2>
          </div>
        </div>
        <div class="recentList">
          ${topFormulas.map(({ formula, total, lines, unresolved }) => `
            <button class="recentItem" type="button" data-action="select-formula" data-formula-id="${formula.id}" data-target-view="formulas">
              <span>
                <strong>${escapeHtml(formula.name)}</strong>
                <span class="small">${escapeHtml(formula.category)} · ${lines.length} refs${unresolved ? ` · ${unresolved} unresolved` : ""}</span>
              </span>
              <strong>${money(total)}</strong>
            </button>
          `).join("") || `<div class="emptyState">No formulas imported yet.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panelHeader">
          <div>
            <div class="kicker">Cost integrity</div>
            <h2>Exceptions</h2>
          </div>
          <button class="smallBtn" type="button" data-action="go-view" data-view="exceptions">Review</button>
        </div>
        <div class="issueList">
          ${issuePreview.map(issueCardHtml).join("") || `<div class="emptyState">No exceptions detected.</div>`}
        </div>
      </div>
    </section>
  `;
}

function groupCardHtml({ name, meta, count, action, attr, value }) {
  return `
    <button class="groupCard" type="button" data-action="${action}" ${attr}="${escapeHtml(value)}">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(meta)}</span>
      <span class="tag">${whole(count)} records</span>
    </button>
  `;
}

function renderCostLibrary() {
  const items = filteredItems();
  const selected = items.find((item) => item.id === state.selectedItemId) || items[0] || null;
  if (selected && state.selectedItemId !== selected.id) state.selectedItemId = selected.id;

  els.workspace.innerHTML = `
    <section class="libraryLayout">
      <aside class="panel sideRail">
        <div class="sectionTitle">Workbook cost groups</div>
        <div class="filterList">
          <button class="filterBtn ${state.activeCostGroup ? "" : "active"}" type="button" data-action="set-cost-group" data-cost-group="">
            <strong>All</strong><span>${state.items.length}</span>
          </button>
          ${COST_GROUPS.map((group) => {
            const count = state.items.filter((item) => itemGroupName(item) === group[0]).length;
            return `
              <button class="filterBtn ${state.activeCostGroup === group[0] ? "active" : ""}" type="button" data-action="set-cost-group" data-cost-group="${escapeHtml(group[0])}">
                <strong>${escapeHtml(group[0])}</strong><span>${count}</span>
              </button>
            `;
          }).join("")}
        </div>
      </aside>

      <div class="twoColumn">
        <section class="panel">
          <div class="panelHeader">
            <div>
              <div class="kicker">Materials, packaging, and components</div>
              <h2>${escapeHtml(state.activeCostGroup || "All Cost Groups")}</h2>
            </div>
            <div class="recordCount">${items.length} records</div>
          </div>
          <div class="dataTableWrap">
            <table class="dataTable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Group</th>
                  <th class="numeric">Cost / oz</th>
                  <th class="numeric">Cost / g</th>
                  <th class="numeric">Cost / unit</th>
                  <th>Sheet cells</th>
                  <th class="numeric">Formulas</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(itemRowHtml).join("") || `<tr><td colspan="7" class="emptyState">No matching cost items.</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel detailPanel">
          ${selected ? itemDetailHtml(selected, "library") : `<div class="emptyState">Select a cost item.</div>`}
        </section>
      </div>
    </section>
  `;
}

function filteredItems() {
  return [...state.items]
    .filter((item) => {
      const group = itemGroupName(item);
      const haystack = `${item.name} ${group} ${item.supplier || ""} ${item.notes || ""}`;
      return (!state.activeCostGroup || group === state.activeCostGroup) && matchesQuery(haystack);
    })
    .sort((a, b) => {
      const groupA = COST_GROUPS.findIndex((group) => group[0] === itemGroupName(a));
      const groupB = COST_GROUPS.findIndex((group) => group[0] === itemGroupName(b));
      return (groupA - groupB) || a.name.localeCompare(b.name);
    });
}

function itemRowHtml(item) {
  const sourceCells = Object.values(item.source_cells || {}).filter(Boolean).join(", ");
  return `
    <tr class="dataRow ${state.selectedItemId === item.id ? "active" : ""}" data-action="select-item" data-item-id="${item.id}">
      <td><strong>${escapeHtml(item.name)}</strong><div class="small">${escapeHtml(item.supplier || "")}</div></td>
      <td>${escapeHtml(itemGroupName(item))}</td>
      <td class="numeric">${money(item.cost_per_oz)}</td>
      <td class="numeric">${money(item.cost_per_gram)}</td>
      <td class="numeric">${money(item.cost_per_unit)}</td>
      <td><span class="small">${escapeHtml(sourceCells || item.source_name_cell || "-")}</span></td>
      <td class="numeric">${formulasAffectedByItem(item).length}</td>
    </tr>
  `;
}

function itemDetailHtml(item, context = "updates") {
  const affected = formulasAffectedByItem(item);
  return `
    <div class="detailGrid">
      <div>
        <div class="kicker">${escapeHtml(itemGroupName(item))}</div>
        <h2>${escapeHtml(item.name)}</h2>
        <div class="small">${escapeHtml(item.source_name_cell || "Manual item")} · ${escapeHtml(Object.values(item.source_cells || {}).filter(Boolean).join(", ") || "No linked cost cells")}</div>
      </div>

      <div class="inlineMetrics">
        <div class="miniMetric"><span>Cost / oz</span><strong>${money(item.cost_per_oz)}</strong></div>
        <div class="miniMetric"><span>Cost / g</span><strong>${money(item.cost_per_gram)}</strong></div>
        <div class="miniMetric"><span>Cost / unit</span><strong>${money(item.cost_per_unit)}</strong></div>
      </div>

      <div class="fieldGrid">
        <label><span class="fieldLabel">Purchase price</span><input id="itemPurchasePrice" type="number" step="0.0001" value="${number(item.purchase_price)}"></label>
        <label><span class="fieldLabel">Purchase quantity</span><input id="itemPurchaseQty" type="number" step="0.0001" value="${number(item.purchase_quantity)}"></label>
        <label><span class="fieldLabel">Purchase unit</span><input id="itemPurchaseUnit" value="${escapeHtml(item.purchase_unit || "")}"></label>
        <label><span class="fieldLabel">Supplier</span><input id="itemSupplier" value="${escapeHtml(item.supplier || "")}"></label>
        <label><span class="fieldLabel">Cost per oz</span><input id="itemCostOz" type="number" step="0.0001" value="${number(item.cost_per_oz)}"></label>
        <label><span class="fieldLabel">Cost per gram</span><input id="itemCostGram" type="number" step="0.0001" value="${number(item.cost_per_gram)}"></label>
        <label><span class="fieldLabel">Cost per unit</span><input id="itemCostUnit" type="number" step="0.0001" value="${number(item.cost_per_unit)}"></label>
      </div>
      <label class="fullField"><span class="fieldLabel">Notes</span><textarea id="itemNotes">${escapeHtml(item.notes || "")}</textarea></label>

      <div class="buttonRow">
        <button id="saveItemBtn" class="primaryBtn" type="button" data-action="save-item" data-item-id="${item.id}">Save price update</button>
        <button id="recalcFromPurchaseBtn" class="mutedBtn" type="button" data-action="recalc-item">Calculate from purchase</button>
      </div>

      ${context === "updates" ? `<div id="impactPreview">${impactPreviewHtml(item, draftOverrideFromForm(item))}</div>` : affectedFormulaListHtml(item, affected)}
    </div>
  `;
}

function affectedFormulaListHtml(item, affected = formulasAffectedByItem(item)) {
  return `
    <section>
      <div class="splitHeader">
        <h3>Affected formulas</h3>
        <span class="recordCount">${affected.length}</span>
      </div>
      <div class="affectedList">
        ${affected.map((formula) => `
          <button class="affectedItem" type="button" data-action="select-formula" data-formula-id="${formula.id}" data-target-view="formulas">
            <span>
              <strong>${escapeHtml(formula.name)}</strong>
              <span class="small">${escapeHtml(formula.category || "")}</span>
            </span>
            <strong>${money(evaluateFormula(formula))}</strong>
          </button>
        `).join("") || `<div class="small">No formula references this item yet.</div>`}
      </div>
    </section>
  `;
}

function renderFormulaBook() {
  const formulas = filteredFormulas();
  const selected = formulas.find((formula) => formula.id === state.selectedFormulaId) || formulas[0] || null;
  if (selected && state.selectedFormulaId !== selected.id) state.selectedFormulaId = selected.id;

  els.workspace.innerHTML = `
    <section class="libraryLayout">
      <aside class="panel sideRail">
        <div class="sectionTitle">Workbook formula groups</div>
        <div class="filterList">
          <button class="filterBtn ${state.activeFormulaGroup ? "" : "active"}" type="button" data-action="set-formula-group" data-formula-group="">
            <strong>All</strong><span>${state.formulas.length}</span>
          </button>
          ${FORMULA_GROUPS.map((group) => {
            const count = state.formulas.filter((formula) => formula.category === group.name).length;
            return `
              <button class="filterBtn ${state.activeFormulaGroup === group.name ? "active" : ""}" type="button" data-action="set-formula-group" data-formula-group="${escapeHtml(group.name)}">
                <strong>${escapeHtml(group.name)}</strong><span>${count}</span>
              </button>
            `;
          }).join("")}
        </div>
      </aside>

      <div class="twoColumn">
        <section class="panel">
          <div class="panelHeader">
            <div>
              <div class="kicker">Parsed workbook formulas</div>
              <h2>${escapeHtml(state.activeFormulaGroup || "All Formula Groups")}</h2>
            </div>
            <div class="recordCount">${formulas.length} records</div>
          </div>
          <div class="formulaGrid">
            ${formulas.map(formulaCardHtml).join("") || `<div class="emptyState">No matching formulas.</div>`}
          </div>
        </section>

        <section class="panel detailPanel">
          ${selected ? formulaDetailHtml(selected) : `<div class="emptyState">Select a formula.</div>`}
        </section>
      </div>
    </section>
  `;
}

function filteredFormulas() {
  return [...state.formulas]
    .filter((formula) => {
      const haystack = `${formula.name} ${formula.category || ""} ${formula.label || ""} ${formula.notes || ""} ${formula.source_cell || ""}`;
      return (!state.activeFormulaGroup || formula.category === state.activeFormulaGroup) && matchesQuery(haystack);
    })
    .sort((a, b) => {
      const groupA = FORMULA_GROUPS.findIndex((group) => group.name === a.category);
      const groupB = FORMULA_GROUPS.findIndex((group) => group.name === b.category);
      return (groupA - groupB) || String(a.source_cell || "").localeCompare(String(b.source_cell || ""));
    });
}

function formulaCardHtml(formula) {
  const breakdown = formulaBreakdown(formula);
  return `
    <button class="formulaCard ${state.selectedFormulaId === formula.id ? "active" : ""}" type="button" data-action="select-formula" data-formula-id="${formula.id}">
      <span class="tag">${escapeHtml(formula.source_cell || "")}</span>
      <strong>${escapeHtml(formula.name)}</strong>
      <span>${escapeHtml(formula.category || "Formula")}${formula.label ? ` · ${escapeHtml(formula.label)}` : ""}</span>
      <div class="formulaMetrics">
        <div class="miniMetric"><span>COGS</span><strong>${money(breakdown.total)}</strong></div>
        <div class="miniMetric"><span>Refs</span><strong>${breakdown.lines.length}</strong></div>
        <div class="miniMetric"><span>Delta</span><strong>${money(breakdown.delta)}</strong></div>
      </div>
    </button>
  `;
}

function formulaDetailHtml(formula, overrides = {}) {
  const breakdown = formulaBreakdown(formula, overrides);
  const deltaClass = Math.abs(breakdown.delta) <= 0.01 ? "good" : "warn";
  return `
    <div class="detailGrid">
      <div>
        <div class="kicker">${escapeHtml(formula.category || "Formula")}</div>
        <h2>${escapeHtml(formula.name)}</h2>
        <div class="small">${escapeHtml(formula.source_cell || "")}${formula.label ? ` · ${escapeHtml(formula.label)}` : ""}</div>
      </div>

      <div class="inlineMetrics">
        <div class="miniMetric"><span>Calculated COGS</span><strong>${money(breakdown.total)}</strong></div>
        <div class="miniMetric"><span>Workbook value</span><strong>${money(formula.workbook_value)}</strong></div>
        <div class="miniMetric"><span>Delta</span><strong><span class="deltaPill ${deltaClass}">${money(breakdown.delta)}</span></strong></div>
      </div>

      <div class="small"><code>=${escapeHtml(formula.formula_expression || "")}</code></div>
      <div class="dataTableWrap">
        <table class="lineTable">
          <thead><tr><th>Ref</th><th>Component</th><th>Qty</th><th>Unit</th><th>Type</th><th class="numeric">Line cost</th></tr></thead>
          <tbody>
            ${breakdown.lines.map((line) => `
              <tr>
                <td>${escapeHtml(line.source_cell_ref || "")}</td>
                <td>${line.item ? `<button class="smallBtn" type="button" data-action="select-item" data-item-id="${line.item.id}" data-target-view="costs">${escapeHtml(line.name)}</button>` : escapeHtml(line.name)}</td>
                <td>${number(line.quantity, 3) || "-"}</td>
                <td>${escapeHtml(line.unit || "")}</td>
                <td>${escapeHtml(line.type)}</td>
                <td class="numeric">${money(line.cost)}</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="small">No parsed line refs for this formula.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPriceUpdates() {
  const items = filteredItems()
    .sort((a, b) => formulasAffectedByItem(b).length - formulasAffectedByItem(a).length);
  const selected = state.items.find((item) => item.id === state.selectedItemId) || items[0];
  if (selected && state.selectedItemId !== selected.id) state.selectedItemId = selected.id;

  els.workspace.innerHTML = `
    <section class="twoColumn">
      <div class="panel">
        <div class="panelHeader">
          <div>
            <div class="kicker">Price update workflow</div>
            <h2>Pick an item and preview formula impact</h2>
          </div>
          <div class="recordCount">${items.length} records</div>
        </div>
        <div class="dataTableWrap">
          <table class="dataTable">
            <thead>
              <tr><th>Item</th><th>Group</th><th>Current basis</th><th class="numeric">Affected</th><th>Updated</th></tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr class="dataRow ${state.selectedItemId === item.id ? "active" : ""}" data-action="select-item" data-item-id="${item.id}">
                  <td><strong>${escapeHtml(item.name)}</strong><div class="small">${escapeHtml(item.supplier || "")}</div></td>
                  <td>${escapeHtml(itemGroupName(item))}</td>
                  <td>${escapeHtml(bestCostLabel(item))}</td>
                  <td class="numeric">${formulasAffectedByItem(item).length}</td>
                  <td>${dateShort(item.updated_at)}</td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="emptyState">No matching cost items.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <section class="panel detailPanel">
        ${selected ? itemDetailHtml(selected, "updates") : `<div class="emptyState">Select a cost item.</div>`}
      </section>
    </section>
  `;
}

function renderExceptions() {
  const issues = getIssues();
  els.workspace.innerHTML = `
    <section class="panel">
      <div class="panelHeader">
        <div>
          <div class="kicker">Workbook integrity checks</div>
          <h2>Exceptions</h2>
        </div>
        <div class="recordCount">${issues.length} records</div>
      </div>
      <div class="issueList">
        ${issues.map(issueCardHtml).join("") || `<div class="emptyState">No exceptions detected.</div>`}
      </div>
    </section>
  `;
}

function issueCardHtml(issue) {
  return `
    <button class="issueCard" type="button" data-action="${issue.action}" ${issue.itemId ? `data-item-id="${issue.itemId}"` : ""} ${issue.formulaId ? `data-formula-id="${issue.formulaId}"` : ""} data-target-view="${issue.targetView}">
      <span>
        <strong>${escapeHtml(issue.title)}</strong>
        <span class="small">${escapeHtml(issue.detail)}</span>
      </span>
      <span class="deltaPill ${issue.severity}">${escapeHtml(issue.type)}</span>
    </button>
  `;
}

function getIssues() {
  const issues = [];
  for (const item of state.items) {
    if (!hasCost(item)) {
      issues.push({
        type: "Missing cost",
        severity: "bad",
        title: item.name,
        detail: `${itemGroupName(item)} has no cost per oz, gram, or unit.`,
        action: "select-item",
        targetView: "updates",
        itemId: item.id
      });
    }
  }

  for (const formula of state.formulas) {
    const breakdown = formulaBreakdown(formula);
    if (breakdown.unresolved) {
      issues.push({
        type: "Unresolved ref",
        severity: "bad",
        title: formula.name,
        detail: `${formula.category} has ${breakdown.unresolved} unresolved workbook reference${breakdown.unresolved === 1 ? "" : "s"}.`,
        action: "select-formula",
        targetView: "formulas",
        formulaId: formula.id
      });
    }
    if (Math.abs(breakdown.delta) > 0.01) {
      issues.push({
        type: "Workbook delta",
        severity: "warn",
        title: formula.name,
        detail: `${formula.source_cell || "Formula"} calculates ${money(breakdown.total)} vs workbook ${money(formula.workbook_value)}.`,
        action: "select-formula",
        targetView: "formulas",
        formulaId: formula.id
      });
    }
    if (!breakdown.lines.length) {
      issues.push({
        type: "No refs",
        severity: "warn",
        title: formula.name,
        detail: `${formula.source_cell || "Formula"} has a formula value but no parsed component lines.`,
        action: "select-formula",
        targetView: "formulas",
        formulaId: formula.id
      });
    }
  }

  return issues.sort((a, b) => {
    const score = { bad: 0, warn: 1, good: 2 };
    return score[a.severity] - score[b.severity] || a.title.localeCompare(b.title);
  });
}

function formulaBreakdown(formula, overrides = {}) {
  const lines = state.lines
    .filter((line) => line.formula_id === formula.id)
    .map((line) => lineBreakdown(line, overrides));
  const total = evaluateFormula(formula, new Set(), overrides);
  const workbookValue = Number(formula.workbook_value) || 0;
  return {
    formula,
    lines,
    total,
    workbookValue,
    delta: total - workbookValue,
    unresolved: lines.filter((line) => line.type === "Unresolved").length
  };
}

function lineBreakdown(line, overrides = {}) {
  const item = line.cost_item_id ? state.items.find((record) => record.id === line.cost_item_id) : null;
  const sourceFormula = state.formulas.find((record) => record.source_cell === line.source_cell_ref);
  const sourceCell = state.cells.find((record) => record.ref === line.source_cell_ref);
  const cost = item ? lineCost(line, item, overrides) : getCellValue(line.source_cell_ref, new Set(), overrides);

  let type = "Workbook cell";
  let name = line.source_item_name || line.source_cell_ref || "Workbook reference";
  if (item) {
    type = "Cost item";
    name = item.name;
  } else if (sourceFormula) {
    type = "Formula";
    name = sourceFormula.name;
  } else if (!sourceCell) {
    type = "Unresolved";
    name = line.source_cell_ref || "Missing reference";
  }

  return {
    ...line,
    item,
    name,
    type,
    cost
  };
}

function formulasAffectedByItem(item) {
  const sourceCells = new Set(Object.values(item.source_cells || {}).filter(Boolean));
  const affectedIds = new Set(
    state.lines
      .filter((line) => line.cost_item_id === item.id || sourceCells.has(line.source_cell_ref))
      .map((line) => line.formula_id)
  );

  let changed = true;
  while (changed) {
    changed = false;
    const affectedSourceCells = new Set(
      state.formulas
        .filter((formula) => affectedIds.has(formula.id) && formula.source_cell)
        .map((formula) => formula.source_cell)
    );
    for (const formula of state.formulas) {
      if (affectedIds.has(formula.id)) continue;
      if (formulaRefs(formula.formula_expression).some((ref) => affectedSourceCells.has(ref))) {
        affectedIds.add(formula.id);
        changed = true;
      }
    }
  }

  return state.formulas.filter((formula) => affectedIds.has(formula.id));
}

function getCellValue(ref, stack = new Set(), overrides = {}) {
  if (!ref) return 0;
  const item = state.items.find((record) => {
    const cells = record.source_cells || {};
    return cells.oz === ref || cells.gram === ref || cells.unit === ref;
  });
  if (item) {
    const costs = getItemCosts(item, overrides);
    if (item.source_cells?.oz === ref) return Number(costs.cost_per_oz) || 0;
    if (item.source_cells?.gram === ref) return Number(costs.cost_per_gram) || 0;
    if (item.source_cells?.unit === ref) return Number(costs.cost_per_unit) || 0;
  }

  const formula = state.formulas.find((record) => record.source_cell === ref);
  if (formula && !stack.has(ref)) {
    stack.add(ref);
    const value = evaluateFormula(formula, stack, overrides);
    stack.delete(ref);
    return value;
  }

  const cell = state.cells.find((record) => record.ref === ref);
  return Number(cell?.numeric_value) || 0;
}

function evaluateFormula(formula, stack = new Set(), overrides = {}) {
  if (!formula?.formula_expression) return Number(formula?.workbook_value) || 0;
  const expression = formula.formula_expression.replace(/\b[A-Z]{1,3}\d+\b/g, (ref) => String(getCellValue(ref, stack, overrides)));
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return Number(formula.workbook_value) || 0;
  try {
    return Number(Function(`"use strict"; return (${expression});`)()) || 0;
  } catch {
    return Number(formula.workbook_value) || 0;
  }
}

function lineCost(line, item, overrides = {}) {
  const quantity = Number(line.quantity) || 1;
  const unit = normalizeUnit(line.unit);
  const costs = getItemCosts(item, overrides);
  if (unit === "g") return quantity * (Number(costs.cost_per_gram) || 0);
  if (unit === "oz") return quantity * (Number(costs.cost_per_oz) || 0);
  return quantity * (Number(costs.cost_per_unit) || 0);
}

function draftOverrideFromForm(item) {
  if (!document.getElementById("itemCostOz")) return { items: {} };
  return {
    items: {
      [item.id]: {
        cost_per_oz: toNumber(document.getElementById("itemCostOz").value),
        cost_per_gram: toNumber(document.getElementById("itemCostGram").value),
        cost_per_unit: toNumber(document.getElementById("itemCostUnit").value)
      }
    }
  };
}

function impactPreviewHtml(item, overrides) {
  const affected = formulasAffectedByItem(item);
  const rows = affected
    .map((formula) => {
      const before = evaluateFormula(formula);
      const after = evaluateFormula(formula, new Set(), overrides);
      return { formula, before, after, delta: after - before };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return `
    <section>
      <div class="splitHeader">
        <h3>Formula impact preview</h3>
        <span class="recordCount">${rows.length}</span>
      </div>
      <div class="affectedList">
        ${rows.map(({ formula, before, after, delta }) => `
          <button class="affectedItem" type="button" data-action="select-formula" data-formula-id="${formula.id}" data-target-view="formulas">
            <span>
              <strong>${escapeHtml(formula.name)}</strong>
              <span class="small">${money(before)} → ${money(after)}</span>
            </span>
            <span class="deltaPill ${Math.abs(delta) <= 0.0001 ? "good" : "warn"}">${money(delta)}</span>
          </button>
        `).join("") || `<div class="small">No formula references this item yet.</div>`}
      </div>
    </section>
  `;
}

function updateImpactPreview() {
  const item = state.items.find((record) => record.id === state.selectedItemId);
  const target = document.getElementById("impactPreview");
  if (!item || !target) return;
  target.innerHTML = impactPreviewHtml(item, draftOverrideFromForm(item));
}

function recalcItemFromPurchase() {
  const price = toNumber(document.getElementById("itemPurchasePrice").value);
  const qty = toNumber(document.getElementById("itemPurchaseQty").value);
  const unit = normalizeUnit(document.getElementById("itemPurchaseUnit").value);
  if (!price || !qty) return;
  if (unit === "oz") {
    document.getElementById("itemCostOz").value = number(price / qty);
    document.getElementById("itemCostGram").value = number(price / qty / 28.3495);
  } else if (unit === "g") {
    document.getElementById("itemCostGram").value = number(price / qty);
    document.getElementById("itemCostOz").value = number((price / qty) * 28.3495);
  } else {
    document.getElementById("itemCostUnit").value = number(price / qty);
  }
  updateImpactPreview();
}

async function saveItem(item) {
  const patch = {
    purchase_price: toNumber(document.getElementById("itemPurchasePrice").value),
    purchase_quantity: toNumber(document.getElementById("itemPurchaseQty").value),
    purchase_unit: document.getElementById("itemPurchaseUnit").value.trim(),
    supplier: document.getElementById("itemSupplier").value.trim(),
    cost_per_oz: toNumber(document.getElementById("itemCostOz").value),
    cost_per_gram: toNumber(document.getElementById("itemCostGram").value),
    cost_per_unit: toNumber(document.getElementById("itemCostUnit").value),
    notes: document.getElementById("itemNotes").value.trim(),
    updated_by: state.user?.id || null
  };

  const { error } = await supabaseClient.from("cogs_cost_items").update(patch).eq("id", item.id);
  if (error) {
    alert(error.message);
    return;
  }

  await supabaseClient.from("cogs_price_history").insert({
    cost_item_id: item.id,
    old_cost_per_oz: item.cost_per_oz,
    new_cost_per_oz: patch.cost_per_oz,
    old_cost_per_gram: item.cost_per_gram,
    new_cost_per_gram: patch.cost_per_gram,
    old_cost_per_unit: item.cost_per_unit,
    new_cost_per_unit: patch.cost_per_unit,
    changed_by: state.user?.id || null
  });

  showStatus(`${item.name} updated. Affected formula totals were recalculated.`);
  state.selectedItemId = item.id;
  await loadWorkspace();
}

async function handleWorkbookFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  showStatus(`Reading ${file.name}...`);
  try {
    const parsed = await parseWorkbook(file);
    openImportPreview(parsed);
  } catch (error) {
    console.error(error);
    showStatus(`Workbook import failed: ${error.message}`, "error");
  } finally {
    event.target.value = "";
  }
}

async function parseWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellFormula: true, cellNF: false, cellStyles: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const cells = [];
  const cellMap = new Map();

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[ref];
      if (!cell) continue;
      const value = cell.v ?? "";
      const record = {
        ref,
        raw_value: value === null || value === undefined ? "" : String(value),
        numeric_value: typeof value === "number" ? value : toNumber(value),
        formula_expression: cell.f || null
      };
      cells.push(record);
      cellMap.set(ref, record);
    }
  }

  const items = parseCostItems(cellMap);
  const costCellMap = new Map();
  for (const item of items) {
    for (const [unit, ref] of Object.entries(item.source_cells)) {
      if (ref) costCellMap.set(ref, { itemKey: item.key, unit });
    }
  }

  const formulas = parseFormulas(cellMap, costCellMap);
  return { sheetName, cells, items, formulas };
}

function cellText(cellMap, ref) {
  return String(cellMap.get(ref)?.raw_value || "").trim();
}

function cellNumber(cellMap, ref) {
  return cellMap.get(ref)?.numeric_value ?? null;
}

function parseCostItems(cellMap) {
  const items = [];
  for (const [category, nameCol, ozCol, gramCol, unitCol] of COST_GROUPS) {
    for (let row = 2; row <= 158; row++) {
      const nameRef = `${nameCol}${row}`;
      const name = cellText(cellMap, nameRef);
      if (!name || name.startsWith("=")) continue;
      const sourceCells = {
        oz: ozCol ? `${ozCol}${row}` : null,
        gram: gramCol ? `${gramCol}${row}` : null,
        unit: unitCol ? `${unitCol}${row}` : null
      };
      const item = {
        key: `${category}::${name}`.toLowerCase(),
        category,
        name,
        source_name_cell: nameRef,
        source_cells: sourceCells,
        cost_per_oz: sourceCells.oz ? cellNumber(cellMap, sourceCells.oz) : null,
        cost_per_gram: sourceCells.gram ? cellNumber(cellMap, sourceCells.gram) : null,
        cost_per_unit: sourceCells.unit ? cellNumber(cellMap, sourceCells.unit) : null,
        notes: ""
      };
      if (item.cost_per_oz !== null || item.cost_per_gram !== null || item.cost_per_unit !== null) {
        items.push(item);
      }
    }
  }
  return items;
}

function formulaCategoryForCol(colIndex) {
  let current = FORMULA_GROUPS[0];
  for (const group of FORMULA_GROUPS) {
    if (colIndex >= group.index) current = group;
  }
  return current;
}

function inferFormulaName(cellMap, ref) {
  const parsed = splitCellRef(ref);
  if (!parsed) return ref;
  const sameRowCandidates = [];
  for (let offset = 1; offset <= 3; offset++) {
    sameRowCandidates.push(`${numberToCol(parsed.colIndex + offset)}${parsed.row}`);
  }
  for (const candidate of sameRowCandidates) {
    const text = cellText(cellMap, candidate);
    if (text && !/^(per|with|w\/|batch|unit|units|\d)/i.test(text)) return text;
  }
  for (let row = parsed.row - 1; row >= Math.max(1, parsed.row - 8); row--) {
    const text = cellText(cellMap, `${parsed.col}${row}`);
    if (text && !/^(per|with|w\/|\d)/i.test(text)) return text;
  }
  return ref;
}

function inferFormulaLabel(cellMap, ref) {
  const parsed = splitCellRef(ref);
  if (!parsed) return "";
  const right = cellText(cellMap, `${numberToCol(parsed.colIndex + 1)}${parsed.row}`);
  const twoRight = cellText(cellMap, `${numberToCol(parsed.colIndex + 2)}${parsed.row}`);
  return right || twoRight || "";
}

function parseFormulas(cellMap, costCellMap) {
  const formulas = [];
  for (const [ref, cell] of cellMap.entries()) {
    if (!cell.formula_expression) continue;
    const parsed = splitCellRef(ref);
    if (!parsed || parsed.colIndex < colToNumber("BT")) continue;
    const group = formulaCategoryForCol(parsed.colIndex);
    const name = inferFormulaName(cellMap, ref);
    const label = inferFormulaLabel(cellMap, ref);
    const lines = parseFormulaRefs(cell.formula_expression, costCellMap);
    formulas.push({
      source_cell: ref,
      category: group.name,
      name,
      label,
      formula_expression: cell.formula_expression,
      workbook_value: cell.numeric_value,
      lines
    });
  }
  return formulas;
}

function parseFormulaRefs(expression, costCellMap) {
  const lines = [];
  const consumed = [];
  const multiplyPattern = /(\d+(?:\.\d+)?)\s*\*\s*([A-Z]{1,3}\d+)|([A-Z]{1,3}\d+)\s*\*\s*(\d+(?:\.\d+)?)/g;
  let match;
  while ((match = multiplyPattern.exec(expression))) {
    const quantity = Number(match[1] || match[4] || 1);
    const ref = match[2] || match[3];
    consumed.push([match.index, match.index + match[0].length]);
    const costRef = costCellMap.get(ref);
    lines.push({
      source_cell_ref: ref,
      item_key: costRef?.itemKey || null,
      quantity,
      unit: costRef?.unit || "",
      sort_order: lines.length + 1
    });
  }

  const refPattern = /\b[A-Z]{1,3}\d+\b/g;
  while ((match = refPattern.exec(expression))) {
    const index = match.index;
    if (consumed.some(([start, end]) => index >= start && index < end)) continue;
    const ref = match[0];
    const costRef = costCellMap.get(ref);
    lines.push({
      source_cell_ref: ref,
      item_key: costRef?.itemKey || null,
      quantity: 1,
      unit: costRef?.unit || "",
      sort_order: lines.length + 1
    });
  }
  return lines;
}

function openImportPreview(parsed) {
  els.modalTitle.textContent = "Import Workbook";
  els.modalContent.innerHTML = `
    <p class="muted">Sheet: ${escapeHtml(parsed.sheetName)}</p>
    <div class="dashboardGrid">
      <div class="metricCard"><span class="kicker">Cells</span><strong>${parsed.cells.length}</strong><span>Workbook values and formulas</span></div>
      <div class="metricCard"><span class="kicker">Cost items</span><strong>${parsed.items.length}</strong><span>Raw materials, packaging, kits</span></div>
      <div class="metricCard"><span class="kicker">Formulas</span><strong>${parsed.formulas.length}</strong><span>Formula cells from BT onward</span></div>
      <div class="metricCard"><span class="kicker">Formula refs</span><strong>${parsed.formulas.reduce((sum, formula) => sum + formula.lines.length, 0)}</strong><span>Parsed component references</span></div>
    </div>
    <div class="previewList">
      ${parsed.items.slice(0, 8).map((item) => `
        <div class="previewRow"><span>${escapeHtml(item.category)} / ${escapeHtml(item.name)}</span><strong>${money(item.cost_per_gram || item.cost_per_oz || item.cost_per_unit)}</strong></div>
      `).join("")}
    </div>
    <div class="buttonRow">
      <button id="confirmImportBtn" class="primaryBtn" type="button">Import to shared workspace</button>
      <button id="cancelImportBtn" class="mutedBtn" type="button">Cancel</button>
    </div>
  `;
  els.modalOverlay.style.display = "flex";
  document.getElementById("confirmImportBtn").addEventListener("click", () => importParsedWorkbook(parsed));
  document.getElementById("cancelImportBtn").addEventListener("click", closeModal);
}

async function importParsedWorkbook(parsed) {
  showStatus("Importing workbook into Supabase...");
  closeModal();
  try {
    await upsertWorkbookCells(parsed.cells);
    const categoryMap = await upsertCategories(parsed);
    const itemMap = await upsertItems(parsed.items, categoryMap);
    const formulaMap = await upsertFormulas(parsed.formulas);
    await replaceFormulaLines(parsed.formulas, formulaMap, itemMap);
    showStatus(`Imported ${parsed.items.length} cost items and ${parsed.formulas.length} formulas.`);
    await loadWorkspace();
  } catch (error) {
    console.error(error);
    showStatus(`Import failed: ${error.message}`, "error");
  }
}

async function upsertWorkbookCells(cells) {
  for (let index = 0; index < cells.length; index += 500) {
    const chunk = cells.slice(index, index + 500);
    const { error } = await supabaseClient.from("cogs_workbook_cells").upsert(chunk, { onConflict: "ref" });
    if (error) throw error;
  }
}

async function upsertCategories(parsed) {
  const names = Array.from(new Set([
    ...parsed.items.map((item) => item.category),
    ...parsed.formulas.map((formula) => formula.category)
  ])).filter(Boolean);
  const rows = names.map((name, index) => ({ name, sort_order: index + 1 }));
  const { error } = await supabaseClient.from("cogs_categories").upsert(rows, { onConflict: "name" });
  if (error) throw error;
  const { data, error: selectError } = await supabaseClient.from("cogs_categories").select("*").in("name", names);
  if (selectError) throw selectError;
  return new Map((data || []).map((category) => [category.name, category.id]));
}

async function upsertItems(items, categoryMap) {
  const rows = items.map((item) => ({
    category_id: categoryMap.get(item.category),
    name: item.name,
    source_name_cell: item.source_name_cell,
    source_cells: item.source_cells,
    cost_per_oz: item.cost_per_oz,
    cost_per_gram: item.cost_per_gram,
    cost_per_unit: item.cost_per_unit,
    notes: item.notes,
    updated_by: state.user?.id || null
  })).filter((item) => item.category_id);

  for (let index = 0; index < rows.length; index += 300) {
    const chunk = rows.slice(index, index + 300);
    const { error } = await supabaseClient.from("cogs_cost_items").upsert(chunk, { onConflict: "category_id,name" });
    if (error) throw error;
  }

  const { data, error } = await supabaseClient.from("cogs_cost_items").select("*");
  if (error) throw error;
  const map = new Map();
  for (const item of data || []) {
    const category = state.categories.find((record) => record.id === item.category_id);
    const categoryName = category?.name || "";
    map.set(`${categoryName}::${item.name}`.toLowerCase(), item.id);
    for (const ref of Object.values(item.source_cells || {})) {
      if (ref) map.set(`cell::${ref}`, item.id);
    }
  }
  for (const parsedItem of items) {
    const id = (data || []).find((item) => item.source_name_cell === parsedItem.source_name_cell)?.id;
    if (id) map.set(parsedItem.key, id);
  }
  return map;
}

async function upsertFormulas(formulas) {
  const rows = formulas.map((formula) => ({
    source_cell: formula.source_cell,
    category: formula.category,
    name: formula.name,
    label: formula.label,
    formula_expression: formula.formula_expression,
    workbook_value: formula.workbook_value,
    updated_by: state.user?.id || null
  }));
  for (let index = 0; index < rows.length; index += 300) {
    const chunk = rows.slice(index, index + 300);
    const { error } = await supabaseClient.from("cogs_formulas").upsert(chunk, { onConflict: "source_cell" });
    if (error) throw error;
  }
  const { data, error } = await supabaseClient.from("cogs_formulas").select("id,source_cell");
  if (error) throw error;
  return new Map((data || []).map((formula) => [formula.source_cell, formula.id]));
}

async function replaceFormulaLines(formulas, formulaMap, itemMap) {
  const formulaIds = Array.from(formulaMap.values());
  if (formulaIds.length) {
    const { error: deleteError } = await supabaseClient.from("cogs_formula_lines").delete().in("formula_id", formulaIds);
    if (deleteError) throw deleteError;
  }
  const rows = [];
  for (const formula of formulas) {
    const formulaId = formulaMap.get(formula.source_cell);
    if (!formulaId) continue;
    for (const line of formula.lines) {
      rows.push({
        formula_id: formulaId,
        cost_item_id: line.item_key ? itemMap.get(line.item_key) || itemMap.get(`cell::${line.source_cell_ref}`) || null : null,
        source_cell_ref: line.source_cell_ref,
        quantity: line.quantity,
        unit: line.unit,
        sort_order: line.sort_order
      });
    }
  }
  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    const { error } = await supabaseClient.from("cogs_formula_lines").insert(chunk);
    if (error) throw error;
  }
}

function closeModal() {
  els.modalOverlay.style.display = "none";
  els.modalContent.innerHTML = "";
}

function exportJson() {
  const payload = {
    categories: state.categories,
    cost_items: state.items,
    formulas: state.formulas,
    formula_lines: state.lines,
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bathhouse-cogs-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function setView(view) {
  state.view = view;
  render();
}

function handleWorkspaceClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === "go-view") {
    setView(trigger.dataset.view);
    return;
  }
  if (action === "pick-cost-group") {
    state.activeCostGroup = trigger.dataset.costGroup || "";
    setView("costs");
    return;
  }
  if (action === "pick-formula-group") {
    state.activeFormulaGroup = trigger.dataset.formulaGroup || "";
    setView("formulas");
    return;
  }
  if (action === "set-cost-group") {
    state.activeCostGroup = trigger.dataset.costGroup || "";
    render();
    return;
  }
  if (action === "set-formula-group") {
    state.activeFormulaGroup = trigger.dataset.formulaGroup || "";
    render();
    return;
  }
  if (action === "select-item") {
    state.selectedItemId = trigger.dataset.itemId;
    state.selectedFormulaId = "";
    if (trigger.dataset.targetView) state.view = trigger.dataset.targetView;
    render();
    return;
  }
  if (action === "select-formula") {
    state.selectedFormulaId = trigger.dataset.formulaId;
    state.selectedItemId = "";
    if (trigger.dataset.targetView) state.view = trigger.dataset.targetView;
    render();
    return;
  }
  if (action === "recalc-item") {
    recalcItemFromPurchase();
    return;
  }
  if (action === "save-item") {
    const item = state.items.find((record) => record.id === trigger.dataset.itemId);
    if (item) saveItem(item);
  }
}

function bindDynamicControls() {
  ["itemCostOz", "itemCostGram", "itemCostUnit", "itemPurchasePrice", "itemPurchaseQty", "itemPurchaseUnit"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener("input", updateImpactPreview);
  });
}

function bindEvents() {
  els.loginBtn.addEventListener("click", login);
  els.logoutBtn.addEventListener("click", logout);
  els.loginPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  els.globalSearch.addEventListener("input", () => {
    state.query = els.globalSearch.value.trim();
    render();
  });
  els.moduleTabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  els.workbookFile.addEventListener("change", handleWorkbookFile);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.workspace.addEventListener("click", handleWorkspaceClick);
  els.modalCloseBtn.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay) closeModal();
  });
}

bindEvents();
checkSession();
