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

  function renderDivisionItems(items) {
    if (!items.length) return '<div class="muted small">등록 없음</div>';
    return items.map(item => `
      <div class="list-item compact">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="small muted" style="margin-top:6px;">${escapeHtml(item.note || '비고 없음')}</div>
      </div>
    `).join('');
  }

  function renderBoard() {
    const list = filtered();
    const baseTiers = [...window.BASE_TIERS].reverse();

    tierBoard.innerHTML = baseTiers.map(base => {
      const divisions = [1, 2, 3, 4, 5].map(div => {
        const exactTier = `${base} ${div}`;
        const items = list.filter(x => (x[`${state.role}_tier`] || '-') === exactTier);
        return `
          <div class="division-card ${slugTier(exactTier)}">
            <div class="division-head">
              <span class="badge ${slugTier(exactTier)}">${escapeHtml(exactTier)}</span>
              <span class="muted small">${items.length}명</span>
            </div>
            <div class="list compact-list">${renderDivisionItems(items)}</div>
          </div>
        `;
      }).join('');

      return `
        <section class="rank-section ${slugTier(base)}">
          <div class="rank-section-head">
            <h4>${escapeHtml(base)}</h4>
            <span class="muted small">1이 가장 높고 5가 가장 낮습니다.</span>
          </div>
          <div class="division-grid">
            ${divisions}
          </div>
        </section>
      `;
    }).join('') + renderUnrated(list);
  }

  function renderUnrated(list) {
    const items = list.filter(x => (x[`${state.role}_tier`] || '-') === '-');
    return `
      <section class="rank-section unrated-block">
        <div class="rank-section-head">
          <h4>측정 안 됨 (-)</h4>
          <span class="muted small">${items.length}명</span>
        </div>
        <div class="list compact-list">${renderDivisionItems(items)}</div>
      </section>
    `;
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
