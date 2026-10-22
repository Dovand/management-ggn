
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
        let currentPemakaianBarang = []; // untuk modal close tiket
        
        

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

            // ============================================================
// FORMAT ODP TERIMBAS — TAMBAH PREFIX ODP- OTOMATIS
// ============================================================
function formatOdpTerimbas(text) {
    if (!text || text === '-') return '-';
    
    const lines = text.split('\n');
    
    const formatted = lines.map(line => {
        let trimmed = line.trim();
        if (!trimmed) return '';
        
        // BUANG BULLET/ANGKA DI AWAL
        trimmed = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
        
        // KALAU SUDAH ADA PREFIX "ODP-", BIARKAN
        if (trimmed.toUpperCase().startsWith('ODP-')) {
            return trimmed;
        }
        
        // TAMBAH PREFIX ODP-
        return 'ODP-' + trimmed;
    }).filter(x => x);
    
    return formatted.join('\n');
}

// ============================================================
// CEK APAKAH ODP PELANGGAN SEDANG TERIMBAS GAMAS
// ============================================================
async function cekOdpTerimbas(odpPelanggan, kodePelanggan) {
    if (!odpPelanggan && !kodePelanggan) return null;
    
    // KUMPULKAN SEMUA KANDIDAT ODP PELANGGAN
    const kandidat = [];
    
    // 1. DARI ODP PELANGGAN
    if (odpPelanggan && odpPelanggan !== '-') {
        kandidat.push(odpPelanggan.trim());
    }
    
    // 2. DARI KODE PELANGGAN (SETELAH /RTL/)
    if (kodePelanggan && kodePelanggan !== '-') {
        const parts = kodePelanggan.split('/RTL/');
        if (parts.length > 1 && parts[1]) {
            kandidat.push(parts[1].trim());
        }
        kandidat.push(kodePelanggan.trim());
    }
    
    if (kandidat.length === 0) return null;
    
    try {
        // AMBIL SEMUA TIKET GAMAS YANG OPEN
        const { data: gamasOpen, error } = await sb
            .from('tickets')
            .select('ticketid, jenisgangguan, odppelanggan, odp_terimbas, createdAt, status, technicians')
            .eq('jenistiket', 'GAMAS')
            .eq('status', 'open');
        
        if (error || !gamasOpen || gamasOpen.length === 0) return null;
        
        // CEK SATU-SATU TIKET GAMAS
        for (const g of gamasOpen) {
            const odpsTerimbas = (g.odp_terimbas || '')
                .split('\n')
                .map(x => x.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
                .filter(x => x);
            
            if (odpsTerimbas.length === 0) continue;
            
            // CEK PARTIAL MATCH
            for (const odpGamas of odpsTerimbas) {
                for (const kand of kandidat) {
                    const a = odpGamas.toUpperCase().replace(/^ODP-/, '');
                    const b = kand.toUpperCase().replace(/^ODP-/, '');
                    
                    if (a === b || a.includes(b) || b.includes(a)) {
                        return g; // KETEMU
                    }
                }
            }
        }
        
        return null;
        
    } catch (e) {
        console.error('Cek ODP terimbas error:', e);
        return null;
    }
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
    
    // AMBIL SEMUA SECTION (TERMASUK YANG BARU)
    var dashboardSection = document.getElementById('dashboardSection');
    var ticketSection = document.getElementById('ticketSection');
    var technicianSection = document.getElementById('technicianSection');
    var reportsSection = document.getElementById('reportsSection');
    var rekapSection = document.getElementById('rekapSection');
    var psbSection = document.getElementById('psbSection');
    var pelangganSection = document.getElementById('pelangganSection');
    var allrekapSection = document.getElementById('allrekapSection');
    var onuOltSection = document.getElementById('onuOltSection');
    var backupSection = document.getElementById('backupSection');
    var settingsSection = document.getElementById('settingsSection');
    var inventorySection = document.getElementById('inventorySection');
    var scheduleSection = document.getElementById('scheduleSection');
    var activityLogSection = document.getElementById('activityLogSection');
    
    var pageTitle = document.querySelector('.top-bar h1');
    
    // SEMBUNYIKAN SEMUA SECTION DULU
    var allSections = [
        'dashboardSection', 'ticketSection', 'psbSection', 'technicianSection',
        'reportsSection', 'rekapSection', 'allrekapSection', 'pelangganSection',
        'onuOltSection', 'backupSection', 'settingsSection', 'inventorySection',
        'scheduleSection', 'activityLogSection'
    ];
    allSections.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // TAMPILKAN SECTION SESUAI TAB
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
            window.scrollTo(0, 0);
        }
    } else if (tab === 'allrekap') {
        if (allrekapSection) {
            allrekapSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📊 Semua Rekapan';
            if (typeof renderAllRekap === 'function') renderAllRekap();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'psb') {
        if (psbSection) {
            psbSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '🔌 Pasang Baru (PSB)';
            renderPsb();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'pelanggan') {
        if (pelangganSection) {
            pelangganSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '👥 Pelanggan';
            updateSortIcons();
            renderPelanggan();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'onuolt') {
        if (onuOltSection) {
            onuOltSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '🖥️ Data ONU OLT';
            if (typeof renderOnuOlt === 'function') renderOnuOlt();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'backup') {
        if (backupSection) {
            backupSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '💾 Backup Data';
            if (typeof loadBackupStats === 'function') loadBackupStats();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'settings') {
        if (settingsSection) {
            settingsSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '⚙️ Pengaturan';
            if (typeof loadSettings === 'function') loadSettings();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'inventory') {
        if (inventorySection) {
            inventorySection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📦 Inventaris';
            if (typeof renderInventoryItems === 'function') renderInventoryItems();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'schedule') {
        if (scheduleSection) {
            scheduleSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📅 Jadwal Teknisi';
            if (typeof renderSchedule === 'function') renderSchedule();
            window.scrollTo(0, 0);
        }
    } else if (tab === 'activitylog') {
        if (activityLogSection) {
            activityLogSection.style.display = 'block';
            if (pageTitle) pageTitle.innerHTML = '📋 Log Aktivitas';
            if (typeof renderActivityLog === 'function') renderActivityLog();
            window.scrollTo(0, 0);
        }
    }
}

    // ============================================================
// HELPER GAUL
// ============================================================
function isGangguanJaringan(t) {
    const jenisTiket = (t.jenistiket || '').toUpperCase().trim();
    if (jenisTiket !== 'GGN' && jenisTiket !== 'GAMAS') return false;
    const jenisGangguan = (t.jenisgangguan || '').trim();
    const GANGGUAN_GAUL = [
        'Kabel Putus (LOS)',
        'Internet lambat',
        'Redaman Tinggi',
        'Tidak Ada Koneksi Internet',
        'GAMAS FEEDER',
        'GAMAS DISTRIBUSI',
        'GAMAS ODP'
    ];
    return GANGGUAN_GAUL.includes(jenisGangguan);
}

// ✅ HELPER: AMBIL KEY GAUL DARI TIKET
// GGN   → pakai kodePelanggan
// GAMAS → pakai setiap ODP di odp_terimbas
function getGaulKeys(t) {
    const jenisTiket = (t.jenistiket || '').toUpperCase().trim();
    const keys = [];

    if (jenisTiket === 'GGN') {
        const kode = t.kodePelanggan;
        if (kode && kode !== '-') keys.push('PLG:' + kode);
    } else if (jenisTiket === 'GAMAS') {
        const odps = (t.odp_terimbas || '')
            .split('\n')
            .map(x => x.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
            .filter(x => x && x !== '-');
        odps.forEach(odp => {
            keys.push('ODP:' + odp.toUpperCase().replace(/^ODP-/, ''));
        });
    }

    return keys;
}

function getPelangganGaul(rentangBulan = 2, filteredTickets = null) {
    const source = filteredTickets || tickets;
    const batas = new Date();
    batas.setMonth(batas.getMonth() - rentangBulan);
    
    const map = {};
    source.forEach(t => {
        if (!t.createdAt) return;
        const tgl = new Date(t.createdAt);
        if (tgl < batas) return;
        if (!isGangguanJaringan(t)) return;
        const keys = getGaulKeys(t);
        keys.forEach(k => {
            if (!map[k]) map[k] = [];
            map[k].push(t);
        });
    });
    
    const result = new Set();
    Object.keys(map).forEach(k => {
        if (map[k].length >= 2) result.add(k);
    });
    return result;
}

// RETURN: Map { teknisiName: totalGaul }
function getTeknisiGaulMap(rentangBulan = 2, filteredTickets = null) {
    const source = filteredTickets || tickets;
    const batas = new Date();
    batas.setMonth(batas.getMonth() - rentangBulan);
    
    const map = {};
    source.forEach(t => {
        if (!t.createdAt) return;
        const tgl = new Date(t.createdAt);
        if (tgl < batas) return;
        if (!isGangguanJaringan(t)) return;
        const kode = t.kodePelanggan;
        if (!kode || kode === '-') return;
        if (!map[kode]) map[kode] = [];
        map[kode].push(t);
    });
    
    const teknisiMap = {};
    
    Object.keys(map).forEach(kode => {
    const list = map[kode].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (list.length < 2) return;
    
    // PENYEBAB GAUL = TEKNISI TIKET KE-i (i = 0 s/d length-2)
    for (let i = 0; i < list.length - 1; i++) {
        // SKIP kalau tiket ini ada IMBAS GAMAS — bukan salah teknisi GGN
        if (list[i].imbas_gamas) continue;
        
        const techs = list[i].technicians || [];
        techs.forEach(name => {
            if (!teknisiMap[name]) teknisiMap[name] = 0;
            teknisiMap[name] += 1;
        });
    }
});
    
    return teknisiMap;
}


// RETURN: Map { timKey: { anggota: [...], total: number } }
function getTimGaulMap(rentangBulan = 2, filteredTickets = null) {
    const source = filteredTickets || tickets;
    const batas = new Date();
    batas.setMonth(batas.getMonth() - rentangBulan);
    
    const map = {};
    source.forEach(t => {
        if (!t.createdAt) return;
        if (new Date(t.createdAt) < batas) return;
        if (!isGangguanJaringan(t)) return;
        const kode = t.kodePelanggan;
        if (!kode || kode === '-') return;
        if (!map[kode]) map[kode] = [];
        map[kode].push(t);
    });
    
    const timMap = {};
    
    Object.keys(map).forEach(kode => {
    const list = map[kode].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (list.length < 2) return;
    
    // PENYEBAB GAUL = TIM TIKET KE-i (i = 0 s/d length-2)
    for (let i = 0; i < list.length - 1; i++) {
        // SKIP kalau tiket ini ada IMBAS GAMAS
        if (list[i].imbas_gamas) continue;
        
        const techs = (list[i].technicians || []).slice().sort();
        if (techs.length === 0) continue;
        
        const timKey = techs.join('|');
        if (!timMap[timKey]) {
            timMap[timKey] = { anggota: techs, total: 0 };
        }
        timMap[timKey].total += 1;
    }
});
    
    return timMap;
}


// ============================================================
// TEKNISI & TIM TERBAIK (PSB/GGN)
// ============================================================

// Cek apakah teknisi/tim berasal dari divisi PSB/GGN
function isPsbGgn(techNames) {
    if (!techNames || techNames.length === 0) return false;
    for (let i = 0; i < techNames.length; i++) {
        const t = techs.find(x => x.name === techNames[i]);
        if (!t) return false;
        const posisi = t.posisi || 'PSB/GGN';
        if (posisi !== 'PSB/GGN') return false;
    }
    return true;
}

// RETURN: array [{ name, total, tepat, rate }] — teknisi terbaik
function getTopTeknisi(filteredTickets) {
    const map = {};
    
    filteredTickets.forEach(t => {
        if (!t.technicians || t.technicians.length === 0) return;
        if (!isPsbGgn(t.technicians)) return;
        
        t.technicians.forEach(name => {
            if (!map[name]) map[name] = { total: 0, tepat: 0 };
            map[name].total++;
            if (t.status === 'close') {
                const ttr = t.ttr || 0;
                if (ttr <= t.duration) map[name].tepat++;
            }
        });
    });
    
    return Object.entries(map)
        .map(([name, d]) => ({
            name,
            total: d.total,
            tepat: d.tepat,
            rate: d.total > 0 ? (d.tepat / d.total) * 100 : 0
        }))
                .filter(x => x.tepat > 0)
        .sort((a, b) => b.tepat - a.tepat || b.total - a.total)
        .slice(0, 10);
}

// RETURN: array [{ name, total, tepat, rate }] — tim terbaik
function getTopTim(filteredTickets) {
    const map = {};
    
    filteredTickets.forEach(t => {
        if (!t.technicians || t.technicians.length === 0) return;
        if (!isPsbGgn(t.technicians)) return;
        
        const timKey = t.technicians.slice().sort().join('|');
        if (!map[timKey]) map[timKey] = { total: 0, tepat: 0, anggota: t.technicians.slice().sort() };
        map[timKey].total++;
        if (t.status === 'close') {
            const ttr = t.ttr || 0;
            if (ttr <= t.duration) map[timKey].tepat++;
        }
    });
    
    return Object.entries(map)
        .map(([key, d]) => ({
            name: d.anggota.join(', '),
            total: d.total,
            tepat: d.tepat,
            rate: d.total > 0 ? (d.tepat / d.total) * 100 : 0
        }))
                .filter(x => x.tepat > 0)
        .sort((a, b) => b.tepat - a.tepat || b.total - a.total)
        .slice(0, 10);
}

    // ===== PILIH CUSTOMER → AUTO ISI ODP & TIKET =====
async function pickCustomer(index) {
    const matches = window._customerMatches || [];
    const p = matches[index];
    if (!p) return;

    // ISI CUSTOMER & KODE PELANGGAN
    document.getElementById('customer').value = p.nama || '';
    document.getElementById('kodePelanggan').value = p.id_pelanggan || '';

    // ISI ODP / WILAYAH: PRIORITAS ODP, KALAU KOSONG PAKAI ALAMAT
    const odpVal = (p.odp && p.odp.trim() !== '' && p.odp !== '-') ? p.odp.trim() : '';
    const alamatVal = (p.alamat && p.alamat.trim() !== '' && p.alamat !== '-') ? p.alamat.trim() : '';

    let isiOdp = '';
    if (odpVal) {
        isiOdp = odpVal;
    } else if (alamatVal) {
        isiOdp = alamatVal;
    } else {
        isiOdp = '';
        notif('⚠️ Pelanggan ini belum punya data ODP / Alamat. Isi manual!', 'warning');
    }

    document.getElementById('odpPelanggan').value = isiOdp;

    // SEMBUNYIKAN DROPDOWN
    document.getElementById('customerSuggestions').style.display = 'none';

    // AUTO ISI FIELD TIKET (TRIGGER oninput KODE PELANGGAN)
    var kodeInput = document.getElementById('kodePelanggan');
    if (kodeInput && typeof kodeInput.oninput === 'function') {
        kodeInput.oninput();
    }

    // AMBIL RIWAYAT GGN / GAMAS DARI TIKET SEBELUMNYA
    try {
        const { data: riwayat, error } = await sb
            .from('tickets')
            .select('ticketid, jenisgangguan, jenistiket, createdAt, status, technicians, keterangan')
            .eq('kodePelanggan', p.id_pelanggan || '')
            .order('createdAt', { ascending: false });

        if (error) throw error;

        const list = (riwayat || []).filter(t => {
            const j = t.jenistiket || '';
            return j === 'GGN' || j === 'GAMAS';
        });

        if (list.length === 0) {
            notif('ℹ️ Pelanggan ini belum punya riwayat GGN / GAMAS', 'info');
            return;
        }

        let html = `<div style="text-align:left; max-height:400px; overflow-y:auto; font-size:13px;">
            <div style="background:#fef3c7; padding:12px 16px; border-radius:8px; margin-bottom:14px;">
                <div style="font-size:14px;"><strong>👤 ${p.nama}</strong></div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">ID: ${p.id_pelanggan || '-'} | ODP: ${p.odp || '-'}</div>
                <div style="font-size:13px; color:#dc2626; font-weight:700; margin-top:6px;">⚠️ Pernah ${list.length}x lapor GGN/GAMAS</div>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr style="background:#0b1a33; color:white;">
                        <th style="padding:6px 8px; text-align:center; width:35px;">No</th>
                        <th style="padding:6px 8px; text-align:left;">Tanggal</th>
                        <th style="padding:6px 8px; text-align:left;">No Tiket</th>
                        <th style="padding:6px 8px; text-align:left;">Jenis Gangguan</th>
                        <th style="padding:6px 8px; text-align:left;">Teknisi</th>
                        <th style="padding:6px 8px; text-align:center; width:70px;">Status</th>
                    </tr>
                </thead>
                <tbody>`;

        list.forEach(function(t, i) {
            const tgl = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
            const tech = (t.technicians || []).join(', ') || '-';
            const statusLabel = t.status === 'close' ? '✅ CLOSE' : t.status === 'open' ? '🔴 OPEN' : '⏸ PENDING';
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 8px; text-align:center;">${i+1}</td>
                <td style="padding:6px 8px;">${tgl}</td>
                <td style="padding:6px 8px; font-weight:600;">${t.ticketid || '-'}</td>
                <td style="padding:6px 8px;">${t.jenisgangguan || '-'}</td>
                <td style="padding:6px 8px;">${tech}</td>
                <td style="padding:6px 8px; text-align:center;">${statusLabel}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;

        Swal.fire({
            title: '📋 Riwayat Gangguan Pelanggan',
            html: html,
            width: 700,
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#2563eb',
            showCloseButton: true
        });

    } catch (e) {
        console.error('Gagal load riwayat:', e);
    }
}


function renderDashTeamCard(filteredTickets) {
    var grid = document.getElementById('dashTeamGrid');
    if (!grid) return;

    var teamMap = {};
    filteredTickets.forEach(function(t) {
        var listTeknisi = (t.technicians || []).slice().sort();
        if (listTeknisi.length === 0) return;
        var key = listTeknisi.join('|');
        if (!teamMap[key]) {
            teamMap[key] = { teknisi: listTeknisi, total: 0, close: 0 };
        }
        teamMap[key].total++;
        if (t.status === 'close') teamMap[key].close++;
    });

    var teams = Object.values(teamMap).sort(function(a, b) { return b.total - a.total; });

    if (teams.length === 0) {
        grid.innerHTML = '<div style="font-size:14px;color:#94a3b8;text-align:center;padding:10px;grid-column:1/-1;">Belum ada tiket</div>';
        return;
    }

    var palette = [
        { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
        { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
        { bg: '#e0f2fe', border: '#0ea5e9', text: '#075985' },
        { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' }
    ];

    var html = '';
    teams.forEach(function(team, i) {
        var c = palette[i % palette.length];

        var half = Math.ceil(team.teknisi.length / 2);
        var baris1 = team.teknisi.slice(0, half).join(', ');
        var baris2 = team.teknisi.slice(half).join(', ');

        var namaHtml =
            '<div style="font-size:12px;font-weight:700;color:' + c.text + ';line-height:1.3;word-break:break-word;">' + baris1 + '</div>' +
            (baris2 ? '<div style="font-size:12px;font-weight:700;color:' + c.text + ';line-height:1.3;word-break:break-word;">' + baris2 + '</div>' : '');

        html += '<div style="background:' + c.bg + ';border-left:4px solid ' + c.border + ';border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;min-height:75px;min-width:0;overflow:hidden;">' +
                    '<div>' + namaHtml + '</div>' +
                    '<div style="text-align:center;font-size:11px;color:#475569;font-weight:600;padding-top:6px;border-top:1px dashed ' + c.border + '40;white-space:nowrap;">' +
                        'Tiket: <strong style="color:#0b1a33;font-size:13px;">' + team.total + '</strong>' +
                        ' | ' +
                        'Close: <strong style="color:#16a34a;font-size:13px;">' + team.close + '</strong>' +
                    '</div>' +
                '</div>';
    });

    grid.innerHTML = html;
}

// ===== MODAL TEMPLATE TIKET (untuk COPY ke GRUP) =====
// ===== MODAL TEMPLATE TIKET (untuk COPY ke GRUP) =====
function showTicketTemplate(ticketData) {
    const tiketId = ticketData.ticketid || '-';
    const kodePelanggan = ticketData.kodePelanggan || '-';
    const customer = ticketData.customer || '-';
    const noHp = ticketData.no_tlp || '-';
    const odpPelanggan = ticketData.odppelanggan || '-';
    const wilayahPelanggan = ticketData.wilayahpelanggan || '-';
    
    // ✅ PENGAMAN: PAKSA JADI STRING, KALAU OBJECT JADIIN '-'
    let tagingLokasi = ticketData.taging_lokasi || '-';
    if (String(tagingLokasi).includes('[object')) tagingLokasi = '-';
    
    let tagingOdp = ticketData.taging_odp || '-';
    if (String(tagingOdp).includes('[object')) tagingOdp = '-';

    const jenisGangguan = ticketData.jenisgangguan || '-';
    const jenisTiket = ticketData.jenistiket || '';
    const odpTerimbas = ticketData.odp_terimbas || '-';
    
    // ✅ AMBIL WAKTU OPEN (DIBUAT)
    let waktuOpen = '-';
    if (ticketData.createdAt) {
        waktuOpen = new Date(ticketData.createdAt).toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).replace('.', ':'); 
    }

    // HITUNG MAX CLOSE
    let maxClose = '-';
    if (ticketData.createdAt && ticketData.duration) {
        const created = new Date(ticketData.createdAt);
        const maxDate = new Date(created.getTime() + ticketData.duration * 60000);
        const day = String(maxDate.getDate()).padStart(2, '0');
        const month = String(maxDate.getMonth() + 1).padStart(2, '0');
        const year = maxDate.getFullYear();
        const hours = String(maxDate.getHours()).padStart(2, '0');
        const minutes = String(maxDate.getMinutes()).padStart(2, '0');
        maxClose = `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    
    // SUSUN TEMPLATE PER JENIS TIKET
    let templateText = '';
    
    if (jenisTiket === 'PSB') {
        templateText = 
            `🟢 TIKET PSB\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Tiket       : ${tiketId}\n` +
            `⏱️ OPEN        : ${waktuOpen}\n` +
            `🆔 ID          : ${kodePelanggan}\n` +
            `👤 Nama        : ${customer}\n` +
            `📱 No Hp       : ${noHp}\n` +
            `📍 ODP         : ${odpPelanggan}\n` +
            `🏘️ Wilayah     : ${wilayahPelanggan}\n` +
            `🏠 Tag Plg     : ${tagingLokasi}\n` +
            `🗺️ Tag Odp    : ${tagingOdp}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
            
    } else if (jenisTiket === 'GGN') {
        templateText = 
            `🔴 TIKET GGN\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Tiket       : ${tiketId}\n` +
            `⏱️ OPEN        : ${waktuOpen}\n` +
            `🆔 ID          : ${kodePelanggan}\n` +
            `👤 Nama        : ${customer}\n` +
            `📱 No Hp       : ${noHp}\n` +
            `📍 ODP         : ${odpPelanggan}\n` +
            `🏘️ Wilayah     : ${wilayahPelanggan}\n` +
            `🏠 Tag Plg     : ${tagingLokasi}\n` +
            `🗺️ Tag Odp    : ${tagingOdp}\n` +
            `⚠️ Jenis GGN   : ${jenisGangguan}\n` +
            `🔧 Perbaikan   : ${ticketData.jenisperbaikan || '-'}\n` +
            `⏰ Max Close   : ${maxClose}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
            
    } else if (jenisTiket === 'GAMAS') {
        templateText = 
            `🚨 TIKET GAMAS\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Tiket          : ${tiketId}\n` +
            `⏱️ OPEN           : ${waktuOpen}\n` +
            `⚠️ Jenis GAMAS    : ${jenisGangguan}\n` +
            `📝 Keterangan     : ${ticketData.keterangangamas || '-'}\n` +
            `📍 ODP            : ${odpPelanggan}\n` +
            `🏘️ Wilayah        : ${wilayahPelanggan}\n` +
            `📍 ODP Terimbas   :\n${odpTerimbas}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
            
    } else if (jenisTiket === 'PROJECT') {
        templateText = 
            `🟣 TIKET PROJECT\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Tiket       : ${tiketId}\n` +
            `⏱️ OPEN        : ${waktuOpen}\n` +
            `🔨 Pekerjaan   : ${kodePelanggan}\n` +
            `📍 ODP         : ${odpPelanggan}\n` +
            `🏘️ Wilayah     : ${wilayahPelanggan}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
            
    } else if (jenisTiket === 'MIGRASI') {
        templateText = 
            `🔄 TIKET MIGRASI\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Tiket       : ${tiketId}\n` +
            `⏱️ OPEN        : ${waktuOpen}\n` +
            `📍 ODP         : ${odpPelanggan}\n` +
            `🏘️ Wilayah     : ${wilayahPelanggan}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
            
    } else if (jenisTiket === 'LAINNYA') {
        templateText = 
            `📝 TIKET LAINNYA\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Tiket       : ${tiketId}\n` +
            `⏱️ OPEN        : ${waktuOpen}\n` +
            `📌 Keperluan   : ${kodePelanggan}\n` +
            `📍 ODP         : ${odpPelanggan}\n` +
            `🏘️ Wilayah     : ${wilayahPelanggan}\n` +
            `━━━━━━━━━━━━━━━━━━━━`;
    }

    Swal.fire({
        title: '',
        width: 600,
        padding: 0,
        background: 'transparent',
        showCancelButton: true,
        confirmButtonText: '📋 Copy',
        cancelButtonText: '✕ Tutup',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        html: `
            <div style="font-family:'Inter',-apple-system,sans-serif;background:white;border-radius:20px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.15);text-align:left;">
                <!-- HEADER -->
                <div style="background:linear-gradient(135deg,#10b981,#059669);padding:22px 26px;color:white;position:relative;overflow:hidden;">
                    <div style="position:absolute;right:-30px;top:-30px;font-size:120px;opacity:0.08;font-weight:900;">✓</div>
                    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:14px;">
                        <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid rgba(255,255,255,0.15);">
                            🎫
                        </div>
                        <div>
                            <div style="font-size:18px;font-weight:700;letter-spacing:-0.3px;">Tiket Berhasil Dibuat</div>
                            <div style="font-size:12px;opacity:0.8;margin-top:2px;">Copy template di bawah untuk order ke teknisi</div>
                        </div>
                    </div>
                </div>

                <!-- BODY -->
                <div style="padding:24px 26px 26px;">
                    <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                        📋 Template Tiket
                    </div>
                    <div id="templateBox" 
                        style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:16px 18px;font-family:'Courier New',monospace;font-size:14px;color:#0b1a33;font-weight:600;word-break:break-all;line-height:1.6;user-select:all;-webkit-user-select:all;">
                        ${templateText}
                    </div>

                    <div style="margin-top:14px;font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px;">
                        <i class="fas fa-info-circle"></i> Klik tombol Copy untuk menyalin ke clipboard
                    </div>
                </div>
            </div>
        `,
        preConfirm: () => {
            // COPY KE CLIPBOARD
            return navigator.clipboard.writeText(templateText)
                .then(() => true)
                .catch(() => {
                    // FALLBACK KALAU GAGAL
                    const el = document.getElementById('templateBox');
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    document.execCommand('copy');
                    sel.removeAllRanges();
                    return true;
                });
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Template berhasil di-copy!',
                showConfirmButton: false,
                timer: 1800
            });
        }

        // ✅ RESET FORM SETELAH MODAL COPY DITUTUP
        document.getElementById('customer').value = '';
        document.getElementById('odpPelanggan').value = '';
        document.getElementById('kodePelanggan').value = '';
        if (document.getElementById('wilayahPelanggan')) document.getElementById('wilayahPelanggan').value = '';
        if (document.getElementById('noHpPelanggan')) document.getElementById('noHpPelanggan').value = '';
        if (document.getElementById('tagingLokasi')) document.getElementById('tagingLokasi').value = '';
        if (document.getElementById('tagingOdp')) document.getElementById('tagingOdp').value = '';
        if (document.getElementById('fotoRumahInput')) document.getElementById('fotoRumahInput').value = '';
        if (document.getElementById('fotoKtpInput')) document.getElementById('fotoKtpInput').value = '';
        if (document.getElementById('fotoRumahPreview')) document.getElementById('fotoRumahPreview').innerHTML = '';
        if (document.getElementById('fotoKtpPreview')) document.getElementById('fotoKtpPreview').innerHTML = '';
        if (document.getElementById('createdAtManual')) document.getElementById('createdAtManual').value = '';
        if (document.getElementById('odpTerimbas')) document.getElementById('odpTerimbas').value = '';
        
        selectedTechs = [];
        renderTechDropdown();

        // ✅ KEMBALIKAN KE DEFAULT
        document.getElementById('jenisTiket').value = 'PSB';
        updateJenisGangguan();
        updateDurationByJenis();
        
        // ✅ GENERATE NOMOR TIKET BARU
        generateTicketId('PSB').then(function(newId) {
            document.getElementById('ticketId').value = newId;
        });
    });
}

// ============================================================
// GENERATE NOMOR TIKET OTOMATIS
// Format: {PREFIX}-{YYMM}-{NNN}
// Nomor urut LANJUT TERUS (tidak reset per bulan)
// ============================================================
function getTicketPrefix(jenisTiket) {
    const map = {
        'GGN': 'GGN',
        'PSB': 'PSB',
        'GAMAS': 'GMS',
        'PROJECT': 'PRJ',
        'MIGRASI': 'MIG',
        'LAINNYA': 'LN'
    };
    return map[jenisTiket] || 'TKT';
}

async function generateTicketId(jenisTiket) {
    const prefix = getTicketPrefix(jenisTiket);
    const now = new Date();
    const yymm = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');

    // CEK NOMOR TERAKHIR DARI DB
    let lastNumber = 0;
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('ticketid')
            .like('ticketid', prefix + '-%')
            .order('createdAt', { ascending: false })
            .limit(100);

        if (!error && data && data.length > 0) {
            data.forEach(row => {
                const parts = (row.ticketid || '').split('-');
                if (parts.length >= 3) {
                    const num = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(num) && num > lastNumber) lastNumber = num;
                }
            });
        }
    } catch (e) {
        console.error('Gagal cek nomor tiket terakhir:', e);
    }

    const nextNumber = lastNumber + 1;
    const numStr = String(nextNumber).padStart(3, '0');

    return prefix + '-' + yymm + '-' + numStr;
}


async function openTicketModalFromStat() {
    // SET DEFAULT JENIS TIKET KE PSB
    document.getElementById('jenisTiket').value = 'PSB';
    updateJenisGangguan();
    
    // KOSONGKAN FORM
    document.getElementById('ticketId').value = '';
    document.getElementById('customer').value = '';
    document.getElementById('odpPelanggan').value = '';
    document.getElementById('kodePelanggan').value = '';
    document.getElementById('duration').value = '60';
    document.getElementById('createdAtManual').value = '';
    
    // RESET TEKNISI
    selectedTechs = [];
    renderTechDropdown();
    
    // TAMPILKAN MODAL
    document.getElementById('openTicketModal').style.display = 'flex';

    // ✅ AUTO-GENERATE TIKET PERTAMA KALI (PSB)
    const firstTicketId = await generateTicketId('PSB');
    document.getElementById('ticketId').value = firstTicketId;

    // ✅ AUTO-GENERATE ULANG SAAT GANTI JENIS TIKET
    document.getElementById('jenisTiket').onchange = async function() {
        const jenis = this.value;
        updateJenisGangguan();
        const newTicketId = await generateTicketId(jenis);
        document.getElementById('ticketId').value = newTicketId;
    };

    // AUTO-FILL DATA PELANGGAN (TANPA UBAH TIKET)
    document.getElementById('kodePelanggan').oninput = function() {
        const kode = this.value.trim();
        if (kode) autoFillCustomerByKode(kode);
    };

    // AUTO-FILL SAAT FIELD KODE PELANGGAN DI-BLUR
    const kodeElBlur = document.getElementById('kodePelanggan');
    if (kodeElBlur && !kodeElBlur.dataset.hasKodeBlur) {
        kodeElBlur.dataset.hasKodeBlur = 'true';
        kodeElBlur.addEventListener('blur', function() {
            autoFillCustomerByKode(this.value.trim());
        });
    }

    // ✅ CEK ODP TERIMBAS SAAT BLUR FIELD ODP (KHUSUS GGN)
    const odpElCek = document.getElementById('odpPelanggan');
    if (odpElCek && !odpElCek.dataset.hasOdpBlur) {
        odpElCek.dataset.hasOdpBlur = 'true';
        odpElCek.addEventListener('blur', async function() {
            const jenisTiket = document.getElementById('jenisTiket').value;
            if (jenisTiket !== 'GGN') return;
            await cekOdpTerimbasWarning();
        });
    }

    // ✅ CEK ODP TERIMBAS SAAT BLUR FIELD ID PELANGGAN (KHUSUS GGN)
    const kodeElCek = document.getElementById('kodePelanggan');
    if (kodeElCek && !kodeElCek.dataset.hasOdpBlur) {
        kodeElCek.dataset.hasOdpBlur = 'true';
        kodeElCek.addEventListener('blur', async function() {
            const jenisTiket = document.getElementById('jenisTiket').value;
            if (jenisTiket !== 'GGN') return;
            await cekOdpTerimbasWarning();
        });
    }

    // AUTOCOMPLETE CUSTOMER & ID UNTUK GGN
    document.getElementById('customer').oninput = function() {
        showCustomerSuggestionsGGN();
    };
    document.getElementById('customer').onfocus = function() {
        showCustomerSuggestionsGGN();
    };
    
    // Daftarkan event untuk kolom ID Pelanggan
    document.getElementById('kodePelanggan').oninput = function() {
        showIdSuggestionsGGN();
    };
    document.getElementById('kodePelanggan').onfocus = function() {
        showIdSuggestionsGGN();
    };

    updateDurationByJenis();
}

// FUNGSI GENERATE TIKET OTOMATIS UNTUK SEMUA JENIS
function generateTicketId() {
    const kodePelanggan = document.getElementById('kodePelanggan').value.trim();
    const manualDate = document.getElementById('createdAtManual').value;
    const ticketIdInput = document.getElementById('ticketId');
    
    if (!kodePelanggan) {
        ticketIdInput.value = '';
        return;
    }
    
    let dateObj;
    if (manualDate) {
        dateObj = new Date(manualDate);
    } else {
        dateObj = new Date();
    }
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    const dateStr = day + month + year;
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const timeStr = hours + ':' + minutes;
    
    ticketIdInput.value = kodePelanggan + '/' + dateStr + '/' + timeStr;
}

function closeOpenTicketModal() {
    document.getElementById('openTicketModal').style.display = 'none';
    const box = document.getElementById('gaulWarningBox');
    if (box) {
        box.style.display = 'none';
        box.innerHTML = '';
    }
}

// ===== FUNGSI UNTUK ADD TIKET DARI MODAL =====
async function addTicketFromModal() {
    // CEK SEMUA FIELD YANG WAJIB
    const jenisTiket = document.getElementById('jenisTiket').value;
    const ticketId = document.getElementById('ticketId').value.trim();
    const customer = document.getElementById('customer') ? document.getElementById('customer').value.trim() : '';
    const kodePelanggan = document.getElementById('kodePelanggan').value.trim();
    const odpPelanggan = document.getElementById('odpPelanggan').value.trim();
    const duration = document.getElementById('duration').value;
    const selectedTechsContainer = document.getElementById('selectedTechs');
    
    // CEK APAKAH ADA TEKNISI DIPILIH
    let hasTech = false;
    if (selectedTechsContainer) {
        const techElements = selectedTechsContainer.querySelectorAll('span');
        for (let i = 0; i < techElements.length; i++) {
            const el = techElements[i];
            if (!el.innerHTML.includes('Belum ada teknisi')) {
                hasTech = true;
                break;
            }
        }
    }
    
    // VALIDASI
    let errors = [];
    
    if (!ticketId) errors.push('Tiket wajib diisi');

    // CUSTOMER WAJIB DIISI KECUALI: LAINNYA, MIGRASI, GAMAS, PROJECT
    if (
        jenisTiket !== 'LAINNYA' &&
        jenisTiket !== 'MIGRASI' &&
        jenisTiket !== 'GAMAS' &&
        jenisTiket !== 'PROJECT' &&
        !customer
    ) {
        errors.push('Customer wajib diisi');
    }

    if (!duration || duration <= 0) errors.push('Durasi wajib diisi');
    
    if ((jenisTiket === 'PSB' || jenisTiket === 'GGN') && !kodePelanggan) {
        errors.push('ID / Kode Pelanggan wajib diisi untuk tiket ' + jenisTiket);
    }
    
    if ((jenisTiket === 'PSB' || jenisTiket === 'GGN' || jenisTiket === 'GAMAS' || jenisTiket === 'MIGRASI') && !odpPelanggan) {
        errors.push('ODP / Wilayah wajib diisi untuk tiket ' + jenisTiket);
    }
    
    if (!hasTech) {
        errors.push('Pilih minimal 1 teknisi');
    }
    
    // KALAU ADA ERROR
    if (errors.length > 0) {
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 999999;
            max-width: 500px; 
            text-align: left;
            font-family: sans-serif;
            border: 1px solid #e2e8f0;
        `;
        alertDiv.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;border-bottom:2px solid #fef3c7;padding-bottom:12px;">
                <span style="font-size:32px;">⚠️</span>
                <div>
                    <div style="font-weight:700;font-size:18px;color:#0b1a33;">DATA BELUM LENGKAP!</div>
                    <div style="font-size:13px;color:#64748b;">Harap lengkapi data di bawah</div>
                </div>
            </div>
            <div style="margin-bottom:20px;">
                ${errors.map(e => `<div style="padding:6px 0;color:#dc2626;font-size:14px;">❌ ${e}</div>`).join('')}
            </div>
            <button onclick="this.parentElement.remove()" style="width:100%;padding:10px;background:#2563eb;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">
                OK, Lengkapi
            </button>
        `;
        document.body.appendChild(alertDiv);
        return;
    }
    
    // KALAU SEMUA OK
    await addTicket();
}

// ============================================================
// AUTO-FILL DATA PELANGGAN — CARI DARI 2 SUMBER
// ============================================================
async function autoFillCustomerByKode(kode) {
    if (!kode || kode === '-') return;
    
    const jenisTiket = document.getElementById('jenisTiket').value;
    if (jenisTiket !== 'GGN') return;
    
    const customerInput = document.getElementById('customer');
    const odpInput = document.getElementById('odpPelanggan');
    
    if (customerInput && customerInput.value.trim() !== '') return;
    
    try {
        // SUMBER 1: TABEL PELANGGAN
        const { data: pel } = await sb
            .from('pelanggan')
            .select('nama, odp, taging_lokasi, taging_odp')
            .eq('id_pelanggan', kode)
            .maybeSingle();
        
        if (pel && pel.nama) {
            if (customerInput) customerInput.value = pel.nama;
            if (odpInput) {
                const odpVal = (pel.odp && pel.odp !== '-') 
                    ? pel.odp 
                    : (pel.taging_lokasi && pel.taging_lokasi !== '-' ? pel.taging_lokasi : '');
                if (odpVal) odpInput.value = odpVal;
            }
            notif('✅ Data pelanggan: ' + pel.nama, 'success');
            return;
        }
        
        // SUMBER 2: RIWAYAT TIKET
        const { data: riwayat } = await sb
            .from('tickets')
            .select('customer, odppelanggan, jenistiket, jenisgangguan, createdAt')
            .eq('kodePelanggan', kode)
            .order('createdAt', { ascending: false });
        
        if (!riwayat || riwayat.length === 0) {
            notif('ℹ️ ID ' + kode + ' tidak ditemukan', 'info');
            return;
        }
        
        let namaDitemukan = '';
        let odpDitemukan = '';
        
        for (const t of riwayat) {
            if (!namaDitemukan && t.customer && t.customer !== '-') {
                namaDitemukan = t.customer;
            }
            if (!odpDitemukan && t.odppelanggan && t.odppelanggan !== '-') {
                odpDitemukan = t.odppelanggan;
            }
            if (namaDitemukan && odpDitemukan) break;
        }
        
        if (customerInput && namaDitemukan) customerInput.value = namaDitemukan;
        if (odpInput && odpDitemukan) odpInput.value = odpDitemukan;
        
        const totalLaporan = riwayat.length;
        if (namaDitemukan) {
            notif('✅ Dari riwayat: ' + namaDitemukan + ' (' + totalLaporan + 'x lapor)', 'success');
        } else {
            notif('⚠️ ID ditemukan, tapi nama kosong', 'warning');
        }
        
        // CEK GAUL
        const GANGGUAN_GAUL = [
            'Kabel Putus (LOS)', 'Internet lambat', 'Redaman Tinggi',
            'Tidak Ada Koneksi Internet', 'GAMAS FEEDER', 'GAMAS DISTRIBUSI', 'GAMAS ODP'
        ];
        const totalGJ = riwayat.filter(t => 
            (t.jenistiket === 'GGN' || t.jenistiket === 'GAMAS') &&
            GANGGUAN_GAUL.includes((t.jenisgangguan || '').trim())
        ).length;
        
        if (totalGJ >= 2 && typeof checkGaulForOpenTicket === 'function') {
            setTimeout(() => checkGaulForOpenTicket(), 300);
        }
        
    } catch (e) {
        console.error('Auto-fill error:', e);
    }
}

       // ============================================================
// PERBAIKAN: updateJenisGangguan agar terisolasi dan tidak merusak state jenis tiket
// ============================================================
function updateJenisGangguan() {
    const jenisTiketEl = document.getElementById('jenisTiket');
    if (!jenisTiketEl) return;
    const jenisTiket = jenisTiketEl.value;
    
    const selectGangguan = document.getElementById('jenisGangguan');
    const keteranganGroup = document.getElementById('keteranganGamasGroup');
    const odpGroup = document.getElementById('odpGroup');
    const odpInput = document.getElementById('odpPelanggan');
    const kodeGroup = document.getElementById('kodePelangganGroup');
    const kodeInput = document.getElementById('kodePelanggan');
    const kodeLabel = document.getElementById('kodePelangganLabel');
    const jenisGangguanLabel = document.getElementById('jenisGangguanLabel');
    const odpLabel = document.getElementById('odpLabel');
    const wilayahGroup = document.getElementById('wilayahGroup');

    // Reset visibility group
    ['tagingLokasiGroup', 'tagingOdpGroup', 'fotoRumahGroup', 'fotoKtpGroup', 'odpTerimbasGroup', 'noHpGroup', 'wilayahGroup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    var customerInput = document.getElementById('customer');
    var customerCol = customerInput ? customerInput.closest('div') : null;
    if (customerCol) customerCol.style.display = 'block';

    if (selectGangguan) {
        var jenisGangguanColReset = selectGangguan.closest('div');
        if (jenisGangguanColReset) jenisGangguanColReset.style.display = 'block';
    }
    
    // Konfigurasi berdasarkan Jenis Tiket yang dipilih
    if (jenisTiket === 'PSB') {
        selectGangguan.innerHTML = `<option value="">-</option>`;
        selectGangguan.value = '';
        selectGangguan.disabled = true;
        selectGangguan.style.background = '#f1f5f9';
        selectGangguan.style.cursor = 'not-allowed';
        selectGangguan.style.color = '#94a3b8';
        
        var jenisGangguanColPSB = selectGangguan.closest('div');
        if (jenisGangguanColPSB) jenisGangguanColPSB.style.display = 'none';
        
        if (kodeGroup) {
            kodeGroup.style.display = 'block';
            kodeInput.required = true;
            kodeLabel.innerHTML = 'ID / Kode Pelanggan <span style="color:#dc2626;">*</span>';
            kodeInput.placeholder = 'Contoh: 1234567890';
        }
        
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpLabel.innerHTML = 'ODP <span style="color:#dc2626;">*</span>';
            odpInput.placeholder = 'Contoh: ODP-001';
        }

        if (wilayahGroup) {
            wilayahGroup.style.display = 'block';
        }
        
        document.getElementById('tagingLokasiGroup').style.display = 'block';
        document.getElementById('tagingOdpGroup').style.display = 'block';
        document.getElementById('fotoRumahGroup').style.display = 'block';
        document.getElementById('fotoKtpGroup').style.display = 'block';
        
        const noHpGrp = document.getElementById('noHpGroup');
        if (noHpGrp) noHpGrp.style.display = 'block';
        return;
    }
    
    if (jenisTiket === 'GGN') {
        selectGangguan.innerHTML = `
            <option value="Ganti Adaptor">Ganti Adaptor</option>
            <option value="Ganti HTB">Ganti HTB</option>
            <option value="Ganti Modem">Ganti Modem</option>
            <option value="Ganti Sandi">Ganti Sandi</option>
            <option value="Internet lambat">Internet lambat</option>
            <option value="Kabel Putus (LOS)">Kabel Putus (LOS)</option>
            <option value="Kabel Terjuntai">Kabel Terjuntai</option>
            <option value="Kelistrikan">Kelistrikan</option>
            <option value="Modem Mati">Modem Mati</option>
            <option value="Pindah Modem">Pindah Modem</option>
            <option value="Redaman Tinggi">Redaman Tinggi</option>
            <option value="Tidak Ada Koneksi Internet">Tidak Ada Koneksi Internet</option>
        `;
        selectGangguan.disabled = false;
        selectGangguan.style.background = 'white';
        selectGangguan.style.cursor = 'default';
        selectGangguan.style.color = 'inherit';
        
        if (kodeGroup) {
            kodeGroup.style.display = 'block';
            kodeInput.required = true;
            kodeLabel.innerHTML = 'ID / Kode Pelanggan <span style="color:#dc2626;">*</span>';
        }
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpLabel.innerHTML = 'ODP <span style="color:#dc2626;">*</span>';
            odpInput.placeholder = 'Contoh: ODP-001';
        }

        if (wilayahGroup) {
            wilayahGroup.style.display = 'block';
        }

        const noHpGrpGGN = document.getElementById('noHpGroup');
        if (noHpGrpGGN) noHpGrpGGN.style.display = 'block';

        const ketGamasGrpGGN = document.getElementById('keteranganGamasGroup');
        if (ketGamasGrpGGN) ketGamasGrpGGN.style.display = 'none';
        return;
    }

    if (jenisTiket === 'GAMAS') {
        selectGangguan.innerHTML = `
            <option value="GAMAS FEEDER">GAMAS FEEDER</option>
            <option value="GAMAS DISTRIBUSI">GAMAS DISTRIBUSI</option>
            <option value="GAMAS ODP">GAMAS ODP</option>
        `;
        selectGangguan.value = 'GAMAS FEEDER';
        selectGangguan.disabled = false;
        selectGangguan.removeAttribute('disabled');
        selectGangguan.style.background = 'white';
        selectGangguan.style.cursor = 'pointer';
        selectGangguan.style.color = '#0b1a33';
        selectGangguan.style.opacity = '1';
        
        if (kodeGroup) kodeGroup.style.display = 'none';
        if (customerCol) customerCol.style.display = 'none';
        
        var noHpGrpGamas = document.getElementById('noHpGroup');
        if (noHpGrpGamas) noHpGrpGamas.style.display = 'none';
        
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpLabel.innerHTML = 'ODP <span style="color:#dc2626;">*</span>';
            odpInput.placeholder = 'Contoh: ODP-001';
        }

        if (wilayahGroup) {
            wilayahGroup.style.display = 'block';
        }

        const odpTerimbasGrpGamas = document.getElementById('odpTerimbasGroup');
        if (odpTerimbasGrpGamas) odpTerimbasGrpGamas.style.display = 'block';

        const ketGamasGrp = document.getElementById('keteranganGamasGroup');
        if (ketGamasGrp) ketGamasGrp.style.display = 'block';
        return;
    }

    if (jenisTiket === 'PROJECT') {
        selectGangguan.innerHTML = `<option value="PROJECT">PROJECT</option>`;
        selectGangguan.value = 'PROJECT';
        selectGangguan.disabled = false;
        
        if (kodeGroup) {
            kodeGroup.style.display = 'block';
            kodeInput.required = true;
            kodeLabel.innerHTML = 'Pekerjaan <span style="color:#dc2626;">*</span>';
        }
        if (customerCol) customerCol.style.display = 'none';
        var noHpGrpProject = document.getElementById('noHpGroup');
        if (noHpGrpProject) noHpGrpProject.style.display = 'none';
        if (selectGangguan) selectGangguan.closest('div').style.display = 'none';

        if (wilayahGroup) wilayahGroup.style.display = 'block';

        const ketGamasGrpProject = document.getElementById('keteranganGamasGroup');
        if (ketGamasGrpProject) ketGamasGrpProject.style.display = 'none';
        return;
    }

    if (jenisTiket === 'MIGRASI') {
        if (kodeGroup) kodeGroup.style.display = 'none';
        const noHpGroupEl = document.getElementById('noHpGroup');
        if (noHpGroupEl) noHpGroupEl.style.display = 'none';
        if (customerCol) customerCol.style.display = 'none';
        if (odpGroup) {
            odpGroup.style.display = 'block';
            odpInput.required = true;
            odpLabel.innerHTML = 'ODP <span style="color:#dc2626;">*</span>';
            odpInput.placeholder = 'Contoh: ODP-001';
        }

        if (wilayahGroup) {
            wilayahGroup.style.display = 'block';
        }

        if (selectGangguan) {
            selectGangguan.value = 'MIGRASI';
            selectGangguan.closest('div').style.display = 'none';

            const ketGamasGrpMigrasi = document.getElementById('keteranganGamasGroup');
            if (ketGamasGrpMigrasi) ketGamasGrpMigrasi.style.display = 'none';
        }
        return;
    }

    if (jenisTiket === 'LAINNYA') {
        if (kodeGroup) {
            kodeGroup.style.display = 'block';
            kodeInput.required = true;
            kodeLabel.innerHTML = 'Keperluan <span style="color:#dc2626;">*</span>';
        }
        if (odpGroup) odpGroup.style.display = 'block';
        if (wilayahGroup) wilayahGroup.style.display = 'block';
        if (selectGangguan) selectGangguan.closest('div').style.display = 'none';
        if (customerCol) customerCol.style.display = 'none';
        return;
    }
}

async function compressImage(file, maxWidth = 1280, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round((maxWidth / w) * h); w = maxWidth; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================
// CEK ODP TERIMBAS YANG SUDAH PERNAH KENA GAMAS ≥2x (2 BULAN)
// ============================================================
async function cekOdpGaulGamas(listOdp) {
    if (!listOdp || listOdp.length === 0) return [];

    const batas = new Date();
    batas.setMonth(batas.getMonth() - 2);

    const gaulList = [];
    const source = (tickets || []).filter(t => {
        if (!t.createdAt) return false;
        if (new Date(t.createdAt) < batas) return false;
        return (t.jenistiket || '').toUpperCase() === 'GAMAS';
    });

    for (const odpRaw of listOdp) {
        const odpKey = odpRaw.toUpperCase().replace(/^ODP-/, '').trim();
        if (!odpKey) continue;

        let count = 0;
        source.forEach(t => {
            const odpsTerimbas = (t.odp_terimbas || '')
                .split('\n')
                .map(x => x.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
                .map(x => x.toUpperCase().replace(/^ODP-/, '').trim())
                .filter(x => x);
            if (odpsTerimbas.includes(odpKey)) count++;
        });

        if (count >= 2) {
            gaulList.push({ odp: odpRaw, count });
        }
    }

    return gaulList;
}

// ============================================================
// TAMPILKAN WARNING ODP GAUL DI MODAL GAMAS
// ============================================================
function renderWarningOdpGaul(gaulList) {
    let box = document.getElementById('gamodGaulWarningBox');
    if (!box) {
        const parent = document.getElementById('odpTerimbasGroup');
        if (!parent) return;
        box = document.createElement('div');
        box.id = 'gamodGaulWarningBox';
        box.style.marginTop = '8px';
        parent.appendChild(box);
    }

    if (!gaulList || gaulList.length === 0) {
        box.innerHTML = '';
        return;
    }

    let items = gaulList.map(g =>
        `<div style="padding:6px 10px;background:white;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;border:1px solid #fecaca;">
            <span style="font-family:'Courier New',monospace;font-weight:700;color:#7f1d1d;font-size:12px;">${g.odp}</span>
            <span style="background:#dc2626;color:white;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;">${g.count}x</span>
        </div>`
    ).join('');

    box.innerHTML = `
        <div style="background:#fef2f2;border-left:5px solid #dc2626;border-radius:10px;padding:12px 14px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:18px;">⚠️</span>
                <span style="font-weight:700;color:#7f1d1d;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">ODP GAUL TERDETEKSI</span>
            </div>
            <div style="font-size:11px;color:#991b1b;margin-bottom:8px;line-height:1.5;">
                ODP di bawah ini sudah <strong>≥2x terimbas GAMAS</strong> dalam 2 bulan terakhir:
            </div>
            ${items}
        </div>
    `;
}

// ============================================================
// PARSE BOT TELEGRAM — EXTRAK ODP TERIMBAS
// ============================================================
function parseBotOdpTerimbas() {
    const textarea = document.getElementById('odpTerimbas');
    if (!textarea) return;
    
    const text = textarea.value.trim();
    if (!text) {
        Swal.fire('Info', 'Field ODP Terimbas kosong. Copas dulu teks dari bot.', 'info');
        return;
    }
    
    // Regex: cari baris yang diawali "📦 KODE"
    // Contoh: 📦 WNJ-012/007 (1 Pelanggan)
    //         📦 Tidak Diketahui (5 Pelanggan)
    const lines = text.split('\n');
    const odpsFound = new Set();
    let totalPelangganFromBot = 0;
    let totalOdpFromBot = 0;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Cek baris ODP: mulai dengan 📦
        const odpMatch = trimmed.match(/^📦\s+(.+?)(?:\s*\(|\s*$)/);
        if (odpMatch) {
            let kode = odpMatch[1].trim();
            
            // Skip kalau "Tidak Diketahui" — SESUAI REQUEST (B) — tetap dimasukkan
            // Kalau tidak mau skip, biarkan. Kalau mau skip, tambahkan: if (kode === 'Tidak Diketahui') return;
            
            // Tambah prefix ODP- kalau belum ada
            if (!kode.toUpperCase().startsWith('ODP-')) {
                kode = 'ODP-' + kode;
            }
            
            odpsFound.add(kode);
        }
        
        // Cek baris "Jumlah Pelanggan Terimbas : XX Pelanggan"
        const pelangganMatch = trimmed.match(/Jumlah\s+Pelanggan\s+Terimbas\s*:\s*(\d+)/i);
        if (pelangganMatch) {
            totalPelangganFromBot = parseInt(pelangganMatch[1]);
        }
        
        // Cek baris "Jumlah ODP Terimbas : XX ODP"
        const odpCountMatch = trimmed.match(/Jumlah\s+ODP\s+Terimbas\s*:\s*(\d+)/i);
        if (odpCountMatch) {
            totalOdpFromBot = parseInt(odpCountMatch[1]);
        }
    });
    
    if (odpsFound.size === 0) {
        Swal.fire('Gagal Parse', 'Tidak ada ODP yang terdeteksi dari teks bot. Pastikan format sesuai contoh.', 'warning');
        return;
    }
    
    // Gabung jadi string satu per baris
    const hasil = Array.from(odpsFound).join('\n');
    
    // Tampilkan konfirmasi
    Swal.fire({
        title: '📋 Hasil Parse',
        width: 600,
        html: `
            <div style="text-align:left;font-size:13px;">
                <div style="background:#ecfdf5;padding:12px 16px;border-radius:10px;margin-bottom:14px;border:1px solid #a7f3d0;">
                    <div style="color:#065f46;font-weight:700;margin-bottom:4px;">✅ Berhasil</div>
                    <div style="color:#047857;font-size:12px;">Ditemukan <strong>${odpsFound.size} ODP</strong> unik${totalPelangganFromBot > 0 ? ` dari <strong>${totalPelangganFromBot} pelanggan</strong>` : ''}</div>
                </div>
                <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;max-height:300px;overflow-y:auto;">
                    <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Daftar ODP:</div>
                    <div style="font-family:'Courier New',monospace;font-size:12px;color:#0b1a33;line-height:1.8;white-space:pre-wrap;">${hasil}</div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '✅ Ganti Field',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8'
    }).then(async result => {
        if (result.isConfirmed) {
            textarea.value = hasil;
            
            const info = document.getElementById('parseBotInfo');
            if (info) {
                info.style.display = 'block';
                info.innerHTML = `✅ <strong>${odpsFound.size} ODP</strong> berhasil di-extract${totalPelangganFromBot > 0 ? ` • ${totalPelangganFromBot} pelanggan` : ''} • ${totalOdpFromBot > 0 ? `${totalOdpFromBot} ODP terimbas` : ''}`;
            }
            
            notif(`✅ ${odpsFound.size} ODP berhasil di-parse`, 'success');

            // ✅ CEK ODP GAUL
            const gaulList = await cekOdpGaulGamas(Array.from(odpsFound));
            renderWarningOdpGaul(gaulList);
            if (gaulList.length > 0) {
                notif(`⚠️ ${gaulList.length} ODP terdeteksi GAUL`, 'warning');
            }
        }
    });
}

        // ===== LOGIN (SUPABASE AUTH) =====
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

    
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePasswordIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}


    // ===== AUTO LOGOUT 15 MENIT =====
    let logoutTimer = null;
    const LOGOUT_TIME = 10 * 60 * 1000; // 10 menit dalam milidetik

    function resetLogoutTimer() {
        // Hapus timer lama
        if (logoutTimer) {
            clearTimeout(logoutTimer);
            logoutTimer = null;
        }
        
        // Cek apakah user sedang login (session berupa JSON)
        const session = localStorage.getItem('user_session');
        if (!session) return;
        
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

    


    // AUTO LOGIN - CEK SESSION SUPABASE AUTH
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            const { data } = await sb.auth.getSession();
            if (data && data.session) {
                var loginPage = document.getElementById('loginPage');
                var mainApp = document.getElementById('mainApp');
                if (loginPage) loginPage.style.display = 'none';
                if (mainApp) mainApp.style.display = 'block';
                document.body.style.background = '#eef2f6';
                resetLogoutTimer();
                setTimeout(function() {
                    loadTechniciansCache();
                    setupRealtime();
                }, 300);
            }
        } catch(e) {
            console.error('Session check error:', e);
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        var bulanSelect = document.getElementById('grafikBulan');
        if (bulanSelect) {
            var nowMonth = new Date().getMonth();
            bulanSelect.value = String(nowMonth);
        }
    });

        // LOGOUT (SUPABASE AUTH)
    async function handleLogout() {
        if (logoutTimer) {
            clearTimeout(logoutTimer);
            logoutTimer = null;
        }
        try {
            await sb.auth.signOut();
        } catch(e) {
            console.error('Sign out error:', e);
        }
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
        
        // ===== WARNING CAPSLOCK GLOBAL =====
        // Muncul di mana saja selama di halaman login
        const capsWarn = document.createElement('div');
        capsWarn.id = 'capsLockWarning';
        capsWarn.style.cssText = `
            display: none;
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #fef2f2;
            border: 2px solid #dc2626;
            color: #dc2626;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            z-index: 99999;
            box-shadow: 0 10px 30px rgba(220, 38, 38, 0.25);
            animation: slideDown 0.3s ease;
            display: none;
        `;
        capsWarn.innerHTML = '⚠️ Caps Lock sedang aktif!';
        document.body.appendChild(capsWarn);
        
        // Deteksi global di seluruh halaman
        document.addEventListener('keydown', function(e) {
            if (e.getModifierState) {
                // Cek apakah login page masih tampil
                const loginPage = document.getElementById('loginPage');
                if (!loginPage || loginPage.style.display === 'none') return;
                
                const isCapsOn = e.getModifierState('CapsLock');
                capsWarn.style.display = isCapsOn ? 'block' : 'none';
            }
        });
        
        document.addEventListener('keyup', function(e) {
            if (e.getModifierState) {
                const loginPage = document.getElementById('loginPage');
                if (!loginPage || loginPage.style.display === 'none') return;
                
                const isCapsOn = e.getModifierState('CapsLock');
                capsWarn.style.display = isCapsOn ? 'block' : 'none';
            }
        });
        
        const usernameInput = document.getElementById('loginUsername');
        if (usernameInput) {
            usernameInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleLogin();
                }
            });
            
            // Warning CapsLock di username juga
            const capsWarnUser = document.createElement('div');
            capsWarnUser.id = 'capsLockWarningUsername';
            capsWarnUser.style.cssText = 'display:none;color:#dc2626;font-size:12px;margin-top:6px;font-weight:600;';
            capsWarnUser.innerHTML = '⚠️ <strong>Caps Lock aktif!</strong>';
            if (usernameInput.parentElement) {
                usernameInput.parentElement.appendChild(capsWarnUser);
            }
            
            usernameInput.addEventListener('keydown', function(e) {
                if (e.getModifierState) {
                    const isCapsOn = e.getModifierState('CapsLock');
                    capsWarnUser.style.display = isCapsOn ? 'block' : 'none';
                }
            });
            
            usernameInput.addEventListener('blur', function() {
                capsWarnUser.style.display = 'none';
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

    // ============================================================
// RENDER DASHBOARD - PANGGIL CHART
// ============================================================

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
        document.getElementById('dashProjectTickets').textContent = '0';
        document.getElementById('dashOverdueTickets').textContent = '0';
        document.getElementById('dashGaulTickets').textContent = '0';
        document.getElementById('dashTicketBody').innerHTML = '<tr><td colspan="8"><div class="empty">Belum ada data</div></td></tr>';
        document.getElementById('dashTicketCount').textContent = '0 tiket';
        document.getElementById('dashPagination').innerHTML = '';
        renderDashboardCharts([]);
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
    
    // GAMAS - HITUNG YANG JENIS TIKETNYA GAMAS
    const gamasCount = filteredTickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        return jenisTiket === 'GAMAS';
    }).length;
    
    // PROJECT - HITUNG YANG JENIS TIKETNYA PROJECT
    const projectCount = filteredTickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        return jenisTiket === 'PROJECT';
    }).length;

    // LAINNYA - HITUNG YANG JENIS TIKETNYA LAINNYA
    const lainnyaCount = filteredTickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        return jenisTiket === 'LAINNYA';
    }).length;
    
    // OVERDUE
    const overdueCount = filteredTickets.filter(t => {
        const status = t.status || '';
        if (status === 'close' || status === 'open') {
            return (t.ttr || 0) > t.duration;
        }
        return false;
    }).length;
    
    // GAUL
    // GAUL (HANYA HARI INI)
    let gaulCount = 0;
    if (filteredTickets.length > 0) {
        // Ambil kodePelanggan dari tiket hari ini (yang gangguan jaringan)
        const kodeHariIni = filteredTickets
            .filter(t => isGangguanJaringan(t))
            .map(t => t.kodePelanggan)
            .filter(k => k && k !== '-');
        
        // Untuk tiap kode, cek apakah pelanggan itu GAUL (>=2 laporan dalam 2 bulan)
        const gaulSet = getPelangganGaul();
        const uniqueGaulHariIni = new Set();
        kodeHariIni.forEach(k => {
            if (gaulSet.has(k)) uniqueGaulHariIni.add(k);
        });
        gaulCount = uniqueGaulHariIni.size;
    }
    
    document.getElementById('dashGaulTickets').textContent = gaulCount;
    
    // UPDATE CARD
    document.getElementById('dashTotalTickets').textContent = totalTickets;
    document.getElementById('dashOpenTickets').textContent = openCount;
    document.getElementById('dashClosedTickets').textContent = closeCount;
    document.getElementById('dashGamasTickets').textContent = gamasCount;
    document.getElementById('dashProjectTickets').textContent = projectCount;
    if (document.getElementById('dashLainnyaTickets')) {
    document.getElementById('dashLainnyaTickets').textContent = lainnyaCount;
}
    document.getElementById('dashOverdueTickets').textContent = overdueCount;
    document.getElementById('dashGaulTickets').textContent = gaulCount;

        // ===== RENDER CARD TIM =====
    renderDashTeamCard(filteredTickets);
    // ===== TIKET TERBARU (TANPA PAGINATION, PAKAI SCROLL) =====
const sortedTickets = [...filteredTickets].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
);

const body = document.getElementById('dashTicketBody');
if (document.getElementById('dashTicketCount')) {
    document.getElementById('dashTicketCount').textContent = filteredTickets.length + ' tiket';
}

if (sortedTickets.length === 0) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty">Tidak ada tiket</div></td></tr>';
} else {
    body.innerHTML = sortedTickets.map(t => {
        const jenisTiket = t.jenistiket || '-';
        let jenisBadge = '';
        if (jenisTiket === 'GAMAS') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#dc2626;color:white;">GAMAS</span>';
        } else if (jenisTiket === 'PSB') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#10b981;color:white;">PSB</span>';
        } else if (jenisTiket === 'PROJECT') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#8b5cf6;color:white;">PROJECT</span>';
        } else if (jenisTiket === 'MIGRASI') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#0891b2;color:white;">MIGRASI</span>';
        } else if (jenisTiket === 'LAINNYA') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#8a8a00;color:white;">LAIN-LAIN</span>';
        } else {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#2563eb;color:white;">RETAIL</span>';
        } 
        
        const statusMap = {
            'open': '🔴 OPEN',
            'pending': '⏸ PENDING',
            'close': '✅ CLOSE'
        };

        let ttrDisplay = '-';
        let isOverdue = false;
        if (t.status === 'open') {
            const now = new Date();
            const createdAt = new Date(t.createdAt);
            const elapsedMs = now.getTime() - createdAt.getTime();
            const elapsedMinutes = elapsedMs / 60000;
            const remainingMinutes = t.duration - elapsedMinutes;
            if (remainingMinutes <= 0) {
                isOverdue = true;
                ttrDisplay = `<span class="live-timer overdue" style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">🔴 +${formatDur(Math.abs(remainingMinutes))}</span>`;
            } else {
                ttrDisplay = `<span class="live-timer" style="background:#dcfce7;color:#166534;padding:2px 12px;border-radius:6px;font-weight:600;">⏳ ${formatDur(remainingMinutes)}</span>`;
            }
        } else if (t.status === 'close') {
            const diff = (t.ttr || 0) - t.duration;
            if (diff > 0) {
                isOverdue = true;
                ttrDisplay = `<span style="color:#dc2626;font-weight:700;">+${formatDur(diff)}</span>`;
            } else if (diff < 0) {
                ttrDisplay = `<span style="color:#166534;font-weight:600;">-${formatDur(Math.abs(diff))}</span>`;
            } else {
                ttrDisplay = `<span style="color:#059669;font-weight:600;">00:00:00</span>`;
            }
        } else if (t.status === 'pending') {
            ttrDisplay = `<span style="color:#6b7280;">⏸ pending</span>`;
        }
        
       
 // ✅ AMBIL DATA ODP
        const odpPelanggan = t.odppelanggan || '-';
        
        return `
        <tr style="cursor:pointer;" onclick="goToTicket('${t.id}')" title="Klik untuk lihat detail tiket">
            <td>${formatDate(t.createdAt)}</td>
            <td>
                <span class="badge-status ${t.status}">${statusMap[t.status] || t.status}</span>
                ${isOverdue ? ' <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#dc2626;animation:blink 1s infinite;margin-left:6px;vertical-align:middle;"></span>' : ''}
            </td>
            <td>${jenisBadge}</td>
            <td style="color:#000000; font-weight:400;">${t.ticketid}</td>
            <td>${t.customer}</td>
            <td>${odpPelanggan}</td>   <!-- ✅ KOLOM ODP BARU -->
            <td>${t.jenistiket === 'PSB' ? '-' : (t.jenisgangguan || '-')}</td>
            <td class="dash-ttr-cell" data-ticket-id="${t.id}">${ttrDisplay}</td>
            <td>${(t.technicians || []).join(', ') || '-'}</td>
        </tr>
    `;
    }).join('');
}

    
    // ===== PANGGIL CHART DENGAN DATA FILTER =====
    renderDashboardCharts(filteredTickets);
    
    // ===== GRAFIK HARIAN =====
    renderGrafikHarian(filteredTickets);
    renderGrafikPsbDashboard(filteredTickets);
}




        function renderGrafikPsbDashboard() {
            var canvas = document.getElementById('grafikPsbDashboardChart');
            if (!canvas) return;
            var periodeSelect = document.getElementById('grafikPsbPeriodeDashboard');
            var bulanSelect = document.getElementById('grafikPsbBulanDashboard');
            if (!periodeSelect) return;
            var periode = periodeSelect.value;
            var bulanFilter = bulanSelect ? bulanSelect.value : '';
            var now = new Date();
            var start = new Date();
            if (periode === '1bulan') start.setMonth(start.getMonth() - 1);
            else if (periode === '3bulan') start.setMonth(start.getMonth() - 3);
            start.setHours(0, 0, 0, 0);
            var dataTickets = tickets.filter(t => {
        if (!t.createdAt) return false;
        // PASTIKAN JENIS TIKET ADALAH PSB
        var jenisTiket = (t.jenistiket || '').toString().toUpperCase().trim();
        if (jenisTiket !== 'PSB') return false;
        
        var d = new Date(t.createdAt);
        if (isNaN(d.getTime())) return false; // CEK VALIDITAS TANGGAL
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
    var seen = {};
    dataTickets.forEach(t => {
        if (!t.createdAt) return;
        if (seen[t.id]) return; // CEK DUPLIKAT
        seen[t.id] = true;
        var d = new Date(t.createdAt);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        dailyMap[key] = (dailyMap[key] || 0) + 1;
    });
            var labels = [];
            var data = [];
            var currentDate = new Date(start);
            var endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            while (currentDate <= endDate) {
                var key = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(currentDate.getDate()).padStart(2, '0');
                var day = currentDate.getDate();
                var month = currentDate.toLocaleDateString('id-ID', { month: 'short' });
                labels.push(day + ' ' + month);
                data.push(dailyMap[key] || 0);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            if (window.grafikPsbDashboardInstance) {
                window.grafikPsbDashboardInstance.destroy();
                window.grafikPsbDashboardInstance = null;
            }
            var ctx = canvas.getContext('2d');
            var areaGradient = ctx.createLinearGradient(0, 0, 0, 300);
            areaGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
            areaGradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
            areaGradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
            window.grafikPsbDashboardInstance = new Chart(ctx, {
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
                        legend: { display: false },
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
                                    return context.parsed.y + ' PSB';
                                }
                            }
                        }
                    },
                    scales: {
            y: {
                beginAtZero: true,
                min: 0,
                max: function() {
                    var maxVal = Math.max(...data);
                    return maxVal === 0 ? 0.5 : maxVal + 1;
                },
                ticks: {
                    stepSize: function() {
                        var maxVal = Math.max(...data);
                        return maxVal === 0 ? 0.5 : 1;
                    },
                    font: { size: 11, weight: '600' },
                    color: '#64748b',
                    callback: function(value) {
                        return Number.isInteger(value) ? value : '';
                    }
                },
                grid: {
                    color: 'rgba(0,0,0,0.05)',
                    drawBorder: false
                }
            },
                        x: {
                            ticks: { font: { size: 9 }, color: '#64748b', maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 15 },
                            grid: { display: false }
                        }
                    },
                    interaction: { intersect: false, mode: 'index' },
                    animation: { duration: 800, easing: 'easeInOutQuad' }
                }
            });
        }

    function resetGrafikPsbDashboard() {
        var periodeSelect = document.getElementById('grafikPsbPeriodeDashboard');
        var bulanSelect = document.getElementById('grafikPsbBulanDashboard');
        if (periodeSelect) periodeSelect.value = '1bulan';
        if (bulanSelect) bulanSelect.value = '';
        renderGrafikPsbDashboard();
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
        document.getElementById('dashTicketBody').innerHTML = '<tr><td colspan="8"><div class="empty">Belum ada data</div></td></tr>';
        document.getElementById('dashTicketCount').textContent = '0 tiket';
    }

   function renderDashboardCharts(filteredTickets) {
    // ===== CEK APAKAH techs SUDAH ADA =====
    if (!techs || techs.length === 0) {
        console.log('⏳ Techs belum ada, tunggu 500ms...');
        setTimeout(function() {
            renderDashboardCharts(filteredTickets);
        }, 500);
        return;
    }
    // ==========================================
    
    // ===== HITUNG DATA =====
    let gamasFeeder = 0;
    let gamasDist = 0;
    let gamasOdp = 0;
    let projectCount = 0;

    filteredTickets.forEach(t => {
        var jenisTiket = t.jenistiket || '';
        var jenisGangguan = t.jenisgangguan || '';
        
        if (jenisTiket === 'GAMAS') {
            if (jenisGangguan === 'GAMAS FEEDER') {
                gamasFeeder++;
            } else if (jenisGangguan === 'GAMAS DISTRIBUSI') {
                gamasDist++;
            } else if (jenisGangguan === 'GAMAS ODP') {
                gamasOdp++;
            } else {
                gamasFeeder++;
            }
        } else if (jenisTiket === 'PROJECT') {
            projectCount++;
        }
    });

    // UPDATE ANGKA SAJA
    document.getElementById('gamasFeederCount').textContent = gamasFeeder;
    document.getElementById('gamasDistCount').textContent = gamasDist;
    document.getElementById('gamasOdpCount').textContent = gamasOdp;
    document.getElementById('projectCount').textContent = projectCount;

        // ===== HITUNG MIGRASI (JUMLAH PELANGGAN MIGRASI, BUKAN JUMLAH TIKET) =====
    let migrasiCount = 0;
    // Ambil tiket MIGRASI dari filteredTickets
    const migrasiTickets = filteredTickets.filter(t => (t.jenistiket || '') === 'MIGRASI');
    // Hitung pelanggan di tabel pelanggan yang migrasi_ticket_id-nya ada di daftar tiket MIGRASI
    if (migrasiTickets.length > 0 && pelangganData && pelangganData.length > 0) {
        const migrasiTicketIds = migrasiTickets.map(t => t.id);
        migrasiCount = pelangganData.filter(p => 
            p.sumber === 'MIGRASI' && 
            p.migrasi_ticket_id && 
            migrasiTicketIds.includes(p.migrasi_ticket_id)
        ).length;
    }
    document.getElementById('migrasiCount').textContent = migrasiCount;
    
    // ===== CHART PRODUKTIVITAS TEKNISI =====
    console.log('📊 Render produktivitas dengan', techs.length, 'teknisi');
    
    const techMap = {};
    techs.forEach(t => { techMap[t.name] = { total: 0, tepatWaktu: 0 }; });

    tickets.forEach(t => {
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
        .filter(([name, data]) => data.total > 0)
        .sort((a, b) => b[1].total - a[1].total);

    if (window.dashProdChartInstance) {
        window.dashProdChartInstance.destroy();
    }

    const prodContainer = document.getElementById('dashProdChart').parentElement;
    if (prodContainer) {
        prodContainer.style.position = 'relative';
        prodContainer.style.maxHeight = '250px';
        prodContainer.style.overflowY = 'auto';
        prodContainer.style.paddingRight = '4px';
    }

    const canvas2 = document.getElementById('dashProdChart');
    if (canvas2) {
        canvas2.style.maxHeight = '180px';
        canvas2.style.height = Math.min(sortedTech.length * 30, 180) + 'px';
        canvas2.style.width = '100%';

        const ctx2 = canvas2.getContext('2d');
        window.dashProdChartInstance = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: sortedTech.length > 0 ? sortedTech.map(t => t[0]) : ['Belum Ada Data'],
                datasets: [{
                    label: 'Produktivitas (%)',
                    data: sortedTech.length > 0 ? sortedTech.map(([name, data]) => 
                        data.total > 0 ? (data.tepatWaktu / data.total) * 100 : 0
                    ) : [0],
                    backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#dc2626'],
                    borderRadius: 6,
                    barThickness: 16
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.x.toFixed(1) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { 
                            callback: function(value) { return value + '%'; },
                            font: { size: 9 },
                            display: false
                        },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { 
                            font: { size: 9 },
                            maxRotation: 0,
                            display: true
                        },
                        grid: { display: false }
                    }
                },
                layout: {
                    padding: {
                        top: 4,
                        bottom: 4,
                        left: 4,
                        right: 55
                    }
                }
            },
            plugins: [{
                id: 'percentageLabelRight',
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const chartArea = chart.chartArea;
                    chart.data.datasets.forEach(function(dataset, i) {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach(function(element, index) {
                            const data = dataset.data[index];
                            if (data === 0 || data === undefined) return;
                            const x = chartArea.right + 15;
                            const y = element.y + 2;
                            ctx.save();
                            ctx.fillStyle = '#0b1a33';
                            ctx.font = 'bold 10px Inter, sans-serif';
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(data.toFixed(1) + '%', x, y);
                            ctx.restore();
                        });
                    });
                }
            }]
        });
    }

    console.log('📊 GAMAS FEEDER:', gamasFeeder);
    console.log('📊 GAMAS DISTRIBUSI:', gamasDist);
    console.log('📊 GAMAS ODP:', gamasOdp);
    console.log('📊 PROJECT:', projectCount);
}

// ============================================================
// VIEW TIKET DETAIL - MODAL
// ============================================================

function viewTicketDetail(jenis) {
    let filteredTickets = [];
    let title = '';
    
    if (jenis === 'GAMAS FEEDER' || jenis === 'GAMAS DISTRIBUSI' || jenis === 'GAMAS ODP') {
        filteredTickets = tickets.filter(t => {
            return t.jenistiket === 'GAMAS' && t.jenisgangguan === jenis;
        });
        title = '📋 Tiket ' + jenis;

        
    } else if (jenis === 'PROJECT') {
        filteredTickets = tickets.filter(t => {
            return t.jenistiket === 'PROJECT';
        });
        title = '📋 Tiket PROJECT';
          } else if (jenis === 'MIGRASI') {
        // MIGRASI: TAMPILKAN DAFTAR PELANGGAN MIGRASI
        viewMigrasiPelangganDetail();
        return;
    } else {
        filteredTickets = tickets.filter(t => {
            return t.jenisgangguan === jenis;
        });
        title = '📋 Tiket ' + jenis;
    }
    
    document.getElementById('modalTicketTitle').textContent = title;
    document.getElementById('modalJenisTiket').textContent = 'Jenis: ' + jenis;
    document.getElementById('modalTotalTiket').textContent = 'Total: ' + filteredTickets.length + ' tiket';
    
    const body = document.getElementById('modalTicketBody');
    if (filteredTickets.length === 0) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">Tidak ada tiket ' + jenis + '</td></tr>';
    } else {
        body.innerHTML = filteredTickets.map((t, i) => {
            const statusMap = {
                'open': '<span class="badge-status open">🔴 OPEN</span>',
                'close': '<span class="badge-status close">✅ CLOSE</span>',
                'pending': '<span class="badge-status pending">⏸ PENDING</span>'
            };
            const statusLabel = statusMap[t.status] || t.status;
            const techDisplay = (t.technicians || []).join(', ') || '-';
            const keterangan = t.keterangan || '-';
            const odp = t.odppelanggan || '-';
            
            return `<tr>
                <td style="padding:8px 12px;">${i + 1}</td>
                <td style="padding:8px 12px;"><strong>${t.ticketid}</strong></td>
                <td style="padding:8px 12px;">${t.customer}</td>
                <td style="padding:8px 12px;">${odp}</td>
                <td style="padding:8px 12px;">${t.jenisgangguan || '-'}</td>
                <td style="padding:8px 12px;">${techDisplay}</td>
                <td style="padding:8px 12px;">${statusLabel}</td>
                <td style="padding:8px 12px;max-width:150px;word-wrap:break-word;">${keterangan}</td>
            </tr>`;
        }).join('');
    }
    
    document.getElementById('viewTicketModal').style.display = 'flex';
}

// ============================================================
// VIEW DETAIL PELANGGAN MIGRASI (UNTUK CARD DASHBOARD)
// ============================================================
async function viewMigrasiPelangganDetail() {
    // AMBIL FILTER DASHBOARD
    const dateFrom = document.getElementById('dashFilterDate')?.value || '';
    const dateTo = document.getElementById('dashFilterDateTo')?.value || '';
    const jenisFilter = document.getElementById('dashFilterJenis')?.value || 'all';

    // FILTER TIKET MIGRASI
    let migrasiTickets = tickets.filter(t => (t.jenistiket || '') === 'MIGRASI');
    if (dateFrom || dateTo) {
        migrasiTickets = migrasiTickets.filter(t => {
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
        });
    } else {
        const today = new Date().toISOString().split('T')[0];
        migrasiTickets = migrasiTickets.filter(t => {
            const d = new Date(t.createdAt);
            return d.toISOString().split('T')[0] === today;
        });
    }

    // AMBIL PELANGGAN MIGRASI DARI TIKET DI ATAS
    const migrasiTicketIds = migrasiTickets.map(t => t.id);
    
    let pelangganMigrasi = [];
    if (migrasiTicketIds.length > 0) {
        const { data, error } = await sb
            .from('pelanggan')
            .select('*')
            .eq('sumber', 'MIGRASI')
            .in('migrasi_ticket_id', migrasiTicketIds);

        if (!error) pelangganMigrasi = data || [];
    }

    // BUAT HTML
    let html = '';
    if (pelangganMigrasi.length === 0) {
        html = '<div style="text-align:center;padding:30px;color:#94a3b8;">Belum ada data pelanggan migrasi.</div>';
    } else {
        html = `<div style="text-align:left;max-height:400px;overflow-y:auto;font-size:13px;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#0b1a33;color:white;">
                    <th style="padding:8px;text-align:center;width:40px;">No</th>
                    <th style="padding:8px;text-align:left;">Tiket</th>
                    <th style="padding:8px;text-align:left;">ID Pelanggan</th>
                    <th style="padding:8px;text-align:left;">Nama</th>
                    <th style="padding:8px;text-align:left;">ODP</th>
                    <th style="padding:8px;text-align:left;">Teknisi</th>
                </tr></thead><tbody>`;

        pelangganMigrasi.forEach((p, i) => {
            const ticket = migrasiTickets.find(t => t.id === p.migrasi_ticket_id);
            const teknisi = ticket ? (ticket.technicians || []).join(', ') : '-';
            const tiketId = ticket ? (ticket.ticketid || '-') : '-';

            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px;text-align:center;">${i + 1}</td>
                <td style="padding:8px;"><strong>${tiketId}</strong></td>
                <td style="padding:8px;">${p.id_pelanggan || '-'}</td>
                <td style="padding:8px;">${p.nama || '-'}</td>
                <td style="padding:8px;">${p.odp || '-'}</td>
                <td style="padding:8px;">${teknisi}</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
    }

    Swal.fire({
        title: '🔄 Daftar Pelanggan Migrasi',
        html: html,
        icon: 'info',
        width: 800,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#0891b2'
    });
}

function closeViewTicketModal() {
    document.getElementById('viewTicketModal').style.display = 'none';
}





    function renderGrafikHarianWithFilter(filteredTickets) {
        var canvas = document.getElementById('grafikHarianChart');
        if (!canvas) {
            console.log('Canvas tidak ditemukan');
            return;
        }
        
        // DESTROY CHART LAMA
        if (window.grafikHarianInstance) {
            try {
                window.grafikHarianInstance.destroy();
            } catch(e) {}
            window.grafikHarianInstance = null;
        }
        
        // CEK APAKAH DATA VALID
        if (!filteredTickets || filteredTickets.length === 0) {
            console.log('⚠️ Tidak ada data untuk chart, render kosong');
            var ctx = canvas.getContext('2d');
            window.grafikHarianInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Tidak ada data'],
                    datasets: [{
                        label: 'Jumlah Tiket',
                        data: [0],
                        borderColor: '#94a3b8',
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 2,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                        x: { ticks: { font: { size: 9 } } }
                    }
                }
            });
            return;
        }
        
        // SET UKURAN CANVAS
        var container = canvas.parentElement;
        var containerWidth = container ? container.clientWidth : 800;
        canvas.width = containerWidth || 800;
        canvas.height = 300;
        canvas.style.width = '100%';
        canvas.style.height = '300px';
        
        var periodeSelect = document.getElementById('grafikPeriode');
        var bulanSelect = document.getElementById('grafikBulan');
        var periode = periodeSelect ? periodeSelect.value : '1bulan';
        var bulanFilter = bulanSelect ? bulanSelect.value : '';
        
        var now = new Date();
        var start = new Date();
        if (periode === '1bulan') start.setMonth(start.getMonth() - 1);
        else if (periode === '3bulan') start.setMonth(start.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        
        var dataTickets = filteredTickets.filter(t => {
            if (!t.createdAt) return false;
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
        var currentDate = new Date(start);
        var endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        
        while (currentDate <= endDate) {
            var key = currentDate.toISOString().split('T')[0];
            var day = currentDate.getDate();
            var month = currentDate.toLocaleDateString('id-ID', { month: 'short' });
            labels.push(day + ' ' + month);
            data.push(dailyMap[key] || 0);
            currentDate.setDate(currentDate.getDate() + 1);
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
    if (!pelangganData || pelangganData.length === 0) {
        const { data } = await sb.from('pelanggan').select('*');
        pelangganData = data || [];
    }

    const body = document.getElementById('psbBody');
    const count = document.getElementById('psbCount');

    const dateFrom = document.getElementById('psbFilterDate').value;
    const dateTo = document.getElementById('psbFilterDateTo').value;
    const idFilter = document.getElementById('psbFilterId').value.trim().toLowerCase();
    const custFilter = document.getElementById('psbFilterCustomer').value.trim().toLowerCase();

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

    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('psbTotal').textContent = data.length;
    document.getElementById('psbOpen').textContent = data.filter(t => t.status === 'open').length;
    document.getElementById('psbClosed').textContent = data.filter(t => t.status === 'close').length;

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / psbItemsPerPage) || 1;
    if (psbCurrentPage < 1) psbCurrentPage = 1;
    if (psbCurrentPage > totalPages) psbCurrentPage = totalPages;

    const start = (psbCurrentPage - 1) * psbItemsPerPage;
    const end = Math.min(start + psbItemsPerPage, totalItems);
    const pageData = data.slice(start, end);

    count.textContent = totalItems + ' tiket (Halaman ' + psbCurrentPage + '/' + totalPages + ')';

    if (totalItems === 0) {
        body.innerHTML = '<tr><td colspan="13"><div class="empty">Belum ada data PSB</div></td></tr>';
        document.getElementById('psbPagination').innerHTML = '';
        return;
    }

    body.innerHTML = pageData.map(t => {
        const status = t.status || 'open';
        const isClosed = status === 'close';
        const isOpen = status === 'open';
        const isPending = status === 'pending';

        let statusClass = 'open';
        let statusLabel = '🔴 OPEN';
        if (isClosed) { statusClass = 'close'; statusLabel = '✅ CLOSE'; }
        else if (isPending) { statusClass = 'pending'; statusLabel = '⏸ PENDING'; }

        const techDisplay = t.technicians && Array.isArray(t.technicians) ?
            t.technicians.map(n => `<span class="tech-badge">${n}</span>`).join(' ') : '-';
        const odpPelanggan = t.odppelanggan || '-';
        const wilayahPelanggan = t.wilayahpelanggan || '-';

        const mapTag = (val) => {
            if (val && val !== '-' && String(val).trim() !== '') {
                return `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:#2563eb;color:white;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap;"><i class="fas fa-map-marker-alt"></i> View</a>`;
            }
            return '<span style="color:#94a3b8;">-</span>';
        };

        const fotoLink = (val) => {
            if (val && val !== '-' && String(val).trim() !== '') {
                return `<a href="${val}" target="_blank" style="color:#2563eb;"><i class="fas fa-image"></i> Lihat</a>`;
            }
            return '<span style="color:#94a3b8;">-</span>';
        };

        return `
        <tr data-ticket-id="${t.id}" onclick="goToTicket('${t.id}')" style="cursor:pointer;">
            <td>${formatDate(t.createdAt)}</td>
            <td>${getJenisTiketBadge(t)}</td>
            <td style="color:#000000; font-weight:400;">${t.ticketid}</td>
            <td>${t.customer}</td>
            <td>${t.no_tlp || '-'}</td>
            <td>${odpPelanggan}</td>
            <td>${wilayahPelanggan}</td>
            <td>${mapTag(t.taging_lokasi)}</td>
            <td>${mapTag(t.taging_odp)}</td>
            <td>${fotoLink(t.foto_rumah)}</td>
            <td>${fotoLink(t.foto_ktp)}</td>
            <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                    ${techDisplay}
                    ${!isClosed ? `
                        <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editTicketTech('${t.id}'); return false;" style="padding:2px 6px;font-size:12px;"><i class="fas fa-exchange-alt" style="color:#2563eb;"></i></button>
                        <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); addTicketTech('${t.id}'); return false;" style="padding:2px 6px;font-size:12px;"><i class="fas fa-plus-circle" style="color:#16a34a;"></i></button>
                    ` : ''}
                </div>
            </td>
            <td class="status-cell">
                <span class="badge-status ${statusClass}">${statusLabel}</span>
            </td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">
                ${isOpen ? `<button type="button" class="btn btn-success btn-sm" onclick="event.stopPropagation(); closeticket('${t.id}'); return false;">Close</button>` : ''}
                ${isClosed ? `<button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editcloseticket('${t.id}'); return false;" title="Edit Waktu Close"><i class="fas fa-clock"></i></button>` : ''}
            </td>
        </tr>
        `;
    }).join('');

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

    function sortPelanggan(field) {
    if (pelSortBy === field) {
        pelSortDir = pelSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        pelSortBy = field;
        pelSortDir = 'asc';
    }
    pelangganCurrentPage = 1; // ✅ RESET PAGE SAAT SORTING
    updateSortIcons();
    renderPelanggan();
}

function updateSortIcons() {
    const iconTgl = document.getElementById('sortIconTanggal');
    const iconOdp = document.getElementById('sortIconOdp');

    if (iconTgl) iconTgl.textContent = pelSortBy === 'tanggal' ? (pelSortDir === 'asc' ? '▲' : '▼') : '⇅';
    if (iconOdp) iconOdp.textContent = pelSortBy === 'odp' ? (pelSortDir === 'asc' ? '▲' : '▼') : '⇅';

    if (iconTgl) iconTgl.style.color = pelSortBy === 'tanggal' ? '#2563eb' : '#94a3b8';
    if (iconOdp) iconOdp.style.color = pelSortBy === 'odp' ? '#2563eb' : '#94a3b8';
}

// ===== PELANGGAN =====
let pelSortBy = 'tanggal';   // 'tanggal' | 'odp'
let pelSortDir = 'desc';     // 'asc' | 'desc'
let pelangganData = [];
let pelangganCurrentPage = 1;        // ✅ TAMBAHKAN
const pelangganItemsPerPage = 10;     // ✅ TAMBAHKAN

async function renderPelanggan() {
    const body = document.getElementById('pelangganBody');
    try {
        const sumberFilter = document.getElementById('pelFilterSumber')?.value || 'all';
        
        const dateFrom = document.getElementById('pelFilterDate')?.value || '';
        const dateTo = document.getElementById('pelFilterDateTo')?.value || '';
        const searchQuery = (document.getElementById('pelFilterSearch')?.value || '').trim().toLowerCase(); // ✅ TAMBAHKAN

        const { data, error } = await sb
            .from('pelanggan')
            .select('*')
            
        
        if (error) {
            console.error('❌ Error fetch pelanggan:', error);
            body.innerHTML = '<tr><td colspan="12"><div class="empty">Gagal load data pelanggan</div></td></tr>';
            return;
        }
        
        let list = data || [];
        console.log('📊 Total pelanggan dari DB:', list.length);
        console.log('📊 Filter sumber:', sumberFilter, '| dateFrom:', dateFrom, '| dateTo:', dateTo);

        if (sumberFilter !== 'all') {
            list = list.filter(p => (p.sumber || '') === sumberFilter);
            console.log('📊 Setelah filter sumber:', list.length);
        }

        if (dateFrom || dateTo) {
            list = list.filter(p => {
                const tgl = p.tanggal_pasang || '';
                if (!tgl || tgl === '-') return true;
                let tglStr = String(tgl).slice(0, 10);
                if (/^\d{2}-\d{2}-\d{4}$/.test(tglStr)) {
                    const [d, m, y] = tglStr.split('-');
                    tglStr = y + '-' + m + '-' + d;
                }
                if (dateFrom && tglStr < dateFrom) return false;
                if (dateTo && tglStr > dateTo) return false;
                return true;
            });
            console.log('📊 Setelah filter tanggal:', list.length);
        }

        // ✅ TAMBAHKAN FILTER SEARCH
        if (searchQuery) {
            list = list.filter(p => {
                const ticketId = (p.ticket_id || '').toLowerCase();
                const idPelanggan = (p.id_pelanggan || '').toLowerCase();
                const nama = (p.nama || '').toLowerCase();
                const odp = (p.odp || '').toLowerCase();
                const noHp = (p.no_hp || '').toLowerCase();
                const alamat = (p.alamat || '').toLowerCase();
                const tagingLokasi = (p.taging_lokasi || '').toLowerCase();
                const tagingOdp = (p.taging_odp || '').toLowerCase();

                return ticketId.includes(searchQuery) ||
                       idPelanggan.includes(searchQuery) ||
                       nama.includes(searchQuery) ||
                       odp.includes(searchQuery) ||
                       noHp.includes(searchQuery) ||
                       alamat.includes(searchQuery) ||
                       tagingLokasi.includes(searchQuery) ||
                       tagingOdp.includes(searchQuery);
            });
            console.log('📊 Setelah filter search:', list.length);
        }

        // ===== SORTING =====
const sortDir = pelSortDir === 'asc' ? 1 : -1;
list.sort((a, b) => {
    let valA, valB;

    if (pelSortBy === 'tanggal') {
        // PARSE TANGGAL KE TIMESTAMP
        const parseTgl = (tgl) => {
            if (!tgl || tgl === '-') return 0;
            const s = String(tgl);
            if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
                const [d, m, y] = s.split(/[-\s]/);
                return new Date(y, m - 1, d).getTime() || 0;
            }
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                return new Date(s).getTime() || 0;
            }
            return 0;
        };
        valA = parseTgl(a.tanggal_pasang);
        valB = parseTgl(b.tanggal_pasang);
    } else {
        // SORT ODP (STRING)
        valA = (a.odp || '').toString().toLowerCase();
        valB = (b.odp || '').toString().toLowerCase();
        return valA.localeCompare(valB) * sortDir;
    }

    return (valA - valB) * sortDir;
});

        pelangganData = list;

// ✅ SIMPAN CACHE UNTUK SEARCH GLOBAL
try {
    localStorage.setItem('pelanggan_cache', JSON.stringify(list));
    localStorage.setItem('pelanggan_cache_time', String(Date.now()));
} catch(e) { console.warn('Gagal cache pelanggan:', e); }
        
        if (list.length === 0) {
            body.innerHTML = '<tr><td colspan="14"><div class="empty">Belum ada data pelanggan</div></td></tr>';
            const pag = document.getElementById('pelangganPagination');
            if (pag) pag.innerHTML = '';
            return;
        }

        // ✅ PAGINATION
        const totalItems = list.length;
        const totalPages = Math.ceil(totalItems / pelangganItemsPerPage) || 1;
        if (pelangganCurrentPage < 1) pelangganCurrentPage = 1;
        if (pelangganCurrentPage > totalPages) pelangganCurrentPage = totalPages;

        const startIdx = (pelangganCurrentPage - 1) * pelangganItemsPerPage;
        const endIdx = Math.min(startIdx + pelangganItemsPerPage, totalItems);
        const pageList = list.slice(startIdx, endIdx);

        body.innerHTML = pageList.map(p => {
            const fotoRumahKosong = !p.foto_depan || p.foto_depan === '-' || p.foto_depan === '';
            const fotoKtpKosong = !p.foto_ktp || p.foto_ktp === '-' || p.foto_ktp === '';
            const noHpKosong = !p.no_hp || p.no_hp === '-' || p.no_hp === '';
            const alamatKosong = !p.alamat || p.alamat === '-' || p.alamat === '';
            const tagingKosong = !p.taging_lokasi || p.taging_lokasi === '-' || p.taging_lokasi === '';
            const odpKosong = !p.odp || p.odp === '-' || p.odp === '';
            const tglKosong = !p.tanggal_pasang || p.tanggal_pasang === '-' || p.tanggal_pasang === '';
            
            const adaDataKosong = fotoRumahKosong || fotoKtpKosong || noHpKosong || alamatKosong || tagingKosong || odpKosong || tglKosong;
            
            const borderStyle = adaDataKosong ? 'border-left: 4px solid #dc2626; background: #fef2f2;' : '';
            const warningIcon = adaDataKosong ? ' 🔴' : '';
            
            let fotoRumahDisplay = '<span style="color:#dc2626;font-weight:700;"><i class="fas fa-exclamation-circle"></i> Belum</span>';
            if (!fotoRumahKosong) {
                fotoRumahDisplay = `<a href="${p.foto_depan}" target="_blank" style="color:#2563eb;"><i class="fas fa-image"></i> Lihat</a>`;
            }
            
            let fotoKtpDisplay = '<span style="color:#dc2626;font-weight:700;"><i class="fas fa-exclamation-circle"></i> Belum</span>';
            if (!fotoKtpKosong) {
                fotoKtpDisplay = `<a href="${p.foto_ktp}" target="_blank" style="color:#2563eb;"><i class="fas fa-image"></i> Lihat</a>`;
            }
            
            // TAGGING LOKASI - TOMBOL VIEW
            let tagingDisplay = '<span style="color:#94a3b8;">-</span>';
            if (p.taging_lokasi && p.taging_lokasi !== '-' && p.taging_lokasi.trim() !== '') {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.taging_lokasi)}`;
                tagingDisplay = `<a href="${mapUrl}" target="_blank" 
                    style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:#2563eb;color:white;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap;">
                    <i class="fas fa-map-marker-alt"></i> View
                </a>`;
            }

            // TAGGING ODP - TOMBOL VIEW
            let tagingOdpDisplay = '<span style="color:#94a3b8;">-</span>';
            if (p.taging_odp && p.taging_odp !== '-' && p.taging_odp.trim() !== '') {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.taging_odp)}`;
                tagingOdpDisplay = `<a href="${mapUrl}" target="_blank" 
                    style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:#f59e0b;color:white;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap;">
                    <i class="fas fa-map-marker-alt"></i> View
                </a>`;
            }

            const wilayahPelanggan = p.wilayah || p.wilayah_pelanggan || '-';
            
            const sumber = p.sumber || '-';
            let sumberBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#94a3b8;color:white;">-</span>';
            if (sumber === 'MIGRASI') {
                sumberBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#0891b2;color:white;">MIGRASI</span>';
            } else if (sumber === 'PSB') {
                sumberBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#10b981;color:white;">PSB</span>';
            }

            return `
            <tr style="${borderStyle}">
                <td>
                    ${p.ticket_id && p.ticket_id !== '-' 
                        ? `<span style="color:#000000;font-weight:400;">${p.ticket_id}</span>` 
                        : '<span style="color:#94a3b8;">-</span>'}
                </td>
                <td>${formatTanggalDDMMYYYY(p.tanggal_pasang)}</td>
                <td>${sumberBadge}</td>
                <td><strong>${p.id_pelanggan || '-'} ${warningIcon}</strong></td>
                <td>${p.nama || '-'}</td>
                <td>${p.no_hp || '-'}</td>
                <td>${p.alamat || '-'}</td>
                <td>${tagingDisplay}</td>
                <td>${tagingOdpDisplay}</td>
                <td>${p.odp || '-'}</td>
                <td>${wilayahPelanggan}</td>
                <td>${fotoRumahDisplay}</td>
                <td>${fotoKtpDisplay}</td>
                
                <td style="white-space:nowrap;">
                    <button class="btn btn-primary btn-sm" onclick="openEditPelangganModal('${p.id}')" title="Edit Pelanggan">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletePelanggan('${p.id}')" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
                        </tr>
        `}).join('');

        // ✅ RENDER PAGINATION
        renderPelangganPagination(totalItems, totalPages, startIdx, endIdx);

    } catch(e) {
        console.error('Error render pelanggan:', e);
        body.innerHTML = '<tr><td colspan="14"><div class="empty">Gagal load data</div></td></tr>';
    }
}

// ✅ FUNGSI PAGINATION PELANGGAN
function renderPelangganPagination(totalItems, totalPages, startIdx, endIdx) {
    const container = document.getElementById('pelangganPagination');
    if (!container) return;

    if (totalItems <= pelangganItemsPerPage) {
        container.innerHTML = '';
        return;
    }

    let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';

    // PREV
    if (pelangganCurrentPage > 1) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPelangganPage(${pelangganCurrentPage - 1})">◀ Prev</button>`;
    } else {
        html += `<button class="btn btn-outline btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">◀ Prev</button>`;
    }

    // NOMOR HALAMAN
    const maxVisible = 5;
    let startPage = Math.max(1, pelangganCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPelangganPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding:0 4px;color:#94a3b8;">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === pelangganCurrentPage) {
            html += `<button class="btn btn-primary btn-sm" style="background:#2563eb;color:white;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;">${i}</button>`;
        } else {
            html += `<button class="btn btn-outline btn-sm" onclick="goToPelangganPage(${i})" style="background:transparent;border:1px solid #cbd5e1;border-radius:6px;padding:4px 12px;cursor:pointer;">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding:0 4px;color:#94a3b8;">...</span>`;
        html += `<button class="btn btn-outline btn-sm" onclick="goToPelangganPage(${totalPages})">${totalPages}</button>`;
    }

    // NEXT
    if (pelangganCurrentPage < totalPages) {
        html += `<button class="btn btn-outline btn-sm" onclick="goToPelangganPage(${pelangganCurrentPage + 1})">Next ▶</button>`;
    } else {
        html += `<button class="btn btn-outline btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">Next ▶</button>`;
    }

    html += '</div>';

    // INFO
    html += `<span style="font-size:13px;color:#64748b;">Menampilkan ${startIdx + 1}-${endIdx} dari ${totalItems}</span>`;

    container.innerHTML = html;
}

// ✅ FUNGSI GO TO PAGE PELANGGAN
function goToPelangganPage(page) {
    pelangganCurrentPage = page;
    renderPelanggan();
    // SCROLL KE ATAS TABEL
    const section = document.getElementById('pelangganSection');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetPelangganFilter() {
    const s = document.getElementById('pelFilterSumber');
    const d1 = document.getElementById('pelFilterDate');
    const d2 = document.getElementById('pelFilterDateTo');
    const search = document.getElementById('pelFilterSearch');
    if (s) s.value = 'all';
    if (d1) d1.value = '';
    if (d2) d2.value = '';
    if (search) search.value = '';
    pelSortBy = 'tanggal';
    pelSortDir = 'desc';
    pelangganCurrentPage = 1; // ✅ RESET PAGE
    updateSortIcons();
    renderPelanggan();
}

// ============================================================
// FILTER TIM - CEK APAKAH SEMUA TEKNISI DI TIKET TERMASUK TIM TERTENTU
// ============================================================
function isTimMatch(ticket, timFilter) {
    if (timFilter === 'all') return true;

    // Ambil daftar teknisi di tiket
    const techsInTicket = ticket.technicians || [];
    if (techsInTicket.length === 0) return false;

    // Cek posisi setiap teknisi
    for (let i = 0; i < techsInTicket.length; i++) {
        const techName = techsInTicket[i];
        const techData = techs.find(t => t.name === techName);
        if (!techData) return false;
        const posisi = techData.posisi || 'PSB/GGN';
        if (posisi !== timFilter) return false;
    }
    return true;
}

async function openPelangganDataModal(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
        Swal.fire('Error', 'Tiket tidak ditemukan!', 'error');
        return;
    }

    const kodePelanggan = ticket.kodePelanggan || '';
    const customerName = ticket.customer || '';

    // CARI DATA PELANGGAN
    let pelanggan = null;
    if (kodePelanggan && kodePelanggan !== '-') {
        const { data, error } = await sb
            .from('pelanggan')
            .select('*')
            .eq('id_pelanggan', kodePelanggan)
            .maybeSingle();
        if (!error && data) pelanggan = data;
    }
    if (!pelanggan && customerName) {
        const { data, error } = await sb
            .from('pelanggan')
            .select('*')
            .eq('nama', customerName)
            .maybeSingle();
        if (!error && data) pelanggan = data;
    }

    // NILAI DEFAULT
    const valNoHp = pelanggan && pelanggan.no_hp ? pelanggan.no_hp : '';
    const valTaggingPelanggan = pelanggan && pelanggan.taging_lokasi && pelanggan.taging_lokasi !== '-' ? pelanggan.taging_lokasi : '';
    const valTaggingOdp = pelanggan && pelanggan.taging_odp && pelanggan.taging_odp !== '-' ? pelanggan.taging_odp : (ticket.odppelanggan || '');
    const valFotoRumah = pelanggan && pelanggan.foto_depan && pelanggan.foto_depan !== '-' ? pelanggan.foto_depan : '';
    const valFotoKtp = pelanggan && pelanggan.foto_ktp && pelanggan.foto_ktp !== '-' ? pelanggan.foto_ktp : '';

    let fotoRumahPreview = '';
    if (valFotoRumah) {
        fotoRumahPreview = `<img src="${valFotoRumah}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:8px;border:1px solid #e2e8f0;">`;
    }

    let fotoKtpPreview = '';
    if (valFotoKtp) {
        fotoKtpPreview = `<img src="${valFotoKtp}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:8px;border:1px solid #e2e8f0;">`;
    }

    const result = await Swal.fire({
        title: '📝 Data Pelanggan',
        width: 600,
        html: `
            <div style="text-align:left;font-size:14px;padding:4px 0;">
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:13px;">
                    <div><strong>Nama:</strong> ${customerName || '-'}</div>
                    <div><strong>ID Pelanggan:</strong> ${kodePelanggan || '-'}</div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">No Tlp</label>
                    <input id="swalNoHp" type="text" value="${valNoHp}" placeholder="08123456789"
                        oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Tagging Pelanggan (Koordinat)</label>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input id="swalTaggingPelanggan" type="text" value="${valTaggingPelanggan}" placeholder="-6.123456, 106.123456"
                            style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                        <a id="swalLinkPelanggan" href="${valTaggingPelanggan ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(valTaggingPelanggan) : '#'}"
                        target="_blank"
                        style="display:${valTaggingPelanggan ? 'inline-flex' : 'none'};align-items:center;gap:4px;padding:10px 14px;background:#2563eb;color:white;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;white-space:nowrap;">
                            <i class="fas fa-map-marker-alt"></i> Buka Maps
                        </a>
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Tagging ODP (Koordinat)</label>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input id="swalTaggingOdp" type="text" value="${valTaggingOdp}" placeholder="-6.123456, 106.123456"
                            style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                        <a id="swalLinkOdp" href="${valTaggingOdp ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(valTaggingOdp) : '#'}"
                        target="_blank"
                        style="display:${valTaggingOdp ? 'inline-flex' : 'none'};align-items:center;gap:4px;padding:10px 14px;background:#2563eb;color:white;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;white-space:nowrap;">
                            <i class="fas fa-map-marker-alt"></i> Buka Maps
                        </a>
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto Rumah</label>
                    <div id="swalFotoRumahPreview">${fotoRumahPreview}</div>
                    <input id="swalFotoRumah" type="file" accept="image/*" style="display:none;">
                    <button type="button" id="swalBtnGantiRumah"
                        style="margin-top:8px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <i class="fas fa-sync-alt"></i> ${valFotoRumah ? 'Ganti Foto' : 'Upload Foto'}
                    </button>
                </div>

                <div style="margin-bottom:6px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto KTP</label>
                    <div id="swalFotoKtpPreview">${fotoKtpPreview}</div>
                    <input id="swalFotoKtp" type="file" accept="image/*" style="display:none;">
                    <button type="button" id="swalBtnGantiKtp"
                        style="margin-top:8px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <i class="fas fa-sync-alt"></i> ${valFotoKtp ? 'Ganti Foto' : 'Upload Foto'}
                    </button>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        didOpen: () => {
            const inputRumah = document.getElementById('swalFotoRumah');
            if (inputRumah) {
                inputRumah.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('swalFotoRumahPreview').innerHTML =
                                `<img src="${e.target.result}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:8px;border:1px solid #e2e8f0;">`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
            const btnRumah = document.getElementById('swalBtnGantiRumah');
            const inputRumahEl = document.getElementById('swalFotoRumah');
            if (btnRumah && inputRumahEl) {
                btnRumah.addEventListener('click', () => inputRumahEl.click());
            }

            const btnKtp = document.getElementById('swalBtnGantiKtp');
            const inputKtpEl = document.getElementById('swalFotoKtp');
            if (btnKtp && inputKtpEl) {
                btnKtp.addEventListener('click', () => inputKtpEl.click());
            }

            const inputKtp = document.getElementById('swalFotoKtp');
            if (inputKtp) {
                inputKtp.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('swalFotoKtpPreview').innerHTML =
                                `<img src="${e.target.result}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:8px;border:1px solid #e2e8f0;">`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            const inputTagPelanggan = document.getElementById('swalTaggingPelanggan');
            const linkPelanggan = document.getElementById('swalLinkPelanggan');
            if (inputTagPelanggan && linkPelanggan) {
                inputTagPelanggan.addEventListener('input', function() {
                    const val = this.value.trim();
                    if (val) {
                        linkPelanggan.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(val);
                        linkPelanggan.style.display = 'inline-flex';
                    } else {
                        linkPelanggan.style.display = 'none';
                    }
                });
            }

            const inputTagOdp = document.getElementById('swalTaggingOdp');
            const linkOdp = document.getElementById('swalLinkOdp');
            if (inputTagOdp && linkOdp) {
                inputTagOdp.addEventListener('input', function() {
                    const val = this.value.trim();
                    if (val) {
                        linkOdp.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(val);
                        linkOdp.style.display = 'inline-flex';
                    } else {
                        linkOdp.style.display = 'none';
                    }
                });
            }
        },
        preConfirm: async () => {
            const noHp = document.getElementById('swalNoHp').value.trim();
            const taggingPelanggan = document.getElementById('swalTaggingPelanggan').value.trim();
            const taggingOdp = document.getElementById('swalTaggingOdp').value.trim();
            const fotoRumahFile = document.getElementById('swalFotoRumah').files[0];
            const fotoKtpFile = document.getElementById('swalFotoKtp').files[0];

            let fotoRumahUrl = valFotoRumah;
            if (fotoRumahFile) {
                const compressed = await compressImage(fotoRumahFile, 1280, 0.7);
                const fileName = 'foto_depan_' + Date.now() + '_' + compressed.name;
                const { error: uploadErr } = await sb.storage
                    .from('pelanggan-foto')
                    .upload(fileName, compressed);
                if (uploadErr) {
                    Swal.showValidationMessage('Gagal upload foto rumah: ' + uploadErr.message);
                    return false;
                }
                const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
                fotoRumahUrl = urlData.publicUrl;
            }

            let fotoKtpUrl = valFotoKtp;
            if (fotoKtpFile) {
                const compressed = await compressImage(fotoKtpFile, 1280, 0.7);
                const fileName = 'foto_ktp_' + Date.now() + '_' + compressed.name;
                const { error: uploadErr } = await sb.storage
                    .from('pelanggan-foto')
                    .upload(fileName, compressed);
                if (uploadErr) {
                    Swal.showValidationMessage('Gagal upload foto KTP: ' + uploadErr.message);
                    return false;
                }
                const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
                fotoKtpUrl = urlData.publicUrl;
            }

            return {
                noHp,
                taggingPelanggan,
                taggingOdp,
                fotoRumahUrl,
                fotoKtpUrl
            };
        }
    });

    if (!result.isConfirmed) return;

    const payload = result.value;

    // HITUNG TANGGAL PASANG DARI TIKET
    let tanggalPasang = '-';
if (ticket.createdAt) {
    const d = new Date(ticket.createdAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    tanggalPasang = dd + '-' + mm + '-' + yyyy;
}

    try {
        if (pelanggan) {
            // UPDATE PELANGGAN YANG SUDAH ADA
            const updateData = {
                no_hp: payload.noHp || '-',
                taging_lokasi: payload.taggingPelanggan || '-',
                taging_odp: payload.taggingOdp || '-',
                odp: payload.taggingOdp || '-',
                foto_depan: payload.fotoRumahUrl || '-',
                foto_ktp: payload.fotoKtpUrl || '-',
                sumber: ticket.jenistiket || pelanggan.sumber || 'PSB'
            };

            // ISI TANGGAL PASANG KALAU MASIH KOSONG
            if (!pelanggan.tanggal_pasang || pelanggan.tanggal_pasang === '-' || pelanggan.tanggal_pasang === '') {
                updateData.tanggal_pasang = tanggalPasang;
            }

            const { error } = await sb
                .from('pelanggan')
                .update(updateData)
                .eq('id', pelanggan.id);

            if (error) throw error;
            notif('✅ Data pelanggan diupdate!', 'success');
        } else {
            // INSERT PELANGGAN BARU
            const { error } = await sb
                .from('pelanggan')
                .insert({
                    id_pelanggan: kodePelanggan || '-',
                    nama: customerName || '-',
                    no_hp: payload.noHp || '-',
                    alamat: '-',
                    taging_lokasi: payload.taggingPelanggan || '-',
                    taging_odp: payload.taggingOdp || '-',
                    odp: payload.taggingOdp || '-',
                    foto_depan: payload.fotoRumahUrl || '-',
                    foto_ktp: payload.fotoKtpUrl || '-',
                    tanggal_pasang: tanggalPasang,
                    sumber: ticket.jenistiket || 'PSB'
                });

            if (error) throw error;
            notif('✅ Data pelanggan ditambahkan!', 'success');
        }

        // REFRESH
        const { data: freshPel } = await sb.from('pelanggan').select('*');
        pelangganData = freshPel || [];

        renderPsb();
        if (typeof renderPelanggan === 'function') renderPelanggan();

    } catch (e) {
        console.error('Error save pelanggan:', e);
        Swal.fire('Error', 'Gagal simpan: ' + e.message, 'error');
    }
}

async function addPelanggan() {
    const id = document.getElementById('pelId').value.trim();
    const nama = document.getElementById('pelNama').value.trim();
    const noHp = document.getElementById('pelNoHp').value.trim();
    const alamat = document.getElementById('pelAlamat').value.trim();
    const tagingLokasi = document.getElementById('pelTagingLokasi').value.trim();
    const odp = document.getElementById('pelOdp').value.trim();
    const tanggalPasang = document.getElementById('pelTanggalPasang').value;
    const fotoDepanInput = document.getElementById('pelFotoDepan');
    const fotoKtpInput = document.getElementById('pelFotoKtp');
    
      // VALIDASI NAMA
    if (!nama) {
        Swal.fire('Error', 'Nama pelanggan wajib diisi!', 'error');
        return;
    }
    
    // VALIDASI NOMER HP HARUS ANGKA
    if (noHp && !/^[0-9]+$/.test(noHp)) {
        Swal.fire('Error', 'Nomer HP harus berupa angka!', 'error');
        return;
    }
    
    // CEK HANYA ANGKA
    const hpRegex = /^[0-9]+$/;
    if (!hpRegex.test(noHp)) {
        Swal.fire('Peringatan', 'No HP hanya boleh angka!', 'warning');
        return;
    }
    
    if (noHp.length < 12) {
        Swal.fire('Peringatan', 'No HP minimal 12 digit!', 'warning');
        return;
    }
    
    // CEK DUPLIKAT NO HP
    const { data: existingData, error: checkError } = await sb
        .from('pelanggan')
        .select('no_hp')
        .eq('no_hp', noHp);
    
    if (checkError) {
        console.error('Error check duplicate:', checkError);
    }
    
    if (existingData && existingData.length > 0) {
        Swal.fire('Peringatan', 'No HP ' + noHp + ' sudah terdaftar!', 'warning');
        return;
    }
    
        let fotoDepanUrl = '-';
    let fotoKtpUrl = '-';
    
    // UPLOAD FOTO DEPAN
    if (fotoDepanInput.files && fotoDepanInput.files.length > 0) {
        let file = fotoDepanInput.files[0];
        file = await compressImage(file, 1280, 0.7);
        const fileName = 'foto_depan_' + Date.now() + '_' + file.name;
        const { data: uploadData, error: uploadError } = await sb
            .storage
            .from('pelanggan-foto')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('Upload foto depan error:', uploadError);
            Swal.fire('Peringatan', 'Gagal upload foto: ' + uploadError.message, 'warning');
            return;
        } else {
            const { data: urlData } = sb
                .storage
                .from('pelanggan-foto')
                .getPublicUrl(fileName);
            fotoDepanUrl = urlData.publicUrl;
        }
    }
    
    // UPLOAD FOTO KTP
    if (fotoKtpInput.files && fotoKtpInput.files.length > 0) {
        let file = fotoKtpInput.files[0];
        file = await compressImage(file, 1280, 0.7);
        const fileName = 'foto_ktp_' + Date.now() + '_' + file.name;
        const { data: uploadData, error: uploadError } = await sb
            .storage
            .from('pelanggan-foto')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('Upload foto KTP error:', uploadError);
            Swal.fire('Peringatan', 'Gagal upload foto: ' + uploadError.message, 'warning');
            return;
        } else {
            const { data: urlData } = sb
                .storage
                .from('pelanggan-foto')
                .getPublicUrl(fileName);
            fotoKtpUrl = urlData.publicUrl;
        }
    }
    
    try {
        const { error } = await sb
            .from('pelanggan')
            .insert({
                id_pelanggan: id || '-',
                nama: nama,
                no_hp: noHp,
                alamat: alamat || '-',
                taging_lokasi: tagingLokasi || '-',
                odp: odp || '-',
                foto_depan: fotoDepanUrl,
                foto_ktp: fotoKtpUrl,
                tanggal_pasang: tanggalPasang || '-'
            });
        
        if (error) throw error;
        
        document.getElementById('pelId').value = '';
        document.getElementById('pelNama').value = '';
        document.getElementById('pelNoHp').value = '';
        document.getElementById('pelAlamat').value = '';
        document.getElementById('pelTagingLokasi').value = '';
        document.getElementById('pelOdp').value = '';
        document.getElementById('pelFotoDepan').value = '';
        document.getElementById('pelFotoKtp').value = '';
        document.getElementById('pelTanggalPasang').value = '';
        
        Swal.fire('Berhasil', 'Pelanggan ' + nama + ' ditambahkan!', 'success');
        renderPelanggan();
    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
}


async function openEditPelangganModal(pelangganId) {
    // AMBIL DATA LANGSUNG DARI DATABASE (JANGAN DARI ARRAY CACHE)
    const { data: p, error: fetchErr } = await sb
        .from('pelanggan')
        .select('*')
        .eq('id', pelangganId)
        .maybeSingle();

    if (fetchErr || !p) {
        Swal.fire('Error', 'Data pelanggan tidak ditemukan!', 'error');
        return;
    }

    // FORMAT TANGGAL UNTUK INPUT DATE
    let tglPasang = '';
    if (p.tanggal_pasang && p.tanggal_pasang !== '-') {
        const tgl = String(p.tanggal_pasang);
        if (/^\d{2}-\d{2}-\d{4}$/.test(tgl)) {
            const [d, m, y] = tgl.split('-');
            tglPasang = y + '-' + m + '-' + d;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(tgl)) {
            tglPasang = tgl.slice(0, 10);
        }
    }

    const valId = p.id_pelanggan && p.id_pelanggan !== '-' ? p.id_pelanggan : '';
    const valNama = p.nama && p.nama !== '-' ? p.nama : '';
    const valNoHp = p.no_hp && p.no_hp !== '-' ? p.no_hp : '';
    const valAlamat = p.alamat && p.alamat !== '-' ? p.alamat : '';
    const valTaging = p.taging_lokasi && p.taging_lokasi !== '-' ? p.taging_lokasi : '';
    const valTagingOdp = p.taging_odp && p.taging_odp !== '-' ? p.taging_odp : '';
    const valOdp = p.odp && p.odp !== '-' ? p.odp : '';
    const valFotoRumah = p.foto_depan && p.foto_depan !== '-' ? p.foto_depan : '';
    const valFotoKtp = p.foto_ktp && p.foto_ktp !== '-' ? p.foto_ktp : '';

    let fotoRumahPreview = '';
    if (valFotoRumah) {
        fotoRumahPreview = `<img src="${valFotoRumah}" style="max-width:100%;max-height:100px;border-radius:8px;margin-top:6px;border:1px solid #e2e8f0;">`;
    }

    let fotoKtpPreview = '';
    if (valFotoKtp) {
        fotoKtpPreview = `<img src="${valFotoKtp}" style="max-width:100%;max-height:100px;border-radius:8px;margin-top:6px;border:1px solid #e2e8f0;">`;
    }

    const result = await Swal.fire({
        title: '✏️ Edit Data Pelanggan',
        width: 620,
        html: `
            <div style="text-align:left; font-size:14px; max-height:70vh; overflow-y:auto; padding-right:4px;">

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">ID Pelanggan</label>
                    <input id="swalPelId" type="text" value="${valId}" placeholder="Contoh: PLG-001"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Nama <span style="color:#dc2626;">*</span></label>
                    <input id="swalPelNama" type="text" value="${valNama}" placeholder="Nama lengkap"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">No HP</label>
                    <input id="swalPelNoHp" type="text" value="${valNoHp}" placeholder="08123456789"
                        oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Alamat</label>
                    <input id="swalPelAlamat" type="text" value="${valAlamat}" placeholder="Alamat lengkap"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Taging Lokasi</label>
                    <input id="swalPelTaging" type="text" value="${valTaging}" placeholder="-6.123456, 106.123456"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Taging ODP (Koordinat)</label>
                    <input id="swalPelTagingOdp" type="text" value="${valTagingOdp}" placeholder="-6.123456, 106.123456"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">ODP</label>
                    <input id="swalPelOdp" type="text" value="${valOdp}" placeholder="ODP-001"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Tanggal Pasang</label>
                    <input id="swalPelTanggal" type="date" value="${tglPasang}"
                        style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto Rumah</label>
                    <div id="swalPelFotoRumahPreview">${fotoRumahPreview}</div>
                    <input id="swalPelFotoRumah" type="file" accept="image/*" style="display:none;">
                    <button type="button" id="swalBtnFotoRumah"
                        style="margin-top:8px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <i class="fas fa-sync-alt"></i> ${valFotoRumah ? 'Ganti Foto' : 'Upload Foto'}
                    </button>
                </div>

                <div style="margin-bottom:6px;">
                    <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto KTP</label>
                    <div id="swalPelFotoKtpPreview">${fotoKtpPreview}</div>
                    <input id="swalPelFotoKtp" type="file" accept="image/*" style="display:none;">
                    <button type="button" id="swalBtnFotoKtp"
                        style="margin-top:8px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <i class="fas fa-sync-alt"></i> ${valFotoKtp ? 'Ganti Foto' : 'Upload Foto'}
                    </button>
                </div>

            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        didOpen: () => {
            const btnRumah = document.getElementById('swalBtnFotoRumah');
            const inputRumah = document.getElementById('swalPelFotoRumah');
            if (btnRumah && inputRumah) {
                btnRumah.addEventListener('click', () => inputRumah.click());
                inputRumah.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('swalPelFotoRumahPreview').innerHTML =
                                `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:8px;margin-top:6px;border:1px solid #e2e8f0;">`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            const btnKtp = document.getElementById('swalBtnFotoKtp');
            const inputKtp = document.getElementById('swalPelFotoKtp');
            if (btnKtp && inputKtp) {
                btnKtp.addEventListener('click', () => inputKtp.click());
                inputKtp.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('swalPelFotoKtpPreview').innerHTML =
                                `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:8px;margin-top:6px;border:1px solid #e2e8f0;">`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        },
        preConfirm: async () => {
            const id = document.getElementById('swalPelId').value.trim();
            const nama = document.getElementById('swalPelNama').value.trim();
            const noHp = document.getElementById('swalPelNoHp').value.trim();
            const alamat = document.getElementById('swalPelAlamat').value.trim();
            const taging = document.getElementById('swalPelTaging').value.trim();
            const odp = document.getElementById('swalPelOdp').value.trim();
            let tgl = document.getElementById('swalPelTanggal').value;

            // KONVERSI YYYY-MM-DD ke DD-MM-YYYY
            if (tgl && /^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
                const [y, m, d] = tgl.split('-');
                tgl = d + '-' + m + '-' + y;
            }

            const fotoRumahFile = document.getElementById('swalPelFotoRumah').files[0];
            const fotoKtpFile = document.getElementById('swalPelFotoKtp').files[0];
            const tagingOdp = document.getElementById('swalPelTagingOdp').value.trim();

            if (!nama) {
                Swal.showValidationMessage('⚠️ Nama wajib diisi!');
                return false;
            }

            let fotoRumahUrl = valFotoRumah;
            if (fotoRumahFile) {
                const compressed = await compressImage(fotoRumahFile, 1280, 0.7);
                const fileName = 'foto_depan_' + Date.now() + '_' + compressed.name;
                const { error: uploadErr } = await sb.storage
                    .from('pelanggan-foto')
                    .upload(fileName, compressed);
                if (uploadErr) {
                    Swal.showValidationMessage('Gagal upload foto rumah: ' + uploadErr.message);
                    return false;
                }
                const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
                fotoRumahUrl = urlData.publicUrl;
            }

            let fotoKtpUrl = valFotoKtp;
            if (fotoKtpFile) {
                const compressed = await compressImage(fotoKtpFile, 1280, 0.7);
                const fileName = 'foto_ktp_' + Date.now() + '_' + compressed.name;
                const { error: uploadErr } = await sb.storage
                    .from('pelanggan-foto')
                    .upload(fileName, compressed);
                if (uploadErr) {
                    Swal.showValidationMessage('Gagal upload foto KTP: ' + uploadErr.message);
                    return false;
                }
                const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
                fotoKtpUrl = urlData.publicUrl;
            }

            return {
                id: id || '-',
                nama,
                noHp: noHp || '-',
                alamat: alamat || '-',
                taging: taging || '-',
                tagingOdp: tagingOdp || '-',
                odp: odp || '-',
                tgl: tgl || '-',
                fotoRumahUrl: fotoRumahUrl || '-',
                fotoKtpUrl: fotoKtpUrl || '-'
            };
        }
    });

    if (!result.isConfirmed) return;
    const payload = result.value;

    try {
        const { error } = await sb
            .from('pelanggan')
            .update({
                id_pelanggan: payload.id,
                nama: payload.nama,
                no_hp: payload.noHp,
                alamat: payload.alamat,
                taging_lokasi: payload.taging,
                taging_odp: payload.tagingOdp,
                odp: payload.odp,
                tanggal_pasang: payload.tgl,
                foto_depan: payload.fotoRumahUrl,
                foto_ktp: payload.fotoKtpUrl
            })
            .eq('id', pelangganId);

        if (error) throw error;

        notif('✅ Data pelanggan berhasil diupdate!', 'success');
        renderPelanggan();

    } catch (e) {
        console.error('Error update pelanggan:', e);
        Swal.fire('Error', 'Gagal update: ' + e.message, 'error');
    }
}

async function deletePelanggan(id) {
    const result = await Swal.fire({
        title: 'Hapus Pelanggan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const { error } = await sb
            .from('pelanggan')
            .delete()
            .eq('id', id);
        
                if (error) throw error;
        
        // ✅ LOG AKTIVITAS
        await logActivity('DELETE', {
            table: 'pelanggan',
            recordId: id,
            description: `Hapus pelanggan ID: ${id}`
        });
        
        Swal.fire('Terhapus!', '', 'success');
        renderPelanggan();
    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
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

    function resetGrafikPsb() {
    document.getElementById('grafikPsbPeriode').value = '3bulan';
    document.getElementById('grafikPsbBulan').value = '';
    renderGrafikPsb();
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

        async function userChangePassword() {
        Swal.fire({
            title: '🔑 Ganti Password',
            html: `
                <div style="text-align:left;">
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
                var newPass = document.getElementById('newPassword').value;
                var confirm = document.getElementById('confirmPassword').value;

                if (!newPass || !confirm) {
                    Swal.showValidationMessage('Semua field wajib diisi!');
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
        }).then(async function(result) {
            if (result.isConfirmed) {
                try {
                    const { error } = await sb.auth.updateUser({
                        password: result.value.newPassword
                    });
                    if (error) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Gagal!',
                            text: error.message,
                            confirmButtonColor: '#dc2626'
                        });
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: '✅ Berhasil!',
                            text: 'Password berhasil diubah. Silakan login ulang.',
                            confirmButtonColor: '#2563eb'
                        }).then(function() {
                            handleLogout();
                        });
                    }
                } catch (e) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal!',
                        text: e.message,
                        confirmButtonColor: '#dc2626'
                    });
                }
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

        // ===== 7. JENIS GANGGUAN PALING SERING (HANYA GGN & GAMAS) =====
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
    // ✅ HANYA PROSES GGN DAN GAMAS
    const jenisTiket = t.jenistiket || '';
    if (jenisTiket !== 'GGN' && jenisTiket !== 'GAMAS') {
        return;
    }
    
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

        // ===== 7.B JENIS PERBAIKAN YANG SERING DILAKUKAN =====
        const perbaikanMap = {};
        filteredTickets.forEach(t => {
            const perbaikan = (t.jenisperbaikan || '-').trim().toUpperCase();
            if (perbaikan && perbaikan !== '-') {
                if (!perbaikanMap[perbaikan]) perbaikanMap[perbaikan] = { count: 0 };
                perbaikanMap[perbaikan].count++;
            }
        });

        const sortedPerbaikan = Object.entries(perbaikanMap).sort((a, b) => b[1].count - a[1].count);
        const totalPerbaikan = sortedPerbaikan.reduce((sum, item) => sum + item[1].count, 0);

        // PAGINATION UNTUK JENIS PERBAIKAN
        const itemsPerPagePerbaikan = 10;
        const totalPagesPerbaikan = Math.ceil(sortedPerbaikan.length / itemsPerPagePerbaikan) || 1;
        let currentPagePerbaikan = parseInt(localStorage.getItem('perbaikanPage')) || 1;
        if (currentPagePerbaikan < 1) currentPagePerbaikan = 1;
        if (currentPagePerbaikan > totalPagesPerbaikan) currentPagePerbaikan = totalPagesPerbaikan;

        const startPerbaikan = (currentPagePerbaikan - 1) * itemsPerPagePerbaikan;
        const endPerbaikan = Math.min(startPerbaikan + itemsPerPagePerbaikan, sortedPerbaikan.length);
        const pageDataPerbaikan = sortedPerbaikan.slice(startPerbaikan, endPerbaikan);

        let perbaikanHtml = '';
        if (sortedPerbaikan.length === 0) {
            perbaikanHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
            pageDataPerbaikan.forEach(([jenis, data], index) => {
                const persen = totalPerbaikan > 0 ? ((data.count / totalPerbaikan) * 100).toFixed(1) : '0';
                const persenNum = parseFloat(persen);
                
                const barWidth = Math.min(persenNum, 100);
                const colorRatio = Math.min(persenNum / 100, 1);
                const red = Math.round(34 + (220 - 34) * colorRatio);
                const green = Math.round(197 - (197 - 50) * colorRatio);
                const blue = Math.round(94 - (94 - 50) * colorRatio);
                const barColor = `rgb(${red}, ${green}, ${blue})`;

                perbaikanHtml += `<tr>
                    <td>${startPerbaikan + index + 1}</td>
                    <td><strong>${jenis}</strong></td>
                    <td>${data.count}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:10px;white-space:nowrap;width:100%;">
                            <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                                <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:4px;transition:width 0.5s;"></div>
                            </div>
                            <span style="font-weight:700;font-size:13px;min-width:50px;text-align:right;flex-shrink:0;">${persen}%</span>
                        </div>
                    </td>
                    <td style="text-align:center;">
                        <button class="btn btn-primary btn-sm" onclick="viewTiketByPerbaikan('${jenis.replace(/'/g, "\\'")}')" style="padding:4px 12px;font-size:11px;">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('jenisperbaikanReportBody').innerHTML = perbaikanHtml;

        // RENDER TOMBOL PAGINATION PERBAIKAN
        const perbaikanPaginationContainer = document.getElementById('perbaikanPaginationContainer');
        if (perbaikanPaginationContainer) {
            let pagHtml = '';
            if (totalPagesPerbaikan > 1) {
                pagHtml = '<div style="display:flex;justify-content:center;gap:6px;padding:10px 0;flex-wrap:wrap;">';
                if (currentPagePerbaikan > 1) {
                    pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToPerbaikanPage(${currentPagePerbaikan - 1})">◀ Prev</button>`;
                }
                for (let i = 1; i <= totalPagesPerbaikan; i++) {
                    const active = i === currentPagePerbaikan ? 'btn-primary' : 'btn-outline';
                    pagHtml += `<button class="btn ${active} btn-sm" onclick="goToPerbaikanPage(${i})">${i}</button>`;
                }
                if (currentPagePerbaikan < totalPagesPerbaikan) {
                    pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToPerbaikanPage(${currentPagePerbaikan + 1})">Next ▶</button>`;
                }
                pagHtml += '</div>';
                pagHtml += `<div style="text-align:center;font-size:13px;color:#64748b;">Menampilkan ${startPerbaikan + 1}-${endPerbaikan} dari ${sortedPerbaikan.length} jenis perbaikan</div>`;
            }
            perbaikanPaginationContainer.innerHTML = pagHtml;
        }

        

// ===== PAGINATION UNTUK JENIS GANGGUAN =====
const itemsPerPageGangguan = 10;
const totalPagesGangguan = Math.ceil(sortedGangguan2.length / itemsPerPageGangguan) || 1;
let currentPageGangguan = parseInt(localStorage.getItem('gangguanPage')) || 1;
if (currentPageGangguan < 1) currentPageGangguan = 1;
if (currentPageGangguan > totalPagesGangguan) currentPageGangguan = totalPagesGangguan;

const startGangguan = (currentPageGangguan - 1) * itemsPerPageGangguan;
const endGangguan = Math.min(startGangguan + itemsPerPageGangguan, sortedGangguan2.length);
const pageDataGangguan = sortedGangguan2.slice(startGangguan, endGangguan);

let gangguanHtml2 = '';
const maxCount2 = sortedGangguan2.length > 0 ? sortedGangguan2[0][1].count : 1;

pageDataGangguan.forEach(([jenis, data], index) => {
    const persen = totalGangguan2 > 0 ? ((data.count / totalGangguan2) * 100).toFixed(1) : '0';
    const persenNum = parseFloat(persen);
    const textColor = data.count === 0 ? '#94a3b8' : '#0b1a33';
    const bgColor = data.count === 0 ? '#f8fafc' : 'transparent';
    
    const barWidth = Math.min(persenNum, 100);
    const colorRatio = Math.min(persenNum / 100, 1);
    const red = Math.round(34 + (220 - 34) * colorRatio);
    const green = Math.round(197 - (197 - 50) * colorRatio);
    const blue = Math.round(94 - (94 - 50) * colorRatio);
    const barColor = `rgb(${red}, ${green}, ${blue})`;
    
    gangguanHtml2 += `<tr style="background:${bgColor};">
        <td>${startGangguan + index + 1}</td>
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
        <td style="text-align:center;">
            ${data.count > 0 ? `<button class="btn btn-primary btn-sm" onclick="viewTiketByGangguan('${jenis.replace(/'/g, "\\'")}')" style="padding:4px 12px;font-size:11px;">
                <i class="fas fa-eye"></i> View
            </button>` : '<span style="color:#94a3b8;">-</span>'}
        </td>
    </tr>`;
});
document.getElementById('jenisgangguanReportBody').innerHTML = gangguanHtml2;

// ===== PAGINATION BUTTONS UNTUK JENIS GANGGUAN =====
const gangPaginationContainer = document.getElementById('gangguanPaginationContainer');
if (gangPaginationContainer) {
    let pagHtml = '';
    if (totalPagesGangguan > 1) {
        pagHtml = '<div style="display:flex;justify-content:center;gap:6px;padding:10px 0;flex-wrap:wrap;">';
        if (currentPageGangguan > 1) {
            pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToGangguanPage(${currentPageGangguan - 1})">◀ Prev</button>`;
        }
        for (let i = 1; i <= totalPagesGangguan; i++) {
            const active = i === currentPageGangguan ? 'btn-primary' : 'btn-outline';
            pagHtml += `<button class="btn ${active} btn-sm" onclick="goToGangguanPage(${i})">${i}</button>`;
        }
        if (currentPageGangguan < totalPagesGangguan) {
            pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToGangguanPage(${currentPageGangguan + 1})">Next ▶</button>`;
        }
        pagHtml += '</div>';
        pagHtml += `<div style="text-align:center;font-size:13px;color:#64748b;">Menampilkan ${startGangguan + 1}-${endGangguan} dari ${sortedGangguan2.length} jenis gangguan</div>`;
    }
    gangPaginationContainer.innerHTML = pagHtml;
}

        // ===== 8. PELANGGAN PALING SERING LAPOR (HANYA GGN) =====
const customerMap = {};

// FILTER TIKET YANG HANYA GGN (BUKAN PSB, GAMAS, PROJECT)
const ggnTickets = filteredTickets.filter(t => {
    const jenisTiket = t.jenistiket || '';
    // HANYA YANG JENISNYA GGN ATAU KOSONG (ANGGAP GGN)
    return jenisTiket === 'GGN' || jenisTiket === '' || jenisTiket === null;
});

// ✅ FILTER GLOBAL: NAMA / ID PELANGGAN / ODP / WILAYAH
const filterCustSearch = (document.getElementById('filterCustomerSearch')?.value || '').toLowerCase().trim();

let ggnTicketsFiltered = ggnTickets;
if (filterCustSearch) {
    ggnTicketsFiltered = ggnTicketsFiltered.filter(t => {
        const nama = (t.customer || '').toLowerCase();
        const idPel = (t.kodePelanggan || '').toLowerCase();
        const odp = (t.odppelanggan || '').toLowerCase();
        return nama.includes(filterCustSearch) || idPel.includes(filterCustSearch) || odp.includes(filterCustSearch);
    });
}

ggnTicketsFiltered.forEach(t => {
    const cust = t.customer || 'Tidak diketahui';
    if(!customerMap[cust]) {
        customerMap[cust] = { 
            total: 0,
            odppelanggan: t.odppelanggan || '-',
            kodepelanggan: t.kodePelanggan || '-'
        };
    }
    customerMap[cust].total++;
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
    customerHtml = '<tr><td colspan="6"><div class="empty">Tidak ada data pelanggan GGN</div></td></tr>';
} else {
    pageData.forEach(([cust, data], index) => {
        customerHtml += `<tr>
            <td>${start + index + 1}</td>
            <td><strong>${cust}</strong></td>
            <td>${data.kodepelanggan}</td>
            <td>${data.odppelanggan}</td>
            <td>${data.total}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewCustomerGangguan('${cust}')" style="padding:2px 12px; font-size:11px;">
                    <i class="fas fa-eye"></i> View
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
        const gaulMap = getTeknisiGaulMap(2, filteredTickets);
        
        const sortedGaul = Object.entries(gaulMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
        
        let gaulHtml = '';
        if(sortedGaul.length === 0) {
            gaulHtml = '<tr><td colspan="3"><div class="empty">Tidak ada data GAUL</div></td></tr>';
        } else {
            sortedGaul.forEach(([tech, count], index) => {
                gaulHtml += `<tr onclick="viewGaulHistory('${tech}')" style="cursor:pointer;">
                    <td>${index + 1}</td>
                    <td><strong>${tech}</strong></td>
                    <td>${count}</td>
                </tr>`;
            });
        }
        document.getElementById('gaulReportBody').innerHTML = gaulHtml;

                // ===== TIM PENYEBAB GAUL =====
        const timGaulMap = getTimGaulMap(2, filteredTickets);
        const sortedTimGaul = Object.entries(timGaulMap).sort((a,b) => b[1].total - a[1].total).slice(0, 10);
        
        let timGaulHtml = '';
        if (sortedTimGaul.length === 0) {
            timGaulHtml = '<tr><td colspan="3"><div class="empty">Tidak ada data Tim GAUL</div></td></tr>';
        } else {
            sortedTimGaul.forEach(([timKey, data], index) => {
                const namaTim = data.anggota.join(', ');
                timGaulHtml += `<tr onclick="viewTimGaulHistory('${timKey}')" style="cursor:pointer;">
                    <td>${index + 1}</td>
                    <td><strong>${namaTim}</strong></td>
                    <td>${data.total}</td>
                </tr>`;
            });
        }
        document.getElementById('gaulTimReportBody').innerHTML = timGaulHtml;

                // ===== TEKNISI TERBAIK (PSB/GGN) =====
        const topTeknisi = getTopTeknisi(filteredTickets);
        let topTeknisiHtml = '';
        if (topTeknisi.length === 0) {
            topTeknisiHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
            topTeknisi.forEach((d, i) => {
                let medal = '';
                if (i === 0) medal = ' 🥇';
                else if (i === 1) medal = ' 🥈';
                else if (i === 2) medal = ' 🥉';
                
                topTeknisiHtml += `<tr>
                    <td style="text-align:center;">${i + 1}</td>
                    <td style="text-align:left;"><strong>${d.name}</strong>${medal}</td>
                    <td style="text-align:center;">${d.total}</td>
                    <td style="text-align:center;color:#16a34a;font-weight:700;">${d.tepat}</td>
                    <td style="text-align:center;">
                        <span style="font-weight:700;color:${d.rate >= 80 ? '#16a34a' : d.rate >= 50 ? '#f59e0b' : '#dc2626'};">
                            ${d.rate.toFixed(0)}%
                        </span>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('topTeknisiBody').innerHTML = topTeknisiHtml;

        // ===== TIM TERBAIK (PSB/GGN) =====
        const topTim = getTopTim(filteredTickets);
        let topTimHtml = '';
        if (topTim.length === 0) {
            topTimHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
            topTim.forEach((d, i) => {
                let medal = '';
                if (i === 0) medal = ' 🥇';
                else if (i === 1) medal = ' 🥈';
                else if (i === 2) medal = ' 🥉';
                
                topTimHtml += `<tr>
                    <td style="text-align:center;">${i + 1}</td>
                    <td style="text-align:left;"><strong>${d.name}</strong>${medal}</td>
                    <td style="text-align:center;">${d.total}</td>
                    <td style="text-align:center;color:#16a34a;font-weight:700;">${d.tepat}</td>
                    <td style="text-align:center;">
                        <span style="font-weight:700;color:${d.rate >= 80 ? '#16a34a' : d.rate >= 50 ? '#f59e0b' : '#dc2626'};">
                            ${d.rate.toFixed(0)}%
                        </span>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('topTimBody').innerHTML = topTimHtml;

            // ===== 10. PRODUKTIVITAS TEKNISI =====
            const techMap = {};
    techs.forEach(t => { techMap[t.name] = { total: 0, closed: 0, tepatWaktu: 0, overdue: 0, imbasGamas: 0 }; });
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
                // Hitung imbas GAMAS
                if (t.imbas_gamas) techMap[tech].imbasGamas++;
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
            const overdueCount = data.overdue || 0;
            const viewBtn = overdueCount > 0 
                ? `<button class="btn btn-danger btn-sm" onclick="viewOverdueTickets('${name}')" title="Lihat tiket overdue" style="padding:2px 8px;font-size:10px;">
                    <i class="fas fa-eye"></i> ${overdueCount}
                </button>` 
                : `<span style="color:#94a3b8;font-size:11px;">-</span>`;
            
            produktivitasHtml += `<tr>
    <td>${index + 1}</td>
    <td><strong>${name}</strong></td>
    <td>${data.total}</td>
    <td style="color:#16a34a;font-weight:600;">${data.closed}</td>
    <td style="color:#22c55e;font-weight:600;">${data.tepatWaktu}</td>
    <td style="color:#dc2626;font-weight:700;">
        ${data.overdue > 0 ? `<span style="display:flex;align-items:center;gap:6px;justify-content:flex-start;">
            <span>${data.overdue}</span>
            <button onclick="viewOverdueTickets('${name}')" 
                    style="background:#dc2626;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;justify-content:center;transition:0.2s;"
                    onmouseover="this.style.transform='scale(1.1)'" 
                    onmouseout="this.style.transform='scale(1)'"
                    title="Lihat tiket overdue">
                <i class="fas fa-eye" style="font-size:10px;"></i>
            </button>
        </span>` : `<span style="color:#94a3b8;">0</span>`}
    </td>
    <td>
        <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;min-width:100px;">
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

    function viewGaulHistory(techName) {
    const batas = new Date();
    batas.setMonth(batas.getMonth() - 2);
    batas.setHours(0, 0, 0, 0);

    // KELOMPOKKAN TIKET GANGGUAN JARINGAN PER PELANGGAN
    const map = {};
    tickets.forEach(t => {
        if (!t.createdAt) return;
        if (new Date(t.createdAt) < batas) return;
        if (!isGangguanJaringan(t)) return;
        const kode = t.kodePelanggan;
        if (!kode || kode === '-') return;
        if (!map[kode]) map[kode] = [];
        map[kode].push(t);
    });

    // FILTER: pelanggan GAUL (>=2 tiket) DAN teknisi ini ada di tiket PERTAMA
    const gaulGroups = [];
    Object.keys(map).forEach(kode => {
    const list = map[kode].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (list.length < 2) return;
    
    // CEK APAKAH TEKNISI INI ADA DI TIKET PENYEBAB (SEMUA KECUALI TIKET TERAKHIR)
    let found = false;
    for (let i = 0; i < list.length - 1; i++) {
        const techs = list[i].technicians || [];
        if (techs.includes(techName)) { found = true; break; }
    }
    if (!found) return;
    
    gaulGroups.push({
        kode: kode,
        allTickets: list
    });
});

    if (gaulGroups.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Teknisi ' + techName + ' tidak menyebabkan GAUL',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

            // TOTAL GAUL = JUMLAH PELANGGAN GAUL YANG DITANGANI DI TIKET PERTAMA
    const totalGaul = gaulGroups.length;

    let html = `<div style="text-align:left; max-height:500px; overflow-y:auto; font-size:13px;">
        <div style="background:#fef3c7; padding:12px 16px; border-radius:8px; margin-bottom:16px;">
            <p style="margin:0; font-size:14px;">
                <strong>🔧 Teknisi:</strong> ${techName}
            </p>
            <p style="margin:6px 0 0 0; font-size:14px;">
                <strong>⚠️ Total GAUL:</strong> ${totalGaul}
            </p>
            <p style="margin:6px 0 0 0; font-size:14px;">
                <strong>👥 Pelanggan GAUL:</strong> ${gaulGroups.length}
            </p>
            <p style="margin:6px 0 0 0; font-size:14px;">
                <strong>📅 Periode:</strong> ${batas.toLocaleDateString('id-ID')} - ${new Date().toLocaleDateString('id-ID')}
            </p>
        </div>`;

    gaulGroups.forEach((group, gi) => {
        const namaPelanggan = group.allTickets[0].customer || '-';
        const jenisTiket = group.allTickets[0].jenistiket || '-';
        
        html += `
        <div style="margin-bottom:16px; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
            <div style="background:#0b1a33; color:white; padding:10px 14px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${gi + 1}. ${namaPelanggan}</strong>
                    <span style="margin-left:12px; background:rgba(255,255,255,0.15); padding:2px 10px; border-radius:12px; font-size:11px;">
                        ${jenisTiket}
                    </span>
                </div>
                <div style="background:#dc2626; padding:2px 12px; border-radius:12px; font-size:11px; font-weight:700;">
                    PENYEBAB GAUL
                </div>
            </div>
            <div style="padding:10px 14px; background:#f8fafc; font-size:12px; color:#475569;">
                <strong>Kode Pelanggan:</strong> ${group.kode}
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:8px; text-align:center; width:40px;">No</th>
                        <th style="padding:8px; text-align:left;">Tanggal</th>
                        <th style="padding:8px; text-align:left;">No Tiket</th>
                        <th style="padding:8px; text-align:left;">Jenis Gangguan</th>
                        <th style="padding:8px; text-align:left;">Teknisi</th>
                        <th style="padding:8px; text-align:center; width:80px;">Status</th>
                    </tr>
                </thead>
                <tbody>`;

        group.allTickets.forEach((t, ti) => {
            const tgl = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
            const tech = (t.technicians || []).join(', ') || '-';
            // PENYEBAB = TIKET PERTAMA
            const isPenyebab = (ti < group.allTickets.length - 1);
            
            let bgRow = isPenyebab ? 'background:#fef2f2;' : '';
            
            html += `<tr style="border-bottom:1px solid #f1f5f9; ${bgRow}">
                <td style="padding:8px; text-align:center;">${ti+1}</td>
                <td style="padding:8px;">${tgl}</td>
                <td style="padding:8px; font-weight:600;">${t.ticketid || '-'}</td>
                <td style="padding:8px;">${t.jenisgangguan || '-'}</td>
                <td style="padding:8px;">${tech}</td>
                <td style="padding:8px; text-align:center;">
                    ${isPenyebab 
                        ? '<span style="background:#dc2626;color:white;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;">GAUL</span>'
                        : '<span style="background:#f1f5f9;color:#94a3b8;padding:2px 10px;border-radius:10px;font-size:10px;">Laporan Ulang</span>'}
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    });

    html += `</div>`;

    Swal.fire({
        title: `⚠️ History GAUL - ${techName}`,
        html: html,
        icon: 'warning',
        width: 850,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb',
        showCloseButton: true
    });
}


function viewTimGaulHistory(timKey) {
    const anggotaTim = timKey.split('|');
    const batas = new Date();
    batas.setMonth(batas.getMonth() - 2);
    batas.setHours(0, 0, 0, 0);

    const map = {};
    tickets.forEach(t => {
        if (!t.createdAt) return;
        if (new Date(t.createdAt) < batas) return;
        if (!isGangguanJaringan(t)) return;
        const kode = t.kodePelanggan;
        if (!kode || kode === '-') return;
        if (!map[kode]) map[kode] = [];
        map[kode].push(t);
    });

    const gaulGroups = [];
    Object.keys(map).forEach(kode => {
    const list = map[kode].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (list.length < 2) return;
    
    // CEK APAKAH TIM INI ADA DI TIKET PENYEBAB (SEMUA KECUALI TIKET TERAKHIR)
    let found = false;
    for (let i = 0; i < list.length - 1; i++) {
        const techs = (list[i].technicians || []).slice().sort();
        if (techs.join('|') === timKey) { found = true; break; }
    }
    if (!found) return;
    
    gaulGroups.push({
        kode: kode,
        allTickets: list
    });
});

    if (gaulGroups.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Tim ini tidak menyebabkan GAUL',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const totalGaul = gaulGroups.length;
    const namaTim = anggotaTim.join(', ');

    let html = `<div style="text-align:left; max-height:500px; overflow-y:auto; font-size:13px;">
        <div style="background:#fef3c7; padding:12px 16px; border-radius:8px; margin-bottom:16px;">
            <p style="margin:0; font-size:14px;">
                <strong>👥 Tim:</strong> ${namaTim}
            </p>
            <p style="margin:6px 0 0 0; font-size:14px;">
                <strong>⚠️ Total GAUL:</strong> ${totalGaul}
            </p>
            <p style="margin:6px 0 0 0; font-size:14px;">
                <strong>👤 Pelanggan GAUL:</strong> ${gaulGroups.length}
            </p>
            <p style="margin:6px 0 0 0; font-size:14px;">
                <strong>📅 Periode:</strong> ${batas.toLocaleDateString('id-ID')} - ${new Date().toLocaleDateString('id-ID')}
            </p>
        </div>`;

    gaulGroups.forEach((group, gi) => {
        const namaPelanggan = group.allTickets[0].customer || '-';
        const jenisTiket = group.allTickets[0].jenistiket || '-';
        
        html += `
        <div style="margin-bottom:16px; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
            <div style="background:#7f1d1d; color:white; padding:10px 14px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${gi + 1}. ${namaPelanggan}</strong>
                    <span style="margin-left:12px; background:rgba(255,255,255,0.15); padding:2px 10px; border-radius:12px; font-size:11px;">
                        ${jenisTiket}
                    </span>
                </div>
                <div style="background:#dc2626; padding:2px 12px; border-radius:12px; font-size:11px; font-weight:700;">
                    PENYEBAB GAUL
                </div>
            </div>
            <div style="padding:10px 14px; background:#f8fafc; font-size:12px; color:#475569;">
                <strong>Kode Pelanggan:</strong> ${group.kode}
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:8px; text-align:center; width:40px;">No</th>
                        <th style="padding:8px; text-align:left;">Tanggal</th>
                        <th style="padding:8px; text-align:left;">No Tiket</th>
                        <th style="padding:8px; text-align:left;">Jenis Gangguan</th>
                        <th style="padding:8px; text-align:left;">Teknisi</th>
                        <th style="padding:8px; text-align:center; width:80px;">Status</th>
                    </tr>
                </thead>
                <tbody>`;

        group.allTickets.forEach((t, ti) => {
            const tgl = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
            const tech = (t.technicians || []).join(', ') || '-';
            // PENYEBAB = SEMUA TIKET KECUALI TIKET TERAKHIR
            const isPenyebab = (ti < group.allTickets.length - 1);
            
            let bgRow = isPenyebab ? 'background:#fef2f2;' : '';
            
            html += `<tr style="border-bottom:1px solid #f1f5f9; ${bgRow}">
                <td style="padding:8px; text-align:center;">${ti+1}</td>
                <td style="padding:8px;">${tgl}</td>
                <td style="padding:8px; font-weight:600;">${t.ticketid || '-'}</td>
                <td style="padding:8px;">${t.jenisgangguan || '-'}</td>
                <td style="padding:8px;">${tech}</td>
                <td style="padding:8px; text-align:center;">
                    ${isPenyebab 
                        ? '<span style="background:#dc2626;color:white;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;">GAUL</span>'
                        : '<span style="background:#f1f5f9;color:#94a3b8;padding:2px 10px;border-radius:10px;font-size:10px;">Laporan Ulang</span>'}
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    });

    html += `</div>`;

    Swal.fire({
        title: `⚠️ History GAUL - Tim`,
        html: html,
        icon: 'warning',
        width: 850,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb',
        showCloseButton: true
    });
}

    // ===== PAGINATION UNTUK JENIS GANGGUAN =====
function goToGangguanPage(page) {
    localStorage.setItem('gangguanPage', page);
    renderReports();
}

// ===== VIEW DETAIL GANGGUAN PELANGGAN (3 BULAN TERAKHIR) =====
function viewCustomerGangguan(customerName) {
    // HITUNG 3 BULAN TERAKHIR
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // FILTER TIKET PELANGGAN TERSEBUT (HANYA GGN, 3 BULAN TERAKHIR)
    const customerTickets = tickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        if (jenisTiket === 'PSB' || jenisTiket === 'GAMAS' || jenisTiket === 'PROJECT') return false;
        if (t.customer !== customerName) return false;
        const tDate = new Date(t.createdAt);
        return tDate >= threeMonthsAgo;
    });
    
    if (customerTickets.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Tidak ada tiket GGN untuk pelanggan ' + customerName + ' dalam 3 bulan terakhir.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }
    
    // HITUNG TOTAL TIKET & STATUS
    const totalTiket = customerTickets.length;
    const totalClose = customerTickets.filter(t => t.status === 'close').length;
    const totalOpen = customerTickets.filter(t => t.status === 'open').length;
    const totalPending = customerTickets.filter(t => t.status === 'pending').length;
    
    // STATUS BADGE
    const statusBadge = s => {
        if (s === 'open') return '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">● OPEN</span>';
        if (s === 'close') return '<span style="display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">✓ CLOSE</span>';
        if (s === 'pending') return '<span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">⏸ PENDING</span>';
        return '<span style="color:#94a3b8;">-</span>';
    };

    // URUTKAN TIKET DARI YANG TERBARU
    const sortedTickets = [...customerTickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // BUILD ROWS
    let rows = '';
    sortedTickets.forEach((t, index) => {
        const tanggal = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) : '-';
        const techDisplay = (t.technicians || []).join(', ') || '-';

        rows += `<tr style="border-bottom:1px solid #eef2f7;">
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">${index + 1}</td>
            <td style="padding:10px 8px;font-size:12px;color:#334155;white-space:nowrap;">${tanggal}</td>
            <td style="padding:10px 8px;font-size:12px;font-weight:700;color:#0b1a33;">${t.ticketid || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#0b1a33;font-weight:600;">${t.jenisgangguan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${t.jenisperbaikan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${techDisplay}</td>
            <td style="padding:10px 8px;text-align:center;">${statusBadge(t.status)}</td>
        </tr>`;
    });

    // BUILD HTML MODAL
    const html = `
        <div style="text-align:left;font-family:'Inter',-apple-system,sans-serif;">
            
            <!-- HEADER INFO -->
            <div style="background:linear-gradient(135deg,#0b1a33,#1e3a6b);padding:20px 24px;border-radius:16px;margin-bottom:16px;color:white;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;box-shadow:0 8px 24px rgba(11,26,51,0.15);">
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.6;font-weight:700;">Histori Pelanggan</div>
                    <div style="font-size:22px;font-weight:800;margin-top:4px;letter-spacing:-0.5px;">👤 ${customerName}</div>
                    <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;opacity:0.85;">
                        <span>✅ ${totalClose} Close</span>
                        <span>🔴 ${totalOpen} Open</span>
                        <span>⏸ ${totalPending} Pending</span>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.15);padding:12px 24px;border-radius:14px;text-align:center;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:32px;font-weight:900;line-height:1;">${totalTiket}</div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.75;margin-top:4px;">Total Laporan</div>
                </div>
            </div>
            
            <!-- INFO PERIODE -->
            <div style="background:#f8fafc;padding:10px 16px;border-radius:10px;margin-bottom:16px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
                <i class="fas fa-calendar-alt" style="color:#64748b;font-size:14px;"></i>
                <span style="font-size:12px;color:#475569;font-weight:600;">
                    Periode: ${threeMonthsAgo.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})} - ${new Date().toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                </span>
            </div>

            <!-- TABEL -->
            <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup>
                        <col style="width:40px;">
                        <col style="width:100px;">
                        <col style="width:170px;">
                        <col style="width:150px;">
                        <col style="width:130px;">
                        <col style="width:150px;">
                        <col style="width:90px;">
                    </colgroup>
                    <thead>
                        <tr style="background:#0b1a33;color:white;">
                            <th style="padding:12px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">No</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tanggal</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">No Tiket</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Jenis Gangguan</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Perbaikan</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Teknisi</th>
                            <th style="padding:12px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                        </tr>
                    </thead>
                </table>
                <!-- SCROLL BODY -->
                <div style="max-height:340px;overflow-y:auto;overflow-x:hidden;">
                    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                        <colgroup>
                            <col style="width:40px;">
                            <col style="width:100px;">
                            <col style="width:170px;">
                            <col style="width:150px;">
                            <col style="width:130px;">
                            <col style="width:150px;">
                            <col style="width:90px;">
                        </colgroup>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top:14px;font-size:11px;color:#94a3b8;text-align:center;">
                Menampilkan ${sortedTickets.length} tiket dari ${totalTiket} total laporan
            </div>
        </div>
    `;
    
    Swal.fire({
        title: '',
        html: html,
        width: 900,
        showConfirmButton: false,
        showCloseButton: true,
        padding: '20px',
        customClass: { popup: 'swal-view-tiket-popup' }
    });
}function viewCustomerGangguan(customerName) {
    // HITUNG 3 BULAN TERAKHIR
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // FILTER TIKET PELANGGAN TERSEBUT (HANYA GGN, 3 BULAN TERAKHIR)
    const customerTickets = tickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        if (jenisTiket === 'PSB' || jenisTiket === 'GAMAS' || jenisTiket === 'PROJECT') return false;
        if (t.customer !== customerName) return false;
        const tDate = new Date(t.createdAt);
        return tDate >= threeMonthsAgo;
    });
    
    if (customerTickets.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Tidak ada tiket GGN untuk pelanggan ' + customerName + ' dalam 3 bulan terakhir.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }
    
    // HITUNG TOTAL TIKET & STATUS
    const totalTiket = customerTickets.length;
    const totalClose = customerTickets.filter(t => t.status === 'close').length;
    const totalOpen = customerTickets.filter(t => t.status === 'open').length;
    const totalPending = customerTickets.filter(t => t.status === 'pending').length;
    
    // STATUS BADGE
    const statusBadge = s => {
        if (s === 'open') return '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">● OPEN</span>';
        if (s === 'close') return '<span style="display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">✓ CLOSE</span>';
        if (s === 'pending') return '<span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">⏸ PENDING</span>';
        return '<span style="color:#94a3b8;">-</span>';
    };

    // URUTKAN TIKET DARI YANG TERBARU
    const sortedTickets = [...customerTickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // BUILD ROWS
    let rows = '';
    sortedTickets.forEach((t, index) => {
        const tanggal = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) : '-';
        const techDisplay = (t.technicians || []).join(', ') || '-';

        rows += `<tr style="border-bottom:1px solid #eef2f7;">
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">${index + 1}</td>
            <td style="padding:10px 8px;font-size:12px;color:#334155;white-space:nowrap;">${tanggal}</td>
            <td style="padding:10px 8px;font-size:12px;font-weight:700;color:#0b1a33;">${t.ticketid || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#0b1a33;font-weight:600;">${t.jenisgangguan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${t.jenisperbaikan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${techDisplay}</td>
            <td style="padding:10px 8px;text-align:center;">${statusBadge(t.status)}</td>
        </tr>`;
    });

    // BUILD HTML MODAL
    const html = `
        <div style="text-align:left;font-family:'Inter',-apple-system,sans-serif;">
            
            <!-- HEADER INFO -->
            <div style="background:linear-gradient(135deg,#0b1a33,#1e3a6b);padding:20px 24px;border-radius:16px;margin-bottom:16px;color:white;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;box-shadow:0 8px 24px rgba(11,26,51,0.15);">
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.6;font-weight:700;">Histori Pelanggan</div>
                    <div style="font-size:22px;font-weight:800;margin-top:4px;letter-spacing:-0.5px;">👤 ${customerName}</div>
                    <div style="display:flex;gap:16px;margin-top:10px;font-size:12px;opacity:0.85;">
                        <span>✅ ${totalClose} Close</span>
                        <span>🔴 ${totalOpen} Open</span>
                        <span>⏸ ${totalPending} Pending</span>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.15);padding:12px 24px;border-radius:14px;text-align:center;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:32px;font-weight:900;line-height:1;">${totalTiket}</div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.75;margin-top:4px;">Total Laporan</div>
                </div>
            </div>
            
            <!-- INFO PERIODE -->
            <div style="background:#f8fafc;padding:10px 16px;border-radius:10px;margin-bottom:16px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
                <i class="fas fa-calendar-alt" style="color:#64748b;font-size:14px;"></i>
                <span style="font-size:12px;color:#475569;font-weight:600;">
                    Periode: ${threeMonthsAgo.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})} - ${new Date().toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                </span>
            </div>

            <!-- TABEL -->
            <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup>
                        <col style="width:40px;">
                        <col style="width:100px;">
                        <col style="width:170px;">
                        <col style="width:150px;">
                        <col style="width:130px;">
                        <col style="width:150px;">
                        <col style="width:90px;">
                    </colgroup>
                    <thead>
                        <tr style="background:#0b1a33;color:white;">
                            <th style="padding:12px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">No</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tanggal</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">No Tiket</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Jenis Gangguan</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Perbaikan</th>
                            <th style="padding:12px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Teknisi</th>
                            <th style="padding:12px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                        </tr>
                    </thead>
                </table>
                <!-- SCROLL BODY -->
                <div style="max-height:340px;overflow-y:auto;overflow-x:hidden;">
                    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                        <colgroup>
                            <col style="width:40px;">
                            <col style="width:100px;">
                            <col style="width:170px;">
                            <col style="width:150px;">
                            <col style="width:130px;">
                            <col style="width:150px;">
                            <col style="width:90px;">
                        </colgroup>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top:14px;font-size:11px;color:#94a3b8;text-align:center;">
                Menampilkan ${sortedTickets.length} tiket dari ${totalTiket} total laporan
            </div>
        </div>
    `;
    
    Swal.fire({
        title: '',
        html: html,
        width: 900,
        showConfirmButton: false,
        showCloseButton: true,
        padding: '20px',
        customClass: { popup: 'swal-view-tiket-popup' }
    });
}   


// ============================================================
// VIEW TIKET BERDASARKAN JENIS GANGGUAN
// ============================================================
function viewTiketByGangguan(jenisGangguan) {
    const dateFrom = document.getElementById('filterLaporanDate')?.value || '';
    const dateTo = document.getElementById('filterLaporanDateTo')?.value || '';
    const bulan = document.getElementById('filterLaporanBulan')?.value || '';

    let list = tickets.filter(t => {
        const jenisTiket = t.jenistiket || '';
        if (jenisTiket !== 'GGN' && jenisTiket !== 'GAMAS') return false;
        if ((t.jenisgangguan || 'Tidak diketahui') !== jenisGangguan) return false;
        return true;
    });

    if (dateFrom || dateTo) {
        list = list.filter(t => {
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
        });
    }

    if (bulan === '3bulan') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        list = list.filter(t => new Date(t.createdAt) >= threeMonthsAgo);
    } else if (bulan !== '' && bulan !== '3bulan' && bulan !== 'all') {
        list = list.filter(t => new Date(t.createdAt).getMonth() == parseInt(bulan));
    }

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (list.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Tidak ada tiket dengan jenis gangguan "' + jenisGangguan + '"',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const fmtTgl = t => t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    }) : '-';

    const statusBadge = s => {
        if (s === 'open') return '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">● OPEN</span>';
        if (s === 'close') return '<span style="display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">✓ CLOSE</span>';
        if (s === 'pending') return '<span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">⏸ PENDING</span>';
        return '<span style="color:#94a3b8;">-</span>';
    };

    const totalClose = list.filter(t => t.status === 'close').length;
    const totalOpen = list.filter(t => t.status === 'open').length;
    const totalPending = list.filter(t => t.status === 'pending').length;

    let rows = '';
    list.forEach((t, i) => {
        const tech = (t.technicians || []).join(', ') || '-';
        rows += `<tr style="border-bottom:1px solid #eef2f7;">
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">${i + 1}</td>
            <td style="padding:10px 8px;font-size:12px;color:#334155;white-space:nowrap;">${fmtTgl(t)}</td>
            <td style="padding:10px 8px;font-size:12px;font-weight:700;color:#0b1a33;">${t.ticketid || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#334155;">${t.customer || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#64748b;">${t.odppelanggan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${tech}</td>
            <td style="padding:10px 8px;font-size:12px;color:#0b1a33;font-weight:600;">${t.jenisgangguan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${t.jenisperbaikan || '-'}</td>
            <td style="padding:10px 8px;text-align:center;">${statusBadge(t.status)}</td>
            <td style="padding:10px 8px;text-align:center;">
                <button onclick="editJenisGangguanFromView('${t.id}')"
                    style="padding:5px 12px;background:#2563eb;color:white;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </td>
        </tr>`;
    });

    const html = `
        <div style="text-align:left;font-family:'Inter',-apple-system,sans-serif;">
            <!-- HEADER INFO -->
            <div style="background:linear-gradient(135deg,#0b1a33,#1e3a6b);padding:18px 22px;border-radius:14px;margin-bottom:16px;color:white;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.6;font-weight:700;">Jenis Gangguan</div>
                    <div style="font-size:20px;font-weight:800;margin-top:2px;">${jenisGangguan}</div>
                    <div style="display:flex;gap:14px;margin-top:8px;font-size:11px;opacity:0.85;">
                        <span>✅ ${totalClose} Close</span>
                        <span>🔴 ${totalOpen} Open</span>
                        <span>⏸ ${totalPending} Pending</span>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.15);padding:8px 18px;border-radius:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:900;line-height:1;">${list.length}</div>
                    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;opacity:0.75;margin-top:2px;">Total</div>
                </div>
            </div>

            <!-- TABEL: HEADER DIAM, BODY SCROLL -->
            <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup>
                        <col style="width:40px;">
                        <col style="width:90px;">
                        <col style="width:180px;">
                        <col style="width:130px;">
                        <col style="width:120px;">
                        <col style="width:150px;">
                        <col style="width:130px;">
                        <col style="width:110px;">
                        <col style="width:80px;">
                        <col style="width:80px;">
                    </colgroup>
                    <thead>
                        <tr style="background:#0b1a33;color:white;">
                            <th style="padding:11px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">No</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tanggal</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tiket</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Customer</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">ODP</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Teknisi</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Jenis Gangguan</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Perbaikan</th>
                            <th style="padding:11px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                            <th style="padding:11px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Aksi</th>
                        </tr>
                    </thead>
                </table>
                <div style="max-height:360px;overflow-y:auto;overflow-x:hidden;">
                    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                        <colgroup>
                            <col style="width:40px;">
                            <col style="width:90px;">
                            <col style="width:180px;">
                            <col style="width:130px;">
                            <col style="width:120px;">
                            <col style="width:150px;">
                            <col style="width:130px;">
                            <col style="width:110px;">
                            <col style="width:80px;">
                            <col style="width:80px;">
                        </colgroup>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: '',
        html: html,
        width: 1200,
        showConfirmButton: false,
        showCloseButton: true,
        padding: '20px',
        customClass: { popup: 'swal-view-tiket-popup' }
    });
}


function viewTiketByPerbaikan(jenisPerbaikan) {
    const dateFrom = document.getElementById('filterLaporanDate')?.value || '';
    const dateTo = document.getElementById('filterLaporanDateTo')?.value || '';
    const bulan = document.getElementById('filterLaporanBulan')?.value || '';

    let list = tickets.filter(t => {
        return (t.jenisperbaikan || '-').toUpperCase() === jenisPerbaikan;
    });

    if (dateFrom || dateTo) {
        list = list.filter(t => {
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
        });
    }

    if (bulan === '3bulan') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        list = list.filter(t => new Date(t.createdAt) >= threeMonthsAgo);
    } else if (bulan !== '' && bulan !== '3bulan' && bulan !== 'all') {
        list = list.filter(t => new Date(t.createdAt).getMonth() == parseInt(bulan));
    }

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (list.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Info',
            text: 'Tidak ada tiket dengan jenis perbaikan "' + jenisPerbaikan + '"',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const fmtTgl = t => t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    }) : '-';

    const statusBadge = s => {
        if (s === 'open') return '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">● OPEN</span>';
        if (s === 'close') return '<span style="display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">✓ CLOSE</span>';
        if (s === 'pending') return '<span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">⏸ PENDING</span>';
        return '<span style="color:#94a3b8;">-</span>';
    };

    const totalClose = list.filter(t => t.status === 'close').length;
    const totalOpen = list.filter(t => t.status === 'open').length;
    const totalPending = list.filter(t => t.status === 'pending').length;

    let rows = '';
    list.forEach((t, i) => {
        const tech = (t.technicians || []).join(', ') || '-';
        rows += `<tr style="border-bottom:1px solid #eef2f7;">
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">${i + 1}</td>
            <td style="padding:10px 8px;font-size:12px;color:#334155;white-space:nowrap;">${fmtTgl(t)}</td>
            <td style="padding:10px 8px;font-size:12px;font-weight:700;color:#0b1a33;">${t.ticketid || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#334155;">${t.customer || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#64748b;">${t.odppelanggan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${tech}</td>
            <td style="padding:10px 8px;font-size:12px;color:#0b1a33;font-weight:600;">${t.jenisgangguan || '-'}</td>
            <td style="padding:10px 8px;font-size:12px;color:#475569;">${t.jenisperbaikan || '-'}</td>
            <td style="padding:10px 8px;text-align:center;">${statusBadge(t.status)}</td>
            <td style="padding:10px 8px;text-align:center;">
                <button onclick="goToTicket('${t.id}')"
                    style="padding:5px 12px;background:#2563eb;color:white;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>`;
    });

    const html = `
        <div style="text-align:left;font-family:'Inter',-apple-system,sans-serif;">
            <!-- HEADER INFO -->
            <div style="background:linear-gradient(135deg,#0b1a33,#1e3a6b);padding:18px 22px;border-radius:14px;margin-bottom:16px;color:white;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.6;font-weight:700;">Jenis Perbaikan</div>
                    <div style="font-size:20px;font-weight:800;margin-top:2px;">${jenisPerbaikan}</div>
                    <div style="display:flex;gap:14px;margin-top:8px;font-size:11px;opacity:0.85;">
                        <span>✅ ${totalClose} Close</span>
                        <span>🔴 ${totalOpen} Open</span>
                        <span>⏸ ${totalPending} Pending</span>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.15);padding:8px 18px;border-radius:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:900;line-height:1;">${list.length}</div>
                    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;opacity:0.75;margin-top:2px;">Total</div>
                </div>
            </div>

            <!-- TABEL: HEADER DIAM, BODY SCROLL -->
            <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup>
                        <col style="width:40px;">
                        <col style="width:90px;">
                        <col style="width:180px;">
                        <col style="width:130px;">
                        <col style="width:120px;">
                        <col style="width:150px;">
                        <col style="width:130px;">
                        <col style="width:110px;">
                        <col style="width:80px;">
                        <col style="width:80px;">
                    </colgroup>
                    <thead>
                        <tr style="background:#0b1a33;color:white;">
                            <th style="padding:11px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">No</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tanggal</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tiket</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Customer</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">ODP</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Teknisi</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Jenis Gangguan</th>
                            <th style="padding:11px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Perbaikan</th>
                            <th style="padding:11px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                            <th style="padding:11px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Aksi</th>
                        </tr>
                    </thead>
                </table>
                <div style="max-height:360px;overflow-y:auto;overflow-x:hidden;">
                    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                        <colgroup>
                            <col style="width:40px;">
                            <col style="width:90px;">
                            <col style="width:180px;">
                            <col style="width:130px;">
                            <col style="width:120px;">
                            <col style="width:150px;">
                            <col style="width:130px;">
                            <col style="width:110px;">
                            <col style="width:80px;">
                            <col style="width:80px;">
                        </colgroup>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: '',
        html: html,
        width: 1200,
        showConfirmButton: false,
        showCloseButton: true,
        padding: '20px',
        customClass: { popup: 'swal-view-tiket-popup' }
    });
}

// ============================================================
// EDIT JENIS GANGGUAN DARI MODAL VIEW LAPORAN
// ============================================================
// ============================================================
// EDIT JENIS GANGGUAN DARI MODAL VIEW LAPORAN
// MODAL CUSTOM — TIDAK MENUTUP MODAL SWEETALERT DI BELAKANG
// ============================================================
async function editJenisGangguanFromView(ticketId, jenisGangguanAwal) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
        Swal.fire('Error', 'Tiket tidak ditemukan!', 'error');
        return;
    }

    if (ticket.status !== 'close') {
        Swal.fire('Peringatan', 'Hanya tiket yang sudah close yang bisa diedit jenis gangguannya!', 'warning');
        return;
    }

    // SIMPAN JENIS GANGGUAN AWAL (YANG SEDANG DIBUKA DI MODAL VIEW)
    const jenisAwal = jenisGangguanAwal || ticket.jenisgangguan || 'Tidak diketahui';

    // HAPUS MODAL CUSTOM LAMA KALAU ADA
    const existing = document.getElementById('editJenisGangguanCustomModal');
    if (existing) existing.remove();

    // DROPDOWN JENIS GANGGUAN
    const optionsList = [
        'Ganti Adaptor',
        'Ganti HTB',
        'Ganti Modem',
        'Ganti Sandi',
        'Internet lambat',
        'Kabel Putus (LOS)',
        'Kabel Terjuntai',
        'Kelistrikan',
        'Modem Mati',
        'Pindah Modem',
        'Redaman Tinggi',
        'Tidak Ada Koneksi Internet',
        'GAMAS FEEDER',
        'GAMAS DISTRIBUSI',
        'GAMAS ODP',
        'PROJECT'
    ];

    let optionsHtml = '';
    optionsList.forEach(opt => {
        const selected = (opt === ticket.jenisgangguan) ? 'selected' : '';
        optionsHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
    });

    // BUAT MODAL CUSTOM (Z-INDEX DI ATAS SWEETALERT)
    const modal = document.createElement('div');
    modal.id = 'editJenisGangguanCustomModal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 99999999;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:0;max-width:480px;width:100%;box-shadow:0 25px 80px rgba(0,0,0,0.35);animation:slideUp 0.25s ease;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0b1a33,#1e3a6b);padding:18px 24px;color:white;display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:16px;font-weight:700;">✏️ Edit Jenis Gangguan</div>
                <button onclick="closeEditJenisGangguanCustom()" style="background:rgba(255,255,255,0.15);border:none;color:white;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer;">✕</button>
            </div>
            <div style="padding:20px 24px;">
                <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;margin-bottom:14px;">
                    <p style="font-size:13px;color:#475569;margin:0;">
                        <strong>Tiket:</strong> ${ticket.ticketid || '-'} • <strong>Customer:</strong> ${ticket.customer || '-'}
                    </p>
                </div>
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;font-size:13px;">
                    Jenis Gangguan saat ini:
                </label>
                <div style="background:#f1f5f9;padding:8px 14px;border-radius:8px;margin-bottom:14px;font-weight:600;color:#0b1a33;font-size:14px;">
                    ${ticket.jenisgangguan || '-'}
                </div>
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;font-size:13px;">
                    Jenis Gangguan baru:
                </label>
                <select id="customEditJenisGangguanSelect"
                    style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;background:white;">
                    ${optionsHtml}
                </select>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;padding-top:16px;border-top:1px solid #e2e8f0;">
                    <button onclick="closeEditJenisGangguanCustom()" style="padding:9px 22px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">
                        ✕ Batal
                    </button>
                    <button onclick="saveEditJenisGangguanCustom('${ticketId}', '${jenisAwal.replace(/'/g, "\\'")}')" style="padding:9px 26px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
                        💾 Simpan
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeEditJenisGangguanCustom() {
    const modal = document.getElementById('editJenisGangguanCustomModal');
    if (modal) modal.remove();
    // MODAL SWEETALERT (VIEW) TETAP ADA DI BELAKANG
}

async function saveEditJenisGangguanCustom(ticketId, jenisGangguanAwal) {
    const sel = document.getElementById('customEditJenisGangguanSelect');
    if (!sel) return;

    const newJenisGangguan = sel.value;
    if (!newJenisGangguan) {
        notif('⚠️ Jenis gangguan tidak boleh kosong!', 'warning');
        return;
    }

    // JENIS GANGGUAN AWAL (YANG SEDANG DIBUKA DI MODAL VIEW)
    const jenisAwal = jenisGangguanAwal || 'Tidak diketahui';

    try {
        const { error } = await sb
            .from('tickets')
            .update({ jenisgangguan: newJenisGangguan })
            .eq('id', ticketId);

        if (error) throw error;

        notif('✅ Jenis gangguan berhasil diupdate!', 'success');

        // TUTUP MODAL CUSTOM EDIT
        closeEditJenisGangguanCustom();

        // ===== REFRESH DATA ARRAY TANPA MENUTUP MODAL SWEETALERT =====
        const { data: freshTickets } = await sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(500);

        if (freshTickets) {
            tickets = freshTickets;
            localStorage.setItem('tickets_data', JSON.stringify(tickets));
            localStorage.setItem('tickets_last_fetch', new Date().toDateString());
        }

        // Render ulang tabel laporan di background
        if (typeof renderReports === 'function') renderReports();

        // ===== TUTUP MODAL VIEW LAMA, LALU BUKA ULANG DENGAN JENIS GANGGUAN AWAL =====
        Swal.close();
        setTimeout(() => {
            viewTiketByGangguan(jenisAwal);
        }, 200);

    } catch (e) {
        notif('❌ Gagal update jenis gangguan: ' + e.message, 'danger');
    }
}

    function viewOverdueTickets(techName) {
        const overdueTickets = tickets.filter(t => {
            if (!t.technicians || !t.technicians.includes(techName)) return false;
            if (t.status !== 'open' && t.status !== 'close') return false;
            const ttr = t.ttr || 0;
            return ttr > t.duration;
        });
        
        if (overdueTickets.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Info',
                text: 'Tidak ada tiket overdue untuk teknisi ' + techName,
                confirmButtonColor: '#2563eb'
            });
            return;
        }
        
        let html = `<div style="text-align:left; max-height:400px; overflow-y:auto; font-size:13px;">
            <p style="margin-bottom:10px; font-weight:600; color:#dc2626;">
                Total ${overdueTickets.length} tiket overdue untuk <strong>${techName}</strong>
            </p>
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="padding:6px 10px; text-align:left;">Tiket</th>
                        <th style="padding:6px 10px; text-align:left;">Customer</th>
                        <th style="padding:6px 10px; text-align:left;">Tanggal</th>
                        <th style="padding:6px 10px; text-align:left;">Durasi</th>
                        <th style="padding:6px 10px; text-align:left;">TTR</th>
                        <th style="padding:6px 10px; text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody>`;
        
        overdueTickets.forEach(t => {
            const statusLabel = t.status === 'close' ? '✅ CLOSE' : '🔴 OPEN';
            const statusClass = t.status === 'close' ? 'close' : 'open';
            const ttrDisplay = t.ttr ? formatDur(t.ttr) : '-';
            const tanggal = t.createdAt ? formatDate(t.createdAt) : '-';
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 10px;"><strong>${t.ticketid}</strong></td>
                <td style="padding:6px 10px;">${t.customer}</td>
                <td style="padding:6px 10px;">${tanggal}</td>
                <td style="padding:6px 10px;">${formatDur(t.duration)}</td>
                <td style="padding:6px 10px; color:#dc2626; font-weight:600;">${ttrDisplay}</td>
                <td style="padding:6px 10px;"><span class="badge-status ${statusClass}">${statusLabel}</span></td>
            </tr>`;
        });
        
        html += `</tbody></table></div>`;
        
        Swal.fire({
            title: `📋 Tiket Overdue - ${techName}`,
            html: html,
            icon: 'warning',
            width: 750,
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#2563eb',
            showCloseButton: true
        });
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
        var jenisTiket = t.jenistiket || '';
        
        // ✅ HANYA PROSES GGN DAN GAMAS
        if (jenisTiket !== 'GGN' && jenisTiket !== 'GAMAS') {
            return;
        }
        
        var jenis = t.jenisgangguan || 'Tidak diketahui';
        
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
    if (bulanFilter === '') {
        var nowMonth = new Date().getMonth();
        bulanFilter = String(nowMonth);
    }
    
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
        var jenis = t.jenistiket || '';
        
        // LEWATKAN PSB, GAMAS, DAN PROJECT
        if (jenis === 'PSB') continue;
        if (jenis === 'GAMAS') continue;
        if (jenis === 'PROJECT') continue;
        
        // VALIDASI DATE
        var d = new Date(t.createdAt);
        if (isNaN(d.getTime())) {
            console.log('⚠️ Invalid date:', t.createdAt);
            continue;
        }
        
        if (d >= start) {
            filteredTickets.push(t);
        }
    }
    
    if (bulanFilter !== '') {
        var temp = [];
        for (var j = 0; j < filteredTickets.length; j++) {
            var t2 = filteredTickets[j];
            var d2 = new Date(t2.createdAt);
            if (!isNaN(d2.getTime()) && d2.getMonth() == parseInt(bulanFilter)) {
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
        if (isNaN(d3.getTime())) continue;
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
        if (isNaN(date.getTime())) continue;
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
    areaGradient.addColorStop(0, 'rgba(220, 38, 38, 0.6)');
    areaGradient.addColorStop(0.5, 'rgba(220, 38, 38, 0.3)');
    areaGradient.addColorStop(1, 'rgba(220, 38, 38, 0.02)');
    
    window.grafikHarianInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tiket',
                data: data,
                borderColor: '#dc2626',
                backgroundColor: areaGradient,
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#dc2626',
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
                    borderColor: '#dc2626',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            var val = context.parsed.y;
                            if (val === 0) return 'Tidak ada tiket';
                            return val + ' tiket';
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
                            if (isNaN(date.getTime())) return label;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = tickets.filter(t => {
        if (!t.createdAt) return false;
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
    } else if (filterType === 'gamas') {
        filtered = filtered.filter(t => (t.jenistiket || '') === 'GAMAS');
    } else if (filterType === 'project') {
        filtered = filtered.filter(t => (t.jenistiket || '') === 'PROJECT');
    } else if (filterType === 'lainnya') {
        filtered = filtered.filter(t => (t.jenistiket || '') === 'LAINNYA');
    } else if (filterType === 'overdue') {
        filtered = filtered.filter(t => {
            if (t.status === 'open' || t.status === 'close') {
                return (t.ttr || 0) > t.duration;
            }
            return false;
        });
    } else if (filterType === 'gaul') {
        const gaulSet = getPelangganGaul();
        filtered = filtered.filter(t => gaulSet.has(t.kodePelanggan));
    }

    // TAMPILKAN DI TABEL TIKET TERBARU DASHBOARD
    const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const body = document.getElementById('dashTicketBody');
    const countEl = document.getElementById('dashTicketCount');

    if (!body) return;

    if (countEl) {
        countEl.textContent = filtered.length + ' tiket (' + filterType.toUpperCase() + ')';
    }

    if (sorted.length === 0) {
        body.innerHTML = '<tr><td colspan="8"><div class="empty">Tidak ada tiket</div></td></tr>';
        return;
    }

    body.innerHTML = sorted.map(t => {
        const jenisTiket = t.jenistiket || '-';
        let jenisBadge = '';
        if (jenisTiket === 'GAMAS') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#dc2626;color:white;">GAMAS</span>';
        } else if (jenisTiket === 'PSB') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#10b981;color:white;">PSB</span>';
        } else if (jenisTiket === 'PROJECT') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#8b5cf6;color:white;">PROJECT</span>';
        } else if (jenisTiket === 'LAINNYA') {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#64748b;color:white;">LAIN-LAIN</span>';
        } else {
            jenisBadge = '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#2563eb;color:white;">RETAIL</span>';
        }

        const statusMap = {
            'open': '🔴 OPEN',
            'pending': '⏸ PENDING',
            'close': '✅ CLOSE'
        };

        let ttrDisplay = '-';
        let isOverdue = false;
        if (t.status === 'open') {
            const now = new Date();
            const createdAt = new Date(t.createdAt);
            const elapsedMs = now.getTime() - createdAt.getTime();
            const elapsedMinutes = elapsedMs / 60000;
            const remainingMinutes = t.duration - elapsedMinutes;
            if (remainingMinutes <= 0) {
                isOverdue = true;
                ttrDisplay = `<span class="live-timer overdue" style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">🔴 +${formatDur(Math.abs(remainingMinutes))}</span>`;
            } else {
                ttrDisplay = `<span class="live-timer" style="background:#dcfce7;color:#166534;padding:2px 12px;border-radius:6px;font-weight:600;">⏳ ${formatDur(remainingMinutes)}</span>`;
            }
        } else if (t.status === 'close') {
            const diff = (t.ttr || 0) - t.duration;
            if (diff > 0) {
                isOverdue = true;
                ttrDisplay = `<span style="color:#dc2626;font-weight:700;">+${formatDur(diff)}</span>`;
            } else if (diff < 0) {
                ttrDisplay = `<span style="color:#166534;font-weight:600;">-${formatDur(Math.abs(diff))}</span>`;
            } else {
                ttrDisplay = `<span style="color:#059669;font-weight:600;">00:00:00</span>`;
            }
        } else if (t.status === 'pending') {
            ttrDisplay = `<span style="color:#6b7280;">⏸ pending</span>`;
        }

        return `
        <tr style="cursor:pointer;" onclick="goToTicket('${t.id}')" title="Klik untuk lihat detail tiket">
            <td>${formatDate(t.createdAt)}</td>
            <td>
                <span class="badge-status ${t.status}">${statusMap[t.status] || t.status}</span>
                ${isOverdue ? ' <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#dc2626;animation:blink 1s infinite;margin-left:6px;vertical-align:middle;"></span>' : ''}
            </td>
            <td>${jenisBadge}</td>
            <td style="color:#000000; font-weight:400;">${t.ticketid}</td>
            <td>${t.customer}</td>
            <td>${t.jenistiket === 'PSB' ? '-' : (t.jenisgangguan || '-')}</td>
            <td class="dash-ttr-cell" data-ticket-id="${t.id}">${ttrDisplay}</td>
            <td>${(t.technicians || []).join(', ') || '-'}</td>
        </tr>
        `;
    }).join('');
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
            html += '<th>Durasi</th><th>TTR</th><th>Status</th><th>Keterangan</th><th>Jenis Perbaikan</th><th>Imbas GAMAS</th>';
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
                html += '<td>' + (t.imbas_gamas || '-') + '</td>';
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
        const odpFilter = (document.getElementById('filterLaporanOdp')?.value || '').toLowerCase().trim();

        console.log('Filter dipanggil:', dateFrom, dateTo, bulan, odpFilter);

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

        // FILTER ODP / WILAYAH
        if (odpFilter) {
            filtered = filtered.filter(t => {
                const odp = (t.odppelanggan || '').toLowerCase();
                return odp.includes(odpFilter);
            });
        }

        console.log('Jumlah data setelah filter:', filtered.length);

        // ✅ RENDER PAKAI DATA YANG SUDAH DIFILTER (JANGAN DITIMPA renderReports)
        renderFilteredData(filtered);
    }


    // ===== RENDER DATA HASIL FILTER =====
        function renderFilteredData(filteredTickets) {
        // ===== UPDATE PERIODE & TOTAL DATA =====
        const now = new Date();
        const filterFrom = document.getElementById('filterLaporanDate')?.value || '';
        const filterTo = document.getElementById('filterLaporanDateTo')?.value || '';
        const filterBulan = document.getElementById('filterLaporanBulan')?.value || '';
        const odpFilter = (document.getElementById('filterLaporanOdp')?.value || '').trim();

        let startDate = 'Tidak ada data';
        let endDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

        if (filteredTickets.length > 0) {
            const sorted = [...filteredTickets].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            startDate = new Date(sorted[0].createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            endDate = new Date(sorted[sorted.length - 1].createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        }

        let periodText = '';
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
            periodText = `${startDate} - ${endDate}`;
        }

        document.getElementById('reportPeriod').textContent = periodText;
        document.getElementById('reportTotalData').textContent = filteredTickets.length;

        // ===== CEK KOSONG =====
        if (filteredTickets.length === 0) {
            document.getElementById('jenisgangguanReportBody').innerHTML = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
            document.getElementById('customerReportBody').innerHTML = '<tr><td colspan="6"><div class="empty">Tidak ada data</div></td></tr>';
            document.getElementById('gaulReportBody').innerHTML = '<tr><td colspan="3"><div class="empty">Tidak ada data</div></td></tr>';
            document.getElementById('gaulTimReportBody').innerHTML = '<tr><td colspan="3"><div class="empty">Tidak ada data</div></td></tr>';
            document.getElementById('topTeknisiBody').innerHTML = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
            document.getElementById('topTimBody').innerHTML = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
            document.getElementById('produktivitasReportBody').innerHTML = '<tr><td colspan="7"><div class="empty">Tidak ada data</div></td></tr>';
            renderCharts([]);
            return;
        }

        // ===== JENIS GANGGUAN =====
        const gMap = {};
        filteredTickets.forEach(t => {
            const jenisTiket = t.jenistiket || '';
            if (jenisTiket !== 'GGN' && jenisTiket !== 'GAMAS') return;
            const jenis = t.jenisgangguan || 'Tidak diketahui';
            gMap[jenis] = (gMap[jenis] || 0) + 1;
        });
        const sortedG = Object.entries(gMap).sort((a,b) => b[1] - a[1]);
        const totalG = filteredTickets.length;
        let htmlG = '';
        if (sortedG.length === 0) {
            htmlG = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
            sortedG.forEach(([jenis, count], i) => {
                const persen = ((count / totalG) * 100).toFixed(1);
                htmlG += `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
                    <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${i+1}</td>
                    <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;"><strong>${jenis}</strong></td>
                    <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${count}</td>
                    <td style="padding:8px 16px; text-align:left; border:1px solid #e2e8f0;">${persen}%</td>
                    <td style="padding:8px 16px; text-align:center; border:1px solid #e2e8f0;">
                        <button class="btn btn-primary btn-sm" onclick="viewTiketByGangguan('${jenis.replace(/'/g, "\\'")}')" style="padding:4px 12px;font-size:11px;">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('jenisgangguanReportBody').innerHTML = htmlG;

        // ===== TOP PELANGGAN (HANYA GGN) =====
        const customerMap = {};
        const ggnTickets = filteredTickets.filter(t => {
            const jenisTiket = t.jenistiket || '';
            return jenisTiket === 'GGN' || jenisTiket === '' || jenisTiket === null;
        });

        const filterCustSearch = (document.getElementById('filterCustomerSearch')?.value || '').toLowerCase().trim();
        let ggnTicketsFiltered = ggnTickets;
        if (filterCustSearch) {
            ggnTicketsFiltered = ggnTicketsFiltered.filter(t => {
                const nama = (t.customer || '').toLowerCase();
                const idPel = (t.kodePelanggan || '').toLowerCase();
                const odp = (t.odppelanggan || '').toLowerCase();
                return nama.includes(filterCustSearch) || idPel.includes(filterCustSearch) || odp.includes(filterCustSearch);
            });
        }

        ggnTicketsFiltered.forEach(t => {
            const cust = t.customer || 'Tidak diketahui';
            if (!customerMap[cust]) {
                customerMap[cust] = { 
                    total: 0,
                    odppelanggan: t.odppelanggan || '-',
                    kodepelanggan: t.kodePelanggan || '-'
                };
            }
            customerMap[cust].total++;
        });

        const sortedCustomers = Object.entries(customerMap)
            .sort((a,b) => b[1].total - a[1].total)
            .slice(0, 10);

        let htmlC = '';
        if (sortedCustomers.length === 0) {
            htmlC = '<tr><td colspan="6"><div class="empty">Tidak ada data pelanggan GGN</div></td></tr>';
        } else {
            sortedCustomers.forEach(([cust, data], i) => {
                htmlC += `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${cust}</strong></td>
                    <td>${data.kodepelanggan}</td>
                    <td>${data.odppelanggan}</td>
                    <td>${data.total}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="viewCustomerGangguan('${cust}')" style="padding:2px 12px; font-size:11px;">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('customerReportBody').innerHTML = htmlC;

        // ===== GAUL (pakai helper, ikut filter) =====
        const gaulMapFiltered = getTeknisiGaulMap(2, filteredTickets);
        const sortedGaulFiltered = Object.entries(gaulMapFiltered).sort((a,b) => b[1] - a[1]).slice(0,10);

        let htmlGaul = '';
        if (sortedGaulFiltered.length === 0) {
            htmlGaul = '<tr><td colspan="3"><div class="empty">Tidak ada data GAUL</div></td></tr>';
        } else {
            sortedGaulFiltered.forEach(([tech, count], i) => {
                htmlGaul += `<tr onclick="viewGaulHistory('${tech}')" style="cursor:pointer;">
                    <td>${i+1}</td>
                    <td><strong>${tech}</strong></td>
                    <td>${count}</td>
                </tr>`;
            });
        }
        document.getElementById('gaulReportBody').innerHTML = htmlGaul;

        // ===== TIM GAUL (pakai helper, ikut filter) =====
        const timGaulMapFiltered = getTimGaulMap(2, filteredTickets);
        const sortedTimGaulFiltered = Object.entries(timGaulMapFiltered).sort((a,b) => b[1].total - a[1].total).slice(0,10);

        let htmlTimGaul = '';
        if (sortedTimGaulFiltered.length === 0) {
            htmlTimGaul = '<tr><td colspan="3"><div class="empty">Tidak ada data Tim GAUL</div></td></tr>';
        } else {
            sortedTimGaulFiltered.forEach(([timKey, data], i) => {
                const namaTim = data.anggota.join(', ');
                htmlTimGaul += `<tr onclick="viewTimGaulHistory('${timKey}')" style="cursor:pointer;">
                    <td>${i+1}</td>
                    <td><strong>${namaTim}</strong></td>
                    <td>${data.total}</td>
                </tr>`;
            });
        }
        document.getElementById('gaulTimReportBody').innerHTML = htmlTimGaul;

        // ===== TEKNISI TERBAIK (PSB/GGN) =====
        const topTeknisi = getTopTeknisi(filteredTickets);
        let topTeknisiHtml = '';
        if (topTeknisi.length === 0) {
            topTeknisiHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
            topTeknisi.forEach((d, i) => {
                let medal = '';
                if (i === 0) medal = ' 🥇';
                else if (i === 1) medal = ' 🥈';
                else if (i === 2) medal = ' 🥉';
                topTeknisiHtml += `<tr>
                    <td style="text-align:center;">${i + 1}</td>
                    <td style="text-align:left;"><strong>${d.name}</strong>${medal}</td>
                    <td style="text-align:center;">${d.total}</td>
                    <td style="text-align:center;color:#16a34a;font-weight:700;">${d.tepat}</td>
                    <td style="text-align:center;">
                        <span style="font-weight:700;color:${d.rate >= 80 ? '#16a34a' : d.rate >= 50 ? '#f59e0b' : '#dc2626'};">
                            ${d.rate.toFixed(0)}%
                        </span>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('topTeknisiBody').innerHTML = topTeknisiHtml;

        // ===== TIM TERBAIK (PSB/GGN) =====
        const topTim = getTopTim(filteredTickets);
        let topTimHtml = '';
        if (topTim.length === 0) {
            topTimHtml = '<tr><td colspan="5"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
            topTim.forEach((d, i) => {
                let medal = '';
                if (i === 0) medal = ' 🥇';
                else if (i === 1) medal = ' 🥈';
                else if (i === 2) medal = ' 🥉';
                topTimHtml += `<tr>
                    <td style="text-align:center;">${i + 1}</td>
                    <td style="text-align:left;"><strong>${d.name}</strong>${medal}</td>
                    <td style="text-align:center;">${d.total}</td>
                    <td style="text-align:center;color:#16a34a;font-weight:700;">${d.tepat}</td>
                    <td style="text-align:center;">
                        <span style="font-weight:700;color:${d.rate >= 80 ? '#16a34a' : d.rate >= 50 ? '#f59e0b' : '#dc2626'};">
                            ${d.rate.toFixed(0)}%
                        </span>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('topTimBody').innerHTML = topTimHtml;

        // ===== PRODUKTIVITAS =====
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
        if (sortedTech.length === 0) {
            htmlT = '<tr><td colspan="7"><div class="empty">Tidak ada data</div></td></tr>';
        } else {
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
        }
        document.getElementById('produktivitasReportBody').innerHTML = htmlT;

        // ===== CHART =====
        renderCharts(filteredTickets);
    }

    // ===== RESET FILTER =====
    function resetLaporanFilter() {
        document.getElementById('filterLaporanDate').value = '';
        document.getElementById('filterLaporanDateTo').value = '';
        document.getElementById('filterLaporanBulan').value = '3bulan';
        document.getElementById('filterLaporanOdp').value = '';
        
        // RESET FILTER PENCARIAN PELANGGAN
        const searchInput = document.getElementById('filterCustomerSearch');
        if (searchInput) searchInput.value = '';
        
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

            

            // ============================================================
// RENDER TEKNISI - TANPA PROJECT
// ============================================================
function renderTechList() {
    const container = document.getElementById('techTablesContainer');
    if(!container) return;
    
    if(techs.length === 0) {
        container.innerHTML = '<div class="empty"><span class="icon">👨‍🔧</span><p>Belum ada teknisi</p></div>';
        return;
    }
    
    // GROUP BY POSISI
    const groups = {};
    techs.forEach(t => {
        const posisi = t.posisi || 'PSB/GGN';
        if (!groups[posisi]) groups[posisi] = [];
        groups[posisi].push(t);
    });
    
    // HANYA PSB/GGN DAN BACKBONE (BUANG PROJECT)
    const posisiOrder = ['PSB/GGN', 'BACKBONE'];
    let html = '';
    
    posisiOrder.forEach(posisi => {
        const techList = groups[posisi] || [];
        
        let headerColor = '#0b1a33';
        if (posisi === 'BACKBONE') { headerColor = '#92400e'; }
        
        html += `<div style="margin-top:20px;border:2px solid ${headerColor};border-radius:12px;overflow:hidden;">`;
        html += `<div style="background:${headerColor};color:white;padding:10px 16px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;align-items:center;">
            <span>${posisi}</span>
            <span style="font-size:13px;font-weight:100;background:rgba(255,255,255,0.2);padding:2px 14px;border-radius:20px;">${techList.length} teknisi</span>
        </div>`;
        html += `<div class="table-wrap" style="border:none;border-radius:0;overflow-x:auto;">`;
        html += `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><thead><tr>
            <th style="width:80px;padding:10px 12px;text-align:left;">No</th>
            <th style="padding:10px 12px;text-align:left;">Nama</th>
            <th style="width:120px;padding:10px 12px;text-align:left;">HP</th>
            <th style="width:200px;padding:10px 12px;text-align:left;">Aksi</th>
        </tr></thead><tbody>`;
        
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
                    
                    // ===== UPDATE LANGSUNG techs DI MEMORY =====
                    const techIndex = techs.findIndex(t => t.id === id);
                    if (techIndex !== -1) {
                        techs[techIndex] = { ...techs[techIndex], name: name, phone: phone || '-', posisi: posisi };
                    } else {
                        // KALAU techs KOSONG, AMBIL ULANG
                        await loadTechniciansCache();
                    }
                    
                    // ===== HAPUS CACHE =====
                    localStorage.removeItem('techs_data');
                    localStorage.removeItem('techs_last_fetch');
                    
                    // ===== RENDER ULANG SEMUA =====
                    renderTechList();
                    renderTechDropdown();
                    renderPerformance();
                    renderReports();
                    renderDashboard();
                    
                    // ===== REFRESH TIKET JUGA =====
                    await refreshData();
                    
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
            
            // ✅ LOG AKTIVITAS
            await logActivity('CREATE', {
                table: 'technicians',
                recordId: name,
                description: `Tambah teknisi: ${name} (${posisi})`,
                newValue: { name, phone, posisi }
            });

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
                
                // ✅ LOG AKTIVITAS
                await logActivity('DELETE', {
                    table: 'technicians',
                    recordId: tech.name,
                    description: `Hapus teknisi: ${tech.name}`,
                    oldValue: { name: tech.name, phone: tech.phone, posisi: tech.posisi }
                });

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
    if (!id) {
        Swal.fire('Peringatan', 'ID Tiket kosong!', 'warning');
        ticketIdInput.focus();
        return;
    }

    const jenisTiket = document.getElementById('jenisTiket').value;
    const kodePelanggan = document.getElementById('kodePelanggan').value.trim();

    let cust = '';
if (jenisTiket === 'LAINNYA') {
    const keperluanEl = document.getElementById('kodePelanggan');
    cust = keperluanEl ? keperluanEl.value.trim() : '-';
} else if (jenisTiket === 'MIGRASI') {
    cust = '-';
} else if (jenisTiket === 'PROJECT') {
    const pekerjaanEl = document.getElementById('kodePelanggan');
    cust = pekerjaanEl ? pekerjaanEl.value.trim() : '-';
} else {
    cust = sanitize(document.getElementById('customer').value.trim());
}

        const odpPelanggan = document.getElementById('odpPelanggan') ? document.getElementById('odpPelanggan').value.trim() : '';
    const wilayahVal = document.getElementById('wilayahPelanggan') ? document.getElementById('wilayahPelanggan').value.trim() : '';
    let desc = sanitize(document.getElementById('jenisGangguan').value.trim());
    if (jenisTiket === 'LAINNYA') {
        const keperluanEl = document.getElementById('kodePelanggan');
        desc = keperluanEl ? keperluanEl.value.trim() : '-';
    }
    if (jenisTiket === 'MIGRASI') {
        desc = 'MIGRASI';
    }
    const dur = parseInt(document.getElementById('duration').value);
    const manualDate = document.getElementById('createdAtManual').value;
        const odpTerimbas = document.getElementById('odpTerimbas') ? document.getElementById('odpTerimbas').value.trim() : '';

    if ((jenisTiket === 'PSB' || jenisTiket === 'GGN') && !kodePelanggan) {
        notif('⚠️ ID / Kode Pelanggan wajib diisi untuk tiket ' + jenisTiket + '!', 'warning');
        document.getElementById('kodePelanggan').focus();
        document.getElementById('kodePelanggan').style.borderColor = '#dc2626';
        setTimeout(() => {
            document.getElementById('kodePelanggan').style.borderColor = '#d1d9e6';
        }, 3000);
        return;
    }

        if (jenisTiket === 'LAINNYA') {
        if (!dur || selectedTechs.length === 0) {
            notif('Isi durasi dan pilih minimal 1 teknisi!','warning');
            return;
        }
    } else if (jenisTiket === 'MIGRASI') {
        if (!dur || selectedTechs.length === 0) {
            notif('Isi durasi dan pilih minimal 1 teknisi!','warning');
            return;
        }
    } else if (jenisTiket === 'GAMAS') {
        if (!dur || selectedTechs.length === 0) {
            notif('Isi durasi dan pilih minimal 1 teknisi!','warning');
            return;
        }
    } else if (jenisTiket === 'PROJECT') {
    if (!dur || selectedTechs.length === 0) {
        notif('Isi durasi dan pilih minimal 1 teknisi!','warning');
        return;
    }
} else {
    if (!cust || !dur || selectedTechs.length === 0) {
        notif('Isi semua field dan pilih minimal 1 teknisi!','warning');
        return;
    }
}

    if ((jenisTiket === 'PSB' || jenisTiket === 'GGN' || jenisTiket === 'GAMAS' || jenisTiket === 'MIGRASI') && !odpPelanggan) {
        notif('⚠️ ODP / Wilayah wajib diisi untuk tiket ' + jenisTiket + '!', 'warning');
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

    if (jenisTiket !== 'MIGRASI' && jenisTiket !== 'LAINNYA' && jenisTiket !== 'PROJECT') {
    const canProceed = await checkDuplicateCustomer(cust);
    if(!canProceed) return;
}

    let createdAt;
    if (manualDate) {
        const parts = manualDate.split('T');
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split(':');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);
        const selectedDate = new Date(year, month, day, hour, minute);
        if (isNaN(selectedDate.getTime())) {
            notif('Format tanggal tidak valid!', 'warning');
            return;
        }
        createdAt = selectedDate.toISOString();
    } else {
        createdAt = new Date().toISOString();
    }

    if (manualDate && new Date(manualDate) > new Date()) {
        notif('Waktu tidak boleh melebihi sekarang!', 'warning');
        return;
    }

    try {
        const tagingLokasiVal = document.getElementById('tagingLokasi') ? document.getElementById('tagingLokasi').value.trim() : '';
        const tagingOdpVal = document.getElementById('tagingOdp') ? document.getElementById('tagingOdp').value.trim() : '';
        const noHpVal = document.getElementById('noHpPelanggan') ? document.getElementById('noHpPelanggan').value.trim() : '';

                let fotoRumahUrl = '-';
        let fotoKtpUrl = '-';

        const inputFR = document.getElementById('fotoRumahInput');
        if (inputFR && inputFR.files && inputFR.files[0]) {
            let f = inputFR.files[0];
            f = await compressImage(f, 1280, 0.7);
            const fn = 'tiket_fr_' + Date.now() + '_' + f.name;
            const { error: ue1 } = await sb.storage.from('pelanggan-foto').upload(fn, f);
            if (!ue1) {
                const { data: u1 } = sb.storage.from('pelanggan-foto').getPublicUrl(fn);
                fotoRumahUrl = u1.publicUrl;
            }
        }

        const inputFK = document.getElementById('fotoKtpInput');
        if (inputFK && inputFK.files && inputFK.files[0]) {
            let f = inputFK.files[0];
            f = await compressImage(f, 1280, 0.7);
            const fn = 'tiket_fk_' + Date.now() + '_' + f.name;
            const { error: ue2 } = await sb.storage.from('pelanggan-foto').upload(fn, f);
            if (!ue2) {
                const { data: u2 } = sb.storage.from('pelanggan-foto').getPublicUrl(fn);
                fotoKtpUrl = u2.publicUrl;
            }
        }

        const { error } = await sb
            .from('tickets')
            .insert({
                ticketid: id,
                customer: (jenisTiket === 'MIGRASI') ? '-' : cust,
                duration: dur,
                jenisgangguan: (jenisTiket === 'LAINNYA') ? kodePelanggan : desc,
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
                no_tlp: noHpVal || '-',
                odp_terimbas: odpTerimbas || '-',
                odppelanggan: odpPelanggan || '-',
                wilayahpelanggan: wilayahVal || '-',
                kodePelanggan: kodePelanggan || '-',
                taging_lokasi: tagingLokasiVal || '-',
                taging_odp: tagingOdpVal || '-',
                foto_rumah: fotoRumahUrl,
                foto_ktp: fotoKtpUrl
            });
                if (error) throw error;

                // ✅ LOG HISTORY: TIKET DIBUAT
        await logTicketHistory(id, 'create', {
            description: `🎫 Tiket ${jenisTiket} dibuat oleh admin`,
            newValue: jenisTiket
        });

        // ✅ LOG AKTIVITAS
        await logActivity('CREATE', {
            table: 'tickets',
            recordId: id,
            description: `Buat tiket ${jenisTiket}: ${id} - ${cust || 'Tanpa nama'}`,
            newValue: { ticketid: id, jenis: jenisTiket, customer: cust }
        });

        document.getElementById('ticketId').value = '';
        document.getElementById('customer').value = '';
        document.getElementById('jenisGangguan').value = '';
        document.getElementById('duration').value = '60';
        document.getElementById('createdAtManual').value = '';
        document.getElementById('jenisTiket').value = 'PSB';
        document.getElementById('odpPelanggan').value = '';
        document.getElementById('kodePelanggan').value = '';
        if (document.getElementById('wilayahPelanggan')) document.getElementById('wilayahPelanggan').value = '';
        if (document.getElementById('noHpPelanggan')) document.getElementById('noHpPelanggan').value = '';
        if (document.getElementById('tagingLokasi')) document.getElementById('tagingLokasi').value = '';
        if (document.getElementById('tagingOdp')) document.getElementById('tagingOdp').value = '';
        if (document.getElementById('fotoRumahInput')) document.getElementById('fotoRumahInput').value = '';
        if (document.getElementById('fotoKtpInput')) document.getElementById('fotoKtpInput').value = '';
        if (document.getElementById('fotoRumahPreview')) document.getElementById('fotoRumahPreview').innerHTML = '';
        if (document.getElementById('fotoKtpPreview')) document.getElementById('fotoKtpPreview').innerHTML = '';
        updateJenisGangguan();
        selectedTechs = [];
        renderTechDropdown();

        // ✅ REGENERATE TIKET BARU
        generateTicketId('PSB').then(function(newId) {
            document.getElementById('ticketId').value = newId;
        });

        notif('Tiket ' + id + ' berhasil dibuat!', 'success');

        // ✅ AUTO-SEND TELEGRAM
        const telegramPayload = {
            ticketid: id,
            customer: (jenisTiket === 'LAINNYA' || jenisTiket === 'MIGRASI' || jenisTiket === 'GAMAS') ? '-' : cust,
            kodePelanggan: kodePelanggan || '-',
            no_tlp: noHpVal || '-',
            odppelanggan: odpPelanggan || '-',
            wilayahpelanggan: wilayahVal || '-',
            // ✅ UDAH GW BENERIN JADI NGAMBIL VARIABEL YANG UDAH LO DEKLARASIIN DI ATAS
            taging_lokasi: tagingLokasiVal || '-', 
            taging_odp: tagingOdpVal || '-',
            jenistiket: jenisTiket,
            jenisgangguan: (jenisTiket === 'LAINNYA') ? kodePelanggan : desc,
            duration: dur,
            createdAt: createdAt,
            odp_terimbas: odpTerimbas || '-',
            keterangangamas: document.getElementById('keteranganGamas') ? document.getElementById('keteranganGamas').value.trim() : '-'
        };

        showTicketTemplate(telegramPayload);

        // Kirim ke Telegram (kalau aktif)
        if (getSetting('auto_send_telegram', 'false') === 'true') {
            sendTelegramNotification(telegramPayload, jenisTiket);
        }

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
            // HITUNG TOTAL DURASI PENDING
            const pendingAt = ticket.pendingAt ? new Date(ticket.pendingAt) : null;
            const now = new Date();
            let totalPendingMs = ticket.pendingDuration || 0;
            
            if (pendingAt) {
                totalPendingMs += (now.getTime() - pendingAt.getTime());
            }

            const { error } = await sb
                .from('tickets')
                .update({
                    status: 'open',
                    pendingAt: null,
                    pendingDuration: totalPendingMs
                })
                .eq('id', docId);

            if (error) throw error;
            notif('Tiket ' + ticket.ticketId + ' dilanjutkan', 'info');
            refreshData();
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

        // ✅ LOG HISTORY: PENDING
        await logTicketHistory(ticket.ticketid, 'pending', {
            description: `⏸️ Tiket di-pending: ${alasan}`,
            newValue: alasan
        });

        notif('Tiket ' + ticket.ticketId + ' di-pending', 'warning');
        refreshData();
    } catch (e) {
        notif('Gagal pending: ' + e.message, 'danger');
    }
}


// ============================================================
// CEK GAUL CUSTOMER DI MODAL OPEN TIKET
// ============================================================
async function checkGaulForOpenTicket() {
    const box = document.getElementById('gaulWarningBox');
    if (!box) return;

    const jenisTiket = document.getElementById('jenisTiket').value;
    const kodePelanggan = document.getElementById('kodePelanggan').value.trim();

    if (jenisTiket !== 'GGN' || !kodePelanggan || kodePelanggan === '-') {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    const gaulSet = getPelangganGaul();
    if (!gaulSet.has(kodePelanggan)) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    // HITUNG TOTAL LAPORAN GANGGUAN JARINGAN
    const batas = new Date();
    batas.setMonth(batas.getMonth() - 2);
    const totalLaporan = tickets.filter(t => {
        if (t.kodePelanggan !== kodePelanggan) return false;
        if (new Date(t.createdAt) < batas) return false;
        return isGangguanJaringan(t);
    }).length;

    box.style.display = 'block';
    box.innerHTML = `
        <div style="background:#fef2f2; border-left:5px solid #dc2626; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
            <div style="font-size:28px;">⚠️</div>
            <div style="flex:1;">
                <div style="font-weight:700; color:#7f1d1d; font-size:13px;">PELANGGAN INDIKASI GAUL</div>
                <div style="font-size:12px; color:#991b1b; margin-top:2px;">
                    Sudah <strong>${totalLaporan}x</strong> lapor gangguan jaringan dalam 2 bulan terakhir
                </div>
            </div>
            <button type="button" 
    onclick="bukaGaulDariOpenTicket('${kodePelanggan}'); return false;"
    style="background:#dc2626; color:white; border:none; border-radius:8px; padding:8px 16px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
    <i class="fas fa-eye"></i> View
</button>
        </div>
    `;
}

function bukaGaulDariOpenTicket(kodePelanggan) {
    viewGaulFromOpenTicket(kodePelanggan);
}

function viewGaulFromOpenTicket(kodePelanggan, onClose) {
    const batas = new Date();
    batas.setMonth(batas.getMonth() - 2);
    batas.setHours(0, 0, 0, 0);

    // AMBIL SEMUA TIKET PELANGGAN INI (gangguan jaringan saja)
    const riwayat = tickets.filter(t => {
        if (t.kodePelanggan !== kodePelanggan) return false;
        if (new Date(t.createdAt) < batas) return false;
        return isGangguanJaringan(t);
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (riwayat.length === 0) {
        Swal.fire('Info', 'Tidak ada riwayat gangguan jaringan.', 'info').then(function() {
            if (typeof onClose === 'function') onClose();
        });
        return;
    }

    const namaPelanggan = riwayat[0].customer || '-';

    let html = `
        <div style="text-align:left; max-height:500px; overflow-y:auto;">
            <div style="background:#fef3c7; padding:14px 18px; border-radius:10px; margin-bottom:16px;">
                <div style="font-size:14px;"><strong>👤 ${namaPelanggan}</strong></div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">Kode: ${kodePelanggan}</div>
                <div style="font-size:13px; color:#dc2626; font-weight:700; margin-top:6px;">
                    ⚠️ ${riwayat.length}x lapor gangguan jaringan dalam 2 bulan terakhir
                </div>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr style="background:#0b1a33; color:white;">
                        <th style="padding:8px; text-align:center; width:40px;">No</th>
                        <th style="padding:8px; text-align:left;">Tanggal</th>
                        <th style="padding:8px; text-align:left;">No Tiket</th>
                        <th style="padding:8px; text-align:left;">Jenis Gangguan</th>
                        <th style="padding:8px; text-align:left;">Teknisi</th>
                        <th style="padding:8px; text-align:left;">Jenis Perbaikan</th>
                        <th style="padding:8px; text-align:center; width:80px;">Penyebab GAUL</th>
                    </tr>
                </thead>
                <tbody>
    `;

    riwayat.forEach((t, i) => {
        const tgl = t.createdAt ? new Date(t.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
        const tech = (t.technicians || []).join(', ') || '-';
        const isPenyebab = (i === 0); 

        html += `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px; text-align:center;">${i+1}</td>
            <td style="padding:8px;">${tgl}</td>
            <td style="padding:8px; font-weight:600;">${t.ticketid || '-'}</td>
            <td style="padding:8px;">${t.jenisgangguan || '-'}</td>
            <td style="padding:8px;">${tech}</td>
            <td style="padding:8px;">${t.jenisperbaikan || '-'}</td>
            <td style="padding:8px; text-align:center;">
                ${isPenyebab 
                    ? '<span style="background:#dc2626;color:white;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;">GAUL</span>' 
                    : '<span style="background:#f1f5f9;color:#94a3b8;padding:2px 10px;border-radius:10px;font-size:10px;">Laporan Ulang</span>'}
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;

    Swal.fire({
        title: '📋 Riwayat GAUL Pelanggan',
        html: html,
        width: 750,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb',
        showCloseButton: true,
        backdrop: 'rgba(15, 23, 42, 0.75)',
        zIndex: 1000000,
        customClass: {
            popup: 'swal-gaul-popup',
            container: 'swal-gaul-container'
        }
    }).then(function() {
        // Modal open tiket tetap ada di belakang
    });
}

        async function closeticket(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;

    if (ticket.status === 'close') {
        notif('Tiket sudah close!', 'warning');
        return;
    }

    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const diffMs = now.getTime() - createdAt.getTime();
const pendingMs = ticket.pendingDuration || 0;
const ttr = (diffMs - pendingMs) / 60000;
    const isOverdue = ttr > ticket.duration;

    let keterangan = '';

        // KHUSUS GAMAS: TAMPILKAN MODAL KETERANGAN GAMAS SEBELUM JENIS PERBAIKAN
    let keteranganGamas = '';
    let odpTerimbas = '';
    
    // ===== 0. MODAL PEMAKAIAN BARANG (KHUSUS GGN & GAMAS) =====
var jenisTiket = ticket.jenistiket || '';
var jenisPerbaikan = '-';
var isSkipJenisPerbaikan = (jenisTiket === 'PSB' || jenisTiket === 'PROJECT' || jenisTiket === 'LAINNYA' || jenisTiket === 'MIGRASI');

// Ambil daftar barang dari inventaris
let inventoryList = [];
if (jenisTiket === 'GGN' || jenisTiket === 'GAMAS') {
    try {
        const { data: invData } = await sb.from('inventory_items').select('*').order('nama_barang');
        inventoryList = invData || [];
    } catch(e) {
        console.error('Gagal load inventory:', e);
    }
}

// Tampilkan modal pemakaian barang KALAU ada barang di inventaris
currentPemakaianBarang = [];
if ((jenisTiket === 'GGN' || jenisTiket === 'GAMAS') && inventoryList.length > 0) {
    
    const pemakaianResult = await Swal.fire({
        title: '',
        width: 720,
        padding: 0,
        background: '#ffffff',
        showCancelButton: true,
        confirmButtonText: '✅ Lanjut Close',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        html: `
            <div style="font-family:'Inter',sans-serif;background:white;border-radius:20px;overflow:hidden;">
                <!-- HEADER -->
                <div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:24px 32px;color:white;">
                    <div style="display:flex;align-items:center;gap:14px;">
                        <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:22px;">
                            📦
                        </div>
                        <div>
                            <div style="font-size:20px;font-weight:700;">Pemakaian Barang</div>
                            <div style="font-size:13px;opacity:0.85;margin-top:2px;">Catat barang yang dipakai di tiket ini</div>
                        </div>
                    </div>
                </div>

                <div style="padding:24px 32px 28px;">
                    <!-- INFO TIKET -->
                    <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;margin-bottom:18px;font-size:13px;color:#475569;">
                        <strong>${ticket.ticketid}</strong> • ${ticket.customer} • ${ticket.jenisgangguan || '-'}
                    </div>

                    <!-- PILIH BARANG -->
                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-weight:600;color:#0b1a33;font-size:13px;margin-bottom:6px;">
                            🔧 Pilih Barang & Jumlah
                        </label>
                        <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;">
                            <select id="swalPemakaianBarang" style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                                <option value="">-- Pilih Barang --</option>
                                ${inventoryList.map(i => `
                                    <option value="${i.id}" data-nama="${i.nama_barang}" data-kode="${i.kode_barang}" data-stok="${i.stok_saat_ini}" data-satuan="${i.satuan || 'pcs'}" data-min="${i.stok_minimum || 0}">
                                        ${i.kode_barang} — ${i.nama_barang} (Stok: ${i.stok_saat_ini})
                                    </option>
                                `).join('')}
                            </select>
                            <input type="number" id="swalPemakaianJumlah" min="1" placeholder="Jumlah" value="1"
                                style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                            <button type="button" onclick="addPemakaianBarang()" 
                                style="padding:10px 20px;background:#7c3aed;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;">
                                <i class="fas fa-plus"></i> Tambah
                            </button>
                        </div>
                    </div>

                    <!-- LIST BARANG YANG SUDAH DIPILIH -->
                    <div style="margin-bottom:16px;">
                        <div style="font-weight:600;color:#0b1a33;font-size:13px;margin-bottom:6px;">
                            📋 Barang yang Dipakai:
                        </div>
                        <div id="swalPemakaianList" style="background:#f8fafc;border-radius:10px;padding:12px;min-height:60px;max-height:250px;overflow-y:auto;border:2px dashed #cbd5e1;">
                            <div style="text-align:center;color:#94a3b8;font-size:13px;padding:12px;">Belum ada barang dipilih</div>
                        </div>
                    </div>

                    <!-- INFO: kalau tidak ada barang, tetap bisa lanjut -->
                    <div style="background:#eff6ff;padding:10px 14px;border-radius:10px;border-left:4px solid #2563eb;font-size:12px;color:#1e40af;">
                        💡 <strong>Opsional:</strong> Kalau tidak ada barang yang dipakai, langsung klik "Lanjut Close".
                    </div>
                </div>
            </div>
        `,
        didOpen: () => {
            // Listener tombol Enter di input jumlah
            const jumlahInput = document.getElementById('swalPemakaianJumlah');
            if (jumlahInput) {
                jumlahInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addPemakaianBarang();
                    }
                });
            }
        },
        preConfirm: () => {
            return currentPemakaianBarang;
        }
    });

    if (!pemakaianResult.isConfirmed) {
        return; // User batal close tiket
    }
}

    // ===== 1. MODAL JENIS PERBAIKAN DULU =====
var jenisTiket = ticket.jenistiket || '';
var jenisPerbaikan = '-';
// MIGRASI JUGA SKIP (SAMA SEPERTI PSB/PROJECT/LAINNYA)
var isSkipJenisPerbaikan = (jenisTiket === 'PSB' || jenisTiket === 'PROJECT' || jenisTiket === 'LAINNYA' || jenisTiket === 'MIGRASI');

    // ===== FETCH LIST TIKET GAMAS (semua, terbaru di atas) =====
    let gamasList = [];
    if (jenisTiket === 'GGN') {
        try {
            const { data: gamasData } = await sb
                .from('tickets')
                .select('ticketid, jenisgangguan, status, createdAt')
                .eq('jenistiket', 'GAMAS')
                .order('createdAt', { ascending: false })
                .limit(100);
            gamasList = gamasData || [];
        } catch(e) {
            console.error('Gagal fetch GAMAS:', e);
        }
    }
    
    // Simpan di window biar bisa diakses di HTML
    window._gamasList = gamasList;

        // ===== INFO GAMAS: Tampilkan ODP Terimbas =====
    let infoGamasHtml = '';
    if (jenisTiket === 'GAMAS') {
        const odpTerimbasVal = ticket.odp_terimbas || '-';
        infoGamasHtml = `
            <div style="background:#fef2f2;border-radius:12px;padding:14px 18px;margin-bottom:20px;border:2px solid #dc2626;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="font-size:18px;">🚨</span>
                    <span style="font-weight:700;color:#7f1d1d;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">ODP TERIMBAS GAMAS</span>
                </div>
                <div style="background:white;border-radius:8px;padding:12px 16px;font-family:'Courier New',monospace;font-size:13px;color:#7f1d1d;font-weight:600;white-space:pre-wrap;line-height:1.6;max-height:200px;overflow-y:auto;">${odpTerimbasVal}</div>
            </div>
        `;
    }

    if (!isSkipJenisPerbaikan) {
        var listPerbaikan = [];
        if (jenisTiket === 'GGN') {
            listPerbaikan = [
                'Sambul DC / PC',
                'Ganti Modem',
                'Ganti Adaptor Modem',
                'Ganti Adaptor HTB',
                'Ganti HTB',
                'Setting Ulang',
                'Pindah Modem',
                'Edukasi Pelanggan',
                'IMBAS GAMAS',
                'Lainnya'
            ];
        } else if (jenisTiket === 'GAMAS') {
            listPerbaikan = [
                'Sambul DC / KU',
                'Sambul IN ODP',
                'Sambul IN ODC',
                'Ganti Spl di ODP',
                'Ganti Spl di ODC',
                'Lainnya'
            ];
        }

                var optionsHtml = '';
        listPerbaikan.forEach(function(opt) {
            optionsHtml += `
                <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;margin-bottom:6px;background:#fafcff;transition:0.15s;font-size:13px;font-weight:500;color:#0b1a33;" 
                    onmouseover="this.style.borderColor='#3b82f6';this.style.background='#eff6ff'" 
                    onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#fafcff'">
                    <input type="checkbox" class="swal-perbaikan-cb" value="${opt}" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb;">
                    <span>${opt}</span>
                </label>
            `;
        });

        const result = await Swal.fire({
            title: '',
            width: 580,
            padding: 0,
            background: '#ffffff',
            showCancelButton: true,
            confirmButtonText: '✅ Close Tiket',
            cancelButtonText: '✕ Batal',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#94a3b8',
            html: `
                <div style="font-family:'Inter',-apple-system,sans-serif;background:white;border-radius:20px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.06);">
                    <div style="background:linear-gradient(135deg,#0b1a33,#1e3a6b);padding:28px 32px;color:white;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex;align-items:center;gap:14px;">
                            <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid rgba(255,255,255,0.04);">
                                🛠️
                            </div>
                            <div>
                                <div style="font-size:18px;font-weight:700;letter-spacing:-0.3px;">Jenis Perbaikan</div>
                                <div style="font-size:13px;opacity:0.5;font-weight:400;margin-top:2px;">${ticket.ticketid} • ${ticket.customer}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="padding:24px 28px 28px;">
                    
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;background:#fafcff;padding:16px 20px;border-radius:12px;border:1px solid #edf2f7;">
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.4px;">Customer</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:14px;margin-top:3px;">${ticket.customer}</div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.4px;">Jenis Tiket</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:14px;margin-top:3px;">${jenisTiket}</div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.4px;">Jenis Gangguan</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:14px;margin-top:3px;">${ticket.jenisgangguan || '-'}</div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.4px;">Teknisi</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:14px;margin-top:3px;">${(ticket.technicians || []).join(', ') || '-'}</div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom:14px;">
                            <label style="display:block;font-weight:600;color:#0b1a33;font-size:13px;margin-bottom:8px;">
                                <span style="color:#3b82f6;margin-right:6px;">✏️</span> Pilih Jenis Perbaikan <span style="font-weight:400;color:#94a3b8;font-size:11px;">(bisa lebih dari 1)</span>
                            </label>
                            <div id="swalPerbaikanList" style="max-height:260px;overflow-y:auto;padding-right:4px;">
                                ${optionsHtml}
                            </div>
                        </div>

                        <div id="swalLainnyaWrap" style="display:none;margin-bottom:4px;">
                            <label style="display:block;font-weight:600;color:#0b1a33;font-size:13px;margin-bottom:8px;">
                                <span style="color:#f59e0b;margin-right:6px;">📝</span> Keterangan Lainnya
                            </label>
                            <textarea id="swalJenisPerbaikanLainnya" 
                                style="width:100%;padding:13px 16px;border:2px solid #e2e8f0;border-radius:12px;font-size:14px;outline:none;background:#fafcff;transition:0.2s;font-family:inherit;min-height:80px;resize:vertical;color:#0b1a33;text-transform:uppercase;"
                                placeholder="Tulis keterangan jenis perbaikan..."></textarea>
                        </div>

                                                <div id="swalImbasGamasWrap" style="display:none;margin-bottom:4px;">
                            <label style="display:block;font-weight:600;color:#0b1a33;font-size:13px;margin-bottom:8px;">
                                <span style="color:#dc2626;margin-right:6px;">🚨</span> Pilih Tiket GAMAS
                            </label>
                            <select id="swalImbasGamasSelect" 
                                style="width:100%;padding:13px 16px;border:2px solid #e2e8f0;border-radius:12px;font-size:14px;outline:none;background:#fafcff;font-family:inherit;color:#0b1a33;">
                                <option value="">-- Pilih Tiket GAMAS --</option>
                                ${(window._gamasList || []).map(g => {
                                    const tgl = g.createdAt ? new Date(g.createdAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}) : '-';
                                    const statusLabel = g.status === 'close' ? '✅' : '🔴';
                                    return `<option value="${g.ticketid}">${statusLabel} ${g.ticketid} — ${g.jenisgangguan || '-'} — ${tgl}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `,
                                    didOpen: () => {
                const checkboxes = document.querySelectorAll('.swal-perbaikan-cb');
                const wrapLainnya = document.getElementById('swalLainnyaWrap');
                const wrapImbas = document.getElementById('swalImbasGamasWrap');
                
                checkboxes.forEach(cb => {
                    cb.addEventListener('change', function() {
                        // CEK "Lainnya"
                        const lainnyaCb = Array.from(checkboxes).find(c => c.value === 'Lainnya');
                        if (lainnyaCb && lainnyaCb.checked) {
                            wrapLainnya.style.display = 'block';
                        } else {
                            wrapLainnya.style.display = 'none';
                        }
                        
                        // CEK "IMBAS GAMAS"
                        const imbasCb = Array.from(checkboxes).find(c => c.value === 'IMBAS GAMAS');
                        if (imbasCb && imbasCb.checked) {
                            wrapImbas.style.display = 'block';
                        } else {
                            wrapImbas.style.display = 'none';
                        }
                    });
                });
            },
                                                preConfirm: () => {
                const checked = Array.from(document.querySelectorAll('.swal-perbaikan-cb:checked'));
                if (checked.length === 0) {
                    Swal.showValidationMessage('⚠️ Pilih minimal 1 jenis perbaikan!');
                    return false;
                }
                
                // AMBIL SEMUA VALUE YANG DICENTANG
                const values = checked.map(c => c.value.toUpperCase());
                
                // KALAU ADA "LAINNYA" YANG DICENTANG → PAKAI KETERANGAN
                if (values.includes('LAINNYA')) {
                    const ket = document.getElementById('swalJenisPerbaikanLainnya').value.trim().toUpperCase();
                    if (!ket) {
                        Swal.showValidationMessage('⚠️ Keterangan Lainnya wajib diisi!');
                        return false;
                    }
                    const idx = values.indexOf('LAINNYA');
                    values[idx] = ket;
                }
                
                // KALAU ADA "IMBAS GAMAS" YANG DICENTANG → WAJIB PILIH TIKET GAMAS
                let imbasGamasValue = '';
                if (values.includes('IMBAS GAMAS')) {
                    const gamasTiket = document.getElementById('swalImbasGamasSelect').value;
                    if (!gamasTiket) {
                        Swal.showValidationMessage('⚠️ Pilih tiket GAMAS yang di-imbas!');
                        return false;
                    }
                    imbasGamasValue = gamasTiket;
                }
                
                // GABUNG DENGAN PEMISAH " + "
                return {
                    jenisPerbaikan: values.join(' + '),
                    imbasGamas: imbasGamasValue
                };
            }
        });

                if (result.isConfirmed) {
            jenisPerbaikan = result.value.jenisPerbaikan || '-';
            window._imbasGamasValue = result.value.imbasGamas || '';
        } else {
            return;
        }
    }

    // JIKA SKIP (PSB/PROJECT/LAINNYA/MIGRASI), PASTIKAN TIDAK RETURN
if (!isSkipJenisPerbaikan && jenisPerbaikan === undefined) return;
const finalJenisPerbaikan = jenisPerbaikan || '-';

    // ===== 2. MODAL KETERANGAN OVERDUE (SETELAH JENIS PERBAIKAN) =====
    if (isOverdue) {
        const { value: alasan } = await Swal.fire({
            title: '',
            width: 600,
            padding: 0,
            background: '#ffffff',
            showCancelButton: true,
            confirmButtonText: '✅ Close Tiket',
            cancelButtonText: '✕ Batal',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#94a3b8',
            html: `
                <div style="font-family:'Inter',sans-serif;padding:0;border-radius:16px;overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#7f1d1d,#b91c1c);padding:28px 32px;color:white;position:relative;overflow:hidden;">
                        <div style="position:absolute;right:-30px;top:-30px;font-size:140px;opacity:0.05;font-weight:900;">⚠️</div>
                        <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;">
                            <div style="display:flex;align-items:center;gap:16px;">
                                <div style="background:rgba(255,255,255,0.12);width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;border:2px solid rgba(255,255,255,0.1);">⏰</div>
                                <div>
                                    <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">OVERDUE!</div>
                                    <div style="font-size:13px;opacity:0.8;margin-top:4px;">Tiket melewati batas waktu SLA</div>
                                </div>
                            </div>
                            <div style="background:rgba(255,255,255,0.1);padding:6px 16px;border-radius:30px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.1);">
                                ${ticket.ticketid}
                            </div>
                        </div>
                    </div>
                    
                    <div style="padding:24px 32px 28px;background:white;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;background:#f8fafc;padding:16px 20px;border-radius:12px;margin-bottom:18px;border:1px solid #e9edf3;">
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Customer</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:15px;margin-top:4px;">${ticket.customer}</div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Durasi SLA</div>
                                <div style="font-weight:700;color:#0b1a33;font-size:15px;margin-top:4px;">${formatDur(ticket.duration)}</div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">TTR</div>
                                <div style="font-weight:700;color:#dc2626;font-size:15px;margin-top:4px;">${formatDur(ttr)}</div>
                            </div>
                        </div>
                        
                        <div style="background:#fef2f2;padding:14px 18px;border-radius:10px;border-left:5px solid #dc2626;margin-bottom:18px;display:flex;align-items:center;gap:12px;">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#dc2626;animation:blink 1s infinite;"></span>
                            <div style="font-size:14px;color:#7f1d1d;">
                                <strong>Terlambat ${formatDur(ttr - ticket.duration)}</strong> dari target penyelesaian
                            </div>
                        </div>
                        
                        <div>
                            <label style="display:block;font-weight:700;color:#1e293b;font-size:13px;margin-bottom:8px;letter-spacing:0.3px;">
                                📝 Keterangan Penyebab Overdue
                            </label>
                            <textarea id="swalOverdueReason" 
                                style="width:100%;padding:14px 18px;border:2px solid #e2e8f0;border-radius:12px;font-size:14px;outline:none;font-family:inherit;min-height:80px;resize:vertical;background:#fafcff;transition:0.2s;"
                                placeholder="Tulis penyebab overdue..."></textarea>
                            <div style="font-size:11px;color:#94a3b8;margin-top:6px;display:flex;align-items:center;gap:4px;">
                                <i class="fas fa-info-circle"></i> Keterangan wajib diisi untuk menyelesaikan tiket
                            </div>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.2;} }
                </style>
            `,
            preConfirm: () => {
                const reason = document.getElementById('swalOverdueReason').value.trim();
                if (!reason) {
                    Swal.showValidationMessage('⚠️ Keterangan wajib diisi!');
                    return false;
                }
                return reason.toUpperCase();
            }
        });
        if (!alasan) return;
        keterangan = alasan;
    }

        // ===== 3. UPDATE DATABASE =====
    try {
        // ✅ SIMPAN PEMAKAIAN BARANG DULU
        if (currentPemakaianBarang && currentPemakaianBarang.length > 0) {
            for (const barang of currentPemakaianBarang) {
                try {
                    // Catat transaksi keluar
                    await sb.from('inventory_transactions').insert({
                        item_id: barang.item_id,
                        tipe: 'keluar',
                        jumlah: barang.jumlah,
                        teknisi: (ticket.technicians && ticket.technicians.length > 0) ? ticket.technicians.join(', ') : null,
                        ticket_id: ticket.ticketid,
                        keterangan: `Dipakai untuk tiket ${ticket.ticketid}`
                    });

                    // Kurangi stok
                    const stokBaru = barang.stok_tersedia - barang.jumlah;
                    await sb.from('inventory_items')
                        .update({ 
                            stok_saat_ini: stokBaru,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', barang.item_id);

                    console.log(`✅ Stok ${barang.nama} dikurangi ${barang.jumlah}, sisa: ${stokBaru}`);
                } catch(e) {
                    console.error(`❌ Gagal update stok ${barang.nama}:`, e);
                }
            }
            
            // ✅ LOG HISTORY: PEMAKAIAN BARANG
            const barangList = currentPemakaianBarang.map(b => `${b.kode} (${b.jumlah} ${b.satuan})`).join(', ');
            await logTicketHistory(ticket.ticketid, 'inventory_used', {
                description: `📦 Barang dipakai: ${barangList}`,
                newValue: barangList
            });
        }

        const updateData = {
            status: 'close',
            ttr: Math.round(ttr * 100) / 100,
            closedAt: now.toISOString(),
            keterangan: keterangan || '-',
            jenisperbaikan: finalJenisPerbaikan,
            imbas_gamas: window._imbasGamasValue ? String(window._imbasGamasValue).trim() : null
        };
        
        // TAMBAH KETERANGAN GAMAS & ODP TERIMBAS KALAU GAMAS
        if (ticket.jenistiket === 'GAMAS') {
            updateData.keterangangamas = keteranganGamas || '-';
            updateData.odp_terimbas = odpTerimbas || '-';
        }
        
        const { error } = await sb
            .from('tickets')
            .update(updateData)
            .eq('id', docId);

                       if (error) throw error;

                // ✅ LOG HISTORY: TIKET CLOSE
        await logTicketHistory(ticket.ticketid, 'close', {
            description: `✅ Tiket ditutup${keterangan && keterangan !== '-' ? ' (Overdue: ' + keterangan + ')' : ''}${finalJenisPerbaikan && finalJenisPerbaikan !== '-' ? ' • Perbaikan: ' + finalJenisPerbaikan : ''}`,
            newValue: ttr.toFixed(1) + ' menit'
        });

        // ✅ LOG AKTIVITAS
        await logActivity('UPDATE', {
            table: 'tickets',
            recordId: ticket.ticketid,
            description: `Close tiket: ${ticket.ticketid}`,
            newValue: { status: 'close', ttr: ttr.toFixed(1) }
        });

        // ===== AUTO-INSERT PELANGGAN SAAT PSB CLOSE =====
        if (ticket.jenistiket === 'PSB') {
            try {
                const kodePelanggan = ticket.kodePelanggan || '-';
                const odpPelanggan = ticket.odppelanggan || '-';
                const namaCustomer = ticket.customer || '-';

                if (kodePelanggan && kodePelanggan !== '-') {
                    const closeDate = new Date(ticket.closedAt || now);
                    const yyyy = closeDate.getFullYear();
                    const mm = String(closeDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(closeDate.getDate()).padStart(2, '0');
                    const tanggalPasang = dd + '-' + mm + '-' + yyyy;

                    const { data: existingPel } = await sb
                        .from('pelanggan')
                        .select('*')
                        .eq('id_pelanggan', kodePelanggan)
                        .maybeSingle();

                    const payload = {
                        sumber: 'PSB',
                        odp: odpPelanggan || '-',
                        ticket_id: ticket.ticketid || '-',
                        no_hp: (ticket.no_tlp && ticket.no_tlp !== '-') ? ticket.no_tlp : '-',
                        taging_lokasi: (ticket.taging_lokasi && ticket.taging_lokasi !== '-') ? ticket.taging_lokasi : '-',
                        taging_odp: (ticket.taging_odp && ticket.taging_odp !== '-') ? ticket.taging_odp : '-'
                    };
                    if (ticket.foto_rumah && ticket.foto_rumah !== '-') payload.foto_depan = ticket.foto_rumah;
                    if (ticket.foto_ktp && ticket.foto_ktp !== '-') payload.foto_ktp = ticket.foto_ktp;

                    if (existingPel) {
                        if (!existingPel.tanggal_pasang || existingPel.tanggal_pasang === '-' || existingPel.tanggal_pasang === '') {
                            payload.tanggal_pasang = tanggalPasang;
                        }
                        await sb.from('pelanggan').update(payload).eq('id', existingPel.id);
                    } else {
                        await sb.from('pelanggan').insert({
                            id_pelanggan: kodePelanggan,
                            nama: namaCustomer,
                            no_hp: '-',
                            alamat: '-',
                            tanggal_pasang: tanggalPasang,
                            ...payload
                        });
                    }

                    const { data: freshPel } = await sb.from('pelanggan').select('*');
                    pelangganData = freshPel || [];
                    console.log('✅ Pelanggan PSB auto-saved:', kodePelanggan);
                }
            } catch (e) {
                console.error('❌ Gagal auto-insert pelanggan PSB:', e);
            }
        }
        // ===== END AUTO-INSERT =====

        notif('Tiket ' + ticket.ticketid + ' ditutup!', 'success');
        
        // ✅ RESET PEMAKAIAN BARANG
        currentPemakaianBarang = [];
        
        refreshData();
    } catch (e) {
        notif('Gagal tutup tiket: ' + e.message, 'danger');
        currentPemakaianBarang = [];
    }
}

                async function deleteTicket(docId) {
            const ticket = tickets.find(t => t.id === docId);
            if (!ticket) {
                notif('Tiket tidak ditemukan!', 'danger');
                return;
            }

            const confirm = await Swal.fire({
                title: '⚠️ Hapus Tiket?',
                html: `Tiket <strong>${ticket.ticketid}</strong> akan dihapus permanen dari database.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '🗑️ Hapus',
                cancelButtonText: '✕ Batal',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#94a3b8'
            });

            if (!confirm.isConfirmed) return;

            try {
                const { error } = await sb
                    .from('tickets')
                    .delete()
                    .eq('id', docId);

                if (error) throw error;

                notif('Tiket ' + ticket.ticketid + ' berhasil dihapus!', 'success');
                refreshData();
            } catch (e) {
                notif('Gagal hapus tiket: ' + e.message, 'danger');
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
        body.innerHTML = '<tr><td colspan="16"><div class="empty"><span class="icon">📭</span>Belum ada tiket</div></td></tr>';
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
    // TTR BERHENTI DI POSISI TERAKHIR SAAT PENDING
    let frozenElapsed;
    if (t.pendingAt && t.pendingStart) {
        // Durasi dari createdAt → saat pertama kali pending
        const pendingStart = new Date(t.pendingStart);
        frozenElapsed = (pendingStart.getTime() - new Date(t.createdAt).getTime()) / 60000;
    } else if (t.pendingAt) {
        // Fallback: pakai pendingAt
        const pendingAt = new Date(t.pendingAt);
        frozenElapsed = (pendingAt.getTime() - new Date(t.createdAt).getTime()) / 60000;
    } else {
        frozenElapsed = 0;
    }
    const frozenRemaining = t.duration - frozenElapsed;
    if (frozenRemaining <= 0) {
        ttrDisplay = `<span style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">⏸ +${formatDur(Math.abs(frozenRemaining))}</span>`;
    } else {
        ttrDisplay = `<span style="background:#e0e7ff;color:#3730a3;padding:2px 12px;border-radius:6px;font-weight:600;">⏸ ${formatDur(frozenRemaining)}</span>`;
    }
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
        const wilayahPelanggan = t.wilayahpelanggan || '-';
        const imbasGamas = t.imbas_gamas || '';

        return `
        <tr data-ticket-id="${t.id}" class="${rowClass}" onclick="goToTicket('${t.id}')" style="cursor:pointer;">
            <td>${formatDate(t.createdAt)}</td>
            <td>${getJenisTiketBadge(t)}</td>
            <td style="color:#000000; font-weight:400;">${t.ticketid}</td>
            <td>${t.customer}</td>
            <td>
    <div style="display:flex;align-items:center;gap:6px;justify-content:center;flex-wrap:nowrap;">
        <strong>${jenisGangguan}</strong>
        ${isClosed && t.jenistiket !== 'PSB' ? `<button type="button" class="btn btn-outline btn-sm btn-edit-gangguan" data-ticket-id="${t.id}" title="Edit Jenis Gangguan" style="padding:2px 6px;font-size:10px;cursor:pointer;">
            <i class="fas fa-edit" style="color:#2563eb;"></i>
        </button>` : ''}
    </div>
</td>
            <td>${odpPelanggan}</td>
            <td>${wilayahPelanggan}</td>
            <td>${formatDur(t.duration)}</td>
            <td>${formatTime(t.createdAt)}</td>
            <td style="min-width:150px;">
    <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
            ${techDisplay}
        </div>
        ${!isClosed ? `
            <div style="display:flex;gap:4px;">
                <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editTicketTech('${t.id}'); return false;" title="Ganti Teknisi" style="padding:2px 6px;font-size:12px;">
                    <i class="fas fa-exchange-alt" style="color:#2563eb;"></i>
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); addTicketTech('${t.id}'); return false;" title="Tambah Teknisi" style="padding:2px 6px;font-size:12px;">
                    <i class="fas fa-plus-circle" style="color:#16a34a;"></i>
                </button>
            </div>
        ` : ''}
    </div>
</td>
            <td>${closeEstDisplay}</td>
            <td>${closeticketDisplay}</td>
            <td class="ttr-cell">${ttrDisplay}</td>
            <td class="status-cell">
                <span class="badge-status ${statusClass}">${statusLabel}</span>
                ${isOverdue ? ' <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#dc2626;animation:blink 1s infinite;margin-left:6px;vertical-align:middle;"></span>' : ''}
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
                    <span>${t.keterangan || '-'}</span>
                    ${isClosed ? `<button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editKeteranganOverdue('${t.id}'); return false;" title="Edit Keterangan Overdue" style="padding:2px 6px;font-size:10px;cursor:pointer;">
                        <i class="fas fa-edit" style="color:#dc2626;"></i>
                    </button>` : ''}
                </div>
            </td>
                        <td>
                <div style="display:flex;flex-direction:column;gap:3px;align-items:center;justify-content:center;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <strong>${jenisPerbaikan}</strong>
                        ${isClosed && t.jenistiket !== 'PSB' ? `<button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editJenisPerbaikan('${t.id}'); return false;" title="Edit Jenis Perbaikan" style="padding:2px 6px;font-size:10px;cursor:pointer;">
                            <i class="fas fa-edit" style="color:#2563eb;"></i>
                        </button>` : ''}
                    </div>
                    ${imbasGamas ? `<div style="font-size:11px;color:#dc2626;font-weight:700;">🚨 Imbas: ${imbasGamas}</div>` : ''}
                </div>
            </td>
            <td style="display:flex;gap:4px;flex-wrap:wrap;">
                ${isOpen ? `<button type="button" class="btn btn-success btn-sm" onclick="event.stopPropagation(); closeticket('${t.id}'); return false;">Close</button>` : ''}
                ${isClosed ? `<button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editcloseticket('${t.id}'); return false;" title="Edit Waktu Close"><i class="fas fa-clock"></i></button>` : ''}
                <button type="button" class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteTicket('${t.id}'); return false;" title="Hapus Tiket"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
        `;
    }).join('');
    
    renderPagination(totalItems, page);
    
    const hasOpen = data.some(t => t.status === 'open');
    if(hasOpen) startTimer(); else stopTimer();
}

    async function editKeteranganOverdue(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;

    if (ticket.status !== 'close') {
        notif('Hanya tiket yang sudah close yang bisa diedit keterangannya!', 'warning');
        return;
    }

    const { value: newKet } = await Swal.fire({
        title: '✏️ Edit Keterangan Overdue',
        width: 550,
        html: `
            <div style="text-align:left; margin-top:10px;">
                <div style="background:#f8fafc; padding:12px 14px; border-radius:10px; margin-bottom:14px;">
                    <p style="font-size:13px; color:#475569; margin-bottom:4px;">
                        <strong>Tiket:</strong> ${ticket.ticketid || '-'}
                    </p>
                    <p style="font-size:13px; color:#475569; margin-bottom:4px;">
                        <strong>Customer:</strong> ${ticket.customer || '-'}
                    </p>
                </div>
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Keterangan saat ini:
                </label>
                <div style="background:#fef2f2; padding:8px 14px; border-radius:8px; margin-bottom:14px; font-weight:600; color:#7f1d1d; border-left:4px solid #dc2626;">
                    ${ticket.keterangan || '-'}
                </div>
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Keterangan baru:
                </label>
                <textarea id="swalEditKeterangan" 
                    style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; text-transform:uppercase; font-family:inherit; min-height:80px; resize:vertical;"
                    placeholder="Tulis keterangan overdue...">${(ticket.keterangan || '').toUpperCase()}</textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const value = document.getElementById('swalEditKeterangan').value.trim().toUpperCase();
            if (!value) {
                Swal.showValidationMessage('Keterangan tidak boleh kosong!');
                return false;
            }
            return value;
        }
    });

    if (!newKet) return;

    try {
        const { error } = await sb
            .from('tickets')
            .update({ keterangan: newKet })
            .eq('id', docId);

                if (error) throw error;

        // ✅ LOG HISTORY: UPDATE KETERANGAN
        await logTicketHistory(ticket.ticketid, 'update_keterangan', {
            oldValue: ticket.keterangan || '-',
            newValue: newKet,
            description: `📝 Keterangan diubah`
        });

        notif('✅ Keterangan overdue berhasil diupdate!', 'success');
        refreshData();
    } catch (e) {
        notif('❌ Gagal update keterangan: ' + e.message, 'danger');
    }
}

    // ===== AUTO-SUGGEST CUSTOMER (HANYA GGN) =====
async function showCustomerSuggestionsGGN() {
    const jenisTiket = document.getElementById('jenisTiket').value;
    // HANYA GGN
    if (jenisTiket !== 'GGN') {
        const el = document.getElementById('customerSuggestions');
        if (el) el.style.display = 'none';
        return;
    }

    const input = document.getElementById('customer');
    const box = document.getElementById('customerSuggestions');
    if (!input || !box) return;

    const keyword = input.value.trim().toLowerCase();

    // AMBIL SEMUA DATA PELANGGAN DARI SUPABASE
    try {
        const { data, error } = await sb
            .from('pelanggan')
            .select('nama, id_pelanggan, odp, taging_lokasi, no_hp')
            .order('nama');

        if (error) throw error;
        if (!data || data.length === 0) {
            box.style.display = 'none';
            return;
        }

        // FILTER: JIKA ADA KEYWORD, FILTER BY NAMA ATAU ID
        let matches = data;
        if (keyword.length > 0) {
            matches = data.filter(p => {
                const nama = (p.nama || '').toLowerCase();
                const idp = (p.id_pelanggan || '').toLowerCase();
                return nama.includes(keyword) || idp.includes(keyword);
            });
        }

        if (matches.length === 0) {
            box.style.display = 'none';
            return;
        }

        // RENDER LIST (max 50)
                box.innerHTML = matches.slice(0, 50).map(p => {
            const nama = (p.nama || '').replace(/'/g, "\\'");
            const idp = (p.id_pelanggan || '').replace(/'/g, "\\'");
            const odp = (p.odp || '').replace(/'/g, "\\'");
            const wilayah = (p.taging_lokasi || '').replace(/'/g, "\\'");
            const noHp = (p.no_hp || '').replace(/'/g, "\\'");
            return `
            <div onclick="pickCustomerGGN('${nama}', '${idp}', '${odp}', '${wilayah}', '${noHp}')"
                 style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:0.15s;"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div style="font-weight:600; color:#0b1a33; font-size:13px;">${p.nama || '-'}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    <i class="fas fa-id-card" style="color:#2563eb; margin-right:4px;"></i>${p.id_pelanggan || '-'}
                </div>
            </div>`;
        }).join('');
        box.style.display = 'block';

    } catch (e) {
        console.error('Gagal load pelanggan:', e);
        box.style.display = 'none';
    }
}

// ============================================================
// AUTOCOMPLETE PINTAR GGN (CARI DI TICKETS & PELANGGAN)
// ============================================================
async function getGabunganDataPelanggan(keyword) {
    const kw = keyword.toLowerCase().trim();
    if (kw.length < 2) return [];

    // 1. Ambil dari tabel TICKETS
    const { data: tData } = await sb
        .from('tickets')
        .select('customer, kodePelanggan, no_tlp, odppelanggan, wilayahpelanggan')
        .or(`customer.ilike.%${kw}%,kodePelanggan.ilike.%${kw}%`)
        .limit(50);

    // 2. Ambil dari tabel PELANGGAN (PAKAI KOLOM 'alamat')
    const { data: pData } = await sb
        .from('pelanggan')
        .select('nama, id_pelanggan, no_hp, odp, alamat')
        .or(`nama.ilike.%${kw}%,id_pelanggan.ilike.%${kw}%`)
        .limit(50);

    // 3. Gabungkan & Rapihkan formatnya
    const hasil = {};
    
    (tData || []).forEach(t => {
        const id = t.kodePelanggan;
        if (!id || id === '-') return;
        if (!hasil[id]) hasil[id] = { 
            nama: t.customer, 
            id: id, 
            no_hp: t.no_tlp, 
            odp: t.odppelanggan, 
            wilayah: t.wilayahpelanggan 
        };
    });

    (pData || []).forEach(p => {
        const id = p.id_pelanggan;
        if (!id || id === '-') return;
        if (!hasil[id]) {
            hasil[id] = { 
                nama: p.nama, 
                id: id, 
                no_hp: p.no_hp, 
                odp: p.odp, 
                wilayah: p.alamat // <--- DIUBAH JADI p.alamat
            };
        } else {
            if (!hasil[id].no_hp && p.no_hp) hasil[id].no_hp = p.no_hp;
            if (!hasil[id].wilayah && p.alamat) hasil[id].wilayah = p.alamat; // <--- DIUBAH JADI p.alamat
        }
    });

    return Object.values(hasil);
}

// 1. Dipanggil saat ngetik di kolom CUSTOMER
async function showCustomerSuggestionsGGN() {
    const jenisTiket = document.getElementById('jenisTiket').value;
    if (jenisTiket !== 'GGN') return;

    const input = document.getElementById('customer');
    const box = document.getElementById('customerSuggestions');
    if (!input || !box) return;

    const kw = input.value.trim();
    if (kw.length < 2) { box.style.display = 'none'; return; }

    const matches = await getGabunganDataPelanggan(kw);
    if (matches.length === 0) { box.style.display = 'none'; return; }

    box.innerHTML = matches.map(p => `
        <div onclick="pickCustomerGGN('${p.nama}', '${p.id}', '${p.odp}', '${p.wilayah}', '${p.no_hp}')"
             style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:0.15s;"
             onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="font-weight:600; color:#0b1a33; font-size:13px;">${p.nama || '-'}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">
                <i class="fas fa-id-card" style="color:#2563eb; margin-right:4px;"></i>${p.id || '-'}
            </div>
        </div>
    `).join('');
    box.style.display = 'block';
}

// 2. Dipanggil saat ngetik di kolom ID PELANGGAN
async function showIdSuggestionsGGN() {
    const jenisTiket = document.getElementById('jenisTiket').value;
    if (jenisTiket !== 'GGN') return;

    const input = document.getElementById('kodePelanggan');
    const box = document.getElementById('customerSuggestions');
    if (!input || !box) return;

    const kw = input.value.trim();
    if (kw.length < 2) { box.style.display = 'none'; return; }

    const matches = await getGabunganDataPelanggan(kw);
    if (matches.length === 0) { box.style.display = 'none'; return; }

    box.innerHTML = matches.map(p => `
        <div onclick="pickCustomerGGN('${p.nama}', '${p.id}', '${p.odp}', '${p.wilayah}', '${p.no_hp}')"
             style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:0.15s;"
             onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="font-weight:600; color:#0b1a33; font-size:13px;">${p.id || '-'}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">
                <i class="fas fa-user" style="color:#2563eb; margin-right:4px;"></i>${p.nama || '-'}
            </div>
        </div>
    `).join('');
    
    // Supaya list muncul di bawah kolom ID Pelanggan
    box.style.top = input.offsetHeight + 'px'; 
    box.style.display = 'block';
}

function pickCustomerGGN(nama, idPelanggan, odp, wilayah, noHp) {
    document.getElementById('customer').value = nama;
    document.getElementById('kodePelanggan').value = idPelanggan;

    // AUTO-ISI NO HP
    const noHpInput = document.getElementById('noHpPelanggan');
    if (noHpInput) {
        noHpInput.value = (noHp && noHp !== '-' && noHp !== '') ? noHp : '';
    }

    // AUTO-ISI ODP
    const odpInput = document.getElementById('odpPelanggan');
    if (odpInput) {
        odpInput.value = (odp && odp !== '-' && odp !== '') ? odp : '';
    }

    // AUTO-ISI WILAYAH (YANG BARU KITA TAMBAHKAN)
    const wilayahInput = document.getElementById('wilayahPelanggan');
    if (wilayahInput) {
        wilayahInput.value = (wilayah && wilayah !== '-' && wilayah !== '') ? wilayah : '';
    }

    document.getElementById('customerSuggestions').style.display = 'none';

    // CEK GAUL
    checkGaulForOpenTicket();

    // CEK ODP TERIMBAS
    setTimeout(() => cekOdpTerimbasWarning(), 300);
}


// ============================================================
// NORMALISASI KEY ODP
// - Buang prefix "ODP-" / "ODP "
// - Buang semua karakter non-alfanumerik
// - UPPERCASE
// Contoh:
//   "ODP-WNJ-001/001" → "WNJ001001"
//   "WNJ-001/001"     → "WNJ001001"
//   "ODP 1"           → "1"
//   "ODP-1"           → "1"
// ============================================================
function normalizeOdpKey(str) {
    if (!str) return '';
    return String(str)
        .toUpperCase()
        .replace(/^ODP[\s\-_]*/i, '')   // buang prefix ODP di awal
        .replace(/[^A-Z0-9]/g, '')       // buang semua non-alfanumerik
        .trim();
}

// ============================================================
// CEK APAKAH 2 KEY ODP COCOK
// - Sama persis ATAU saling mengandung (partial match)
// ============================================================
function isOdpMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    // Partial match: minimal 3 karakter agar tidak false positive
    if (a.length >= 3 && b.length >= 3) {
        if (a.includes(b) || b.includes(a)) return true;
    }
    return false;
}

// ============================================================
// NORMALISASI KEY ODP
// ============================================================
function normalizeOdpKey(str) {
    if (!str) return '';
    return String(str)
        .toUpperCase()
        .replace(/^ODP[\s\-_]*/i, '')
        .replace(/[^A-Z0-9]/g, '')
        .trim();
}

// ============================================================
// CEK APAKAH 2 KEY ODP COCOK
// ============================================================
function isOdpMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 3 && b.length >= 3) {
        if (a.includes(b) || b.includes(a)) return true;
    }
    return false;
}

// ============================================================
// CEK ODP TERIMBAS GAMAS — VERSI FINAL
// Pop-up tengah + backdrop blur (tanpa gelap)
// ============================================================
async function cekOdpTerimbasWarning() {
    const jenisTiket = document.getElementById('jenisTiket').value;
    if (jenisTiket !== 'GGN') return;

    const odpField = document.getElementById('odpPelanggan');
    const kodeField = document.getElementById('kodePelanggan');

    // ===== 1. KUMPULKAN SEMUA KANDIDAT =====
    const kandidatRaw = [];

    // Dari field ODP
    if (odpField && odpField.value.trim() !== '' && odpField.value.trim() !== '-') {
        kandidatRaw.push(odpField.value.trim());
    }

    // Dari ID Pelanggan (bagian setelah /RTL/)
    if (kodeField && kodeField.value.trim() !== '' && kodeField.value.trim() !== '-') {
        const kode = kodeField.value.trim();
        if (kode.toUpperCase().includes('/RTL/')) {
            const parts = kode.split(/\/RTL\//i);
            if (parts.length > 1 && parts[1]) {
                const afterRtl = parts[1].trim();
                if (afterRtl) {
                    kandidatRaw.push(afterRtl);
                    kandidatRaw.push('ODP-' + afterRtl);
                }
            }
        } else {
            kandidatRaw.push(kode);
        }
    }

    if (kandidatRaw.length === 0) return;

    // Deduplikasi + normalisasi
    const kandidat = [...new Set(
        kandidatRaw.map(k => normalizeOdpKey(k)).filter(k => k)
    )];
    if (kandidat.length === 0) return;

    // ===== 2. QUERY GAMAS YANG OPEN =====
    let gamasOpen;
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('ticketid, jenisgangguan, odppelanggan, odp_terimbas, createdAt, status, technicians')
            .eq('jenistiket', 'GAMAS')
            .eq('status', 'open');
        if (error) return;
        gamasOpen = data;
    } catch (e) { return; }

    if (!gamasOpen || gamasOpen.length === 0) return;

    // ===== 3. COCOKKAN =====
    let gamasKetemu = null;

    for (const g of gamasOpen) {
        const odpsTerimbas = (g.odp_terimbas || '')
            .split('\n')
            .map(x => x.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
            .filter(x => x)
            .map(x => normalizeOdpKey(x))
            .filter(x => x);

        if (odpsTerimbas.length === 0) continue;

        let match = false;
        for (const kand of kandidat) {
            for (const odpTerimbas of odpsTerimbas) {
                if (isOdpMatch(kand, odpTerimbas)) {
                    match = true;
                    break;
                }
            }
            if (match) break;
        }
        if (match) {
            gamasKetemu = g;
            break;
        }
    }

    // ===== 4. HAPUS LAMA KALAU ADA =====
    const oldOverlay = document.getElementById('odpTerimbasOverlay');
    if (oldOverlay) oldOverlay.remove();
    const oldPopup = document.getElementById('odpTerimbasWarning');
    if (oldPopup) oldPopup.remove();

    if (!gamasKetemu) return;

    // ===== 5. BUAT BACKDROP BLUR (TANPA GELAP) =====
    const overlay = document.createElement('div');
    overlay.id = 'odpTerimbasOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: transparent;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 9999998;
        animation: fadeIn 0.25s ease;
    `;
    document.body.appendChild(overlay);

    // ===== 6. BUAT POP-UP DI TENGAH =====
    const tglGamas = gamasKetemu.createdAt
        ? new Date(gamasKetemu.createdAt).toLocaleString('id-ID')
        : '-';

    const popup = document.createElement('div');
    popup.id = 'odpTerimbasWarning';
    popup.style.cssText = `
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 18px;
        padding: 26px 30px;
        box-shadow: 0 30px 80px rgba(220, 38, 38, 0.35), 0 0 0 1px rgba(220,38,38,0.1);
        z-index: 9999999;
        max-width: 480px;
        width: 92%;
        border: 2px solid #dc2626;
        font-family: Inter, -apple-system, sans-serif;
        animation: popInCenter 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    `;

    let html = '';

    // HEADER
    html += '<div style="text-align:center;margin-bottom:18px;">';
    html += '<div style="font-size:52px;line-height:1;margin-bottom:10px;">⚠️</div>';
    html += '<div style="font-weight:800;color:#7f1d1d;font-size:19px;letter-spacing:-0.3px;">ODP TERIMBAS GAMAS</div>';
    html += '<div style="font-size:13px;color:#991b1b;line-height:1.6;margin-top:6px;">ODP pelanggan ini sedang terimbas gangguan massal</div>';
    html += '</div>';

    // INFO BOX
    html += '<div style="background:#fef2f2;border-radius:12px;padding:14px 18px;font-size:13px;color:#475569;margin-bottom:14px;border:1px solid #fecaca;text-align:left;">';
    html += '<div style="margin-bottom:7px;"><strong>📋 Tiket GAMAS:</strong> ' + (gamasKetemu.ticketid || '-') + '</div>';
    html += '<div style="margin-bottom:7px;"><strong>⚠️ Jenis:</strong> ' + (gamasKetemu.jenisgangguan || '-') + '</div>';
    html += '<div style="margin-bottom:7px;"><strong>📍 ODP Utama:</strong> ' + (gamasKetemu.odppelanggan || '-') + '</div>';
    html += '<div style="margin-bottom:7px;"><strong>👷 Teknisi:</strong> ' + ((gamasKetemu.technicians || []).join(', ') || '-') + '</div>';
    html += '<div><strong>🕒 Dibuat:</strong> ' + tglGamas + '</div>';
    html += '</div>';

    // SARAN
    html += '<div style="background:#fffbeb;border-radius:10px;padding:12px 16px;font-size:12px;color:#92400e;margin-bottom:18px;border:1px solid #fde68a;text-align:left;line-height:1.6;">';
    html += '💡 <strong>Saran:</strong> Konfirmasi ke pelanggan bahwa gangguannya sudah tercakup dalam tiket GAMAS. Hindari membuat tiket GGN baru.';
    html += '</div>';

    // TOMBOL
    html += '<button id="odpTerimbasBtnClose" style="width:100%;padding:13px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.3px;transition:0.2s;">✓ Mengerti</button>';

    popup.innerHTML = html;
    document.body.appendChild(popup);

    // ===== 7. EVENT TUTUP =====
    const btnClose = document.getElementById('odpTerimbasBtnClose');
    if (btnClose) {
        btnClose.onclick = function() {
            const p = document.getElementById('odpTerimbasWarning');
            const o = document.getElementById('odpTerimbasOverlay');
            if (p) p.remove();
            if (o) o.remove();
        };
    }
}


    async function editJenisPerbaikan(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) {
        notif('Tiket tidak ditemukan!', 'danger');
        return;
    }

    if (ticket.jenistiket === 'PSB') return;

    if (ticket.status !== 'close') {
        notif('Hanya tiket yang sudah close yang bisa diedit jenis perbaikannya!', 'warning');
        return;
    }

    var listPerbaikan = [];
    if (ticket.jenistiket === 'GAMAS') {
        listPerbaikan = [
            'Sambul DC / KU',
            'Sambul IN ODP',
            'Sambul IN ODC',
            'Ganti Spl di ODP',
            'Ganti Spl di ODC',
            'Lainnya'
        ];
    } else {
        listPerbaikan = [
            'Sambul DC / PC',
            'Ganti Modem',
            'Ganti Adaptor Modem',
            'Ganti Adaptor HTB',
            'Ganti HTB',
            'Setting Ulang',
            'Pindah Modem',
            'Edukasi Pelanggan',
            'Lainnya'
        ];
    }

    var currentVal = (ticket.jenisperbaikan || '').toUpperCase();
    if (currentVal && currentVal !== '-' && !listPerbaikan.includes(currentVal)) {
        listPerbaikan.unshift(currentVal);
    }

    var optionsHtml = '<option value="">-- Pilih Jenis Perbaikan --</option>';
    listPerbaikan.forEach(function(opt) {
        var selected = (opt.toUpperCase() === currentVal) ? 'selected' : '';
        optionsHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
    });

    const result = await Swal.fire({
        title: '✏️ Edit Jenis Perbaikan',
        width: 520,
        html: `
            <div style="text-align:left; margin-top:10px;">
                <div style="background:#f8fafc; padding:10px 14px; border-radius:8px; margin-bottom:14px;">
                    <p style="font-size:13px; color:#475569; margin:0;">
                        <strong>Tiket:</strong> ${ticket.ticketid || '-'} • <strong>Customer:</strong> ${ticket.customer || '-'}
                    </p>
                </div>
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Jenis Perbaikan saat ini:
                </label>
                <div style="background:#f1f5f9; padding:8px 14px; border-radius:8px; margin-bottom:14px; font-weight:600; color:#0b1a33;">
                    ${ticket.jenisperbaikan || '-'}
                </div>
                <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                    Jenis Perbaikan baru:
                </label>
                <select id="swalEditJenisPerbaikan" 
                    style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; background:white;">
                    ${optionsHtml}
                </select>
                <div id="swalLainnyaWrapEdit" style="display:none; margin-top:12px;">
                    <label style="display:block; font-weight:600; margin-bottom:6px; color:#1e293b;">
                        Keterangan Lainnya:
                    </label>
                    <textarea id="swalEditJenisPerbaikanLainnya" 
                        style="width:100%; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; text-transform:uppercase; font-family:inherit; min-height:70px; resize:vertical;"
                        placeholder="Tulis keterangan..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        didOpen: () => {
            const sel = document.getElementById('swalEditJenisPerbaikan');
            const wrap = document.getElementById('swalLainnyaWrapEdit');
            if (sel && wrap) {
                sel.addEventListener('change', function() {
                    if (this.value === 'Lainnya') {
                        wrap.style.display = 'block';
                    } else {
                        wrap.style.display = 'none';
                    }
                });
                if (sel.value === 'Lainnya') wrap.style.display = 'block';
            }
        },
        preConfirm: () => {
            const val = document.getElementById('swalEditJenisPerbaikan').value;
            if (!val) {
                Swal.showValidationMessage('⚠️ Pilih jenis perbaikan!');
                return false;
            }
            if (val === 'Lainnya') {
                const ket = document.getElementById('swalEditJenisPerbaikanLainnya').value.trim().toUpperCase();
                if (!ket) {
                    Swal.showValidationMessage('⚠️ Keterangan wajib diisi!');
                    return false;
                }
                return ket;
            }
            return val.toUpperCase();
        }
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await sb
            .from('tickets')
            .update({ jenisperbaikan: result.value })
            .eq('id', docId);

                if (error) throw error;

        // ✅ LOG HISTORY: UPDATE PERBAIKAN
        await logTicketHistory(ticket.ticketid, 'update_perbaikan', {
            oldValue: ticket.jenisperbaikan || '-',
            newValue: result.value,
            description: `🛠️ Jenis perbaikan diubah: "${ticket.jenisperbaikan || '-'}" → "${result.value}"`
        });

        notif('✅ Jenis perbaikan berhasil diupdate!', 'success');
        refreshData();
    } catch (e) {
        notif('❌ Gagal update: ' + e.message, 'danger');
    }
}


    function exportRekapTeknisi() {
    const dateFrom = document.getElementById('rekapDate')?.value || '';
    const dateTo = document.getElementById('rekapDateTo')?.value || '';
    const jenisFilter = document.getElementById('rekapJenisTiket')?.value || 'all';
    const timFilter = document.getElementById('rekapTim')?.value || 'all';

    const checkedJenis = [];
    if (document.getElementById('expPSB')?.checked) checkedJenis.push('PSB');
    if (document.getElementById('expGGN')?.checked) checkedJenis.push('GGN');
    if (document.getElementById('expGAMAS')?.checked) checkedJenis.push('GAMAS');
    if (document.getElementById('expPROJECT')?.checked) checkedJenis.push('PROJECT');
    if (document.getElementById('expMIGRASI')?.checked) checkedJenis.push('MIGRASI');
    if (document.getElementById('expLAINNYA')?.checked) checkedJenis.push('LAINNYA');

    if (checkedJenis.length === 0) {
        Swal.fire('Peringatan', 'Pilih minimal 1 jenis tiket untuk di-export!', 'warning');
        return;
    }

    let data = tickets.filter(t => {
        if (!t.createdAt) return false;
        const tDate = new Date(t.createdAt);
        const tDateStr = tDate.toISOString().split('T')[0];
        if (dateFrom && tDateStr < dateFrom) return false;
        if (dateTo && tDateStr > dateTo) return false;
        if (jenisFilter !== 'all' && (t.jenistiket || '') !== jenisFilter) return false;
        if (!checkedJenis.includes(t.jenistiket || '')) return false;
        if (!isTimMatch(t, timFilter)) return false;
        return true;
    });

    if (data.length === 0) {
        Swal.fire('Info', 'Tidak ada data tiket untuk di-export.', 'info');
        return;
    }

    // GROUP: tanggal → tim
    const dateMap = {};
    data.forEach(t => {
        const tgl = new Date(t.createdAt);
        const dateKey = tgl.getFullYear() + '-' +
            String(tgl.getMonth() + 1).padStart(2, '0') + '-' +
            String(tgl.getDate()).padStart(2, '0');
        if (!dateMap[dateKey]) dateMap[dateKey] = [];
        dateMap[dateKey].push(t);
    });

    const sortedDateKeys = Object.keys(dateMap).sort();
    const sortedData = [];

    sortedDateKeys.forEach(dateKey => {
        const ticketsInDate = dateMap[dateKey];
        const timMap = {};
        ticketsInDate.forEach(t => {
            const techList = (t.technicians || []).slice().sort();
            const timKey = techList.length > 0 ? techList.join('|') : 'TANPA_TEKNISI';
            if (!timMap[timKey]) timMap[timKey] = [];
            timMap[timKey].push(t);
        });

        // Urutkan tim berdasar close paling awal
        const timKeys = Object.keys(timMap).sort((a, b) => {
            const aMin = Math.min(...timMap[a].map(t => {
                const c = (t.status === 'close' && t.closedAt) ? new Date(t.closedAt).getTime() : Infinity;
                return isFinite(c) ? c : Infinity;
            }));
            const bMin = Math.min(...timMap[b].map(t => {
                const c = (t.status === 'close' && t.closedAt) ? new Date(t.closedAt).getTime() : Infinity;
                return isFinite(c) ? c : Infinity;
            }));
            return aMin - bMin;
        });

        timKeys.forEach(timKey => {
            // URUT BERDASARKAN JAM CLOSE — paling akhir di bawah
            const list = timMap[timKey].slice().sort((a, b) => {
                const ca = (a.status === 'close' && a.closedAt) ? new Date(a.closedAt).getTime() : Infinity;
                const cb = (b.status === 'close' && b.closedAt) ? new Date(b.closedAt).getTime() : Infinity;
                return ca - cb;
            });
            list.forEach(t => sortedData.push({ ticket: t, timKey: timKey }));
        });
    });

    // HITUNG jam mulai: close sebelumnya + 2-13 menit
    const timState = {};
    const rows = [];
    let noUrut = 0;

    sortedData.forEach(({ ticket: t, timKey }) => {
        noUrut++;

        const openDate = new Date(t.createdAt);
        const tglStr = String(openDate.getDate()).padStart(2, '0') + '/' +
            String(openDate.getMonth() + 1).padStart(2, '0') + '/' +
            openDate.getFullYear();
        const jamKeluarStr = String(openDate.getHours()).padStart(2, '0') + ':' +
            String(openDate.getMinutes()).padStart(2, '0');

        let jenisPekerjaan = t.jenisgangguan || '-';
        if (t.jenistiket === 'PSB') jenisPekerjaan = 'PSB';
        if (t.jenistiket === 'PROJECT') jenisPekerjaan = 'PROJECT';

        let closeDate = null;
        if (t.status === 'close' && t.closedAt) {
            const cd = new Date(t.closedAt);
            if (!isNaN(cd.getTime())) closeDate = cd;
        }

        // JAM MULAI
        const offset = Math.floor(Math.random() * 12) + 2;
        let baseTime;

        const state = timState[timKey];
        if (!state || !state.lastClose) {
            baseTime = openDate.getTime();
        } else {
            baseTime = state.lastClose.getTime();
        }

        let jamMulaiDate = new Date(baseTime + offset * 60000);

        // Jaga-jaga: mulai tidak boleh sebelum open
        if (jamMulaiDate.getTime() < openDate.getTime()) {
            jamMulaiDate = new Date(openDate.getTime() + offset * 60000);
        }
        // Jaga-jaga: mulai tidak boleh setelah/lewat close
        if (closeDate && jamMulaiDate.getTime() >= closeDate.getTime()) {
            jamMulaiDate = new Date(closeDate.getTime() - 60000);
        }

        const jamMulaiStr = String(jamMulaiDate.getHours()).padStart(2, '0') + ':' +
            String(jamMulaiDate.getMinutes()).padStart(2, '0');

        let jamSelesaiStr = '-';
        if (closeDate) {
            jamSelesaiStr = String(closeDate.getHours()).padStart(2, '0') + ':' +
                String(closeDate.getMinutes()).padStart(2, '0');
        }

        if (!timState[timKey]) timState[timKey] = { lastClose: null };
        if (closeDate) {
            if (!timState[timKey].lastClose || closeDate > timState[timKey].lastClose) {
                timState[timKey].lastClose = closeDate;
            }
        }

        const techList = (t.technicians || []).slice().sort();
        if (techList.length === 0) {
            rows.push({
                no: noUrut, tanggal: tglStr, idTiket: t.ticketid || '-',
                jenisPekerjaan, pelanggan: t.customer || '-', teknisi: '-',
                jamKeluar: jamKeluarStr, jamMulai: jamMulaiStr, jamSelesai: jamSelesaiStr
            });
        } else {
            techList.forEach((nama, idx) => {
                rows.push({
                    no: idx === 0 ? noUrut : '',
                    tanggal: idx === 0 ? tglStr : '',
                    idTiket: idx === 0 ? (t.ticketid || '-') : '',
                    jenisPekerjaan: idx === 0 ? jenisPekerjaan : '',
                    pelanggan: idx === 0 ? (t.customer || '-') : '',
                    teknisi: nama,
                    jamKeluar: jamKeluarStr,
                    jamMulai: jamMulaiStr,
                    jamSelesai: jamSelesaiStr
                });
            });
        }
    });

    const aoa = [];
    aoa.push(['', '', 'TIKET TEKNISI', '', '', '', '', '', '']);
    aoa.push(['NO', 'TANGGAL', 'ID TIKET', 'JENIS PEKERJAAN', 'PELANGGAN', 'TEKNISI', 'JAM KELUAR', 'JAM MULAI', 'JAM SELESAI']);
    rows.forEach(r => {
        aoa.push([r.no, r.tanggal, r.idTiket, r.jenisPekerjaan, r.pelanggan, r.teknisi, r.jamKeluar, r.jamMulai, r.jamSelesai]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 6 }, { wch: 12 }, { wch: 40 }, { wch: 45 }, { wch: 25 },
        { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'REKAP');

    let fileName = 'REKAP TIKET TEKNISI';
    if (dateFrom && dateTo) {
        const p1 = dateFrom.split('-');
        const p2 = dateTo.split('-');
        fileName += '_' + p1[2] + '-' + p1[1] + '-' + p1[0] +
            '_sd_' + p2[2] + '-' + p2[1] + '-' + p2[0];
    } else if (dateFrom) {
        const p = dateFrom.split('-');
        fileName += '_' + p[2] + '-' + p[1] + '-' + p[0];
    }
    fileName += '.xlsx';

    XLSX.writeFile(wb, fileName);
    Swal.fire('Berhasil!', '✅ File ' + fileName + ' berhasil di-export!', 'success');
}

    async function editJenisGangguan(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;

    // PSB LANGSUNG RETURN TANPA WARNING
    if (ticket.jenistiket === 'PSB') return;
    
    // CEK JIKA TIKET PSB, TIDAK BISA EDIT JENIS GANGGUAN
    if (ticket.jenistiket === 'PSB') {
        notif('Tiket PSB tidak memiliki jenis gangguan!', 'warning');
        return;
    }
    
    if (ticket.status !== 'close') {
        notif('Hanya tiket yang sudah close yang bisa diedit jenis gangguannya!', 'warning');
        return;
    }
    
    // DROPDOWN JENIS GANGGUAN (TANPA PSB)
    const optionsList = [
        'Ganti Adaptor',
        'Ganti HTB',
        'Ganti Modem',
        'Ganti Sandi',
        'Internet lambat',
        'Kabel Putus (LOS)',
        'Kabel Terjuntai',
        'Kelistrikan',
        'Modem Mati',
        'Pindah Modem',
        'Redaman Tinggi',
        'Tidak Ada Koneksi Internet',
        'GAMAS FEEDER',
        'GAMAS DISTRIBUSI',
        'GAMAS ODP',
        'PROJECT'
    ];
    
    let optionsHtml = '';
    optionsList.forEach(opt => {
        const selected = (opt === ticket.jenisgangguan) ? 'selected' : '';
        optionsHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    
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
                    ${optionsHtml}
                </select>
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
        
        // ✅ LOG HISTORY: UPDATE GANGGUAN
        await logTicketHistory(ticket.ticketid, 'update_gangguan', {
            oldValue: ticket.jenisgangguan || '-',
            newValue: newJenisGangguan,
            description: `⚠️ Jenis gangguan diubah: "${ticket.jenisgangguan || '-'}" → "${newJenisGangguan}"`
        });
        
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
    } else if (jenisTiket === 'PROJECT') {
        return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#8b5cf6;color:white;">PROJECT</span>';
    } else if (jenisTiket === 'MIGRASI') {
        return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#0891b2;color:white;">MIGRASI</span>';
    } else {
        return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#2563eb;color:white;">RETAIL</span>';
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
        
        // ✅ PENGAMAN KALAU TIKET UNDEFINED
        if (!ticket) {
            notif('Tiket tidak ditemukan / gagal dimuat!', 'danger');
            return;
        }

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
                            <strong>Tiket:</strong> ${ticket.ticketid || '-'}
                        </p>
                        <p style="font-size:13px;color:#475569;margin-bottom:4px;">
                            <strong>Customer:</strong> ${ticket.customer || '-'}
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

            notif('✅ Waktu close tiket ' + (ticket.ticketid || '') + ' berhasil diupdate!', 'success');
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
                    
                    // ✅ LOG HISTORY: GANTI TEKNISI
                    await logTicketHistory(ticket.ticketid, 'update_tech', {
                        oldValue: currentTechs.join(', '),
                        newValue: result.value.join(', '),
                        description: `👨‍🔧 Teknisi diubah: [${currentTechs.join(', ')}] → [${result.value.join(', ')}]`
                    });
                    
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

        // ✅ LOG HISTORY: TAMBAH TEKNISI
        await logTicketHistory(ticket.ticketid, 'add_tech', {
            newValue: result.value.join(', '),
            description: `➕ Teknisi ditambahkan: ${result.value.join(', ')}`
        });

        notif('Teknisi diperbarui','success');
        // Update memory langsung
        const idx = tickets.findIndex(x => x.id === ticketid);
        if (idx !== -1) {
            tickets[idx].technicians = newTechs;
        }
        // Render ulang tabel saja
        renderTickets(null, currentPage);
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
    const globalSearch = document.getElementById('filterGlobal').value.trim().toLowerCase();
    const status = document.getElementById('filterStatusSelect').value;
    const jenisTiket = document.getElementById('filterJenisTiket').value;

    let filtered = tickets.filter(t => {
        // Filter tanggal
        if (dateFrom || dateTo) {
            const d = new Date(t.createdAt);
            const dStr = d.toISOString().split('T')[0];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
        }
        
        // PENCARIAN GLOBAL
        if (globalSearch) {
            const searchFields = [
                t.ticketid || '',
                t.ticketId || '',
                t.customer || '',
                t.kodePelanggan || '',
                t.odppelanggan || '',
                t.jenisgangguan || '',
                t.jenistiket || '',
                (t.technicians || []).join(' ')
            ];
            
            const match = searchFields.some(function(field) {
                return field.toLowerCase().includes(globalSearch);
            });
            
            if (!match) return false;
        }
        
        // Filter Status
        if (status === 'overdue') {
            if (t.status === 'close' || t.status === 'open') {
                return (t.ttr || 0) > t.duration;
            }
            return false;
        }
        if (status !== 'all' && t.status !== status) return false;
        
        // Filter Jenis Tiket
        if (jenisTiket !== 'all') {
            const jenis = t.jenistiket || '';
            if (jenis !== jenisTiket) return false;
        }
        
        return true;
    });
    
    filteredTickets = filtered;
    
    if (filtered.length > 0) {
        renderTickets(filtered, 1);
        document.getElementById('ticketCount').textContent = filtered.length + ' tiket (Filtered)';
    } else {
        const body = document.getElementById('ticketBody');
        body.innerHTML = '<tr><td colspan="16"><div class="empty">Tidak ada tiket sesuai filter</div></td></tr>';
        document.getElementById('ticketCount').textContent = '0 tiket';
        renderPagination(0, 1);
    }
}




        // ===== RESET FILTER =====
// ===== RESET FILTER DASHBOARD =====
function resetDashboardFilters() {
    var dateFrom = document.getElementById('dashFilterDate');
    var dateTo = document.getElementById('dashFilterDateTo');
    var jenis = document.getElementById('dashFilterJenis');

    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    if (jenis) jenis.value = 'all';

    dashCurrentPage = 1;
    renderDashboard();
}

// ===== RESET FILTER MENU TIKET =====
function resetFilters() {
    var filterDate = document.getElementById('filterDate');
    var filterDateTo = document.getElementById('filterDateTo');
    var filterGlobal = document.getElementById('filterGlobal');
    var filterStatusSelect = document.getElementById('filterStatusSelect');
    var filterJenisTiket = document.getElementById('filterJenisTiket');

    if (filterDate) filterDate.value = '';
    if (filterDateTo) filterDateTo.value = '';
    if (filterGlobal) filterGlobal.value = '';
    if (filterStatusSelect) filterStatusSelect.value = 'all';
    if (filterJenisTiket) filterJenisTiket.value = 'all';

    applyFilters();
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
    
    const todayTickets = tickets.filter(t => {
        const d = new Date(t.createdAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    });
    
    const gaulSet = getPelangganGaul();
    const filtered = todayTickets.filter(t => gaulSet.has(t.kodePelanggan));
    
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
            // ============================================================
// PERFORMANSI TEKNISI - DIVISI SETELAH NAMA
// ============================================================
function renderPerformance() {
    const body = document.getElementById('perfBody');
    if(tickets.length===0 || techs.length===0) {
        body.innerHTML = `<tr><td colspan="8"><div class="empty"><span class="icon">📊</span><p>Belum ada data</p></div></td></tr>`;
        return;
    }
    
    const perf = {};
    techs.forEach(t => { 
        perf[t.name] = { 
            total: 0, 
            closed: 0, 
            open: 0, 
            overdue: 0, 
            totalTTR: 0, 
            closedCount: 0,
            posisi: t.posisi || 'PSB/GGN'
        }; 
    });
    
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
        body.innerHTML = `<tr><td colspan="8"><div class="empty"><span class="icon">📊</span><p>Belum ada aktivitas</p></div></td></tr>`;
        return;
    }
    
    const sorted = Object.keys(perf).sort((a, b) => {
        return perf[b].closed - perf[a].closed;
    });
    
    let no = 1;
    body.innerHTML = sorted.map(name => {
        const d = perf[name];
        const avg = d.closedCount>0 ? (d.totalTTR/d.closedCount) : 0;
        const divisi = d.posisi || 'PSB/GGN';
        
        let bgColor = '#e0e7ff';
        let textColor = '#1e3a6b';
        if (divisi === 'BACKBONE') { bgColor = '#fef3c7'; textColor = '#92400e'; }
        else if (divisi === 'PROJECT') { bgColor = '#d1fae5'; textColor = '#065f46'; }
        
        return `<tr>
            <td>${no++}</td>
            <td><strong>${name}</strong></td>
            <td><span style="display:inline-block;padding:2px 12px;border-radius:12px;font-size:11px;font-weight:600;background:${bgColor};color:${textColor};">${divisi}</span></td>
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
        document.querySelectorAll('#ticketBody tr').forEach(row => {
            const ttrCell = row.querySelector('.ttr-cell');
            if(!ttrCell) return;
            const ticketid = row.getAttribute('data-ticket-id');
            if(!ticketid) return;
            const ticket = tickets.find(t => t.id === ticketid);
            if(!ticket || ticket.status !== 'open') return;
            
            const now = new Date();
            const createdAt = new Date(ticket.createdAt);
            const elapsedMinutes = (now.getTime() - createdAt.getTime()) / 60000;
            const remainingMinutes = ticket.duration - elapsedMinutes;
            
            if(remainingMinutes <= 0) {
                ttrCell.innerHTML = `<span class="live-timer overdue" style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">🔴 +${formatDur(Math.abs(remainingMinutes))}</span>`;
            } else {
                ttrCell.innerHTML = `<span class="live-timer" style="background:#dcfce7;color:#166534;padding:2px 12px;border-radius:6px;font-weight:600;">⏳ ${formatDur(remainingMinutes)}</span>`;
            }
        });

        document.querySelectorAll('#dashTicketBody tr .dash-ttr-cell').forEach(ttrCell => {
            const ticketid = ttrCell.getAttribute('data-ticket-id');
            if(!ticketid) return;
            const ticket = tickets.find(t => t.id === ticketid);
            if(!ticket || ticket.status !== 'open') return;
            
            const now = new Date();
            const createdAt = new Date(ticket.createdAt);
            const elapsedMinutes = (now.getTime() - createdAt.getTime()) / 60000;
            const remainingMinutes = ticket.duration - elapsedMinutes;
            
            if(remainingMinutes <= 0) {
                ttrCell.innerHTML = `<span class="live-timer overdue" style="background:#fee2e2;color:#dc2626;padding:2px 12px;border-radius:6px;font-weight:700;">🔴 +${formatDur(Math.abs(remainingMinutes))}</span>`;
            } else {
                ttrCell.innerHTML = `<span class="live-timer" style="background:#dcfce7;color:#166534;padding:2px 12px;border-radius:6px;font-weight:600;">⏳ ${formatDur(remainingMinutes)}</span>`;
            }
        });
    }, 1000);
}

function goToTicket(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
        Swal.fire('Error', 'Tiket tidak ditemukan!', 'error');
        return;
    }
    
    if (ticket.status === 'close') {
        showTicketDetail(ticket);
        return;
    }
    
    const isOverdue = ticket.duration - ((new Date().getTime() - new Date(ticket.createdAt).getTime()) / 60000) <= 0;
    
    Swal.fire({
        title: '',
        width: 620,
        padding: 0,
        background: '#ffffff',
        showConfirmButton: (ticket.status === 'open'),
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '✅ Close Tiket',
        denyButtonText: (ticket.status === 'pending') ? '▶️ Resume Tiket' : '⏸ Pending',
        cancelButtonText: '✕ Tutup',
        confirmButtonColor: '#2563eb',
        denyButtonColor: (ticket.status === 'pending') ? '#16a34a' : '#f59e0b',
        cancelButtonColor: '#94a3b8',
        html: `
            <div style="padding:0;font-family:'Inter',-apple-system,sans-serif;">
                <!-- HEADER BANNER -->
                <div style="background:${isOverdue ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'linear-gradient(135deg,#0b1a33,#1e3a6b)'};padding:18px 22px;border-radius:16px 16px 0 0;color:white;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.7;font-weight:600;">Tiket</div>
                        <div style="font-size:22px;font-weight:700;margin-top:2px;">${ticket.ticketid}</div>
                        <div style="font-size:13px;opacity:0.9;margin-top:3px;display:flex;align-items:center;gap:6px;">
                            <i class="fas fa-user" style="font-size:11px;"></i> ${ticket.customer}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="background:${isOverdue ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)'};padding:6px 16px;border-radius:24px;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;gap:8px;">
                            ${isOverdue ? '⚠️ OVERDUE' : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;animation:blink 1s infinite;"></span> OPEN'}
                        </div>
                        <div style="font-size:11px;opacity:0.7;margin-top:5px;">
                            <i class="far fa-clock" style="font-size:10px;"></i> ${new Date(ticket.createdAt).toLocaleString('id-ID')}
                        </div>
                    </div>
                </div>
                
                <!-- BODY -->
                <div style="padding:16px 22px 18px;">
                    <!-- BADGE -->
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
                        <span style="background:#dbeafe;color:#1e40af;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;">${ticket.jenistiket || 'GGN'}</span>
                        <span style="background:#f1f5f9;color:#475569;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;">${ticket.jenisgangguan || '-'}</span>
                        <span style="background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;">
                            <i class="fas fa-user-cog" style="font-size:10px;"></i> ${(ticket.technicians || []).join(', ') || '-'}
                        </span>
                    </div>
                    
                    <!-- INFO 2 KOLOM -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
    <div style="background:#e0f2fe;padding:9px 12px;border-radius:8px;border-left:3px solid #0284c7;">
        <div style="font-size:9px;color:#0369a1;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">ODP / Wilayah</div>
        <div style="font-weight:600;color:#0b1a33;font-size:12px;margin-top:1px;">${ticket.odppelanggan || '-'}</div>
    </div>
    <div style="background:#ede9fe;padding:9px 12px;border-radius:8px;border-left:3px solid #7c3aed;">
        <div style="font-size:9px;color:#6d28d9;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">Kode Pelanggan</div>
        <div style="font-weight:600;color:#0b1a33;font-size:12px;margin-top:1px;">${ticket.kodePelanggan || '-'}</div>
    </div>
    <div style="background:#dcfce7;padding:9px 12px;border-radius:8px;border-left:3px solid #16a34a;">
        <div style="font-size:9px;color:#15803d;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">Durasi SLA</div>
        <div style="font-weight:700;color:#0b1a33;font-size:13px;margin-top:1px;">${formatDur(ticket.duration)}</div>
    </div>
    <div style="background:#fef3c7;padding:9px 12px;border-radius:8px;border-left:3px solid #d97706;">
        <div style="font-size:9px;color:#b45309;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">Target Selesai</div>
        <div style="font-weight:600;color:#0b1a33;font-size:11px;margin-top:1px;">${new Date(new Date(ticket.createdAt).getTime() + ticket.duration * 60000).toLocaleString('id-ID')}</div>
    </div>
</div>
                    
                    <!-- TTR LIVE -->
                    <div style="background:${isOverdue ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)'};border-radius:12px;padding:14px 18px;border:2px solid ${isOverdue ? '#dc2626' : '#22c55e'};margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">
                                <i class="fas fa-hourglass-half" style="margin-right:5px;"></i> Time to Resolve (TTR)
                            </div>
                            <div style="font-size:26px;font-weight:800;color:#0b1a33;font-family:'Courier New',monospace;margin-top:3px;letter-spacing:-0.5px;line-height:1;" id="ttrLive_${ticket.id}">
                                ${(function(){
    if (ticket.status === 'pending') {
        let frozenElapsed = 0;
        if (ticket.pendingAt) {
            frozenElapsed = (new Date(ticket.pendingAt).getTime() - new Date(ticket.createdAt).getTime()) / 60000;
        }
        const pendingDur = (ticket.pendingDuration || 0) / 60000;
        const rem = ticket.duration - (frozenElapsed - pendingDur);
        return `<span style="color:#3730a3;">⏸ ${formatDur(Math.max(rem,0))}</span>`;
    }
    const elapsed = (new Date().getTime() - new Date(ticket.createdAt).getTime()) / 60000;
    const pendingDur = (ticket.pendingDuration || 0) / 60000;
    const rem = ticket.duration - (elapsed - pendingDur);
    return formatDur(Math.max(rem,0));
})()}
                            </div>
                        </div>

                        
                        <div style="text-align:right;">
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Status</div>
                            <div style="font-weight:700;font-size:13px;color:${isOverdue ? '#dc2626' : '#16a34a'};margin-top:2px;">
                                ${isOverdue ? '⚠️ OVERDUE' : '✓ ON TRACK'}
                            </div>
                        </div>
                    </div>

                                        ${ticket.jenistiket === 'GAMAS' && ticket.odp_terimbas ? `
                    <div style="background:#fef2f2;border-radius:10px;padding:11px 14px;border:2px solid #dc2626;margin-bottom:8px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                            <span style="font-size:15px;">🚨</span>
                            <span style="font-weight:700;color:#7f1d1d;font-size:11px;text-transform:uppercase;">ODP TERIMBAS</span>
                        </div>
                        <div style="background:white;border-radius:7px;padding:9px 12px;font-family:'Courier New',monospace;font-size:11px;color:#7f1d1d;font-weight:600;white-space:pre-wrap;line-height:1.6;max-height:150px;overflow-y:auto;">${ticket.odp_terimbas}</div>
                    </div>` : ''}
                    
                    ${ticket.keterangan ? `
<div style="background:${isOverdue ? '#fef2f2' : '#fffbeb'};padding:11px 14px;border-radius:10px;border:1px solid ${isOverdue ? '#fca5a5' : '#fde68a'};margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;">
    <i class="fas fa-info-circle" style="color:${isOverdue ? '#dc2626' : '#f59e0b'};font-size:15px;margin-top:1px;"></i>
    <div>
        <div style="font-size:10px;color:${isOverdue ? '#991b1b' : '#92400e'};font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">${isOverdue ? '⚠️ KETERANGAN OVERDUE' : 'Keterangan'}</div>
        <div style="color:${isOverdue ? '#7f1d1d' : '#78350f'};font-size:12px;margin-top:2px;">${ticket.keterangan}</div>
    </div>
</div>` : ''}
                    
                                        ${ticket.jenisperbaikan ? `
                    <div style="background:#f0fdf4;padding:11px 14px;border-radius:10px;border:1px solid #86efac;display:flex;gap:10px;align-items:flex-start;">
                        <i class="fas fa-tools" style="color:#22c55e;font-size:15px;margin-top:1px;"></i>
                        <div>
                            <div style="font-size:10px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Jenis Perbaikan</div>
                            <div style="color:#14532d;font-size:12px;margin-top:2px;">${ticket.jenisperbaikan}</div>
                        </div>
                    </div>` : ''}

                    <!-- ✅ PEMAKAIAN BARANG -->
                    <div id="pemakaianBarangDetail_${ticket.id}" style="margin-top:8px;"></div>

                    ${ticket.jenistiket === 'MIGRASI' ? `
                    <div style="background:#ecfeff;padding:11px 14px;border-radius:10px;border:1px solid #67e8f9;margin-top:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div style="font-size:11px;color:#0e7490;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">
                                <i class="fas fa-users" style="margin-right:5px;"></i> Pelanggan Migrasi
                            </div>
                            <button onclick="event.stopPropagation(); openMigrasiPelangganModal('${ticket.id}')" 
                                style="padding:5px 12px;background:#0891b2;color:white;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;">
                                <i class="fas fa-plus"></i> Tambah
                            </button>
                        </div>
                        <div id="migrasiList_${ticket.id}" style="font-size:12px;color:#64748b;">
                            Memuat data...
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `,
        didOpen: () => {
            if (ticket.jenistiket === 'MIGRASI') {
                loadMigrasiPelangganList(ticket.id);
            }
            const interval = setInterval(() => {
    const el = document.getElementById('ttrLive_' + ticket.id);
    if (!el) { clearInterval(interval); return; }
    const parent = el.closest('div[style*="linear-gradient"]');

    if (ticket.status === 'pending') {
        let frozenElapsed;
        if (ticket.pendingAt) {
            const pendingAt = new Date(ticket.pendingAt);
            frozenElapsed = (pendingAt.getTime() - new Date(ticket.createdAt).getTime()) / 60000;
        } else {
            frozenElapsed = 0;
        }
        const pendingDur = (ticket.pendingDuration || 0) / 60000;
        const rem = ticket.duration - (frozenElapsed - pendingDur);

        if (rem <= 0) {
            el.innerHTML = `<span style="color:#dc2626;">+${formatDur(Math.abs(rem))}</span>`;
            if (parent) {
                parent.style.background = 'linear-gradient(135deg,#fef2f2,#fee2e2)';
                parent.style.borderColor = '#dc2626';
            }
        } else {
            el.innerHTML = `<span style="color:#3730a3;">⏸ ${formatDur(rem)}</span>`;
            if (parent) {
                parent.style.background = 'linear-gradient(135deg,#e0e7ff,#c7d2fe)';
                parent.style.borderColor = '#6366f1';
            }
        }
        return;
    }

    const now = new Date();
    const elapsed = (now.getTime() - new Date(ticket.createdAt).getTime()) / 60000;
    const pendingDur = (ticket.pendingDuration || 0) / 60000;
    const rem = ticket.duration - (elapsed - pendingDur);

    if (rem <= 0) {
        el.innerHTML = `<span style="color:#dc2626;">+${formatDur(Math.abs(rem))}</span>`;
        if (parent) {
            parent.style.background = 'linear-gradient(135deg,#fef2f2,#fee2e2)';
            parent.style.borderColor = '#dc2626';
        }
    } else {
        el.innerHTML = `<span style="color:#16a34a;">${formatDur(rem)}</span>`;
        if (parent) {
            parent.style.background = 'linear-gradient(135deg,#f0fdf4,#dcfce7)';
            parent.style.borderColor = '#22c55e';
        }
    }
}, 1000);
            Swal.getConfirmButton()?.addEventListener('click', () => clearInterval(interval));
            Swal.getDenyButton()?.addEventListener('click', () => clearInterval(interval));
            Swal.getCancelButton()?.addEventListener('click', () => clearInterval(interval));
        },
        preConfirm: () => { if (ticket.status === 'open') closeticket(ticket.id); },
preDeny: () => {
    if (ticket.status === 'open') {
        pendingTicket(ticket.id);
    } else if (ticket.status === 'pending') {
        resumeTicket(ticket.id);
    }
}
    });
}



async function resumeTicket(docId) {
    const ticket = tickets.find(t => t.id === docId);
    if (!ticket) return;
    if (ticket.status !== 'pending') return;

    const confirm = await Swal.fire({
        title: '▶️ Resume Tiket?',
        html: `Lanjutkan tiket <strong>${ticket.ticketid}</strong>?<br><small style="color:#64748b;">TTR akan lanjut dari posisi terakhir.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Lanjutkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#94a3b8'
    });

    if (!confirm.isConfirmed) return;

    try {
        const pendingAt = ticket.pendingAt ? new Date(ticket.pendingAt) : null;
        const now = new Date();
        let totalPendingMs = ticket.pendingDuration || 0;

        if (pendingAt) {
            totalPendingMs += (now.getTime() - pendingAt.getTime());
        }

        const { error } = await sb
            .from('tickets')
            .update({
                status: 'open',
                pendingAt: null,
                pendingDuration: totalPendingMs
            })
            .eq('id', docId);

                if (error) throw error;

        // ✅ LOG HISTORY: RESUME
        await logTicketHistory(ticket.ticketid, 'resume', {
            description: `▶️ Tiket dilanjutkan (pending ${Math.round(totalPendingMs/60000)} menit)`
        });

        notif('✅ Tiket ' + ticket.ticketid + ' dilanjutkan', 'success');
        refreshData();
    } catch (e) {
        notif('❌ Gagal resume: ' + e.message, 'danger');
    }
}
// ============================================================
// MIGRASI PELANGGAN - TAMBAH/LOAD/DELETE
// ============================================================

// LOAD DAFTAR PELANGGAN MIGRASI UNTUK 1 TIKET
async function loadMigrasiPelangganList(ticketId) {
    const container = document.getElementById('migrasiList_' + ticketId);
    if (!container) return;

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    try {
        const { data, error } = await sb
            .from('pelanggan')
            .select('id, id_pelanggan, nama, odp, no_hp, alamat, taging_lokasi, taging_odp, tanggal_pasang, foto_depan, foto_ktp, sumber, migrasi_ticket_id')
            .eq('sumber', 'MIGRASI')
            .eq('migrasi_ticket_id', ticketId);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="padding:10px;background:white;border-radius:8px;color:#94a3b8;text-align:center;">Belum ada pelanggan migrasi ditambahkan.</div>';
            return;
        }

        let html = '<div style="background:white;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;overflow-x:auto;">';
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:800px;">';
        html += '<thead><tr style="background:#0e7490;color:white;">';
        html += '<th style="padding:8px;text-align:center;width:35px;">No</th>';
        html += '<th style="padding:8px;text-align:left;">ID Pelanggan</th>';
        html += '<th style="padding:8px;text-align:left;">Nama</th>';
        html += '<th style="padding:8px;text-align:left;">No HP</th>';
        html += '<th style="padding:8px;text-align:left;">Alamat</th>';
        html += '<th style="padding:8px;text-align:left;">ODP</th>';
        html += '<th style="padding:8px;text-align:center;width:110px;">Aksi</th>';
        html += '</tr></thead><tbody>';

        data.forEach((p, i) => {
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px;text-align:center;">${i + 1}</td>
                <td style="padding:8px;font-weight:600;">${p.id_pelanggan || '-'}</td>
                <td style="padding:8px;">${p.nama || '-'}</td>
                <td style="padding:8px;">${p.no_hp || '-'}</td>
                <td style="padding:8px;">${p.alamat || '-'}</td>
                <td style="padding:8px;">${p.odp || '-'}</td>
                <td style="padding:8px;text-align:center;white-space:nowrap;">
                    <button onclick="event.stopPropagation(); editMigrasiPelanggan('${p.id}', '${ticketId}')" 
                        style="background:#2563eb;color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;margin-right:4px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); deleteMigrasiPelanggan('${p.id}', '${ticketId}')" 
                        style="background:#dc2626;color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (e) {
        console.error('Error load migrasi pelanggan:', e);
        container.innerHTML = '<div style="color:#dc2626;">Gagal load data.</div>';
    }
}

// EDIT PELANGGAN MIGRASI
async function editMigrasiPelanggan(pelangganId, ticketId) {
    const { data: p, error: fetchErr } = await sb
        .from('pelanggan')
        .select('*')
        .eq('id', pelangganId)
        .maybeSingle();

    if (fetchErr || !p) {
        Swal.fire('Error', 'Data pelanggan tidak ditemukan!', 'error');
        return;
    }

    let tglPasang = '';
    if (p.tanggal_pasang && p.tanggal_pasang !== '-') {
        const tgl = String(p.tanggal_pasang);
        if (/^\d{2}-\d{2}-\d{4}$/.test(tgl)) {
            const [d, m, y] = tgl.split('-');
            tglPasang = y + '-' + m + '-' + d;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(tgl)) {
            tglPasang = tgl.slice(0, 10);
        }
    }

    const valId = p.id_pelanggan && p.id_pelanggan !== '-' ? p.id_pelanggan : '';
    const valNama = p.nama && p.nama !== '-' ? p.nama : '';
    const valNoHp = p.no_hp && p.no_hp !== '-' ? p.no_hp : '';
    const valOdp = p.odp && p.odp !== '-' ? p.odp : '';
    const valAlamat = p.alamat && p.alamat !== '-' ? p.alamat : '';
    const valTagingLokasi = p.taging_lokasi && p.taging_lokasi !== '-' ? p.taging_lokasi : '';
    const valTagingOdp = p.taging_odp && p.taging_odp !== '-' ? p.taging_odp : '';

    const result = await Swal.fire({
        title: '✏️ Edit Pelanggan Migrasi',
        width: 650,
        html: `
            <div style="text-align:left;font-size:14px; max-height:65vh; overflow-y:auto; padding-right:4px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">ID Pelanggan <span style="color:#dc2626;">*</span></label>
                        <input id="editMigIdPelanggan" type="text" value="${valId}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Nama <span style="color:#dc2626;">*</span></label>
                        <input id="editMigNama" type="text" value="${valNama}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">No HP</label>
                        <input id="editMigNoHp" type="text" value="${valNoHp}" oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">ODP</label>
                        <input id="editMigOdp" type="text" value="${valOdp}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="margin-bottom:12px;grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Alamat</label>
                        <input id="editMigAlamat" type="text" value="${valAlamat}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Taging Lokasi</label>
                        <input id="editMigTagingLokasi" type="text" value="${valTagingLokasi}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Taging ODP</label>
                        <input id="editMigTagingOdp" type="text" value="${valTagingOdp}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                                        <div style="margin-bottom:12px;grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Tanggal Pasang</label>
                        <input id="editMigTanggalPasang" type="date" value="${tglPasang}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>

                    <!-- ✅ FOTO RUMAH -->
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto Rumah</label>
                        <div id="editMigFotoRumahPreview">
                            ${p.foto_depan && p.foto_depan !== '-' 
                                ? `<img src="${p.foto_depan}" style="max-width:100%;max-height:100px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;">` 
                                : '<div style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Belum ada foto</div>'}
                        </div>
                        <input id="editMigFotoRumah" type="file" accept="image/*"
                            style="width:100%;padding:8px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:13px;background:white;">
                    </div>

                    <!-- ✅ FOTO KTP -->
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto KTP</label>
                        <div id="editMigFotoKtpPreview">
                            ${p.foto_ktp && p.foto_ktp !== '-' 
                                ? `<img src="${p.foto_ktp}" style="max-width:100%;max-height:100px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;">` 
                                : '<div style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Belum ada foto</div>'}
                        </div>
                        <input id="editMigFotoKtp" type="file" accept="image/*"
                            style="width:100%;padding:8px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:13px;background:white;">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#0891b2',
        cancelButtonColor: '#94a3b8',
                didOpen: () => {
            // PREVIEW FOTO RUMAH
            const inputRumah = document.getElementById('editMigFotoRumah');
            if (inputRumah) {
                inputRumah.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('editMigFotoRumahPreview').innerHTML =
                                `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;">`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
            // PREVIEW FOTO KTP
            const inputKtp = document.getElementById('editMigFotoKtp');
            if (inputKtp) {
                inputKtp.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            document.getElementById('editMigFotoKtpPreview').innerHTML =
                                `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;">`;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        },
        preConfirm: async () => {
            const idPelanggan = document.getElementById('editMigIdPelanggan').value.trim();
            const nama = document.getElementById('editMigNama').value.trim();
            const noHp = document.getElementById('editMigNoHp').value.trim();
            const odp = document.getElementById('editMigOdp').value.trim();
            const alamat = document.getElementById('editMigAlamat').value.trim();
            const tagingLokasi = document.getElementById('editMigTagingLokasi').value.trim();
            const tagingOdp = document.getElementById('editMigTagingOdp').value.trim();
            const tanggalPasang = document.getElementById('editMigTanggalPasang').value;
            const fotoRumahFile = document.getElementById('editMigFotoRumah').files[0];
            const fotoKtpFile = document.getElementById('editMigFotoKtp').files[0];

            if (!idPelanggan) {
                Swal.showValidationMessage('⚠️ ID Pelanggan wajib diisi!');
                return false;
            }
            if (!nama) {
                Swal.showValidationMessage('⚠️ Nama wajib diisi!');
                return false;
            }

            // ✅ UPLOAD FOTO RUMAH BARU (KALAU ADA)
            let fotoRumahUrl = p.foto_depan || '-';
            if (fotoRumahFile) {
                const compressed = await compressImage(fotoRumahFile, 1280, 0.7);
                const fileName = 'migrasi_edit_fr_' + Date.now() + '_' + compressed.name;
                const { error: uploadErr } = await sb.storage
                    .from('pelanggan-foto')
                    .upload(fileName, compressed);
                if (uploadErr) {
                    Swal.showValidationMessage('Gagal upload foto rumah: ' + uploadErr.message);
                    return false;
                }
                const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
                fotoRumahUrl = urlData.publicUrl;
            }

            let fotoKtpUrl = p.foto_ktp || '-';
            if (fotoKtpFile) {
                const compressed = await compressImage(fotoKtpFile, 1280, 0.7);
                const fileName = 'migrasi_edit_fk_' + Date.now() + '_' + compressed.name;
                const { error: uploadErr } = await sb.storage
                    .from('pelanggan-foto')
                    .upload(fileName, compressed);
                if (uploadErr) {
                    Swal.showValidationMessage('Gagal upload foto KTP: ' + uploadErr.message);
                    return false;
                }
                const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
                fotoKtpUrl = urlData.publicUrl;
            }

            return { idPelanggan, nama, noHp, odp, alamat, tagingLokasi, tagingOdp, tanggalPasang, fotoRumahUrl, fotoKtpUrl };
        }
    });

    if (!result.isConfirmed) {
        const t = tickets.find(x => x.id === ticketId);
        if (t) showTicketDetail(t);
        return;
    }
    const payload = result.value;

    let tanggalPasangFormatted = p.tanggal_pasang || '-';
    if (payload.tanggalPasang) {
        const [y, m, d] = payload.tanggalPasang.split('-');
        tanggalPasangFormatted = d + '-' + m + '-' + y;
    }

        try {
        const { error } = await sb
            .from('pelanggan')
            .update({
                id_pelanggan: payload.idPelanggan,
                nama: payload.nama,
                no_hp: payload.noHp || '-',
                odp: payload.odp || '-',
                alamat: payload.alamat || '-',
                taging_lokasi: payload.tagingLokasi || '-',
                taging_odp: payload.tagingOdp || '-',
                tanggal_pasang: tanggalPasangFormatted,
                foto_depan: payload.fotoRumahUrl || '-',
                foto_ktp: payload.fotoKtpUrl || '-'
            })
            .eq('id', pelangganId);

        if (error) throw error;

        notif('✅ Pelanggan migrasi berhasil diupdate!', 'success');
        loadMigrasiPelangganList(ticketId);

        const { data: freshPel } = await sb.from('pelanggan').select('*');
        pelangganData = freshPel || [];

    } catch (e) {
        console.error('Error update migrasi pelanggan:', e);
        Swal.fire('Error', 'Gagal update: ' + e.message, 'error');
    }
}

// MODAL INPUT PELANGGAN MIGRASI
async function openMigrasiPelangganModal(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // HAPUS MODAL LAMA KALAU ADA
    const existing = document.getElementById('migrasiModalCustom');
    if (existing) existing.remove();

    // BUAT MODAL CUSTOM
    const modal = document.createElement('div');
    modal.id = 'migrasiModalCustom';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999999;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        animation: fadeIn 0.25s ease;
    `;

    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:0;max-width:650px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 30px 90px rgba(0,0,0,0.4);animation:slideUp 0.3s ease;">
            <div style="background:linear-gradient(135deg,#0e7490,#0891b2);padding:20px 26px;border-radius:20px 20px 0 0;color:white;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:18px;font-weight:700;">📝 Tambah Pelanggan Migrasi</div>
                    <div style="font-size:12px;opacity:0.85;margin-top:2px;">Tiket: ${ticket.ticketid} • ${(ticket.technicians || []).join(', ') || '-'}</div>
                </div>
                <button onclick="closeMigrasiModalCustom()" style="background:rgba(255,255,255,0.15);border:none;color:white;width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer;">✕</button>
            </div>

            <div style="padding:24px 26px;font-size:14px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">ID Pelanggan <span style="color:#dc2626;">*</span></label>
                        <input id="migIdPelanggan" type="text" placeholder="Contoh: 1234567890"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Nama <span style="color:#dc2626;">*</span></label>
                        <input id="migNama" type="text" placeholder="Nama pelanggan"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">No HP</label>
                        <input id="migNoHp" type="text" placeholder="08123456789" oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">ODP</label>
                        <input id="migOdp" type="text" placeholder="Contoh: ODP-001"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Alamat</label>
                        <input id="migAlamat" type="text" placeholder="Alamat lengkap"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Taging Lokasi</label>
                        <input id="migTagingLokasi" type="text" placeholder="-6.123456, 106.123456"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Taging ODP</label>
                        <input id="migTagingOdp" type="text" placeholder="-6.123456, 106.123456"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Tanggal Pasang</label>
                        <input id="migTanggalPasang" type="date"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto Rumah</label>
                        <input id="migFotoRumah" type="file" accept="image/*"
                            style="width:100%;padding:8px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:13px;background:white;">
                        <div id="migFotoRumahPreview" style="margin-top:8px;"></div>
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Foto KTP</label>
                        <input id="migFotoKtp" type="file" accept="image/*"
                            style="width:100%;padding:8px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:13px;background:white;">
                        <div id="migFotoKtpPreview" style="margin-top:8px;"></div>
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
                    <button onclick="closeMigrasiModalCustom()" style="padding:10px 24px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
                        ✕ Batal
                    </button>
                    <button onclick="saveMigrasiPelanggan('${ticketId}')" style="padding:10px 30px;background:linear-gradient(135deg,#0e7490,#0891b2);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
                        💾 Simpan
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // PREVIEW FOTO
    setTimeout(() => {
        const inputRumah = document.getElementById('migFotoRumah');
        if (inputRumah) {
            inputRumah.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        document.getElementById('migFotoRumahPreview').innerHTML =
                            `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:8px;border:1px solid #e2e8f0;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        const inputKtp = document.getElementById('migFotoKtp');
        if (inputKtp) {
            inputKtp.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        document.getElementById('migFotoKtpPreview').innerHTML =
                            `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:8px;border:1px solid #e2e8f0;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }, 50);
}

function closeMigrasiModalCustom() {
    const modal = document.getElementById('migrasiModalCustom');
    if (modal) modal.remove();
    // MODAL DETAIL TIKET TETAP ADA DI BELAKANG — TIDAK PERLU DIPANGGIL ULANG
}

async function saveMigrasiPelanggan(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const idPelanggan = document.getElementById('migIdPelanggan').value.trim();
    const nama = document.getElementById('migNama').value.trim();
    const noHp = document.getElementById('migNoHp').value.trim();
    const odp = document.getElementById('migOdp').value.trim();
    const alamat = document.getElementById('migAlamat').value.trim();
    const tagingLokasi = document.getElementById('migTagingLokasi').value.trim();
    const tagingOdp = document.getElementById('migTagingOdp').value.trim();
    const tanggalPasang = document.getElementById('migTanggalPasang').value;
    const fotoRumahFile = document.getElementById('migFotoRumah').files[0];
    const fotoKtpFile = document.getElementById('migFotoKtp').files[0];

    if (!idPelanggan) { notif('⚠️ ID Pelanggan wajib diisi!', 'warning'); return; }
    if (!nama) { notif('⚠️ Nama wajib diisi!', 'warning'); return; }

    // UPLOAD FOTO
        let fotoRumahUrl = '-';
    if (fotoRumahFile) {
        const compressed = await compressImage(fotoRumahFile, 1280, 0.7);
        const fileName = 'migrasi_fr_' + Date.now() + '_' + compressed.name;
        const { error: uploadErr } = await sb.storage.from('pelanggan-foto').upload(fileName, compressed);
        if (uploadErr) { notif('Gagal upload foto rumah: ' + uploadErr.message, 'danger'); return; }
        const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
        fotoRumahUrl = urlData.publicUrl;
    }

    let fotoKtpUrl = '-';
    if (fotoKtpFile) {
        const compressed = await compressImage(fotoKtpFile, 1280, 0.7);
        const fileName = 'migrasi_fk_' + Date.now() + '_' + compressed.name;
        const { error: uploadErr } = await sb.storage.from('pelanggan-foto').upload(fileName, compressed);
        if (uploadErr) { notif('Gagal upload foto KTP: ' + uploadErr.message, 'danger'); return; }
        const { data: urlData } = sb.storage.from('pelanggan-foto').getPublicUrl(fileName);
        fotoKtpUrl = urlData.publicUrl;
    }

    // FORMAT TANGGAL
    let tanggalPasangFormatted = '-';
    if (tanggalPasang) {
        const [y, m, d] = tanggalPasang.split('-');
        tanggalPasangFormatted = d + '-' + m + '-' + y;
    } else if (ticket.createdAt) {
        const d = new Date(ticket.createdAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        tanggalPasangFormatted = dd + '-' + mm + '-' + yyyy;
    }

    try {
        // CEK APAKAH ID SUDAH ADA
        const { data: existing } = await sb
            .from('pelanggan')
            .select('id')
            .eq('id_pelanggan', idPelanggan)
            .maybeSingle();

        if (existing) {
            const confirm = await Swal.fire({
                title: '⚠️ Data Sudah Ada',
                html: `Pelanggan dengan ID <strong>${idPelanggan}</strong> sudah ada.<br><br>Update data?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '🔄 Update',
                cancelButtonText: '⏭️ Skip',
                confirmButtonColor: '#2563eb',
                cancelButtonColor: '#94a3b8'
            });

            if (confirm.isConfirmed) {
                const { error: updateErr } = await sb
                    .from('pelanggan')
                    .update({
                        nama, no_hp: noHp || '-', alamat: alamat || '-',
                        taging_lokasi: tagingLokasi || '-', taging_odp: tagingOdp || '-',
                        odp: odp || '-', tanggal_pasang: tanggalPasangFormatted,
                        foto_depan: fotoRumahUrl || '-', foto_ktp: fotoKtpUrl || '-',
                        sumber: 'MIGRASI', migrasi_ticket_id: ticketId,
                        ticket_id: ticket.ticketid || '-'
                    })
                    .eq('id', existing.id);
                if (updateErr) throw updateErr;
                notif('✅ Pelanggan diupdate!', 'success');
            } else {
                notif('⏭️ Pelanggan dilewati', 'info');
                closeMigrasiModalCustom();
                return;
            }
        } else {
            const { error: insertErr } = await sb
                .from('pelanggan')
                .insert({
                    id_pelanggan: idPelanggan, nama,
                    no_hp: noHp || '-', alamat: alamat || '-',
                    taging_lokasi: tagingLokasi || '-', taging_odp: tagingOdp || '-',
                    odp: odp || '-', tanggal_pasang: tanggalPasangFormatted,
                    foto_depan: fotoRumahUrl || '-', foto_ktp: fotoKtpUrl || '-',
                    sumber: 'MIGRASI', migrasi_ticket_id: ticketId,
                    ticket_id: ticket.ticketid || '-'
                });
            if (insertErr) throw insertErr;
            notif('✅ Pelanggan migrasi ditambahkan!', 'success');
        }

        // REFRESH LIST DI MODAL DETAIL (TANPA TUTUP MODAL DETAIL)
        loadMigrasiPelangganList(ticketId);
        closeMigrasiModalCustom();

        // REFRESH CACHE
        const { data: freshPel } = await sb.from('pelanggan').select('*');
        pelangganData = freshPel || [];

    } catch (e) {
        console.error('Error save migrasi:', e);
        notif('Gagal simpan: ' + e.message, 'danger');
    }
}

// HAPUS PELANGGAN MIGRASI (HAPUS DARI TABEL PELANGGAN)
async function deleteMigrasiPelanggan(pelangganId, ticketId) {
    const confirm = await Swal.fire({
        title: '⚠️ Hapus Pelanggan?',
        text: 'Pelanggan ini akan dihapus dari database.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🗑️ Hapus',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8'
    });

        if (!confirm.isConfirmed) {
        const t = tickets.find(x => x.id === ticketId);
        if (t) showTicketDetail(t);
        return;
    }

    try {
        const { error } = await sb
            .from('pelanggan')
            .delete()
            .eq('id', pelangganId);

        if (error) throw error;

        notif('✅ Pelanggan dihapus!', 'success');
        loadMigrasiPelangganList(ticketId);

        // REFRESH CACHE
        const { data: freshPel } = await sb.from('pelanggan').select('*');
        pelangganData = freshPel || [];

    } catch (e) {
        console.error('Error delete:', e);
        Swal.fire('Error', 'Gagal hapus: ' + e.message, 'error');
    }
}

function showTicketDetail(ticket) {
    const diff = (ticket.ttr || 0) - ticket.duration;
    const isOverdue = diff > 0;
    
    Swal.fire({
        title: '',
        width: 620,
        padding: 0,
        background: '#ffffff',
        confirmButtonText: '✕ Tutup',
        confirmButtonColor: '#2563eb',
        html: `
            <div style="padding:0;font-family:'Inter',-apple-system,sans-serif;">
                <!-- HEADER BANNER -->
                <div style="background:${isOverdue ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'linear-gradient(135deg,#064e3b,#0d9488)'};padding:18px 22px;border-radius:18px 18px 0 0;color:white;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.7;font-weight:600;">Tiket Selesai</div>
                        <div style="font-size:22px;font-weight:700;margin-top:2px;letter-spacing:-0.3px;">${ticket.ticketid}</div>
                        <div style="font-size:13px;opacity:0.9;margin-top:3px;display:flex;align-items:center;gap:6px;">
                            <i class="fas fa-user" style="font-size:11px;"></i> ${ticket.customer}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="background:${isOverdue ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)'};padding:6px 16px;border-radius:24px;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,0.2);">
                            ${isOverdue ? '⚠️ OVERDUE' : '✅ CLOSE'}
                        </div>
                        <div style="font-size:11px;opacity:0.7;margin-top:5px;">
                            <i class="fas fa-check-circle" style="font-size:10px;"></i> ${ticket.closedAt ? new Date(ticket.closedAt).toLocaleString('id-ID') : '-'}
                        </div>
                    </div>
                </div>
                
                <!-- BODY -->
                <div style="padding:16px 22px 18px;">
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
                        <span style="background:#dbeafe;color:#1e40af;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;">${ticket.jenistiket || 'GGN'}</span>
                        <span style="background:#f1f5f9;color:#475569;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;">${ticket.jenisgangguan || '-'}</span>
                        <span style="background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;">
                            <i class="fas fa-user-cog" style="font-size:10px;"></i> ${(ticket.technicians || []).join(', ') || '-'}
                        </span>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
    <div style="background:#e0f2fe;padding:9px 12px;border-radius:8px;border-left:3px solid #0284c7;">
        <div style="font-size:9px;color:#0369a1;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">ODP / Wilayah</div>
        <div style="font-weight:600;color:#0b1a33;font-size:12px;margin-top:1px;">${ticket.odppelanggan || '-'}</div>
    </div>
    <div style="background:#ede9fe;padding:9px 12px;border-radius:8px;border-left:3px solid #7c3aed;">
        <div style="font-size:9px;color:#6d28d9;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">Kode Pelanggan</div>
        <div style="font-weight:600;color:#0b1a33;font-size:12px;margin-top:1px;">${ticket.kodePelanggan || '-'}</div>
    </div>
    <div style="background:#dcfce7;padding:9px 12px;border-radius:8px;border-left:3px solid #16a34a;">
        <div style="font-size:9px;color:#15803d;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">Durasi SLA</div>
        <div style="font-weight:700;color:#0b1a33;font-size:14px;margin-top:1px;">${formatDur(ticket.duration)}</div>
    </div>
    <div style="background:#fef3c7;padding:9px 12px;border-radius:8px;border-left:3px solid #d97706;">
        <div style="font-size:9px;color:#b45309;text-transform:uppercase;font-weight:700;letter-spacing:0.4px;">TTR</div>
        <div style="font-weight:700;color:${isOverdue ? '#dc2626' : '#16a34a'};font-size:14px;margin-top:1px;">${isOverdue ? '+'+formatDur(diff) : '-'+formatDur(Math.abs(diff))}</div>
    </div>
</div>
                    
                    <div style="background:${isOverdue ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)'};border-radius:12px;padding:14px 18px;border:2px solid ${isOverdue ? '#dc2626' : '#22c55e'};margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">
                                <i class="fas fa-flag-checkered" style="margin-right:5px;"></i> Hasil Resolusi
                            </div>
                            <div style="font-size:26px;font-weight:800;color:#0b1a33;font-family:'Courier New',monospace;margin-top:3px;letter-spacing:-0.5px;line-height:1;">
                                ${isOverdue ? `<span style="color:#dc2626;">+${formatDur(diff)}</span>` : `<span style="color:#16a34a;">-${formatDur(Math.abs(diff))}</span>`}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Status</div>
                            <div style="font-weight:700;font-size:13px;color:${isOverdue ? '#dc2626' : '#16a34a'};margin-top:2px;">
                                ${isOverdue ? '⚠️ OVERDUE' : '✓ TEPAT WAKTU'}
                            </div>
                        </div>
                    </div>
                    
                    ${ticket.keterangan ? `
<div style="background:${isOverdue ? '#fef2f2' : '#fffbeb'};padding:11px 14px;border-radius:10px;border:1px solid ${isOverdue ? '#fca5a5' : '#fde68a'};margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;">
    <i class="fas fa-info-circle" style="color:${isOverdue ? '#dc2626' : '#f59e0b'};font-size:15px;margin-top:1px;"></i>
    <div>
        <div style="font-size:10px;color:${isOverdue ? '#991b1b' : '#92400e'};font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">${isOverdue ? '⚠️ KETERANGAN OVERDUE' : 'Keterangan'}</div>
        <div style="color:${isOverdue ? '#7f1d1d' : '#78350f'};font-size:12px;margin-top:2px;">${ticket.keterangan}</div>
    </div>
</div>` : ''}
                    
                    ${ticket.imbas_gamas ? `
                    <div id="imbasGamasCard" style="background:#fef2f2;padding:11px 14px;border-radius:10px;border:2px solid #dc2626;display:flex;gap:10px;align-items:flex-start;margin-top:8px;">
                        <i class="fas fa-exclamation-triangle" style="color:#dc2626;font-size:15px;margin-top:1px;"></i>
                        <div style="flex:1;">
                            <div style="font-size:10px;color:#991b1b;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">🚨 Tiket GAMAS Terkait</div>
                            <div style="color:#7f1d1d;font-size:13px;margin-top:4px;font-weight:700;font-family:monospace;" id="imbasGamasTiketId">${ticket.imbas_gamas}</div>
                            <div id="imbasGamasDetail" style="color:#475569;font-size:11px;margin-top:3px;">Memuat info GAMAS...</div>
                        </div>
                    </div>` : ''}

                    <div id="ticketHistoryContainer_${ticket.id}" style="margin-top:8px;"></div>

                    ${ticket.jenistiket === 'MIGRASI' ? `
                    <div style="background:#ecfeff;padding:11px 14px;border-radius:10px;border:1px solid #67e8f9;margin-top:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div style="font-size:11px;color:#0e7490;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">
                                <i class="fas fa-users" style="margin-right:5px;"></i> Pelanggan Migrasi
                            </div>
                            <button onclick="event.stopPropagation(); openMigrasiPelangganModal('${ticket.id}')" 
                                style="padding:5px 12px;background:#0891b2;color:white;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;">
                                <i class="fas fa-plus"></i> Tambah
                            </button>
                        </div>
                        <div id="migrasiList_${ticket.id}" style="font-size:12px;color:#64748b;">
                            Memuat data...
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `,
        didOpen: async () => {
            if (ticket.jenistiket === 'MIGRASI') {
                loadMigrasiPelangganList(ticket.id);
            }
            
            loadPemakaianBarangDetail(ticket.id);
            loadTicketHistory(ticket.id);
            
            if (ticket.imbas_gamas) {
                const detailEl = document.getElementById('imbasGamasDetail');
                if (detailEl) {
                    try {
                        const { data: gamasData, error } = await sb
                            .from('tickets')
                            .select('ticketid, jenisgangguan, status, createdAt, customer, odppelanggan')
                            .eq('ticketid', String(ticket.imbas_gamas).trim())
                            .maybeSingle();
                        
                        if (gamasData) {
                            const tgl = gamasData.createdAt ? new Date(gamasData.createdAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}) : '-';
                            const statusLabel = gamasData.status === 'close' ? '✅ CLOSE' : '🔴 OPEN';
                            detailEl.innerHTML = `
                                <div><strong>Jenis:</strong> ${gamasData.jenisgangguan || '-'}</div>
                                <div><strong>Status:</strong> ${statusLabel}</div>
                                <div><strong>Tanggal:</strong> ${tgl}</div>
                            `;
                        } else {
                            detailEl.textContent = 'Data GAMAS tidak ditemukan di sistem.';
                        }
                    } catch(e) {
                        detailEl.textContent = 'Gagal memuat data GAMAS.';
                        console.error('Gagal fetch GAMAS:', e);
                    }
                }
            }
        }
    });
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

    function formatTanggalDDMMYYYY(tgl) {
    if (!tgl || tgl === '-' || tgl === '') {
        return '<span style="color:#dc2626;font-weight:700;">⚠️ Belum diisi</span>';
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(tgl)) return tgl;
    if (/^\d{4}-\d{2}-\d{2}/.test(tgl)) {
        const [y, m, d] = String(tgl).slice(0, 10).split('-');
        return d + '-' + m + '-' + y;
    }
    return tgl;
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
            const jenis = t.jenistiket || '';
            if (jenis !== 'GGN' && jenis !== 'GAMAS') return false;
            const kodeP = t.kodePelanggan;
            if (!kodeP || kodeP === '-') return false;
            const history = tickets.filter(t2 => {
                if (t2.kodePelanggan !== kodeP) return false;
                const jenis2 = t2.jenistiket || '';
                if (jenis2 !== 'GGN' && jenis2 !== 'GAMAS') return false;
                if (t2.id === t.id) return false;
                return true;
            });
            return history.length > 0;
        }).map(t => t.kodePelanggan);
        
        const uniqueGaul = [...new Set(gaulCustomers)];
        if (elGaul) elGaul.textContent = uniqueGaul.length;
    }

        

  // ============================================================
// SETUP REALTIME - UPDATE OTOMATIS
// ============================================================
async function setupRealtime() {
    // Cek versi — kalau beda, clear cache
    const APP_VERSION = '2.2.0';   // naikkan versi biar cache lama otomatis kehapus
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion !== APP_VERSION) {
        localStorage.setItem('app_version', APP_VERSION);
        localStorage.removeItem('tickets_data');
        localStorage.removeItem('techs_data');
        localStorage.removeItem('tickets_last_fetch');
        localStorage.removeItem('techs_last_fetch');
        console.log('🔄 Cache cleared due to version update');
    }

    // Pakai cache kalau ada
    const cachedData = localStorage.getItem('tickets_data');
    const cachedDate = localStorage.getItem('tickets_last_fetch');
    const today = new Date().toDateString();

    if (cachedData && cachedDate === today) {
        tickets = JSON.parse(cachedData);
        console.log('📦 Pakai cache tiket:', tickets.length);
        renderTickets(null, 1);
        updateStats();
        renderPerformance();
        setTimeout(() => renderDashboard(), 300);
        loadTechniciansCache();
    }

    // Ambil data terbaru dari Supabase
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(500);

        if (error) throw error;

        const newData = data;
        const oldData = tickets || [];
        const hasChanged = JSON.stringify(oldData) !== JSON.stringify(newData);

        if (hasChanged) {
            tickets = newData;
            localStorage.setItem('tickets_data', JSON.stringify(tickets));
            localStorage.setItem('tickets_last_fetch', today);
            console.log('✅ Data berubah, refresh UI');
            renderTickets(null, 1);
            updateStats();
            renderPerformance();
            setTimeout(() => renderDashboard(), 300);
        } else {
            console.log('📦 Data sama dengan cache');
        }

    } catch (e) {
        console.error('❌ Gagal ambil tiket:', e);
        notif('Gagal ambil data tiket', 'danger');
    }

    loadTechniciansCache();
}

  // ============================================================
// FORCE SYNC - PASTIKAN DATA SAMA PERSIS DENGAN DATABASE
// ============================================================

// FUNGSI REFRESH DATA YANG BENAR (HAPUS CACHE DULU)
async function refreshData() {
    console.log('🔄 FORCE SYNC...');
    
    if (!window.sb) {
        console.error('❌ Supabase client not ready');
        return;
    }
    
    try {
        // AMBIL DATA TICKETS TERBARU DARI DATABASE
        const { data: ticketsData, error: ticketsError } = await window.sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(500);
            
        if (ticketsError) throw ticketsError;
        
        // AMBIL DATA TECHNICIANS TERBARU DARI DATABASE
        const { data: techsData, error: techsError } = await window.sb
            .from('technicians')
            .select('*')
            .order('name');
            
        if (techsError) throw techsError;
        
        // UPDATE GLOBAL VARIABLES (LANGSUNG TIMPA)
        tickets = ticketsData;

        techs = techsData;
        
        // HAPUS CACHE LAMA
        localStorage.removeItem('tickets_data');
        localStorage.removeItem('techs_data');
        localStorage.removeItem('tickets_last_fetch');
        localStorage.removeItem('techs_last_fetch');
        
        // SIMPAN CACHE BARU
        const today = new Date().toDateString();
        localStorage.setItem('tickets_data', JSON.stringify(tickets));
        localStorage.setItem('techs_data', JSON.stringify(techs));
        localStorage.setItem('tickets_last_fetch', today);
        localStorage.setItem('techs_last_fetch', today);
        
        console.log('✅ Data synced:', tickets.length, 'tickets,', techs.length, 'technicians');
        
        // RENDER ULANG SEMUA
        renderTickets(null, 1);
        renderTechList();
        renderTechDropdown();
        updateStats();
        renderPerformance();
        renderDashboard();
        renderReports();
        renderPsb();

        // TAMBAHKAN INI:
        if (document.getElementById('allrekapSection') && document.getElementById('allrekapSection').style.display === 'block') {
            renderAllRekap();
        }
        
    } catch (e) {
        console.error('❌ Sync error:', e);
        notif('Gagal sync data: ' + e.message, 'danger');
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

                techs = data;
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
    const dateFrom = document.getElementById('rekapDate') ? document.getElementById('rekapDate').value : '';
    const dateTo = document.getElementById('rekapDateTo') ? document.getElementById('rekapDateTo').value : '';
    const jenisFilter = document.getElementById('rekapJenisTiket') ? document.getElementById('rekapJenisTiket').value : 'all';
    const timFilter = document.getElementById('rekapTim') ? document.getElementById('rekapTim').value : 'all';

        if (!tickets || tickets.length === 0) {
            const body = document.getElementById('rekapBody');
            if (body) body.innerHTML = '<tr><td colspan="8"><div class="empty">Data tiket kosong</div></td></tr>';
            document.getElementById('rekapTotalTiket').textContent = '0';
            document.getElementById('rekapTotalTeknisi').textContent = '0';
            document.getElementById('rekapTotalClose').textContent = '0';
            document.getElementById('rekapTotalOpen').textContent = '0';
            return;
        }

               if (!dateFrom && !dateTo) {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('rekapDate');
        const dateInputTo = document.getElementById('rekapDateTo');
        if (dateInput) dateInput.value = today;
        if (dateInputTo) dateInputTo.value = today;
        // LANGSUNG FILTER PAKAI RENTANG HARI INI
        return renderRekap();
    }

    const filtered = tickets.filter(t => {
        if (!t.createdAt) return false;
        const tDate = new Date(t.createdAt);
        const tDateStr = tDate.toISOString().split('T')[0];
        
        // FILTER RENTANG TANGGAL
        if (dateFrom && tDateStr < dateFrom) return false;
        if (dateTo && tDateStr > dateTo) return false;
        
        if (jenisFilter !== 'all') {
            const jenisTiket = t.jenistiket || '';
            if (jenisTiket !== jenisFilter) return false;
        }

        // FILTER TIM
        if (!isTimMatch(t, timFilter)) return false;

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
            body.innerHTML = '<tr><td colspan="8"><div class="empty">Tidak ada tiket pada tanggal ' + date + '</div></td></tr>';
            document.getElementById('rekapPagination').innerHTML = '';
            return;
        }

        // ===== URUTKAN BERDASARKAN TEKNISI, LALU WAKTU CLOSE (TERCEPAT - TERLAMA) =====
        const sortedTickets = [...filtered].sort((a, b) => {
            // Pertama urutkan berdasarkan teknisi
            const techA = a.technicians && a.technicians.length > 0 ? a.technicians[0] : '';
            const techB = b.technicians && b.technicians.length > 0 ? b.technicians[0] : '';
            if (techA !== techB) {
                return techA.localeCompare(techB);
            }
            
            // Jika teknisi sama, urutkan berdasarkan waktu close (tercepat - terlama)
            const getCloseTime = (t) => {
                if (t.status === 'close' && t.closedAt) {
                    try {
                        const closed = t.closedAt.toDate ? t.closedAt.toDate() : new Date(t.closedAt);
                        return closed.getTime();
                    } catch(e) {
                        return 9999999999999;
                    }
                }
                return 9999999999999;
            };
            return getCloseTime(a) - getCloseTime(b);
        });

        // ===== GROUPING UNTUK MENENTUKAN ROWSPAN TEKNISI =====
        let html = '';
        let no = 0;
        let currentTech = '';
        let techRowspan = 0;
        let techTickets = [];
        let techNames = [];

        sortedTickets.forEach((t, index) => {
            const techKey = (t.technicians && t.technicians.length > 0) ? t.technicians.sort().join('|') : '';
            
            if (techKey !== currentTech) {
                // Render grup sebelumnya
                if (techTickets.length > 0) {
                    no++;
                    html += renderTechGroup(no, techNames, techTickets);
                }
                // Mulai grup baru
                currentTech = techKey;
                techNames = t.technicians || [];
                techTickets = [t];
            } else {
                techTickets.push(t);
            }
        });

        // Render grup terakhir
        if (techTickets.length > 0) {
            no++;
            html += renderTechGroup(no, techNames, techTickets);
        }

        body.innerHTML = html;
        document.getElementById('rekapPagination').innerHTML = '';
    }

    // ===== FUNGSI RENDER GROUP TEKNISI =====
    // ===== FUNGSI RENDER GROUP TEKNISI =====
    function renderTechGroup(no, techNames, tickets) {
        const rowspan = tickets.length;
        let html = '';
        
        // Buat string teknisi
        let techDisplay = techNames.length > 0 ? techNames.join('<br>') : '-';
        
        tickets.forEach((t, idx) => {
            const borderBottom = 'border-bottom:1px solid #e2e8f0;';
            
            html += '<tr>';
            
            // NO (pakai rowspan)
            if (idx === 0) {
                html += '<td style="padding:10px 12px;text-align:center;font-weight:700;vertical-align:middle;' + borderBottom + '" rowspan="' + rowspan + '">' + no + '</td>';
            }
            
            // JENIS TIKET (per tiket)
            var jenisTiket = t.jenistiket || 'GGN';
            var bgColor = '#2563eb';
            if (jenisTiket === 'PSB') bgColor = '#10b981';
            else if (jenisTiket === 'GAMAS') bgColor = '#dc2626';
            else if (jenisTiket === 'PROJECT') bgColor = '#8b5cf6';
            else if (jenisTiket === 'LAINNYA') bgColor = '#8a8a00';
            else bgColor = '#2563eb';

            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">';
            html += '<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:' + bgColor + ';color:white;">' + jenisTiket + '</span>';
            html += '</td>';
            
            // TIKET
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">';
            html += '<span style="color:#000000; font-weight:400;">' + (t.ticketid || t.ticketId || '-') + '</span>';
            html += '</td>';
            
            // ID PELANGGAN
            var idPelangganDisplay = (jenisTiket === 'LAINNYA') ? '' : (t.kodePelanggan || '-');
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">';
            html += '<span style="color:#000000; font-weight:400;">' + idPelangganDisplay + '</span>';
            html += '</td>';
            
            // NAMA
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">' + (t.customer || '-') + '</td>';

            // ✅ ODP (KOLOM BARU)
            var odpDisplay = t.odppelanggan || '-';
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">';
            html += '<span style="color:#000000; font-weight:400;">' + odpDisplay + '</span>';
            html += '</td>';

            // ✅ WILAYAH (KOLOM BARU)
            var wilayahDisplay = t.wilayahpelanggan || '-';
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">';
            html += '<span style="color:#000000; font-weight:400;">' + wilayahDisplay + '</span>';
            html += '</td>';
            
            // JENIS GANGGUAN
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">' + (t.jenisgangguan || '-') + '</td>';
            
            // CLOSE TICKET
            html += '<td style="padding:10px 12px;text-align:center;vertical-align:middle;' + borderBottom + '">';
            if (t.status === 'close' && t.closedAt) {
                try {
                    var closeDate = t.closedAt.toDate ? t.closedAt.toDate() : new Date(t.closedAt);
                    if (!isNaN(closeDate.getTime())) {
                        var day = String(closeDate.getDate()).padStart(2, '0');
                        var month = String(closeDate.getMonth() + 1).padStart(2, '0');
                        var year = closeDate.getFullYear();
                        var hours = String(closeDate.getHours()).padStart(2, '0');
                        var minutes = String(closeDate.getMinutes()).padStart(2, '0');
                        html += day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
                    } else {
                        html += t.closedAt || '-';
                    }
                } catch(e) {
                    html += t.closedAt || '-';
                }
            } else {
                html += '-';
            }
            html += '</td>';
            
            // TEKNISI / TIM (pakai rowspan)
            if (idx === 0) {
                html += '<td style="padding:10px 14px;font-weight:700;color:#0b1a33;background:#f8fafc;vertical-align:middle;text-align:center;border-left:1px solid #cbd5e1;' + borderBottom + '" rowspan="' + rowspan + '">' + techDisplay + '</td>';
            }
            
            html += '</tr>';
        });
        
        // Garis pemisah antar grup
        html += '<tr><td colspan="10" style="padding:0;height:0;border:none;border-bottom:2px solid #0b1a33;"></td></tr>';
       
        return html;
    }

    function updateDurationByJenis() {
    const jenis = document.getElementById('jenisTiket').value;
    
    // ✅ BACA DARI SETTINGS
    const slaMap = {
        'PSB': parseInt(getSetting('sla_psb', '120')),
        'GGN': parseInt(getSetting('sla_ggn', '180')),
        'GAMAS': parseInt(getSetting('sla_gamas', '240')),
        'PROJECT': parseInt(getSetting('sla_project', '480')),
        'MIGRASI': parseInt(getSetting('sla_migrasi', '120')),
        'LAINNYA': parseInt(getSetting('sla_lainnya', '60'))
    };
    
    document.getElementById('duration').value = slaMap[jenis] || 60;
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
    document.getElementById('rekapDateTo').value = '';
    document.getElementById('rekapTim').value = 'all';
    document.getElementById('rekapBody').innerHTML = '<tr><td colspan="8"><div class="empty">Pilih tanggal dan klik Tampilkan</div></td></tr>';
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
    const dateInputTo = document.getElementById('rekapDateTo');
    if (dateInput) dateInput.value = today;
    if (dateInputTo) dateInputTo.value = today;
    setTimeout(function() {
        renderRekap();
    }, 100);
}

// ============================================================
// DATA ONU OLT — INTEGRASI BACKEND CLOUDFLARE TUNNEL
// ============================================================
const OLT_BACKEND_URL = 'https://noc-mahawira.tail6b7a38.ts.net';

let onuDataCache = [];
let onuCurrentPage = 1;
const onuItemsPerPage = 20;

// ===== FETCH DARI BACKEND =====
async function fetchOnuList() {
    try {
        const res = await fetch(`${OLT_BACKEND_URL}/api/onu`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        onuDataCache = data || [];
        return onuDataCache;
    } catch (e) {
        console.error('Gagal fetch ONU:', e);
        notif('❌ Gagal konek ke backend OLT: ' + e.message, 'danger');
        return [];
    }
}

// ===== HELPER: STATUS BADGE =====
function getOnuStatusBadge(phase_state) {
    if (!phase_state) return '<span style="background:#94a3b8;color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">-</span>';
    
    const s = String(phase_state).toUpperCase();
    if (s === 'WORKING') return '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">✅ working</span>';
    if (s === 'DYINGGASP') return '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">⚠️ DyingGasp</span>';
    if (s === 'LOS') return '<span style="background:#fee2e2;color:#dc2626;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">🔴 LOS</span>';
    if (s === 'OFFLINE') return '<span style="background:#f1f5f9;color:#475569;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">⚫ OffLine</span>';
    return `<span style="background:#e2e8f0;color:#475569;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">${phase_state}</span>`;
}

// ===== RENDER UTAMA =====
async function renderOnuOlt() {
    const body = document.getElementById('onuOltBody');
    if (!body) return;
    
    // Load mapping dari Supabase (sekali)
    if (Object.keys(onuMappingCache).length === 0) {
        await loadOnuMapping();
    }

    // Kalau cache kosong, fetch dulu
    if (onuDataCache.length === 0) {
        body.innerHTML = '<tr><td colspan="9"><div class="empty">⏳ Mengambil data dari OLT...</div></td></tr>';
        await fetchOnuList();
    }

    // Filter
    const keyword = (document.getElementById('onuSearch')?.value || '').trim().toLowerCase();
    const filterStatus = document.getElementById('onuFilterStatus')?.value || 'all';

    let list = onuDataCache.slice();

    // Filter status
    if (filterStatus !== 'all') {
        list = list.filter(o => String(o.phase_state || '').toUpperCase() === filterStatus.toUpperCase());
    }

    // Filter keyword
    if (keyword) {
        list = list.filter(o => {
            const nama = (o.name || '').toLowerCase();
            const sn = (o.serial_number || '').toLowerCase();
            const path = (o.full_path || '').toLowerCase();
            return nama.includes(keyword) || sn.includes(keyword) || path.includes(keyword);
        });
    }

    // Update statistik
    document.getElementById('onuTotal').textContent = onuDataCache.length;
    document.getElementById('onuWorking').textContent = onuDataCache.filter(o => String(o.phase_state || '').toUpperCase() === 'WORKING').length;
    document.getElementById('onuLos').textContent = onuDataCache.filter(o => ['LOS','OFFLINE'].includes(String(o.phase_state || '').toUpperCase())).length;
    document.getElementById('onuDying').textContent = onuDataCache.filter(o => String(o.phase_state || '').toUpperCase() === 'DYINGGASP').length;

    document.getElementById('onuCount').textContent = list.length + ' ONU';

    if (list.length === 0) {
        body.innerHTML = '<tr><td colspan="9"><div class="empty">Tidak ada ONU sesuai filter</div></td></tr>';
        document.getElementById('onuPagination').innerHTML = '';
        return;
    }

    // Pagination
    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / onuItemsPerPage) || 1;
    if (onuCurrentPage > totalPages) onuCurrentPage = totalPages;
    const start = (onuCurrentPage - 1) * onuItemsPerPage;
    const end = Math.min(start + onuItemsPerPage, totalItems);
    const pageList = list.slice(start, end);

    // Render
    body.innerHTML = pageList.map((o, i) => {
        return `<tr>
            <td style="text-align:center;">${start + i + 1}</td>
            <td style="font-family:monospace;font-weight:600;color:#2563eb;">${o.full_path || '-'}</td>
                        <td>${(() => {
                const savedId = onuMappingCache[o.full_path] || '';
                if (savedId) {
                    return `<div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-weight:600;color:#0b1a33;font-size:12px;">${savedId}</span>
                        <button onclick="event.stopPropagation(); openEditOnuId('${o.full_path}')" 
                            style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;" 
                            title="Edit ID">
                            <i class="fas fa-edit" style="color:#2563eb;"></i>
                        </button>
                    </div>`;
                } else {
                    return `<button onclick="event.stopPropagation(); openEditOnuId('${o.full_path}')" 
                        style="background:#eff6ff;border:1px dashed #93c5fd;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:11px;color:#2563eb;font-weight:600;" 
                        title="Isi ID Pelanggan">
                        <i class="fas fa-plus"></i> Isi ID
                    </button>`;
                }
            })()}</td>
            <td><strong>${o.name || '-'}</strong></td>
            <td style="font-family:monospace;font-size:12px;">${o.serial_number || '-'}</td>
            <td>${getOnuStatusBadge(o.phase_state)}</td>
            <td>${o.onu_distance || '-'}</td>
            <td style="font-size:12px;color:#475569;">${o.online_duration || '-'}</td>
            <td style="text-align:center;">
                <button class="btn btn-primary btn-sm" onclick="openOnuDetail('${o.full_path}')" title="Lihat detail + redaman" style="padding:4px 12px;font-size:11px;">
                    <i class="fas fa-eye"></i> Detail
                </button>
            </td>
        </tr>`;
    }).join('');

    // Pagination buttons
    let pagHtml = '';
    if (totalPages > 1) {
        pagHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        if (onuCurrentPage > 1) pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToOnuPage(${onuCurrentPage - 1})">◀ Prev</button>`;
        for (let i = 1; i <= totalPages; i++) {
            const active = i === onuCurrentPage ? 'btn-primary' : 'btn-outline';
            pagHtml += `<button class="btn ${active} btn-sm" onclick="goToOnuPage(${i})">${i}</button>`;
        }
        if (onuCurrentPage < totalPages) pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToOnuPage(${onuCurrentPage + 1})">Next ▶</button>`;
        pagHtml += '</div>';
        pagHtml += `<span style="font-size:13px;color:#64748b;">Menampilkan ${start+1}-${end} dari ${totalItems}</span>`;
    }
    document.getElementById('onuPagination').innerHTML = pagHtml;
}

function goToOnuPage(page) {
    onuCurrentPage = page;
    renderOnuOlt();
}

function resetOnuFilter() {
    const s = document.getElementById('onuSearch');
    const f = document.getElementById('onuFilterStatus');
    if (s) s.value = '';
    if (f) f.value = 'all';
    onuCurrentPage = 1;
    renderOnuOlt();
}


// ============================================================
// FULL SCAN ONU OLT
// ============================================================
async function fullScanOnu() {
    const conf = await Swal.fire({
        title: '🔍 Full Scan OLT',
        html: 'Proses ini memakan waktu <strong>5-10 menit</strong>.<br>Mengambil nama, SN, distance, uptime semua ONU.<br><br>Lanjutkan?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Full Scan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#7f1d1d'
    });
    if (!conf.isConfirmed) return;

    Swal.fire({
        title: 'Full Scan OLT...',
        html: 'Mohon tunggu 5-10 menit.<br>Jangan tutup halaman ini.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        await fetch(`${OLT_BACKEND_URL}/api/cache/full-scan`, { method: 'POST' });

        // Polling status tiap 5 detik
        let attempts = 0;
        while (attempts < 180) {
            await new Promise(r => setTimeout(r, 5000));
            const info = await fetch(`${OLT_BACKEND_URL}/api/cache/info`).then(r => r.json());
            if (!info.is_full_scanning) {
                Swal.close();
                notif(`✅ Full scan selesai: ${info.total} ONU`, 'success');
                await fetchOnuList();
                renderOnuOlt();
                return;
            }
            attempts++;
        }
        Swal.close();
        notif('⚠️ Full scan masih jalan di background', 'warning');
    } catch(e) {
        Swal.close();
        notif('❌ Full scan error: ' + e.message, 'danger');
    }
}

// ===== REFRESH CACHE DARI OLT =====
async function refreshOnuCache() {
    try {
        const conf = await Swal.fire({
            title: '🔄 Refresh Status',
            text: 'Proses ini ~30 detik. Cuma update status ONU (working/LOS/DyingGasp). Lanjutkan?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Refresh',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#2563eb'
        });
        if (!conf.isConfirmed) return;

        Swal.fire({
            title: 'Memuat...',
            html: 'Sedang scan semua port OLT. Mohon tunggu 2-3 menit.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await fetch(`${OLT_BACKEND_URL}/api/cache/refresh`, { method: 'POST' });
        const data = await res.json();

        // Tunggu sampai selesai
        let attempts = 0;
        while (attempts < 60) {
            await new Promise(r => setTimeout(r, 3000));
            const info = await fetch(`${OLT_BACKEND_URL}/api/cache/info`).then(r => r.json());
            if (!info.is_refreshing) {
                Swal.close();
                notif(`✅ Cache refreshed: ${info.total} ONU`, 'success');
                await fetchOnuList();
                renderOnuOlt();
                return;
            }
            attempts++;
        }
        Swal.close();
        notif('⚠️ Refresh masih berjalan di background', 'warning');
    } catch (e) {
        Swal.close();
        notif('❌ Gagal refresh: ' + e.message, 'danger');
    }
}

async function fullScanOnu() {
    const conf = await Swal.fire({
        title: '🔍 Full Scan OLT',
        html: 'Proses ini memakan waktu <strong>5-10 menit</strong>.<br>Mengambil nama, SN, distance, uptime semua ONU.<br><br>Lanjutkan?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Full Scan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#7f1d1d'
    });
    if (!conf.isConfirmed) return;

    Swal.fire({
        title: 'Full Scan OLT...',
        html: 'Mohon tunggu 5-10 menit.<br>Jangan tutup halaman ini.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        await fetch(`${OLT_BACKEND_URL}/api/cache/full-scan`, { method: 'POST' });

        // Polling status tiap 5 detik
        let attempts = 0;
        while (attempts < 180) {
            await new Promise(r => setTimeout(r, 5000));
            const info = await fetch(`${OLT_BACKEND_URL}/api/cache/info`).then(r => r.json());
            if (!info.is_full_scanning) {
                Swal.close();
                notif(`✅ Full scan selesai: ${info.total} ONU`, 'success');
                await fetchOnuList();
                renderOnuOlt();
                return;
            }
            attempts++;
        }
        Swal.close();
        notif('⚠️ Full scan masih jalan di background', 'warning');
    } catch(e) {
        Swal.close();
        notif('❌ Full scan error: ' + e.message, 'danger');
    }
}

// ===== DETAIL ONU (dengan Rx/Tx live) =====
async function openOnuDetail(fullPath) {
    // Tampilkan loading
    Swal.fire({
        title: '⏳ Mengambil data ONU...',
        html: `Path: <strong>${fullPath}</strong>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Path: 1/13/1:1 → slot=13, port=1, onu=1
        const parts = fullPath.split(':');
const slotPort = parts[0].split('/');
const frame = slotPort[0];   // "1"
const slot = slotPort[1];    // "13"
const port = slotPort[2];    // "1"
const onu_id = parts[1];     // "1"

        const url = `${OLT_BACKEND_URL}/api/onu/${frame}/${slot}/${port}/${onu_id}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // Ambil data dari cache untuk detail
        const cached = onuDataCache.find(o => o.full_path === fullPath);
        const d = data.detail || {};
        const rx = data.rx_power;
        const tx = data.tx_power;

        // Format redaman dengan warna
        const rxColor = rx === null ? '#94a3b8' : (rx < -27 ? '#dc2626' : rx < -25 ? '#f59e0b' : '#16a34a');
        const txColor = tx === null ? '#94a3b8' : (tx < 0 ? '#dc2626' : tx > 5 ? '#f59e0b' : '#16a34a');

        Swal.fire({
            title: '',
            width: 650,
            padding: 0,
            background: '#ffffff',
            confirmButtonText: '✕ Tutup',
            confirmButtonColor: '#2563eb',
            html: `
                <div style="font-family:'Inter',sans-serif;text-align:left;">

                    <!-- HEADER -->
                    <div style="background:linear-gradient(135deg,#0b1a33,#1a365d);padding:22px 28px;border-radius:16px 16px 0 0;color:white;">
                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.7;">Detail ONU</div>
                        <div style="font-size:24px;font-weight:700;font-family:monospace;margin-top:4px;">${fullPath}</div>
                        <div style="font-size:14px;opacity:0.85;margin-top:4px;">${d.name || cached?.name || '-'}</div>
                    </div>

                    <!-- BODY -->
                    <div style="padding:20px 28px 24px;">

                        <!-- STATUS BADGE -->
                        <div style="margin-bottom:16px;">
                            ${getOnuStatusBadge(d.phase_state || cached?.phase_state)}
                        </div>

                        <!-- INFO GRID -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
                            <div style="background:#f8fafc;padding:10px 14px;border-radius:10px;border-left:4px solid #2563eb;">
                                <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Serial Number</div>
                                <div style="font-family:monospace;font-weight:600;color:#0b1a33;font-size:13px;margin-top:2px;">${d.serial_number || cached?.serial_number || '-'}</div>
                            </div>
                            <div style="background:#f8fafc;padding:10px 14px;border-radius:10px;border-left:4px solid #8b5cf6;">
                                <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Distance</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:13px;margin-top:2px;">${d.onu_distance || cached?.onu_distance || '-'}</div>
                            </div>
                            <div style="background:#f8fafc;padding:10px 14px;border-radius:10px;border-left:4px solid #16a34a;grid-column:1/-1;">
                                <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Online Duration</div>
                                <div style="font-weight:600;color:#0b1a33;font-size:13px;margin-top:2px;">${d.online_duration || cached?.online_duration || '-'}</div>
                            </div>
                        </div>

                        <!-- REDAMAN -->
                        <div style="background:#eff6ff;border-radius:12px;padding:16px;border:1px solid #bfdbfe;">
                            <div style="font-size:11px;color:#1e40af;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                                📶 Redaman Optik (Live)
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                                <div style="background:white;padding:12px;border-radius:10px;text-align:center;">
                                    <div style="font-size:11px;color:#64748b;font-weight:600;">Rx Power</div>
                                    <div style="font-size:22px;font-weight:800;color:${rxColor};font-family:monospace;margin-top:4px;">${rx !== null ? rx + ' dBm' : '-'}</div>
                                </div>
                                <div style="background:white;padding:12px;border-radius:10px;text-align:center;">
                                    <div style="font-size:11px;color:#64748b;font-weight:600;">Tx Power</div>
                                    <div style="font-size:22px;font-weight:800;color:${txColor};font-family:monospace;margin-top:4px;">${tx !== null ? tx + ' dBm' : '-'}</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            `
        });
    } catch (e) {
        Swal.close();
        notif('❌ Gagal ambil detail ONU: ' + e.message, 'danger');
    }
}
            
// ============================================================
// EDIT ID PELANGGAN DI DATA ONU OLT
// ============================================================
let onuMappingCache = {}; // { full_path: id }

// Fetch semua mapping dari Supabase
async function loadOnuMapping() {
    try {
        const { data, error } = await sb
            .from('onu_mapping')
            .select('full_path, id');
        if (error) throw error;
        
        onuMappingCache = {};
        (data || []).forEach(row => {
            onuMappingCache[row.full_path] = row.id || '';
        });
        console.log('✅ ONU mapping loaded:', Object.keys(onuMappingCache).length);
    } catch(e) {
        console.error('Gagal load ONU mapping:', e);
    }
}

// Buka modal edit ID
async function openEditOnuId(fullPath) {
    const currentId = onuMappingCache[fullPath] || '';
    
    // Cari nama ONU dari cache
    const onuData = onuDataCache.find(o => o.full_path === fullPath);
    const namaOnu = onuData ? (onuData.name || '-') : '-';
    
    const { value: newId, isConfirmed } = await Swal.fire({
        title: 'Edit ID Pelanggan',
        width: 500,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;margin-bottom:16px;">
                    <div style="font-size:12px;color:#64748b;">Path ONU</div>
                    <div style="font-family:monospace;font-weight:700;color:#0b1a33;font-size:15px;margin-top:2px;">${fullPath}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:8px;">Nama ONU</div>
                    <div style="font-weight:600;color:#0b1a33;font-size:14px;margin-top:2px;">${namaOnu}</div>
                </div>
                <label style="display:block;font-weight:600;color:#1e293b;margin-bottom:6px;">ID Pelanggan</label>
                <input id="swalOnuIdInput" type="text" value="${currentId}" placeholder="Contoh: 1234/RTL/WNJ-001/001" autocomplete="off"
                    style="width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
                <div style="font-size:11px;color:#94a3b8;margin-top:6px;">Kosongkan untuk hapus ID</div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        didOpen: () => {
            const input = document.getElementById('swalOnuIdInput');
            if (input) {
                input.focus();
                input.select();
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        Swal.clickConfirm();
                    }
                });
            }
        },
        preConfirm: () => {
            const input = document.getElementById('swalOnuIdInput');
            return input ? input.value.trim() : '';
        }
    });
    
    if (!isConfirmed) return;
    
    const finalId = newId || '';
    
    try {
        if (finalId === '') {
            // Hapus mapping
            await sb.from('onu_mapping').delete().eq('full_path', fullPath);
            delete onuMappingCache[fullPath];
            notif('✅ ID dihapus', 'success');
        } else {
            // Upsert
            const { error } = await sb
                .from('onu_mapping')
                .upsert({
                    full_path: fullPath,
                    id: finalId,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'full_path' });
            
            if (error) throw error;
            onuMappingCache[fullPath] = finalId;
            notif('✅ ID tersimpan', 'success');
        }
        
        // Re-render tabel
        renderOnuOlt();
    } catch(e) {
        console.error('Gagal simpan ID:', e);
        Swal.fire('Error', 'Gagal simpan: ' + e.message, 'error');
    }
}

// ============================================================
// RIWAYAT LOS PER ONU
// ============================================================
async function showOnuLosHistory(onuPath) {
    try {
        Swal.fire({
            title: '⏳ Memuat riwayat...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const { data, error } = await sb
            .from('onu_los_history')
            .select('*')
            .eq('onu_path', onuPath)
            .order('los_started_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        Swal.close();

        if (!data || data.length === 0) {
            Swal.fire({
                title: '📭 Belum ada riwayat LOS',
                html: `<div style="text-align:center;padding:20px;">
                    <div style="font-size:48px;margin-bottom:10px;">📭</div>
                    <div style="color:#64748b;font-size:14px;">
                        ONU <strong style="font-family:monospace;">${onuPath}</strong><br>
                        belum pernah tercatat LOS
                    </div>
                </div>`,
                confirmButtonText: 'Tutup',
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        function durasiLos(start, end) {
            if (!start) return '-';
            const s = new Date(start);
            const e = end ? new Date(end) : new Date();
            const ms = e.getTime() - s.getTime();
            const mnt = Math.floor(ms / 60000);
            if (mnt < 60) return mnt + ' menit';
            const jam = Math.floor(mnt / 60);
            const sisaMnt = mnt % 60;
            if (jam < 24) return jam + ' jam ' + sisaMnt + ' mnt';
            const hari = Math.floor(jam / 24);
            const sisaJam = jam % 24;
            return hari + ' hari ' + sisaJam + ' jam';
        }

        function warnaRx(rx) {
            if (rx === null || rx === undefined) return '#94a3b8';
            if (rx < -27) return '#dc2626';
            if (rx < -25) return '#f59e0b';
            return '#16a34a';
        }

        let html = `
            <div style="text-align:left;max-height:500px;overflow-y:auto;font-size:13px;">
                <div style="background:#f1f5f9;padding:10px 14px;border-radius:8px;margin-bottom:14px;">
                    <div style="font-size:12px;color:#64748b;">ONU Path</div>
                    <div style="font-family:monospace;font-weight:700;color:#0b1a33;font-size:14px;">${onuPath}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:8px;">Total: <strong>${data.length} kejadian LOS</strong></div>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead>
                        <tr style="background:#0b1a33;color:white;">
                            <th style="padding:8px;text-align:center;width:30px;">No</th>
                            <th style="padding:8px;text-align:left;">Waktu LOS</th>
                            <th style="padding:8px;text-align:center;">Durasi</th>
                            <th style="padding:8px;text-align:center;background:#7f1d1d;">SEBELUM (Rx / Tx)</th>
                            <th style="padding:8px;text-align:center;background:#166534;">SETELAH (Rx / Tx)</th>
                            <th style="padding:8px;text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach((row, i) => {
            const tglMulai = row.los_started_at 
                ? new Date(row.los_started_at).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
                : '-';
            const durasi = durasiLos(row.los_started_at, row.los_ended_at);
            
            const rxBefore = row.rx_before !== null ? row.rx_before : null;
            const txBefore = row.tx_before !== null ? row.tx_before : null;
            const rxAfter = row.rx_after !== null ? row.rx_after : null;
            const txAfter = row.tx_after !== null ? row.tx_after : null;

            const statusBadge = row.status === 'CLOSED'
                ? '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;">✅ SELESAI</span>'
                : '<span style="background:#fee2e2;color:#dc2626;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;">🔴 MASIH LOS</span>';

            html += `<tr style="border-bottom:1px solid #f1f5f9;background:${i%2===0?'#ffffff':'#f8fafc'};">
                <td style="padding:8px;text-align:center;">${i+1}</td>
                <td style="padding:8px;">${tglMulai}</td>
                <td style="padding:8px;text-align:center;font-weight:600;color:${row.status==='OPEN'?'#dc2626':'#475569'};">${durasi}</td>
                <td style="padding:8px;text-align:center;background:#fef2f2;font-family:monospace;">
                    ${rxBefore !== null ? `<span style="color:${warnaRx(rxBefore)};font-weight:700;">${rxBefore}</span>` : '-'}
                    <span style="color:#94a3b8;"> / </span>
                    ${txBefore !== null ? `<span style="color:#16a34a;font-weight:700;">${txBefore}</span>` : '-'}
                </td>
                <td style="padding:8px;text-align:center;background:#f0fdf4;font-family:monospace;">
                    ${rxAfter !== null ? `<span style="color:${warnaRx(rxAfter)};font-weight:700;">${rxAfter}</span>` : '-'}
                    <span style="color:#94a3b8;"> / </span>
                    ${txAfter !== null ? `<span style="color:#16a34a;font-weight:700;">${txAfter}</span>` : '-'}
                </td>
                <td style="padding:8px;text-align:center;">${statusBadge}</td>
            </tr>`;
        });

        html += `
                    </tbody>
                </table>
                <div style="margin-top:12px;font-size:11px;color:#94a3b8;text-align:center;">
                    Sebelum = Rx/Tx terakhir saat masih working | Setelah = Rx/Tx pertama saat recovery
                </div>
            </div>
        `;

        Swal.fire({
            title: '📊 Riwayat LOS — ' + onuPath,
            html: html,
            width: 900,
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#2563eb',
            showCloseButton: true
        });

    } catch (e) {
        Swal.close();
        notif('❌ Gagal load riwayat: ' + e.message, 'danger');
    }
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

        // ✅ INIT DARK MODE DI SINI — GAK NUNGGU DATABASE
    initTheme();
    
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

    
// ============================================================
// REALTIME FORCE - PASTI JALAN DI SEMUA PERANGKAT
// ============================================================
(function() {
    console.log('🔥 FORCE REALTIME...');
    
    function forceRealtime() {
        if (!window.sb) {
            console.log('⏳ Tunggu sb...');
            setTimeout(forceRealtime, 500);
            return;
        }
        
        // HAPUS LISTENER LAMA
        if (window._realtimeListener) {
            try {
                window._realtimeListener.unsubscribe();
            } catch(e) {}
            window._realtimeListener = null;
        }
        
        console.log('🔄 Subscribe realtime...');
        
        // SUBSCRIBE ULANG
        window._realtimeListener = window.sb
            .channel('tickets-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tickets'
            }, function(payload) {
                console.log('🔄 Data berubah!', payload.eventType);
                window._realtimeActive = true;
                refreshData();
               
            })
            .subscribe(function(status) {
                console.log('📡 Realtime status:', status);
                if (status === 'SUBSCRIBED') {
                    window._realtimeActive = true;
                    console.log('✅ REALTIME AKTIF!');
                } else if (status === 'CHANNEL_ERROR') {
                    console.log('⚠️ Realtime error, coba lagi...');
                    setTimeout(forceRealtime, 3000);
                }
            });
    }
    
    // JALANKAN
    forceRealtime();
    
    // CEK SETIAP 10 DETIK, KALAU MATI, START ULANG
    setInterval(function() {
        if (!window._realtimeActive) {
            console.log('⚠️ Realtime mati, start ulang...');
            forceRealtime();
        }
    }, 10000);
})();

// ===== TUTUP MODAL KALO KLIK DI LUAR =====
// TARUH INI DI SINI (DI AKHIR FILE)
document.addEventListener('click', function(e) {
    var modal = document.getElementById('openTicketModal');
    if (modal && e.target === modal) {
        closeOpenTicketModal();
    }
});

// TUTUP DROPDOWN CUSTOMER KALAU KLIK DI LUAR
document.addEventListener('click', function(e) {
    const box = document.getElementById('customerSuggestions');
    const input = document.getElementById('customer');
    if (box && input) {
        if (!box.contains(e.target) && e.target !== input) {
            box.style.display = 'none';
        }
    }
});
             
// ============================================================
// BACKUP & RESTORE DATA
// ============================================================

// Render halaman backup
async function renderBackupSection() {
    // Update stats
    document.getElementById('backupTotalTickets').textContent = tickets.length;
    document.getElementById('backupTotalTeknisi').textContent = techs.length;

    // Ambil jumlah pelanggan
    try {
        const { count: pelangganCount } = await sb
            .from('pelanggan')
            .select('*', { count: 'exact', head: true });
        document.getElementById('backupTotalPelanggan').textContent = pelangganCount || 0;
    } catch(e) {
        document.getElementById('backupTotalPelanggan').textContent = '?';
    }

    // Ambil jumlah ONU mapping
    try {
        const { count: onuCount } = await sb
            .from('onu_mapping')
            .select('*', { count: 'exact', head: true });
        document.getElementById('backupTotalOnu').textContent = onuCount || 0;
    } catch(e) {
        document.getElementById('backupTotalOnu').textContent = '0';
    }

    // Update waktu backup terakhir
    const lastBackup = localStorage.getItem('last_backup_time');
    if (lastBackup) {
        document.getElementById('lastBackupTime').textContent = lastBackup;
    }
}

// ============================================================
// 1. BACKUP FULL JSON — semua tabel
// ============================================================
async function backupFullJSON() {
    const conf = await Swal.fire({
        title: '📦 Full Backup JSON',
        html: `Backup <strong>SEMUA TABEL</strong> ke file JSON.<br><br>
               File ini bisa di-restore kembali ke sistem.<br>
               <small style="color:#64748b;">Proses 5-30 detik tergantung jumlah data.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '💾 Mulai Backup',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8'
    });

    if (!conf.isConfirmed) return;

    Swal.fire({
        title: '⏳ Mengambil data...',
        html: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const backup = {
            meta: {
                version: '1.0',
                app: 'NOC MAHAWIRA',
                timestamp: new Date().toISOString(),
                timestamp_local: new Date().toLocaleString('id-ID')
            },
            tables: {}
        };

        // Ambil semua tabel
        const tables = ['tickets', 'pelanggan', 'technicians', 'users', 'onu_mapping', 'onu_los_history'];

        for (const table of tables) {
            try {
                const { data, error } = await sb.from(table).select('*');
                if (error) {
                    console.warn(`Gagal ambil ${table}:`, error.message);
                    backup.tables[table] = { error: error.message, data: [] };
                } else {
                    backup.tables[table] = { count: data.length, data: data };
                }
            } catch (e) {
                backup.tables[table] = { error: e.message, data: [] };
            }
        }

        // Total ukuran
        const jsonStr = JSON.stringify(backup);
        const sizeMB = (jsonStr.length / 1024 / 1024).toFixed(2);

        // Download
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `backup_noc_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Simpan waktu backup
        const waktu = new Date().toLocaleString('id-ID');
        localStorage.setItem('last_backup_time', waktu);
        document.getElementById('lastBackupTime').textContent = waktu;

        // Info tabel
        let infoHtml = '<div style="text-align:left;font-size:13px;">';
        for (const table of tables) {
            const info = backup.tables[table];
            const count = info.data ? info.data.length : 0;
            infoHtml += `<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">`;
            infoHtml += `<strong>${table}</strong>: ${count} baris`;
            if (info.error) infoHtml += ` <span style="color:#dc2626;">(${info.error})</span>`;
            infoHtml += `</div>`;
        }
        infoHtml += '</div>';

        Swal.fire({
            title: '✅ Backup Berhasil!',
            html: `
                <div style="text-align:left;">
                    <div style="background:#f0fdf4;padding:12px 16px;border-radius:10px;margin-bottom:14px;border-left:4px solid #16a34a;">
                        <div style="font-weight:700;color:#166534;margin-bottom:4px;">File: ${fileName}</div>
                        <div style="font-size:12px;color:#15803d;">Ukuran: <strong>${sizeMB} MB</strong></div>
                    </div>
                    <div style="font-weight:600;color:#0b1a33;margin-bottom:8px;">Rincian:</div>
                    ${infoHtml}
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#16a34a'
        });

    } catch (e) {
        console.error('Backup error:', e);
        Swal.fire('Gagal Backup', e.message, 'error');
    }
}

// ============================================================
// 2. BACKUP EXCEL — multi-sheet
// ============================================================
async function backupExcel() {
    const conf = await Swal.fire({
        title: '📊 Backup Excel',
        html: `Backup ke file Excel multi-sheet.<br><br>
               <small style="color:#64748b;">File ini untuk dibaca manusia, tidak bisa di-restore.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '📥 Mulai Backup',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#94a3b8'
    });

    if (!conf.isConfirmed) return;

    Swal.fire({
        title: '⏳ Membuat Excel...',
        html: 'Mohon tunggu sebentar.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const wb = XLSX.utils.book_new();

        // TIKET
        try {
            const { data: ticketsData } = await sb.from('tickets').select('*').order('createdAt', { ascending: false });
            if (ticketsData && ticketsData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(ticketsData.map(t => ({
                    'Tanggal': t.createdAt ? new Date(t.createdAt).toLocaleString('id-ID') : '-',
                    'Tiket': t.ticketid || '-',
                    'Jenis Tiket': t.jenistiket || '-',
                    'Customer': t.customer || '-',
                    'Kode Pelanggan': t.kodePelanggan || '-',
                    'ODP': t.odppelanggan || '-',
                    'Jenis Gangguan': t.jenisgangguan || '-',
                    'Teknisi': (t.technicians || []).join(', '),
                    'Durasi': t.duration || 0,
                    'TTR': t.ttr || 0,
                    'Status': t.status || '-',
                    'Keterangan': t.keterangan || '-',
                    'Jenis Perbaikan': t.jenisperbaikan || '-',
                    'Imbas GAMAS': t.imbas_gamas || '-',
                    'Created At': t.createdAt || '-',
                    'Closed At': t.closedAt || '-'
                })));
                XLSX.utils.book_append_sheet(wb, ws, 'Tiket');
            }
        } catch(e) { console.warn('Tiket gagal:', e); }

        // PELANGGAN
        try {
            const { data: pelData } = await sb.from('pelanggan').select('*').order('nama');
            if (pelData && pelData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(pelData.map(p => ({
                    'ID Pelanggan': p.id_pelanggan || '-',
                    'Nama': p.nama || '-',
                    'No HP': p.no_hp || '-',
                    'Alamat': p.alamat || '-',
                    'ODP': p.odp || '-',
                    'Taging Lokasi': p.taging_lokasi || '-',
                    'Taging ODP': p.taging_odp || '-',
                    'Tanggal Pasang': p.tanggal_pasang || '-',
                    'Sumber': p.sumber || '-',
                    'Ticket ID': p.ticket_id || '-',
                    'Foto Depan': p.foto_depan || '-',
                    'Foto KTP': p.foto_ktp || '-'
                })));
                XLSX.utils.book_append_sheet(wb, ws, 'Pelanggan');
            }
        } catch(e) { console.warn('Pelanggan gagal:', e); }

        // TEKNISI
        try {
            const { data: techData } = await sb.from('technicians').select('*').order('name');
            if (techData && techData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(techData.map(t => ({
                    'Nama': t.name || '-',
                    'No HP': t.phone || '-',
                    'Posisi': t.posisi || '-'
                })));
                XLSX.utils.book_append_sheet(wb, ws, 'Teknisi');
            }
        } catch(e) { console.warn('Teknisi gagal:', e); }

        // ONU MAPPING
        try {
            const { data: onuData } = await sb.from('onu_mapping').select('*');
            if (onuData && onuData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(onuData.map(o => ({
                    'Path ONU': o.full_path || '-',
                    'ID Pelanggan': o.id || '-',
                    'Updated At': o.updated_at || '-'
                })));
                XLSX.utils.book_append_sheet(wb, ws, 'ONU Mapping');
            }
        } catch(e) { console.warn('ONU gagal:', e); }

        // ONU LOS HISTORY
        try {
            const { data: losData } = await sb.from('onu_los_history').select('*').order('los_started_at', { ascending: false }).limit(5000);
            if (losData && losData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(losData.map(o => ({
                    'Path ONU': o.onu_path || '-',
                    'Mulai LOS': o.los_started_at || '-',
                    'Selesai LOS': o.los_ended_at || '-',
                    'Durasi': o.duration_seconds || '-',
                    'Rx Before': o.rx_before || '-',
                    'Tx Before': o.tx_before || '-',
                    'Rx After': o.rx_after || '-',
                    'Tx After': o.tx_after || '-',
                    'Status': o.status || '-'
                })));
                XLSX.utils.book_append_sheet(wb, ws, 'LOS History');
            }
        } catch(e) { console.warn('LOS gagal:', e); }

        if (wb.SheetNames.length === 0) {
            throw new Error('Tidak ada data untuk di-export');
        }

        // Download
        const fileName = `backup_noc_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        const waktu = new Date().toLocaleString('id-ID');
        localStorage.setItem('last_backup_time', waktu);
        document.getElementById('lastBackupTime').textContent = waktu;

        Swal.fire({
            title: '✅ Backup Excel Berhasil!',
            html: `
                <div style="text-align:left;">
                    <div style="font-weight:700;color:#166534;margin-bottom:6px;">File: ${fileName}</div>
                    <div style="font-size:13px;color:#475569;">Sheet: <strong>${wb.SheetNames.join(', ')}</strong></div>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#16a34a'
        });

    } catch (e) {
        console.error('Excel error:', e);
        Swal.fire('Gagal Backup', e.message, 'error');
    }
}

// ============================================================
// 3. RESTORE FROM JSON
// ============================================================
async function restoreFromJSON(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    // Reset input biar bisa upload file yang sama lagi
    input.value = '';

    try {
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.meta || !backup.tables) {
            throw new Error('Format file tidak valid');
        }

        // Konfirmasi
        const info = backup.meta;
        let tablesInfo = '';
        const tableNames = Object.keys(backup.tables);
        tableNames.forEach(t => {
            const count = backup.tables[t].data ? backup.tables[t].data.length : 0;
            tablesInfo += `<div style="padding:4px 0;font-size:12px;"><strong>${t}</strong>: ${count} baris</div>`;
        });

        const conf = await Swal.fire({
            title: '⚠️ Restore dari Backup?',
            width: 550,
            html: `
                <div style="text-align:left;">
                    <div style="background:#fef3c7;padding:12px 16px;border-radius:10px;margin-bottom:14px;border-left:4px solid #f59e0b;">
                        <div style="font-weight:700;color:#92400e;margin-bottom:6px;">⚠️ PERINGATAN!</div>
                        <div style="font-size:12px;color:#78350f;line-height:1.6;">
                            Restore akan <strong style="color:#dc2626;">MENIMPA / MENGGABUNGKAN</strong> data yang ada di database.<br>
                            Pastikan Anda sudah backup data saat ini!
                        </div>
                    </div>

                    <div style="background:#f8fafc;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:12px;">
                        <div><strong>Backup dari:</strong> ${info.timestamp_local || info.timestamp || '-'}</div>
                        <div><strong>Versi:</strong> ${info.version || '-'}</div>
                    </div>

                    <div style="font-weight:700;color:#0b1a33;margin-bottom:6px;font-size:13px;">Data yang akan di-restore:</div>
                    <div style="background:#f8fafc;padding:10px 14px;border-radius:10px;max-height:150px;overflow-y:auto;">
                        ${tablesInfo}
                    </div>

                    <div style="margin-top:14px;">
                        <label style="display:block;font-weight:600;color:#0b1a33;font-size:13px;margin-bottom:6px;">
                            Ketik <strong style="color:#dc2626;font-family:monospace;">RESTORE</strong> untuk konfirmasi:
                        </label>
                        <input type="text" id="restoreConfirmText" placeholder="Ketik RESTORE"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '♻️ Restore',
            cancelButtonText: '✕ Batal',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const val = document.getElementById('restoreConfirmText').value.trim();
                if (val !== 'RESTORE') {
                    Swal.showValidationMessage('⚠️ Ketik RESTORE (huruf kapital) untuk konfirmasi');
                    return false;
                }
                return true;
            }
        });

        if (!conf.isConfirmed) return;

        // Proses restore
        Swal.fire({
            title: '⏳ Restore data...',
            html: 'Jangan tutup halaman ini.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        let totalRestored = 0;
        const results = [];

        for (const table of tableNames) {
            const info = backup.tables[table];
            if (!info.data || !Array.isArray(info.data) || info.data.length === 0) {
                results.push({ table, status: 'SKIP', count: 0 });
                continue;
            }

            try {
                // Upsert: insert atau update berdasarkan id
                const { error } = await sb.from(table).upsert(info.data, { onConflict: 'id' });
                if (error) {
                    results.push({ table, status: 'ERROR', message: error.message, count: 0 });
                } else {
                    results.push({ table, status: 'OK', count: info.data.length });
                    totalRestored += info.data.length;
                }
            } catch (e) {
                results.push({ table, status: 'ERROR', message: e.message, count: 0 });
            }
        }

        // Tampilkan hasil
        let resultHtml = '<div style="text-align:left;font-size:13px;">';
        results.forEach(r => {
            const color = r.status === 'OK' ? '#16a34a' : r.status === 'SKIP' ? '#94a3b8' : '#dc2626';
            const icon = r.status === 'OK' ? '✅' : r.status === 'SKIP' ? '⏭️' : '❌';
            resultHtml += `<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">`;
            resultHtml += `${icon} <strong>${r.table}</strong>: `;
            resultHtml += `<span style="color:${color};font-weight:600;">${r.status}</span>`;
            if (r.count) resultHtml += ` (${r.count} baris)`;
            if (r.message) resultHtml += ` <span style="color:#dc2626;font-size:11px;">${r.message}</span>`;
            resultHtml += `</div>`;
        });
        resultHtml += '</div>';

        Swal.fire({
            title: '✅ Restore Selesai!',
            html: `
                <div style="text-align:left;">
                    <div style="background:#f0fdf4;padding:12px 16px;border-radius:10px;margin-bottom:14px;border-left:4px solid #16a34a;">
                        <div style="font-weight:700;color:#166534;">Total ${totalRestored} baris di-restore</div>
                    </div>
                    ${resultHtml}
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Tutup & Refresh',
            confirmButtonColor: '#16a34a'
        }).then(() => {
            // Refresh semua data
            refreshData();
            renderBackupSection();
        });

    } catch (e) {
        console.error('Restore error:', e);
        Swal.fire('Gagal Restore', e.message, 'error');
    }
}

// ============================================================
// SETTINGS — PENGATURAN APLIKASI
// ============================================================

// Cache settings global
let appSettings = {};

// ============================================================
// LOAD SETTINGS DARI DATABASE
// ============================================================
async function loadAppSettings() {
    try {
        const { data, error } = await sb
            .from('app_settings')
            .select('setting_key, setting_value');

        if (error) throw error;

        appSettings = {};
        (data || []).forEach(row => {
            appSettings[row.setting_key] = row.setting_value;
        });

        console.log('✅ Settings loaded:', Object.keys(appSettings).length, 'keys');
        return appSettings;
    } catch(e) {
        console.error('Gagal load settings:', e);
        return {};
    }
}

// ============================================================
// GET SETTING VALUE
// ============================================================
function getSetting(key, defaultValue = '') {
    return appSettings[key] !== undefined && appSettings[key] !== null
        ? appSettings[key]
        : defaultValue;
}

// ============================================================
// RENDER HALAMAN SETTINGS
// ============================================================
async function renderSettingsSection() {
    // Load settings kalau belum
    if (Object.keys(appSettings).length === 0) {
        await loadAppSettings();
    }

    // ===== ISI FIELD UMUM =====
    document.getElementById('setCompanyName').value = getSetting('company_name', 'NOC MAHAWIRA GRUP');
    document.getElementById('setCompanyLogo').value = getSetting('company_logo', '');
    document.getElementById('setCompanyAddress').value = getSetting('company_address', '');
    document.getElementById('setCompanyPhone').value = getSetting('company_phone', '');
    document.getElementById('setCompanyEmail').value = getSetting('company_email', '');

    // ===== ISI FIELD SLA =====
    document.getElementById('setSlaPsb').value = getSetting('sla_psb', '120');
    document.getElementById('setSlaGgn').value = getSetting('sla_ggn', '180');
    document.getElementById('setSlaGamas').value = getSetting('sla_gamas', '240');
    document.getElementById('setSlaProject').value = getSetting('sla_project', '480');
    document.getElementById('setSlaMigrasi').value = getSetting('sla_migrasi', '120');
    document.getElementById('setSlaLainnya').value = getSetting('sla_lainnya', '60');

    // ===== ISI FIELD TEMPLATE =====
    document.getElementById('setTemplatePsb').value = getSetting('template_psb', '');
    document.getElementById('setTemplateGgn').value = getSetting('template_ggn', '');
    document.getElementById('setTemplateGamas').value = getSetting('template_gamas', '');

    // ===== ISI FIELD NOTIF =====
    document.getElementById('setAutoSendTelegram').checked = getSetting('auto_send_telegram', 'false') === 'true';
    document.getElementById('setTelegramBotToken').value = getSetting('telegram_bot_token', '');
    document.getElementById('setTelegramChatId').value = getSetting('telegram_chat_id', '');
}

// ============================================================
// SWITCH TAB DI HALAMAN SETTINGS
// ============================================================
function switchSettingsTab(tab) {
    // Update tab aktif
    document.querySelectorAll('.settings-tab').forEach(el => {
        el.classList.remove('active');
    });
    const targetTab = document.querySelector(`.settings-tab[data-settings-tab="${tab}"]`);
    if (targetTab) targetTab.classList.add('active');

    // Sembunyikan semua content
    document.querySelectorAll('.settings-content').forEach(el => {
        el.style.display = 'none';
    });

    // Tampilkan yang dipilih
    const map = {
        'umum': 'settingsTabUmum',
        'sla': 'settingsTabSla',
        'template': 'settingsTabTemplate',
        'notif': 'settingsTabNotif'
    };
    const targetContent = document.getElementById(map[tab]);
    if (targetContent) targetContent.style.display = 'block';
}

// ============================================================
// SAVE SETTINGS
// ============================================================
async function saveSettings(tab) {
    let payload = {};

    if (tab === 'umum') {
        payload = {
            company_name: document.getElementById('setCompanyName').value.trim(),
            company_logo: document.getElementById('setCompanyLogo').value.trim(),
            company_address: document.getElementById('setCompanyAddress').value.trim(),
            company_phone: document.getElementById('setCompanyPhone').value.trim(),
            company_email: document.getElementById('setCompanyEmail').value.trim()
        };
    } else if (tab === 'sla') {
        payload = {
            sla_psb: document.getElementById('setSlaPsb').value,
            sla_ggn: document.getElementById('setSlaGgn').value,
            sla_gamas: document.getElementById('setSlaGamas').value,
            sla_project: document.getElementById('setSlaProject').value,
            sla_migrasi: document.getElementById('setSlaMigrasi').value,
            sla_lainnya: document.getElementById('setSlaLainnya').value
        };
    } else if (tab === 'template') {
        payload = {
            template_psb: document.getElementById('setTemplatePsb').value,
            template_ggn: document.getElementById('setTemplateGgn').value,
            template_gamas: document.getElementById('setTemplateGamas').value
        };
    } else if (tab === 'notif') {
        payload = {
            auto_send_telegram: document.getElementById('setAutoSendTelegram').checked ? 'true' : 'false',
            telegram_bot_token: document.getElementById('setTelegramBotToken').value.trim(),
            telegram_chat_id: document.getElementById('setTelegramChatId').value.trim()
        };
    }

    try {
        // Upsert setiap key
        const updates = Object.entries(payload).map(([key, value]) => ({
            setting_key: key,
            setting_value: String(value),
            updated_at: new Date().toISOString()
        }));

        const { error } = await sb
            .from('app_settings')
            .upsert(updates, { onConflict: 'setting_key' });

        if (error) throw error;

        // Update cache lokal
        Object.entries(payload).forEach(([key, value]) => {
            appSettings[key] = String(value);
        });

        // Update UI (nama perusahaan di sidebar, dll)
        applySettingsToUI();

        // ✅ LOG AKTIVITAS
        await logActivity('UPDATE', {
            table: 'app_settings',
            recordId: tab,
            description: `Update pengaturan: ${tab}`,
            newValue: payload
        });

        notif('✅ Pengaturan berhasil disimpan!', 'success');

    } catch(e) {
        console.error('Gagal save settings:', e);
        Swal.fire('Gagal Simpan', e.message, 'error');
    }
}

// ============================================================
// EXPORT PELANGGAN (ikut filter aktif)
// ============================================================
async function exportPelanggan() {
    // Ambil nilai filter yang aktif
    const sumberFilter = document.getElementById('pelFilterSumber')?.value || 'all';
    const dateFrom = document.getElementById('pelFilterDate')?.value || '';
    const dateTo = document.getElementById('pelFilterDateTo')?.value || '';
    const searchQuery = (document.getElementById('pelFilterSearch')?.value || '').trim().toLowerCase();

    // Konfirmasi filter yang akan di-export
    const filterInfo = [];
    if (sumberFilter !== 'all') filterInfo.push(`Sumber: ${sumberFilter}`);
    if (dateFrom) filterInfo.push(`Dari: ${dateFrom}`);
    if (dateTo) filterInfo.push(`Sampai: ${dateTo}`);
    if (searchQuery) filterInfo.push(`Cari: "${searchQuery}"`);

    const confirm = await Swal.fire({
        title: '📤 Export Pelanggan',
        width: 500,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="background:#eff6ff;padding:14px 18px;border-radius:10px;border-left:4px solid #2563eb;margin-bottom:16px;">
                    <div style="font-weight:700;color:#1e40af;margin-bottom:6px;">Filter Aktif:</div>
                    <div style="font-size:13px;color:#1e40af;line-height:1.7;">
                        ${filterInfo.length > 0 ? filterInfo.join('<br>') : '<em>Tidak ada filter — export SEMUA data</em>'}
                    </div>
                </div>
                <div style="font-size:13px;color:#475569;">
                    File Excel akan berisi semua pelanggan yang <strong>sesuai filter di atas</strong>.
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '📥 Download Excel',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#94a3b8'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
        title: '⏳ Mengambil data...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Fetch data dari Supabase dengan filter
        let query = sb.from('pelanggan').select('*').order('nama');

        // Apply filter sumber
        if (sumberFilter !== 'all') {
            query = query.eq('sumber', sumberFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        let list = data || [];

        // Filter tanggal
        if (dateFrom || dateTo) {
            list = list.filter(p => {
                const tgl = p.tanggal_pasang || '';
                if (!tgl || tgl === '-') return true;
                let tglStr = String(tgl).slice(0, 10);
                if (/^\d{2}-\d{2}-\d{4}$/.test(tglStr)) {
                    const [d, m, y] = tglStr.split('-');
                    tglStr = y + '-' + m + '-' + d;
                }
                if (dateFrom && tglStr < dateFrom) return false;
                if (dateTo && tglStr > dateTo) return false;
                return true;
            });
        }

        // Filter search
        if (searchQuery) {
            list = list.filter(p => {
                const fields = [
                    p.ticket_id, p.id_pelanggan, p.nama, p.odp,
                    p.no_hp, p.alamat, p.taging_lokasi, p.taging_odp
                ].map(f => (f || '').toString().toLowerCase());
                return fields.some(f => f.includes(searchQuery));
            });
        }

        if (list.length === 0) {
            Swal.fire('Info', 'Tidak ada data pelanggan sesuai filter.', 'info');
            return;
        }

        // Susun data untuk Excel
        const excelData = list.map((p, i) => ({
            'No': i + 1,
            'Tiket': p.ticket_id || '-',
            'Tanggal Pasang': p.tanggal_pasang || '-',
            'Sumber': p.sumber || '-',
            'ID Pelanggan': p.id_pelanggan || '-',
            'Nama': p.nama || '-',
            'No HP': p.no_hp || '-',
            'Alamat': p.alamat || '-',
            'Tag Lokasi': p.taging_lokasi || '-',
            'Tag ODP': p.taging_odp || '-',
            'ODP': p.odp || '-',
            'Foto Rumah': p.foto_depan || '-',
            'Foto KTP': p.foto_ktp || '-'
        }));

        // Buat worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set lebar kolom
        ws['!cols'] = [
            { wch: 5 },   // No
            { wch: 25 },  // Tiket
            { wch: 14 },  // Tanggal
            { wch: 10 },  // Sumber
            { wch: 20 },  // ID Pelanggan
            { wch: 25 },  // Nama
            { wch: 15 },  // No HP
            { wch: 30 },  // Alamat
            { wch: 20 },  // Tag Lokasi
            { wch: 20 },  // Tag ODP
            { wch: 18 },  // ODP
            { wch: 30 },  // Foto Rumah
            { wch: 30 }   // Foto KTP
        ];

        // Buat workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pelanggan');

        // Nama file dengan info filter
        let fileName = 'Pelanggan';
        if (sumberFilter !== 'all') fileName += `_${sumberFilter}`;
        if (dateFrom) fileName += `_dari_${dateFrom}`;
        if (dateTo) fileName += `_sd_${dateTo}`;
        fileName += `_${new Date().toISOString().slice(0, 10)}.xlsx`;

        // Download
        XLSX.writeFile(wb, fileName);

        // Log aktivitas
        await logActivity('EXPORT', {
            table: 'pelanggan',
            description: `Export ${list.length} pelanggan${filterInfo.length > 0 ? ' (filtered)' : ''}`,
            newValue: { total: list.length, filters: filterInfo }
        });

        Swal.fire({
            title: '✅ Export Berhasil!',
            html: `
                <div style="text-align:left;font-size:14px;">
                    <div style="background:#f0fdf4;padding:12px 16px;border-radius:10px;border-left:4px solid #16a34a;margin-bottom:12px;">
                        <div style="font-weight:700;color:#166534;">File: ${fileName}</div>
                        <div style="font-size:12px;color:#15803d;margin-top:4px;">Total: <strong>${list.length} pelanggan</strong></div>
                    </div>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#16a34a'
        });

    } catch (e) {
        console.error('Export error:', e);
        Swal.fire('Gagal Export', e.message, 'error');
    }
}

// ============================================================
// APPLY SETTINGS KE UI
// ============================================================
function applySettingsToUI() {
    // Update judul halaman login
    const companyName = getSetting('company_name', 'NOC MAHAWIRA');
    const logoUrl = getSetting('company_logo', '');

    // Update brand sidebar
    const brand = document.querySelector('.sidebar .brand');
    if (brand) {
        if (logoUrl) {
            brand.innerHTML = `<img src="${logoUrl}" style="width:28px;height:28px;border-radius:6px;"> ${companyName}`;
        } else {
            brand.innerHTML = `<img src="https://img.icons8.com/color/48/headset.png" style="width:28px;height:28px;border-radius:6px;"> ${companyName}`;
        }
    }

    // Update judul tab browser
    document.title = companyName;

    // Update login page title
    const loginTitle = document.querySelector('.login-container .logo h1');
    if (loginTitle) loginTitle.textContent = companyName;
}

// ============================================================
// RESET TEMPLATE KE DEFAULT
// ============================================================
function resetTemplateToDefault() {
    Swal.fire({
        title: 'Reset Template?',
        text: 'Template akan dikembalikan ke default. Perubahan Anda akan hilang.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Reset',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626'
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('setTemplatePsb').value = `🟢 TIKET PSB
━━━━━━━━━━━━━━━━━━━━
📋 Tiket       : {{tiket}}
🆔 ID          : {{id}}
👤 Nama        : {{nama}}
📱 No Hp       : {{hp}}
📍 ODP         : {{odp}}
🏠 Tag Plg     : {{tag_plg}}
🗺️ Tag Odp    : {{tag_odp}}
━━━━━━━━━━━━━━━━━━━━`;

            document.getElementById('setTemplateGgn').value = `🔴 TIKET GGN
━━━━━━━━━━━━━━━━━━━━
📋 Tiket       : {{tiket}}
🆔 ID          : {{id}}
👤 Nama        : {{nama}}
📱 No Hp       : {{hp}}
📍 ODP         : {{odp}}
🏠 Tag Plg     : {{tag_plg}}
🗺️ Tag Odp    : {{tag_odp}}
⚠️ Jenis GGN   : {{gangguan}}
🔧 Perbaikan   : {{perbaikan}}
⏰ Max Close   : {{max_close}}
━━━━━━━━━━━━━━━━━━━━`;

            document.getElementById('setTemplateGamas').value = `🚨 TIKET GAMAS
━━━━━━━━━━━━━━━━━━━━
📋 Tiket          : {{tiket}}
⚠️ Jenis GAMAS    : {{gangguan}}
📝 Keterangan     : {{keterangan}}
📍 ODP Terimbas   :
{{odp_terimbas}}
━━━━━━━━━━━━━━━━━━━━`;

            notif('Template direset ke default', 'info');
        }
    });
}

// ============================================================
// TEST TELEGRAM BOT
// ============================================================
async function testTelegramBot() {
    const token = document.getElementById('setTelegramBotToken').value.trim();
    const chatId = document.getElementById('setTelegramChatId').value.trim();

    if (!token || !chatId) {
        Swal.fire('Info', 'Isi Bot Token & Chat ID terlebih dahulu', 'info');
        return;
    }

    Swal.fire({
        title: '⏳ Mengirim test...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const companyName = getSetting('company_name', 'NOC MAHAWIRA');
        const message = `✅ *Test Notifikasi*\n\nBot ${companyName} berhasil terhubung!\n\n_Waktu: ${new Date().toLocaleString('id-ID')}_`;

        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();

        if (result.ok) {
            Swal.fire({
                title: '✅ Berhasil!',
                html: 'Pesan test terkirim ke Telegram.<br>Cek grup Anda.',
                icon: 'success',
                confirmButtonColor: '#16a34a'
            });
        } else {
            throw new Error(result.description || 'Gagal kirim');
        }
    } catch(e) {
        Swal.fire('❌ Gagal', 'Error: ' + e.message, 'error');
    }
}

// ============================================================
// KIRIM NOTIFIKASI KE TELEGRAM (untuk dipanggil saat buat tiket)
// ============================================================
async function sendTelegramNotification(ticketData, jenisTiket) {
    // Cek apakah auto-send aktif
    if (getSetting('auto_send_telegram', 'false') !== 'true') return;

    const token = getSetting('telegram_bot_token', '');
    const chatId = getSetting('telegram_chat_id', '');
    if (!token || !chatId) return;

    try {
        // Ambil template sesuai jenis tiket
        const templateKey = jenisTiket === 'PSB' ? 'template_psb'
                          : jenisTiket === 'GAMAS' ? 'template_gamas'
                          : 'template_ggn';
        let template = getSetting(templateKey, '');
        if (!template) return;

        // Hitung max close
        let maxClose = '-';
        if (ticketData.createdAt && ticketData.duration) {
            const created = new Date(ticketData.createdAt);
            const maxDate = new Date(created.getTime() + ticketData.duration * 60000);
            maxClose = maxDate.toLocaleString('id-ID', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }

        // Replace variabel
        const replacements = {
            '{{tiket}}': ticketData.ticketid || '-',
            '{{id}}': ticketData.kodePelanggan || '-',
            '{{nama}}': ticketData.customer || '-',
            '{{hp}}': ticketData.no_tlp || '-',
            '{{odp}}': ticketData.odppelanggan || '-',
            '{{tag_plg}}': ticketData.taging_lokasi || '-',
            '{{tag_odp}}': ticketData.taging_odp || '-',
            '{{gangguan}}': ticketData.jenisgangguan || '-',
            '{{perbaikan}}': ticketData.jenisperbaikan || '-',
            '{{max_close}}': maxClose,
            '{{keterangan}}': ticketData.keterangan || '-',
            '{{odp_terimbas}}': ticketData.odp_terimbas || '-'
        };

        let message = template;
        Object.entries(replacements).forEach(([key, val]) => {
            message = message.split(key).join(val);
        });

        // Kirim ke Telegram
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        });

        console.log('✅ Telegram notif terkirim');

    } catch(e) {
        console.error('Gagal kirim Telegram:', e);
    }
}

// ============================================================
// INVENTORY — MASTER & TRANSAKSI STOK
// ============================================================

let invItems = [];
let invCurrentPage = 1;
const invItemsPerPage = 15;

// ============================================================
// RENDER HALAMAN INVENTARIS
// ============================================================
async function renderInventorySection() {
    await loadInventoryItems();
    await renderInventoryStats();
    await fillInventorySelects();
    await renderInventoryItems();
    await renderRecentTransactions();
}

// ============================================================
// LOAD SEMUA BARANG
// ============================================================
async function loadInventoryItems() {
    try {
        const { data, error } = await sb
            .from('inventory_items')
            .select('*')
            .order('nama_barang');

        if (error) throw error;
        invItems = data || [];

        // Isi dropdown kategori
        const kategoriSet = new Set(invItems.map(i => i.kategori).filter(k => k));
        const kategoriSelect = document.getElementById('invFilterKategori');
        if (kategoriSelect) {
            const currentVal = kategoriSelect.value;
            kategoriSelect.innerHTML = '<option value="all">Semua Kategori</option>';
            Array.from(kategoriSet).sort().forEach(k => {
                kategoriSelect.innerHTML += `<option value="${k}">${k}</option>`;
            });
            kategoriSelect.value = currentVal || 'all';
        }

        return invItems;
    } catch(e) {
        console.error('Error load inventory:', e);
        notif('Gagal load data inventaris: ' + e.message, 'danger');
        return [];
    }
}

// ============================================================
// STATISTIK INVENTARIS
// ============================================================
async function renderInventoryStats() {
    const totalBarang = invItems.length;
    const totalStok = invItems.reduce((sum, i) => sum + (parseInt(i.stok_saat_ini) || 0), 0);
    const stokKritis = invItems.filter(i => (parseInt(i.stok_saat_ini) || 0) <= (parseInt(i.stok_minimum) || 0)).length;
    const nilaiTotal = invItems.reduce((sum, i) => sum + ((parseInt(i.stok_saat_ini) || 0) * (parseFloat(i.harga_satuan) || 0)), 0);

    document.getElementById('invTotalBarang').textContent = totalBarang;
    document.getElementById('invTotalStok').textContent = totalStok;
    document.getElementById('invStokKritis').textContent = stokKritis;
    document.getElementById('invNilaiTotal').textContent = 'Rp ' + nilaiTotal.toLocaleString('id-ID');
}

// ============================================================
// ISI DROPDOWN DI FORM MASUK / KELUAR / RIWAYAT
// ============================================================
async function fillInventorySelects() {
    const optionsHtml = '<option value="">-- Pilih Barang --</option>' +
        invItems.map(i => `<option value="${i.id}">${i.kode_barang} — ${i.nama_barang} (Stok: ${i.stok_saat_ini})</option>`).join('');

    const masukBarang = document.getElementById('invMasukBarang');
    if (masukBarang) masukBarang.innerHTML = optionsHtml;

    const keluarBarang = document.getElementById('invKeluarBarang');
    if (keluarBarang) keluarBarang.innerHTML = optionsHtml;

    const riwayatBarang = document.getElementById('invRiwayatBarang');
    if (riwayatBarang) {
        riwayatBarang.innerHTML = '<option value="all">Semua Barang</option>' +
            invItems.map(i => `<option value="${i.id}">${i.kode_barang} — ${i.nama_barang}</option>`).join('');
    }

    // Isi dropdown teknisi
    const keluarTeknisi = document.getElementById('invKeluarTeknisi');
    if (keluarTeknisi) {
        keluarTeknisi.innerHTML = '<option value="">-- Pilih Teknisi --</option>' +
            techs.map(t => `<option value="${t.name}">${t.name} (${t.posisi || 'PSB/GGN'})</option>`).join('');
    }
}

// ============================================================
// RENDER TABEL MASTER BARANG (v2)
// ============================================================
async function renderInventoryItems() {
    const body = document.getElementById('invItemBody');
    if (!body) return;

    const keyword = (document.getElementById('invSearch')?.value || '').toLowerCase().trim();
    const kategoriFilter = document.getElementById('invFilterKategori')?.value || 'all';
    const statusFilter = document.getElementById('invFilterStatus')?.value || 'all';

    let list = invItems.slice();

    if (keyword) {
        list = list.filter(i =>
            (i.nama_barang || '').toLowerCase().includes(keyword) ||
            (i.kode_barang || '').toLowerCase().includes(keyword)
        );
    }
    if (kategoriFilter !== 'all') list = list.filter(i => i.kategori === kategoriFilter);
    if (statusFilter === 'low') {
        list = list.filter(i => (parseInt(i.stok_saat_ini) || 0) <= (parseInt(i.stok_minimum) || 0));
    } else if (statusFilter === 'ok') {
        list = list.filter(i => (parseInt(i.stok_saat_ini) || 0) > (parseInt(i.stok_minimum) || 0));
    }

    const counter = document.getElementById('invItemCount');
    if (counter) counter.textContent = list.length;

    if (list.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="invx-empty">📭 Tidak ada data barang</td></tr>';
        return;
    }

    body.innerHTML = list.map((item, i) => {
        const stok = parseInt(item.stok_saat_ini) || 0;
        const min = parseInt(item.stok_minimum) || 0;
        const isLow = stok <= min;

        return `<tr>
            <td style="text-align:center;color:#94a3b8;font-weight:600;">${i + 1}</td>
            <td>
                <div class="invx-item-name">${item.nama_barang || '-'}</div>
                <div class="invx-item-code">${item.kode_barang || '-'}</div>
            </td>
            <td><span class="invx-status" style="background:#f1f5f9;color:#334155;">${item.kategori || 'Umum'}</span></td>
            <td style="text-align:center;">
                <span class="invx-stock ${isLow ? 'invx-stock--low' : ''}">${stok}</span>
                <span class="invx-stock-unit">${item.satuan || 'pcs'}</span>
            </td>
            <td style="text-align:center;color:#64748b;font-weight:600;">${min}</td>
            <td style="text-align:right;font-weight:600;color:#0f172a;">Rp ${(parseFloat(item.harga_satuan) || 0).toLocaleString('id-ID')}</td>
            <td style="text-align:center;">
                ${isLow
                    ? '<span class="invx-status invx-status--low">⚠️ Stok Minimum</span>'
                    : '<span class="invx-status invx-status--ok">✅ Aman</span>'}
            </td>
            <td>
                <div class="invx-actions">
                    <button class="invx-action-btn edit" onclick="openEditItemModal(${item.id})" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="invx-action-btn adjust" onclick="adjustStock(${item.id})" title="Penyesuaian Stok">
                        <i class="fas fa-sliders-h"></i>
                    </button>
                    <button class="invx-action-btn delete" onclick="deleteInventoryItem(${item.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ============================================================
// SWITCH TAB DI INVENTARIS
// ============================================================
// ============================================================
// SWITCH TAB DI INVENTARIS (update class)
// ============================================================
function switchInvTab(tab) {
    document.querySelectorAll('.invx-tab').forEach(el => el.classList.remove('active'));
    const targetTab = document.querySelector(`.invx-tab[data-inv-tab="${tab}"]`);
    if (targetTab) targetTab.classList.add('active');

    document.querySelectorAll('.invx-content').forEach(el => el.style.display = 'none');

    const map = {
        'stok': 'invTabStok',
        'masuk': 'invTabMasuk',
        'keluar': 'invTabKeluar',
        'riwayat': 'invTabRiwayat'
    };
    const targetContent = document.getElementById(map[tab]);
    if (targetContent) targetContent.style.display = 'block';

    if (tab === 'riwayat') renderInventoryHistory();
}

// ============================================================
// MODAL TAMBAH BARANG
// ============================================================
async function openAddItemModal() {
    const result = await Swal.fire({
        title: '➕ Tambah Barang Baru',
        width: 550,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Kode Barang <span style="color:#dc2626;">*</span></label>
                        <input id="swalItemKode" type="text" placeholder="MDM-001"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;text-transform:uppercase;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Kategori</label>
                        <input id="swalItemKategori" type="text" placeholder="Modem / Kabel / dll" value="Umum"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Nama Barang <span style="color:#dc2626;">*</span></label>
                        <input id="swalItemNama" type="text" placeholder="Modem ZTE F660"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Satuan</label>
                        <input id="swalItemSatuan" type="text" value="pcs"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Stok Minimum</label>
                        <input id="swalItemMin" type="number" value="5" min="0"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Stok Awal</label>
                        <input id="swalItemStok" type="number" value="0" min="0"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Harga Satuan (Rp)</label>
                        <input id="swalItemHarga" type="number" value="0" min="0"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Keterangan</label>
                        <input id="swalItemKet" type="text" placeholder="Opsional"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const kode = document.getElementById('swalItemKode').value.trim().toUpperCase();
            const nama = document.getElementById('swalItemNama').value.trim();
            if (!kode) { Swal.showValidationMessage('⚠️ Kode barang wajib!'); return false; }
            if (!nama) { Swal.showValidationMessage('⚠️ Nama barang wajib!'); return false; }
            return {
                kode_barang: kode,
                nama_barang: nama,
                kategori: document.getElementById('swalItemKategori').value.trim() || 'Umum',
                satuan: document.getElementById('swalItemSatuan').value.trim() || 'pcs',
                stok_minimum: parseInt(document.getElementById('swalItemMin').value) || 0,
                stok_saat_ini: parseInt(document.getElementById('swalItemStok').value) || 0,
                harga_satuan: parseFloat(document.getElementById('swalItemHarga').value) || 0,
                keterangan: document.getElementById('swalItemKet').value.trim() || null
            };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await sb.from('inventory_items').insert(result.value);
        if (error) throw error;

        // Kalau ada stok awal, catat sebagai transaksi masuk
        if (result.value.stok_saat_ini > 0) {
            const { data: newItem } = await sb.from('inventory_items')
                .select('id')
                .eq('kode_barang', result.value.kode_barang)
                .maybeSingle();

            if (newItem) {
                await sb.from('inventory_transactions').insert({
                    item_id: newItem.id,
                    tipe: 'masuk',
                    jumlah: result.value.stok_saat_ini,
                    keterangan: 'Stok awal'
                });
            }
        }

        notif('✅ Barang berhasil ditambahkan', 'success');
        await loadInventoryItems();
        await renderInventoryStats();
        await fillInventorySelects();
        await renderInventoryItems();
        await renderRecentTransactions();

    } catch(e) {
        if (e.message.includes('duplicate') || e.message.includes('unique')) {
            Swal.fire('Gagal', 'Kode barang sudah dipakai!', 'error');
        } else {
            Swal.fire('Gagal', e.message, 'error');
        }
    }
}

// ============================================================
// MODAL EDIT BARANG
// ============================================================
async function openEditItemModal(itemId) {
    const item = invItems.find(i => i.id === itemId);
    if (!item) return;

    const result = await Swal.fire({
        title: '✏️ Edit Barang',
        width: 550,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Kode Barang <span style="color:#dc2626;">*</span></label>
                        <input id="swalEditItemKode" type="text" value="${item.kode_barang || ''}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;text-transform:uppercase;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Kategori</label>
                        <input id="swalEditItemKategori" type="text" value="${item.kategori || 'Umum'}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Nama Barang <span style="color:#dc2626;">*</span></label>
                        <input id="swalEditItemNama" type="text" value="${item.nama_barang || ''}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Satuan</label>
                        <input id="swalEditItemSatuan" type="text" value="${item.satuan || 'pcs'}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Stok Minimum</label>
                        <input id="swalEditItemMin" type="number" value="${item.stok_minimum || 0}" min="0"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Harga Satuan (Rp)</label>
                        <input id="swalEditItemHarga" type="number" value="${item.harga_satuan || 0}" min="0"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Keterangan</label>
                        <input id="swalEditItemKet" type="text" value="${item.keterangan || ''}"
                            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    </div>
                </div>
                <div style="background:#fef3c7;padding:10px 14px;border-radius:8px;margin-top:12px;font-size:12px;color:#92400e;border-left:4px solid #f59e0b;">
                    ⚠️ Stok saat ini <strong>${item.stok_saat_ini}</strong>. Untuk mengubah stok, gunakan tombol <strong>Penyesuaian Stok</strong>.
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const kode = document.getElementById('swalEditItemKode').value.trim().toUpperCase();
            const nama = document.getElementById('swalEditItemNama').value.trim();
            if (!kode) { Swal.showValidationMessage('⚠️ Kode barang wajib!'); return false; }
            if (!nama) { Swal.showValidationMessage('⚠️ Nama barang wajib!'); return false; }
            return {
                kode_barang: kode,
                nama_barang: nama,
                kategori: document.getElementById('swalEditItemKategori').value.trim() || 'Umum',
                satuan: document.getElementById('swalEditItemSatuan').value.trim() || 'pcs',
                stok_minimum: parseInt(document.getElementById('swalEditItemMin').value) || 0,
                harga_satuan: parseFloat(document.getElementById('swalEditItemHarga').value) || 0,
                keterangan: document.getElementById('swalEditItemKet').value.trim() || null,
                updated_at: new Date().toISOString()
            };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await sb.from('inventory_items').update(result.value).eq('id', itemId);
        if (error) throw error;

        notif('✅ Barang berhasil diupdate', 'success');
        await loadInventoryItems();
        await renderInventoryStats();
        await fillInventorySelects();
        await renderInventoryItems();

    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// PENYESUAIAN STOK
// ============================================================
async function adjustStock(itemId) {
    const item = invItems.find(i => i.id === itemId);
    if (!item) return;

    const result = await Swal.fire({
        title: '🔧 Penyesuaian Stok',
        width: 450,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;margin-bottom:14px;">
                    <div style="font-weight:700;color:#0b1a33;">${item.kode_barang} — ${item.nama_barang}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px;">Stok saat ini: <strong>${item.stok_saat_ini}</strong> ${item.satuan}</div>
                </div>
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Stok Baru</label>
                <input id="swalAdjustStok" type="number" min="0" value="${item.stok_saat_ini}"
                    style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                <label style="display:block;font-weight:600;margin:12px 0 6px;color:#1e293b;">Alasan</label>
                <input id="swalAdjustReason" type="text" placeholder="Misal: hasil stock opname"
                    style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const newStok = parseInt(document.getElementById('swalAdjustStok').value);
            const reason = document.getElementById('swalAdjustReason').value.trim();
            if (isNaN(newStok) || newStok < 0) { Swal.showValidationMessage('⚠️ Stok tidak valid'); return false; }
            if (!reason) { Swal.showValidationMessage('⚠️ Alasan wajib diisi'); return false; }
            return { newStok, reason, selisih: newStok - (parseInt(item.stok_saat_ini) || 0) };
        }
    });

    if (!result.isConfirmed) return;

    try {
        // Update stok
        const { error: errUpdate } = await sb.from('inventory_items')
            .update({ stok_saat_ini: result.value.newStok, updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (errUpdate) throw errUpdate;

        // Catat transaksi penyesuaian
        await sb.from('inventory_transactions').insert({
            item_id: itemId,
            tipe: 'penyesuaian',
            jumlah: result.value.selisih,
            keterangan: result.value.reason
        });

        notif('✅ Stok berhasil disesuaikan', 'success');
        await loadInventoryItems();
        await renderInventoryStats();
        await fillInventorySelects();
        await renderInventoryItems();
        await renderRecentTransactions();

    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// HAPUS BARANG
// ============================================================
async function deleteInventoryItem(itemId) {
    const item = invItems.find(i => i.id === itemId);
    if (!item) return;

    const conf = await Swal.fire({
        title: '⚠️ Hapus Barang?',
        html: `<div style="text-align:left;">
            <div style="font-weight:700;">${item.kode_barang} — ${item.nama_barang}</div>
            <div style="font-size:13px;color:#dc2626;margin-top:8px;">
                Semua riwayat transaksi barang ini juga akan terhapus!
            </div>
        </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🗑️ Hapus',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8'
    });

    if (!conf.isConfirmed) return;

    try {
        const { error } = await sb.from('inventory_items').delete().eq('id', itemId);
        if (error) throw error;

        notif('✅ Barang dihapus', 'success');
        await loadInventoryItems();
        await renderInventoryStats();
        await fillInventorySelects();
        await renderInventoryItems();
        await renderRecentTransactions();

    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// SUBMIT STOK MASUK
// ============================================================
async function submitStokMasuk() {
    const itemId = document.getElementById('invMasukBarang').value;
    const jumlah = parseInt(document.getElementById('invMasukJumlah').value);
    const harga = parseFloat(document.getElementById('invMasukHarga').value) || 0;
    const supplier = document.getElementById('invMasukSupplier').value.trim();
    const ket = document.getElementById('invMasukKet').value.trim();

    if (!itemId) { notif('⚠️ Pilih barang dulu!', 'warning'); return; }
    if (!jumlah || jumlah < 1) { notif('⚠️ Jumlah tidak valid!', 'warning'); return; }

    try {
        // 1. Catat transaksi
        const { error: errTx } = await sb.from('inventory_transactions').insert({
            item_id: parseInt(itemId),
            tipe: 'masuk',
            jumlah: jumlah,
            supplier: supplier || null,
            keterangan: ket || null
        });
        if (errTx) throw errTx;

        // 2. Update stok
        const item = invItems.find(i => i.id === parseInt(itemId));
        const stokBaru = (parseInt(item.stok_saat_ini) || 0) + jumlah;
        const updateData = { stok_saat_ini: stokBaru, updated_at: new Date().toISOString() };

        // Kalau ada harga baru, update juga
        if (harga > 0) updateData.harga_satuan = harga;

        const { error: errUpdate } = await sb.from('inventory_items').update(updateData).eq('id', parseInt(itemId));
        if (errUpdate) throw errUpdate;

        // ✅ LOG AKTIVITAS
        await logActivity('CREATE', {
            table: 'inventory_items',
            recordId: item.kode_barang,
            description: `Stok masuk: ${jumlah} ${item.satuan} ${item.nama_barang}`,
            newValue: { item: item.nama_barang, jumlah, stokBaru, supplier }
        });

        notif(`✅ ${jumlah} ${item.satuan} ${item.nama_barang} masuk. Stok: ${stokBaru}`, 'success');

        // Reset form
        document.getElementById('invMasukBarang').value = '';
        document.getElementById('invMasukJumlah').value = '';
        document.getElementById('invMasukHarga').value = '';
        document.getElementById('invMasukSupplier').value = '';
        document.getElementById('invMasukKet').value = '';

        await loadInventoryItems();
        await renderInventoryStats();
        await fillInventorySelects();
        await renderInventoryItems();
        await renderRecentTransactions();

    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// SUBMIT STOK KELUAR
// ============================================================
async function submitStokKeluar() {
    const itemId = document.getElementById('invKeluarBarang').value;
    const jumlah = parseInt(document.getElementById('invKeluarJumlah').value);
    const teknisi = document.getElementById('invKeluarTeknisi').value;
    const tiket = document.getElementById('invKeluarTiket').value.trim();
    const ket = document.getElementById('invKeluarKet').value.trim();

    if (!itemId) { notif('⚠️ Pilih barang dulu!', 'warning'); return; }
    if (!jumlah || jumlah < 1) { notif('⚠️ Jumlah tidak valid!', 'warning'); return; }
    if (!teknisi) { notif('⚠️ Pilih teknisi dulu!', 'warning'); return; }

    const item = invItems.find(i => i.id === parseInt(itemId));
    const stokSekarang = parseInt(item.stok_saat_ini) || 0;

    if (jumlah > stokSekarang) {
        Swal.fire('Stok Tidak Cukup!', `Stok ${item.nama_barang} hanya ${stokSekarang}. Tidak bisa keluar ${jumlah}.`, 'error');
        return;
    }

    try {
        // 1. Catat transaksi
        const { error: errTx } = await sb.from('inventory_transactions').insert({
            item_id: parseInt(itemId),
            tipe: 'keluar',
            jumlah: jumlah,
            teknisi: teknisi,
            ticket_id: tiket || null,
            keterangan: ket || null
        });
        if (errTx) throw errTx;

        // 2. Update stok
        const stokBaru = stokSekarang - jumlah;
        const { error: errUpdate } = await sb.from('inventory_items')
            .update({ stok_saat_ini: stokBaru, updated_at: new Date().toISOString() })
            .eq('id', parseInt(itemId));
        if (errUpdate) throw errUpdate;

                // ✅ LOG AKTIVITAS
        await logActivity('CREATE', {
            table: 'inventory_items',
            recordId: item.kode_barang,
            description: `Stok keluar: ${jumlah} ${item.satuan} ${item.nama_barang} → ${teknisi}`,
            newValue: { item: item.nama_barang, jumlah, teknisi, stokBaru }
        });

        // Cek kalau stok rendah
        if (stokBaru <= (parseInt(item.stok_minimum) || 0)) {
            notif(`⚠️ STOK ${item.nama_barang} MENIPIS! Sisa: ${stokBaru}`, 'warning');
        } else {
            notif(`✅ ${jumlah} ${item.satuan} ${item.nama_barang} keluar ke ${teknisi}. Sisa: ${stokBaru}`, 'success');
        }

        // Reset form
        document.getElementById('invKeluarBarang').value = '';
        document.getElementById('invKeluarJumlah').value = '';
        document.getElementById('invKeluarTeknisi').value = '';
        document.getElementById('invKeluarTiket').value = '';
        document.getElementById('invKeluarKet').value = '';
        document.getElementById('invKeluarStokInfo').textContent = '';

        await loadInventoryItems();
        await renderInventoryStats();
        await fillInventorySelects();
        await renderInventoryItems();
        await renderRecentTransactions();

    } catch(e) {
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// INFO STOK SAAT PILIH BARANG DI FORM KELUAR
// ============================================================
function updateKeluarStokInfo() {
    const itemId = parseInt(document.getElementById('invKeluarBarang').value);
    const infoEl = document.getElementById('invKeluarStokInfo');
    if (!infoEl) return;

    if (!itemId) { infoEl.textContent = ''; return; }

    const item = invItems.find(i => i.id === itemId);
    if (!item) { infoEl.textContent = ''; return; }

    const stok = parseInt(item.stok_saat_ini) || 0;
    const min = parseInt(item.stok_minimum) || 0;
    const isLow = stok <= min;

    infoEl.innerHTML = `Stok tersedia: <strong style="color:${isLow ? '#dc2626' : '#16a34a'};">${stok} ${item.satuan}</strong>`;
}

// ============================================================
// RENDER 10 TRANSAKSI MASUK/KELUAR TERAKHIR (v2 — Feed Style)
// ============================================================
async function renderRecentTransactions() {
    try {
        // 10 MASUK
        const { data: masukData } = await sb.from('inventory_transactions')
            .select('*, inventory_items(nama_barang, kode_barang, satuan)')
            .eq('tipe', 'masuk')
            .order('created_at', { ascending: false })
            .limit(10);

        const masukBody = document.getElementById('invMasukBody');
        if (masukBody) {
            if (!masukData || masukData.length === 0) {
                masukBody.innerHTML = '<div class="invx-empty">📭 Belum ada transaksi</div>';
            } else {
                masukBody.innerHTML = masukData.map(t => {
                    const tgl = new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    const item = t.inventory_items || {};
                    return `<div class="invx-feed-item">
                        <div class="invx-feed-icon in"><i class="fas fa-arrow-down"></i></div>
                        <div class="invx-feed-content">
                            <div class="invx-feed-title">${item.nama_barang || '-'}</div>
                            <div class="invx-feed-meta">${item.kode_barang || '-'} • ${tgl}${t.supplier ? ' • ' + t.supplier : ''}</div>
                        </div>
                        <div class="invx-feed-qty in">+${t.jumlah}</div>
                    </div>`;
                }).join('');
            }
        }

        // 10 KELUAR
        const { data: keluarData } = await sb.from('inventory_transactions')
            .select('*, inventory_items(nama_barang, kode_barang, satuan)')
            .eq('tipe', 'keluar')
            .order('created_at', { ascending: false })
            .limit(10);

        const keluarBody = document.getElementById('invKeluarBody');
        if (keluarBody) {
            if (!keluarData || keluarData.length === 0) {
                keluarBody.innerHTML = '<div class="invx-empty">📭 Belum ada transaksi</div>';
            } else {
                keluarBody.innerHTML = keluarData.map(t => {
                    const tgl = new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    const item = t.inventory_items || {};
                    return `<div class="invx-feed-item">
                        <div class="invx-feed-icon out"><i class="fas fa-arrow-up"></i></div>
                        <div class="invx-feed-content">
                            <div class="invx-feed-title">${item.nama_barang || '-'}</div>
                            <div class="invx-feed-meta">${item.kode_barang || '-'} • ${tgl}${t.teknisi ? ' • ' + t.teknisi : ''}</div>
                        </div>
                        <div class="invx-feed-qty out">-${t.jumlah}</div>
                    </div>`;
                }).join('');
            }
        }
    } catch(e) {
        console.error('Error recent transactions:', e);
    }
}

// ============================================================
// RENDER RIWAYAT TRANSAKSI (v2)
// ============================================================
let invRiwayatCurrentPage = 1;
const invRiwayatPerPage = 25;

async function renderInventoryHistory() {
    const body = document.getElementById('invRiwayatBody');
    if (!body) return;

    const dateFrom = document.getElementById('invRiwayatDateFrom')?.value || '';
    const dateTo = document.getElementById('invRiwayatDateTo')?.value || '';
    const tipe = document.getElementById('invRiwayatTipe')?.value || 'all';
    const itemId = document.getElementById('invRiwayatBarang')?.value || 'all';

    body.innerHTML = '<tr><td colspan="7" class="invx-empty">⏳ Memuat data...</td></tr>';

    try {
        let query = sb.from('inventory_transactions')
            .select('*, inventory_items(nama_barang, kode_barang, satuan)', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
        if (tipe !== 'all') query = query.eq('tipe', tipe);
        if (itemId !== 'all') query = query.eq('item_id', parseInt(itemId));

        const from = (invRiwayatCurrentPage - 1) * invRiwayatPerPage;
        const to = from + invRiwayatPerPage - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="7" class="invx-empty">📭 Tidak ada riwayat sesuai filter</td></tr>';
            document.getElementById('invRiwayatPagination').innerHTML = '';
            return;
        }

        body.innerHTML = data.map(t => {
            const tgl = new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const item = t.inventory_items || {};
            const isMasuk = t.tipe === 'masuk';
            const isKeluar = t.tipe === 'keluar';

            let tipeBadge = '';
            let jumlahDisplay = '';
            if (isMasuk) {
                tipeBadge = '<span class="invx-status invx-status--ok"><i class="fas fa-arrow-down"></i> MASUK</span>';
                jumlahDisplay = `<span style="color:#059669;font-weight:800;">+${t.jumlah}</span>`;
            } else if (isKeluar) {
                tipeBadge = '<span class="invx-status invx-status--low"><i class="fas fa-arrow-up"></i> KELUAR</span>';
                jumlahDisplay = `<span style="color:#dc2626;font-weight:800;">-${t.jumlah}</span>`;
            } else {
                tipeBadge = '<span class="invx-status" style="background:#fffbeb;color:#d97706;"><i class="fas fa-sliders-h"></i> ADJUST</span>';
                jumlahDisplay = `<span style="color:#d97706;font-weight:800;">${t.jumlah > 0 ? '+' : ''}${t.jumlah}</span>`;
            }

            const teknisiOrSupplier = isKeluar ? (t.teknisi || '-') : (t.supplier || '-');

            return `<tr>
                <td style="font-size:12px;color:#475569;">${tgl}</td>
                <td style="text-align:center;">${tipeBadge}</td>
                <td>
                    <div class="invx-item-name">${item.nama_barang || '-'}</div>
                    <div class="invx-item-code">${item.kode_barang || '-'}</div>
                </td>
                <td style="text-align:center;">${jumlahDisplay} <span class="invx-stock-unit">${item.satuan || ''}</span></td>
                <td style="font-size:12px;">${teknisiOrSupplier}</td>
                <td style="font-size:12px;">${t.ticket_id || '-'}</td>
                <td style="font-size:12px;color:#475569;">${t.keterangan || '-'}</td>
            </tr>`;
        }).join('');

        const totalPages = Math.ceil(count / invRiwayatPerPage);
        let pagHtml = '';
        if (totalPages > 1) {
            pagHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
            if (invRiwayatCurrentPage > 1) pagHtml += `<button class="invx-btn-ghost" onclick="goToInvRiwayatPage(${invRiwayatCurrentPage - 1})">◀ Prev</button>`;
            const startPage = Math.max(1, invRiwayatCurrentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);
            for (let i = startPage; i <= endPage; i++) {
                const active = i === invRiwayatCurrentPage;
                pagHtml += `<button class="invx-btn-ghost" onclick="goToInvRiwayatPage(${i})" style="${active ? 'background:#0f172a;color:white;border-color:#0f172a;' : ''}">${i}</button>`;
            }
            if (invRiwayatCurrentPage < totalPages) pagHtml += `<button class="invx-btn-ghost" onclick="goToInvRiwayatPage(${invRiwayatCurrentPage + 1})">Next ▶</button>`;
            pagHtml += '</div>';
            pagHtml += `<span style="font-size:13px;color:#64748b;">Menampilkan ${from + 1}-${Math.min(from + invRiwayatPerPage, count)} dari ${count}</span>`;
        }
        document.getElementById('invRiwayatPagination').innerHTML = pagHtml;

    } catch(e) {
        console.error('Error render history:', e);
        body.innerHTML = '<tr><td colspan="7" class="invx-empty" style="color:#dc2626;">❌ Gagal load data</td></tr>';
    }
}

function goToInvRiwayatPage(page) {
    invRiwayatCurrentPage = page;
    renderInventoryHistory();
}

// ============================================================
// RESET FILTER
// ============================================================
function resetInvFilter() {
    const s = document.getElementById('invSearch');
    const k = document.getElementById('invFilterKategori');
    const st = document.getElementById('invFilterStatus');
    if (s) s.value = '';
    if (k) k.value = 'all';
    if (st) st.value = 'all';
    renderInventoryItems();
}

function resetInvRiwayat() {
    const d1 = document.getElementById('invRiwayatDateFrom');
    const d2 = document.getElementById('invRiwayatDateTo');
    const t = document.getElementById('invRiwayatTipe');
    const b = document.getElementById('invRiwayatBarang');
    if (d1) d1.value = '';
    if (d2) d2.value = '';
    if (t) t.value = 'all';
    if (b) b.value = 'all';
    invRiwayatCurrentPage = 1;
    renderInventoryHistory();
}

// ============================================================
// FILTER LOW STOCK (dari stat card)
// ============================================================
function filterLowStock() {
    const st = document.getElementById('invFilterStatus');
    if (st) st.value = 'low';
    renderInventoryItems();
    switchInvTab('stok');
    notif('Menampilkan barang dengan stok minimum', 'info');
}

// ============================================================
// PEMAKAIAN BARANG DI MODAL CLOSE TIKET
// ============================================================

function addPemakaianBarang() {
    const selectEl = document.getElementById('swalPemakaianBarang');
    const jumlahEl = document.getElementById('swalPemakaianJumlah');
    
    if (!selectEl || !jumlahEl) return;
    
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const itemId = selectEl.value;
    const jumlah = parseInt(jumlahEl.value);
    
    if (!itemId) {
        Swal.showValidationMessage('⚠️ Pilih barang dulu!');
        return;
    }
    if (!jumlah || jumlah < 1) {
        Swal.showValidationMessage('⚠️ Jumlah tidak valid!');
        return;
    }
    
    // Cek apakah barang sudah ada di list
    const existing = currentPemakaianBarang.find(b => b.item_id === parseInt(itemId));
    if (existing) {
        existing.jumlah += jumlah;
    } else {
        currentPemakaianBarang.push({
            item_id: parseInt(itemId),
            kode: selectedOption.dataset.kode,
            nama: selectedOption.dataset.nama,
            satuan: selectedOption.dataset.satuan || 'pcs',
            stok_tersedia: parseInt(selectedOption.dataset.stok) || 0,
            stok_minimum: parseInt(selectedOption.dataset.min) || 0,
            jumlah: jumlah
        });
    }
    
    // Reset input
    selectEl.value = '';
    jumlahEl.value = '1';
    
    // Render list
    renderPemakaianList();
}

function renderPemakaianList() {
    const listEl = document.getElementById('swalPemakaianList');
    if (!listEl) return;
    
    if (currentPemakaianBarang.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:12px;">Belum ada barang dipilih</div>';
        return;
    }
    
    listEl.innerHTML = currentPemakaianBarang.map((b, idx) => {
        const stokSetelah = b.stok_tersedia - b.jumlah;
        const isWarning = stokSetelah < 0;
        const isLow = stokSetelah <= b.stok_minimum && stokSetelah >= 0;
        
        let statusColor = '#16a34a';
        let statusText = `Sisa: ${stokSetelah}`;
        if (isWarning) {
            statusColor = '#dc2626';
            statusText = `⚠️ Stok minus: ${stokSetelah}`;
        } else if (isLow) {
            statusColor = '#f59e0b';
            statusText = `⚠️ Stok rendah: ${stokSetelah}`;
        }
        
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:white;border-radius:8px;margin-bottom:6px;border:1px solid #e2e8f0;">
            <div style="flex:1;">
                <div style="font-weight:600;color:#0b1a33;font-size:13px;">${b.kode} — ${b.nama}</div>
                <div style="font-size:11px;color:${statusColor};margin-top:2px;font-weight:600;">
                    ${b.jumlah} ${b.satuan} • Stok: ${b.stok_tersedia} → ${statusText}
                </div>
            </div>
            <button type="button" onclick="removePemakaianBarang(${idx})" 
                style="background:#fee2e2;border:none;color:#dc2626;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-left:8px;">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    }).join('');
}

function removePemakaianBarang(index) {
    currentPemakaianBarang.splice(index, 1);
    renderPemakaianList();
}

// ============================================================
// LOAD DETAIL PEMAKAIAN BARANG DI TIKET
// ============================================================
async function loadPemakaianBarangDetail(ticketId) {
    const container = document.getElementById('pemakaianBarangDetail_' + ticketId);
    if (!container) return;

    try {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        const { data, error } = await sb
            .from('inventory_transactions')
            .select('*, inventory_items(nama_barang, kode_barang, satuan)')
            .eq('ticket_id', ticket.ticketid)
            .eq('tipe', 'keluar')
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <div style="background:#f5f3ff;padding:14px 18px;border-radius:12px;border:1px solid #c4b5fd;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <i class="fas fa-box-open" style="color:#7c3aed;font-size:18px;"></i>
                    <div style="font-size:11px;color:#5b21b6;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                        Barang yang Dipakai
                    </div>
                </div>
                <div style="background:white;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#ede9fe;color:#5b21b6;">
                                <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;">Barang</th>
                                <th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:700;width:80px;">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        data.forEach(t => {
            const item = t.inventory_items || {};
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 10px;">
                    <div style="font-weight:600;color:#0b1a33;">${item.kode_barang || '-'} — ${item.nama_barang || '-'}</div>
                </td>
                <td style="padding:8px 10px;text-align:center;color:#7c3aed;font-weight:700;">
                    ${t.jumlah} ${item.satuan || 'pcs'}
                </td>
            </tr>`;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch(e) {
        console.error('Error load pemakaian barang:', e);
    }
}

// ============================================================
// SCHEDULE — JADWAL TEKNISI
// ============================================================

let scheduleWeekStart = null; // Tanggal Senin minggu ini
let scheduleData = [];

// ============================================================
// RENDER HALAMAN JADWAL
// ============================================================
async function renderScheduleSection() {
    // Set default minggu ini (Senin)
    if (!scheduleWeekStart) {
        scheduleWeekStart = getMonday(new Date());
    }
    
    await loadScheduleData();
    renderScheduleGrid();
    updateScheduleStats();
}

// ============================================================
// HELPER: Dapatkan tanggal Senin dari minggu tertentu
// ============================================================
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Senin = 1
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ============================================================
// FORMAT TANGGAL (YYYY-MM-DD)
// ============================================================
function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================================
// LOAD DATA JADWAL MINGGU INI
// ============================================================
async function loadScheduleData() {
    const weekStart = scheduleWeekStart;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startStr = formatDateStr(weekStart);
    const endStr = formatDateStr(weekEnd);
    
    // Update label
    const labelEl = document.getElementById('scheduleWeekLabel');
    if (labelEl) {
        const startFmt = weekStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const endFmt = weekEnd.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        labelEl.textContent = `${startFmt} — ${endFmt}`;
    }
    
    try {
        const { data, error } = await sb
            .from('technician_schedules')
            .select('*')
            .gte('tanggal', startStr)
            .lte('tanggal', endStr);
        
        if (error) throw error;
        scheduleData = data || [];
        console.log('📅 Schedule loaded:', scheduleData.length);
    } catch(e) {
        console.error('Error load schedule:', e);
        scheduleData = [];
    }
}

// ============================================================
// RENDER GRID JADWAL
// ============================================================
function renderScheduleGrid() {
    const tbody = document.getElementById('scheduleBody');
    if (!tbody) return;
    
    if (!techs || techs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">Belum ada teknisi. Tambahkan di menu Teknisi dulu.</td></tr>';
        return;
    }
    
    // Dapatkan 7 hari minggu ini
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(scheduleWeekStart);
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    
    // Update header tanggal
    document.querySelectorAll('.sched-day-header').forEach(el => {
        const dayNum = parseInt(el.dataset.day);
        // Cari index hari di minggu ini (0=Senin, 6=Minggu)
        let idx = -1;
        if (dayNum === 1) idx = 0;
        else if (dayNum === 2) idx = 1;
        else if (dayNum === 3) idx = 2;
        else if (dayNum === 4) idx = 3;
        else if (dayNum === 5) idx = 4;
        else if (dayNum === 6) idx = 5;
        else if (dayNum === 0) idx = 6;
        
        if (idx >= 0 && days[idx]) {
            const d = days[idx];
            const dayName = el.textContent.split('<')[0].trim();
            el.innerHTML = `${el.textContent.replace(/\d.*/, '').trim()}<br><span style="font-size:10px;opacity:0.75;font-weight:400;">${d.getDate()}/${d.getMonth()+1}</span>`;
        }
    });
    
    // Header nama hari
    const dayHeaders = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    document.querySelectorAll('.sched-day-header').forEach((el, i) => {
        // urutkan: senin(1), selasa(2), rabu(3), kamis(4), jumat(5), sabtu(6), minggu(0)
        const order = [1, 2, 3, 4, 5, 6, 0];
        const dayNum = order[i];
        let idx = i;
        const d = days[idx];
        const name = dayHeaders[idx];
        el.innerHTML = `${name}<br><span style="font-size:10px;opacity:0.75;font-weight:400;">${d.getDate()}/${d.getMonth()+1}</span>`;
    });
    
    // Render baris per teknisi
    const today = formatDateStr(new Date());
    
    tbody.innerHTML = techs.map(t => {
        const cells = days.map(d => {
            const tglStr = formatDateStr(d);
            const sched = scheduleData.find(s => s.technician_id === t.id && s.tanggal === tglStr);
            const isToday = tglStr === today;
            
            let cellContent = '<span class="sched-empty">·</span>';
            if (sched) {
                const shiftClass = `sched-shift-${sched.shift.toLowerCase()}`;
                const shiftLabel = getShiftLabel(sched.shift);
                cellContent = `<span class="sched-badge ${shiftClass}">${shiftLabel}</span>`;
            }
            
            const todayClass = isToday ? 'sched-today' : '';
            
            return `<td class="${todayClass}" onclick="openCellScheduleModal(${t.id}, '${t.name}', '${tglStr}')" title="Klik untuk edit">
                ${cellContent}
            </td>`;
        }).join('');
        
        return `<tr>
            <td class="sched-nama">${t.name} <span style="font-size:10px;color:#64748b;font-weight:400;">(${t.posisi || 'PSB/GGN'})</span></td>
            ${cells}
        </tr>`;
    }).join('');
}

// ============================================================
// LABEL SHIFT
// ============================================================
function getShiftLabel(shift) {
    const labels = {
        'pagi': '🌅 Pagi',
        'siang': '☀️ Siang',
        'malam': '🌙 Malam',
        'standby': '🟢 Standby',
        'cuti': '🏖️ Cuti',
        'izin': '📋 Izin',
        'libur': '💤 Libur'
    };
    return labels[shift] || shift;
}

// ============================================================
// UPDATE STATISTIK MINGGU INI
// ============================================================
function updateScheduleStats() {
    const totalPagi = scheduleData.filter(s => s.shift === 'pagi').length;
    const totalSiang = scheduleData.filter(s => s.shift === 'siang').length;
    const totalMalam = scheduleData.filter(s => s.shift === 'malam').length;
    
    // Hitung teknisi yang punya jadwal minggu ini
    const uniqueTechs = new Set(scheduleData.map(s => s.technician_id));
    
    document.getElementById('schedTotalTeknisi').textContent = uniqueTechs.size;
    document.getElementById('schedTotalPagi').textContent = totalPagi;
    document.getElementById('schedTotalSiang').textContent = totalSiang;
    document.getElementById('schedTotalMalam').textContent = totalMalam;
}

// ============================================================
// NAVIGASI MINGGU
// ============================================================
function changeScheduleWeek(direction) {
    if (!scheduleWeekStart) {
        scheduleWeekStart = getMonday(new Date());
    }
    scheduleWeekStart.setDate(scheduleWeekStart.getDate() + (direction * 7));
    renderScheduleSection();
}

function goToTodaySchedule() {
    scheduleWeekStart = getMonday(new Date());
    renderScheduleSection();
}

// ============================================================
// MODAL EDIT 1 SEL JADWAL
// ============================================================
async function openCellScheduleModal(techId, techName, tglStr) {
    const existing = scheduleData.find(s => s.technician_id === techId && s.tanggal === tglStr);
    const tglFmt = new Date(tglStr).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    
    const result = await Swal.fire({
        title: '📅 Atur Jadwal',
        width: 500,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;margin-bottom:16px;">
                    <div style="font-weight:700;color:#0b1a33;">👤 ${techName}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px;">📅 ${tglFmt}</div>
                </div>
                
                <label style="display:block;font-weight:600;margin-bottom:8px;color:#1e293b;">Pilih Shift:</label>
                <select id="swalShiftSelect" style="width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
                    <option value="">-- Kosongkan --</option>
                    <option value="pagi" ${existing?.shift === 'pagi' ? 'selected' : ''}>🌅 Pagi (07:00 - 15:00)</option>
                    <option value="siang" ${existing?.shift === 'siang' ? 'selected' : ''}>☀️ Siang (15:00 - 23:00)</option>
                    <option value="malam" ${existing?.shift === 'malam' ? 'selected' : ''}>🌙 Malam (23:00 - 07:00)</option>
                    <option value="standby" ${existing?.shift === 'standby' ? 'selected' : ''}>🟢 Standby (On-Call)</option>
                    <option value="cuti" ${existing?.shift === 'cuti' ? 'selected' : ''}>🏖️ Cuti</option>
                    <option value="izin" ${existing?.shift === 'izin' ? 'selected' : ''}>📋 Izin</option>
                    <option value="libur" ${existing?.shift === 'libur' ? 'selected' : ''}>💤 Libur</option>
                </select>
                
                <label style="display:block;font-weight:600;margin:12px 0 6px;color:#1e293b;">Catatan (opsional)</label>
                <input id="swalShiftNote" type="text" value="${existing?.catatan || ''}" placeholder="Misal: jaga area Jakarta"
                    style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            return {
                shift: document.getElementById('swalShiftSelect').value,
                catatan: document.getElementById('swalShiftNote').value.trim()
            };
        }
    });
    
    if (!result.isConfirmed) return;
    
    const { shift, catatan } = result.value;
    
    try {
        if (!shift) {
            // Hapus jadwal
            if (existing) {
                await sb.from('technician_schedules').delete().eq('id', existing.id);
                notif('✅ Jadwal dihapus', 'success');
            }
        } else {
            // Upsert jadwal
            const payload = {
                technician_id: techId,
                technician_name: techName,
                tanggal: tglStr,
                shift: shift,
                catatan: catatan || null,
                updated_at: new Date().toISOString()
            };
            
            const { error } = await sb.from('technician_schedules').upsert(payload, {
                onConflict: 'technician_id,tanggal'
            });
            
            if (error) throw error;
            notif('✅ Jadwal disimpan', 'success');
        }
        
        await loadScheduleData();
        renderScheduleGrid();
        updateScheduleStats();
        
    } catch(e) {
        console.error('Error save schedule:', e);
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// MODAL BULK ASSIGN (1 TEKNISI, 1 MINGGU)
// ============================================================
async function openBulkScheduleModal() {
    if (!techs || techs.length === 0) {
        Swal.fire('Info', 'Belum ada teknisi', 'info');
        return;
    }
    
    const techOptions = techs.map(t => 
        `<option value="${t.id}" data-nama="${t.name}">${t.name} (${t.posisi || 'PSB/GGN'})</option>`
    ).join('');
    
    const result = await Swal.fire({
        title: '📅 Assign Jadwal Massal',
        width: 620,
        html: `
            <div style="text-align:left;font-size:14px;">
                <div style="background:#eff6ff;padding:12px 16px;border-radius:10px;margin-bottom:16px;border-left:4px solid #2563eb;font-size:12px;color:#1e40af;">
                    💡 Assign 1 teknisi untuk beberapa hari sekaligus.
                </div>
                
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Teknisi <span style="color:#dc2626;">*</span></label>
                <select id="swalBulkTech" style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;margin-bottom:14px;">
                    <option value="">-- Pilih Teknisi --</option>
                    ${techOptions}
                </select>
                
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Pilih Hari <span style="color:#dc2626;">*</span></label>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="1"> Senin
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="2"> Selasa
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="3"> Rabu
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="4"> Kamis
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="5"> Jumat
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="6"> Sabtu
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f8fafc;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;font-size:12px;">
                        <input type="checkbox" class="bulk-hari" value="0"> Minggu
                    </label>
                </div>
                
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Shift <span style="color:#dc2626;">*</span></label>
                <select id="swalBulkShift" style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;margin-bottom:14px;">
                    <option value="pagi">🌅 Pagi (07:00 - 15:00)</option>
                    <option value="siang">☀️ Siang (15:00 - 23:00)</option>
                    <option value="malam">🌙 Malam (23:00 - 07:00)</option>
                    <option value="standby">🟢 Standby (On-Call)</option>
                    <option value="cuti">🏖️ Cuti</option>
                    <option value="izin">📋 Izin</option>
                    <option value="libur">💤 Libur</option>
                </select>
                
                <label style="display:block;font-weight:600;margin-bottom:6px;color:#1e293b;">Catatan</label>
                <input id="swalBulkNote" type="text" placeholder="Opsional"
                    style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '💾 Assign',
        cancelButtonText: '✕ Batal',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
    const techId = document.getElementById('swalBulkTech').value;
    const hariSelected = Array.from(document.querySelectorAll('.bulk-hari:checked')).map(c => parseInt(c.value));
    const shift = document.getElementById('swalBulkShift').value;
    const catatan = document.getElementById('swalBulkNote').value.trim();
    
    if (!techId) { Swal.showValidationMessage('⚠️ Pilih teknisi dulu!'); return false; }
    if (hariSelected.length === 0) { Swal.showValidationMessage('⚠️ Pilih minimal 1 hari!'); return false; }
    
    // ✅ UUID: pakai string langsung, bukan parseInt
    const techObj = techs.find(t => String(t.id) === String(techId));
    
    if (!techObj) {
        Swal.showValidationMessage('⚠️ Teknisi tidak ditemukan. Refresh halaman dulu.');
        return false;
    }
    
    return { 
        techId: techId,  // UUID string
        techName: techObj.name, 
        hariSelected, 
        shift, 
        catatan 
    };
}
    });
    
    if (!result.isConfirmed) return;
    
    const { techId, techName, hariSelected, shift, catatan } = result.value;
    
    try {
        // Buat array tanggal dari hari yang dipilih
        const payloads = [];
        hariSelected.forEach(dayNum => {
            // Cari tanggal untuk hari ini di minggu aktif
            for (let i = 0; i < 7; i++) {
                const d = new Date(scheduleWeekStart);
                d.setDate(d.getDate() + i);
                if (d.getDay() === dayNum) {
                    payloads.push({
                        technician_id: techId,
                        technician_name: techName,
                        tanggal: formatDateStr(d),
                        shift: shift,
                        catatan: catatan || null,
                        updated_at: new Date().toISOString()
                    });
                    break;
                }
            }
        });
        
        if (payloads.length === 0) {
            Swal.fire('Error', 'Tidak ada tanggal valid', 'error');
            return;
        }
        
        const { error } = await sb.from('technician_schedules').upsert(payloads, {
            onConflict: 'technician_id,tanggal'
        });
        
        if (error) throw error;
        
        notif(`✅ Jadwal ${techName} disimpan untuk ${payloads.length} hari`, 'success');
        
        await loadScheduleData();
        renderScheduleGrid();
        updateScheduleStats();
        
    } catch(e) {
        console.error('Error bulk schedule:', e);
        Swal.fire('Gagal', e.message, 'error');
    }
}

// ============================================================
// GLOBAL SEARCH
// ============================================================

let globalSearchTimeout = null;

function handleGlobalSearch(keyword) {
    // Debounce biar tidak spam
    if (globalSearchTimeout) clearTimeout(globalSearchTimeout);
    
    const hasil = document.getElementById('globalSearchResults');
    if (!hasil) return;
    
    const kw = (keyword || '').trim().toLowerCase();
    
    // Kalau kosong, sembunyikan dropdown
    if (kw.length < 2) {
        hasil.style.display = 'none';
        hasil.innerHTML = '';
        return;
    }
    
    hasil.style.display = 'block';
    hasil.innerHTML = '<div class="gs-loading">🔍 Mencari...</div>';
    
    globalSearchTimeout = setTimeout(() => {
        performGlobalSearch(kw);
    }, 250);
}

async function performGlobalSearch(kw) {
    const hasil = document.getElementById('globalSearchResults');
    if (!hasil) return;
    
    const results = {
        tiket: [],
        pelanggan: [],
        teknisi: [],
        inventaris: []
    };
    
    // ========== 1. CARI TIKET ==========
    try {
        const tiketMatches = tickets.filter(t => {
            return (t.ticketid || '').toLowerCase().includes(kw) ||
                   (t.customer || '').toLowerCase().includes(kw) ||
                   (t.kodePelanggan || '').toLowerCase().includes(kw) ||
                   (t.odppelanggan || '').toLowerCase().includes(kw) ||
                   (t.jenisgangguan || '').toLowerCase().includes(kw) ||
                   (t.technicians || []).join(' ').toLowerCase().includes(kw);
        }).slice(0, 8);
        
        results.tiket = tiketMatches;
    } catch(e) { console.warn('Search tiket error:', e); }
    
    // ========== 2. CARI PELANGGAN (dari cache kalau ada) ==========
    try {
        let pelangganList = pelangganData;
        if (!pelangganList || pelangganList.length === 0) {
            const cached = localStorage.getItem('pelanggan_cache');
            if (cached) pelangganList = JSON.parse(cached);
        }
        
        if (pelangganList && pelangganList.length > 0) {
            const pelMatches = pelangganList.filter(p => {
                return (p.nama || '').toLowerCase().includes(kw) ||
                       (p.id_pelanggan || '').toLowerCase().includes(kw) ||
                       (p.no_hp || '').toLowerCase().includes(kw) ||
                       (p.odp || '').toLowerCase().includes(kw) ||
                       (p.alamat || '').toLowerCase().includes(kw);
            }).slice(0, 8);
            results.pelanggan = pelMatches;
        } else {
            // Fetch dari Supabase kalau cache kosong
            const { data } = await sb.from('pelanggan')
                .select('id, id_pelanggan, nama, no_hp, odp, alamat, sumber')
                .or(`nama.ilike.%${kw}%,id_pelanggan.ilike.%${kw}%,no_hp.ilike.%${kw}%,odp.ilike.%${kw}%`)
                .limit(8);
            results.pelanggan = data || [];
        }
    } catch(e) { console.warn('Search pelanggan error:', e); }
    
    // ========== 3. CARI TEKNISI ==========
    try {
        const techMatches = techs.filter(t => {
            return (t.name || '').toLowerCase().includes(kw) ||
                   (t.phone || '').toLowerCase().includes(kw) ||
                   (t.posisi || '').toLowerCase().includes(kw);
        }).slice(0, 5);
        results.teknisi = techMatches;
    } catch(e) { console.warn('Search teknisi error:', e); }
    
    // ========== 4. CARI INVENTARIS (kalau invItems ada) ==========
    try {
        if (typeof invItems !== 'undefined' && invItems && invItems.length > 0) {
            const invMatches = invItems.filter(i => {
                return (i.nama_barang || '').toLowerCase().includes(kw) ||
                       (i.kode_barang || '').toLowerCase().includes(kw) ||
                       (i.kategori || '').toLowerCase().includes(kw);
            }).slice(0, 5);
            results.inventaris = invMatches;
        }
    } catch(e) { console.warn('Search inventaris error:', e); }
    
    // ========== RENDER HASIL ==========
    renderGlobalSearchResults(results, kw);
}

function renderGlobalSearchResults(results, kw) {
    const container = document.getElementById('globalSearchResults');
    if (!container) return;
    
    const totalResults = results.tiket.length + results.pelanggan.length + results.teknisi.length + results.inventaris.length;
    
    if (totalResults === 0) {
        container.innerHTML = `
            <div class="gs-empty">
                <div style="font-size:32px;margin-bottom:8px;">🔍</div>
                Tidak ada hasil untuk "<strong>${escapeHtml(kw)}</strong>"
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // ===== TIKET =====
    if (results.tiket.length > 0) {
        html += `<div class="gs-category">📋 Tiket (${results.tiket.length})</div>`;
        results.tiket.forEach(t => {
            const jenisTiket = t.jenistiket || '-';
            let iconBg = '#dbeafe';
            let iconColor = '#2563eb';
            let iconEmoji = '📋';
            
            if (jenisTiket === 'PSB') { iconBg = '#d1fae5'; iconColor = '#059669'; iconEmoji = '🔌'; }
            else if (jenisTiket === 'GAMAS') { iconBg = '#fee2e2'; iconColor = '#dc2626'; iconEmoji = '🚨'; }
            else if (jenisTiket === 'PROJECT') { iconBg = '#ede9fe'; iconColor = '#8b5cf6'; iconEmoji = '📐'; }
            else if (jenisTiket === 'MIGRASI') { iconBg = '#cffafe'; iconColor = '#0891b2'; iconEmoji = '🔄'; }
            else if (jenisTiket === 'LAINNYA') { iconBg = '#f1f5f9'; iconColor = '#64748b'; iconEmoji = '📝'; }
            
            const statusIcon = t.status === 'close' ? '✅' : t.status === 'pending' ? '⏸' : '🔴';
            
            html += `<div class="gs-item" onclick="openSearchResult('ticket', '${t.id}')">
                <div class="gs-icon" style="background:${iconBg};color:${iconColor};">${iconEmoji}</div>
                <div class="gs-content">
                    <div class="gs-title">${escapeHtml(t.ticketid || '-')} ${statusIcon}</div>
                    <div class="gs-subtitle">${escapeHtml(t.customer || '-')} • ${escapeHtml(t.jenisgangguan || '-')} • ${escapeHtml((t.technicians || []).join(', ') || '-')}</div>
                </div>
            </div>`;
        });
    }
    
    // ===== PELANGGAN =====
    if (results.pelanggan.length > 0) {
        html += `<div class="gs-category">👤 Pelanggan (${results.pelanggan.length})</div>`;
        results.pelanggan.forEach(p => {
            const sumber = p.sumber || '-';
            let iconBg = '#dbeafe', iconColor = '#2563eb';
            if (sumber === 'MIGRASI') { iconBg = '#cffafe'; iconColor = '#0891b2'; }
            else if (sumber === 'PSB') { iconBg = '#d1fae5'; iconColor = '#059669'; }
            
            html += `<div class="gs-item" onclick="openSearchResult('pelanggan', '${p.id}')">
                <div class="gs-icon" style="background:${iconBg};color:${iconColor};"><i class="fas fa-user"></i></div>
                <div class="gs-content">
                    <div class="gs-title">${escapeHtml(p.nama || '-')}</div>
                    <div class="gs-subtitle">${escapeHtml(p.id_pelanggan || '-')} • ${escapeHtml(p.no_hp || '-')} • ${escapeHtml(p.odp || '-')}</div>
                </div>
            </div>`;
        });
    }
    
    // ===== TEKNISI =====
    if (results.teknisi.length > 0) {
        html += `<div class="gs-category">👨‍🔧 Teknisi (${results.teknisi.length})</div>`;
        results.teknisi.forEach(t => {
            const posisi = t.posisi || 'PSB/GGN';
            let iconBg = '#dbeafe', iconColor = '#2563eb';
            if (posisi === 'BACKBONE') { iconBg = '#fef3c7'; iconColor = '#92400e'; }
            
            html += `<div class="gs-item" onclick="openSearchResult('teknisi', '${t.id}')">
                <div class="gs-icon" style="background:${iconBg};color:${iconColor};"><i class="fas fa-user-cog"></i></div>
                <div class="gs-content">
                    <div class="gs-title">${escapeHtml(t.name || '-')}</div>
                    <div class="gs-subtitle">${escapeHtml(posisi)} • ${escapeHtml(t.phone || '-')}</div>
                </div>
            </div>`;
        });
    }
    
    // ===== INVENTARIS =====
    if (results.inventaris.length > 0) {
        html += `<div class="gs-category">📦 Inventaris (${results.inventaris.length})</div>`;
        results.inventaris.forEach(i => {
            const stok = parseInt(i.stok_saat_ini) || 0;
            const min = parseInt(i.stok_minimum) || 0;
            const isLow = stok <= min;
            const iconColor = isLow ? '#dc2626' : '#059669';
            const iconBg = isLow ? '#fee2e2' : '#d1fae5';
            
            html += `<div class="gs-item" onclick="openSearchResult('inventaris', '${i.id}')">
                <div class="gs-icon" style="background:${iconBg};color:${iconColor};"><i class="fas fa-box"></i></div>
                <div class="gs-content">
                    <div class="gs-title">${escapeHtml(i.nama_barang || '-')}</div>
                    <div class="gs-subtitle">${escapeHtml(i.kode_barang || '-')} • Stok: ${stok} ${escapeHtml(i.satuan || '')}${isLow ? ' ⚠️' : ''}</div>
                </div>
            </div>`;
        });
    }
    
    // ===== FOOTER =====
    html += `<div style="padding:10px 16px;text-align:center;font-size:11px;color:#94a3b8;background:#f8fafc;border-top:1px solid #f1f5f9;border-radius:0 0 14px 14px;">
        Total: ${totalResults} hasil untuk "${escapeHtml(kw)}"
    </div>`;
    
    container.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function openSearchResult(type, id) {
    // Sembunyikan dropdown
    const hasil = document.getElementById('globalSearchResults');
    if (hasil) {
        hasil.style.display = 'none';
        hasil.innerHTML = '';
    }
    const input = document.getElementById('globalSearch');
    if (input) input.value = '';
    
    // ===== TIKET =====
    if (type === 'ticket') {
        switchTab('tickets');
        setTimeout(() => {
            const t = tickets.find(x => x.id === id);
            if (t) {
                if (t.status === 'close') {
                    showTicketDetail(t);
                } else {
                    goToTicket(id);
                }
            }
        }, 200);
        return;
    }
    
    // ===== PELANGGAN =====
    if (type === 'pelanggan') {
        switchTab('pelanggan');
        setTimeout(() => {
            const cariEl = document.getElementById('pelFilterSearch');
            if (cariEl) {
                // Fetch data pelanggan dari DB untuk dapat nama
                sb.from('pelanggan').select('nama, id_pelanggan').eq('id', id).maybeSingle().then(({ data }) => {
                    if (data) {
                        cariEl.value = data.id_pelanggan || data.nama || '';
                        renderPelanggan();
                    }
                });
            }
        }, 300);
        return;
    }
    
    // ===== TEKNISI =====
    if (type === 'teknisi') {
        switchTab('technicians');
        setTimeout(() => {
            const t = techs.find(x => String(x.id) === String(id));
            if (t) {
                Swal.fire({
                    title: '👨‍🔧 Data Teknisi',
                    html: `
                        <div style="text-align:left;font-size:14px;">
                            <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                                <strong>Nama:</strong> ${escapeHtml(t.name)}
                            </div>
                            <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                                <strong>No HP:</strong> ${escapeHtml(t.phone || '-')}
                            </div>
                            <div style="padding:8px 0;">
                                <strong>Posisi:</strong> ${escapeHtml(t.posisi || 'PSB/GGN')}
                            </div>
                        </div>
                    `,
                    confirmButtonText: 'Tutup',
                    confirmButtonColor: '#2563eb'
                });
            }
        }, 200);
        return;
    }
    
    // ===== INVENTARIS =====
    if (type === 'inventaris') {
        switchTab('inventory');
        setTimeout(() => {
            const cariEl = document.getElementById('invSearch');
            if (cariEl) {
                const item = invItems.find(x => String(x.id) === String(id));
                if (item) {
                    cariEl.value = item.kode_barang || item.nama_barang || '';
                    switchInvTab('stok');
                    renderInventoryItems();
                }
            }
        }, 300);
        return;
    }
}

// ============================================================
// TUTUP DROPDOWN KALAU KLIK DI LUAR
// ============================================================
document.addEventListener('click', function(e) {
    const searchWrap = document.querySelector('.global-search-wrap');
    const hasil = document.getElementById('globalSearchResults');
    if (searchWrap && hasil) {
        if (!searchWrap.contains(e.target)) {
            hasil.style.display = 'none';
        }
    }
});

// ============================================================
// KEYBOARD SHORTCUT: Ctrl+K untuk fokus ke search
// ============================================================
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.getElementById('globalSearch');
        if (input) {
            input.focus();
            input.select();
        }
    }
    
    // ESC untuk tutup dropdown
    if (e.key === 'Escape') {
        const hasil = document.getElementById('globalSearchResults');
        if (hasil) hasil.style.display = 'none';
    }
});

// ============================================================
// DARK MODE
// ============================================================

const THEME_KEY = 'app_theme'; // 'light', 'dark', atau 'auto'

// ============================================================
// INIT THEME — dipanggil saat app pertama load
// ============================================================
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'auto';
    applyTheme(saved, false);
    
    // Cek preferensi sistem
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const currentTheme = localStorage.getItem(THEME_KEY) || 'auto';
            if (currentTheme === 'auto') {
                applyTheme('auto', false);
            }
        });
    }
}

// ============================================================
// TOGGLE THEME — dipanggil saat tombol diklik
// ============================================================
function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) || 'auto';
    
    // Urutan: auto → light → dark → auto
    let next;
    if (current === 'auto') next = 'light';
    else if (current === 'light') next = 'dark';
    else next = 'auto';
    
    applyTheme(next, true);
    
    // Notif
    const labels = {
        'light': '☀️ Tema Terang',
        'dark': '🌙 Tema Gelap',
        'auto': '🔄 Tema Otomatis'
    };
    notif(labels[next] + ' diaktifkan', 'info');
}

// ============================================================
// APPLY THEME
// ============================================================
function applyTheme(theme, animate = true) {
    localStorage.setItem(THEME_KEY, theme);
    
    // Tentukan apakah harus dark
    let isDark = false;
    if (theme === 'dark') isDark = true;
    else if (theme === 'light') isDark = false;
    else if (theme === 'auto') {
        // Cek preferensi sistem
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            isDark = true;
        }
    }
    
    // Animasi transisi
    if (animate) {
        document.documentElement.classList.add('theme-transition');
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 350);
    }
    
    // Apply class
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Update icon tombol
    const icon = document.getElementById('themeIcon');
    const btn = document.getElementById('themeToggle');
    if (icon && btn) {
        if (theme === 'auto') {
            icon.className = 'fas fa-adjust';
            icon.style.color = isDark ? '#fbbf24' : '#475569';
            btn.title = 'Tema: Otomatis (Klik untuk Terang)';
        } else if (theme === 'light') {
            icon.className = 'fas fa-sun';
            icon.style.color = '#f59e0b';
            btn.title = 'Tema: Terang (Klik untuk Gelap)';
        } else if (theme === 'dark') {
            icon.className = 'fas fa-moon';
            icon.style.color = '#fbbf24';
            btn.title = 'Tema: Gelap (Klik untuk Otomatis)';
        }
    }
    
    console.log('🎨 Theme applied:', theme, isDark ? '(dark)' : '(light)');
}

// ============================================================
// SHORTCUT: Ctrl+Shift+L untuk toggle tema
// ============================================================
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleTheme();
    }
});

// ============================================================
// TICKET HISTORY — TIMELINE AUDIT
// ============================================================

// ============================================================
// SIMPAN HISTORY PERUBAHAN TIKET
// ============================================================
async function logTicketHistory(ticketId, action, options = {}) {
    try {
        const payload = {
            ticket_id: ticketId,
            action: action,
            field_changed: options.field || null,
            old_value: options.oldValue !== undefined ? String(options.oldValue) : null,
            new_value: options.newValue !== undefined ? String(options.newValue) : null,
            description: options.description || getHistoryDescription(action, options),
            user_action: (JSON.parse(localStorage.getItem('user_session') || '{}').username) || 'admin'
        };
        
        const { error } = await sb.from('ticket_history').insert(payload);
        if (error) throw error;
        
        console.log('📝 History saved:', action, '→', ticketId);
    } catch(e) {
        console.error('Gagal simpan history:', e);
    }
}

// ============================================================
// DESKRIPSI OTOMATIS DARI ACTION
// ============================================================
function getHistoryDescription(action, options = {}) {
    const map = {
        'create': `🎫 Tiket dibuat`,
        'close': `✅ Tiket ditutup`,
        'pending': `⏸️ Tiket di-pending`,
        'resume': `▶️ Tiket dilanjutkan`,
        'update_status': `🔄 Status diubah: ${options.oldValue || '-'} → ${options.newValue || '-'}`,
        'update_tech': `👨‍🔧 Teknisi diubah`,
        'add_tech': `➕ Teknisi ditambah`,
        'remove_tech': `➖ Teknisi dihapus`,
        'update_gangguan': `⚠️ Jenis gangguan diubah: "${options.oldValue || '-'}" → "${options.newValue || '-'}"`,
        'update_perbaikan': `🛠️ Jenis perbaikan diubah: "${options.oldValue || '-'}" → "${options.newValue || '-'}"`,
        'update_keterangan': `📝 Keterangan diubah`,
        'update_close_time': `🕐 Waktu close diubah`,
        'update_duration': `⏱️ Durasi diubah: ${options.oldValue || '-'} → ${options.newValue || '-'}`,
        'inventory_used': `📦 Barang dipakai: ${options.newValue || '-'}`
    };
    return map[action] || action;
}

// ============================================================
// ICON & WARNA PER ACTION
// ============================================================
function getHistoryIcon(action) {
    const map = {
        'create': { icon: 'fa-plus-circle', color: '#2563eb', bg: '#dbeafe' },
        'close': { icon: 'fa-check-circle', color: '#16a34a', bg: '#dcfce7' },
        'pending': { icon: 'fa-pause-circle', color: '#f59e0b', bg: '#fef3c7' },
        'resume': { icon: 'fa-play-circle', color: '#0891b2', bg: '#cffafe' },
        'update_status': { icon: 'fa-sync', color: '#8b5cf6', bg: '#ede9fe' },
        'update_tech': { icon: 'fa-user-cog', color: '#2563eb', bg: '#dbeafe' },
        'add_tech': { icon: 'fa-user-plus', color: '#16a34a', bg: '#dcfce7' },
        'remove_tech': { icon: 'fa-user-minus', color: '#dc2626', bg: '#fee2e2' },
        'update_gangguan': { icon: 'fa-exclamation-triangle', color: '#f59e0b', bg: '#fef3c7' },
        'update_perbaikan': { icon: 'fa-tools', color: '#16a34a', bg: '#dcfce7' },
        'update_keterangan': { icon: 'fa-edit', color: '#64748b', bg: '#f1f5f9' },
        'update_close_time': { icon: 'fa-clock', color: '#dc2626', bg: '#fee2e2' },
        'update_duration': { icon: 'fa-hourglass-half', color: '#8b5cf6', bg: '#ede9fe' },
        'inventory_used': { icon: 'fa-box-open', color: '#7c3aed', bg: '#f5f3ff' }
    };
    return map[action] || { icon: 'fa-info-circle', color: '#64748b', bg: '#f1f5f9' };
}

// ============================================================
// LOAD & RENDER TIMELINE DI DETAIL TIKET
// ============================================================
async function loadTicketHistory(ticketId) {
    const container = document.getElementById('ticketHistoryContainer_' + ticketId);
    if (!container) return;

    try {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        const { data, error } = await sb
            .from('ticket_history')
            .select('*')
            .eq('ticket_id', ticket.ticketid)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="background:#f8fafc;padding:20px;border-radius:12px;text-align:center;color:#94a3b8;font-size:13px;">
                    <i class="fas fa-history" style="font-size:24px;margin-bottom:8px;opacity:0.5;"></i><br>
                    Belum ada riwayat perubahan
                </div>
            `;
            return;
        }

        let html = `
            <div style="background:#f5f3ff;padding:16px 20px;border-radius:12px;border:1px solid #c4b5fd;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-history" style="color:#7c3aed;font-size:18px;"></i>
                        <div style="font-size:12px;color:#5b21b6;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                            Riwayat Perubahan
                        </div>
                    </div>
                    <span style="background:white;color:#5b21b6;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid #c4b5fd;">
                        ${data.length} aktivitas
                    </span>
                </div>

                <div style="background:white;border-radius:10px;padding:16px 18px;max-height:400px;overflow-y:auto;">
                    <div style="position:relative;padding-left:28px;">
                        <!-- Vertical line -->
                        <div style="position:absolute;left:9px;top:10px;bottom:10px;width:2px;background:#e2e8f0;"></div>
        `;

        data.forEach((h, i) => {
            const meta = getHistoryIcon(h.action);
            const tanggal = h.created_at ? new Date(h.created_at) : null;
            const tglFull = tanggal ? tanggal.toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }) : '-';
            
            // Format: "14 Okt 2025 • 14:32:15"
            const tglFmt = tanggal ? (() => {
                const d = tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                const t = tanggal.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return `${d} • ${t}`;
            })() : '-';

            html += `
                <div style="position:relative;padding-bottom:16px;">
                    <div style="position:absolute;left:-28px;top:0;width:20px;height:20px;border-radius:50%;background:${meta.bg};border:3px solid white;box-shadow:0 0 0 2px ${meta.color};display:flex;align-items:center;justify-content:center;">
                        <i class="fas ${meta.icon}" style="font-size:9px;color:${meta.color};"></i>
                    </div>
                    <div style="padding-left:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
                            <div style="font-weight:600;color:#0b1a33;font-size:13px;">${escapeHtml(h.description || h.action)}</div>
                            <div style="font-size:10px;color:#94a3b8;font-weight:500;white-space:nowrap;" title="${tglFull}">${tglFmt}</div>
                        </div>
                        ${h.field_changed && h.old_value !== null && h.new_value !== null && h.action !== 'update_gangguan' && h.action !== 'update_perbaikan' ? `
                            <div style="background:#f8fafc;padding:6px 10px;border-radius:6px;margin-top:6px;font-size:11px;">
                                <span style="color:#64748b;">Field:</span>
                                <strong style="color:#0b1a33;">${escapeHtml(h.field_changed)}</strong>
                                ${h.old_value !== 'null' && h.old_value !== '' ? `<br><span style="color:#dc2626;">Sebelum: <span style="font-family:monospace;">${escapeHtml(String(h.old_value).substring(0, 80))}${String(h.old_value).length > 80 ? '...' : ''}</span></span>` : ''}
                                ${h.new_value !== 'null' && h.new_value !== '' ? `<br><span style="color:#16a34a;">Sesudah: <span style="font-family:monospace;">${escapeHtml(String(h.new_value).substring(0, 80))}${String(h.new_value).length > 80 ? '...' : ''}</span></span>` : ''}
                            </div>
                        ` : ''}
                        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
                            <i class="fas fa-user" style="margin-right:4px;"></i>${escapeHtml(h.user_action || 'admin')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch(e) {
        console.error('Error load ticket history:', e);
        container.innerHTML = `
            <div style="background:#fee2e2;padding:12px 16px;border-radius:10px;color:#dc2626;font-size:13px;">
                <i class="fas fa-exclamation-triangle"></i> Gagal load riwayat: ${e.message}
            </div>
        `;
    }
}



// ============================================================
// FORMAT RELATIVE TIME (contoh: "5 menit lalu")
// ============================================================
function formatRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // detik

    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';

    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
// ACTIVITY LOG — AUDIT TRAIL GLOBAL
// ============================================================

let logCurrentPage = 1;
const logPerPage = 25;

// ============================================================
// SIMPAN LOG AKTIVITAS
// ============================================================
async function logActivity(action, options = {}) {
    try {
        const session = JSON.parse(localStorage.getItem('user_session') || '{}');
        
        const payload = {
            user_id: session.username || 'unknown',
            username: session.username || 'unknown',
            action: action.toUpperCase(),
            table_name: options.table || null,
            record_id: options.recordId || null,
            description: options.description || null,
            old_value: options.oldValue ? JSON.stringify(options.oldValue) : null,
            new_value: options.newValue ? JSON.stringify(options.newValue) : null,
            ip_address: null,
            user_agent: navigator.userAgent ? navigator.userAgent.substring(0, 200) : null
        };
        
        const { error } = await sb.from('activity_log').insert(payload);
        if (error) throw error;
        
        console.log('📋 Log saved:', action, options.table || '');
    } catch(e) {
        console.error('Gagal simpan log:', e);
    }
}

// ============================================================
// RENDER HALAMAN LOG AKTIVITAS
// ============================================================
async function renderActivityLog() {
    await loadActivityStats();
    await fillLogUserFilter();
    await renderActivityLogTable();
}

// ============================================================
// STATISTIK LOG
// ============================================================
async function loadActivityStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Total hari ini
        const { count: todayCount } = await sb.from('activity_log')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());
        
        // Total 7 hari
        const { count: weekCount } = await sb.from('activity_log')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', weekAgo.toISOString());
        
        // Total semua
        const { count: allCount } = await sb.from('activity_log')
            .select('*', { count: 'exact', head: true });
        
        // User aktif (unik)
        const { data: userData } = await sb.from('activity_log')
            .select('username')
            .gte('created_at', weekAgo.toISOString());
        
        const uniqueUsers = new Set((userData || []).map(u => u.username).filter(Boolean));
        
        document.getElementById('logTotalToday').textContent = todayCount || 0;
        document.getElementById('logTotalWeek').textContent = weekCount || 0;
        document.getElementById('logTotalUser').textContent = uniqueUsers.size;
        document.getElementById('logTotalAll').textContent = allCount || 0;
        
    } catch(e) {
        console.error('Error load stats:', e);
    }
}

// ============================================================
// ISI DROPDOWN FILTER USER
// ============================================================
async function fillLogUserFilter() {
    const selectEl = document.getElementById('logFilterUser');
    if (!selectEl) return;
    
    try {
        const { data } = await sb.from('activity_log')
            .select('username')
            .order('username');
        
        const users = [...new Set((data || []).map(u => u.username).filter(Boolean))].sort();
        const currentVal = selectEl.value;
        
        selectEl.innerHTML = '<option value="all">Semua User</option>' +
            users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
        
        selectEl.value = currentVal || 'all';
    } catch(e) {
        console.error('Error fill user filter:', e);
    }
}

// ============================================================
// RENDER TABEL LOG
// ============================================================
async function renderActivityLogTable() {
    const body = document.getElementById('activityLogBody');
    if (!body) return;

    const dateFrom = document.getElementById('logFilterDateFrom')?.value || '';
    const dateTo = document.getElementById('logFilterDateTo')?.value || '';
    const userFilter = document.getElementById('logFilterUser')?.value || 'all';
    const actionFilter = document.getElementById('logFilterAction')?.value || 'all';
    const tableFilter = document.getElementById('logFilterTable')?.value || 'all';
    const searchQuery = (document.getElementById('logFilterSearch')?.value || '').toLowerCase().trim();

    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">Memuat data...</td></tr>';

    try {
        let query = sb.from('activity_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
        if (userFilter !== 'all') query = query.eq('username', userFilter);
        if (actionFilter !== 'all') query = query.eq('action', actionFilter);
        if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
        if (searchQuery) query = query.ilike('description', `%${searchQuery}%`);

        const from = (logCurrentPage - 1) * logPerPage;
        const to = from + logPerPage - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        document.getElementById('logCount').textContent = (count || 0) + ' aktivitas';

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">Tidak ada log aktivitas</td></tr>';
            document.getElementById('activityLogPagination').innerHTML = '';
            return;
        }

        body.innerHTML = data.map(log => {
            const tgl = new Date(log.created_at).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            const actionMeta = getLogActionMeta(log.action);
            const tableLabel = getLogTableLabel(log.table_name);

            return `<tr>
                <td style="font-size:12px;color:#475569;">${tgl}</td>
                <td><strong>${escapeHtml(log.username || '-')}</strong></td>
                <td style="text-align:center;">
                    <span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:${actionMeta.bg};color:${actionMeta.color};">
                        <i class="fas ${actionMeta.icon}" style="margin-right:3px;"></i>${log.action}
                    </span>
                </td>
                <td style="font-size:12px;">${tableLabel}</td>
                <td style="font-size:12px;color:#0b1a33;">${escapeHtml(log.description || '-')}</td>
                <td style="text-align:center;">
                    ${(log.old_value || log.new_value) ? `
                        <button class="btn btn-outline btn-sm" onclick="showLogDetail(${log.id})" style="padding:2px 10px;font-size:11px;">
                            <i class="fas fa-eye"></i>
                        </button>
                    ` : '<span style="color:#94a3b8;">-</span>'}
                </td>
            </tr>`;
        }).join('');

        // Pagination
        const totalPages = Math.ceil(count / logPerPage);
        let pagHtml = '';
        if (totalPages > 1) {
            pagHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
            if (logCurrentPage > 1) pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToLogPage(${logCurrentPage - 1})">◀ Prev</button>`;
            const startPage = Math.max(1, logCurrentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);
            for (let i = startPage; i <= endPage; i++) {
                const active = i === logCurrentPage ? 'btn-primary' : 'btn-outline';
                pagHtml += `<button class="btn ${active} btn-sm" onclick="goToLogPage(${i})">${i}</button>`;
            }
            if (logCurrentPage < totalPages) pagHtml += `<button class="btn btn-outline btn-sm" onclick="goToLogPage(${logCurrentPage + 1})">Next ▶</button>`;
            pagHtml += '</div>';
            pagHtml += `<span style="font-size:13px;color:#64748b;">Menampilkan ${from + 1}-${Math.min(from + logPerPage, count)} dari ${count}</span>`;
        }
        document.getElementById('activityLogPagination').innerHTML = pagHtml;

    } catch(e) {
        console.error('Error render log:', e);
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#dc2626;">Gagal load data: ' + e.message + '</td></tr>';
    }
}

function getLogActionMeta(action) {
    const map = {
        'LOGIN': { icon: 'fa-sign-in-alt', bg: '#dcfce7', color: '#166534' },
        'LOGOUT': { icon: 'fa-sign-out-alt', bg: '#fef3c7', color: '#92400e' },
        'CREATE': { icon: 'fa-plus-circle', bg: '#dbeafe', color: '#1e40af' },
        'UPDATE': { icon: 'fa-edit', bg: '#ede9fe', color: '#6d28d9' },
        'DELETE': { icon: 'fa-trash', bg: '#fee2e2', color: '#991b1b' },
        'VIEW': { icon: 'fa-eye', bg: '#f1f5f9', color: '#475569' },
        'EXPORT': { icon: 'fa-download', bg: '#cffafe', color: '#0e7490' }
    };
    return map[action] || { icon: 'fa-circle', bg: '#f1f5f9', color: '#64748b' };
}

function getLogTableLabel(table) {
    const map = {
        'tickets': '📋 Tiket',
        'pelanggan': '👤 Pelanggan',
        'technicians': '👨‍🔧 Teknisi',
        'inventory_items': '📦 Inventaris',
        'inventory_transactions': '📦 Transaksi Stok',
        'app_settings': '⚙️ Pengaturan',
        'users': '🔐 User',
        'technician_schedules': '📅 Jadwal'
    };
    return map[table] || (table || '-');
}

function goToLogPage(page) {
    logCurrentPage = page;
    renderActivityLogTable();
    window.scrollTo(0, 0);
}

function resetLogFilter() {
    const el1 = document.getElementById('logFilterDateFrom');
    const el2 = document.getElementById('logFilterDateTo');
    const el3 = document.getElementById('logFilterUser');
    const el4 = document.getElementById('logFilterAction');
    const el5 = document.getElementById('logFilterTable');
    const el6 = document.getElementById('logFilterSearch');
    if (el1) el1.value = '';
    if (el2) el2.value = '';
    if (el3) el3.value = 'all';
    if (el4) el4.value = 'all';
    if (el5) el5.value = 'all';
    if (el6) el6.value = '';
    logCurrentPage = 1;
    renderActivityLogTable();
}

// ============================================================
// MODAL DETAIL LOG
// ============================================================
async function showLogDetail(logId) {
    const { data, error } = await sb.from('activity_log').select('*').eq('id', logId).maybeSingle();
    if (error || !data) {
        Swal.fire('Error', 'Log tidak ditemukan', 'error');
        return;
    }

    let oldVal = data.old_value;
    let newVal = data.new_value;

    try { oldVal = data.old_value ? JSON.parse(data.old_value) : null; } catch(e) {}
    try { newVal = data.new_value ? JSON.parse(data.new_value) : null; } catch(e) {}

    const formatVal = (val) => {
        if (val === null || val === undefined) return '<em style="color:#94a3b8;">-</em>';
        if (typeof val === 'object') {
            return '<pre style="background:#f8fafc;padding:10px;border-radius:6px;font-size:11px;max-height:200px;overflow:auto;border:1px solid #e2e8f0;white-space:pre-wrap;word-break:break-word;">' + escapeHtml(JSON.stringify(val, null, 2)) + '</pre>';
        }
        return escapeHtml(String(val));
    };

    Swal.fire({
        title: '📋 Detail Log',
        width: 650,
        html: `
            <div style="text-align:left;font-size:13px;">
                <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;margin-bottom:14px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div><span style="color:#64748b;">Waktu:</span> <strong>${new Date(data.created_at).toLocaleString('id-ID')}</strong></div>
                        <div><span style="color:#64748b;">User:</span> <strong>${escapeHtml(data.username || '-')}</strong></div>
                        <div><span style="color:#64748b;">Aksi:</span> <strong>${escapeHtml(data.action)}</strong></div>
                        <div><span style="color:#64748b;">Tabel:</span> <strong>${escapeHtml(data.table_name || '-')}</strong></div>
                    </div>
                    ${data.description ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;">Keterangan:</span><br><strong>${escapeHtml(data.description)}</strong></div>` : ''}
                </div>
                
                ${oldVal ? `
                    <div style="margin-bottom:12px;">
                        <div style="font-weight:700;color:#dc2626;margin-bottom:6px;">🔴 Data Sebelum</div>
                        ${formatVal(oldVal)}
                    </div>
                ` : ''}
                
                ${newVal ? `
                    <div style="margin-bottom:12px;">
                        <div style="font-weight:700;color:#16a34a;margin-bottom:6px;">🟢 Data Sesudah</div>
                        ${formatVal(newVal)}
                    </div>
                ` : ''}
            </div>
        `,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb'
    });
}

// ============================================================
// DRAG TO SCROLL — TANPA BLOK KLIK
// Klik tetap jalan, drag tetap jalan
// ============================================================
(function() {
    'use strict';

    const DRAG_THRESHOLD = 8; // px — di atas ini baru dianggap drag
    let isDown = false;
    let hasMoved = false;
    let startX = 0;
    let startScroll = 0;
    let currentWrap = null;

    document.body.addEventListener('mousedown', function(e) {
        const wrap = e.target.closest('.table-wrap');
        if (!wrap) return;

        // Skip kalau klik tombol/link/input
        if (e.target.closest('button, a, input, select, textarea, label, .btn')) return;

        // Cek bisa di-scroll
        if (wrap.scrollWidth <= wrap.clientWidth) return;

        isDown = true;
        hasMoved = false;
        currentWrap = wrap;
        startX = e.pageX;
        startScroll = wrap.scrollLeft;
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDown || !currentWrap) return;

        const walk = e.pageX - startX;

        if (Math.abs(walk) > DRAG_THRESHOLD) {
            if (!hasMoved) {
                hasMoved = true;
                currentWrap.style.cursor = 'grabbing';
                currentWrap.style.userSelect = 'none';
            }
            currentWrap.scrollLeft = startScroll - walk;
            e.preventDefault();
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (!isDown) return;

        const wasMoved = hasMoved;
        const wrap = currentWrap;

        isDown = false;
        currentWrap = null;

        if (wrap) {
            wrap.style.cursor = '';
            wrap.style.userSelect = '';
        }

        // KALAU TADI DRAG → BATALKAN KLIK BERIKUTNYA
        if (wasMoved) {
            const blockClick = function(ev) {
                ev.stopPropagation();
                ev.preventDefault();
                document.removeEventListener('click', blockClick, true);
            };
            document.addEventListener('click', blockClick, true);
            setTimeout(function() {
                document.removeEventListener('click', blockClick, true);
            }, 50);
        }

        hasMoved = false;
    });

    console.log('✅ Drag to scroll aktif (klik tetap jalan)');
})();

// ============================================================
// DRAG TO SCROLL — TABEL
// ============================================================
(function() {
    let isDown = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let wrap = null;
    const THRESHOLD = 6;

    function onDown(e) {
        const w = e.target.closest('.table-wrap');
        if (!w) return;
        if (e.target.closest('button, a, input, select, textarea, label, .btn')) return;
        if (w.scrollWidth <= w.clientWidth) return;

        wrap = w;
        isDown = true;
        hasMoved = false;
        startX = e.pageX;
        startY = e.pageY;
        startScroll = w.scrollLeft;

        // ⚡ LANGSUNG MATIKAN SELEKSI
        wrap.style.userSelect = 'none';
        wrap.style.webkitUserSelect = 'none';
    }

    function onMove(e) {
        if (!isDown || !wrap) return;

        const diffX = Math.abs(e.pageX - startX);
        const diffY = Math.abs(e.pageY - startY);

        // ⚡ AKTIFKAN DRAG kalau gerak horizontal > threshold
        if (diffX > THRESHOLD && diffX > diffY) {
            hasMoved = true;
            wrap.classList.add('dragging');
            wrap.style.cursor = 'grabbing';
            wrap.scrollLeft = startScroll - (e.pageX - startX);
            e.preventDefault(); // hanya di sini, saat drag benar-benar aktif
        }
    }

    function onUp() {
        if (!isDown) return;

        const wasMoved = hasMoved;
        isDown = false;

        if (wrap) {
            wrap.classList.remove('dragging');
            wrap.style.cursor = '';
            wrap.style.userSelect = '';
            wrap.style.webkitUserSelect = '';
        }

        if (wasMoved) {
            // ⚡ BATALKAN KLIK setelah drag
            const stopClick = function(ev) {
                ev.stopPropagation();
                ev.preventDefault();
                document.removeEventListener('click', stopClick, true);
            };
            document.addEventListener('click', stopClick, true);
            setTimeout(function() {
                document.removeEventListener('click', stopClick, true);
            }, 20);
        }

        hasMoved = false;
        wrap = null;
    }

    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);

    console.log('✅ Drag scroll ready');
})();

// ============================================================
// GENERATE NOMOR TIKET OTOMATIS
// Format: {PREFIX}-{YYMM}-{NNN}
// ============================================================
function getTicketPrefix(jenisTiket) {
    const map = {
        'GGN': 'GGN',
        'PSB': 'PSB',
        'GAMAS': 'GMS',
        'PROJECT': 'PRJ',
        'MIGRASI': 'MIG',
        'LAINNYA': 'LN'
    };
    return map[jenisTiket] || 'TKT';
}

async function generateTicketId(jenisTiket) {
    const prefix = getTicketPrefix(jenisTiket);
    const now = new Date();
    const yymm = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');

    let lastNumber = 0;
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('ticketid')
            .like('ticketid', prefix + '-%')
            .order('createdAt', { ascending: false })
            .limit(100);

        if (!error && data && data.length > 0) {
            data.forEach(row => {
                const parts = (row.ticketid || '').split('-');
                if (parts.length >= 3) {
                    const num = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(num) && num > lastNumber) lastNumber = num;
                }
            });
        }
    } catch (e) {
        console.error('Gagal cek nomor tiket terakhir:', e);
    }

    const nextNumber = lastNumber + 1;
    const numStr = String(nextNumber).padStart(3, '0');

    return prefix + '-' + yymm + '-' + numStr;
}

// ============================================================
// ALL REKAP SECTION (EXECUTIVE DASHBOARD)
// ============================================================

// ============================================================
// ALL REKAP SECTION (EXECUTIVE DASHBOARD) - VERSI PERBAIKAN
// ============================================================

// ============================================================
// ALL REKAP SECTION (EXECUTIVE PRESENTATION) - VERSI LENGKAP
// ============================================================

async function renderAllRekap() {
    const section = document.getElementById('allrekapSection');
    if (!section) return;
    if (!tickets || tickets.length === 0) { setTimeout(renderAllRekap, 500); return; }

    document.getElementById('allRekapDate').textContent = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // --- HITUNG SEMUA DATA ---
    const totalTiket = tickets.length;
    const tiketsClose = tickets.filter(t => t.status === 'close').length;
    const tiketsOverdue = tickets.filter(t => (t.ttr || 0) > t.duration).length;
    const totalGamas = tickets.filter(t => (t.jenistiket || '') === 'GAMAS').length;
    const totalPSB = tickets.filter(t => (t.jenistiket || '') === 'PSB').length;
    const totalGaul = (typeof getPelangganGaul === 'function') ? getPelangganGaul().size : 0;
    
    if (!pelangganData || pelangganData.length === 0) {
        try { const { data } = await sb.from('pelanggan').select('id'); pelangganData = data || []; } catch(e) {}
    }
    const totalPelanggan = pelangganData.length;

    // --- SET ANGKA KE HTML ---
    document.getElementById('arTotalTiket').textContent = totalTiket;
    document.getElementById('arTotalPelanggan').textContent = totalPelanggan;
    document.getElementById('arTotalPSB').textContent = totalPSB;
    document.getElementById('arTotalTeknisi').textContent = techs ? techs.length : 0;
    document.getElementById('arTiketClose').textContent = tiketsClose;
    document.getElementById('arTiketOverdue').textContent = tiketsOverdue;
    document.getElementById('arTotalGamas').textContent = totalGamas;
    document.getElementById('arTotalGaul').textContent = totalGaul;

    renderAllRekapCharts();
    renderAllRekapTables();
}

function renderAllRekapCharts() {
    try {
        // A. DISTRIBUSI TIKET
        const canvasJenis = document.getElementById('arChartJenisTiket');
        if (canvasJenis) {
            const jenisCount = { 'PSB': 0, 'GGN': 0, 'GAMAS': 0, 'PROJECT': 0, 'MIGRASI': 0, 'LAINNYA': 0 };
            tickets.forEach(t => { const j = t.jenistiket || 'LAINNYA'; if (jenisCount[j] !== undefined) jenisCount[j]++; else jenisCount['LAINNYA']++; });
            if (window.arChartJenisTiketInst) window.arChartJenisTiketInst.destroy();
            window.arChartJenisTiketInst = new Chart(canvasJenis, {
                type: 'doughnut',
                data: { labels: Object.keys(jenisCount), datasets: [{ data: Object.values(jenisCount), backgroundColor: ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#94a3b8'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } }
            });
        }

        // B. STATUS TIKET
        const canvasStatus = document.getElementById('arChartStatus');
        if (canvasStatus) {
            const statusCount = { 'Open': 0, 'Close': 0, 'Pending': 0 };
            tickets.forEach(t => { if (t.status === 'open') statusCount['Open']++; else if (t.status === 'close') statusCount['Close']++; else if (t.status === 'pending') statusCount['Pending']++; });
            if (window.arChartStatusInst) window.arChartStatusInst.destroy();
            window.arChartStatusInst = new Chart(canvasStatus, {
                type: 'bar',
                data: { labels: Object.keys(statusCount), datasets: [{ label: 'Jumlah Tiket', data: Object.values(statusCount), backgroundColor: ['#f59e0b', '#22c55e', '#8b5cf6'], borderRadius: 8 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }

        // C. TOP GANGGUAN (GGN & GAMAS)
        const canvasGangguan = document.getElementById('arChartGangguan');
        if (canvasGangguan) {
            const gangCount = {};
            tickets.forEach(t => {
                if (t.jenistiket === 'GGN' || t.jenistiket === 'GAMAS') {
                    const g = t.jenisgangguan || 'Lainnya';
                    gangCount[g] = (gangCount[g] || 0) + 1;
                }
            });
            const sortedGang = Object.entries(gangCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
            if (window.arChartGangguanInst) window.arChartGangguanInst.destroy();
            window.arChartGangguanInst = new Chart(canvasGangguan, {
                type: 'bar',
                data: { labels: sortedGang.map(x=>x[0]), datasets: [{ label: 'Jumlah', data: sortedGang.map(x=>x[1]), backgroundColor: '#ef4444', borderRadius: 6 }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // D. BEBAN KERJA TEKNISI
        const canvasTeknisi = document.getElementById('arChartTeknisi');
        if (canvasTeknisi) {
            const techMap = {};
            if (techs) techs.forEach(t => techMap[t.name] = 0);
            tickets.forEach(t => { if (t.technicians) t.technicians.forEach(n => { if (techMap[n] !== undefined) techMap[n]++; }); });
            const sortedTech = Object.entries(techMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
            if (window.arChartTeknisiInst) window.arChartTeknisiInst.destroy();
            window.arChartTeknisiInst = new Chart(canvasTeknisi, {
                type: 'bar',
                data: { labels: sortedTech.map(x=>x[0]), datasets: [{ label: 'Total Tiket', data: sortedTech.map(x=>x[1]), backgroundColor: '#8b5cf6', borderRadius: 6 }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
    } catch (err) { console.error('Chart error:', err); }
}

function renderAllRekapTables() {
    // 1. TABEL GANGGUAN DETAIL
    const tbodyGang = document.getElementById('arTableGangguanBody');
    if (tbodyGang) {
        const gangCount = {};
        tickets.forEach(t => {
            if (t.jenistiket === 'GGN' || t.jenistiket === 'GAMAS') {
                const g = t.jenisgangguan || 'Lainnya';
                gangCount[g] = (gangCount[g] || 0) + 1;
            }
        });
        const sortedGang = Object.entries(gangCount).sort((a,b) => b[1] - a[1]);
        const totalGang = sortedGang.reduce((sum, item) => sum + item[1], 0);

        if (sortedGang.length === 0) {
            tbodyGang.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">Belum ada data</td></tr>';
        } else {
            tbodyGang.innerHTML = sortedGang.map(([nama, count]) => {
                const persen = totalGang > 0 ? ((count / totalGang) * 100).toFixed(1) : 0;
                return `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px; font-weight:600; color:#0b1a33;">${nama}</td>
                    <td style="padding:10px; text-align:center; font-weight:700; color:#dc2626;">${count}</td>
                    <td style="padding:10px; text-align:center; color:#475569;">${persen}%</td>
                </tr>`;
            }).join('');
        }
    }

    // 2. TABEL TOP PELANGGAN
    const tbodyCust = document.getElementById('arTopCustomerBody');
    if (tbodyCust) {
        const custMap = {};
        tickets.filter(t => (t.jenistiket || '') === 'GGN').forEach(t => {
            const c = t.customer || 'Tidak diketahui';
            if (!custMap[c]) custMap[c] = { total: 0, odp: t.odppelanggan || '-' };
            custMap[c].total++;
        });
        const sortedCust = Object.entries(custMap).sort((a,b) => b[1].total - a[1].total).slice(0, 10);

        if (sortedCust.length === 0) {
            tbodyCust.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Belum ada data</td></tr>';
        } else {
            tbodyCust.innerHTML = sortedCust.map(([nama, data], i) => {
                let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
                return `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px; text-align:center; font-weight:700;">${medal}</td>
                    <td style="padding:10px; font-weight:600; color:#0b1a33;">${nama}</td>
                    <td style="padding:10px; color:#475569;">${data.odp}</td>
                    <td style="padding:10px; text-align:center;">
                        <span style="background:#fee2e2; color:#dc2626; padding:4px 10px; border-radius:20px; font-weight:700; font-size:12px;">${data.total}</span>
                    </td>
                </tr>`;
            }).join('');
        }
    }
}

let ggnIdCounter = 0;

function goToPerbaikanPage(page) {
    localStorage.setItem('perbaikanPage', page);
    renderReports();
}
