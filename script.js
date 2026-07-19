
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

       

        // SWITCH TAB (SIDEBAR)
function switchTab(tab) {
    console.log('Switch tab ke:', tab);
    
    // Hapus active dari semua
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
        el.classList.remove('active');
    });
    
    // Aktifkan berdasarkan data-tab
    const targetNav = document.querySelector(`.sidebar .nav-item[data-tab="${tab}"]`);
    if (targetNav) targetNav.classList.add('active');
    
    // Ambil semua section
    const ticketSection = document.getElementById('ticketSection');
    const technicianSection = document.getElementById('technicianSection');
    const reportsSection = document.getElementById('reportsSection');
    
    // HIDE SEMUA
    if (ticketSection) ticketSection.style.display = 'none';
    if (technicianSection) technicianSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'none';
    
    // TAMPILKAN SESUAI TAB
    if (tab === 'tickets') {
        if (ticketSection) {
            ticketSection.style.display = 'block';
            renderTickets(null, 1);
        }
    } else if (tab === 'technicians') {
        if (technicianSection) {
            technicianSection.style.display = 'block';
            renderTechList();
            renderPerformance();
        }
    } else if (tab === 'reports') {
        if (reportsSection) {
            reportsSection.style.display = 'block';
            renderReports();
        }
    }
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
    const startDate = filteredTickets.length > 0 ? 
        new Date(filteredTickets[filteredTickets.length - 1].createdAt).toLocaleDateString('id-ID') : 
        'Tidak ada data';
    const endDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    document.getElementById('reportPeriod').textContent = `${startDate} - ${endDate}`;
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
    document.getElementById('jenisGangguanReportBody').innerHTML = gangguanHtml2;

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
    
    const sortedTech = Object.entries(techMap)
        .filter(([name, data]) => data.total > 0)
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

        // === CHART PRODUKTIVITAS TEKNISI (TOP 5) ===
    const techMap = {};
    techs.forEach(t => {
        techMap[t.name] = { total: 0, tepatWaktu: 0 };
    });
    
    ticketsData.forEach(t => {
        const techsList = t.technicians || [];
        techsList.forEach(tech => {
            if (techMap[tech]) {
                techMap[tech].total++;
                // CEK TEPAT WAKTU: CLOSE DAN TTR <= DURASI
                if (t.status === 'close') {
                    const ttr = t.ttr || 0;
                    if (ttr <= t.duration) {
                        techMap[tech].tepatWaktu++;
                    }
                }
            }
        });
    });
    
    const sortedTech = Object.entries(techMap)
        .filter(([name, data]) => data.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5);
    
    const techLabels = sortedTech.map(t => t[0]);
    // PRODUKTIVITAS = (TEPAT WAKTU / TOTAL) * 100
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const filteredTickets = tickets.filter(t => {
            const tDate = new Date(t.createdAt);
            return tDate >= thirtyDaysAgo;
        });

        if (filteredTickets.length === 0) {
            Swal.fire('Info', 'Tidak ada data 30 hari terakhir!', 'info');
            return;
        }

        const wb = XLSX.utils.book_new();

        // --- SHEET 1: DATA TIKET (TAMBAH JENIS PERBAIKAN) ---
        const data1 = [
            ['LAPORAN GANGGUAN HELPDESK PRO'],
            ['Periode:', thirtyDaysAgo.toLocaleDateString('id-ID'), '-', new Date().toLocaleDateString('id-ID')],
            ['Total Tiket:', filteredTickets.length],
            [],
            ['DATA TIKET'],
            ['No', 'Tanggal', 'ID Tiket', 'Customer', 'Jenis Gangguan', 'Teknisi', 'Durasi (Menit)', 'TTR (Menit)', 'Status', 'Keterangan', 'Jenis Perbaikan']
        ];

        filteredTickets.forEach((t, i) => {
            data1.push([
                i + 1,
                new Date(t.createdAt).toLocaleString('id-ID'),
                t.ticketId,
                t.customer,
                t.jenisgangguan || '-',
                (t.technicians || []).join(', '),
                t.duration,
                (t.ttr || 0).toFixed(1),
                t.status,
                t.keterangan || '-',
                t.jenisPerbaikan || '-'  // <--- INI TAMBAHAN JENIS PERBAIKAN
            ]);
        });

        const ws1 = XLSX.utils.aoa_to_sheet(data1);
        ws1['!cols'] = [
            { wch: 5 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
            { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 10 },
            { wch: 10 }, { wch: 30 }, { wch: 25 }  // <--- LEBAR KOLOM JENIS PERBAIKAN
        ];
        XLSX.utils.book_append_sheet(wb, ws1, 'Data Tiket');

        // --- SHEET 2: DIAGRAM JENIS GANGGUAN (TETAP) ---
        const gangguanMap = {};
        filteredTickets.forEach(t => {
            const jenis = t.jenisgangguan || 'Tidak diketahui';
            gangguanMap[jenis] = (gangguanMap[jenis] || 0) + 1;
        });
        const sortedGangguan = Object.entries(gangguanMap).sort((a, b) => b[1] - a[1]);

        const data2 = [
            ['DIAGRAM & LAPORAN JENIS GANGGUAN'],
            [],
            ['No', 'Jenis Gangguan', 'Jumlah', 'Persentase']
        ];
        const totalGangguan = filteredTickets.length;
        sortedGangguan.forEach(([jenis, count], i) => {
            const persen = ((count / totalGangguan) * 100).toFixed(1);
            data2.push([i + 1, jenis, count, persen + '%']);
        });

        const ws2 = XLSX.utils.aoa_to_sheet(data2);
        ws2['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 15 }];

        const canvasJenis = document.getElementById('jenisChart');
        if (canvasJenis) {
            const imgJenis = canvasJenis.toDataURL('image/png');
            ws2['!images'] = ws2['!images'] || [];
            ws2['!images'].push({
                name: 'diagram_jenis.png',
                data: imgJenis,
                opts: { base64: true },
                range: { s: { r: 10, c: 4 }, e: { r: 30, c: 10 } }
            });
        }
        XLSX.utils.book_append_sheet(wb, ws2, 'Diagram Gangguan');

        // --- SHEET 3: DIAGRAM PRODUKTIVITAS (TETAP) ---
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

        const data3 = [
            ['DIAGRAM & LAPORAN PRODUKTIVITAS TEKNISI'],
            [],
            ['No', 'Nama Teknisi', 'Total Tiket', 'Selesai', 'Tepat Waktu', 'Overdue', 'Produktivitas (%)']
        ];
        sortedTech.forEach(([name, data], i) => {
            const productivity = data.total > 0 ? ((data.tepatWaktu / data.total) * 100).toFixed(1) : '0';
            data3.push([i + 1, name, data.total, data.closed, data.tepatWaktu, data.overdue, productivity + '%']);
        });

        const ws3 = XLSX.utils.aoa_to_sheet(data3);
        ws3['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 18 }];

        const canvasProd = document.getElementById('produktivitasChart');
        if (canvasProd) {
            const imgProd = canvasProd.toDataURL('image/png');
            ws3['!images'] = ws3['!images'] || [];
            ws3['!images'].push({
                name: 'diagram_produktivitas.png',
                data: imgProd,
                opts: { base64: true },
                range: { s: { r: 15, c: 4 }, e: { r: 35, c: 10 } }
            });
        }
        XLSX.utils.book_append_sheet(wb, ws3, 'Diagram Produktivitas');

        // --- SHEET 4: TOP PELANGGAN (TETAP) ---
        const customerMap = {};
        filteredTickets.forEach(t => {
            const cust = t.customer || 'Tidak diketahui';
            if (!customerMap[cust]) customerMap[cust] = { total: 0, gangguan: {} };
            customerMap[cust].total++;
            const jenis = t.jenisgangguan || 'Tidak diketahui';
            customerMap[cust].gangguan[jenis] = (customerMap[cust].gangguan[jenis] || 0) + 1;
        });
        const sortedCustomers = Object.entries(customerMap).sort((a, b) => b[1].total - a[1].total).slice(0, 10);

        const data4 = [
            ['TOP 10 PELANGGAN PALING SERING LAPOR'],
            [],
            ['No', 'Nama Pelanggan', 'Total Laporan', 'Gangguan Terbanyak']
        ];
        sortedCustomers.forEach(([cust, data], i) => {
            const topGangguan = Object.entries(data.gangguan).sort((a, b) => b[1] - a[1])[0];
            const gangguanText = topGangguan ? `${topGangguan[0]} (${topGangguan[1]}x)` : '-';
            data4.push([i + 1, cust, data.total, gangguanText]);
        });
        const ws4 = XLSX.utils.aoa_to_sheet(data4);
        ws4['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws4, 'Top Pelanggan');

        // --- SHEET 5: GAUL (TETAP) ---
        const gaulMap = {};
        filteredTickets.forEach(t => {
            const customer = t.customer;
            const techsList = t.technicians || [];
            const tDate = new Date(t.createdAt);
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

            if (tDate >= twoMonthsAgo) {
                const otherTickets = filteredTickets.filter(t2 => t2.id !== t.id && t2.customer === customer && t2.createdAt.toDate() >= twoMonthsAgo);
                if (otherTickets.length > 0) {
                    techsList.forEach(tech => { gaulMap[tech] = (gaulMap[tech] || 0) + 1; });
                }
            }
        });
        const sortedGaul = Object.entries(gaulMap).sort((a, b) => b[1] - a[1]);

        const data5 = [
            ['TEKNISI PENYEBAB GANGGUAN ULANG (GAUL)'],
            [],
            ['No', 'Nama Teknisi', 'Total GAUL']
        ];
        sortedGaul.forEach(([tech, count], i) => data5.push([i + 1, tech, count]));
        const ws5 = XLSX.utils.aoa_to_sheet(data5);
        ws5['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws5, 'Laporan GAUL');

        // DOWNLOAD
        XLSX.writeFile(wb, `Laporan_Lengkap_Diagram_${new Date().toISOString().slice(0, 10)}.xlsx`);

        Swal.fire('Berhasil!', '✅ Laporan Excel lengkap beserta diagram berhasil di-export!', 'success');

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
        notif('Masukkan nama teknisi!','warning'); 
        return; 
    }
    
    try {
        const { error } = await sb
            .from('technicians')
            .insert({ 
                name: name, 
                phone: phone || '-' 
            });
        
        if (error) throw error;
        
        nameInput.value = '';
        phoneInput.value = '';
        
        notif('Teknisi '+name+' ditambahkan','success');
        loadTechniciansCache();
        
    } catch(e) { 
        notif('Gagal tambah teknisi: ' + e.message,'danger'); 
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
            
            Swal.fire({
                icon: 'success',
                title: 'Terhapus!',
                text: `Teknisi "${tech.name}" berhasil dihapus`,
                timer: 1500,
                showConfirmButton: false,
                background: '#ffffff',
                backdrop: 'rgba(0,0,0,0.3)'
            });
            notif('✅ Teknisi ' + tech.name + ' dihapus', 'success');
            loadTechniciansCache(); // RELOAD DATA
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
    const desc = sanitize(document.getElementById('jenisgangguan').value.trim());
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
        ticketid: id,
        customer: cust,
        duration: dur,
        jenisgangguan: desc,
        technicians: selectedTechs,
        status: 'open',
        createdat: createdAt,
        ttr: 0,
        pendingnote: null,
        closeticket: null,
        closedat: null,
        keterangan: null,
        jenisPerbaikan: null  
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
        setupRealtime(); // RELOAD DATA
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
        setupRealtime();
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
                jenisPerbaikan: finalJenisPerbaikan  // <-- PAKAI YANG P BESAR
            })
            .eq('id', docId);

        if (error) throw error;
        
        notif('Tiket '+ticket.ticketId+' ditutup!', 'success');
        setupRealtime();
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
        setupRealtime(); // RELOAD DATA
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
            <td><strong>${t.ticketId}</strong></td>
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
        setupRealtime();
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
                setupRealtime();
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

    document.getElementById('totalTickets').textContent = todayTickets.length;
    document.getElementById('openTickets').textContent = todayTickets.filter(t => t.status === 'open').length;
    document.getElementById('closedTickets').textContent = todayTickets.filter(t => t.status === 'close').length;
    document.getElementById('pendingTickets').textContent = todayTickets.filter(t => t.status === 'pending').length;
    
    // Overdue hari ini
    const todayOverdue = todayTickets.filter(t => {
        if (t.status === 'close' || t.status === 'open') {
            const ttr = t.ttr || 0;
            return ttr > t.duration;
        }
        return false;
    });
    document.getElementById('overdueTickets').textContent = todayOverdue.length;
    
    // GAUL - HAPUS FILTER YANG PAKE toDate
    const gaulCustomers = todayTickets.filter(t => {
        const customerName = t.customer;
        const history = tickets.filter(t2 => {
            if (t2.customer !== customerName) return false;
            if (t2.id === t.id) return false;
            return true; // <-- SKIP CEK TANGGAL DULU
        });
        return history.length > 0;
    }).map(t => t.customer);
    
    const uniqueGaul = [...new Set(gaulCustomers)];
    document.getElementById('gaulTickets').textContent = uniqueGaul.length;
}

       

async function setupRealtime() {
    const today = new Date().toDateString();

    console.log('🔥 Ambil tiket dari Supabase...');
    try {
        const { data, error } = await sb
            .from('tickets')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw error;

        tickets = data;
        localStorage.setItem('tickets_data', JSON.stringify(tickets));
        localStorage.setItem('tickets_last_fetch', today);

        console.log('✅ Tiket dimuat:', tickets.length);
        console.log('📋 Data tiket:', tickets);
        
        renderTickets(null, 1);  // <-- PAKSA RENDER
        updateStats();
        renderPerformance();
        renderReports();
        
    } catch (e) {
        console.error('❌ Gagal ambil tiket:', e);
        notif('Gagal ambil data tiket', 'danger');
    }

    // CEK CACHE TEKNISI
    const cachedTechs = localStorage.getItem('techs_data');
    const lastFetchTechs = localStorage.getItem('techs_last_fetch');

    if (cachedTechs && lastFetchTechs === today) {
        techs = JSON.parse(cachedTechs);
        console.log('📦 Pakai cache teknisi:', techs.length);
    } else {
        console.log('🔥 Ambil teknisi dari Supabase...');
        try {
            const { data, error } = await sb
                .from('technicians')
                .select('*')
                .order('name');

            if (error) throw error;

            techs = data;
            localStorage.setItem('techs_data', JSON.stringify(techs));
            localStorage.setItem('techs_last_fetch', today);
            console.log('✅ Teknisi dimuat:', techs.length);
        } catch (e) {
            console.error('Gagal ambil teknisi:', e);
        }
    }

    renderTechList();
    renderTechDropdown();
    renderPerformance();
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
    const ticketSection = document.getElementById('ticketSection');
    const techSection = document.getElementById('technicianSection');
    const reportSection = document.getElementById('reportsSection');

    if (ticketSection) ticketSection.style.display = 'block';
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

    // JANGAN SET FILTER TANGGAL KE HARI INI - BIARKAN KOSONG
    const filterDate = document.getElementById('filterDate');
    const filterDateTo = document.getElementById('filterDateTo');
    if (filterDate) filterDate.value = '';   // <-- KOSONGKAN
    if (filterDateTo) filterDateTo.value = ''; // <-- KOSONGKAN

    // LOAD DATA
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