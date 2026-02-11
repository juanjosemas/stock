// CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyD3BA__Bl9Ao1g4P9F6WUR93uEatnUKsNk",
    authDomain: "stock-almacen-b9af8.firebaseapp.com",
    databaseURL: "https://stock-almacen-b9af8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "stock-almacen-b9af8",
    storageBucket: "stock-almacen-b9af8.firebasestorage.app",
    messagingSenderId: "966227531987",
    appId: "1:966227531987:web:6c4ee4e2795e12eaad9c26"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let inventario = [];
let historial = [];
let filtroCategoriaActual = 'Todas';
let fotoMarcadaParaBorrar = false;
let fotoCapturadaTemp = null; 
let previewContainerActual = ""; 

// --- SISTEMA DE CÁMARA (Mejorado para evitar pantalla negra) ---

window.abrirCamara = async function(containerId) {
    previewContainerActual = containerId;
    const overlay = document.getElementById('camera-overlay');
    const video = document.getElementById('video-stream');
    
    overlay.classList.remove('hidden');

    const constraints = {
        video: { 
            facingMode: "environment", // Intentar cámara trasera
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        window.currentStream = stream;
        
        // Forzar la reproducción después de cargar los metadatos
        video.onloadedmetadata = () => {
            video.play().catch(e => console.error("Error al reproducir video:", e));
        };
    } catch (err) {
        console.error("Error cámara:", err);
        alert("No se pudo activar la cámara. Revisa los permisos o asegúrate de usar HTTPS.");
        cerrarCamara();
    }
};

window.capturarFoto = function() {
    const video = document.getElementById('video-stream');
    const canvas = document.getElementById('canvas-photo');
    const context = canvas.getContext('2d');

    if (video.videoWidth === 0) {
        alert("Esperando a que la cámara inicie...");
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    fotoCapturadaTemp = canvas.toDataURL('image/jpeg', 0.6);
    document.getElementById(previewContainerActual).innerHTML = `<img src="${fotoCapturadaTemp}" class="img-preview-form">`;
    cerrarCamara();
};

window.cerrarCamara = function() {
    if (window.currentStream) {
        window.currentStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('camera-overlay').classList.add('hidden');
};

window.procesarFotoGaleria = function(input, containerId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                fotoCapturadaTemp = canvas.toDataURL('image/jpeg', 0.6);
                document.getElementById(containerId).innerHTML = `<img src="${fotoCapturadaTemp}" class="img-preview-form">`;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// --- FIREBASE SYNC ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderizar(); 
    }
});

// --- LOGIN ---
window.onload = function() {
    if (localStorage.getItem('almacen_juanjo_login') === 'true') {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    }
};

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

window.cerrarSesion = function() {
    if (confirm("¿Cerrar sesión?")) {
        localStorage.removeItem('almacen_juanjo_login');
        location.reload();
    }
};

// --- ACCIONES ---
document.getElementById('form-nuevo').addEventListener('submit', function(e) {
    e.preventDefault();
    const nombreInput = document.getElementById('nombre').value.trim();
    const catNueva = document.getElementById('categoria-nueva').value;
    const cantNueva = parseInt(document.getElementById('cantidad').value);
    const costoNuevo = document.getElementById('costo').value || '0';
    const fechaNueva = document.getElementById('fecha').value;
    const stockMinVal = parseInt(document.getElementById('stock-minimo').value) || 0;

    const itemExistente = inventario.find(item => item.nombre.toLowerCase() === nombreInput.toLowerCase());

    if (itemExistente) {
        itemExistente.ubicaciones["Almacén"] += cantNueva;
        itemExistente.costo = costoNuevo;
        itemExistente.fecha = fechaNueva;
        itemExistente.stockMinimo = stockMinVal;
        if (fotoCapturadaTemp) itemExistente.foto = fotoCapturadaTemp;
        anotarHistorial(itemExistente.nombre, `Compra adicional: +${cantNueva} un.`);
    } else {
        const nuevo = {
            id: Date.now(),
            nombre: nombreInput,
            categoria: catNueva,
            costo: costoNuevo,
            fecha: fechaNueva,
            stockMinimo: stockMinVal,
            foto: fotoCapturadaTemp, 
            ubicaciones: { "Almacén": cantNueva }
        };
        inventario.push(nuevo);
        anotarHistorial(nombreInput, `Nueva compra: ${cantNueva} un.`);
    }
    actualizarFirebase();
    this.reset();
    fotoCapturadaTemp = null; 
    document.getElementById('preview-nueva').innerHTML = ""; 
    showScreen('inicio');
});

window.abrirEditor = function(index) {
    const item = inventario[index];
    fotoMarcadaParaBorrar = false;
    fotoCapturadaTemp = null;
    document.getElementById('edit-index').value = index;
    document.getElementById('edit-nombre').value = item.nombre;
    document.getElementById('edit-categoria').value = item.categoria || 'Manual';
    document.getElementById('edit-costo').value = item.costo;
    document.getElementById('edit-stock-minimo').value = item.stockMinimo || 0;
    const previewCont = document.getElementById('preview-editar');
    previewCont.innerHTML = "";
    if (item.foto) {
        previewCont.innerHTML = `<img src="${item.foto}" class="img-preview-form">`;
        document.getElementById('btn-borrar-foto-edit').classList.remove('hidden');
    } else {
        document.getElementById('btn-borrar-foto-edit').classList.add('hidden');
    }
    showScreen('editar');
};

window.eliminarFotoEdicion = function() {
    if(confirm("¿Quitar la foto?")) {
        fotoMarcadaParaBorrar = true;
        document.getElementById('btn-borrar-foto-edit').classList.add('hidden');
        document.getElementById('preview-editar').innerHTML = "<p style='color:red; font-size:0.8rem;'>Foto marcada para borrar.</p>";
    }
};

document.getElementById('form-editar').addEventListener('submit', function(e) {
    e.preventDefault();
    const index = document.getElementById('edit-index').value;
    const item = inventario[index];
    item.nombre = document.getElementById('edit-nombre').value.trim();
    item.categoria = document.getElementById('edit-categoria').value;
    item.costo = document.getElementById('edit-costo').value;
    item.stockMinimo = parseInt(document.getElementById('edit-stock-minimo').value) || 0;
    if (fotoCapturadaTemp) item.foto = fotoCapturadaTemp;
    else if (fotoMarcadaParaBorrar) delete item.foto;
    actualizarFirebase();
    fotoCapturadaTemp = null;
    showScreen('inicio');
});

window.filtrarCategoria = function(cat) {
    filtroCategoriaActual = cat;
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText === cat) btn.classList.add('active');
    });
    renderizar();
};

