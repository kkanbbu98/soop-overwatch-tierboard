(() => {
  const configNotice = document.getElementById('configNotice');
  const statusBox = document.getElementById('statusBox');
  const totalCount = document.getElementById('totalCount');
  const filteredCount = document.getElementById('filteredCount');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const cardList = document.getElementById('cardList');
  const tableBody = document.getElementById('tableBody');

  const form = document.getElementById('streamerForm');
  const nameInput = document.getElementById('nameInput');
  const tankTier = document.getElementById('tankTier');
  const dpsTier = document.getElementById('dpsTier');
  const supportTier = document.getElementById('supportTier');
  const noteInput = document.getElementById('noteInput');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const selectedBox = document.getElementById('selectedBox');
  const editBtn = document.getElementById('editBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  const authBtn = document.getElementById('authBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authModal = document.getElementById('authModal');
  const authPassword = document.getElementById('authPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authCloseBtn = document.getElementById('authCloseBtn');
  const authStatus = document.getElementById('authStatus');

  const state = {
    supabase: null,
    streamers: [],
    search: '',
    selectedId: null,
    editId: null,
    isAdmin: false,
    adminPassword: ''
  };

  function populateTierSelect(select) {
    select.innerHTML = window.TIER_ORDER.map(tier => `<option value="${tier}">${tier}</option>`).join('');
  }

  [tankTier, dpsTier, supportTier].forEach(populateTierSelect);

  function filteredStreamers() {
    const q = normalizeName(state.search);
    if (!q) return [...state.streamers];
    return state.streamers.filter(item => normalizeName(item.name).includes(q));
  }

  function renderSelectedBox() {
    const item = state.streamers.find(x => x.id === state.selectedId);
    if (!item) {
      selectedBox.className = 'notice';
      selectedBox.textContent = '선택된 스트리머가 없습니다.';
      return;
    }
    selectedBox.className = 'notice';
    selectedBox.innerHTML = `
      <div class="kv"><div>이름</div><div>${escapeHtml(item.name)}</div></div>
      <div class="kv"><div>탱커</div><div>${escapeHtml(item.tank_tier)}</div></div>
      <div class="kv"><div>딜러</div><div>${escapeHtml(item.dps_tier)}</div></div>
      <div class="kv"><div>힐러</div><div>${escapeHtml(item.support_tier)}</div></div>
      <div class="kv"><div>비고</div><div>${escapeHtml(item.note || '-')}</div></div>
    `;
  }

  function render() {
    const list = filteredStreamers();
    totalCount.textContent = state.streamers.length;
    filteredCount.textContent = list.length;

    cardList.innerHTML = list.map(item => `
      <article class="card ${state.selectedId === item.id ? 'selected' : ''}" data-id="${item.id}">
        <div class="card-head">
          <h3>${escapeHtml(item.name)}</h3>
          ${tierBadge(item.tank_tier)}
        </div>
        <div class="tier-row">${roleBadge('탱커', item.tank_tier)}</div>
        <div class="tier-row">${roleBadge('딜러', item.dps_tier)}</div>
        <div class="tier-row">${roleBadge('힐러', item.support_tier)}</div>
        <div class="small muted">${escapeHtml(item.note || '비고 없음')}</div>
      </article>
    `).join('');

    tableBody.innerHTML = list.map(item => `
      <tr data-id="${item.id}" class="${state.selectedId === item.id ? 'selected' : ''}">
        <td>${escapeHtml(item.name)}</td>
        <td>${tierBadge(item.tank_tier)}</td>
        <td>${tierBadge(item.dps_tier)}</td>
        <td>${tierBadge(item.support_tier)}</td>
        <td>${escapeHtml(item.note || '-')}</td>
      </tr>
    `).join('');

    renderSelectedBox();
    renderAdminState();
  }

  function renderAdminState() {
    const disabled = !state.isAdmin;
    [nameInput, tankTier, dpsTier, supportTier, noteInput, saveBtn, resetBtn, editBtn, deleteBtn].forEach(el => {
      el.disabled = disabled;
    });
    authBtn.textContent = state.isAdmin ? '관리 잠금 해제됨' : '관리 잠금 해제';
    logoutBtn.classList.toggle('hidden', !state.isAdmin);
  }

  function fillForm(item) {
    state.editId = item?.id || null;
    nameInput.value = item?.name || '';
    tankTier.value = item?.tank_tier || '-';
    dpsTier.value = item?.dps_tier || '-';
    supportTier.value = item?.support_tier || '-';
    noteInput.value = item?.note || '';
    saveBtn.textContent = state.editId ? '수정 저장' : '등록하기';
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
    render();
  }

  async function callAdminFunction(action, payload = {}) {
    const url = getAdminFunctionUrl();
    if (!url) {
      return { ok: false, message: 'admin-streamers 함수 URL을 찾을 수 없습니다.' };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({
          action,
          password: payload.password ?? state.adminPassword,
          ...payload
        })
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, message: json?.error || `요청 실패 (${response.status})` };
      }
      return { ok: true, data: json };
    } catch (error) {
      return { ok: false, message: error.message || '네트워크 오류가 발생했습니다.' };
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!state.isAdmin) {
      openAuthModal();
      return;
    }

    const streamer = {
      name: nameInput.value.trim(),
      tank_tier: tankTier.value,
      dps_tier: dpsTier.value,
      support_tier: supportTier.value,
      note: noteInput.value.trim()
    };

    if (!streamer.name) {
      setStatus(statusBox, '스트리머명을 입력해 주세요.', 'error');
      return;
    }

    const result = state.editId
      ? await callAdminFunction('update', { id: state.editId, streamer })
      : await callAdminFunction('insert', { streamer });

    if (!result.ok) {
      if (/비밀번호|password/i.test(result.message || '')) {
        state.isAdmin = false;
        state.adminPassword = '';
        renderAdminState();
      }
      setStatus(statusBox, `저장 실패: ${result.message}`, 'error');
      return;
    }

    setStatus(statusBox, state.editId ? '수정되었습니다.' : '등록되었습니다.', 'notice');
    fillForm(null);
    await loadStreamers();
  }

  async function handleDelete() {
    if (!state.isAdmin) {
      openAuthModal();
      return;
    }
    const item = state.streamers.find(x => x.id === state.selectedId);
    if (!item) {
      setStatus(statusBox, '삭제할 스트리머를 먼저 선택해 주세요.', 'error');
      return;
    }
    if (!confirm(`${item.name} 항목을 삭제할까요?`)) return;

    const result = await callAdminFunction('delete', { id: item.id });
    if (!result.ok) {
      if (/비밀번호|password/i.test(result.message || '')) {
        state.isAdmin = false;
        state.adminPassword = '';
        renderAdminState();
      }
      setStatus(statusBox, `삭제 실패: ${result.message}`, 'error');
      return;
    }
    state.selectedId = null;
    fillForm(null);
    setStatus(statusBox, '삭제되었습니다.', 'notice');
    await loadStreamers();
  }

  function bindSelectionHandlers() {
    cardList.addEventListener('click', (e) => {
      const card = e.target.closest('[data-id]');
      if (!card) return;
      state.selectedId = card.dataset.id;
      render();
    });

    tableBody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      state.selectedId = tr.dataset.id;
      render();
    });
  }

  function openAuthModal() {
    authModal.classList.remove('hidden');
    authPassword.value = '';
    authPassword.type = 'password';
    togglePasswordBtn.textContent = '보기';
    setStatus(authStatus, '');
    authPassword.focus();
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
    authPassword.value = '';
    authPassword.type = 'password';
    togglePasswordBtn.textContent = '보기';
  }

  async function unlockAdmin() {
    const password = authPassword.value;
    if (!password) {
      setStatus(authStatus, '비밀번호를 입력해 주세요.', 'error');
      return;
    }

    setStatus(authStatus, '권한 확인 중...', 'notice');
    const result = await callAdminFunction('verify', { password });
    if (!result.ok) {
      setStatus(authStatus, `잠금 해제 실패: ${result.message}`, 'error');
      return;
    }

    state.isAdmin = true;
    state.adminPassword = password;
    renderAdminState();
    closeAuthModal();
    setStatus(statusBox, '관리 권한이 이 탭에서 활성화되었습니다.', 'notice');
  }

  function lockAdmin() {
    state.isAdmin = false;
    state.adminPassword = '';
    renderAdminState();
    fillForm(null);
    setStatus(statusBox, '관리 권한을 다시 잠갔습니다.', 'notice');
  }

  async function init() {
    if (!requireSupabaseConfig()) {
      configNotice.className = 'error';
      configNotice.textContent = 'supabase-config.js에 SUPABASE_URL과 SUPABASE_ANON_KEY를 먼저 입력해 주세요.';
      return;
    }

    state.supabase = createSupabaseClient();
    renderAdminState();
    await loadStreamers();
  }

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    state.search = '';
    searchInput.value = '';
    render();
  });

  refreshBtn.addEventListener('click', loadStreamers);
  form.addEventListener('submit', handleSave);
  resetBtn.addEventListener('click', () => fillForm(null));

  editBtn.addEventListener('click', () => {
    if (!state.isAdmin) {
      openAuthModal();
      return;
    }
    const item = state.streamers.find(x => x.id === state.selectedId);
    if (!item) {
      setStatus(statusBox, '불러올 스트리머를 먼저 선택해 주세요.', 'error');
      return;
    }
    fillForm(item);
  });

  deleteBtn.addEventListener('click', handleDelete);
  authBtn.addEventListener('click', openAuthModal);
  authCloseBtn.addEventListener('click', closeAuthModal);
  authSubmitBtn.addEventListener('click', unlockAdmin);
  logoutBtn.addEventListener('click', lockAdmin);
  togglePasswordBtn.addEventListener('click', () => {
    authPassword.type = authPassword.type === 'password' ? 'text' : 'password';
    togglePasswordBtn.textContent = authPassword.type === 'password' ? '보기' : '숨기기';
    authPassword.focus();
  });

  authPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockAdmin();
    if (e.key === 'Escape') closeAuthModal();
  });

  bindSelectionHandlers();
  fillForm(null);
  init();
})();
