let recordId = null;
let negocio = null;
let emisor = null;
let deudor = null;
let emisorComoDeudor = null;
let deudorComoEmisor = null;


let cupoEmisorSeleccionado = null;
let cupoDeudorSeleccionado = null;
let observacionEmisor = "";
let observacionDeudor = "";

let controlEmisor = null;
let controlDeudor = null;
let validacionesCumplimiento = [];

let pendientes = [];
let requiereExcepcion = false;
let bloqueoValidacion = false;




ZOHO.embeddedApp.on("PageLoad", async function(data){
    try
    {
        recordId = Array.isArray(data.EntityId)
        ? data.EntityId[0]
        : data.EntityId;
        //console.log("Record ID:", recordId);
        
        await cargarInformacion();

        document.getElementById("btnRevalidar").addEventListener("click", cargarInformacion);

        document.getElementById("btnContinuar").addEventListener("click", continuarCredito);
        
        document.getElementById("btnConsultarCupos").addEventListener("click",consultarCupos);

        document.getElementById("linkExcepcion").addEventListener("blur", guardarExcepcion);

        document.getElementById("comentariosCupo").addEventListener("blur", guardarExcepcion);
        
        
    }
    catch(error)
    {
        console.error(error);
        mostrarError("Error cargando información del negocio.");
    }


});

ZOHO.embeddedApp.init();

async function cargarInformacion()
{
    mostrarLoader(true);
    
    try
    {
        // ==========================
        // NEGOCIO
        // ==========================

        let negocioResp = await ZOHO.CRM.API.getRecord({
            Entity: "Potentials",
            RecordID: recordId
        });

        negocio = negocioResp.data[0];

       //console.log("NEGOCIO", negocio);

      
        // ==========================
        // EMISOR Y DEUDOR
        // ==========================

        const idEmisor = negocio.Account_Name.id;

        const idDeudor = negocio.Deudor.id;

        const [emisorResp, deudorResp] =
            await Promise.all([
                ZOHO.CRM.API.getRecord({
                    Entity: "Accounts",
                    RecordID: idEmisor
                }),
                ZOHO.CRM.API.getRecord({
                    Entity: "Pagadores",
                    RecordID: idDeudor
                })
            ]);

        emisor = emisorResp.data[0];
        deudor = deudorResp.data[0];

        // ==========================
        // PERFIL CRUZADO POR NIT
        // ==========================

        emisorComoDeudor =
            await buscarPorNit(
                "Pagadores",
                emisor.NIT_9
            );

        deudorComoEmisor =
            await buscarPorNit(
                "Accounts",
                deudor.NIT_9
            );

        // console.log("EMISOR COMO DEUDOR", emisorComoDeudor);
        // console.log("DEUDOR COMO EMISOR", deudorComoEmisor);
        
        observacionEmisor = emisor.Observaciones_Cupo || "Sin observaciones";
        observacionDeudor = deudor.Observaciones_Cupo || "Sin observaciones";
        
        //document.getElementById("nombreNegocio").innerText = negocio.Deal_Name || "-";

        document.getElementById("nombreEmisor").innerText =  emisor.Account_Name || "-";

        document.getElementById("nombreDeudor").innerText =  deudor.Name || "-";
        
        document.getElementById("numeroNegocio").innerText =  negocio.N_mero_negocio || "-";
               

        document.getElementById("tipoProducto").innerText =  negocio.Tipo_de_Negocio || "-";

        document.getElementById("objetivoNegocio").innerText = negocio.Objetivo_Negocio || "-";
        
        document.getElementById("importeNegocio").innerText =  formatearMoneda(negocio.Amount || "-"); 
        
        document.getElementById("linkExcepcion").value = negocio.Link_Gestion_Excepcion || "";

        
        document.getElementById("comentariosCupo").value = negocio.Comentarios_Cupo_V2 || "";

        // Placeholder Link
        document.getElementById("linkExcepcion").placeholder = negocio.Link_Gestion_Excepcion
            ? "Link ya registrado (puede modificarlo)"
            : "https://";

        // Placeholder Comentarios
        document.getElementById("comentariosCupo").placeholder =  negocio.Comentarios_Cupo_V2
            ? "Comentarios existentes (puede modificarlos)"
            : "Describa la justificación de la excepción...";
                
                
        // CUPOS

        document.getElementById("cupoFactoring").innerText = formatearMoneda(negocio.Cupo_Aprobado_Prueba);

        document.getElementById("cupoDeudor").innerText = formatearMoneda(negocio.Cupo_Deudor_Aprobado);

        document.getElementById("usadoEmisor").innerText = formatearMoneda(negocio.Cupo_Factoring_Prueba);

        document.getElementById("usadoDeudor").innerText = formatearMoneda(negocio.Disponible_Eeudor);
        
        document.getElementById("disponibleAntesEmisor").innerText = formatearMoneda(negocio.Disponible_Antes_de_Negocio);
        
        document.getElementById("disponibleAntesDeudor").innerText = formatearMoneda(negocio.Disponible_Deudor_Antes_de_Negocio);
        
        document.getElementById("chkExtracupo").checked = negocio.Alerta_Extra_Cupo_Emisor || false;

        pintarValor(
            "disponibleEmisorNegocio",
            negocio.Prueba_disponible
        );

        pintarValor(
            "disponibleDeudorNegocio",
            negocio.Disponible_Deudor_Negocio
        );
        //console.log("EMISOR", emisor);
        //console.log("DEUDOR", deudor);

        pintarEmisor();
        pintarDeudor();

        // ==========================
        // CONTROL EMISOR y DEUDOR
        // ==========================
        const [
            controlEmisorResp,
            controlDeudorResp
        ] = await Promise.all([
            ZOHO.CRM.API.getRelatedRecords({
                Entity: "Accounts",
                RecordID: idEmisor,
                RelatedList: "Control_CIFIN_y_c_mara_de_comercio"
            }),
            ZOHO.CRM.API.getRelatedRecords({
                Entity: "Pagadores",
                RecordID: idDeudor,
                RelatedList: "Control_CIFIN_y_c_mara_de_comercio"
            })
        ]);

        if(
            controlEmisorResp &&
            controlEmisorResp.data &&
            controlEmisorResp.data.length > 0
        )
        {
            controlEmisor =
                controlEmisorResp.data[0];
        }

        if(
            controlDeudorResp &&
            controlDeudorResp.data &&
            controlDeudorResp.data.length > 0
        )
        {
            controlDeudor =
                controlDeudorResp.data[0];
        }

        //console.log("CONTROL EMISOR", controlEmisor);
        //console.log("CONTROL DEUDOR", controlDeudor);

        pintarControles();

        await cargarValidacionesCumplimiento();

        pintarValidacionesCumplimiento();
        
        revalidar();
    }
    catch(error)
    {
        console.error(error);
        mostrarError(
            "No fue posible cargar la información."
        );
    }
    finally
    {
        mostrarLoader(false);
    }


}
async function buscarPorNit(modulo, nit)
{
    if(!nit)
    {
        return null;
    }

    const resp = await ZOHO.CRM.API.searchRecord({
        Entity: modulo,
        Type: "criteria",
        Query: "(NIT_9:equals:" + nit + ")"
    });

    if(resp?.data?.length)
    {
        return resp.data[0];
    }

    return null;
}
function pintarEmisor()
{

    const estadoEmisor = emisor.Estado_de_Vinculaci_n || "";

    const emisorValido =
        estadoEmisor === "Activo" ||
        estadoEmisor === "Vinculado" ||
        estadoEmisor === "En Proceso de Vinculación";

    document.getElementById("estadoEmisor").innerHTML =
        emisorValido
        ? "✅ " + estadoEmisor
        : "❌ " + estadoEmisor;
}

