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
  showItemsBtn: document.getElementById("showItemsBtn"),
  showFormulasBtn: document.getElementById("showFormulasBtn"),
  categoryList: document.getElementById("categoryList"),
  recordList: document.getElementById("recordList"),
  recordCount: document.getElementById("recordCount"),
  listEyebrow: document.getElementById("listEyebrow"),
  listTitle: document.getElementById("listTitle"),
  detailContent: document.getElementById("detailContent"),
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
  view: "items",
  query: "",
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
  if (["each", "ea", "unit", "units", "tube", "jar", "bottle", "bag"].includes(value)) return "unit";
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

function getCategoryName(id) {
  return state.categories.find((category) => category.id === id)?.name || "Uncategorized";
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
  renderCategories();
  renderRecordList();
  renderDetail();
}

function renderCategories() {
  const records = state.view === "items" ? state.items : state.formulas;
  const counts = new Map();

  for (const record of records) {
    const category = state.view === "items" ? getCategoryName(record.category_id) : record.category || "Uncategorized";
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  const categories = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  els.categoryList.innerHTML = `
    <button class="categoryBtn ${state.activeCategory ? "" : "active"}" type="button" data-category="">
      <strong>All</strong><span>${records.length}</span>
    </button>
    ${categories.map(([name, count]) => `
      <button class="categoryBtn ${state.activeCategory === name ? "active" : ""}" type="button" data-category="${escapeHtml(name)}">
        <strong>${escapeHtml(name)}</strong><span>${count}</span>
      </button>
    `).join("")}
  `;

  els.categoryList.querySelectorAll(".categoryBtn").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category || "";
      render();
    });
  });
}

function filteredItems() {
  const query = state.query.toLowerCase();
  return state.items.filter((item) => {
    const category = getCategoryName(item.category_id);
    const haystack = `${item.name} ${category} ${item.supplier || ""} ${item.notes || ""}`.toLowerCase();
    return (!state.activeCategory || category === state.activeCategory) && (!query || haystack.includes(query));
  });
}

function filteredFormulas() {
  const query = state.query.toLowerCase();
  return state.formulas.filter((formula) => {
    const haystack = `${formula.name} ${formula.category || ""} ${formula.label || ""} ${formula.notes || ""}`.toLowerCase();
    return (!state.activeCategory || formula.category === state.activeCategory) && (!query || haystack.includes(query));
  });
}

function renderRecordList() {
  els.showItemsBtn.classList.toggle("active", state.view === "items");
  els.showFormulasBtn.classList.toggle("active", state.view === "formulas");
  els.listEyebrow.textContent = state.view === "items" ? "Cost Items" : "Formulas";
  els.listTitle.textContent = state.activeCategory || "All Categories";

  if (state.view === "items") {
    const items = filteredItems();
    els.recordCount.textContent = `${items.length} records`;
    els.recordList.innerHTML = items.map((item) => `
      <button class="recordCard ${state.selectedItemId === item.id ? "active" : ""}" type="button" data-id="${item.id}">
        <span class="recordTitle">${escapeHtml(item.name)}</span>
        <span class="recordMeta">${escapeHtml(getCategoryName(item.category_id))}</span>
        <span class="recordMeta">oz ${money(item.cost_per_oz)} / g ${money(item.cost_per_gram)} / unit ${money(item.cost_per_unit)}</span>
      </button>
    `).join("") || `<div class="emptyState">No cost items found.</div>`;
  } else {
    const formulas = filteredFormulas();
    els.recordCount.textContent = `${formulas.length} records`;
    els.recordList.innerHTML = formulas.map((formula) => {
      const value = evaluateFormula(formula);
      return `
        <button class="recordCard ${state.selectedFormulaId === formula.id ? "active" : ""}" type="button" data-id="${formula.id}">
          <span class="recordTitle">${escapeHtml(formula.name)}</span>
          <span class="recordMeta">${escapeHtml(formula.category || "Formula")}${formula.label ? ` - ${escapeHtml(formula.label)}` : ""}</span>
          <span class="recordMeta">Calculated ${money(value)}</span>
        </button>
      `;
    }).join("") || `<div class="emptyState">No formulas found.</div>`;
  }

  els.recordList.querySelectorAll(".recordCard").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.view === "items") {
        state.selectedItemId = button.dataset.id;
        state.selectedFormulaId = "";
      } else {
        state.selectedFormulaId = button.dataset.id;
        state.selectedItemId = "";
      }
      renderDetail();
      renderRecordList();
    });
  });
}

