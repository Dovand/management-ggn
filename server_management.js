/**
 * ============================================================
 * NOC MAHAWIRA - KELOLA SERVER MIKROTIK
 * ============================================================
 * Fitur:
 * 1. Manajemen Server MikroTik (Multi-Router: Wonorejo, Sukodono, Kota, Tekung, Klakah, dll)
 * 2. Integrasi real-time API MikroTik (cek CPU, Memory, Uptime, Klien PPPoE Aktif)
 * 3. Tampilan Node Cards modern & tabel komparasi detail
 * 4. Keamanan tinggi: Kredensial tidak diekspos ke frontend atau publik
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
        const cardsCont = document.getElementById('serverCardsContainer');
        const refreshIcon = document.getElementById('iconRefreshServers');

        if (refreshIcon) refreshIcon.classList.add('fa-spin');

        if (tbody && globalServerList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center;padding:30px;color:#64748b;">
                        <i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i> ${forceCheck ? 'Melakukan ping & cek status API ke semua server MikroTik...' : 'Memuat data server...'}
                    </td>
                </tr>
            `;
        }

        if (cardsCont && globalServerList.length === 0) {
            cardsCont.innerHTML = `
                <div style="grid-column:1 / -1;text-align:center;padding:30px;color:#64748b;">
                    <i class="fas fa-spinner fa-spin fa-2x" style="color:#2563eb;margin-bottom:10px;"></i>
                    <div>Menghubungi RouterOS API...</div>
                </div>
            `;
        }

        try {
            const checkParam = forceCheck ? '?check=1' : '';
            const res = await fetch(`${MODEM_API_BASE}/api/servers${checkParam}`);
            const json = await res.json();

            if (refreshIcon) refreshIcon.classList.remove('fa-spin');

            if (json.success && Array.isArray(json.data)) {
                globalServerList = json.data;
                renderServerStats();
                renderServerCards(globalServerList);
                renderServerTable(globalServerList);
                populateRouterFilterDropdown(globalServerList);

                const lastUpEl = document.getElementById('serverLastUpdatedText');
                if (lastUpEl) {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    lastUpEl.innerHTML = `<i class="fas fa-check-circle" style="color:#16a34a;"></i> Status aktif per <b>${timeStr} WIB</b>`;
                }
            } else {
                throw new Error(json.error || 'Gagal memuat daftar server');
            }
        } catch (err) {
            if (refreshIcon) refreshIcon.classList.remove('fa-spin');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align:center;padding:30px;color:#dc2626;">
                            <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> Gagal memuat server: ${err.message}
                        </td>
                    </tr>
                `;
            }
            if (cardsCont) {
                cardsCont.innerHTML = `
                    <div style="grid-column:1 / -1;padding:24px;border:1px solid #fecdd3;background:#fff1f2;border-radius:14px;color:#991b1b;text-align:center;">
                        <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom:8px;"></i>
                        <div>Gagal menghubungi service server MikroTik: ${err.message}</div>
                    </div>
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
        if (pppoeEl) pppoeEl.textContent = totalPpp > 0 ? `${totalPpp} Klien` : (online > 0 ? 'Aktif' : '0');
    }

    // Render modern router node cards
    function renderServerCards(servers) {
        const container = document.getElementById('serverCardsContainer');
        if (!container) return;

        if (!servers || servers.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; background:#ffffff; border:1px dashed #cbd5e1; border-radius:16px; padding:36px; text-align:center; color:#64748b;">
                    <i class="fas fa-server" style="font-size:32px; color:#94a3b8; margin-bottom:12px;"></i>
                    <div style="font-size:15px; font-weight:700; color:#334155;">Belum ada router yang terdaftar</div>
                    <div style="font-size:13px; color:#64748b; margin-top:4px;">Klik tombol "+ Tambah Server" di atas untuk menambahkan router MikroTik baru.</div>
                </div>
            `;
            return;
        }

        let html = '';
        servers.forEach(s => {
            const isOnline = s.online === true;
            const statusBadge = isOnline
                ? `<span style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span> Online (${s.latency || 'OK'})</span>`
                : (s.enabled === false
                    ? `<span style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">⚪ Nonaktif</span>`
                    : `<span style="background:#fef2f2;color:#991b1b;border:1px solid #fecdd3;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;"><span style="width:7px;height:7px;border-radius:50%;background:#ef4444;"></span> Offline</span>`);

            const cpuVal = s.cpu_load && s.cpu_load !== '-' ? s.cpu_load : '-';
            const cpuInt = parseInt(cpuVal) || 0;
            const cpuColor = cpuInt > 75 ? '#dc2626' : (cpuInt > 40 ? '#d97706' : '#16a34a');

            html += `
                <div class="card" style="border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.03);display:flex;flex-direction:column;justify-content:space-between;transition:transform 0.15s, box-shadow 0.15s;">
                    <div>
                        <!-- CARD HEADER -->
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                            <div>
                                <div style="font-weight:800;color:#0f172a;font-size:16px;letter-spacing:-0.2px;display:flex;align-items:center;gap:8px;">
                                    <i class="fas fa-network-wired" style="color:#2563eb;font-size:14px;"></i> ${s.name}
                                </div>
                                <div style="font-size:11px;color:#64748b;font-family:monospace;margin-top:2px;">#${s.id}</div>
                            </div>
                            <div>${statusBadge}</div>
                        </div>

                        <!-- HOST & SPECS -->
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:14px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;">
                                <span style="color:#64748b;font-weight:600;">Host IP:</span>
                                <span style="font-family:monospace;font-weight:800;color:#0f172a;">${s.host}:${s.port}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;">
                                <span style="color:#64748b;font-weight:600;">User API:</span>
                                <span style="font-weight:700;color:#334155;">${s.user}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
                                <span style="color:#64748b;font-weight:600;">Profil VPN:</span>
                                <span style="color:#2563eb;font-weight:700;font-size:11px;"><i class="fas fa-shield-alt"></i> ${s.vpn_name || s.name} (${s.vpn_user || 'PC ADMIN'})</span>
                            </div>
                        </div>

                        <!-- 4 METRICS TILES -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
                            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;text-align:center;">
                                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">CPU Load</div>
                                <div style="font-size:14px;font-weight:800;color:${cpuColor};margin-top:2px;">${cpuVal}</div>
                            </div>
                            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;text-align:center;">
                                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Free Memory</div>
                                <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:2px;">${s.free_memory || '-'}</div>
                            </div>
                            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;text-align:center;">
                                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">PPPoE Aktif</div>
                                <div style="font-size:14px;font-weight:800;color:#2563eb;margin-top:2px;">${typeof s.active_pppoe === 'number' ? s.active_pppoe + ' Klien' : '-'}</div>
                            </div>
                            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;text-align:center;">
                                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Uptime</div>
                                <div style="font-size:12px;font-weight:700;color:#475569;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.uptime || '-'}">${s.uptime || '-'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- CARD ACTIONS -->
                    <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid #f1f5f9;">
                        <button class="btn btn-outline btn-sm" onclick="testServerDirect('${s.id}')" style="flex:1;padding:8px;border-radius:8px;font-weight:700;color:#2563eb;border-color:#bfdbfe;background:#eff6ff;display:inline-flex;align-items:center;justify-content:center;gap:5px;">
                            <i class="fas fa-bolt"></i> Test API
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="openServerFormModalById('${s.id}')" style="padding:8px 12px;border-radius:8px;font-weight:600;color:#475569;border-color:#cbd5e1;background:#ffffff;" title="Edit Server">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="deleteServer('${s.id}', '${s.name}')" style="padding:8px 12px;border-radius:8px;color:#dc2626;border-color:#fca5a5;background:#fef2f2;" title="Hapus Server">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Render clean summary table
    function renderServerTable(servers) {
        const tbody = document.getElementById('serverTableBody');
        if (!tbody) return;

        if (!servers || servers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center;padding:30px;color:#64748b;">
                        Belum ada server MikroTik yang terdaftar.
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
                ? `<span style="background:#ecfdf5;color:#065f46;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Online (${s.latency || 'OK'})</span>`
                : (s.enabled === false
                    ? `<span style="background:#f1f5f9;color:#64748b;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">⚪ Nonaktif</span>`
                    : `<span style="background:#fef2f2;color:#991b1b;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:#dc2626;display:inline-block;"></span> Offline</span>`);

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
                    <td style="text-align:center;font-weight:600;color:#64748b;padding:12px 14px;">${no}</td>
                    <td style="padding:12px 14px;">
                        <div style="font-weight:800;color:#0f172a;font-size:13px;">${s.name}</div>
                        <div style="font-size:11px;color:#64748b;font-family:monospace;">ID: ${s.id}</div>
                    </td>
                    <td style="padding:12px 14px;">
                        <div style="font-family:monospace;font-weight:700;color:#1e293b;">${s.host}</div>
                        <div style="font-size:11px;color:#64748b;">Port: <b>${s.port}</b> | User: <b>${s.user}</b></div>
                    </td>
                    <td style="padding:12px 14px;">${vpnInfo}</td>
                    <td style="text-align:center;padding:12px 14px;">${statusBadge}</td>
                    <td style="text-align:center;padding:12px 14px;">${cpuText}</td>
                    <td style="text-align:center;padding:12px 14px;font-size:12px;color:#475569;">${s.free_memory || '-'}</td>
                    <td style="text-align:center;padding:12px 14px;">${pppText}</td>
                    <td style="text-align:center;padding:12px 14px;font-size:11px;color:#64748b;">${s.uptime || '-'}</td>
                    <td style="text-align:center;padding:12px 14px;white-space:nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="testServerDirect('${s.id}')" style="padding:4px 9px;font-size:11px;border-radius:6px;color:#2563eb;border-color:#93c5fd;background:#eff6ff;font-weight:700;" title="Test Koneksi API">
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
                        <div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;font-size:13px;line-height:1.8;">
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                                <span>⚡ <b>Latensi:</b></span>
                                <span style="color:#16a34a;font-weight:800;">${data.latency}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                                <span>📟 <b>Perangkat:</b></span>
                                <span style="font-weight:700;color:#0f172a;">${data.board_name} (RouterOS v${data.version})</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                                <span>⚙️ <b>CPU Load:</b></span>
                                <span style="font-weight:800;color:${parseInt(data.cpu_load) > 75 ? '#dc2626' : '#16a34a'};">${data.cpu_load}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                                <span>🧠 <b>Memori Bebas:</b></span>
                                <span style="font-weight:700;color:#334155;">${data.free_memory}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                                <span>⏱️ <b>Uptime:</b></span>
                                <span style="font-weight:600;color:#475569;">${data.uptime}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;padding-top:2px;">
                                <span>👥 <b>Klien PPPoE Aktif:</b></span>
                                <span style="color:#2563eb;font-weight:800;">${data.active_pppoe} Klien</span>
                            </div>
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
