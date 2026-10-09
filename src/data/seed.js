// Seed records for the yard. Parties, materials, rates and tickets are taken from the 22 Aug and 8 Oct 2026 registers;
// staff, attendance, advances, payroll and expenses are demo entries.

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

const emp = [
  { id: 'E01', code: 'EM-01', name: 'Murugan R', role: 'Weighbridge Operator', phone: '98430 11902', joined: '2021-04-12', salary: 24000, status: 'Active' },
  { id: 'E02', code: 'EM-02', name: 'Selvam K', role: 'Driver', phone: '99524 88210', joined: '2022-01-08', salary: 21000, status: 'Active' },
  { id: 'E03', code: 'EM-03', name: 'Anitha P', role: 'Accounts', phone: '94879 30144', joined: '2020-11-02', salary: 28000, status: 'Active' },
  { id: 'E04', code: 'EM-04', name: 'Bhaskar N', role: 'Loading Supervisor', phone: '90031 74558', joined: '2019-06-20', salary: 26000, status: 'Active' },
  { id: 'E05', code: 'EM-05', name: 'Kumar S', role: 'Driver', phone: '97865 20913', joined: '2023-03-15', salary: 21000, status: 'Active' },
  { id: 'E06', code: 'EM-06', name: 'Jayanthi M', role: 'Front Office', phone: '98652 41027', joined: '2024-07-01', salary: 19000, status: 'Active' },
  { id: 'E07', code: 'EM-07', name: 'Ravi T', role: 'JCB Operator', phone: '95001 66284', joined: '2022-09-09', salary: 27000, status: 'On leave' },
  { id: 'E08', code: 'EM-08', name: 'Dinesh V', role: 'Driver', phone: '96775 39418', joined: '2025-02-17', salary: 21000, status: 'Active' }
];
const att = [
  ['2026-09-09', 'E01', 'Day A', '07:52', '18:10', 'Present', 2],
  ['2026-09-09', 'E02', 'Day A', '06:40', '17:05', 'Present', 1],
  ['2026-09-09', 'E03', 'General', '09:05', '18:00', 'Present', 0],
  ['2026-09-09', 'E04', 'Day A', '07:30', '19:20', 'Present', 3],
  ['2026-09-09', 'E05', 'Day A', '—', '—', 'Absent', 0],
  ['2026-09-09', 'E06', 'General', '09:15', '14:00', 'Half day', 0],
  ['2026-09-08', 'E01', 'Day A', '07:48', '18:02', 'Present', 2],
  ['2026-09-08', 'E02', 'Day A', '06:35', '18:40', 'Present', 2],
  ['2026-09-08', 'E04', 'Day A', '07:34', '17:50', 'Present', 0],
  ['2026-09-08', 'E07', 'Day B', '—', '—', 'Leave', 0],
  ['2026-09-08', 'E08', 'Day B', '13:00', '22:15', 'Present', 1]
].map((r, i) => ({ id: 'A' + i, date: r[0], empId: r[1], shift: r[2], in: r[3], out: r[4], status: r[5], ot: r[6] }));
const adv = [
  { id: 'V01', date: '2026-08-28', empId: 'E02', amount: 8000, reason: 'Medical', recovered: 4000, status: 'Recovering' },
  { id: 'V02', date: '2026-09-02', empId: 'E05', amount: 5000, reason: 'Festival', recovered: 0, status: 'Open' },
  { id: 'V03', date: '2026-07-14', empId: 'E04', amount: 12000, reason: 'House rent', recovered: 12000, status: 'Cleared' },
  { id: 'V04', date: '2026-09-06', empId: 'E08', amount: 3500, reason: 'Travel', recovered: 0, status: 'Open' },
  { id: 'V05', date: '2026-08-19', empId: 'E01', amount: 6000, reason: 'School fees', recovered: 2000, status: 'Recovering' }
];
const pay = [
  { id: 'P01', empId: 'E01', month: '2026-08', days: 26, ot: 14, status: 'Paid' },
  { id: 'P02', empId: 'E02', month: '2026-08', days: 24, ot: 22, status: 'Paid' },
  { id: 'P03', empId: 'E03', month: '2026-08', days: 26, ot: 0, status: 'Paid' },
  { id: 'P04', empId: 'E04', month: '2026-08', days: 25, ot: 18, status: 'Paid' },
  { id: 'P05', empId: 'E05', month: '2026-08', days: 22, ot: 6, status: 'Pending' },
  { id: 'P06', empId: 'E06', month: '2026-08', days: 23, ot: 0, status: 'Pending' },
  { id: 'P07', empId: 'E07', month: '2026-08', days: 18, ot: 0, status: 'Pending' },
  { id: 'P08', empId: 'E08', month: '2026-08', days: 26, ot: 11, status: 'Pending' }
];
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

export const SEED_NEXT_TICKET = 24115;

export function seedDb() {
  return JSON.parse(JSON.stringify({
    customers: cust, suppliers, materials: mats, rates, orders: ord, employees: emp, attendance: att, advances: adv, payroll: pay, expenses: exp, onsite,
  }));
}
