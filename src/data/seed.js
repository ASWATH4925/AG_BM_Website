// Seed records for the yard. Parties, materials, rates and tickets are taken from the 22 Aug and 8 Oct 2026 registers;
// workers, attendance, advances and expenses are sample entries.

// Credit parties (they owe us). Owner, address and contact are filled in by the office.
const cust = [
  'AJITH', 'CASTLE STONE 1', 'DKR 1', 'DR', 'EKM MURUGAN', 'GOKILA MANI 1', 'GP', 'KK', 'LAKSHMI', 'MANI V.MURUGAN',
  'MATHAN', 'OG', 'PKV', 'RMS KUMAR', 'RNP', 'SAMPATH', 'SELVAMAYIL', 'SIVA WORKSHOP', 'SKS', 'TIRUPATHI',
].map((name, i) => ({
  id: 'C' + String(i + 1).padStart(2, '0'), code: 'CP-' + String(i + 1).padStart(3, '0'), name,
  owner: '', address: '', contact: '', gst: '', status: 'Active', remarks: '', received: 0, last: '—',
}));

// Soling (boulder) suppliers (we owe them). Kept apart from credit parties.
const suppliers = ['SKK KARTHI', 'SARAVANABAVA', 'SR'].map((name, i) => ({
  id: 'P' + String(i + 1).padStart(2, '0'), code: 'SP-' + String(i + 1).padStart(2, '0'), name,
  owner: '', address: '', contact: '', upi: '', linkedCustId: '', status: 'Active', remarks: '',
}));

// Materials. Everything is priced per ton; "Other" takes a name typed on the ticket; soling is bought, never sold.
const mats = [
  ['M01', 'AG-14', 'Aggregate 1/4', 'Aggregate'],
  ['M02', 'AG-12', 'Aggregate 1/2', 'Aggregate'],
  ['M03', 'AG-34', 'Aggregate 3/4', 'Aggregate'],
  ['M04', 'AG-OV', 'Aggregate Over', 'Aggregate'],
  ['M05', 'AG-112', 'Aggregate 1 1/2', 'Aggregate'],
  ['M06', 'MS', 'M-Sand', 'Sand'],
  ['M07', 'PS', 'P-Sand', 'Sand'],
  ['M08', 'DU', 'Dust', 'Dust'],
  ['M09', 'WM', 'Wedmix', 'Wedmix'],
  ['M10', 'OT', 'Other', 'Other'],
  ['M20', 'SO', 'Soling (boulder)', 'Purchase'],
].map(([id, code, name, group]) => ({ id, code, name, group, unit: 'Ton', kind: group === 'Purchase' ? 'purchase' : 'sale', status: 'Active' }));

// Rate cards, ₹ per ton. custId '' = standard rate; a party card overrides it for its period.
// Values are read off the bills in the two registers; period start dates are placeholders to adjust.
let rid = 0;
const card = (custId, matId, rate, from, to, remarks) => ({ id: 'R' + String(++rid).padStart(3, '0'), custId, matId, rate, from, to, remarks, by: 'A. Gopalakrishnan' });
const rates = [
  ...[['M06', 1100], ['M07', 1200], ['M01', 900], ['M03', 900], ['M05', 900]]
    .map(([m, r]) => card('', m, r, '2026-08-01', '2026-09-30', 'Read from the 22 Aug 2026 register')),
  ...[['M06', 1000], ['M07', 1100], ['M01', 800], ['M02', 800], ['M03', 800], ['M05', 800]]
    .map(([m, r]) => card('', m, r, '2026-10-01', '', 'Read from the 8 Oct 2026 register')),
  card('C10', 'M01', 750, '2026-10-01', '', 'Party rate seen on the 8 Oct register'),
  card('C04', 'M06', 950, '2026-10-01', '', 'Party rate seen on the 8 Oct register'),
];

