document.addEventListener("DOMContentLoaded", () => {
  const sistemaSel  = document.getElementById("sistema");
  const colorSel    = document.getElementById("color");
  const productoSel = document.getElementById("producto");
  const kgInput     = document.getElementById("kg");
  const resultado   = document.getElementById("resultado");
  const calcularBtn = document.getElementById("calcular");

  // 1) Sistema -> fichero en /data (ajusta nombres si alguno difiere)
  const FILE_BY_SYSTEM = {
    concrete:       "sttandard_new.json",
    monocrete:      "evoluttion_new.json",
    concrete_pool:  "atlanttic.json",
    easycret:       "efectto_new.json",
    concrete_pox:   "industrial.json",
    limecrete:      "natture_new.json",
  };

  // 2) Campos meta (no productos)
  const META_FIELDS = new Set([
    "id","color","subcolor","color_lux","color_myr","arcocem_basic","color_beton"
  ]);

  // 3) (Opcional) imagen por producto (usa tus rutas si las tienes)
  const IMAGE_BY_PRODUCT = {
    concrete_base: "img/concrete_base.jpg",
    concrete_wall_wt: "img/concrete_wall.jpg",
    concrete_floor_wt: "img/concrete_floor.jpg",
    concrete_stone_wt: "img/concrete_stone.jpg",
    concrete_wall_dsv: "img/concrete_wall.jpg",
    concrete_floor_dsv: "img/concrete_floor.jpg",
    concrete_stone_dsv: "img/concrete_stone.jpg",
    concrete_wall_top100: "img/concrete_wall.jpg",
    concrete_floor_top100: "img/concrete_floor.jpg",
    concrete_stone_top100: "img/concrete_stone.jpg",

    monocrete_base: "img/monocrete_base.jpg",
    monocrete_wall_wt: "img/monocrete_wall.jpg",
    monocrete_floor_wt: "img/monocrete_floor.jpg",
    monocrete_wall_dsv: "img/monocrete_wall.jpg",
    monocrete_floor_dsv: "img/monocrete_floor.jpg",
    monocrete_wall_top100: "img/monocrete_wall.jpg",
    monocrete_floor_top100: "img/monocrete_floor.jpg",
    monocrete_stone_top100: "img/monocrete_stone.jpg",

    concrete_pool_grand: "img/concrete_pool.jpg",
    concrete_pool_medium: "img/concrete_pool.jpg",

    easycret_thin: "img/easycret_thin.jpg",
    easycret_medium: "img/easycret_medium.jpg",
    easycret_basic: "img/easycret_basic.jpg",
    easycret_extra: "img/easycret_extra.jpg",

    concrete_pox_extra: "img/concrete_pox_extra.webp",
    concrete_pox_medium: "img/concrete_pox_medium.webp",
    concrete_pox_basic: "img/concrete_pox_basic.webp",
    concrete_pox_thin: "img/concrete_pox_thin.webp",

    limecrete_thin_wt: "img/limecrete_thin.webp",
    limecrete_medium_wt: "img/limecrete_medium.webp",
    limecrete_basic_wt: "img/limecrete_basic.webp",
    limecrete_extra_wt: "img/limecrete_extra.webp",
    limecrete_thin_dsv: "img/limecrete_thin.webp",
    limecrete_medium_dsv: "img/limecrete_medium.webp",
    limecrete_basic_dsv: "img/limecrete_basic.webp",
    limecrete_extra_dsv: "img/limecrete_extra.webp",
    limecrete_thin_top100: "img/limecrete_thin.webp",
    limecrete_medium_top100: "img/limecrete_medium.webp",
    limecrete_basic_top100: "img/limecrete_basic.webp",
    limecrete_extra_top100: "img/limecrete_extra.webp",
  };

  const DATA_BASE_PATH = "./data/";
  let data = [];
  let productos = [];
  let colorKey = "color_lux";

  // utilidades
  function resetSelect(select, placeholder) {
    select.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  }
  function setSelectLoading(select, text) {
    select.innerHTML = `<option value="" disabled selected>${text}</option>`;
  }
  function fillSelect(select, values, labelFn = (v) => v) {
    if (!values.length) return resetSelect(select, "Sin opciones");
    select.innerHTML = values.map(v => `<option value="${v}">${labelFn(v)}</option>`).join("");
  }
  function prettify(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  function pintarError(msg) {
    resultado.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
  }
  function limpiarResultado() { resultado.innerHTML = ""; }

  async function cargarSistema(sistema) {
    const file = FILE_BY_SYSTEM[sistema];
    if (!file) { pintarError("Sistema desconocido."); return; }

    limpiarResultado();
    setSelectLoading(colorSel, "Cargando colores…");
    setSelectLoading(productoSel, "Cargando productos…");

    try {
      const resp = await fetch(`${DATA_BASE_PATH}${file}`, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error("JSON vacío");

      data = json;

      // Color key
      const hayLux = data.some(r => (r.color_lux || "").toString().trim() !== "");
      colorKey = hayLux ? "color_lux" : "color";

      // Colores únicos
      const colores = [...new Set(
        data.map(r => (r[colorKey] || "").toString().trim())
      )].filter(Boolean);
      if (colores.length) {
        fillSelect(colorSel, colores);
      } else {
        resetSelect(colorSel, "Sin colores");
      }

      // Columnas de producto: todas las no-meta que parezcan numéricas en alguna fila
      const claves = new Set();
      for (const r of data) Object.keys(r).forEach(k => claves.add(k));

      productos = [...claves].filter(k => !META_FIELDS.has(k)).filter(k => {
        // considerar numérica si en alguna fila es un número
        return data.some(r => r[k] !== "" && !isNaN(parseFloat(r[k])));
      });

      if (!productos.length) productos = [...claves].filter(k => !META_FIELDS.has(k));

      fillSelect(productoSel, productos, prettify);
      limpiarResultado();
    } catch (e) {
      console.error(e);
      pintarError("No se pudo cargar el sistema seleccionado.");
      resetSelect(colorSel, "Selecciona un sistema");
      resetSelect(productoSel, "Selecciona un sistema");
      data = []; productos = [];
    }
  }

  sistemaSel.addEventListener("change", e => cargarSistema(e.target.value));

  calcularBtn.addEventListener("click", () => {
    const color = colorSel.value;
    const producto = productoSel.value;
    const kg = parseFloat(kgInput.value);

    if (!data.length) return pintarError("Selecciona un sistema primero.");
    if (!color || !producto || isNaN(kg) || kg <= 0) {
      return pintarError("Rellena todos los campos correctamente antes de calcular.");
    }

    // --- DESGLOSE MULTI-PIGMENTO (fiel al PHP) ---
    const filasColor = data.filter(r => (r[colorKey] || "").toString().trim() === color);

    if (!filasColor.length) return pintarError("No se encontró el color en el sistema.");

    let total = 0;
    const lineas = [];

    for (const r of filasColor) {
      const base = parseFloat(r[producto]);           // p.ej. gramos por kg
      const pigmento = (r.arcocem_basic || "").toString().trim() || "Pigmento";
      if (!isNaN(base) && base > 0) {
        const peso = base * kg;
        total += peso;
        lineas.push({ pigmento, peso });
      }
    }

    if (!lineas.length) return pintarError("Producto no disponible para este color.");

    // render
    const imgSrc = IMAGE_BY_PRODUCT[producto];
    const imgHtml = imgSrc ? `<img src="${imgSrc}" alt="${prettify(producto)}" style="display:block;margin:auto;width:250px;">` : "";

    const desgloseHtml = lineas
      .sort((a,b) => b.peso - a.peso)
      .map(l => `<p class="mb-1" style="text-align:center;">
                   <strong>${l.pigmento}</strong>: ${l.peso.toFixed(2)} g / ${kg} kg
                 </p>`).join("");

    resultado.innerHTML = `
      <div class="card p-3">
        ${imgHtml}
        <p class="mt-3 mb-1" style="text-align:center;"><strong>Producto:</strong> ${prettify(producto)}</p>
        <p class="mb-1" style="text-align:center;"><strong>Color:</strong> ${color}</p>
        <p class="mb-3" style="text-align:center;"><strong>Peso total:</strong> ${kg} kg</p>
        <p class="pig_tot fw-semibold text-center mb-2"><strong>Total pigmentos:</strong> ${total.toFixed(2)} g</p>
        ${desgloseHtml}
      </div>`;
  });

  // carga inicial
  cargarSistema(sistemaSel.value);
});
