
    let techs = [];
    let tickets = [];
    let timerInterval = null;
    let timerRunning = false;
    let editingTechId = null;
    let selectedTechs = [];
    let isResetting = false;
    let currentPage = 1;
    const itemsPerPage = 10;
    let filteredTickets = [];
    

    function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


        function notif(msg, type='info') {
            const c = document.getElementById('notifContainer');
            const el = document.createElement('div');
            el.className = `notif ${type}`;
            el.innerHTML = `<span>${msg}</span><button class="close" onclick="this.parentElement.remove()">×</button>`;
            c.appendChild(el);
            setTimeout(() => { if(el.parentElement) el.remove(); }, 5000);
        }

       

 function switchTab(tab) {
    console.log('Switch tab ke:', tab);
    
    // TUTUP SIDEBAR
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
    
    document.querySelectorAll('.sidebar .nav-item').forEach(function(el) {
        el.classList.remove('active');
    });
    
    var targetNav = document.querySelector('.sidebar .nav-item[data-tab="' + tab + '"]');
    if (targetNav) targetNav.classList.add('active');
    
    var dashboardSection = document.getElementById('dashboardSection');
    var ticketSection = document.getElementById('ticketSection');
    var technicianSection = document.getElementById('technicianSection');
    var reportsSection = document.getElementById('reportsSection');
    var rekapSection = document.getElementById('rekapSection');
    var psbSection = document.getElementById('psbSection');
    
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (ticketSection) ticketSection.style.display = 'none';
    if (technicianSection) technicianSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'none';
    if (rekapSection) rekapSection.style.display = 'none';
    
    var pageTitle = document.querySelector('.top-bar h1');
    
    if (tab === 'dashboard') {
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📊 Dashboard';
            renderDashboard();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'tickets') {
        if (ticketSection) {
            ticketSection.style.display = 'block';
            renderTickets(null, 1);
            if (pageTitle) pageTitle.innerHTML = '📋 Tiket';
            window.scrollTo(0, 0);
        }
    } else if (tab === 'psb') {
        if (psbSection) {
            psbSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '🔌 Pasang Baru (PSB)';
            renderPsb();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'technicians') {
        if (technicianSection) {
            technicianSection.style.display = 'block';
            renderTechList();
            renderPerformance();
            if (pageTitle) pageTitle.innerHTML = '👨‍🔧 Teknisi';
            window.scrollTo(0, 0);
        }
    } else if (tab === 'reports') {
        if (reportsSection) {
            reportsSection.style.display = 'block';
            renderReports();
            if (pageTitle) pageTitle.innerHTML = '📊 Laporan';
            window.scrollTo(0, 0);
        }
    } else if (tab === 'rekap') {
        if (rekapSection) {
            rekapSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📋 Rekap Harian';
            populateRekapTeknisi();
            setRekapDefaultDate();
            renderRekap();
            window.scrollTo(0, 0);
        }
    }
}

    function updateJenisGangguan() {
    const jenisTiket = document.getElementById('jenisTiket').value;
    const selectGangguan = document.getElementById('jenisGangguan');
    const keteranganGroup = document.getElementById('keteranganGamasGroup');
    const odpGroup = document.getElementById('odpGroup');
    const odpInput = document.getElementById('odpPelanggan');
    
    if (jenisTiket === 'PSB') {
        // KOSONGKAN DAN NONAKTIFKAN JENIS GANGGUAN
        selectGangguan.innerHTML = `<option value="">-</option>`;
        selectGangguan.value = '';
        selectGangguan.disabled = true;
        selectGangguan.style.background = '#f1f5f9';
        selectGangguan.style.cursor = 'not-allowed';
        selectGangguan.style.color = '#94a3b8';

        if (keteranganGroup) keteranganGroup.style.display = 'none';
        if (odpGroup) {
            odpGroup.style.display = 'none';
            if (odpInput) odpInput.value = '';
            odpInput.required = false;
        }
    } else if (jenisTiket === 'GGN') {
        selectGangguan.innerHTML = `
            <option value="Ganti Adaptor">Ganti Adaptor</option>
            <option value="Ganti HTB">Ganti HTB</option>
            <option value="Ganti Modem">Ganti Modem</option>
            <option value="Ganti Sandi">Ganti Sandi</option>
            <option value="Internet lambat">Internet lambat</option>
            <option value="Kabel Putus (LOS)">Kabel Putus (LOS)</option>
            <option value="Kabel Terjuntai">Kabel Terjuntai</option>
            <option value="Pindah Modem">Pindah Modem</option>
            <option value="Tidak Ada Koneksi Internet">Tidak Ada Koneksi Internet</option>
        `;
        selectGangguan.value = 'Kabel Putus (LOS)';
        selectGangguan.disabled = false;
        selectGangguan.style.background = 'white';
        selectGangguan.style.cursor = 'default';
        selectGangguan.style.color = 'inherit';
        if (keteranganGroup) keteranganGroup.style.display = 'none';
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpInput.placeholder = 'Contoh: ODP-001 / ID-12345 / Jl. Merdeka';
        }
    } else if (jenisTiket === 'GAMAS') {
        selectGangguan.innerHTML = `
            <option value="GAMAS FEEDER">GAMAS FEEDER</option>
            <option value="GAMAS DISTRIBUSI">GAMAS DISTRIBUSI</option>
        `;
        selectGangguan.value = 'GAMAS FEEDER';
        selectGangguan.disabled = false;
        selectGangguan.style.background = 'white';
        selectGangguan.style.cursor = 'default';
        selectGangguan.style.color = 'inherit';
        if (keteranganGroup) keteranganGroup.style.display = 'block';
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpInput.placeholder = 'Contoh: ODP-001 / Wilayah Selatan';
        }
    } else if (jenisTiket === 'PROJECT') {
        selectGangguan.innerHTML = `
            <option value="PROJECT">PROJECT</option>
        `;
        selectGangguan.value = 'PROJECT';
        selectGangguan.disabled = false;
        selectGangguan.style.background = 'white';
        selectGangguan.style.cursor = 'default';
        selectGangguan.style.color = 'inherit';
        if (keteranganGroup) keteranganGroup.style.display = 'none';
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpInput.placeholder = 'Contoh: Project A / Lokasi B';
        }
    }
}

// ===== LOGIN =====
async function handleLogin() {
    var user = document.getElementById('loginUsername').value.trim();
    var pass = document.getElementById('loginPassword').value.trim();
    var err = document.getElementById('loginError');
    
    if (!user || !pass) {
        err.style.display = 'block';
        err.textContent = '⚠️ Username dan password wajib diisi!';
        return;
    }
    
    try {
        // CEK KE SUPABASE
        const { data, error } = await sb
            .from('users')
            .select('*')
            .eq('username', user)
            .eq('password', pass)
            .maybeSingle();
        
        if (error) {
            console.error('Error login:', error);
            err.style.display = 'block';
            err.textContent = '⚠️ Terjadi kesalahan sistem!';
            return;
        }
        
        if (data) {
            err.style.display = 'none';
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            localStorage.setItem('user_session', JSON.stringify({
                username: data.username,
                role: data.role || 'user'
            }));
            location.reload();
        } else {
            err.style.display = 'block';
            err.textContent = '⚠️ Username atau password salah!';
        }
    } catch (e) {
        console.error('Login error:', e);
        err.style.display = 'block';
        err.textContent = '⚠️ Terjadi kesalahan!';
    }
}




// ===== AUTO LOGOUT 15 MENIT =====
let logoutTimer = null;
const LOGOUT_TIME = 15 * 60 * 1000; // 15 menit dalam milidetik

function resetLogoutTimer() {
    // Hapus timer lama
    if (logoutTimer) {
        clearTimeout(logoutTimer);
        logoutTimer = null;
    }
    
    // Cek apakah user sedang login
    const session = localStorage.getItem('user_session');
    if (session !== 'logged') return;
    
    // Set timer baru
    logoutTimer = setTimeout(function() {
        Swal.fire({
            icon: 'warning',
            title: '⏰ Sesi Habis',
            text: 'Anda telah tidak aktif selama 15 menit. Silakan login kembali.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#2563eb',
            allowOutsideClick: false
        }).then(function() {
            handleLogout();
        });
    }, LOGOUT_TIME);
    
    console.log('⏳ Timer logout direset, 15 menit lagi');
}

// Reset timer saat ada aktivitas
function resetTimerOnActivity() {
    resetLogoutTimer();
}

// Daftarkan event listener untuk aktivitas user
document.addEventListener('DOMContentLoaded', function() {
    // Event yang menandakan user aktif
    const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart', 'input', 'change'];
    events.forEach(function(event) {
        document.addEventListener(event, resetTimerOnActivity);
    });
});

// Override fungsi handleLogin - mulai timer setelah login
const originalHandleLogin = handleLogin;
handleLogin = function() {
    originalHandleLogin();
    // Jika login berhasil, mulai timer
    if (localStorage.getItem('user_session') === 'logged') {
        resetLogoutTimer();
    }
};

// Override fungsi handleLogout - bersihkan timer
const originalHandleLogout = handleLogout;
handleLogout = function() {
    if (logoutTimer) {
        clearTimeout(logoutTimer);
        logoutTimer = null;
    }
    originalHandleLogout();
};

// Reset timer saat switch tab menu
const originalSwitchTab = switchTab;
switchTab = function(tab) {
    originalSwitchTab(tab);
    resetLogoutTimer();
};

// Reset timer saat buat tiket
const originalAddTicket = addTicket;
addTicket = function() {
    originalAddTicket();
    resetLogoutTimer();
};

// Reset timer saat close tiket
const originalCloseticket = closeticket;
closeticket = function(docId) {
    originalCloseticket(docId);
    resetLogoutTimer();
};

// Reset timer saat pending tiket
const originalPendingTicket = pendingTicket;
pendingTicket = function(docId) {
    originalPendingTicket(docId);
    resetLogoutTimer();
};


// AUTO LOGIN - PASTIKAN ELEMENT SUDAH ADA
document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('user_session') === 'logged') {
        var loginPage = document.getElementById('loginPage');
        var mainApp = document.getElementById('mainApp');
        if (loginPage) loginPage.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
    }
});

// LOGOUT
function handleLogout() {
    localStorage.removeItem('user_session');
    location.reload();
}

// EVENT LISTENER UNTUK TOMBOL LOGIN
document.addEventListener('DOMContentLoaded', function() {
    // Tombol login
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    // Enter key
    const passwordInput = document.getElementById('loginPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
    const usernameInput = document.getElementById('loginUsername');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
    
    // Cek session
    const session = localStorage.getItem('user_session');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            if (sessionData.username) {
                document.getElementById('loginPage').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                document.body.style.background = '#eef2f6';
                setTimeout(function() {
                    loadTechniciansCache();
                    setupRealtime();
                }, 300);
            }
        } catch(e) {}
    }
});

// VARIABEL GLOBAL UNTUK PAGINATION DASHBOARD
let dashCurrentPage = 1;
const dashItemsPerPage = 5;

function renderDashboard() {
    // AMBIL FILTER
    const dateFrom = document.getElementById('dashFilterDate') ? document.getElementById('dashFilterDate').value : '';
    const dateTo = document.getElementById('dashFilterDateTo') ? document.getElementById('dashFilterDateTo').value : '';
    const jenisFilter = document.getElementById('dashFilterJenis') ? document.getElementById('dashFilterJenis').value : 'all';
    
    const today = new Date();
    document.getElementById('currentDate').textContent = today.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
    
    // FILTER TIKET
    let filteredTickets = [];
    
    if (!tickets || tickets.length === 0) {
        document.getElementById('dashTotalTickets').textContent = '0';
        document.getElementById('dashOpenTickets').textContent = '0';
        document.getElementById('dashClosedTickets').textContent = '0';
        document.getElementById('dashGamasTickets').textContent = '0';
        document.getElementById('dashGaulTickets').textContent = '0';
        document.getElementById('dashTicketBody').innerHTML = '<tr><td colspan="7"><div class="empty">Belum ada data</div></td></tr>';
        document.getElementById('dashTicketCount').textContent = '0 tiket';
        document.getElementById('dashPagination').innerHTML = '';
        return;
    }
    
    // FILTER TANGGAL
    if (dateFrom || dateTo) {
        filteredTickets = tickets.filter(t => {
            if (!t.createdAt) return false;
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
        });
    } else {
        const todayStr = today.toISOString().split('T')[0];
        filteredTickets = tickets.filter(t => {
            if (!t.createdAt) return false;
            const d = new Date(t.createdAt);
            return d.toISOString().split('T')[0] === todayStr;
        });
    }
    
    // FILTER JENIS TIKET
    if (jenisFilter !== 'all') {
        filteredTickets = filteredTickets.filter(t => {
            const jenis = t.jenistiket || '';
            return jenis === jenisFilter;
        });
    }
    
    // ===== HITUNG =====
    const totalTickets = filteredTickets.length;
    const openCount = filteredTickets.filter(t => t.status === 'open').length;
    const closeCount = filteredTickets.filter(t => t.status === 'close').length;
    
    // GAMAS
    const gamasCount = filteredTickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        return jenisTiket === 'GAMAS';
    }).length;
    
    // GAUL
    const gaulSet = new Set();
    filteredTickets.forEach(t => {
        const customerName = t.customer;
        const history = tickets.filter(t2 => {
            if (t2.customer !== customerName) return false;
            if (t2.id === t.id) return false;
            return true;
        });
        if (history.length > 0) {
            gaulSet.add(customerName);
        }
    });
    const gaulCount = gaulSet.size;
    
    // UPDATE CARD
    document.getElementById('dashTotalTickets').textContent = totalTickets;
    document.getElementById('dashOpenTickets').textContent = openCount;
    document.getElementById('dashClosedTickets').textContent = closeCount;
    document.getElementById('dashGamasTickets').textContent = gamasCount;
    document.getElementById('dashGaulTickets').textContent = gaulCount;
    
    // ===== TIKET TERBARU DENGAN PAGINATION =====
    const sortedTickets = [...filteredTickets].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    const totalItems = sortedTickets.length;
    const totalPages = Math.ceil(totalItems / dashItemsPerPage) || 1;
    
    if (dashCurrentPage < 1) dashCurrentPage = 1;
    if (dashCurrentPage > totalPages) dashCurrentPage = totalPages;
    
    const startIndex = (dashCurrentPage - 1) * dashItemsPerPage;
    const endIndex = Math.min(startIndex + dashItemsPerPage, totalItems);
    const pageData = sortedTickets.slice(startIndex, endIndex);
    
    const body = document.getElementById('dashTicketBody');
    document.getElementById('dashTicketCount').textContent = filteredTickets.length + ' tiket (Halaman ' + dashCurrentPage + '/' + totalPages + ')';
    
    if (pageData.length === 0) {
        body.innerHTML = '<tr><td colspan="7"><div class="empty">Tidak ada tiket</div></td></tr>';
    } else {
        body.innerHTML = pageData.map(t => {
            const jenisTiket = t.jenistiket || '-';
            const isGamas = jenisTiket === 'GAMAS';
            const jenisBadge = isGamas 
                ? '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#dc2626;color:white;">GAMAS</span>' 
                : '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#2563eb;color:white;">REGULER</span>';
            
            const statusMap = {
                'open': '🔴 OPEN',
                'pending': '⏸ PENDING',
                'close': '✅ CLOSE'
            };
            
            return `
            <tr>
                <td>${formatDate(t.createdAt)}</td>
                <td>${jenisBadge}</td>
                <td><strong>${t.ticketid}</strong></td>
                <td>${t.customer}</td>
                <td>${t.jenisgangguan || '-'}</td>
                <td><span class="badge-status ${t.status}">${statusMap[t.status] || t.status}</span></td>
                <td>${(t.technicians || []).join(', ') || '-'}</td>
            </tr>
        `;
        }).join('');
    }
    
    // PAGINATION
    renderDashPagination(totalItems, totalPages);
    
    // CHART
    renderDashboardCharts(filteredTickets);
    renderGrafikHarianWithFilter(filteredTickets);
}

// ===== PAGINATION DASHBOARD =====
function renderDashPagination(totalItems, totalPages) {
    const container = document.getElementById('dashPagination');
    if (!container) return;
    
    if (totalItems <= dashItemsPerPage) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    
    // PREV
    if (dashCurrentPage > 1) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToDashPage(${dashCurrentPage - 1})">◀ Prev</button>`;
    }
    
    // NUMBER
    for (let i = 1; i <= totalPages; i++) {
        if (i === dashCurrentPage) {
            html += `<button class="btn btn-primary btn-sm" style="background:#2563eb;color:white;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;">${i}</button>`;
        } else {
            html += `<button class="btn btn-outline btn-sm" onclick="goToDashPage(${i})" style="background:transparent;border:1px solid #cbd5e1;border-radius:6px;padding:4px 12px;cursor:pointer;">${i}</button>`;
        }
    }
    
    // NEXT
    if (dashCurrentPage < totalPages) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToDashPage(${dashCurrentPage + 1})">Next ▶</button>`;
    }
    
    html += '</div>';
    
    // INFO
    const startItem = (dashCurrentPage - 1) * dashItemsPerPage + 1;
    const endItem = Math.min(dashCurrentPage * dashItemsPerPage, totalItems);
    html += `<span style="font-size:13px;color:#64748b;">Menampilkan ${startItem}-${endItem} dari ${totalItems}</span>`;
    
    container.innerHTML = html;
}

// ===== GO TO PAGE DASHBOARD =====
function goToDashPage(page) {
    dashCurrentPage = page;
    renderDashboard();
}

function resetDashboardStats() {
    document.getElementById('dashTotalTickets').textContent = '0';
    document.getElementById('dashOpenTickets').textContent = '0';
    document.getElementById('dashClosedTickets').textContent = '0';
    document.getElementById('dashGamasTickets').textContent = '0';
    document.getElementById('dashOverdueTickets').textContent = '0';
    document.getElementById('dashGaulTickets').textContent = '0';
    document.getElementById('dashTicketBody').innerHTML = '<tr><td colspan="7"><div class="empty">Belum ada data</div></td></tr>';
    document.getElementById('dashTicketCount').textContent = '0 tiket';
}

