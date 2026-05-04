const $$ = (selector) => document.querySelectorAll(selector);
const $ = (selector) => document.querySelector(selector);

let variablesState = {};
let currentFonts = [];

const pickrInstances = [];

const colorPickersContainer = document.getElementById("colorPickersContainer");
const fontMainSelect = document.getElementById("fontFamilyBase");
const fontStyleBase = document.getElementById("fontStyleBase");
const fontUploader = document.getElementById("fontUploader");
const fontGrid = document.getElementById("fontGrid");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const wifiIpText = document.getElementById("wifiIpText");

const popup = document.getElementById("customPopup");
const popupTitle = document.getElementById("popupTitle");
const popupMessage = document.getElementById("popupMessage");
const popupCloseBtn = document.getElementById("popupCloseBtn");

function showPopup(title, message, icon = "🎉") {
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  popup.querySelector(".popup-icon").textContent = icon;

  popup.classList.remove("hidden");
}

function hidePopup() {
  popup.classList.add("hidden");
}

popupCloseBtn?.addEventListener("click", hidePopup);

/* ---------------- GAME SETUP ---------------- */

$$(".op-card").forEach((label) => {
  const input = label.querySelector("input");

  label.addEventListener("click", () => {
    setTimeout(() => {
      label.classList.toggle("selected", input.checked);
    });
  });
});

$$(".level").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".level").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
  });
});

$("#nextBtn")?.addEventListener("click", () => {
  const operations = [...$$(".op-card input:checked")].map(
    (input) => input.value
  );

  const difficulty = $(".level.active").dataset.level;

  if (!operations.length) {
    alert("Select at least one operation");
    return;
  }

  localStorage.setItem("operations", JSON.stringify(operations));
  localStorage.setItem("difficulty", difficulty);

  window.location.href = "/teams";
});

/* ---------------- HELPERS ---------------- */

function isColorValue(value = "") {
  return (
    value.startsWith("#") ||
    value.startsWith("rgb") ||
    value.startsWith("hsl") ||
    value === "transparent"
  );
}

