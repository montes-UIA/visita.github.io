/* ============================================================
   Rally STI 2026 — Lógica de la SPA (script.js)
   Requiere que index.html ya haya inicializado Firebase y
   expuesto window.RALLY_CONFIG, window.RALLY_DB, etc.
   ============================================================ */

// ---------------------------------------------------------------
// ESTADO DE LA APP
// ---------------------------------------------------------------
let state = {
  currentScreen: 'screen-login',
  currentStation: null,   // { id, name, description, order }
  scores: {},             // { stationId: { teamId: points } }
  isLoggedIn: false,
  unsubscribers: [],      // Firebase listeners activos
  previousScreen: null,
};

// ---------------------------------------------------------------
// INIT
// ---------------------------------------------------------------
function initApp() {
  const cfg = window.RALLY_CONFIG;
  if (!cfg) { console.error('RALLY_CONFIG no definido'); return; }

  // Poblar select de estaciones en el login
  const sel = document.getElementById('station-select');
  if (sel) {
    cfg.stations.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st.id;
      opt.textContent = `${st.order}. ${st.name}`;
      sel.appendChild(opt);
    });
  }

  // Suscribirse a los datos de Firebase (o cargar localStorage)
  subscribeToScores();

  // Mostrar pantalla de login por defecto
  showScreen('screen-login');
}

// ---------------------------------------------------------------
// FIREBASE / STORAGE
// ---------------------------------------------------------------
function subscribeToScores() {
  const db  = window.RALLY_DB;
  const fbr = window.RALLY_FB;

  if (db && window.RALLY_FB_READY) {
    // Firebase en tiempo real
    const scoresRef = fbr.ref(db, 'scores');
    const unsub = fbr.onValue(scoresRef, (snapshot) => {
      const data = snapshot.val();
      state.scores = data || {};
      refreshCurrentScreen();
    }, (error) => {
      console.error('Firebase error:', error);
      setOffline();
    });
    state.unsubscribers.push(unsub);
  } else {
    // Fallback: localStorage
    const saved = localStorage.getItem('rally_scores_v2');
    if (saved) {
      try { state.scores = JSON.parse(saved); } catch(e) { state.scores = {}; }
    }
    setOffline();
  }
}

function saveScore(stationId, teamId, points) {
  const db  = window.RALLY_DB;
  const fbr = window.RALLY_FB;

  // Actualizar estado local inmediatamente (optimistic update)
  if (!state.scores[stationId]) state.scores[stationId] = {};
  state.scores[stationId][teamId] = points;

  if (db && window.RALLY_FB_READY) {
    // Guardar en Firebase
    const path = fbr.ref(db, `scores/${stationId}/${teamId}`);
    fbr.set(path, points).catch(err => {
      console.error('Error guardando:', err);
      showToast('❌ Error al sincronizar', 'error');
    });
  } else {
    // Guardar en localStorage
    localStorage.setItem('rally_scores_v2', JSON.stringify(state.scores));
  }
}

function setOffline() {
  const dot   = document.querySelector('.sync-dot');
  const label = document.querySelector('.sync-label');
  if (dot)   dot.classList.add('offline');
  if (label) label.textContent = 'Sin conexión (modo local)';
}

