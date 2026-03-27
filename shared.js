window.TIER_ORDER = ['-','Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster','Champion'];
window.ROLE_KEYS = [
  { key: 'tank', label: '탱커' },
  { key: 'dps', label: '딜러' },
  { key: 'support', label: '힐러' }
];

function slugTier(tier) {
  const map = {
    '-': 'unrated',
    'Bronze': 'bronze',
    'Silver': 'silver',
    'Gold': 'gold',
    'Platinum': 'platinum',
    'Diamond': 'diamond',
    'Master': 'master',
    'Grandmaster': 'grandmaster',
    'Champion': 'champion'
  };
  return map[tier] || 'unrated';
}

function roleBadge(roleLabel, tier) {
  return `
    <span class="badge role">${escapeHtml(roleLabel)}</span>
    <span class="badge ${slugTier(tier)}">${escapeHtml(tier || '-')}</span>
  `;
}

function tierBadge(tier) {
  return `<span class="badge ${slugTier(tier)}">${escapeHtml(tier || '-')}</span>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeName(value = '') {
  return value.trim().toLowerCase();
}

function compareTier(a, b) {
  return window.TIER_ORDER.indexOf(b) - window.TIER_ORDER.indexOf(a);
}

function sortByNameThenTier(items, roleKey) {
  return [...items].sort((a, b) => {
    const tierGap = compareTier(a[roleKey], b[roleKey]);
    if (tierGap !== 0) return tierGap;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
}

function setStatus(el, message, type = 'notice') {
  if (!el) return;
  if (!message) {
    el.className = 'hidden';
    el.innerHTML = '';
    return;
  }
  el.className = type;
  el.textContent = message;
}

function requireSupabaseConfig() {
  const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY;
  return Boolean(configured);
}

function createSupabaseClient() {
  if (!requireSupabaseConfig()) return null;
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

function getAdminFunctionUrl() {
  if (window.SUPABASE_FUNCTION_URL) return window.SUPABASE_FUNCTION_URL;
  if (!window.SUPABASE_URL) return '';
  return `${window.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/admin-streamers`;
}

function storageKey(name) {
  return `ow_soop_${name}`;
}

function loadLocal(name, fallback) {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(name, data) {
  localStorage.setItem(storageKey(name), JSON.stringify(data));
}

function uniqueById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}