function extractPrimaryFontFamily(fontValue = "") {
  return fontValue.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

function destroyPickrs() {
  while (pickrInstances.length) {
    try {
      pickrInstances.pop().destroyAndRemove();
    } catch {}
  }
}

/* ---------------- COLORS ---------------- */

function buildColorPickers(vars) {
  destroyPickrs();
  colorPickersContainer.innerHTML = "";

  for (const [varName, value] of Object.entries(vars)) {
    if (!isColorValue(value)) continue;

    const wrapper = document.createElement("div");
    wrapper.className = "color-picker-container";

    const label = document.createElement("label");
    label.textContent = varName.replace("--", "");

    const pickerEl = document.createElement("div");
    pickerEl.id = `picker-${varName.replace(/[^a-z0-9-]/gi, "")}`;

    wrapper.append(label, pickerEl);
    colorPickersContainer.appendChild(wrapper);

    const pickr = Pickr.create({
      el: `#${pickerEl.id}`,
      theme: "classic",
      default: value,
      components: {
        preview: true,
        opacity: true,
        hue: true,
        interaction: {
          input: true,
          save: true,
        },
      },
    });

    pickr.on("save", (color) => {
      variablesState[varName] = color.toHEXA().toString();
      pickr.hide();
    });

    pickrInstances.push(pickr);
  }
}

/* ---------------- FONTS ---------------- */

function buildFontSelect(fonts = []) {
  if (!fontMainSelect) return;

  const currentFont = extractPrimaryFontFamily(
    variablesState["--font-main"] || ""
  );

  fontMainSelect.innerHTML = "";

  if (!fonts.length) {
    fontMainSelect.innerHTML = `<option value="">No fonts found</option>`;
    return;
  }

  fonts.forEach((font) => {
    const option = document.createElement("option");

    option.value = `'${font.family}'`;
    option.textContent = font.family;
    option.style.fontFamily = `'${font.family}'`;

    fontMainSelect.appendChild(option);
  });

  const matchedFont = fonts.find((font) => font.family === currentFont);

  fontMainSelect.value = matchedFont
    ? `'${matchedFont.family}'`
    : `'${fonts[0].family}'`;
}

function renderFontGrid(fonts = []) {
  if (!fontGrid) return;

  fontGrid.innerHTML = "";

  if (!fonts.length) {
    fontGrid.innerHTML = `<div>No fonts found in public/font</div>`;
    return;
  }

  fonts.forEach((font) => {
    const item = document.createElement("div");
    item.className = "font-item";

    const preview = document.createElement("div");
    preview.className = "font-preview";
    preview.textContent = "Abc 123";
    preview.style.fontFamily = `'${font.family}'`;

    const name = document.createElement("div");
    name.textContent = font.family;

    const del = document.createElement("button");
    del.className = "delete-font-btn";
    del.type = "button";
    del.textContent = "Delete";

    del.addEventListener("click", async () => {
      const result = await window.electron.invoke(
        "delete-font-file",
        font.file
      );

      if (!result?.success) {
        alert(result?.message || "Delete failed");
        return;
      }

      currentFonts = result.fonts || [];

      buildFontSelect(currentFonts);
      renderFontGrid(currentFonts);
      await loadVariables();
    });

    item.append(preview, name, del);
    fontGrid.appendChild(item);
  });
}

async function loadFonts() {
  if (!window.electron) return;

  const result = await window.electron.invoke("get-fonts");

  if (!result?.success) return;

  currentFonts = result.fonts || [];

  buildFontSelect(currentFonts);
  renderFontGrid(currentFonts);
}

fontUploader?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);

  for (const file of files) {
    const buffer = await file.arrayBuffer();

    const result = await window.electron.invoke("upload-font-file", {
      name: file.name,
      buffer: Array.from(new Uint8Array(buffer)),
    });

    if (!result?.success) {
      alert(result?.message || "Upload failed");
      continue;
    }

    currentFonts = result.fonts || [];
  }

  e.target.value = "";

  await loadFonts();
  await loadVariables();
});

/* ---------------- VARIABLES ---------------- */

async function loadVariables() {
  if (!window.electron) return;

  const result = await window.electron.invoke("get-css-variables");

  if (!result?.success) return;

  variablesState = result.variables || {};

  fontStyleBase.value = variablesState["--font-style-main"] || "normal";

  buildFontSelect(currentFonts);
  buildColorPickers(variablesState);
}

/* ---------------- SERVER INFO ---------------- */

async function loadServerInfo() {
  try {
    const res = await fetch("/api/server-info");
    const data = await res.json();

    wifiIpText.innerHTML = `
      WiFi IP: ${data.ip}<br>
      Team 1: ${data.team1Url}<br>
      Team 2: ${data.team2Url}<br>
      Game: ${data.gameUrl}
    `;
  } catch {
    wifiIpText.textContent = "WiFi IP not found";
  }
}

/* ---------------- LIVE PREVIEW ---------------- */

fontMainSelect?.addEventListener("change", () => {
  document.body.style.fontFamily = fontMainSelect.value;
});

fontStyleBase?.addEventListener("change", () => {
  document.body.style.fontStyle = fontStyleBase.value;
});

/* ---------------- SAVE SETTINGS ---------------- */

saveSettingsBtn?.addEventListener("click", async () => {
  variablesState["--font-main"] = fontMainSelect.value;
  variablesState["--font-style-main"] = fontStyleBase.value;

  const result = await window.electron.invoke(
    "update-css-variables",
    variablesState
  );

  if (result?.success) {
    showPopup("Saved!", "Your settings have been applied 🎯", "✅");
  } else {
    showPopup("Error", "Failed to save settings ❌", "⚠️");
  }
});

/* ---------------- RELOAD CSS ---------------- */

window.electron?.on("reload-styles", () => {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href").split("?")[0];
    link.setAttribute("href", `${href}?v=${Date.now()}`);
  });
});

/* ---------------- INIT ---------------- */

(async function init() {
  await loadFonts();
  await loadVariables();
  await loadServerInfo();
})();