function renderDetail() {
  if (state.selectedItemId) {
    const item = state.items.find((record) => record.id === state.selectedItemId);
    if (item) return renderItemDetail(item);
  }
  if (state.selectedFormulaId) {
    const formula = state.formulas.find((record) => record.id === state.selectedFormulaId);
    if (formula) return renderFormulaDetail(formula);
  }
  els.detailContent.className = "emptyState";
  els.detailContent.innerHTML = "Select a cost item or formula.";
}

function renderItemDetail(item) {
  const affected = formulasAffectedByItem(item);
  els.detailContent.className = "detailGrid";
  els.detailContent.innerHTML = `
    <div>
      <div class="kicker">${escapeHtml(getCategoryName(item.category_id))}</div>
      <h2>${escapeHtml(item.name)}</h2>
      <div class="small">${escapeHtml(item.source_name_cell || "Manual item")}</div>
    </div>

    <div class="metricGrid">
      <div class="metricBox"><span class="small">Cost / oz</span><strong>${money(item.cost_per_oz)}</strong></div>
      <div class="metricBox"><span class="small">Cost / gram</span><strong>${money(item.cost_per_gram)}</strong></div>
      <div class="metricBox"><span class="small">Cost / unit</span><strong>${money(item.cost_per_unit)}</strong></div>
    </div>

    <div class="fieldGrid">
      <label>Purchase price<input id="itemPurchasePrice" type="number" step="0.0001" value="${number(item.purchase_price)}"></label>
      <label>Purchase quantity<input id="itemPurchaseQty" type="number" step="0.0001" value="${number(item.purchase_quantity)}"></label>
      <label>Purchase unit<input id="itemPurchaseUnit" value="${escapeHtml(item.purchase_unit || "")}"></label>
      <label>Supplier<input id="itemSupplier" value="${escapeHtml(item.supplier || "")}"></label>
      <label>Cost per oz<input id="itemCostOz" type="number" step="0.0001" value="${number(item.cost_per_oz)}"></label>
      <label>Cost per gram<input id="itemCostGram" type="number" step="0.0001" value="${number(item.cost_per_gram)}"></label>
      <label>Cost per unit<input id="itemCostUnit" type="number" step="0.0001" value="${number(item.cost_per_unit)}"></label>
    </div>
    <label class="fullField">Notes<textarea id="itemNotes">${escapeHtml(item.notes || "")}</textarea></label>

    <div class="buttonRow">
      <button id="saveItemBtn" class="primaryBtn" type="button">Save price update</button>
      <button id="recalcFromPurchaseBtn" class="mutedBtn" type="button">Calculate from purchase</button>
    </div>

    <section>
      <h3>Affected formulas</h3>
      <div class="affectedList">
        ${affected.length ? affected.map((formula) => `
          <button class="affectedItem" type="button" data-formula-id="${formula.id}">
            <span>${escapeHtml(formula.name)}</span>
            <strong>${money(evaluateFormula(formula))}</strong>
          </button>
        `).join("") : `<div class="small">No formula references this item yet.</div>`}
      </div>
    </section>
  `;

  document.getElementById("saveItemBtn").addEventListener("click", () => saveItem(item));
  document.getElementById("recalcFromPurchaseBtn").addEventListener("click", recalcItemFromPurchase);
  els.detailContent.querySelectorAll("[data-formula-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "formulas";
      state.selectedFormulaId = button.dataset.formulaId;
      state.selectedItemId = "";
      render();
    });
  });
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
    document.getElementById("itemCostOz").value = number(price / qty * 28.3495);
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

  showStatus(`${item.name} updated. Formula totals have been recalculated in the browser.`);
  await loadWorkspace();
  state.selectedItemId = item.id;
  renderDetail();
}

