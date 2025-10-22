document.addEventListener("DOMContentLoaded", () => {
  const sistemaSel  = document.getElementById("sistema");
  const colorSel    = document.getElementById("color");
  const productoSel = document.getElementById("producto");
  const kgInput     = document.getElementById("kg");
  const resultado   = document.getElementById("resultado");
  const calcularBtn = document.getElementById("calcular");

  // 1) Mapa de sistema -> fichero real en /data
  const FILE_BY_SYSTEM = {
    concrete:       "sttandard_new.json",
    monocrete:      "evoluttion_new.json",
    concrete_pool:  "atlanttic.json",
    easycret:       "efectto_new.json",
    concrete_pox:   "industrial.json",
    limecrete:      "natture_new.json",
  };

  // 2) Campos que NO son productos (metadatos)
  const META_FIELDS = new Set([
    "id", "color", "subcolor", "color_lux", "color_myr",
    "arcocem_basic", "color_beton"
  ]);

  const DATA_BASE_PATH = "./data/";

  let data = [];        // dataset del sistema actual
  let productos = [];   // columnas de producto del dataset actual
  let colorKey = "color_lux"; // clave de color a usar (o "color" si lux está vacío)

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

      // 2.1) Determinar si usamos color_lux o color
      const hayLux = data.some(r => (r.color_lux || "").toString().trim() !== "");
      colorKey = hayLux ? "color_lux" : "color";

      // 2.2) Rellenar colores únicos
      const colores = [...new Set(
        data.map(r => (r[colorKey] || "").toString().trim())
      )].filter(v => v !== "");
      if (colores.length === 0) {
        // como último recurso, usa combinación color+subcolor
        const fallback = [...new Set(
          data.map(r => {
            const c = (r.color || "").toString().trim();
            const s = (r.subcolor || "").toString().trim();
            return [c, s].filter(Boolean).join(" - ");
          })
        )].filter(Boolean);
        fillSelect(colorSel, fallback);
      } else {
        fillSelect(colorSel, colores);
      }

      // 2.3) Detectar columnas de producto (numéricas y no meta)
      const sample = data[0];
      productos = Object.keys(sample)
        .filter(k => !META_FIELDS.has(k))
        .filter(k => typeof sample[k] === "number" || isNumericColumn(k));

      if (productos.length === 0) {
        // si no detecta numéricas, usa todas menos meta (hay casos con números como string)
        productos = Object.keys(sample).filter(k => !META_FIELDS.has(k));
      }

      // Opciones más legibles: convierto snake_case a títulos
      fillSelect(productoSel, productos, (k) => prettify(k));

      limpiarResultado();
    } catch (err) {
      console.error("Error cargando JSON:", err);
      pintarError("No se pudo cargar el sistema seleccionado. Revisa la ruta de datos o el formato del JSON.");
      // deja los selects en estado inicial
      resetSelect(colorSel, "Selecciona un sistema");
      resetSelect(productoSel, "Selecciona un sistema");
      data = [];
      productos = [];
    }
  }

  function isNumericColumn(key) {
    // mira en algunas filas si es convertible a número
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const v = data[i]?.[key];
      if (v == null || v === "") continue;
      return !isNaN(parseFloat(v));
    }
    return false;
  }

  function fillSelect(select, values, labelFn = (v) => v) {
    if (!values.length) {
      resetSelect(select, "Sin opciones");
      return;
    }
    select.innerHTML = values.map(v => `<option value="${v}">${labelFn(v)}</option>`).join("");
  }

  function resetSelect(select, placeholder) {
    select.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  }

  function setSelectLoading(select, text) {
    select.innerHTML = `<option value="" disabled selected>${text}</option>`;
  }

  function prettify(key) {
    // microdeck_wt -> Microdeck WT ; small_grain -> Small Grain
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function limpiarResultado() {
    resultado.innerHTML = "";
  }

  function pintarError(msg) {
    resultado.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
  }

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

    // Busca la fila por color (o por combinación como fallback)
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

    resultado.innerHTML = `
      <div class="card p-3">
        <h5>Resultado</h5>
        <p><strong>Producto:</strong> ${prettify(producto)}</p>
        <p><strong>Color:</strong> ${color}</p>
        <p><strong>Kilos:</strong> ${kg} kg</p>
        <p><strong>Peso total del pigmento:</strong> ${total.toFixed(2)} g</p>
      </div>`;
  });

  // Carga inicial
  cargarSistema(sistemaSel.value);
});
