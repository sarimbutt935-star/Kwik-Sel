/* ==========================================================================
   KwikSel — Data layer
   Single source of truth in localStorage under STORAGE_KEY.
   ========================================================================== */

const STORAGE_KEY = 'kwiksel_data';
const APP_VERSION = '1.0.0';

const STATUSES = ['New', 'Replied', 'Interested', 'Follow-up', 'Won', 'Lost'];

const STATUS_META = {
  'New':        { color: 'var(--info)',     light: 'var(--info-light)' },
  'Replied':    { color: 'var(--primary)',  light: 'var(--primary-light)' },
  'Interested': { color: 'var(--purple)',   light: 'var(--purple-light)' },
  'Follow-up':  { color: 'var(--warning-strong)', light: 'var(--warning-light)' },
  'Won':        { color: 'var(--success)',  light: 'var(--success-light)' },
  'Lost':       { color: 'var(--danger-strong)',  light: 'var(--danger-light)' },
};

const SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in', 'Other'];

const TEMPLATE_CATEGORIES = [
  { id: 'welcome',     label: 'Welcome / First reply' },
  { id: 'price',       label: 'Price inquiry' },
  { id: 'thinking',    label: "I'll let you know" },
  { id: 'followup',    label: 'Follow-up after no response' },
  { id: 'payment',     label: 'Payment reminder' },
  { id: 'unavailable', label: 'Out of stock / unavailable' },
  { id: 'order',       label: 'Order confirmation' },
  { id: 'delivery',    label: 'Delivery update' },
  { id: 'other',       label: 'Other' },
];

function categoryLabel(id) {
  const c = TEMPLATE_CATEGORIES.find(c => c.id === id);
  return c ? c.label : 'Other';
}

/* ---- date helpers used only for seeding (kept local to this file) ---- */
function _addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function _dateStr(d) { return d.toISOString().slice(0, 10); }
function _isoStr(d) { return d.toISOString(); }

