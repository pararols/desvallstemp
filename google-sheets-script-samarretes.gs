/**
 * GOOGLE APPS SCRIPT - GESTIÓ DE COMANDES DE SAMARRETES
 * DESVALLS CULTURA 2026
 * 
 * Instruccions:
 * 1. Obre el teu full de Google Sheets a Google Drive.
 * 2. Vés a Extensions > Apps Script.
 * 3. Enganxa aquest codi.
 * 4. Fes clic a "Implementa" (Deploy) > "Nova implementació" (New deployment).
 * 5. Tipus: "Aplicació web" (Web app).
 * 6. Executa com a: "Jo" (El teu compte).
 * 7. Qui té accés: "Tothom" (Anyone).
 * 8. Copia l'URL de l'aplicació web generada i actualitza-la al fitxer marxandatge.html si cal.
 */

const NOM_FULL = "Comandes Samarretes";
const EMAIL_ORGANITZACIO = "desvallscultura@gmail.com";
const PREU_UNITARI = 20;

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    missatge: "Servei de comandes de samarretes de Desvalls Cultura actiu"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
      if (typeof data.items === "string") {
        try {
          data.items = JSON.parse(data.items);
        } catch(err) {}
      }
    }
    
    // Honeypot anti-spam
    if (data.website_hp && data.website_hp.length > 0) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Bot detected" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var resultat = registrarComanda(data);
    return ContentService.createTextOutput(JSON.stringify(resultat))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function registrarComanda(dades) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(NOM_FULL);
  
  if (!sheet) {
    sheet = doc.insertSheet(NOM_FULL);
  }
  
  var capcaleres = [
    "Data i Hora",
    "Núm. Comanda",
    "Nom i Cognoms",
    "Telèfon",
    "Email",
    "Detall Comanda",
    "Total Unitats",
    "Import (€)",
    "Observacions",
    "Estat"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, capcaleres.length).setValues([capcaleres]);
    sheet.getRange(1, 1, 1, capcaleres.length)
      .setFontWeight("bold")
      .setBackground("#12a298")
      .setFontColor("white");
    sheet.setFrozenRows(1);
  }
  
  var nComanda = dades.num_comanda || dades.nComanda || generarNumeroComanda();
  var items = dades.items || [];
  
  var detallText = "";
  var totalUnitats = 0;
  
  if (Array.isArray(items)) {
    items.forEach(function(item) {
      var q = parseInt(item.unitats) || 0;
      if (q > 0) {
        totalUnitats += q;
        if (detallText !== "") detallText += ", ";
        detallText += q + "x " + item.talla + " (" + item.color + ")";
      }
    });
  }
  
  if (totalUnitats === 0 && dades.total_unitats) {
    totalUnitats = parseInt(dades.total_unitats) || 0;
  }
  
  var importTotal = dades.import_total ? parseFloat(dades.import_total) : (totalUnitats * PREU_UNITARI);
  
  var fila = [
    new Date(),
    nComanda,
    dades.nom || "",
    dades.telf || dades.telefon || "",
    dades.mail || dades.email || "",
    detallText,
    totalUnitats,
    importTotal,
    dades.observacions || dades.obs || "",
    "Pendent de recollida / pagament"
  ];
  
  sheet.appendRow(fila);
  
  // Format visual automàtic a la fila
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 8).setNumberFormat("#,##0.00 €");
  sheet.getRange(lastRow, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  
  // Enviar correus de confirmació
  try {
    enviarConfirmacioClient(dades, nComanda, detallText, totalUnitats, importTotal);
    enviarNotificacioVenedor(dades, nComanda, detallText, totalUnitats, importTotal);
  } catch (eEmail) {
    Logger.log("Error enviant correu: " + eEmail.toString());
  }
  
  return {
    success: true,
    nComanda: nComanda,
    totalUnitats: totalUnitats,
    importTotal: importTotal,
    missatge: "Comanda registrada correctament!"
  };
}

function generarNumeroComanda() {
  var prefix = "SAM-2026-";
  var aleatori = Math.floor(1000 + Math.random() * 9000);
  return prefix + aleatori;
}

