/**
 * Servidor Backend para Sistema Multitienda de Paquetería
 * Sincronización basada en archivos JSON aislados por sucursal en Google Drive.
 */

function doGet(e) {
  try {
    var storeId = (e.parameter.storeId || 'LAPAZ').toUpperCase();
    var fileName = 'Backup_Tienda_' + storeId.charAt(0) + storeId.slice(1).toLowerCase() + '.json';
    
    var folder = getOrCreateBackupFolder();
    var files = folder.getFilesByName(fileName);
    
    if (files.hasNext()) {
      var content = files.next().getBlob().getDataAsString();
      return ContentService.createTextOutput(content)
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Si el archivo no existe aún, retornar estructura inicial vacía para la tienda
    var emptyData = { storeId: storeId, packages: [], settings: {}, updatedAt: new Date().toISOString() };
    return ContentService.createTextOutput(JSON.stringify(emptyData))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var storeId = (data.storeId || 'LAPAZ').toUpperCase();
    var fileName = 'Backup_Tienda_' + storeId.charAt(0) + storeId.slice(1).toLowerCase() + '.json';
    
    var folder = getOrCreateBackupFolder();
    var files = folder.getFilesByName(fileName);
    var file;
    var backupData = { storeId: storeId, packages: [], settings: {}, updatedAt: new Date().toISOString() };
    
    if (files.hasNext()) {
      file = files.next();
      backupData = JSON.parse(file.getBlob().getDataAsString());
    }
    
    // Procesar elementos de la cola de sincronización (syncQueue)
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
      } 
      else if (item.type === 'DELETE') {
        var pkgId = item.payload.packageId;
        backupData.packages = backupData.packages.filter(function(p) { 
          return p.packageId !== pkgId; 
        });
      } 
      else if (item.type === 'SYNC_SETTING') {
        if (!backupData.settings) backupData.settings = {};
        backupData.settings[item.payload.key] = item.payload.value;
      }
      else if (item.type === 'SYNC_USER') {
        // Soporte opcional para guardar usuarios dentro del JSON de la tienda si aplica
        if (!backupData.users) backupData.users = [];
        var usr = item.payload;
        var usrFound = false;
        for (var j = 0; j < backupData.users.length; j++) {
          if (backupData.users[j].username === usr.username) {
            backupData.users[j] = usr;
            usrFound = true;
            break;
          }
        }
        if (!usrFound) {
          backupData.users.push(usr);
        }
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

/**
 * Función auxiliar para obtener o crear la carpeta contenedora en Google Drive
 */
function getOrCreateBackupFolder() {
  var folders = DriveApp.getFoldersByName('PaqueteriaBackups');
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder('PaqueteriaBackups');
}
