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
  quickSearchToggle: document.getElementById("quickSearchToggle"),
  quickSearchPanel: document.getElementById("quickSearchPanel"),
  quickSearchInput: document.getElementById("quickSearchInput"),
  quickSearchResults: document.getElementById("quickSearchResults"),
  importStatus: document.getElementById("importStatus"),
  workspace: document.getElementById("workspace"),
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
  view: "home",
  activeKind: "",
  activeCategory: "",
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

function itemSearchText(item) {
  return `${item.name} ${itemGroupName(item)} ${item.supplier || ""} ${item.notes || ""}`;
}

function formulaSearchText(formula) {
  return `${formula.name} ${formula.category || ""} ${formula.label || ""} ${formula.source_cell || ""} ${formula.notes || ""}`;
}

function bestCostLabel(item) {
  if (Number(item.cost_per_unit) > 0) return `${money(item.cost_per_unit)} / unit`;
  if (Number(item.cost_per_gram) > 0) return `${money(item.cost_per_gram)} / g`;
  if (Number(item.cost_per_oz) > 0) return `${money(item.cost_per_oz)} / oz`;
  return "Missing cost";
}

function hasCost(item) {
  return [item.cost_per_oz, item.cost_per_gram, item.cost_per_unit].some((value) => Number(value) > 0);
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
  render();
}

function render() {
  if (state.view === "home") renderHome();
  if (state.view === "itemCategories") renderCategoryPicker("items");
  if (state.view === "formulaCategories") renderCategoryPicker("formulas");
  if (state.view === "itemList") renderRecordList("items");
  if (state.view === "formulaList") renderRecordList("formulas");
  if (state.view === "itemDetail") renderItemDetail();
  if (state.view === "formulaDetail") renderFormulaDetail();
  bindDetailInputs();
}

function renderHome() {
  const missingCosts = state.items.filter((item) => !hasCost(item)).length;
  els.workspace.innerHTML = `
    <section class="screenHeader">
      <div>
        <div class="kicker">Start</div>
        <h2>Choose a workbook area</h2>
      </div>
      <div class="recordCount">${whole(state.items.length + state.formulas.length)} records</div>
    </section>

    <section class="chooserGrid">
      <button class="choiceCard" type="button" data-action="open-section" data-kind="items">
        <span class="tag">Raw materials, packaging, kits</span>
        <strong>Cost Items</strong>
        <span class="muted">Browse by the same categories used in the spreadsheet, then open one item to update its cost.</span>
        <span class="choiceStats">
          <span class="recordCount">${whole(state.items.length)} items</span>
          <span class="recordCount">${whole(COST_GROUPS.length)} categories</span>
          <span class="recordCount">${whole(missingCosts)} missing costs</span>
        </span>
      </button>
      <button class="choiceCard" type="button" data-action="open-section" data-kind="formulas">
        <span class="tag">Product costing</span>
        <strong>Formulas</strong>
        <span class="muted">Browse formula groups from the workbook and inspect COGS, workbook value, and component lines.</span>
        <span class="choiceStats">
          <span class="recordCount">${whole(state.formulas.length)} formulas</span>
          <span class="recordCount">${whole(FORMULA_GROUPS.length)} groups</span>
          <span class="recordCount">${whole(state.lines.length)} refs</span>
        </span>
      </button>
    </section>
  `;
}

function renderCategoryPicker(kind) {
  const isItems = kind === "items";
  const groups = isItems ? COST_GROUPS : FORMULA_GROUPS.map((group) => [group.name, group.col]);
  const title = isItems ? "Cost Item Categories" : "Formula Categories";
  const subtitle = isItems ? "Pick a cost category from the workbook." : "Pick a formula section from the workbook.";

  els.workspace.innerHTML = `
    ${screenHeaderHtml({
      eyebrow: isItems ? "Cost items" : "Formulas",
      title,
      subtitle,
      backAction: "go-home"
    })}
    <section class="categoryGrid">
      ${groups.map((group) => {
        const name = group[0];
        const count = isItems
          ? state.items.filter((item) => itemGroupName(item) === name).length
          : state.formulas.filter((formula) => formula.category === name).length;
        const meta = isItems ? `${sourceCellList(group)} columns` : `${group[1]}+ formula block`;
        return `
          <button class="categoryCard" type="button" data-action="open-category" data-kind="${kind}" data-category="${escapeHtml(name)}">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(meta)}</span>
            <span class="tag">${whole(count)} records</span>
          </button>
        `;
      }).join("")}
    </section>
  `;
}