function renderDashboardCharts(filteredTickets) {
    // CHART JENIS GANGGUAN
    const gMap = {};
    filteredTickets.forEach(t => {
        var jenis = t.jenisgangguan || 'Tidak diketahui';
        var jenisTiket = t.jenistiket || '';
        
        if (jenisTiket === 'GAMAS') {
            if (jenis === 'GAMAS FEEDER') {
                jenis = 'GAMAS FEEDER';
            } else if (jenis === 'GAMAS DISTRIBUSI') {
                jenis = 'GAMAS DISTRIBUSI';
            } else {
                jenis = 'GAMAS';
            }
        }
        
        gMap[jenis] = (gMap[jenis] || 0) + 1;
    });
    const sortedG = Object.entries(gMap).sort((a,b) => b[1] - a[1]);
    
    if (window.dashJenisChartInstance) {
        window.dashJenisChartInstance.destroy();
    }
    const ctx1 = document.getElementById('dashJenisChart').getContext('2d');
    window.dashJenisChartInstance = new Chart(ctx1, {
        type: 'pie',
        data: {
            labels: sortedG.length > 0 ? sortedG.map(g => g[0]) : ['Belum ada data'],
            datasets: [{
                data: sortedG.length > 0 ? sortedG.map(g => g[1]) : [1],
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 11 } } }
            }
        }
    });
    
    // CHART PRODUKTIVITAS TEKNISI
    const techMap = {};
    techs.forEach(t => { techMap[t.name] = { total: 0, tepatWaktu: 0 }; });
    
    filteredTickets.forEach(t => {
        (t.technicians || []).forEach(tech => {
            if (techMap[tech]) {
                techMap[tech].total++;
                if (t.status === 'close') {
                    const ttr = t.ttr || 0;
                    if (ttr <= t.duration) techMap[tech].tepatWaktu++;
                }
            }
        });
    });
    
    const sortedTech = Object.entries(techMap)
        .sort((a, b) => b[1].total - a[1].total);
    
    if (window.dashProdChartInstance) {
        window.dashProdChartInstance.destroy();
    }
    const ctx2 = document.getElementById('dashProdChart').getContext('2d');
    window.dashProdChartInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: sortedTech.map(t => t[0]),
            datasets: [{
                label: 'Produktivitas (%)',
                data: sortedTech.map(([name, data]) => 
                    data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0
                ),
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: function(value) { return value + '%'; } }
                }
            }
        }
    });
}

function renderGrafikHarianWithFilter(filteredTickets) {
    var canvas = document.getElementById('grafikHarianChart');
    if (!canvas) return;
    
    var periodeSelect = document.getElementById('grafikPeriode');
    var bulanSelect = document.getElementById('grafikBulan');
    var periode = periodeSelect ? periodeSelect.value : '1bulan';
    var bulanFilter = bulanSelect ? bulanSelect.value : '';
    
    var now = new Date();
    var start = new Date();
    if (periode === '1bulan') start.setMonth(start.getMonth() - 1);
    else if (periode === '3bulan') start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    
    // FILTER DARI VARIABEL GLOBAL tickets, TAPI BUANG PSB
    var dataTickets = tickets.filter(t => {
        if (!t.createdAt) return false;
        var jenis = t.jenistiket || '';
        if (jenis === 'PSB') return false; // BUANG PSB DARI GRAFIK GANGGUAN
        
        var d = new Date(t.createdAt);
        d.setHours(0, 0, 0, 0);
        return d >= start && d <= now;
    });
    
    if (bulanFilter !== '' && bulanFilter !== 'all') {
        var temp = [];
        for (var j = 0; j < dataTickets.length; j++) {
            var t2 = dataTickets[j];
            var d2 = new Date(t2.createdAt);
            if (d2.getMonth() == parseInt(bulanFilter)) temp.push(t2);
        }
        dataTickets = temp;
    }
    
    var dailyMap = {};
    dataTickets.forEach(t => {
        if (!t.createdAt) return;
        var d = new Date(t.createdAt);
        var key = d.toISOString().split('T')[0];
        dailyMap[key] = (dailyMap[key] || 0) + 1;
    });
    
    var labels = [];
    var data = [];
    var totalTiket = 0;
    var currentDate = new Date(start);
    var endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    while (currentDate <= endDate) {
        var key = currentDate.toISOString().split('T')[0];
        var day = currentDate.getDate();
        var month = currentDate.toLocaleDateString('id-ID', { month: 'short' });
        labels.push(day + ' ' + month);
        var count = dailyMap[key] || 0;
        data.push(count);
        totalTiket += count;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (window.grafikHarianInstance) {
        window.grafikHarianInstance.destroy();
        window.grafikHarianInstance = null;
    }
    
    var ctx = canvas.getContext('2d');
    var areaGradient = ctx.createLinearGradient(0, 0, 0, 300);
    areaGradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
    areaGradient.addColorStop(0.5, 'rgba(37, 99, 235, 0.15)');
    areaGradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');
    
    window.grafikHarianInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Tiket',
                data: data,
                borderColor: '#2563eb',
                backgroundColor: areaGradient,
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11, weight: '600' }, color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false } },
                x: { ticks: { font: { size: 9 }, color: '#64748b', maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } }
            },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 800, easing: 'easeInOutQuad' }
        }
    });
}



// ===== PSB SECTION =====
let psbCurrentPage = 1;
const psbItemsPerPage = 10;

async function renderPsb() {
    // AMBIL DATA TERBARU
    await refreshData(); 

    const body = document.getElementById('psbBody');
    const count = document.getElementById('psbCount');

    const dateFrom = document.getElementById('psbFilterDate').value;
    const dateTo = document.getElementById('psbFilterDateTo').value;
    const idFilter = document.getElementById('psbFilterId').value.trim().toLowerCase();
    const custFilter = document.getElementById('psbFilterCustomer').value.trim().toLowerCase();

    // 1. FILTER DATA PSB (TANPA BATASAN TANGGAL DEFAULT)
    let data = tickets.filter(t => {
        const jenis = t.jenistiket || '';
        if (jenis !== 'PSB') return false;

        if (dateFrom || dateTo) {
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
        }
        if (idFilter && !t.ticketid.toLowerCase().includes(idFilter)) return false;
        if (custFilter && !t.customer.toLowerCase().includes(custFilter)) return false;

        return true;
    });

    // 2. URUTKAN
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 3. HITUNG UNTUK CARD (BERDASARKAN FILTER YANG ADA)
    document.getElementById('psbTotal').textContent = data.length;
    document.getElementById('psbOpen').textContent = data.filter(t => t.status === 'open').length;
    document.getElementById('psbClosed').textContent = data.filter(t => t.status === 'close').length;

    // 4. PAGINATION
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / psbItemsPerPage) || 1;
    if (psbCurrentPage < 1) psbCurrentPage = 1;
    if (psbCurrentPage > totalPages) psbCurrentPage = totalPages;

    const start = (psbCurrentPage - 1) * psbItemsPerPage;
    const end = Math.min(start + psbItemsPerPage, totalItems);
    const pageData = data.slice(start, end);

    count.textContent = totalItems + ' tiket (Halaman ' + psbCurrentPage + '/' + totalPages + ')';

    // 5. RENDER TABEL
    if (totalItems === 0) {
        body.innerHTML = '<tr><td colspan="7"><div class="empty">Belum ada data PSB</div></td></tr>';
        document.getElementById('psbPagination').innerHTML = '';
        return;
    }

    body.innerHTML = pageData.map(t => {
        const statusLabel = t.status === 'close' ? '✅ CLOSE' : '🔴 OPEN';
        const statusClass = t.status === 'close' ? 'close' : 'open';
        const techDisplay = (t.technicians || []).join(', ') || '-';
        const isClosed = t.status === 'close';
        const odpPelanggan = t.odppelanggan || '-';

        return `
        <tr data-ticket-id="${t.id}">
            <td>${formatDate(t.createdAt)}</td>
            <td><strong>${t.ticketid}</strong></td>
            <td>${t.customer}</td>
            <td>${odpPelanggan}</td>
            <td>${techDisplay}</td>
            <td><span class="badge-status ${statusClass}">${statusLabel}</span></td>
            <td>
                ${!isClosed ? `<button class="btn btn-success btn-sm" onclick="closeticket('${t.id}')">Close</button>` : '-'}
            </td>
        </tr>
        `;
    }).join('');

    // 6. PAGINATION BUTTONS
    let html = '';
    if (totalPages > 1) {
        html = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        if (psbCurrentPage > 1) html += `<button class="btn btn-outline btn-sm" onclick="goToPsbPage(${psbCurrentPage - 1})">◀ Prev</button>`;
        for (let i = 1; i <= totalPages; i++) {
            const active = i === psbCurrentPage ? 'btn-primary' : 'btn-outline';
            html += `<button class="btn ${active} btn-sm" onclick="goToPsbPage(${i})">${i}</button>`;
        }
        if (psbCurrentPage < totalPages) html += `<button class="btn btn-outline btn-sm" onclick="goToPsbPage(${psbCurrentPage + 1})">Next ▶</button>`;
        html += '</div>';
        html += `<span style="font-size:13px;color:#64748b;">Menampilkan ${start+1}-${end} dari ${totalItems}</span>`;
    }
    document.getElementById('psbPagination').innerHTML = html;

    renderGrafikPsb();
}

function goToPsbPage(page) {
    psbCurrentPage = page;
    renderPsb();
}

function resetPsbFilter() {
    document.getElementById('psbFilterDate').value = '';
    document.getElementById('psbFilterDateTo').value = '';
    document.getElementById('psbFilterId').value = '';
    document.getElementById('psbFilterCustomer').value = '';
    psbCurrentPage = 1;
    renderPsb();
}

// ===== GRAFIK PSB =====
function renderGrafikPsb() {
    var canvas = document.getElementById('grafikPsbChart');
    if (!canvas) {
        console.log('⚠️ Canvas grafikPsbChart tidak ditemukan');
        return;
    }

    // AMBIL FILTER PERIODE & BULAN DARI ELEMEN GRAFIK PSB
    var periodeSelect = document.getElementById('grafikPsbPeriode');
    var bulanSelect = document.getElementById('grafikPsbBulan');
    
    // Jika elemen filter bulan belum ada di HTML, fallback ke default
    if (!periodeSelect) return;
    
    var periode = periodeSelect ? periodeSelect.value : '1bulan';
    var bulanFilter = bulanSelect ? (bulanSelect.value || '') : '';
    
    // TENTUKAN RENTANG TANGGAL
    var now = new Date();
    var start = new Date();
    if (periode === '1bulan') {
        start.setMonth(start.getMonth() - 1);
    } else if (periode === '3bulan') {
        start.setMonth(start.getMonth() - 3);
    }
    start.setHours(0, 0, 0, 0);
    
    // FILTER DATA HANYA PSB BERDASARKAN RENTANG TANGGAL
    var dataTickets = tickets.filter(t => {
        if (!t.createdAt) return false;
        var jenis = t.jenistiket || '';
        if (jenis !== 'PSB') return false; // HANYA PSB
        
        var d = new Date(t.createdAt);
        d.setHours(0, 0, 0, 0);
        return d >= start && d <= now;
    });
    
    // FILTER BULAN (JIKA DIPILIH)
    if (bulanFilter !== '' && bulanFilter !== 'all') {
        var temp = [];
        for (var j = 0; j < dataTickets.length; j++) {
            var t2 = dataTickets[j];
            var d2 = new Date(t2.createdAt);
            if (d2.getMonth() == parseInt(bulanFilter)) {
                temp.push(t2);
            }
        }
        dataTickets = temp;
    }
    
    // HITUNG PER HARI
    var dailyMap = {};
    
    dataTickets.forEach(t => {
        if (!t.createdAt) return;
        var d = new Date(t.createdAt);
        var key = d.toISOString().split('T')[0];
        dailyMap[key] = (dailyMap[key] || 0) + 1;
    });
    
    // BUAT LABEL DAN DATA DARI TANGGAL START SAMPAI SEKARANG
    var labels = [];
    var data = [];
    var totalTiket = 0;
    
    var currentDate = new Date(start);
    var endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    while (currentDate <= endDate) {
        var key = currentDate.toISOString().split('T')[0];
        var day = currentDate.getDate();
        var month = currentDate.toLocaleDateString('id-ID', { month: 'short' });
        labels.push(day + ' ' + month);
        
        var count = dailyMap[key] || 0;
        data.push(count);
        totalTiket += count;
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // DESTROY CHART LAMA
    if (window.grafikPsbInstance) {
        window.grafikPsbInstance.destroy();
        window.grafikPsbInstance = null;
    }
    
    var ctx = canvas.getContext('2d');
    
    // GRADIENT (WARNA HIJAU UNTUK PSB)
    var areaGradient = ctx.createLinearGradient(0, 0, 0, 300);
    areaGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    areaGradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
    areaGradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
    
    window.grafikPsbInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah PSB',
                data: data,
                borderColor: '#10b981',
                backgroundColor: areaGradient,
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            var val = context.parsed.y;
                            return val + ' PSB';
                        },
                        title: function(items) {
                            if (!items || items.length === 0) return '';
                            var label = items[0].label;
                            var parts = label.split(' ');
                            if (parts.length < 2) return label;
                            var day = parts[0];
                            var month = parts[1];
                            var year = new Date().getFullYear();
                            var date = new Date(month + ' ' + day + ', ' + year);
                            return date.toLocaleDateString('id-ID', {
                                weekday: 'long',
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                            });
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        font: { size: 9 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 800,
                easing: 'easeInOutQuad'
            }
        }
    });
}


function resetDashboardFilter() {
    document.getElementById('dashFilterDate').value = '';
    document.getElementById('dashFilterDateTo').value = '';
    document.getElementById('dashFilterJenis').value = 'all';
    dashCurrentPage = 1; // RESET PAGE KE 1
    renderDashboard();
}

function toggleUserDropdown() {
    var menu = document.getElementById('userDropdownMenu');
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
    }
}

// TUTUP DROPDOWN KALO KLIK DI LUAR
document.addEventListener('click', function(e) {
    var dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        var menu = document.getElementById('userDropdownMenu');
        if (!dropdown.contains(e.target)) {
            if (menu) menu.style.display = 'none';
        }
    }
});

function userProfile() {
    Swal.fire({
        icon: 'info',
        title: '👤 Profil User',
        html: `
            <div style="text-align:left;padding:10px 0;">
                <p><strong>Username:</strong> admin</p>
                <p><strong>Role:</strong> Administrator</p>
                <p><strong>Status:</strong> <span style="color:#22c55e;">● Online</span></p>
            </div>
        `,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb'
    });
    document.getElementById('userDropdownMenu').style.display = 'none';
}

