(() => {
  const configNotice = document.getElementById('configNotice');
  const statusBox = document.getElementById('statusBox');
  const streamerCount = document.getElementById('streamerCount');
  const pairCount = document.getElementById('pairCount');

  const rivalAInput = document.getElementById('rivalAInput');
  const rivalBInput = document.getElementById('rivalBInput');
  const rivalASuggest = document.getElementById('rivalASuggest');
  const rivalBSuggest = document.getElementById('rivalBSuggest');
  const pickedAName = document.getElementById('pickedAName');
  const pickedBName = document.getElementById('pickedBName');
  const pickedANote = document.getElementById('pickedANote');
  const pickedBNote = document.getElementById('pickedBNote');
  const savePairBtn = document.getElementById('savePairBtn');
  const swapPairBtn = document.getElementById('swapPairBtn');
  const clearPairsBtn = document.getElementById('clearPairsBtn');

  const size5Btn = document.getElementById('size5Btn');
  const size6Btn = document.getElementById('size6Btn');
  const resetTeamsBtn = document.getElementById('resetTeamsBtn');
  const shuffleTeamsBtn = document.getElementById('shuffleTeamsBtn');
  const poolList = document.getElementById('poolList');
  const poolZone = document.getElementById('poolZone');
  const teamACount = document.getElementById('teamACount');
  const teamBCount = document.getElementById('teamBCount');
  const teamAList = document.getElementById('teamAList');
  const teamBList = document.getElementById('teamBList');
  const teamAZone = document.getElementById('teamAZone');
  const teamBZone = document.getElementById('teamBZone');

  const state = {
    supabase: null,
    streamers: [],
    rivals: loadLocal('rivals', []),
    teams: loadLocal('teams', { size: 5, a: [], b: [], autoLinks: {} }),
    picks: {
      a: { id: null, auto: false },
      b: { id: null, auto: false }
    },
    drag: null
  };

  function ensureTeamShape() {
    state.teams = {
      size: state.teams?.size || 5,
      a: Array.isArray(state.teams?.a) ? [...new Set(state.teams.a.map(String))] : [],
      b: Array.isArray(state.teams?.b) ? [...new Set(state.teams.b.map(String))] : [],
      autoLinks: state.teams?.autoLinks || {}
    };
  }

  ensureTeamShape();

  function getStreamer(id) {
    return state.streamers.find(x => String(x.id) === String(id));
  }

  function getName(id) {
    return getStreamer(id)?.name || '삭제된 항목';
  }

  function normalize(text) {
    return normalizeName(String(text || ''));
  }

  function scoreStreamer(streamer, term) {
    const name = streamer.name || '';
    const normalizedName = normalize(name);
    const q = normalize(term);
    if (!q) return -1;
    if (normalizedName === q) return 1000;
    if (name === term) return 950;
    if (normalizedName.startsWith(q)) return 800 - (normalizedName.length - q.length);
    const idx = normalizedName.indexOf(q);
    if (idx >= 0) return 600 - idx;
    return -1;
  }

  function rankedStreamers(term, excludeIds = []) {
    const q = normalize(term);
    if (!q) return [];
    return state.streamers
      .filter(item => !excludeIds.includes(String(item.id)))
      .map(item => ({ item, score: scoreStreamer(item, term) }))
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'ko'))
      .map(entry => entry.item)
      .slice(0, 8);
  }

  function topMatch(term, excludeIds = []) {
    return rankedStreamers(term, excludeIds)[0] || null;
  }

  function rivalFor(id) {
    const key = String(id);
    const pair = state.rivals.find(([a, b]) => String(a) === key || String(b) === key);
    if (!pair) return null;
    return String(pair[0]) === key ? String(pair[1]) : String(pair[0]);
  }

  function teamOf(id) {
    const key = String(id);
    if (state.teams.a.includes(key)) return 'a';
    if (state.teams.b.includes(key)) return 'b';
    return null;
  }

  function canAdd(team, extra = 1) {
    return state.teams[team].length + extra <= state.teams.size;
  }

  function syncAutoLinks() {
    const next = {};
    state.rivals.forEach(([a, b]) => {
      const left = String(a);
      const right = String(b);
      if (teamOf(left) && teamOf(right)) {
        next[left] = right;
        next[right] = left;
      }
    });
    state.teams.autoLinks = next;
  }

  function sanitizeTeams() {
    state.teams.a = [...new Set(state.teams.a.filter(Boolean).map(String))];
    state.teams.b = [...new Set(state.teams.b.filter(Boolean).map(String))];
    state.teams.a = state.teams.a.filter(id => !state.teams.b.includes(id));
    state.teams.b = state.teams.b.filter(id => !state.teams.a.includes(id));
    syncAutoLinks();
  }

  function saveState() {
    saveLocal('teams', state.teams);
    saveLocal('rivals', state.rivals);
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
      onPick(String(target.dataset.id), false);
    };
  }

  function selectRivalSide(side, id, auto = false) {
    const key = String(id);
    state.picks[side] = { id: key, auto };
    const name = getName(key);
    if (side === 'a') {
      rivalAInput.value = name;
      renderSuggest(rivalASuggest, [], () => {});
    } else {
      rivalBInput.value = name;
      renderSuggest(rivalBSuggest, [], () => {});
    }
    renderPickedNames();
  }

  function resolvePickFromInput(side) {
    const input = side === 'a' ? rivalAInput : rivalBInput;
    const current = state.picks[side]?.id ? getStreamer(state.picks[side].id) : null;
    const exclude = [];
    const otherSide = side === 'a' ? 'b' : 'a';
    if (state.picks[otherSide]?.id) exclude.push(String(state.picks[otherSide].id));

    if (!input.value.trim()) {
      state.picks[side] = { id: null, auto: false };
      renderPickedNames();
      return null;
    }

    if (current && normalize(current.name) === normalize(input.value)) {
      renderPickedNames();
      return current;
    }

    const best = topMatch(input.value, exclude);
    if (!best) {
      state.picks[side] = { id: null, auto: false };
      renderPickedNames();
      return null;
    }

    selectRivalSide(side, String(best.id), true);
    return best;
  }

  function renderPickedNames() {
    const left = state.picks.a;
    const right = state.picks.b;

    pickedAName.textContent = left?.id ? getName(left.id) : '선택 전';
    pickedBName.textContent = right?.id ? getName(right.id) : '선택 전';
    pickedANote.textContent = left?.id ? (left.auto ? '자동 선택' : '직접 선택') : '';
    pickedBNote.textContent = right?.id ? (right.auto ? '자동 선택' : '직접 선택') : '';
    pickedAName.classList.toggle('is-auto', !!left?.auto);
    pickedBName.classList.toggle('is-auto', !!right?.auto);
  }

  function clearPickInputs() {
    rivalAInput.value = '';
    rivalBInput.value = '';
    state.picks.a = { id: null, auto: false };
    state.picks.b = { id: null, auto: false };
    renderSuggest(rivalASuggest, [], () => {});
    renderSuggest(rivalBSuggest, [], () => {});
    renderPickedNames();
  }

  function renderPool() {
    pairCount.textContent = state.rivals.length;
    if (!state.rivals.length) {
      poolList.innerHTML = '<div class="empty-drop">등록된 맞상대가 없습니다.</div>';
      return;
    }

    poolList.innerHTML = state.rivals.map(([a, b]) => {
      const left = String(a);
      const right = String(b);
      const assigned = !!(teamOf(left) && teamOf(right));
      return `
        <div class="pair-row ${assigned ? 'assigned' : ''}">
          <div class="pair-side" draggable="true" data-drag-id="${left}">${escapeHtml(getName(left))}</div>
          <div class="pair-link">↔</div>
          <div class="pair-side" draggable="true" data-drag-id="${right}">${escapeHtml(getName(right))}</div>
        </div>
      `;
    }).join('');

    bindPoolDraggables();
  }

  function renderTeamItem(id) {
    return `<div class="name-card"><strong>${escapeHtml(getName(id))}</strong></div>`;
  }

  function renderTeams() {
    sanitizeTeams();
    streamerCount.textContent = state.streamers.length;
    teamACount.textContent = `${state.teams.a.length} / ${state.teams.size}`;
    teamBCount.textContent = `${state.teams.b.length} / ${state.teams.size}`;
    size5Btn.classList.toggle('success', state.teams.size === 5);
    size6Btn.classList.toggle('success', state.teams.size === 6);

    teamAList.innerHTML = state.teams.a.length
      ? state.teams.a.map(id => renderTeamItem(id)).join('')
      : '<div class="empty-drop">목록에서 끌어다 놓기</div>';
    teamBList.innerHTML = state.teams.b.length
      ? state.teams.b.map(id => renderTeamItem(id)).join('')
      : '<div class="empty-drop">목록에서 끌어다 놓기</div>';

    saveState();
  }

  function renderAll() {
    renderPool();
    renderTeams();
  }

  function bindPoolDraggables() {
    poolList.querySelectorAll('[data-drag-id]').forEach(node => {
      node.addEventListener('dragstart', () => {
        node.classList.add('dragging');
        state.drag = { id: String(node.dataset.dragId) };
      });
      node.addEventListener('dragend', () => {
        node.classList.remove('dragging');
        clearDropHighlight();
        state.drag = null;
      });
    });
  }

  function clearDropHighlight() {
    [teamAZone, teamBZone].forEach(zone => zone.classList.remove('drop-active'));
  }

  function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function shuffleTeamsFromRivals() {
    const pairs = state.rivals.map(([a, b]) => [String(a), String(b)]);
    if (!pairs.length) {
      setStatus(statusBox, '셔플할 맞상대가 없습니다.', 'error');
      return;
    }
    if (pairs.length > state.teams.size) {
      setStatus(statusBox, `현재 등록된 맞상대가 ${pairs.length}쌍이라 ${state.teams.size}대${state.teams.size} 팀에 모두 배치할 수 없습니다.`, 'error');
      return;
    }

    const randomizedPairs = shuffleArray(pairs);
    const nextA = [];
    const nextB = [];
    randomizedPairs.forEach(([a, b]) => {
      if (Math.random() < 0.5) {
        nextA.push(a);
        nextB.push(b);
      } else {
        nextA.push(b);
        nextB.push(a);
      }
    });

    state.teams.a = nextA;
    state.teams.b = nextB;
    sanitizeTeams();
    renderAll();
    setStatus(statusBox, '팀을 랜덤으로 셔플했습니다.', 'notice');
  }

  function assignWithRival(id, targetTeam) {
    const sourceId = String(id);
    const rivalId = rivalFor(sourceId);
    if (!rivalId) {
      setStatus(statusBox, '먼저 맞상대를 등록해 주세요.', 'error');
      return false;
    }

    const oppositeTeam = targetTeam === 'a' ? 'b' : 'a';
    state.teams.a = state.teams.a.filter(x => x !== sourceId && x !== rivalId);
    state.teams.b = state.teams.b.filter(x => x !== sourceId && x !== rivalId);

    if (!canAdd(targetTeam, 1) || !canAdd(oppositeTeam, 1)) {
      sanitizeTeams();
      renderAll();
      setStatus(statusBox, '팀 정원이 가득 찼습니다.', 'error');
      return false;
    }

    state.teams[targetTeam].push(sourceId);
    state.teams[oppositeTeam].push(rivalId);
    sanitizeTeams();
    renderAll();
    setStatus(statusBox, `${getName(sourceId)}을 ${targetTeam.toUpperCase()}팀에 배치했습니다.`, 'notice');
    return true;
  }

  function savePair(a, b) {
    const left = String(a);
    const right = String(b);
    state.rivals = state.rivals.filter(([x, y]) => ![String(x), String(y)].includes(left) && ![String(x), String(y)].includes(right));
    state.rivals.push([left, right]);
    clearPickInputs();
    renderAll();
    setStatus(statusBox, '목록에 저장했습니다. 아래 목록에서 팀으로 끌어다 넣어 주세요.', 'notice');
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

    state.streamers = (data || []).map(item => ({ ...item, id: String(item.id) }));
    setStatus(statusBox, '');
    renderPickedNames();
    renderAll();
  }

  function attachDropzone(zone, target) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drop-active');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drop-active');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drop-active');
      if (!state.drag?.id) return;
      assignWithRival(state.drag.id, target);
    });
  }

  function handleInput(side) {
    const input = side === 'a' ? rivalAInput : rivalBInput;
    const otherSide = side === 'a' ? 'b' : 'a';
    state.picks[side] = { id: null, auto: false };
    renderPickedNames();
    renderSuggest(
      side === 'a' ? rivalASuggest : rivalBSuggest,
      rankedStreamers(input.value, state.picks[otherSide]?.id ? [String(state.picks[otherSide].id)] : []),
      (id, auto) => selectRivalSide(side, id, auto)
    );
  }

  function bindInputEvents(input, side, suggestBox) {
    input.addEventListener('input', () => handleInput(side));
    input.addEventListener('blur', () => {
      setTimeout(() => {
        resolvePickFromInput(side);
        suggestBox.classList.add('hidden');
      }, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        resolvePickFromInput(side);
        if (side === 'a') rivalBInput.focus();
      }
    });
  }

  function bindButtons() {
    savePairBtn.addEventListener('click', () => {
      const bestA = resolvePickFromInput('a');
      const bestB = resolvePickFromInput('b');
      const a = state.picks.a.id || bestA?.id;
      const b = state.picks.b.id || bestB?.id;

      if (!a || !b) {
        setStatus(statusBox, '두 스트리머를 모두 찾을 수 있게 이름을 입력해 주세요.', 'error');
        return;
      }
      if (String(a) === String(b)) {
        setStatus(statusBox, '같은 스트리머끼리는 등록할 수 없습니다.', 'error');
        return;
      }

      savePair(a, b);
    });

    swapPairBtn.addEventListener('click', () => {
      const temp = state.picks.a;
      state.picks.a = state.picks.b;
      state.picks.b = temp;
      rivalAInput.value = state.picks.a?.id ? getName(state.picks.a.id) : '';
      rivalBInput.value = state.picks.b?.id ? getName(state.picks.b.id) : '';
      renderPickedNames();
    });

    clearPairsBtn.addEventListener('click', () => {
      if (!confirm('등록 목록 전체를 삭제할까요? 팀 편성도 함께 초기화됩니다.')) return;
      state.rivals = [];
      state.teams = { size: state.teams.size, a: [], b: [], autoLinks: {} };
      clearPickInputs();
      renderAll();
      setStatus(statusBox, '등록 목록과 팀 편성을 모두 초기화했습니다.', 'notice');
    });

    size5Btn.addEventListener('click', () => {
      state.teams = { size: 5, a: [], b: [], autoLinks: {} };
      renderAll();
    });

    size6Btn.addEventListener('click', () => {
      state.teams = { size: 6, a: [], b: [], autoLinks: {} };
      renderAll();
    });

    shuffleTeamsBtn.addEventListener('click', () => {
      shuffleTeamsFromRivals();
    });

    resetTeamsBtn.addEventListener('click', () => {
      state.teams = { size: state.teams.size, a: [], b: [], autoLinks: {} };
      renderAll();
      setStatus(statusBox, '팀을 모두 비우고 등록 목록 상태로 돌렸습니다.', 'notice');
    });
  }

  function init() {
    if (!requireSupabaseConfig()) {
      configNotice.className = 'error';
      configNotice.textContent = 'supabase-config.js에 SUPABASE_URL과 SUPABASE_ANON_KEY를 먼저 입력해 주세요.';
      return;
    }

    state.supabase = createSupabaseClient();
    bindInputEvents(rivalAInput, 'a', rivalASuggest);
    bindInputEvents(rivalBInput, 'b', rivalBSuggest);
    bindButtons();
    attachDropzone(teamAZone, 'a');
    attachDropzone(teamBZone, 'b');
    renderPickedNames();
    renderAll();
    loadStreamers();
  }

  init();
})();
