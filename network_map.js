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
      dropLines: []
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

      /* Pin Pelanggan Mati / Padam (Sesuai Cek Modem) */
      .marker-cust-dead {
        width: 26px;
        height: 26px;
        background-image: url('http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png');
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
        filter: drop-shadow(0 0 6px #ef4444);
        animation: gisPulseDead 1.4s infinite;
      }
      .marker-cust-dead::after {
        content: 'MATI';
        position: absolute;
        top: -6px;
        right: -10px;
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
      @keyframes gisPulseDead {
        0% { transform: scale(1); filter: drop-shadow(0 0 4px #ef4444); }
        50% { transform: scale(1.15); filter: drop-shadow(0 0 10px #dc2626); }
        100% { transform: scale(1); filter: drop-shadow(0 0 4px #ef4444); }
      }
      .marker-cust-online {
        width: 24px;
        height: 24px;
        background-image: url('http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png');
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
      }
      .marker-cust-online::after {
        content: '';
        position: absolute;
        top: -2px;
        right: -2px;
        width: 10px;
        height: 10px;
        background: #16a34a;
        border: 1.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(22, 163, 74, 0.9);
      }
      .marker-cust-online-nodrop {
        width: 26px;
        height: 26px;
        background-image: url('http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png');
        background-size: contain;
        background-repeat: no-repeat;
        cursor: pointer;
        position: relative;
      }
      .marker-cust-online-nodrop::after {
        content: '!';
        position: absolute;
        top: -4px;
        right: -4px;
        width: 13px;
        height: 13px;
        background: #f59e0b;
        color: white;
        border-radius: 50%;
        font-size: 9px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid white;
      }
      .earth-label-dead {
        background: #dc2626 !important;
        color: #ffffff !important;
        border: 1.5px solid #ffffff !important;
        font-weight: 800 !important;
        box-shadow: 0 2px 8px rgba(220,38,38,0.5) !important;
      }
      .earth-label-online {
        border-left: 3px solid #16a34a !important;
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
        background: rgba(15, 23, 42, 0.8) !important;
        border: 1px solid rgba(255, 255, 255, 0.45) !important;
        border-radius: 4px !important;
        box-shadow: 0 2px 5px rgba(0,0,0,0.45) !important;
        color: #ffffff !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        font-weight: 800 !important;
        font-size: 10.5px !important;
        padding: 1px 6px !important;
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

    // Buat Peta Leaflet Berpusat di Lumajang dengan Optimasi Zooming & 100% SVG Vector Presisi
    S.map = L.map('gisMapContainer', {
      center: [-8.133, 113.224],
      zoom: 14,
      zoomControl: false,
      maxZoom: 21,
      preferCanvas: false, // SVG Renderer Murni: 100% presisi akurat di HP/Tablet/Desktop, 0 drift, kabel tidak akan lari dari pin
      zoomAnimation: true,
      fadeAnimation: true,
      wheelPxPerZoomLevel: 120
    });

    // Kontrol Zoom di Kanan Bawah
    L.control.zoom({ position: 'bottomright' }).addTo(S.map);

    // BASEMAP SATELIT GOOGLE HYBRID (MULTI-SUBDOMAIN MT0-MT3 & AUTO-SCALED ZOOM)
    const googleHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution: 'Satelit &copy; Google Maps'
    });

    const googleSat = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution: 'Satelit Murni &copy; Google'
    });

    const googleStreets = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps'
    });

    const esriWorld = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 22,
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
    S.layers.lainnya = L.layerGroup(); // Hidden by default

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

    // Debounced listener untuk Smooth Zooming & Panning di HP (60 FPS tanpa lag)
    let renderTimer = null;
    function schedulePelangganRender() {
      if (renderTimer) cancelAnimationFrame(renderTimer);
      renderTimer = requestAnimationFrame(() => {
        window.gisRenderPelangganMarkers();
      });
    }

    let lastZoomDetailed = S.map.getZoom() >= 16;
    S.map.on('zoomend', () => {
      const isDetailed = S.map.getZoom() >= 16;
      if (isDetailed !== lastZoomDetailed) {
        lastZoomDetailed = isDetailed;
        schedulePelangganRender();
      } else {
        schedulePelangganRender();
      }
    });

    S.map.on('moveend', () => {
      schedulePelangganRender();
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
      try { localStorage.removeItem('mahawira_map_network_data'); } catch (_) { }

      let json = null;

      // 1. Prioritas Cloud Supabase: Ambil data termutakhir yang diedit dari HP atau Laptop
      if (window.sb) {
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
              console.log('☁️ [MAP GIS] Berhasil memuat data jaringan TERBARU dari Supabase Cloud');
            }
          }

          const { data: tsRow } = await window.sb
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'map_network_last_update')
            .maybeSingle();
          if (tsRow && tsRow.setting_value) {
            lastKnownMapUpdateTs = String(tsRow.setting_value);
          }
        } catch (supaErr) {
          console.warn('[MAP GIS] Gagal load dari Supabase Cloud, fallback ke server lokal:', supaErr.message);
        }
      }

      // 2. Fallback ke file lokal jika Supabase offline
      if (!json) {
        const res = await fetch('data/map_network.json?v=' + Date.now());
        if (res.ok) {
          json = await res.json();
          console.log('📁 [MAP GIS] Memuat data jaringan dari file lokal disk');
        }
      }

      if (json) {
        S.data = {
          odcs: json.odcs || [],
          odps: json.odps || [],
          pelanggans: json.pelanggans || [],
          closures: json.closures || [],
          lainnya: json.lainnya || [],
          feederLines: json.feederLines || [],
          distLines: json.distLines || [],
          dropLines: json.dropLines || []
        };

        // Cross-reference dengan window.allPelangganData jika sudah dimuat dari Supabase di script.js
        if (window.allPelangganData && Array.isArray(window.allPelangganData)) {
          window.allPelangganData.forEach(sp => {
            if (sp.nama) {
              const cust = S.data.pelanggans.find(p => p.nama && p.nama.trim().toUpperCase() === sp.nama.trim().toUpperCase());
              if (cust) {
                if (sp.id_pelanggan && sp.id_pelanggan !== '-' && (!cust.id || cust.id === '-' || cust.id.startsWith('plg_'))) {
                  cust.id = sp.id_pelanggan.trim();
                }
                if (sp.odp && sp.odp !== '-') cust.odp = sp.odp;
                if (sp.alamat && sp.alamat !== '-') cust.alamat = sp.alamat;
              } else if (sp.taging_lokasi && sp.taging_lokasi !== '-') {
                const coord = parseCoordinates(sp.taging_lokasi);
                if (coord) {
                  S.data.pelanggans.push({
                    id: sp.id_pelanggan || ('plg_' + (sp.id || Date.now())),
                    nama: sp.nama.trim().toUpperCase(),
                    lat: coord.lat,
                    lng: coord.lng,
                    odp: sp.odp || '-',
                    kec: sp.alamat || 'KECAMATAN SUKODONO',
                    alamat: sp.alamat || '-',
                    hasDropcore: false
                  });
                }
              }
            }
          });
        }

        renderAllLayers();
        syncModemStatusWithMap();
        setInterval(syncModemStatusWithMap, 60000);

        // Aktifkan Real-Time Cross-Device Polling setiap 10 detik agar edit di HP langsung tampil di Laptop
        if (!window.__gisCrossDevicePollTimer) {
          window.__gisCrossDevicePollTimer = setInterval(checkCrossDeviceMapSync, 10000);
        }
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

            // Jika laptop sedang membuka peta di localhost, otomatis simpan juga ke file disk backend
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocal && window.location.protocol === 'http:') {
              fetch('http://127.0.0.1:7878/api/map/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: typeof supaRow.setting_value === 'string' ? supaRow.setting_value : JSON.stringify(supaRow.setting_value)
              }).catch(() => {});
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
        c.modemData = null;
        c.isModemDead = false;
      }
    });

    console.log(`[MAP GIS] Status Modem Sinkron: ${liveCount} Online, ${deadCount} Mati/Offline. (${claimedClients.size} modem terikat 1-ke-1)`);
    renderAllLayers();
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
          dropLines: S.data.dropLines || []
        };
        const jsonStr = JSON.stringify(payload);
        const nowIso = new Date().toISOString();
        const nowTs = String(Date.now());
        lastKnownMapUpdateTs = nowTs;

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
          }).catch(() => {});
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
      autoPan: true,
      autoPanPaddingTopLeft: L.point((window.innerWidth <= 768) ? 10 : 20, (window.innerWidth <= 768) ? 50 : 115),
      autoPanPaddingBottomRight: L.point((window.innerWidth <= 768) ? 10 : 20, (window.innerWidth <= 768) ? 40 : 90),
      closeButton: true,
      autoClose: false,
      closeOnClick: true,
      offset: L.point(0, -10),
      maxWidth: 320
    };

    // 1. RENDER JALUR FEEDER: WARNA BIRU (#2563eb)
    S.data.feederLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      const poly = L.polyline(l.coords, {
        color: '#2563eb', // BIRU
        weight: (window.innerWidth <= 768) ? 5.0 : 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.feeder);

      poly.bindTooltip(`🔵 Feeder: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(() => buildCablePopupHtml(l, 'feeder', '#2563eb'), GIS_POPUP_OPTIONS);
    });

    // 2. RENDER JALUR DISTRIBUSI: WARNA MERAH (#dc2626)
    S.data.distLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      const poly = L.polyline(l.coords, {
        color: '#dc2626', // MERAH
        weight: (window.innerWidth <= 768) ? 4.5 : 4.0,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.distribusi);

      poly.bindTooltip(`🔴 Distribusi: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(() => buildCablePopupHtml(l, 'distribusi', '#dc2626'), GIS_POPUP_OPTIONS);
    });

    // 3. RENDER JALUR DROP CORE ASLI: WARNA KUNING TERANG (#facc15)
    // HANYA KABEL ASLI DARI FILE, TANPA AUTO CONNECT
    S.data.dropLines.forEach(l => {
      if (!l.coords || l.coords.length < 2) return;
      const poly = L.polyline(l.coords, {
        color: '#facc15', // KUNING TERANG ASLI FILE
        weight: (window.innerWidth <= 768) ? 5.0 : 4.0,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(S.layers.dropcore);

      poly.bindTooltip(`🟡 Drop Core: ${escapeHtml(l.name)}`, { sticky: false });
      poly.bindPopup(() => buildCablePopupHtml(l, 'dropcore', '#ca8a04'), GIS_POPUP_OPTIONS);
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
          permanent: S.map.getZoom() >= 15,
          direction: 'top',
          className: 'earth-label',
          offset: [0, -20]
        })
        .bindPopup(() => buildOdcPopupHtml(odc), GIS_POPUP_OPTIONS)
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

      const marker = L.marker([odp.lat, odp.lng], { icon })
        .bindTooltip(escapeHtml(odp.name), {
          permanent: S.map.getZoom() >= 15,
          direction: 'top',
          className: 'earth-label',
          offset: [0, -18]
        })
        .bindPopup(() => buildOdpPopupHtml(odp), GIS_POPUP_OPTIONS);

      marker.on('click', function (e) {
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
      });

      marker.addTo(S.layers.odp);
    });

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
    // Di zoom < 16: gunakan 100% Canvas Circle Marker (0 DOM Node, super ringan zoom in/out di HP)
    // Di zoom >= 16 (close-up jalan): tampilkan Pushpin + Nama Pelanggan Tetap Muncul di Peta
    const isDetailed = currentZoom >= 16;
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

    // Ambil batas viewport peta untuk virtualisasi jika zoom tinggi agar HP tidak terbebani (buffer luas 60%)
    const bounds = S.map.getBounds().pad(0.6);

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

      // VIEWPORT CULLING: Hanya render titik pelanggan di dalam layar (Super Smooth di HP)
      if (!bounds.contains([c.lat, c.lng])) return;

      if (isDetailed) {
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
          iconSize: [26, 26],
          iconAnchor: [6, 24]
        });

        const labelText = isDead
          ? `🔴 ${escapeHtml(c.nama)} (MODEM MATI)`
          : (isOnline ? `🟢 ${escapeHtml(c.nama)}` : escapeHtml(c.nama));
        const labelClass = isDead
          ? 'earth-label earth-label-dead'
          : (isOnline ? 'earth-label earth-label-online' : 'earth-label');

        // LAZY POPUP: Popup HTML HANYA dibuat saat di-klik, bukan saat zooming!
        const marker = L.marker([c.lat, c.lng], { icon })
          .bindTooltip(labelText, {
            permanent: true,
            direction: 'top',
            className: labelClass,
            offset: [6, -22]
          })
          .bindPopup(() => buildCustomerPopupHtml(c), GIS_POPUP_OPTIONS);

        marker.on('click', function (e) {
          if (S.pendingDropcoreOdp) {
            L.DomEvent.stop(e);
            marker.closePopup();
            window.gisCompleteDropcoreConnection(c, S.pendingDropcoreOdp);
            return;
          }
          if (S.activeTool === 'draw-cable' && !S.pendingDropcoreCust && !S.pendingDropcoreOdp) {
            L.DomEvent.stop(e);
            marker.closePopup();
            window.gisStartConnectDropcore(c.id || c.nama);
            return;
          }
        });

        if (isDead && S.layers.pelangganMati) {
          marker.addTo(S.layers.pelangganMati);
        } else if (hasLine) {
          marker.addTo(S.layers.pelangganConnected);
        } else {
          marker.addTo(S.layers.pelangganUnconnected);
        }
      } else {
        // Low/Mid Zoom (<16): Circle Marker (Ringan Zooming di Canvas)
        const radius = isDead ? 6.5 : (isOnline ? (hasLine ? 4.5 : 5.5) : (hasLine ? 4 : 5.5));
        const color = isDead ? '#991b1b' : (isOnline ? '#15803d' : (hasLine ? '#ca8a04' : '#b91c1c'));
        const fillColor = isDead ? '#ef4444' : (isOnline ? '#22c55e' : (hasLine ? '#facc15' : '#ef4444'));
        const weight = isDead ? 2.5 : (isOnline ? 1.5 : (hasLine ? 1 : 1.5));

        const tooltipText = isDead
          ? `🔴 ${escapeHtml(c.nama)} (MODEM MATI)`
          : (isOnline ? `🟢 ${escapeHtml(c.nama)}` : escapeHtml(c.nama));
        const tooltipClass = isDead
          ? 'earth-label earth-label-dead'
          : (isOnline ? 'earth-label earth-label-online' : 'earth-label');

        // LAZY POPUP: Popup HTML HANYA dibuat saat di-klik!
        const marker = L.circleMarker([c.lat, c.lng], {
          radius: radius,
          color: color,
          fillColor: fillColor,
          fillOpacity: isDead ? 1 : 0.95,
          weight: weight
        }).bindTooltip(tooltipText, {
          permanent: false,
          direction: 'top',
          className: tooltipClass
        }).bindPopup(() => buildCustomerPopupHtml(c), GIS_POPUP_OPTIONS);

        marker.on('click', function (e) {
          if (S.pendingDropcoreOdp) {
            L.DomEvent.stop(e);
            marker.closePopup();
            window.gisCompleteDropcoreConnection(c, S.pendingDropcoreOdp);
            return;
          }
          if (S.activeTool === 'draw-cable' && !S.pendingDropcoreCust && !S.pendingDropcoreOdp) {
            L.DomEvent.stop(e);
            marker.closePopup();
            window.gisStartConnectDropcore(c.id || c.nama);
            return;
          }
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

    // 7. RENDER INFRASTRUKTUR LAINNYA (TIANG, T1M, SLACK, COLE, CLOSURE) - HIDDEN BY DEFAULT
    if (S.data.lainnya && S.layers.lainnya) {
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
            <div style="display:flex; gap:6px; width:100%;">
              <button onclick="window.gisEditCable('${escapeHtml(line.id)}', '${type}')"
                style="flex:1; padding:7px 10px; background:#eff6ff; color:#1d4ed8; border:1.5px solid #93c5fd; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                <i class="fas fa-edit"></i> Edit Kabel
              </button>
              <button onclick="window.gisDeleteCable('${escapeHtml(line.id)}', '${type}')"
                style="padding:7px 12px; background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"
                title="Hapus Jalur Kabel">
                <i class="fas fa-trash-alt"></i> Hapus
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

    const hasModemData = !!(c.modemData && (c.modemData.is_active || c.modemData.ip_address || c.modemData.last_logged_out || c.modemData.mac_address || c.modemData.brand || c.modemData.router_name));
    let mBrand = '-';
    let mModel = 'Belum Terdaftar di MikroTik';
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
        } else if (rawMac && rawMac.length === 12 && /^[0-9A-F]{12}$/.test(rawMac)) {
          mSerial = 'HWTC' + rawMac.slice(-8);
        } else {
          mSerial = '-';
        }
      } else if (rawBrand.toLowerCase().includes('fiberhome')) {
        mBrand = 'Fiberhome';
        mModel = rawModel || 'AN5506';
        if (rawSerial && rawSerial !== '-' && rawSerial.toUpperCase().startsWith('FHTT')) {
          mSerial = rawSerial;
        } else if (rawMac && rawMac.length === 12 && /^[0-9A-F]{12}$/.test(rawMac)) {
          mSerial = 'FHTT' + rawMac.slice(-8);
        } else {
          mSerial = '-';
        }
      } else {
        // ONT GPON ZTE
        mBrand = 'ZTE';
        mModel = (rawModel && rawModel !== '-' && rawModel !== 'Perangkat Pelanggan' && rawModel !== 'GPON ONT') ? rawModel : 'F670L';
        if (rawSerial && rawSerial !== '-' && rawSerial !== mData.pppoe_user && !rawSerial.includes('Belum')) {
          mSerial = rawSerial;
        } else if (rawMac && rawMac.length === 12 && /^[0-9A-F]{12}$/.test(rawMac)) {
          mSerial = 'ZTEG' + rawMac.slice(-8);
        } else {
          mSerial = '-';
        }
      }
    }

    return `
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:290px; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- Modern Vibrant Header -->
        <div style="background:linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-bottom:1.5px solid #e2e8f0; padding:12px 14px 10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="display:inline-flex; align-items:center; gap:5px; background:#dbeafe; color:#1d4ed8; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; box-shadow:0 1px 2px rgba(29,78,216,0.1);">
              <i class="fas fa-user-check" style="font-size:9.5px;"></i> PELANGGAN FTTH
            </span>
            <span style="background:rgba(255,255,255,0.7); color:#475569; font-size:9.5px; font-weight:700; padding:2px 7px; border-radius:12px; border:1px solid #e2e8f0;">
              NOC MAHAWIRA
            </span>
          </div>
          
          <div style="font-size:15px; font-weight:900; color:#0f172a; line-height:1.25; text-transform:uppercase; letter-spacing:-0.2px; word-break:break-word;">
            ${escapeHtml(c.nama)}
          </div>

          <div style="margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:10px; color:#64748b; font-weight:700;">ID PELANGGAN:</span>
            ${realId ? `
              <span ${admin ? `onclick="window.gisEditPelanggan('${escapeJsAttr(c.id || c.nama)}')"` : ''} style="display:inline-flex; align-items:center; gap:5px; background:#ffffff; color:#1d4ed8; font-family:'Consolas','Courier New',monospace; font-size:11.5px; font-weight:800; padding:2px 8px; border-radius:6px; border:1.5px solid #93c5fd; box-shadow:0 1px 3px rgba(37,99,235,0.12); ${admin ? 'cursor:pointer;' : ''}" title="${admin ? 'Klik untuk Edit ID Pelanggan' : ''}">
                ${escapeHtml(realId)} ${admin ? '<i class="fas fa-pencil-alt" style="font-size:9.5px; color:#2563eb; margin-left:3px;"></i>' : ''}
              </span>
            ` : `
              <span ${admin ? `onclick="window.gisEditPelanggan('${escapeJsAttr(c.id || c.nama)}')"` : ''} style="background:#f1f5f9; color:#94a3b8; font-size:11px; font-style:italic; padding:2px 6px; border-radius:4px; ${admin ? 'cursor:pointer;' : ''}" title="${admin ? 'Klik untuk Daftarkan ID Pelanggan' : ''}">
                Belum terdaftar ${admin ? '<i class="fas fa-plus-circle" style="font-size:9.5px; color:#3b82f6; margin-left:3px;"></i>' : ''}
              </span>
            `}
          </div>
        </div>

        <!-- NOTIFIKASI STATUS KONEKSI MODEM (CEK MODEM MIKROTIK) -->
        ${c.isModemDead ? `
          <div style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-bottom:1.5px solid #fca5a5; border-left:4px solid #dc2626; padding:10px 14px; display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px; line-height:1; animation:gisPulseDead 1.2s infinite; flex-shrink:0;">🔴</span>
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:900; color:#991b1b; text-transform:uppercase; letter-spacing:0.3px;">KONEKSI MODEM: MATI (OFFLINE)</div>
              <div style="font-size:11px; color:#7f1d1d; font-weight:700; margin-top:3px;">
                Terakhir Logout: <b>${escapeHtml(c.modemData?.last_logged_out || c.modemData?.last_reason_raw || '-')}</b>.
              </div>
            </div>
          </div>
        ` : (c.modemData && c.modemData.is_active ? `
          <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-bottom:1.5px solid #86efac; border-left:4px solid #16a34a; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div style="display:flex; align-items:center; gap:9px; min-width:0; flex:1;">
              <span style="font-size:20px; line-height:1; flex-shrink:0;">🟢</span>
              <div style="min-width:0;">
                <div style="font-size:12px; font-weight:900; color:#15803d; text-transform:uppercase; letter-spacing:0.3px;">KONEKSI MODEM: HIDUP (ONLINE)</div>
                <div style="font-size:10.5px; color:#166534; font-weight:700; margin-top:2px;">
                  Router: <b>${escapeHtml(c.modemData.router_name || '-')}</b> | Uptime: <b>${escapeHtml(c.modemData.uptime || '-')}</b>
                </div>
              </div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <span style="background:#ffffff; color:#166534; font-family:'Consolas',monospace; font-size:11px; font-weight:800; padding:3px 7px; border-radius:6px; border:1px solid #86efac; box-shadow:0 1px 2px rgba(22,101,52,0.1);">
                ${escapeHtml(c.modemData.ip_address || '-')}
              </span>
            </div>
          </div>
        ` : `
          <div style="background:#f8fafc; border-bottom:1.5px solid #e2e8f0; border-left:4px solid #94a3b8; padding:8px 14px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px; flex-shrink:0;">⚪</span>
            <div style="min-width:0; flex:1;">
              <div style="font-size:11px; font-weight:800; color:#475569;">STATUS MODEM: BELUM TERDAFTAR DI MIKROTIK</div>
              <div style="font-size:9.5px; color:#64748b;">Nama/ID belum teridentifikasi di data Cek Modem</div>
            </div>
          </div>
        `)}

        <!-- Body Info -->
        <div style="padding:10px 14px 12px;">
          <!-- Modem & Serial Number Box -->
          ${hasModemData ? `
            <div style="background:linear-gradient(135deg, ${isTendaOrHtb ? '#eff6ff 0%, #dbeafe 100%' : '#f0fdf4 0%, #dcfce7 100%'}); border:1.5px solid ${isTendaOrHtb ? '#93c5fd' : '#bbf7d0'}; border-radius:10px; padding:7px 10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 4px rgba(0,0,0,0.04);">
              <div>
                <div style="font-size:9px; color:${isTendaOrHtb ? '#1d4ed8' : '#166534'}; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">TIPE MODEM &amp; SN</div>
                <div style="font-size:12px; color:${isTendaOrHtb ? '#1e40af' : '#15803d'}; font-weight:900;">${escapeHtml(mBrand)} ${escapeHtml(mModel)}</div>
              </div>
              <div style="text-align:right;">
                <span style="font-family:'Consolas',monospace; font-size:11px; font-weight:800; color:#0f172a; background:#ffffff; border:1px solid ${isTendaOrHtb ? '#93c5fd' : '#86efac'}; padding:2px 7px; border-radius:5px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                  SN: ${escapeHtml(mSerial)}
                </span>
              </div>
            </div>
          ` : `
            <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:7px 10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">TIPE PERANGKAT &amp; SN</div>
                <div style="font-size:11px; color:#94a3b8; font-weight:700; font-style:italic;">Belum Terdaftar di MikroTik</div>
              </div>
              <div style="text-align:right;">
                <span style="font-family:'Consolas',monospace; font-size:11px; font-weight:700; color:#94a3b8; background:#ffffff; border:1px solid #cbd5e1; padding:2px 7px; border-radius:5px;">
                  SN: -
                </span>
              </div>
            </div>
          `}

          <!-- ODP Card Badge -->
          <div style="background:linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%); border:1.5px solid #fecaca; border-radius:10px; padding:7px 10px; margin-bottom:8px; display:flex; align-items:center; box-shadow:0 2px 4px rgba(220,38,38,0.04);">
            <div style="background:#fee2e2; color:#dc2626; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; margin-right:9px; flex-shrink:0; box-shadow:0 1px 2px rgba(220,38,38,0.15);">
              📦
            </div>
            <div style="min-width:0; flex:1;">
              <div style="font-size:9px; color:#991b1b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">ODP TERHUBUNG</div>
              <div style="font-size:12px; color:#b91c1c; font-weight:900; word-break:break-all;">${escapeHtml(c.odp || '-')}</div>
            </div>
          </div>

          <!-- Metadata Details in Rounded Pill Box -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:7px 10px; margin-bottom:10px; font-size:11px;">
            <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #edf2f7;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-landmark" style="width:14px; color:#3b82f6;"></i> Wilayah</span>
              <span style="color:#0f172a; font-weight:700; text-align:right;">${escapeHtml(c.kec || '-')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #edf2f7;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-map-marker-alt" style="width:14px; color:#ef4444;"></i> Alamat</span>
              <span style="color:#0f172a; font-weight:600; text-align:right; max-width:65%; word-break:break-word;">${escapeHtml(c.alamat || '-')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:3px 0;">
              <span style="color:#64748b; font-weight:600;"><i class="fas fa-globe" style="width:14px; color:#06b6d4;"></i> Koordinat</span>
              <span style="font-family:'Consolas',monospace; color:#0284c7; font-weight:700; font-size:10px;">${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</span>
            </div>
          </div>

          <!-- Modern Action Buttons -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
            <button onclick="window.gisNavigasiGoogleMaps(${c.lat}, ${c.lng})"
              style="flex:1 1 100%; padding:7px 12px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 3px 6px rgba(16,185,129,0.25); transition:transform 0.1s;">
              <i class="fas fa-location-arrow"></i> Buka Rute Google Maps
            </button>

            ${admin ? `
              <button onclick="window.gisEditPelanggan('${escapeJsAttr(c.id || c.nama)}')"
                style="flex:1; padding:6px; background:#f1f5f9; color:#1e293b; border:1.5px solid #cbd5e1; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"
                title="Edit Data Pelanggan">
                <i class="fas fa-edit" style="color:#2563eb;"></i> Edit
              </button>
              <button onclick="window.gisStartConnectDropcore('${escapeJsAttr(c.id || c.nama)}')"
                style="flex:1.4; padding:6px 8px; background:linear-gradient(135deg, #fef08a 0%, #facc15 100%); color:#854d0e; border:1.5px solid #eab308; border-radius:8px; font-size:10.5px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 2px 4px rgba(234,179,8,0.25);"
                title="Klik lalu klik PIN ODP di peta untuk menghubungkan kabel">
                <i class="fas fa-bolt" style="color:#ca8a04;"></i> Tarik Dropcore
              </button>
              <button onclick="window.gisDeletePelanggan('${escapeJsAttr(c.id || c.nama)}')"
                style="padding:6px 10px; background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer;"
                title="Hapus Pelanggan">
                <i class="fas fa-trash-alt"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Status Bar Footer -->
        <div style="background:#f8fafc; border-top:1.5px solid #e2e8f0; padding:8px 14px; font-size:10px; color:#64748b; display:flex; flex-direction:column; gap:5px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; display:flex; align-items:center; gap:5px;">
              <i class="fas fa-wave-square" style="color:${isConn ? '#16a34a' : '#dc2626'};"></i> Jalur Dropcore:
            </span>
            <span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:${isConn ? '#16a34a' : '#dc2626'}; background:${isConn ? '#dcfce7' : '#fee2e2'}; padding:2px 8px; border-radius:12px;">
              <span style="width:6px; height:6px; border-radius:50%; background:${isConn ? '#16a34a' : '#dc2626'}; display:inline-block;"></span>
              ${isConn ? 'TERKONEKSI' : 'BELUM ADA TARIKAN'}
            </span>
          </div>
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
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:300px; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- ODP Header -->
        <div style="background:linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%); border-bottom:1.5px solid #fecaca; padding:12px 14px 10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="display:inline-flex; align-items:center; gap:4px; background:#fee2e2; color:#dc2626; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; box-shadow:0 1px 2px rgba(220,38,38,0.1);">
              <i class="fas fa-box" style="font-size:9.5px;"></i> ODP FIBER
            </span>
            <span style="background:rgba(255,255,255,0.7); color:#991b1b; font-size:9.5px; font-weight:700; padding:2px 7px; border-radius:12px; border:1px solid #fecaca;">
              NOC MAHAWIRA
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
          <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">PELANGGAN TERHUBUNG</div>
              <div style="font-size:19px; font-weight:900; color:#0f172a;">
                ${connectedCusts.length} <span style="font-size:11px; color:#64748b; font-weight:600;">Port Terisi</span>
              </div>
            </div>
            <div style="background:#fee2e2; color:#dc2626; width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 2px 5px rgba(220,38,38,0.15);">
              ⚡
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

  // Popup ODC - TEMA MODERN TERANG
  function buildOdcPopupHtml(odc) {
    const admin = isAdmin();
    return `
      <div style="font-family:'Segoe UI',Inter,sans-serif; width:100%; max-width:300px; background:#ffffff; color:#1e293b; box-sizing:border-box;">
        <!-- ODC Header -->
        <div style="background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-bottom:1.5px solid #fde68a; padding:12px 14px 10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="display:inline-flex; align-items:center; gap:4px; background:#fef3c7; color:#b45309; font-size:10px; font-weight:800; padding:3px 9px; border-radius:20px; box-shadow:0 1px 2px rgba(180,83,9,0.1);">
              <i class="fas fa-server" style="font-size:9.5px;"></i> ODC CENTRAL
            </span>
            <span style="background:rgba(255,255,255,0.7); color:#92400e; font-size:9.5px; font-weight:700; padding:2px 7px; border-radius:12px; border:1px solid #fde68a;">
              NOC MAHAWIRA
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
    dropdown.innerHTML = displayResults.map((r, idx) => `
      <div class="gis-search-item" onpointerdown="window.gisSelectSearchResult(${r.lat}, ${r.lng}, '${r.type}', '${escapeHtml(r.title)}')" onclick="window.gisSelectSearchResult(${r.lat}, ${r.lng}, '${r.type}', '${escapeHtml(r.title)}')">
        <div style="min-width:0; flex:1; padding-right:8px;">
          <div style="font-weight:700; word-break:break-word;">${r.title}</div>
          <div style="font-size:11px; color:#64748b; word-break:break-word;">${r.subtitle}</div>
        </div>
        <span style="font-size:11px; color:#2563eb; font-weight:800; white-space:nowrap; flex-shrink:0;">Lihat ➜</span>
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
  window.gisSelectSearchResult = function (lat, lng, type, title) {
    const dropdown = document.getElementById('gisSearchResultsDropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Bersihkan penanda pencarian sebelumnya
    S.layers.searchPin.clearLayers();

    // 1. LANGSUNG ZOOM KE TITIK KOORDINAT (ZOOM 18 - SANGAT DEKAT & DETAIL)
    // Titik langsung tepat berada di tengah layar
    S.map.setView([lat, lng], 18, { animate: true, duration: 0.5 });

    // Segera render ulang penanda pelanggan di viewport baru agar pelanggan dan ODP di sekitar langsung muncul!
    setTimeout(() => {
      window.gisRenderPelangganMarkers();
    }, 350);

    // 2. PENANDA KHUSUS TITIK PENCARIAN (RADAR BEACON + TARGET PIN MENYALA)
    // Z-Index super tinggi (999999) agar selalu berada DI ATAS semua label & pin pelanggan!
    const searchTargetIcon = L.divIcon({
      className: 'custom-search-beacon',
      html: `
        <div class="gis-search-beacon-wrap" title="Titik Lokasi Dicari: ${lat.toFixed(6)}, ${lng.toFixed(6)}">
          <div class="gis-beacon-wave"></div>
          <div class="gis-beacon-wave wave-2"></div>
          <div class="gis-beacon-center">
            <span style="font-size:26px; line-height:1; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));">🎯</span>
          </div>
          <div class="gis-beacon-label">
            📍 TITIK DICARI
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const targetMarker = L.marker([lat, lng], {
      icon: searchTargetIcon,
      zIndexOffset: 999999 // DIJAMIN PALING DEPAN, TIDAK TERTUTUP LABEL APAPUN
    }).addTo(S.layers.searchPin);

    // Popup Info
    const isMobile = window.innerWidth <= 768;
    const POPUP_OPT = {
      autoPan: true,
      autoPanPaddingTopLeft: L.point(isMobile ? 10 : 20, isMobile ? 50 : 115),
      autoPanPaddingBottomRight: L.point(isMobile ? 10 : 20, isMobile ? 40 : 90),
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

    // Jika mencari Pelanggan / ODP / ODC:
    setTimeout(() => {
      if (type === 'pelanggan') {
        const cust = S.data.pelanggans.find(p => Math.abs(p.lat - lat) < 0.00015 && Math.abs(p.lng - lng) < 0.00015);
        if (cust) {
          L.popup(POPUP_OPT).setLatLng([cust.lat, cust.lng]).setContent(buildCustomerPopupHtml(cust)).openOn(S.map);
          return;
        }
      } else if (type === 'odp') {
        const odp = S.data.odps.find(o => Math.abs(o.lat - lat) < 0.00015 && Math.abs(o.lng - lng) < 0.00015);
        if (odp) {
          L.popup(POPUP_OPT).setLatLng([odp.lat, odp.lng]).setContent(buildOdpPopupHtml(odp)).openOn(S.map);
          return;
        }
      } else if (type === 'odc') {
        const odc = S.data.odcs.find(o => Math.abs(o.lat - lat) < 0.00015 && Math.abs(o.lng - lng) < 0.00015);
        if (odc) {
          L.popup(POPUP_OPT).setLatLng([odc.lat, odc.lng]).setContent(buildOdcPopupHtml(odc)).openOn(S.map);
          return;
        }
      }

      // Fallback cari di layer
      S.layers.pelangganConnected.eachLayer(layer => { if (layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.0001) layer.openPopup(); });
      S.layers.pelangganUnconnected.eachLayer(layer => { if (layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.0001) layer.openPopup(); });
      S.layers.odp.eachLayer(layer => { if (layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.0001) layer.openPopup(); });
      S.layers.odc.eachLayer(layer => { if (layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.0001) layer.openPopup(); });
    }, 500);
  };

  // Hapus Penanda Pencarian Sementara
  window.gisClearSearchPin = function () {
    if (S.layers.searchPin) S.layers.searchPin.clearLayers();
    if (S.map) S.map.closePopup();
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
        'draw-cable': '✏️ Klik Pin Pelanggan lalu Pin ODP untuk otomatis membuat dropcore, atau klik peta!'
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

  // 6. EDIT JALUR KABEL MANUAL
  window.gisEditCable = function (lineId, cableType) {
    if (!isAdmin()) return;

    let targetArray = null;
    if (cableType === 'feeder') targetArray = S.data.feederLines;
    else if (cableType === 'distribusi') targetArray = S.data.distLines;
    else targetArray = S.data.dropLines;

    const line = targetArray.find(l => l.id === lineId);
    if (!line) return;

    Swal.fire({
      title: '✏️ Edit Jalur Kabel',
      html: `
        <div style="text-align:left; font-size:13px;">
          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">Nama Jalur Kabel:</label>
            <input type="text" id="swalEditCableName" class="swal2-input" value="${escapeHtml(line.name)}" style="width:100%; margin:4px 0;">
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-weight:700;">Jenis Kabel:</label>
            <select id="swalEditCableType" class="swal2-select" style="width:100%; margin:4px 0; display:block;">
              <option value="feeder" ${cableType === 'feeder' ? 'selected' : ''}>🔵 Feeder (Biru)</option>
              <option value="distribusi" ${cableType === 'distribusi' ? 'selected' : ''}>🔴 Distribusi (Merah)</option>
              <option value="dropcore" ${cableType === 'dropcore' ? 'selected' : ''}>🟡 Drop Core (Kuning)</option>
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
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
        Swal.fire({ icon: 'success', title: 'Kabel Berhasil Diperbarui!', timer: 1800, showConfirmButton: false });
      }
    });
  };

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