function renderFormulaDetail(formula) {
  const lines = state.lines.filter((line) => line.formula_id === formula.id);
  const calculated = evaluateFormula(formula);
  els.detailContent.className = "detailGrid";
  els.detailContent.innerHTML = `
    <div>
      <div class="kicker">${escapeHtml(formula.category || "Formula")}</div>
      <h2>${escapeHtml(formula.name)}</h2>
      <div class="small">${escapeHtml(formula.source_cell || "")}${formula.label ? ` - ${escapeHtml(formula.label)}` : ""}</div>
    </div>
    <div class="metricGrid">
      <div class="metricBox"><span class="small">Calculated COGS</span><strong>${money(calculated)}</strong></div>
      <div class="metricBox"><span class="small">Workbook value</span><strong>${money(formula.workbook_value)}</strong></div>
      <div class="metricBox"><span class="small">Line refs</span><strong>${lines.length}</strong></div>
    </div>
    <div class="small"><code>=${escapeHtml(formula.formula_expression || "")}</code></div>
    <table class="lineTable">
      <thead><tr><th>Reference</th><th>Item</th><th>Qty</th><th>Unit</th><th>Line cost</th></tr></thead>
      <tbody>
        ${lines.map((line) => {
          const item = line.cost_item_id ? state.items.find((record) => record.id === line.cost_item_id) : null;
          const cost = item ? lineCost(line, item) : getCellValue(line.source_cell_ref);
          return `
            <tr>
              <td>${escapeHtml(line.source_cell_ref || "")}</td>
              <td>${escapeHtml(item?.name || line.source_item_name || "Workbook reference")}</td>
              <td>${number(line.quantity, 3) || "-"}</td>
              <td>${escapeHtml(line.unit || "")}</td>
              <td>${money(cost)}</td>
            </tr>
          `;
        }).join("") || `<tr><td colspan="5" class="small">No parsed line refs for this formula.</td></tr>`}
      </tbody>
    </table>
  `;
}

function formulasAffectedByItem(item) {
  const sourceCells = new Set(Object.values(item.source_cells || {}).filter(Boolean));
  const directFormulaIds = new Set(
    state.lines
      .filter((line) => line.cost_item_id === item.id || sourceCells.has(line.source_cell_ref))
      .map((line) => line.formula_id)
  );
  return state.formulas.filter((formula) => directFormulaIds.has(formula.id));
}

function getCellValue(ref, stack = new Set()) {
  if (!ref) return 0;
  const item = state.items.find((record) => {
    const cells = record.source_cells || {};
    return cells.oz === ref || cells.gram === ref || cells.unit === ref;
  });
  if (item) {
    if (item.source_cells?.oz === ref) return Number(item.cost_per_oz) || 0;
    if (item.source_cells?.gram === ref) return Number(item.cost_per_gram) || 0;
    if (item.source_cells?.unit === ref) return Number(item.cost_per_unit) || 0;
  }

  const formula = state.formulas.find((record) => record.source_cell === ref);
  if (formula && !stack.has(ref)) {
    stack.add(ref);
    const value = evaluateFormula(formula, stack);
    stack.delete(ref);
    return value;
  }

  const cell = state.cells.find((record) => record.ref === ref);
  return Number(cell?.numeric_value) || 0;
}

function evaluateFormula(formula, stack = new Set()) {
  if (!formula?.formula_expression) return Number(formula?.workbook_value) || 0;
  const expression = formula.formula_expression.replace(/\b[A-Z]{1,3}\d+\b/g, (ref) => String(getCellValue(ref, stack)));
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return Number(formula.workbook_value) || 0;
  try {
    return Number(Function(`"use strict"; return (${expression});`)()) || 0;
  } catch {
    return Number(formula.workbook_value) || 0;
  }
}

function lineCost(line, item) {
  const quantity = Number(line.quantity) || 1;
  const unit = normalizeUnit(line.unit);
  if (unit === "g") return quantity * (Number(item.cost_per_gram) || 0);
  if (unit === "oz") return quantity * (Number(item.cost_per_oz) || 0);
  return quantity * (Number(item.cost_per_unit) || 0);
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
      <div class="metricBox"><span class="small">Cells</span><strong>${parsed.cells.length}</strong></div>
      <div class="metricBox"><span class="small">Cost items</span><strong>${parsed.items.length}</strong></div>
      <div class="metricBox"><span class="small">Formulas</span><strong>${parsed.formulas.length}</strong></div>
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

function bindEvents() {
  els.loginBtn.addEventListener("click", login);
  els.logoutBtn.addEventListener("click", logout);
  els.loginPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  els.globalSearch.addEventListener("input", () => {
    state.query = els.globalSearch.value.trim();
    renderRecordList();
  });
  els.showItemsBtn.addEventListener("click", () => {
    state.view = "items";
    state.activeCategory = "";
    render();
  });
  els.showFormulasBtn.addEventListener("click", () => {
    state.view = "formulas";
    state.activeCategory = "";
    render();
  });
  els.workbookFile.addEventListener("change", handleWorkbookFile);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.modalCloseBtn.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay) closeModal();
  });
}

bindEvents();
checkSession();