// Credit tickets from the registers: [ticket, date, time, party, material, vehicle, tare kg, gross kg]
const byName = (n) => cust.find((c) => c.name === n).id;
const ord = [
  ['WB-24112', '2026-10-08', '08:35', 'TIRUPATHI', 'M03', 'TN 78 AY 4114', 4340, 11550],
  ['WB-24111', '2026-10-08', '08:32', 'DR', 'M06', 'TN 78 MC 8339', 4820, 13360],
  ['WB-24110', '2026-10-08', '08:10', 'OG', 'M01', 'TN 78 MB 0972', 4360, 12070],
  ['WB-24109', '2026-10-08', '07:57', 'PKV', 'M06', 'TN 78 AZ 6221', 4250, 12450],
  ['WB-24108', '2026-10-08', '07:50', 'MANI V.MURUGAN', 'M01', 'TN 32 J 3355', 8380, 22550],
  ['WB-24107', '2026-10-08', '07:37', 'SKS', 'M02', 'TN 78 MA 5806', 4320, 13790],
  ['WB-24106', '2026-10-08', '07:36', 'GOKILA MANI 1', 'M05', 'TN 75 B 6233', 4720, 12070],
  ['WB-24105', '2026-10-08', '07:19', 'DKR 1', 'M07', 'TN 78 MA 6498', 4380, 11800],
  ['WB-24104', '2026-10-08', '07:13', 'PKV', 'M06', 'TN 78 AZ 6221', 4250, 12530],
  ['WB-24103', '2026-10-08', '06:30', 'RMS KUMAR', 'M06', 'TN 78 MA 1611', 4670, 12550],
  ['WB-24102', '2026-10-08', '06:19', 'LAKSHMI', 'M07', 'TN 88 U 1068', 4260, 11460],
  ['WB-24101', '2026-10-08', '04:55', 'SELVAMAYIL', 'M06', 'TN 42 0823', 7520, 23780],
  ['CR00005', '2026-08-22', '14:31', 'MANI V.MURUGAN', 'M07', 'TN19 9004', 4500, 10270],
  ['CR00004', '2026-08-22', '14:19', 'MANI V.MURUGAN', 'M03', 'TN74Q4709', 4650, 11820],
].map((r, i) => ({
  id: 'O' + i, ticket: r[0], date: r[1], time: r[2], custId: byName(r[3]), matId: r[4], matName: '', vehicle: r[5], dir: 'OUT',
  tare: r[6], gross: r[7], manualRate: '', method: 'Credit', status: 'Completed', reason: '', remarks: '', by: 'Murugan R',
}));