function userChangePassword() {
    Swal.fire({
        title: '🔑 Ganti Password',
        html: `
            <div style="text-align:left;">
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;font-size:13px;color:#334155;margin-bottom:4px;">Password Lama</label>
                    <input type="password" id="oldPassword" style="width:100%;padding:8px 12px;border:1px solid #d1d9e6;border-radius:8px;">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;font-size:13px;color:#334155;margin-bottom:4px;">Password Baru</label>
                    <input type="password" id="newPassword" style="width:100%;padding:8px 12px;border:1px solid #d1d9e6;border-radius:8px;">
                </div>
                <div>
                    <label style="display:block;font-weight:600;font-size:13px;color:#334155;margin-bottom:4px;">Konfirmasi Password</label>
                    <input type="password" id="confirmPassword" style="width:100%;padding:8px 12px;border:1px solid #d1d9e6;border-radius:8px;">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: function() {
            var old = document.getElementById('oldPassword').value;
            var newPass = document.getElementById('newPassword').value;
            var confirm = document.getElementById('confirmPassword').value;
            
            if (!old || !newPass || !confirm) {
                Swal.showValidationMessage('Semua field wajib diisi!');
                return false;
            }
            if (old !== 'admin123') {
                Swal.showValidationMessage('Password lama salah!');
                return false;
            }
            if (newPass.length < 6) {
                Swal.showValidationMessage('Password baru minimal 6 karakter!');
                return false;
            }
            if (newPass !== confirm) {
                Swal.showValidationMessage('Password baru dan konfirmasi tidak cocok!');
                return false;
            }
            return { newPassword: newPass };
        }
    }).then(function(result) {
        if (result.isConfirmed) {
            Swal.fire({
                icon: 'success',
                title: '✅ Berhasil!',
                text: 'Password berhasil diubah. Silakan login ulang.',
                confirmButtonColor: '#2563eb'
            }).then(function() {
                handleLogout();
            });
        }
        document.getElementById('userDropdownMenu').style.display = 'none';
    });
}


function renderReports() {
    console.log('renderReports dipanggil!');
    
    // ===== 1. AMBIL SEMUA DATA DARI MEMORY =====
    let dataSource = tickets;
    
    // ===== 2. AMBIL NILAI FILTER =====
    const dateFrom = document.getElementById('filterLaporanDate')?.value || '';
    const dateTo = document.getElementById('filterLaporanDateTo')?.value || '';
    const bulan = document.getElementById('filterLaporanBulan')?.value || '';
    
    // ===== 3. TERAPKAN FILTER =====
    if (dateFrom || dateTo || bulan) {
        dataSource = dataSource.filter(t => {
            const d = new Date(t.createdAt);

            const dStr = d.toISOString().split('T')[0];
            
            // Filter tanggal
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            
            // Filter bulan
            if (bulan === '3bulan') {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                return d >= threeMonthsAgo;
            } else if (bulan !== '' && bulan !== '3bulan') {
                return d.getMonth() == parseInt(bulan);
            }
            
            return true;
        });
    } else {
        // ===== 4. DEFAULT: 30 HARI TERAKHIR =====
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dataSource = dataSource.filter(t => {
            const tDate = new Date(t.createdAt);
            return tDate >= thirtyDaysAgo;
        });
    }
    
    const filteredTickets = dataSource;
    
            // ===== 5. UPDATE PERIODE & TOTAL DATA =====
    const now = new Date();
    const filterFrom = document.getElementById('filterLaporanDate')?.value || '';
    const filterTo = document.getElementById('filterLaporanDateTo')?.value || '';
    const filterBulan = document.getElementById('filterLaporanBulan')?.value || '';
    
    let startDate = 'Tidak ada data';
    let endDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    
    if (filteredTickets.length > 0) {
        const sorted = [...filteredTickets].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        startDate = new Date(sorted[0].createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        endDate = new Date(sorted[sorted.length - 1].createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    
    let periodText = '';
    
        // PRIORITAS: FILTER BULAN DULU
    console.log('filterBulan value:', filterBulan);
    console.log('filterFrom value:', filterFrom);
    console.log('filterTo value:', filterTo);
    
        // CEK FILTER BULAN DULU
    if (filterBulan === '3bulan') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const start = threeMonthsAgo.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const end = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        periodText = `3 Bulan Terakhir (${start} - ${end})`;
    } else if (filterFrom || filterTo) {
        periodText = `${startDate} - ${endDate}`;
    } else if (filterBulan !== '' && filterBulan !== '3bulan') {
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const year = now.getFullYear();
        const monthIndex = parseInt(filterBulan);
        if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
            periodText = `${monthNames[monthIndex]} ${year}`;
        } else {
            periodText = `${startDate} - ${endDate}`;
        }
    } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const start = thirtyDaysAgo.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const end = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        periodText = `30 Hari Terakhir (${start} - ${end})`;
    
    }
    
    document.getElementById('reportPeriod').textContent = periodText;
    document.getElementById('reportTotalData').textContent = filteredTickets.length;
    
    // ===== 6. CEK KOSONG =====
    if(filteredTickets.length === 0) {
        document.getElementById('jenisgangguanReportBody').innerHTML = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        document.getElementById('customerReportBody').innerHTML = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        document.getElementById('gaulReportBody').innerHTML = '<tr><td colspan="4"><div class="empty">Tidak ada data</div></td></tr>';
        document.getElementById('produktivitasReportBody').innerHTML = '<tr><td colspan="7"><div class="empty">Tidak ada data</div></td></tr>';
        renderCharts([]);
        
        return;
    }

    // ===== 7. JENIS GANGGUAN PALING SERING =====
    const selectElement2 = document.getElementById('jenisGangguan');
    const alljenisgangguan2 = [];
    if (selectElement2) {
        for (let i = 0; i < selectElement2.options.length; i++) {
            const value = selectElement2.options[i].value;
            if (value) alljenisgangguan2.push(value);
        }
    }
    if (alljenisgangguan2.length === 0) {
        alljenisgangguan2.push('Kabel Putus (LOS)', 'Internet lambat', 'Ganti Modem', 'Ganti HTB');
    }
    
    const gangguanMap2 = {};
    alljenisgangguan2.forEach(jenis => { gangguanMap2[jenis] = { count: 0, perbaikan: {} }; });
    
    filteredTickets.forEach(t => {
        const jenis = t.jenisgangguan || 'Tidak diketahui';
        const perbaikan = t.jenisPerbaikan || '-';
        if (gangguanMap2[jenis] !== undefined) {
            gangguanMap2[jenis].count++;
            gangguanMap2[jenis].perbaikan[perbaikan] = (gangguanMap2[jenis].perbaikan[perbaikan] || 0) + 1;
        } else {
            if (!gangguanMap2[jenis]) gangguanMap2[jenis] = { count: 0, perbaikan: {} };
            gangguanMap2[jenis].count++;
            gangguanMap2[jenis].perbaikan[perbaikan] = (gangguanMap2[jenis].perbaikan[perbaikan] || 0) + 1;
        }
    });
    
    const sortedGangguan2 = Object.entries(gangguanMap2).sort((a, b) => b[1].count - a[1].count);
    const totalGangguan2 = filteredTickets.length;
    
    let gangguanHtml2 = '';
    const maxCount2 = sortedGangguan2.length > 0 ? sortedGangguan2[0][1].count : 1;
    
    sortedGangguan2.forEach(([jenis, data], index) => {
                const persen = totalGangguan2 > 0 ? ((data.count / totalGangguan2) * 100).toFixed(1) : '0';
        const persenNum = parseFloat(persen);
        const textColor = data.count === 0 ? '#94a3b8' : '#0b1a33';
        const bgColor = data.count === 0 ? '#f8fafc' : 'transparent';
        const topPerbaikan = Object.entries(data.perbaikan).sort((a, b) => b[1] - a[1])[0];
        const perbaikanText = topPerbaikan ? `${topPerbaikan[0]} (${topPerbaikan[1]}x)` : '-';
        
                // CHART BAR PERSENTASE - PANJANG = NILAI PERSENTASE
        const barWidth = Math.min(persenNum, 100); // MAKSIMAL 100%
        const colorRatio = Math.min(persenNum / 100, 1);
        const red = Math.round(34 + (220 - 34) * colorRatio);
        const green = Math.round(197 - (197 - 50) * colorRatio);
        const blue = Math.round(94 - (94 - 50) * colorRatio);
        const barColor = `rgb(${red}, ${green}, ${blue})`;
        
        gangguanHtml2 += `<tr style="background:${bgColor};">
            <td>${index + 1}</td>
            <td><strong style="color:${textColor};">${jenis}</strong></td>
            <td style="color:${textColor};">${data.count}</td>
                <td style="color:${textColor};">
                <div style="display:flex;align-items:center;gap:10px;white-space:nowrap;width:100%;">
                    <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:4px;transition:width 0.5s;"></div>
                    </div>
                    <span style="font-weight:700;font-size:13px;min-width:50px;text-align:right;flex-shrink:0;">${data.count === 0 ? '0%' : persen + '%'}</span>
                </div>
            </td>
            <td style="color:${textColor};">${perbaikanText}</td>
        </tr>`;
    });
    document.getElementById('jenisgangguanReportBody').innerHTML = gangguanHtml2;

    // ===== 8. PELANGGAN PALING SERING LAPOR =====
    const customerMap = {};

// FILTER TIKET YANG BUKAN GAMAS (HANYA GGN)
const ggnTickets = filteredTickets.filter(t => {
    const jenisTiket = t.jenistiket || '';
    return jenisTiket !== 'GAMAS'; // HANYA GGN, PSB, PROJECT
});

ggnTickets.forEach(t => {
    const cust = t.customer || 'Tidak diketahui';
    if(!customerMap[cust]) {
        customerMap[cust] = { 
            total: 0, 
            gangguan: {},
            odppelanggan: t.odppelanggan || '-' 
        };
    }
    customerMap[cust].total++;
    const jenis = t.jenisgangguan || 'Tidak diketahui';
    customerMap[cust].gangguan[jenis] = (customerMap[cust].gangguan[jenis] || 0) + 1;
});

const sortedCustomers = Object.entries(customerMap)
    .sort((a,b) => b[1].total - a[1].total)
    .slice(0, 50);

// PAGINATION
const itemsPerPage = 10;
const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
let currentPage = parseInt(localStorage.getItem('customerPage')) || 1;
if (currentPage < 1) currentPage = 1;
if (currentPage > totalPages) currentPage = totalPages;

const start = (currentPage - 1) * itemsPerPage;
const end = Math.min(start + itemsPerPage, sortedCustomers.length);
const pageData = sortedCustomers.slice(start, end);

let customerHtml = '';
if(sortedCustomers.length === 0) {
    customerHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data pelanggan GGN</div></td></tr>';
} else {
    pageData.forEach(([cust, data], index) => {
        const topGangguan = Object.entries(data.gangguan).sort((a,b) => b[1] - a[1])[0];
        const gangguanText = topGangguan ? `${topGangguan[0]} (${topGangguan[1]}x)` : '-';
        customerHtml += `<tr>
            <td>${start + index + 1}</td>
            <td><strong>${cust}</strong></td>
            <td>${data.odppelanggan}</td>
            <td>${data.total}</td>
            <td>
                ${gangguanText}
                <button onclick="viewCustomerHistory('${cust}')" title="Lihat History Tiket" style="background:transparent;border:none;cursor:pointer;color:#2563eb;margin-left:6px;font-size:14px;">
                    <i class="fas fa-history"></i>
                </button>
            </td>
        </tr>`;
    });
}
document.getElementById('customerReportBody').innerHTML = customerHtml;
document.getElementById('customerPaginationContainer').innerHTML = '';
    
    // PAGINATION BUTTONS
    const container = document.getElementById('customerPaginationContainer');
    if (container) {
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = '<div style="display:flex;justify-content:center;gap:6px;padding:10px 0;flex-wrap:wrap;">';
            if (currentPage > 1) {
                paginationHtml += `<button class="btn btn-outline btn-sm" onclick="goToCustomerPage(${currentPage - 1})">◀ Prev</button>`;
            }
            for (let i = 1; i <= totalPages; i++) {
                const active = i === currentPage ? 'btn-primary' : 'btn-outline';
                paginationHtml += `<button class="btn ${active} btn-sm" onclick="goToCustomerPage(${i})">${i}</button>`;
            }
            if (currentPage < totalPages) {
                paginationHtml += `<button class="btn btn-outline btn-sm" onclick="goToCustomerPage(${currentPage + 1})">Next ▶</button>`;
            }
            paginationHtml += '</div>';
            paginationHtml += `<div style="text-align:center;font-size:13px;color:#64748b;">Menampilkan ${start + 1}-${end} dari ${sortedCustomers.length} pelanggan</div>`;
        }
        container.innerHTML = paginationHtml;
    }

    // ===== 9. TEKNISI PENYEBAB GAUL =====
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    const gaulMap = {};
    filteredTickets.forEach(t => {
        const customer = t.customer;
        const techs = t.technicians || [];
        const tDate = new Date(t.createdAt);
        
        if (tDate >= twoMonthsAgo) {
            const otherTickets = filteredTickets.filter(t2 => {
                if (t2.id === t.id) return false;
                if (t2.customer !== customer) return false;
                const t2Date = new Date(t2.createdAt);
                return t2Date >= twoMonthsAgo;
            });
            
            if (otherTickets.length > 0) {
                techs.forEach(tech => {
                    if (!gaulMap[tech]) gaulMap[tech] = 0;
                    gaulMap[tech]++;
                });
            }
        }
    });
    
    const sortedGaul = Object.entries(gaulMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const totalGaul = Object.values(gaulMap).reduce((a,b) => a + b, 0);
    
    let gaulHtml = '';
    if(sortedGaul.length === 0) {
        gaulHtml = '<tr><td colspan="4"><div class="empty">Tidak ada data GAUL</div></td></tr>';
    } else {
        sortedGaul.forEach(([tech, count], index) => {
            const persen = totalGaul > 0 ? ((count / totalGaul) * 100).toFixed(1) : '0';
            gaulHtml += `<tr>
                <td>${index + 1}</td>
                <td><strong>${tech}</strong></td>
                <td>${count}</td>
                <td>${persen}%</td>
            </tr>`;
        });
    }
    document.getElementById('gaulReportBody').innerHTML = gaulHtml;

        // ===== 10. PRODUKTIVITAS TEKNISI =====
    const techMap = {};
    techs.forEach(t => { techMap[t.name] = { total: 0, closed: 0, tepatWaktu: 0, overdue: 0 }; });
    filteredTickets.forEach(t => {
        const techsList = t.technicians || [];
        techsList.forEach(tech => {
            if (techMap[tech]) {
                techMap[tech].total++;
                if (t.status === 'close') {
                    techMap[tech].closed++;
                    const ttr = t.ttr || 0;
                    if (ttr <= t.duration) techMap[tech].tepatWaktu++;
                }
                const ttr = t.ttr || 0;
                if (ttr > t.duration) techMap[tech].overdue++;
            }
        });
    });
    
    // TAMPILKAN SEMUA TEKNISI (TANPA FILTER data.total > 0)
    const sortedTech = Object.entries(techMap)
        .sort((a, b) => b[1].total - a[1].total);   
    
    let produktivitasHtml = '';
    if(sortedTech.length === 0) {
        produktivitasHtml = '<tr><td colspan="7"><div class="empty">Tidak ada data</div></td></tr>';
    } else {
        sortedTech.forEach(([name, data], index) => {
            const productivity = data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0;
            produktivitasHtml += `<tr>
                <td>${index + 1}</td>
                <td><strong>${name}</strong></td>
                <td>${data.total}</td>
                <td style="color:#16a34a;font-weight:600;">${data.closed}</td>
                <td style="color:#22c55e;font-weight:600;">${data.tepatWaktu}</td>
                <td style="color:#dc2626;font-weight:700;">${data.overdue}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${productivity}%;background:${productivity >= 80 ? '#22c55e' : productivity >= 50 ? '#f59e0b' : '#dc2626'};border-radius:4px;transition:width 0.5s;"></div>
                        </div>
                        <span style="font-weight:600;font-size:13px;min-width:45px;">${productivity.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>`;
        });
    }
    document.getElementById('produktivitasReportBody').innerHTML = produktivitasHtml;
    
    // ===== 11. CHART =====
    renderCharts(filteredTickets);
    renderGrafikHarian();
}

function goToCustomerPage(page) {
    localStorage.setItem('customerPage', page);
    renderReports();
}

function renderCharts(data) {
    // Hapus chart lama
    if (window.jenisChartInstance) {
        window.jenisChartInstance.destroy();
    }
    if (window.produktivitasChartInstance) {
        window.produktivitasChartInstance.destroy();
    }

    const ticketsData = data || tickets;

            // === CHART JENIS GANGGUAN (AMBIL DARI DROPDOWN) ===
    // Ambil semua option dari dropdown jenis gangguan
    const selectElement = document.getElementById('jenisgangguan');
    const alljenisgangguan = [];
    if (selectElement) {
        for (let i = 0; i < selectElement.options.length; i++) {
            const value = selectElement.options[i].value;
            if (value) alljenisgangguan.push(value);
        }
    }
    // Fallback jika dropdown tidak ditemukan
    if (alljenisgangguan.length === 0) {
        alljenisgangguan.push('Kabel Putus (LOS)', 'Internet lambat', 'Ganti Modem', 'Ganti HTB');
    }
    
    const gangguanMap = {};
alljenisgangguan.forEach(jenis => { gangguanMap[jenis] = 0; });

ticketsData.forEach(t => {
    var jenis = t.jenisgangguan || 'Tidak diketahui';
    var jenisTiket = t.jenistiket || '';
    
    // LEWATKAN GAMAS ODP DAN GAMAS ODC
    if (jenis === 'GAMAS ODP' || jenis === 'GAMAS ODC') {
        return;
    }
    
    // GAMAS FEEDER DAN DISTRIBUSI TETAP MUNCUL
    if (jenisTiket === 'GAMAS') {
        if (jenis === 'GAMAS FEEDER' || jenis === 'GAMAS DISTRIBUSI') {
            // Tetap pakai nama aslinya
        } else {
            jenis = 'GAMAS';
        }
    }
    
    if (gangguanMap[jenis] !== undefined) {
        gangguanMap[jenis]++;
    } else {
        if (!gangguanMap[jenis]) gangguanMap[jenis] = 0;
        gangguanMap[jenis]++;
    }
});
    
    const sortedJenis = Object.entries(gangguanMap).sort((a, b) => b[1] - a[1]);
    const jenisLabels = sortedJenis.map(j => j[0]);
    const jenisData = sortedJenis.map(j => j[1]);
    
    const barColors = jenisData.map(val => {
        return val > 0 ? '#3b82f6' : '#e2e8f0';
    });

    const ctx1 = document.getElementById('jenisChart').getContext('2d');
    window.jenisChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: jenisLabels,
            datasets: [{
                label: 'Jumlah Gangguan',
                data: jenisData,
                backgroundColor: barColors,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                },
                y: {
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });

         // === CHART PRODUKTIVITAS TEKNISI (SEMUA TEKNISI) ===
    // Chart Produktivitas Teknisi - DENGAN DROPDOWN FILTER
const techFilter = document.getElementById('dashTechFilter') ? document.getElementById('dashTechFilter').value : 'all';

// POPULATE DROPDOWN
const filterSelect = document.getElementById('dashTechFilter');
if (filterSelect) {
    const currentValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">Semua Teknisi</option>';
    techs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        filterSelect.appendChild(opt);
    });
    filterSelect.value = currentValue;
}

const techMap = {};
techs.forEach(t => { techMap[t.name] = { total: 0, tepatWaktu: 0 }; });

ticketsData.forEach(t => {
    (t.technicians || []).forEach(tech => {
        if (techMap[tech]) {
            techMap[tech].total++;
            if (t.status === 'close') {
                const ttr = t.ttr || 0;
                if (ttr <= t.duration) techMap[tech].tepatWaktu++;
            }
        }
    });
});

let sortedTech = Object.entries(techMap)
    .sort((a, b) => b[1].total - a[1].total);

// FILTER BERDASARKAN DROPDOWN
if (techFilter !== 'all') {
    sortedTech = sortedTech.filter(([name]) => name === techFilter);
}

// KALAU SORTEDTECH KOSONG, TAMPILKAN PESAN
if (sortedTech.length === 0) {
    sortedTech = [['Belum Ada Data', { total: 0, tepatWaktu: 0 }]];
}

if (window.dashProdChartInstance) {
    window.dashProdChartInstance.destroy();
}
const ctx2 = document.getElementById('produktivitasChart').getContext('2d');
if (window.produktivitasChartInstance) {
    window.produktivitasChartInstance.destroy();
}
window.produktivitasChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
        labels: sortedTech.length > 0 ? sortedTech.map(t => t[0]) : ['Belum Ada Data'],
        datasets: [{
            label: 'Produktivitas (%)',
            data: sortedTech.length > 0 ? sortedTech.map(([name, data]) => 
                data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0
            ) : [0],
            backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#dc2626'],
            borderRadius: 8
        }]
    },
    options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                beginAtZero: true,
                max: 100,
                ticks: { callback: function(value) { return value + '%'; } }
            }
        }
    }
});

}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('show');
    if (overlay) {
        overlay.classList.toggle('show');
    }
}

function closeSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}   

function renderGrafikHarian() {
    var periodeSelect = document.getElementById('grafikPeriode');
    var bulanSelect = document.getElementById('grafikBulan');
    var canvas = document.getElementById('grafikHarianChart');
    
    if (!periodeSelect || !bulanSelect || !canvas) {
        return;
    }
    
    var periode = periodeSelect.value;
    var bulanFilter = bulanSelect.value;
    
    var now = new Date();
    var start = new Date();
    if (periode === '1bulan') {
        start.setMonth(start.getMonth() - 1);
    } else if (periode === '3bulan') {
        start.setMonth(start.getMonth() - 3);
    }
    
    var filteredTickets = [];
    for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        var d = new Date(t.createdAt);
        if (d >= start) {
            filteredTickets.push(t);
        }
    }
    
    if (bulanFilter !== '') {
        var temp = [];
        for (var j = 0; j < filteredTickets.length; j++) {
            var t2 = filteredTickets[j];
            var d2 = new Date(t2.createdAt);
            if (d2.getMonth() == parseInt(bulanFilter)) {
                temp.push(t2);
            }
        }
        filteredTickets = temp;
    }
    
    var dailyMap = {};
    var startDate = new Date(start);
    var endDate = new Date();
    
    while (startDate <= endDate) {
        var key = startDate.toISOString().split('T')[0];
        dailyMap[key] = 0;
        startDate.setDate(startDate.getDate() + 1);
    }
    
    for (var k = 0; k < filteredTickets.length; k++) {
        var t3 = filteredTickets[k];
        var d3 = new Date(t3.createdAt);
        var key2 = d3.toISOString().split('T')[0];
        if (dailyMap[key2] !== undefined) {
            dailyMap[key2]++;
        }
    }
    
    var sortedDates = Object.keys(dailyMap).sort();
    var labels = [];
    var data = [];
    for (var m = 0; m < sortedDates.length; m++) {
        var date = new Date(sortedDates[m]);
        var day = date.getDate();
        var month = date.toLocaleDateString('id-ID', { month: 'short' });
        labels.push(day + ' ' + month);
        data.push(dailyMap[sortedDates[m]]);
    }
    
    if (window.grafikHarianInstance) {
        window.grafikHarianInstance.destroy();
    }
    
    var ctx = canvas.getContext('2d');
    
    var maxData = 0;
    for (var n = 0; n < data.length; n++) {
        if (data[n] > maxData) maxData = data[n];
    }
    if (maxData === 0) maxData = 1;
    
    var areaGradient = ctx.createLinearGradient(0, 0, 0, 300);
    areaGradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
    areaGradient.addColorStop(0.5, 'rgba(37, 99, 235, 0.15)');
    areaGradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');
    
    window.grafikHarianInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tiket',
                data: data,
                borderColor: '#2563eb',
                backgroundColor: areaGradient,
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            var val = context.parsed.y;
                            if (val === 0) return 'Tidak ada tiket';
                            return val + ' tiket';
                        },
                        title: function(items) {
                            var label = items[0].label;
                            var parts = label.split(' ');
                            var day = parts[0];
                            var month = parts[1];
                            var year = new Date().getFullYear();
                            var date = new Date(month + ' ' + day + ', ' + year);
                            return date.toLocaleDateString('id-ID', {
                                weekday: 'long',
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                            });
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        font: { size: 9 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 800,
                easing: 'easeInOutQuad'
            }
        }
    });
}

function resetGrafikFilter() {
    const periodeSelect = document.getElementById('grafikPeriode');
    const bulanSelect = document.getElementById('grafikBulan');
    if (periodeSelect) periodeSelect.value = '1bulan';
    if (bulanSelect) bulanSelect.value = '';
    renderGrafikHarian();

}

function viewStatFilter(filterType) {
    switchTab('tickets');
    
    document.getElementById('filterDate').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterId').value = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('filterStatusSelect').value = 'all';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filtered = tickets.filter(t => {
        const d = new Date(t.createdAt);

        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    });
    
    if (filterType === 'all') {
        // tetap filter hari ini
    } else if (filterType === 'open') {
        filtered = filtered.filter(t => t.status === 'open');
    } else if (filterType === 'close') {
        filtered = filtered.filter(t => t.status === 'close');
    } else if (filterType === 'pending') {
        filtered = filtered.filter(t => t.status === 'pending');
    } else if (filterType === 'overdue') {
        filtered = filtered.filter(t => {
            if (t.status === 'open' || t.status === 'close') {
                return (t.ttr || 0) > t.duration;
            }
            return false;
        });
    } else if (filterType === 'gaul') {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        
        const gaulCustomers = filtered.filter(t => {
            const customerName = t.customer;
            const history = tickets.filter(t2 => {
                if (t2.customer !== customerName) return false;
                if (t2.id === t.id) return false;
                return t2.createdAt.toDate() >= twoMonthsAgo;
            });
            return history.length > 0;
        }).map(t => t.customer);
        
        const uniqueGaul = [...new Set(gaulCustomers)];
        filtered = filtered.filter(t => uniqueGaul.includes(t.customer));
    }
    
    renderTickets(filtered, 1);
    const filterLabel = filterType ? filterType.toUpperCase() : 'ALL';
document.getElementById('ticketCount').textContent = filtered.length + ' tiket (Hari ini · ' + filterLabel + ')';
    
    
}

function exportReport() {
    try {
        // AMBIL FILTER DARI HALAMAN LAPORAN
        const dateFrom = document.getElementById('filterLaporanDate')?.value || '';
        const dateTo = document.getElementById('filterLaporanDateTo')?.value || '';
        const bulan = document.getElementById('filterLaporanBulan')?.value || '';
        
        // DEKLARASIKAN DI LUAR KONDISI
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let filteredTickets = tickets.slice();
        
        // FILTER TANGGAL
        if (dateFrom || dateTo) {
            filteredTickets = filteredTickets.filter(t => {
                const d = new Date(t.createdAt);
                const dStr = d.toISOString().split('T')[0];
                if (dateFrom && dStr < dateFrom) return false;
                if (dateTo && dStr > dateTo) return false;
                return true;
            });
        }
        
        // FILTER BULAN
        if (bulan === '3bulan') {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            filteredTickets = filteredTickets.filter(t => {
                const d = new Date(t.createdAt);
                return d >= threeMonthsAgo;
            });
        } else if (bulan !== '' && bulan !== '3bulan' && bulan !== 'all') {
            filteredTickets = filteredTickets.filter(t => {
                const d = new Date(t.createdAt);
                return d.getMonth() == parseInt(bulan);
            });
        }
        
        // JIKA TIDAK ADA FILTER, PAKAI 30 HARI TERAKHIR
        if (!dateFrom && !dateTo && (!bulan || bulan === 'all')) {
            filteredTickets = tickets.filter(t => {
                const tDate = new Date(t.createdAt);
                return tDate >= thirtyDaysAgo;
            });
        }

        if (filteredTickets.length === 0) {
            Swal.fire('Info', 'Tidak ada data 30 hari terakhir!', 'info');
            return;
        }

        // ===== AMBIL SEMUA GAMBAR CHART =====
        const canvasJenis = document.getElementById('jenisChart');
        const canvasProd = document.getElementById('produktivitasChart');
        const canvasDashJenis = document.getElementById('dashJenisChart');
        const canvasDashProd = document.getElementById('dashProdChart');
        
        let imgJenis = '';
        let imgProd = '';
        let imgDashJenis = '';
        let imgDashProd = '';
        
        if (canvasJenis) imgJenis = canvasJenis.toDataURL('image/png');
        if (canvasProd) imgProd = canvasProd.toDataURL('image/png');
        if (canvasDashJenis) imgDashJenis = canvasDashJenis.toDataURL('image/png');
        if (canvasDashProd) imgDashProd = canvasDashProd.toDataURL('image/png');

        // ===== BUAT CSV =====
        let csv = '';
        
        csv += 'REKAP PERFORMANSI PT MAHAWIRA NUSANTARA\n';
        csv += 'Periode: ' + thirtyDaysAgo.toLocaleDateString('id-ID') + ' - ' + new Date().toLocaleDateString('id-ID') + '\n';
        csv += 'Total Tiket: ' + filteredTickets.length + '\n\n';
        
        csv += 'DATA TIKET\n';
        csv += 'No,Tanggal,ID Tiket,Customer,Jenis Gangguan,Teknisi,Durasi (Menit),TTR (Menit),Status,Keterangan,Jenis Perbaikan\n';
        filteredTickets.forEach((t, i) => {
            csv += (i + 1) + ',';
            csv += new Date(t.createdAt).toLocaleString('id-ID') + ',';
            csv += (t.ticketId || t.ticketid || '-') + ',';
            csv += (t.customer || '-') + ',';
            csv += (t.jenisgangguan || '-') + ',';
            csv += ((t.technicians || []).join(', ')) + ',';
            csv += (t.duration || 0) + ',';
            csv += ((t.ttr || 0).toFixed(1)) + ',';
            csv += (t.status || '-') + ',';
            csv += (t.keterangan || '-') + ',';
            csv += (t.jenisPerbaikan || '-') + '\n';
        });
        
        csv += '\n\n';
        
        const gangguanMap = {};
        filteredTickets.forEach(t => {
            const jenis = t.jenisgangguan || 'Tidak diketahui';
            gangguanMap[jenis] = (gangguanMap[jenis] || 0) + 1;
        });
        const sortedGangguan = Object.entries(gangguanMap).sort((a, b) => b[1] - a[1]);
        const totalGangguan = filteredTickets.length;
        
        csv += 'JENIS GANGGUAN\n';
        csv += 'No,Jenis Gangguan,Jumlah,Persentase\n';
        sortedGangguan.forEach(([jenis, count], i) => {
            const persen = ((count / totalGangguan) * 100).toFixed(1);
            csv += (i + 1) + ',' + jenis + ',' + count + ',' + persen + '%\n';
        });
        
        csv += '\n\n';
        
        const techMap = {};
        techs.forEach(t => { techMap[t.name] = { total: 0, closed: 0, tepatWaktu: 0, overdue: 0 }; });
        filteredTickets.forEach(t => {
            const techsList = t.technicians || [];
            techsList.forEach(tech => {
                if (techMap[tech]) {
                    techMap[tech].total++;
                    if (t.status === 'close') {
                        techMap[tech].closed++;
                        const ttr = t.ttr || 0;
                        if (ttr <= t.duration) techMap[tech].tepatWaktu++;
                    }
                    const ttr = t.ttr || 0;
                    if (ttr > t.duration) techMap[tech].overdue++;
                }
            });
        });
        const sortedTech = Object.entries(techMap).filter(([name, data]) => data.total > 0);
        
        csv += 'PRODUKTIVITAS TEKNISI\n';
        csv += 'No,Nama Teknisi,Total Tiket,Selesai,Tepat Waktu,Overdue,Produktivitas (%)\n';
        sortedTech.forEach(([name, data], i) => {
            const productivity = data.total > 0 ? ((data.tepatWaktu / data.total) * 100).toFixed(1) : '0';
            csv += (i + 1) + ',' + name + ',' + data.total + ',' + data.closed + ',' + data.tepatWaktu + ',' + data.overdue + ',' + productivity + '%\n';
        });
        
        csv += '\n\n';
        
        const customerMap = {};
        filteredTickets.forEach(t => {
            const cust = t.customer || 'Tidak diketahui';
            if (!customerMap[cust]) customerMap[cust] = { total: 0, gangguan: {} };
            customerMap[cust].total++;
            const jenis = t.jenisgangguan || 'Tidak diketahui';
            customerMap[cust].gangguan[jenis] = (customerMap[cust].gangguan[jenis] || 0) + 1;
        });
        const sortedCustomers = Object.entries(customerMap).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
        
        csv += 'TOP 10 PELANGGAN PALING SERING LAPOR\n';
        csv += 'No,Nama Pelanggan,Total Laporan,Gangguan Terbanyak\n';
        sortedCustomers.forEach(([cust, data], i) => {
            const topGangguan = Object.entries(data.gangguan).sort((a, b) => b[1] - a[1])[0];
            const gangguanText = topGangguan ? topGangguan[0] + ' (' + topGangguan[1] + 'x)' : '-';
            csv += (i + 1) + ',' + cust + ',' + data.total + ',' + gangguanText + '\n';
        });
        
        csv += '\n\n';
        
        const gaulMap = {};
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        filteredTickets.forEach(t => {
            const customer = t.customer;
            const techsList = t.technicians || [];
            const tDate = new Date(t.createdAt);
            if (tDate >= twoMonthsAgo) {
                const otherTickets = filteredTickets.filter(t2 => t2.id !== t.id && t2.customer === customer && t2.createdAt.toDate() >= twoMonthsAgo);
                if (otherTickets.length > 0) {
                    techsList.forEach(tech => { gaulMap[tech] = (gaulMap[tech] || 0) + 1; });
                }
            }
        });
        const sortedGaul = Object.entries(gaulMap).sort((a, b) => b[1] - a[1]);
        
        csv += 'TEKNISI PENYEBAB GANGGUAN ULANG (GAUL)\n';
        csv += 'No,Nama Teknisi,Total GAUL\n';
        sortedGaul.forEach(([tech, count], i) => {
            csv += (i + 1) + ',' + tech + ',' + count + '\n';
        });

        // ===== BUAT HTML UNTUK 1 FILE (CSV + GAMBAR) =====
        let html = '<html><head><meta charset="UTF-8"><title>Laporan Lengkap</title>';
        html += '<style>';
        html += 'body{font-family:Arial,sans-serif;padding:20px;background:#f5f7fa;}';
        html += 'h1{color:#0b1a33;border-bottom:3px solid #2563eb;padding-bottom:10px;}';
        html += 'h2{color:#1e293b;margin-top:30px;background:#e2e8f0;padding:8px 16px;border-radius:6px;}';
        html += 'table{border-collapse:collapse;width:100%;margin:10px 0 20px;font-size:13px;}';
        html += 'th{background:#0b1a33;color:white;padding:8px 12px;text-align:left;}';
        html += 'td{padding:12px 12px;border:1px solid #e2e8f0;}';
        html += 'tr:nth-child(even){background:#f8fafc;}';
        html += '.chart-img{max-width:500%;border:2px solid #e2e8f0;border-radius:8px;margin:10px 0;}';
        html += '.header-info{background:#dbeafe;padding:12px 20px;border-radius:8px;margin-bottom:20px;}';
        html += '</style></head><body>';
        
        html += '<h1>📊 LAPORAN GANGGUAN HELPDESK PRO</h1>';
        html += '<div class="header-info">';
        html += '<strong>Periode:</strong> ' + thirtyDaysAgo.toLocaleDateString('id-ID') + ' - ' + new Date().toLocaleDateString('id-ID') + '<br>';
        html += '<strong>Total Tiket:</strong> ' + filteredTickets.length;
        html += '</div>';
        
        // DATA TIKET
        html += '<h2>📋 DATA TIKET</h2>';
        html += '<table><thead><tr>';
        html += '<th>No</th><th>Tanggal</th><th>ID Tiket</th><th>Customer</th><th>Jenis Gangguan</th><th>Teknisi</th>';
        html += '<th>Durasi</th><th>TTR</th><th>Status</th><th>Keterangan</th><th>Jenis Perbaikan</th>';
        html += '</tr></thead><tbody>';
        filteredTickets.forEach((t, i) => {
            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>' + new Date(t.createdAt).toLocaleString('id-ID') + '</td>';
            html += '<td>' + (t.ticketId || t.ticketid || '-') + '</td>';
            html += '<td>' + (t.customer || '-') + '</td>';
            html += '<td>' + (t.jenisgangguan || '-') + '</td>';
            html += '<td>' + ((t.technicians || []).join(', ')) + '</td>';
            html += '<td>' + (t.duration || 0) + '</td>';
            html += '<td>' + ((t.ttr || 0).toFixed(1)) + '</td>';
            html += '<td>' + (t.status || '-') + '</td>';
            html += '<td>' + (t.keterangan || '-') + '</td>';
            html += '<td>' + (t.jenisPerbaikan || '-') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        
        // JENIS GANGGUAN
        html += '<h2>📊 JENIS GANGGUAN</h2>';
        if (imgJenis) {
            html += '<img src="' + imgJenis + '" class="chart-img" alt="Diagram Jenis Gangguan">';
        }
        html += '<table><thead><tr><th>No</th><th>Jenis Gangguan</th><th>Jumlah</th><th>Persentase</th></tr></thead><tbody>';
        sortedGangguan.forEach(([jenis, count], i) => {
            const persen = ((count / totalGangguan) * 100).toFixed(1);
            html += '<tr><td>' + (i + 1) + '</td><td>' + jenis + '</td><td>' + count + '</td><td>' + persen + '%</td></tr>';
        });
        html += '</tbody></table>';
        
        // PRODUKTIVITAS TEKNISI
        html += '<h2>📊 PRODUKTIVITAS TEKNISI</h2>';
        if (imgProd) {
            html += '<img src="' + imgProd + '" class="chart-img" alt="Diagram Produktivitas Teknisi">';
        }
        html += '<table><thead><tr><th>No</th><th>Nama Teknisi</th><th>Total</th><th>Selesai</th><th>Tepat Waktu</th><th>Overdue</th><th>Produktivitas</th></tr></thead><tbody>';
        sortedTech.forEach(([name, data], i) => {
            const productivity = data.total > 0 ? ((data.tepatWaktu / data.total) * 100).toFixed(1) : '0';
            html += '<tr><td>' + (i + 1) + '</td><td>' + name + '</td><td>' + data.total + '</td>';
            html += '<td>' + data.closed + '</td><td>' + data.tepatWaktu + '</td><td>' + data.overdue + '</td>';
            html += '<td>' + productivity + '%</td></tr>';
        });
        html += '</tbody></table>';
        
        // TOP PELANGGAN
        html += '<h2>🏆 TOP 10 PELANGGAN PALING SERING LAPOR</h2>';
        html += '<table><thead><tr><th>No</th><th>Nama Pelanggan</th><th>Total Laporan</th><th>Gangguan Terbanyak</th></tr></thead><tbody>';
        sortedCustomers.forEach(([cust, data], i) => {
            const topGangguan = Object.entries(data.gangguan).sort((a, b) => b[1] - a[1])[0];
            const gangguanText = topGangguan ? topGangguan[0] + ' (' + topGangguan[1] + 'x)' : '-';
            html += '<tr><td>' + (i + 1) + '</td><td>' + cust + '</td><td>' + data.total + '</td><td>' + gangguanText + '</td></tr>';
        });
        html += '</tbody></table>';
        
        // GAUL
        html += '<h2>⚠️ TEKNISI PENYEBAB GANGGUAN ULANG (GAUL)</h2>';
        html += '<table><thead><tr><th>No</th><th>Nama Teknisi</th><th>Total GAUL</th></tr></thead><tbody>';
        sortedGaul.forEach(([tech, count], i) => {
            html += '<tr><td>' + (i + 1) + '</td><td>' + tech + '</td><td>' + count + '</td></tr>';
        });
        html += '</tbody></table>';
        
        html += '<p style="margin-top:40px;color:#94a3b8;font-size:12px;text-align:center;">';
        html += 'Dicetak dari NOC MAHAWIRA GRUP - ' + new Date().toLocaleString('id-ID');
        html += '</p>';
        html += '</body></html>';
        
        // ===== DOWNLOAD 1 FILE HTML =====
        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Laporan_Lengkap_' + new Date().toISOString().slice(0, 10) + '.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        Swal.fire('Berhasil!', '✅ 1 file HTML lengkap berisi semua data dan grafik berhasil di-export!', 'success');

    } catch (e) {
        Swal.fire('Error', 'Terjadi kesalahan: ' + e.message, 'error');
        console.error(e);
    }
}

function exportReportPDF() {
    notif('📄 Fitur export PDF sedang dikembangkan!', 'info');
}

        function openEditModal(id, name, phone) {
    editingTechId = id;
    document.getElementById('editTechName').value = name;
    document.getElementById('editTechPhone').value = phone;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    editingTechId = null;
}

// ===== FILTER LAPORAN =====
function applyLaporanFilter() {
    const dateFrom = document.getElementById('filterLaporanDate').value;
    const dateTo = document.getElementById('filterLaporanDateTo').value;
    const bulan = document.getElementById('filterLaporanBulan').value;
    const customerName = document.getElementById('filterCustomerName') ? document.getElementById('filterCustomerName').value.toLowerCase().trim() : '';
    const customerOdp = document.getElementById('filterCustomerOdp') ? document.getElementById('filterCustomerOdp').value.toLowerCase().trim() : '';
    
    console.log('Filter dipanggil:', dateFrom, dateTo, bulan, customerName, customerOdp);
    
    let filtered = tickets.slice();
    
    // FILTER TANGGAL
    if (dateFrom || dateTo) {
        filtered = filtered.filter(t => {
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
        });
    }
    
    // FILTER BULAN
    if (bulan === '3bulan') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        filtered = filtered.filter(t => {
            const d = new Date(t.createdAt);
            return d >= threeMonthsAgo;
        });
    } else if (bulan !== '' && bulan !== '3bulan') {
        filtered = filtered.filter(t => {
            const d = new Date(t.createdAt);
            return d.getMonth() == parseInt(bulan);
        });
    }
    
    // FILTER NAMA PELANGGAN
    if (customerName) {
        filtered = filtered.filter(t => {
            const name = (t.customer || '').toLowerCase();
            return name.includes(customerName);
        });
    }
    
    // FILTER ODP/WILAYAH
    if (customerOdp) {
        filtered = filtered.filter(t => {
            const odp = (t.odppelanggan || '').toLowerCase();
            return odp.includes(customerOdp);
        });
    }
    
    console.log('Jumlah data setelah filter:', filtered.length);
    
    renderFilteredData(filtered);
}

// ===== RENDER DATA HASIL FILTER =====
function renderFilteredData(filteredTickets) {
    if (filteredTickets.length === 0) {
        document.getElementById('jenisgangguanReportBody').innerHTML = '<tr><td colspan="4"><div class="empty">Tidak ada data</div></td></tr>';
        document.getElementById('customerReportBody').innerHTML = '<tr><td colspan="4"><div class="empty">Tidak ada data</div></td></tr>';
        document.getElementById('gaulReportBody').innerHTML = '<tr><td colspan="4"><div class="empty">Tidak ada data</div></td></tr>';
        document.getElementById('produktivitasReportBody').innerHTML = '<tr><td colspan="7"><div class="empty">Tidak ada data</div></td></tr>';
        renderCharts([]);
        return;
    }
    
    // === JENIS GANGGUAN ===
    const gMap = {};
    filteredTickets.forEach(t => {
        const jenis = t.jenisgangguan || 'Tidak diketahui';
        gMap[jenis] = (gMap[jenis] || 0) + 1;
    });
    const sortedG = Object.entries(gMap).sort((a,b) => b[1] - a[1]);
    const totalG = filteredTickets.length;
    let htmlG = '';
    sortedG.forEach(([jenis, count], i) => {
        const persen = ((count / totalG) * 100).toFixed(1);
        htmlG += `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${i+1}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;"><strong>${jenis}</strong></td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${count}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${persen}%</td>
        </tr>`;
    });
    document.getElementById('jenisgangguanReportBody').innerHTML = htmlG;
    
    // === TOP PELANGGAN ===
const customerMap = {};

// FILTER TIKET YANG BUKAN GAMAS (HANYA GGN)
const ggnTickets = filteredTickets.filter(t => {
    const jenisTiket = t.jenistiket || '';
    return jenisTiket !== 'GAMAS';
});

ggnTickets.forEach(t => {
    const cust = t.customer || 'Tidak diketahui';
    if (!customerMap[cust]) {
        customerMap[cust] = { 
            total: 0, 
            gangguan: {},
            odppelanggan: t.odppelanggan || '-' 
        };
    }
    customerMap[cust].total++;
    const jenis = t.jenisgangguan || 'Tidak diketahui';
    customerMap[cust].gangguan[jenis] = (customerMap[cust].gangguan[jenis] || 0) + 1;
});

const sortedCustomers = Object.entries(customerMap)
    .sort((a,b) => b[1].total - a[1].total)
    .slice(0, 10);

let htmlC = '';
if (sortedCustomers.length === 0) {
    htmlC = '<tr><td colspan="5"><div class="empty">Tidak ada data pelanggan GGN</div></td></tr>';
} else {
    sortedCustomers.forEach(([cust, data], i) => {
        const topG = Object.entries(data.gangguan).sort((a,b) => b[1] - a[1])[0];
        const gText = topG ? `${topG[0]} (${topG[1]}x)` : '-';
        htmlC += `<tr>
            <td>${i + 1}</td>
            <td><strong>${cust}</strong></td>
            <td>${data.odppelanggan}</td>
            <td>${data.total}</td>
            <td>${gText}</td>
        </tr>`;
    });
}
document.getElementById('customerReportBody').innerHTML = htmlC;
    
    // === GAUL ===
    const gaulMap = {};
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    filteredTickets.forEach(t => {
        const customer = t.customer;
        const techs = t.technicians || [];
        const tDate = new Date(t.createdAt);
        if (tDate >= twoMonthsAgo) {
            const otherTickets = filteredTickets.filter(t2 => {
                if (t2.id === t.id) return false;
                if (t2.customer !== customer) return false;
                return t2.createdAt.toDate() >= twoMonthsAgo;
            });
            if (otherTickets.length > 0) {
                techs.forEach(tech => {
                    gaulMap[tech] = (gaulMap[tech] || 0) + 1;
                });
            }
        }
    });
    const sortedGaul = Object.entries(gaulMap).sort((a,b) => b[1] - a[1]).slice(0,10);
    const totalGaul = Object.values(gaulMap).reduce((a,b) => a+b, 0);
    let htmlGaul = '';
    sortedGaul.forEach(([tech, count], i) => {
        const persen = totalGaul > 0 ? ((count/totalGaul)*100).toFixed(1) : '0';
        htmlGaul += `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${i+1}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;"><strong>${tech}</strong></td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${count}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${persen}%</td>
        </tr>`;
    });
    document.getElementById('gaulReportBody').innerHTML = htmlGaul;
    
    // === PRODUKTIVITAS ===
    const techMap = {};
    techs.forEach(t => { techMap[t.name] = { total: 0, closed: 0, tepatWaktu: 0, overdue: 0 }; });
    filteredTickets.forEach(t => {
        (t.technicians || []).forEach(tech => {
            if (techMap[tech]) {
                techMap[tech].total++;
                if (t.status === 'close') {
                    techMap[tech].closed++;
                    if ((t.ttr || 0) <= t.duration) techMap[tech].tepatWaktu++;
                }
                if ((t.ttr || 0) > t.duration) techMap[tech].overdue++;
            }
        });
    });
    const sortedTech = Object.entries(techMap).filter(([name, data]) => data.total > 0).sort((a,b) => b[1].total - a[1].total);
    let htmlT = '';
    sortedTech.forEach(([name, data], i) => {
        const productivity = data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0;
        htmlT += `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${i+1}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;"><strong>${name}</strong></td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${data.total}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0; color:#16a34a;">${data.closed}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0; color:#22c55e;">${data.tepatWaktu}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0; color:#dc2626;">${data.overdue}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;max-width:120px;">
                        <div style="height:100%;width:${productivity}%;background:${productivity>=80?'#22c55e':productivity>=50?'#f59e0b':'#dc2626'};border-radius:4px;"></div>
                    </div>
                    <span style="font-weight:600;font-size:13px;">${productivity.toFixed(1)}%</span>
                </div>
            </td>
        </tr>`;
    });
    document.getElementById('produktivitasReportBody').innerHTML = htmlT;
    
    // === CHART ===
    renderCharts(filteredTickets);
}

// ===== RESET FILTER =====
function resetLaporanFilter() {
    document.getElementById('filterLaporanDate').value = '';
    document.getElementById('filterLaporanDateTo').value = '';
    document.getElementById('filterLaporanBulan').value = '3bulan';
    document.getElementById('filterLaporanOdp').value = '';
    
    // TAMBAHKAN RESET UNTUK FILTER PELANGGAN
    const nameInput = document.getElementById('filterCustomerName');
    const odpInput = document.getElementById('filterCustomerOdp');
    if (nameInput) nameInput.value = '';
    if (odpInput) odpInput.value = '';
    
    renderReports();
}

// ===== UBAH FUNGSI editTech =====
function editTech(id, name, phone) {
    openEditModal(id, name, phone);
}
// ===== TAMBAHKAN EVENT SAVE =====
// HAPUS BARIS 2133, GANTI DENGAN:
const saveBtn = document.getElementById('saveEditBtn');
if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
        if(!editingTechId) return;
        const newName = document.getElementById('editTechName').value.trim();
        const newPhone = document.getElementById('editTechPhone').value.trim();
        
        if(!newName) { notif('Nama tidak boleh kosong!','warning'); return; }
        
        try {
            const { error } = await sb
                .from('technicians')
                .update({
                    name: newName,
                    phone: newPhone || '-'
                })
                .eq('id', editingTechId);
            
            if (error) throw error;
            
            notif('Teknisi berhasil diupdate!','success');
            closeEditModal();
            loadTechniciansCache();
        } catch(e) {
            notif('Gagal update teknisi: ' + e.message,'danger');
        }
    });
}

        function renderTechDropdown() {
    const select = document.getElementById('techSelect');
    if(!select) return;
    select.innerHTML = '<option value="">-- Pilih Teknisi --</option>';
    
    // Group by posisi
    const groups = {};
    techs.forEach(t => {
        const posisi = t.posisi || 'PSB/GGN';
        if (!groups[posisi]) groups[posisi] = [];
        groups[posisi].push(t);
    });
    
    const posisiOrder = ['PSB/GGN', 'BACKBONE', 'PROJECT'];
    posisiOrder.forEach(posisi => {
        if (groups[posisi] && groups[posisi].length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = posisi;
            groups[posisi].forEach(t => {
                if(!selectedTechs.includes(t.name)) {
                    const opt = document.createElement('option');
                    opt.value = t.name;
                    opt.textContent = t.name;
                    optgroup.appendChild(opt);
                }
            });
            select.appendChild(optgroup);
        }
    });
    
    renderSelectedTechs();
}

function renderSelectedTechs() {
    const container = document.getElementById('selectedTechs');
    if(!container) return;
    if(selectedTechs.length === 0) {
        container.innerHTML = '<span style="color:#94a3b8;font-size:13px;">Belum ada teknisi</span>';
        return;
    }
    container.innerHTML = selectedTechs.map(name => `
        <span style="background:#eef2ff;padding:4px 14px;border-radius:20px;font-size:13px;border:1px solid #c7d2fe;display:inline-flex;align-items:center;gap:8px;">
            ${name}
            <span onclick="removeTechFromTicket('${name}')" style="cursor:pointer;color:#dc2626;font-weight:700;">×</span>
        </span>
    `).join('');
}

function addTechToTicket() {
    const select = document.getElementById('techSelect');
    if(!select.value) { notif('Pilih teknisi!','warning'); return; }
    if(selectedTechs.includes(select.value)) { notif('Sudah dipilih!','warning'); return; }
    selectedTechs.push(select.value);
    renderTechDropdown();
}

function removeTechFromTicket(name) {
    selectedTechs = selectedTechs.filter(t => t !== name);
    renderTechDropdown();
}

        

        function renderTechList() {
    const container = document.getElementById('techTablesContainer');
    if(!container) return;
    
    if(techs.length === 0) {
        container.innerHTML = '<div class="empty"><span class="icon">👨‍🔧</span><p>Belum ada teknisi</p></div>';
        return;
    }
    
    const hasPosisi = techs.some(t => t.posisi !== undefined && t.posisi !== null);
    
    if (!hasPosisi) {
        let html = `<div class="table-wrap"><table style="width:100%;border-collapse:collapse;table-layout:fixed;"><thead><tr><th style="width:80px;padding:10px 12px;text-align:left;">No</th><th style="padding:10px 12px;text-align:left;">Nama</th><th style="width:120px;padding:10px 12px;text-align:left;">HP</th><th style="width:200px;padding:10px 12px;text-align:left;">Aksi</th></tr></thead><tbody>`;
        techs.forEach((t, i) => {
            html += `<tr>
                <td style="padding:10px 12px;">${i+1}</td>
                <td style="padding:10px 12px;"><strong>${t.name}</strong></td>
                <td style="padding:10px 12px;">${t.phone || '-'}</td>
                <td style="padding:10px 12px;">
                    <button class="btn btn-primary btn-sm" onclick="editTech('${t.id}','${t.name}','${t.phone || '-'}','${t.posisi || 'PSB/GGN'}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTech('${t.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
        return;
    }
    
    const groups = {};
    techs.forEach(t => {
        const posisi = t.posisi || 'PSB/GGN';
        if (!groups[posisi]) groups[posisi] = [];
        groups[posisi].push(t);
    });
    
    const posisiOrder = ['PSB/GGN', 'BACKBONE', 'PROJECT'];
    let html = '';
    
    posisiOrder.forEach(posisi => {
        const techList = groups[posisi] || [];
        
        let headerColor = '#0b1a33';
        if (posisi === 'BACKBONE') { headerColor = '#92400e'; }
        else if (posisi === 'PROJECT') { headerColor = '#166534'; }
        
        html += `<div style="margin-top:20px;border:2px solid ${headerColor};border-radius:12px;overflow:hidden;">`;
        html += `<div style="background:${headerColor};color:white;padding:10px 16px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;align-items:center;">
            <span>${posisi}</span>
            <span style="font-size:13px;font-weight:100;background:rgba(255,255,255,0.2);padding:2px 14px;border-radius:20px;">${techList.length} teknisi</span>
        </div>`;
        html += `<div class="table-wrap" style="border:none;border-radius:0;overflow-x:auto;">`;
        html += `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><thead><tr><th style="width:100px;padding:10px 12px;text-align:left;">No</th><th style="padding:10px 12px;text-align:left;">Nama</th><th style="width:120px;padding:10px 12px;text-align:left;">HP</th><th style="width:200px;padding:10px 12px;text-align:left;">Aksi</th></tr></thead><tbody>`;
        
        if (techList.length === 0) {
            html += `<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8;">Belum ada teknisi</td></tr>`;
        } else {
            techList.forEach((t, i) => {
                html += `<tr>
                    <td style="padding:10px 12px;">${i+1}</td>
                    <td style="padding:10px 12px;"><strong>${t.name}</strong></td>
                    <td style="padding:10px 12px;">${t.phone || '-'}</td>
                    <td style="padding:10px 12px;">
                        <button class="btn btn-primary btn-sm" onclick="editTech('${t.id}','${t.name}','${t.phone || '-'}','${t.posisi || 'PSB/GGN'}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTech('${t.id}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </td>
                </tr>`;
            });
        }
        
        html += `</tbody></table></div></div>`;
    });
    
    container.innerHTML = html;
}

function editTech(id, currentName, currentPhone, currentPosisi) {
    Swal.fire({
        title: '✏️ Edit Teknisi',
        width: 420,
        padding: '1.5rem',
        background: '#ffffff',
        html: `
            <div style="text-align:left; margin-top:8px;">
                <div style="margin-bottom:16px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px;">
                        <i class="fas fa-user" style="color:#2563eb; margin-right:6px;"></i> Nama Teknisi
                    </label>
                    <input id="swalEditName" type="text" value="${currentName}" 
                        style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none;">
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px;">
                        <i class="fas fa-phone" style="color:#2563eb; margin-right:6px;"></i> No HP
                    </label>
                    <input id="swalEditPhone" type="text" value="${currentPhone || ''}" 
                        style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none;">
                </div>
                <div style="margin-bottom:4px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px;">
                        <i class="fas fa-briefcase" style="color:#2563eb; margin-right:6px;"></i> Posisi
                    </label>
                    <select id="swalEditPosisi" style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; background:white;">
                        <option value="PSB/GGN" ${currentPosisi === 'PSB/GGN' ? 'selected' : ''}>PSB/GGN</option>
                        <option value="BACKBONE" ${currentPosisi === 'BACKBONE' ? 'selected' : ''}>BACKBONE</option>
                        <option value="PROJECT" ${currentPosisi === 'PROJECT' ? 'selected' : ''}>PROJECT</option>
                    </select>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const name = document.getElementById('swalEditName').value.trim();
            const phone = document.getElementById('swalEditPhone').value.trim();
            const posisi = document.getElementById('swalEditPosisi').value;
            if(!name) {
                Swal.showValidationMessage('⚠️ Nama teknisi wajib diisi!');
                return false;
            }
            return { name, phone, posisi };
        }
    }).then(async (result) => {
        if(result.isConfirmed) {
            const { name, phone, posisi } = result.value;
            try {
                const { error } = await sb
                    .from('technicians')
                    .update({
                        name: name,
                        phone: phone || '-',
                        posisi: posisi
                    })
                    .eq('id', id);

                if (error) throw error;
                
                localStorage.removeItem('techs_data');
                localStorage.removeItem('techs_last_fetch');
                
                await loadTechniciansCache();
                renderTechList();
                renderTechDropdown();
                renderPerformance();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: 'Teknisi ' + name + ' berhasil diupdate',
                    timer: 1500,
                    showConfirmButton: false
                });
                
            } catch(e) {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal!',
                    text: 'Terjadi kesalahan: ' + e.message,
                    confirmButtonColor: '#dc2626'
                });
            }
        }
    });
}

        async function addTechnician() {
    const nameInput = document.getElementById('techName');
    const phoneInput = document.getElementById('techPhone');
    const posisiInput = document.getElementById('techPosisi');
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const posisi = posisiInput ? posisiInput.value : 'PSB/GGN';
    
    if(!name) { 
        Swal.fire('Peringatan', 'Masukkan nama teknisi!', 'warning');
        return; 
    }
    
    try {
        const { error } = await sb
            .from('technicians')
            .insert({ 
                name: name, 
                phone: phone || '-',
                posisi: posisi
            });
        
        if (error) throw error;
        
        nameInput.value = '';
        phoneInput.value = '';
        if (posisiInput) posisiInput.value = 'PSB/GGN';
        
        const { data } = await sb
            .from('technicians')
            .select('*')
            .order('name');
        
        techs = data;
        
        renderTechList();
        renderTechDropdown();
        renderPerformance();
        
        Swal.fire('Berhasil', 'Teknisi '+name+' ('+posisi+') ditambahkan!', 'success');
        refreshData();
        
    } catch(e) { 
        Swal.fire('Gagal', e.message, 'error');
        console.error(e);
    }
}





        async function deleteTech(id) {
    const tech = techs.find(t => t.id === id);
    if(!tech) return;
    
    const result = await Swal.fire({
        title: '⚠️ Hapus Teknisi',
        text: `Apakah Anda yakin ingin menghapus "${tech.name}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🗑️ Hapus',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        buttonsStyling: false,
        customClass: {
            confirmButton: 'btn btn-danger',
            cancelButton: 'btn btn-outline',
            popup: 'swal-custom-popup'
        },
        reverseButtons: true
    });
    
    if(result.isConfirmed) {
        try {
            const { error } = await sb
                .from('technicians')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            localStorage.removeItem('techs_data');
            localStorage.removeItem('techs_last_fetch');
            
            Swal.fire({
                icon: 'success',
                title: 'Terhapus!',
                text: `Teknisi "${tech.name}" berhasil dihapus`,
                timer: 1500,
                showConfirmButton: false,
                background: '#ffffff',
                backdrop: 'rgba(0,0,0,0.3)'
            });
            
            await loadTechniciansCache();
            renderTechList();
            renderTechDropdown();
            renderPerformance();
            
            notif('✅ Teknisi ' + tech.name + ' dihapus', 'success');
            
        } catch(e) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal!',
                text: 'Terjadi kesalahan: ' + e.message,
                confirmButtonColor: '#dc2626'
            });
        }
    }
}

      // DI FUNGSI addTicket, TAMBAHKAN VARIABLE jenisTiket