function pintarDeudor()
{

    document.getElementById("estadoDeudor").innerHTML =
        deudor.Estado_Actual_Deudor === "Activo"
        ? "✅ Activo"
        : "❌ " + deudor.Estado_Actual_Deudor;

}

function pintarControles()
{
    // ==========================
    // EMISOR
    // ==========================

    if(controlEmisor)
    {
        const cifinEmisor = Number(controlEmisor.R_CIFIN || 0);
        const ccEmisor = Number(controlEmisor.R_C_mara_Comercio || 0);

        document.getElementById("cifinEmisor").innerHTML =
            cifinEmisor > 30
            ? `❌ ${cifinEmisor}`
            : `✅ ${cifinEmisor}`;

        document.getElementById("ccEmisor").innerHTML =
            ccEmisor > 60
            ? `❌ ${ccEmisor}`
            : `✅ ${ccEmisor}`;
    }
    else
    {
        document.getElementById("cifinEmisor").innerHTML =
            "⚠ Sin control";

        document.getElementById("ccEmisor").innerHTML =
            "⚠ Sin control";
    }


    // ==========================
    // DEUDOR
    // ==========================

    if(controlDeudor)
    {
        const cifinDeudor = Number(controlDeudor.R_CIFIN || 0);
        const ccDeudor = Number(controlDeudor.R_C_mara_Comercio || 0);

        document.getElementById("cifinDeudor").innerHTML =
            cifinDeudor > 30
            ? `❌ ${cifinDeudor}`
            : `✅ ${cifinDeudor}`;

        document.getElementById("ccDeudor").innerHTML =
            ccDeudor > 60
            ? `❌ ${ccDeudor}`
            : `✅ ${ccDeudor}`;
    }
    else
    {
        document.getElementById("cifinDeudor").innerHTML =
            "⚠ Sin control";

        document.getElementById("ccDeudor").innerHTML =
            "⚠ Sin control";
    }
}
function mostrarLoader(mostrar)
{
    const loader = document.getElementById("loader");

    if(!loader)
    {
        return;
    }

    loader.classList.toggle("hidden", !mostrar);
}

function mostrarError(mensaje)
{
    const div = document.getElementById("messageContainer");

    div.innerHTML =`<div class="message-error">${mensaje}</div>`;

}

async function revalidar()
{
    document.getElementById("messageContainer").innerHTML = "";
    pendientes = [];
    requiereExcepcion = false;
    bloqueoValidacion = false;

    const objetivo = negocio.Objetivo_Negocio || "";

    const estadoEmisor = emisor.Estado_de_Vinculaci_n || "";

    const estadoDeudor = deudor.Estado_Actual_Deudor || "";

    const tipoNegocio = negocio.Tipo_de_Negocio || "";

    const disponibleEmisor = Number(negocio.Prueba_disponible || 0);

    const disponibleDeudor = Number(negocio.Disponible_Deudor_Negocio || 0);

    const validarEmisor = Number(negocio.Cupo_Aprobado_Prueba || 0) > 0;

    const validarDeudor = Number(negocio.Cupo_Deudor_Aprobado || 0) > 0;

    let extraCupo = false;
    let extraCupoEmisor = false;
    let extraCupoDeudor = false;

    switch(tipoNegocio)
    {
        case "Confirming":

            extraCupoDeudor =
                validarDeudor &&
                disponibleDeudor < 0;

            break;

        case "Anticipo":

            extraCupoEmisor =
                validarEmisor &&
                disponibleEmisor < 0;

            break;

        case "Factoring Con Recurso":

        case "Factoring Sin Recurso":

        case "Prefactoring":

            extraCupoEmisor =
                validarEmisor &&
                disponibleEmisor < 0;

            extraCupoDeudor =
                validarDeudor &&
                disponibleDeudor < 0;

            break;
    }

    extraCupo = extraCupoEmisor || extraCupoDeudor;
    
    //console.log(
    //"EXTRACUPO:",
    //negocio.Alerta_Extra_Cupo_Emisor
    //);

    const cifinEmisor = Number(controlEmisor?.R_CIFIN || 0);

    const ccEmisor = Number(controlEmisor?.R_C_mara_Comercio || 0);

    const cifinDeudor = Number(controlDeudor?.R_CIFIN || 0);

    const ccDeudor = Number(controlDeudor?.R_C_mara_Comercio || 0);
        
    const existeControlEmisor = controlEmisor && controlEmisor.R_CIFIN != null;
        
    const existeControlDeudor = controlDeudor && controlDeudor.R_CIFIN != null;

    if(!existeControlEmisor)
        {
            pendientes.push(
                "Emisor sin registro Control CIFIN/Cámara"
            );
            
        }
    if(!existeControlDeudor)
        {
            pendientes.push(
                "Deudor sin registro Control CIFIN/Cámara"
            );
        }

    // ==========================
    // CIFIN
    // ==========================

    if(cifinEmisor > 30)
    {
        pendientes.push(
            "CIFIN Emisor mayor a 30 días"
        );
        
    }
    // Estado CIFIN Emisor

    if(cifinDeudor > 30)
    {
        pendientes.push(
            "CIFIN Deudor mayor a 30 días"
        );
    }
    
    // Estado CIFIN Emisor
    if(controlEmisor)
    {
        if(controlEmisor.Estado_CIFIN == "ALERTA")
        {
            pendientes.push({
                tipo:"alerta",
                texto:"CIFIN Emisor: ALERTA",
                titulo:"Observaciones CIFIN Emisor",
                observacion:controlEmisor.Observaciones_CIFIN
            });
        }
        else if(controlEmisor.Estado_CIFIN === "SIN INFORMACIÓN" ||!controlEmisor.Estado_CIFIN)        
        {
            pendientes.push({
                tipo:"info",
                texto:"CIFIN Emisor: Sin información o vacio"
            });
        }
    }

    // Estado CIFIN Deudor
    if(controlDeudor)
    {
        if(controlDeudor.Estado_CIFIN == "ALERTA")
        {
            pendientes.push({
                tipo:"alerta",
                texto:"CIFIN Deudor: ALERTA",
                titulo:"Observaciones CIFIN Deudor",
                observacion:controlDeudor.Observaciones_CIFIN
            });
        }
        
        else if(controlDeudor.Estado_CIFIN == "SIN INFORMACIÓN" ||!controlDeudor.Estado_CIFIN)   
        {
            pendientes.push({
                tipo:"info",
                texto:"CIFIN Deudor: Sin información o vacio"
            });
        }
    }

    // ==========================
    // CAMARA
    // ==========================

    if(ccEmisor > 60)
    {
        pendientes.push(
            "Cámara de Comercio Emisor mayor a 60 días"
        );
        
    }

    if(ccDeudor > 60)
    {
        pendientes.push(
            "Cámara de Comercio Deudor mayor a 60 días"
        );

    }
    // Estado Cámara Emisor
if(controlEmisor)
{
    if(controlEmisor.Estado_CC == "ALERTA")
    {
        pendientes.push({
            tipo:"alerta",
            texto:"Cámara de Comercio Emisor: ALERTA",
            titulo:"Observaciones Cámara Comercio Emisor",
            observacion:controlEmisor.Observaciones_C_mara_Comercio
        });
    }
    else if(controlEmisor?.Estado_CC == "SIN INFORMACIÓN" ||!controlEmisor.Estado_CC)
    {
        pendientes.push({
            tipo:"info",
            texto:"Cámara de Comercio Emisor: Sin información o vacio"
        });
    }
}

    // Estado Cámara Deudor
    if(controlDeudor)
    {
        if(controlDeudor.Estado_CC == "ALERTA")
        {
            pendientes.push({
                tipo:"alerta",
                texto:"Cámara de Comercio Deudor: ALERTA",
                titulo:"Observaciones Cámara Comercio Deudor",
                observacion:controlDeudor.Observaciones_C_mara_Comercio
            });
        }
        else if(controlDeudor?.Estado_CC == "SIN INFORMACIÓN" || !controlDeudor.Estado_CC)
        {
            pendientes.push({
                tipo:"info",
                texto:"Cámara de Comercio Deudor: Sin información o vacio"
            });
        }
    }

    // ==========================
    // EXTRACUPO
    // ==========================

    if(extraCupoEmisor)
    {
        requiereExcepcion = true;

        pendientes.push(
            "Extracupo Emisor"
        );
    }

    if(extraCupoDeudor)
    {
        requiereExcepcion = true;

        pendientes.push(
            "Extracupo Deudor"
        );
    }

    // Gestión de extracupo solicitada manualmente
    if(negocio.Alerta_Extra_Cupo_Emisor)
    {
        requiereExcepcion = true;

        pendientes.push({
            tipo:"info",
            texto:"Se solicitó Gestión de Extracupo. Es obligatorio registrar la Gestión de Excepción."
        });
    }

    // ==========================
    // OBJETIVO
    // ==========================

    const emisorValido =
        estadoEmisor === "Activo" ||
        estadoEmisor === "Vinculado" ||
        estadoEmisor === "En Proceso de Vinculación";

    const deudorValido =
        estadoDeudor === "Activo";

    if(
        objetivo === "Giro" ||
        objetivo === "Compensación con Giro"
    )
    {
        if(!emisorValido)
        {
            requiereExcepcion = true;

            pendientes.push(
                "Estado Emisor no válido"
            );
        }

        if(!deudorValido)
        {
            requiereExcepcion = true;

            pendientes.push(
                "Estado Deudor diferente de Activo"
            );
        }
    }

    // COMPENSACIÓN

    if(

        objetivo === "Compensación"
        
    )
    {
        if(estadoDeudor !== "Activo")
        {
            requiereExcepcion = true;

            pendientes.push(
                "Estado Deudor diferente de Activo"
            );
        }

        // El estado del emisor NO se valida
        // Puede estar Activo o Vencido
    }

    renderResultado();
}

