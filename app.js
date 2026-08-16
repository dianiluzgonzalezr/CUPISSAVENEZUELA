const SUPABASE_URL = 'https://tellgxzpkylnefqevcub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbGxneHpwa3lsbmVmcWV2Y3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MzI5NjYsImV4cCI6MjEwMjQwODk2Nn0.dDuGs4uWWYMSx9W_OV9hDcIpafklWennH_QUfkpBeAE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CONFIG_PAISES = {
    CO: { 
        nombre: 'Colombia', 
        moneda: 'COP', 
        simbolo: '$', 
        telefono: '573147671380', 
        metodosPago: ['BRE-B', 'Nequi', 'Tarjeta Débito y Crédito', 'Crédito ADDI', 'Plan Separe'], 
        factorDolar: 3200,
        avisoInternacional: false 
    },
    VE: { 
        nombre: 'Venezuela', 
        moneda: 'VES', 
        simbolo: 'Bs', 
        telefono: '584242897281', 
        metodosPago: ['Pago Móvil', 'Bolívares', 'Dólares en efectivo', 'Dólares por transferencia'], 
        factorDolar: 3200, 
        tasaVES: 772.00,
        avisoInternacional: false 
    },
    MX: { 
        nombre: 'México', 
        moneda: 'MXN', 
        simbolo: '$', 
        telefono: '573147671380', 
        metodosPago: ['Tarjeta Débito y Crédito', 'PayPal'], 
        factorDolar: 3200,
        avisoInternacional: true 
    },
    AR: { 
        nombre: 'Argentina', 
        moneda: 'ARS', 
        simbolo: '$', 
        telefono: '573147671380', 
        metodosPago: ['Tarjeta Débito y Crédito', 'PayPal'], 
        factorDolar: 3200,
        avisoInternacional: true 
    },
    US: { 
        nombre: 'Estados Unidos', 
        moneda: 'USD', 
        simbolo: '$', 
        telefono: '573147671380', 
        metodosPago: ['Tarjeta Débito y Crédito', 'PayPal'], 
        factorDolar: 3200,
        avisoInternacional: true 
    }
};

let paisActual = CONFIG_PAISES['VE'];
let modoMayorista = false;
let carrito = [];
let productosTotales = [];
let categoriasDinamicas = ['Productos Personalizados', 'Conjuntos', 'Detalles'];
let mundoSeleccionado = 'Todos';

function seleccionarPais(codigoPais) {
    paisActual = CONFIG_PAISES[codigoPais];
    document.getElementById('modal-pais').style.display = 'none';
    
    actualizarTextoInterfazTasa();
    document.getElementById('footer-telefono').innerText = `📞 +${paisActual.telefono}`;
    document.getElementById('footer-pagos').innerText = `💳 Métodos de Pago: ${paisActual.metodosPago.join(' | ')}`;
    
    actualizarSelectMetodosPago();
    renderizarProductos(productosTotales);
}

function actualizarTextoInterfazTasa() {
    const textoTasaEl = document.getElementById('texto-tasa-local');
    let textoAviso = paisActual.avisoInternacional ? ' ⚠️ (Envío internacional desde Colombia)' : '';
    
    if (paisActual.moneda === 'VES') {
        textoTasaEl.innerText = `Moneda: ${paisActual.moneda} | 1 USD = ${paisActual.tasaVES.toFixed(2)} Bs (Base: 3,200 COP = $1 USD)${textoAviso}`;
        document.getElementById('input-nueva-tasa').value = paisActual.tasaVES;
    } else if (paisActual.moneda === 'COP') {
        textoTasaEl.innerText = `Moneda: ${paisActual.moneda} | Base: 3,200 COP = $1 USD${textoAviso}`;
    } else {
        textoTasaEl.innerText = `Moneda: ${paisActual.moneda} | Referencia calculada desde COP (3,200 COP = $1 USD)${textoAviso}`;
    }
}

function actualizarTasaVenezuela() {
    const inputTasa = document.getElementById('input-nueva-tasa');
    const valor = parseFloat(inputTasa.value);
    if (!isNaN(valor) && valor > 0) {
        CONFIG_PAISES['VE'].tasaVES = valor;
        if (paisActual.moneda === 'VES') {
            paisActual.tasaVES = valor;
        }
        actualizarTextoInterfazTasa();
        renderizarProductos(productosTotales);
        mostrarNotificacion('Tasa VES de Venezuela actualizada correctamente.', 'success');
    } else {
        mostrarNotificacion('Ingresa una tasa válida.');
    }
}

