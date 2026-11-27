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
      searchPin: null,
      lainnya: null
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
      dropLines: [],
      cutPoints: []
    },
    filterKecamatan: 'ALL',
    activeTool: null, // 'add-pelanggan', 'add-odp', 'add-odc', 'draw-cable'
    pendingDropcoreCust: null,
    pendingDropcoreOdp: null,
    pendingMovePin: null,
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

  // UKURAN DINAMIS JALUR KABEL BERDASARKAN LEVEL ZOOM
  // Saat Zoom Out (Jauh): kabel diperbesar agar sangat mudah diklik dan diarahkan kursor
  // Saat Zoom In (Dekat): kabel diperkecil agar presisi, rapi, dan tidak menutupi jalan/bangunan
  function getCableWeight(type, zoom) {
    const isMobile = window.innerWidth <= 768;
    const m = isMobile ? 1.25 : 1.0;
    const z = typeof zoom === 'number' ? zoom : (S.map ? S.map.getZoom() : 16);

    if (z <= 12) {
      if (type === 'feeder') return 8.5 * m;
      if (type === 'distribusi') return 7.0 * m;
      return 5.5 * m; // dropcore
    } else if (z <= 14) {
      if (type === 'feeder') return 7.0 * m;
      if (type === 'distribusi') return 5.8 * m;
      return 4.4 * m;
    } else if (z <= 16) {
      if (type === 'feeder') return 4.8 * m;
      if (type === 'distribusi') return 3.8 * m;
      return 2.8 * m;
    } else if (z <= 17) {
      if (type === 'feeder') return 3.4 * m;
      if (type === 'distribusi') return 2.6 * m;
      return 1.8 * m;
    } else {
      // Zoom in sangat dekat (>= 18): kabel ramping dan rapi
      if (type === 'feeder') return 2.6 * m;
      if (type === 'distribusi') return 2.0 * m;
      return 1.4 * m;
    }
  }

  // Update bobot garis kabel real-time saat zoom berubah (cepat <1ms tanpa re-render semua layer)
  function updateDynamicCableWeights() {
    if (!S.map) return;
    const z = S.map.getZoom();
    const wFeeder = getCableWeight('feeder', z);
    const wDist = getCableWeight('distribusi', z);
    const wDrop = getCableWeight('dropcore', z);

    if (S.layers.feeder) {
      S.layers.feeder.eachLayer(l => {
        if (l && typeof l.setStyle === 'function') l.setStyle({ weight: wFeeder });
      });
    }
    if (S.layers.distribusi) {
      S.layers.distribusi.eachLayer(l => {
        if (l && typeof l.setStyle === 'function') l.setStyle({ weight: wDist });
      });
    }
    if (S.layers.dropcore) {
      S.layers.dropcore.eachLayer(l => {
        if (l && typeof l.setStyle === 'function') l.setStyle({ weight: wDrop });
      });
    }
  }
  window.updateDynamicCableWeights = updateDynamicCableWeights;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJsAttr(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // ============================================================================
  // 1. INJEKSI CSS STYLING TERANG / PUTIH BERSIH (NO BACKGROUND HITAM)
  // ============================================================================
  function injectMapStyles() {
    if (document.getElementById('gisMapCustomStyles')) return;
    const style = document.createElement('style');
    style.id = 'gisMapCustomStyles';
    style.innerHTML = `
      /* KUNCI BODY HP: HANYA BERLAKU DI LAYAR MOBILE / SMARTPHONE */
      @media (max-width: 768px) {
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
          padding: 6px 10px !important;
          margin-bottom: 6px !important;
          height: 44px !important;
          min-height: 44px !important;
          flex-shrink: 0 !important;
          box-sizing: border-box !important;
          z-index: 1025 !important;
          background: #ffffff !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        body.gis-tab-active .top-bar h1 {
          font-size: 15px !important;
          font-weight: 800 !important;
          margin: 0 !important;
          color: #0f172a !important;
          display: block !important;
        }

        body.gis-tab-active .top-bar > div:last-child {
          display: none !important;
        }

        body.gis-tab-active #gisMapSection {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          height: calc(100% - 50px) !important;
          padding: 0 4px 4px 4px !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }
      }

      /* TAMPILAN DESKTOP LAPTOP: LEGA, MENYESUAIKAN DENGAN SIDEBAR TANPA OVERLAP / GLITCH HITAM */
      @media (min-width: 769px) {
        body.gis-tab-active {
          overflow: hidden !important;
        }
        body.gis-tab-active .main {
          height: 100vh !important;
          max-height: 100vh !important;
          padding: 6px 14px 10px !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        body.gis-tab-active .top-bar {
          height: 48px !important;
          min-height: 48px !important;
          margin-bottom: 8px !important;
          padding: 6px 14px !important;
          flex-shrink: 0 !important;
          z-index: 1025 !important;
          background: #ffffff !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        body.gis-tab-active .top-bar h1 {
          font-size: 18px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          display: block !important;
        }
        body.gis-tab-active #gisMapSection {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          height: calc(100% - 44px) !important;
          padding: 0 !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
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
        min-width: 280px;
        max-width: 90vw;
        background: #ffffff;
        border: 1.5px solid #2563eb;
        border-radius: 8px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.3);
        max-height: 280px;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        overscroll-behavior: contain !important;
        z-index: 9999999 !important;
        padding: 4px;
      }
      @media (max-width: 768px) {
        .gis-search-dropdown {
          position: absolute !important;
          top: calc(100% + 4px) !important;
          left: 0 !important;
          width: max(280px, calc(100vw - 32px)) !important;
          max-width: calc(100vw - 32px) !important;
          max-height: 52vh !important;
          z-index: 9999999 !important;
          box-shadow: 0 16px 36px rgba(0,0,0,0.35) !important;
        }
      }

      @keyframes gisPulseBanner {
        from { transform: translateX(-50%) scale(1); box-shadow: 0 10px 25px rgba(37,99,235,0.4); }
        to { transform: translateX(-50%) scale(1.02); box-shadow: 0 12px 32px rgba(37,99,235,0.7); }
      }
      .leaflet-tile {
        outline: 1px solid transparent;
      }

      /* Icon transparan untuk marker divIcon kustom agar tidak ada background kotak putih Leaflet */
      .custom-cust-icon,
      .custom-odp-icon,
      .custom-odc-icon {
        background: transparent !important;
        border: none !important;
      }

      /* Pin Pelanggan Mati / Padam (Sesuai Cek Modem) */
      .marker-cust-dead {
        width: 28px;
        height: 36px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 40' width='32' height='40'%3E%3Cdefs%3E%3CradialGradient id='gr' cx='35%25' cy='35%25' r='65%25'%3E%3Cstop offset='0%25' stop-color='%23fecaca'/%3E%3Cstop offset='50%25' stop-color='%23ef4444'/%3E%3Cstop offset='100%25' stop-color='%23b91c1c'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d='M16 22 L15 39 L17 39 Z' fill='%23475569' stroke='%231e293b' stroke-width='0.5'/%3E%3Ccircle cx='16' cy='14' r='11' fill='url(%23gr)' stroke='%23991b1b' stroke-width='1.5'/%3E%3Ccircle cx='13' cy='11' r='3.5' fill='%23fff' fill-opacity='0.6'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
        filter: drop-shadow(0 0 5px #ef4444);
      }
      .marker-cust-dead::after {
        content: 'PADAM';
        position: absolute;
        top: -4px;
        right: -8px;
        background: #dc2626;
        color: #ffffff;
        font-size: 8px;
        font-weight: 900;
        padding: 1px 4px;
        border-radius: 6px;
        border: 1px solid #ffffff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        line-height: 1.1;
      }
      .marker-cust-online {
        width: 28px;
        height: 36px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 40' width='32' height='40'%3E%3Cdefs%3E%3CradialGradient id='gg' cx='35%25' cy='35%25' r='65%25'%3E%3Cstop offset='0%25' stop-color='%23bbf7d0'/%3E%3Cstop offset='50%25' stop-color='%2322c55e'/%3E%3Cstop offset='100%25' stop-color='%2315803d'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d='M16 22 L15 39 L17 39 Z' fill='%23475569' stroke='%231e293b' stroke-width='0.5'/%3E%3Ccircle cx='16' cy='14' r='11' fill='url(%23gg)' stroke='%23166534' stroke-width='1.5'/%3E%3Ccircle cx='13' cy='11' r='3.5' fill='%23fff' fill-opacity='0.6'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
      }
      .marker-cust-online::after {
        content: '';
        position: absolute;
        top: 2px;
        right: 0px;
        width: 9px;
        height: 9px;
        background: #16a34a;
        border: 1.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(22, 163, 74, 0.9);
      }
      .marker-cust-online-nodrop {
        width: 28px;
        height: 36px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 40' width='32' height='40'%3E%3Cdefs%3E%3CradialGradient id='go' cx='35%25' cy='35%25' r='65%25'%3E%3Cstop offset='0%25' stop-color='%23ffedd5'/%3E%3Cstop offset='50%25' stop-color='%23f97316'/%3E%3Cstop offset='100%25' stop-color='%23c2410c'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d='M16 22 L15 39 L17 39 Z' fill='%23475569' stroke='%231e293b' stroke-width='0.5'/%3E%3Ccircle cx='16' cy='14' r='11' fill='url(%23go)' stroke='%239a3412' stroke-width='1.5'/%3E%3Ccircle cx='13' cy='11' r='3.5' fill='%23fff' fill-opacity='0.6'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
      }
      .marker-cust-online-nodrop::after {
        content: '!';
        position: absolute;
        top: -3px;
        right: -3px;
        width: 14px;
        height: 14px;
        background: #f59e0b;
        color: white;
        border-radius: 50%;
        font-size: 9px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      .earth-label-dead {
        background: #fee2e2 !important;
        color: #991b1b !important;
        border: 1.5px solid #dc2626 !important;
        font-weight: 800 !important;
        box-shadow: 0 2px 6px rgba(220,38,38,0.25) !important;
      }
      .earth-label-online {
        background: #ffffff !important;
        border: 1.5px solid #16a34a !important;
        color: #14532d !important;
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

      /* Optimasi Zooming & Panning Ringan di HP (60 FPS) */
      .earth-label {
        pointer-events: none !important;
        user-select: none;
      }
      .leaflet-zoom-anim .leaflet-zoom-animated {
        will-change: transform;
      }

      /* Penanda Khusus Titik Koordinat Hasil Pencarian */
      .custom-search-beacon {
        background: transparent !important;
        border: none !important;
      }
      .gis-search-beacon-wrap {
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        cursor: pointer;
      }
      .gis-beacon-center {
        position: relative;
        z-index: 999999;
        animation: gisTargetBounce 0.9s infinite alternate ease-in-out;
      }
      .gis-beacon-label {
        position: absolute;
        top: -26px;
        left: 50%;
        transform: translateX(-50%);
        background: #dc2626;
        color: #ffffff;
        font-size: 10px;
        font-weight: 900;
        padding: 3px 8px;
        border-radius: 12px;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px rgba(220,38,38,0.85);
        white-space: nowrap;
        letter-spacing: 0.5px;
        z-index: 999999;
        pointer-events: none;
      }
      .gis-beacon-wave {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.4);
        border: 2px solid #dc2626;
        animation: gisBeaconWave 1.6s infinite ease-out;
        pointer-events: none;
        z-index: 10;
      }
      .gis-beacon-wave.wave-2 {
        animation-delay: 0.8s;
      }
      @keyframes gisBeaconWave {
        0% { width: 14px; height: 14px; opacity: 1; border-width: 3px; }
        100% { width: 90px; height: 90px; opacity: 0; border-width: 1px; }
      }
      @keyframes gisTargetBounce {
        0% { transform: translateY(0) scale(1); }
        100% { transform: translateY(-7px) scale(1.15); }
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
        touch-action: pan-x pan-y;
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

      /* POPUP MODAL: RESPONSIVE TEPAT DI ATAS TITIK PIN & BISA DI-SCROLL */
      .leaflet-popup {
        max-width: calc(100vw - 20px) !important;
        margin-bottom: 8px !important;
        z-index: 999999 !important;
      }
      .leaflet-popup-content-wrapper {
        padding: 0 !important;
        border-radius: 14px !important;
        overflow: hidden !important;
        box-shadow: 0 12px 32px rgba(0,0,0,0.28) !important;
        border: 1.5px solid #cbd5e1 !important;
        background: #ffffff !important;
        max-width: calc(100vw - 24px) !important;
        box-sizing: border-box !important;
      }
      .leaflet-popup-content {
        margin: 0 !important;
        line-height: 1.4 !important;
        width: min(300px, calc(100vw - 32px)) !important;
        max-width: calc(100vw - 32px) !important;
        max-height: 60vh !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        box-sizing: border-box !important;
      }
      .leaflet-popup-tip {
        background: #ffffff !important;
        box-shadow: 0 3px 6px rgba(0,0,0,0.15) !important;
      }
      .leaflet-container a.leaflet-popup-close-button {
        top: 8px !important;
        right: 8px !important;
        width: 26px !important;
        height: 26px !important;
        background: #f1f5f9 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 50% !important;
        color: #475569 !important;
        font-size: 16px !important;
        font-weight: 900 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
        z-index: 10 !important;
      }

      .earth-label {
        background: #ffffff !important;
        border: 1.5px solid #2563eb !important;
        border-radius: 6px !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
        color: #0f172a !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        font-weight: 800 !important;
        font-size: 10.5px !important;
        padding: 2px 7px !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        letter-spacing: 0.3px !important;
      }
      .earth-label::before {
        display: none !important;
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
        width: 28px;
        height: 36px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 40' width='32' height='40'%3E%3Cdefs%3E%3CradialGradient id='gy' cx='35%25' cy='35%25' r='65%25'%3E%3Cstop offset='0%25' stop-color='%23fef08a'/%3E%3Cstop offset='50%25' stop-color='%23eab308'/%3E%3Cstop offset='100%25' stop-color='%23ca8a04'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d='M16 22 L15 39 L17 39 Z' fill='%23475569' stroke='%231e293b' stroke-width='0.5'/%3E%3Ccircle cx='16' cy='14' r='11' fill='url(%23gy)' stroke='%23a16207' stroke-width='1.5'/%3E%3Ccircle cx='13' cy='11' r='3.5' fill='%23fff' fill-opacity='0.6'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
      }
      .marker-yellow-pin-unconnected {
        width: 28px;
        height: 36px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 40' width='32' height='40'%3E%3Cdefs%3E%3CradialGradient id='gu' cx='35%25' cy='35%25' r='65%25'%3E%3Cstop offset='0%25' stop-color='%23ffedd5'/%3E%3Cstop offset='50%25' stop-color='%23f97316'/%3E%3Cstop offset='100%25' stop-color='%23c2410c'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d='M16 22 L15 39 L17 39 Z' fill='%23475569' stroke='%231e293b' stroke-width='0.5'/%3E%3Ccircle cx='16' cy='14' r='11' fill='url(%23gu)' stroke='%239a3412' stroke-width='1.5'/%3E%3Ccircle cx='13' cy='11' r='3.5' fill='%23fff' fill-opacity='0.6'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
      }
      .marker-yellow-pin-unconnected::after {
        content: '!';
        position: absolute;
        top: -3px;
        right: -3px;
        width: 14px;
        height: 14px;
        background: #dc2626;
        color: white;
        border-radius: 50%;
        font-size: 10px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }

      /* MODAL FLOATING CARD ELEGAN & MODERN (TAMPIL DI ATAS PETA - PIN DI BAWAHNYA TIDAK TERTUTUP) */
      .gis-center-modal {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translate(-50%, -10px) scale(0.97);
        width: calc(100% - 24px);
        max-width: 375px;
        max-height: 55vh;
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 20px 45px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(226, 232, 240, 0.9), 0 8px 16px -4px rgba(0, 0, 0, 0.08);
        z-index: 9999999;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        display: none;
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }
      .gis-center-modal.show {
        display: block !important;
        opacity: 1 !important;
        transform: translate(-50%, 0) scale(1) !important;
      }

      /* Tombol Tutup Floating Frosted Glass */
      .gis-modal-close-btn {
        position: absolute;
        top: 10px;
        right: 12px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(203, 213, 225, 0.8);
        color: #475569;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 100;
      }
      .gis-modal-close-btn:hover {
        background: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
        transform: scale(1.1);
      }

      /* Marker Titik Potong / Ujung Kabel */
      .custom-cut-icon {
        background: transparent !important;
        border: none !important;
      }
      .marker-cut-endpoint {
        position: relative;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .cut-ping-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.35);
        border: 2px solid #ef4444;
        animation: cutPing 1.8s infinite cubic-bezier(0, 0, 0.2, 1);
      }
      @keyframes cutPing {
        0% { transform: scale(0.8); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      .cut-core-badge {
        position: relative;
        z-index: 10;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #ef4444;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(220, 38, 38, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #ffffff;
      }

      /* Efek Animasi Sambung Kabel (Electric Welding Flash & Spark) */
      .gis-weld-anim-icon {
        background: transparent !important;
        border: none !important;
      }
      .gis-weld-wrapper {
        position: relative;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .gis-weld-shockwave {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 3px solid #10b981;
        background: rgba(16, 185, 129, 0.4);
        box-shadow: 0 0 25px #10b981, inset 0 0 15px #34d399;
        animation: gisWeldExpand 1.1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
      }
      .gis-weld-shockwave-2 {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid #38bdf8;
        background: rgba(56, 189, 248, 0.35);
        box-shadow: 0 0 30px #38bdf8;
        animation: gisWeldExpand 1.1s 0.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
      }
      .gis-weld-core {
        position: relative;
        z-index: 30;
        font-size: 26px;
        animation: gisWeldSpark 0.2s infinite alternate;
        filter: drop-shadow(0 0 10px #fef08a);
      }
      @keyframes gisWeldExpand {
        0% { transform: scale(0.2); opacity: 1; }
        60% { transform: scale(1.6); opacity: 0.8; }
        100% { transform: scale(2.8); opacity: 0; }
      }
      @keyframes gisWeldSpark {
        0% { transform: scale(0.9) rotate(-15deg); }
        100% { transform: scale(1.35) rotate(20deg); }
      }

      /* Snap Target Beacon */
      .gis-snap-target {
        animation: gisSnapPulse 0.8s infinite alternate !important;
        box-shadow: 0 0 0 4px #10b981, 0 0 20px #10b981 !important;
      }
      @keyframes gisSnapPulse {
        0% { transform: scale(1); filter: brightness(1); }
        100% { transform: scale(1.3); filter: brightness(1.5); }
      }

      .earth-label-target {
        background: #ffffff !important;
        border: 2px solid #1d4ed8 !important;
        color: #1d4ed8 !important;
        font-weight: 900 !important;
        font-size: 11px !important;
        box-shadow: 0 3px 10px rgba(29,78,216,0.4) !important;
        z-index: 999999 !important;
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

    const urlParams = new URLSearchParams(window.location.search);
    const pLat = parseFloat(urlParams.get('lat'));
    const pLng = parseFloat(urlParams.get('lng'));
    const pName = urlParams.get('name') || urlParams.get('id') || 'Lokasi Pelanggan';
    const pId = urlParams.get('id') || '';
    const hasInitialCoord = !isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0;

    if (S.map) {
      setTimeout(() => { S.map.invalidateSize(); }, 200);
      applyRoleAccessToUi();
      if (hasInitialCoord) {
        window.gisSelectSearchResult(pLat, pLng, 'pelanggan', pName, pId);
      }
      return;
    }

    console.log('🗺️ Inisialisasi Peta Jaringan FTTH Mahawira (High-Performance Engine)...');

    let initialCenter = [-8.133, 113.224];
    let initialZoom = 14;
    if (hasInitialCoord) {
      initialZoom = 17;
      const isMobile = window.innerWidth <= 768;
      const offY = isMobile ? Math.round(window.innerHeight * 0.18) : Math.round(window.innerHeight * 0.12);
      const latOffsetDeg = (offY / 256) * (360 / Math.pow(2, 17));
      initialCenter = [pLat + latOffsetDeg, pLng];
    }

    // Buat Peta Leaflet Berpusat LANGSUNG di bawah modal (SVG Renderer Murni: 100% presisi akurat di jalan)
    S.map = L.map('gisMapContainer', {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      maxZoom: 24,
      preferCanvas: false, // SVG Renderer Murni: Presisi 100% di jalan & pin, 0 drift, kabel tidak lari / berantakan
      zoomAnimation: true,
      fadeAnimation: true,
      wheelPxPerZoomLevel: 120
    });

    // Custom Pane Khusus Pin Target yang Dicari (Z-INDEX 900: DI ATAS SEMUA PIN & TOOLTIP LAINNYA)
    if (!S.map.getPane('searchPinPane')) {
      const spPane = S.map.createPane('searchPinPane');
      spPane.style.zIndex = '900';
    }

    // Kontrol Zoom di Kanan Bawah
    L.control.zoom({ position: 'bottomright' }).addTo(S.map);

    // BASEMAP SATELIT GOOGLE HYBRID (MULTI-SUBDOMAIN MT0-MT3 & AUTO-SCALED ZOOM)
    const googleHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 24,
      maxNativeZoom: 20,
      attribution: 'Satelit &copy; Google Maps'
    });

    const googleSat = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 24,
      maxNativeZoom: 20,
      attribution: 'Satelit Murni &copy; Google'
    });

    const googleStreets = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 24,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps'
    });

    const esriWorld = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 24,
      maxNativeZoom: 19,
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
    S.layers.pelangganMati = L.layerGroup().addTo(S.map);
    S.layers.userGps = L.layerGroup().addTo(S.map);
    S.layers.searchPin = L.layerGroup().addTo(S.map);
    S.layers.cutPoints = L.layerGroup().addTo(S.map);
    S.layers.lainnya = L.layerGroup(); // Hidden by default

    // Jika dibuka langsung via Bot Telegram dengan parameter lat & lng, tampilkan beacon dan buka modal seketika!
    if (hasInitialCoord) {
      setTimeout(() => {
        if (typeof window.gisSelectSearchResult === 'function') {
          window.gisSelectSearchResult(pLat, pLng, 'pelanggan', pName, pId);
        }
      }, 50);
    }

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
      // Hanya hentikan event scroll (wheel & touchmove) agar tap/click item hasil pencarian tetap berfungsi normal di HP!
      ['wheel', 'mousewheel', 'DOMMouseScroll', 'touchmove'].forEach(evt => {
        searchDropdown.addEventListener(evt, e => e.stopPropagation(), { passive: true });
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

    // Debounced listener untuk Mobilitas Super Ringan di HP (60 FPS tanpa stutter)
    let lastRenderedZoomMode = null;
    let renderTimer = null;
    function schedulePelangganRender(force = false) {
      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        const curZoom = S.map ? S.map.getZoom() : 0;
        const curMode = curZoom < 15 ? 'low' : (curZoom < 17 ? 'mid' : 'high');
        // Saat panning / geser peta biasa: JANGAN hapus & buat ulang marker! Peta 100% instan 60 FPS
        if (!force && lastRenderedZoomMode === curMode) {
          return;
        }
        lastRenderedZoomMode = curMode;
        window.gisRenderPelangganMarkers();
      }, 80);
    }

    // Hanya render ulang saat zoom berubah mode (misal dari jauh ke dekat)
    S.map.on('zoomend', () => {
      schedulePelangganRender(false);
      updateDynamicCableWeights();
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
  // 3. LOAD & SIMPAN DATA JARINGAN (MULTI-DEVICE CLOUD & DISK SYNC)
  // ============================================================================
  let lastKnownMapUpdateTs = '0';
  let isMapSyncing = false;

  async function loadInitialData() {
    try {
      let json = null;

      // 1. ULTRA-FAST LOCAL CACHE (5ms): Buka peta langsung seketika dari cache browser tanpa tunggu download
      try {
        const cachedRaw = localStorage.getItem('mahawira_map_network_cache_v2');
        if (cachedRaw) {
          const parsedCache = JSON.parse(cachedRaw);
          if (parsedCache && parsedCache.data && (parsedCache.data.pelanggans || parsedCache.data.odps)) {
            json = parsedCache.data;
            lastKnownMapUpdateTs = String(parsedCache.ts || '0');
            console.log('⚡ [MAP GIS] Peta dimuat INSTAN dari Local Cache Browser (~5ms)');
          }
        }
      } catch (_) { }

      // 2. Jika belum ada cache lokal, unduh dari disk CDN Vercel
      if (!json) {
        try {
          const res = await fetch('data/map_network.json?v=' + Date.now());
          if (res.ok) {
            json = await res.json();
            console.log('⚡ [MAP GIS] Memuat data jaringan pertama kali dari disk CDN (~50ms)');
            try {
              localStorage.setItem('mahawira_map_network_cache_v2', JSON.stringify({ data: json, ts: Date.now() }));
            } catch (_) { }
          }
        } catch (e) {
          console.warn('[MAP GIS] Gagal load file lokal disk:', e);
        }
      }

      // 2. Fallback ke Supabase Cloud jika file lokal belum siap
      if (!json && window.sb) {
        try {
          const { data: supaRow, error } = await window.sb
            .from('app_settings')
            .select('setting_value, updated_at')
            .eq('setting_key', 'map_network_full')
            .maybeSingle();

          if (!error && supaRow && supaRow.setting_value) {
            const parsed = typeof supaRow.setting_value === 'string' ? JSON.parse(supaRow.setting_value) : supaRow.setting_value;
            if (parsed && (parsed.pelanggans || parsed.odps)) {
              json = parsed;
              console.log('☁️ [MAP GIS] Berhasil memuat data jaringan dari Supabase Cloud');
            }
          }
        } catch (supaErr) {
          console.warn('[MAP GIS] Gagal load dari Supabase Cloud:', supaErr.message);
        }
      }

      // Ambil timestamp update terakhir di background tanpa membebani HP
      if (window.sb) {
        setTimeout(async () => {
          try {
            const { data: tsRow } = await window.sb
              .from('app_settings')
              .select('setting_value')
              .eq('setting_key', 'map_network_last_update')
              .maybeSingle();
            if (tsRow && tsRow.setting_value) {
              lastKnownMapUpdateTs = String(tsRow.setting_value);
            }
          } catch (_) { }
        }, 1500);
      }

      function deduplicatePelanggans(list) {
        if (!Array.isArray(list)) return [];
        const result = [];
        const seen = [];
        list.forEach(p => {
          if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
          const cleanName = (p.nama || '').trim().toUpperCase();
          const hasRealId = p.id && !String(p.id).startsWith('plg_') && p.id !== '-';

          const dupIdx = seen.findIndex(s => {
            const sameName = cleanName && s.name && cleanName === s.name;
            const d = Math.hypot(p.lat - s.lat, p.lng - s.lng);
            const sameCoord = d < 0.00025; // ~25 meter
            const sameId = hasRealId && s.id && p.id === s.id;
            return sameId || (sameName && sameCoord);
          });

          if (dupIdx === -1) {
            seen.push({ name: cleanName, id: p.id, lat: p.lat, lng: p.lng });
            result.push(p);
          } else {
            const existing = result[dupIdx];
            if (hasRealId && (!existing.id || String(existing.id).startsWith('plg_') || existing.id === '-')) {
              existing.id = p.id;
            }
            if (cleanName && (!existing.nama || existing.nama.length < cleanName.length)) {
              existing.nama = cleanName;
            }
            if (p.odp && p.odp !== '-' && (!existing.odp || existing.odp === '-')) {
              existing.odp = p.odp;
            }
            if (p.alamat && p.alamat !== '-' && (!existing.alamat || existing.alamat === '-')) {
              existing.alamat = p.alamat;
            }
            if (p.modemData && !existing.modemData) {
              existing.modemData = p.modemData;
              existing.isModemDead = p.isModemDead;
            }
          }
        });
        return result;
      }
      window.deduplicatePelanggans = deduplicatePelanggans;

      if (json) {
        S.data = {
          odcs: json.odcs || [],
          odps: json.odps || [],
          pelanggans: deduplicatePelanggans(json.pelanggans || []),
          closures: json.closures || [],
          lainnya: json.lainnya || [],
          feederLines: json.feederLines || [],
          distLines: json.distLines || [],
          dropLines: json.dropLines || [],
          cutPoints: Array.isArray(json.cutPoints) ? json.cutPoints : []
        };

        // Cross-reference dengan window.allPelangganData jika sudah dimuat dari Supabase di script.js
        if (window.allPelangganData && Array.isArray(window.allPelangganData)) {
          window.allPelangganData.forEach(sp => {
            if (sp.nama) {
              const cleanSpName = sp.nama.trim().toUpperCase();
              let coord = null;
              if (sp.taging_lokasi && sp.taging_lokasi !== '-') {
                coord = parseCoordinates(sp.taging_lokasi);
              }

              const cust = S.data.pelanggans.find(p => {
                const sameName = p.nama && p.nama.trim().toUpperCase() === cleanSpName;
                const sameCoord = coord && Math.hypot(p.lat - coord.lat, p.lng - coord.lng) < 0.00025;
                return sameName || sameCoord;
              });

              if (cust) {
                if (sp.id_pelanggan && sp.id_pelanggan !== '-' && (!cust.id || cust.id === '-' || cust.id.startsWith('plg_'))) {
                  cust.id = sp.id_pelanggan.trim();
                }
                if (cleanSpName && (!cust.nama || cust.nama.length < cleanSpName.length)) {
                  cust.nama = cleanSpName;
                }
                if (sp.odp && sp.odp !== '-') cust.odp = sp.odp;
                if (sp.alamat && sp.alamat !== '-') cust.alamat = sp.alamat;
                if (coord && (!cust.lat || !cust.lng)) {
                  cust.lat = coord.lat;
                  cust.lng = coord.lng;
                }
              } else if (coord) {
                S.data.pelanggans.push({
                  id: sp.id_pelanggan || ('plg_' + (sp.id || Date.now())),
                  nama: cleanSpName,
                  lat: coord.lat,
                  lng: coord.lng,
                  odp: sp.odp || '-',
                  kec: sp.alamat || 'KECAMATAN SUKODONO',
                  alamat: sp.alamat || '-',
                  hasDropcore: false
                });
              }
            }
          });
          S.data.pelanggans = deduplicatePelanggans(S.data.pelanggans);
        }

        renderAllLayers();
        syncModemStatusWithMap();
        setInterval(syncModemStatusWithMap, 60000);

        // Aktifkan Real-Time Cross-Device Polling setiap 10 detik agar edit di HP langsung tampil di Laptop
        if (!window.__gisCrossDevicePollTimer) {
          window.__gisCrossDevicePollTimer = setInterval(checkCrossDeviceMapSync, 10000);
        }

        // Cek URL parameters jika dibuka via bot Telegram (view=map)
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const pLat = parseFloat(urlParams.get('lat'));
          const pLng = parseFloat(urlParams.get('lng'));
          const pName = urlParams.get('name') || urlParams.get('id') || 'Lokasi Pelanggan';
          const pId = urlParams.get('id') || '';
          const pSearch = urlParams.get('search');

          if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
            // Langsung arahkan ke titik koordinat pelanggan dan buka modalnya secara otomatis
            setTimeout(() => {
              if (typeof window.gisSelectSearchResult === 'function') {
                window.gisSelectSearchResult(pLat, pLng, 'pelanggan', pName, pId);
              }
            }, 100);
          } else if (pSearch) {
            setTimeout(() => {
              const sBox = document.getElementById('gisSearchInputField') || document.getElementById('gisSearchInput');
              if (sBox) {
                sBox.value = pSearch;
              }
              if (typeof window.gisSearchInput === 'function') {
                window.gisSearchInput(pSearch);
              }
              // Cari langsung data pelanggan yang cocok dan buka seketika
              const qTarget = pSearch.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              let matched = S.data.pelanggans.find(p => {
                const pId = (p.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return pId && pId === qTarget;
              });
              if (!matched) {
                matched = S.data.pelanggans.find(p => {
                  const pName = (p.nama || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  return pName && (pName === qTarget || pName.includes(qTarget) || qTarget.includes(pName));
                });
              }
              if (matched) {
                window.gisSelectSearchResult(matched.lat, matched.lng, 'pelanggan', matched.nama, matched.id);
              } else {
                const firstItem = document.querySelector('#gisSearchResultsDropdown .gis-search-item');
                if (firstItem) firstItem.click();
              }
            }, 100);
          }
        } catch (_) { }
      }
    } catch (err) {
      console.warn('Gagal memuat map data:', err);
    }
  }

  // Cek apakah ada perangkat lain (misal HP) yang baru saja mengedit atau menambah data
  async function checkCrossDeviceMapSync() {
    if (isMapSyncing || !window.sb || S.activeTool) return;
    try {
      const { data: tsRow } = await window.sb
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'map_network_last_update')
        .maybeSingle();

      if (tsRow && tsRow.setting_value && String(tsRow.setting_value) !== String(lastKnownMapUpdateTs)) {
        console.log('🔄 [MAP GIS] Deteksi perubahan data dari perangkat lain (HP). Memperbarui map...');
        lastKnownMapUpdateTs = String(tsRow.setting_value);
        isMapSyncing = true;

        const { data: supaRow } = await window.sb
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'map_network_full')
          .maybeSingle();

        if (supaRow && supaRow.setting_value) {
          const parsed = typeof supaRow.setting_value === 'string' ? JSON.parse(supaRow.setting_value) : supaRow.setting_value;
          if (parsed && (parsed.pelanggans || parsed.odps)) {
            S.data.odcs = parsed.odcs || [];
            S.data.odps = parsed.odps || [];
            S.data.pelanggans = parsed.pelanggans || [];
            S.data.closures = parsed.closures || [];
            S.data.lainnya = parsed.lainnya || [];
            S.data.feederLines = parsed.feederLines || [];
            S.data.distLines = parsed.distLines || [];
            S.data.dropLines = parsed.dropLines || [];

            renderAllLayers();
            updateStatsBadge();
            try { localStorage.setItem('mahawira_map_network_cache_v2', JSON.stringify({ data: parsed, ts: lastKnownMapUpdateTs })); } catch (_) { }

            // Jika laptop sedang membuka peta di localhost, otomatis simpan juga ke file disk backend
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocal && window.location.protocol === 'http:') {
              fetch('http://127.0.0.1:7878/api/map/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: typeof supaRow.setting_value === 'string' ? supaRow.setting_value : JSON.stringify(supaRow.setting_value)
              }).catch(() => { });
            }
            // Sinkronisasi background tanpa popup / alert agar tidak mengganggu tampilan
          }
        }
        isMapSyncing = false;
      }
    } catch (_) {
      isMapSyncing = false;
    }
  }

  // ============================================================================
  // SINKRONISASI STATUS KONEKSI MODEM PELANGGAN LANGSUNG DARI MIKROTIK (CEK MODEM)
  // ============================================================================
  function applyModemClientsToMap(clientList) {
    if (!clientList || !Array.isArray(clientList) || clientList.length === 0) return;
    window.allModemList = clientList;

    // Strict 1-to-1 matching structures
    const clientsByUser = new Map();
    const clientsByName = new Map();
    const clientsByCommentId = new Map();

    clientList.forEach(m => {
      if (!m) return;
      if (m.pppoe_user) {
        const u = m.pppoe_user.trim().toLowerCase();
        clientsByUser.set(u, m);
        const cleanU = u.replace(/[^a-z0-9]/g, '');
        if (cleanU) clientsByUser.set(cleanU, m);
      }
      if (m.customer_name && m.customer_name !== '-') {
        const c = m.customer_name.trim().toLowerCase();
        const cleanC = c.replace(/[^a-z0-9]/g, '');
        if (cleanC && cleanC.length >= 5 && cleanC !== 'pelanggan' && cleanC !== 'unknown') {
          if (!clientsByName.has(cleanC)) clientsByName.set(cleanC, m);
        }
      }
      if (m.raw_comment && m.raw_comment !== '-') {
        const r = m.raw_comment.trim().toLowerCase();
        const idM = r.match(/([0-9]{1,4}\/[a-z0-9\-\/]+)/i);
        if (idM) {
          const cleanIdMatch = idM[1].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanIdMatch) clientsByCommentId.set(cleanIdMatch, m);
        }
      }
    });

    let deadCount = 0;
    let liveCount = 0;
    const claimedClients = new Set();
    const claimedSerials = new Set();

    (S.data.pelanggans || []).forEach(c => {
      const kId = (c.id || '').trim().toLowerCase();
      const kName = (c.nama || '').trim().toLowerCase();
      const cleanId = kId.replace(/[^a-z0-9]/g, '');
      const cleanName = kName.replace(/[^a-z0-9]/g, '');

      let m = null;

      // Prioritas 1: Exact ID Pelanggan (1-to-1)
      if (cleanId && cleanId.length >= 3 && !cleanId.startsWith('plg')) {
        const cand = clientsByUser.get(kId) || clientsByUser.get(cleanId) || clientsByCommentId.get(cleanId);
        if (cand && !claimedClients.has(cand.pppoe_user)) {
          m = cand;
        }
      }

      // Prioritas 2: Exact Full Name (Hanya jika nama lengkap >= 6 karakter dan match persis, TANPA substring)
      if (!m && cleanName && cleanName.length >= 6) {
        const cand = clientsByName.get(cleanName) || clientsByUser.get(cleanName);
        if (cand && !claimedClients.has(cand.pppoe_user)) {
          m = cand;
        }
      }

      if (m) {
        claimedClients.add(m.pppoe_user);

        // Cek serial number: Cegah 2 pelanggan berbeda menampilkan serial yang sama
        const sn = (m.serial || m.optical?.serial || '').trim();
        if (sn && sn !== '-' && sn !== m.pppoe_user) {
          if (claimedSerials.has(sn)) {
            // Jika serial ini sudah diklaim pelanggan lain, kosongkan serial di pelanggan kedua
            c.modemData = Object.assign({}, m, { serial: '-', optical: m.optical ? Object.assign({}, m.optical, { serial: '-' }) : null });
          } else {
            claimedSerials.add(sn);
            c.modemData = m;
          }
        } else {
          c.modemData = m;
        }

        // isModemDead bernilai true jika di MikroTik statusnya offline / padam
        c.isModemDead = !m.is_active;
        if (c.isModemDead) deadCount++; else liveCount++;
      } else {
        // Cek apakah pelanggan ini merupakan target dari URL bot dengan status offline
        const urlP = new URLSearchParams(window.location.search);
        const urlStatus = urlP.get('status');
        const urlId = (urlP.get('id') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const urlName = (urlP.get('name') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const isUrlTarget = (urlId && cleanId && (cleanId === urlId || urlId.includes(cleanId) || cleanId.includes(urlId))) ||
                            (urlName && cleanName && (cleanName === urlName || urlName.includes(cleanName) || cleanName.includes(urlName)));

        if (isUrlTarget && urlStatus === 'offline') {
          c.isModemDead = true;
          c.modemData = {
            is_active: false,
            last_logged_out: urlP.get('last_off') || 'Hari ini',
            router_name: urlP.get('router') || '-'
          };
          deadCount++;
        } else {
          c.modemData = null;
          c.isModemDead = false;
        }
      }
    });

    console.log(`[MAP GIS] Status Modem Sinkron: ${liveCount} Online, ${deadCount} Mati/Offline. (${claimedClients.size} modem terikat 1-ke-1)`);
    // HANYA perbarui layer penanda pelanggan & badge statistik, JANGAN gambar ulang seluruh kabel/ODP agar instan
    window.gisRenderPelangganMarkers();
    updateStatsBadge(null, null, deadCount);
  }

  async function syncModemStatusWithMap() {
    // 1. Prioritas Utama: Muat instant static cache (~30ms di HP / Vercel)
    if (!window.__gisCacheLoaded) {
      try {
        const cacheRes = await fetch(`data/modem_clients_cache.json?v=${Date.now()}`, { cache: 'no-store' });
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json();
          if (Array.isArray(cacheData) && cacheData.length > 0) {
            window.__gisCacheLoaded = true;
            applyModemClientsToMap(cacheData);
          }
        }
      } catch (errCache) {
        console.warn('[MAP GIS] Gagal memuat static modem cache:', errCache.message);
      }
    }

    // 2. Jika sudah ada allModemList di window (misal dari Cek Modem), terapkan segera
    if (window.allModemList && window.allModemList.length > 0) {
      applyModemClientsToMap(window.allModemList);
    }

    // 3. Background refresh live data langsung dari router MikroTik (timeout 18 detik)
    try {
      const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiBase = isLocal ? 'http://127.0.0.1:7878' : 'https://noc-mahawira.tail6b7a38.ts.net';

      const res = await fetch(`${apiBase}/api/modem/clients?router=all&refresh=1&_t=${Date.now()}`, {
        signal: AbortSignal.timeout(18000),
        cache: 'no-store'
      });
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        window.allModemList = json.data;
        applyModemClientsToMap(json.data);
      }
    } catch (e) {
      console.warn('[MAP GIS] Live background sync timeout / offline (tetap menggunakan cache):', e.message);
    }
  }
  window.gisSyncModemStatus = syncModemStatusWithMap;
  let saveDebounceTimer = null;
  window.gisSaveLocalData = function () {
    saveLocalData();
  };

  async function saveLocalData() {
    if (!S.data) return;

    // Tampilkan indikator status sinkronisasi di toolbar
    const syncBadge = document.getElementById('gisSyncStatusBadge');
    if (syncBadge) {
      syncBadge.innerHTML = '💾 <span class="sync-text">Menyimpan...</span>';
      syncBadge.style.display = 'inline-flex';
      syncBadge.style.color = '#d97706';
      syncBadge.style.borderColor = '#fde68a';
      syncBadge.style.background = '#fffbeb';
    }

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
      try {
        const payload = {
          odcs: S.data.odcs || [],
          odps: S.data.odps || [],
          pelanggans: S.data.pelanggans || [],
          closures: S.data.closures || [],
          lainnya: S.data.lainnya || [],
          feederLines: S.data.feederLines || [],
          distLines: S.data.distLines || [],
          dropLines: S.data.dropLines || [],
          cutPoints: S.data.cutPoints || []
        };
        const jsonStr = JSON.stringify(payload);
        const nowIso = new Date().toISOString();
        const nowTs = String(Date.now());
        lastKnownMapUpdateTs = nowTs;
        try { localStorage.setItem('mahawira_map_network_cache_v2', JSON.stringify({ data: payload, ts: nowTs })); } catch (_) { }

        // 1. Simpan ke Supabase Cloud (onConflict: setting_key agar upsert selalu berhasil dan tersinkron ke semua perangkat)
        if (window.sb) {
          const { error: err1 } = await window.sb.from('app_settings').upsert({
            setting_key: 'map_network_full',
            setting_value: jsonStr,
            setting_type: 'json',
            updated_at: nowIso
          }, { onConflict: 'setting_key' });
          if (err1) throw err1;

          const { error: err2 } = await window.sb.from('app_settings').upsert({
            setting_key: 'map_network_last_update',
            setting_value: nowTs,
            setting_type: 'string',
            updated_at: nowIso
          }, { onConflict: 'setting_key' });
          if (err2) throw err2;
        }

        // 2. Simpan juga ke Server Lokal (hanya jika berjalan di localhost/127.0.0.1 via HTTP)
        const isLocalHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.protocol === 'http:';
        if (isLocalHost) {
          fetch('http://127.0.0.1:7878/api/map/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStr
          }).catch(() => { });
        }

        if (syncBadge) {
          syncBadge.innerHTML = '✅ <span class="sync-text">Tersimpan ke Server</span>';
          syncBadge.style.color = '#15803d';
          syncBadge.style.borderColor = '#bbf7d0';
          syncBadge.style.background = '#f0fdf4';
          setTimeout(() => {
            if (syncBadge && syncBadge.innerHTML.includes('Tersimpan')) {
              syncBadge.style.display = 'none';
            }
          }, 3500);
        }
      } catch (err) {
        console.error('[GIS SYNC SAVE ERROR]', err);
        if (syncBadge) {
          syncBadge.innerHTML = '⚠️ <span class="sync-text">Gagal Simpan</span>';
          syncBadge.style.color = '#dc2626';
          syncBadge.style.borderColor = '#fecaca';
          syncBadge.style.background = '#fef2f2';
          syncBadge.style.display = 'inline-flex';
          setTimeout(() => {
            if (syncBadge && syncBadge.innerHTML.includes('Gagal Simpan')) {
              syncBadge.style.display = 'none';
            }
          }, 4000);
        }
      }
    }, 350);
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
      autoPan: false,
      closeButton: true,
      autoClose: false,
      closeOnClick: true,
      offset: L.point(0, -10),
      maxWidth: 320
    };

    const currentMapZoom = S.map ? S.map.getZoom() : 16;

    // 1. RENDER JALUR FEEDER: WARNA BIRU (#2563eb)
    S.data.feederLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      const poly = L.polyline(l.coords, {
        color: '#2563eb', // BIRU
        weight: getCableWeight('feeder', currentMapZoom),
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.feeder);

      poly.bindTooltip(`🔵 Feeder: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(() => buildCablePopupHtml(l, 'feeder', '#2563eb'), GIS_POPUP_OPTIONS);
      poly.on('click', function (e) {
        if (S.activeTool === 'cut-cable') {
          if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          window.gisExecuteCutCable(l, 'feeder', e.latlng);
        }
      });
    });

    // 2. RENDER JALUR DISTRIBUSI: WARNA MERAH (#dc2626)
    S.data.distLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      const poly = L.polyline(l.coords, {
        color: '#dc2626', // MERAH
        weight: getCableWeight('distribusi', currentMapZoom),
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.distribusi);

      poly.bindTooltip(`🔴 Distribusi: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(() => buildCablePopupHtml(l, 'distribusi', '#dc2626'), GIS_POPUP_OPTIONS);
      poly.on('click', function (e) {
        if (S.activeTool === 'cut-cable') {
          if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          window.gisExecuteCutCable(l, 'distribusi', e.latlng);
        }
      });
    });

    // 3. RENDER JALUR DROP CORE: KUNING TERANG (#eab308) - SUPER RINGAN CANVAS
    S.data.dropLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      const poly = L.polyline(l.coords, {
        color: '#eab308', // KUNING TERANG DROPCORE
        weight: getCableWeight('dropcore', currentMapZoom),
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.dropcore);

      poly.bindPopup(() => buildCablePopupHtml(l, 'dropcore', '#ca8a04'), GIS_POPUP_OPTIONS);
      poly.on('click', function (e) {
        if (S.activeTool === 'cut-cable') {
          if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          window.gisExecuteCutCable(l, 'dropcore', e.latlng);
        }
      });
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

      const odcMarker = L.marker([odc.lat, odc.lng], { icon })
        .bindTooltip(escapeHtml(odc.name), {
          permanent: S.map.getZoom() >= 16,
          direction: 'top',
          className: 'earth-label',
          offset: [0, -20]
        })
        .bindPopup(() => buildOdcPopupHtml(odc), GIS_POPUP_OPTIONS);
      odcMarker.on('click', function (e) {
        window.__justClickedPin = true;
        setTimeout(() => { window.__justClickedPin = false; }, 350);
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        if (window.gisClearSearchPin) window.gisClearSearchPin();
        L.DomEvent.stop(e);
        window.gisOpenOdcDetailModal(odc);
      });
      odcMarker.addTo(S.layers.odc);
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

      const isTargetOdp = S.selectedTargetCoord &&
        ((odp.id && odp.id === S.selectedTargetCoord.id) ||
         (odp.name && odp.name === S.selectedTargetCoord.name) ||
         Math.hypot(odp.lat - S.selectedTargetCoord.lat, odp.lng - S.selectedTargetCoord.lng) < 0.00015);

      const marker = L.marker([odp.lat, odp.lng], { icon });

      // Sembunyikan label default jika pin sedang diberi label khusus agar tidak menutupi label khusus!
      // Dan gunakan permanent: false agar tidak me-render ratusan DOM tooltip yang bikin Chrome freeze / Page Unresponsive
      if (!isTargetOdp) {
        marker.bindTooltip(escapeHtml(odp.name), {
          permanent: false,
          direction: 'top',
          className: 'earth-label',
          offset: [0, -18]
        });
      }
      marker.bindPopup(() => buildOdpPopupHtml(odp), GIS_POPUP_OPTIONS);

      marker.on('click', function (e) {
        window.__justClickedPin = true;
        setTimeout(() => { window.__justClickedPin = false; }, 350);
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        if (window.gisClearSearchPin) window.gisClearSearchPin();
        if (S.pendingDropcoreCust) {
          L.DomEvent.stop(e);
          marker.closePopup();
          window.gisCompleteDropcoreConnection(S.pendingDropcoreCust, odp);
          return;
        }
        if (S.activeTool === 'draw-cable' && !S.pendingDropcoreCust && !S.pendingDropcoreOdp) {
          L.DomEvent.stop(e);
          marker.closePopup();
          window.gisStartConnectDropcoreFromOdp(odp);
          return;
        }
        L.DomEvent.stop(e);
        window.gisOpenOdpDetailModal(odp);
      });

      marker.addTo(S.layers.odp);
    });

    // 5.5. RENDER TITIK UJUNG KABEL YANG DI-CUT (Tanpa Menghilangkan Kabel)
    if (S.layers.cutPoints) S.layers.cutPoints.clearLayers();
    if (Array.isArray(S.data.cutPoints)) {
      S.data.cutPoints.forEach(cp => {
        if (!cp || typeof cp.lat !== 'number' || typeof cp.lng !== 'number') return;
        const icon = L.divIcon({
          className: 'custom-cut-icon',
          html: `
            <div class="marker-cut-endpoint" title="✂️ Ujung Kabel: ${escapeHtml(cp.originalName || 'Kabel')}">
              <div class="cut-ping-ring"></div>
              <div class="cut-core-badge"><i class="fas fa-cut"></i></div>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const cutMarker = L.marker([cp.lat, cp.lng], { icon });
        cutMarker.bindPopup(`
          <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:260px; padding:12px; box-sizing:border-box; text-align:center;">
            <div style="font-size:13px; font-weight:800; color:#ef4444; margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:6px;">
              <i class="fas fa-cut"></i> Titik Ujung Kabel
            </div>
            <div style="font-size:11px; color:#64748b; margin-bottom:12px;">
              Kabel: <b>${escapeHtml(cp.originalName || 'Kabel')}</b>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button onclick="window.gisMergeCutCable('${cp.id}')"
                style="width:100%; padding:8px 10px; background:#10b981; color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; box-shadow:0 1px 3px rgba(16,185,129,0.3);">
                <i class="fas fa-link"></i> Sambung Kembali Kabel
              </button>
              <button onclick="window.gisOpenModalTambahOdp(${cp.lat}, ${cp.lng})"
                style="width:100%; padding:8px 10px; background:#2563eb; color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; box-shadow:0 1px 3px rgba(37,99,235,0.3);">
                <i class="fas fa-box"></i> Pasang ODP di Titik Ini
              </button>
              <button onclick="window.gisDeleteCutPoint('${cp.id}')"
                style="width:100%; padding:6px 10px; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; border-radius:8px; font-size:10px; font-weight:600; cursor:pointer;">
                Hapus Tanda Ujung Kabel
              </button>
            </div>
          </div>
        `, GIS_POPUP_OPTIONS);

        if (S.layers.cutPoints) cutMarker.addTo(S.layers.cutPoints);
      });
    }

    // 6. RENDER PELANGGAN (HYBRID 60 FPS: CANVAS DI ZOOM RENDAH, PUSHPIN DI ZOOM TINGGI)
    window.gisRenderPelangganMarkers();
  }

  window.gisRenderPelangganMarkers = function () {
    if (!S.map || !S.layers.pelangganConnected || !S.layers.pelangganUnconnected) return;

    // Simpan popup aktif agar tidak hilang saat map di-scroll / digeser
    const curPopup = S.map._popup;
    let savedPopupData = null;
    if (curPopup && curPopup.isOpen && curPopup.isOpen()) {
      savedPopupData = {
        latlng: curPopup.getLatLng(),
        content: curPopup.getContent(),
        options: curPopup.options
      };
    }

    S.layers.pelangganConnected.clearLayers();
    S.layers.pelangganUnconnected.clearLayers();
    if (S.layers.pelangganMati) S.layers.pelangganMati.clearLayers();

    const currentZoom = S.map.getZoom();
    // Di zoom >= 15: tampilkan Pushpin SVG. Di zoom < 15: CircleMarker ringan (60 FPS anti macet)
    const isDetailed = currentZoom >= 15;
    const isMatchKec = (kec) => {
      if (!S.filterKecamatan || S.filterKecamatan === 'ALL') return true;
      return String(kec || '').toUpperCase().includes(S.filterKecamatan.toUpperCase());
    };

    const isMobile = window.innerWidth <= 768;
    const GIS_POPUP_OPTIONS = {
      autoPan: false,
      closeButton: true,
      offset: L.point(0, -10),
      maxWidth: isMobile ? Math.min(275, window.innerWidth - 24) : 310
    };

    // Buffer ringan 25% di luar layar (Super cepat & 60 FPS)
    const bounds = S.map.getBounds().pad(0.25);

    let countConn = 0;
    let countUnconn = 0;
    let countDead = 0;

    S.data.pelanggans.forEach(c => {
      if (!isMatchKec(c.kec)) return;
      const hasLine = c.hasDropcore !== false;
      const isDead = !!c.isModemDead;
      const isOnline = !!(c.modemData && c.modemData.is_active);
      if (isDead) countDead++;
      if (hasLine) countConn++; else countUnconn++;

      // Hanya render titik pelanggan di dalam batas buffer viewport
      if (!bounds.contains([c.lat, c.lng])) return;

      const isSelectedTarget = S.selectedTargetCoord &&
        ((c.id && c.id === S.selectedTargetCoord.id) ||
         Math.hypot(c.lat - S.selectedTargetCoord.lat, c.lng - S.selectedTargetCoord.lng) < 0.00015);

      // Sembunyikan label default jika pin sedang diberi label khusus (radar beacon) agar tidak menutupi label khusus!
      // Gunakan permanent: false agar 1.000 label pelanggan TIDAK bertumpuk dan TIDAK membebani browser hingga "Page Unresponsive"!
      // Nama pelanggan akan muncul seketika saat di-hover atau di-tap!
      if (isDetailed || isSelectedTarget) {
        let iconClass = 'marker-yellow-pin';
        if (isDead) {
          iconClass = 'marker-cust-dead';
        } else if (isOnline) {
          iconClass = hasLine ? 'marker-cust-online' : 'marker-cust-online-nodrop';
        } else {
          iconClass = hasLine ? 'marker-yellow-pin' : 'marker-yellow-pin-unconnected';
        }

        const icon = L.divIcon({
          className: 'custom-cust-icon',
          html: `<div class="${iconClass}" title="${escapeHtml(c.nama)}${isDead ? ' (MODEM MATI / PADAM)' : (isOnline ? ' (MODEM ONLINE)' : '')}"></div>`,
          iconSize: [28, 36],
          iconAnchor: [14, 35]
        });

        const labelText = isDead
          ? `🔴 ${escapeHtml(c.nama)} (MODEM MATI)`
          : (isOnline ? `🟢 ${escapeHtml(c.nama)}` : escapeHtml(c.nama));
        let labelClass = isDead
          ? 'earth-label earth-label-dead'
          : (isOnline ? 'earth-label earth-label-online' : 'earth-label');

        if (isSelectedTarget) {
          labelClass += ' earth-label-target';
        }

        const marker = L.marker([c.lat, c.lng], { icon });
        if (!isSelectedTarget) {
          marker.bindTooltip(labelText, {
            permanent: false,
            direction: 'top',
            className: labelClass,
            offset: [0, -32]
          });
        }

        marker.on('click', function (e) {
          window.__justClickedPin = true;
          setTimeout(() => { window.__justClickedPin = false; }, 350);
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
          if (S.pendingDropcoreOdp) {
            window.gisCompleteDropcoreConnection(c, S.pendingDropcoreOdp);
            return;
          }
          if (S.activeTool === 'draw-cable' && !S.pendingDropcoreCust && !S.pendingDropcoreOdp) {
            window.gisStartConnectDropcore(c.id || c.nama);
            return;
          }
          // Buka Modal Detail Pelanggan seketika!
          window.gisOpenCustomerDetailModal(c);
        });

        if (isDead && S.layers.pelangganMati) {
          marker.addTo(S.layers.pelangganMati);
        } else if (hasLine) {
          marker.addTo(S.layers.pelangganConnected);
        } else {
          marker.addTo(S.layers.pelangganUnconnected);
        }
      } else {
        // Low Zoom (<15): Circle Marker super ringan (Render 1.000 titik dalam 2ms tanpa lag)
        const radius = isDead ? 5.5 : (isOnline ? (hasLine ? 4 : 4.5) : (hasLine ? 3.5 : 4.5));
        const color = isDead ? '#991b1b' : (isOnline ? '#15803d' : (hasLine ? '#ca8a04' : '#b91c1c'));
        const fillColor = isDead ? '#ef4444' : (isOnline ? '#22c55e' : (hasLine ? '#facc15' : '#ef4444'));
        const weight = isDead ? 2 : 1;

        const tooltipText = isDead
          ? `🔴 ${escapeHtml(c.nama)} (MODEM MATI)`
          : (isOnline ? `🟢 ${escapeHtml(c.nama)}` : escapeHtml(c.nama));
        const tooltipClass = isDead
          ? 'earth-label earth-label-dead'
          : (isOnline ? 'earth-label earth-label-online' : 'earth-label');

        const marker = L.circleMarker([c.lat, c.lng], {
          radius: radius,
          color: color,
          fillColor: fillColor,
          fillOpacity: isDead ? 1 : 0.9,
          weight: weight
        });
        if (!isSelectedTarget) {
          marker.bindTooltip(tooltipText, {
            permanent: false,
            direction: 'top',
            className: tooltipClass
          });
        }

        marker.on('click', function (e) {
          window.__justClickedPin = true;
          setTimeout(() => { window.__justClickedPin = false; }, 350);
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
          if (S.pendingDropcoreOdp) {
            window.gisCompleteDropcoreConnection(c, S.pendingDropcoreOdp);
            return;
          }
          if (S.activeTool === 'draw-cable' && !S.pendingDropcoreCust && !S.pendingDropcoreOdp) {
            window.gisStartConnectDropcore(c.id || c.nama);
            return;
          }
          // Buka Modal Detail Pelanggan seketika!
          window.gisOpenCustomerDetailModal(c);
        });

        if (isDead && S.layers.pelangganMati) {
          marker.addTo(S.layers.pelangganMati);
        } else if (hasLine) {
          marker.addTo(S.layers.pelangganConnected);
        } else {
          marker.addTo(S.layers.pelangganUnconnected);
        }
      }
    });

    // 7. RENDER INFRASTRUKTUR LAINNYA HANYA JIKA LAYER DIAKTIFKAN OLEH USER (Super Ringan di HP)
    if (S.data.lainnya && S.layers.lainnya && S.map.hasLayer(S.layers.lainnya)) {
      S.layers.lainnya.clearLayers();
      S.data.lainnya.forEach(item => {
        if (!isMatchKec(item.kec)) return;
        const icon = L.divIcon({
          className: 'custom-lainnya-icon',
          html: `<div style="width:10px; height:10px; background:#64748b; border:1.5px solid #ffffff; border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,0.5);" title="${escapeHtml(item.nama)}"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });

        L.marker([item.lat, item.lng], { icon })
          .bindTooltip(`${escapeHtml(item.nama)} (${escapeHtml(item.type || 'Lainnya')})`, {
            permanent: false,
            direction: 'top',
            className: 'earth-label'
          })
          .bindPopup(`
            <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:260px; background:#ffffff; color:#1e293b; box-sizing:border-box;">
              <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; padding:12px 14px 10px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                  <span style="background:#f1f5f9; color:#475569; font-size:9.5px; font-weight:800; padding:2px 8px; border-radius:12px; border:1px solid #cbd5e1;">
                    📍 INFRASTRUKTUR
                  </span>
                  <span style="color:#64748b; font-size:9.5px; font-weight:700;">MAHAWIRA</span>
                </div>
                <div style="font-weight:900; font-size:14px; color:#0f172a; line-height:1.25; word-break:break-word;">
                  ${escapeHtml(item.nama)}
                </div>
              </div>
              <div style="padding:10px 14px 12px;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; margin-bottom:8px; font-size:11px;">
                  <span style="color:#64748b;">Tipe:</span> <b style="color:#1e293b;">${escapeHtml(item.type || 'Infrastruktur')}</b>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; font-size:11px; display:flex; justify-content:space-between;">
                  <span style="color:#64748b;"><i class="fas fa-globe"></i> GPS:</span>
                  <span style="font-family:'Consolas',monospace; color:#0284c7; font-weight:700;">${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>
          `, GIS_POPUP_OPTIONS)
          .addTo(S.layers.lainnya);
      });
    }

    // Pulihkan popup jika sebelumnya terbuka saat user menggeser map
    if (savedPopupData && (!S.map._popup || !S.map._popup.isOpen())) {
      L.popup(savedPopupData.options)
        .setLatLng(savedPopupData.latlng)
        .setContent(savedPopupData.content)
        .openOn(S.map);
    }

    updateStatsBadge(countConn, countUnconn, countDead);
  };
  function updateStatsBadge(conn, unconn, deadCount) {
    const el = document.getElementById('gisStatsBadge');
    if (!el || !S.data) return;
    const allPel = S.data.pelanggans || [];
    const connNum = (typeof conn === 'number' && !isNaN(conn)) ? conn : allPel.filter(p => p.hasDropcore !== false).length;
    const unconnNum = (typeof unconn === 'number' && !isNaN(unconn)) ? unconn : allPel.filter(p => p.hasDropcore === false).length;
    const deadNum = (typeof deadCount === 'number' && !isNaN(deadCount)) ? deadCount : allPel.filter(p => !!p.isModemDead).length;
    const lainnyaCount = (S.data.lainnya || []).length;
    el.innerHTML = `
      <span>📦 <b>${(S.data.odps || []).length}</b> ODP</span>
      <span>🏢 <b>${(S.data.odcs || []).length}</b> ODC</span>
      <span>👤 <b>${connNum}</b> Terhubung</span>
      <span style="color:#dc2626;">⚠️ <b>${unconnNum}</b> Tanpa Dropcore</span>
      ${deadNum > 0 ? `<span style="color:#dc2626; font-weight:800; background:#fee2e2; padding:2px 8px; border-radius:12px; border:1px solid #fecaca;">🔴 <b>${deadNum}</b> Modem Mati</span>` : ''}
      ${lainnyaCount > 0 ? `<span style="color:#64748b;">📍 <b>${lainnyaCount}</b> Lainnya</span>` : ''}
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
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:275px; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- Cable Header -->
        <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; padding:12px 14px 10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="display:inline-flex; align-items:center; gap:5px; background:#ffffff; color:${colorHex}; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; border:1.5px solid ${colorHex}; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
              <span style="width:7px; height:7px; border-radius:50%; background:${colorHex};"></span>
              ${typeNames[type] || 'JALUR KABEL'}
            </span>
            <span style="color:#64748b; font-size:9.5px; font-weight:700;">NOC MAHAWIRA</span>
          </div>

          <div style="font-size:14px; font-weight:900; color:#0f172a; line-height:1.25; word-break:break-word;">
            ${escapeHtml(line.name)}
          </div>
        </div>

        <!-- Body -->
        <div style="padding:10px 14px 12px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-ruler-horizontal"></i> Panjang Kabel:</span>
              <b style="color:#0f172a; font-size:12px;">${Math.round(totalLenM)} meter</b>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-code-branch"></i> Jumlah Titik:</span>
              <b style="color:#0f172a; font-size:12px;">${line.coords.length} titik</b>
            </div>
          </div>

          ${admin ? `
            <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
              <div style="display:flex; gap:6px; width:100%;">
                <button onclick="window.gisStartEditCablePoints('${escapeHtml(line.id)}', '${type}')"
                  style="flex:1.4; padding:8px 10px; background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); color:#1d4ed8; border:1.5px solid #93c5fd; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; box-shadow:0 2px 4px rgba(37,99,235,0.12);"
                  title="Tarik ujung kabel atau titik tikungan langsung di peta">
                  <i class="fas fa-arrows-alt"></i> Geser Ujung / Titik
                </button>
                <button onclick="window.gisPromptCutCable('${escapeHtml(line.id)}', '${type}')"
                  style="flex:1.2; padding:8px 10px; background:#fff1f2; color:#e11d48; border:1.5px solid #fecdd3; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;"
                  title="Potong kabel di titik tertentu tanpa menghilangkannya">
                  <i class="fas fa-cut"></i> Potong Kabel
                </button>
              </div>
              <div style="display:flex; gap:6px; width:100%;">
                <button onclick="window.gisEditCableMeta('${escapeHtml(line.id)}', '${type}')"
                  style="flex:1; padding:8px 10px; background:#f8fafc; color:#334155; border:1.5px solid #cbd5e1; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"
                  title="Ganti Nama / Jenis Kabel">
                  <i class="fas fa-pen"></i> Edit Info
                </button>
                <button onclick="window.gisDeleteCable('${escapeHtml(line.id)}', '${type}')"
                  style="padding:8px 14px; background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"
                  title="Hapus Jalur Kabel">
                  <i class="fas fa-trash-alt"></i> Hapus
                </button>
              </div>
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

    const hasModemData = !!(c.modemData && (c.modemData.is_active || c.modemData.ip_address || c.modemData.last_logged_out || c.modemData.mac_address || c.modemData.brand || c.modemData.router_name));
    let mBrand = '-';
    let mModel = '-';
    let mSerial = '-';
    let isTendaOrHtb = false;

    if (hasModemData) {
      const mData = c.modemData;
      const rawBrand = (mData.brand || '').trim();
      const rawModel = (mData.model || mData.optical?.model || '').trim();
      const rawSerial = (mData.serial || mData.optical?.serial || '').trim();
      const rawMac = (mData.mac_address || '').replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
      isTendaOrHtb = mData.isHtb || (!mData.isOlt && (rawBrand.toLowerCase().includes('tenda') || rawBrand.toLowerCase().includes('totolink') || rawBrand.toLowerCase().includes('tp-link') || rawBrand.toLowerCase().includes('mercusys') || rawBrand.toLowerCase().includes('router') || rawModel.toLowerCase().includes('router') || rawModel.toLowerCase().includes('ap')));

      if (isTendaOrHtb || rawBrand.toLowerCase().includes('tenda')) {
        mBrand = rawBrand || 'Tenda';
        mModel = (rawModel && !rawModel.includes('F670') && !rawModel.includes('ONT')) ? rawModel : 'Router WiFi (HTB)';
        // Router WiFi / Tenda TIDAK PERNAH pakai SN GPON ZTEG!
        if (rawSerial && rawSerial !== '-' && !rawSerial.toUpperCase().startsWith('ZTEG')) {
          mSerial = rawSerial;
        } else if (rawMac && rawMac.length === 12 && /^[0-9A-F]{12}$/.test(rawMac)) {
          mSerial = mData.mac_address;
        } else {
          mSerial = '-';
        }
      } else if (rawBrand.toLowerCase().includes('huawei')) {
        mBrand = 'Huawei';
        mModel = rawModel || 'HG8245H';
        if (rawSerial && rawSerial !== '-' && rawSerial.toUpperCase().startsWith('HWTC')) {
          mSerial = rawSerial;
        } else {
          mSerial = '-';
        }
      } else if (rawBrand.toLowerCase().includes('fiberhome')) {
        mBrand = 'Fiberhome';
        mModel = rawModel || 'AN5506';
        if (rawSerial && rawSerial !== '-' && rawSerial.toUpperCase().startsWith('FHTT')) {
          mSerial = rawSerial;
        } else {
          mSerial = '-';
        }
      } else {
        // ONT GPON (Ambil brand dan model riil, jangan berasumsi ZTE F670L jika belum dicek)
        mBrand = rawBrand || '-';
        mModel = (rawModel && rawModel !== '-' && rawModel !== 'Perangkat Pelanggan' && rawModel !== 'GPON ONT') ? rawModel : '-';
        if (rawSerial && rawSerial !== '-' && rawSerial !== mData.pppoe_user && !rawSerial.includes('Belum')) {
          mSerial = rawSerial;
        } else {
          mSerial = '-';
        }
      }
    }

    return `
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:100%; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-bottom:1.5px solid #e2e8f0; padding:8px 12px 6px; position:relative;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px; padding-right:24px;">
            <span style="background:#dbeafe; color:#1d4ed8; font-size:9.5px; font-weight:800; padding:2px 8px; border-radius:12px;">
              📍 PELANGGAN FTTH
            </span>
            ${realId ? `
              <span style="background:#ffffff; color:#1d4ed8; font-family:'Consolas',monospace; font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:4px; border:1px solid #bfdbfe;">
                ${escapeHtml(realId)}
              </span>
            ` : ''}
          </div>
          <div style="font-size:13.5px; font-weight:900; color:#0f172a; line-height:1.2; text-transform:uppercase; word-break:break-word; padding-right:24px;">
            ${escapeHtml(c.nama)}
          </div>
        </div>

        <!-- NOTIFIKASI STATUS KONEKSI MODEM (CEK MODEM MIKROTIK) -->
        ${(c.isModemDead || (c.modemData && !c.modemData.is_active)) ? `
          <div style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-bottom:1.5px solid #fca5a5; border-left:4px solid #dc2626; padding:7px 12px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px; line-height:1; flex-shrink:0;">🔴</span>
            <div style="min-width:0; flex:1;">
              <div style="font-size:11px; font-weight:900; color:#991b1b; text-transform:uppercase; letter-spacing:0.3px;">KONEKSI MODEM: MATI (OFFLINE)</div>
              <div style="font-size:10px; color:#7f1d1d; font-weight:700; margin-top:2px;">
                Terputus: <b>${escapeHtml((c.modemData && (c.modemData.last_logged_out || c.modemData.last_reason_raw)) || 'Hari ini')}</b> ${c.modemData && c.modemData.router_name && c.modemData.router_name !== '-' ? `(${escapeHtml(c.modemData.router_name)})` : ''}
              </div>
            </div>
          </div>
        ` : (c.modemData && c.modemData.is_active) ? `
          <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-bottom:1.5px solid #86efac; border-left:4px solid #16a34a; padding:7px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
              <span style="font-size:18px; line-height:1; flex-shrink:0;">🟢</span>
              <div style="min-width:0;">
                <div style="font-size:11px; font-weight:900; color:#15803d; text-transform:uppercase; letter-spacing:0.3px;">KONEKSI MODEM: HIDUP (ONLINE)</div>
                <div style="font-size:10px; color:#166534; font-weight:700; margin-top:2px;">
                  Uptime: <b>${escapeHtml(c.modemData.uptime || '-')}</b> ${c.modemData.router_name && c.modemData.router_name !== '-' ? `(${escapeHtml(c.modemData.router_name)})` : ''}
                </div>
              </div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <span style="background:#ffffff; color:#166534; font-family:'Consolas',monospace; font-size:10px; font-weight:800; padding:2px 6px; border-radius:5px; border:1px solid #86efac;">
                ${escapeHtml(c.modemData.ip_address || '-')}
              </span>
            </div>
          </div>
        ` : `
          <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; border-left:4px solid #94a3b8; padding:6px 12px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:15px; flex-shrink:0;">⚪</span>
            <div style="min-width:0; flex:1;">
              <div style="font-size:10.5px; font-weight:800; color:#475569;">STATUS MODEM: BELUM TERHUBUNG MIKROTIK</div>
              <div style="font-size:9px; color:#64748b;">Data modem belum tersinkronisasi dari router</div>
            </div>
          </div>
        `}

        <!-- Body Info -->
        <div style="padding:8px 12px;">
          <!-- ODP & Jalur Dropcore -->
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <div style="flex:1; background:#fff1f2; border:1px solid #fecaca; border-radius:8px; padding:5px 8px; min-width:0;">
              <div style="font-size:8.5px; color:#991b1b; font-weight:800; text-transform:uppercase;">ODP TERHUBUNG</div>
              <div style="font-size:11px; color:#b91c1c; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📦 ${escapeHtml(c.odp || '-')}</div>
            </div>
            <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:5px 8px; min-width:0;">
              <div style="font-size:8.5px; color:#64748b; font-weight:800; text-transform:uppercase;">JALUR DROPCORE</div>
              <div style="font-size:11px; color:${isConn ? '#16a34a' : '#dc2626'}; font-weight:900;">
                ${isConn ? '🟢 Terkoneksi' : '🔴 Belum Ada'}
              </div>
            </div>
          </div>

          <!-- Wilayah & Koordinat GPS -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:5px 8px; margin-bottom:8px; font-size:10.5px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-landmark" style="color:#3b82f6;"></i> Wilayah:</span>
              <span style="color:#0f172a; font-weight:700;">${escapeHtml(c.kec || '-')}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-globe" style="color:#06b6d4;"></i> GPS:</span>
              <span style="font-family:'Consolas',monospace; color:#0284c7; font-weight:800; font-size:10px;">${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</span>
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button onclick="window.gisNavigasiGoogleMaps(${c.lat}, ${c.lng})"
              style="flex:1 1 100%; padding:7px 10px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 4px rgba(16,185,129,0.25);">
              <i class="fas fa-location-arrow"></i> Buka Rute Google Maps
            </button>
            ${admin ? `
              <button onclick="window.gisEditPelanggan('${escapeJsAttr(c.id || c.nama)}')"
                style="flex:1; padding:5px 6px; background:#f1f5f9; color:#1e293b; border:1.5px solid #cbd5e1; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:3px;"
                title="Edit Data Pelanggan">
                <i class="fas fa-edit" style="color:#2563eb;"></i> Edit
              </button>
              <button onclick="window.gisStartConnectDropcore('${escapeJsAttr(c.id || c.nama)}')"
                style="flex:1.2; padding:5px 6px; background:linear-gradient(135deg, #fef08a 0%, #facc15 100%); color:#854d0e; border:1.5px solid #eab308; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:3px;"
                title="Tarik Dropcore">
                <i class="fas fa-bolt" style="color:#ca8a04;"></i> Dropcore
              </button>
              <button onclick="window.gisDeletePelanggan('${escapeJsAttr(c.id || c.nama)}')"
                style="padding:5px 8px; background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;"
                title="Hapus Pelanggan">
                <i class="fas fa-trash-alt"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Popup ODP - TEMA BERSIH PUTIH / LIGHT
  function buildOdpPopupHtml(odp) {
    const admin = isAdmin();
    const cleanOdpName = (odp.name || '').trim();
    const norm = (str) => (str || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const odpNorm = norm(cleanOdpName);

    // 1. Cari pelanggan yang terikat ke ODP ini berdasarkan field odp
    const connectedCusts = S.data.pelanggans.filter(p => {
      if (!p) return false;
      const pOdp = (p.odp || '').trim();
      if (!pOdp || pOdp === '-') return false;
      const pNorm = norm(pOdp);
      return pNorm === odpNorm ||
        (pOdp.length >= 3 && cleanOdpName.toUpperCase().includes(pOdp.toUpperCase())) ||
        (cleanOdpName.length >= 3 && pOdp.toUpperCase().includes(cleanOdpName.toUpperCase()));
    });

    // 2. Cross-check melalui kabel dropcore yang terhubung ke ODP ini
    if (Array.isArray(S.data.dropLines)) {
      S.data.dropLines.forEach(l => {
        if (!l || !l.coords || l.coords.length < 2) return;
        const lineName = (l.name || '').toUpperCase();
        const matchesOdpName = lineName.includes(cleanOdpName.toUpperCase());
        const lastPt = l.coords[l.coords.length - 1];
        const isNearOdp = Math.abs(lastPt[0] - odp.lat) < 0.0002 && Math.abs(lastPt[1] - odp.lng) < 0.0002;
        if (matchesOdpName || isNearOdp) {
          const cust = S.data.pelanggans.find(c => {
            if (!c) return false;
            if (lineName.startsWith(c.nama.toUpperCase())) return true;
            const firstPt = l.coords[0];
            return Math.abs(firstPt[0] - c.lat) < 0.0002 && Math.abs(firstPt[1] - c.lng) < 0.0002;
          });
          if (cust && !connectedCusts.includes(cust)) {
            connectedCusts.push(cust);
          }
        }
      });
    }

    // Urutkan pelanggan: Padam/Mati di posisi atas, lalu Online, lalu Standby
    connectedCusts.sort((a, b) => {
      const aDead = a.isModemDead ? 1 : 0;
      const bDead = b.isModemDead ? 1 : 0;
      if (aDead !== bDead) return bDead - aDead;
      const aOn = (a.modemData && a.modemData.is_active) ? 1 : 0;
      const bOn = (b.modemData && b.modemData.is_active) ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return (a.nama || '').localeCompare(b.nama || '');
    });

    return `
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:100%; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- ODP Header -->
        <div style="background:linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%); border-bottom:1.5px solid #fecaca; padding:12px 14px 10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="display:inline-flex; align-items:center; gap:4px; background:#fee2e2; color:#dc2626; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; box-shadow:0 1px 2px rgba(220,38,38,0.1);">
              <i class="fas fa-box" style="font-size:9.5px;"></i> ODP FIBER
            </span>
            <span style="font-size:10.5px; font-weight:800; color:#dc2626; background:#fff; padding:2px 8px; border-radius:10px; border:1px solid #fecaca;">
              ${connectedCusts.length} Pelanggan
            </span>
          </div>

          <div style="font-size:16px; font-weight:900; color:#0f172a; line-height:1.25; text-transform:uppercase; letter-spacing:-0.2px; word-break:break-word;">
            ${escapeHtml(odp.name)}
          </div>

          <div style="color:#64748b; font-size:11px; margin-top:4px;">
            Wilayah: <b style="color:#0f172a;">${escapeHtml(odp.kec || '-')}</b>
          </div>
        </div>

        <!-- Body Info -->
        <div style="padding:10px 14px 12px;">
          <!-- Port Usage Card -->
          <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">TOTAL PORT TERPAKAI</div>
              <div style="font-size:18px; font-weight:900; color:#0f172a;">
                ${connectedCusts.length} <span style="font-size:11px; color:#64748b; font-weight:600;">Port Terisi</span>
              </div>
            </div>
            <div style="background:#fee2e2; color:#dc2626; width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 2px 5px rgba(220,38,38,0.15);">
              ⚡
            </div>
          </div>

          <!-- DAFTAR NAMA PELANGGAN TERHUBUNG -->
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="font-size:11px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.3px; display:flex; align-items:center; gap:5px;">
                <i class="fas fa-users" style="color:#0284c7;"></i> Daftar Pelanggan (${connectedCusts.length})
              </span>
              <span style="font-size:9.5px; color:#64748b;">(Klik nama untuk ke lokasi)</span>
            </div>

            <div style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; padding:5px;">
              ${connectedCusts.length === 0 ? `
                <div style="padding:16px; text-align:center; color:#94a3b8; font-size:11.5px; font-style:italic;">
                  <i class="fas fa-inbox" style="font-size:22px; display:block; margin-bottom:4px; opacity:0.5;"></i>
                  Belum ada pelanggan terhubung ke ODP ini (Port Kosong)
                </div>
              ` : connectedCusts.map((c, idx) => {
                const isDead = !!c.isModemDead;
                const isOnline = !!(c.modemData && c.modemData.is_active);
                let badgeColor = '#ca8a04';
                let badgeBg = '#fef9c3';
                let statusLabel = 'Standby';
                let dotIcon = '🟡';
                if (isDead) {
                  badgeColor = '#dc2626';
                  badgeBg = '#fee2e2';
                  statusLabel = 'Mati / Offline';
                  dotIcon = '🔴';
                } else if (isOnline) {
                  badgeColor = '#16a34a';
                  badgeBg = '#dcfce7';
                  statusLabel = 'Online';
                  dotIcon = '🟢';
                }

                const dist = (typeof c.lat === 'number' && typeof c.lng === 'number' && typeof odp.lat === 'number' && typeof odp.lng === 'number')
                  ? Math.round(calcDistM(c.lat, c.lng, odp.lat, odp.lng))
                  : null;

                const custKey = c.id || c.nama;
                const ipStr = (c.modemData && c.modemData.ip_address) ? c.modemData.ip_address : '';

                return `
                  <div onclick="window.gisClickCustomerFromOdp('${escapeJsAttr(custKey)}')"
                    style="display:flex; align-items:center; justify-content:space-between; padding:7px 9px; margin-bottom:4px; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; transition:all 0.15s ease;"
                    onmouseover="this.style.borderColor='#38bdf8'; this.style.background='#f0f9ff';"
                    onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#ffffff';"
                    title="Klik untuk membuka detail pelanggan & lokasi ${escapeHtml(c.nama)}">
                    <div style="display:flex; align-items:center; gap:7px; min-width:0; flex:1;">
                      <span style="font-size:11px; font-weight:800; color:#64748b; width:16px; flex-shrink:0;">${idx + 1}.</span>
                      <div style="min-width:0; flex:1;">
                        <div style="font-size:12px; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                          ${escapeHtml(c.nama)}
                        </div>
                        <div style="font-size:10px; color:#64748b; display:flex; align-items:center; gap:6px; margin-top:1px;">
                          ${c.id ? `<span style="font-family:monospace; background:#f1f5f9; padding:0 3px; border-radius:3px;">${escapeHtml(c.id)}</span>` : ''}
                          ${ipStr ? `<span style="font-family:monospace; color:#2563eb;">${escapeHtml(ipStr)}</span>` : ''}
                          ${dist !== null ? `<span style="color:#0284c7; font-weight:700;"><i class="fas fa-arrows-alt-h" style="font-size:9px;"></i> ${dist}m</span>` : ''}
                        </div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:5px; flex-shrink:0; margin-left:6px;">
                      <span style="font-size:9.5px; font-weight:800; color:${badgeColor}; background:${badgeBg}; padding:2px 7px; border-radius:12px; display:inline-flex; align-items:center; gap:3px;">
                        ${dotIcon} ${statusLabel}
                      </span>
                      <i class="fas fa-chevron-right" style="font-size:9px; color:#cbd5e1;"></i>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Coordinate Chip -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; margin-bottom:10px; font-size:11px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#64748b; font-weight:600;"><i class="fas fa-globe" style="color:#0284c7;"></i> Koordinat GPS:</span>
            <span style="font-family:'Consolas',monospace; color:#0284c7; font-weight:800; font-size:10.5px;">${odp.lat.toFixed(6)}, ${odp.lng.toFixed(6)}</span>
          </div>

          <!-- Actions -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button onclick="window.gisNavigasiGoogleMaps(${odp.lat}, ${odp.lng})"
              style="flex:1 1 100%; padding:7px 12px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 3px 6px rgba(16,185,129,0.25);">
              <i class="fas fa-location-arrow"></i> Rute Google Maps
            </button>

            ${admin ? `
              <button onclick="window.gisEditOdp('${escapeJsAttr(odp.name)}')"
                style="flex:1; padding:6px; background:#f1f5f9; color:#1e293b; border:1.5px solid #cbd5e1; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
                <i class="fas fa-edit" style="color:#2563eb;"></i> Edit ODP
              </button>
              <button onclick="window.gisDeleteOdp('${escapeJsAttr(odp.name)}')"
                style="padding:6px 10px; background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer;"
                title="Hapus ODP">
                <i class="fas fa-trash-alt"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Helper: Deteksi ODP yang BENAR-BENAR terhubung melalui KABEL DISTRIBUSI (distLines) dari ODC ini
  function getConnectedOdpsForOdc(odc) {
    if (!odc || !Array.isArray(S.data.odps) || !Array.isArray(S.data.distLines)) return [];

    // Fungsi jarak titik ke segmen garis (meter)
    function ptToSegDistM(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (dx === 0 && dy === 0) return calcDistM(px, py, x1, y1);
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
      return calcDistM(px, py, x1 + t * dx, y1 + t * dy);
    }

    function ptToPolyDistM(lat, lng, coords) {
      if (!coords || coords.length === 0) return 999999;
      if (coords.length === 1) return calcDistM(lat, lng, coords[0][0], coords[0][1]);
      let minD = 999999;
      for (let i = 0; i < coords.length - 1; i++) {
        const d = ptToSegDistM(lat, lng, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
        if (d < minD) minD = d;
      }
      return minD;
    }

    function endToEndDistM(c1, c2) {
      const e1a = c1[0], e1b = c1[c1.length - 1];
      const e2a = c2[0], e2b = c2[c2.length - 1];
      return Math.min(
        calcDistM(e1a[0], e1a[1], e2a[0], e2a[1]),
        calcDistM(e1a[0], e1a[1], e2b[0], e2b[1]),
        calcDistM(e1b[0], e1b[1], e2a[0], e2a[1]),
        calcDistM(e1b[0], e1b[1], e2b[0], e2b[1])
      );
    }

    // 1. Ambil kabel distribusi (distLines) yang LANGSUNG menempel ke ODC ini (jarak <= 35m)
    const directCables = S.data.distLines.filter(l => l.coords && l.coords.length > 0 && ptToPolyDistM(odc.lat, odc.lng, l.coords) <= 35);

    // Jika ODC belum memiliki kabel distribusi sama sekali, kembalikan kosong (TIDAK ASAL MENGIRA-NGIRA)
    if (directCables.length === 0) return [];

    // 2. Telusuri sambungan kabel distribusi berantai (ujung kabel menempel ke ujung kabel lain <= 15m)
    const odcDistCables = [...directCables];
    const visitedCableIds = new Set(directCables.map(c => c.id || c.name));
    const queue = [...directCables];

    while (queue.length > 0) {
      const curr = queue.shift();
      S.data.distLines.forEach(next => {
        const nextId = next.id || next.name;
        if (!visitedCableIds.has(nextId) && next.coords && next.coords.length > 0) {
          if (endToEndDistM(curr.coords, next.coords) <= 15) {
            visitedCableIds.add(nextId);
            odcDistCables.push(next);
            queue.push(next);
          }
        }
      });
    }

    // 3. Cari ODP yang dilalui atau menempel di sepanjang jalur kabel distribusi ODC ini (jarak <= 30m)
    const connectedOdps = [];
    S.data.odps.forEach(o => {
      if (!o || typeof o.lat !== 'number' || typeof o.lng !== 'number') return;
      for (const cable of odcDistCables) {
        if (ptToPolyDistM(o.lat, o.lng, cable.coords) <= 30) {
          connectedOdps.push(o);
          break;
        }
      }
    });

    // Urutkan ODP dari yang terdekat dengan ODC
    return connectedOdps.sort((a, b) => {
      const da = calcDistM(odc.lat, odc.lng, a.lat, a.lng);
      const db = calcDistM(odc.lat, odc.lng, b.lat, b.lng);
      return da - db;
    });
  }

  // Popup ODC - TEMA MODERN TERANG DENGAN DAFTAR ODP TERHUBUNG
  function buildOdcPopupHtml(odc) {
    const admin = isAdmin();
    const connectedOdps = getConnectedOdpsForOdc(odc);

    // Hitung total pelanggan di bawah seluruh ODP yang terhubung ke ODC ini
    const odpNameSet = new Set(connectedOdps.map(o => (o.name || '').trim().toUpperCase()));
    let totalCustUnderOdc = 0;
    if (Array.isArray(S.data.pelanggans)) {
      S.data.pelanggans.forEach(p => {
        const pOdp = (p.odp || '').trim().toUpperCase();
        if (pOdp && odpNameSet.has(pOdp)) {
          totalCustUnderOdc++;
        }
      });
    }

    return `
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:100%; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- ODC Header -->
        <div style="background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-bottom:1.5px solid #fde68a; padding:12px 14px 10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="display:inline-flex; align-items:center; gap:4px; background:#fef3c7; color:#b45309; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; box-shadow:0 1px 2px rgba(180,83,9,0.1);">
              <i class="fas fa-server" style="font-size:9.5px;"></i> ODC CENTRAL
            </span>
            <span style="font-size:10.5px; font-weight:800; color:#b45309; background:#fff; padding:2px 8px; border-radius:10px; border:1px solid #fde68a;">
              ${connectedOdps.length} ODP Terhubung
            </span>
          </div>

          <div style="font-size:16px; font-weight:900; color:#0f172a; line-height:1.25; text-transform:uppercase; letter-spacing:-0.2px; word-break:break-word;">
            ${escapeHtml(odc.name)}
          </div>

          <div style="color:#64748b; font-size:11px; margin-top:4px;">
            Wilayah: <b style="color:#0f172a;">${escapeHtml(odc.kec || '-')}</b>
          </div>
        </div>

        <!-- Body Info -->
        <div style="padding:10px 14px 12px;">
          <!-- ODC Summary Card -->
          <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">DISTRIBUSI ODP & PELANGGAN</div>
              <div style="font-size:17px; font-weight:900; color:#0f172a;">
                ${connectedOdps.length} <span style="font-size:11px; color:#64748b; font-weight:600;">ODP</span>
                <span style="color:#cbd5e1; margin:0 4px;">•</span>
                <span style="color:#0284c7;">${totalCustUnderOdc}</span> <span style="font-size:11px; color:#64748b; font-weight:600;">Pelanggan</span>
              </div>
            </div>
            <div style="background:#fef3c7; color:#d97706; width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 2px 5px rgba(217,119,6,0.15);">
              📦
            </div>
          </div>

          <!-- DAFTAR ODP TERHUBUNG (KABEL DISTRIBUSI FISIK) -->
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="font-size:11px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.3px; display:flex; align-items:center; gap:5px;">
                <i class="fas fa-boxes" style="color:#d97706;"></i> Jalur Kabel Distribusi (${connectedOdps.length} ODP)
              </span>
              <span style="font-size:9.5px; color:#64748b;">(Klik ODP untuk sorot pin)</span>
            </div>

            <div style="max-height:210px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; padding:5px;">
              ${connectedOdps.length === 0 ? `
                <div style="padding:16px; text-align:center; color:#94a3b8; font-size:11.5px; font-style:italic;">
                  <i class="fas fa-network-wired" style="font-size:22px; display:block; margin-bottom:6px; opacity:0.4;"></i>
                  Belum ada jalur kabel distribusi yang terhubung ke ODC ini di peta.
                </div>
              ` : connectedOdps.map((o, idx) => {
                const dist = Math.round(calcDistM(odc.lat, odc.lng, o.lat, o.lng));
                const oClean = (o.name || '').trim().toUpperCase();
                let custCount = 0;
                if (Array.isArray(S.data.pelanggans)) {
                  custCount = S.data.pelanggans.filter(p => {
                    const pOdp = (p.odp || '').trim().toUpperCase();
                    return pOdp === oClean || (pOdp.length >= 3 && oClean.includes(pOdp));
                  }).length;
                }

                return `
                  <div class="odc-odp-item" onclick="window.gisHighlightOdpFromOdc('${escapeJsAttr(o.name)}', this)"
                    style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:5px; background:#ffffff; border:1.5px solid #e2e8f0; border-radius:7px; cursor:pointer; transition:all 0.15s ease;"
                    onmouseover="if(this.style.borderColor!=='rgb(234, 88, 12)') { this.style.borderColor='#fbbf24'; this.style.background='#fffbeb'; }"
                    onmouseout="if(this.style.borderColor!=='rgb(234, 88, 12)') { this.style.borderColor='#e2e8f0'; this.style.background='#ffffff'; }"
                    title="Klik untuk menyorot ODP ${escapeHtml(o.name)} di peta">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                      <span style="font-size:11px; font-weight:800; color:#64748b; width:16px; flex-shrink:0;">${idx + 1}.</span>
                      <div style="min-width:0; flex:1;">
                        <div style="font-size:12px; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                          ${escapeHtml(o.name)}
                        </div>
                        <div style="font-size:10px; color:#64748b; display:flex; align-items:center; gap:6px; margin-top:2px;">
                          <span style="color:#d97706; font-weight:700;"><i class="fas fa-arrows-alt-h" style="font-size:9px;"></i> ${dist}m</span>
                          <span>•</span>
                          <span style="color:#0284c7; font-weight:700;"><i class="fas fa-user" style="font-size:9px;"></i> ${custCount} Port</span>
                        </div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:5px; flex-shrink:0; margin-left:6px;">
                      <span style="font-size:9.5px; font-weight:800; color:#ea580c; background:#ffedd5; padding:2px 8px; border-radius:12px; border:1px solid #fed7aa;">
                        📍 Sorot Pin
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Coordinate Chip -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; margin-bottom:10px; font-size:11px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#64748b; font-weight:600;"><i class="fas fa-globe" style="color:#d97706;"></i> Koordinat GPS:</span>
            <span style="font-family:'Consolas',monospace; color:#d97706; font-weight:800; font-size:10.5px;">${odc.lat.toFixed(6)}, ${odc.lng.toFixed(6)}</span>
          </div>

          <!-- Actions -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button onclick="window.gisNavigasiGoogleMaps(${odc.lat}, ${odc.lng})" 
              style="flex:1 1 100%; padding:7px 12px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 3px 6px rgba(16,185,129,0.25);">
              <i class="fas fa-location-arrow"></i> Buka Rute Google Maps
            </button>

            ${admin ? `
              <button onclick="window.gisEditOdc('${escapeJsAttr(odc.name)}')" 
                style="flex:1; padding:6px; background:#f1f5f9; color:#1e293b; border:1.5px solid #cbd5e1; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
                <i class="fas fa-edit" style="color:#d97706;"></i> Edit ODC
              </button>
              <button onclick="window.gisDeleteOdc('${escapeJsAttr(odc.name)}')" 
                style="padding:6px 10px; background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer;"
                title="Hapus ODC">
                <i class="fas fa-trash-alt"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // FOCUS MAP DI BAWAH MODAL (AUTO ZOOM OUT MENYESUAIKAN LAYAR AGAR PIN TIDAK TERTUTUP)
  // ============================================================================
  function focusMapBelowModal(lat, lng, zoomLevel) {
    if (!S.map || typeof lat !== 'number' || typeof lng !== 'number') return;
    const z = typeof zoomLevel === 'number' ? zoomLevel : 17;
    const isMobile = window.innerWidth <= 768;
    const offsetY = isMobile ? Math.round(window.innerHeight * 0.20) : Math.round(window.innerHeight * 0.14);

    const targetPoint = S.map.project([lat, lng], z);
    const centerPoint = targetPoint.subtract([0, offsetY]);
    const centerLatLng = S.map.unproject(centerPoint, z);

    S.map.setView(centerLatLng, z, { animate: true, duration: 0.35 });
  }
  window.focusMapBelowModal = focusMapBelowModal;

  // ============================================================================
  // MODAL DETAIL PELANGGAN & ODP (TAMPIL DI ATAS PETA - PIN DI BAWAHNYA TIDAK TERTUTUP - 0 BLUR)
  // ============================================================================
  window.gisOpenCustomerDetailModal = function (c) {
    if (!c) return;

    window.__justClickedPin = true;
    setTimeout(() => { window.__justClickedPin = false; }, 350);

    S.selectedTargetCoord = { lat: c.lat, lng: c.lng, id: c.id, nama: c.nama };
    S.lastTargetCust = c;

    let modalEl = document.getElementById('gisCustomerCenterModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'gisCustomerCenterModal';
      modalEl.className = 'gis-center-modal';
      const container = document.getElementById('gisMapContainer') || document.body;
      container.appendChild(modalEl);
    }

    if (window.L && L.DomEvent && !modalEl.__eventsDisabled) {
      L.DomEvent.disableClickPropagation(modalEl);
      L.DomEvent.disableScrollPropagation(modalEl);
      modalEl.__eventsDisabled = true;
    }

    modalEl.innerHTML = `
      <div style="position:relative; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:center; padding-top:6px; padding-bottom:2px;">
          <span style="width:36px; height:4px; border-radius:999px; background:#cbd5e1; display:block;"></span>
        </div>
        <button onclick="window.gisCloseCustomerDetailModal()" class="gis-modal-close-btn" title="Tutup Modal">✕</button>
        ${buildCustomerPopupHtml(c)}
      </div>
    `;

    modalEl.style.display = 'block';
    modalEl.classList.add('show');
    modalEl.scrollTop = 0;
    setTimeout(() => { if (modalEl) modalEl.scrollTop = 0; }, 30);

    // Geser peta agar koordinat pin pelanggan berada tepat di area terbuka di bawah modal
    if (S.map && typeof c.lat === 'number' && typeof c.lng === 'number') {
      const currentZ = S.map.getZoom();
      const targetZ = currentZ >= 16 ? currentZ : 17;
      focusMapBelowModal(c.lat, c.lng, targetZ);
    }

    if (typeof window.gisRenderPelangganMarkers === 'function') {
      window.gisRenderPelangganMarkers();
    }
  };

  window.gisCloseCustomerDetailModal = function () {
    const modalEl = document.getElementById('gisCustomerCenterModal');
    if (modalEl) {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
    const backdropEl = document.getElementById('gisModalBackdrop');
    if (backdropEl) backdropEl.remove();

    S.selectedTargetCoord = null;
    if (S.layers.searchPin) S.layers.searchPin.clearLayers();
    if (S.map) S.map.closePopup();
    if (typeof window.gisRenderPelangganMarkers === 'function') {
      window.gisRenderPelangganMarkers();
    }
  };

  window.gisOpenOdpDetailModal = function (odp) {
    if (!odp) return;

    window.__justClickedPin = true;
    setTimeout(() => { window.__justClickedPin = false; }, 350);

    let modalEl = document.getElementById('gisCustomerCenterModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'gisCustomerCenterModal';
      modalEl.className = 'gis-center-modal';
      const container = document.getElementById('gisMapContainer') || document.body;
      container.appendChild(modalEl);
    }

    if (window.L && L.DomEvent && !modalEl.__eventsDisabled) {
      L.DomEvent.disableClickPropagation(modalEl);
      L.DomEvent.disableScrollPropagation(modalEl);
      modalEl.__eventsDisabled = true;
    }

    modalEl.innerHTML = `
      <div style="position:relative; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:center; padding-top:6px; padding-bottom:2px;">
          <span style="width:36px; height:4px; border-radius:999px; background:#cbd5e1; display:block;"></span>
        </div>
        <button onclick="window.gisCloseCustomerDetailModal()" class="gis-modal-close-btn" title="Tutup Modal">✕</button>
        ${buildOdpPopupHtml(odp)}
      </div>
    `;

    modalEl.style.display = 'block';
    modalEl.classList.add('show');

    if (S.map && typeof odp.lat === 'number' && typeof odp.lng === 'number') {
      const currentZ = S.map.getZoom();
      const targetZ = currentZ >= 16 ? currentZ : 17;
      focusMapBelowModal(odp.lat, odp.lng, targetZ);
    }
  };

  window.gisOpenOdcDetailModal = function (odc) {
    if (!odc) return;

    window.__justClickedPin = true;
    setTimeout(() => { window.__justClickedPin = false; }, 350);

    let modalEl = document.getElementById('gisCustomerCenterModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'gisCustomerCenterModal';
      modalEl.className = 'gis-center-modal';
      const container = document.getElementById('gisMapContainer') || document.body;
      container.appendChild(modalEl);
    }

    if (window.L && L.DomEvent && !modalEl.__eventsDisabled) {
      L.DomEvent.disableClickPropagation(modalEl);
      L.DomEvent.disableScrollPropagation(modalEl);
      modalEl.__eventsDisabled = true;
    }

    modalEl.innerHTML = `
      <div style="position:relative; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:center; padding-top:6px; padding-bottom:2px;">
          <span style="width:36px; height:4px; border-radius:999px; background:#cbd5e1; display:block;"></span>
        </div>
        <button onclick="window.gisCloseCustomerDetailModal()" class="gis-modal-close-btn" title="Tutup Modal">✕</button>
        ${buildOdcPopupHtml(odc)}
      </div>
    `;

    modalEl.style.display = 'block';
    modalEl.classList.add('show');

    if (S.map && typeof odc.lat === 'number' && typeof odc.lng === 'number') {
      const currentZ = S.map.getZoom();
      // SAMAKAN PERSIS DENGAN KLIK ODP / PELANGGAN
      const targetZ = currentZ >= 16 ? currentZ : 17;
      focusMapBelowModal(odc.lat, odc.lng, targetZ);
    }
  };

  // Menyorot lokasi ODP di peta dengan tanda khusus (Radar Beacon) TANPA menutup modal ODC
  window.gisHighlightOdpFromOdc = function (odpName, el) {
    if (!odpName) return;
    const odpKey = String(odpName).trim().toUpperCase();
    const targetOdp = S.data.odps.find(o =>
      (o.id && String(o.id).trim().toUpperCase() === odpKey) ||
      (o.name && String(o.name).trim().toUpperCase() === odpKey)
    );
    if (!targetOdp) return;

    // 1. Berikan efek aktif / terpilih pada baris ODP yang diklik di modal ODC
    if (el) {
      const parentList = el.parentElement;
      if (parentList) {
        const allItems = parentList.querySelectorAll('.odc-odp-item');
        allItems.forEach(item => {
          item.style.borderColor = '#e2e8f0';
          item.style.background = '#ffffff';
        });
      }
      el.style.borderColor = '#ea580c';
      el.style.background = '#fff7ed';
    }

    // 2. Tampilkan penanda khusus di titik ODP (Radar Beacon + Pin Menyala + Label Nama)
    if (S.layers.searchPin) S.layers.searchPin.clearLayers();

    const beaconHtml = `
      <div class="gis-search-beacon-wrap" title="ODP Terpilih: ${escapeHtml(targetOdp.name)}">
        <div class="gis-beacon-wave" style="border-color:#ea580c; background:rgba(234,88,12,0.4);"></div>
        <div class="gis-beacon-wave wave-2" style="border-color:#ea580c; background:rgba(234,88,12,0.2);"></div>
        <div class="gis-beacon-center">
          <span style="font-size:34px; line-height:1; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.65));">📍</span>
        </div>
        <div class="gis-beacon-label" style="background:#ea580c; color:#ffffff; font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:14px; border:2px solid #ffffff; box-shadow:0 4px 14px rgba(234,88,12,0.9); top:-36px; white-space:nowrap; z-index:9999999;">
          ⭐ ${escapeHtml(targetOdp.name)}
        </div>
      </div>
    `;

    const beaconMarker = L.marker([targetOdp.lat, targetOdp.lng], {
      icon: L.divIcon({
        className: 'custom-search-beacon',
        html: beaconHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      }),
      zIndexOffset: 100000
    });
    beaconMarker.addTo(S.layers.searchPin);

    // 3. Geser peta ke lokasi ODP di bawah modal (modal ODC tetap terbuka!)
    const currentZ = S.map ? S.map.getZoom() : 17;
    const targetZ = currentZ >= 16 ? currentZ : 17;
    focusMapBelowModal(targetOdp.lat, targetOdp.lng, targetZ);
  };
  window.gisClickOdpFromOdc = window.gisHighlightOdpFromOdc;

  // Navigasi cepat dari daftar pelanggan di dalam popup/modal ODP ke pin pelanggan
  window.gisClickCustomerFromOdp = function (custIdOrName) {
    if (!custIdOrName) return;
    const custKey = String(custIdOrName).trim().toUpperCase();
    const target = S.data.pelanggans.find(p =>
      (p.id && String(p.id).trim().toUpperCase() === custKey) ||
      (p.nama && String(p.nama).trim().toUpperCase() === custKey)
    );
    if (target) {
      S.selectedTargetCoord = { lat: target.lat, lng: target.lng, id: target.id };
      window.gisRenderPelangganMarkers();
      window.gisOpenCustomerDetailModal(target);
    }
  };

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
  // 7. PENCARIAN (NAMA PELANGGAN / ODP / KOORDINAT LAT-LNG UNIVERSAL PARSER)
  // ============================================================================

  // Helper: Konversi Koordinat Decimal ke Derajat Menit Detik (DMS)
  function toDms(val, type) {
    if (typeof val !== 'number' || isNaN(val)) return '-';
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(1);
    const dir = type === 'lat' ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(4, '0')}"${dir}`;
  }

  // Universal Coordinate Parser:
  // Mendukung:
  // 1. DMS: 8°04'32.3"S 113°14'42.3"E, 8°04'32,3"S 113°14'42,3"E, 8 04 32.3 S 113 14 42.3 E
  // 2. Koma Desimal: -8,1256254, 113,2309915 atau -8,1256254 113,2309915 atau -8,1256254,113,2309915
  // 3. Titik Desimal Standar: -8.075411609192914, 113.24509189964833
  // 4. URL Google Maps: https://maps.google.com/?q=-8.1256254,113.2309915 atau @-8.125,113.230
  function parseCoordinates(input) {
    if (!input || typeof input !== 'string') return null;
    let str = input.trim();

    // 1. Deteksi Google Maps URL pattern: @-8.125,113.230 atau ?q=-8.125,113.230
    const urlMatch = str.match(/[@?&]q?=([ -]?\d+[\.,]\d+)[,\s]+([ -]?\d+[\.,]\d+)/i);
    if (urlMatch) {
      str = urlMatch[1] + ', ' + urlMatch[2];
    }

    // 2. Deteksi DMS (Degrees Minutes Seconds):
    // Contoh: 8°04'32.3"S 113°14'42.3"E atau 8° 04' 32.3" S, 113° 14' 42.3" E
    const dmsRegex = /([0-9]{1,3})\s*[°d:\s]\s*([0-9]{1,2})\s*['m:\s]\s*([0-9]{1,2}(?:[\.,][0-9]+)?)\s*["s]?\s*([NSEW])/gi;
    const dmsMatches = [...str.matchAll(dmsRegex)];
    if (dmsMatches.length === 2) {
      let lat = null, lng = null;
      for (const m of dmsMatches) {
        const deg = parseFloat(m[1]);
        const min = parseFloat(m[2]);
        const sec = parseFloat(m[3].replace(',', '.'));
        const dir = m[4].toUpperCase();
        let dec = deg + (min / 60) + (sec / 3600);
        if (dir === 'S' || dir === 'W') dec = -dec;
        if (dir === 'N' || dir === 'S') lat = dec;
        else if (dir === 'E' || dir === 'W') lng = dec;
      }
      if (lat !== null && lng !== null) {
        return sanitizeLatLng(lat, lng);
      }
    }

    // DMS format spasi biasa: 8 04 32.3 S 113 14 42.3 E
    const dmsLooseRegex = /([0-9]{1,3})\s+([0-9]{1,2})\s+([0-9]{1,2}(?:[\.,][0-9]+)?)\s*([NSEW])/gi;
    const dmsLoose = [...str.matchAll(dmsLooseRegex)];
    if (dmsLoose.length === 2) {
      let lat = null, lng = null;
      for (const m of dmsLoose) {
        const deg = parseFloat(m[1]);
        const min = parseFloat(m[2]);
        const sec = parseFloat(m[3].replace(',', '.'));
        const dir = m[4].toUpperCase();
        let dec = deg + (min / 60) + (sec / 3600);
        if (dir === 'S' || dir === 'W') dec = -dec;
        if (dir === 'N' || dir === 'S') lat = dec;
        else if (dir === 'E' || dir === 'W') lng = dec;
      }
      if (lat !== null && lng !== null) {
        return sanitizeLatLng(lat, lng);
      }
    }

    // 3. Format Desimal dengan Koma atau Titik
    let cleaned = str.replace(/[°"']/gi, '').trim();

    // Kasus A: Dipisah tanda titik koma, slash, atau pipe: '-8,1256; 113,2309'
    let parts = cleaned.split(/[;/|]/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      const p0 = parseFloat(parts[0].replace(',', '.'));
      const p1 = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(p0) && !isNaN(p1)) return sanitizeLatLng(p0, p1);
    }

    // Kasus B: Dipisah koma dan spasi: '-8,1256254, 113,2309915'
    if (cleaned.includes(', ')) {
      parts = cleaned.split(/,\s+/).map(s => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        const p0 = parseFloat(parts[0].replace(',', '.'));
        const p1 = parseFloat(parts[1].replace(',', '.'));
        if (!isNaN(p0) && !isNaN(p1)) return sanitizeLatLng(p0, p1);
      }
    }

    // Kasus C: Dipisah spasi: '-8,1256254 113,2309915' atau '-8.1256254 113.2309915'
    parts = cleaned.split(/\s+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      const p0 = parseFloat(parts[0].replace(',', '.'));
      const p1 = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(p0) && !isNaN(p1)) return sanitizeLatLng(p0, p1);
    }

    // Kasus D: Koma rapat tanpa spasi: '-8,1256254,113,2309915' (4 bagian koma)
    const commaParts = cleaned.split(',').map(s => s.trim());
    if (commaParts.length === 4) {
      const p0 = parseFloat(commaParts[0] + '.' + commaParts[1]);
      const p1 = parseFloat(commaParts[2] + '.' + commaParts[3]);
      if (!isNaN(p0) && !isNaN(p1)) return sanitizeLatLng(p0, p1);
    }

    // Kasus E: Titik desimal standar: '-8.075411609192914, 113.24509189964833'
    const dotMatch = cleaned.match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
    if (dotMatch) {
      const p0 = parseFloat(dotMatch[1]);
      const p1 = parseFloat(dotMatch[2]);
      if (!isNaN(p0) && !isNaN(p1)) return sanitizeLatLng(p0, p1);
    }

    return null;
  }

  function sanitizeLatLng(lat, lng) {
    // Balik jika user input Longitude duluan lalu Latitude (misal 113..., -8...)
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      const t = lat; lat = lng; lng = t;
    }
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
    return null;
  }

  window.gisParseCoordinates = parseCoordinates;

  window.gisSearchInput = function (query) {
    const dropdown = document.getElementById('gisSearchResultsDropdown');
    if (!dropdown) return;

    const q = (query || '').trim();
    if (!q || q.length < 1) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const results = [];
    const qUpper = q.toUpperCase();

    // 1. CEK KOORDINAT UNIVERSAL (DMS / DECIMAL KOMA / DECIMAL TITIK / GOOGLE MAPS)
    const coord = parseCoordinates(q);
    if (coord) {
      const lat = coord.lat;
      const lng = coord.lng;
      results.push({
        type: 'coord',
        title: `📍 Koordinat GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        subtitle: `DMS: ${toDms(lat, 'lat')} ${toDms(lng, 'lng')} ➜ Klik untuk langsung menuju titik ini`,
        lat,
        lng
      });

      // Cari pelanggan atau ODP terdekat di sekitar koordinat ini (<500 meter)
      const nearbyCust = S.data.pelanggans
        .map(c => ({ item: c, dist: Math.round(calcDistM(lat, lng, c.lat, c.lng)) }))
        .filter(c => c.dist <= 500)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);

      nearbyCust.forEach(nc => {
        results.push({
          type: 'pelanggan',
          title: `👤 ${nc.item.nama} (${nc.dist}m dari koordinat)`,
          subtitle: `ODP: ${nc.item.odp || '-'} | Koordinat: ${nc.item.lat.toFixed(6)}, ${nc.item.lng.toFixed(6)}`,
          lat: nc.item.lat,
          lng: nc.item.lng,
          item: nc.item
        });
      });
    } else {
      // User mengetik 1 angka saja (contoh 113.2206 atau -8.137)
      const cleanSingle = q.replace(/[^\d.,\-]/g, '').trim().replace(',', '.');
      const num = parseFloat(cleanSingle);
      if (!isNaN(num) && (num > 100 || num < -5) && cleanSingle.length >= 4) {
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
    dropdown.innerHTML = displayResults.map((r, idx) => {
      const safeTitle = escapeHtml(r.title).replace(/'/g, "\\'");
      const safeId = escapeHtml(r.item && r.item.id ? r.item.id : '').replace(/'/g, "\\'");
      return `
        <div class="gis-search-item" onclick="window.gisSelectSearchResult(${r.lat}, ${r.lng}, '${r.type}', '${safeTitle}', '${safeId}')">
          <div style="min-width:0; flex:1; padding-right:8px;">
            <div style="font-weight:700; word-break:break-word;">${r.title}</div>
            <div style="font-size:11px; color:#64748b; word-break:break-word;">${r.subtitle}</div>
          </div>
          <span style="font-size:11px; color:#2563eb; font-weight:800; white-space:nowrap; flex-shrink:0;">Lihat ➜</span>
        </div>
      `;
    }).join('');

    // KUNCI PROPAGASI SCROLL AGAR MAP TIDAK IKUT GESER (BUG 1 FIX)
    if (window.L && L.DomEvent) {
      L.DomEvent.disableScrollPropagation(dropdown);
      L.DomEvent.disableClickPropagation(dropdown);
    }
    dropdown.onwheel = function (e) { e.stopPropagation(); };
    dropdown.ontouchstart = function (e) { e.stopPropagation(); };
    dropdown.ontouchmove = function (e) { e.stopPropagation(); };
  };

  // Keyboard Enter shortcut untuk Search Input
  window.gisSearchKeyDown = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = document.getElementById('gisSearchInputField');
      const val = (input ? input.value : '').trim();
      if (!val) return;

      const coord = parseCoordinates(val);
      if (coord) {
        window.gisSelectSearchResult(coord.lat, coord.lng, 'coord', `📍 Koordinat: ${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`);
        return;
      }

      // Pilih item pertama dari hasil pencarian yang sedang tampil
      const firstItem = document.querySelector('#gisSearchResultsDropdown .gis-search-item');
      if (firstItem) {
        firstItem.click();
      }
    }
  };

  // Saat salah satu hasil pencarian diklik
  window.gisSelectSearchResult = function (lat, lng, type, title, id) {
    const dropdown = document.getElementById('gisSearchResultsDropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Bersihkan penanda pencarian sebelumnya
    S.layers.searchPin.clearLayers();

    // Simpan koordinat target aktif untuk sembunyikan nama tetangga rapat (<45m) agar tidak menimpa nama target
    const displayTitle = (title || 'Pelanggan').replace(/^[🟢🔴🟡👤\s]+/, '').trim();
    S.selectedTargetCoord = { lat, lng, id: id || '', nama: displayTitle };

    // 1. AUTO ZOOM OUT KE ZOOM 17 & GESER PIN KE AREA TENGAH DI BAWAH MODAL
    focusMapBelowModal(lat, lng, 17);

    // Segera render ulang penanda pelanggan di viewport baru
    window.gisRenderPelangganMarkers();

    // 2. PENANDA KHUSUS TITIK PENCARIAN (RADAR BEACON + PIN TARGET + LABEL NAMA MENYALA)
    const isCoordSearch = type === 'coord';

    const beaconHtml = `
      <div class="gis-search-beacon-wrap" title="Titik Lokasi: ${escapeHtml(displayTitle)}">
        <div class="gis-beacon-wave" style="border-color:#2563eb; background:rgba(37,99,235,0.35);"></div>
        <div class="gis-beacon-wave wave-2" style="border-color:#2563eb; background:rgba(37,99,235,0.2);"></div>
        <div class="gis-beacon-center">
          <span style="font-size:34px; line-height:1; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.65));">📍</span>
        </div>
        <div class="gis-beacon-label" style="background:#1d4ed8; color:#ffffff; font-size:11.5px; font-weight:800; padding:4px 12px; border-radius:14px; border:2px solid #ffffff; box-shadow:0 4px 14px rgba(29,78,216,0.9); top:-36px; white-space:nowrap; z-index:9999999;">
          ⭐ ${escapeHtml(displayTitle)}
        </div>
      </div>
    `;

    const searchTargetIcon = L.divIcon({
      className: 'custom-search-beacon',
      html: beaconHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const targetMarker = L.marker([lat, lng], {
      pane: 'searchPinPane',
      icon: searchTargetIcon,
      zIndexOffset: 9999999 // Tampil paling atas agar selalu jelas terlihat
    }).addTo(S.layers.searchPin);

    targetMarker.on('click', function (e) {
      window.__justClickedPin = true;
      setTimeout(() => { window.__justClickedPin = false; }, 350);
      if (e && e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }
      if (type === 'pelanggan' && S.lastTargetCust) {
        window.gisOpenCustomerDetailModal(S.lastTargetCust);
      }
    });

    // Popup Info
    const POPUP_OPT = {
      autoPan: false,
      closeButton: true,
      maxWidth: isMobile ? Math.min(285, window.innerWidth - 24) : 320
    };

    const dmsStr = `${toDms(lat, 'lat')} ${toDms(lng, 'lng')}`;

    if (type === 'coord') {
      const popupContent = `
        <div style="font-family:'Segoe UI',sans-serif; width:100%; max-width:280px; background:#ffffff; color:#1e293b; box-sizing:border-box; border-radius:8px; overflow:hidden;">
          <div style="background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom:1.5px solid #bfdbfe; padding:10px 14px 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="display:inline-flex; align-items:center; gap:5px; background:#ffffff; color:#1d4ed8; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; border:1px solid #93c5fd;">
                🎯 TITIK KOORDINAT DICARI
              </span>
              <button onclick="window.gisClearSearchPin()" style="background:none; border:none; color:#dc2626; font-size:11px; font-weight:800; cursor:pointer;" title="Hapus penanda ini">
                ✖ Tutup
              </button>
            </div>
            <div style="font-size:13.5px; font-weight:900; color:#0f172a; margin-top:6px; font-family:'Consolas',monospace;">
              ${lat.toFixed(7)}, ${lng.toFixed(7)}
            </div>
            <div style="font-size:10.5px; color:#475569; font-weight:700; margin-top:2px;">
              DMS: <b>${dmsStr}</b>
            </div>
          </div>
          <div style="padding:10px 14px; display:flex; flex-direction:column; gap:6px;">
            <button onclick="window.gisNavigasiGoogleMaps(${lat}, ${lng})"
              style="padding:7px 12px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 4px rgba(16,185,129,0.25);">
              <i class="fas fa-location-arrow"></i> Buka Rute Google Maps
            </button>
            ${isAdmin() ? `
              <button onclick="window.gisOpenModalTambahPelanggan(${lat}, ${lng})"
                style="padding:7px 12px; background:#2563eb; color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                <i class="fas fa-user-plus"></i> + Tambah Pelanggan di Sini
              </button>
              <button onclick="window.gisOpenModalTambahOdp(${lat}, ${lng})"
                style="padding:7px 12px; background:#dc2626; color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                <i class="fas fa-box"></i> + Tambah ODP di Sini
              </button>
            ` : ''}
            <button onclick="window.gisClearSearchPin()"
              style="padding:6px 12px; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer; margin-top:2px;">
              🗑️ Hapus Penanda Ini Dari Peta
            </button>
          </div>
        </div>
      `;

      setTimeout(() => {
        targetMarker.bindPopup(popupContent, POPUP_OPT).openPopup();
      }, 500);
      return;
    }

    // Jika mencari Pelanggan / ODP / ODC: Buka Modal Otomatis Tepat di Titik Pelanggan (SEKETIKA TANPA DELAY)
    if (type === 'pelanggan') {
      const cleanTargetId = (id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanTargetName = (title || '').replace(/^[^a-zA-Z0-9]+/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      let cust = null;
      // Prioritas 1: Match persis ID Pelanggan (Anti salah orang)
      if (cleanTargetId && cleanTargetId.length >= 3 && !cleanTargetId.startsWith('plg')) {
        cust = S.data.pelanggans.find(p => {
          const pId = (p.id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return pId && pId === cleanTargetId;
        });
      }
      // Prioritas 2: Match persis Nama Pelanggan
      if (!cust && cleanTargetName && cleanTargetName.length >= 3) {
        cust = S.data.pelanggans.find(p => {
          const pName = (p.nama || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return pName && (pName === cleanTargetName || pName.includes(cleanTargetName) || cleanTargetName.includes(pName));
        });
      }
      // Prioritas 3: Jarak Euclidean Terdekat (< 0.00035 ~35 meter)
      if (!cust) {
        let minDist = Infinity;
        S.data.pelanggans.forEach(p => {
          const d = Math.hypot(p.lat - lat, p.lng - lng);
          if (d < 0.00035 && d < minDist) {
            minDist = d;
            cust = p;
          }
        });
      }

      // Fallback: Jika tidak ditemukan di data lokal, buat objek agar modal tetap otomatis muncul
      if (!cust) {
        cust = {
          id: id || '-',
          nama: (title || '').replace(/^[^a-zA-Z0-9]+/, '').trim() || 'Pelanggan',
          lat: lat,
          lng: lng,
          odp: '-',
          kec: '-',
          alamat: '-'
        };
      }

      // SINKRONKAN STATUS OFFLINE / ONLINE DARI URL PARAMETERS / BOT
      const urlP = new URLSearchParams(window.location.search);
      const urlStatus = urlP.get('status');
      const urlLastOff = urlP.get('last_off');
      const urlRouter = urlP.get('router');
      if (urlStatus === 'offline') {
        cust.isModemDead = true;
        if (!cust.modemData) cust.modemData = {};
        cust.modemData.is_active = false;
        cust.modemData.last_logged_out = urlLastOff || cust.modemData.last_logged_out || 'Hari ini';
        cust.modemData.router_name = urlRouter || cust.modemData.router_name || '-';
      } else if (urlStatus === 'online') {
        cust.isModemDead = false;
        if (!cust.modemData) cust.modemData = {};
        cust.modemData.is_active = true;
        cust.modemData.router_name = urlRouter || cust.modemData.router_name || '-';
      }

      window.gisOpenCustomerDetailModal(cust);
      return;
    } else if (type === 'odp') {
      let odp = S.data.odps.find(o => o.name === title || (id && o.id === id));
      if (!odp) {
        let minDist = Infinity;
        S.data.odps.forEach(o => {
          const d = Math.hypot(o.lat - lat, o.lng - lng);
          if (d < 0.00035 && d < minDist) {
            minDist = d;
            odp = o;
          }
        });
      }
      if (odp) {
        window.gisOpenOdpDetailModal(odp);
        return;
      }
    } else if (type === 'odc') {
      const odc = S.data.odcs.find(o => Math.abs(o.lat - lat) < 0.00015 && Math.abs(o.lng - lng) < 0.00015);
      if (odc) {
        L.popup(POPUP_OPT).setLatLng([odc.lat, odc.lng]).setContent(buildOdcPopupHtml(odc)).openOn(S.map);
        return;
      }
    }
  };

  // Hapus Penanda Pencarian Sementara & Tutup Modal
  window.gisClearSearchPin = function () {
    if (S.layers.searchPin) S.layers.searchPin.clearLayers();
    if (S.map) S.map.closePopup();
    S.selectedTargetCoord = null;
    const modalEl = document.getElementById('gisCustomerCenterModal');
    if (modalEl) {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
    if (typeof window.gisRenderPelangganMarkers === 'function') {
      window.gisRenderPelangganMarkers();
    }
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
    if (!S.activeTool) {
      window.gisCancelConnectDropcore();
    }

    document.querySelectorAll('.gis-tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === S.activeTool);
    });

    if (S.activeTool) {
      const labels = {
        'add-pelanggan': '👤 Klik di peta pada lokasi rumah pelanggan baru!',
        'add-odp': '📦 Klik di peta pada lokasi tiang ODP baru!',
        'add-odc': '🏢 Klik di peta pada lokasi ODC baru!',
        'draw-cable': '✏️ Klik Pin Pelanggan lalu Pin ODP untuk otomatis membuat dropcore, atau klik peta!',
        'cut-cable': '✂️ Klik pada jalur kabel di peta untuk memotong kabel di titik tersebut!'
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
    // Jika baru saja mengklik pin marker, JANGAN tutup modal!
    if (window.__justClickedPin) return;

    // Hilangkan modal dan penanda pin target saat klik sembarang tempat kosong di peta
    window.gisCloseCustomerDetailModal();
    if (S.layers.searchPin && S.layers.searchPin.getLayers().length > 0) {
      window.gisClearSearchPin();
    }

    if (!isAdmin()) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (S.pendingMovePin) {
      const { type, idOrName } = S.pendingMovePin;
      S.pendingMovePin = null;
      removeConnectingBanner();

      let item = null;
      if (type === 'pelanggan') item = S.data.pelanggans.find(p => p.id === idOrName || p.nama === idOrName);
      else if (type === 'odp') item = S.data.odps.find(o => o.name === idOrName || o.id === idOrName);
      else if (type === 'odc') item = S.data.odcs.find(o => o.name === idOrName || o.id === idOrName);
      else if (type === 'lainnya') item = S.data.lainnya.find(l => l.nama === idOrName || l.id === idOrName);

      if (item) {
        const oldLat = item.lat;
        const oldLng = item.lng;
        item.lat = lat;
        item.lng = lng;

        // Otomatis tarik ujung kabel yang terhubung ke lokasi baru!
        moveConnectedCables(oldLat, oldLng, lat, lng, item.name || item.nama);

        saveLocalData();
        renderAllLayers();

        Swal.fire({
          icon: 'success',
          title: '📍 Lokasi Berhasil Dipindahkan!',
          text: `Posisi ${item.name || item.nama} & kabel terhubung berhasil diperbarui ke titik (${lat.toFixed(6)}, ${lng.toFixed(6)}).`,
          timer: 2500,
          showConfirmButton: false
        });
      }
      return;
    }

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
    } else if (S.activeTool === 'cut-cable') {
      window.gisFindAndCutCableNear(lat, lng);
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

  // ============================================================================
  // EDIT & DELETE PIN UNIVERSAL (PELANGGAN, ODP, ODC) + KABEL MENGIKUTI POSISI PIN
  // ============================================================================

  // 1. UPDATE TITIK KOORDINAT KABEL YANG TERHUBUNG (KABEL MENGIKUTI LOKASI PIN)
  function moveConnectedCables(oldLat, oldLng, newLat, newLng, pinName) {
    const THRESHOLD = 0.00018; // Toleransi radius ~18 meter

    let movedCount = 0;
    const updateCoordsInList = (list) => {
      list.forEach(line => {
        if (!line.coords || !Array.isArray(line.coords)) return;
        line.coords.forEach(pt => {
          if (Array.isArray(pt) && pt.length >= 2) {
            const d = Math.abs(pt[0] - oldLat) + Math.abs(pt[1] - oldLng);
            if (d < THRESHOLD) {
              pt[0] = newLat;
              pt[1] = newLng;
              movedCount++;
            }
          }
        });
      });
    };

    updateCoordsInList(S.data.feederLines);
    updateCoordsInList(S.data.distLines);
    updateCoordsInList(S.data.dropLines);
    console.log(`[MAP GIS] Memindahkan ${movedCount} titik ujung kabel mengikuti pin ${pinName}.`);
  }

  // 2. TRANSFORMASI TIPE PIN OTOMATIS BERDASARKAN NAMA / LABEL
  function transformPinType(item, currentType, newName, newLat, newLng, newId = null) {
    const upper = newName.trim().toUpperCase();
    let targetType = 'pelanggan';
    if (upper.startsWith('ODC') || upper.includes('ODC-') || upper.includes('ODC/')) {
      targetType = 'odc';
    } else if (upper.startsWith('ODP') || upper.startsWith('LMJ/') || upper.includes('ODP-') || upper.includes('ODP/')) {
      targetType = 'odp';
    } else if (upper.startsWith('TIANG') || upper.startsWith('SLACK') || upper.startsWith('COLE') || upper.startsWith('CLOSURE')) {
      targetType = 'lainnya';
    }

    const oldLat = item.lat;
    const oldLng = item.lng;
    const finalLat = typeof newLat === 'number' && !isNaN(newLat) ? newLat : oldLat;
    const finalLng = typeof newLng === 'number' && !isNaN(newLng) ? newLng : oldLng;

    // Jika koordinat bergeser, pindahkan semua kabel yang menempel pada pin ini
    if (Math.abs(finalLat - oldLat) > 0.000001 || Math.abs(finalLng - oldLng) > 0.000001) {
      moveConnectedCables(oldLat, oldLng, finalLat, finalLng, item.name || item.nama);
    }

    // Jika jenis pin berubah (contoh: dari ODP jadi ODC atau dari Pelanggan jadi ODP/ODC)
    if (targetType !== currentType) {
      if (currentType === 'odc') S.data.odcs = S.data.odcs.filter(x => x !== item);
      else if (currentType === 'odp') S.data.odps = S.data.odps.filter(x => x !== item);
      else if (currentType === 'pelanggan') S.data.pelanggans = S.data.pelanggans.filter(x => x !== item);
      else if (currentType === 'lainnya') S.data.lainnya = S.data.lainnya.filter(x => x !== item);

      if (targetType === 'odc') {
        const finalName = upper.startsWith('ODC') ? upper : ('ODC-' + upper);
        S.data.odcs.push({
          id: item.id || ('odc_' + Date.now()),
          name: finalName,
          lat: finalLat,
          lng: finalLng,
          kec: item.kec || 'KECAMATAN SUKODONO'
        });
        Swal.fire({ icon: 'success', title: 'Berubah Menjadi Pin ODC!', text: `Pin "${finalName}" berhasil diubah menjadi ODC.`, timer: 2200, showConfirmButton: false });
      } else if (targetType === 'odp') {
        const finalName = (upper.startsWith('ODP') || upper.startsWith('LMJ/')) ? upper : ('ODP-' + upper);
        S.data.odps.push({
          id: item.id || ('odp_' + Date.now()),
          name: finalName,
          lat: finalLat,
          lng: finalLng,
          kec: item.kec || 'KECAMATAN SUKODONO'
        });
        Swal.fire({ icon: 'success', title: 'Berubah Menjadi Pin ODP!', text: `Pin "${finalName}" berhasil diubah menjadi ODP.`, timer: 2200, showConfirmButton: false });
      } else if (targetType === 'pelanggan') {
        const finalCustId = (newId !== null && String(newId).trim()) ? String(newId).trim() : (item.id || ('plg_' + Date.now()));
        S.data.pelanggans.push({
          id: finalCustId,
          nama: upper,
          lat: finalLat,
          lng: finalLng,
          odp: item.odp || '-',
          kec: item.kec || 'KECAMATAN SUKODONO',
          alamat: item.alamat || '-',
          hasDropcore: item.hasDropcore || false
        });
        Swal.fire({ icon: 'success', title: 'Berubah Menjadi Pin Pelanggan!', text: `Pin "${upper}" berhasil diubah menjadi Pelanggan.`, timer: 2200, showConfirmButton: false });
      } else if (targetType === 'lainnya') {
        S.data.lainnya.push({
          id: item.id || ('lainnya_' + Date.now()),
          nama: upper,
          lat: finalLat,
          lng: finalLng,
          type: 'Infrastruktur',
          kec: item.kec || 'KECAMATAN SUKODONO'
        });
      }
    } else {
      // Tipe sama, perbarui data nama & koordinat
      if (currentType === 'odc' || currentType === 'odp') item.name = upper;
      else if (currentType === 'pelanggan') {
        item.nama = upper;
        if (newId !== null) {
          const trimmedId = String(newId).trim();
          item.id = trimmedId ? trimmedId : (item.id || ('plg_' + Date.now()));
        }
      }
      else if (currentType === 'lainnya') item.nama = upper;
      item.lat = finalLat;
      item.lng = finalLng;
      Swal.fire({ icon: 'success', title: 'Perubahan Disimpan!', timer: 1600, showConfirmButton: false });
    }

    saveLocalData();
    if (currentType === 'pelanggan' || targetType === 'pelanggan') {
      if (typeof syncModemStatusWithMap === 'function') {
        syncModemStatusWithMap();
      }
    }
    renderAllLayers();
  }

  // 3. UNIVERSAL PIN EDIT MODAL (PELANGGAN, ODP, ODC, LAINNYA)
  window.gisEditAnyPin = function (type, idOrName) {
    if (!isAdmin()) return;

    let item = null;
    if (type === 'pelanggan') {
      item = S.data.pelanggans.find(p => p.id === idOrName || p.nama === idOrName);
    } else if (type === 'odp') {
      item = S.data.odps.find(o => o.name === idOrName || o.id === idOrName);
    } else if (type === 'odc') {
      item = S.data.odcs.find(o => o.name === idOrName || o.id === idOrName);
    } else if (type === 'lainnya') {
      item = S.data.lainnya.find(l => l.nama === idOrName || l.id === idOrName);
    }

    if (!item) {
      Swal.fire('Error', 'Data pin tidak ditemukan!', 'error');
      return;
    }

    const currentName = item.name || item.nama || '';
    const currentId = (item.id && !item.id.startsWith('plg_') && item.id !== '-') ? item.id : (item.id || '');
    const currentLat = item.lat;
    const currentLng = item.lng;

    Swal.fire({
      title: `✏️ Edit Pin (${type.toUpperCase()})`,
      html: `
        <div style="text-align:left; font-size:13px; color:#1e293b;">
          ${type === 'pelanggan' ? `
            <div style="margin-bottom:8px;">
              <label style="font-weight:700; color:#1e293b;">ID Pelanggan:</label>
              <input type="text" id="swalEditPinId" class="swal2-input" value="${escapeHtml(currentId)}" placeholder="Contoh: 1510/RTL/KT-034/005" style="width:100%; margin:4px 0; text-transform:uppercase; font-family:'Consolas','Courier New',monospace; font-weight:700; letter-spacing:0.3px;">
              <div style="font-size:11px; color:#64748b; margin-top:2px;">
                💡 Masukkan ID Pelanggan MikroTik / Billing untuk sinkronisasi status modem & ODP.
              </div>
            </div>
          ` : ''}

          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">Nama / Label Pin:</label>
            <input type="text" id="swalEditPinName" class="swal2-input" value="${escapeHtml(currentName)}" style="width:100%; margin:4px 0;">
            <div style="font-size:11px; color:#64748b; margin-top:2px;">
              💡 <b>Auto-Convert:</b> Awali dengan <b>ODC-</b> untuk Pin ODC, <b>ODP-</b> untuk Pin ODP, atau nama biasa untuk Pelanggan.
            </div>
          </div>

          ${type === 'pelanggan' ? `
            <div style="margin-bottom:8px;">
              <label style="font-weight:700;">ODP Terhubung:</label>
              <input type="text" id="swalEditPinOdp" class="swal2-input" value="${escapeHtml(item.odp || '-')}" style="width:100%; margin:4px 0;">
            </div>
            <div style="margin-bottom:8px;">
              <label style="font-weight:700;">Alamat:</label>
              <input type="text" id="swalEditPinAlamat" class="swal2-input" value="${escapeHtml(item.alamat || '-')}" style="width:100%; margin:4px 0;">
            </div>
          ` : ''}

          <div style="margin-bottom:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px;">
            <label style="font-weight:700; font-size:11px; color:#475569;">Paste Koordinat Bebas (DMS / Google Maps / Koma):</label>
            <input type="text" id="swalEditPinQuickCoord" placeholder="Contoh: 8°04'32.3&quot;S 113°14'42.3&quot;E atau -8,125..., 113,230..."
              oninput="window.gisQuickParseCoordInput(this.value)"
              class="swal2-input" style="width:100%; margin:4px 0; font-size:11px; padding:6px 8px; height:auto;">
            <div style="font-size:10px; color:#64748b;">Mendukung format DMS, desimal koma, dan link Google Maps.</div>
          </div>

          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <div style="flex:1;">
              <label style="font-weight:700; font-size:11.5px;">Latitude:</label>
              <input type="number" step="any" id="swalEditPinLat" class="swal2-input" value="${currentLat.toFixed(6)}" style="width:100%; margin:4px 0; font-family:monospace; font-size:12px;">
            </div>
            <div style="flex:1;">
              <label style="font-weight:700; font-size:11.5px;">Longitude:</label>
              <input type="number" step="any" id="swalEditPinLng" class="swal2-input" value="${currentLng.toFixed(6)}" style="width:100%; margin:4px 0; font-family:monospace; font-size:12px;">
            </div>
          </div>

          <button type="button" onclick="window.gisPickNewLocation('${type}', '${escapeHtml(idOrName)}')"
            style="width:100%; padding:8px 12px; background:#eff6ff; color:#1d4ed8; border:1.5px solid #93c5fd; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
            <i class="fas fa-crosshairs"></i> 📍 Geser / Pilih Posisi Baru di Peta
          </button>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '💾 Simpan Perubahan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const nameVal = document.getElementById('swalEditPinName').value.trim();
        let latVal = parseFloat(document.getElementById('swalEditPinLat').value);
        let lngVal = parseFloat(document.getElementById('swalEditPinLng').value);

        const quickEl = document.getElementById('swalEditPinQuickCoord');
        if (quickEl && quickEl.value.trim()) {
          const parsed = parseCoordinates(quickEl.value.trim());
          if (parsed) {
            latVal = parsed.lat;
            lngVal = parsed.lng;
          }
        }
        if (!nameVal) {
          Swal.showValidationMessage('Nama / label pin tidak boleh kosong!');
          return false;
        }
        if (isNaN(latVal) || isNaN(lngVal)) {
          Swal.showValidationMessage('Koordinat latitude dan longitude tidak valid!');
          return false;
        }
        return {
          name: nameVal,
          lat: latVal,
          lng: lngVal,
          id: document.getElementById('swalEditPinId') ? document.getElementById('swalEditPinId').value.trim() : null,
          odp: document.getElementById('swalEditPinOdp') ? document.getElementById('swalEditPinOdp').value.trim() : null,
          alamat: document.getElementById('swalEditPinAlamat') ? document.getElementById('swalEditPinAlamat').value.trim() : null
        };
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        if (type === 'pelanggan' && item) {
          if (res.value.id !== null) {
            item.id = res.value.id ? res.value.id : (item.id || ('plg_' + Date.now()));
          }
          if (res.value.odp !== null) item.odp = res.value.odp;
          if (res.value.alamat !== null) item.alamat = res.value.alamat;
        }
        transformPinType(item, type, res.value.name, res.value.lat, res.value.lng, res.value.id);
      }
    });
  };

  window.gisQuickParseCoordInput = function (val) {
    const c = parseCoordinates(val);
    if (c) {
      const latEl = document.getElementById('swalEditPinLat');
      const lngEl = document.getElementById('swalEditPinLng');
      if (latEl) latEl.value = c.lat.toFixed(6);
      if (lngEl) lngEl.value = c.lng.toFixed(6);
    }
  };

  window.gisEditPelanggan = (id) => window.gisEditAnyPin('pelanggan', id);
  window.gisEditOdp = (name) => window.gisEditAnyPin('odp', name);
  window.gisEditOdc = (name) => window.gisEditAnyPin('odc', name);

  // 4. PICK NEW LOCATION ON MAP (GESER POSISI PIN)
  window.gisPickNewLocation = function (type, idOrName) {
    if (!isAdmin()) return;
    if (S.map) S.map.closePopup();
    Swal.close();

    S.pendingMovePin = { type, idOrName };

    showDropcoreConnectingBanner(`📍 <b>Pindah Lokasi:</b> Klik posisi baru di peta untuk memindahkan pin!`);
  };

  // 5. HAPUS PIN TANPA MEMUTUS / MEMINDAHKAN JALUR KABEL
  window.gisDeletePelanggan = function (identifier) {
    if (!isAdmin()) return;
    Swal.fire({
      title: 'Hapus Pelanggan?',
      text: `Hapus ${identifier}? Kabel yang terhubung akan tetap aman di posisinya.`,
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

  window.gisDeleteOdp = function (odpName) {
    if (!isAdmin()) return;
    Swal.fire({
      title: 'Hapus ODP?',
      text: `Hapus ${odpName}? Jalur kabel distribusi dan dropcore akan tetap terhubung di posisinya.`,
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

  window.gisDeleteOdc = function (odcName) {
    if (!isAdmin()) return;
    Swal.fire({
      title: 'Hapus ODC?',
      text: `Hapus ${odcName}? Jalur kabel feeder dan distribusi akan tetap terhubung di posisinya.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Hapus!'
    }).then(res => {
      if (res.isConfirmed) {
        S.data.odcs = S.data.odcs.filter(o => o.name !== odcName);
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // ============================================================================
  // GESER JALUR / UJUNG KABEL SECARA INTERAKTIF (DRAGGABLE VERTICES)
  // ============================================================================
  window.gisStartEditCablePoints = function (lineId, cableType) {
    if (!isAdmin()) return;
    if (S.cableEditSession) {
      window.gisCancelCableEdit();
    }

    let targetArray = null;
    if (cableType === 'feeder') {
      targetArray = S.data.feederLines;
    } else if (cableType === 'distribusi') {
      targetArray = S.data.distLines;
    } else {
      targetArray = S.data.dropLines;
    }

    const line = targetArray.find(l => l.id === lineId);
    if (!line || !Array.isArray(line.coords) || line.coords.length < 2) {
      Swal.fire({ icon: 'warning', title: 'Data Titik Kabel Tidak Ditemukan', timer: 1500, showConfirmButton: false });
      return;
    }

    if (S.map && S.map._popup) S.map.closePopup();

    // Simpan koordinat awal (clone)
    const originalCoords = line.coords.map(pt => [pt[0], pt[1]]);
    const currentCoords = line.coords.map(pt => [pt[0], pt[1]]);

    // Buat layer editing khusus (highlight glow)
    const editPolyline = L.polyline(currentCoords, {
      color: '#2563eb',
      weight: 6,
      opacity: 0.95,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(S.map);

    // Buat Draggable Markers untuk setiap titik (terutama ujung awal & ujung akhir)
    const handleMarkers = [];

    function updateHandles() {
      // Hapus handle lama
      handleMarkers.forEach(m => S.map.removeLayer(m));
      handleMarkers.length = 0;

      const totalPts = currentCoords.length;

      currentCoords.forEach((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === totalPts - 1;

        let iconHtml = '';
        let iconSize = [20, 20];
        let iconAnchor = [10, 10];

        if (isStart) {
          // Handle Ujung Awal (Hijau)
          iconHtml = `<div style="width:24px; height:24px; background:#10b981; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 0 2px #059669, 0 3px 8px rgba(0,0,0,0.35); cursor:move; display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:11px; font-weight:900;">A</div>`;
          iconSize = [24, 24];
          iconAnchor = [12, 12];
        } else if (isEnd) {
          // Handle Ujung Akhir (Merah)
          iconHtml = `<div style="width:24px; height:24px; background:#ef4444; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 0 2px #dc2626, 0 3px 8px rgba(0,0,0,0.35); cursor:move; display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:11px; font-weight:900;">B</div>`;
          iconSize = [24, 24];
          iconAnchor = [12, 12];
        } else {
          // Handle Titik Tikungan Tengah (Biru Putih)
          iconHtml = `<div style="width:16px; height:16px; background:#ffffff; border:3px solid #2563eb; border-radius:50%; box-shadow:0 2px 6px rgba(37,99,235,0.35); cursor:move;"></div>`;
          iconSize = [16, 16];
          iconAnchor = [8, 8];
        }

        const handleIcon = L.divIcon({
          className: 'gis-vertex-handle',
          html: iconHtml,
          iconSize: iconSize,
          iconAnchor: iconAnchor
        });

        const handleMarker = L.marker([pt[0], pt[1]], {
          icon: handleIcon,
          draggable: true,
          zIndexOffset: 2000
        }).addTo(S.map);

        handleMarker.bindTooltip(
          isStart ? '🟢 Ujung Awal (Tarik untuk geser)' : (isEnd ? '🔴 Ujung Akhir (Tarik untuk geser)' : `Titik #${idx + 1} (Klik kanan hapus)`),
          { direction: 'top', offset: [0, -12] }
        );

        // Event Drag Real-time (Smooth 60 FPS)
        handleMarker.on('drag', function (e) {
          const newPos = e.target.getLatLng();
          currentCoords[idx] = [newPos.lat, newPos.lng];
          editPolyline.setLatLngs(currentCoords);

          if (isStart || isEnd) {
            window.gisCheckEndpointSnap(newPos, line.id, cableType);
          }
        });

        handleMarker.on('dragend', function (e) {
          const newPos = e.target.getLatLng();
          currentCoords[idx] = [newPos.lat, newPos.lng];
          editPolyline.setLatLngs(currentCoords);

          if (isStart || isEnd) {
            window.gisHandleEndpointDrop(newPos, isStart ? 'start' : 'end', line, cableType, currentCoords, editPolyline, updateHandles);
          }
        });

        // Klik kanan pada titik tengah untuk menghapus titik tersebut
        if (!isStart && !isEnd) {
          handleMarker.on('contextmenu', function (e) {
            L.DomEvent.stop(e);
            if (currentCoords.length <= 2) return;
            currentCoords.splice(idx, 1);
            editPolyline.setLatLngs(currentCoords);
            updateHandles();
          });
        }

        handleMarkers.push(handleMarker);
      });
    }

    updateHandles();

    // Klik pada garis edit untuk menambahkan titik tikungan baru
    editPolyline.on('click', function (e) {
      L.DomEvent.stop(e);
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;

      let bestIdx = 1;
      let minDst = Infinity;
      for (let i = 0; i < currentCoords.length - 1; i++) {
        const midLat = (currentCoords[i][0] + currentCoords[i + 1][0]) / 2;
        const midLng = (currentCoords[i][1] + currentCoords[i + 1][1]) / 2;
        const d = calcDistM(clickedLat, clickedLng, midLat, midLng);
        if (d < minDst) {
          minDst = d;
          bestIdx = i + 1;
        }
      }

      currentCoords.splice(bestIdx, 0, [clickedLat, clickedLng]);
      editPolyline.setLatLngs(currentCoords);
      updateHandles();
    });

    // Simpan sesi aktif
    S.cableEditSession = {
      line,
      cableType,
      editPolyline,
      handleMarkers,
      originalCoords,
      currentCoords
    };

    // Tampilkan Floating Toolbar di Layar
    showCableEditorDock(line.name, cableType);
  };

  function showCableEditorDock(lineName, cableType) {
    removeCableEditorDock();

    const dock = document.createElement('div');
    dock.id = 'gisCableEditorDock';
    dock.style.cssText = `
      position: absolute;
      top: 75px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1500;
      background: #ffffff;
      border: 1.5px solid #3b82f6;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(15,23,42,0.18);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: 'Segoe UI', Inter, sans-serif;
      animation: gisDockSlideIn 0.25s ease-out;
      max-width: 90vw;
    `;

    dock.innerHTML = `
      <div style="display:flex; align-items:center; gap:9px; min-width:0;">
        <span style="font-size:22px; flex-shrink:0;">📍</span>
        <div style="min-width:0;">
          <div style="font-weight:900; font-size:12.5px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            Mode Geser Kabel: <span style="color:#2563eb;">${escapeHtml(lineName)}</span>
          </div>
          <div style="font-size:10.5px; color:#64748b; margin-top:1px;">
            Tarik lingkaran ujung <b>A</b> (awal) atau <b>B</b> (akhir/ODP) untuk memindahkan kabel
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
        <button onclick="window.gisSaveCableEdit()"
          style="padding:7px 14px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; border:none; border-radius:8px; font-weight:800; font-size:11.5px; cursor:pointer; box-shadow:0 2px 6px rgba(16,185,129,0.3); display:flex; align-items:center; gap:5px;">
          <i class="fas fa-check"></i> Simpan Posisi
        </button>
        <button onclick="window.gisCancelCableEdit()"
          style="padding:7px 12px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:8px; font-weight:700; font-size:11.5px; cursor:pointer;">
          ✕ Batal
        </button>
      </div>
    `;

    document.getElementById('gisMapContainer').appendChild(dock);
  }

  function removeCableEditorDock() {
    const el = document.getElementById('gisCableEditorDock');
    if (el) el.remove();
  }

  window.gisSaveCableEdit = function () {
    if (!S.cableEditSession) return;
    const { line, editPolyline, handleMarkers, currentCoords } = S.cableEditSession;

    // Simpan koordinat baru
    line.coords = currentCoords.map(pt => [pt[0], pt[1]]);

    // Bersihkan sesi edit
    if (editPolyline) S.map.removeLayer(editPolyline);
    if (handleMarkers) handleMarkers.forEach(m => S.map.removeLayer(m));
    removeCableEditorDock();
    S.cableEditSession = null;

    // Simpan ke database / backend
    saveLocalData();
    renderAllLayers();

    // Notifikasi modern & elegan
    Swal.fire({
      icon: 'success',
      title: 'Posisi Jalur Kabel Tersimpan!',
      text: 'Ujung dan titik kabel berhasil digeser dan diperbarui.',
      timer: 1800,
      showConfirmButton: false
    });
  };

  // ============================================================================
  // FITUR CUT KABEL (MEMOTONG KABEL TANPA MENGHILANGKANNYA & MENANDAI UJUNG KABEL)
  // FITUR SAMBUNG KABEL (SNAPPING UJUNG KABEL + POP UP + ANIMASI PENYAMBUNGAN ⚡)
  // ============================================================================

  // Proyeksi titik P ke segmen garis A-B (mencari titik potong terdekat)
  function projectPointOnSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
    const dx = bLng - aLng;
    const dy = bLat - aLat;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return [aLat, aLng];
    let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return [aLat + t * dy, aLng + t * dx];
  }

  // Cari kabel terdekat dalam radius ~25 meter saat klik peta dengan tool cut-cable
  window.gisFindAndCutCableNear = function (lat, lng) {
    let closestLine = null;
    let closestType = null;
    let minDistance = 25; // max 25 meter
    let bestCutPoint = null;

    const checkList = [
      { list: S.data.dropLines || [], type: 'dropcore' },
      { list: S.data.distLines || [], type: 'distribusi' },
      { list: S.data.feederLines || [], type: 'feeder' }
    ];

    checkList.forEach(({ list, type }) => {
      list.forEach(l => {
        if (!l.coords || l.coords.length < 2) return;
        for (let i = 0; i < l.coords.length - 1; i++) {
          const pCut = projectPointOnSegment(lat, lng, l.coords[i][0], l.coords[i][1], l.coords[i + 1][0], l.coords[i + 1][1]);
          const d = calcDistM(lat, lng, pCut[0], pCut[1]);
          if (d < minDistance) {
            minDistance = d;
            closestLine = l;
            closestType = type;
            bestCutPoint = pCut;
          }
        }
      });
    });

    if (closestLine && bestCutPoint) {
      window.gisExecuteCutCable(closestLine, closestType, { lat: bestCutPoint[0], lng: bestCutPoint[1] });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Tidak Ada Kabel Terdeteksi',
        text: 'Klik tepat pada garis kabel yang ingin Anda potong (jarak maksimal 25 meter dari garis kabel).',
        timer: 2500,
        showConfirmButton: false
      });
    }
  };

  // Eksekusi pemotongan kabel: membagi polyline menjadi 2 segmen dan menandai titik potong tanpa menghilangkan kabel
  window.gisExecuteCutCable = function (line, type, cutLatLng) {
    if (!isAdmin()) {
      Swal.fire('Akses Dibatasi', 'Hanya Admin yang dapat memotong jalur kabel!', 'warning');
      return;
    }
    if (!line || !line.coords || line.coords.length < 2) return;

    const cutLat = cutLatLng.lat || cutLatLng[0];
    const cutLng = cutLatLng.lng || cutLatLng[1];

    // Cari segmen terdekat
    let bestSegIdx = 0;
    let minDist = Infinity;
    let bestCutPoint = [cutLat, cutLng];

    for (let i = 0; i < line.coords.length - 1; i++) {
      const pCut = projectPointOnSegment(cutLat, cutLng, line.coords[i][0], line.coords[i][1], line.coords[i + 1][0], line.coords[i + 1][1]);
      const d = calcDistM(cutLat, cutLng, pCut[0], pCut[1]);
      if (d < minDist) {
        minDist = d;
        bestSegIdx = i;
        bestCutPoint = pCut;
      }
    }

    // Bentuk dua segmen kabel baru
    const coordsA = line.coords.slice(0, bestSegIdx + 1);
    coordsA.push(bestCutPoint);

    const coordsB = [bestCutPoint];
    for (let j = bestSegIdx + 1; j < line.coords.length; j++) {
      coordsB.push(line.coords[j]);
    }

    let targetArray = null;
    if (type === 'feeder') targetArray = S.data.feederLines;
    else if (type === 'distribusi') targetArray = S.data.distLines;
    else targetArray = S.data.dropLines;

    if (!targetArray) return;

    // Perbarui segmen pertama (tetap pakai ID lama)
    const oldName = line.name || 'Kabel';
    line.coords = coordsA;

    // Buat segmen kedua
    const lineBId = (line.id || 'cable_' + Date.now()) + '_seg2';
    const lineB = {
      id: lineBId,
      name: oldName + ' (Segmen 2)',
      kec: line.kec || 'ALL',
      color: line.color,
      coords: coordsB
    };
    targetArray.push(lineB);

    // Tambah titik ujung kabel (cut endpoint)
    if (!Array.isArray(S.data.cutPoints)) S.data.cutPoints = [];
    const cutId = 'cut_' + Date.now();
    S.data.cutPoints.push({
      id: cutId,
      lat: bestCutPoint[0],
      lng: bestCutPoint[1],
      cableType: type,
      originalName: oldName,
      lineAId: line.id,
      lineBId: lineBId,
      createdAt: new Date().toISOString()
    });

    window.gisSetTool(null);
    saveLocalData();
    renderAllLayers();

    Swal.fire({
      icon: 'success',
      title: '✂️ Kabel Berhasil Dipotong!',
      html: `
        <div style="font-size:13px; color:#1e293b; text-align:center;">
          Kabel <b>${escapeHtml(oldName)}</b> telah dipotong menjadi 2 segmen.<br>
          <span style="display:inline-block; margin-top:6px; color:#ef4444; font-weight:700;">
            📍 Titik ujung kabel (cut point) kini muncul di peta.
          </span>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">
            Kabel tidak hilang. Anda dapat menyambung kembali atau memasang ODP di titik ini kapan saja.
          </div>
        </div>
      `,
      timer: 3500,
      showConfirmButton: false
    });
  };

  // Sambung kembali kabel yang dipotong (Merge / Reconnect)
  window.gisMergeCutCable = function (cutId) {
    if (!isAdmin()) {
      Swal.fire('Akses Dibatasi', 'Hanya Admin yang dapat menyambung kabel!', 'warning');
      return;
    }
    if (!Array.isArray(S.data.cutPoints)) return;
    const cpIdx = S.data.cutPoints.findIndex(c => c.id === cutId);
    if (cpIdx === -1) return;
    const cp = S.data.cutPoints[cpIdx];

    let targetArray = null;
    if (cp.cableType === 'feeder') targetArray = S.data.feederLines;
    else if (cp.cableType === 'distribusi') targetArray = S.data.distLines;
    else targetArray = S.data.dropLines;

    if (!targetArray) return;

    const lineA = targetArray.find(l => l.id === cp.lineAId);
    const lineB = targetArray.find(l => l.id === cp.lineBId);

    if (lineA && lineB) {
      const mergedCoords = [...lineA.coords];
      const startB = (lineB.coords.length > 1 && Math.hypot(lineB.coords[0][0] - cp.lat, lineB.coords[0][1] - cp.lng) < 0.00005) ? 1 : 0;
      for (let k = startB; k < lineB.coords.length; k++) {
        mergedCoords.push(lineB.coords[k]);
      }
      lineA.coords = mergedCoords;

      const bIdx = targetArray.findIndex(l => l.id === cp.lineBId);
      if (bIdx !== -1) targetArray.splice(bIdx, 1);
    }

    S.data.cutPoints.splice(cpIdx, 1);

    if (S.map) S.map.closePopup();
    saveLocalData();
    renderAllLayers();

    Swal.fire({
      icon: 'success',
      title: '🔗 Kabel Berhasil Disambung!',
      text: 'Kedua segmen kabel telah digabungkan kembali secara utuh.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  // Hapus hanya marker titik cut tanpa menghapus kabel
  window.gisDeleteCutPoint = function (cutId) {
    if (!isAdmin()) return;
    if (!Array.isArray(S.data.cutPoints)) return;
    const idx = S.data.cutPoints.findIndex(c => c.id === cutId);
    if (idx !== -1) {
      S.data.cutPoints.splice(idx, 1);
      if (S.map) S.map.closePopup();
      saveLocalData();
      renderAllLayers();
    }
  };

  // Buka dialog untuk memotong kabel dari popup kabel
  window.gisPromptCutCable = function (lineId, type) {
    if (!isAdmin()) return;
    let targetArray = null;
    if (type === 'feeder') targetArray = S.data.feederLines;
    else if (type === 'distribusi') targetArray = S.data.distLines;
    else targetArray = S.data.dropLines;
    if (!targetArray) return;
    const line = targetArray.find(l => l.id === lineId);
    if (!line) return;

    if (S.map) S.map.closePopup();
    window.gisSetTool('cut-cable');
    Swal.fire({
      icon: 'info',
      title: '✂️ Mode Cut Kabel Aktif',
      html: `Silakan klik pada titik garis <b>${escapeHtml(line.name || 'Kabel')}</b> di peta tempat Anda ingin memotong kabel.`,
      timer: 3000,
      showConfirmButton: false
    });
  };

  // SNAP & SAMBUNG KABEL SAAT UJUNG DIGESER KE UJUNG LAIN
  let activeSnapBeacon = null;

  window.gisCheckEndpointSnap = function (pos, currentLineId, cableType) {
    const thresholdM = 18; // 18 meter
    let target = null;

    const allCables = [
      ...(S.data.dropLines || []).map(l => ({ ...l, type: 'dropcore' })),
      ...(S.data.distLines || []).map(l => ({ ...l, type: 'distribusi' })),
      ...(S.data.feederLines || []).map(l => ({ ...l, type: 'feeder' }))
    ];

    for (const c of allCables) {
      if (c.id === currentLineId || !Array.isArray(c.coords) || c.coords.length < 2) continue;
      const startPt = c.coords[0];
      const endPt = c.coords[c.coords.length - 1];

      const dStart = calcDistM(pos.lat, pos.lng, startPt[0], startPt[1]);
      if (dStart <= thresholdM) {
        target = { line: c, end: 'start', coord: startPt, dist: dStart };
        break;
      }
      const dEnd = calcDistM(pos.lat, pos.lng, endPt[0], endPt[1]);
      if (dEnd <= thresholdM) {
        target = { line: c, end: 'end', coord: endPt, dist: dEnd };
        break;
      }
    }

    if (target) {
      if (!activeSnapBeacon) {
        const icon = L.divIcon({
          className: 'gis-snap-icon',
          html: `
            <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; width:100%; height:100%; border-radius:50%; background:rgba(16,185,129,0.35); border:2.5px solid #10b981; animation:gisSnapPulse 0.6s infinite alternate;"></div>
              <div style="position:relative; z-index:10; font-size:16px;">⚡</div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        activeSnapBeacon = L.marker([target.coord[0], target.coord[1]], { icon, zIndexOffset: 3000 }).addTo(S.map);
        activeSnapBeacon.bindTooltip('⚡ Lepaskan untuk Sambung Kabel', { permanent: true, direction: 'top', offset: [0, -18] }).openTooltip();
      } else {
        activeSnapBeacon.setLatLng([target.coord[0], target.coord[1]]);
      }
    } else {
      if (activeSnapBeacon) {
        S.map.removeLayer(activeSnapBeacon);
        activeSnapBeacon = null;
      }
    }
  };

  window.gisHandleEndpointDrop = function (dropPos, whichEnd, line, cableType, currentCoords, editPolyline, updateHandles) {
    if (activeSnapBeacon) {
      S.map.removeLayer(activeSnapBeacon);
      activeSnapBeacon = null;
    }

    const thresholdM = 22; // 22 meter toleransi drop
    let target = null;

    const allCables = [
      ...(S.data.dropLines || []).map(l => ({ ...l, type: 'dropcore', listRef: S.data.dropLines })),
      ...(S.data.distLines || []).map(l => ({ ...l, type: 'distribusi', listRef: S.data.distLines })),
      ...(S.data.feederLines || []).map(l => ({ ...l, type: 'feeder', listRef: S.data.feederLines }))
    ];

    for (const c of allCables) {
      if (c.id === line.id || !Array.isArray(c.coords) || c.coords.length < 2) continue;
      const startPt = c.coords[0];
      const endPt = c.coords[c.coords.length - 1];

      const dStart = calcDistM(dropPos.lat, dropPos.lng, startPt[0], startPt[1]);
      if (dStart <= thresholdM) {
        target = { line: c, end: 'start', coord: startPt, dist: dStart, listRef: c.listRef };
        break;
      }
      const dEnd = calcDistM(dropPos.lat, dropPos.lng, endPt[0], endPt[1]);
      if (dEnd <= thresholdM) {
        target = { line: c, end: 'end', coord: endPt, dist: dEnd, listRef: c.listRef };
        break;
      }
    }

    if (!target) return;

    // Snap koordinat persis ke ujung kabel tujuan
    const targetIdx = whichEnd === 'start' ? 0 : currentCoords.length - 1;
    currentCoords[targetIdx] = [target.coord[0], target.coord[1]];
    if (editPolyline) editPolyline.setLatLngs(currentCoords);
    if (updateHandles) updateHandles();

    // POP UP SAMBUNG KABEL
    Swal.fire({
      title: '🔗 Sambung Kabel?',
      html: `
        <div style="font-family:'Segoe UI',Inter,sans-serif; font-size:13px; color:#1e293b; text-align:center;">
          <div style="background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:12px; padding:12px; margin-bottom:12px;">
            <div style="font-size:11px; font-weight:800; color:#16a34a; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">⚡ Deteksi Ujung Kabel Berdekatan</div>
            <div style="font-weight:700; color:#0f172a; font-size:14px; margin-bottom:2px;">
              ${escapeHtml(line.name || 'Kabel Saat Ini')}
            </div>
            <div style="color:#16a34a; font-size:16px; margin:2px 0;">⬇️ 🔗 ⬇️</div>
            <div style="font-weight:700; color:#0f172a; font-size:14px;">
              ${escapeHtml(target.line.name || 'Kabel Tujuan')}
            </div>
          </div>
          Apakah Anda ingin <b>menyambungkan</b> kedua kabel ini menjadi satu kesatuan jalur?
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '⚡ Ya, Sambung Kabel!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      reverseButtons: true
    }).then((res) => {
      if (res.isConfirmed) {
        // JALANKAN ANIMASI PENYAMBUNGAN KABEL (ELECTRIC WELDING FLASH & SPARK)
        window.gisPlayCableMergeAnimation(target.coord, () => {
          window.gisExecuteMergeTwoCables(line, whichEnd, target.line, target.end, currentCoords, cableType);
        });
      }
    });
  };

  // ANIMASI PENYAMBUNGAN KABEL
  window.gisPlayCableMergeAnimation = function (junctionCoord, onComplete) {
    if (!S.map || !junctionCoord) {
      if (onComplete) onComplete();
      return;
    }

    const lat = junctionCoord[0] || junctionCoord.lat;
    const lng = junctionCoord[1] || junctionCoord.lng;

    const weldIcon = L.divIcon({
      className: 'gis-weld-anim-icon',
      html: `
        <div class="gis-weld-wrapper">
          <div class="gis-weld-shockwave"></div>
          <div class="gis-weld-shockwave-2"></div>
          <div class="gis-weld-core">⚡</div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 30]
    });

    const animMarker = L.marker([lat, lng], { icon: weldIcon, zIndexOffset: 9999 }).addTo(S.map);

    const neonFlash = L.circle([lat, lng], {
      radius: 15,
      color: '#34d399',
      fillColor: '#10b981',
      fillOpacity: 0.65,
      weight: 3
    }).addTo(S.map);

    setTimeout(() => {
      if (S.map) {
        S.map.removeLayer(animMarker);
        S.map.removeLayer(neonFlash);
      }
      if (typeof onComplete === 'function') onComplete();
    }, 1100);
  };

  // PROSES PENGGABUNGAN KEDUA KABEL MENJADI SATU JALUR UTUH
  window.gisExecuteMergeTwoCables = function (lineA, whichEndA, lineB, whichEndB, currentCoordsA, cableType) {
    let coordsA = currentCoordsA.map(pt => [pt[0], pt[1]]);
    let coordsB = (lineB.coords || []).map(pt => [pt[0], pt[1]]);

    // Pastikan orientasi: sambungkan ujung A ke awal B
    if (whichEndA === 'start') {
      coordsA.reverse();
    }
    if (whichEndB === 'end') {
      coordsB.reverse();
    }

    // Gabungkan coordsA + coordsB (buang titik awal B jika duplikat koordinat pertemuan)
    const merged = [...coordsA];
    const junctionLat = coordsA[coordsA.length - 1][0];
    const junctionLng = coordsA[coordsA.length - 1][1];
    const startIdxB = (coordsB.length > 0 && Math.hypot(coordsB[0][0] - junctionLat, coordsB[0][1] - junctionLng) < 0.0001) ? 1 : 0;
    for (let k = startIdxB; k < coordsB.length; k++) {
      merged.push(coordsB[k]);
    }

    // Update lineA dengan koordinat gabungan
    lineA.coords = merged;

    // Hapus lineB dari array miliknya
    const findAndRemove = (list) => {
      if (!Array.isArray(list)) return;
      const idx = list.findIndex(l => l.id === lineB.id);
      if (idx !== -1) list.splice(idx, 1);
    };
    findAndRemove(S.data.feederLines);
    findAndRemove(S.data.distLines);
    findAndRemove(S.data.dropLines);

    // Hapus titik cut terkait jika ada di cutPoints
    if (Array.isArray(S.data.cutPoints)) {
      S.data.cutPoints = S.data.cutPoints.filter(cp =>
        !(cp.lineAId === lineA.id && cp.lineBId === lineB.id) &&
        !(cp.lineAId === lineB.id && cp.lineBId === lineA.id) &&
        Math.hypot(cp.lat - junctionLat, cp.lng - junctionLng) > 0.0002
      );
    }

    // Akhiri session edit
    if (typeof window.gisCancelCableEdit === 'function') {
      window.gisCancelCableEdit();
    }

    saveLocalData();
    renderAllLayers();

    Swal.fire({
      icon: 'success',
      title: '⚡ Kabel Berhasil Tersambung!',
      html: `
        <div style="font-size:13px; color:#1e293b; text-align:center;">
          Kedua kabel telah disatukan secara sempurna menjadi 1 jalur utuh.<br>
          <span style="display:inline-block; margin-top:6px; color:#10b981; font-weight:800;">
            Total Panjang: ${Math.round(merged.reduce((acc, cur, i, arr) => i > 0 ? acc + calcDistM(arr[i - 1][0], arr[i - 1][1], cur[0], cur[1]) : 0, 0))} meter
          </span>
        </div>
      `,
      timer: 3000,
      showConfirmButton: false
    });
  };

  window.gisCancelCableEdit = function () {
    if (activeSnapBeacon) {
      if (S.map) S.map.removeLayer(activeSnapBeacon);
      activeSnapBeacon = null;
    }
    if (!S.cableEditSession) return;
    const { editPolyline, handleMarkers } = S.cableEditSession;

    // Batalkan tanpa menyimpan
    if (editPolyline) S.map.removeLayer(editPolyline);
    if (handleMarkers) handleMarkers.forEach(m => S.map.removeLayer(m));
    removeCableEditorDock();
    S.cableEditSession = null;

    renderAllLayers();
  };

  // 6. EDIT METADATA KABEL (NAMA & TIPE)
  window.gisEditCableMeta = function (lineId, cableType) {
    if (!isAdmin()) return;

    let targetArray = null;
    if (cableType === 'feeder') targetArray = S.data.feederLines;
    else if (cableType === 'distribusi') targetArray = S.data.distLines;
    else targetArray = S.data.dropLines;

    const line = targetArray.find(l => l.id === lineId);
    if (!line) return;

    Swal.fire({
      title: '',
      html: `
        <div style="text-align:left; font-family:'Segoe UI',Inter,sans-serif;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;">
            <span style="font-size:20px;">🏷️</span>
            <div>
              <div style="font-size:15px; font-weight:800; color:#0f172a;">Edit Informasi Kabel</div>
              <div style="font-size:11px; color:#64748b;">Ubah nama label atau jenis kabel</div>
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Nama Jalur Kabel:</label>
            <input type="text" id="swalEditCableName" value="${escapeHtml(line.name)}" style="width:100%; padding:8px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:600; outline:none; box-sizing:border-box;">
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Kategori Jalur:</label>
            <select id="swalEditCableType" style="width:100%; padding:8px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:600; outline:none; box-sizing:border-box;">
              <option value="feeder" ${cableType === 'feeder' ? 'selected' : ''}>🔵 Feeder (Biru)</option>
              <option value="distribusi" ${cableType === 'distribusi' ? 'selected' : ''}>🔴 Distribusi (Merah)</option>
              <option value="dropcore" ${cableType === 'dropcore' ? 'selected' : ''}>🟡 Drop Core (Kuning)</option>
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
        return {
          name: document.getElementById('swalEditCableName').value.trim() || line.name,
          type: document.getElementById('swalEditCableType').value
        };
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        line.name = res.value.name;
        const newType = res.value.type;
        if (newType !== cableType) {
          if (cableType === 'feeder') S.data.feederLines = S.data.feederLines.filter(l => l !== line);
          else if (cableType === 'distribusi') S.data.distLines = S.data.distLines.filter(l => l !== line);
          else S.data.dropLines = S.data.dropLines.filter(l => l !== line);

          if (newType === 'feeder') S.data.feederLines.push(line);
          else if (newType === 'distribusi') S.data.distLines.push(line);
          else S.data.dropLines.push(line);
        }
        saveLocalData();
        renderAllLayers();
      }
    });
  };

  // Alias gisEditCable langsung membuka mode geser titik/ujung kabel
  window.gisEditCable = window.gisStartEditCablePoints;

  // ============================================================================
  // TARIK DROPCORE INTERAKTIF: KLIK PIN PELANGGAN -> KLIK PIN ODP (OTOMATIS)
  // ============================================================================
  function showDropcoreConnectingBanner(msgHtml) {
    removeConnectingBanner();

    const banner = document.createElement('div');
    banner.id = 'gisConnectingBanner';
    banner.style.cssText = `
      position: fixed;
      top: 68px;
      left: 50%;
      transform: translateX(-50%);
      background: #1d4ed8;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 30px;
      z-index: 99999999;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12.5px;
      font-weight: 700;
      animation: gisPulseBanner 1.5s infinite alternate;
      border: 2px solid #93c5fd;
      max-width: 90vw;
      box-sizing: border-box;
    `;
    banner.innerHTML = `
      <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${msgHtml}</span>
      <button onclick="window.gisCancelConnectDropcore()" style="background:#ef4444; color:#ffffff; border:none; padding:4px 10px; border-radius:14px; font-size:11px; font-weight:800; cursor:pointer; flex-shrink:0;">Batal ✕</button>
    `;

    document.body.appendChild(banner);
  }

  function removeConnectingBanner() {
    const b = document.getElementById('gisConnectingBanner');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  window.gisCancelConnectDropcore = function () {
    S.pendingDropcoreCust = null;
    S.pendingDropcoreOdp = null;
    if (S.activeTool === 'draw-cable') {
      window.gisSetTool(null);
    }
    removeConnectingBanner();
  };

  window.gisStartConnectDropcore = function (identifier) {
    if (!isAdmin()) {
      Swal.fire('Akses Terbatas', 'Hanya Admin yang dapat menghubungkan dropcore!', 'warning');
      return;
    }
    const cust = S.data.pelanggans.find(p => p.id === identifier || p.nama === identifier);
    if (!cust) return;

    S.pendingDropcoreCust = cust;
    S.pendingDropcoreOdp = null;

    if (S.map) S.map.closePopup();

    showDropcoreConnectingBanner(`⚡ <b>${escapeHtml(cust.nama)}</b>: Silakan klik PIN ODP (▲) di peta!`);
  };

  window.gisStartConnectDropcoreFromOdp = function (odp) {
    if (!isAdmin() || !odp) return;
    S.pendingDropcoreOdp = odp;
    S.pendingDropcoreCust = null;

    if (S.map) S.map.closePopup();

    showDropcoreConnectingBanner(`📦 <b>ODP ${escapeHtml(odp.name)}</b>: Silakan klik PIN Pelanggan di peta!`);
  };

  window.gisCompleteDropcoreConnection = function (cust, odp) {
    if (!cust || !odp) return;

    const dist = Math.round(calcDistM(cust.lat, cust.lng, odp.lat, odp.lng));

    // Bersihkan jalur dropcore lama untuk pelanggan ini jika sebelumnya ada
    const oldLineIdx = S.data.dropLines.findIndex(l => {
      const matchName = l.name && l.name.toUpperCase().startsWith(cust.nama.toUpperCase());
      const matchCoord = l.coords && l.coords.length >= 2 &&
        Math.abs(l.coords[0][0] - cust.lat) < 0.0001 && Math.abs(l.coords[0][1] - cust.lng) < 0.0001;
      return matchName || matchCoord;
    });
    if (oldLineIdx !== -1) {
      S.data.dropLines.splice(oldLineIdx, 1);
    }

    // Buat jalur dropcore baru
    const newDropLine = {
      id: 'drop_' + Date.now(),
      name: `${cust.nama} -> ${odp.name}`,
      coords: [
        [cust.lat, cust.lng],
        [odp.lat, odp.lng]
      ]
    };

    S.data.dropLines.push(newDropLine);
    cust.hasDropcore = true;
    cust.odp = odp.name;
    cust.distToDropcore = dist;

    S.lastAddedCableId = newDropLine.id;
    S.lastAddedCableType = 'dropcore';

    S.pendingDropcoreCust = null;
    S.pendingDropcoreOdp = null;
    if (S.activeTool === 'draw-cable') {
      window.gisSetTool(null);
    }
    removeConnectingBanner();

    saveLocalData();
    renderAllLayers();

    Swal.fire({
      icon: 'success',
      title: '⚡ Dropcore Terhubung!',
      html: `
        <div style="font-size:13px; color:#1e293b; text-align:center;">
          <div style="font-size:15px; font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(cust.nama)} ➔ ${escapeHtml(odp.name)}</div>
          <div style="display:inline-block; background:#dcfce7; color:#15803d; font-weight:800; padding:4px 12px; border-radius:20px; font-size:12px; margin-top:4px;">
            Panjang Dropcore: ${dist} meter
          </div>
        </div>
      `,
      timer: 2400,
      showConfirmButton: false
    });
  };

  window.gisAutoConnectDropcore = window.gisStartConnectDropcore;

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
      title: 'Membaca ' + escapeHtml(file.name) + '...',
      text: 'Sedang mengekstrak struktur KML & parsing data...',
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
      const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));

      const parsed = {
        odcs: [],
        odps: [],
        pelanggans: [],
        feederLines: [],
        distLines: [],
        dropLines: []
      };

      placemarks.forEach((pm, i) => {
        const nameEl = pm.getElementsByTagName('name')[0];
        const name = nameEl ? nameEl.textContent.trim() : '';
        const styleEl = pm.getElementsByTagName('styleUrl')[0];
        const style = (styleEl ? styleEl.textContent.trim() : '').toLowerCase();

        // Cari folder induk jika ada
        let folderName = '';
        let parent = pm.parentElement;
        while (parent && parent.nodeName !== 'kml') {
          if (parent.nodeName === 'Folder') {
            const fNameEl = parent.getElementsByTagName('name')[0];
            if (fNameEl) {
              folderName = fNameEl.textContent.trim().toLowerCase();
              break;
            }
          }
          parent = parent.parentElement;
        }

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
              if (folderName.includes('odc') || style.includes('odc') || (u.includes('ODC') && !u.includes('ODP'))) {
                parsed.odcs.push({ id: 'odc_' + Date.now() + '_' + i, name, lat, lng, kec: 'IMPORT' });
              } else if (folderName.includes('odp') || style.includes('odp') || u.includes('ODP') || /^[A-Z]{2,4}[-/_][0-9]+/i.test(u)) {
                parsed.odps.push({ id: 'odp_' + Date.now() + '_' + i, name, lat, lng, kec: 'IMPORT' });
              } else {
                parsed.pelanggans.push({
                  id: 'plg_' + Date.now() + '_' + i,
                  nama: name || ('Pelanggan ' + (i + 1)),
                  lat,
                  lng,
                  odp: '-',
                  kec: 'IMPORT',
                  alamat: '-',
                  hasDropcore: false
                });
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
              if (folderName.includes('feeder') || style.includes('feeder') || name.toUpperCase().includes('FEEDER')) {
                parsed.feederLines.push(lineObj);
              } else if (folderName.includes('distribusi') || style.includes('distribusi') || name.toUpperCase().includes('DISTRIBUSI')) {
                parsed.distLines.push(lineObj);
              } else {
                parsed.dropLines.push(lineObj);
              }
            }
          }
        }
      });

      const totalItems = parsed.odcs.length + parsed.odps.length + parsed.pelanggans.length +
        parsed.feederLines.length + parsed.distLines.length + parsed.dropLines.length;

      if (totalItems === 0) {
        Swal.fire('Data Kosong', 'Tidak ditemukan data titik atau jalur kabel yang valid dalam file KML.', 'warning');
        return;
      }

      Swal.fire({
        title: '📁 Konfirmasi Import KML / KMZ',
        html: `
          <div style="text-align:left; font-size:13px; color:#1e293b; background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:12px;">
            <div style="font-weight:800; color:#0f172a; margin-bottom:4px;">File: ${escapeHtml(file.name)}</div>
            <div style="color:#64748b; font-size:11.5px; margin-bottom:8px;">Ditemukan total <b>${totalItems}</b> entitas:</div>
            <ul style="margin:0 0 0 16px; padding:0; line-height:1.6; font-size:12px;">
              <li>🏢 ODC: <b>${parsed.odcs.length}</b></li>
              <li>📦 ODP: <b>${parsed.odps.length}</b></li>
              <li>👤 Pelanggan: <b>${parsed.pelanggans.length}</b></li>
              <li>🔵 Jalur Feeder: <b>${parsed.feederLines.length}</b></li>
              <li>🔴 Jalur Distribusi: <b>${parsed.distLines.length}</b></li>
              <li>🟡 Jalur Drop Core: <b>${parsed.dropLines.length}</b></li>
            </ul>
          </div>
          <div style="font-size:12.5px; color:#334155;">Pilih metode memasukkan data ke peta:</div>
        `,
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '⚡ Gabungkan (Merge)',
        denyButtonText: '🔄 Ganti Semua (Replace)',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#ea580c',
        cancelButtonColor: '#64748b'
      }).then((choice) => {
        if (choice.isConfirmed) {
          // GABUNGKAN (MERGE)
          S.data.odcs = [...(S.data.odcs || []), ...parsed.odcs];
          S.data.odps = [...(S.data.odps || []), ...parsed.odps];
          S.data.pelanggans = window.deduplicatePelanggans
            ? window.deduplicatePelanggans([...(S.data.pelanggans || []), ...parsed.pelanggans])
            : [...(S.data.pelanggans || []), ...parsed.pelanggans];
          S.data.feederLines = [...(S.data.feederLines || []), ...parsed.feederLines];
          S.data.distLines = [...(S.data.distLines || []), ...parsed.distLines];
          S.data.dropLines = [...(S.data.dropLines || []), ...parsed.dropLines];

          saveLocalData();
          renderAllLayers();

          Swal.fire({
            icon: 'success',
            title: '⚡ Data Berhasil Digabungkan!',
            text: `Berhasil menambahkan ${totalItems} data dari file KML ke peta jaringan.`,
            timer: 2500,
            showConfirmButton: false
          });
        } else if (choice.isDenied) {
          // GANTIKAN SEMUA (REPLACE)
          S.data.odcs = parsed.odcs;
          S.data.odps = parsed.odps;
          S.data.pelanggans = parsed.pelanggans;
          S.data.feederLines = parsed.feederLines;
          S.data.distLines = parsed.distLines;
          S.data.dropLines = parsed.dropLines;
          S.data.cutPoints = [];

          saveLocalData();
          renderAllLayers();

          Swal.fire({
            icon: 'success',
            title: '🔄 Data Peta Telah Diganti!',
            text: `Seluruh data jaringan kini telah diperbarui dari file KML.`,
            timer: 2500,
            showConfirmButton: false
          });
        }
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
    <Style id="style-cutpoint"><IconStyle><color>ff0000ff</color><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/cross-hairs.png</href></Icon></IconStyle></Style>

    <Folder>
      <name>Jalur Feeder (${(S.data.feederLines || []).length})</name>
      ${(S.data.feederLines || []).map(l => `<Placemark><name>${escapeHtml(l.name)}</name><styleUrl>#style-feeder</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.coords.map(pt => `${pt[1]},${pt[0]},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}
    </Folder>
    <Folder>
      <name>Jalur Distribusi (${(S.data.distLines || []).length})</name>
      ${(S.data.distLines || []).map(l => `<Placemark><name>${escapeHtml(l.name)}</name><styleUrl>#style-distribusi</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.coords.map(pt => `${pt[1]},${pt[0]},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}
    </Folder>
    <Folder>
      <name>Jalur Drop Core (${(S.data.dropLines || []).length})</name>
      ${(S.data.dropLines || []).map(l => `<Placemark><name>${escapeHtml(l.name)}</name><styleUrl>#style-dropcore</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.coords.map(pt => `${pt[1]},${pt[0]},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}
    </Folder>
    <Folder>
      <name>Titik ODC (${(S.data.odcs || []).length})</name>
      ${(S.data.odcs || []).map(o => `<Placemark><name>${escapeHtml(o.name)}</name><styleUrl>#style-odc</styleUrl><Point><coordinates>${o.lng},${o.lat},0</coordinates></Point></Placemark>`).join('')}
    </Folder>
    <Folder>
      <name>Titik ODP (${(S.data.odps || []).length})</name>
      ${(S.data.odps || []).map(o => `<Placemark><name>${escapeHtml(o.name)}</name><styleUrl>#style-odp</styleUrl><Point><coordinates>${o.lng},${o.lat},0</coordinates></Point></Placemark>`).join('')}
    </Folder>
    <Folder>
      <name>Titik Pelanggan (${(S.data.pelanggans || []).length})</name>
      ${(S.data.pelanggans || []).map(c => {
        const isDead = !!c.isModemDead;
        const isOnline = !!(c.modemData && c.modemData.is_active);
        const statusStr = isDead ? '🔴 MODEM MATI' : (isOnline ? '🟢 ONLINE' : '⚪ OFFLINE');
        return `<Placemark><name>${escapeHtml(c.nama)}</name><styleUrl>#style-pelanggan</styleUrl><description><![CDATA[ID: ${escapeHtml(c.id || '-')}<br>ODP: ${escapeHtml(c.odp || '-')}<br>Status: ${statusStr}<br>IP: ${escapeHtml(c.modemData?.ip_address || '-')}<br>Redaman: ${escapeHtml(c.modemData?.optical?.rx_power || '-')}]]></description><Point><coordinates>${c.lng},${c.lat},0</coordinates></Point></Placemark>`;
      }).join('')}
    </Folder>
    ${(S.data.cutPoints && S.data.cutPoints.length > 0) ? `
    <Folder>
      <name>Titik Ujung Kabel / Cut (${S.data.cutPoints.length})</name>
      ${S.data.cutPoints.map(cp => `<Placemark><name>✂️ Ujung Kabel: ${escapeHtml(cp.originalName || 'Kabel')}</name><styleUrl>#style-cutpoint</styleUrl><Point><coordinates>${cp.lng},${cp.lat},0</coordinates></Point></Placemark>`).join('')}
    </Folder>
    ` : ''}
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

        S.map.flyTo([lat, lng], 18);
        setTimeout(() => {
          window.gisRenderPelangganMarkers();
        }, 400);
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
