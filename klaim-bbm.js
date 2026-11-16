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
      let found = null;
      const btn = currentRow.querySelector('.btn-toggle-kendaraan[data-ticketid]');
      if (btn) {
        found = btn.getAttribute('data-ticketid');
      }

      if (!found) {
        const tds = currentRow.querySelectorAll('td');
        for (const td of tds) {
          const txt = td.textContent.trim();
          // Pola ticketid: PREFIX-YYMM-NNN atau TCK/NNNN/YYYYMMDD
          if (/^(MIG|PSB|GGN|GMS|PRJ|LN|TKT)[-/]\d+/i.test(txt) || /^TCK\/\d+\/\d+/i.test(txt)) {
            found = txt;
            break;
          }
        }
      }

      if (found && !tickets.includes(found)) tickets.push(found);

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

    // Prioritas 1: Ambil dari span nama teknisi
    const spans = lastTd.querySelectorAll('span');
    if (spans.length > 0) {
      const list = [];
      spans.forEach(s => {
        const t = s.textContent.trim();
        if (t && t !== '-' && !list.includes(t)) list.push(t);
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

      // 🔥 FILTER KENDARAAN PER TIKET:
      // Hanya tiket yang diset R2 (Motor) yang berhak masuk kupon klaim BBM R2!
      // Tiket yang diset R4 (Mobil) otomatis dikeluarkan dari kupon BBM R2.
      const r2Tickets = tickets.filter(tId => {
        const veh = (localStorage.getItem('ticket_vehicle_' + tId) || 'R2').toUpperCase();
        return veh === 'R2';
      });

      if (r2Tickets.length > 0 && allTechs.length > 0) {
        payload.push({
          timLabel: allTechs.join(', '),
          r2Techs: allTechs,
          ticketIds: r2Tickets
        });
      }
    });

    if (payload.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'Tidak Ada Tiket R2',
          text: 'Semua tiket pada rekap ini ditandai menggunakan kendaraan R4 (Mobil). Ubah penanda kendaraan tiket menjadi R2 untuk mencetak kupon BBM.'
        });
      } else {
        alert('Tidak ada tiket R2 pada rekap ini.');
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
    // Filter HANYA tiket R2
    const r2Tickets = ticketsIds.filter(tId => {
      const veh = (localStorage.getItem('ticket_vehicle_' + tId) || 'R2').toUpperCase();
      return veh === 'R2';
    });
    if (r2Tickets.length === 0) {
      alert('Semua tiket pada tim ini ditandai menggunakan kendaraan R4 (Mobil).');
      return;
    }
    const periode = extractPeriodeLabel();
    const params = new URLSearchParams({
      tickets: r2Tickets.join(','),
      tim: timLabel || 'Tim',
      periode: periode,
      kendaraan: 'R2'
    });
    window.open('klaim-bbm.html?' + params.toString(), '_blank');
  }
  window.openKlaimBBM = openKlaimBBM;

  console.log('✅ Klaim BBM module ready (Tombol View Nota aktif)');

})();