document.addEventListener("DOMContentLoaded", () => {
    const sistemaSel = document.getElementById("sistema");
    const colorSel = document.getElementById("color");
    const productoSel = document.getElementById("producto");
    const kgInput = document.getElementById("kg");
    const resultado = document.getElementById("resultado");
    const calcularBtn = document.getElementById("calcular");

    // ⚠️ Cambia "natture_new.json" a "nature_new.json" si ese es tu archivo real.
    const FILE_BY_SYSTEM = {
        concrete: "sttandard_new.json",
        monocrete: "evoluttion_new.json",
        concrete_pool: "atlanttic.json",
        easycret: "efectto_new.json",
        concrete_pox: "industrial.json",
        limecrete: "natture_new.json"
    };

    const META_FIELDS = new Set([
        "id", "color", "subcolor", "color_lux", "color_myr",
        "arcocem_basic", "color_beton"
    ]);

    const DATA_BASE_PATH = "./data/";
    const EQUIV_COL_FILE = `${DATA_BASE_PATH}color_equivalencias.json`;
    const EQUIV_PROD_FILE = `${DATA_BASE_PATH}producto_equivalencias.json`;

    let data = [];              // dataset del sistema actual
    let productos = [];         // columnas de producto del dataset actual
    let colorKey = "color_lux"; // clave de color a usar (o "color" si lux está vacío)

    // ====== Equivalencias de color ======
    let equivCol = { renombrar: {}, ocultar: [] };
    const colNorm = { map: new Map(), hide: new Set(), ready: false };

    // ====== Equivalencias de producto ======
    let equivProd = { por_sistema: {}, ocultar: {} };
    const prodNorm = {
        labels: new Map(), // sistema -> Map( columna -> etiqueta )
        hide: new Map(), // sistema -> Set( columnas a ocultar )
        ready: false
    };

    const norm = (s) =>
        (s ?? "")
            .toString()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

    // --- preparar equivalencias de color
    function prepararEquivalenciasColor() {
        colNorm.map = new Map(
            Object.entries(equivCol.renombrar || {}).map(([k, v]) => [norm(k), v])
        );
        colNorm.hide = new Set((equivCol.ocultar || []).map(norm));
        colNorm.ready = true;
    }

    async function cargarEquivalenciasColor() {
        try {
            const r = await fetch(EQUIV_COL_FILE, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            equivCol = await r.json();
        } catch (_e) {
            equivCol = { renombrar: {}, ocultar: [] };
        } finally {
            prepararEquivalenciasColor();
        }
    }

    const colorOculto = (raw) => colNorm.hide.has(norm(raw));
    const colorAMostrar = (raw) => colNorm.map.get(norm(raw)) || raw;

    // --- preparar equivalencias de producto
    function prepararEquivalenciasProducto() {
        prodNorm.labels.clear();
        prodNorm.hide.clear();

        const porSistema = equivProd.por_sistema || {};
        const ocultar = equivProd.ocultar || {};

        Object.keys(porSistema).forEach(sys => {
            const map = new Map(Object.entries(porSistema[sys] || {}));
            prodNorm.labels.set(sys, map);
        });

        Object.keys(ocultar).forEach(sys => {
            const set = new Set(ocultar[sys] || []);
            prodNorm.hide.set(sys, set);
        });

        prodNorm.ready = true;
    }

    async function cargarEquivalenciasProducto() {
        try {
            const r = await fetch(EQUIV_PROD_FILE, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            equivProd = await r.json();
        } catch (_e) {
            // sin archivo, seguimos con detección automática
            equivProd = { por_sistema: {}, ocultar: {} };
        } finally {
            prepararEquivalenciasProducto();
        }
    }

    // ====== Utilidades UI ======
    const esc = (s) =>
        String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

    function fillSelectOptions(select, options, placeholder) {
        const head = `<option value="" disabled selected>${esc(placeholder)}</option>`;
        if (!options.length) {
            select.innerHTML = head;
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

    // ====== Cargar sistema ======
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

            // ---- COLORES ----
            const baseColors = [...new Set(
                data.map(r => (r[colorKey] || "").toString().trim())
            )].filter(v => v !== "");

            let colorOptions = baseColors
                .filter(c => !colNorm.ready || !colorOculto(c))
                .map(c => ({ value: c, label: colNorm.ready ? colorAMostrar(c) : c }));

            colorOptions.sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

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

            // ---- PRODUCTOS ----
            const sample = data[0];
            let columnas = Object.keys(sample).filter(k => !META_FIELDS.has(k));

            // si hay equivalencias para este sistema, usamos SOLO esas columnas (y en ese orden)
            const labelsMap = prodNorm.labels.get(sistema);
            const hideSet = prodNorm.hide.get(sistema) || new Set();

            let prodOptions = [];
            if (prodNorm.ready && labelsMap && labelsMap.size) {
                // columnas del mapeo que existan en el dataset y NO estén ocultas
                for (const [colKey, visibleLabel] of labelsMap.entries()) {
                    if (!hideSet.has(colKey) && columnas.includes(colKey)) {
                        prodOptions.push({ value: colKey, label: visibleLabel });
                    }
                }
            } else {
                // fallback: detecta numéricas (o todas) y úsalas con prettify
                let cols = columnas.filter(k => typeof sample[k] === "number" || isNumericColumn(k));
                if (!cols.length) cols = columnas; // por si vinieran como string numérico
                prodOptions = cols.map(k => ({ value: k, label: prettify(k) }));
            }

            fillSelectOptions(productoSel, prodOptions, "Selecciona un producto");
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
        const sistema = sistemaSel.value;
        const color = colorSel.value;        // valor visible seleccionado
        const producto = productoSel.value;     // clave de columna real (p. ej. "microbase", "microdeck_wt", etc.)
        const kg = parseFloat(String(kgInput.value).replace(",", "."));

        if (!data.length) return pintarError("Selecciona un sistema primero.");
        if (!color || !producto) return pintarError("Rellena todos los campos.");
        if (!kg || isNaN(kg) || kg <= 0) return pintarError("Indica un peso (kg) válido.");

        // 1) Recupera TODAS las filas del color seleccionado
        let filas = data.filter(r => (r[colorKey] || "").toString().trim() === color);

        // fallback “Color - Subcolor”
        if (!filas.length && color.includes(" - ")) {
            const [c, s] = color.split(" - ").map(v => v.trim());
            filas = data.filter(r =>
                (r.color || "").toString().trim() === c &&
                (r.subcolor || "").toString().trim() === s
            );
        }

        if (!filas.length) return pintarError("No se encontró el color en el sistema seleccionado.");

        // 2) Parse seguro (punto o coma)
        const toNum = (v) => {
            if (v == null || v === "") return NaN;
            const n = parseFloat(String(v).replace(",", "."));
            return isNaN(n) ? NaN : n;
        };

        // 3) Para rotular cada pigmento, la original usa la columna "colorcrete_base" que mapea a "arcocem_basic".
        //    En tu JSON esa columna existe como "arcocem_basic" (está en META_FIELDS). La usaremos para el nombre.
        const pigmentNameKey = "arcocem_basic"; // si en tu export se llama distinto, cámbialo aquí

        // 4) Construir desglose y total
        const items = [];
        let totalGr = 0;

        for (const f of filas) {
            const nombrePigmento = (f[pigmentNameKey] || "").toString().trim();
            const gramosPorKg = toNum(f[producto]); // dosis base (g por kg) de ese pigmento para este producto
            if (!nombrePigmento || isNaN(gramosPorKg) || gramosPorKg <= 0) continue;

            const gramos = gramosPorKg * kg;
            totalGr += gramos;
            items.push({ nombre: nombrePigmento, gramosPorKg, gramos });
        }

        if (!items.length) return pintarError("Producto no disponible para este color.");

        // 5) Etiquetas visibles
        const colorVisible = colNorm.ready ? colorAMostrar(color) : color;
        const prodMap = prodNorm.labels.get(sistema);
        const productoVisible = (prodMap && prodMap.get(producto)) || prettify(producto);

        // 6) Render (igual que la original: total + lista por pigmento)
        items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

        resultado.innerHTML = `
    <div class="card p-3">
      <h5>Resultado</h5>
      <p><strong>Producto:</strong> ${esc(productoVisible)}</p>
      <p><strong>Color:</strong> ${esc(colorVisible)}</p>
      <p><strong>Kilos:</strong> ${esc(kg)} kg</p>
      <hr>
      <p><strong>Peso total del pigmento:</strong> ${esc(totalGr.toFixed(2))} g</p>
      ${items.map(it => `
        <p><strong>${esc(it.nombre)}:</strong> ${esc(it.gramos.toFixed(2))} g / ${esc(kg)} kg</p>
      `).join("")}
    </div>
  `;
    });


    // Carga inicial: primero equivalencias, luego sistema por defecto
    Promise.all([cargarEquivalenciasColor(), cargarEquivalenciasProducto()])
        .finally(() => cargarSistema(sistemaSel.value));
});
