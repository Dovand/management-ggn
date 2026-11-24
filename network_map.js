/**
 * ==============================================================================
 * NOC MAHAWIRA - PETA JARINGAN FIBER OPTIK FTTH (WEB GIS HIGH PERFORMANCE)
 * ==============================================================================
 * Fitur Utama:
 * 1. Tampilan Visual Bersih & Terang (BEBAS DARI BACKGROUND HITAM / DARK MODE)
 * 2. High Performance 60 FPS Canvas Rendering (Smooth Zoom In / Zoom Out tanpa Lag)
 * 3. Indikator Statis Ringan (0% CPU impact, tanpa animasi berkedip berat)
 * 4. Hak Akses (Role Base):
 *    - Admin: Full CRUD (Tambah/Edit/Hapus Pelanggan, ODP, ODC, Kabel, Import & Export)
 *    - Teknisi / Viewer Link: Hanya Melihat, Mencari, Memfilter, dan Navigasi GPS
 * 5. Warna Kabel Sesuai Standar:
 *    - Feeder: BIRU (#2563eb)
 *    - Distribusi: MERAH (#dc2626)
 *    - Drop Core: KUNING (#eab308)
 * 6. Fitur Hapus Kabel (Klik kabel langsung untuk hapus + Tombol Undo Kabel Terakhir)
 * 7. Search Multifungsi:
 *    - Cari Nama Pelanggan / Kode ODP dengan Dropdown List Multi-Hasil
 *    - Cari Berdasarkan Koordinat GPS / Latitude / Longitude
 * 8. Otomasi Pasang Baru (PSB): Otomatis menarik kabel dropcore ke ODP tujuan
 * 9. Import & Export KML / KMZ secara Real-Time
 */

