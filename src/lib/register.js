import { pad2 } from './format';

// Reads the weighbridge software's "Date-Wise Collection Register" (.xls / .xlsx):
// title rows, a header row (S.No, Serial No, Vehicle No, Name, Material, Tare, Gross, Net, Amount, Time),
// "Date : 22-Aug-2026" rows that date the rows beneath them, data rows, and total rows (skipped).

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

const COLS = {
  sno: /^s\.?\s*no/i,
  serial: /serial/i,
  vehicle: /veh|reg/i,
  name: /name/i,
  material: /^mat/i,
  tare: /tare|trae/i,
  gross: /gross/i,
  net: /^net/i,
  amount: /amount|bill/i,
  time: /time/i,
};

export const normalName = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function num(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseDate(text) {
  const m = String(text).match(/(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ](\d{4})/);
  if (!m || !MONTHS[m[2].toUpperCase()]) return '';
  return m[3] + '-' + pad2(MONTHS[m[2].toUpperCase()]) + '-' + pad2(+m[1]);
}

function parseTime(v) {
  if (typeof v === 'number') {
    const mins = Math.round((v % 1) * 24 * 60);
    return pad2(Math.floor(mins / 60) % 24) + ':' + pad2(mins % 60);
  }
  const m = String(v || '').match(/(\d{1,2})[:.](\d{2})/);
  return m ? pad2(+m[1]) + ':' + m[2] : '';
}

// Register material text → material id. Returns { matId, kind, matName }.
export function matchMaterial(text) {
  const raw = String(text || '').trim();
  const t = raw.toUpperCase().replace(/[\s.\-_]/g, '');
  if (/SOLING|BOULDER/.test(t)) return { matId: 'M20', kind: 'soling', matName: '' };
  if (/11\/2/.test(t)) return { matId: 'M05', kind: 'sale', matName: '' };
  if (/1\/4/.test(t)) return { matId: 'M01', kind: 'sale', matName: '' };
  if (/1\/2/.test(t)) return { matId: 'M02', kind: 'sale', matName: '' };
  if (/3\/4/.test(t)) return { matId: 'M03', kind: 'sale', matName: '' };
  if (/OVER/.test(t)) return { matId: 'M04', kind: 'sale', matName: '' };
  if (/^MS$|MSAND/.test(t)) return { matId: 'M06', kind: 'sale', matName: '' };
  if (/^PS$|PSAND/.test(t)) return { matId: 'M07', kind: 'sale', matName: '' };
  if (/^POW|POWD|DUST/.test(t)) return { matId: 'M08', kind: 'sale', matName: '' };
  if (/^WM$|WEDMIX|WETMIX|WMM/.test(t)) return { matId: 'M09', kind: 'sale', matName: '' };
  return { matId: 'M10', kind: 'sale', matName: raw };
}

// SheetJS is loaded only when a register is opened, so it does not slow down every page.
export async function parseRegister(buffer) {
  const { read, utils } = await import('xlsx');
  const wb = read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  let cols = null;
  let date = '';
  let periodFrom = '';
  let periodTo = '';
  const rows = [];
  const skipped = [];

  grid.forEach((cells, r) => {
    const line = cells.map((c) => String(c).trim()).join(' ');
    if (!line.trim()) return;
    const period = line.match(/from\s*:?\s*(\S+)\s+to\s*:?\s*(\S+)/i);
    if (period && !cols) { periodFrom = parseDate(period[1]); periodTo = parseDate(period[2]); return; }
    if (!cols && cells.some((c) => COLS.sno.test(String(c).trim())) && cells.some((c) => COLS.material.test(String(c).trim()))) {
      cols = {};
      cells.forEach((c, i) => {
        const h = String(c).trim();
        Object.entries(COLS).forEach(([k, re]) => { if (cols[k] === undefined && h && re.test(h)) cols[k] = i; });
      });
      return;
    }
    const dateCell = line.match(/date\s*:\s*(.+)/i);
    if (dateCell) { date = parseDate(dateCell[1]) || date; return; }
    if (!cols) return;
    if (/total/i.test(line)) return;
    const get = (k) => (cols[k] === undefined ? '' : cells[cols[k]]);
    const serial = String(get('serial')).trim();
    if (!serial || !String(get('sno')).trim()) return;
    const row = {
      line: r + 1,
      date: date || periodFrom,
      time: parseTime(get('time')),
      serial,
      vehicle: String(get('vehicle')).trim().toUpperCase(),
      name: String(get('name')).trim(),
      material: String(get('material')).trim(),
      tare: num(get('tare')),
      gross: num(get('gross')),
      net: num(get('net')),
      amount: num(get('amount')),
    };
    if (!row.date) { skipped.push({ ...row, why: 'No date found above this row' }); return; }
    rows.push(row);
  });

  if (!cols) throw new Error('This file does not look like the collection register — no header row with S.No and Material was found.');
  return { rows, skipped, from: periodFrom || (rows[0] && rows[0].date) || '', to: periodTo || (rows[rows.length - 1] && rows[rows.length - 1].date) || '' };
}