function screenHeaderHtml({ eyebrow, title, subtitle, backAction, backLabel = "Back" }) {
  return `
    <section class="screenHeader">
      <div>
        <div class="kicker">${escapeHtml(eyebrow)}</div>
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<div class="muted">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <div class="breadcrumb">
        ${backAction ? `<button class="mutedBtn" type="button" data-action="${backAction}">${escapeHtml(backLabel)}</button>` : ""}
        <button class="smallBtn" type="button" data-action="go-home">Home</button>
      </div>
    </section>
  `;
}

function renderRecordList(kind) {
  const isItems = kind === "items";
  const records = isItems ? categoryItems(state.activeCategory) : categoryFormulas(state.activeCategory);
  const title = state.activeCategory || (isItems ? "Cost Items" : "Formulas");

  els.workspace.innerHTML = `
    ${screenHeaderHtml({
      eyebrow: isItems ? "Cost items" : "Formulas",
      title,
      subtitle: `${records.length} ${isItems ? "items" : "formulas"} in this category.`,
      backAction: isItems ? "back-item-categories" : "back-formula-categories"
    })}
    <section class="listGrid">
      ${records.map((record) => isItems ? itemCardHtml(record) : formulaCardHtml(record)).join("") || `<div class="emptyState">No records in this category.</div>`}
    </section>
  `;
}

