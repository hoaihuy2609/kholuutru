// ============================================================
// THÊM VÀO GOOGLE APPS SCRIPT (paste vào cuối file Code.gs)
// Action: proxy_pdf
// Mục đích: Fetch PDF binary từ Telegram, trả về base64 JSON
//           để tránh CORS khi browser load trực tiếp
// ============================================================

// Trong hàm doGet(e) hiện tại, thêm case này vào switch/if:
//
//   if (action === 'proxy_pdf') return handleProxyPdf(e);
//

function handleProxyPdf(e) {
  try {
    var filePath = e.parameter.file_path;
    var token = e.parameter.token;
    
    if (!filePath || !token) {
      return jsonResponse({ success: false, error: 'Thiếu file_path hoặc token' });
    }
    
    // Fetch PDF binary từ Telegram CDN
    var url = 'https://api.telegram.org/file/bot' + token + '/' + filePath;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() !== 200) {
      return jsonResponse({ 
        success: false, 
        error: 'Telegram trả về lỗi: ' + response.getResponseCode() 
      });
    }
    
    // Chuyển binary sang base64
    var blob = response.getBlob();
    var base64Data = Utilities.base64Encode(blob.getBytes());
    
    return jsonResponse({ success: true, data: base64Data });
    
  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// Helper (nếu chưa có trong file):
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// VÍ DỤ: Đây là cấu trúc doGet() sau khi thêm proxy_pdf:
//
// function doGet(e) {
//   var action = e.parameter.action;
//   
//   if (action === 'list') return handleList();
//   if (action === 'check') return handleCheck(e);
//   if (action === 'get_latest_index') return handleGetLatestIndex(e);
//   if (action === 'get_vault_data') return handleGetVaultData(e);
//   if (action === 'update_vault_index') return handleUpdateVaultIndex(e);
//   if (action === 'proxy_pdf') return handleProxyPdf(e);  // ← THÊM DÒNG NÀY
//   
//   return jsonResponse({ success: false, error: 'Unknown action' });
// }
// ============================================================
