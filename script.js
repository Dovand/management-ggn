
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
    
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
        el.classList.remove('active');
    });
    
    const targetNav = document.querySelector(`.sidebar .nav-item[data-tab="${tab}"]`);
    if (targetNav) targetNav.classList.add('active');
    
    const dashboardSection = document.getElementById('dashboardSection');
    const ticketSection = document.getElementById('ticketSection');
    const technicianSection = document.getElementById('technicianSection');
    const reportsSection = document.getElementById('reportsSection');
    const pageTitle = document.querySelector('.top-bar h1');
    
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (ticketSection) ticketSection.style.display = 'none';
    if (technicianSection) technicianSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'none';
    
        if (tab === 'dashboard') {
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📊 Dashboard';
            renderDashboard();
        }
    
    } else if (tab === 'tickets') {
        if (ticketSection) {
            ticketSection.style.display = 'block';
            renderTickets(null, 1);
            if (pageTitle) pageTitle.innerHTML = '📋 Tiket';
        }
    } else if (tab === 'technicians') {
        if (technicianSection) {
            technicianSection.style.display = 'block';
            renderTechList();
            renderPerformance();
            if (pageTitle) pageTitle.innerHTML = '👨‍🔧 Teknisi';
        }
    } else if (tab === 'reports') {
        if (reportsSection) {
            reportsSection.style.display = 'block';
            renderReports();
            if (pageTitle) pageTitle.innerHTML = '📊 Laporan';
        }
    }
}