async function addTicket() {
    const ticketIdInput = document.getElementById('ticketId');
    if (!ticketIdInput) {
        notif('Element ticketId tidak ditemukan!', 'danger');
        return;
    }
    const id = ticketIdInput.value.trim().toUpperCase();
    const cust = sanitize(document.getElementById('customer').value.trim());
    const desc = sanitize(document.getElementById('jenisGangguan').value.trim());
    const dur = parseInt(document.getElementById('duration').value);
    const manualDate = document.getElementById('createdAtManual').value;
    const jenisTiket = document.getElementById('jenisTiket').value;
    const keteranganGamas = document.getElementById('keteranganGamas') ? document.getElementById('keteranganGamas').value.trim() : '';
    const odpPelanggan = document.getElementById('odpPelanggan') ? document.getElementById('odpPelanggan').value.trim() : '';

    if(!id || !cust || !dur || selectedTechs.length === 0) {
        notif('Isi semua field dan pilih minimal 1 teknisi!','warning');
        return;
    }

    // VALIDASI ODP UNTUK JENIS TIKET SELAIN PSB
    if (jenisTiket !== 'PSB' && !odpPelanggan) {
        notif('⚠️ ODP / ID Pelanggan / Wilayah wajib diisi untuk tiket ' + jenisTiket + '!', 'warning');
        document.getElementById('odpPelanggan').focus();
        document.getElementById('odpPelanggan').style.borderColor = '#dc2626';
        setTimeout(() => {
            document.getElementById('odpPelanggan').style.borderColor = '#d1d9e6';
        }, 3000);
        return;
    }

    if (dur < 1 || dur > 1440) {
        notif('Durasi minimal 1 menit, maksimal 1440 menit!', 'warning');
        return;
    }

    const canProceed = await checkDuplicateCustomer(cust);
    if(!canProceed) return;

    let createdAt = manualDate ? new Date(manualDate).toISOString() : new Date().toISOString();

    if (manualDate && new Date(manualDate) > new Date()) {
        notif('Waktu tidak boleh melebihi sekarang!', 'warning');
        return;
    }

    try {
        const { error } = await sb
            .from('tickets')
            .insert({
                ticketid: id,
                customer: cust,
                duration: dur,
                jenisgangguan: desc,
                technicians: selectedTechs,
                status: 'open',
                createdAt: createdAt,
                ttr: 0,
                pendingnote: null,
                closeticket: null,
                closedAt: null,
                keterangan: null,
                jenisperbaikan: null,
                jenistiket: jenisTiket,
                keterangangamas: keteranganGamas || '-',
                odppelanggan: odpPelanggan || '-'  // TAMBAHKAN FIELD INI
            });
        if (error) throw error;

        document.getElementById('ticketId').value = '';
        document.getElementById('customer').value = '';
        document.getElementById('jenisGangguan').value = '';
        document.getElementById('duration').value = '60';
        document.getElementById('createdAtManual').value = '';
        document.getElementById('jenisTiket').value = 'PSB';
        document.getElementById('odpPelanggan').value = '';  // RESET ODP
        updateJenisGangguan();
        selectedTechs = [];
        renderTechDropdown();

        notif('Tiket ' + id + ' berhasil dibuat!', 'success');
        refreshData(); 
    } catch (e) {
        notif('Gagal buat tiket: ' + e.message, 'danger');
    }
}

