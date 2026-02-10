// Iniciamos variables cargando del LocalStorage o vacías
let inventario = JSON.parse(localStorage.getItem('almacen_juanjo_v1')) || [];
let historial = JSON.parse(localStorage.getItem('historial_juanjo_v1')) || [];

// COMPROBACIÓN INICIAL DE SESIÓN: Si ya logueó antes, entrar directo
window.onload = function() {
    if (localStorage.getItem('almacen_juanjo_login') === 'true') {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderizar();
    }
};

// FUNCIÓN DE LOGIN
window.verificarAcceso = function() {
    const userVal = document.getElementById('user').value.trim();
    const passVal = document.getElementById('pass').value;

    // Comprobamos usuario en minúsculas para que acepte Admin, admin, ADMIN, etc.
    if (userVal.toLowerCase() === 'admin' && passVal === 'admin123') {
        localStorage.setItem('almacen_juanjo_login', 'true'); // Guardamos la sesión
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderizar();
    } else {
        const errorMsg = document.getElementById('login-error');
        errorMsg.classList.remove('hidden');
        setTimeout(() => errorMsg.classList.add('hidden'), 3000);
    }
};

// FUNCIÓN CERRAR SESIÓN
window.cerrarSesion = function() {
    if (confirm("¿Cerrar sesión?")) {
        localStorage.removeItem('almacen_juanjo_login'); // Borramos la sesión
        location.reload(); // Recargamos para volver al login
    }
};

// FUNCIÓN AUXILIAR: Formateo de fecha
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
    if (buscadorCont) {
        if (['inicio', 'salida', 'regreso'].includes(screenId)) {
            buscadorCont.classList.remove('hidden');
        } else {
            buscadorCont.classList.add('hidden');
        }
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

// EXPORTAR EXCEL
window.exportarExcel = function() {
    if (inventario.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    let csvContent = "Nombre;Costo (€);Fecha Compra;Ubicacion;Cantidad\n";
    inventario.forEach(item => {
        for (let loc in item.ubicaciones) {
            let cant = item.ubicaciones[loc];
            if (cant > 0 || loc === "Almacén") {
                csvContent += `${item.nombre};${item.costo};${item.fecha};${loc};${cant}\n`;
            }
        }
    });
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_Almacen_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// SALIDA A OBRA
window.salidaObra = function(index) {
    let item = inventario[index];
    let cantEnAlmacen = item.ubicaciones["Almacén"];

    if (cantEnAlmacen > 0) {
        const obraDestino = prompt("¿A qué obra envías " + item.nombre + "?");
        if (obraDestino) {
            let cantEnviar = prompt(`¿Cuántas unidades envías a ${obraDestino}? (Máximo: ${cantEnAlmacen})`, "1");
            cantEnviar = parseInt(cantEnviar);

            if (!isNaN(cantEnviar) && cantEnviar > 0 && cantEnviar <= cantEnAlmacen) {
                item.ubicaciones["Almacén"] -= cantEnviar;
                if (!item.ubicaciones[obraDestino]) item.ubicaciones[obraDestino] = 0;
                item.ubicaciones[obraDestino] += cantEnviar;
                anotarHistorial(item.nombre, `Enviado a ${obraDestino}: ${cantEnviar} un.`);
                actualizarStorage();
                renderizar();
            } else {
                alert("Cantidad no válida.");
            }
        }
    } else {
        alert("No queda stock en Almacén.");
    }
};

// REGRESO RÁPIDO
window.regresoRapido = function(index, nombreObra) {
    let item = inventario[index];
    let cantEnObra = item.ubicaciones[nombreObra];

    if (cantEnObra > 0) {
        let cantRegreso = prompt(`¿Cuántas unidades regresan de ${nombreObra}? (Máximo: ${cantEnObra})`, "1");
        cantRegreso = parseInt(cantRegreso);

        if (!isNaN(cantRegreso) && cantRegreso > 0 && cantRegreso <= cantEnObra) {
            item.ubicaciones[nombreObra] -= cantRegreso;
            item.ubicaciones["Almacén"] += cantRegreso;
            anotarHistorial(item.nombre, `Regresó de ${nombreObra}: ${cantRegreso} un.`);
            actualizarStorage();
            renderizar();
        } else {
            alert("Cantidad no válida.");
        }
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

    if (!lTotal || document.getElementById('app-container').classList.contains('hidden')) return;

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