// ===== LOGIN =====
function handleLogin() {
    var user = document.getElementById('loginUsername').value;
    var pass = document.getElementById('loginPassword').value;
    var err = document.getElementById('loginError');
    
    if (user === 'admin' && pass === 'admin123') {
        err.style.display = 'none';
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        localStorage.setItem('user_session', 'logged');
        location.reload();
    } else {
        err.style.display = 'block';
        err.textContent = '⚠️ Username atau password salah!';
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

function renderDashboard() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Date
    document.getElementById('currentDate').textContent = today.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
    
    // Filter tiket hari ini
    const todayTickets = tickets.filter(t => {
        const d = new Date(t.createdAt);
        return d.toISOString().split('T')[0] === todayStr;
    });
    
    // Stats
    document.getElementById('dashTotalTickets').textContent = todayTickets.length;
    document.getElementById('dashOpenTickets').textContent = todayTickets.filter(t => t.status === 'open').length;
    document.getElementById('dashClosedTickets').textContent = todayTickets.filter(t => t.status === 'close').length;
    document.getElementById('dashPendingTickets').textContent = todayTickets.filter(t => t.status === 'pending').length;
    
    const overdue = todayTickets.filter(t => {
        if (t.status === 'close' || t.status === 'open') {
            return (t.ttr || 0) > t.duration;
        }
        return false;
    });
    document.getElementById('dashOverdueTickets').textContent = overdue.length;
    
    const gaulCustomers = todayTickets.filter(t => {
        const customerName = t.customer;
        const history = tickets.filter(t2 => {
            if (t2.customer !== customerName) return false;
            if (t2.id === t.id) return false;
            return true;
        });
        return history.length > 0;
    }).map(t => t.customer);
    document.getElementById('dashGaulTickets').textContent = [...new Set(gaulCustomers)].length;
    
    // Chart Jenis Gangguan
    const gMap = {};
    todayTickets.forEach(t => {
        const jenis = t.jenisgangguan || 'Tidak diketahui';
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
    
        // Chart Produktivitas Teknisi - TAMPILKAN SEMUA TEKNISI
    const techMap = {};
    techs.forEach(t => { techMap[t.name] = { total: 0, tepatWaktu: 0 }; });
    
    todayTickets.forEach(t => {
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
    
    // TAMPILKAN SEMUA TEKNISI (TIDAK DI-FILTER & TIDAK DI-SLICE)
    const sortedTech = Object.entries(techMap)
        .sort((a, b) => b[1].total - a[1].total);
    
    if (window.dashProdChartInstance) {
        window.dashProdChartInstance.destroy();
    }
    const ctx2 = document.getElementById('dashProdChart').getContext('2d');
    window.dashProdChartInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: sortedTech.length > 0 ? sortedTech.map(t => t[0]) : ['Belum Ada Data'],
            datasets: [{
                label: 'Produktivitas (%)',
                data: sortedTech.length > 0 ? sortedTech.map(([name, data]) => 
                    data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0
                ) : [0],
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
                borderRadius: 8
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
                    max: 100,
                    ticks: { callback: function(value) { return value + '%'; } }
                }
            }
        }
    });
    
    // Tiket terbaru (5 data terakhir)
    const latestTickets = [...todayTickets].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 5);
    
    const body = document.getElementById('dashTicketBody');
    document.getElementById('dashTicketCount').textContent = todayTickets.length + ' tiket';
    
    if (latestTickets.length === 0) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty">Belum ada tiket hari ini</div></td></tr>';
        return;
    }
    
    body.innerHTML = latestTickets.map(t => `
        <tr>
            <td>${formatDate(t.createdAt)}</td>
            <td><strong>${t.ticketid}</strong></td>
            <td>${t.customer}</td>
            <td>${t.jenisgangguan || '-'}</td>
            <td><span class="badge-status ${t.status}">${t.status === 'open' ? '🔴 OPEN' : t.status === 'pending' ? '⏸ PENDING' : '✅ CLOSE'}</span></td>
            <td>${(t.technicians || []).join(', ') || '-'}</td>
        </tr>
    `).join('');
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
    sortedGangguan2.forEach(([jenis, data], index) => {
        const persen = totalGangguan2 > 0 ? ((data.count / totalGangguan2) * 100).toFixed(1) : '0';
        const textColor = data.count === 0 ? '#94a3b8' : '#0b1a33';
        const bgColor = data.count === 0 ? '#f8fafc' : 'transparent';
        const topPerbaikan = Object.entries(data.perbaikan).sort((a, b) => b[1] - a[1])[0];
        const perbaikanText = topPerbaikan ? `${topPerbaikan[0]} (${topPerbaikan[1]}x)` : '-';
        gangguanHtml2 += `<tr style="background:${bgColor};">
            <td>${index + 1}</td>
            <td><strong style="color:${textColor};">${jenis}</strong></td>
            <td style="color:${textColor};">${data.count}</td>
            <td style="color:${textColor};">${data.count === 0 ? '0%' : persen + '%'}</td>
            <td style="color:${textColor};">${perbaikanText}</td>
        </tr>`;
    });
    document.getElementById('jenisgangguanReportBody').innerHTML = gangguanHtml2;

    // ===== 8. PELANGGAN PALING SERING LAPOR =====
    const customerMap = {};
    filteredTickets.forEach(t => {
        const cust = t.customer || 'Tidak diketahui';
        if(!customerMap[cust]) {
            customerMap[cust] = { total: 0, gangguan: {}, perbaikan: {} };
        }
        customerMap[cust].total++;
        const jenis = t.jenisgangguan || 'Tidak diketahui';
        customerMap[cust].gangguan[jenis] = (customerMap[cust].gangguan[jenis] || 0) + 1;
        const perbaikan = t.jenisPerbaikan || '-';
        customerMap[cust].perbaikan[perbaikan] = (customerMap[cust].perbaikan[perbaikan] || 0) + 1;
    });
    
    const sortedCustomers = Object.entries(customerMap)
        .sort((a,b) => b[1].total - a[1].total)
        .slice(0, 10);
    
    let customerHtml = '';
    if(sortedCustomers.length === 0) {
        customerHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
    } else {
        sortedCustomers.forEach(([cust, data], index) => {
            const topGangguan = Object.entries(data.gangguan).sort((a,b) => b[1] - a[1])[0];
            const gangguanText = topGangguan ? `${topGangguan[0]} (${topGangguan[1]}x)` : '-';
            const topPerbaikan = Object.entries(data.perbaikan).sort((a,b) => b[1] - a[1])[0];
            const perbaikanText = topPerbaikan ? `${topPerbaikan[0]} (${topPerbaikan[1]}x)` : '-';
            customerHtml += `<tr>
                <td>${index + 1}</td>
                <td><strong>${cust}</strong></td>
                <td>${data.total}</td>
                <td>${gangguanText}</td>
                <td>${perbaikanText}</td>
            </tr>`;
        });
    }
    document.getElementById('customerReportBody').innerHTML = customerHtml;

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
        const jenis = t.jenisgangguan || 'Tidak diketahui';
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
    const techMap = {};
    techs.forEach(t => {
        techMap[t.name] = { total: 0, tepatWaktu: 0 };
    });
    
    ticketsData.forEach(t => {
        const techsList = t.technicians || [];
        techsList.forEach(tech => {
            if (techMap[tech]) {
                techMap[tech].total++;
                if (t.status === 'close') {
                    const ttr = t.ttr || 0;
                    if (ttr <= t.duration) {
                        techMap[tech].tepatWaktu++;
                    }
                }
            }
        });
    });
    
    // TAMPILKAN SEMUA TEKNISI (TANPA FILTER .filter() DAN TANPA .slice())
    const sortedTech = Object.entries(techMap)
        .sort((a, b) => b[1].total - a[1].total);
    
    const techLabels = sortedTech.map(t => t[0]);
    const techData = sortedTech.map(([name, data]) => {
        return data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0;
    });

    const ctx2 = document.getElementById('produktivitasChart').getContext('2d');
    window.produktivitasChartInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: techLabels.length > 0 ? techLabels : ['Belum Ada Data'],
            datasets: [{
                label: 'Produktivitas (%)',
                data: techData.length > 0 ? techData : [0],
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y', // <-- INI MEMBUAT CHART MENDATAR
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) { return value + '%'; }
                    }
                },
                y: {
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });

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
    
    console.log('Filter dipanggil:', dateFrom, dateTo, bulan);
    
    let filtered = tickets.slice(); // COPY SEMUA DATA
    
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
    
    // FILTER BULAN (TERMASUK 3 BULAN)
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
    
    console.log('Jumlah data setelah filter:', filtered.length);
    
    // PANGGIL RENDER
    renderFilteredData(filtered);
    renderReports();
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
    const cMap = {};
    filteredTickets.forEach(t => {
        const cust = t.customer || 'Tidak diketahui';
        if (!cMap[cust]) cMap[cust] = { total: 0, gangguan: {} };
        cMap[cust].total++;
        const jenis = t.jenisgangguan || 'Tidak diketahui';
        cMap[cust].gangguan[jenis] = (cMap[cust].gangguan[jenis] || 0) + 1;
    });
    const sortedC = Object.entries(cMap).sort((a,b) => b[1].total - a[1].total).slice(0,10);
    let htmlC = '';
    sortedC.forEach(([cust, data], i) => {
        const topG = Object.entries(data.gangguan).sort((a,b) => b[1] - a[1])[0];
        const gText = topG ? `${topG[0]} (${topG[1]}x)` : '-';
        htmlC += `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${i+1}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;"><strong>${cust}</strong></td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${data.total}</td>
            <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${gText}</td>
        </tr>`;
    });
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
    document.getElementById('filterLaporanBulan').value = '';
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
    select.innerHTML = '<option value="">-- Pilih --</option>';
    techs.forEach(t => {
        if(!selectedTechs.includes(t.name)) {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name;
            select.appendChild(opt);
        }
    });
    renderSelectedTechs();
    
    // TAMBAHKAN: event listener onchange
    select.onchange = function() {
        const value = this.value;
        if(!value) return;
        if(selectedTechs.includes(value)) {
            notif('Teknisi sudah dipilih!','warning');
            this.value = '';
            return;
        }
        selectedTechs.push(value);
        this.value = '';
        renderTechDropdown();
    };
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
    const body = document.getElementById('techTableBody');
    if(techs.length===0) {
        body.innerHTML = `<tr><td colspan="4"><div class="empty"><span class="icon">👨‍🔧</span><p>Belum ada teknisi</p></div></td></tr>`;
        return;
    }
    body.innerHTML = techs.map((t,i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${t.name}</strong></td>
            <td>${t.phone || '-'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editTech('${t.id}','${t.name}','${t.phone || '-'}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteTech('${t.id}')">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </td>
        </tr>
    `).join('');
}

function editTech(id, currentName, currentPhone) {
    Swal.fire({
        title: '✏️ Edit Teknisi',
        width: 420,
        padding: '1.5rem',
        background: '#ffffff',
        backdrop: 'rgba(0,0,0,0.5)',
        html: `
            <div style="text-align:left; margin-top:8px;">
                <div style="margin-bottom:16px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px;">
                        <i class="fas fa-user" style="color:#2563eb; margin-right:6px;"></i> Nama Teknisi
                    </label>
                    <input id="swalEditName" type="text" value="${currentName}" 
                        style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; transition:0.2s; outline:none;"
                        onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#e2e8f0'">
                </div>
                <div style="margin-bottom:4px;">
                    <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px;">
                        <i class="fas fa-phone" style="color:#2563eb; margin-right:6px;"></i> No HP
                    </label>
                    <input id="swalEditPhone" type="text" value="${currentPhone || ''}" 
                        style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; transition:0.2s; outline:none;"
                        onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#e2e8f0'">
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
        preConfirm: () => {
            const name = document.getElementById('swalEditName').value.trim();
            const phone = document.getElementById('swalEditPhone').value.trim();
            if(!name) {
                Swal.showValidationMessage('⚠️ Nama teknisi wajib diisi!');
                return false;
            }
            return { name, phone };
        }
    }).then(async (result) => {
        if(result.isConfirmed) {
            const { name, phone } = result.value;
            try {
                const { error } = await sb
    .from('technicians')
    .update({
        name: name,
        phone: phone || '-'
    })
    .eq('id', id);

if (error) throw error;
refreshData();
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: 'Teknisi ' + name + ' berhasil diupdate',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#ffffff',
                    backdrop: 'rgba(0,0,0,0.3)'
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
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    
    if(!name) { 
        Swal.fire('Peringatan', 'Masukkan nama teknisi!', 'warning');
        return; 
    }
    
    try {
        // INSERT KE SUPABASE
        const { error } = await sb
            .from('technicians')
            .insert({ name: name, phone: phone || '-' });
        
        if (error) throw error;
        
        // KOSONGKAN INPUT
        nameInput.value = '';
        phoneInput.value = '';
        
        // AMBIL ULANG DATA DARI SUPABASE
        const { data } = await sb
            .from('technicians')
            .select('*')
            .order('name');
        
        techs = data;  // <-- UPDATE techs DENGAN DATA TERBARU
        
        // RENDER ULANG
        renderTechList();
        renderTechDropdown();
        renderPerformance();
        
        Swal.fire('Berhasil', 'Teknisi '+name+' ditambahkan!', 'success');
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
            
            // HAPUS CACHE
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
            
            // REFRESH DATA
            await loadTechniciansCache();
            renderTechList();
            renderTechDropdown();
            renderPerformance();
            
            notif('✅ Teknisi ' + tech.name + ' dihapus', 'success');
            refreshData();
            
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

    if(!id || !cust || !dur || selectedTechs.length === 0) {
        notif('Isi semua field dan pilih minimal 1 teknisi!','warning');
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
        ticketid: id,               // <-- KECIL SEMUA
        customer: cust,
        duration: dur,
        jenisgangguan: desc,        // <-- KECIL SEMUA
        technicians: selectedTechs,
        status: 'open',
        createdAt: createdAt,       // <-- A BESAR
        ttr: 0,
        pendingnote: null,          // <-- KECIL SEMUA
        closeticket: null,          // <-- KECIL SEMUA
        closedAt: null,             // <-- A BESAR
        keterangan: null,
        jenisperbaikan: null        // <-- KECIL SEMUA
    });

        if (error) throw error;

        // PERBAIKAN: PAKAI ticketId BUKAN ticketid
        document.getElementById('ticketId').value = '';  // <-- INI YANG SALAH SEBELUMNYA
        document.getElementById('customer').value = '';
        document.getElementById('jenisGangguan').value = '';
        document.getElementById('duration').value = '60';
        document.getElementById('createdAtManual').value = '';
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
    
    const { value: jenisPerbaikan } = await Swal.fire({
        title: '📝 Jenis Perbaikan',
        text: 'Masukkan jenis perbaikan (opsional):',
        input: 'textarea',
        inputPlaceholder: 'Tulis jenis perbaikan...',
        inputAttributes: { style: 'text-transform:uppercase;' },
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Lewati',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        inputValidator: (value) => null
    });
    
    const finalJenisPerbaikan = jenisPerbaikan ? jenisPerbaikan.toUpperCase() : '-';
    
    try {
        const { error } = await sb
            .from('tickets')
            .update({
                status: 'close',
                ttr: ttr,
                closedAt: now.toISOString(),
                keterangan: keterangan,
                jenisperbaikan: finalJenisPerbaikan  // <-- PAKAI YANG P BESAR
            })
            .eq('id', docId);

        if (error) throw error;
        
        notif('Tiket '+ticket.ticketId+' ditutup!', 'success');
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


        function renderTickets(data = null, page = 1) {
    const body = document.getElementById('ticketBody');
    const count = document.getElementById('ticketCount');
    
    // KALAU data = null, pakai semua tickets
    if (data === null) {
        data = tickets;  // <-- TAMPILKAN SEMUA, BUKAN HANYA HARI INI
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
        body.innerHTML = '<tr><td colspan="14"><div class="empty"><span class="icon">📭</span>Belum ada tiket</div></td></tr>';
        stopTimer(); 
        renderPagination(totalItems, page);
        return;
    }

    body.innerHTML = pageData.map(t => {
        let ttrDisplay;
        if(t.status==='open') {
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
        } else if(t.status==='close') {
            const diff = t.ttr - t.duration;
            if(diff > 0) {
                ttrDisplay = `<span style="color:#dc2626;font-weight:700;">+${formatDur(diff)}</span>`;
            } else if(diff < 0) {
                ttrDisplay = `<span style="color:#166534;font-weight:600;">-${formatDur(Math.abs(diff))}</span>`;
            } else {
                ttrDisplay = `<span style="color:#059669;font-weight:600;">00:00:00</span>`;
            }
        } else if(t.status==='pending') {
            ttrDisplay = `<span style="color:#6b7280;">⏸ pending</span>`;
        } else {
            ttrDisplay = formatDur(t.ttr);
        }

        const statusClass = t.status==='open'?'open': t.status==='pending'?'pending':'close';
        const statusLabel = t.status==='open'?'🔴 OPEN': t.status==='pending'?'⏸ PENDING':'✅ CLOSE';

        const techDisplay = t.technicians && Array.isArray(t.technicians) ?
            t.technicians.map(n => `<span class="tech-badge">${n}</span>`).join(' ') : '-';

        let closeEstDisplay = '-';
        const createdAt = new Date(t.createdAt);
        const estTime = new Date(createdAt.getTime() + t.duration * 60000);
        closeEstDisplay = formatTime(estTime);
        
        let closeticketDisplay = '-';
        if (t.status === 'close' && t.closedAt) {
            closeticketDisplay = formatTime(t.closedAt);
        }

        const isOverdue = (t.status === 'open' || t.status === 'close') ? 
            (t.ttr || 0) > t.duration : false;

        const rowClass = isOverdue ? 'overdue' : '';

        return `
        <tr data-ticket-id="${t.id}" class="${rowClass}">
            <td>${formatDate(t.createdAt)}</td>
            <td><strong>${t.ticketid}</strong></td>
            <td>${t.customer}</td>
            <td>${t.jenisgangguan || '-'}</td>
            <td>${formatDur(t.duration)}</td>
            <td>${formatTime(t.createdAt)}</td>
            <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                    ${techDisplay}
                    ${t.status !== 'close' ? `
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
            <td>${t.jenisPerbaikan || '-'}</td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">
                ${t.status==='open' ? `<button class="btn btn-success btn-sm" onclick="closeticket('${t.id}')">Close</button>` : ''}
                ${t.status==='open' ? `<button class="btn btn-warning btn-sm" onclick="pendingTicket('${t.id}')">⏸ Pending</button>` : ''}
                ${t.status==='pending' ? `<button class="btn btn-primary btn-sm" onclick="pendingTicket('${t.id}')">▶ Resume</button>` : ''}
                ${t.status==='close' ? `<button class="btn btn-outline btn-sm" onclick="editcloseticket('${t.id}')" title="Edit Waktu Close"><i class="fas fa-clock"></i></button>` : ''}
            </td>
        </tr>
        `;
    }).join('');
    
    renderPagination(totalItems, page);
    
    const hasOpen = data.some(t => t.status==='open');
    if(hasOpen) startTimer(); else stopTimer();
}

async function editKeterangan(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if(!ticket) return;
    
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
                    <input id="editjenisPerbaikan" type="text" value="${ticket.jenisPerbaikan || ''}" style="width:100%;padding:8px;border:1px solid #d1d9e6;border-radius:8px;">
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
        jenisPerbaikan: formValues.jenisPerbaikan || '-'
    })
    .eq('id', docId);

if (error) throw error;
        notif('Keterangan berhasil diupdate!', 'success');
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
    
    // Cari atau buat container pagination
    let paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) {
        // Buat container jika belum ada
        const card = document.querySelector('.card:last-child .table-wrap');
        const wrapper = document.createElement('div');
        wrapper.id = 'paginationContainer';
        wrapper.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px 0;flex-wrap:wrap;gap:10px;';
        card.parentNode.insertBefore(wrapper, card.nextSibling);
        paginationContainer = wrapper;
    }
    
    if (totalItems <= itemsPerPage) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    // Tombol Previous
    html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>◀ Prev</button>`;
    
    // Nomor halaman
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding:0 4px;">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding:0 4px;">...</span>`;
        html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button class="btn btn-outline btn-sm" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Next ▶</button>`;
    html += '</div>';
    
    // Info jumlah
    html += `<span style="font-size:13px;color:#64748b;">Menampilkan ${(currentPage-1)*itemsPerPage+1}-${Math.min(currentPage*itemsPerPage, totalItems)} dari ${totalItems}</span>`;
    
    paginationContainer.innerHTML = html;
}

function goToPage(page) {
    const data = window._currentDisplayData || [];
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    if (page < 1 || page > totalPages) return;
    renderTickets(data, page);
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
        if (t.status === 'close' || t.status === 'open') {
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

    // JIKA ADA CACHE DAN MASIH HARI INI, PAKAI CACHE
    if (cachedData && lastFetch === today) {
        tickets = JSON.parse(cachedData);
        console.log('📦 Pakai cache tiket:', tickets.length);
        
        renderTickets(null, 1);
        updateStats();
        renderPerformance();
        renderDashboard();
        
        // TETAP AMBIL TEKNISI DARI CACHE
        loadTechniciansCache();
        return; // <-- LANGSUNG KELUAR, TIDAK QUERY
    }

    console.log('🔥 Ambil tiket dari Supabase...');
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(500);

        if (error) throw error;

        tickets = data;
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

    // TEKNISI (JUGA PAKAI CACHE)
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

        tickets = data;
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

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}

// TUTUP SIDEBAR KALO KLIK DI LUAR (untuk mobile)
document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('toggleSidebar');
    if (window.innerWidth <= 820) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    }
});
        


document.addEventListener('DOMContentLoaded', function() {
    const dashboardSection = document.getElementById('dashboardSection');
    const ticketSection = document.getElementById('ticketSection');
    const techSection = document.getElementById('technicianSection');
    const reportSection = document.getElementById('reportsSection');

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