function convertirPrecioLocal(precioCOP) {
    const usd = precioCOP / 3200;

    if (paisActual.moneda === 'VES') {
        return usd * paisActual.tasaVES;
    }
    if (paisActual.moneda === 'USD') {
        return usd;
    }
    let factorReferencia = 4100;
    if (paisActual.moneda === 'MXN') factorReferencia = 18.50;
    if (paisActual.moneda === 'ARS') factorReferencia = 1050.00;
    if (paisActual.moneda === 'COP') return precioCOP;

    return usd * factorReferencia;
}

function toggleModoMayorista() {
    modoMayorista = !modoMayorista;
    const btn = document.getElementById('btn-mayorista');
    if (modoMayorista) {
        btn.classList.add('activo');
        btn.innerText = '✨ Modo Mayorista Activado';
    } else {
        btn.classList.remove('activo');
        btn.innerText = '📦 Activar Modo Mayorista';
    }
    renderizarProductos(productosTotales);
}

async function cargarDatos() {
    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.log('Error al cargar:', error);
        return;
    }
    
    productosTotales = productos || [];
    
    const catsBD = [...new Set(productosTotales.map(p => p.categoria))];
    catsBD.forEach(c => { if(c && !categoriasDinamicas.includes(c)) categoriasDinamicas.push(c); });

    actualizarMenuCategorias();
    actualizarSelectModal();
    renderizarProductos(productosTotales);
}

function actualizarMenuCategorias() {
    const nav = document.getElementById('menu-categorias');
    nav.innerHTML = `<button onclick="filtrarMundo('Todos')" class="${mundoSeleccionado === 'Todos' ? 'activo-mundo' : ''}">🌟 Todos los Mundos</button>`;
    categoriasDinamicas.forEach(cat => {
        nav.innerHTML += `<button onclick="filtrarMundo('${cat}')" class="${mundoSeleccionado === cat ? 'activo-mundo' : ''}">${cat}</button>`;
    });
}

