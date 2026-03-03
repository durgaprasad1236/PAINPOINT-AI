/* ═══════════════════════════════════════════════════════════════
   PAINPOINT AI — COMPLETE JAVASCRIPT APPLICATION
   All functionality: Auth, API, Charts, Export, Streaming
═══════════════════════════════════════════════════════════════ */

// ── Configuration ─────────────────────────────────────────────
const DEFAULT_API_BASE = normalizeApiBase(
  window.APP_CONFIG?.API_BASE_URL || ''
);
let API_BASE = resolveApiBaseUrl();
let currentView = 'overview';
let currentTab = 'csv';
let analysisData = null;
let allResults = [];
let charts = {};

function normalizeApiBase(url) {
  return (url || '').trim().replace(/\/$/, '');
}

function resolveApiBaseUrl() {
  const baseUrl = normalizeApiBase(window.APP_CONFIG?.API_BASE_URL || DEFAULT_API_BASE);

  if (window.location.protocol === 'https:' && baseUrl.startsWith('http://')) {
    return baseUrl.replace(/^http:\/\//i, 'https://');
  }

  return baseUrl;
}

async function apiFetch(path, options = {}, maxRetries = 1, timeoutMs = 45000) {
  API_BASE = resolveApiBaseUrl();
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${endpoint}`;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let detail = '';

        try {
          const payload = await response.clone().json();
          detail = payload.detail || payload.message || '';
        } catch {
          detail = await response.clone().text();
        }

        if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
          await delay(2000 * (attempt + 1));
          continue;
        }

        throw new Error(detail || `Request failed (${response.status})`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      const isTimeout = error?.name === 'AbortError';
      const isNetworkError = error instanceof TypeError || isTimeout;

      if (isNetworkError && attempt < maxRetries) {
        await delay(2000 * (attempt + 1));
        continue;
      }

      if (isTimeout) {
        throw new Error('Request timed out. The backend may be waking up (Render cold start). Please retry in a few seconds.');
      }

      throw error;
    }
  }

  throw new Error('Unable to reach the backend API.');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (isLoginPage()) {
    initLoginPage();
    return;
  }

  checkAuth();
  setupEventListeners();
  checkApiHealth();
  generateParticles();
  loadSettings();
  loadSidebarState();
});

function isLoginPage() {
  return Boolean(document.getElementById('loginForm'));
}

// ── Auth Check ────────────────────────────────────────────────
function checkAuth() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('rememberMe');
  window.location.href = 'login.html';
}

function initLoginPage() {
  if (localStorage.getItem('authToken')) {
    window.location.href = 'dashboard.html';
    return;
  }

  generateLoginParticles();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await login();
    });
  }

  const resetLink = document.getElementById('resetLink');
  if (resetLink) {
    resetLink.addEventListener('click', (event) => {
      event.preventDefault();
      showLoginError('Password reset is not enabled.');
    });
  }

  const googleBtn = document.getElementById('googleBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      showLoginError('Google sign-in is not enabled.');
    });
  }

  const githubBtn = document.getElementById('githubBtn');
  if (githubBtn) {
    githubBtn.addEventListener('click', () => {
      showLoginError('GitHub OAuth integration is not enabled.');
    });
  }
}

function generateLoginParticles() {
  const particlesEl = document.getElementById('particles');
  if (!particlesEl) return;

  particlesEl.innerHTML = '';
  for (let index = 0; index < 30; index += 1) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDuration = `${Math.random() * 10 + 10}s`;
    particle.style.animationDelay = `${Math.random() * 5}s`;
    particlesEl.appendChild(particle);
  }
}

function setLoginLoadingState(isLoading) {
  const loginBtn = document.getElementById('loginBtn');
  const btnText = document.getElementById('btnText');
  const btnLoading = document.getElementById('btnLoading');

  if (loginBtn) loginBtn.disabled = isLoading;
  if (btnText) btnText.classList.toggle('hidden', isLoading);
  if (btnLoading) btnLoading.classList.toggle('hidden', !isLoading);
}

function showLoginError(message) {
  const errorBox = document.getElementById('errorBox');
  const errorMsg = document.getElementById('errorMsg');

  if (errorMsg) {
    errorMsg.textContent = message;
  }

  if (errorBox) {
    errorBox.classList.add('show');
  }
}

function hideLoginError() {
  const errorBox = document.getElementById('errorBox');
  if (errorBox) {
    errorBox.classList.remove('show');
  }
}

async function login() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberInput = document.getElementById('remember');

  if (!emailInput || !passwordInput) {
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const remember = Boolean(rememberInput?.checked);

  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  if (!window.APP_CONFIG?.API_BASE_URL) {
    showLoginError('Backend unavailable');
    return;
  }

  hideLoginError();
  setLoginLoadingState(true);

  try {
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok || !payload.success) {
      const detail = payload.detail || payload.message || 'Invalid email or password';
      showLoginError(detail);
      return;
    }

    localStorage.setItem('authToken', payload.token || 'authenticated');
    if (remember) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }

    window.location.href = 'dashboard.html';
  } catch (error) {
    showLoginError('Backend unavailable');
  } finally {
    setLoginLoadingState(false);
  }
}

window.login = login;

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
  disableSidebarSettingsAccess();

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;

      if (view === 'settings') {
        return;
      }

      switchView(view);
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // File upload
  const csvFile = document.getElementById('csvFile');
  const uploadZone = document.getElementById('uploadZone');
  
  if (csvFile && uploadZone) {
    csvFile.addEventListener('change', handleFileSelect);
    
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) {
        csvFile.files = e.dataTransfer.files;
        handleFileSelect();
      }
    });
    
    uploadZone.addEventListener('click', () => csvFile.click());
  }

  // Search and filters
  const searchInput = document.getElementById('searchInput');
  const filterCategory = document.getElementById('filterCategory');
  const filterSeverity = document.getElementById('filterSeverity');
  
  if (searchInput) searchInput.addEventListener('input', filterResults);
  if (filterCategory) filterCategory.addEventListener('change', filterResults);
  if (filterSeverity) filterSeverity.addEventListener('change', filterResults);

  // Avatar upload
  const userAvatarContainer = document.getElementById('userAvatarContainer');
  const profileMenuWrap = document.getElementById('profileMenuWrap');
  const profileDropdown = document.getElementById('profileDropdown');
  const manageSettingsBtn = document.getElementById('manageSettingsBtn');
  const avatarUpload = document.getElementById('avatarUpload');
  
  if (userAvatarContainer && profileDropdown) {
    userAvatarContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }

  if (manageSettingsBtn) {
    manageSettingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeProfileDropdown();
      openSettings();
    });
  }

  document.addEventListener('click', (event) => {
    if (profileMenuWrap && !profileMenuWrap.contains(event.target)) {
      closeProfileDropdown();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeProfileDropdown();
    }
  });

  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      setTheme(theme);
    });
  });

  // Settings modal listeners
  const accentColorPicker = document.getElementById('accentColorPicker');
  if (accentColorPicker) {
    accentColorPicker.addEventListener('change', (e) => {
      applyAccentColor(e.target.value);
    });
  }

  const fontSizeSelect = document.getElementById('fontSizeSelect');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
      applyFontSize(e.target.value);
    });
  }

  const toggleAnimations = document.getElementById('toggleAnimations');
  if (toggleAnimations) {
    toggleAnimations.addEventListener('change', (e) => {
      applyAnimationToggle(e.target.checked);
    });
  }

  const displayNameInput = document.getElementById('displayName');
  if (displayNameInput) {
    displayNameInput.addEventListener('input', (e) => {
      localStorage.setItem('displayName', e.target.value);
    });
  }

  const userEmailInput = document.getElementById('userEmail');
  if (userEmailInput) {
    userEmailInput.addEventListener('input', (e) => {
      localStorage.setItem('userEmail', e.target.value);
    });
  }

  if (avatarUpload) {
    avatarUpload.addEventListener('change', handleAvatarUploadSettings);
  }

  // Settings selections
  document.querySelectorAll('#modelSelect, #responseStyle, #exportFormat, #performanceMode').forEach(select => {
    select.addEventListener('change', (e) => {
      const settingKey = e.target.id.replace('Select', '').replace('Input', '');
      localStorage.setItem(settingKey, e.target.value);
    });
  });

  // Toggle switches
  document.querySelectorAll('#streamToggle, #confidenceToggle, #autoSaveToggle, #notifyToggle, #soundToggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      localStorage.setItem(e.target.id, e.target.checked ? 'true' : 'false');
    });
  });

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }
}

function disableSidebarSettingsAccess() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('click', (event) => {
    const blockedTrigger = event.target.closest(
      '#sidebarSettingsBtn, #settingsBtn, .sidebar-settings-btn, .nav-link[data-view="settings"], [data-action="open-settings"], [onclick*="openSettings"]'
    );

    if (!blockedTrigger) return;

    event.preventDefault();
    event.stopPropagation();
  });
}

// ── Sidebar Toggle ────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContainer = document.querySelector('.main-container');
  if (!sidebar || !mainContainer) return;
  
  const isCollapsed = sidebar.classList.contains('collapsed');
  
  if (isCollapsed) {
    // Expand sidebar
    sidebar.classList.remove('collapsed');
    mainContainer.classList.remove('sidebar-collapsed');
    localStorage.setItem('sidebarState', 'open');
  } else {
    // Collapse sidebar
    sidebar.classList.add('collapsed');
    mainContainer.classList.add('sidebar-collapsed');
    localStorage.setItem('sidebarState', 'closed');
  }
}

function loadSidebarState() {
  // Ensure DOM is ready
  const sidebar = document.getElementById('sidebar');
  const mainContainer = document.querySelector('.main-container');
  if (!sidebar || !mainContainer) {
    return;
  }
  
  // Get saved state, default to 'open'
  const sidebarState = localStorage.getItem('sidebarState') || 'open';
  
  // Apply correct classes based on saved state
  sidebar.classList.remove('collapsed');
  mainContainer.classList.remove('sidebar-collapsed');
  
  if (sidebarState === 'closed') {
    sidebar.classList.add('collapsed');
    mainContainer.classList.add('sidebar-collapsed');
  }
}

// ── View Switching ────────────────────────────────────────────
function switchView(viewName) {
  currentView = viewName;
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });
  
  // Update views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });
  
  // Update page title
  const titles = {
    overview: ['Intelligence Overview', 'Real-time customer insights & decision intelligence'],
    analyze: ['AI Analysis Engine', 'Upload feedback for deep intelligence extraction'],
    intelligence: ['Executive Intelligence', 'AI-generated insights and recommendations'],
    insights: ['Detailed Results', 'Complete analysis breakdown by feedback'],
    export: ['Export Data', 'Download results in multiple formats'],
    about: ['About PainPoint AI', 'Platform information, features, and technology stack']
  };
  
  const [title, subtitle] = titles[viewName] || ['Dashboard', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = subtitle;
}

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

// ── File Handling ─────────────────────────────────────────────
function handleFileSelect() {
  const file = document.getElementById('csvFile').files[0];
  if (file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const uploadContent = document.querySelector('.upload-content');
    
    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
    uploadContent.classList.add('hidden');
  }
}

function clearFile() {
  document.getElementById('csvFile').value = '';
  document.getElementById('fileInfo').classList.add('hidden');
  document.querySelector('.upload-content').classList.remove('hidden');
}

// ── API Health Check ──────────────────────────────────────────
async function checkApiHealth() {
  const statusEl = document.getElementById('apiStatusWidget');
  const statusText = document.getElementById('statusText');
  const indicator = statusEl.querySelector('.status-indicator');
  
  try {
    const res = await apiFetch('/api/health', {}, 2, 20000);
    const data = await res.json();
    
    if (data.api_key_configured) {
      indicator.className = 'status-indicator online';
      statusText.textContent = 'Connected';
    } else {
      indicator.className = 'status-indicator offline';
      statusText.textContent = 'No API Key';
    }
  } catch {
    indicator.className = 'status-indicator offline';
    statusText.textContent = 'Offline';
  }
}

// ── Run Analysis ──────────────────────────────────────────────
async function runAnalysis() {
  const btn = document.getElementById('analyzeBtn');
  const btnText = document.getElementById('analyzeBtnText');
  const btnLoading = document.getElementById('analyzeBtnLoading');
  const errorAlert = document.getElementById('errorAlert');
  const errorMsg = document.getElementById('errorMsg');
  
  errorAlert.classList.add('hidden');
  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');
  
  showLoading();
  
  try {
    if (currentTab === 'single') {
      await analyzeSingle();
    } else {
      await analyzeBatch();
    }
    
    switchView('overview');
    
  } catch (err) {
    errorAlert.classList.remove('hidden');
    errorMsg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
    hideLoading();
  }
}

async function analyzeSingle() {
  const feedback = document.getElementById('singleFeedback').value.trim();
  if (!feedback) throw new Error('Please enter feedback text');
  
  updateLoadingStep('Analyzing with AI...', 50);
  
  const res = await apiFetch('/api/analyse-single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback })
  }, 2);
  
  const data = await res.json();
  displaySingleResult(data);
}

async function analyzeBatch() {
  const formData = new FormData();
  
  if (currentTab === 'csv') {
    const file = document.getElementById('csvFile').files[0];
    if (!file) throw new Error('Please upload a CSV file');
    formData.append('file', file);
    const col = document.getElementById('colName').value.trim();
    if (col) formData.append('feedback_column', col);
    updateLoadingStep('Reading CSV...', 20);
  } else {
    const rawText = document.getElementById('rawText').value.trim();
    if (!rawText) throw new Error('Please paste feedback text');
    formData.append('raw_text', rawText);
    updateLoadingStep('Processing text...', 20);
  }
  
  await delay(600);
  updateLoadingStep('Running ML analysis...', 40);
  await delay(500);
  updateLoadingStep('Calling LLM...', 60);
  
  const res = await apiFetch('/api/analyse', {
    method: 'POST',
    body: formData
  }, 2);
  
  updateLoadingStep('Generating insights...', 80);
  const data = await res.json();
  
  updateLoadingStep('Complete!', 100);
  await delay(400);
  
  handleBatchResult(data);
}

// ── Display Results ───────────────────────────────────────────
function handleBatchResult(data) {
  analysisData = data;
  allResults = data.all_results || [];
  
  // Update stats
  document.getElementById('statTotal').textContent = data.summary_stats.total_feedback;
  document.getElementById('statCritical').textContent = data.summary_stats.high_severity_count;
  document.getElementById('statCategory').textContent = data.summary_stats.top_category;
  document.getElementById('statEmotion').textContent = data.summary_stats.top_emotion;
  
  // Show content
  document.getElementById('emptyState')?.classList.add('hidden');
  document.getElementById('statsGrid')?.classList.remove('hidden');
  document.getElementById('chartsRow')?.classList.remove('hidden');
  document.getElementById('intelligenceRow')?.classList.remove('hidden');
  
  // Render visualizations
  renderPriorityChart(data.priority_scores);
  renderSeverityChart(data.severity_distribution);
  renderEmotionChart(data.emotion_distribution);
  renderPriorityTable(data.priority_scores);
  renderResultsTable(allResults);
  renderIntelligence(data);
}

function displaySingleResult(data) {
  // Hide summary grid and show detail view
  const summaryGrid = document.getElementById('intelligenceGrid');
  const detailContainer = document.getElementById('resultsDetailContainer');
  const analysisPanel = document.getElementById('analysisResult');
  const solutionPanel = document.getElementById('intelligentSolution');
  
  if (!detailContainer || !analysisPanel || !solutionPanel) return;
  
  // Determine severity badge background color
  let severityColor = 'var(--success)';
  if (data.severity === 'High') severityColor = 'var(--error)';
  else if (data.severity === 'Medium') severityColor = 'var(--warning)';
  
  // LEFT PANEL: ANALYSIS ONLY
  document.getElementById('originalFeedback').innerHTML = `"${esc(data.original_feedback)}"`;
  document.getElementById('painPoint').textContent = data.pain_point || 'N/A';
  document.getElementById('categoryAnalysis').textContent = data.ml_suggested_category || 'N/A';
  document.getElementById('severityAnalysis').innerHTML = `<span style="padding: 8px 12px; background: ${severityColor}20; border: 1px solid ${severityColor}40; border-radius: 6px; color: ${severityColor};">${esc(data.severity)}</span>`;
  document.getElementById('emotionAnalysis').textContent = data.emotion || 'N/A';
  document.getElementById('rootCauseAnalysis').textContent = data.root_cause || 'N/A';
  
  // RIGHT PANEL: INTELLIGENT SOLUTION GENERATION
  document.getElementById('solutionGenerated').textContent = data.solution || 'No solution generated';
  document.getElementById('recommendedFix').textContent = (data.llm_response?.recommended_fix || data.solution) || 'No fix recommended';
  document.getElementById('actionableSteps').textContent = (data.llm_response?.actionable_steps || 'Follow the recommended solution steps') || 'No steps provided';
  document.getElementById('improvementSuggestion').textContent = data.feature_suggestion || 'No improvement suggestion';
  
  // Show detail view, hide summary
  if (summaryGrid) summaryGrid.classList.add('hidden');
  detailContainer.classList.remove('hidden');
  
  switchView('intelligence');
}

function isLightThemeActive() {
  return document.documentElement.classList.contains('light-mode');
}

function getThemeValue(variableName, fallback = '') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallback;
}

function getChartThemeColors() {
  const isLight = isLightThemeActive();
  const textPrimary = getThemeValue('--text-primary', '#ffffff');
  const textSecondary = getThemeValue('--text-secondary', 'rgba(255, 255, 255, 0.7)');
  const borderColor = getThemeValue('--glass-border', 'rgba(255, 255, 255, 0.1)');
  const chartBackground = isLight
    ? 'rgba(255, 255, 255, 0.88)'
    : 'rgba(20, 25, 45, 0.35)';

  return {
    isLight,
    textPrimary,
    textSecondary,
    gridColor: borderColor,
    chartBackground,
    tooltipBg: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(0, 0, 0, 0.85)',
    tooltipTitle: isLight ? textPrimary : '#ffffff',
    tooltipBody: isLight ? textSecondary : '#dddddd',
    tooltipBorder: borderColor
  };
}

function rgba(rgb, opacity) {
  return `rgba(${rgb}, ${opacity})`;
}

const chartThemeBackgroundPlugin = {
  id: 'chartThemeBackground',
  beforeDraw(chart, _args, pluginOptions) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    ctx.save();
    ctx.fillStyle = pluginOptions?.backgroundColor || 'transparent';
    ctx.fillRect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top
    );
    ctx.restore();
  }
};

function refreshChartsForTheme() {
  if (!analysisData) return;

  renderPriorityChart(analysisData.priority_scores || []);
  renderSeverityChart(analysisData.severity_distribution || []);
  renderEmotionChart(analysisData.emotion_distribution || []);
}

// ── Charts ────────────────────────────────────────────────────
function renderPriorityChart(data) {
  const ctx = document.getElementById('priorityChart')?.getContext('2d');
  if (!ctx) return;
  const theme = getChartThemeColors();
  const barOpacity = theme.isLight ? 0.92 : 0.8;
  
  if (charts.priority) charts.priority.destroy();
  
  charts.priority = new Chart(ctx, {
    plugins: [chartThemeBackgroundPlugin],
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        label: 'Priority Score',
        data: data.map(d => d.priority_score),
        backgroundColor: data.map(d => {
          if (d.severity_label === 'Critical') return rgba('239, 68, 68', barOpacity);
          if (d.severity_label === 'High') return rgba('245, 158, 11', barOpacity);
          if (d.severity_label === 'Medium') return rgba('59, 130, 246', barOpacity);
          return rgba('16, 185, 129', barOpacity);
        }),
        borderRadius: 0,
        borderSkipped: false,
        barPercentage: 0.8,
        categoryPercentage: 0.9,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        chartThemeBackground: {
          backgroundColor: theme.chartBackground
        },
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          padding: 12,
          borderColor: theme.tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textSecondary }
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textSecondary }
        }
      }
    }
  });
}

function renderSeverityChart(data) {
  const ctx = document.getElementById('severityChart')?.getContext('2d');
  if (!ctx) return;
  const theme = getChartThemeColors();
  const sliceOpacity = theme.isLight ? 0.92 : 0.8;
  
  if (charts.severity) charts.severity.destroy();
  
  charts.severity = new Chart(ctx, {
    plugins: [chartThemeBackgroundPlugin],
    type: 'doughnut',
    data: {
      labels: data.map(d => d.severity),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: [
          rgba('239, 68, 68', sliceOpacity),
          rgba('245, 158, 11', sliceOpacity),
          rgba('16, 185, 129', sliceOpacity)
        ],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        chartThemeBackground: {
          backgroundColor: theme.chartBackground
        },
        legend: {
          position: 'bottom',
          labels: {
            color: theme.textPrimary,
            padding: 16,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10
        }
      }
    }
  });
}

function renderEmotionChart(data) {
  const ctx = document.getElementById('emotionChart')?.getContext('2d');
  if (!ctx) return;
  const theme = getChartThemeColors();
  const barOpacity = theme.isLight ? 0.92 : 0.8;
  
  if (charts.emotion) charts.emotion.destroy();
  
  const colors = {
    'Frustration': rgba('239, 68, 68', barOpacity),
    'Anger': rgba('220, 38, 38', barOpacity),
    'Disappointment': rgba('245, 158, 11', barOpacity),
    'Neutral': rgba('107, 114, 128', barOpacity),
    'Satisfaction': rgba('16, 185, 129', barOpacity),
    'Confusion': rgba('139, 92, 246', barOpacity)
  };
  
  charts.emotion = new Chart(ctx, {
    plugins: [chartThemeBackgroundPlugin],
    type: 'bar',
    data: {
      labels: data.map(d => d.emotion),
      datasets: [{
        label: 'Count',
        data: data.map(d => d.count),
        backgroundColor: data.map(d => colors[d.emotion] || rgba('107, 114, 128', barOpacity)),
        borderRadius: 0,
        borderSkipped: false,
        barPercentage: 0.8,
        categoryPercentage: 0.9,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        chartThemeBackground: {
          backgroundColor: theme.chartBackground
        },
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textSecondary }
        },
        y: {
          grid: { display: false },
          ticks: { color: theme.textSecondary }
        }
      }
    }
  });
}

// ── Priority Table ────────────────────────────────────────────
function renderPriorityTable(data) {
  const wrap = document.getElementById('priorityTableWrap');
  if (!wrap) return;
  
  const rows = data.map((d, i) => {
    const badgeColors = {
      'Critical': 'background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4)',
      'High': 'background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4)',
      'Medium': 'background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.4)',
      'Low': 'background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4)'
    };
    
    return `
      <tr style="border-bottom: 1px solid var(--glass-border);">
        <td style="padding: 12px; font-weight: 700; color: var(--text-primary);">${i + 1}. ${esc(d.category)}</td>
        <td style="padding: 12px; color: var(--text-secondary);">${d.frequency}</td>
        <td style="padding: 12px; color: var(--text-secondary);">${d.avg_severity}/3</td>
        <td style="padding: 12px; font-weight: 700; color: var(--primary);">${d.priority_score}</td>
        <td style="padding: 12px;">
          <span style="padding: 4px 10px; border-radius: 100px; font-size: 0.75rem; font-weight: 700; ${badgeColors[d.severity_label]}">${d.severity_label}</span>
        </td>
      </tr>
    `;
  }).join('');
  
  wrap.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
      <thead>
        <tr style="border-bottom: 1px solid var(--glass-border);">
          <th style="text-align: left; padding: 10px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Category</th>
          <th style="text-align: left; padding: 10px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Freq</th>
          <th style="text-align: left; padding: 10px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Avg Sev</th>
          <th style="text-align: left; padding: 10px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Priority</th>
          <th style="text-align: left; padding: 10px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Results Table ─────────────────────────────────────────────
function renderResultsTable(results) {
  const tbody = document.getElementById('resultsBody');
  const catSelect = document.getElementById('filterCategory');
  
  if (!tbody) return;
  
  // Populate category filter
  const cats = [...new Set(results.map(r => r.ml_suggested_category).filter(Boolean))];
  catSelect.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  
  buildResultRows(results);
}

let resultIndexMap = {}; // Map to store results for detail view

function buildResultRows(results) {
  const tbody = document.getElementById('resultsBody');
  if (!tbody) return;
  
  if (!results.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No results found</td></tr>';
    return;
  }
  
  // Clear previous map and rebuild with current results
  resultIndexMap = {};
  
  tbody.innerHTML = results.map((r, i) => {
    const mapKey = `result_${Date.now()}_${i}`;
    resultIndexMap[mapKey] = r;
    
    return `
      <tr style="border-bottom: 1px solid var(--glass-border); transition: var(--transition); cursor: pointer;" 
          onmouseover="this.style.background='var(--glass-bg-light)'" 
          onmouseout="this.style.background='transparent'"
          onclick="displaySingleResult(resultIndexMap['${mapKey}'])">
        <td style="padding: 14px; text-align: center; color: var(--text-muted); font-weight: 700;">${i + 1}</td>
        <td style="padding: 14px; max-width: 200px; font-size: 0.85rem; color: var(--text-secondary);">${esc(truncate(r.original_feedback || '', 80))}</td>
        <td style="padding: 14px;"><span style="padding: 4px 10px; background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 100px; font-size: 0.75rem; font-weight: 700; color: var(--secondary);">${esc(r.ml_suggested_category || 'N/A')}</span></td>
        <td style="padding: 14px; font-weight: 700; color: ${r.severity === 'High' ? 'var(--error)' : r.severity === 'Medium' ? 'var(--warning)' : 'var(--success)'};">${esc(r.severity || 'N/A')}</td>
        <td style="padding: 14px; color: var(--text-secondary);">${esc(r.emotion || 'N/A')}</td>
        <td style="padding: 14px; font-size: 0.85rem; color: var(--text-secondary);">${esc(truncate(r.root_cause || '', 60))}</td>
        <td style="padding: 14px; font-size: 0.85rem; color: var(--text-secondary);">${esc(truncate(r.solution || '', 60))}</td>
      </tr>
    `;
  }).join('');
}

function filterResults() {
  if (!allResults.length) return;
  
  const query = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const catFilter = document.getElementById('filterCategory')?.value || '';
  const sevFilter = document.getElementById('filterSeverity')?.value || '';
  
  const filtered = allResults.filter(r => {
    const matchText = !query ||
      (r.original_feedback || '').toLowerCase().includes(query) ||
      (r.ml_suggested_category || '').toLowerCase().includes(query);
    const matchCat = !catFilter || r.ml_suggested_category === catFilter;
    const matchSev = !sevFilter || r.severity === sevFilter;
    return matchText && matchCat && matchSev;
  });
  
  buildResultRows(filtered);
}

// ── Intelligence ──────────────────────────────────────────────
function renderIntelligence(data) {
  const summaryText = document.getElementById('summaryText');
  const featuresContainer = document.getElementById('featuresContainer');
  
  if (summaryText) {
    summaryText.textContent = data.executive_summary || 'No summary available';
  }
  
  if (featuresContainer) {
    const features = (data.all_results || [])
      .map(r => r.feature_suggestion)
      .filter(f => f && f !== 'Could not determine' && f.trim().length > 5)
      .slice(0, 8);
    
    if (features.length) {
      featuresContainer.innerHTML = features.map((f, i) => `
        <div style="display: flex; gap: 12px; padding: 14px; background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: 10px; margin-bottom: 10px;">
          <div style="width: 28px; height: 28px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: white; flex-shrink: 0;">${i + 1}</div>
          <div style="color: var(--text-secondary); line-height: 1.6;">${esc(f)}</div>
        </div>
      `).join('');
    } else {
      featuresContainer.innerHTML = '<p style="color: var(--text-muted);">No feature suggestions generated</p>';
    }
  }
}

// ── Export Functions ──────────────────────────────────────────
async function exportToPDF() {
  if (!analysisData) {
    showNotification('No analysis data available. Run analysis first.', 'error');
    return;
  }

  const jsPDFCtor = window.jspdf?.jsPDF;
  if (!jsPDFCtor || !window.html2canvas) {
    showNotification('PDF export is unavailable. Missing jsPDF/html2canvas.', 'error');
    return;
  }

  try {
    showLoading();
    updateLoadingStep('Preparing PDF export...', 8);
    await yieldToMainThread();

    const chartImages = await captureChartsForPdf();
    updateLoadingStep('Building PDF layout...', 45);
    await yieldToMainThread();

    const pdf = new jsPDFCtor('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const usableWidth = pageWidth - margin * 2;

    let cursorY = margin;
    const lineHeight = 5.2;

    const ensureSpace = (requiredHeight) => {
      if (cursorY + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }
    };

    const drawSectionTitle = (title) => {
      ensureSpace(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(title, margin, cursorY);
      cursorY += 6;
    };

    const drawWrappedText = (text, fontSize = 10, color = [55, 65, 81]) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(...color);

      const lines = pdf.splitTextToSize(String(text || ''), usableWidth);
      for (const line of lines) {
        ensureSpace(lineHeight);
        pdf.text(line, margin, cursorY);
        cursorY += lineHeight;
      }
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('PainPoint AI Report', margin, cursorY);
    cursorY += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, cursorY);
    cursorY += 8;

    drawSectionTitle('Summary');
    const summary = analysisData.summary_stats || {};
    drawWrappedText(`Total Feedback: ${summary.total_feedback ?? 0}`);
    drawWrappedText(`High Severity: ${summary.high_severity_count ?? 0}`);
    drawWrappedText(`Top Category: ${summary.top_category || 'N/A'}`);
    drawWrappedText(`Top Emotion: ${summary.top_emotion || 'N/A'}`);
    cursorY += 2;

    drawSectionTitle('Executive Insights');
    drawWrappedText(analysisData.executive_summary || 'No executive summary available.');
    cursorY += 2;

    drawSectionTitle('Charts');
    const chartWidth = (usableWidth - 6) / 2;
    const chartHeight = 52;
    const drawChartAt = (img, x, y, w, h) => {
      if (!img) return;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, y, w, h, 2, 2, 'FD');
      pdf.addImage(img, 'JPEG', x + 1.5, y + 1.5, w - 3, h - 3, undefined, 'FAST');
    };

    ensureSpace(chartHeight * 2 + 10);
    const chartsY = cursorY;
    drawChartAt(chartImages[0], margin, chartsY, chartWidth, chartHeight);
    drawChartAt(chartImages[1], margin + chartWidth + 6, chartsY, chartWidth, chartHeight);
    drawChartAt(chartImages[2], margin, chartsY + chartHeight + 6, usableWidth, chartHeight);
    cursorY += chartHeight * 2 + 10;

    updateLoadingStep('Formatting table data...', 72);
    await yieldToMainThread();

    drawSectionTitle('Detailed Results');
    const columns = [
      { key: 'index', label: '#', width: 8 },
      { key: 'feedback', label: 'Feedback', width: 50 },
      { key: 'category', label: 'Category', width: 32 },
      { key: 'severity', label: 'Sev', width: 12 },
      { key: 'emotion', label: 'Emotion', width: 18 },
      { key: 'root', label: 'Root Cause', width: 42 },
      { key: 'solution', label: 'Solution', width: 42 }
    ];

    const drawTableHeader = () => {
      ensureSpace(8);
      pdf.setFillColor(243, 244, 246);
      pdf.setDrawColor(209, 213, 219);
      let x = margin;
      columns.forEach((col) => {
        pdf.rect(x, cursorY, col.width, 8, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(31, 41, 55);
        pdf.text(col.label, x + 1.5, cursorY + 5.3);
        x += col.width;
      });
      cursorY += 8;
    };

    const rows = (allResults || []).map((item, idx) => ({
      index: String(idx + 1),
      feedback: item.original_feedback || '',
      category: item.ml_suggested_category || item.category || '',
      severity: item.severity || '',
      emotion: item.emotion || '',
      root: item.root_cause || '',
      solution: item.solution || ''
    }));

    if (!rows.length) {
      drawWrappedText('No data available.');
    } else {
      drawTableHeader();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(31, 41, 55);

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        if (rowIndex % 10 === 0) {
          updateLoadingStep(`Rendering table rows (${Math.min(rowIndex, rows.length)}/${rows.length})...`, 72 + Math.round((rowIndex / rows.length) * 20));
          await yieldToMainThread();
        }

        const row = rows[rowIndex];
        const cellLines = columns.map((col) => {
          const cellText = String(row[col.key] || '');
          return pdf.splitTextToSize(cellText, col.width - 3);
        });

        const rowHeight = Math.max(6, ...cellLines.map((lines) => lines.length * 3.6 + 1.6));
        if (cursorY + rowHeight > pageHeight - margin) {
          pdf.addPage();
          cursorY = margin;
          drawTableHeader();
        }

        let x = margin;
        columns.forEach((col, colIdx) => {
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(x, cursorY, col.width, rowHeight);
          const lines = cellLines[colIdx];
          lines.forEach((line, lineIdx) => {
            pdf.text(line, x + 1.5, cursorY + 4 + lineIdx * 3.6);
          });
          x += col.width;
        });

        cursorY += rowHeight;
      }
    }

    updateLoadingStep('Finalizing download...', 96);
    await yieldToMainThread();

    const blob = pdf.output('blob');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `painpoint-report-${stamp}.pdf`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    updateLoadingStep('Complete!', 100);
    await delay(120);
    showNotification('PDF downloaded successfully', 'success');
  } catch (error) {
    showNotification('Failed to export PDF. Please try again.', 'error');
  } finally {
    hideLoading();
  }
}

async function captureChartsForPdf() {
  const chartTargets = ['priorityChart', 'severityChart', 'emotionChart'];
  const images = [];

  await yieldToMainThread();
  await delay(60);

  for (let index = 0; index < chartTargets.length; index += 1) {
    updateLoadingStep(`Capturing charts (${index + 1}/${chartTargets.length})...`, 18 + index * 9);
    const canvas = document.getElementById(chartTargets[index]);
    if (!canvas) {
      images.push(null);
      continue;
    }

    const captureCanvas = await window.html2canvas(canvas, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    images.push(captureCanvas.toDataURL('image/jpeg', 0.82));
    await yieldToMainThread();
  }

  return images;
}

function yieldToMainThread() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

function exportToCSV() {
  if (!allResults.length) {
    showNotification('No results to export. Run analysis first.', 'warning');
    return;
  }
  
  const headers = ['Feedback', 'Category', 'Severity', 'Emotion', 'Root Cause', 'Solution', 'Feature Suggestion'];
  const rows = allResults.map(r => [
    r.original_feedback || '',
    r.ml_suggested_category || '',
    r.severity || '',
    r.emotion || '',
    r.root_cause || '',
    r.solution || '',
    r.feature_suggestion || ''
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  downloadFile('painpoint-analysis.csv', csv, 'text/csv');
}

function exportToJSON() {
  if (!analysisData) {
    showNotification('No analysis data available. Run analysis first.', 'warning');
    return;
  }
  
  const json = JSON.stringify(analysisData, null, 2);
  downloadFile('painpoint-analysis.json', json, 'application/json');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Avatar Upload (Persistent) ────────────────────────────────
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file is an image
  if (!file.type.startsWith('image/')) {
    showNotification('Please select a valid image file', 'warning');
    return;
  }

  // Use FileReader to read the image
  const reader = new FileReader();
  
  reader.onload = (event) => {
    const imageData = event.target.result;
    
    // Save to localStorage
    localStorage.setItem('userAvatar', imageData);
    
    // Update the UI immediately
    const userAvatarImg = document.getElementById('userAvatarImg');
    if (userAvatarImg) {
      userAvatarImg.src = imageData;
    }
  };

  reader.onerror = () => {
    showNotification('Error reading file. Please try again.', 'error');
  };

  reader.readAsDataURL(file);
  
  // Reset file input
  e.target.value = '';
}

// ── Theme Management (Dark/Light/Auto) ────────────────────────
function setTheme(theme) {
  // Save to localStorage
  localStorage.setItem('themeMode', theme);
  
  // Apply the theme
  applyTheme(theme);
  
  // Update active button
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function applyTheme(theme) {
  const htmlElement = document.documentElement;
  
  if (theme === 'auto') {
    // Follow system theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      htmlElement.classList.remove('light-mode');
    } else {
      htmlElement.classList.add('light-mode');
    }
  } else if (theme === 'light') {
    htmlElement.classList.add('light-mode');
  } else {
    // dark theme (default)
    htmlElement.classList.remove('light-mode');
  }

  // Update active button in settings modal
  const themeBtn = document.querySelector(`.theme-btn[data-theme="${theme}"]`);
  if (themeBtn) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    themeBtn.classList.add('active');
  }

  requestAnimationFrame(() => {
    refreshChartsForTheme();
  });
}

// ── Settings ──────────────────────────────────────────────────
function updateProfileDropdown() {
  const profileNameLabel = document.getElementById('profileNameLabel');
  const profileEmailLabel = document.getElementById('profileEmailLabel');

  if (!profileNameLabel || !profileEmailLabel) return;

  const displayName = localStorage.getItem('displayName') || 'Admin User';
  const userEmail = localStorage.getItem('userEmail') || 'admin@painpoint.ai';

  profileNameLabel.textContent = displayName;
  profileEmailLabel.textContent = userEmail;
}

function toggleProfileDropdown() {
  const profileDropdown = document.getElementById('profileDropdown');
  if (!profileDropdown) return;

  const willOpen = profileDropdown.classList.contains('hidden');
  if (willOpen) {
    updateProfileDropdown();
    profileDropdown.classList.remove('hidden');
  } else {
    profileDropdown.classList.add('hidden');
  }
}

function closeProfileDropdown() {
  const profileDropdown = document.getElementById('profileDropdown');
  if (!profileDropdown) return;
  profileDropdown.classList.add('hidden');
}

function openSettings() {
  closeProfileDropdown();
  document.getElementById('settingsModal').classList.remove('hidden');
  
  // Load all current values
  const apiKey = localStorage.getItem('groqApiKey') || '';
  const backendUrl = localStorage.getItem('backendUrlInput') || DEFAULT_API_BASE;
  const themeMode = localStorage.getItem('themeMode') || 'auto';
  const displayName = localStorage.getItem('displayName') || '';
  const userEmail = localStorage.getItem('userEmail') || '';
  const accentColor = localStorage.getItem('accentColor') || '#00d9ff';
  const fontSize = localStorage.getItem('fontSize') || 'medium';
  const animationsEnabled = localStorage.getItem('animationsEnabled') !== 'false';
  const modelSelect = localStorage.getItem('modelSelect') || 'llama3';
  const responseStyle = localStorage.getItem('responseStyle') || 'balanced';
  const streamToggle = localStorage.getItem('streamToggle') !== 'false';
  const confidenceToggle = localStorage.getItem('confidenceToggle') !== 'false';
  const exportFormat = localStorage.getItem('exportFormat') || 'pdf';
  const autoSaveToggle = localStorage.getItem('autoSaveToggle') !== 'false';
  const performanceMode = localStorage.getItem('performanceMode') || 'balanced';
  const notifyToggle = localStorage.getItem('notifyToggle') !== 'false';
  const soundToggle = localStorage.getItem('soundToggle') !== 'false';

  // Populate form fields
  document.getElementById('apiKeyInput').value = apiKey;
  document.getElementById('backendUrlInput').value = backendUrl;
  document.getElementById('displayName').value = displayName;
  document.getElementById('userEmail').value = userEmail;
  document.getElementById('accentColorPicker').value = accentColor;
  document.getElementById('fontSizeSelect').value = fontSize;
  document.getElementById('toggleAnimations').checked = animationsEnabled;
  document.getElementById('modelSelect').value = modelSelect;
  document.getElementById('responseStyle').value = responseStyle;
  document.getElementById('streamToggle').checked = streamToggle;
  document.getElementById('confidenceToggle').checked = confidenceToggle;
  document.getElementById('exportFormat').value = exportFormat;
  document.getElementById('autoSaveToggle').checked = autoSaveToggle;
  document.getElementById('performanceMode').value = performanceMode;
  document.getElementById('notifyToggle').checked = notifyToggle;
  document.getElementById('soundToggle').checked = soundToggle;

  // Set active theme button
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeMode);
  });
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
  // Save API settings
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const backendUrl = document.getElementById('backendUrlInput').value.trim();
  
  if (apiKey) localStorage.setItem('groqApiKey', apiKey);
  if (backendUrl) localStorage.setItem('backendUrlInput', backendUrl);
  API_BASE = resolveApiBaseUrl();

  // Save appearance settings
  const accentColor = document.getElementById('accentColorPicker').value;
  localStorage.setItem('accentColor', accentColor);

  const fontSize = document.getElementById('fontSizeSelect').value;
  localStorage.setItem('fontSize', fontSize);

  const animationsEnabled = document.getElementById('toggleAnimations').checked;
  localStorage.setItem('animationsEnabled', animationsEnabled ? 'true' : 'false');

  // Save AI settings
  localStorage.setItem('modelSelect', document.getElementById('modelSelect').value);
  localStorage.setItem('responseStyle', document.getElementById('responseStyle').value);
  localStorage.setItem('streamToggle', document.getElementById('streamToggle').checked ? 'true' : 'false');
  localStorage.setItem('confidenceToggle', document.getElementById('confidenceToggle').checked ? 'true' : 'false');

  // Save data settings
  localStorage.setItem('exportFormat', document.getElementById('exportFormat').value);
  localStorage.setItem('autoSaveToggle', document.getElementById('autoSaveToggle').checked ? 'true' : 'false');

  // Save system settings
  localStorage.setItem('performanceMode', document.getElementById('performanceMode').value);
  localStorage.setItem('notifyToggle', document.getElementById('notifyToggle').checked ? 'true' : 'false');
  localStorage.setItem('soundToggle', document.getElementById('soundToggle').checked ? 'true' : 'false');

  closeSettings();
  checkApiHealth();
  
  showNotification('Settings saved successfully!', 'success');
}

function loadSettings() {
  API_BASE = resolveApiBaseUrl();

  // Load theme
  const savedTheme = localStorage.getItem('themeMode') || 'auto';
  applyTheme(savedTheme);

  // Load avatar
  const savedAvatar = localStorage.getItem('userAvatar');
  if (savedAvatar) {
    const userAvatarImg = document.getElementById('userAvatarImg');
    if (userAvatarImg) {
      userAvatarImg.src = savedAvatar;
    }
  }

  // Load accent color
  const accentColor = localStorage.getItem('accentColor') || '#00d9ff';
  applyAccentColor(accentColor);

  // Load font size
  const fontSize = localStorage.getItem('fontSize') || 'medium';
  applyFontSize(fontSize);

  // Load animations toggle
  const animationsEnabled = localStorage.getItem('animationsEnabled') !== 'false';
  applyAnimationToggle(animationsEnabled);

  // Load performance mode
  const performanceMode = localStorage.getItem('performanceMode') || 'balanced';
  applyPerformanceMode(performanceMode);
}
// ── Accent Color Live Preview ─────────────────────────────────
function applyAccentColor(color) {
  document.documentElement.style.setProperty('--primary', color);
  localStorage.setItem('accentColor', color);
}

// ── Font Size Control ──────────────────────────────────────────
function applyFontSize(size) {
  const htmlElement = document.documentElement;
  
  const fontSizeMap = {
    small: 0.9,
    medium: 1,
    large: 1.1
  };
  
  const scale = fontSizeMap[size] || 1;
  htmlElement.style.fontSize = (16 * scale) + 'px';
  localStorage.setItem('fontSize', size);
}

// ── Animation Toggle ───────────────────────────────────────────
function applyAnimationToggle(enabled) {
  const htmlElement = document.documentElement;
  
  if (!enabled) {
    htmlElement.style.setProperty('--transition', 'none');
    document.querySelectorAll('[style*="animation"]').forEach(el => {
      el.style.animationPlayState = 'paused';
    });
  } else {
    htmlElement.style.setProperty('--transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)');
    document.querySelectorAll('[style*="animation"]').forEach(el => {
      el.style.animationPlayState = 'running';
    });
  }
  
  localStorage.setItem('animationsEnabled', enabled ? 'true' : 'false');
}

// ── Performance Mode ───────────────────────────────────────────
function applyPerformanceMode(mode) {
  const htmlElement = document.documentElement;
  
  if (mode === 'low') {
    htmlElement.style.setProperty('--blur', 'blur(5px)');
  } else if (mode === 'high') {
    htmlElement.style.setProperty('--blur', 'blur(30px)');
  } else {
    htmlElement.style.setProperty('--blur', 'blur(20px)');
  }
  
  localStorage.setItem('performanceMode', mode);
}

// ── Avatar Upload (Settings Modal) ────────────────────────────
function handleAvatarUploadSettings(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showNotification('Please select a valid image file', 'error');
    return;
  }

  const reader = new FileReader();
  
  reader.onload = (event) => {
    const imageData = event.target.result;
    localStorage.setItem('userAvatar', imageData);
    
    const userAvatarImg = document.getElementById('userAvatarImg');
    if (userAvatarImg) {
      userAvatarImg.src = imageData;
    }
    
    showNotification('Profile picture updated', 'success');
  };

  reader.onerror = () => {
    showNotification('Error reading file. Please try again.', 'error');
  };

  reader.readAsDataURL(file);
  e.target.value = '';
}

// ── Reset Avatar ──────────────────────────────────────────────
function resetAvatar() {
  localStorage.removeItem('userAvatar');
  const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin';
  const userAvatarImg = document.getElementById('userAvatarImg');
  if (userAvatarImg) {
    userAvatarImg.src = defaultAvatar;
  }
  showNotification('Avatar reset to default', 'success');
}

// ── API Connection Test ─────────────────────────────────────────
async function testApiConnection() {
  const backendUrl = document.getElementById('backendUrlInput').value.trim();

  if (!backendUrl) {
    showNotification('Please enter a Backend URL', 'error');
    return;
  }

  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.style.display = 'block';
  statusDiv.textContent = 'Testing connection...';
  statusDiv.style.color = 'var(--text-muted)';

  try {
    const response = await fetch(`${normalizeApiBase(backendUrl)}/api/health`);

    if (response.ok) {
      const data = await response.json();
      statusDiv.textContent = '✓ Connection successful!';
      statusDiv.style.color = 'var(--success)';
      showNotification('API connection verified', 'success');
    } else {
      statusDiv.textContent = '✗ Connection failed (Invalid credentials)';
      statusDiv.style.color = 'var(--error)';
      showNotification('Connection failed', 'error');
    }
  } catch (err) {
    statusDiv.textContent = '✗ Connection failed (' + err.message + ')';
    statusDiv.style.color = 'var(--error)';
    showNotification('Connection error: ' + err.message, 'error');
  }
}

// ── Reset API Config ──────────────────────────────────────────
function resetApiConfig() {
  if (confirm('Reset API configuration? You\'ll need to enter it again.')) {
    localStorage.removeItem('groqApiKey');
    localStorage.removeItem('backendUrlInput');
    document.getElementById('apiKeyInput').value = '';
    document.getElementById('backendUrlInput').value = DEFAULT_API_BASE;
    API_BASE = resolveApiBaseUrl();
    document.getElementById('connectionStatus').style.display = 'none';
    showNotification('API config reset', 'success');
  }
}

// ── Clear All Data ────────────────────────────────────────────
function clearAllData() {
  if (confirm('Clear all analysis data? This cannot be undone.')) {
    analysisData = null;
    allResults = [];
    localStorage.removeItem('analysisResults');
    localStorage.removeItem('allResults');
    document.getElementById('emptyState')?.classList.remove('hidden');
    document.getElementById('statsGrid')?.classList.add('hidden');
    document.getElementById('chartsRow')?.classList.add('hidden');
    document.getElementById('intelligenceRow')?.classList.add('hidden');
    showNotification('All data cleared', 'success');
  }
}

// ── Download Logs ──────────────────────────────────────────────
function downloadLogs() {
  const logs = {
    timestamp: new Date().toISOString(),
    analysisData: analysisData,
    allResults: allResults,
    settings: {
      theme: localStorage.getItem('themeMode'),
      model: localStorage.getItem('modelSelect'),
      responseStyle: localStorage.getItem('responseStyle'),
      performanceMode: localStorage.getItem('performanceMode'),
      exportFormat: localStorage.getItem('exportFormat'),
      displayName: localStorage.getItem('displayName')
    }
  };

  const dataStr = JSON.stringify(logs, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `painpoint-logs-${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Logs downloaded', 'success');
}

// ── Factory Reset ──────────────────────────────────────────────
function factoryReset() {
  if (confirm('This will reset ALL settings to default. Continue?')) {
    // Clear all localStorage except auth
    const authToken = localStorage.getItem('authToken');
    localStorage.clear();
    if (authToken) localStorage.setItem('authToken', authToken);
    
    // Reload page
    window.location.reload();
  }
}

// ── Notification Helper ────────────────────────────────────────
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--info)'};
    color: white;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-size: 0.9rem;
    font-weight: 600;
    z-index: 3000;
    animation: slideInUp 0.3s ease;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutDown 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
// ── Loading Overlay ───────────────────────────────────────────
function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
  document.getElementById('progressFill').style.width = '0%';
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function updateLoadingStep(text, progress) {
  document.getElementById('loadingStep').textContent = text;
  document.getElementById('progressFill').style.width = progress + '%';
}

// ── Background Particles ──────────────────────────────────────
function generateParticles() {
  const container = document.getElementById('bgParticles');
  if (!container) return;
  
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = Math.random() * 4 + 2 + 'px';
    particle.style.height = particle.style.width;
    particle.style.background = 'rgba(0, 217, 255, 0.3)';
    particle.style.borderRadius = '50%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animation = `float ${Math.random() * 10 + 10}s linear infinite`;
    particle.style.animationDelay = Math.random() * 5 + 's';
    particle.style.opacity = Math.random() * 0.5 + 0.2;
    container.appendChild(particle);
  }
}

// ── Utilities ─────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}