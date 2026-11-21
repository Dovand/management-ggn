/**
 * ============================================================
 * NOC MAHAWIRA - KELOLA SERVER MIKROTIK
 * ============================================================
 * Fitur:
 * 1. Manajemen Server MikroTik (Multi-Router: Wonorejo, Sukodono, Kota, Tekung, Klakah, dll)
 * 2. Integrasi real-time API MikroTik (cek CPU, Memory, Uptime, Klien PPPoE Aktif)
 * 3. Keamanan: Kredensial dan password router tersimpan aman di server backend,
 *    tidak pernah diekspos ke frontend atau disebarkan ke publik.
 */

(function () {
    const MODEM_API_BASE = (window.location.protocol === 'https:' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
        ? 'https://noc-mahawira.tail6b7a38.ts.net'
        : 'http://127.0.0.1:7878';

    let globalServerList = [];

    // ============================================================
    // 1. HOOK SWITCH TAB KE MENU "servers"
    // ============================================================
    const origSwitchTab = window.switchTab;
    window.switchTab = function (tab) {
        if (tab === 'servers') {
            console.log('Switch tab ke: servers');
            try { localStorage.setItem('dashboard_active_tab', 'servers'); } catch (_) { }

            // Tutup sidebar mobile
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('show');
            if (overlay) overlay.classList.remove('show');

            // Set active class di menu sidebar
            document.querySelectorAll('.sidebar .nav-item').forEach(function (el) {
                el.classList.remove('active');
            });
            const targetNav = document.querySelector('.sidebar .nav-item[data-tab="servers"]');
            if (targetNav) targetNav.classList.add('active');

            // Sembunyikan semua section
            const allSections = [
                'dashboardSection', 'ticketSection', 'psbSection', 'technicianSection',
                'reportsSection', 'rekapSection', 'allrekapSection', 'pelangganSection',
                'onuOltSection', 'cekModemSection', 'serversSection', 'backupSection', 'settingsSection', 'inventorySection',
                'scheduleSection', 'activityLogSection'
            ];
            allSections.forEach(function (id) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Tampilkan serversSection
            const serversSection = document.getElementById('serversSection');
            const pageTitle = document.querySelector('.top-bar h1');
            if (serversSection) {
                serversSection.style.display = 'block';
                if (pageTitle) pageTitle.innerHTML = '🖥️ Kelola Server MikroTik';
                loadServerList(false);
                window.scrollTo(0, 0);
            }
            return;
        }

        // Jika pindah ke tab lain, sembunyikan serversSection
        const serversSection = document.getElementById('serversSection');
        if (serversSection) serversSection.style.display = 'none';

        if (typeof origSwitchTab === 'function') {
            origSwitchTab(tab);
        }
    };

    // ============================================================
    // 2. FITUR KELOLA SERVER MIKROTIK
    // ============================================================
    async function loadServerList(forceCheck = false) {
        const tbody = document.getElementById('serverTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center;padding:30px;color:#64748b;">
                        <i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i> ${forceCheck ? 'Melakukan ping & cek status API ke semua server MikroTik...' : 'Memuat data server...'}
                    </td>
                </tr>
            `;
        }

        try {
            const checkParam = forceCheck ? '?check=1' : '';
            const res = await fetch(`${MODEM_API_BASE}/api/servers${checkParam}`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                globalServerList = json.data;
                renderServerStats();
                renderServerTable(globalServerList);
                populateRouterFilterDropdown(globalServerList);
            } else {
                throw new Error(json.error || 'Gagal memuat daftar server');
            }
        } catch (err) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align:center;padding:30px;color:#dc2626;">
                            <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> Gagal memuat server: ${err.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    function renderServerStats() {
        const totalEl = document.getElementById('serverTotalCount');
        const onlineEl = document.getElementById('serverOnlineCount');
        const offlineEl = document.getElementById('serverOfflineCount');
        const pppoeEl = document.getElementById('serverTotalPppoe');

        let total = globalServerList.length;
        let online = 0;
        let offline = 0;
        let totalPpp = 0;

        globalServerList.forEach(s => {
            if (s.enabled && s.online) {
                online++;
            } else {
                offline++;
            }
            if (typeof s.active_pppoe === 'number') {
                totalPpp += s.active_pppoe;
            }
        });

        if (totalEl) totalEl.textContent = total;
        if (onlineEl) onlineEl.textContent = online;
        if (offlineEl) offlineEl.textContent = offline;
        if (pppoeEl) pppoeEl.textContent = totalPpp > 0 ? totalPpp : (online > 0 ? 'Aktif' : '0');
    }

    function renderServerTable(servers) {
        const tbody = document.getElementById('serverTableBody');
        if (!tbody) return;

        if (!servers || servers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center;padding:30px;color:#64748b;">
                        Belum ada server MikroTik yang terdaftar. Klik tombol <b>+ Tambah Server Baru</b> di atas.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        servers.forEach((s, idx) => {
            const no = idx + 1;
            const isOnline = s.online === true;
            const statusBadge = isOnline
                ? `<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;display:inline-flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;"></span> Online (${s.latency || 'OK'})</span>`
                : (s.enabled === false
                    ? `<span style="background:#f1f5f9;color:#64748b;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;">⚪ Nonaktif</span>`
                    : `<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;display:inline-flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:#dc2626;display:inline-block;"></span> Offline</span>`);

            const pppText = typeof s.active_pppoe === 'number'
                ? `<b style="color:#2563eb;">${s.active_pppoe} Klien</b>`
                : '<span style="color:#94a3b8;">-</span>';

            const cpuText = s.cpu_load && s.cpu_load !== '-'
                ? `<span style="font-weight:700;color:${parseInt(s.cpu_load) > 75 ? '#dc2626' : '#16a34a'};">${s.cpu_load}</span>`
                : '<span style="color:#94a3b8;">-</span>';

            const vpnInfo = s.vpn_name
                ? `<div style="font-size:11px;color:#334155;font-weight:600;"><i class="fas fa-shield-alt" style="color:#3b82f6;"></i> ${s.vpn_name}</div><div style="font-size:10px;color:#64748b;">User: ${s.vpn_user || 'PC ADMIN'}</div>`
                : '<span style="color:#94a3b8;font-size:11px;">-</span>';

            html += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="text-align:center;font-weight:600;color:#64748b;padding:12px 10px;">${no}</td>
                    <td style="padding:12px 10px;">
                        <div style="font-weight:800;color:#0f172a;font-size:13px;">${s.name}</div>
                        <div style="font-size:11px;color:#64748b;font-family:monospace;">ID: ${s.id}</div>
                    </td>
                    <td style="padding:12px 10px;">
                        <div style="font-family:monospace;font-weight:700;color:#1e293b;">${s.host}</div>
                        <div style="font-size:11px;color:#64748b;">Port API: <b>${s.port}</b> | User: <b>${s.user}</b></div>
                    </td>
                    <td style="padding:12px 10px;">${vpnInfo}</td>
                    <td style="text-align:center;padding:12px 10px;">${statusBadge}</td>
                    <td style="text-align:center;padding:12px 10px;">${cpuText}</td>
                    <td style="text-align:center;padding:12px 10px;font-size:12px;color:#475569;">${s.free_memory || '-'}</td>
                    <td style="text-align:center;padding:12px 10px;">${pppText}</td>
                    <td style="text-align:center;padding:12px 10px;font-size:11px;color:#64748b;">${s.uptime || '-'}</td>
                    <td style="text-align:center;padding:12px 10px;white-space:nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="testServerDirect('${s.id}')" style="padding:4px 9px;font-size:11px;border-radius:6px;color:#2563eb;border-color:#93c5fd;background:#eff6ff;font-weight:700;" title="Test Koneksi API Sekarang">
                            <i class="fas fa-bolt"></i> Test
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="openServerFormModalById('${s.id}')" style="padding:4px 9px;font-size:11px;border-radius:6px;color:#475569;border-color:#cbd5e1;" title="Edit Server">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="deleteServer('${s.id}', '${s.name}')" style="padding:4px 9px;font-size:11px;border-radius:6px;color:#dc2626;border-color:#fca5a5;background:#fef2f2;" title="Hapus Server">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function populateRouterFilterDropdown(servers) {
        const filterSelect = document.getElementById('modemRouterFilter');
        if (!filterSelect || !Array.isArray(servers)) return;

        const currentVal = filterSelect.value;
        let html = '<option value="all">🌐 Semua Router Aktif</option>';
        servers.forEach(s => {
            if (s.enabled !== false) {
                html += `<option value="${s.id}">📍 ${s.name} (${s.host})</option>`;
            }
        });

        filterSelect.innerHTML = html;
        if (servers.some(s => s.id === currentVal)) {
            filterSelect.value = currentVal;
        }
    }

    function openServerFormModalById(id) {
        const found = globalServerList.find(s => s.id === id);
        openServerFormModal(found || null);
    }

    function openServerFormModal(server = null) {
        const modal = document.getElementById('serverFormModal');
        const titleEl = document.getElementById('serverFormTitle');
        const modeEl = document.getElementById('serverFormMode');
        const feedbackEl = document.getElementById('serverTestFeedback');

        if (!modal) return;
        if (feedbackEl) feedbackEl.style.display = 'none';

        if (server) {
            modeEl.value = 'edit';
            if (titleEl) titleEl.textContent = `Edit Server: ${server.name}`;
            document.getElementById('serverInputId').value = server.id || '';
            document.getElementById('serverInputId').readOnly = true;
            document.getElementById('serverInputName').value = server.name || '';
            document.getElementById('serverInputHost').value = server.host || '';
            document.getElementById('serverInputPort').value = server.port || 8728;
            document.getElementById('serverInputUser').value = server.user || '';
            document.getElementById('serverInputPass').value = '';
            document.getElementById('serverInputPass').placeholder = 'Kosongkan jika tidak ingin mengubah password';
            document.getElementById('serverInputVpnName').value = server.vpn_name || server.name || '';
            document.getElementById('serverInputVpnUser').value = server.vpn_user || 'PC ADMIN';
            document.getElementById('serverInputEnabled').checked = server.enabled !== false;
        } else {
            modeEl.value = 'add';
            if (titleEl) titleEl.textContent = 'Tambah Server MikroTik Baru';
            document.getElementById('serverInputId').value = '';
            document.getElementById('serverInputId').readOnly = false;
            document.getElementById('serverInputName').value = '';
            document.getElementById('serverInputHost').value = '';
            document.getElementById('serverInputPort').value = '8728';
            document.getElementById('serverInputUser').value = 'admin';
            document.getElementById('serverInputPass').value = '';
            document.getElementById('serverInputPass').placeholder = 'Password API MikroTik';
            document.getElementById('serverInputVpnName').value = '';
            document.getElementById('serverInputVpnUser').value = 'PC ADMIN';
            document.getElementById('serverInputEnabled').checked = true;
        }

        modal.style.display = 'flex';
    }

    function closeServerFormModal() {
        const modal = document.getElementById('serverFormModal');
        if (modal) modal.style.display = 'none';
    }

    async function testCurrentServerForm() {
        const host = document.getElementById('serverInputHost')?.value.trim();
        const port = document.getElementById('serverInputPort')?.value.trim() || 8728;
        const user = document.getElementById('serverInputUser')?.value.trim();
        const pass = document.getElementById('serverInputPass')?.value || '';
        const id = document.getElementById('serverInputId')?.value.trim();
        const feedbackEl = document.getElementById('serverTestFeedback');
        const testBtn = document.getElementById('btnTestServerForm');

        if (!host || !user) {
            Swal.fire('Input Kurang', 'Host IP dan User API wajib diisi untuk melakukan test!', 'warning');
            return;
        }

        const origText = testBtn ? testBtn.innerHTML : '';
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungi MikroTik...';
        }

        if (feedbackEl) {
            feedbackEl.style.display = 'block';
            feedbackEl.style.background = '#f8fafc';
            feedbackEl.style.border = '1px solid #cbd5e1';
            feedbackEl.style.color = '#334155';
            feedbackEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungi MikroTik API...';
        }

        try {
            const res = await fetch(`${MODEM_API_BASE}/api/servers/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, port, user, pass, id })
            });
            const data = await res.json();

            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = origText;
            }

            if (data.success) {
                if (feedbackEl) {
                    feedbackEl.style.background = '#ecfdf5';
                    feedbackEl.style.border = '1px solid #a7f3d0';
                    feedbackEl.style.color = '#065f46';
                    feedbackEl.innerHTML = `
                        <b><i class="fas fa-check-circle"></i> Koneksi Berhasil!</b> Latensi: <b>${data.latency}</b><br>
                        Perangkat: <b>${data.board_name}</b> (RouterOS v${data.version}) | CPU: <b>${data.cpu_load}</b> | Memori Bebas: <b>${data.free_memory}</b> | Klien PPPoE Aktif: <b>${data.active_pppoe}</b>
                    `;
                }
            } else {
                if (feedbackEl) {
                    feedbackEl.style.background = '#fef2f2';
                    feedbackEl.style.border = '1px solid #fecdd3';
                    feedbackEl.style.color = '#991b1b';
                    feedbackEl.innerHTML = `<b><i class="fas fa-times-circle"></i> Koneksi Gagal:</b> ${data.error}`;
                }
            }
        } catch (err) {
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = origText;
            }
            if (feedbackEl) {
                feedbackEl.style.background = '#fef2f2';
                feedbackEl.style.border = '1px solid #fecdd3';
                feedbackEl.style.color = '#991b1b';
                feedbackEl.innerHTML = `<b><i class="fas fa-times-circle"></i> Error:</b> ${err.message}`;
            }
        }
    }

    async function handleSaveServer(e) {
        e.preventDefault();

        const id = document.getElementById('serverInputId')?.value.trim().toLowerCase();
        const name = document.getElementById('serverInputName')?.value.trim();
        const host = document.getElementById('serverInputHost')?.value.trim();
        const port = document.getElementById('serverInputPort')?.value.trim();
        const user = document.getElementById('serverInputUser')?.value.trim();
        const pass = document.getElementById('serverInputPass')?.value;
        const vpn_name = document.getElementById('serverInputVpnName')?.value.trim();
        const vpn_user = document.getElementById('serverInputVpnUser')?.value.trim();
        const enabled = document.getElementById('serverInputEnabled')?.checked !== false;

        if (!id || !name || !host || !port || !user) {
            Swal.fire('Form Belum Lengkap', 'ID, Nama Server, Host IP, Port, dan User API wajib diisi.', 'warning');
            return;
        }

        const submitBtn = document.getElementById('btnSubmitServer');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        }

        try {
            const res = await fetch(`${MODEM_API_BASE}/api/servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id, name, host, port, user, pass, vpn_name, vpn_user, enabled
                })
            });
            const data = await res.json();

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Simpan Server';
            }

            if (data.success) {
                closeServerFormModal();
                Swal.fire({
                    icon: 'success',
                    title: 'Server Berhasil Disimpan',
                    text: data.message,
                    timer: 1800,
                    showConfirmButton: false
                });
                loadServerList(true);
            } else {
                Swal.fire('Gagal Menyimpan', data.error || 'Terjadi kesalahan sistem', 'error');
            }
        } catch (err) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Simpan Server';
            }
            Swal.fire('Error', err.message, 'error');
        }
    }

    async function deleteServer(id, name) {
        const confirmRes = await Swal.fire({
            title: 'Hapus Server?',
            html: `Apakah Anda yakin ingin menghapus server <b>${name}</b> (${id}) dari daftar monitoring?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        });

        if (!confirmRes.isConfirmed) return;

        Swal.fire({
            title: 'Menghapus Server...',
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await fetch(`${MODEM_API_BASE}/api/servers?id=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Server Dihapus',
                    text: data.message,
                    timer: 1800,
                    showConfirmButton: false
                });
                loadServerList(true);
            } else {
                Swal.fire('Gagal Hapus', data.error || 'Server tidak dapat dihapus', 'error');
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }

    async function testServerDirect(id) {
        const server = globalServerList.find(s => s.id === id);
        if (!server) return;

        Swal.fire({
            title: `Mengetes Server ${server.name}...`,
            html: `Menghubungi host <b>${server.host}:${server.port}</b> via MikroTik API...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await fetch(`${MODEM_API_BASE}/api/servers/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: server.id,
                    host: server.host,
                    port: server.port,
                    user: server.user
                })
            });
            const data = await res.json();

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: `Server ${server.name} ONLINE!`,
                    html: `
                        <div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:13px;line-height:1.7;">
                            <div>⚡ <b>Latensi:</b> <span style="color:#16a34a;font-weight:700;">${data.latency}</span></div>
                            <div>📟 <b>Perangkat:</b> ${data.board_name} (RouterOS v${data.version})</div>
                            <div>⚙️ <b>CPU Load:</b> <span style="font-weight:700;">${data.cpu_load}</span></div>
                            <div>🧠 <b>Memori Bebas:</b> ${data.free_memory}</div>
                            <div>⏱️ <b>Uptime:</b> ${data.uptime}</div>
                            <div>👥 <b>Klien PPPoE Aktif:</b> <span style="color:#2563eb;font-weight:700;">${data.active_pppoe} Klien</span></div>
                        </div>
                    `,
                    confirmButtonColor: '#2563eb'
                });
                loadServerList(true);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: `Server ${server.name} OFFLINE`,
                    text: data.error || 'Gagal terhubung ke RouterOS API.'
                });
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }

    // Ekspor fungsi ke window global
    window.loadServerList = loadServerList;
    window.openServerFormModal = openServerFormModal;
    window.openServerFormModalById = openServerFormModalById;
    window.closeServerFormModal = closeServerFormModal;
    window.testCurrentServerForm = testCurrentServerForm;
    window.handleSaveServer = handleSaveServer;
    window.deleteServer = deleteServer;
    window.testServerDirect = testServerDirect;
    window.populateRouterFilterDropdown = populateRouterFilterDropdown;

    // Inisialisasi awal saat halaman selesai dimuat
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(() => {
            loadServerList(false);
        }, 1200);
    });
})();