function renderResultado()
{
    const estado =
        document.getElementById("estadoGeneral");

    const lista =
        document.getElementById("listaPendientes");

    const seccionExcepcion =
        document.getElementById("seccionExcepcion");

    if(pendientes.length === 0)
    {
        estado.innerHTML =
            "<span style='color:#15803d;font-weight:bold'>✅ Negocio válido para continuar</span>";

        lista.innerHTML =
            "<div class='correcto'>Todas las validaciones fueron superadas.</div>";
    }
    else
    {
        if(bloqueoValidacion)
        {
            estado.innerHTML =
                "<span style='color:#dc2626;font-weight:bold'>⛔ No es posible continuar</span>";
        }
        else
        {
            estado.innerHTML =
                "<span style='color:#d97706;font-weight:bold'>⚠ Existen validaciones pendientes</span>";
        }

        lista.innerHTML = "";

        pendientes.forEach(function(item)
        {
            // Pendientes normales
            if(typeof item === "string")
            {
                lista.innerHTML += `
                    <div class="pendiente">
                        ❌ ${item}
                    </div>
                `;
                return;
            }

            // ALERTAS
            if(item.tipo === "alerta")
                {
                    const texto = (item.observacion || "")
                    .replace(/\\/g, "\\\\")
                    .replace(/'/g, "\\'")
                    .replace(/\r/g, "")
                    .replace(/\n/g, "\\n");
                    
                    lista.innerHTML += `
                        <div class="pendiente" style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:12px;
                            padding:6px 0;
                            border-bottom:1px solid #eee;">

                            <span>
                                🚨 ${item.texto}
                            </span>

                            <button
                                class="btnMini"
                                onclick="verObservacion('${item.titulo}','${texto}')">

                                Ver observaciones

                            </button>

                        </div>
                    `;

                    return;
                }
                if(item.tipo === "info")
                    {
                        lista.innerHTML += `
                        <div style="
                        color:#64748b;
                        padding:6px 0;
                        font-size:13px;">
                        
                        ℹ ${item.texto}

                        </div>
                        `;

                        return;
                    }
                        });
                    }

                    if(requiereExcepcion)
                    {
                        seccionExcepcion.classList.remove("hidden");
                    }
                    else
                    {
                        seccionExcepcion.classList.add("hidden");
                    }
                }
async function cargarValidacionesCumplimiento()
{
    const resp =
    await ZOHO.CRM.API.getRelatedRecords({
    Entity:"Potentials",
    RecordID:recordId,
    RelatedList:"Validaci_n_de_cumplimiento_asociada"
});

validacionesCumplimiento = resp.data || [];
    
}

function pintarValidacionesCumplimiento()
{
   

    const tbody =
        document.getElementById("tbodyCumplimiento");

    tbody.innerHTML = "";

    for(const [i,r] of validacionesCumplimiento.entries())
    {
        const tieneAlerta =
        r.Contralor_a == "ALERTA" ||
        r.Procuraduria == "ALERTA" ||
        r.Lista_OFAC == "ALERTA" ||
        r.Procesos_judiciales == "ALERTA";
        let entidad = "-";

        if(r.Emisor)
        {
            entidad = r.Emisor.name;
        }
        else if(r.Deudor)
        {
            entidad = r.Deudor.name;
        }
        else
        {
            entidad = r.Raz_n_social_prospecto || "-";
        }

        let estado = "";

        switch(r.Estado)
        {
            case "Finalizada":
                estado = "<span class='estado-ok'>✔ Finalizada</span>";
                break;

            case "En revisión":
                estado = "<span class='estado-revision'>🟡 En revisión</span>";
                break;

            case "Anulada":
                estado = "<span class='estado-anulada'>🔴 Anulada</span>";
                break;

            default:
                estado = r.Estado || "-";
        }

        tbody.innerHTML += `
        <tr>

            <td>${entidad}</td>

            <td style="text-align:center;">
                ${estado}
                <div class="fechaEstado">
                    ${formatearFecha(r.Created_Time)}
                </div>
            </td>

        <td style="text-align:center;">

            <button
                class="${
                    tieneAlerta
                    ? "btnDetalleAlerta"
                    : "btnDetalle"
                }"
                onclick="abrirModalCumplimiento(${i})">

                ${
                    tieneAlerta
                    ? "⚠ Revisar alerta"
                    : "Ver detalle"
                }

            </button>

        </td>`;
    }
}

async function continuarCredito()
{
    
    try
    {
        const linkExcepcion =
            document
                .getElementById("linkExcepcion")
                .value
                .trim();

        const comentarios =
            document
                .getElementById("comentariosCupo")
                .value
                .trim();

        if(bloqueoValidacion)
        {
            mostrarError(
                "No es posible continuar. Existen controles CIFIN/Cámara pendientes de crear."
            );
            return;
        }

        // ==========================
        // VALIDAR EXCEPCIÓN
        // ==========================

        if(requiereExcepcion)
        {
            if(!linkExcepcion)
            {
                mostrarError(
                    "Debe diligenciar el Link Gestión Excepción."
                );
                return;
            }

            if(!comentarios)
            {
                mostrarError(
                    "Debe diligenciar Comentarios Cupo."
                );
                return;
            }
        }

        mostrarLoader(true);

        // ==========================
        // ARMAR UPDATE
        // ==========================

        const ahora = new Date();

        const fechaZoho =
            ahora.getFullYear() + "-" +
            String(ahora.getMonth() + 1).padStart(2,"0") + "-" +
            String(ahora.getDate()).padStart(2,"0") + "T" +
            String(ahora.getHours()).padStart(2,"0") + ":" +
            String(ahora.getMinutes()).padStart(2,"0") + ":" +
            String(ahora.getSeconds()).padStart(2,"0") +
            "-05:00";

        const dataUpdate =
        {
            id: String(recordId),
            Stage: "Crédito",
            Fecha_hora_Cr_dito: fechaZoho
        };
/*
        if(requiereExcepcion)
        {
            dataUpdate.Link_Gestion_Excepcion =
                linkExcepcion;

            dataUpdate.Comentarios_Cupo_V2 =
                comentarios;
        }
*/
        // ==========================
        // ACTUALIZAR NEGOCIO
        // ==========================

        const resp =
            await ZOHO.CRM.API.updateRecord({
                Entity: "Potentials",
                APIData: dataUpdate
            });

        if(
            resp &&
            resp.data &&
            resp.data[0] &&
            resp.data[0].code === "SUCCESS"
        )
        {

            // ======================================
            // CREAR NOTA DE EVIDENCIA
            // ======================================

            await crearNotaCredito();

            document.querySelector(".container").innerHTML = `
            <div style="
            height:420px;
            display:flex;
            justify-content:center;
            align-items:center;
            flex-direction:column;
            ">

                <div style="font-size:40px;">
                    ✅
                </div>

                <div style="
                    margin-top:15px;
                    font-size:20px;
                    font-weight:bold;
                    color:#15803d;
                ">
                    Negocio cerrado correctamente
                </div>

            </div>
            `;

            setTimeout(function()
            {
                ZOHO.CRM.UI.Popup.closeReload();
            },900);
        }
        else
        {
            console.error(resp);

            mostrarError(
                resp?.data?.[0]?.message ||
                "No fue posible actualizar el negocio."
            );
        }
    }
    catch(error)
    {
        console.error(error);

        mostrarError(
            "Error actualizando el negocio."
        );
    }
    finally
    {
        mostrarLoader(false);
    }
}


function formatearMoneda(valor)
{
    return Number(valor || 0)
        .toLocaleString("es-CO");
}
function convertirLinks(texto)
{
    if(!texto)
    {
        return "";
    }

    return texto.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank">$1</a>'
    );
}
function abrirModalCumplimiento(indice)
{
    const r = validacionesCumplimiento[indice];

    let html = "";

    let entidad = "-";

    if(r.Emisor)
    {
        entidad = r.Emisor.name;
    }
    else if(r.Deudor)
    {
        entidad = r.Deudor.name;
    }
    else
    {
        entidad = r.Raz_n_social_prospecto || "-";
    }

    html += `
    <h3 style="margin-bottom:12px;color:#1d4ed8;">
        ${entidad}
    </h3>

    <p>
        <b>Estado:</b> ${r.Estado}
    </p>

    <hr style="margin:15px 0">
    `;

    let tieneAlertas = false;

    function agregarBloque(nombre,estado,observacion)
    {
        if(!estado || estado=="SIN ALERTA")
            return;

        tieneAlertas=true;

        let color="#dc2626";

        if(estado=="ALERTA SUBSANADA")
            color="#d97706";

        html += `
        <div style="
            border-left:5px solid ${color};
            background:#fafafa;
            padding:12px;
            margin-bottom:12px;
            border-radius:6px;">

            <div style="
                font-weight:bold;
                color:${color};
                margin-bottom:8px;">

                ${nombre}

            </div>

            <div>

                <b>Resultado:</b>
                ${estado}

            </div>

            <div style="margin-top:8px">

                <b>Observaciones</b>

                <br>

                ${convertirLinks(observacion || "Sin observaciones")}

            </div>

        </div>
        `;
    }

    agregarBloque(
        "Contaduría",
        r.Contralor_a,
        r.Observaciones_contraloria
    );

    agregarBloque(
        "Procuraduría",
        r.Procuraduria,
        r.Observaciones_procuraduria
    );

    agregarBloque(
        "Listas Vinculantes",
        r.Lista_OFAC,
        r.Observaciones_Lista_OFAC
    );

    agregarBloque(
        "Procesos Judiciales",
        r.Procesos_judiciales,
        r.Observaciones_procesos_judiciales
    );

    if(!tieneAlertas)
    {
        if(r.Estado=="Finalizada")
        {
            html += `
            <div style="
                background:#ecfdf5;
                border-left:5px solid #22c55e;
                padding:12px;
                border-radius:6px;
                margin-bottom:12px;">

                ✅ No se identificaron alertas.

            </div>
            `;
        }
        else
        {
            html += `
            <div style="
                background:#fff7ed;
                border-left:5px solid #f59e0b;
                padding:12px;
                border-radius:6px;
                margin-bottom:12px;">

                La validación aún no ha finalizado.

            </div>
            `;
        }
    }

    html += `
    <div style="
        background:#eff6ff;
        border-left:5px solid #2563eb;
        padding:12px;
        border-radius:6px;">

        <b>Observaciones Generales</b>

        <br><br>

        ${
            convertirLinks(
                r.Observaciones_Generales || "Sin observaciones."
            )
        }

    </div>
    `;

    document.getElementById(
        "modalCumplimientoBody"
    ).innerHTML = html;

    document.getElementById(
        "modalCumplimiento"
    ).classList.remove("hidden");
}
function cerrarModalCumplimiento()
{
    document
        .getElementById("modalCumplimiento")
        .classList.add("hidden");
}