function categoryItems(category) {
  return state.items
    .filter((item) => !category || itemGroupName(item) === category)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function categoryFormulas(category) {
  return state.formulas
    .filter((formula) => !category || formula.category === category)
    .sort((a, b) => String(a.source_cell || "").localeCompare(String(b.source_cell || "")));
}

function itemCardHtml(item) {
  const affectedCount = formulasAffectedByItem(item).length;
  return `
    <button class="recordCard" type="button" data-action="select-item" data-item-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(bestCostLabel(item))}</span>
      <span>${escapeHtml(Object.values(item.source_cells || {}).filter(Boolean).join(", ") || item.source_name_cell || "")}</span>
      <span class="tag">${whole(affectedCount)} affected formulas</span>
    </button>
  `;
}

function formulaCardHtml(formula) {
  const breakdown = formulaBreakdown(formula);
  return `
    <button class="recordCard" type="button" data-action="select-formula" data-formula-id="${formula.id}">
      <strong>${escapeHtml(formula.name)}</strong>
      <span>${escapeHtml(formula.source_cell || "")}${formula.label ? ` - ${escapeHtml(formula.label)}` : ""}</span>
      <span>Calculated ${money(breakdown.total)}</span>
      <span class="tag">${whole(breakdown.lines.length)} refs</span>
    </button>
  `;
}

function renderItemDetail() {
  const item = state.items.find((record) => record.id === state.selectedItemId);
  if (!item) {
    state.view = "itemList";
    render();
    return;
  }
  const affectedCount = formulasAffectedByItem(item).length;
  els.workspace.innerHTML = `
    ${screenHeaderHtml({
      eyebrow: itemGroupName(item),
      title: item.name,
      subtitle: item.source_name_cell || "Manual item",
      backAction: "back-item-list"
    })}
    <section class="panel detailPanel">
      <div class="detailGrid">
        <div class="metricGrid">
          <div class="metricBox"><span class="small">Cost / oz</span><strong>${money(item.cost_per_oz)}</strong></div>
          <div class="metricBox"><span class="small">Cost / gram</span><strong>${money(item.cost_per_gram)}</strong></div>
          <div class="metricBox"><span class="small">Cost / unit</span><strong>${money(item.cost_per_unit)}</strong></div>
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
          <button class="primaryBtn" type="button" data-action="save-item" data-item-id="${item.id}">Save price update</button>
          <button class="mutedBtn" type="button" data-action="recalc-item">Calculate from purchase</button>
          <button class="darkBtn" type="button" data-action="show-affected" data-item-id="${item.id}">Affected formulas (${affectedCount})</button>
        </div>
      </div>
    </section>
  `;
}

function renderFormulaDetail() {
  const formula = state.formulas.find((record) => record.id === state.selectedFormulaId);
  if (!formula) {
    state.view = "formulaList";
    render();
    return;
  }
  const breakdown = formulaBreakdown(formula);
  const deltaClass = Math.abs(breakdown.delta) <= 0.01 ? "good" : "warn";
  els.workspace.innerHTML = `
    ${screenHeaderHtml({
      eyebrow: formula.category || "Formula",
      title: formula.name,
      subtitle: `${formula.source_cell || ""}${formula.label ? ` - ${formula.label}` : ""}`,
      backAction: "back-formula-list"
    })}
    <section class="panel detailPanel">
      <div class="detailGrid">
        <div class="metricGrid">
          <div class="metricBox"><span class="small">Calculated COGS</span><strong>${money(breakdown.total)}</strong></div>
          <div class="metricBox"><span class="small">Workbook value</span><strong>${money(formula.workbook_value)}</strong></div>
          <div class="metricBox"><span class="small">Delta</span><strong><span class="deltaPill ${deltaClass}">${money(breakdown.delta)}</span></strong></div>
        </div>
        <div class="small"><code>=${escapeHtml(formula.formula_expression || "")}</code></div>
        <div class="lineTableWrap">
          <table class="lineTable">
            <thead><tr><th>Ref</th><th>Component</th><th>Qty</th><th>Unit</th><th>Type</th><th class="numeric">Line cost</th></tr></thead>
            <tbody>
              ${breakdown.lines.map((line) => `
                <tr>
                  <td>${escapeHtml(line.source_cell_ref || "")}</td>
                  <td>${line.item ? `<button class="smallBtn" type="button" data-action="select-item" data-item-id="${line.item.id}">${escapeHtml(line.name)}</button>` : escapeHtml(line.name)}</td>
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
    </section>
  `;
}

function openQuickSearch() {
  els.quickSearchPanel.style.display = "block";
  els.quickSearchInput.focus();
  els.quickSearchInput.select();
  renderQuickSearchResults();
}

function closeQuickSearch() {
  els.quickSearchPanel.style.display = "none";
}

function scoreSearchResult(name, haystack, query) {
  const text = String(name || "").toLowerCase();
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (text.includes(query)) return 2;
  if (haystack.includes(query)) return 3;
  return 9;
}

function quickSearchMatches(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const itemMatches = state.items
    .map((item) => ({
      type: "Cost item",
      action: "select-item",
      idAttr: "data-item-id",
      id: item.id,
      title: item.name,
      meta: itemGroupName(item),
      value: bestCostLabel(item),
      score: scoreSearchResult(item.name, itemSearchText(item).toLowerCase(), normalized)
    }))
    .filter((result) => result.score < 9);

  const formulaMatches = state.formulas
    .map((formula) => ({
      type: "Formula",
      action: "select-formula",
      idAttr: "data-formula-id",
      id: formula.id,
      title: formula.name,
      meta: formula.category || "Formula",
      value: money(evaluateFormula(formula)),
      score: scoreSearchResult(formula.name, formulaSearchText(formula).toLowerCase(), normalized)
    }))
    .filter((result) => result.score < 9);

  return [...itemMatches, ...formulaMatches]
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
    .slice(0, 10);
}

function renderQuickSearchResults() {
  const query = els.quickSearchInput.value.trim();
  if (!query) {
    els.quickSearchResults.innerHTML = `<div class="small">Start typing to jump to a cost item or formula.</div>`;
    return;
  }

  const matches = quickSearchMatches(query);
  els.quickSearchResults.innerHTML = matches.map((result, index) => `
    <button class="quickResult ${index === 0 ? "active" : ""}" type="button" data-action="${result.action}" ${result.idAttr}="${result.id}">
      <span>
        <strong>${escapeHtml(result.title)}</strong>
        <span class="small">${escapeHtml(result.type)} - ${escapeHtml(result.meta)}</span>
      </span>
      <span class="small">${escapeHtml(result.value)}</span>
    </button>
  `).join("") || `<div class="small">No matching cost items or formulas.</div>`;
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

  return { ...line, item, name, type, cost };
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
    const override = overrides.items?.[item.id] || {};
    const costPerOz = override.cost_per_oz ?? item.cost_per_oz;
    const costPerGram = override.cost_per_gram ?? item.cost_per_gram;
    const costPerUnit = override.cost_per_unit ?? item.cost_per_unit;
    if (item.source_cells?.oz === ref) return Number(costPerOz) || 0;
    if (item.source_cells?.gram === ref) return Number(costPerGram) || 0;
    if (item.source_cells?.unit === ref) return Number(costPerUnit) || 0;
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
  const override = overrides.items?.[item.id] || {};
  const costPerOz = override.cost_per_oz ?? item.cost_per_oz;
  const costPerGram = override.cost_per_gram ?? item.cost_per_gram;
  const costPerUnit = override.cost_per_unit ?? item.cost_per_unit;
  if (unit === "g") return quantity * (Number(costPerGram) || 0);
  if (unit === "oz") return quantity * (Number(costPerOz) || 0);
  return quantity * (Number(costPerUnit) || 0);
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

  state.selectedItemId = item.id;
  state.activeCategory = itemGroupName(item);
  state.view = "itemDetail";
  showStatus(`${item.name} updated.`);
  await loadWorkspace();
}

function showAffectedModal(item) {
  const affected = formulasAffectedByItem(item);
  els.modalTitle.textContent = "Affected Formulas";
  els.modalContent.innerHTML = `
    <div class="muted">${escapeHtml(item.name)} is referenced by ${affected.length} formula${affected.length === 1 ? "" : "s"}.</div>
    <div class="modalList">
      ${affected.map((formula) => `
        <button class="modalRow" type="button" data-action="select-formula" data-formula-id="${formula.id}">
          <span>
            <strong>${escapeHtml(formula.name)}</strong>
            <span class="small">${escapeHtml(formula.category || "")}${formula.source_cell ? ` - ${escapeHtml(formula.source_cell)}` : ""}</span>
          </span>
          <strong>${money(evaluateFormula(formula))}</strong>
        </button>
      `).join("") || `<div class="emptyState">No formula references this item yet.</div>`}
    </div>
  `;
  els.modalOverlay.style.display = "flex";
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
    <div class="metricGrid">
      <div class="metricBox"><span class="small">Cells</span><strong>${whole(parsed.cells.length)}</strong></div>
      <div class="metricBox"><span class="small">Cost items</span><strong>${whole(parsed.items.length)}</strong></div>
      <div class="metricBox"><span class="small">Formulas</span><strong>${whole(parsed.formulas.length)}</strong></div>
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
    state.view = "home";
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
  for (const parsedItem of items) {
    const id = (data || []).find((item) => item.source_name_cell === parsedItem.source_name_cell)?.id;
    if (id) {
      map.set(parsedItem.key, id);
      for (const ref of Object.values(parsedItem.source_cells || {})) {
        if (ref) map.set(`cell::${ref}`, id);
      }
    }
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

function handleActionClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === "go-home") {
    state.view = "home";
    state.activeCategory = "";
    state.activeKind = "";
    render();
  }
  if (action === "open-section") {
    state.activeKind = trigger.dataset.kind;
    state.view = trigger.dataset.kind === "items" ? "itemCategories" : "formulaCategories";
    render();
  }
  if (action === "open-category") {
    state.activeKind = trigger.dataset.kind;
    state.activeCategory = trigger.dataset.category || "";
    state.view = trigger.dataset.kind === "items" ? "itemList" : "formulaList";
    render();
  }
  if (action === "back-item-categories") {
    state.view = "itemCategories";
    render();
  }
  if (action === "back-formula-categories") {
    state.view = "formulaCategories";
    render();
  }
  if (action === "back-item-list") {
    state.view = "itemList";
    render();
  }
  if (action === "back-formula-list") {
    state.view = "formulaList";
    render();
  }
  if (action === "select-item") {
    const item = state.items.find((record) => record.id === trigger.dataset.itemId);
    if (!item) return;
    closeModal();
    closeQuickSearch();
    state.selectedItemId = item.id;
    state.activeCategory = itemGroupName(item);
    state.activeKind = "items";
    state.view = "itemDetail";
    render();
  }
  if (action === "select-formula") {
    const formula = state.formulas.find((record) => record.id === trigger.dataset.formulaId);
    if (!formula) return;
    closeModal();
    closeQuickSearch();
    state.selectedFormulaId = formula.id;
    state.activeCategory = formula.category || "";
    state.activeKind = "formulas";
    state.view = "formulaDetail";
    render();
  }
  if (action === "recalc-item") {
    recalcItemFromPurchase();
  }
  if (action === "save-item") {
    const item = state.items.find((record) => record.id === trigger.dataset.itemId);
    if (item) saveItem(item);
  }
  if (action === "show-affected") {
    const item = state.items.find((record) => record.id === trigger.dataset.itemId);
    if (item) showAffectedModal(item);
  }
}

function bindDetailInputs() {
  ["itemPurchasePrice", "itemPurchaseQty", "itemPurchaseUnit"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") recalcItemFromPurchase();
    });
  });
}

function bindEvents() {
  els.loginBtn.addEventListener("click", login);
  els.loginPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  els.quickSearchToggle.addEventListener("click", () => {
    if (els.quickSearchPanel.style.display === "none") {
      openQuickSearch();
    } else {
      closeQuickSearch();
    }
  });
  els.quickSearchInput.addEventListener("input", renderQuickSearchResults);
  els.quickSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeQuickSearch();
    if (event.key === "Enter") {
      const firstResult = els.quickSearchResults.querySelector("[data-action]");
      if (firstResult) firstResult.click();
    }
  });
  els.quickSearchResults.addEventListener("click", handleActionClick);
  els.workspace.addEventListener("click", handleActionClick);
  els.modalContent.addEventListener("click", handleActionClick);
  els.modalCloseBtn.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay) closeModal();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".quickSearch")) closeQuickSearch();
  });
}

bindEvents();
checkSession();
