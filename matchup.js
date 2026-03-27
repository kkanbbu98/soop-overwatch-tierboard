
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

  const teamSearchInput = document.getElementById('teamSearchInput');
  const teamSuggest = document.getElementById('teamSuggest');
  const pickedBox = document.getElementById('pickedBox');
  const addTeamABtn = document.getElementById('addTeamABtn');
  const addTeamBBtn = document.getElementById('addTeamBBtn');
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
    pickedStreamerId: null,
    picks: { a: null, b: null },
    suggest: { rivalA: [], rivalB: [], team: [] }
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

  function setPickedBox() {
    const item = getStreamer(state.pickedStreamerId);
    if (!item) {
      pickedBox.className = 'notice';
      pickedBox.textContent = '선택된 스트리머가 없습니다.';
      return;
    }
    const rivalId = rivalFor(item.id);
    const rival = rivalId ? getStreamer(rivalId) : null;
    pickedBox.className = 'notice';
    pickedBox.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <div class="small" style="margin-top:8px;">
        탱커 ${escapeHtml(item.tank_tier)} · 딜러 ${escapeHtml(item.dps_tier)} · 힐러 ${escapeHtml(item.support_tier)}
      </div>
      <div class="small muted" style="margin-top:6px;">맞상대: ${rival ? escapeHtml(rival.name) : '미지정'}</div>
    `;
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

  function selectTeamSearch(id) {
    state.pickedStreamerId = id;
    const streamer = getStreamer(id);
    teamSearchInput.value = streamer?.name || '';
    renderSuggest(teamSuggest, [], () => {});
    setPickedBox();
  }

  function renderPairs() {
    pairCount.textContent = state.rivals.length;
    if (!state.rivals.length) {
      pairList.innerHTML = '<div class="muted small">저장된 맞상대가 없습니다.</div>';
      return;
    }
    pairList.innerHTML = state.rivals.map(([a, b], idx) => {
      const sa = getStreamer(a);
      const sb = getStreamer(b);
      return `
        <div class="list-item">
          <div><strong>${escapeHtml(sa?.name || '삭제된 항목')}</strong> ↔ <strong>${escapeHtml(sb?.name || '삭제된 항목')}</strong></div>
          <div class="controls" style="margin-top:10px;">
            <button type="button" class="danger" data-delete-pair="${idx}">삭제</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTeams() {
    streamerCount.textContent = state.streamers.length;
    teamACount.textContent = `${state.teams.a.length} / ${state.teams.size}`;
    teamBCount.textContent = `${state.teams.b.length} / ${state.teams.size}`;
    size5Btn.classList.toggle('success', state.teams.size === 5);
    size6Btn.classList.toggle('success', state.teams.size === 6);

    teamAList.innerHTML = state.teams.a.length ? state.teams.a.map(id => renderTeamItem(id, 'a')).join('') : '<div class="muted small">비어 있음</div>';
    teamBList.innerHTML = state.teams.b.length ? state.teams.b.map(id => renderTeamItem(id, 'b')).join('') : '<div class="muted small">비어 있음</div>';
    setPickedBox();
    saveLocal('teams', state.teams);
    saveLocal('rivals', state.rivals);
  }

  function renderTeamItem(id, team) {
    const item = getStreamer(id);
    const rivalId = rivalFor(id);
    const rival = rivalId ? getStreamer(rivalId) : null;
    return `
      <div class="list-item">
        <strong>${escapeHtml(item?.name || '삭제된 항목')}</strong>
        <div class="small muted" style="margin-top:6px;">
          탱 ${escapeHtml(item?.tank_tier || '-')} · 딜 ${escapeHtml(item?.dps_tier || '-')} · 힐 ${escapeHtml(item?.support_tier || '-')}
        </div>
        <div class="small muted" style="margin-top:6px;">맞상대: ${rival ? escapeHtml(rival.name) : '미지정'}</div>
        <div class="controls" style="margin-top:10px;">
          <button type="button" class="danger" data-remove-team="${team}" data-id="${id}">제거</button>
        </div>
      </div>
    `;
  }

  function canAdd(team) {
    return state.teams[team].length < state.teams.size;
  }

  function teamOf(id) {
    if (state.teams.a.includes(id)) return 'a';
    if (state.teams.b.includes(id)) return 'b';
    return null;
  }

  function addToTeam(team, id, autoSource = null) {
    const otherTeam = team === 'a' ? 'b' : 'a';
    if (!id) return;
    if (teamOf(id)) {
      setStatus(statusBox, '이미 팀에 들어간 스트리머입니다.', 'error');
      return;
    }
    if (!canAdd(team)) {
      setStatus(statusBox, `${team === 'a' ? 'A팀' : 'B팀'} 정원이 가득 찼습니다.`, 'error');
      return;
    }
    state.teams[team].push(id);

    const rivalId = rivalFor(id);
    if (rivalId && !teamOf(rivalId)) {
      if (!canAdd(otherTeam)) {
        setStatus(statusBox, '반대 팀 정원이 가득 차서 맞상대를 자동 배치할 수 없습니다.', 'error');
      } else {
        state.teams[otherTeam].push(rivalId);
        state.teams.autoLinks[id] = rivalId;
        state.teams.autoLinks[rivalId] = id;
      }
    }

    setStatus(statusBox, autoSource ? '자동 맞상대 배치가 적용되었습니다.' : '팀에 추가되었습니다.', 'notice');
    renderTeams();
  }

  function removeFromTeam(team, id) {
    state.teams[team] = state.teams[team].filter(x => x !== id);
    const linked = state.teams.autoLinks[id];
    delete state.teams.autoLinks[id];

    if (linked) {
      delete state.teams.autoLinks[linked];
      state.teams.a = state.teams.a.filter(x => x !== linked);
      state.teams.b = state.teams.b.filter(x => x !== linked);
    }
    setStatus(statusBox, '팀에서 제거되었습니다.', 'notice');
    renderTeams();
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

    teamSearchInput.addEventListener('input', () => {
      state.pickedStreamerId = null;
      renderSuggest(teamSuggest, searchStreamers(teamSearchInput.value), id => selectTeamSearch(id));
      setPickedBox();
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
      if (!confirm('개인 맞상대 전체를 삭제할까요?')) return;
      state.rivals = [];
      state.teams.autoLinks = {};
      renderPairs();
      renderTeams();
    });

    pairList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delete-pair]');
      if (!btn) return;
      const idx = Number(btn.dataset.deletePair);
      state.rivals.splice(idx, 1);
      renderPairs();
      renderTeams();
    });

    addTeamABtn.addEventListener('click', () => addToTeam('a', state.pickedStreamerId));
    addTeamBBtn.addEventListener('click', () => addToTeam('b', state.pickedStreamerId));

    size5Btn.addEventListener('click', () => {
      state.teams = { size: 5, a: [], b: [], autoLinks: {} };
      renderTeams();
    });

    size6Btn.addEventListener('click', () => {
      state.teams = { size: 6, a: [], b: [], autoLinks: {} };
      renderTeams();
    });

    resetTeamsBtn.addEventListener('click', () => {
      if (!confirm('팀 편성을 초기화할까요?')) return;
      state.teams = { size: state.teams.size, a: [], b: [], autoLinks: {} };
      renderTeams();
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