async function checkDuplicateCustomer(customerName) {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const { data, error } = await sb
    .from('tickets')
    .select('*')
    .eq('customer', customerName);

    if (error) {
        console.error('Error check duplicate:', error);
        return true;
    }

    const filteredTickets = data.filter(doc => {
        const createdAt = doc.createdAt ? new Date(doc.createdAt) : null;
        return createdAt && createdAt >= twoMonthsAgo;
    });

    if (filteredTickets.length === 0) return true;

    const count = filteredTickets.length;
    let listGangguan = '';
    let no = 1;
    filteredTickets.forEach(doc => {
        const tanggal = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('id-ID') : '-';
        const teknisi = doc.technicians ? doc.technicians.join(', ') : '-';

        listGangguan += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 8px;font-size:13px;">${no++}</td>
                <td style="padding:6px 8px;font-size:13px;">${tanggal}</td>
                <td style="padding:6px 8px;font-size:13px;font-weight:600;">${doc.ticketid || '-'}</td>
                <td style="padding:6px 8px;font-size:13px;">${doc.jenisgangguan || '-'}</td>
                <td style="padding:6px 8px;font-size:13px;">${teknisi}</td>
                <td style="padding:6px 8px;font-size:12px;">
                    <span class="badge-status ${doc.status}">${doc.status}</span>
                </td>
            </tr>
        `;
    });

    const result = await Swal.fire({
        icon: 'warning',
        title: '⚠️ Peringatan!',
        width: 700,
        html: `
            <div style="text-align:left;">
                <p style="margin-bottom:12px;">Pelanggan <strong>${customerName}</strong> sudah membuat tiket sebanyak <strong>${count}x</strong> dalam 2 bulan terakhir.</p>
                
                <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:auto;max-height:280px;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead style="background:#f8fafc;position:sticky;top:0;">
                            <tr>
                                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569;">No</th>
                                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569;">Tanggal</th>
                                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569;">No Tiket</th>
                                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569;">Jenis Gangguan</th>
                                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569;">Teknisi</th>
                                <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${listGangguan}
                        </tbody>
                    </table>
                </div>
                
                <p style="font-size:13px;color:#dc2626;margin-top:14px;text-align:center;">Apakah tetap ingin membuat tiket baru?</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Tetap Buat',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
        return true;
    }
    return false;
}

        async function pendingTicket(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;

    if (ticket.status === 'close') {
        notif('Tiket sudah close, tidak bisa di-pending', 'warning');
        return;
    }

    if (ticket.status === 'pending') {
        const result = await Swal.fire({
            title: '▶️ Resume Tiket',
            text: `Lanjutkan tiket ${ticket.ticketId}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#94a3b8'
        });

        if (!result.isConfirmed) return;

        try {
            const { error } = await sb
    .from('tickets')
    .update({
        status: 'open',
        pendingAt: null
    })
    .eq('id', docId);

            if (error) throw error;
            notif('Tiket ' + ticket.ticketId + ' dilanjutkan', 'info');
            setupRealtime();
        } catch (e) {
            notif('Gagal resume: ' + e.message, 'danger');
        }
        return;
    }

    if (ticket.pendingcount && ticket.pendingcount >= 1) {
        notif('Tiket ini sudah pernah di-pending! Tidak boleh pending lebih dari 1x.', 'danger');
        return;
    }

    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (diffHours > 24) {
        notif('Maksimal pending 24 jam sejak tiket dibuat!', 'danger');
        return;
    }

    const { value: alasan } = await Swal.fire({
        title: '⏸ Pending Tiket',
        html: `
            <div style="text-align:left;">
                <p style="margin-bottom:12px; color:#475569; font-size:14px;">
                    Tiket: <strong>${ticket.ticketId}</strong> | Customer: <strong>${ticket.customer}</strong>
                </p>
                <textarea id="swalPendingReason" 
                    style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; font-family:inherit;"
                    placeholder="Alasan pending..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Pending',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const reason = document.getElementById('swalPendingReason').value.trim().toUpperCase();
            if (!reason) {
                Swal.showValidationMessage('Alasan wajib diisi!');
                return false;
            }
            return reason;
        }
    });

    if (!alasan) return;

    try {
        const { error } = await sb
    .from('tickets')
    .update({
        status: 'pending',
        pendingnote: `⏸ PENDING: ${alasan} | ${new Date().toLocaleString('id-ID')}`,
        pendingAt: new Date().toISOString(),
        pendingcount: (ticket.pendingcount || 0) + 1
    })
    .eq('id', docId);

        if (error) throw error;

        notif('Tiket ' + ticket.ticketId + ' di-pending', 'warning');
        refreshData();
    } catch (e) {
        notif('Gagal pending: ' + e.message, 'danger');
    }
}

      async function closeticket(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if(!ticket) return;
    
    // CEK APAKAH TIKET SUDAH CLOSE
    if (ticket.status === 'close') {
        notif('Tiket sudah close!', 'warning');
        return;
    }
    
    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const diffMs = now.getTime() - createdAt.getTime();
    const ttr = diffMs / 60000;
    const isOverdue = ttr > ticket.duration;
    
    let keterangan = '';
    
    if(isOverdue) {
        const { value: alasan } = await Swal.fire({
            title: '⚠️ Tiket Overdue!',
            text: 'Berikan keterangan penyebab overdue:',
            input: 'textarea',
            inputPlaceholder: 'Tulis penyebab overdue...',
            inputAttributes: { style: 'text-transform:uppercase;' },
            showCancelButton: true,
            confirmButtonText: 'Close Tiket',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
            inputValidator: (value) => {
                if(!value) return 'Keterangan wajib diisi!';
                return null;
            }
        });
        if(!alasan) return;
        keterangan = alasan.toUpperCase();
    }
    
    // PERBAIKI: GUNAKAN INPUT TEXT BUKAN TEXTAREA
    const { value: jenisPerbaikan } = await Swal.fire({
        title: '📝 Jenis Perbaikan',
        html: `
            <div style="text-align:left; margin-top:10px;">
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Masukkan jenis perbaikan:
                </label>
                <input id="swalJenisPerbaikan" type="text" 
                    style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; text-transform:uppercase;"
                    placeholder="Contoh: GANTI MODEM, SETTING ULANG, DLL">
                <p style="font-size:12px; color:#64748b; margin-top:6px;">
                    <i class="fas fa-info-circle"></i> Kosongkan jika tidak ada
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '✅ Close Tiket',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const value = document.getElementById('swalJenisPerbaikan').value.trim().toUpperCase();
            return value || '-';
        }
    });
    
    if (jenisPerbaikan === undefined) return;
    
    const finalJenisPerbaikan = jenisPerbaikan || '-';
    
    try {
        const { error } = await sb
            .from('tickets')
            .update({
                status: 'close',
                ttr: Math.round(ttr * 100) / 100,
                closedAt: now.toISOString(),
                keterangan: keterangan || '-',
                jenisperbaikan: finalJenisPerbaikan
            })
            .eq('id', docId);

        if (error) throw error;
        
        notif('Tiket '+ticket.ticketid+' ditutup!', 'success');
        refreshData();
    } catch(e) {
        notif('Gagal tutup tiket: ' + e.message, 'danger');
    }
}

       async function deleteTicket(docId) {
    if (!confirm('Hapus tiket?')) return;
    try {
        const { error } = await sb
    .from('tickets')
    .delete()
    .eq('id', docId);

        if (error) throw error;
        notif('Tiket dihapus', 'success');
        refreshData(); 
    } catch (e) {
        notif('Gagal hapus: ' + e.message, 'danger');
    }
}

function viewCustomerHistory(customerName) {
    const historyTickets = tickets.filter(t => t.customer === customerName);
    if (historyTickets.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Tidak ada history tiket untuk pelanggan ini.',
            confirmButtonColor: '#2563eb',
            customClass: { popup: 'swal-custom-popup' }
        });
        return;
    }

    let html = `<div style="text-align:left; max-height:400px; overflow-y:auto; font-size:13px; border-radius:12px;">
        <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f8fafc;">
                <th style="padding:8px 10px; border-bottom:2px solid #e2e8f0;">Tanggal</th>
                <th style="padding:8px 10px; border-bottom:2px solid #e2e8f0;">Tiket</th>
                <th style="padding:8px 10px; border-bottom:2px solid #e2e8f0;">Jenis Gangguan</th>
                <th style="padding:8px 10px; border-bottom:2px solid #e2e8f0;">Status</th>
            </tr></thead>
            <tbody>`;
    
    historyTickets.forEach(t => {
        const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID') : '-';
        const statusMap = {'open': '🔴 OPEN', 'pending': '⏸ PENDING', 'close': '✅ CLOSE'};
        const statusLabel = statusMap[t.status] || t.status;
        html += `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 10px;">${date}</td>
            <td style="padding:8px 10px;"><strong>${t.ticketid || '-'}</strong></td>
            <td style="padding:8px 10px;">${t.jenisgangguan || '-'}</td>
            <td style="padding:8px 10px;">${statusLabel}</td>
        </tr>`;
    });
    
    html += `</tbody></table></div>`;

    Swal.fire({
        title: `📜 History Laporan: ${customerName}`,
        html: html,
        icon: 'info',
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb',
        width: 800,
        customClass: {
            popup: 'swal-custom-popup',
            title: 'swal2-title-smooth'
        },
        showClass: {
            popup: 'animate__animated animate__fadeInUp'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutDown'
        }
    });
}


        function renderTickets(data = null, page = 1) {
    const body = document.getElementById('ticketBody');
    const count = document.getElementById('ticketCount');
    
    if (data === null) {
        data = tickets;
    }
    
    window._currentDisplayData = data;
    
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const pageData = data.slice(startIndex, endIndex);
    
    count.textContent = totalItems + ' tiket (Halaman ' + page + '/' + totalPages + ')';

    if(totalItems===0) {
        body.innerHTML = '<tr><td colspan="15"><div class="empty"><span class="icon">📭</span>Belum ada tiket</div></td></tr>';
        stopTimer(); 
        renderPagination(totalItems, page);
        return;
    }

    body.innerHTML = pageData.map(t => {
        const status = t.status || 'open';
        const isClosed = status === 'close';
        const isOpen = status === 'open';
        const isPending = status === 'pending';
        
        let ttrDisplay;
        if(isOpen) {
            const now = new Date();
            const createdAt = new Date(t.createdAt);
            const elapsedMs = now.getTime() - createdAt.getTime();
            const elapsedMinutes = elapsedMs / 60000;
            const remainingMinutes = t.duration - elapsedMinutes;
            const isOverdue = remainingMinutes <= 0;
            
            if(isOverdue) {
                const overdueMinutes = Math.abs(remainingMinutes);
                ttrDisplay = `<span class="live-timer overdue" style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">+${formatDur(overdueMinutes)}</span>`;
            } else {
                ttrDisplay = `<span class="live-timer" style="background:#dcfce7;color:#166534;padding:2px 12px;border-radius:6px;font-weight:600;">-${formatDur(remainingMinutes)}</span>`;
            }
        } else if(isClosed) {
            const diff = (t.ttr || 0) - t.duration;
            if(diff > 0) {
                ttrDisplay = `<span style="color:#dc2626;font-weight:700;">+${formatDur(diff)}</span>`;
            } else if(diff < 0) {
                ttrDisplay = `<span style="color:#166534;font-weight:600;">-${formatDur(Math.abs(diff))}</span>`;
            } else {
                ttrDisplay = `<span style="color:#059669;font-weight:600;">00:00:00</span>`;
            }
        } else if(isPending) {
            ttrDisplay = `<span style="color:#6b7280;">⏸ pending</span>`;
        } else {
            ttrDisplay = formatDur(t.ttr || 0);
        }

        let statusClass = 'open';
        let statusLabel = '🔴 OPEN';
        if (isClosed) {
            statusClass = 'close';
            statusLabel = '✅ CLOSE';
        } else if (isPending) {
            statusClass = 'pending';
            statusLabel = '⏸ PENDING';
        }

        const techDisplay = t.technicians && Array.isArray(t.technicians) ?
            t.technicians.map(n => `<span class="tech-badge">${n}</span>`).join(' ') : '-';

        let closeEstDisplay = '-';
        const createdAt = new Date(t.createdAt);
        const estTime = new Date(createdAt.getTime() + t.duration * 60000);
        closeEstDisplay = formatTime(estTime);
        
        let closeticketDisplay = '-';
        if (isClosed && t.closedAt) {
            closeticketDisplay = formatTime(t.closedAt);
        }

        const isOverdue = (isOpen || isClosed) ? 
            (t.ttr || 0) > t.duration : false;

        const rowClass = isOverdue ? 'overdue' : '';

        const jenisPerbaikan = t.jenisperbaikan || '-';
        const jenisGangguan = t.jenisgangguan || '-';
        const odpPelanggan = t.odppelanggan || '-';

        return `
        <tr data-ticket-id="${t.id}" class="${rowClass}">
            <td>${formatDate(t.createdAt)}</td>
            <td>${getJenisTiketBadge(t)}</td>
            <td><strong>${t.ticketid}</strong></td>
            <td>${t.customer}</td>
            <td>
                <strong>${jenisGangguan}</strong>
                ${isClosed ? `<button class="btn btn-outline btn-sm" onclick="editJenisGangguan('${t.id}')" title="Edit Jenis Gangguan" style="padding:2px 6px;font-size:10px;margin-left:4px;">
                    <i class="fas fa-edit" style="color:#2563eb;"></i>
                </button>` : ''}
            </td>
            <td>${odpPelanggan}</td>
            <td>${formatDur(t.duration)}</td>
            <td>${formatTime(t.createdAt)}</td>
            <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                    ${techDisplay}
                    ${!isClosed ? `
                        <button class="btn btn-outline btn-sm" onclick="editTicketTech('${t.id}')" title="Ganti Teknisi" style="padding:2px 6px;font-size:12px;">
                            <i class="fas fa-exchange-alt" style="color:#2563eb;"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="addTicketTech('${t.id}')" title="Tambah Teknisi" style="padding:2px 6px;font-size:12px;">
                            <i class="fas fa-plus-circle" style="color:#16a34a;"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
            <td>${closeEstDisplay}</td>
            <td>${closeticketDisplay}</td>
            <td class="ttr-cell">${ttrDisplay}</td>
            <td class="status-cell">
                <span class="badge-status ${statusClass}">${statusLabel}</span>
                ${isOverdue ? ' <span class="badge-overdue">OVERDUE</span>' : ''}
            </td>
            <td>${t.keterangan || '-'}</td>
            <td>
                <strong>${jenisPerbaikan}</strong>
                ${isClosed ? `<button class="btn btn-outline btn-sm" onclick="editJenisPerbaikan('${t.id}')" title="Edit Jenis Perbaikan" style="padding:2px 6px;font-size:10px;margin-left:4px;">
                    <i class="fas fa-edit" style="color:#2563eb;"></i>
                </button>` : ''}
            </td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">
                ${isOpen ? `<button class="btn btn-success btn-sm" onclick="closeticket('${t.id}')">Close</button>` : ''}
               
                ${isClosed ? `<button class="btn btn-outline btn-sm" onclick="editcloseticket('${t.id}')" title="Edit Waktu Close"><i class="fas fa-clock"></i></button>` : ''}
            </td>
        </tr>
        `;
    }).join('');
    
    renderPagination(totalItems, page);
    
    const hasOpen = data.some(t => t.status === 'open');
    if(hasOpen) startTimer(); else stopTimer();
}


async function editJenisPerbaikan(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;
    
    if (ticket.status !== 'close') {
        notif('Hanya tiket yang sudah close yang bisa diedit jenis perbaikannya!', 'warning');
        return;
    }
    
    const { value: newJenisPerbaikan } = await Swal.fire({
        title: '✏️ Edit Jenis Perbaikan',
        html: `
            <div style="text-align:left; margin-top:10px;">
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Jenis Perbaikan saat ini:
                </label>
                <div style="background:#f1f5f9; padding:8px 14px; border-radius:8px; margin-bottom:14px; font-weight:600; color:#0b1a33;">
                    ${ticket.jenisperbaikan || '-'}
                </div>
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Jenis Perbaikan baru:
                </label>
                <input id="swalEditJenisPerbaikan" type="text" 
                    style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; text-transform:uppercase;"
                    placeholder="Contoh: GANTI MODEM, SETTING ULANG, DLL"
                    value="${ticket.jenisperbaikan || ''}">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const value = document.getElementById('swalEditJenisPerbaikan').value.trim().toUpperCase();
            if (!value) {
                Swal.showValidationMessage('Jenis perbaikan tidak boleh kosong!');
                return false;
            }
            return value;
        }
    });
    
    if (!newJenisPerbaikan) return;
    
    try {
        const { error } = await sb
            .from('tickets')
            .update({
                jenisperbaikan: newJenisPerbaikan
            })
            .eq('id', docId);
            
        if (error) throw error;
        
        notif('✅ Jenis perbaikan berhasil diupdate!', 'success');
        refreshData();
    } catch(e) {
        notif('❌ Gagal update jenis perbaikan: ' + e.message, 'danger');
    }
}