window.salidaObra = function(index) {
    let item = inventario[index];
    let cantEnAlmacen = item.ubicaciones["Almacén"];
    if (cantEnAlmacen > 0) {
        const obraDestino = prompt("¿A qué obra envías " + item.nombre + "?");
        if (obraDestino) {
            let cantEnviar = prompt(`¿Cuántas unidades envías?`, "1");
            cantEnviar = parseInt(cantEnviar);
            if (!isNaN(cantEnviar) && cantEnviar > 0 && cantEnviar <= cantEnAlmacen) {
                item.ubicaciones["Almacén"] -= cantEnviar;
                if (!item.ubicaciones[obraDestino]) item.ubicaciones[obraDestino] = 0;
                item.ubicaciones[obraDestino] += cantEnviar;
                anotarHistorial(item.nombre, `Enviado a ${obraDestino}: ${cantEnviar} un.`);
                actualizarFirebase();
            }
        }
    }
};

window.regresoRapido = function(index, nombreObra) {
    let item = inventario[index];
    let cantEnObra = item.ubicaciones[nombreObra];
    let cantRegreso = prompt(`¿Cuántas unidades regresan?`, "1");
    cantRegreso = parseInt(cantRegreso);
    if (!isNaN(cantRegreso) && cantRegreso > 0 && cantRegreso <= cantEnObra) {
        item.ubicaciones[nombreObra] -= cantRegreso;
        item.ubicaciones["Almacén"] += cantRegreso;
        anotarHistorial(item.nombre, `Regresó de ${nombreObra}: ${cantRegreso} un.`);
        actualizarFirebase();
    }
};

window.eliminar = function(index) {
    if(confirm("¿Borrar herramienta?")) {
        inventario.splice(index, 1);
        actualizarFirebase();
    }
};

function actualizarFirebase() {
    db.ref('/').set({ inventario: inventario, historial: historial });
}

