/**
 * سجل الأعطال اليومي - الباك إند (Google Apps Script)
 * ------------------------------------------------------
 * الواجهة (index.html) بقت مستضافة على GitHub Pages منفصلة.
 * هنا وظيفته الوحيدة: يستقبل البيانات من الفورم (doPost) ويسجلها
 * في الشيت، ويرجع اقتراحات الأقسام/الماكينات (doGet مع action=suggestions).
 */

const SHEET_NAME = 'سجل الأعطال';

const HEADERS = [
  'وقت التسجيل',
  'التاريخ',
  'القسم',
  'الوردية',
  'اسم/كود موظف الإنتاج',
  'وظيفة موظف الإنتاج',
  'الماكينة/الكود',
  'وقت بداية العطل',
  'اسم/كود فني الصيانة',
  'وظيفة فني الصيانة',
  'نوع الصيانة',
  'وصف العطل',
  'نوع الإجراء',
  'الإجراء الذي تم',
  'حالة قطع الغيار',
  'ملاحظات الصيانة',
  'تاريخ الانتهاء',
  'وقت الانتهاء',
  'الوقت الفعلي للصيانة (دقيقة)',
  'ملاحظات الإنتاج بعد الاستلام',
  'وقت الاستلام',
  'زمن التوقف الكلي للماكينة (دقيقة)',
];

/**
 * طلبات GET: بتُستخدم بس لجلب اقتراحات الأقسام والماكينات
 * مثال: https://script.google.com/macros/s/XXX/exec?action=suggestions
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'suggestions') {
    return jsonOutput_(getSuggestions_());
  }

  // fallback: رسالة بسيطة لو حد فتح رابط الـ API مباشرة من المتصفح
  return jsonOutput_({ status: 'ok', message: 'سجل الأعطال API شغال. استخدم الفورم من الرابط المخصص.' });
}

/**
 * طلبات POST: حفظ سجل عطل جديد.
 * الواجهة بتبعت البيانات كـ text/plain (JSON.stringify) عشان تتجنب مشاكل CORS.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet_();

    const row = [
      new Date(),
      data.date || '',
      data.department || '',
      data.shift || '',
      data.prodEmployee || '',
      data.prodRole || '',
      data.machine || '',
      data.faultStart || '',
      data.maintEmployee || '',
      data.maintRole || '',
      (data.maintTypes || []).join(', '),
      data.faultDescription || '',
      data.actionType || '',
      data.actionTaken || '',
      data.spareParts || '',
      data.otherNotes || '',
      data.endDate || '',
      data.endTime || '',
      data.actualMinutes || '',
      data.receiveNotes || '',
      data.receiveTime || '',
      data.totalDowntime || '',
    ];

    sheet.appendRow(row);

    return jsonOutput_({ success: true, rowNumber: sheet.getLastRow() });
  } catch (err) {
    return jsonOutput_({ success: false, error: err.message });
  }
}

function getSuggestions_() {
  const sheet = getOrCreateSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { departments: [], machines: [] };

  const deptCol = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
  const machineCol = sheet.getRange(2, 7, lastRow - 1, 1).getValues().flat();

  return {
    departments: uniqueNonEmpty_(deptCol),
    machines: uniqueNonEmpty_(machineCol),
  };
}

function uniqueNonEmpty_(arr) {
  return [...new Set(arr.filter(String).map(String))];
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