// ---------------------------------------------------------------
// NAVEGACIÓN ENTRE PANTALLAS
// ---------------------------------------------------------------
function showScreen(screenId) {
  // Ocultar todas
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Mostrar la target
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');

  // Navbar
  const navbar = document.getElementById('navbar');
  const needsNavbar = screenId === 'screen-dashboard' || screenId === 'screen-scoring';
  if (navbar) navbar.style.display = needsNavbar ? 'flex' : 'none';

  // Guardar pantalla anterior
  state.previousScreen = state.currentScreen;
  state.currentScreen  = screenId;

  // Acciones específicas por pantalla
  if (screenId === 'screen-ranking') {
    renderRanking();
    updateLastUpdate();
  } else if (screenId === 'screen-dashboard') {
    renderDashboard();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshCurrentScreen() {
  if (state.currentScreen === 'screen-ranking')  renderRanking();
  if (state.currentScreen === 'screen-scoring' && state.currentStation)
    renderScoring(state.currentStation);
}

function goBackToDashboard() {
  showScreen('screen-dashboard');
}

function goBackFromRanking() {
  if (state.isLoggedIn) {
    showScreen(state.previousScreen && state.previousScreen !== 'screen-ranking'
      ? state.previousScreen
      : 'screen-dashboard');
  } else {
    showScreen('screen-login');
  }
}

// ---------------------------------------------------------------
// LOGIN / LOGOUT
// ---------------------------------------------------------------
function handleLogin(e) {
  e.preventDefault();

  const cfg        = window.RALLY_CONFIG;
  const pinInput   = document.getElementById('pin-input').value.trim();
  const stationId  = document.getElementById('station-select').value;
  const errorEl    = document.getElementById('login-error');

  if (pinInput !== cfg.evaluatorPin) {
    if (errorEl) {
      errorEl.style.display = 'flex';
      // Reset animation
      errorEl.style.animation = 'none';
      errorEl.offsetHeight; // reflow
      errorEl.style.animation = '';
    }
    return;
  }

  if (errorEl) errorEl.style.display = 'none';

  // Buscar la estación seleccionada
  state.currentStation = cfg.stations.find(s => s.id === stationId);
  state.isLoggedIn = true;

  // Actualizar navbar
  const badge = document.getElementById('nav-station-name');
  if (badge) badge.textContent = `${state.currentStation.order}. ${state.currentStation.name}`;

  const label = document.getElementById('dashboard-station-label');
  if (label) label.textContent = `Evaluando: ${state.currentStation.name}`;

  // Ir directo a la estación
  openStationScoring(state.currentStation);
}

function handleLogout() {
  openModal(
    '¿Cerrar sesión?',
    'Saldrás del panel de evaluador.',
    () => {
      state.isLoggedIn     = false;
      state.currentStation = null;

      // Reset form
      const form = document.getElementById('login-form');
      if (form) form.reset();

      showScreen('screen-login');
    }
  );
}

function togglePin() {
  const input = document.getElementById('pin-input');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ---------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------
function renderDashboard() {
  const cfg  = window.RALLY_CONFIG;
  const grid = document.getElementById('stations-grid');
  if (!grid) return;

  const icons = ['💻', '🤖', '🔐', '📡', '🧬', '🔬', '⚡', '🌐', '📊', '🎮'];

  grid.innerHTML = cfg.stations.map((st, i) => `
    <div class="station-card" onclick="openStationScoring('${st.id}')" id="card-${st.id}">
      <span class="station-card-icon">${icons[i % icons.length]}</span>
      <div class="station-card-order">Estación ${st.order}</div>
      <div class="station-card-name">${escHtml(st.name)}</div>
      <div class="station-card-desc">${escHtml(st.description)}</div>
      <span class="station-card-arrow">→</span>
    </div>
  `).join('');
}

// ---------------------------------------------------------------
// SCORING
// ---------------------------------------------------------------
function openStationScoring(station) {
  // Normalize — puede venir como string (desde onclick) o como objeto
  if (typeof station === 'string') {
    station = window.RALLY_CONFIG.stations.find(s => s.id === station);
  }
  state.currentStation = station;

  // Actualizar títulos
  const nameEl = document.getElementById('scoring-station-name');
  const descEl = document.getElementById('scoring-station-desc');
  if (nameEl) nameEl.textContent = `${station.order}. ${station.name}`;
  if (descEl) descEl.textContent = station.description;

  // Renderizar lista de equipos
  renderScoring(station);

  showScreen('screen-scoring');
}

function renderScoring(station) {
  const cfg  = window.RALLY_CONFIG;
  const list = document.getElementById('teams-list');
  if (!list) return;

  list.innerHTML = cfg.teams.map(team => {
    const currentPts = getScore(station.id, team.id);
    const btns = [0,1,2,3,4,5].map(p => `
      <button class="score-btn ${currentPts === p ? (p === 0 ? 'active active-0' : 'active') : ''}"
              onclick="assignPoints('${station.id}','${team.id}',${p})"
              id="btn-${station.id}-${team.id}-${p}"
              aria-label="${p} puntos">
        ${p}
      </button>
    `).join('');

    return `
      <div class="team-row" id="row-${station.id}-${team.id}">
        <div class="team-name">${escHtml(team.name)}</div>
        <div class="score-btns">${btns}</div>
        <div class="team-row-status">
          <span class="save-indicator" id="saved-${station.id}-${team.id}">✓ Guardado</span>
        </div>
      </div>
    `;
  }).join('');
}

function assignPoints(stationId, teamId, points) {
  points = parseInt(points, 10);

  // Actualizar botones en el DOM
  [0,1,2,3,4,5].forEach(p => {
    const btn = document.getElementById(`btn-${stationId}-${teamId}-${p}`);
    if (!btn) return;
    btn.classList.remove('active', 'active-0');
    if (p === points) {
      btn.classList.add('active');
      if (p === 0) btn.classList.add('active-0');
    }
  });

  // Guardar
  saveScore(stationId, teamId, points);

  // Mostrar indicador de guardado
  const indicator = document.getElementById(`saved-${stationId}-${teamId}`);
  if (indicator) {
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 2500);
  }
}

function getScore(stationId, teamId) {
  const s = state.scores;
  if (s && s[stationId] && s[stationId][teamId] !== undefined) {
    return parseInt(s[stationId][teamId], 10);
  }
  return null; // sin puntuación asignada
}

// ---------------------------------------------------------------
// RANKING
// ---------------------------------------------------------------
function renderRanking() {
  const cfg    = window.RALLY_CONFIG;
  const ranked = calcRanking(cfg.teams, cfg.stations);

  renderPodium(ranked.slice(0, 3));
  renderRankingTable(ranked, cfg.stations);
  updateLastUpdate();
}

function calcRanking(teams, stations) {
  return teams.map(team => {
    let total = 0;
    const byStation = {};
    stations.forEach(st => {
      const pts = getScore(st.id, team.id);
      byStation[st.id] = pts !== null ? pts : null;
      if (pts !== null) total += pts;
    });
    return { team, total, byStation };
  }).sort((a, b) => b.total - a.total || a.team.name.localeCompare(b.team.name));
}

function renderPodium(top) {
  const section = document.getElementById('podium-section');
  if (!section) return;
  if (top.length === 0) { section.innerHTML = ''; return; }

  const medals  = ['🥇', '🥈', '🥉'];
  const barCls  = ['podium-bar-1', 'podium-bar-2', 'podium-bar-3'];
  const order   = top.length >= 3 ? [1, 0, 2] : [0, 1]; // 2nd, 1st, 3rd visual order

  const items = order.map(i => {
    if (!top[i]) return '';
    const { team, total } = top[i];
    return `
      <div class="podium-item">
        <div class="podium-medal">${medals[i]}</div>
        <div class="podium-name">${escHtml(team.name)}</div>
        <div class="podium-pts">${total} pts</div>
        <div class="podium-bar ${barCls[i]}">${medals[i]}</div>
      </div>
    `;
  });

  section.innerHTML = items.join('');
}

function renderRankingTable(ranked, stations) {
  const tbody = document.getElementById('ranking-table-body');
  if (!tbody) return;
  if (ranked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="padding:2rem;text-align:center;color:var(--text3);">
      No hay equipos registrados aún.
    </td></tr>`;
    return;
  }

  const rankCls = ['rank-1', 'rank-2', 'rank-3'];
  const medals  = ['🥇', '🥈', '🥉'];

  tbody.innerHTML = ranked.map(({ team, total, byStation }, idx) => {
    const pos = idx < 3 ? medals[idx] : `${idx + 1}`;
    const pills = stations.map(st => {
      const pts = byStation[st.id];
      return `<span class="station-score-pill">${escHtml(st.name.substring(0,4))}: ${pts !== null ? pts : '—'}</span>`;
    }).join('');

    return `
      <tr class="${rankCls[idx] || ''}">
        <td class="rank-pos">${pos}</td>
        <td class="team-name-cell">${escHtml(team.name)}</td>
        <td class="pts-cell">${total}</td>
        <td class="detail-cell">${pills}</td>
      </tr>
    `;
  }).join('');
}

function updateLastUpdate() {
  const el = document.getElementById('last-update');
  if (el) el.textContent = new Date().toLocaleTimeString('es-MX');
}

// ---------------------------------------------------------------
// MODAL
// ---------------------------------------------------------------
function openModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-body').textContent    = body;
  document.getElementById('modal-overlay').style.display = 'flex';

  const btn = document.getElementById('modal-confirm-btn');
  btn.onclick = () => { closeModal(); onConfirm(); };
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ---------------------------------------------------------------
// TOAST
// ---------------------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ---------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auto-refresh del ranking cada 30s si está visible
setInterval(() => {
  if (state.currentScreen === 'screen-ranking') updateLastUpdate();
}, 30000);