// Daily-wage workers, paid every Saturday. Sample week: Mon 5 – Wed 7 Oct marked; Thu 8 Oct left for staff to mark.
const emp = [
  ['Murugan R', 'Weighbridge operator', '98430 11902', 900],
  ['Selvam K', 'Driver', '99524 88210', 800],
  ['Bhaskar N', 'Loading supervisor', '90031 74558', 850],
  ['Kumar S', 'Driver', '97865 20913', 800],
  ['Ravi T', 'JCB operator', '95001 66284', 1000],
  ['Dinesh V', 'Helper', '96775 39418', 600],
  ['Muthu P', 'Loader', '', 650],
  ['Raja M', 'Loader', '', 650],
].map((r, i) => ({
  id: 'E0' + (i + 1), code: 'EM-0' + (i + 1), name: r[0], role: r[1], phone: r[2], joined: '', wage: r[3], status: 'Active', remarks: '',
}));
const marks = {
  '2026-10-05': ['Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Absent'],
  '2026-10-06': ['Present', 'Present', 'Present', 'Half day', 'Present', 'Present', 'Present', 'Present'],
  '2026-10-07': ['Present', 'Absent', 'Present', 'Present', 'Present', 'Half day', 'Present', 'Present'],
};
const att = Object.entries(marks).flatMap(([date, list]) => list.map((status, i) => ({
  id: 'A' + date.slice(-2) + i, date, empId: emp[i].id, status, wage: emp[i].wage,
  remarks: status === 'Absent' ? 'Informed' : status === 'Half day' ? 'Left after lunch' : '', by: 'Murugan R',
})));
const adv = [
  { id: 'V01', date: '2026-09-26', time: '18:10', empId: 'E02', amount: 2000, mode: 'Cash', remarks: 'Medical', by: 'A. Gopalakrishnan' },
  { id: 'V02', date: '2026-10-06', time: '18:30', empId: 'E04', amount: 300, mode: 'Cash', remarks: '', by: 'A. Gopalakrishnan' },
  { id: 'V03', date: '2026-10-07', time: '18:20', empId: 'E07', amount: 200, mode: 'UPI', remarks: '', by: 'A. Gopalakrishnan' },
];
const pay = [];
const exp = [
  { id: 'X01', date: '2026-09-09', head: 'Diesel', desc: 'HSD 420 L — tipper fleet', type: 'Debit', amount: 39480, mode: 'Bank Transfer', party: 'Kaveri Fuels' },
  { id: 'X02', date: '2026-09-08', head: 'Vehicle repair', desc: 'Rear axle bushing TN 70 Z 3321', type: 'Debit', amount: 14200, mode: 'Cash', party: 'Sakthi Auto Works' },
  { id: 'X03', date: '2026-09-08', head: 'Quarry royalty', desc: 'Seigniorage — Aug lifting', type: 'Debit', amount: 86000, mode: 'Bank Transfer', party: 'Dept. of Geology' },
  { id: 'X04', date: '2026-09-07', head: 'Scrap sale', desc: 'Worn conveyor belting', type: 'Credit', amount: 9600, mode: 'UPI', party: 'Metro Scrap' },
  { id: 'X05', date: '2026-09-07', head: 'Weighbridge AMC', desc: 'Quarterly calibration', type: 'Debit', amount: 7500, mode: 'UPI', party: 'Avery Service' },
  { id: 'X06', date: '2026-09-06', head: 'Loading labour', desc: 'Weekly wages — 6 hands', type: 'Debit', amount: 18900, mode: 'Cash', party: 'Bhaskar N' },
  { id: 'X07', date: '2026-09-05', head: 'Electricity', desc: 'Crusher unit — Aug', type: 'Debit', amount: 62400, mode: 'Bank Transfer', party: 'TANGEDCO' },
  { id: 'X08', date: '2026-09-04', head: 'Insurance claim', desc: 'Settled — KA 05 AH 9087', type: 'Credit', amount: 24500, mode: 'Bank Transfer', party: 'United India' }
];


// Vehicles holding a tare weight on the bridge.
const onsite = [
  { id: 'S1', ticket: 'WB-24113', vehicle: 'TN 78 MA 5806', custId: byName('SKS'), matId: 'M02', tare: 4320, load: 9470, inAt: '10:42', method: 'Credit' },
  { id: 'S2', ticket: 'WB-24114', vehicle: 'TN 78 AZ 6221', custId: byName('PKV'), matId: 'M06', tare: 4250, load: 8280, inAt: '11:15', method: 'Credit' },
];

// Walk-in sales from the 8 Oct register, paid in cash or into the company account ("ACC P"), with the round-off given.
const walkIns = [
  ['WB-24115', '06:59', 'ANNAI', 'M06', 'TN 69 BF 3916', 4390, 8010, 'Cash', 3600, 20],
  ['WB-24116', '07:55', 'MAYIL', 'M07', 'TN 78 R 7626', 4580, 8120, 'Account', 3890, 4],
  ['WB-24117', '08:38', 'TATA ACE', 'M06', 'TN 39 CK 6013', 1770, 3370, 'Cash', 1600, 0],
];
walkIns.forEach((w, i) => {
  ord.push({
    id: 'OW' + i, ticket: w[0], date: '2026-10-08', time: w[1], custId: '', walkIn: w[2], matId: w[3], matName: '', vehicle: w[4], dir: 'OUT',
    tare: w[5], gross: w[6], manualRate: '', method: w[7], roundOff: w[9], status: 'Completed', reason: '', remarks: '', by: 'Murugan R',
  });
});
const payments = walkIns.map((w, i) => ({
  id: 'YW' + i, date: '2026-10-08', time: w[1], ticketId: 'OW' + i, custId: '', walkIn: w[2], method: w[7], amount: w[8],
  toType: 'company', supplierId: '', toName: '', remarks: '', by: 'Murugan R',
}));

