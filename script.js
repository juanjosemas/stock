// Iniciamos variables cargando del LocalStorage o vacías
let inventario = JSON.parse(localStorage.getItem('almacen_juanjo_v1')) || [];
let historial = JSON.parse(localStorage.getItem('historial_juanjo_v1')) || [];

// FUNCIÓN AUXILIAR: Convierte fecha de 2026-02-09 a 09-02-2026
function formatearFechaVisual(fechaStr) {
    if (!fechaStr) return 's/f'; 
    const [anio, mes, dia] = fechaStr.split('-'); 
    return `${dia}-${mes}-${anio}`; 
}

// NAVEGACIÓN
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function showScreen(screenId) {
    document.querySelectorAll('.view').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-' + screenId).classList.remove('hidden');
    
    const buscadorCont = document.getElementById('busqueda-container');
    if (['inicio', 'salida', 'regreso'].includes(screenId)) {
        buscadorCont.classList.remove('hidden');
    } else {
        buscadorCont.classList.add('hidden');
    }

    if(document.getElementById('sidebar').classList.contains('active')) toggleMenu();
    renderizar();
}

// GUARDAR NUEVA HERRAMIENTA
document.getElementById('form-nuevo').addEventListener('submit', function(e) {
    e.preventDefault();
    const nombreInput = document.getElementById('nombre').value.trim();
    const cantNueva = parseInt(document.getElementById('cantidad').value);
    const costoNuevo = document.getElementById('costo').value || '0';
    const fechaNueva = document.getElementById('fecha').value;

    const itemExistente = inventario.find(item => item.nombre.toLowerCase() === nombreInput.toLowerCase());

    if (itemExistente) {
        itemExistente.ubicaciones["Almacén"] += cantNueva;
        itemExistente.costo = costoNuevo;
        itemExistente.fecha = fechaNueva;
        anotarHistorial(itemExistente.nombre, `Compra adicional: +${cantNueva} un.`);
    } else {
        const nuevo = {
            id: Date.now(),
            nombre: nombreInput,
            costo: costoNuevo,
            fecha: fechaNueva,
            ubicaciones: { "Almacén": cantNueva }
        };
        inventario.push(nuevo);
        anotarHistorial(nombreInput, `Nueva compra: ${cantNueva} un.`);
    }
    
    actualizarStorage();
    this.reset();
    showScreen('inicio');
});

// EDITAR NOMBRE
window.editarNombre = function(index) {
    const nuevoNombre = prompt("Editar nombre de la herramienta:", inventario[index].nombre);
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        const nombreAnterior = inventario[index].nombre;
        inventario[index].nombre = nuevoNombre.trim();
        anotarHistorial(nuevoNombre, `Nombre cambiado (antes: ${nombreAnterior})`);
        actualizarStorage();
        renderizar();
    }
};