function enviarConfirmacioClient(dades, nComanda, detallText, totalUnitats, importTotal) {
  var email = dades.mail || dades.email;
  if (!email) return;
  
  var assumpte = "Confirmació de comanda de samarreta - Desvalls Cultura (" + nComanda + ")";
  var htmlCos = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>" +
    "<div style='text-align: center; margin-bottom: 20px;'>" +
      "<h2 style='color: #12a298; margin: 0;'>Desvalls Cultura</h2>" +
      "<p style='color: #64748b; margin: 5px 0;'>Sant Jordi Desvalls · Batec cultural</p>" +
    "</div>" +
    "<div style='background: #f0fdfa; border-left: 4px solid #12a298; padding: 15px; margin-bottom: 20px; border-radius: 4px;'>" +
      "<h3 style='margin: 0 0 5px; color: #0f766e;'>Comanda confirmada amb èxit!</h3>" +
      "<p style='margin: 0; color: #334155;'>Gràcies per col·laborar amb Desvalls Cultura. Hem rebut la teva comanda correctament.</p>" +
    "</div>" +
    "<table style='width: 100%; border-collapse: collapse; margin-bottom: 20px;'>" +
      "<tr><td style='padding: 8px 0; color: #64748b;'><strong>Número de comanda:</strong></td><td style='padding: 8px 0; color: #0f766e; font-size: 18px; font-weight: bold;'>" + nComanda + "</td></tr>" +
      "<tr><td style='padding: 8px 0; color: #64748b;'><strong>Comprador/a:</strong></td><td style='padding: 8px 0; color: #1e293b;'>" + (dades.nom || "") + "</td></tr>" +
      "<tr><td style='padding: 8px 0; color: #64748b;'><strong>Telèfon:</strong></td><td style='padding: 8px 0; color: #1e293b;'>" + (dades.telf || dades.telefon || "") + "</td></tr>" +
      "<tr><td style='padding: 8px 0; color: #64748b;'><strong>Articles:</strong></td><td style='padding: 8px 0; color: #1e293b;'>" + detallText + "</td></tr>" +
      "<tr><td style='padding: 8px 0; color: #64748b;'><strong>Total unitats:</strong></td><td style='padding: 8px 0; color: #1e293b;'>" + totalUnitats + "</td></tr>" +
      "<tr><td style='padding: 8px 0; color: #64748b;'><strong>Import total:</strong></td><td style='padding: 8px 0; color: #1e293b; font-size: 18px; font-weight: bold;'>" + importTotal.toFixed(2).replace(".", ",") + " €</td></tr>" +
    "</table>" +
    (dades.observacions ? "<p style='color: #64748b; font-size: 14px;'><strong>Observacions:</strong> " + dades.observacions + "</p>" : "") +
    "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />" +
    "<p style='color: #64748b; font-size: 14px;'>T'avisarem tan bon punt les samarretes estiguin llestes per a recollir i pagar a Sant Jordi Desvalls.</p>" +
    "<p style='color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;'>Associació Desvalls Cultura · Sant Jordi Desvalls</p>" +
  "</div>";
  
  MailApp.sendEmail({
    to: email,
    subject: assumpte,
    htmlBody: htmlCos
  });
}

function enviarNotificacioVenedor(dades, nComanda, detallText, totalUnitats, importTotal) {
  if (!EMAIL_ORGANITZACIO) return;
  
  var assumpte = "Nova comanda de samarreta (" + nComanda + ") - " + (dades.nom || "Client");
  var cos = "S'ha registrat una nova comanda de samarretes:\n\n" +
    "Núm. Comanda: " + nComanda + "\n" +
    "Nom: " + (dades.nom || "") + "\n" +
    "Telèfon: " + (dades.telf || dades.telefon || "") + "\n" +
    "Email: " + (dades.mail || dades.email || "") + "\n" +
    "Articles: " + detallText + "\n" +
    "Total unitats: " + totalUnitats + "\n" +
    "Import: " + importTotal.toFixed(2) + " €\n" +
    "Observacions: " + (dades.observacions || dades.obs || "Cap") + "\n\n" +
    "Pots consultar el full de càlcul de Google Sheets per gestionar l'estat de la comanda.";
    
  MailApp.sendEmail(EMAIL_ORGANITZACIO, assumpte, cos);
}
