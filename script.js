// CONFIGURACIÓN DE TU PROYECTO FIREBASE (Obtenida de tu foto)
const firebaseConfig = {
    apiKey: "AIzaSyD3BA__Bl9Ao1g4P9F6WUR93uEatnUKsNk",
    authDomain: "stock-almacen-b9af8.firebaseapp.com",
    databaseURL: "https://stock-almacen-b9af8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "stock-almacen-b9af8",
    storageBucket: "stock-almacen-b9af8.firebasestorage.app",
    messagingSenderId: "966227531987",
    appId: "1:966227531987:web:6c4ee4e2795e12eaad9c26"
};

// Inicializamos Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variables globales que se sincronizarán con la nube
let inventario = [];
let historial = [];

// ESCUCHADOR DE DATOS: Cuando algo cambie en la nube, se actualiza tu app solo
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderizar(); // Volvemos a dibujar todo con los datos nuevos
    }
});

// COMPROBACIÓN INICIAL DE SESIÓN (Persiste en el móvil)
window.onload = function() {
    if (localStorage.getItem('almacen_juanjo_login') === 'true') {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    }
};

// FUNCIÓN DE LOGIN (Sin cambios, admin/admin123)
window.verificarAcceso = function() {
    const userVal = document.getElementById('user').value.trim();
    const passVal = document.getElementById('pass').value;

    if (userVal.toLowerCase() === 'admin' && passVal === 'admin123') {
        localStorage.setItem('almacen_juanjo_login', 'true');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderizar();
    } else {
        const errorMsg = document.getElementById('login-error');
        errorMsg.classList.remove('hidden');
        setTimeout(() => errorMsg.classList.add('hidden'), 3000);
    }
};

// CERRAR SESIÓN
window.cerrarSesion = function() {
    if (confirm("¿Cerrar sesión?")) {
        localStorage.removeItem('almacen_juanjo_login');
        location.reload();
    }
};

// GUARDAR NUEVA HERRAMIENTA O JUNTAR STOCK EN LA NUBE
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
    
    actualizarFirebase(); // Guardamos en la nube
    this.reset();
    showScreen('inicio');
});

// EDITAR NOMBRE
window.editarNombre = function(index) {
    const nuevoNombre = prompt("Editar nombre de la herramienta:", inventario[index].nombre);
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        const nombreAnterior = inventario[index].nombre;
        inventario[index].nombre = nuevoNombre.trim();
        anotarHistorial(nuevoNombre, `Nombre cambiado (era: ${nombreAnterior})`);
        actualizarFirebase();
    }
};

// SALIDA A OBRA
window.salidaObra = function(index) {
    let item = inventario[index];
    let cantEnAlmacen = item.ubicaciones["Almacén"];

    if (cantEnAlmacen > 0) {
        const obraDestino = prompt("¿A qué obra envías " + item.nombre + "?");
        if (obraDestino) {
            let cantEnviar = prompt(`¿Cuántas unidades envías a ${obraDestino}?`, "1");
            cantEnviar = parseInt(cantEnviar);

            if (!isNaN(cantEnviar) && cantEnviar > 0 && cantEnviar <= cantEnAlmacen) {
                item.ubicaciones["Almacén"] -= cantEnviar;
                if (!item.ubicaciones[obraDestino]) item.ubicaciones[obraDestino] = 0;
                item.ubicaciones[obraDestino] += cantEnviar;
                anotarHistorial(item.nombre, `Enviado a ${obraDestino}: ${cantEnviar} un.`);
                actualizarFirebase();
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

    let cantRegreso = prompt(`¿Cuántas unidades regresan de ${nombreObra}?`, "1");
    cantRegreso = parseInt(cantRegreso);

    if (!isNaN(cantRegreso) && cantRegreso > 0 && cantRegreso <= cantEnObra) {
        item.ubicaciones[nombreObra] -= cantRegreso;
        item.ubicaciones["Almacén"] += cantRegreso;
        anotarHistorial(item.nombre, `Regresó de ${nombreObra}: ${cantRegreso} un.`);
        actualizarFirebase();
    } else {
        alert("Cantidad no válida.");
    }
};

// ELIMINAR HERRAMIENTA
window.eliminar = function(index) {
    if(confirm("¿Borrar definitivamente de la nube?")) {
        inventario.splice(index, 1);
        actualizarFirebase();
    }
};

// LIMPIAR HISTORIAL
window.borrarHistorial = function() {
    if(confirm("¿Limpiar historial de la nube?")) {
        historial = [];
        actualizarFirebase();
    }
};

// FUNCION PARA SUBIR TODO A FIREBASE
function actualizarFirebase() {
    db.ref('/').set({
        inventario: inventario,
        historial: historial
    });
}

function anotarHistorial(nombre, accion) {
    historial.unshift({ fecha: new Date().toLocaleString(), nombre, accion });
    if (historial.length > 50) historial.pop();
}

// FUNCIONES VISUALES (Se mantienen igual)
function formatearFechaVisual(fechaStr) {
    if (!fechaStr) return 's/f'; 
    const [anio, mes, dia] = fechaStr.split('-'); 
    return `${dia}-${mes}-${anio}`; 
}

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function showScreen(screenId) {
    document.querySelectorAll('.view').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-' + screenId).classList.remove('hidden');
    const buscadorCont = document.getElementById('busqueda-container');
    if (buscadorCont) {
        if (['inicio', 'salida', 'regreso'].includes(screenId)) buscadorCont.classList.remove('hidden');
        else buscadorCont.classList.add('hidden');
    }
    if(document.getElementById('sidebar').classList.contains('active')) toggleMenu();
    renderizar();
}

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
                <span class="item-nombre" ondblclick="editarNombre(${index})">${item.nombre}</span>
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

function exportarExcel() {
    if (inventario.length === 0) return alert("No hay datos.");
    let csvContent = "Nombre;Costo;Fecha;Ubicacion;Cantidad\n";
    inventario.forEach(item => {
        for (let loc in item.ubicaciones) {
            if (item.ubicaciones[loc] > 0 || loc === "Almacén")
                csvContent += `${item.nombre};${item.costo};${item.fecha};${loc};${item.ubicaciones[loc]}\n`;
        }
    });
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Almacen_EcoStruct_${new Date().toLocaleDateString()}.csv`;
    link.click();
}