function actualizarSelectModal() {
    const select = document.getElementById('nuevo-categoria');
    select.innerHTML = '';
    categoriasDinamicas.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function actualizarSelectMetodosPago() {
    const select = document.getElementById('metodo-pago-select');
    if (!select) return;
    select.innerHTML = '';
    paisActual.metodosPago.forEach(metodo => {
        select.innerHTML += `<option value="${metodo}">${metodo}</option>`;
    });
}

function crearNuevaCategoria() {
    const nueva = prompt('Nombre del nuevo Mundo/Categoría:');
    if (nueva && nueva.trim() !== '') {
        const catLimpia = nueva.trim();
        if (!categoriasDinamicas.includes(catLimpia)) {
            categoriasDinamicas.push(catLimpia);
            actualizarMenuCategorias();
            actualizarSelectModal();
            document.getElementById('nuevo-categoria').value = catLimpia;
        }
    }
}

function filtrarMundo(mundo) {
    mundoSeleccionado = mundo;
    actualizarMenuCategorias();
    aplicarFiltrosYBusqueda();
}

function buscarProductos(texto) {
    aplicarFiltrosYBusqueda();
}

function aplicarFiltrosYBusqueda() {
    const textoBuscador = document.getElementById('input-buscador').value.toLowerCase().trim();
    
    let filtrados = productosTotales.filter(p => {
        const coincideMundo = (mundoSeleccionado === 'Todos' || p.categoria === mundoSeleccionado);
        const coincideTexto = textoBuscador === '' || 
            p.nombre.toLowerCase().includes(textoBuscador) || 
            (p.categoria && p.categoria.toLowerCase().includes(textoBuscador)) || 
            (p.subcategoria && p.subcategoria.toLowerCase().includes(textoBuscador)) ||
            (p.tematica && p.tematica.toLowerCase().includes(textoBuscador));
        return coincideMundo && coincideTexto;
    });

    renderizarProductos(filtrados);
}

function renderizarProductos(productos) {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = '';

    if (productos.length === 0) {
        contenedor.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No se encontraron productos en este mundo o búsqueda.</p>';
        return;
    }

    productos.forEach(prod => {
        let precioBaseCOP = modoMayorista && prod.precio_mayorista ? prod.precio_mayorista : prod.precio;
        const precioLocalValor = convertirPrecioLocal(precioBaseCOP);
        const precioUsdValor = precioBaseCOP / 3200;

        const nombreSeguro = prod.nombre.replace(/'/g, "\\'");
        
        let subcatHtml = prod.subcategoria ? `<p class="subcategoria-tag">✨ ${prod.subcategoria}</p>` : '';
        let tematicaHtml = prod.tematica ? `<span class="tematica-tag">🏷️ ${prod.tematica}</span>` : '';
        let infoMayorista = modoMayorista && prod.min_mayorista ? `<p style="color:#ff4757; font-size:0.8rem; font-weight:700;">Mín. Mayorista: ${prod.min_mayorista} unid.</p>` : '';

        contenedor.innerHTML += `
            <div class="card">
                <div>
                    <div style="position:relative;">
                        <img src="${prod.imagen}" alt="${prod.nombre}">
                        ${tematicaHtml}
                    </div>
                    <h3>${prod.nombre}</h3>
                    ${subcatHtml}
                    <p class="precio-usd">$${precioUsdValor.toFixed(2)} USD</p>
                    <p class="precio-local">${paisActual.moneda} ${paisActual.simbolo}${precioLocalValor.toFixed(2)}</p>
                    ${infoMayorista}

                    <div class="selector-variante">
                        <label><small>Talla / Variante (Ajuste de precio):</small></label>
                        <select id="var-${prod.id}" onchange="actualizarPrecioCard(${prod.id}, ${precioBaseCOP})">
                            <option value="Única|0">Única (+$0.00)</option>
                            <option value="S|0">S (+$0.00)</option>
                            <option value="M|0">M (+$0.00)</option>
                            <option value="L|2000">L (+$0.62 USD)</option>
                            <option value="XL|4000">XL (+$1.25 USD)</option>
                        </select>
                    </div>

                    <div class="selector-complemento">
                        <label><small>Accesorio / Complemento:</small></label>
                        <select id="comp-${prod.id}" onchange="actualizarPrecioCard(${prod.id}, ${precioBaseCOP})">
                            <option value="Ninguno|0">Ninguno (+$0.00)</option>
                            <option value="Caja de Regalo|6400">Caja de Regalo (+$2.00)</option>
                            <option value="Llavero Personalizado|11200">Llavero Personalizado (+$3.50)</option>
                        </select>
                    </div>

                    <div class="selector-personalizacion" style="margin-top:10px;">
                        <label><small>📝 Personalización (Nombre / Frase):</small></label>
                        <input type="text" id="pers-${prod.id}" placeholder="Ej: Diani & Nombre" style="width:100%; padding:5px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px;">
                    </div>
                </div>
                <div>
                    <div class="admin-card-controls">
                        <button class="btn-editar-card" onclick="abrirModalEditar(${prod.id}, '${nombreSeguro}', ${prod.precio}, ${prod.precio_mayorista || prod.precio}, ${prod.min_mayorista || 1}, '${prod.categoria}', '${prod.subcategoria || ''}', '${prod.tematica || ''}', '${prod.imagen}')">Editar</button>
                        <button class="btn-eliminar-card" onclick="eliminarProducto(${prod.id})">Eliminar</button>
                    </div>

                    <div class="selector-cantidad">
                        <button onclick="cambiarCantLocal('${nombreSeguro}', -1)">-</button>
                        <span id="cant-${prod.nombre.replace(/\s+/g, '')}">1</span>
                        <button onclick="cambiarCantLocal('${nombreSeguro}', 1)">+</button>
                    </div>
                    <button class="btn-agregar" onclick="agregarAlCarritoAvanzado(${prod.id}, '${nombreSeguro}', ${precioBaseCOP})">Agregar</button>
                </div>
            </div>
        `;
    });
}

function actualizarPrecioCard(id, precioBaseCOP) {
    const varSelect = document.getElementById(`var-${id}`);
    const compSelect = document.getElementById(`comp-${id}`);
    
    let extraVar = 0;
    if (varSelect) {
        const partes = varSelect.value.split('|');
        extraVar = parseFloat(partes[1]) || 0;
    }

    let extraComp = 0;
    if (compSelect) {
        const partes = compSelect.value.split('|');
        extraComp = parseFloat(partes[1]) || 0;
    }

    const totalCOP = precioBaseCOP + extraVar + extraComp;
    const cardEl = varSelect.closest('.card');
    const localEl = cardEl.querySelector('.precio-local');
    const usdEl = cardEl.querySelector('.precio-usd');

    const localVal = convertirPrecioLocal(totalCOP);
    const usdVal = totalCOP / 3200;

    localEl.innerText = `${paisActual.moneda} ${paisActual.simbolo}${localVal.toFixed(2)}`;
    usdEl.innerText = `$${usdVal.toFixed(2)} USD`;
}

function cambiarCantLocal(nombre, cambio) {
    const idSpan = `cant-${nombre.replace(/\s+/g, '')}`;
    const span = document.getElementById(idSpan);
    if (!span) return;
    let actual = parseInt(span.innerText) + cambio;
    if (actual < 1) actual = 1;
    span.innerText = actual;
}

function agregarAlCarritoAvanzado(id, nombre, precioBaseCOP) {
    const idSpan = `cant-${nombre.replace(/\s+/g, '')}`;
    const span = document.getElementById(idSpan);
    const cantidad = span ? parseInt(span.innerText) : 1;
    
    const prodOriginal = productosTotales.find(p => p.id === id);
    if (modoMayorista && prodOriginal && prodOriginal.min_mayorista && cantidad < prodOriginal.min_mayorista) {
        mostrarNotificacion(`El pedido mínimo mayorista para este producto es de ${prodOriginal.min_mayorista} unidades.`);
        return;
    }

    const varianteSelect = document.getElementById(`var-${id}`);
    let varianteNombre = 'Única';
    let extraVarCOP = 0;
    if (varianteSelect) {
        const partes = varianteSelect.value.split('|');
        varianteNombre = partes[0];
        extraVarCOP = parseFloat(partes[1]) || 0;
    }

    const complementoSelect = document.getElementById(`comp-${id}`);
    let complementoNombre = 'Ninguno';
    let extraCompCOP = 0;
    if (complementoSelect) {
        const partes = complementoSelect.value.split('|');
        complementoNombre = partes[0];
        extraCompCOP = parseFloat(partes[1]) || 0;
    }

    const personalizacionInput = document.getElementById(`pers-${id}`);
    const textoPersonalizacion = personalizacionInput ? personalizacionInput.value.trim() : '';

    const precioFinalCOP = precioBaseCOP + extraVarCOP + extraCompCOP;
    
    let nombreCompleto = `${nombre} (Talla: ${varianteNombre}`;
    if (complementoNombre !== 'Ninguno') {
        nombreCompleto += ` + Acc: ${complementoNombre}`;
    }
    if (textoPersonalizacion !== '') {
        nombreCompleto += ` | Pers: "${textoPersonalizacion}"`;
    }
    nombreCompleto += `)`;
    
    const index = carrito.findIndex(item => item.nombre === nombreCompleto);
    if (index > -1) {
        carrito[index].cantidad += cantidad;
    } else {
        carrito.push({ nombre: nombreCompleto, precioCOP: precioFinalCOP, cantidad });
    }
    
    actualizarContadorCarrito();
    if (span) span.innerText = '1';
    if (personalizacionInput) personalizacionInput.value = '';
    mostrarNotificacion('Producto agregado al carrito con éxito', 'success');
}

function actualizarContadorCarrito() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('contador-carrito').innerText = totalItems;
    renderizarPanelCarrito();
}

function togglePanelCarrito() {
    document.getElementById('panel-carrito').classList.toggle('activo');
}

function renderizarPanelCarrito() {
    const lista = document.getElementById('lista-carrito-items');
    if (carrito.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#888; margin-top:40px;">Tu carrito está vacío</p>';
        return;
    }

    lista.innerHTML = '';
    let totalCOP = 0;

    carrito.forEach((item, index) => {
        const subtotalCOP = item.precioCOP * item.cantidad;
        totalCOP += subtotalCOP;
        const subtotalLocal = convertirPrecioLocal(subtotalCOP);
        const itemUsd = item.precioCOP / 3200;

        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <div>
                    <strong>${item.nombre}</strong><br>
                    <small>$${itemUsd.toFixed(2)} USD x ${item.cantidad}</small>
                </div>
                <div>
                    <span style="font-weight:700; color:#2ed573;">${paisActual.simbolo}${subtotalLocal.toFixed(2)}</span>
                    <button onclick="eliminarItem(${index})" style="background:none; border:none; color:red; cursor:pointer; margin-left:10px;">🗑️</button>
                </div>
            </div>
        `;
    });

    let totalLocalFinal = convertirPrecioLocal(totalCOP);
    let totalUsdFinal = totalCOP / 3200;

    lista.innerHTML += `
        <div style="margin-top:20px; font-weight:700; font-size:1.1rem; text-align:right;">
            Total USD: $${totalUsdFinal.toFixed(2)}<br>
            Total ${paisActual.moneda}: ${paisActual.simbolo}${totalLocalFinal.toFixed(2)}
        </div>
    `;
}

function eliminarItem(index) {
    carrito.splice(index, 1);
    actualizarContadorCarrito();
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío');
        return;
    }

    const metodoPagoSeleccionado = document.getElementById('metodo-pago-select').value;
    let mensaje = `Hola *CUPISSA* (${paisActual.nombre}), quiero hacer el siguiente pedido:%0A%0A`;
    if (paisActual.avisoInternacional) {
        mensaje += `⚠️ *Nota:* Este pedido corresponde a un envío internacional desde Colombia.%0A%0A`;
    }
    let totalCOP = 0;

    carrito.forEach(item => {
        let subCOP = item.precioCOP * item.cantidad;
        let subLocal = convertirPrecioLocal(subCOP);
        mensaje += `🛍️ *${item.nombre}* (${item.cantidad} unid) - ${paisActual.simbolo}${subLocal.toFixed(2)} ${paisActual.moneda}%0A`;
        totalCOP += subCOP;
    });

    let totalLocalFinal = convertirPrecioLocal(totalCOP);
    let totalUsdFinal = totalCOP / 3200;

    mensaje += `%0A*Total USD:* $${totalUsdFinal.toFixed(2)}`;
    mensaje += `%0A*Total ${paisActual.moneda}:* ${paisActual.simbolo}${totalLocalFinal.toFixed(2)}`;
    mensaje += `%0A*Método de pago:* ${metodoPagoSeleccionado}`;
    mensaje += `%0A*Modalidad:* ${modoMayorista ? 'Mayorista' : 'Detal'}`;
    mensaje += `%0A%0AIndícame los datos necesarios para proceder.`;

    window.open(`https://wa.me/${paisActual.telefono}?text=${mensaje}`, '_blank');
}

let imagenActualUrl = '';
let archivoImagenSeleccionado = null;

function abrirModal() {
    const editIdEl = document.getElementById('edit-id');
    if (editIdEl) editIdEl.value = '';
    
    const tituloEl = document.getElementById('modal-titulo');
    if (tituloEl) tituloEl.innerText = 'Agregar Producto';
    
    const btnAccionEl = document.getElementById('btn-accion-guardar');
    if (btnAccionEl) btnAccionEl.innerText = 'Guardar Producto';
    
    const campos = ['nuevo-nombre', 'nuevo-precio', 'nuevo-precio-mayorista', 'nuevo-min-mayorista', 'nueva-subcategoria', 'nueva-tematica'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    imagenActualUrl = '';
    archivoImagenSeleccionado = null;
    if (previewImg) previewImg.style.display = 'none';
    if (dropZone) dropZone.querySelector('p').style.display = 'block';
    
    const modalAdmin = document.getElementById('modal-admin');
    if (modalAdmin) modalAdmin.style.display = 'block';
}

function abrirModalEditar(id, nombre, precio, precioMayorista, minMayorista, categoria, subcategoria, tematica, imagen) {
    const editIdEl = document.getElementById('edit-id');
    if (editIdEl) editIdEl.value = id;
    
    const tituloEl = document.getElementById('modal-titulo');
    if (tituloEl) tituloEl.innerText = 'Editar Producto';
    
    const btnAccionEl = document.getElementById('btn-accion-guardar');
    if (btnAccionEl) btnAccionEl.innerText = 'Actualizar Producto';
    
    if (document.getElementById('nuevo-nombre')) document.getElementById('nuevo-nombre').value = nombre;
    if (document.getElementById('nuevo-precio')) document.getElementById('nuevo-precio').value = precio;
    if (document.getElementById('nuevo-precio-mayorista')) document.getElementById('nuevo-precio-mayorista').value = precioMayorista;
    if (document.getElementById('nuevo-min-mayorista')) document.getElementById('nuevo-min-mayorista').value = minMayorista;
    if (document.getElementById('nuevo-categoria')) document.getElementById('nuevo-categoria').value = categoria;
    if (document.getElementById('nueva-subcategoria')) document.getElementById('nueva-subcategoria').value = subcategoria;
    if (document.getElementById('nueva-tematica')) document.getElementById('nueva-tematica').value = tematica;
    
    imagenActualUrl = imagen;
    archivoImagenSeleccionado = null;
    if (previewImg) {
        previewImg.src = imagen;
        previewImg.style.display = 'block';
    }
    if (dropZone) dropZone.querySelector('p').style.display = 'none';
    
    const modalAdmin = document.getElementById('modal-admin');
    if (modalAdmin) modalAdmin.style.display = 'block';
}

function cerrarModal() { 
    document.getElementById('modal-admin').style.display = 'none'; 
    resetearFormulario(); 
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewImg = document.getElementById('preview-img');

if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#e2e8f0'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.background = '#f8f9fa'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#f8f9fa';
        if (e.dataTransfer.files.length > 0) procesarArchivo(e.dataTransfer.files[0]);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) procesarArchivo(e.target.files[0]);
    });
}

window.addEventListener('paste', (e) => {
    const modal = document.getElementById('modal-admin');
    if (modal && modal.style.display === 'block') {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                procesarArchivo(items[i].getAsFile());
            }
        }
    }
});

