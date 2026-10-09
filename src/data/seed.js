// Seed records for the yard: accounts, products, rate cards, tickets, staff and ledger entries.

const cust = [
  { id: 'C01', code: 'CU-1041', name: 'Sree Constructions', city: 'Hosur', phone: '98430 22417', gst: '33AAECS1234K1Z9', limit: 500000, invoiced: 1284500, received: 1066100, last: '2026-09-04', status: 'Active' },
  { id: 'C02', code: 'CU-1042', name: 'L&T Site 4', city: 'Krishnagiri', phone: '99406 71180', gst: '33AAACL0140P1ZQ', limit: 1200000, invoiced: 3162000, received: 2697000, last: '2026-09-07', status: 'Active' },
  { id: 'C03', code: 'CU-1043', name: 'Nandi Infra', city: 'Bengaluru', phone: '90080 44512', gst: '29AAFCN9921R1ZK', limit: 300000, invoiced: 742000, received: 742000, last: '2026-09-01', status: 'Active' },
  { id: 'C04', code: 'CU-1044', name: 'Raghav Builders', city: 'Dharmapuri', phone: '94434 90271', gst: '33AAGFR5510M1Z2', limit: 250000, invoiced: 588400, received: 495650, last: '2026-08-22', status: 'On hold' },
  { id: 'C05', code: 'CU-1045', name: 'VRS Ready Mix', city: 'Hosur', phone: '98942 13360', gst: '33AABCV7781L1ZH', limit: 800000, invoiced: 2410800, received: 2069600, last: '2026-09-06', status: 'Active' },
  { id: 'C06', code: 'CU-1046', name: 'Ambica Concrete', city: 'Salem', phone: '97910 55842', gst: '33AACCA3345D1ZP', limit: 400000, invoiced: 906300, received: 848300, last: '2026-09-05', status: 'Active' }
];
const mats = [
  { id: 'M01', code: 'MT-20J', name: '20mm Jelly', unit: 'Tonne', rate: 680, stock: 1840, status: 'Active' },
  { id: 'M02', code: 'MT-12J', name: '12mm Jelly', unit: 'Tonne', rate: 720, stock: 960, status: 'Active' },
  { id: 'M03', code: 'MT-40B', name: '40mm Blue Metal', unit: 'Tonne', rate: 610, stock: 2410, status: 'Active' },
  { id: 'M04', code: 'MT-MSD', name: 'M-Sand', unit: 'Tonne', rate: 950, stock: 640, status: 'Active' },
  { id: 'M05', code: 'MT-PSD', name: 'P-Sand', unit: 'Tonne', rate: 1010, stock: 285, status: 'Active' },
  { id: 'M06', code: 'MT-QDT', name: 'Quarry Dust', unit: 'Tonne', rate: 340, stock: 3120, status: 'Active' },
  { id: 'M07', code: 'MT-GSB', name: 'GSB Grade 1', unit: 'Tonne', rate: 520, stock: 1275, status: 'Active' },
  { id: 'M08', code: 'MT-WMM', name: 'WMM', unit: 'Tonne', rate: 560, stock: 0, status: 'Paused' }
];
const rates = [
  { id: 'R01', custId: 'C02', matId: 'M01', rate: 648, from: '2026-07-01', by: 'A. Gopalakrishnan' },
  { id: 'R02', custId: 'C02', matId: 'M03', rate: 582, from: '2026-07-01', by: 'A. Gopalakrishnan' },
  { id: 'R03', custId: 'C05', matId: 'M04', rate: 905, from: '2026-08-01', by: 'A. Gopalakrishnan' },
  { id: 'R04', custId: 'C05', matId: 'M01', rate: 662, from: '2026-08-01', by: 'Anitha P' },
  { id: 'R05', custId: 'C01', matId: 'M06', rate: 315, from: '2026-06-15', by: 'Anitha P' },
  { id: 'R06', custId: 'C03', matId: 'M02', rate: 735, from: '2026-09-01', by: 'A. Gopalakrishnan' },
  { id: 'R07', custId: 'C06', matId: 'M07', rate: 498, from: '2026-08-18', by: 'Anitha P' }
];
const ord = [
  ['WB-24118', '2026-09-09', 'C02', 'M01', 'TN 29 BX 4412', 'OUT', 14180, 32460, 'Credit', 'Completed'],
  ['WB-24117', '2026-09-09', 'C05', 'M04', 'KA 05 AH 9087', 'OUT', 12920, 29140, 'UPI', 'Completed'],
  ['WB-24116', '2026-09-09', 'C01', 'M06', 'TN 70 Z 3321', 'OUT', 13640, 34980, 'Cash', 'Completed'],
  ['WB-24115', '2026-09-09', 'C06', 'M07', 'TN 29 CD 7756', 'OUT', 14020, 31880, 'Credit', 'In Transit'],
  ['WB-24114', '2026-09-08', 'C02', 'M03', 'AP 39 TB 1204', 'OUT', 14400, 35120, 'Credit', 'Completed'],
  ['WB-24113', '2026-09-08', 'C04', 'M01', 'TN 29 BX 4412', 'OUT', 14180, 30720, 'Credit', 'Void'],
  ['WB-24112', '2026-09-08', 'C03', 'M02', 'KA 05 AH 9087', 'OUT', 12920, 28640, 'Bank Transfer', 'Completed'],
  ['WB-24111', '2026-09-08', 'C05', 'M01', 'TN 70 Z 3321', 'OUT', 13640, 33260, 'Credit', 'Completed'],
  ['WB-24110', '2026-09-07', 'C01', 'M04', 'TN 29 CD 7756', 'OUT', 14020, 32900, 'Cash', 'Completed'],
  ['WB-24109', '2026-09-07', 'C02', 'M01', 'AP 39 TB 1204', 'OUT', 14400, 36180, 'Credit', 'Completed'],
  ['WB-24108', '2026-09-07', 'C06', 'M06', 'TN 29 BX 4412', 'OUT', 14180, 29980, 'UPI', 'Completed'],
  ['WB-24107', '2026-09-06', 'C05', 'M04', 'KA 05 AH 9087', 'OUT', 12920, 30240, 'Credit', 'Completed'],
  ['WB-24106', '2026-09-06', 'C04', 'M03', 'TN 70 Z 3321', 'OUT', 13640, 31460, 'Cash', 'Void'],
  ['WB-24105', '2026-09-05', 'C03', 'M07', 'TN 29 CD 7756', 'OUT', 14020, 33740, 'Bank Transfer', 'Completed'],
  ['WB-24104', '2026-09-05', 'C02', 'M01', 'AP 39 TB 1204', 'OUT', 14400, 37020, 'Credit', 'Completed'],
  ['WB-24103', '2026-09-04', 'C01', 'M02', 'TN 29 BX 4412', 'OUT', 14180, 32180, 'Credit', 'Completed']
].map((r, i) => ({
  id: 'O' + i, ticket: r[0], date: r[1], custId: r[2], matId: r[3], vehicle: r[4], dir: r[5],
  tare: r[6], gross: r[7], method: r[8], status: r[9],
  reason: r[9] === 'Void' ? (i === 5 ? 'Wrong material loaded' : 'Customer cancelled at gate') : '',
  by: 'Murugan R'
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

const onsite = [
  { id: 'S1', ticket: 'WB-24119', vehicle: 'TN 29 BX 4412', custId: 'C02', matId: 'M01', tare: 14180, load: 18620, inAt: '10:42' },
  { id: 'S2', ticket: 'WB-24120', vehicle: 'KA 05 AH 9087', custId: 'C05', matId: 'M04', tare: 12920, load: 16340, inAt: '11:15' }
];

export function seedDb() {
  return { customers: cust, materials: mats, rates, orders: ord, employees: emp, attendance: att, advances: adv, payroll: pay, expenses: exp, onsite };
}
