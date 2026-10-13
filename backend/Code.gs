/**
 * Servidor Backend para ParcelTrack_BD
 * Sincronización multiusuario de Paquetes, Usuarios y Configuración Global.
 */

const DB_SHEET_NAME = 'PAQUETES';
const DB_USERS_SHEET_NAME = 'USUARIOS';
const DB_SETTINGS_SHEET_NAME = 'CONFIGURACION';

function doGet(e) {
  var storeId = e.parameter.storeId || 'LAPAZ';
  var fileName = 'Backup_Tienda_' + storeId.charAt(0) + storeId.slice(1).toLowerCase() + '.json';
  
  var folders = DriveApp.getFoldersByName('PaqueteriaBackups');
  if (folders.hasNext()) {
    var folder = folders.next();
    var files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      var content = files.next().getBlob().getDataAsString();
      return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ storeId: storeId, packages: [], settings: {} }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var storeId = data.storeId || 'LAPAZ';
    var fileName = 'Backup_Tienda_' + storeId.charAt(0) + storeId.slice(1).toLowerCase() + '.json';
    
    var folders = DriveApp.getFoldersByName('PaqueteriaBackups');
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('PaqueteriaBackups');
    
    var files = folder.getFilesByName(fileName);
    var file;
    var backupData = { storeId: storeId, packages: [], settings: {}, updatedAt: new Date().toISOString() };
    
    if (files.hasNext()) {
      file = files.next();
      backupData = JSON.parse(file.getBlob().getDataAsString());
    }
    
    if (data.item) {
      var item = data.item;
      if (item.type === 'CREATE' || item.type === 'UPDATE' || item.type === 'DELIVERY') {
        var pkg = item.payload;
        pkg.storeId = storeId;
        var found = false;
        for (var i = 0; i < backupData.packages.length; i++) {
          if (backupData.packages[i].packageId === pkg.packageId) {
            backupData.packages[i] = pkg;
            found = true;
            break;
          }
        }
        if (!found) {
          backupData.packages.push(pkg);
        }
      } else if (item.type === 'DELETE') {
        var pkgId = item.payload.packageId;
        backupData.packages = backupData.packages.filter(function(p) { return p.packageId !== pkgId; });
      } else if (item.type === 'SYNC_SETTING') {
        backupData.settings[item.payload.key] = item.payload.value;
      }
    }
    
    backupData.updatedAt = new Date().toISOString();
    var jsonString = JSON.stringify(backupData, null, 2);
    
    if (file) {
      file.setContent(jsonString);
    } else {
      folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', storeId: storeId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- AUXILIARES CONFIGURACIÓN ---
function saveOrUpdateSetting(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  const jsonValue = JSON.stringify(value);
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 2).setValue(jsonValue);
    sheet.getRange(rowIndex, 3).setValue(new Date().toISOString());
    return { status: 'success', action: 'UPDATE_SETTING', key };
  } else {
    sheet.appendRow([key, jsonValue, new Date().toISOString()]);
    return { status: 'success', action: 'CREATE_SETTING', key };
  }
}

function getOrCreateSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_SETTINGS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet(DB_SETTINGS_SHEET_NAME);
    sheet.appendRow(['key', 'value', 'updatedAt']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  return sheet;
}

// --- AUXILIARES PAQUETES Y USUARIOS ---
function saveOrUpdateRecord(sheet, record) {
  const headers = getDatabaseHeaders();
  const rowIndex = findRowIndexById(sheet, record.packageId);
  const rowData = headers.map(header => record[header] !== undefined ? record[header] : '');

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    return { status: 'success', action: 'UPDATE', packageId: record.packageId };
  } else {
    sheet.appendRow(rowData);
    return { status: 'success', action: 'CREATE', packageId: record.packageId };
  }
}

function deleteRecord(sheet, packageId) {
  const rowIndex = findRowIndexById(sheet, packageId);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { status: 'success', action: 'DELETE', packageId };
  }
  return { status: 'warning', message: 'Registro no encontrado.', packageId };
}

function findRowIndexById(sheet, packageId) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === packageId) return i + 1;
  }
  return -1;
}

function getDatabaseSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet(DB_SHEET_NAME);
    sheet.appendRow(getDatabaseHeaders());
    sheet.getRange(1, 1, 1, getDatabaseHeaders().length).setFontWeight('bold');
  }
  return sheet;
}

function getDatabaseHeaders() {
  return [
    'packageId', 'code', 'qrCode', 'client', 'phone', 'recipientPhone',
    'category', 'size', 'color', 'location', 'status', 'createdAt',
    'createdBy', 'updatedAt', 'updatedBy', 'deliveredTo', 'deliveredAt',
    'deliveredBy', 'amountCharged'
  ];
}

function saveOrUpdateUser(sheet, user) {
  const headers = ['username', 'fullName', 'pin', 'role', 'status', 'createdAt'];
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.username) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowData = headers.map(h => user[h] !== undefined ? user[h] : '');

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    return { status: 'success', action: 'UPDATE_USER', username: user.username };
  } else {
    sheet.appendRow(rowData);
    return { status: 'success', action: 'CREATE_USER', username: user.username };
  }
}

function getOrCreateUserSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB_USERS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet(DB_USERS_SHEET_NAME);
    const headers = ['username', 'fullName', 'pin', 'role', 'status', 'createdAt'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
