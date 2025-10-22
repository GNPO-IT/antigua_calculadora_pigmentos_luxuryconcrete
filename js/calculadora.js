// js/calculadora.js
document.addEventListener("DOMContentLoaded", () => {
  const sistemaSel  = document.getElementById("sistema");
  const colorSel    = document.getElementById("color");
  const productoSel = document.getElementById("producto");
  const kgInput     = document.getElementById("kg");
  const resultado   = document.getElementById("resultado");
  const calcularBtn = document.getElementById("calcular");

  // ⚠️ IMPORTANTE: revisa el nombre real del fichero de Limecrete.
  // Si en /data está "nature_new.json", cambia "natture_new.json" por "nature_new.json".
  const FILE_BY_SYSTEM = {
    concrete:       "sttandard_new.json",
    monocrete:      "evoluttion_new.json",
    concrete_pool:  "atlanttic.json",
    easycret:       "efectto_new.json",
    concrete_pox:   "industrial.json",
    limecrete:      "natture_new.json", // <-- cambia a "nature_new.json" si es tu caso
  };

  const META_FIELDS = new Set([
    "id", "color", "subcolor", "color_lux", "color_myr",
    "arcocem_basic", "color_beton"
  ]);

  const DATA_BASE_PATH = "./data/";
  const EQUIV_FILE = `${DATA_BASE_PATH}color_equivalencias2.json`;

  let data = [];              // dataset del sistema actual
  let productos = [];         // columnas de producto del dataset actual
  let colorKey = "color_lux"; // clave de color a usar (o "color" si lux está vacío)

  // ====== Equivalencias / Ocultación ======
  let equiv = { renombrar: {}, ocultar: [] };
  const equivNorm = { map: new Map(), hide: new Set(), ready: false };

  const norm = (s) =>
    (s ?? "")
      .toString()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

  function prepararEquivalencias() {
    equivNorm.map = new Map(
      Object.entries(equiv.renombrar || {}).map(([k, v]) => [norm(k), v])
    );
    equivNorm.hide = new Set((equiv.ocultar || []).map(norm));
    equivNorm.ready = true;
  }

  async function cargarEquivalencias() {
    try {
      const r = await fetch(EQUIV_FILE, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      equiv = await r.json();
    } catch (_e) {
      // Si no existe el archivo, seguimos sin transformar/ocultar
      equiv = { renombrar: {}, ocultar: [] };
    } finally {
      prepararEquivalencias();
    }
  }

  const colorOculto = (raw) => equivNorm.hide.has(norm(raw));
  const colorAMostrar = (raw) => equivNorm.map.get(norm(raw)) || raw;

  // ====== Utilidades UI ======
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function fillSelectSimple(select, values, labelFn = (v) => v, placeholder) {
    const head = placeholder ? `<option value="" disabled selected>${esc(placeholder)}</option>` : "";
    if (!values.length) {
      select.innerHTML = head || `<option value="" disabled selected>Sin opciones</option>`;
      return;
    }
    select.innerHTML =
      head + values.map(v => `<option value="${esc(v)}">${esc(labelFn(v))}</option>`).join("");
  }

  function fillSelectOptions(select, options, placeholder) {
    // options: [{value, label}]
    const head = placeholder ? `<option value="" disabled selected>${esc(placeholder)}</option>` : "";
    if (!options.length) {
      select.innerHTML = head || `<option value="" disabled selected>Sin opciones</option>`;
      return;
    }
    select.innerHTML =
      head + options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  }

  function resetSelect(select, placeholder) {
    select.innerHTML = `<option value="" disabled selected>${esc(placeholder)}</option>`;
  }

  function setSelectLoading(select, text) {
    select.innerHTML = `<option value="" disabled selected>${esc(text)}</option>`;
  }

  function prettify(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function limpiarResultado() {
    resultado.innerHTML = "";
  }

  function pintarError(msg) {
    resultado.innerHTML = `<div class="alert alert-danger">${esc(msg)}</div>`;
  }

  function isNumericColumn(key) {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const v = data[i]?.[key];
      if (v == null || v === "") continue;
      return !isNaN(parseFloat(v));
    }
    return false;
  }

  // ====== Carga de un sistema ======
  async function cargarSistema(sistema) {
    const file = FILE_BY_SYSTEM[sistema];
    if (!file) {
      pintarError("Sistema desconocido.");
      return;
    }

    const url = `${DATA_BASE_PATH}${file}`;
    limpiarResultado();
    setSelectLoading(colorSel, "Cargando colores…");
    setSelectLoading(productoSel, "Cargando productos…");

    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      if (!Array.isArray(json) || json.length === 0) {
        throw new Error("El JSON no tiene registros.");
      }

      data = json;

      // ¿Usamos color_lux o color?
      const hayLux = data.some(r => (r.color_lux || "").toString().trim() !== "");
      colorKey = hayLux ? "color_lux" : "color";

      // --- Colores únicos del dataset ---
      const baseColors = [...new Set(
        data.map(r => (r[colorKey] || "").toString().trim())
      )].filter(v => v !== "");

      let colorOptions = baseColors
        // 1) Ocultamos los que tocan (si hay equivalencias)
        .filter(c => !equivNorm.ready || !colorOculto(c))
        // 2) Convertimos a {value, label} usando el nombre Luxury
        .map(c => ({ value: c, label: equivNorm.ready ? colorAMostrar(c) : c }));

      // Orden por etiqueta visible (es-ES)
      colorOptions.sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

      // Si no hay colores, intento fallback color + subcolor
      if (!colorOptions.length) {
        const fallback = [...new Set(
          data.map(r => {
            const c = (r.color || "").toString().trim();
            const s = (r.subcolor || "").toString().trim();
            return [c, s].filter(Boolean).join(" - ");
          })
        )].filter(Boolean).map(x => ({ value: x, label: x }));
        colorOptions = fallback;
      }

      fillSelectOptions(colorSel, colorOptions, "Selecciona un color");

      // --- Columnas de producto (numéricas y no meta) ---
      const sample = data[0];
      productos = Object.keys(sample)
        .filter(k => !META_FIELDS.has(k))
        .filter(k => typeof sample[k] === "number" || isNumericColumn(k));

      if (!productos.length) {
        productos = Object.keys(sample).filter(k => !META_FIELDS.has(k));
      }

      fillSelectSimple(productoSel, productos, (k) => prettify(k), "Selecciona un producto");
      limpiarResultado();
    } catch (err) {
      console.error("Error cargando JSON:", err);
      pintarError("No se pudo cargar el sistema seleccionado. Revisa la ruta de datos o el formato del JSON.");
      resetSelect(colorSel, "Selecciona un sistema");
      resetSelect(productoSel, "Selecciona un sistema");
      data = [];
      productos = [];
    }
  }

  // ====== Eventos ======
  sistemaSel.addEventListener("change", (e) => {
    cargarSistema(e.target.value);
  });

  calcularBtn.addEventListener("click", () => {
    const color = colorSel.value;
    const producto = productoSel.value;
    const kg = parseFloat(kgInput.value);

    if (!data.length) {
      pintarError("Selecciona un sistema primero.");
      return;
    }
    if (!color || !producto || isNaN(kg) || kg <= 0) {
      pintarError("Rellena todos los campos correctamente antes de calcular.");
      return;
    }

    // Busca la fila por color (o por combinación color - subcolor)
    let fila = data.find(r => (r[colorKey] || "").toString().trim() === color);
    if (!fila && color.includes(" - ")) {
      const [c, s] = color.split(" - ").map(v => v.trim());
      fila = data.find(r => (r.color || "").toString().trim() === c && (r.subcolor || "").toString().trim() === s);
    }
    if (!fila) {
      pintarError("No se encontró el color en el sistema seleccionado.");
      return;
    }

    const valor = fila[producto];
    const pigmentoBase = parseFloat(valor);
    if (isNaN(pigmentoBase)) {
      pintarError("Producto no disponible para este color.");
      return;
    }

    const total = pigmentoBase * kg;

    // Nombre visible del color (Luxury) para el resultado
    const colorVisible = equivNorm.ready ? colorAMostrar(color) : color;

    resultado.innerHTML = `
      <div class="card p-3">
        <h5>Resultado</h5>
        <p><strong>Producto:</strong> ${esc(prettify(producto))}</p>
        <p><strong>Color:</strong> ${esc(colorVisible)}</p>
        <p><strong>Kilos:</strong> ${esc(kg)} kg</p>
        <p><strong>Peso total del pigmento:</strong> ${esc(total.toFixed(2))} g</p>
      </div>`;
  });

  // Carga inicial: primero equivalencias, luego el sistema por defecto
  cargarEquivalencias().finally(() => cargarSistema(sistemaSel.value));
});