function procesarArchivo(file) {
    archivoImagenSeleccionado = file;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        previewImg.src = reader.result;
        previewImg.style.display = 'block';
        dropZone.querySelector('p').style.display = 'none';
    };
}

async function guardarProducto() {
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('nuevo-nombre').value;
    const precio = parseFloat(document.getElementById('nuevo-precio').value.replace(',', '.'));
    const precio_mayorista = parseFloat(document.getElementById('nuevo-precio-mayorista').value.replace(',', '.')) || precio;
    const min_mayorista = parseInt(document.getElementById('nuevo-min-mayorista').value) || 6;
    const categoria = document.getElementById('nuevo-categoria').value;
    const subcategoria = document.getElementById('nueva-subcategoria').value.trim();
    const tematica = document.getElementById('nueva-tematica').value.trim();

    if (!nombre || isNaN(precio)) {
        mostrarNotificacion('Por favor, llena el nombre y un precio válido en Pesos Colombianos (COP).');
        return;
    }

    let urlFinalImagen = imagenActualUrl;

    if (archivoImagenSeleccionado) {
        const nombreArchivo = `${Date.now()}_${archivoImagenSeleccionado.name.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('productos')
            .upload(nombreArchivo, archivoImagenSeleccionado);

        if (uploadError) {
            mostrarNotificacion('Error al subir la imagen: ' + uploadError.message);
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from('productos')
            .getPublicUrl(nombreArchivo);

        urlFinalImagen = publicUrlData.publicUrl;
    }

    if (!urlFinalImagen) {
        mostrarNotificacion('Asegúrate de agregar una imagen para el producto.');
        return;
    }

    const datosGuardar = { nombre, precio, precio_mayorista, min_mayorista, categoria, subcategoria, tematica, imagen: urlFinalImagen };

    if (id) {
        const { error } = await supabaseClient.from('productos').update(datosGuardar).eq('id', id);
        if (error) mostrarNotificacion('Error al actualizar: ' + error.message);
        else { cerrarModal(); cargarDatos(); }
    } else {
        const { error } = await supabaseClient.from('productos').insert([datosGuardar]);
        if (error) mostrarNotificacion('Error al guardar: ' + error.message);
        else { cerrarModal(); cargarDatos(); }
    }
}

async function eliminarProducto(id) {
    if (confirm('¿Estás segura de que deseas eliminar este producto?')) {
        const { error } = await supabaseClient.from('productos').delete().eq('id', id);
        if (error) mostrarNotificacion('Error al eliminar: ' + error.message);
        else cargarDatos();
    }
}

function resetearFormulario() {
    document.getElementById('edit-id').value = '';
    document.getElementById('nuevo-nombre').value = '';
    document.getElementById('nuevo-precio').value = '';
    document.getElementById('nuevo-precio-mayorista').value = '';
    document.getElementById('nuevo-min-mayorista').value = '';
    document.getElementById('nueva-subcategoria').value = '';
    document.getElementById('nueva-tematica').value = '';
    imagenActualUrl = '';
    archivoImagenSeleccionado = null;
    previewImg.style.display = 'none';
    dropZone.querySelector('p').style.display = 'block';
    fileInput.value = '';
}

function mostrarNotificacion(mensaje, tipo = 'error') {
    const contenedor = document.getElementById('toast-container');
    if (!contenedor) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    contenedor.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('modal-pais').style.display = 'flex';
    cargarDatos();
});