(function () {
  'use strict';

  // State Global Peta Jaringan
  window.GisMapState = {
    map: null,
    canvasRenderer: null,
    layers: {
      feeder: null,
      distribusi: null,
      dropcore: null,
      closure: null,
      odc: null,
      odp: null,
      pelangganConnected: null,
      pelangganUnconnected: null,
      userGps: null,
      searchPin: null
    },
    baseLayers: {},
    activeBaseLayer: 'hybrid',
    data: {
      odcs: [],
      odps: [],
      pelanggans: [],
      closures: [],
      feederLines: [],
      distLines: [],
      dropLines: []
    },
    filterKecamatan: 'ALL',
    activeTool: null, // 'add-pelanggan', 'add-odp', 'add-odc', 'draw-cable'
    drawPoints: [],
    drawTempPolyline: null,
    lastAddedCableId: null,
    lastAddedCableType: null,
    isInitialized: false
  };

  const S = window.GisMapState;

  // Cek apakah user saat ini adalah Admin
  function isAdmin() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'view' || urlParams.get('role') === 'technician') return false;
      const sess = JSON.parse(localStorage.getItem('user_session') || '{}');
      return sess.role === 'admin' || sess.username === 'admin';
    } catch (_) {
      return false;
    }
  }

  // Hitung jarak meter dua koordinat GPS
  function calcDistM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================================
  // 1. INJEKSI CSS STYLING TERANG / PUTIH BERSIH (NO BACKGROUND HITAM)
  // ============================================================================
  function injectMapStyles() {
    if (document.getElementById('gisMapCustomStyles')) return;
    const style = document.createElement('style');
    style.id = 'gisMapCustomStyles';
    style.innerHTML = `
      /* KUNCI BODY HP: BADAN MENU DIAM, HANYA PETA YANG SCROLL / PAN (0 BOUNCE) */
      html.gis-tab-active, body.gis-tab-active {
        overflow: hidden !important;
        position: fixed !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        margin: 0 !important;
        padding: 0 !important;
        touch-action: none !important;
      }

      body.gis-tab-active .main {
        height: 100vh !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        padding: 2px 4px 4px !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      body.gis-tab-active .top-bar {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 2px 6px !important;
        margin-bottom: 2px !important;
        height: 36px !important;
        min-height: 36px !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
      }

      body.gis-tab-active .top-bar h1 {
        font-size: 13.5px !important;
        margin: 0 !important;
      }

      body.gis-tab-active .top-bar > div:last-child {
        display: none !important;
      }

      body.gis-tab-active #gisMapSection {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        height: calc(100% - 38px) !important;
        padding: 0 !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      /* Layout Wrapper: Mengisi Sisa Ruang Tanpa Overflow Vertikal */
      .gis-layout-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        max-height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
      }

      /* 1. TOOLBAR ATAS: SEJAJAR SATU BARIS DENGAN KOLOM SEARCH */
      .gis-toolbar-outer {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        padding: 4px 8px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        margin-bottom: 4px;
        flex-shrink: 0;
        z-index: 1010;
        position: relative;
        overflow: visible;
        width: 100%;
        box-sizing: border-box;
        flex-wrap: nowrap;
      }

      /* Kolom Search */
      .gis-search-box {
        position: relative;
        min-width: 180px;
        max-width: 260px;
        flex-shrink: 0;
        z-index: 1020;
      }

      .gis-search-input {
        width: 100%;
        background: #f8fafc;
        color: #0f172a;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 6px 8px 6px 28px;
        font-size: 11.5px;
        font-weight: 600;
        outline: none;
        transition: all 0.2s;
        box-sizing: border-box;
      }
      .gis-search-input:focus {
        background: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .gis-search-icon {
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: #64748b;
        font-size: 11.5px;
        pointer-events: none;
      }

      /* Dropdown Hasil Pencarian Bebas Mengambang */
      .gis-search-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        min-width: 270px;
        max-width: 90vw;
        background: #ffffff;
        border: 1.5px solid #2563eb;
        border-radius: 8px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.25);
        max-height: 260px;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        overscroll-behavior: contain !important;
        z-index: 99999 !important;
        padding: 4px;
      }

      .gis-search-item {
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: #1e293b;
        transition: background 0.15s;
        border-bottom: 1px solid #f1f5f9;
        touch-action: pan-y !important;
      }
      .gis-search-item:last-child {
        border-bottom: none;
      }
      .gis-search-item:hover {
        background: #eff6ff;
        color: #1d4ed8;
      }

      /* Tombol Action Toolbar Sejajar dengan Search */
      .gis-tools-scroll {
        display: flex;
        align-items: center;
        gap: 5px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        flex: 1;
        min-width: 0;
        scrollbar-width: thin;
        padding-bottom: 1px;
        touch-action: pan-x;
      }

      .gis-tool-btn {
        background: #ffffff;
        color: #1e293b;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s ease;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .gis-tool-btn:hover {
        background: #2563eb;
        border-color: #1d4ed8;
        color: #ffffff !important;
      }
      .gis-tool-btn:hover i {
        color: #ffffff !important;
      }
      .gis-tool-btn.active {
        background: #dc2626 !important;
        border-color: #b91c1c !important;
        color: #ffffff !important;
      }

      /* 2. PETA LEAFLET (DI TENGAH - MEMENUHI SISA TINGGI SCREEN) */
      #gisMapContainer {
        flex: 1 1 auto;
        min-height: 0;
        width: 100% !important;
        height: 100% !important;
        border-radius: 8px;
        overflow: hidden;
        border: 1.5px solid #cbd5e1;
        box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        background: #f8fafc;
        position: relative;
        z-index: 1;
        touch-action: none;
      }

      /* CARD RINCIAN ODC, ODP, TERHUBUNG, TANPA DROPCORE DI DALAM MAP BAGIAN BAWAH */
      .gis-stats-badge {
        position: absolute;
        bottom: 10px;
        left: 10px;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(4px);
        color: #1e293b;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.14);
        pointer-events: auto;
        user-select: none;
        white-space: nowrap;
        max-width: calc(100% - 60px);
        overflow-x: auto;
      }

      /* 3. FILTER LAYER BAWAH: MENEMPEL DI BAWAH PETA, TIDAK TENGGELAM */
      .gis-layer-bar-outer {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        padding: 4px 8px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        margin-top: 4px;
        flex-shrink: 0;
        z-index: 1005;
        overflow: hidden;
        width: 100%;
        box-sizing: border-box;
      }

      .gis-layer-scroll {
        display: flex;
        align-items: center;
        gap: 5px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        flex: 1;
        min-width: 0;
        scrollbar-width: none;
        touch-action: pan-x;
      }
      .gis-layer-scroll::-webkit-scrollbar {
        display: none;
      }

      .gis-pill {
        background: #ffffff !important;
        color: #1e293b !important;
        border: 1.5px solid #cbd5e1 !important;
        border-radius: 20px;
        padding: 3px 9px;
        font-size: 10.5px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        user-select: none;
        transition: all 0.2s ease;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .gis-pill.active {
        background: #ffffff !important;
        color: #0f172a !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.12) !important;
      }
      .gis-pill.active[data-layer="odp"] { border: 2px solid #dc2626 !important; }
      .gis-pill.active[data-layer="odc"] { border: 2px solid #d97706 !important; }
      .gis-pill.active[data-layer="pelangganConnected"] { border: 2px solid #16a34a !important; }
      .gis-pill.active[data-layer="pelangganUnconnected"] { border: 2px solid #ef4444 !important; }
      .gis-pill.active[data-layer="feeder"] { border: 2px solid #2563eb !important; }
      .gis-pill.active[data-layer="distribusi"] { border: 2px solid #dc2626 !important; }
      .gis-pill.active[data-layer="dropcore"] { border: 2px solid #ca8a04 !important; }

      .gis-pill:not(.active) {
        background: #f8fafc !important;
        color: #94a3b8 !important;
        border: 1.5px dashed #cbd5e1 !important;
        opacity: 0.55;
      }

      /* POPUP MODAL: RESPONSIVE TIDAK AKAN TERPOTONG SEBELAH KANAN DI HP */
      .leaflet-popup {
        max-width: calc(100vw - 20px) !important;
        margin-bottom: 12px !important;
      }
      .leaflet-popup-content-wrapper {
        padding: 0 !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        box-shadow: 0 10px 28px rgba(0,0,0,0.2) !important;
        border: 1px solid #cbd5e1 !important;
        background: #ffffff !important;
        max-width: calc(100vw - 20px) !important;
        box-sizing: border-box !important;
      }
      .leaflet-popup-content {
        margin: 0 !important;
        line-height: 1.4 !important;
        width: min(275px, calc(100vw - 28px)) !important;
        max-width: calc(100vw - 28px) !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
      }
      .leaflet-popup-tip {
        background: #ffffff !important;
      }

      .earth-label {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        color: #ffffff !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        font-weight: 800 !important;
        font-size: 11px !important;
        text-shadow: -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 1px 1px 2px #000, 0 0 4px rgba(0,0,0,0.9) !important;
        padding: 0 !important;
        pointer-events: none !important;
      }

      .marker-triangle-red {
        width: 0; height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-bottom: 18px solid #dc2626;
        cursor: pointer;
      }
      .marker-triangle-yellow {
        width: 0; height: 0;
        border-left: 11px solid transparent;
        border-right: 11px solid transparent;
        border-bottom: 22px solid #facc15;
        cursor: pointer;
      }
      .marker-yellow-pin {
        width: 24px; height: 24px;
        background-image: url('http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png');
        background-size: contain; background-repeat: no-repeat; cursor: pointer;
      }
      .marker-yellow-pin-unconnected {
        width: 26px; height: 26px;
        background-image: url('http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png');
        background-size: contain; background-repeat: no-repeat; cursor: pointer;
        position: relative;
      }
      .marker-yellow-pin-unconnected::after {
        content: '!'; position: absolute; top: -4px; right: -4px; width: 14px; height: 14px;
        background: #dc2626; color: white; border-radius: 50%; font-size: 10px; font-weight: 900;
        display: flex; align-items: center; justify-content: center; border: 1.5px solid white;
      }

      @media (max-width: 768px) {
        .gis-search-box {
          min-width: 130px !important;
          max-width: 170px !important;
        }
        .gis-stats-badge {
          bottom: 6px !important;
          left: 6px !important;
          font-size: 9.5px !important;
          padding: 3px 6px !important;
          gap: 6px !important;
        }
        .gis-layer-bar-outer > span {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  function initNetworkMap() {
    injectMapStyles();

    const container = document.getElementById('gisMapContainer');
    if (!container) return;

    if (S.map) {
      setTimeout(() => { S.map.invalidateSize(); }, 200);
      applyRoleAccessToUi();
      return;
    }

    console.log('🗺️ Inisialisasi Peta Jaringan FTTH Mahawira (High-Performance Engine)...');

    // AKTIFKAN HTML5 CANVAS RENDERER (60 FPS SMOOTH)
    S.canvasRenderer = L.canvas({ padding: 0.5 });

    // Buat Peta Leaflet Berpusat di Lumajang dengan Optimasi Zooming
    S.map = L.map('gisMapContainer', {
      center: [-8.133, 113.224],
      zoom: 14,
      zoomControl: false,
      maxZoom: 21,
      preferCanvas: true,
      zoomAnimation: true,
      fadeAnimation: true,
      wheelPxPerZoomLevel: 120
    });

    // Kontrol Zoom di Kanan Bawah
    L.control.zoom({ position: 'bottomright' }).addTo(S.map);

    // BASEMAP SATELIT GOOGLE HYBRID
    const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 21,
      updateWhenZooming: false,
      updateWhenIdle: true,
      attribution: 'Satelit &copy; Google Maps'
    });

    const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 21,
      updateWhenZooming: false,
      updateWhenIdle: true,
      attribution: 'Satelit Murni &copy; Google'
    });

    const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    });

    const esriWorld = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri World Imagery'
    });

    // Default: Google Hybrid
    googleHybrid.addTo(S.map);
    S.baseLayers = {
      hybrid: googleHybrid,
      satellite: googleSat,
      streets: googleStreets,
      esri: esriWorld
    };
    S.activeBaseLayer = 'hybrid';

    // Layer Groups
    S.layers.feeder = L.layerGroup().addTo(S.map);
    S.layers.distribusi = L.layerGroup().addTo(S.map);
    S.layers.dropcore = L.layerGroup().addTo(S.map);
    S.layers.closure = L.layerGroup().addTo(S.map);
    S.layers.odc = L.layerGroup().addTo(S.map);
    S.layers.odp = L.layerGroup().addTo(S.map);
    S.layers.pelangganConnected = L.layerGroup().addTo(S.map);
    S.layers.pelangganUnconnected = L.layerGroup().addTo(S.map);
    S.layers.userGps = L.layerGroup().addTo(S.map);
    S.layers.searchPin = L.layerGroup().addTo(S.map);

    // Event Klik Peta untuk Tool Mode
    S.map.on('click', handleMapClick);

    // PREVENT MAP SCROLL & DRAG INTERFERENCE ON CONTROLS & DROPDOWN (BUG 1 FIX)
    const toolbar = document.querySelector('.gis-toolbar-outer');
    if (toolbar && window.L && L.DomEvent) {
      L.DomEvent.disableScrollPropagation(toolbar);
      L.DomEvent.disableClickPropagation(toolbar);
    }
    const layerBar = document.querySelector('.gis-layer-bar-outer');
    if (layerBar && window.L && L.DomEvent) {
      L.DomEvent.disableScrollPropagation(layerBar);
      L.DomEvent.disableClickPropagation(layerBar);
    }
    const searchDropdown = document.getElementById('gisSearchResultsDropdown');
    if (searchDropdown && window.L && L.DomEvent) {
      L.DomEvent.disableScrollPropagation(searchDropdown);
      L.DomEvent.disableClickPropagation(searchDropdown);
      ['wheel', 'mousewheel', 'DOMMouseScroll', 'touchstart', 'touchmove', 'touchend'].forEach(evt => {
        searchDropdown.addEventListener(evt, e => e.stopPropagation(), { passive: false });
      });
    }

    // Auto Invalidate Size (Cegah Peta Terpotong di Desktop & Mobile)
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (S.map) S.map.invalidateSize({ pan: false });
      });
      ro.observe(container);
    }
    window.addEventListener('resize', () => {
      if (S.map) S.map.invalidateSize({ pan: false });
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { if (S.map) S.map.invalidateSize({ pan: false }); }, 200);
    });

    // Zoom listener untuk beralih Canvas Circle (<15) vs Pushpin (>=15) - 60 FPS Smooth
    let lastZoomDetailed = S.map.getZoom() >= 15;
    S.map.on('zoomend', () => {
      const isDetailed = S.map.getZoom() >= 15;
      if (isDetailed !== lastZoomDetailed) {
        lastZoomDetailed = isDetailed;
        window.gisRenderPelangganMarkers();
      }
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.gis-search-box')) {
        const dd = document.getElementById('gisSearchResultsDropdown');
        if (dd) dd.style.display = 'none';
      }
    });

    // Terapkan hak akses UI (Admin vs Teknisi/Viewer)
    applyRoleAccessToUi();

    // Load Data
    loadInitialData();
  }

  // Terapkan batasan Role (Admin vs Teknisi/Viewer)
  function applyRoleAccessToUi() {
    const admin = isAdmin();
    document.querySelectorAll('.gis-admin-only').forEach(el => {
      el.style.display = admin ? 'inline-flex' : 'none';
    });

    const roleBadge = document.getElementById('gisRoleIndicator');
    if (roleBadge) {
      roleBadge.innerHTML = admin ? '👑 Mode Admin (Full CRUD)' : '👁️ Mode Teknisi (View Only)';
      roleBadge.style.color = admin ? '#2563eb' : '#059669';
    }
  }

  // ============================================================================
  // 3. LOAD & SIMPAN DATA JARINGAN
  // ============================================================================
  async function loadInitialData() {
    try {
      const MAP_STORAGE_VER = 'v_20261125_03';
      const savedVer = localStorage.getItem('mahawira_map_ver');
      
      // Jika versi berbeda, wajib buang cache lama agar data kabel dropcore & real id pelanggan termuat fresh!
      if (savedVer !== MAP_STORAGE_VER) {
        localStorage.removeItem('mahawira_map_network_data');
        localStorage.setItem('mahawira_map_ver', MAP_STORAGE_VER);
      } else {
        const cached = localStorage.getItem('mahawira_map_network_data');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.odps && parsed.odps.length > 0 && parsed.dropLines && parsed.dropLines.length > 0) {
              S.data = parsed;
              renderAllLayers();
              // Lanjut fetch di background untuk update
            }
          } catch (_) { }
        }
      }

      const res = await fetch('data/map_network.json?v=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        S.data = {
          odcs: json.odcs || [],
          odps: json.odps || [],
          pelanggans: json.pelanggans || [],
          closures: json.closures || [],
          feederLines: json.feederLines || [],
          distLines: json.distLines || [],
          dropLines: json.dropLines || []
        };

        // Cross-reference dengan window.allPelangganData jika sudah dimuat dari Supabase di script.js
        if (window.allPelangganData && Array.isArray(window.allPelangganData)) {
          window.allPelangganData.forEach(sp => {
            if (sp.nama && sp.id_pelanggan && sp.id_pelanggan !== '-') {
              const cust = S.data.pelanggans.find(p => p.nama && p.nama.trim().toUpperCase() === sp.nama.trim().toUpperCase());
              if (cust && (!cust.id || cust.id === '-' || cust.id.startsWith('plg_'))) {
                cust.id = sp.id_pelanggan.trim();
              }
            }
          });
        }

        saveLocalData();
        renderAllLayers();
      }
    } catch (err) {
      console.warn('Gagal memuat map_network.json:', err);
    }
  }
  function saveLocalData() {
    try {
      localStorage.setItem('mahawira_map_network_data', JSON.stringify(S.data));
    } catch (e) {
      console.warn('LocalStorage penuh:', e);
    }
  }

  // ============================================================================
  // 4. RENDER SEMUA LAYER (HIGH PERFORMANCE CANVAS + WARNA SESUAI INSTRUKSI)
  // ============================================================================
  function renderAllLayers() {
    if (!S.map) return;

    Object.values(S.layers).forEach(layer => {
      if (layer && typeof layer.clearLayers === 'function') layer.clearLayers();
    });

    const isMatchKec = (kec) => {
      if (!S.filterKecamatan || S.filterKecamatan === 'ALL') return true;
      return String(kec || '').toUpperCase().includes(S.filterKecamatan.toUpperCase());
    };

    const admin = isAdmin();

    // Global Popup Options: Posisi modal dijamin tidak tertutup menu toolbar di atasnya (Bug 4 Fix)
    const GIS_POPUP_OPTIONS = {
      autoPan: true,
      autoPanPaddingTopLeft: L.point((window.innerWidth <= 768) ? 10 : 20, (window.innerWidth <= 768) ? 50 : 115),
      autoPanPaddingBottomRight: L.point((window.innerWidth <= 768) ? 10 : 20, (window.innerWidth <= 768) ? 40 : 90),
      closeButton: true,
      offset: L.point(0, -10),
      maxWidth: 320
    };

    // 1. RENDER JALUR FEEDER: WARNA BIRU (#2563eb) - HIGH CONTRAST DOUBLE STROKE
    S.data.feederLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      L.polyline(l.coords, {
        color: '#1e3a8a',
        weight: 6,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.feeder);

      const poly = L.polyline(l.coords, {
        color: '#2563eb', // BIRU
        weight: 4,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.feeder);

      poly.bindTooltip(`🔵 Feeder: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(buildCablePopupHtml(l, 'feeder', '#2563eb'), GIS_POPUP_OPTIONS);
    });

    // 2. RENDER JALUR DISTRIBUSI: WARNA MERAH (#dc2626) - HIGH CONTRAST DOUBLE STROKE
    S.data.distLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      L.polyline(l.coords, {
        color: '#7f1d1d',
        weight: 5,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.distribusi);

      const poly = L.polyline(l.coords, {
        color: '#dc2626', // MERAH
        weight: 3.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.distribusi);

      poly.bindTooltip(`🔴 Distribusi: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(buildCablePopupHtml(l, 'distribusi', '#dc2626'), GIS_POPUP_OPTIONS);
    });

    // 3. RENDER JALUR DROP CORE: WARNA KUNING (#facc15) - DIJAMIN MUNCUL DI HP & PC
    S.data.dropLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      // Garis kontras gelap bawah agar kabel kuning terlihat jelas di atas citra satelit
      L.polyline(l.coords, {
        color: '#713f12',
        weight: 5,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.dropcore);

      const poly = L.polyline(l.coords, {
        color: '#facc15', // KUNING TERANG
        weight: 3.2,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.dropcore);

      poly.bindTooltip(`🟡 Drop Core: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(buildCablePopupHtml(l, 'dropcore', '#ca8a04'), GIS_POPUP_OPTIONS);
    });

    // 4. RENDER ODC: Segitiga Kuning (▲)
    S.data.odcs.forEach(odc => {
      if (!isMatchKec(odc.kec)) return;
      const icon = L.divIcon({
        className: 'custom-odc-icon',
        html: `<div class="marker-triangle-yellow" title="${escapeHtml(odc.name)}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22]
      });

      L.marker([odc.lat, odc.lng], { icon })
        .bindTooltip(escapeHtml(odc.name), {
          permanent: false,
          direction: 'top',
          className: 'earth-label',
          offset: [0, -20]
        })
        .bindPopup(buildOdcPopupHtml(odc), GIS_POPUP_OPTIONS)
        .addTo(S.layers.odc);
    });

    // 5. RENDER ODP: Segitiga Merah (▲)
    S.data.odps.forEach(odp => {
      if (!isMatchKec(odp.kec)) return;
      const icon = L.divIcon({
        className: 'custom-odp-icon',
        html: `<div class="marker-triangle-red" title="${escapeHtml(odp.name)}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 18]
      });

      L.marker([odp.lat, odp.lng], { icon })
        .bindTooltip(escapeHtml(odp.name), {
          permanent: false,
          direction: 'top',
          className: 'earth-label',
          offset: [0, -18]
        })
        .bindPopup(buildOdpPopupHtml(odp), GIS_POPUP_OPTIONS)
        .addTo(S.layers.odp);
    });

    // 6. RENDER PELANGGAN (HYBRID 60 FPS: CANVAS DI ZOOM RENDAH, PUSHPIN DI ZOOM TINGGI)
    window.gisRenderPelangganMarkers();
  }

  window.gisRenderPelangganMarkers = function () {
    if (!S.map || !S.layers.pelangganConnected || !S.layers.pelangganUnconnected) return;
    S.layers.pelangganConnected.clearLayers();
    S.layers.pelangganUnconnected.clearLayers();

    const currentZoom = S.map.getZoom();
    const isDetailed = currentZoom >= 15;
    const isMatchKec = (kec) => {
      if (!S.filterKecamatan || S.filterKecamatan === 'ALL') return true;
      return String(kec || '').toUpperCase().includes(S.filterKecamatan.toUpperCase());
    };

    const isMobile = window.innerWidth <= 768;
    const GIS_POPUP_OPTIONS = {
      autoPan: true,
      autoPanPaddingTopLeft: L.point(isMobile ? 10 : 20, isMobile ? 50 : 115),
      autoPanPaddingBottomRight: L.point(isMobile ? 10 : 20, isMobile ? 40 : 90),
      closeButton: true,
      offset: L.point(0, -10),
      maxWidth: isMobile ? Math.min(275, window.innerWidth - 24) : 310
    };

    let countConn = 0;
    let countUnconn = 0;

    S.data.pelanggans.forEach(c => {
      if (!isMatchKec(c.kec)) return;
      const hasLine = c.hasDropcore !== false;

      let marker;
      if (isDetailed) {
        // High Zoom (>=15): Google Earth Pushpin Marker
        const iconClass = hasLine ? 'marker-yellow-pin' : 'marker-yellow-pin-unconnected';
        const icon = L.divIcon({
          className: 'custom-cust-icon',
          html: `<div class="${iconClass}" title="${escapeHtml(c.nama)}"></div>`,
          iconSize: [24, 24],
          iconAnchor: [6, 24]
        });
        marker = L.marker([c.lat, c.lng], { icon })
          .bindTooltip(escapeHtml(c.nama), {
            permanent: false,
            direction: 'top',
            className: 'earth-label',
            offset: [6, -22]
          });
      } else {
        // Low/Mid Zoom (<15): 60 FPS HTML5 Canvas Circle (0 Lag, Silky Smooth Pan & Zoom)
        marker = L.circleMarker([c.lat, c.lng], {
          renderer: S.canvasRenderer,
          radius: hasLine ? 4 : 5.5,
          color: hasLine ? '#ca8a04' : '#b91c1c',
          fillColor: hasLine ? '#facc15' : '#ef4444',
          fillOpacity: 0.9,
          weight: hasLine ? 1 : 1.5
        }).bindTooltip(escapeHtml(c.nama), {
          permanent: false,
          direction: 'top',
          className: 'earth-label'
        });
      }

      marker.bindPopup(buildCustomerPopupHtml(c), GIS_POPUP_OPTIONS);

      if (hasLine) {
        marker.addTo(S.layers.pelangganConnected);
        countConn++;
      } else {
        marker.addTo(S.layers.pelangganUnconnected);
        countUnconn++;
      }
    });

    updateStatsBadge(countConn, countUnconn);
  };

  function updateStatsBadge(conn, unconn) {
    const el = document.getElementById('gisStatsBadge');
    if (!el) return;
    el.innerHTML = `
      <span>📦 <b>${S.data.odps.length}</b> ODP</span>
      <span>🏢 <b>${S.data.odcs.length}</b> ODC</span>
      <span>👤 <b>${conn}</b> Terhubung</span>
      <span style="color:#dc2626;">⚠️ <b>${unconn}</b> Tanpa Dropcore</span>
    `;
  }

  // ============================================================================
  // 5. POPUP TEMPLATES - TEMA BERSIH / TERANG (NO BACKGROUND HITAM)
  // ============================================================================

  // Popup Kabel dengan Fitur HAPUS KABEL
  function buildCablePopupHtml(line, type, colorHex) {
    const admin = isAdmin();
    let totalLenM = 0;
    for (let i = 0; i < line.coords.length - 1; i++) {
      totalLenM += calcDistM(line.coords[i][0], line.coords[i][1], line.coords[i + 1][0], line.coords[i + 1][1]);
    }

    const typeNames = { feeder: 'Jalur Feeder (Biru)', distribusi: 'Jalur Distribusi (Merah)', dropcore: 'Jalur Drop Core (Kuning)' };

    return `
      <div style="font-family:'Segoe UI',sans-serif; width:260px; background:#ffffff; border-radius:12px; overflow:hidden; color:#1e293b; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
        <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; padding:10px 14px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="width:10px; height:10px; border-radius:50%; background:${colorHex}; display:inline-block; border:1px solid #cbd5e1;"></span>
            <span style="font-size:11px; font-weight:800; color:#0f172a; text-transform:uppercase;">${typeNames[type] || 'JALUR KABEL'}</span>
          </div>
          <span style="font-size:10px; color:#64748b; font-weight:700;">NOC MAHAWIRA</span>
        </div>
        <div style="padding:12px 14px; font-size:12px;">
          <div style="font-size:14px; font-weight:800; line-height:1.2; margin-bottom:8px; word-break:break-all; color:#0f172a;">${escapeHtml(line.name)}</div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:#64748b; font-size:11px;">Panjang Kabel:</span>
              <b style="color:#0f172a; font-size:12px;">${Math.round(totalLenM)} meter</b>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#64748b; font-size:11px;">Jumlah Titik:</span>
              <b style="color:#0f172a; font-size:12px;">${line.coords.length} titik</b>
            </div>
          </div>

          ${admin ? `
            <div>
              <button onclick="window.gisDeleteCable('${escapeHtml(line.id)}', '${type}')" 
                style="width:100%; padding:7px 10px; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;"
                title="Hapus kabel ini dari peta">
                🗑️ Hapus Kabel Ini
              </button>
            </div>
          ` : `
            <div style="font-size:10px; color:#94a3b8; font-style:italic; text-align:center;">Mode Teknisi: Hanya Lihat</div>
          `}
        </div>
      </div>
    `;
  }

  // Popup Pelanggan - TEMA BERSIH PUTIH / LIGHT (TIDAK ADA BACKGROUND GELAP/HITAM)
  function buildCustomerPopupHtml(c) {
    const admin = isAdmin();
    const isConn = c.hasDropcore !== false;
    const realId = (c.id && !c.id.startsWith('plg_') && c.id !== '-') ? c.id : null;

    return `
      <div style="font-family:'Segoe UI',sans-serif; width:100%; max-width:275px; background:#ffffff; border-radius:12px; overflow:hidden; color:#1e293b; box-sizing:border-box; word-break:break-word;">
        <!-- Header Bersih Putih / Light -->
        <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; padding:10px 12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <span style="background:#eff6ff; color:#1d4ed8; font-size:10px; font-weight:800; padding:2px 8px; border-radius:999px; border:1px solid #bfdbfe;">
              👤 PELANGGAN FTTH
            </span>
            <span style="color:#64748b; font-size:10px; font-weight:700;">NOC MAHAWIRA</span>
          </div>
          <div style="font-size:14px; font-weight:800; color:#0f172a; line-height:1.2; text-transform:uppercase; margin-top:3px; word-break:break-word;">
            ${escapeHtml(c.nama)}
          </div>
          <div style="color:#64748b; font-size:11px; margin-top:4px;">
            ID Pelanggan: ${realId ? `<b style="color:#1d4ed8; font-family:monospace; font-size:11.5px; background:#eff6ff; padding:2px 6px; border-radius:4px; border:1px solid #bfdbfe; word-break:break-all;">${escapeHtml(realId)}</b>` : `<b style="color:#94a3b8;">-</b>`}
          </div>
        </div>

        <!-- Body Info -->
        <div style="padding:8px 12px;">
          <!-- ODP Box -->
          <div style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:8px; padding:6px 10px; margin-bottom:8px; display:flex; align-items:center;">
            <div style="background:#fee2e2; color:#dc2626; width:26px; height:26px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:13px; margin-right:8px; flex-shrink:0;">
              📦
            </div>
            <div style="min-width:0; flex:1;">
              <div style="font-size:9px; color:#991b1b; font-weight:800; text-transform:uppercase;">ODP TERHUBUNG</div>
              <div style="font-size:12px; color:#b91c1c; font-weight:800; word-break:break-all;">${escapeHtml(c.odp || '-')}</div>
            </div>
          </div>

          <!-- Table Detail -->
          <table style="width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed;">
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:3px 0; color:#64748b; font-weight:600; width:35%;">🏛️ Wilayah</td>
              <td style="padding:3px 0; color:#0f172a; font-weight:700; text-align:right; word-break:break-word;">${escapeHtml(c.kec || '-')}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:3px 0; color:#64748b; font-weight:600;">📍 Alamat</td>
              <td style="padding:3px 0; color:#0f172a; font-weight:600; text-align:right; word-break:break-word;">${escapeHtml(c.alamat || '-')}</td>
            </tr>
            <tr>
              <td style="padding:3px 0; color:#64748b; font-weight:600;">🌐 Koordinat</td>
              <td style="padding:3px 0; color:#0284c7; font-weight:700; font-family:monospace; font-size:10px; text-align:right;">${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</td>
            </tr>
          </table>

          <!-- Action Buttons -->
          <div style="display:flex; gap:5px; margin-top:8px; padding-top:6px; border-top:1px solid #e2e8f0; flex-wrap:wrap;">
            ${admin ? `
              <button onclick="window.gisEditPelanggan('${escapeHtml(c.id || c.nama)}')" 
                style="flex:1; min-width:60px; padding:5px; background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; border-radius:6px; font-size:10.5px; font-weight:700; cursor:pointer;"
                title="Edit Pelanggan">
                ✏️ Edit
              </button>
              <button onclick="window.gisAutoConnectDropcore('${escapeHtml(c.id || c.nama)}')" 
                style="flex:1; min-width:80px; padding:5px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:6px; font-size:10.5px; font-weight:700; cursor:pointer;"
                title="Tarik Otomatis Kabel Dropcore ke ODP">
                ⚡ Tarik Dropcore
              </button>
              <button onclick="window.gisDeletePelanggan('${escapeHtml(c.id || c.nama)}')" 
                style="padding:5px 8px; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:6px; font-size:10.5px; font-weight:700; cursor:pointer;"
                title="Hapus Pelanggan">
                🗑️
              </button>
            ` : ''}
            <button onclick="window.gisNavigasiGoogleMaps(${c.lat}, ${c.lng})" 
              style="${admin ? 'padding:5px 8px;' : 'flex:1; padding:7px;'} background:#10b981; color:white; border:none; border-radius:6px; font-size:10.5px; font-weight:700; cursor:pointer;"
              title="Buka Navigasi Rute Google Maps">
              🧭 Rute Google Maps
            </button>
          </div>
        </div>

        <!-- Footer Status -->
        <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:4px 12px; font-size:9.5px; color:#64748b; display:flex; justify-content:space-between; align-items:center;">
          <span>⚡ Status Dropcore</span>
          <span style="color:${isConn ? '#16a34a' : '#dc2626'}; font-weight:800;">
            ● ${isConn ? 'TERKONEKSI' : 'BELUM ADA TARIKAN'}
          </span>
        </div>
      </div>
    `;
  }

  // Popup ODP - TEMA BERSIH PUTIH / LIGHT
  function buildOdpPopupHtml(odp) {
    const admin = isAdmin();
    const connectedCusts = S.data.pelanggans.filter(p => {
      return (p.odp && p.odp.toUpperCase().includes(odp.name.toUpperCase())) ||
        (odp.name && odp.name.toUpperCase().includes(p.odp.toUpperCase()));
    });

    return `
      <div style="font-family:'Segoe UI',sans-serif; width:300px; background:#ffffff; border-radius:12px; overflow:hidden; color:#1e293b; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
        <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; padding:12px 14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <span style="background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 8px; border-radius:999px; border:1px solid #fecaca;">
              📦 ODP FIBER
            </span>
            <span style="color:#64748b; font-size:10px; font-weight:700;">NOC MAHAWIRA</span>
          </div>
          <div style="font-size:16px; font-weight:800; color:#0f172a; line-height:1.2; text-transform:uppercase; margin-top:4px;">
            ${escapeHtml(odp.name)}
          </div>
          <div style="color:#64748b; font-size:11px; margin-top:2px;">Wilayah: <b style="color:#1e293b;">${escapeHtml(odp.kec || '-')}</b></div>
        </div>

        <div style="padding:10px 14px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:10px; color:#64748b; font-weight:700;">PELANGGAN TERHUBUNG</div>
              <div style="font-size:18px; font-weight:900; color:#0f172a;">${connectedCusts.length} <span style="font-size:11px; color:#64748b; font-weight:500;">Port</span></div>
            </div>
            <div style="background:#fee2e2; color:#dc2626; width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px;">
              ⚡
            </div>
          </div>

          <div style="font-size:11px; color:#64748b;">
            <b>🌐 Koordinat GPS:</b> <span style="font-family:monospace; color:#0284c7;">${odp.lat.toFixed(6)}, ${odp.lng.toFixed(6)}</span>
          </div>

          <div style="display:flex; gap:6px; margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0;">
            ${admin ? `
              <button onclick="window.gisEditOdp('${escapeHtml(odp.name)}')" 
                style="flex:1; padding:6px; background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">
                ✏️ Edit ODP
              </button>
              <button onclick="window.gisDeleteOdp('${escapeHtml(odp.name)}')" 
                style="padding:6px 10px; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;"
                title="Hapus ODP">
                🗑️
              </button>
            ` : ''}
            <button onclick="window.gisNavigasiGoogleMaps(${odp.lat}, ${odp.lng})" 
              style="${admin ? 'padding:6px 12px;' : 'flex:1; padding:8px;'} background:#10b981; color:white; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;"
              title="Buka Navigasi Rute Google Maps">
              🧭 Rute Google Maps
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Popup ODC - TEMA BERSIH PUTIH / LIGHT
  function buildOdcPopupHtml(odc) {
    return `
      <div style="font-family:'Segoe UI',sans-serif; width:290px; background:#ffffff; border-radius:12px; overflow:hidden; color:#1e293b; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
        <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; padding:12px 14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <span style="background:#fef3c7; color:#d97706; font-size:10px; font-weight:800; padding:2px 8px; border-radius:999px; border:1px solid #fde68a;">
              🏢 ODC FIBER
            </span>
            <span style="color:#64748b; font-size:10px; font-weight:700;">NOC MAHAWIRA</span>
          </div>
          <div style="font-size:16px; font-weight:800; color:#0f172a; line-height:1.2; text-transform:uppercase; margin-top:4px;">
            ${escapeHtml(odc.name)}
          </div>
          <div style="color:#64748b; font-size:11px; margin-top:2px;">Wilayah: <b style="color:#1e293b;">${escapeHtml(odc.kec || '-')}</b></div>
        </div>
        <div style="padding:10px 14px; font-size:11px;">
          <div><b>🌐 Koordinat GPS:</b> <span style="font-family:monospace; color:#0284c7;">${odc.lat.toFixed(6)}, ${odc.lng.toFixed(6)}</span></div>
          <div style="margin-top:10px; display:flex; gap:6px;">
            <button onclick="window.gisNavigasiGoogleMaps(${odc.lat}, ${odc.lng})" 
              style="flex:1; padding:7px; background:#10b981; color:white; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">
              🧭 Rute Google Maps
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // 6. FITUR HAPUS KABEL (KLIK LANGSUNG & UNDO KABEL TERAKHIR)
  // ============================================================================
  window.gisDeleteCable = function (lineId, type) {
    if (!isAdmin()) {
      Swal.fire('Akses Dibatasi', 'Hanya Admin yang dapat menghapus kabel!', 'warning');
      return;
    }

    Swal.fire({
      title: 'Hapus Jalur Kabel?',
      text: 'Yakin ingin menghapus jalur kabel ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Hapus!'
    }).then(res => {
      if (res.isConfirmed) {
        if (type === 'feeder') S.data.feederLines = S.data.feederLines.filter(l => l.id !== lineId);
        else if (type === 'distribusi') S.data.distLines = S.data.distLines.filter(l => l.id !== lineId);
        else S.data.dropLines = S.data.dropLines.filter(l => l.id !== lineId);

        saveLocalData();
        renderAllLayers();
        Swal.fire({ icon: 'success', title: 'Kabel Berhasil Dihapus!', timer: 1600, showConfirmButton: false });
      }
    });
  };

  // Undo / Hapus kabel yang baru saja ditarik
  window.gisUndoLastCable = function () {
    if (!isAdmin()) {
      Swal.fire('Akses Dibatasi', 'Hanya Admin yang dapat menghapus kabel!', 'warning');
      return;
    }

    if (!S.lastAddedCableId) {
      // Hapus kabel dropcore terakhir jika ada
      if (S.data.dropLines.length > 0) {
        const removed = S.data.dropLines.pop();
        saveLocalData();
        renderAllLayers();
        Swal.fire({ icon: 'success', title: 'Kabel Terakhir Dihapus', text: `Jalur "${removed.name}" telah dihapus.`, timer: 1800, showConfirmButton: false });
        return;
      }
      Swal.fire('Info', 'Tidak ada riwayat kabel yang baru ditarik.', 'info');
      return;
    }

    const cid = S.lastAddedCableId;
    const ctype = S.lastAddedCableType;

    if (ctype === 'feeder') S.data.feederLines = S.data.feederLines.filter(l => l.id !== cid);
    else if (ctype === 'distribusi') S.data.distLines = S.data.distLines.filter(l => l.id !== cid);
    else S.data.dropLines = S.data.dropLines.filter(l => l.id !== cid);

    S.lastAddedCableId = null;
    S.lastAddedCableType = null;

    saveLocalData();
    renderAllLayers();
    Swal.fire({ icon: 'success', title: 'Kabel Berhasil Dibatalkan (Undo)!', timer: 1800, showConfirmButton: false });
  };

  // ============================================================================
  // 7. PENCARIAN (NAMA PELANGGAN / ODP / KOORDINAT LAT-LNG DENGAN DROPDOWN LIST)
  // ============================================================================
  window.gisSearchInput = function (query) {
    const dropdown = document.getElementById('gisSearchResultsDropdown');
    if (!dropdown) return;

    const q = (query || '').trim();
    if (!q || q.length < 2) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const results = [];
    const qUpper = q.toUpperCase();

    // 1. CEK APAKAH QUERY MERUPAKAN KOORDINAT GPS (LAT, LNG / LONGITUDE)
    const coordParts = q.replace(/[^\d.,\- ]/g, '').trim().split(/[,\s]+/).map(Number);
    if (coordParts.length >= 2 && !isNaN(coordParts[0]) && !isNaN(coordParts[1])) {
      let lat = coordParts[0];
      let lng = coordParts[1];
      if (lat > 90 && lng < 0) { const temp = lat; lat = lng; lng = temp; }
      results.push({
        type: 'coord',
        title: `📍 Koordinat GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        subtitle: 'Klik untuk langsung menuju koordinat ini',
        lat,
        lng
      });
    } else if (coordParts.length === 1 && !isNaN(coordParts[0]) && (coordParts[0] > 100 || coordParts[0] < -5)) {
      // User mengetik longitude saja (contoh 113.2206) atau latitude (-8.137)
      const num = coordParts[0];
      const matchCustCoords = S.data.pelanggans.filter(p => {
        return Math.abs(p.lng - num) < 0.005 || Math.abs(p.lat - num) < 0.005;
      }).slice(0, 5);

      matchCustCoords.forEach(c => {
        results.push({
          type: 'pelanggan',
          title: `👤 ${c.nama}`,
          subtitle: `ODP: ${c.odp} | Koordinat: ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`,
          lat: c.lat,
          lng: c.lng,
          item: c
        });
      });
    }

    // 2. CARI DI PELANGGAN (NAMA, ID, ODP, ALAMAT)
    S.data.pelanggans.forEach(c => {
      if (
        c.nama.toUpperCase().includes(qUpper) ||
        (c.id && c.id.toUpperCase().includes(qUpper)) ||
        (c.odp && c.odp.toUpperCase().includes(qUpper)) ||
        (c.alamat && c.alamat.toUpperCase().includes(qUpper))
      ) {
        results.push({
          type: 'pelanggan',
          title: `👤 ${c.nama}`,
          subtitle: `ODP: ${c.odp || '-'} | ${c.kec || '-'}`,
          lat: c.lat,
          lng: c.lng,
          item: c
        });
      }
    });

    // 3. CARI DI ODP
    S.data.odps.forEach(o => {
      if (o.name.toUpperCase().includes(qUpper) || (o.kec && o.kec.toUpperCase().includes(qUpper))) {
        results.push({
          type: 'odp',
          title: `📦 ${o.name}`,
          subtitle: `ODP Fiber | ${o.kec || '-'}`,
          lat: o.lat,
          lng: o.lng,
          item: o
        });
      }
    });

    // 4. CARI DI ODC
    S.data.odcs.forEach(odc => {
      if (odc.name.toUpperCase().includes(qUpper)) {
        results.push({
          type: 'odc',
          title: `🏢 ${odc.name}`,
          subtitle: `ODC Fiber | ${odc.kec || '-'}`,
          lat: odc.lat,
          lng: odc.lng,
          item: odc
        });
      }
    });

    // Batasi 25 hasil teratas
    const displayResults = results.slice(0, 25);

    if (displayResults.length === 0) {
      dropdown.style.display = 'block';
      dropdown.innerHTML = `<div style="padding:10px; color:#64748b; font-size:12px; text-align:center;">Tidak ada hasil untuk "${escapeHtml(q)}"</div>`;
      return;
    }

    dropdown.style.display = 'block';
    dropdown.innerHTML = displayResults.map((r, idx) => `
      <div class="gis-search-item" onclick="window.gisSelectSearchResult(${r.lat}, ${r.lng}, '${r.type}', '${escapeHtml(r.title)}')">
        <div>
          <div style="font-weight:700;">${r.title}</div>
          <div style="font-size:11px; color:#64748b;">${r.subtitle}</div>
        </div>
        <span style="font-size:11px; color:#2563eb; font-weight:700;">YOK, GAS!!! ➜</span>
      </div>
    `).join('');

    // KUNCI PROPAGASI SCROLL AGAR MAP TIDAK IKUT GESER (BUG 1 FIX)
    if (window.L && L.DomEvent) {
      L.DomEvent.disableScrollPropagation(dropdown);
      L.DomEvent.disableClickPropagation(dropdown);
    }
    dropdown.onwheel = function (e) { e.stopPropagation(); };
    dropdown.ontouchstart = function (e) { e.stopPropagation(); };
    dropdown.ontouchmove = function (e) { e.stopPropagation(); };
  };

  // Saat salah satu hasil pencarian diklik
  window.gisSelectSearchResult = function (lat, lng, type, title) {
    const dropdown = document.getElementById('gisSearchResultsDropdown');
    if (dropdown) dropdown.style.display = 'none';

    S.layers.searchPin.clearLayers();

    // Smooth flyTo ke titik - Berikan offset lat sedikit ke utara agar marker posisinya tidak di ujung atas layar dan popup tidak tertutup toolbar (Bug 4 Fix)
    S.map.flyTo([lat + 0.0006, lng], 18, { duration: 1.2 });

    // Pasang highlight ring sementara
    const highlight = L.circleMarker([lat, lng], {
      radius: 14,
      color: '#2563eb',
      weight: 3,
      fillColor: '#60a5fa',
      fillOpacity: 0.3
    }).addTo(S.layers.searchPin);

    setTimeout(() => { S.layers.searchPin.clearLayers(); }, 8000);

    // Cari marker terdekat dan buka popup-nya
    setTimeout(() => {
      let found = false;
      if (type === 'pelanggan') {
        S.layers.pelangganConnected.eachLayer(layer => {
          if (!found && layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.00002) { layer.openPopup(); found = true; }
        });
        if (!found) {
          S.layers.pelangganUnconnected.eachLayer(layer => {
            if (!found && layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.00002) { layer.openPopup(); found = true; }
          });
        }
      } else if (type === 'odp') {
        S.layers.odp.eachLayer(layer => {
          if (!found && layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.00002) { layer.openPopup(); found = true; }
        });
      } else if (type === 'odc') {
        S.layers.odc.eachLayer(layer => {
          if (!found && layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.00002) { layer.openPopup(); found = true; }
        });
      }
    }, 1300);
  };

  // Alias untuk kompatibilitas
  window.gisSearchQuery = window.gisSearchInput;

  // Tutup search dropdown jika klik di luar
  document.addEventListener('click', function (e) {
    const box = document.querySelector('.gis-search-box');
    const dropdown = document.getElementById('gisSearchResultsDropdown');
    if (box && dropdown && !box.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // ============================================================================
  // 8. CRUD PELANGGAN, ODP, ODC & OTOMASI PSB (HANYA ADMIN)
  // ============================================================================
  window.gisSetTool = function (toolName) {
    if (!isAdmin()) {
      Swal.fire('Akses Terbatas', 'Fitur edit & gambar hanya dapat digunakan oleh Admin!', 'warning');
      return;
    }

    S.activeTool = (S.activeTool === toolName) ? null : toolName;

    document.querySelectorAll('.gis-tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === S.activeTool);
    });

    if (S.activeTool) {
      const labels = {
        'add-pelanggan': '👤 Klik di peta pada lokasi rumah pelanggan baru!',
        'add-odp': '📦 Klik di peta pada lokasi tiang ODP baru!',
        'add-odc': '🏢 Klik di peta pada lokasi ODC baru!',
        'draw-cable': '✏️ Klik titik awal lalu klik titik tujuan untuk menarik kabel!'
      };
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: labels[S.activeTool],
        showConfirmButton: false,
        timer: 3000
      });
    }
  };

  function handleMapClick(e) {
    if (!isAdmin()) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (S.activeTool === 'add-pelanggan') {
      window.gisOpenModalTambahPelanggan(lat, lng);
      window.gisSetTool(null);
    } else if (S.activeTool === 'add-odp') {
      window.gisOpenModalTambahOdp(lat, lng);
      window.gisSetTool(null);
    } else if (S.activeTool === 'add-odc') {
      window.gisOpenModalTambahOdc(lat, lng);
      window.gisSetTool(null);
    } else if (S.activeTool === 'draw-cable') {
      handleDrawCableClick(lat, lng);
    }
  }

  // Modal Tambah Pelanggan + OTOMATIS TARIK KABEL (RINGAN & CEPAT)
  window.gisOpenModalTambahPelanggan = function (lat, lng) {
    const odpsWithDist = S.data.odps.map(o => ({
      name: o.name,
      dist: Math.round(calcDistM(lat, lng, o.lat, o.lng))
    })).sort((a, b) => a.dist - b.dist);

    // Ambil 30 ODP terdekat agar modal terbuka instan (<10ms)
    const closestOdps = odpsWithDist.slice(0, 30);
    const odpOptions = closestOdps.map((o, idx) => `
      <option value="${escapeHtml(o.name)}" ${idx === 0 ? 'selected' : ''}>
        ${escapeHtml(o.name)} (${o.dist} meter) ${idx === 0 ? '⭐ Terdekat' : ''}
      </option>
    `).join('');

    Swal.fire({
      title: '👤 Pasang Baru (PSB)',
      html: `
        <div style="text-align:left; font-size:13px;">
          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">Nama Pelanggan <span style="color:#dc2626;">*</span></label>
            <input type="text" id="swalCustNama" class="swal2-input" placeholder="Nama Pelanggan" style="width:100%; margin:4px 0;">
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">ID Pelanggan (Opsional)</label>
            <input type="text" id="swalCustId" class="swal2-input" placeholder="ID Pelanggan" style="width:100%; margin:4px 0;">
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">ODP Tujuan (Otomatis Tarik Dropcore) <span style="color:#dc2626;">*</span></label>
            <select id="swalCustOdp" class="swal2-select" style="width:100%; margin:4px 0; display:block;">
              ${odpOptions}
            </select>
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">Wilayah</label>
            <select id="swalCustKec" class="swal2-select" style="width:100%; margin:4px 0; display:block;">
              <option value="KECAMATAN SUKODONO">KECAMATAN SUKODONO</option>
              <option value="KECAMATAN KEDUNGJAJANG">KECAMATAN KEDUNGJAJANG</option>
              <option value="KECAMATAN LUMAJANG (KOTA)">KECAMATAN LUMAJANG (KOTA)</option>
              <option value="KECAMATAN RANDUAGUNG">KECAMATAN RANDUAGUNG</option>
              <option value="KECAMATAN KLAKAH">KECAMATAN KLAKAH</option>
              <option value="KECAMATAN TEKUNG">KECAMATAN TEKUNG</option>
              <option value="KECAMATAN SENDURO">KECAMATAN SENDURO</option>
            </select>
          </div>
          <div style="font-size:11px; color:#64748b;">Koordinat: <b>${lat.toFixed(6)}, ${lng.toFixed(6)}</b></div>
        </div>
      `,
      confirmButtonText: '⚡ Simpan & Tarik Dropcore',
      cancelButtonText: 'Batal',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const nama = document.getElementById('swalCustNama').value.trim();
        const id = document.getElementById('swalCustId').value.trim();
        const odp = document.getElementById('swalCustOdp').value;
        const kec = document.getElementById('swalCustKec').value;
        if (!nama) {
          Swal.showValidationMessage('Nama pelanggan wajib diisi!');
          return false;
        }
        return { nama, id, odp, kec, lat, lng };
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        const c = res.value;
        const newCust = {
          id: c.id || ('plg_' + Date.now()),
          nama: c.nama.toUpperCase(),
          lat: c.lat,
          lng: c.lng,
          odp: c.odp,
          kec: c.kec,
          alamat: c.kec,
          hasDropcore: true
        };
        S.data.pelanggans.push(newCust);

        // OTOMATIS TARIK KABEL DROPCORE KE ODP
        const targetOdp = S.data.odps.find(o => o.name === c.odp);
        if (targetOdp) {
          const newDropLine = {
            id: 'drop_' + Date.now(),
            name: `${c.nama} -> ${targetOdp.name}`,
            coords: [
              [c.lat, c.lng],
              [targetOdp.lat, targetOdp.lng]
            ]
          };
          S.data.dropLines.push(newDropLine);
          S.lastAddedCableId = newDropLine.id;
          S.lastAddedCableType = 'dropcore';
        }

        saveLocalData();
        renderAllLayers();
        Swal.fire({ icon: 'success', title: 'Pelanggan & Dropcore Berhasil Ditambahkan!', timer: 2000, showConfirmButton: false });
      }
    });
  };

  // Tambah ODP Baru
  window.gisOpenModalTambahOdp = function (lat, lng) {
    Swal.fire({
      title: '📦 Tambah ODP Baru',
      html: `
        <div style="text-align:left; font-size:13px;">
          <label style="font-weight:700;">Nama / Label ODP <span style="color:#dc2626;">*</span></label>
          <input type="text" id="swalOdpNama" class="swal2-input" placeholder="Contoh: ODP-KT-001/009" style="width:100%; margin:4px 0 10px;">
          <label style="font-weight:700;">Wilayah</label>
          <input type="text" id="swalOdpKec" class="swal2-input" value="KECAMATAN SUKODONO" style="width:100%; margin:4px 0;">
        </div>
      `,
      confirmButtonText: 'Simpan ODP',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      preConfirm: () => {
        const name = document.getElementById('swalOdpNama').value.trim();
        const kec = document.getElementById('swalOdpKec').value.trim();
        if (!name) {
          Swal.showValidationMessage('Nama ODP wajib diisi!');
          return false;
        }
        return { name: name.toUpperCase(), kec, lat, lng };
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        S.data.odps.push({
          id: 'odp_' + Date.now(),
          name: res.value.name,
          lat: res.value.lat,
          lng: res.value.lng,
          kec: res.value.kec
        });
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Tambah ODC Baru
  window.gisOpenModalTambahOdc = function (lat, lng) {
    Swal.fire({
      title: '🏢 Tambah ODC Baru',
      html: `
        <div style="text-align:left; font-size:13px;">
          <label style="font-weight:700;">Nama ODC <span style="color:#dc2626;">*</span></label>
          <input type="text" id="swalOdcNama" class="swal2-input" placeholder="Contoh: ODC-SKDN/03" style="width:100%; margin:4px 0 10px;">
          <label style="font-weight:700;">Wilayah</label>
          <input type="text" id="swalOdcKec" class="swal2-input" value="KECAMATAN SUKODONO" style="width:100%; margin:4px 0;">
        </div>
      `,
      confirmButtonText: 'Simpan ODC',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      preConfirm: () => {
        const name = document.getElementById('swalOdcNama').value.trim();
        const kec = document.getElementById('swalOdcKec').value.trim();
        if (!name) {
          Swal.showValidationMessage('Nama ODC wajib diisi!');
          return false;
        }
        return { name: name.toUpperCase(), kec, lat, lng };
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        S.data.odcs.push({
          id: 'odc_' + Date.now(),
          name: res.value.name,
          lat: res.value.lat,
          lng: res.value.lng,
          kec: res.value.kec
        });
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Tool Tarik Kabel Manual
  function handleDrawCableClick(lat, lng) {
    S.drawPoints.push([lat, lng]);

    if (S.drawPoints.length === 1) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'Titik awal diset. Klik titik tujuan kabel!',
        showConfirmButton: false,
        timer: 3000
      });
      return;
    }

    if (S.drawPoints.length >= 2) {
      const coords = [...S.drawPoints];
      S.drawPoints = [];
      window.gisSetTool(null);

      Swal.fire({
        title: 'Tarik Jalur Kabel Baru',
        html: `
          <div style="text-align:left; font-size:13px;">
            <label style="font-weight:700;">Nama Kabel:</label>
            <input type="text" id="swalCableName" class="swal2-input" value="Jalur Baru" style="width:100%; margin:4px 0 10px;">
            <label style="font-weight:700;">Jenis Kabel:</label>
            <select id="swalCableType" class="swal2-select" style="width:100%; margin:4px 0 10px; display:block;">
              <option value="dropcore">🟡 Drop Core (Kuning)</option>
              <option value="distribusi">🔴 Distribusi (Merah)</option>
              <option value="feeder">🔵 Feeder (Biru)</option>
            </select>
          </div>
        `,
        confirmButtonText: 'Simpan Kabel',
        showCancelButton: true,
        preConfirm: () => {
          return {
            name: document.getElementById('swalCableName').value.trim() || 'Jalur Baru',
            type: document.getElementById('swalCableType').value,
            coords
          };
        }
      }).then(res => {
        if (res.isConfirmed && res.value) {
          const l = {
            id: 'line_' + Date.now(),
            name: res.value.name,
            coords: res.value.coords
          };
          if (res.value.type === 'feeder') S.data.feederLines.push(l);
          else if (res.value.type === 'distribusi') S.data.distLines.push(l);
          else S.data.dropLines.push(l);

          S.lastAddedCableId = l.id;
          S.lastAddedCableType = res.value.type;

          saveLocalData();
          renderAllLayers();
          Swal.fire({ icon: 'success', title: 'Kabel Berhasil Disimpan!', timer: 1800, showConfirmButton: false });
        }
      });
    }
  }

  // Edit Pelanggan
  window.gisEditPelanggan = function (identifier) {
    if (!isAdmin()) return;
    const cust = S.data.pelanggans.find(p => p.id === identifier || p.nama === identifier);
    if (!cust) return;

    Swal.fire({
      title: '✏️ Edit Pelanggan',
      html: `
        <div style="text-align:left; font-size:13px;">
          <label style="font-weight:700;">Nama Pelanggan:</label>
          <input type="text" id="editCustNama" class="swal2-input" value="${escapeHtml(cust.nama)}" style="width:100%; margin:4px 0 10px;">
          <label style="font-weight:700;">ODP Terhubung:</label>
          <input type="text" id="editCustOdp" class="swal2-input" value="${escapeHtml(cust.odp || '-')}" style="width:100%; margin:4px 0 10px;">
          <label style="font-weight:700;">Alamat:</label>
          <input type="text" id="editCustAlamat" class="swal2-input" value="${escapeHtml(cust.alamat || '-')}" style="width:100%; margin:4px 0 10px;">
        </div>
      `,
      confirmButtonText: 'Simpan',
      showCancelButton: true,
      preConfirm: () => {
        return {
          nama: document.getElementById('editCustNama').value.trim().toUpperCase(),
          odp: document.getElementById('editCustOdp').value.trim(),
          alamat: document.getElementById('editCustAlamat').value.trim()
        };
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        cust.nama = res.value.nama;
        cust.odp = res.value.odp;
        cust.alamat = res.value.alamat;
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Hapus Pelanggan
  window.gisDeletePelanggan = function (identifier) {
    if (!isAdmin()) return;
    Swal.fire({
      title: 'Hapus Pelanggan?',
      text: `Hapus ${identifier}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Hapus!'
    }).then(res => {
      if (res.isConfirmed) {
        S.data.pelanggans = S.data.pelanggans.filter(p => p.id !== identifier && p.nama !== identifier);
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Tarik Dropcore Otomatis 1 Pelanggan
  window.gisAutoConnectDropcore = function (identifier) {
    if (!isAdmin()) return;
    const cust = S.data.pelanggans.find(p => p.id === identifier || p.nama === identifier);
    if (!cust) return;

    let targetOdp = null;
    if (cust.odp && cust.odp !== '-') {
      targetOdp = S.data.odps.find(o => o.name.toUpperCase().includes(cust.odp.toUpperCase()) || cust.odp.toUpperCase().includes(o.name.toUpperCase()));
    }

    if (!targetOdp) {
      let minD = Infinity;
      S.data.odps.forEach(o => {
        const d = calcDistM(cust.lat, cust.lng, o.lat, o.lng);
        if (d < minD) { minD = d; targetOdp = o; }
      });
    }

    if (!targetOdp) {
      Swal.fire('Info', 'Tidak ditemukan ODP di dekat pelanggan ini!', 'info');
      return;
    }

    const newDropLine = {
      id: 'drop_' + Date.now(),
      name: `${cust.nama} -> ${targetOdp.name}`,
      coords: [
        [cust.lat, cust.lng],
        [targetOdp.lat, targetOdp.lng]
      ]
    };

    S.data.dropLines.push(newDropLine);
    cust.hasDropcore = true;
    cust.odp = targetOdp.name;

    S.lastAddedCableId = newDropLine.id;
    S.lastAddedCableType = 'dropcore';

    saveLocalData();
    renderAllLayers();
    Swal.fire({ icon: 'success', title: 'Dropcore Terhubung ke ' + targetOdp.name, timer: 1800, showConfirmButton: false });
  };

  // Hapus ODP
  window.gisDeleteOdp = function (odpName) {
    if (!isAdmin()) return;
    Swal.fire({
      title: 'Hapus ODP?',
      text: `Hapus ${odpName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Hapus!'
    }).then(res => {
      if (res.isConfirmed) {
        S.data.odps = S.data.odps.filter(o => o.name !== odpName);
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Edit ODP
  window.gisEditOdp = function (odpName) {
    if (!isAdmin()) return;
    const odp = S.data.odps.find(o => o.name === odpName);
    if (!odp) return;

    Swal.fire({
      title: '✏️ Edit ODP',
      html: `<input type="text" id="editOdpName" class="swal2-input" value="${escapeHtml(odp.name)}" style="width:100%; margin:4px 0;">`,
      confirmButtonText: 'Simpan',
      showCancelButton: true,
      preConfirm: () => document.getElementById('editOdpName').value.trim().toUpperCase()
    }).then(res => {
      if (res.isConfirmed && res.value) {
        odp.name = res.value;
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Navigasi Google Maps (Mobile Friendly)
  window.gisNavigasiGoogleMaps = function (lat, lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  // Otomasi Bulk Pasang Baru (PSB)
  window.gisSyncPsbAutoConnect = async function () {
    if (!isAdmin()) return;
    Swal.fire({
      title: 'Menghubungkan Pasang Baru...',
      html: 'Menarik jalur dropcore otomatis ke ODP tujuan...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    let count = 0;
    S.data.pelanggans.forEach(c => {
      if (!c.hasDropcore) {
        let targetOdp = null;
        if (c.odp && c.odp !== '-') {
          targetOdp = S.data.odps.find(o => o.name.toUpperCase().includes(c.odp.toUpperCase()) || c.odp.toUpperCase().includes(o.name.toUpperCase()));
        }
        if (!targetOdp) {
          let minD = Infinity;
          S.data.odps.forEach(o => {
            const d = calcDistM(c.lat, c.lng, o.lat, o.lng);
            if (d < minD) { minD = d; targetOdp = o; }
          });
        }
        if (targetOdp) {
          S.data.dropLines.push({
            id: 'drop_psb_' + Date.now() + '_' + count,
            name: `${c.nama} -> ${targetOdp.name}`,
            coords: [
              [c.lat, c.lng],
              [targetOdp.lat, targetOdp.lng]
            ]
          });
          c.hasDropcore = true;
          c.odp = targetOdp.name;
          count++;
        }
      }
    });

    saveLocalData();
    renderAllLayers();
    Swal.fire({
      icon: 'success',
      title: 'Tarik Dropcore Selesai',
      text: `${count} pelanggan baru berhasil terhubung ke ODP tujuan!`,
      confirmButtonColor: '#2563eb'
    });
  };

  // ============================================================================
  // 9. IMPORT & EXPORT KML / KMZ (REAL-TIME UPDATE)
  // ============================================================================
  window.gisTriggerImport = function () {
    if (!isAdmin()) {
      Swal.fire('Akses Dibatasi', 'Hanya Admin yang dapat mengimport file KML/KMZ!', 'warning');
      return;
    }
    const input = document.getElementById('gisKmlFileInput');
    if (input) input.click();
  };

  window.gisHandleFileImport = async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    Swal.fire({
      title: 'Memproses ' + file.name + '...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      let kmlText = '';
      if (file.name.toLowerCase().endsWith('.kmz')) {
        if (typeof JSZip === 'undefined') throw new Error('JSZip belum termuat!');
        const zip = await JSZip.loadAsync(file);
        const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'));
        if (!kmlFile) throw new Error('File KML tidak ditemukan di dalam arsip KMZ!');
        kmlText = await kmlFile.async('string');
      } else {
        kmlText = await file.text();
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const placemarks = xmlDoc.getElementsByTagName('Placemark');
      let newOdc = 0, newOdp = 0, newCust = 0, newLines = 0;

      for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];
        const nameEl = pm.getElementsByTagName('name')[0];
        const name = nameEl ? nameEl.textContent.trim() : '';
        const styleEl = pm.getElementsByTagName('styleUrl')[0];
        const style = styleEl ? styleEl.textContent.trim() : '';

        const pointEl = pm.getElementsByTagName('Point')[0];
        const lineEl = pm.getElementsByTagName('LineString')[0];

        if (pointEl) {
          const coordEl = pointEl.getElementsByTagName('coordinates')[0];
          if (coordEl) {
            const parts = coordEl.textContent.trim().split(',').map(Number);
            const lng = parts[0];
            const lat = parts[1];
            if (!isNaN(lat) && !isNaN(lng)) {
              const u = name.toUpperCase();
              if (style.includes('odc') || (u.includes('ODC') && !u.includes('ODP'))) {
                S.data.odcs.push({ id: 'odc_' + Date.now() + '_' + i, name, lat, lng, kec: 'IMPORT' });
                newOdc++;
              } else if (style.includes('odp') || u.includes('ODP') || /^[A-Z]{2,4}[-/_][0-9]+/i.test(u)) {
                S.data.odps.push({ id: 'odp_' + Date.now() + '_' + i, name, lat, lng, kec: 'IMPORT' });
                newOdp++;
              } else {
                S.data.pelanggans.push({
                  id: 'plg_' + Date.now() + '_' + i,
                  nama: name,
                  lat,
                  lng,
                  odp: '-',
                  kec: 'IMPORT',
                  alamat: '-',
                  hasDropcore: false
                });
                newCust++;
              }
            }
          }
        } else if (lineEl) {
          const coordEl = lineEl.getElementsByTagName('coordinates')[0];
          if (coordEl) {
            const pts = coordEl.textContent.trim().split(/\s+/).map(c => {
              const p = c.split(',').map(Number);
              return [p[1], p[0]];
            }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

            if (pts.length >= 2) {
              const lineObj = { id: 'line_' + Date.now() + '_' + i, name: name || 'Jalur Kabel', coords: pts };
              if (style.includes('feeder') || name.toUpperCase().includes('FEEDER')) S.data.feederLines.push(lineObj);
              else if (style.includes('distribusi') || name.toUpperCase().includes('DISTRIBUSI')) S.data.distLines.push(lineObj);
              else S.data.dropLines.push(lineObj);
              newLines++;
            }
          }
        }
      }

      saveLocalData();
      renderAllLayers();

      Swal.fire({
        icon: 'success',
        title: 'Import Berhasil!',
        html: `Memuat: <b>${newOdp}</b> ODP, <b>${newOdc}</b> ODC, <b>${newCust}</b> Pelanggan, <b>${newLines}</b> Jalur kabel.`,
        confirmButtonColor: '#2563eb'
      });
    } catch (err) {
      Swal.fire('Gagal Import', err.message, 'error');
    } finally {
      event.target.value = '';
    }
  };

  // KML Generator
  function generateKmlString() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>JARINGAN FIBER OPTIK NOC MAHAWIRA</name>
    <open>1</open>
    <Style id="style-odc"><IconStyle><color>ff00ffff</color><scale>1.3</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon></IconStyle><LabelStyle><color>ffffffff</color><scale>0.85</scale></LabelStyle></Style>
    <Style id="style-odp"><IconStyle><color>ff0000ff</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon></IconStyle><LabelStyle><color>ffffffff</color><scale>0.8</scale></LabelStyle></Style>
    <Style id="style-pelanggan"><IconStyle><color>ffffffff</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href></Icon></IconStyle><LabelStyle><color>ffffffff</color><scale>0.75</scale></LabelStyle></Style>
    <Style id="style-feeder"><LineStyle><color>ffff0000</color><width>4</width></LineStyle><LabelStyle><scale>0</scale></LabelStyle></Style>
    <Style id="style-distribusi"><LineStyle><color>ff0000ff</color><width>3</width></LineStyle><LabelStyle><scale>0</scale></LabelStyle></Style>
    <Style id="style-dropcore"><LineStyle><color>ff00ffff</color><width>1.8</width></LineStyle><LabelStyle><scale>0</scale></LabelStyle></Style>
    <Folder><name>Jalur Feeder (${S.data.feederLines.length})</name>${S.data.feederLines.map(l => `<Placemark><name>${escapeHtml(l.name)}</name><styleUrl>#style-feeder</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.coords.map(pt => `${pt[1]},${pt[0]},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}</Folder>
    <Folder><name>Jalur Distribusi (${S.data.distLines.length})</name>${S.data.distLines.map(l => `<Placemark><name>${escapeHtml(l.name)}</name><styleUrl>#style-distribusi</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.coords.map(pt => `${pt[1]},${pt[0]},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}</Folder>
    <Folder><name>Jalur Drop Core (${S.data.dropLines.length})</name>${S.data.dropLines.map(l => `<Placemark><name>${escapeHtml(l.name)}</name><styleUrl>#style-dropcore</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.coords.map(pt => `${pt[1]},${pt[0]},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}</Folder>
    <Folder><name>Titik ODC (${S.data.odcs.length})</name>${S.data.odcs.map(o => `<Placemark><name>${escapeHtml(o.name)}</name><styleUrl>#style-odc</styleUrl><Point><coordinates>${o.lng},${o.lat},0</coordinates></Point></Placemark>`).join('')}</Folder>
    <Folder><name>Titik ODP (${S.data.odps.length})</name>${S.data.odps.map(o => `<Placemark><name>${escapeHtml(o.name)}</name><styleUrl>#style-odp</styleUrl><Point><coordinates>${o.lng},${o.lat},0</coordinates></Point></Placemark>`).join('')}</Folder>
    <Folder><name>Titik Pelanggan (${S.data.pelanggans.length})</name>${S.data.pelanggans.map(c => `<Placemark><name>${escapeHtml(c.nama)}</name><styleUrl>#style-pelanggan</styleUrl><description><![CDATA[ID: ${escapeHtml(c.id || '-')}<br>ODP: ${escapeHtml(c.odp || '-')}]]></description><Point><coordinates>${c.lng},${c.lat},0</coordinates></Point></Placemark>`).join('')}</Folder>
  </Document>
</kml>`;
  }

  window.gisExportKml = function () {
    const kml = generateKmlString();
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JARINGAN_MAHAWIRA_${new Date().toISOString().slice(0, 10)}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.gisExportKmz = async function () {
    if (typeof JSZip === 'undefined') {
      window.gisExportKml();
      return;
    }
    const zip = new JSZip();
    zip.file('doc.kml', generateKmlString());
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JARINGAN_MAHAWIRA_${new Date().toISOString().slice(0, 10)}.kmz`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // GPS Live Tracking
  window.gisLocateUser = function () {
    if (!navigator.geolocation) {
      Swal.fire('GPS', 'Geolocation tidak didukung.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        S.layers.userGps.clearLayers();

        L.circle([lat, lng], { radius: accuracy, color: '#2563eb', fillOpacity: 0.15 }).addTo(S.layers.userGps);

        const marker = L.circleMarker([lat, lng], {
          radius: 9,
          fillColor: '#2563eb',
          color: '#ffffff',
          weight: 3,
          fillOpacity: 1
        }).addTo(S.layers.userGps);

        const nearby = S.data.odps.map(o => ({
          name: o.name,
          dist: Math.round(calcDistM(lat, lng, o.lat, o.lng))
        })).sort((a, b) => a.dist - b.dist).slice(0, 3);

        const nearbyText = nearby.map(o => `<li><b>${escapeHtml(o.name)}</b>: ${o.dist} meter</li>`).join('');

        marker.bindPopup(`
          <div style="font-family:'Segoe UI',sans-serif; padding:10px; font-size:12px; color:#1e293b;">
            <div style="font-weight:800; color:#2563eb; margin-bottom:4px;">📍 POSISI ANDA</div>
            <div>Akurasi GPS: &plusmn;${accuracy} m</div>
            <hr style="margin:6px 0; border:none; border-top:1px solid #e2e8f0;">
            <div style="font-weight:700;">ODP Terdekat:</div>
            <ul style="margin:4px 0 0 16px; padding:0;">${nearbyText}</ul>
          </div>
        `).openPopup();

        S.map.flyTo([lat, lng], 17);
      },
      err => {
        Swal.fire('GPS', err.message, 'warning');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Layer Toggle
  window.gisToggleLayer = function (layerKey) {
    const layer = S.layers[layerKey];
    if (!layer || !S.map) return;
    const btn = document.querySelector(`.gis-pill[data-layer="${layerKey}"]`);
    if (S.map.hasLayer(layer)) {
      S.map.removeLayer(layer);
      if (btn) btn.classList.remove('active');
    } else {
      S.map.addLayer(layer);
      if (btn) btn.classList.add('active');
    }
  };

  // Switch Base Layer
  window.gisSwitchBaseLayer = function (type) {
    Object.values(S.baseLayers).forEach(l => {
      if (S.map.hasLayer(l)) S.map.removeLayer(l);
    });
    if (S.baseLayers[type]) {
      S.baseLayers[type].addTo(S.map);
      S.activeBaseLayer = type;
    }
  };

  // Filter Kecamatan
  window.gisFilterKecamatan = function (kec) {
    S.filterKecamatan = kec;
    renderAllLayers();
  };

  // Fullscreen
  window.gisToggleFullscreen = function () {
    const container = document.getElementById('gisMapContainer');
    if (!container) return;
    if (!document.fullscreenElement) container.requestFullscreen().catch(() => { });
    else document.exitFullscreen().catch(() => { });
    setTimeout(() => { S.map.invalidateSize(); }, 300);
  };

  // Pasang Baru (PSB) Registration Hook
  window.gisRegisterPsbCustomer = function (nama, id, odpName, lat, lng, alamat, kec) {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    const newCust = {
      id: id || ('plg_' + Date.now()),
      nama: String(nama || 'PELANGGAN BARU').toUpperCase(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      odp: odpName || '-',
      kec: kec || 'KECAMATAN SUKODONO',
      alamat: alamat || '-',
      hasDropcore: true
    };
    S.data.pelanggans.push(newCust);

    let targetOdp = null;
    if (odpName && odpName !== '-') {
      targetOdp = S.data.odps.find(o => o.name.toUpperCase().includes(odpName.toUpperCase()) || odpName.toUpperCase().includes(o.name.toUpperCase()));
    }
    if (!targetOdp) {
      let minD = Infinity;
      S.data.odps.forEach(o => {
        const d = calcDistM(lat, lng, o.lat, o.lng);
        if (d < minD) { minD = d; targetOdp = o; }
      });
    }

    if (targetOdp) {
      const newDropLine = {
        id: 'drop_psb_' + Date.now(),
        name: `${newCust.nama} -> ${targetOdp.name}`,
        coords: [[parseFloat(lat), parseFloat(lng)], [targetOdp.lat, targetOdp.lng]]
      };
      S.data.dropLines.push(newDropLine);
      newCust.odp = targetOdp.name;
      S.lastAddedCableId = newDropLine.id;
      S.lastAddedCableType = 'dropcore';
    }
    saveLocalData();
    renderAllLayers();
  };

  window.initNetworkMap = initNetworkMap;

})();
