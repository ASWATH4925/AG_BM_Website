// Yard settings. Material is billed as net tons × rate per ton; staff add any GST or rent amount per load.
export const settings = {
  companyName: 'AG BlueMetals',
  liveScale: true,
};

import { isoDate } from './lib/format';

// The business day: today's date on this device, taken when the app opens.
export const TODAY = isoDate();
export const TODAY_LABEL = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const IDLE_SCALE_KG = 14180;