async function editJenisGangguan(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;
    
    if (ticket.status !== 'close') {
        notif('Hanya tiket yang sudah close yang bisa diedit jenis gangguannya!', 'warning');
        return;
    }
    
    // Ambil semua option dari dropdown jenis gangguan
    const selectElement = document.getElementById('jenisGangguan');
    let options = '';
    
    if (selectElement) {
        // Gunakan option dari dropdown yang ada
        for (let i = 0; i < selectElement.options.length; i++) {
            const value = selectElement.options[i].value;
            const text = selectElement.options[i].text;
            if (value) {
                const selected = value === ticket.jenisgangguan ? 'selected' : '';
                options += `<option value="${value}" ${selected}>${text}</option>`;
            }
        }
    } else {
        // Fallback options
        const defaultOptions = [
            'Ganti Adaptor', 'Ganti HTB', 'Ganti Modem', 'Ganti Sandi',
            'Internet lambat', 'Kabel Putus (LOS)', 'Kabel Terjuntai',
            'Pindah Modem', 'Tidak Ada Koneksi Internet',
            'GAMAS FEEDER', 'GAMAS DISTRIBUSI', 'PROJECT'
        ];
        defaultOptions.forEach(opt => {
            const selected = opt === ticket.jenisgangguan ? 'selected' : '';
            options += `<option value="${opt}" ${selected}>${opt}</option>`;
        });
    }
    
    const { value: newJenisGangguan } = await Swal.fire({
        title: '✏️ Edit Jenis Gangguan',
        html: `
            <div style="text-align:left; margin-top:10px;">
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Jenis Gangguan saat ini:
                </label>
                <div style="background:#f1f5f9; padding:8px 14px; border-radius:8px; margin-bottom:14px; font-weight:600; color:#0b1a33;">
                    ${ticket.jenisgangguan || '-'}
                </div>
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Jenis Gangguan baru:
                </label>
                <select id="swalEditJenisGangguan" 
                    style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; background:white;">
                    ${options}
                </select>
                <p style="font-size:12px; color:#64748b; margin-top:6px;">
                    <i class="fas fa-info-circle"></i> Pilih jenis gangguan yang sesuai
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const value = document.getElementById('swalEditJenisGangguan').value;
            if (!value) {
                Swal.showValidationMessage('Jenis gangguan tidak boleh kosong!');
                return false;
            }
            return value;
        }
    });
    
    if (!newJenisGangguan) return;
    
    try {
        const { error } = await sb
            .from('tickets')
            .update({
                jenisgangguan: newJenisGangguan
            })
            .eq('id', docId);
            
        if (error) throw error;
        
        notif('✅ Jenis gangguan berhasil diupdate!', 'success');
        refreshData();
    } catch(e) {
        notif('❌ Gagal update jenis gangguan: ' + e.message, 'danger');
    }
}

function getJenisTiketBadge(t) {
    const jenisTiket = t.jenistiket || '-';
    
    if (jenisTiket === 'PSB') {
        return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#10b981;color:white;">PSB</span>';
    } else if (jenisTiket === 'GAMAS') {
        return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#dc2626;color:white;">GAMAS</span>';
    } else {
        return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#2563eb;color:white;">REGULER</span>';
    }
}


async function editKeterangan(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if(!ticket) return;
    
    if (ticket.status !== 'close') {
        notif('Hanya tiket yang sudah close yang bisa diedit!', 'warning');
        return;
    }
    
    const { value: formValues } = await Swal.fire({
        title: '✏️ Edit Keterangan & Jenis Perbaikan',
        html: `
            <div style="text-align:left;">
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Keterangan</label>
                    <textarea id="editKeteranganText" style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:8px;min-height:60px;text-transform:uppercase;">${(ticket.keterangan || '').toUpperCase()}</textarea>
                </div>
                <div>
                    <label style="display:block;font-weight:600;margin-bottom:4px;">Jenis Perbaikan</label>
                    <input id="editjenisPerbaikan" type="text" value="${ticket.jenisPerbaikan || ''}" style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:8px;text-transform:uppercase;">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const keterangan = document.getElementById('editKeteranganText').value.trim().toUpperCase();
            const jenisPerbaikan = document.getElementById('editjenisPerbaikan').value.trim().toUpperCase();
            return { keterangan, jenisPerbaikan };
        }
    });
    
    if(!formValues) return;
    
    try {
        const { error } = await sb
            .from('tickets')
            .update({
                keterangan: formValues.keterangan || '-',
                jenisperbaikan: formValues.jenisPerbaikan || '-'
            })
            .eq('id', docId);

        if (error) throw error;
        notif('Keterangan berhasil diupdate!', 'success');
        refreshData();
    } catch(e) {
        notif('Gagal update keterangan', 'danger');
    }
}