// Soling (boulder) loads from the 22 Aug register. Soling trucks come in loaded, so the register's
// "Gross" column is the empty truck and its "Net" column the loaded weight: net = Net − Gross.
const purchases = [
  ['CR00001', '13:46', 'SKK KARTHI', 'TN28BJ1481', 13110, 28680],
  ['CR00007', '14:36', 'SARAVANABAVA', 'TN41BD1599', 17300, 48860],
  ['CR00010', '14:51', 'SR', 'TN85L2226', 16860, 47570],
].map((r, i) => ({
  id: 'U' + i, serial: r[0], date: '2026-08-22', time: r[1], supplierId: suppliers.find((p) => p.name === r[2]).id, regName: r[2],
  vehicle: r[3], tare: r[4], gross: r[5], manualRate: '', extra: '', batchId: '', remarks: '', by: 'System',
}));

// Sample soling rates (₹ per ton) so the ledger has values — replace them with the agreed rates.
const solRates = suppliers.map((p, i) => ({
  id: 'SR' + i, supplierId: p.id, rate: [380, 400, 390][i], from: '2026-08-01', to: '', remarks: 'Sample rate — change to the agreed rate', by: 'System',
}));

// Soling loads stored before Module 3 kept the register columns as they were (tare 0, gross, net).
const normalSoling = (u) => {
  if (!('net' in u)) return u;
  const { net, amount, ...rest } = u;
  return { manualRate: '', extra: '', ...rest, tare: +u.gross || 0, gross: +net || 0 };
};

export const SEED_NEXT_TICKET = 24118;

export function seedDb() {
  return JSON.parse(JSON.stringify({
    customers: cust, suppliers, materials: mats, rates, orders: ord, payments, purchases, solRates, supPayments: [], staging: [], imports: [], voided: [],
    employees: emp, attendance: att, advances: adv, payroll: pay, onsite,
    expenses: exp.map((x) => ({ time: '', headOther: '', ...x, mode: x.mode === 'Bank Transfer' ? 'Account' : x.mode, head: x.head === 'Electricity' ? 'Electricity (EB)' : x.head })),
    settings: { cashStart: 0, bankStart: 0, startDate: '' },
  }));
}

// Workers, attendance, advances and salaries on their own, for replacing the old monthly-salary demo records.
export function peopleSeed() {
  return JSON.parse(JSON.stringify({ employees: emp, attendance: att, advances: adv, payroll: pay }));
}

// Fills in collections added after a browser first saved its data, so older saves keep working.
export function upgradeDb(saved) {
  const db = { payments: [], purchases: [], staging: [], imports: [], suppliers: [], voided: [], supPayments: [], ...saved };
  if (!db.solRates) db.solRates = JSON.parse(JSON.stringify(solRates));
  db.purchases = db.purchases.map(normalSoling);
  // Saves from before daily wages held demo monthly salaries; start them on the daily-wage sample instead.
  if (!(db.employees || []).some((e) => 'wage' in e)) Object.assign(db, peopleSeed());
  if (!db.settings) db.settings = { cashStart: 0, bankStart: 0, startDate: '' };
  db.expenses = (db.expenses || []).map((x) => ({ time: '', headOther: '', ...x, mode: x.mode === 'Bank Transfer' ? 'Account' : x.mode, head: x.head === 'Electricity' ? 'Electricity (EB)' : x.head }));
  db.voided = db.voided.map((e) => (e.records && e.records.purchases ? { ...e, records: { ...e.records, purchases: e.records.purchases.map(normalSoling) } } : e));
  // Older saves kept a party's receipts as one running total; turn it into a receipt record so it shows in payment history.
  const receipts = [];
  db.customers = db.customers.map((c) => {
    if (!(+c.received > 0)) return c;
    receipts.push({
      id: 'YR-' + c.id, date: c.last && c.last !== '—' ? c.last : '2026-10-01', time: '00:00', ticketId: '', custId: c.id, walkIn: '',
      method: 'Cash', amount: +c.received, toType: 'company', supplierId: '', toName: '', ref: 'Earlier receipts', remarks: 'Carried over from the earlier total', by: 'System',
    });
    return { ...c, received: 0 };
  });
  return { ...db, payments: db.payments.concat(receipts) };
}
