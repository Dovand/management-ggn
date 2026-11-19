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

  function getTicketTechVeh(tId, techName, fallbackId = '') {
    const cleanT = String(tId || '').trim();
    const cleanTech = String(techName || '').trim();
    const cleanFallback = String(fallbackId || '').trim();

    if (typeof window.getTicketTechVehicle === 'function') {
      const v1 = window.getTicketTechVehicle(cleanT, cleanTech);
      if (v1 === 'R4') return 'R4';
      if (cleanFallback) {
        const v2 = window.getTicketTechVehicle(cleanFallback, cleanTech);
        if (v2 === 'R4') return 'R4';
      }
      return v1;
    }

    const exact = localStorage.getItem('ticket_tech_veh_' + cleanT + '_' + cleanTech) ||
                  (cleanFallback ? localStorage.getItem('ticket_tech_veh_' + cleanFallback + '_' + cleanTech) : null);
    if (exact) return exact.toUpperCase();

    const byTicket = localStorage.getItem('ticket_vehicle_' + cleanT) ||
                     (cleanFallback ? localStorage.getItem('ticket_vehicle_' + cleanFallback) : null);
    if (byTicket) return byTicket.toUpperCase();

    return 'R2';
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

      // 🔥 CEK PER TEKNISI PADA TIKET:
      // Hanya teknisi yang memakai R2 (Motor) pada tiket tersebut yang masuk kupon BBM!
      // Jika teknisi A memakai Mobil (R4) dan teknisi B memakai Motor (R2),
      // teknisi B tetap mendapatkan kupon BBM motor tanpa terpengaruh teknisi A!
      allTechs.forEach(tech => {
        const r2Tickets = tickets.filter(tId => getTicketTechVeh(tId, tech) === 'R2');
        if (r2Tickets.length > 0) {
          // Cari grup dengan tiket yang persis sama untuk digabung (maks 2 teknisi per motor)
          const existingGroup = payload.find(g => 
            g.ticketIds.length === r2Tickets.length && 
            g.ticketIds.every((id, idx) => id === r2Tickets[idx]) &&
            g.r2Techs.length < 2 &&
            !g.r2Techs.includes(tech)
          );

          if (existingGroup) {
            existingGroup.r2Techs.push(tech);
            existingGroup.timLabel = existingGroup.r2Techs.join(', ');
          } else {
            payload.push({
              timLabel: tech,
              r2Techs: [tech],
              ticketIds: r2Tickets
            });
          }
        }
      });
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
  // PRINT REKAP PENCAIRAN BBM (LANDSCAPE A4 UNTUK TANDA TANGAN BASAH)
  // ============================================================
  function openPrintRekapBBM(e) {
    if (e && e.preventDefault) e.preventDefault();

    const dateFrom = document.getElementById('rekapDate')?.value || '';
    const dateTo   = document.getElementById('rekapDateTo')?.value || '';
    const jenisFilter = document.getElementById('rekapJenisTiket')?.value || 'all';
    const timFilter = document.getElementById('rekapTim')?.value || 'all';

    const checkedJenis = [];
    if (document.getElementById('expPSB')?.checked) checkedJenis.push('PSB');
    if (document.getElementById('expGGN')?.checked) checkedJenis.push('GGN');
    if (document.getElementById('expGAMAS')?.checked) checkedJenis.push('GAMAS');
    if (document.getElementById('expPROJECT')?.checked) checkedJenis.push('PROJECT');
    if (document.getElementById('expMIGRASI')?.checked) checkedJenis.push('MIGRASI');
    if (document.getElementById('expLAINNYA')?.checked) checkedJenis.push('LAINNYA');

    const allTickets = (typeof window.tickets !== 'undefined' && Array.isArray(window.tickets))
      ? window.tickets
      : (typeof tickets !== 'undefined' && Array.isArray(tickets) ? tickets : []);

    function getTicketDateStr(t) {
      if (!t || !t.createdAt) return '';
      if (typeof t.createdAt === 'string' && t.createdAt.includes('T')) {
        return t.createdAt.split('T')[0];
      }
      try {
        const d = new Date(t.createdAt);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (e) {}
      return '';
    }

    let filtered = allTickets.filter(t => {
      const tDateStr = getTicketDateStr(t);
      if (!tDateStr) return false;

      if (dateFrom && tDateStr < dateFrom) return false;
      if (dateTo && tDateStr > dateTo) return false;
      if (jenisFilter !== 'all' && (t.jenistiket || '') !== jenisFilter) return false;
      if (checkedJenis.length > 0 && !checkedJenis.includes(t.jenistiket || '')) return false;
      if (typeof isTimMatch === 'function' && !isTimMatch(t, timFilter)) return false;
      return true;
    });

    if (filtered.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'Data Kosong',
          text: 'Tidak ada data tiket pada filter / tanggal yang dipilih.'
        });
      } else {
        alert('Tidak ada data tiket pada filter / tanggal yang dipilih.');
      }
      return;
    }

    function abbreviateLocation(loc) {
      if (!loc || loc === '-') return '-';
      let str = String(loc).trim();
      str = str.replace(/^ODP[\s\-_]*/i, '');
      const dict = [
        { reg: /\b(WONOREJO|WONREJO)\b/gi, rep: 'WNJ' },
        { reg: /\b(SUKODONO)\b/gi, rep: 'SKD' },
        { reg: /\b(BANJARWARU|BANJAR\s+WARU)\b/gi, rep: 'BJW' },
        { reg: /\b(GROBOGAN|GRBOBOGAN)\b/gi, rep: 'GRB' },
        { reg: /\b(CURAHLENGKONG|CURAH\s+LENGKONG)\b/gi, rep: 'CRL' },
        { reg: /\b(KEDUNGJAJANG|KEDUNG\s+JAJANG)\b/gi, rep: 'KDJ' },
        { reg: /\b(RANDUAGUNG|RANDU\s+AGUNG)\b/gi, rep: 'RDA' },
        { reg: /\b(PANDANSARI|PANDAN\s+SARI)\b/gi, rep: 'PDS' },
        { reg: /\b(KRASAK)\b/gi, rep: 'KSK' },
        { reg: /\b(YOSOWILANGUN)\b/gi, rep: 'YSW' },
        { reg: /\b(CANDIPURO)\b/gi, rep: 'CDP' },
        { reg: /\b(BONDOYUDO)\b/gi, rep: 'BDY' },
        { reg: /\b(BANYUPUTIH)\b/gi, rep: 'BYP' },
        { reg: /\b(LABRUK)\b/gi, rep: 'LBK' },
        { reg: /\b(KEBONAN)\b/gi, rep: 'KBN' },
        { reg: /\b(KRAJAN)\b/gi, rep: 'KRJ' },
        { reg: /\b(SUMBER\s+MRUTU)\b/gi, rep: 'S.MRUTU' },
        { reg: /\b(SERVER)\b/gi, rep: 'SRV' },
        { reg: /\b(KANTOR)\b/gi, rep: 'KTR' }
      ];
      dict.forEach(item => {
        str = str.replace(item.reg, item.rep);
      });
      return str.trim() || '-';
    }

    // Kelompokkan per Tanggal -> per Tim
    const dateMap = {};
    filtered.forEach(t => {
      const dateKey = getTicketDateStr(t);
      if (!dateKey) return;
      if (!dateMap[dateKey]) dateMap[dateKey] = [];
      dateMap[dateKey].push(t);
    });

    const daysIndo = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
    const rows = [];
    const sortedDateKeys = Object.keys(dateMap).sort();

    sortedDateKeys.forEach(dateKey => {
      const ticketsInDate = dateMap[dateKey];
      const [yr, mo, da] = dateKey.split('-');
      const dateObj = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, parseInt(da, 10));
      const hari = daysIndo[dateObj.getDay()] || '-';
      const tglIndo = `${da}/${mo}/${yr}`;

      // Kelompokkan per Tim (HANYA TEKNISI DENGAN KENDARAAN R2 / MOTOR)
      const timMap = {};
      ticketsInDate.forEach(t => {
        const ticketId = (t.ticketid || t.ticketId || '-').trim();
        let rawTechs = t.technicians || [];
        if (typeof rawTechs === 'string') {
          try { rawTechs = JSON.parse(rawTechs); } catch(e) { rawTechs = rawTechs.split(',').map(s => s.trim()); }
        }
        if (!Array.isArray(rawTechs)) rawTechs = [];
        rawTechs = rawTechs.filter(n => !['PSB', 'GGN', 'GAMAS', 'PROJECT', 'MIGRASI', 'LAINNYA', 'PSB/GGN'].includes(n));

        // 🔥 FILTER KETAT: HANYA TEKNISI R2 (MOTOR)
        // Teknisi yang memakai R4 (Mobil) TIDAK dimasukkan ke form pencairan BBM!
        const r2Techs = rawTechs.filter(techName => {
          const veh = getTicketTechVeh(ticketId, techName, t.id);
          return veh === 'R2';
        });

        // Jika tidak ada teknisi R2 pada tiket ini (semua R4 / mobil), tiket tidak masuk rekap BBM
        if (r2Techs.length === 0) return;

        // 🔥 ATURAN KLAIM BBM: 1 TIM MAKSIMAL 2 ORANG SESUAI URUTAN CENTANG
        // Jika 3 orang: Tim 1 (Orang 1 & 2), Tim 2 (Orang 3)
        // Jika 4 orang: Tim 1 (Orang 1 & 2), Tim 2 (Orang 3 & 4)
        const teams = [];
        for (let i = 0; i < r2Techs.length; i += 2) {
          teams.push(r2Techs.slice(i, i + 2));
        }

        teams.forEach(teamMembers => {
          const timKey = teamMembers.join(', ');
          if (!timMap[timKey]) timMap[timKey] = [];
          if (!timMap[timKey].includes(t)) {
            timMap[timKey].push(t);
          }
        });
      });

      Object.keys(timMap).forEach(timName => {
        const groupTickets = timMap[timName];

        // Daftar tiket
        const ticketIds = groupTickets.map(t => t.ticketid || '-').filter(x => x && x !== '-');

        // Daftar tujuan/wilayah (hanya wilayah/lokasi, tanpa ODP)
        const destinations = [];
        groupTickets.forEach(t => {
          let loc = (t.wilayahpelanggan && t.wilayahpelanggan !== '-') ? t.wilayahpelanggan : '';
          if (!loc && t.alamat && t.alamat !== '-') {
            loc = t.alamat.replace(/ODP[\s\-_]*[A-Z0-9\-_]*/gi, '').trim();
          }
          if (loc && !/^ODP/i.test(loc)) {
            const shortLoc = abbreviateLocation(loc);
            if (shortLoc && shortLoc !== '-' && !destinations.includes(shortLoc)) {
              destinations.push(shortLoc);
            }
          }
        });

        // Daftar kegiatan / jenis gangguan
        const kegs = [];
        groupTickets.forEach(t => {
          const j = t.jenistiket || t.jenisgangguan || '';
          if (j && !kegs.includes(j)) kegs.push(j);
        });

        rows.push({
          hari: hari,
          tgl: tglIndo,
          rawDate: dateKey,
          tim: timName,
          ticketIds: ticketIds,
          tujuan: destinations.join(' | ') || '-',
          keterangan: kegs.join(' | ') || 'Operasional',
          nominal: '',
          ttd: ''
        });
      });
    });

    if (rows.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'Tidak Ada Tiket R2',
          text: 'Semua teknisi pada tiket yang difilter ditandai menggunakan kendaraan R4 (Mobil). Form pencairan BBM hanya untuk teknisi dengan kendaraan R2 (Motor).'
        });
      } else {
        alert('Semua teknisi pada tiket yang difilter ditandai menggunakan kendaraan R4 (Mobil).');
      }
      return;
    }

    const periode = extractPeriodeLabel();
    const payload = {
      periode: periode,
      rows: rows,
      totalTickets: filtered.length
    };

    sessionStorage.setItem('rekap_bbm_print_data', JSON.stringify(payload));
    window.open('rekap-bbm-print.html', '_blank');
  }

  window.openPrintRekapBBM = openPrintRekapBBM;

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