function anotarHistorial(nombre, accion) {
    historial.unshift({ fecha: new Date().toLocaleString(), nombre, accion });
    if (historial.length > 150) historial.pop();
}

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
    const lPorObra = document.getElementById('lista-por-obra');
    
    const buscador = document.getElementById('buscador');
    const filtroTexto = buscador ? buscador.value.toLowerCase() : '';
    const buscadorHist = document.getElementById('buscador-historial');
    const filtroHist = buscadorHist ? buscadorHist.value.toLowerCase() : '';

    if (!lTotal || document.getElementById('app-container').classList.contains('hidden')) return;

    lTotal.innerHTML = ''; lSalida.innerHTML = ''; lRegreso.innerHTML = ''; lHistorial.innerHTML = ''; lPorObra.innerHTML = '';

    let obrasEncontradas = {};

    inventario.forEach((item, index) => {
        if (!item.nombre.toLowerCase().includes(filtroTexto)) return;
        if (filtroCategoriaActual !== 'Todas' && item.categoria !== filtroCategoriaActual) return;

        let cantAlmacen = item.ubicaciones["Almacén"] || 0;
        let esCritico = (item.stockMinimo && cantAlmacen <= item.stockMinimo);
        let estiloNombre = esCritico ? 'color: #e74c3c; font-weight: 900; animation: blink 1s infinite;' : '';
        let avisoCritico = esCritico ? '<br><small style="color:red">⚠️ ¡REPOSICIÓN NECESARIA!</small>' : '';
        let fotoHTML = item.foto ? `<img src="${item.foto}" class="item-foto">` : `<div class="item-foto-vacia">📷</div>`;

        let badgesHTML = '';
        let badgesRegresoHTML = ''; 
        for (let loc in item.ubicaciones) {
            let cant = item.ubicaciones[loc];
            if (cant > 0 || loc === "Almacén") {
                let clase = (loc === "Almacén") ? "badge-almacen" : "badge-obra";
                let textoBadge = `<span class="${clase}">📍 ${loc}: ${cant} un.</span>`;
                badgesHTML += textoBadge;
                if (cant > 0) {
                    if (!obrasEncontradas[loc]) obrasEncontradas[loc] = [];
                    obrasEncontradas[loc].push(`${item.nombre} (${cant} un.)`);
                }
                if (loc !== "Almacén" && cant > 0) {
                    badgesRegresoHTML += `<div class="fila-regreso">${textoBadge}<button class="btn-mini-regreso" onclick="regresoRapido(${index}, '${loc}')">↖ Devolver</button></div>`;
                } else {
                    badgesRegresoHTML += textoBadge;
                }
            }
        }

        const cuerpoCard = `<div class="card-cuerpo">${fotoHTML}<div class="card-info"><span class="tag-categoria">${item.categoria || 'Manual'}</span><span class="item-nombre" style="${estiloNombre}">${item.nombre} ${avisoCritico}</span><div class="info-stock">Coste: ${item.costo}€ | Compra: ${formatearFechaVisual(item.fecha)}</div>${badgesHTML}</div></div>`;
        lTotal.innerHTML += `<div class="item-card" ondblclick="abrirEditor(${index})">${cuerpoCard}<button class="btn-borrar" onclick="eliminar(${index})">Eliminar</button></div>`;
        lSalida.innerHTML += `<div class="item-card" ondblclick="abrirEditor(${index})">${cuerpoCard}<button class="btn-enviar-peque" onclick="salidaObra(${index})">↗ Enviar a Obra</button></div>`;
        lRegreso.innerHTML += `<div class="item-card" ondblclick="abrirEditor(${index})"><div class="card-cuerpo">${fotoHTML}<div class="card-info"><span class="tag-categoria">${item.categoria || 'Manual'}</span><span class="item-nombre" style="${estiloNombre}">${item.nombre}</span><div class="info-stock">Coste: ${item.costo}€ | Compra: ${formatearFechaVisual(item.fecha)}</div>${badgesRegresoHTML}</div></div></div>`; 
    });

    for (let obra in obrasEncontradas) {
        lPorObra.innerHTML += `<div class="item-card" style="border-left: 6px solid #f1c40f"><span class="item-nombre">📍 Obra: ${obra}</span>Contenido: <ul style="font-size:0.9rem">${obrasEncontradas[obra].map(h => `<li>${h}</li>`).join('')}</ul></div>`;
    }

    historial.forEach(h => {
        if (h.nombre.toLowerCase().includes(filtroHist) || h.accion.toLowerCase().includes(filtroHist)) {
            lHistorial.innerHTML += `<div class="hist-item"><span class="hist-fecha">${h.fecha}</span><br><strong>${h.nombre}</strong>: ${h.accion}</div>`;
        }
    });
}

function exportarExcel() {
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

window.borrarHistorial = function() {
    if(confirm("¿Limpiar historial de la nube definitivamente?")) {
        historial = [];
        actualizarFirebase();
    }
};