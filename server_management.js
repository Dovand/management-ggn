/**
 * ============================================================
 * NOC MAHAWIRA - KELOLA SERVER MIKROTIK & REMOTE MODEM DARI HP
 * ============================================================
 * Fitur:
 * 1. Manajemen Server MikroTik (Multi-Router: Wonorejo, Sukodono, Kota, Tekung, Klakah, dll)
 * 2. Remote Web GUI Modem dari HP / Luar Jaringan via Dynamic DST-NAT tanpa perlu VPN di HP
 * 3. Integrasi real-time API MikroTik (cek CPU, Memory, Uptime, Klien PPPoE Aktif)
 */

(function () {
    const MODEM_API_BASE = (window.location.protocol === 'https:' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
        ? 'https://noc-mahawira.tail6b7a38.ts.net'
        : 'http://127.0.0.1:7878';

    let globalServerList = [];
    let currentActiveRemoteTunnel = null;

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
    // 2. HOOK TABEL CEK MODEM (INJECT TOMBOL "REMOTE HP")
    // ============================================================
    function injectRemoteHpButtons() {
        const tbody = document.getElementById('modemTableBody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[id^="modem-row-"]');
        rows.forEach(row => {
            const rowId = row.id; // modem-row-192-168-121-183
            const ipStr = rowId.replace('modem-row-', '').replace(/-/g, '.');
            const actionTd = row.querySelector('td:last-child');
            if (!actionTd) return;

            // Cek apakah tombol Remote HP sudah ada
            if (actionTd.querySelector('.btn-remote-hp')) return;

            // Ambil data klien dari allModemList atau filteredModemList
            let clientData = null;
            if (typeof filteredModemList !== 'undefined' && Array.isArray(filteredModemList)) {
                clientData = filteredModemList.find(m => m.ip_address === ipStr);
            }
            if (!clientData && typeof allModemList !== 'undefined' && Array.isArray(allModemList)) {
                clientData = allModemList.find(m => m.ip_address === ipStr);
            }

            const routerId = clientData ? (clientData.router_id || clientData.router || 'sukodono') : 'sukodono';
            const custName = clientData ? (clientData.customer_name || clientData.pppoe_user || '').replace(/'/g, "\\'") : '';

            // Buat tombol Remote HP
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline btn-sm btn-remote-hp';
            btn.style.cssText = 'padding:4px 8px;font-size:11px;border-radius:6px;color:#2563eb;border-color:#93c5fd;background:#eff6ff;font-weight:700;display:inline-flex;align-items:center;gap:3px;margin-right:4px;';
            btn.title = 'Buka Remote Web GUI Modem dari HP Tanpa VPN';
            btn.innerHTML = '<i class="fas fa-mobile-alt"></i> Remote HP';
            btn.onclick = function () {
                openRemoteModemFromPhone(ipStr, routerId, custName, btn);
            };

            // Sisipkan di awal td action
            actionTd.insertBefore(btn, actionTd.firstChild);

            // Update router badge jika router selain wonorejo/sukodono
            if (clientData && clientData.router_id && clientData.router_id !== 'wonorejo' && clientData.router_id !== 'sukodono') {
                const routerTd = row.children[1];
                if (routerTd) {
                    const rName = (clientData.router_name || clientData.router_id).toUpperCase();
                    routerTd.innerHTML = `<span style="background:#ecfdf5;color:#065f46;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;">${rName}</span>`;
                }
            }
        });
    }

    // Hook renderModemTable
    const origRenderModemTable = window.renderModemTable;
    window.renderModemTable = function () {
        if (typeof origRenderModemTable === 'function') {
            origRenderModemTable();
        }
        injectRemoteHpButtons();
    };

    // ============================================================
    // 3. FITUR REMOTE MODEM DARI HP / LUAR JARINGAN (DYNAMIC NAT)
    // ============================================================
    async function openRemoteModemFromPhone(ip, router, customerName, btn) {
        if (!ip) {
            Swal.fire('Error', 'IP modem tidak valid.', 'error');
            return;
        }

        const origBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuka...';
        }

        Swal.fire({
            title: 'Membuka Jalur Remote HP...',
            html: `Menghubungi Router MikroTik untuk membuka port NAT ke IP <b>${ip}</b> agar bisa diakses langsung dari HP tanpa VPN...`,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const routerParam = router ? `&router=${encodeURIComponent(router)}` : '';
            const res = await fetch(`${MODEM_API_BASE}/api/modem/remote-tunnel?ip=${encodeURIComponent(ip)}${routerParam}`);
            const data = await res.json();

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origBtnHtml;
            }

            if (data.success && data.remote_url) {
                currentActiveRemoteTunnel = {
                    ip: ip,
                    router: router,
                    remote_url: data.remote_url,
                    remote_port: data.remote_port
                };

                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.remote_url)}`;

                Swal.fire({
                    title: '📱 Modem Siap Diremote dari HP!',
                    html: `
                        <div style="text-align:center;padding:5px;">
                            <div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:10px 14px;border-radius:10px;font-size:12px;margin-bottom:14px;line-height:1.5;">
                                <b>✅ Akses Terbuka!</b> Anda dan teknisi di lapangan dapat membuka Web GUI modem ini langsung dari browser HP mana saja <b>TANPA PERLU VPN</b>.
                            </div>

                            <div style="margin-bottom:14px;">
                                <a href="${data.remote_url}" target="_blank" class="btn btn-primary" style="padding:10px 24px;border-radius:10px;background:#2563eb;font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:8px;text-decoration:none;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
                                    <i class="fas fa-external-link-alt"></i> Buka Web GUI Modem (Port ${data.remote_port})
                                </a>
                            </div>

                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:14px;">
                                <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Link Akses Publik (Bisa Dishare ke WA / HP Teknisi)</div>
                                <div style="display:flex;gap:6px;align-items:center;">
                                    <input type="text" id="remoteModemUrlInput" value="${data.remote_url}" readonly style="flex:1;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-family:monospace;font-size:12px;background:#ffffff;">
                                    <button class="btn btn-outline btn-sm" onclick="copyRemoteModemUrl()" style="padding:7px 14px;border-radius:6px;font-weight:700;white-space:nowrap;">
                                        <i class="fas fa-copy"></i> Salin
                                    </button>
                                </div>
                            </div>

                            <div style="border-top:1px dashed #e2e8f0;padding-top:12px;margin-top:12px;">
                                <div style="font-size:12px;color:#475569;font-weight:600;margin-bottom:8px;">
                                    📷 Scan QR Code ini lewat Kamera HP Anda:
                                </div>
                                <div style="display:inline-block;padding:8px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                                    <img src="${qrUrl}" alt="QR Code Remote Modem" style="width:160px;height:160px;display:block;">
                                </div>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonColor: '#2563eb',
                    cancelButtonColor: '#dc2626',
                    confirmButtonText: '<i class="fas fa-check"></i> Selesai',
                    cancelButtonText: '<i class="fas fa-times-circle"></i> Tutup & Hapus Rule NAT',
                    showCloseButton: true
                }).then((result) => {
                    if (result.dismiss === Swal.DismissReason.cancel) {
                        closeRemoteModemTunnel(ip, router);
                    }
                });
            } else {
                Swal.fire('Gagal Buka Remote', data.error || data.message || 'Tidak dapat membuat rule NAT di MikroTik.', 'error');
            }
        } catch (err) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origBtnHtml;
            }
            Swal.fire('Gagal Buka Remote', err.message, 'error');
        }
    }

    function copyRemoteModemUrl() {
        const input = document.getElementById('remoteModemUrlInput');
        if (input) {
            input.select();
            document.execCommand('copy');
            if (typeof Swal !== 'undefined' && Swal.showValidationMessage) {
                Swal.showValidationMessage('Link berhasil disalin ke clipboard!');
                setTimeout(() => {
                    Swal.resetValidationMessage();
                }, 2000);
            }
        }
    }

    async function closeRemoteModemTunnel(ip, router) {
        if (!ip) return;
        try {
            const routerParam = router ? `&router=${encodeURIComponent(router)}` : '';
            const res = await fetch(`${MODEM_API_BASE}/api/modem/remote-tunnel?ip=${encodeURIComponent(ip)}${routerParam}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Akses Remote Ditutup',
                    text: 'Rule DST-NAT di Router MikroTik telah dihapus untuk keamanan jaringan.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (_) { }
    }

    function triggerRemoteFromDiagnose() {
        if (typeof activeDiagTarget !== 'undefined' && activeDiagTarget && activeDiagTarget.ip) {
            openRemoteModemFromPhone(activeDiagTarget.ip, activeDiagTarget.router, activeDiagTarget.customerName);
        } else {
            Swal.fire('Error', 'Data target modem tidak ditemukan', 'error');
        }
    }

    // ============================================================
    // 4. FITUR KELOLA SERVER MIKROTIK
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

            const serverJsonStr = JSON.stringify(s).replace(/"/g, '&quot;');

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
        const mode = document.getElementById('serverFormMode')?.value;
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
                    host: server.host,
                    port: server.port,
                    user: server.user,
                    pass: server.pass
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

    // Ekspor ke global window
    window.openRemoteModemFromPhone = openRemoteModemFromPhone;
    window.closeRemoteModemTunnel = closeRemoteModemTunnel;
    window.copyRemoteModemUrl = copyRemoteModemUrl;
    window.triggerRemoteFromDiagnose = triggerRemoteFromDiagnose;

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