// EXPORTAR A EXCEL (CSV)
window.exportarExcel = function() {
    if (inventario.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    // Cabecera del archivo (Usamos punto y coma para que Excel España lo reconozca como columnas)
    let csvContent = "Nombre;Costo (€);Fecha Compra;Ubicacion;Cantidad\n";

    // Recorremos el inventario y sus ubicaciones
    inventario.forEach(item => {
        for (let loc in item.ubicaciones) {
            let cant = item.ubicaciones[loc];
            if (cant > 0 || loc === "Almacén") {
                csvContent += `${item.nombre};${item.costo};${item.fecha};${loc};${cant}\n`;
            }
        }
    });

    // Creamos el archivo con codificación UTF-8 para tildes y Ñ
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Crear enlace invisible para descargar
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_Almacen_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    
    link.click(); // Disparar descarga
    document.body.removeChild(link); // Limpiar
};

// SALIDA A OBRA
window.salidaObra = function(index) {
    let item = inventario[index];
    if (item.ubicaciones["Almacén"] > 0) {
        const obraDestino = prompt("¿A qué obra envías 1 unidad de " + item.nombre + "?");
        if (obraDestino) {
            item.ubicaciones["Almacén"]--;
            if (!item.ubicaciones[obraDestino]) item.ubicaciones[obraDestino] = 0;
            item.ubicaciones[obraDestino]++;
            anotarHistorial(item.nombre, `Enviado a ${obraDestino}`);
            actualizarStorage();
            renderizar();
        }
    } else {
        alert("No queda stock en Almacén.");
    }
};

// REGRESO RÁPIDO
window.regresoRapido = function(index, nombreObra) {
    let item = inventario[index];
    if (item.ubicaciones[nombreObra] > 0) {
        item.ubicaciones[nombreObra]--;
        item.ubicaciones["Almacén"]++;
        anotarHistorial(item.nombre, `Regresó de ${nombreObra}`);
        actualizarStorage();
        renderizar();
    }
};

// DIBUJAR LISTAS
function renderizar() {
    const lTotal = document.getElementById('lista-total');
    const lSalida = document.getElementById('lista-salida');
    const lRegreso = document.getElementById('lista-regreso');
    const lHistorial = document.getElementById('lista-historial');
    const buscador = document.getElementById('buscador');
    const filtro = buscador ? buscador.value.toLowerCase() : '';

    lTotal.innerHTML = ''; lSalida.innerHTML = ''; lRegreso.innerHTML = ''; lHistorial.innerHTML = '';

    inventario.forEach((item, index) => {
        if (!item.nombre.toLowerCase().includes(filtro)) return;

        let badgesHTML = '';
        let badgesRegresoHTML = ''; 

        for (let loc in item.ubicaciones) {
            let cant = item.ubicaciones[loc];
            if (cant > 0 || loc === "Almacén") {
                let clase = (loc === "Almacén") ? "badge-almacen" : "badge-obra";
                let textoBadge = `<span class="${clase}">📍 ${loc}: ${cant} un.</span>`;
                badgesHTML += textoBadge;
                if (loc !== "Almacén" && cant > 0) {
                    badgesRegresoHTML += `<div class="fila-regreso">${textoBadge}<button class="btn-mini-regreso" onclick="regresoRapido(${index}, '${loc}')">↖ Devolver</button></div>`;
                } else {
                    badgesRegresoHTML += textoBadge;
                }
            }
        }

        const btnSalidaHTML = `<button class="btn-enviar-peque" onclick="salidaObra(${index})">↗ Enviar a Obra</button>`;

        const cardHTML = `
            <div class="item-card">
                <span class="item-nombre" ondblclick="editarNombre(${index})" title="Doble clic para editar">${item.nombre}</span>
                ${btnSalidaHTML}
                <div class="info-stock">Coste: ${item.costo}€ | Compra: ${formatearFechaVisual(item.fecha)}</div>
                ${badgesHTML}
                <button class="btn-borrar" onclick="eliminar(${index})">Eliminar</button>
            </div>
        `;

        const cardRegresoHTML = `
            <div class="item-card">
                <span class="item-nombre" ondblclick="editarNombre(${index})">${item.nombre}</span>
                <div class="info-stock">Coste: ${item.costo}€ | Compra: ${formatearFechaVisual(item.fecha)}</div>
                ${badgesRegresoHTML}
                <button class="btn-borrar" onclick="eliminar(${index})">Eliminar</button>
            </div>
        `;
        
        lTotal.innerHTML += cardHTML;
        lSalida.innerHTML += cardHTML;
        lRegreso.innerHTML += cardRegresoHTML; 
    });

    historial.forEach(h => {
        lHistorial.innerHTML += `<div class="hist-item"><span class="hist-fecha">${h.fecha}</span><br><strong>${h.nombre}</strong>: ${h.accion}</div>`;
    });
}

function anotarHistorial(nombre, accion) {
    historial.unshift({ fecha: new Date().toLocaleString(), nombre, accion });
    if (historial.length > 50) historial.pop();
}

window.eliminar = function(index) {
    if(confirm("¿Borrar?")) {
        inventario.splice(index, 1);
        actualizarStorage();
        renderizar();
    }
};

window.borrarHistorial = function() {
    if(confirm("¿Limpiar historial?")) {
        historial = [];
        actualizarStorage();
        renderizar();
    }
};

function actualizarStorage() {
    localStorage.setItem('almacen_juanjo_v1', JSON.stringify(inventario));
    localStorage.setItem('historial_juanjo_v1', JSON.stringify(historial));
}

renderizar();