function seedLeads() {
  const now = new Date();
  const mk = (overrides) => Object.assign({
    id: uid(),
    name: '', phone: '', business: '', productService: '',
    value: 0, source: 'WhatsApp', notes: '', status: 'New',
    createdAt: _isoStr(now), nextFollowUp: null,
  }, overrides);

  return [
    mk({
      name: 'Ayesha Khan', phone: '0301-2345678', business: 'Home use',
      productService: 'Lawn 3-piece suit (unstitched)', value: 4500, source: 'Instagram',
      notes: 'Asked for size M, wants pastel colors.', status: 'New',
      createdAt: _isoStr(now), nextFollowUp: null,
    }),
    mk({
      name: 'Bilal Ahmed', phone: '+92 322 1122334', business: 'Ahmed Boutique',
      productService: 'Chiffon dupatta set', value: 8000, source: 'WhatsApp',
      notes: 'Wants bulk order for shop, 10 pieces.', status: 'Replied',
      createdAt: _isoStr(_addDays(now, -1)), nextFollowUp: _dateStr(_addDays(now, 1)),
    }),
    mk({
      name: 'Fatima Noor', phone: '0333-4455667', business: 'Home use',
      productService: 'Bridal formal wear', value: 12000, source: 'Facebook',
      notes: 'Needs delivery before 20th for a wedding.', status: 'Interested',
      createdAt: _isoStr(_addDays(now, -2)), nextFollowUp: _dateStr(now),
    }),
    mk({
      name: 'Hamza Raza', phone: '+923014567890', business: 'Raza Garments',
      productService: 'Men\'s kurta shalwar', value: 6500, source: 'Referral',
      notes: 'Was interested last week, went quiet after price share.', status: 'Follow-up',
      createdAt: _isoStr(_addDays(now, -6)), nextFollowUp: _dateStr(_addDays(now, -3)),
    }),
    mk({
      name: 'Sana Malik', phone: '0345-9988776', business: 'Home use',
      productService: 'Stitched 2pc lawn', value: 3200, source: 'WhatsApp',
      notes: 'Asked about cash on delivery availability.', status: 'Follow-up',
      createdAt: _isoStr(_addDays(now, -4)), nextFollowUp: _dateStr(_addDays(now, -1)),
    }),
    mk({
      name: 'Usman Tariq', phone: '0300-1234567', business: 'Tariq Traders',
      productService: 'Winter shawls (bulk)', value: 15000, source: 'Referral',
      notes: 'Paid advance, order dispatched.', status: 'Won',
      createdAt: _isoStr(_addDays(now, -8)), nextFollowUp: null,
    }),
    mk({
      name: 'Zara Sheikh', phone: '0312-7766554', business: 'Home use',
      productService: 'Embroidered kurti', value: 0, source: 'Instagram',
      notes: 'Found cheaper price elsewhere, went with competitor.', status: 'Lost',
      createdAt: _isoStr(_addDays(now, -9)), nextFollowUp: null,
    }),
    mk({
      name: 'Ali Hassan', phone: '+92 345 1239876', business: 'Home use',
      productService: 'Casual shirts (3 pcs)', value: 5400, source: 'Walk-in',
      notes: '', status: 'New',
      createdAt: _isoStr(_addDays(now, -2)), nextFollowUp: null,
    }),
    mk({
      name: 'Mahnoor Iqbal', phone: '0321-5566778', business: 'Home use',
      productService: 'Party wear maxi', value: 9000, source: 'Facebook',
      notes: 'Comparing colors, will confirm size after trying similar dress.', status: 'Interested',
      createdAt: _isoStr(_addDays(now, -3)), nextFollowUp: _dateStr(_addDays(now, 3)),
    }),
    mk({
      name: 'Kashif Javed', phone: '0300-8877665', business: 'Javed Fabrics',
      productService: 'Cotton fabric (10 meters)', value: 5000, source: 'WhatsApp',
      notes: 'Regular customer, reorders monthly.', status: 'Follow-up',
      createdAt: _isoStr(_addDays(now, -5)), nextFollowUp: _dateStr(now),
    }),
    mk({
      name: 'Rimsha Aslam', phone: '+92 333 2211009', business: 'Home use',
      productService: 'Abaya with hijab set', value: 7000, source: 'Instagram',
      notes: 'Sent measurements, waiting for confirmation.', status: 'Replied',
      createdAt: _isoStr(_addDays(now, -1)), nextFollowUp: _dateStr(_addDays(now, 5)),
    }),
    mk({
      name: 'Noman Sheikh', phone: '0303-4433221', business: 'Sheikh & Sons',
      productService: 'School uniforms (bulk, 40 pcs)', value: 22000, source: 'Referral',
      notes: 'Delivered on time, very happy customer.', status: 'Won',
      createdAt: _isoStr(_addDays(now, -12)), nextFollowUp: null,
    }),
  ];
}