async function editcloseticket(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;
    if (ticket.status !== 'close') {
        notif('Tiket belum close!', 'warning');
        return;
    }

    const createdAt = new Date(ticket.createdAt);
    const maxClose = new Date(createdAt.getTime() + ticket.duration * 60000);
    const maxCloseStr = maxClose.toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const minDate = new Date(createdAt.getTime() + 1000);
    const minDateStr = minDate.toISOString().slice(0, 16);
    const minDateDisplay = minDate.toLocaleString('id-ID');

    const defaultDateStr = minDateStr;

    const now = new Date();
    const maxDateStr = now.toISOString().slice(0, 16);

    const { value: newDate } = await Swal.fire({
        title: '✏️ Edit Waktu Close Ticket',
        width: 550,
        html: `
            <div style="text-align:left;">
                <div style="background:#f8fafc;padding:12px 14px;border-radius:10px;margin-bottom:14px;">
                    <p style="font-size:13px;color:#475569;margin-bottom:4px;">
                        <strong>Tiket:</strong> ${ticket.ticketId}
                    </p>
                    <p style="font-size:13px;color:#475569;margin-bottom:4px;">
                        <strong>Customer:</strong> ${ticket.customer}
                    </p>
                </div>
                
                <div style="background:#fef3c7;padding:10px 14px;border-radius:8px;margin-bottom:14px;border-left:4px solid #f59e0b;">
                    <p style="font-size:13px;color:#92400e;margin-bottom:4px;">
                        <strong>📅 Created At:</strong> ${createdAt.toLocaleString('id-ID')}
                    </p>
                    <p style="font-size:13px;color:#92400e;margin-bottom:4px;">
                        <strong>⏱ Durasi SLA:</strong> ${formatDur(ticket.duration)}
                    </p>
                    <p style="font-size:14px;color:#dc2626;font-weight:700;">
                        <strong>⏰ MAX CLOSE:</strong> ${maxCloseStr}
                    </p>
                </div>
                
                <div style="margin-bottom:4px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Waktu Close Baru</label>
                    <input type="datetime-local" id="editCloseDate" value="${defaultDateStr}" min="${minDateStr}" max="${maxDateStr}" step="1" style="width:100%;padding:10px 12px;border:2px solid #d1d9e6;border-radius:10px;font-size:14px;outline:none;transition:0.2s;">
                    <p style="font-size:12px;color:#dc2626;margin-top:6px;font-weight:600;">⚠️ MINIMAL: ${minDateDisplay}</p>
                    <p style="font-size:12px;color:#dc2626;margin-top:2px;">⚠️ Jika melewati MAX CLOSE, tiket akan otomatis OVERDUE</p>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        buttonsStyling: false,
        customClass: {
            confirmButton: 'btn btn-primary',
            cancelButton: 'btn btn-outline',
            popup: 'swal-custom-popup'
        },
        didOpen: () => {
            const input = document.getElementById('editCloseDate');
            if (input) {
                input.value = defaultDateStr;
                input.min = minDateStr;
                input.max = maxDateStr;
            }
        },
        preConfirm: () => {
            const val = document.getElementById('editCloseDate').value;
            if (!val) {
                Swal.showValidationMessage('⚠️ Pilih waktu!');
                return false;
            }
            const selectedDate = new Date(val);
            if (selectedDate < createdAt) {
                Swal.showValidationMessage('⚠️ Tidak boleh sebelum tiket dibuat! Minimal: ' + minDateDisplay);
                return false;
            }
            if (selectedDate > new Date()) {
                Swal.showValidationMessage('⚠️ Tidak boleh melewati waktu sekarang!');
                return false;
            }
            return selectedDate;
        }
    });

    if (!newDate) return;

        const diffMs = newDate.getTime() - createdAt.getTime();
    const ttr = diffMs / 60000;
    const isOverdue2 = ttr > ticket.duration;

    let keterangan = (ticket.keterangan || '').toUpperCase();
    
    // JIKA TIDAK OVERDUE, KOSONGKAN KETERANGAN
    if (!isOverdue2) {
        keterangan = '-';
    }

    try {
        const { error } = await sb
    .from('tickets')
    .update({
        closedAt: newDate.toISOString(),
        ttr: ttr,
        keterangan: keterangan
    })
    .eq('id', docId);

        if (error) throw error;

        notif('✅ Waktu close tiket ' + ticket.ticketId + ' berhasil diupdate!', 'success');
        refreshData();
    } catch (e) {
        notif('❌ Gagal update waktu close: ' + e.message, 'danger');
    }
}

function renderPagination(totalItems, currentPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    
    // Cari container pagination
    let paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) {
        const card = document.querySelector('.card:last-child .table-wrap');
        if (card) {
            const wrapper = document.createElement('div');
            wrapper.id = 'paginationContainer';
            wrapper.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px 0;flex-wrap:wrap;gap:10px;';
            card.parentNode.insertBefore(wrapper, card.nextSibling);
            paginationContainer = wrapper;
        } else {
            return;
        }
    }
    
    // KALAU TOTAL ITEM <= 10, HAPUS PAGINATION
    if (totalItems <= 10) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    
    // Tombol Previous
    if (currentPage > 1) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${currentPage - 1})">◀ Prev</button>`;
    } else {
        html += `<button class="btn btn-outline btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">◀ Prev</button>`;
    }
    
    // Nomor halaman
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding:0 4px;color:#94a3b8;">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="btn btn-primary btn-sm" style="background:#2563eb;color:white;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;">${i}</button>`;
        } else {
            html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${i})" style="background:transparent;border:1px solid #cbd5e1;border-radius:6px;padding:4px 12px;cursor:pointer;">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding:0 4px;color:#94a3b8;">...</span>`;
        html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Tombol Next
    if (currentPage < totalPages) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${currentPage + 1})">Next ▶</button>`;
    } else {
        html += `<button class="btn btn-outline btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">Next ▶</button>`;
    }
    
    html += '</div>';
    
    // Info jumlah
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    html += `<span style="font-size:13px;color:#64748b;">Menampilkan ${startItem}-${endItem} dari ${totalItems}</span>`;
    
    paginationContainer.innerHTML = html;
}

function goToPage(page) {
    const data = window._currentDisplayData || [];
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    if (page < 1 || page > totalPages) return;
    renderTickets(data, page);
}

function addTechOnSelect() {
    const select = document.getElementById('techSelect');
    if (!select) return;
    const value = select.value;
    if (!value) return;
    if (selectedTechs.includes(value)) {
        notif('Teknisi sudah dipilih!', 'warning');
        select.value = '';
        return;
    }
    selectedTechs.push(value);
    select.value = '';
    renderTechDropdown();
}

        function editTicketTech(ticketid) {
    const ticket = tickets.find(t => t.id === ticketid);
    if(!ticket) return;
    const currentTechs = ticket.technicians || [];
    if(techs.length === 0) { notif('Belum ada teknisi!', 'warning'); return; }
    const options = techs.map(t => `
        <label style="display:block;padding:6px 0;cursor:pointer;border-bottom:1px solid #f1f5f9;">
            <input type="radio" name="techRadio" value="${t.name}" ${currentTechs.includes(t.name) ? 'checked' : ''}>
            <span style="margin-left:8px;">${t.name}</span>
        </label>
    `).join('');
    Swal.fire({
        title: 'Ganti Teknisi',
        html: `<div style="text-align:left;max-height:200px;overflow-y:auto;">${options}</div>`,
        showCancelButton: true,
        confirmButtonText: 'Ganti',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#2563eb',
        preConfirm: () => {
            const checked = document.querySelector('input[name="techRadio"]:checked');
            if(!checked) { Swal.showValidationMessage('Pilih satu teknisi!'); return false; }
            return [checked.value];
        }
    }).then(async (result) => {
        if(result.isConfirmed && result.value.length > 0) {
            try {
                const { error } = await sb
    .from('tickets')
    .update({ technicians: result.value })
    .eq('id', ticketid);
                
                if (error) throw error;
                
                notif('Teknisi diperbarui','success');
                refreshData();
            } catch(e) { 
                notif('Gagal update teknisi: ' + e.message,'danger'); 
            }
        }
    });
}

function addTicketTech(ticketid) {
    const ticket = tickets.find(t => t.id === ticketid);
    if(!ticket) return;
    const currentTechs = ticket.technicians || [];
    const available = techs.filter(t => !currentTechs.includes(t.name));
    if(available.length === 0) { notif('Semua teknisi sudah ditambahkan!', 'warning'); return; }
    const options = available.map(t => `
        <label style="display:block;padding:6px 0;cursor:pointer;border-bottom:1px solid #f1f5f9;">
            <input type="checkbox" value="${t.name}">
            <span style="margin-left:8px;">${t.name}</span>
        </label>
    `).join('');
    Swal.fire({
        title: 'Tambah Teknisi',
        html: `<div style="text-align:left;max-height:200px;overflow-y:auto;">${options}</div>`,
        showCancelButton: true,
        confirmButtonText: 'Tambah',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#16a34a',
        preConfirm: () => {
            const checked = document.querySelectorAll('input[type="checkbox"]:checked');
            if(checked.length === 0) { Swal.showValidationMessage('Pilih minimal satu teknisi!'); return false; }
            return Array.from(checked).map(c => c.value);
        }
    }).then(async (result) => {
        if(result.isConfirmed && result.value.length > 0) {
            const newTechs = [...currentTechs, ...result.value];
            const { error } = await sb
    .from('tickets')
    .update({ technicians: newTechs })
    .eq('id', ticketid);

if (error) throw error;

notif('Teknisi diperbarui','success');
setupRealtime();
        }
    });
}


// Tambahkan di script bagian atas
const dateInput = document.getElementById('filterDate');
if (dateInput) {
    // Set locale Indonesia
    dateInput.lang = 'id';
    
    // Override display
    dateInput.addEventListener('change', function() {
        if (this.value) {
            const d = new Date(this.value + 'T00:00:00');
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            this.setAttribute('data-display', `${day}/${month}/${year}`);
        }
    });
}
        // FILTER
// ===== FILTER TIKET (PAKAI DATA YANG UDAH ADA) =====
function applyFilters() {
    const dateFrom = document.getElementById('filterDate').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const id = document.getElementById('filterId').value.trim().toLowerCase();
    const cust = document.getElementById('filterCustomer').value.trim().toLowerCase();
    const status = document.getElementById('filterStatusSelect').value;

    // FILTER PAKAI DATA YANG UDAH ADA (tickets)
    let filtered = tickets.filter(t => {
        // Filter tanggal
        if (dateFrom || dateTo) {
            const d = new Date(t.createdAt);

            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
        }
        
        // Filter ID
        if (id && !t.ticketId.toLowerCase().includes(id)) return false;
        
        // Filter Customer
        if (cust && !t.customer.toLowerCase().includes(cust)) return false;
        
        // Filter Status
        if (status === 'overdue') {
            if (t.status === 'close' || t.status === 'open') {
                return (t.ttr || 0) > t.duration;
            }
            return false;
        }
        if (status !== 'all' && t.status !== status) return false;
        
        return true;
    });
    
    filteredTickets = filtered;
    
    if (filtered.length > 0) {
        renderTickets(filtered, 1);
    } else {
        const body = document.getElementById('ticketBody');
        body.innerHTML = '<tr><td colspan="14"><div class="empty">Tidak ada tiket sesuai filter</div></td></tr>';
        document.getElementById('ticketCount').textContent = '0 tiket';
        renderPagination(0, 1);
    }
}




       // ===== RESET FILTER =====
function resetFilters() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterId').value = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('filterStatusSelect').value = 'all';
    document.getElementById('filterJenisGangguan').value = 'all'; 
    
    filteredTickets = [];
    renderTickets(null, 1);
}

        function filterStatus(st) {
            document.getElementById('filterStatusSelect').value = st;
            applyFilters();
        }
        function filterToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    document.getElementById('filterDate').value = todayStr;
    document.getElementById('filterDateTo').value = todayStr;
    document.getElementById('filterId').value = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('filterStatusSelect').value = 'all';
    
    applyFilters();
}

// ===== FILTER OVERDUE =====
function filterOverdue() {
    document.getElementById('filterStatusSelect').value = 'overdue';
    applyFilters();
}

