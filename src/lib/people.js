import { isoDate } from './format';

// Daily-wage workers paid weekly on Saturday. A pay week is the seven days ending on a Saturday
// (work on a Sunday counts toward the following Saturday).
// Advances are recovered from salary: this week's advances in full, older advance as staff choose.

export const MARKS = ['Present', 'Half day', 'Absent'];
export const MARK_SHORT = { Present: 'P', 'Half day': '½', Absent: 'A' };

export const addDays = (iso, n) => {
  const t = new Date(iso + 'T00:00:00');
  t.setDate(t.getDate() + n);
  return isoDate(t);
};
export const weekEndOf = (iso) => addDays(iso, (6 - new Date(iso + 'T00:00:00').getDay() + 7) % 7);
export const weekDays = (weekEnd) => [-6, -5, -4, -3, -2, -1, 0].map((n) => addDays(weekEnd, n));
export const dayName = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
export const shortDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const dayCount = (a) => (a.status === 'Present' ? 1 : a.status === 'Half day' ? 0.5 : 0);
export const dayPay = (a) => dayCount(a) * (+a.wage || 0);
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
const cuts = (p) => (+p.cutWeek || 0) + (+p.cutOld || 0);

export function createPeople(db) {
  const emps = db.employees || [];
  const att = db.attendance || [];
  const adv = db.advances || [];
  const pay = db.payroll || [];
  const emp = (id) => emps.find((e) => e.id === id) || { id, name: '—', wage: 0 };

  // Everything advanced minus everything recovered from salaries.
  const advanceDue = (empId) => sum(adv.filter((a) => a.empId === empId), (a) => +a.amount || 0) - sum(pay.filter((p) => p.empId === empId), cuts);
  const advancesOn = (empId, date) => adv.filter((a) => a.empId === empId && a.date === date);

  const weekLine = (e, weekEnd) => {
    const days = weekDays(weekEnd);
    const start = days[0];
    const marks = att.filter((a) => a.empId === e.id && a.date >= start && a.date <= weekEnd);
    const weekAdvList = adv.filter((a) => a.empId === e.id && a.date >= start && a.date <= weekEnd);
    const weekAdv = sum(weekAdvList, (a) => +a.amount || 0);
    const before = sum(adv.filter((a) => a.empId === e.id && a.date < start), (a) => +a.amount || 0)
      - sum(pay.filter((p) => p.empId === e.id && p.weekEnd < weekEnd), cuts);
    return {
      emp: e, weekEnd, days,
      marks: Object.fromEntries(marks.map((m) => [m.date, m])),
      worked: sum(marks, dayCount),
      earned: sum(marks, dayPay),
      weekAdv, weekAdvList,
      oldDue: Math.max(0, before),
      paid: pay.find((p) => p.empId === e.id && p.weekEnd === weekEnd) || null,
    };
  };

  // What a salary payment takes off: this week's advances first (up to what was earned), then the older advance staff chose.
  const settle = (line, recover) => {
    const cutWeek = Math.min(line.weekAdv, line.earned);
    const roomOld = line.oldDue + (line.weekAdv - cutWeek);
    const cutOld = Math.max(0, Math.min(+recover || 0, roomOld, line.earned - cutWeek));
    return { cutWeek, cutOld, net: line.earned - cutWeek - cutOld };
  };

  // Workers shown for a week: active ones, plus anyone who worked, borrowed or was paid that week.
  const weekLines = (weekEnd) => emps
    .map((e) => weekLine(e, weekEnd))
    .filter((l) => l.emp.status !== 'Left' || l.worked || l.weekAdv || l.paid);

  const dueFor = (weekEnd) => sum(weekLines(weekEnd).filter((l) => !l.paid), (l) => settle(l, 0).net);

  return { emp, advanceDue, advancesOn, weekLine, weekLines, settle, dueFor };
}
