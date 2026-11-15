/* ============================================================
   KLAIM BBM — INJECTOR (FIXED)
   ============================================================ */
(function () {
  'use strict';

  console.log('📎 Klaim BBM injector loaded');

  // ============================================================
  // Ambil SEMUA ticketid dari grup (pakai selector yang aman)
  // ============================================================
  function extractTicketsFromGroup(groupRow) {
    const tickets = [];
    let currentRow = groupRow;

    while (currentRow) {
      // Cari semua td di baris ini, TAPI ambil berdasarkan kolom visual
      // yang benar. Karena pakai rowspan, tiap baris bisa beda jumlah td.
      // Solusi paling aman: baca data-ticket-id kalau ada.
      // Kalau tidak ada, pakai pendekatan: cari teks yang formatnya ticketid
      // (mengandung "-" dan diawali prefix tiket: MIG/PSB/GGN/GMS/PRJ/LN).

      const tds = currentRow.querySelectorAll('td');
      let found = null;

      for (const td of tds) {
        const txt = td.textContent.trim();
        // Pola ticketid: PREFIX-YYMM-NNN
        if (/^(MIG|PSB|GGN|GMS|PRJ|LN|TKT)-\d{4}-\d+$/i.test(txt)) {
          found = txt;
          break;
        }
      }

      if (found) tickets.push(found);

      const nextRow = currentRow.nextElementSibling;
      if (!nextRow) break;

      const nextTds = nextRow.querySelectorAll('td');
      // Pemisah grup (td colspan)
      if (nextTds.length === 1 && nextTds[0].hasAttribute('colspan')) break;

      // Baris grup baru (td pertama punya rowspan)
      const firstTd = nextTds[0];
      if (firstTd && firstTd.hasAttribute('rowspan')) break;

      currentRow = nextRow;
    }

    return tickets;
  }

  // ============================================================
  // Ambil label tim dari grup (hanya nama teknisi, buang tombol)
  // ============================================================
  function extractTimLabel(groupRow) {
    const tds = groupRow.querySelectorAll('td');
    const lastTd = tds[tds.length - 1];
    if (!lastTd) return 'Tim';

    // Ambil text node saja, TANPA isi tombol
    let names = [];
    lastTd.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) names.push(t);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Kalau <br>, jadi pemisah
        if (node.tagName === 'BR') return;
        // Kalau <span>, <strong>, dll → ambil teks
        // TAPI SKIP tombol
        if (node.tagName === 'BUTTON') return;
        const t = node.textContent.trim();
        if (t) names.push(t);
      }
    });

    // Fallback: kalau kosong, ambil innerHTML buang tombol
    if (names.length === 0) {
      const clone = lastTd.cloneNode(true);
      clone.querySelectorAll('button').forEach(b => b.remove());
      const txt = clone.innerHTML.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').trim();
      return txt || 'Tim';
    }

    let text = names.join(', ').replace(/,\s*,/g, ',').trim();
    if (text.length > 60) text = text.substring(0, 60) + '...';
    return text || 'Tim';
  }

  // ============================================================
  // Ambil label periode
  // ============================================================
  function extractPeriodeLabel() {
    const dateFrom = document.getElementById('rekapDate')?.value || '';
    const dateTo   = document.getElementById('rekapDateTo')?.value || '';
    const fmt = (s) => {
      if (!s) return '';
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    };
    if (dateFrom && dateTo) return `${fmt(dateFrom)} s/d ${fmt(dateTo)}`;
    if (dateFrom) return fmt(dateFrom);
    if (dateTo) return fmt(dateTo);
    return '-';
  }

  // ============================================================
  // Ambil daftar teknisi dari grup
  // ============================================================
  function extractTechListFromGroup(groupRow) {
    const tds = groupRow.querySelectorAll('td');
    const lastTd = tds[tds.length - 1];
    if (!lastTd) return [];

    // Prioritas 1: Ambil dari data-tech tombol toggle
    const btns = lastTd.querySelectorAll('.btn-toggle-kendaraan');
    if (btns.length > 0) {
      const list = [];
      btns.forEach(b => {
        const t = (b.getAttribute('data-tech') || '').trim();
        if (t && !list.includes(t)) list.push(t);
      });
      if (list.length > 0) return list;
    }

    // Prioritas 2: Parse text node
    const clone = lastTd.cloneNode(true);
    clone.querySelectorAll('button').forEach(b => b.remove());
    return clone.innerText.split(/[\n,&|<br>]+/).map(s => s.trim()).filter(Boolean);
  }

  // ============================================================
  // VIEW INDUK KLAIM BBM (SEMUA TIM / FORM SEKALIGUS)
  // ============================================================
  function openKlaimBBMInduk(e) {
    if (e && e.preventDefault) e.preventDefault();
    const rekapBody = document.getElementById('rekapBody');
    if (!rekapBody) return;

    const groupRows = [];
    rekapBody.querySelectorAll('tr').forEach(tr => {
      const firstTd = tr.querySelector('td');
      if (firstTd && firstTd.hasAttribute('rowspan')) {
        groupRows.push(tr);
      }
    });

    if (groupRows.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data rekap tiket pada tanggal/filter yang dipilih.' });
      } else {
        alert('Tidak ada data rekap tiket.');
      }
      return;
    }

    const payload = [];

    groupRows.forEach(row => {
      const tickets = extractTicketsFromGroup(row);
      const allTechs = extractTechListFromGroup(row);
      // Filter teknisi yang diset ke R2
      const r2Techs = allTechs.filter(t => (localStorage.getItem('tech_vehicle_' + t) || 'R2') === 'R2');

      if (r2Techs.length > 0 && tickets.length > 0) {
        payload.push({
          timLabel: r2Techs.join(', '),
          r2Techs: r2Techs,
          ticketIds: tickets
        });
      }
    });

    if (payload.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'Tidak Ada Teknisi R2',
          text: 'Semua teknisi pada rekap ini ditandai menggunakan kendaraan R4 (Mobil). Ubah penanda di samping nama teknisi menjadi R2 untuk mencetak kupon BBM.'
        });
      } else {
        alert('Tidak ada teknisi R2 pada rekap ini.');
      }
      return;
    }

    const periode = extractPeriodeLabel();
    const dataObj = {
      mode: 'induk',
      periode: periode,
      groups: payload
    };

    sessionStorage.setItem('klaim_bbm_induk_data', JSON.stringify(dataObj));
    window.open('klaim-bbm.html?mode=induk', '_blank');
  }

  window.openKlaimBBMInduk = openKlaimBBMInduk;
  window.openViewNota = openKlaimBBMInduk;

  // ============================================================
  // Buka klaim BBM satuan (fallback)
  // ============================================================
  function openKlaimBBM(ticketsIds, timLabel) {
    if (!ticketsIds || ticketsIds.length === 0) {
      alert('Tidak ada tiket di grup ini.');
      return;
    }
    const periode = extractPeriodeLabel();
    const params = new URLSearchParams({
      tickets: ticketsIds.join(','),
      tim: timLabel || 'Tim',
      periode: periode,
      kendaraan: 'R2'
    });
    window.open('klaim-bbm.html?' + params.toString(), '_blank');
  }
  window.openKlaimBBM = openKlaimBBM;

  console.log('✅ Klaim BBM module ready (Tombol View Nota aktif)');

})();