function pintarValor(id, valor)
{
    const elemento = document.getElementById(id);

    const numero = Number(valor || 0);

    elemento.innerText = formatearMoneda(numero);

    elemento.classList.remove(
        "valor-negativo",
        "valor-positivo"
    );

    if(numero < 0)
    {
        elemento.classList.add("valor-negativo");
    }
    else
    {
        elemento.classList.add("valor-positivo");
    }
}
async function crearNotaCredito()
{
    const titulo =
        `Aprobación Validación Crédito - ${negocio.N_mero_negocio || negocio.Deal_Name}`;

    const ahora = new Date();

    let contenido = `
============================================================
APROBACIÓN VALIDACIÓN DE CRÉDITO
============================================================

Esta nota registra la información utilizada para aprobar
la etapa de Crédito.

Fecha Validación:
${ahora.toLocaleString("es-CO")}

Resultado:
${bloqueoValidacion
? "NO APROBADO"
: requiereExcepcion
? "APROBADO CON EXCEPCIÓN"
: "APROBADO"}

============================================================
INFORMACIÓN GENERAL
============================================================

Número Negocio:
${negocio.N_mero_negocio || "-"}

Tipo:
${negocio.Tipo_de_Negocio || "-"}

Objetivo:
${negocio.Objetivo_Negocio || "-"}

Importe:
${formatearMoneda(negocio.Amount)}

Tasa:
${negocio.Tasa != null ? negocio.Tasa + " %" : "-"}

============================================================
EMISOR
============================================================

Nombre:
${emisor.Account_Name || "-"}
${emisor.Estado_de_Vinculaci_n || "-"}

============================================================
DEUDOR
============================================================

Nombre:
${deudor.Name || "-"}
${deudor.Estado_Actual_Deudor || "-"}

============================================================
INFORMACIÓN DE CUPOS
============================================================

EMISOR

Cupo aprobado:
${formatearMoneda(negocio.Cupo_Aprobado_Prueba)}

Cupo utilizado:
${formatearMoneda(negocio.Cupo_Factoring_Prueba)}

Disponible antes del negocio:
${formatearMoneda(negocio.Disponible_Antes_de_Negocio)}

Disponible después del negocio:
${formatearMoneda(negocio.Prueba_disponible)}

--------------------------------------------

DEUDOR

Cupo aprobado:
${formatearMoneda(negocio.Cupo_Deudor_Aprobado)}

Cupo utilizado:
${formatearMoneda(negocio.Disponible_Eeudor)}

Disponible antes del negocio:
${formatearMoneda(negocio.Disponible_Deudor_Antes_de_Negocio)}

Disponible después del negocio:
${formatearMoneda(negocio.Disponible_Deudor_Negocio)}

============================================================
GESTIÓN DE EXCEPCIÓN
============================================================

Extracupo solicitado:
${negocio.Alerta_Extra_Cupo_Emisor ? "SI" : "NO"}

Link Gestión Excepción:
${negocio.Link_Gestion_Excepcion || "-"}

Comentarios:
${negocio.Comentarios_Cupo_V2 || "-"}

============================================================
CONTROL CÁMARA Y CIFIN
============================================================

************* EMISOR *************

${
controlEmisor
?

`Razón Social:
${controlEmisor.Raz_n_social || emisor.Account_Name}

Días CIFIN:
${controlEmisor.R_CIFIN}

Estado CIFIN:
${controlEmisor.Estado_CIFIN || "-"}

Observaciones CIFIN:
${controlEmisor.Observaciones_CIFIN || "Sin observaciones"}

--------------------------------------------

Días Cámara:
${controlEmisor.R_C_mara_Comercio}

Estado Cámara:
${controlEmisor.Estado_CC || "-"}

Observaciones Cámara:
${controlEmisor.Observaciones_C_mara_Comercio || "Sin observaciones"}

--------------------------------------------

Atribuciones Representante Legal:
${controlEmisor.Atribuciones_RL || "-"}

Acta Atribuciones:
${controlEmisor.Acta_Atribuciones || "-"}

Fecha vencimiento Acta:
${controlEmisor.Fecha_hora_Vencimiento_Acta_Atribuciones || "-"}

Link Acta:
${controlEmisor.Link_Acta_de_Atribuciones || "No disponible"}

Carpeta Documentos Legales:
${controlEmisor.Link_Documentos_Legales || "No disponible"}
`

:

`No existe registro de Control Cámara y CIFIN para el Emisor.
`
}
============================================================

************* DEUDOR *************

${
controlDeudor
?

`Razón Social:
${controlDeudor.Raz_n_social || deudor.Name}

Días CIFIN:
${controlDeudor.R_CIFIN}

Estado CIFIN:
${controlDeudor.Estado_CIFIN || "-"}

Observaciones CIFIN:
${controlDeudor.Observaciones_CIFIN || "Sin observaciones"}

--------------------------------------------

Días Cámara:
${controlDeudor.R_C_mara_Comercio}

Estado Cámara:
${controlDeudor.Estado_CC || "-"}

Observaciones Cámara:
${controlDeudor.Observaciones_C_mara_Comercio || "Sin observaciones"}

--------------------------------------------

Atribuciones Representante Legal:
${controlDeudor.Atribuciones_RL || "-"}

Acta Atribuciones:
${controlDeudor.Acta_Atribuciones || "-"}

Fecha vencimiento Acta:
${controlDeudor.Fecha_hora_Vencimiento_Acta_Atribuciones || "-"}

Link Acta:
${controlDeudor.Link_Acta_de_Atribuciones || "No disponible"}

Carpeta Documentos Legales:
${controlDeudor.Link_Documentos_Legales || "No disponible"}
`

:

`No existe registro de Control Cámara y CIFIN para el Deudor.
`
}

============================================================
VALIDACIONES DE CUMPLIMIENTO
============================================================
`;
for(const r of validacionesCumplimiento)
{
    let entidad = "-";

    if(r.Emisor)
    {
        entidad = r.Emisor.name;
    }
    else if(r.Deudor)
    {
        entidad = r.Deudor.name;
    }
    else
    {
        entidad = r.Raz_n_social_prospecto || "-";
    }

    contenido += `

------------------------------------------------------------
${entidad}
------------------------------------------------------------

Estado:
${r.Estado || "-"}

Fecha Validación:
${r.Modified_Time || r.Created_Time || "-"}

Contraloría:
${r.Contralor_a || "-"}

${r.Observaciones_contraloria || ""}

Procuraduría:
${r.Procuraduria || "-"}

${r.Observaciones_procuraduria || ""}

Listas Vinculantes:
${r.Lista_OFAC || "-"}

${r.Observaciones_Lista_OFAC || ""}

Procesos Judiciales:
${r.Procesos_judiciales || "-"}

${r.Observaciones_procesos_judiciales || ""}

Observaciones Generales:
${r.Observaciones_Generales || "-"}

`;
}

contenido += `
============================================================
OBSERVACIONES GENERADAS DURANTE LA VALIDACIÓN
============================================================
`;

if(pendientes.length === 0)
{
    contenido += `
No se identificaron novedades durante la validación.

`;
}
else
{
    pendientes.forEach(function(item)
    {
        if(typeof item === "string")
        {
            contenido += `
• ${item}

`;
            return;
        }

        if(item.tipo === "alerta")
        {
            contenido += `
🚨 ${item.texto}

Observaciones:
${item.observacion || "Sin observaciones"}

`;
            return;
        }

        if(item.tipo === "info")
        {
            contenido += `
ℹ ${item.texto}

`;
        }
    });
}

contenido += `
============================================================
RESUMEN DE LA VALIDACIÓN
============================================================

Estado Comercial Emisor:
${emisor.Estado_de_Vinculaci_n || "-"}

Estado Comercial Deudor:
${deudor.Estado_Actual_Deudor || "-"}

Control CIFIN Emisor:
${controlEmisor ? "SI" : "NO"}

Control Cámara Emisor:
${controlEmisor ? "SI" : "NO"}

Control CIFIN Deudor:
${controlDeudor ? "SI" : "NO"}

Control Cámara Deudor:
${controlDeudor ? "SI" : "NO"}

Validaciones de Cumplimiento:
${validacionesCumplimiento.length}

Pendientes Encontrados:
${pendientes.length}

Resultado Final:
${
bloqueoValidacion
? "NO APROBADO"
: requiereExcepcion
? "APROBADO CON EXCEPCIÓN"
: "APROBADO"
}

Fecha:
${ahora.toLocaleString("es-CO")}

============================================================
FIN DE LA VALIDACIÓN
============================================================
`;

await ZOHO.CRM.API.insertRecord({
    Entity: "Notes",
    APIData:
    {
        Note_Title: titulo,
        Note_Content: contenido,
        Parent_Id: recordId,
        se_module: "Potentials"
    }
});

}

