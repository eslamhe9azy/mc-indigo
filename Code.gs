/**
 * سجل الأعطال اليومي - نظام رقمي بديل للورق
 * ------------------------------------------------
 * الكود ده بيشتغل كـ Google Apps Script Web App، وبيخدم حالتين مع بعض:
 *
 * 1) لو فتحت رابط الـ Apps Script (exec) مباشرة من المتصفح من غير أي
 *    باراميتر -> بيتفتح فورم HTML من ملف index.html جوه نفس المشروع.
 *
 * 2) لو الطلب جاي عن طريق fetch() من نسخة الـ HTML المرفوعة على GitHub
 *    (أو أي استضافة تانية) -> بيتعامل معاه كـ API بيرجع JSON:
 *      GET  ?action=suggestions   -> اقتراحات الأقسام/الماكينات
 *      GET  ?action=getDraft      -> آخر بيانات تسجيل شغال (مشترك)
 *      POST { action:'updateDraft', draft:{...} } -> يحدّث التسجيل المشترك
 *      POST { action:'clearDraft' }               -> يفضّي التسجيل المشترك
 *      POST { ...بيانات السجل من غير action }      -> يحفظ السجل نهائيًا في الشيت
 */

// اسم الشيت اللي هيتسجل فيه كل الأعطال
const SHEET_NAME = 'سجل الأعطال';

// مفتاح تخزين "التسجيل المشترك" اللي بيتزامن بين أي جهاز بيفتح الفورم
const DRAFT_KEY = 'sharedDraft';

// ترتيب الأعمدة في الشيت - لازم يطابق ترتيب الحقول في الفورم
const HEADERS = [
  'وقت التسجيل',
  'التاريخ',
  'القسم',
  'الوردية',
  // بيانات الإنتاج
  'اسم/كود موظف الإنتاج',
  'وظيفة موظف الإنتاج',
  'الماكينة/الكود',
  'وقت بداية العطل',
  // بيانات الصيانة
  'اسم/كود فني الصيانة',
  'وظيفة فني الصيانة',
  'نوع الصيانة',
  'وصف العطل',
  'نوع الإجراء',
  'الإجراء الذي تم',
  'حالة قطع الغيار',
  'ملاحظات الصيانة',
  // الإنهاء
  'تاريخ الانتهاء',
  'كود العطل',
  'وقت الانتهاء',
  'الوقت الفعلي للصيانة (دقيقة)',
  // استلام الإنتاج
  'ملاحظات الإنتاج بعد الاستلام',
  'وقت الاستلام',
  'زمن التوقف الكلي للماكينة (دقيقة)',
];

/**
 * بيشتغل لما حد يفتح رابط التطبيق بـ GET.
 * - من غير action: بيعرض صفحة الفورم (للاستخدام كـ Apps Script Web App مباشرة).
 * - مع action=suggestions أو action=getDraft: بيرجع JSON (للاستخدام من أي
 *   نسخة HTML مستضافة في مكان تاني زي GitHub وبتعمل fetch على الرابط ده).
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;

  if (action === 'suggestions') {
    return jsonResponse_(getSuggestions());
  }

  if (action === 'getDraft') {
    const v = PropertiesService.getScriptProperties().getProperty(DRAFT_KEY);
    return jsonResponse_({ draft: v ? JSON.parse(v) : null });
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('سجل الأعطال اليومي')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * بيستقبل كل طلبات POST الجايه من fetch() في نسخة الـ HTML المستضافة
 * برّه Apps Script (زي GitHub). بيفرّق بين 3 حالات حسب "action":
 *   - updateDraft : تحديث التسجيل المشترك (أثناء التعبئة)
 *   - clearDraft  : تفريغ التسجيل المشترك (بعد الحفظ النهائي)
 *   - (من غيرها)  : سجل نهائي جاهز يتحفظ في الشيت
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'updateDraft') {
      PropertiesService.getScriptProperties().setProperty(DRAFT_KEY, JSON.stringify(body.draft || {}));
      return jsonResponse_({ success: true });
    }

    if (body.action === 'clearDraft') {
      PropertiesService.getScriptProperties().deleteProperty(DRAFT_KEY);
      return jsonResponse_({ success: true });
    }

    // مفيش action -> ده سجل نهائي، احفظه في الشيت
    const result = saveRecord(body);
    return jsonResponse_(result);

  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

/**
 * بتتنادى:
 *  - من doPost لما تيجي طلبات fetch من نسخة GitHub، أو
 *  - مباشرة عن طريق google.script.run لو الفورم شغال من جوه Apps Script نفسه.
 * data = object فيه كل قيم الحقول
 */
function saveRecord(data) {
  const sheet = getOrCreateSheet_();

  const row = [
    new Date(), // وقت التسجيل الفعلي في السيرفر - دليل إنه اتسجل صح
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
    data.faultCode || '',
    data.endTime || '',
    data.actualMinutes || '',
    data.receiveNotes || '',
    data.receiveTime || '',
    data.totalDowntime || '',
  ];

  sheet.appendRow(row);

  return { success: true, rowNumber: sheet.getLastRow() };
}

/**
 * بيرجع قائمة بالأقسام/الماكينات المحفوظة قبل كده، عشان تظهر
 * كاقتراحات في الفورم (اختياري - يسهل التعبئة بعد أول استخدامات)
 */
function getSuggestions() {
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
  }
  ensureHeaders_(sheet);
  return sheet;
}

/**
 * بتتأكد إن صف العناوين (Row 1) مطابق لـ HEADERS بالظبط في كل مرة —
 * لو حد عدّل عمود يدوي في الشيت، أو الأعمدة اتلخبطت لأي سبب، الكود
 * بيصلّحها لوحده تلقائيًا قبل ما يكتب أي صف جديد. كده العناوين والبيانات
 * مينفصلوش عن بعض تاني حتى لو حد غيّر حاجة يدوي في الشيت بالغلط.
 */
function ensureHeaders_(sheet) {
  const range = sheet.getRange(1, 1, 1, HEADERS.length);
  const current = range.getValues()[0];

  let matches = true;
  for (let i = 0; i < HEADERS.length; i++) {
    if (current[i] !== HEADERS[i]) { matches = false; break; }
  }

  if (!matches) {
    range.setValues([HEADERS]);
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/**
 * تجميعة صغيرة لإرجاع رد JSON بالشكل اللي fetch() في الـ HTML بيستناه.
 */
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
