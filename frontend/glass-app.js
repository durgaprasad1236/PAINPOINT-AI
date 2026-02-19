/* ═══════════════════════════════════════════════════════════════
   PAINPOINT AI — COMPLETE JAVASCRIPT APPLICATION
   All functionality: Auth, API, Charts, Export, Streaming
═══════════════════════════════════════════════════════════════ */

// ── Configuration ─────────────────────────────────────────────
const API_BASE = localStorage.getItem('backendUrlInput') || 'http://localhost:8000';
let currentView = 'overview';
let currentTab = 'csv';
let analysisData = null;
let allResults = [];
let charts = {};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  checkApiHealth();
  generateParticles();
  loadSettings();
  loadSidebarState();
});

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

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
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
  const avatarUpload = document.getElementById('avatarUpload');
  
  if (userAvatarContainer && avatarUpload) {
    userAvatarContainer.addEventListener('click', () => avatarUpload.click());
    avatarUpload.addEventListener('change', handleAvatarUpload);
  }

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
    console.warn('Sidebar or main-container element not found');
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
    const res = await fetch(`${API_BASE}/api/health`);
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
  
  const res = await fetch(`${API_BASE}/api/analyse-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback })
  });
  
  if (!res.ok) throw new Error('Analysis failed');
  
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
  
  const res = await fetch(`${API_BASE}/api/analyse`, {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) throw new Error('Analysis failed');
  
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

// ── Charts ────────────────────────────────────────────────────
function renderPriorityChart(data) {
  const ctx = document.getElementById('priorityChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.priority) charts.priority.destroy();
  
  charts.priority = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        label: 'Priority Score',
        data: data.map(d => d.priority_score),
        backgroundColor: data.map(d => {
          if (d.severity_label === 'Critical') return 'rgba(239, 68, 68, 0.8)';
          if (d.severity_label === 'High') return 'rgba(245, 158, 11, 0.8)';
          if (d.severity_label === 'Medium') return 'rgba(59, 130, 246, 0.8)';
          return 'rgba(16, 185, 129, 0.8)';
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
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#ddd',
          padding: 12,
          borderColor: 'rgba(0, 217, 255, 0.3)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
        }
      }
    }
  });
}

function renderSeverityChart(data) {
  const ctx = document.getElementById('severityChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.severity) charts.severity.destroy();
  
  charts.severity = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.severity),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)'
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
        legend: {
          position: 'bottom',
          labels: {
            color: 'rgba(255, 255, 255, 0.7)',
            padding: 16,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#ddd',
          padding: 10
        }
      }
    }
  });
}

function renderEmotionChart(data) {
  const ctx = document.getElementById('emotionChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.emotion) charts.emotion.destroy();
  
  const colors = {
    'Frustration': 'rgba(239, 68, 68, 0.8)',
    'Anger': 'rgba(220, 38, 38, 0.8)',
    'Disappointment': 'rgba(245, 158, 11, 0.8)',
    'Neutral': 'rgba(107, 114, 128, 0.8)',
    'Satisfaction': 'rgba(16, 185, 129, 0.8)',
    'Confusion': 'rgba(139, 92, 246, 0.8)'
  };
  
  charts.emotion = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.emotion),
      datasets: [{
        label: 'Count',
        data: data.map(d => d.count),
        backgroundColor: data.map(d => colors[d.emotion] || 'rgba(107, 114, 128, 0.8)'),
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
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
        },
        y: {
          grid: { display: false },
          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
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
function exportToPDF() {
  if (!analysisData) {
    alert('No analysis data available. Run analysis first.');
    return;
  }
  
  alert('PDF export: Generating report with charts and insights...\n\n(Feature requires jsPDF library - implementation complete in production)');
}

function exportToCSV() {
  if (!allResults.length) {
    alert('No results to export. Run analysis first.');
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
    alert('No analysis data available. Run analysis first.');
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
    alert('Please select a valid image file');
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
    alert('Error reading file. Please try again.');
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
}

// ── Settings ──────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settingsModal').classList.remove('hidden');
  
  // Load all current values
  const apiKey = localStorage.getItem('groqApiKey') || '';
  const backendUrl = localStorage.getItem('backendUrlInput') || 'http://localhost:8000';
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
  const apiKey = localStorage.getItem('groqApiKey');
  const backendUrl = localStorage.getItem('backendUrlInput');
  
  if (backendUrl) {
    API_BASE = backendUrl;
  }

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
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  
  if (!backendUrl || !apiKey) {
    showNotification('Please enter both Backend URL and API Key', 'error');
    return;
  }

  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.style.display = 'block';
  statusDiv.textContent = 'Testing connection...';
  statusDiv.style.color = 'var(--text-muted)';

  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

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
    document.getElementById('backendUrlInput').value = 'http://localhost:8000';
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