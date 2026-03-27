
(() => {
  const configNotice = document.getElementById('configNotice');
  const statusBox = document.getElementById('statusBox');
  const roleTabs = document.getElementById('roleTabs');
  const tierBoard = document.getElementById('tierBoard');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  const state = {
    supabase: null,
    streamers: [],
    role: 'tank',
    search: ''
  };

  function renderTabs() {
    roleTabs.innerHTML = window.ROLE_KEYS.map(role => `
      <button class="tab ${state.role === role.key ? 'active' : ''}" data-role="${role.key}" type="button">${role.label}</button>
    `).join('');
  }

  function filtered() {
    const q = normalizeName(state.search);
    const list = q
      ? state.streamers.filter(item => normalizeName(item.name).includes(q))
      : [...state.streamers];
    return sortByNameThenTier(list, state.role);
  }

  function renderBoard() {
    const list = filtered();
    const tiers = [...window.TIER_ORDER].reverse();
    tierBoard.innerHTML = tiers.map(tier => {
      const items = list.filter(x => (x[`${state.role}_tier`] || '-') === tier);
      return `
        <section class="tier-column">
          <h4>${escapeHtml(tier)} <span class="muted">(${items.length})</span></h4>
          <div class="list">
            ${items.length ? items.map(item => `
              <div class="list-item">
                <strong>${escapeHtml(item.name)}</strong>
                <div class="small muted" style="margin-top:6px;">${escapeHtml(item.note || '비고 없음')}</div>
              </div>
            `).join('') : '<div class="muted small">등록 없음</div>'}
          </div>
        </section>
      `;
    }).join('');
  }

  async function loadStreamers() {
    if (!state.supabase) return;
    setStatus(statusBox, '데이터를 불러오는 중입니다...', 'notice');
    const { data, error } = await state.supabase
      .from('streamers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setStatus(statusBox, `불러오기 실패: ${error.message}`, 'error');
      return;
    }
    state.streamers = data || [];
    setStatus(statusBox, '');
    renderTabs();
    renderBoard();
  }

  function init() {
    if (!requireSupabaseConfig()) {
      configNotice.className = 'error';
      configNotice.textContent = 'supabase-config.js에 SUPABASE_URL과 SUPABASE_ANON_KEY를 먼저 입력해 주세요.';
      return;
    }
    state.supabase = createSupabaseClient();
    loadStreamers();
  }

  roleTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-role]');
    if (!tab) return;
    state.role = tab.dataset.role;
    renderTabs();
    renderBoard();
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    renderBoard();
  });

  clearSearchBtn.addEventListener('click', () => {
    state.search = '';
    searchInput.value = '';
    renderBoard();
  });

  init();
})();