/*
async function crearNotaCredito()
{
    const titulo =`Validación Crédito - ${negocio.Deal_Name}`;

    const ahora = new Date();

    let contenido = `
    =========================================
    VALIDACIÓN DE CRÉDITO
    =========================================
    Fecha: ${ahora.toLocaleString("es-CO")}
    -----------------------------------------
    DATOS GENERALES
    -----------------------------------------
    Negocio : ${negocio.Deal_Name || "-"}

    Tipo Negocio : ${negocio.Tipo_de_Negocio || "-"}

    Objetivo : ${negocio.Objetivo_Negocio || "-"}

    Importe: ${formatearMoneda(negocio.Amount|| "-")}

    Emisor : ${emisor.Account_Name || "-"}
    Estado Emisor : ${emisor.Estado_de_Vinculaci_n || "-"}

    Deudor : ${deudor.Name || "-"}
    Estado Deudor : ${deudor.Estado_Actual_Deudor || "-"}
    -----------------------------------------
    CUPOS
    -----------------------------------------
    Cupo Aprobado Emisor :
    ${formatearMoneda(negocio.Cupo_Aprobado_Prueba)}

    Cupo Utilizado Emisor :
    ${formatearMoneda(negocio.Cupo_Factoring_Prueba)}

    Disponible Emisor :
    ${formatearMoneda(negocio.Prueba_disponible)}

    Cupo Aprobado Deudor :
    ${formatearMoneda(negocio.Cupo_Deudor_Aprobado)}

    Cupo Utilizado Deudor :
    ${formatearMoneda(negocio.Disponible_Eeudor)}

    Disponible Deudor :
    ${formatearMoneda(negocio.Disponible_Deudor_Negocio)}
    -----------------------------------------
    CONTROL CIFIN / CÁMARA
    -----------------------------------------
    CIFIN Emisor :
    ${controlEmisor ? controlEmisor.R_CIFIN : "Sin Control"}

    Cámara Emisor :
    ${controlEmisor ? controlEmisor.R_C_mara_Comercio : "Sin Control"}

    CIFIN Deudor :
    ${controlDeudor ? controlDeudor.R_CIFIN : "Sin Control"}

    Cámara Deudor :
    ${controlDeudor ? controlDeudor.R_C_mara_Comercio : "Sin Control"}
    -----------------------------------------
    EXCEPCIÓN
    -----------------------------------------
    Extracupo :
    ${negocio.Alerta_Extra_Cupo_Emisor ? "SI" : "NO"}

    Link Gestión Excepción:
    ${negocio.Link_Gestion_Excepcion || "-"}

    Comentarios Cupo:
    ${negocio.Comentarios_Cupo_V2 || "-"}
    -----------------------------------------
    VALIDACIONES DE CUMPLIMIENTO
    -----------------------------------------
    `;

        for(const r of validacionesCumplimiento)
        {
            let entidad = "-";

            if(r.Emisor)
            {
                entidad = r.Emisor.name;
            }
            else if(r.Deudor)
            {
                entidad = r.Deudor.name;
            }
            else
            {
                entidad = r.Raz_n_social_prospecto || "-";
            }

            contenido += `

    =========================================
    ${entidad}
    =========================================
    Estado:
    ${r.Estado || "-"}

    Contaduría:
    ${r.Contralor_a || "-"}
    ${r.Observaciones_contraloria || ""}

    Procuraduría:
    ${r.Procuraduria || "-"}
    ${r.Observaciones_procuraduria || ""}

    Listas Vinculantes:
    ${r.Lista_OFAC || "-"}
    ${r.Observaciones_Lista_OFAC || ""}

    Procesos Judiciales:
    ${r.Procesos_judiciales || "-"}
    ${r.Observaciones_procesos_judiciales || ""}

    Observaciones Generales:
    ${r.Observaciones_Generales || "-"}

    `;
        }

        await ZOHO.CRM.API.insertRecord({
            Entity: "Notes",
            APIData:
            {
                Note_Title: titulo,
                Note_Content: contenido,
                Parent_Id: recordId,
                se_module: "Potentials"
            }
        });
}
*/
async function consultarCupos()
{
    const body = document.getElementById("modalCuposBody");

    const cupoFactoring    = Number(emisor.Cupo_Factoring || 0);
    const cupoPreFactoring = Number(emisor.Cupo_Aprobado_Prefactoring || 0);
    const cupoAnticipo     = Number(emisor.Cupo_Aprobado_Anticipos || 0);
    const cupoPagador      = Number(deudor.Cupo_Pagador || 0);
    
    const cupoEmisorComoDeudor = Number(emisorComoDeudor?.Cupo_Pagador || 0);
    const cupoDeudorFactoring = Number(deudorComoEmisor?.Cupo_Factoring || 0);
    const cupoDeudorPrefactoring =Number(deudorComoEmisor?.Cupo_Aprobado_Prefactoring || 0);
    const cupoDeudorAnticipo = Number(deudorComoEmisor?.Cupo_Aprobado_Anticipos || 0);
    const estadoEmisorComoDeudor = emisorComoDeudor?.Estado_Actual_Deudor || "Vacio";
    const estadoDeudorComoEmisor = deudorComoEmisor?.Estado_de_Vinculaci_n || "Vacio";

    function filaRadio(nombre, grupo, valor, deshabilitado = false)
    {
        const sinValor = valor <= 0;
        const valorStr = sinValor ? "—" : formatearMoneda(valor);
        const colorTexto = sinValor ? "#94a3b8" : "#334155";

        return `
        <label class="cupo-row-modal ${sinValor ? "cupo-sin-valor" : ""}">
            <input
                type="radio"
                name="${grupo}"
                value="${valor}"
                ${(sinValor || deshabilitado) ? "disabled" : ""}
                style="accent-color:#2563eb;width:15px;height:15px;flex-shrink:0;">

            <span style="flex:1;font-size:13px;color:${colorTexto};">
                ${nombre}
            </span>

            <span style="font-size:13px;font-weight:600;color:${colorTexto};">
                ${valorStr}
            </span>
        </label>`;
    }

    body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">

            <!-- EMISOR -->
            <div style="padding-right:20px;border-right:0.5px solid #e5e7eb;">

                <div class="cupos-col-titulo">Emisor</div>

                ${filaRadio("Factoring",    "cupoEmisor", cupoFactoring)}
                ${filaRadio("Prefactoring", "cupoEmisor", cupoPreFactoring)}
                ${filaRadio("Anticipo",     "cupoEmisor", cupoAnticipo)}
                <hr style="margin:10px 0;border:none;border-top:1px solid #e5e7eb;">

                <div class="cupos-col-titulo">
                Como Deudor
                </div>
                <div style="
                font-size:12px;
                color:#0C06F7;
                margin-bottom:6px;">
                Estado: <b>${estadoEmisorComoDeudor}</b>
            </div>

                ${filaRadio(
                "Pagador",
                "cupoEmisor",
                cupoEmisorComoDeudor,
                !(estadoEmisorComoDeudor === "Activo" || estadoEmisorComoDeudor === "Vencido"|| estadoEmisorComoDeudor === "Vinculado")
            )}

                <div class="cupos-field-label">Cupo aprobado</div>
                <input
                    id="inputAprobadoEmisor"
                    class="input-cupo inputMoneda"
                    type="text"
                    value="${formatearMoneda(negocio.Cupo_Aprobado_Prueba)}">

                <div class="cupos-field-label">Cupo utilizado</div>
                <input
                    id="txtUsadoEmisor"
                    class="input-cupo calculadora"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                    spellcheck="false"
                    value="${formatearMoneda(negocio.Cupo_Factoring_Prueba)}"
                    onblur="calcularExpresion(this)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();calcularExpresion(this);}">

                <div class="cupos-fecha">
                    Vence: <b>${pintarFechaVencimiento(emisor.Fecha_Vencimiento_Cupo) || "—"}</b>
                </div>
                <div class="campoTitulo">
                    Condiciones
                </div>

                <div class="campoTexto">
                    ${(emisor.Condiciones_de_Operaciones || "Sin condiciones").trim()}
                </div>

                <button
                    class="btn-obs-mini"
                    onclick="verObservacion('Observaciones Emisor', observacionEmisor)">
                    Ver observaciones
                </button>

            </div>

            <!-- DEUDOR -->
            <div style="padding-left:20px;">

                <div class="cupos-col-titulo">Deudor</div>

                ${filaRadio("Pagador", "cupoDeudor", cupoPagador)}
                <hr style="margin:10px 0;border:none;border-top:1px solid #e5e7eb;">

                <div class="cupos-col-titulo">
                Como Emisor
                </div>
                <div style="
                font-size:12px;
                color:#0C06F7;
                margin-bottom:6px;">
                Estado: <b>${estadoDeudorComoEmisor}</b>
            </div>

            ${filaRadio(
                "Factoring",
                "cupoDeudor",
                cupoDeudorFactoring,
                !(estadoDeudorComoEmisor === "Activo" || estadoDeudorComoEmisor === "Vencido")
            )}

           ${filaRadio(
                "Prefactoring",
                "cupoDeudor",
                cupoDeudorPrefactoring,
                !(estadoDeudorComoEmisor === "Activo" || estadoDeudorComoEmisor === "Vencido")
            )}
            
            ${filaRadio(
                "Anticipo",
                "cupoDeudor",
                cupoDeudorAnticipo,
                !(estadoDeudorComoEmisor === "Activo" || estadoDeudorComoEmisor === "Vencido")
            )}

                <div class="cupos-field-label">Cupo aprobado</div>
                <input
                    id="inputAprobadoDeudor"
                    class="input-cupo inputMoneda"
                    type="text"
                    value="${formatearMoneda(negocio.Cupo_Deudor_Aprobado)}">

                <div class="cupos-field-label">Cupo utilizado</div>
                <input
                    id="txtUsadoDeudor"
                    class="input-cupo calculadora"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                    spellcheck="false"
                    value="${formatearMoneda(negocio.Disponible_Eeudor)}"
                    onblur="calcularExpresion(this)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();calcularExpresion(this);}">

                <div class="cupos-fecha">
                
                    Vence: <b>${pintarFechaVencimiento(deudor.Fecha_Vencimiento_Cupo) || "—"}</b>
                </div>
                
                <div class="campoTitulo">
                    Condiciones
                </div>

                <div class="campoTexto">
                    ${(deudor.Condiciones_de_Operaciones || "Sin condiciones").trim()}
                </div>               

                <button
                    class="btn-obs-mini"
                    onclick="verObservacion('Observaciones Deudor', observacionDeudor)">
                    Ver observaciones
                </button>

            </div>

        </div>

        <hr style="margin:18px 0;border:none;border-top:0.5px solid #e5e7eb;">

        <div style="text-align:right;">
            <button class="btn btn-success" onclick="guardarCupos()">
                Guardar cupos
            </button>
        </div>
    `;

    // Marcar la fila que ya coincide con el cupo actual del negocio
    marcarFilaActual("cupoEmisor", Number(negocio.Cupo_Aprobado_Prueba || 0));
    marcarFilaActual("cupoDeudor", Number(negocio.Cupo_Deudor_Aprobado || 0));

    // ✅ Listeners AQUÍ — después de que el HTML ya existe en el DOM
    body.querySelectorAll("input[type='radio']").forEach(function(radio)
    {
        radio.addEventListener("change", function()
        {
            const grupo = this.name;
            const valor = Number(this.value);

            // Quitar selección anterior del mismo grupo
            body.querySelectorAll(`input[name="${grupo}"]`).forEach(function(r)
            {
                r.closest(".cupo-row-modal").classList.remove("cupo-seleccionada");
            });

            // Marcar la fila actual
            this.closest(".cupo-row-modal").classList.add("cupo-seleccionada");

            // Rellenar el input de cupo aprobado
            if(valor > 0)
            {
                const inputId = grupo === "cupoEmisor"
                    ? "inputAprobadoEmisor"
                    : "inputAprobadoDeudor";

                document.getElementById(inputId).value = formatearMoneda(valor);
            }
        });
    });

    document.getElementById("modalCupos").classList.remove("hidden");
}


// ==================================================
// Marca visualmente la fila que ya está activa
// ==================================================

function marcarFilaActual(grupo, valorActual)
{
    if(!valorActual) return;

    document.querySelectorAll(`input[name="${grupo}"]`).forEach(function(radio)
    {
        if(Number(radio.value) === valorActual)
        {
            radio.checked = true;
            radio.closest(".cupo-row-modal").classList.add("cupo-seleccionada");
        }
    });
}

// ==================================================
// guardarCupos — lee los cuatro inputs
// ==================================================

async function guardarCupos()
{
    try
    {
        mostrarLoader(true);

        function leerInput(id)
        {
            const val = document.getElementById(id)?.value || "0";
            return Number(val.replace(/\./g, "").replace(/,/g, ""));
        }

        const nuevoAprobadoEmisor = leerInput("inputAprobadoEmisor");
        const nuevoAprobadoDeudor = leerInput("inputAprobadoDeudor");
        const nuevoUsadoEmisor    = leerInput("txtUsadoEmisor");
        const nuevoUsadoDeudor    = leerInput("txtUsadoDeudor");

        const aprobadoEmisorActual = Number(negocio.Cupo_Aprobado_Prueba   || 0);
        const aprobadoDeudorActual = Number(negocio.Cupo_Deudor_Aprobado   || 0);
        const usadoEmisorActual    = Number(negocio.Cupo_Factoring_Prueba  || 0);
        const usadoDeudorActual    = Number(negocio.Disponible_Eeudor      || 0);

        if(
            nuevoAprobadoEmisor === aprobadoEmisorActual &&
            nuevoAprobadoDeudor === aprobadoDeudorActual &&
            nuevoUsadoEmisor    === usadoEmisorActual    &&
            nuevoUsadoDeudor    === usadoDeudorActual
        )
        {
            mostrarError("No hay cambios para guardar.");
            return;
        }

        const resp = await ZOHO.CRM.API.updateRecord({
            Entity: "Potentials",
            APIData: {
                id:                    String(recordId),
                Cupo_Aprobado_Prueba:  nuevoAprobadoEmisor,
                Cupo_Deudor_Aprobado:  nuevoAprobadoDeudor,
                Cupo_Factoring_Prueba: nuevoUsadoEmisor,
                Disponible_Eeudor:     nuevoUsadoDeudor
            }
        });

        if(resp?.data?.[0]?.code === "SUCCESS")
        {
            document.getElementById("modalCupos").classList.add("hidden");

            await cargarInformacion();

            document.getElementById("messageContainer").innerHTML =
                `<div class="message-success">Cupos actualizados correctamente.</div>`;
        }
        else
        {
            console.error(resp);
            mostrarError(resp?.data?.[0]?.message || "No fue posible guardar los cupos.");
        }
    }
    catch(error)
    {
        console.error(error);
        mostrarError("Error guardando los cupos.");
    }
    finally
    {
        mostrarLoader(false);
    }
}
async function guardarExcepcion()
{
    const resp = await ZOHO.CRM.API.updateRecord({
        Entity:"Potentials",
        APIData:{
            id:String(recordId),
            Link_Gestion_Excepcion:
                document.getElementById("linkExcepcion").value,
            Comentarios_Cupo_V2:
                document.getElementById("comentariosCupo").value
        }
    });

    if(resp?.data?.[0]?.code === "SUCCESS")
    {
        negocio.Link_Gestion_Excepcion =
            document.getElementById("linkExcepcion").value;

        negocio.Comentarios_Cupo_V2 =
            document.getElementById("comentariosCupo").value;
    }
}
async function guardarExtracupo(valor)
{
    if(valor)
    {
        mostrarConfirmacion(
            "⚠ Confirmar Gestión de Extracupo",

                `
                ¿Está seguro de solicitar la <b>Gestión de Extracupo</b> para este negocio?<br><br>

                Esta acción notificará automáticamente a las áreas y responsables involucrados en el proceso de extracupo.<br><br>

                <b>¿Desea continuar?</b>
                `,

            async function()
            {
                await actualizarExtracupo(true);
            }
        );

        return;
    }

    await actualizarExtracupo(false);
}
async function actualizarExtracupo(valor)
{
    const resp = await ZOHO.CRM.API.updateRecord({
        Entity:"Potentials",
        APIData:{
            id:String(recordId),
            Alerta_Extra_Cupo_Emisor:valor
        }
    });

    if(resp?.data?.[0]?.code === "SUCCESS")
    {
        negocio.Alerta_Extra_Cupo_Emisor = valor;

        document.getElementById("chkExtracupo").checked = valor;

        await revalidar();
    }
    else
    {
        document.getElementById("chkExtracupo").checked =
            !!negocio.Alerta_Extra_Cupo_Emisor;

        mostrarError("No fue posible actualizar la Gestión de Extracupo.");
    }
}
function usarCupo(valor,tipo)
{
    valor = Number(valor || 0);

    if(tipo == "emisor")
    {
        cupoEmisorSeleccionado = valor;

        document.getElementById("cupoFactoring").innerText =
            formatearMoneda(valor);
    }
    else
    {
        cupoDeudorSeleccionado = valor;

        document.getElementById("cupoDeudor").innerText =
            formatearMoneda(valor);
    }
}

function cerrarModalCupos()
{
    document
        .getElementById("modalCupos")
        .classList.add("hidden");
}

function verObservacion(titulo, texto)
{
    document.getElementById("tituloObservacion").innerText = titulo;

    document.getElementById("contenidoObservacion").innerText =
        texto || "Sin observaciones.";

    document.getElementById("modalObservacion").classList.remove("hidden");
}
function cerrarModalObservacion()
{
    document
        .getElementById("modalObservacion").classList.add("hidden");
}
    document.addEventListener("input", function(e)
    {
        if(!e.target.classList.contains("inputMoneda"))
        {
            return;
        }

        // Mientras escribe no hacer nada.
        // El cálculo se realiza al salir del campo o con Enter.
    });


function calcularExpresion(input)
{
    try
    {
        let expresion = input.value;

        // quitar separadores de miles
        expresion = expresion.replace(/\./g,"");

        // permitir números y operaciones
        if(!/^[0-9+\-*/(). ]+$/.test(expresion))
        {
            return;
        }

        const resultado = Function(
            "return (" + expresion + ")"
        )();

        if(!isNaN(resultado))
        {
            input.value = Number(resultado)
                .toLocaleString("es-CO");
        }
    }
    catch(error)
    {
        // expresión inválida
    }
}

function pintarFechaVencimiento(fecha)
{
    if(!fecha)
    {
        return "-";
    }

    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    const vence = new Date(fecha);

    if(vence < hoy)
    {
        return `<span class="fechaVencida">${fecha}</span>`;
    }

    return `<span class="fechaVigente">${fecha}</span>`;
}

function formatearFecha(fecha)
{
    if(!fecha)
    {
        return "-";
    }

    const f = new Date(fecha);

    return f.toLocaleString("es-CO",{
        day:"2-digit",
        month:"2-digit",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit"
    });
}

let accionConfirmada = null;

function mostrarConfirmacion(titulo, mensaje, callback)
{
    document.getElementById("tituloConfirmacion").innerHTML = titulo;

    document.getElementById("mensajeConfirmacion").innerHTML = mensaje;

    accionConfirmada = callback;

    document
        .getElementById("modalConfirmacion")
        .classList.remove("hidden");
}

function ocultarModalConfirmacion()
{
    document
        .getElementById("modalConfirmacion")
        .classList.add("hidden");
}
document.getElementById("btnConfirmarModal").onclick = async function()
{
    ocultarModalConfirmacion();

    try
    {
        if(accionConfirmada)
        {
            await accionConfirmada();
        }
    }
    finally
    {
        accionConfirmada = null;
    }
};
function cerrarConfirmacion()
{
    ocultarModalConfirmacion();

    document.getElementById("chkExtracupo").checked =
        !!negocio.Alerta_Extra_Cupo_Emisor;

    accionConfirmada = null;
}

// pendiente bloquear seleccion de cupos cuando uno de las entidades como emisor o deudor este  descartada o demas. solo estado vencido e activo se debe permitir seleccionar, tambien el boton 
//solicitar extracupo  debe pedir un tipo de estas seguro o algo asi porque es muy rapido. ojala una confirmación. 
