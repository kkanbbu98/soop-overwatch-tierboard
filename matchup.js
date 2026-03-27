(() => {
  const configNotice = document.getElementById('configNotice');
  const statusBox = document.getElementById('statusBox');
  const streamerCount = document.getElementById('streamerCount');
  const pairCount = document.getElementById('pairCount');

  const rivalAInput = document.getElementById('rivalAInput');
  const rivalBInput = document.getElementById('rivalBInput');
  const rivalASuggest = document.getElementById('rivalASuggest');
  const rivalBSuggest = document.getElementById('rivalBSuggest');
  const savePairBtn = document.getElementById('savePairBtn');
  const clearPairsBtn = document.getElementById('clearPairsBtn');
  const pairList = document.getElementById('pairList');

  const size5Btn = document.getElementById('size5Btn');
  const size6Btn = document.getElementById('size6Btn');
  const resetTeamsBtn = document.getElementById('resetTeamsBtn');
  const teamACount = document.getElementById('teamACount');
  const teamBCount = document.getElementById('teamBCount');
  const teamAList = document.getElementById('teamAList');
  const teamBList = document.getElementById('teamBList');

  const state = {
    supabase: null,
    streamers: [],
    rivals: loadLocal('rivals', []),
    teams: loadLocal('teams', { size: 5, a: [], b: [], autoLinks: {} }),
    picks: { a: null, b: null },
    pendingScrollPairKey: null
  };

  function ensureTeamShape() {
    state.teams = {
      size: state.teams?.size || 5,
      a: Array.isArray(state.teams?.a) ? state.teams.a : [],
      b: Array.isArray(state.teams?.b) ? state.teams.b : [],
      autoLinks: state.teams?.autoLinks || {}
    };
  }

  ensureTeamShape();

  function getStreamer(id) {
    return state.streamers.find(x => x.id === id);
  }

  function searchStreamers(term, excludeIds = []) {
    const q = normalizeName(term);
    if (!q) return [];
    return state.streamers
      .filter(item => normalizeName(item.name).includes(q) && !excludeIds.includes(item.id))
      .slice(0, 8);
  }

  function rivalFor(id) {
    const pair = state.rivals.find(([a, b]) => a === id || b === id);
    if (!pair) return null;
    return pair[0] === id ? pair[1] : pair[0];
  }

  function pairKey(a, b) {
    return `${a}__${b}`;
  }

  function renderSuggest(box, items, onPick) {
    if (!items.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = items.map(item => `
      <div class="suggest-item" data-id="${item.id}">${escapeHtml(item.name)}</div>
    `).join('');
    box.onclick = (e) => {
      const target = e.target.closest('[data-id]');
      if (!target) return;
      onPick(target.dataset.id);
    };
  }

  function selectRivalSide(side, id) {
    state.picks[side] = id;
    const streamer = getStreamer(id);
    if (side === 'a') {
      rivalAInput.value = streamer?.name || '';
      renderSuggest(rivalASuggest, [], () => {});
    } else {
      rivalBInput.value = streamer?.name || '';
      renderSuggest(rivalBSuggest, [], () => {});
    }
  }

  function canAdd(team) {
    return state.teams[team].length < state.teams.size;
  }

  function teamOf(id) {
    if (state.teams.a.includes(id)) return 'a';
    if (state.teams.b.includes(id)) return 'b';
    return null;
  }

  function pairStatus(a, b) {
    const leftTeam = teamOf(a);
    const rightTeam = teamOf(b);
    if (leftTeam === 'a' && rightTeam === 'b') {
      return { mode: 'left-a', text: '배치됨 · 왼쪽 A팀 / 오른쪽 B팀', className: 'left-a' };
    }
    if (leftTeam === 'b' && rightTeam === 'a') {
      return { mode: 'right-a', text: '배치됨 · 오른쪽 A팀 / 왼쪽 B팀', className: 'right-a' };
    }
    if (leftTeam || rightTeam) {
      return { mode: 'partial', text: '부분 배치됨', className: 'partial' };
    }
    return { mode: 'idle', text: '미배치', className: 'idle' };
  }

  function renderPairs() {
    pairCount.textContent = state.rivals.length;
    if (!state.rivals.length) {
      pairList.innerHTML = '<div class="muted small">저장된 맞상대가 없습니다.</div>';
      return;
    }

    pairList.innerHTML = state.rivals.map(([a, b], idx) => {
      const left = getStreamer(a);
      const right = getStreamer(b);
      const status = pairStatus(a, b);
      const canAssign = status.mode === 'idle' && canAdd('a') && canAdd('b');
      const key = pairKey(a, b);

      return `
        <div class="pair-card ${status.className}" data-pair-key="${key}">
          <div class="pair-card-head">
            <div>
              <strong>${escapeHtml(left?.name || '삭제된 항목')}</strong>
              <span class="small muted"> ↔ </span>
              <strong>${escapeHtml(right?.name || '삭제된 항목')}</strong>
            </div>
            <span class="badge pair-status ${status.className}">${escapeHtml(status.text)}</span>
          </div>

          <div class="pair-members">
            <div class="pair-member left">
              <div class="small muted">왼쪽</div>
              <div class="pair-name">${escapeHtml(left?.name || '삭제된 항목')}</div>
              <div class="chipline" style="margin-top:8px;">
                ${tierBadge(left?.tank_tier || '-')}
                ${tierBadge(left?.dps_tier || '-')}
                ${tierBadge(left?.support_tier || '-')}
              </div>
            </div>
            <div class="pair-member right">
              <div class="small muted">오른쪽</div>
              <div class="pair-name">${escapeHtml(right?.name || '삭제된 항목')}</div>
              <div class="chipline" style="margin-top:8px;">
                ${tierBadge(right?.tank_tier || '-')}
                ${tierBadge(right?.dps_tier || '-')}
                ${tierBadge(right?.support_tier || '-')}
              </div>
            </div>
          </div>

          <div class="controls" style="margin-top:12px;">
            <button type="button" class="success" data-assign-pair="left" data-a="${a}" data-b="${b}" ${canAssign ? '' : 'disabled'}>왼쪽을 A팀</button>
            <button type="button" class="secondary" data-assign-pair="right" data-a="${a}" data-b="${b}" ${canAssign ? '' : 'disabled'}>오른쪽을 A팀</button>
            <button type="button" class="danger" data-delete-pair="${idx}">삭제</button>
          </div>
        </div>
      `;
    }).join('');

    if (state.pendingScrollPairKey) {
      requestAnimationFrame(() => scrollToPairCard(state.pendingScrollPairKey));
      state.pendingScrollPairKey = null;
    }
  }

  function renderTeams() {
    streamerCount.textContent = state.streamers.length;
    teamACount.textContent = `${state.teams.a.length} / ${state.teams.size}`;
    teamBCount.textContent = `${state.teams.b.length} / ${state.teams.size}`;
    size5Btn.classList.toggle('success', state.teams.size === 5);
    size6Btn.classList.toggle('success', state.teams.size === 6);

    teamAList.innerHTML = state.teams.a.length ? state.teams.a.map(id => renderTeamItem(id, 'a')).join('') : '<div class="muted small">비어 있음</div>';
    teamBList.innerHTML = state.teams.b.length ? state.teams.b.map(id => renderTeamItem(id, 'b')).join('') : '<div class="muted small">비어 있음</div>';

    saveLocal('teams', state.teams);
    saveLocal('rivals', state.rivals);
  }

  function renderTeamItem(id, team) {
    const item = getStreamer(id);
    const rivalId = rivalFor(id);
    const rival = rivalId ? getStreamer(rivalId) : null;
    const teamName = team === 'a' ? 'A팀' : 'B팀';
    return `
      <div class="list-item team-item" data-team-item="${id}">
        <strong>${escapeHtml(item?.name || '삭제된 항목')}</strong>
        <div class="small muted" style="margin-top:6px;">
          탱 ${escapeHtml(item?.tank_tier || '-')} · 딜 ${escapeHtml(item?.dps_tier || '-')} · 힐 ${escapeHtml(item?.support_tier || '-')}
        </div>
        <div class="small muted" style="margin-top:6px;">현재 팀: ${teamName} · 맞상대: ${rival ? escapeHtml(rival.name) : '미지정'}</div>
        <div class="controls" style="margin-top:10px;">
          <button type="button" class="danger" data-remove-team="${team}" data-id="${id}">제거</button>
        </div>
      </div>
    `;
  }

  function addPairToTeams(a, b, orientation) {
    const leftTeam = teamOf(a);
    const rightTeam = teamOf(b);
    if (leftTeam || rightTeam) {
      setStatus(statusBox, '이미 팀에 배치된 맞상대입니다. 먼저 기존 팀에서 제거해 주세요.', 'error');
      return;
    }
    if (!canAdd('a') || !canAdd('b')) {
      setStatus(statusBox, 'A팀 또는 B팀 정원이 가득 찼습니다.', 'error');
      return;
    }

    const aTeamId = orientation === 'left' ? a : b;
    const bTeamId = orientation === 'left' ? b : a;

    state.teams.a.push(aTeamId);
    state.teams.b.push(bTeamId);
    state.teams.autoLinks[aTeamId] = bTeamId;
    state.teams.autoLinks[bTeamId] = aTeamId;

    renderTeams();
    renderPairs();
    setStatus(statusBox, orientation === 'left' ? '왼쪽을 A팀으로 배치했습니다.' : '오른쪽을 A팀으로 배치했습니다.', 'notice');
  }

  function scrollToPairCard(key) {
    const card = document.querySelector(`[data-pair-key="${key}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash-focus');
    setTimeout(() => card.classList.remove('flash-focus'), 1500);
  }

  function removeFromTeam(team, id) {
    const rivalId = rivalFor(id);
    const linked = state.teams.autoLinks[id] || rivalId;
    const pairA = team === 'a' ? id : linked;
    const pairB = team === 'a' ? linked : id;
    if (pairA && pairB) {
      state.pendingScrollPairKey = pairKey(pairA, pairB);
    } else if (rivalId) {
      const pair = state.rivals.find(([a, b]) => a === id || b === id);
      if (pair) state.pendingScrollPairKey = pairKey(pair[0], pair[1]);
    }

    state.teams.a = state.teams.a.filter(x => x !== id);
    state.teams.b = state.teams.b.filter(x => x !== id);

    if (linked) {
      state.teams.a = state.teams.a.filter(x => x !== linked);
      state.teams.b = state.teams.b.filter(x => x !== linked);
      delete state.teams.autoLinks[linked];
    }
    delete state.teams.autoLinks[id];

    renderTeams();
    renderPairs();
    setStatus(statusBox, '팀에서 제거되었습니다. 원래 맞상대 카드로 이동합니다.', 'notice');
  }

  function removePairAt(idx) {
    const pair = state.rivals[idx];
    if (!pair) return;
    const [a, b] = pair;
    if (teamOf(a) || teamOf(b)) {
      state.teams.a = state.teams.a.filter(x => x !== a && x !== b);
      state.teams.b = state.teams.b.filter(x => x !== a && x !== b);
      delete state.teams.autoLinks[a];
      delete state.teams.autoLinks[b];
    }
    state.rivals.splice(idx, 1);
    renderTeams();
    renderPairs();
    setStatus(statusBox, '맞상대가 삭제되었습니다.', 'notice');
  }

  async function loadStreamers() {
    if (!state.supabase) return;
    setStatus(statusBox, '공유 스트리머 데이터를 불러오는 중입니다...', 'notice');
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
    renderPairs();
    renderTeams();
  }

  function initSearchInputs() {
    rivalAInput.addEventListener('input', () => {
      state.picks.a = null;
      renderSuggest(rivalASuggest, searchStreamers(rivalAInput.value, state.picks.b ? [state.picks.b] : []), id => selectRivalSide('a', id));
    });

    rivalBInput.addEventListener('input', () => {
      state.picks.b = null;
      renderSuggest(rivalBSuggest, searchStreamers(rivalBInput.value, state.picks.a ? [state.picks.a] : []), id => selectRivalSide('b', id));
    });
  }

  function bindButtons() {
    savePairBtn.addEventListener('click', () => {
      const a = state.picks.a;
      const b = state.picks.b;
      if (!a || !b) {
        setStatus(statusBox, '양쪽 스트리머를 모두 선택해 주세요.', 'error');
        return;
      }
      if (a === b) {
        setStatus(statusBox, '같은 스트리머를 서로 연결할 수 없습니다.', 'error');
        return;
      }
      state.rivals = state.rivals.filter(([x, y]) => ![x, y].includes(a) && ![x, y].includes(b));
      state.rivals.push([a, b]);
      rivalAInput.value = '';
      rivalBInput.value = '';
      state.picks.a = null;
      state.picks.b = null;
      renderPairs();
      renderTeams();
      setStatus(statusBox, '맞상대가 저장되었습니다.', 'notice');
    });

    clearPairsBtn.addEventListener('click', () => {
      if (!confirm('개인 맞상대 전체를 삭제할까요? 팀 편성도 함께 초기화됩니다.')) return;
      state.rivals = [];
      state.teams = { size: state.teams.size, a: [], b: [], autoLinks: {} };
      renderPairs();
      renderTeams();
      setStatus(statusBox, '개인 맞상대와 팀 편성을 모두 초기화했습니다.', 'notice');
    });

    pairList.addEventListener('click', (e) => {
      const assignBtn = e.target.closest('[data-assign-pair]');
      if (assignBtn) {
        addPairToTeams(assignBtn.dataset.a, assignBtn.dataset.b, assignBtn.dataset.assignPair);
        return;
      }

      const deleteBtn = e.target.closest('[data-delete-pair]');
      if (deleteBtn) {
        removePairAt(Number(deleteBtn.dataset.deletePair));
      }
    });

    size5Btn.addEventListener('click', () => {
      state.teams = { size: 5, a: [], b: [], autoLinks: {} };
      renderTeams();
      renderPairs();
    });

    size6Btn.addEventListener('click', () => {
      state.teams = { size: 6, a: [], b: [], autoLinks: {} };
      renderTeams();
      renderPairs();
    });

    resetTeamsBtn.addEventListener('click', () => {
      if (!confirm('팀 편성을 초기화할까요?')) return;
      state.teams = { size: state.teams.size, a: [], b: [], autoLinks: {} };
      renderTeams();
      renderPairs();
    });

    teamAList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-team]');
      if (!btn) return;
      removeFromTeam('a', btn.dataset.id);
    });

    teamBList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-team]');
      if (!btn) return;
      removeFromTeam('b', btn.dataset.id);
    });
  }

  function init() {
    if (!requireSupabaseConfig()) {
      configNotice.className = 'error';
      configNotice.textContent = 'supabase-config.js에 SUPABASE_URL과 SUPABASE_ANON_KEY를 먼저 입력해 주세요.';
      return;
    }
    state.supabase = createSupabaseClient();
    initSearchInputs();
    bindButtons();
    loadStreamers();
    renderPairs();
    renderTeams();
  }

  init();
})();