// ===== FILTER GAUL =====
function filterGaul() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    // PAKAI DATA YANG UDAH ADA
    const todayTickets = tickets.filter(t => {
        const d = new Date(t.createdAt);

        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    });
    
    const gaulCustomers = todayTickets.filter(t => {
        const customerName = t.customer;
        return tickets.some(t2 => {
            if (t2.id === t.id) return false;
            if (t2.customer !== customerName) return false;
            return t2.createdAt.toDate() >= twoMonthsAgo;
        });
    }).map(t => t.customer);
    
    const uniqueGaul = [...new Set(gaulCustomers)];
    const filtered = todayTickets.filter(t => uniqueGaul.includes(t.customer));
    
    filteredTickets = filtered;
    renderTickets(filtered, 1);
    document.getElementById('ticketCount').textContent = filtered.length + ' tiket (GAUL)';
}

            // Tambahin fungsi ini
    function formatDateDisplay(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Tambahin event listener
    const filterDate = document.getElementById('filterDate');
if (filterDate) {
    filterDate.addEventListener('change', function() {
        if (this.value) {
            this.title = formatDateDisplay(this.value);
        }
    });
}
   
        // PERFORMANCE
        function renderPerformance() {
    const body = document.getElementById('perfBody');
    if(tickets.length===0 || techs.length===0) {
        body.innerHTML = `<tr><td colspan="7"><div class="empty"><span class="icon">📊</span><p>Belum ada data</p></div></td></tr>`;
        return;
    }
    
    const perf = {};
    techs.forEach(t => { perf[t.name] = { total:0, closed:0, open:0, overdue:0, totalTTR:0, closedCount:0 }; });
    
    tickets.forEach(t => {
        if(t.technicians && Array.isArray(t.technicians)) {
            t.technicians.forEach(name => {
                if(perf[name]) {
                    perf[name].total++;
                    if(t.status==='close') { 
                        perf[name].closed++; 
                        perf[name].totalTTR += t.ttr||0; 
                        perf[name].closedCount++; 
                    }
                    else if(t.status==='open') { 
                        perf[name].open++; 
                        if(t.ttr > t.duration) perf[name].overdue++; 
                    }
                    else if(t.status==='pending') { 
                        perf[name].open++; 
                    }
                }
            });
        }
    });
    
    const hasData = Object.values(perf).some(d => d.total>0);
    if(!hasData) {
        body.innerHTML = `<tr><td colspan="7"><div class="empty"><span class="icon">📊</span><p>Belum ada aktivitas</p></div></td></tr>`;
        return;
    }
    
    // ===== URUTKAN BERDASARKAN CLOSED TERBANYAK =====
    const sorted = Object.keys(perf).sort((a, b) => {
        return perf[b].closed - perf[a].closed; // DESC (terbanyak di atas)
    });
    
    let no = 1;
    body.innerHTML = sorted.map(name => {
        const d = perf[name];
        const avg = d.closedCount>0 ? (d.totalTTR/d.closedCount) : 0;
        return `<tr>
            <td>${no++}</td>
            <td><strong>${name}</strong></td>
            <td>${d.total}</td>
            <td style="color:#16a34a;font-weight:600;">${d.closed}</td>
            <td style="color:#d97706;">${d.open}</td>
            <td style="color:#dc2626;font-weight:700;">${d.overdue}</td>
            <td>${formatDur(avg)}</td>
        </tr>`;
    }).join('');
}

        // TIMER
        function startTimer() {
    if(timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(() => {
        const rows = document.querySelectorAll('#ticketBody tr');
        rows.forEach(row => {
            const ttrCell = row.querySelector('.ttr-cell');
            if(!ttrCell) return;
            const ticketid = row.getAttribute('data-ticket-id');
            if(!ticketid) return;
            const ticket = tickets.find(t => t.id===ticketid);
            if(!ticket || ticket.status!=='open') return;
            
            const now = new Date();
            const createdAt = new Date(ticket.createdAt);
            const elapsedMs = now.getTime() - createdAt.getTime();
            const elapsedMinutes = elapsedMs / 60000;
            const remainingMinutes = ticket.duration - elapsedMinutes;
            const isOverdue = remainingMinutes <= 0;
            
            if(isOverdue) {
                const overdueMinutes = Math.abs(remainingMinutes);
                ttrCell.innerHTML = `<span class="live-timer overdue" style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">🔴 +${formatDur(overdueMinutes)}</span>`;
            } else {
                ttrCell.innerHTML = `<span class="live-timer" style="background:#dcfce7;color:#166534;padding:2px 12px;border-radius:6px;font-weight:600;">⏳ ${formatDur(remainingMinutes)}</span>`;
            }
        });
    }, 1000);
}

        function stopTimer() {
            if(timerInterval) { clearInterval(timerInterval); timerInterval=null; timerRunning=false; }
        }

        function formatDur(minutes) {
            if(!minutes || minutes<0) return '00:00:00';
            const hrs = String(Math.floor(minutes/60)).padStart(2,'0');
            const mins = String(Math.floor(minutes%60)).padStart(2,'0');
            const secs = String(Math.floor((minutes%1)*60)).padStart(2,'0');
            return `${hrs}:${mins}:${secs}`;
        }
        function formatDate(ts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} `;
}
function formatTime(ts) { 
    if(!ts) return '-'; 
    const d = ts.toDate ? ts.toDate() : new Date(ts); 
    return d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit', second:'2-digit'}); 
}
       function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTickets = tickets.filter(t => {
        const tDate = new Date(t.createdAt);
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() === today.getTime();
    });

    // CEK ELEMEN SEBELUM DIISI
    const elTotal = document.getElementById('totalTickets');
    const elOpen = document.getElementById('openTickets');
    const elClosed = document.getElementById('closedTickets');
    const elPending = document.getElementById('pendingTickets');
    const elOverdue = document.getElementById('overdueTickets');
    const elGaul = document.getElementById('gaulTickets');
    
    if (elTotal) elTotal.textContent = todayTickets.length;
    if (elOpen) elOpen.textContent = todayTickets.filter(t => t.status === 'open').length;
    if (elClosed) elClosed.textContent = todayTickets.filter(t => t.status === 'close').length;
    if (elPending) elPending.textContent = todayTickets.filter(t => t.status === 'pending').length;
    
    const todayOverdue = todayTickets.filter(t => {
        const status = t.status || 'open';
        if (status === 'close' || status === 'open') {
            const ttr = t.ttr || 0;
            return ttr > t.duration;
        }
        return false;
    });
    if (elOverdue) elOverdue.textContent = todayOverdue.length;
    
    const gaulCustomers = todayTickets.filter(t => {
        const customerName = t.customer;
        const history = tickets.filter(t2 => {
            if (t2.customer !== customerName) return false;
            if (t2.id === t.id) return false;
            return true;
        });
        return history.length > 0;
    }).map(t => t.customer);
    
    const uniqueGaul = [...new Set(gaulCustomers)];
    if (elGaul) elGaul.textContent = uniqueGaul.length;
}

       

async function setupRealtime() {
    const today = new Date().toDateString();
    const cachedData = localStorage.getItem('tickets_data');
    const lastFetch = localStorage.getItem('tickets_last_fetch');

    // CEK APAKAH ADA DATA BARU DI DATABASE
    try {
        const { data: latestData, error } = await sb
            .from('tickets')
            .select('createdAt')
            .order('createdAt', { ascending: false })
            .limit(1);

        if (error) throw error;

        const latestDate = latestData.length > 0 ? new Date(latestData[0].createdAt).toDateString() : null;
        const cachedDate = cachedData ? new Date(JSON.parse(cachedData)[0]?.createdAt).toDateString() : null;

        if (cachedData && lastFetch === today && cachedDate === latestDate) {
            tickets = JSON.parse(cachedData);
            // FILTER HAPUS PENDING
            tickets = tickets.filter(t => t.status !== 'pending');
            console.log('📦 Pakai cache tiket:', tickets.length);
            
            renderTickets(null, 1);
            updateStats();
            renderPerformance();
            renderDashboard();
            loadTechniciansCache();
            return;
        }

        console.log('🔥 Ambil tiket dari Supabase...');
        const { data, error: fetchError } = await sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(500);

        if (fetchError) throw fetchError;

        // FILTER HAPUS PENDING
        tickets = data.filter(t => t.status !== 'pending');
        localStorage.setItem('tickets_data', JSON.stringify(tickets));
        localStorage.setItem('tickets_last_fetch', today);

        console.log('✅ Tiket dimuat dari Supabase:', tickets.length);
        
        renderTickets(null, 1);
        updateStats();
        renderPerformance();
        renderDashboard();
        
    } catch (e) {
        console.error('❌ Gagal ambil tiket:', e);
        notif('Gagal ambil data tiket', 'danger');
    }

    loadTechniciansCache();
}

async function refreshData() {
    console.log('🔄 Refresh data dari Supabase...');
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(500);

        if (error) throw error;

        // FILTER HAPUS PENDING
        tickets = data.filter(t => t.status !== 'pending');
        const today = new Date().toDateString();
        localStorage.setItem('tickets_data', JSON.stringify(tickets));
        localStorage.setItem('tickets_last_fetch', today);

        console.log('✅ Data refreshed:', tickets.length);
        
        renderTickets(null, 1);
        updateStats();
        renderPerformance();
        renderDashboard();
        renderReports();
        
    } catch (e) {
        console.error('❌ Gagal refresh:', e);
        notif('Gagal refresh data', 'danger');
    }
}


function loadTechniciansCache() {
    const cached = localStorage.getItem('techs_data');
    const lastFetch = localStorage.getItem('techs_last_fetch');
    const today = new Date().toDateString();

    if (cached && lastFetch === today) {
        techs = JSON.parse(cached);
        renderTechList();
        renderTechDropdown();
        renderPerformance();
        return;
    }

    sb
        .from('technicians')
        .select('*')
        .order('name')
        .then(({ data, error }) => {
            if (error) throw error;

            techs = data; // <-- INI YANG NYIMPEN KE MEMORI
            localStorage.setItem('techs_data', JSON.stringify(techs));
            localStorage.setItem('techs_last_fetch', today);

            renderTechList();
            renderTechDropdown();
            renderPerformance();
        })
        .catch((error) => {
            console.error('Gagal load teknisi:', error);
            notif('Gagal load teknisi', 'danger');
        });
}


// ===== REFRESH TEKNISI (PAKAI INI SETELAH TAMBAH/EDIT/HAPUS) =====
function refreshTechnicians() {
    localStorage.removeItem('techs_data');
    localStorage.removeItem('techs_last_fetch');
    loadTechniciansCache();
    notif('Data teknisi diperbarui', 'success');
}

// TAMBAHKAN FUNGSI UNTUK MATIKAN LISTENER (jika perlu)
function detachListeners() {
    if (unsubscribeTickets) {
        unsubscribeTickets();
        unsubscribeTickets = null;
    }
    if (unsubscribeTechs) {
        unsubscribeTechs();
        unsubscribeTechs = null;
    }
}



// TUTUP SIDEBAR KALO KLIK DI LUAR (untuk mobile)
document.addEventListener('click', function(e) {
    var sidebar = document.getElementById('sidebar');
    var toggle = document.getElementById('toggleSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth <= 820) {
        if (sidebar && toggle && overlay) {
            if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('show');
                overlay.classList.remove('show');
            }
        }
    }
});

// ===== REKAP HARIAN =====
let rekapCurrentPage = 1;
const rekapItemsPerPage = 15;
let rekapData = [];

function renderRekap() {
    const dateInput = document.getElementById('rekapDate');
    const date = dateInput ? dateInput.value : '';
    const jenisFilter = document.getElementById('rekapJenisTiket') ? document.getElementById('rekapJenisTiket').value : 'all';

    if (!tickets || tickets.length === 0) {
        const body = document.getElementById('rekapBody');
        if (body) body.innerHTML = '<tr><td colspan="6"><div class="empty">Data tiket kosong</div></td></tr>';
        document.getElementById('rekapTotalTiket').textContent = '0';
        document.getElementById('rekapTotalTeknisi').textContent = '0';
        document.getElementById('rekapTotalClose').textContent = '0';
        document.getElementById('rekapTotalOpen').textContent = '0';
        return;
    }

    if (!date) {
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = today;
        return;
    }

    const filtered = tickets.filter(t => {
        if (!t.createdAt) return false;
        const tDate = new Date(t.createdAt);
        const tDateStr = tDate.toISOString().split('T')[0];
        if (tDateStr !== date) return false;
        
        // FILTER JENIS TIKET - HANYA GGN
        if (jenisFilter !== 'all') {
            const jenisTiket = t.jenistiket || '';
            // HANYA TAMPILKAN GGN
            if (jenisTiket !== 'GGN') return false;
        } else {
            // KALAU "Semua Jenis", TAMPILKAN GGN SAJA (GAMAS TIDAK MASUK)
            const jenisTiket = t.jenistiket || '';
            if (jenisTiket === 'GAMAS') return false;
        }
        
        return true;
    });

    // UPDATE SUMMARY
    document.getElementById('rekapTotalTiket').textContent = filtered.length;
    const uniqueTechs = new Set();
    filtered.forEach(t => {
        if (t.technicians && Array.isArray(t.technicians)) {
            t.technicians.forEach(tech => uniqueTechs.add(tech));
        }
    });
    document.getElementById('rekapTotalTeknisi').textContent = uniqueTechs.size;
    document.getElementById('rekapTotalClose').textContent = filtered.filter(t => t.status === 'close').length;
    document.getElementById('rekapTotalOpen').textContent = filtered.filter(t => t.status === 'open' || t.status === 'pending').length;

    const body = document.getElementById('rekapBody');
    
    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty">Tidak ada tiket GGN pada tanggal ' + date + '</div></td></tr>';
        document.getElementById('rekapPagination').innerHTML = '';
        return;
    }

    // GROUP BY TEKNISI
    const sortedTickets = [...filtered].sort((a, b) => {
        const techA = a.technicians && a.technicians.length > 0 ? a.technicians[0] : '';
        const techB = b.technicians && b.technicians.length > 0 ? b.technicians[0] : '';
        return techA.localeCompare(techB);
    });

    const groupMap = {};
    sortedTickets.forEach(t => {
        const techs = t.technicians || [];
        const sortedTechs = [...techs].sort();
        const key = sortedTechs.join('|');
        if (!groupMap[key]) {
            groupMap[key] = {
                technicians: sortedTechs,
                tickets: []
            };
        }
        groupMap[key].tickets.push(t);
    });

    const groups = Object.values(groupMap);
    
    let html = '';
    let no = 0;
    
    groups.forEach((group) => {
        const techNames = group.technicians;
        const tickets = group.tickets;
        no++;
        const rowspan = tickets.length;
        let isFirstRow = true;
        
        tickets.forEach((t, idx) => {
            const borderBottom = (idx === tickets.length - 1) ? 'border-bottom:3px solid #0b1a33;' : 'border-bottom:1px solid #e2e8f0;';
            const borderTop = (idx === 0) ? 'border-top:3px solid #0b1a33;' : '';
            
            html += '<tr style="' + borderTop + '">';
            
            // NO
            if (isFirstRow) {
                html += '<td style="padding:10px 12px;text-align:center;font-weight:700;vertical-align:middle;' + borderBottom + '" rowspan="' + rowspan + '">' + no + '</td>';
            }
            
            // JENIS TIKET - TETAP TAMPIL TAPI SEMUA GGN
            if (isFirstRow) {
                html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '" rowspan="' + rowspan + '">';
                html += '<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:#2563eb;color:white;">GGN</span>';
                html += '</td>';
            }
            
            // TEKNISI
            if (isFirstRow) {
                var techHtml = '';
                techNames.forEach(function(tech, techIdx) {
                    techHtml += tech;
                    if (techIdx < techNames.length - 1) techHtml += '<br>';
                });
                html += '<td style="padding:10px 14px;font-weight:700;color:#0b1a33;background:#f8fafc;vertical-align:middle;' + borderBottom + '" rowspan="' + rowspan + '">' + techHtml + '</td>';
            }
            
            // TIKET
            html += '<td style="padding:10px 12px;vertical-align:middle;' + borderBottom + '">';
            html += '<strong style="color:#2563eb;">' + (t.ticketid || t.ticketId || '-') + '</strong>';
            html += '</td>';
            
            // NAMA
            html += '<td style="padding:10px 12px;vertical-align:middle;' + borderBottom + '">' + (t.customer || '-') + '</td>';
            
            // JENIS GANGGUAN
            html += '<td style="padding:10px 12px;vertical-align:middle;' + borderBottom + '">' + (t.jenisgangguan || '-') + '</td>';
            
            html += '</tr>';
            isFirstRow = false;
        });
    });

    body.innerHTML = html;
    document.getElementById('rekapPagination').innerHTML = '';
}

function renderRekapTable(page) {
    const body = document.getElementById('rekapBody');
    const totalItems = rekapData.length;
    const totalPages = Math.ceil(totalItems / rekapItemsPerPage) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    rekapCurrentPage = page;

    const start = (page - 1) * rekapItemsPerPage;
    const end = Math.min(start + rekapItemsPerPage, totalItems);
    const pageData = rekapData.slice(start, end);

    if (totalItems === 0) {
        body.innerHTML = '<tr><td colspan="10"><div class="empty">Tidak ada tiket pada tanggal ini</div></td></tr>';
        document.getElementById('rekapPagination').innerHTML = '';
        return;
    }

    body.innerHTML = pageData.map((t, i) => {
        const statusClass = t.status === 'open' ? 'open' : t.status === 'pending' ? 'pending' : 'close';
        const statusLabel = t.status === 'open' ? '🔴 OPEN' : t.status === 'pending' ? '⏸ PENDING' : '✅ CLOSE';
        const techDisplay = (t.technicians || []).join(', ') || '-';
        const ttr = t.ttr || 0;
        return `<tr>
            <td>${start + i + 1}</td>
            <td>${formatDate(t.createdAt)}</td>
            <td><strong>${t.ticketid || t.ticketId || '-'}</strong></td>
            <td>${t.customer || '-'}</td>
            <td>${t.jenisgangguan || '-'}</td>
            <td>${techDisplay}</td>
            <td>${formatDur(t.duration)}</td>
            <td>${ttr > 0 ? formatDur(ttr) : '-'}</td>
            <td><span class="badge-status ${statusClass}">${statusLabel}</span></td>
            <td>${t.jenisPerbaikan || '-'}</td>
        </tr>`;
    }).join('');

    // Pagination
    let pagHtml = '';
    if (totalPages > 1) {
        pagHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToRekapPage(${page - 1})" ${page === 1 ? 'disabled style="opacity:0.5;"' : ''}>◀ Prev</button>`;
        for (let i = 1; i <= totalPages; i++) {
            const active = i === page ? 'btn-primary' : 'btn-outline';
            pagHtml += `<button class="btn ${active} btn-sm" onclick="goToRekapPage(${i})">${i}</button>`;
        }
        pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToRekapPage(${page + 1})" ${page === totalPages ? 'disabled style="opacity:0.5;"' : ''}>Next ▶</button>`;
        pagHtml += '</div>';
        pagHtml += `<span style="font-size:13px;color:#64748b;">Menampilkan ${start+1}-${end} dari ${totalItems}</span>`;
    }
    document.getElementById('rekapPagination').innerHTML = pagHtml;
}

function goToRekapPage(page) {
    renderRekapTable(page);
}

function resetRekap() {
    document.getElementById('rekapDate').value = '';
    document.getElementById('rekapTeknisi').value = 'all';
    document.getElementById('rekapBody').innerHTML = '<tr><td colspan="10"><div class="empty">Pilih tanggal dan klik Tampilkan</div></td></tr>';
    document.querySelectorAll('#rekapSummary .num').forEach(el => el.textContent = '0');
    document.getElementById('rekapPagination').innerHTML = '';
    rekapData = [];
}

function populateRekapTeknisi() {
    const select = document.getElementById('rekapTeknisi');
    if (!select) return;
    select.innerHTML = '<option value="all">Semua Teknisi</option>';
    techs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        select.appendChild(opt);
    });
}

function setRekapDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('rekapDate');
    if (dateInput) dateInput.value = today;
}
        


document.addEventListener('DOMContentLoaded', function() {
    const dashboardSection = document.getElementById('dashboardSection');
    const ticketSection = document.getElementById('ticketSection');
    const techSection = document.getElementById('technicianSection');
    const reportSection = document.getElementById('reportsSection');
    const rekapSection = document.getElementById('rekapSection');
    if (rekapSection) rekapSection.style.display = 'none';

    // DEFAULT: YANG TAMPIL HANYA DASHBOARD
    if (dashboardSection) dashboardSection.style.display = 'block';
    if (ticketSection) ticketSection.style.display = 'none';
    if (techSection) techSection.style.display = 'none';
    if (reportSection) reportSection.style.display = 'none';

    const btnTambah = document.getElementById('btnTambahTeknisi');
    if (btnTambah) {
        btnTambah.addEventListener('click', function(e) {
            setTimeout(function() {
                document.getElementById('techName').value = '';
                document.getElementById('techPhone').value = '';
            }, 100);
        });
    }

    // RESET FORM
    const ticketIdInput = document.getElementById('ticketId');
    const customerInput = document.getElementById('customer');
    const jenisInput = document.getElementById('jenisGangguan');
    const durationInput = document.getElementById('duration');
    
    if (ticketIdInput) ticketIdInput.value = '';
    if (customerInput) customerInput.value = '';
    if (jenisInput) jenisInput.value = '';
    if (durationInput) durationInput.value = '';
    
    selectedTechs = [];
    renderTechDropdown();

    const filterDate = document.getElementById('filterDate');
    const filterDateTo = document.getElementById('filterDateTo');
    if (filterDate) filterDate.value = '';
    if (filterDateTo) filterDateTo.value = '';

    setTimeout(function() {
        loadTechniciansCache();
        setupRealtime();
    }, 300);
});







// PASTIKAN LAPORAN TAMPIL KETIKA DI KLIK
// TAMBAHKAN INI JUGA:
const reportNav = document.querySelector('.sidebar .nav-item[data-tab="reports"]');
if (reportNav) {
    reportNav.addEventListener('click', function() {
        setTimeout(function() {
            var reportSection = document.getElementById('reportsSection');
            if (reportSection) {
                reportSection.style.display = 'block';
                if (typeof renderReports === 'function') {
                    renderReports();
                }
            }
        }, 100);
    });
}

// EVENT UNTUK MENU LAPORAN
const reportNav2 = document.querySelector('.sidebar .nav-item[data-tab="reports"]');
if (reportNav2) {
    reportNav2.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('LAPORAN DI KLIK!');
        switchTab('reports');
    });
}


setTimeout(function() {
    loadTechniciansCache();
    renderTechDropdown();
    setupRealtime();
    
}, 500);