function seedTemplates() {
  const mk = (overrides) => Object.assign({
    id: uid(), title: '', category: 'other', language: 'en', body: '', isFavorite: false,
  }, overrides);

  return [
    mk({ title: 'Warm welcome', category: 'welcome', language: 'en', isFavorite: true,
      body: 'Assalam-o-Alaikum {{name}}! Thanks for reaching out to {{business_name}} 😊 How can we help you today?' }),
    mk({ title: 'Khush aamdeed', category: 'welcome', language: 'ur', isFavorite: true,
      body: 'Ji {{name}} bhai/baji, {{business_name}} mein khush aamdeed! Aap kis product ke baare mein poochna chahtay hain?' }),

    mk({ title: 'Price sharing', category: 'price', language: 'en', isFavorite: true,
      body: 'The price for {{product}} is Rs. {{price}}. Free delivery is available across Pakistan! Would you like to place an order?' }),
    mk({ title: 'Price batana', category: 'price', language: 'ur',
      body: '{{product}} ki price Rs. {{price}} hai. Pura Pakistan mein delivery available hai. Order confirm karwa dein?' }),

    mk({ title: 'Take your time', category: 'thinking', language: 'en',
      body: "No problem {{name}}! Take your time. Feel free to message us whenever you're ready 🙂" }),
    mk({ title: 'Soch lein araam se', category: 'thinking', language: 'ur',
      body: 'Koi masla nahi {{name}}! Aap araam se soch lein, jab bhi ready hon message kar dein.' }),

    mk({ title: 'Gentle nudge', category: 'followup', language: 'en', isFavorite: true,
      body: 'Hi {{name}}, just checking in about {{product}}. Still interested? Let us know if you have any questions!' }),
    mk({ title: 'Yaad dahani', category: 'followup', language: 'ur',
      body: '{{name}} bhai, {{product}} ke baare mein pooch raha tha, abhi tak interested hain kya? Koi sawal ho to zaroor batayein.' }),

    mk({ title: 'Payment pending', category: 'payment', language: 'en',
      body: 'Hi {{name}}, this is a reminder that payment of Rs. {{price}} is pending for your order. Please confirm once done, jazakAllah!' }),
    mk({ title: 'Payment ki yaad dahani', category: 'payment', language: 'ur',
      body: '{{name}} ji, aapka Rs. {{price}} ka payment abhi pending hai. Please jaldi confirm kar dein, shukriya!' }),

    mk({ title: 'Currently unavailable', category: 'unavailable', language: 'en',
      body: "Sorry {{name}}, {{product}} is currently out of stock. We'll notify you as soon as it's back!" }),
    mk({ title: 'Stock khatam', category: 'unavailable', language: 'ur',
      body: '{{name}} bhai/baji, {{product}} abhi stock mein nahi hai. Jaisay hi aayega hum aapko sabse pehle batayein gay.' }),

    mk({ title: 'Order confirmed', category: 'order', language: 'en', isFavorite: true,
      body: 'Great news {{name}}! Your order for {{product}} (Rs. {{price}}) has been confirmed. Thank you for shopping with {{business_name}}!' }),
    mk({ title: 'Order confirm ho gaya', category: 'order', language: 'ur',
      body: '{{name}} ji, aapka order {{product}} (Rs. {{price}}) confirm ho gaya hai. {{business_name}} ki taraf se shukriya!' }),

    mk({ title: 'On its way', category: 'delivery', language: 'en',
      body: 'Hi {{name}}, your order is on its way and should arrive within 2-3 working days. Thanks for your patience!' }),
    mk({ title: 'Rasta mein hai', category: 'delivery', language: 'ur',
      body: '{{name}} bhai, aapka order rasta mein hai, 2-3 working days mein pohnch jayega. Sabar ka shukriya!' }),
  ];
}

function defaultData() {
  return {
    business: { name: 'StyleCart PK', defaultLanguage: 'en' },
    leads: seedLeads(),
    templates: seedTemplates(),
    settings: { theme: 'system' },
  };
}

function isValidDataShape(d) {
  return d && typeof d === 'object'
    && d.business && typeof d.business === 'object'
    && Array.isArray(d.leads)
    && Array.isArray(d.templates)
    && d.settings && typeof d.settings === 'object';
}

function loadData() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('KwikSel: localStorage unavailable, using in-memory data.', e);
    return defaultData();
  }
  if (!raw) {
    const fresh = defaultData();
    saveData(fresh);
    return fresh;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isValidDataShape(parsed)) throw new Error('Unexpected data shape');
    // Backfill defensive defaults in case of partial/older data.
    parsed.business.name = parsed.business.name || '';
    parsed.business.defaultLanguage = parsed.business.defaultLanguage || 'en';
    parsed.settings.theme = parsed.settings.theme || 'system';
    parsed.leads = parsed.leads.filter(l => l && typeof l === 'object' && l.id);
    parsed.templates = parsed.templates.filter(t => t && typeof t === 'object' && t.id);
    return parsed;
  } catch (e) {
    console.warn('KwikSel: stored data was corrupt, resetting to defaults.', e);
    const fresh = defaultData();
    saveData(fresh);
    return fresh;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('KwikSel: failed to save data.', e);
    return false;
  }
}
