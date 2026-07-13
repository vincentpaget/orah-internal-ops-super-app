'use client';

import { useState } from 'react';
import {
  SUPERVISE_TIER_PRICES,
  BOARDING_TIER_PRICES,
  ADDON_PRICES,
  CURRENCIES,
  type Currency,
} from '@/lib/pricing-migration/data/pricelist';

// ---- Feature matrix data (derived from feature-claims.ts structure) ----

type SuperviseTier = 'Basic' | 'Pro' | 'Elite';
type BoardingTier = 'Core' | 'Pro';

interface FeatureRow {
  name: string;
  group: string;
  supervise: Record<SuperviseTier, boolean>;
  boarding: Record<BoardingTier, boolean>;
  addons: {
    boardingAddon: boolean;
    nurture: boolean;
    autoAttendance: boolean;
    dismissals: boolean;
    openApi: boolean;
  };
}

const FEATURE_GROUPS: { group: string; features: FeatureRow[] }[] = [
  {
    group: 'Core',
    features: [
      { name: 'Student App',           group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Parent App',            group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Smart Groups',          group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Custom Branding',       group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Student Profiles',      group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Attendance Dashboard',  group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Homeboard',             group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'SIS Integration',       group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Reports & Dashboards',  group: 'Core', supervise: { Basic: true,  Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Attendance & Location',
    features: [
      { name: 'Attendance Overview',          group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Contact Information Table',    group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Location Overview',            group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Location Manager',             group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Student Check Ins',            group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Daily Roll Checks',            group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Live Rolls',                   group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Scheduled Rolls',              group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: false, Pro: false }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Schedule View',                group: 'Attendance & Location', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Automated Attendance',         group: 'Attendance & Location', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: false }, addons: { boardingAddon: false, nurture: false, autoAttendance: true,  dismissals: false, openApi: false } },
      { name: 'Automated Rolls',              group: 'Attendance & Location', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: false }, addons: { boardingAddon: false, nurture: false, autoAttendance: true,  dismissals: false, openApi: false } },
      { name: 'Dismissals',                   group: 'Attendance & Location', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: false }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: true,  openApi: false } },
    ],
  },
  {
    group: 'Passes',
    features: [
      { name: 'Basic Passes',           group: 'Passes', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Advanced Passes',        group: 'Passes', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pass Requests',          group: 'Passes', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pass Verification',      group: 'Passes', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'In-Transit Tracking',    group: 'Passes', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Hardware',
    features: [
      { name: 'NFC Tiles',                  group: 'Hardware', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Checkpoint Kiosk App',       group: 'Hardware', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'NFC/RFID Scanner Integration', group: 'Hardware', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Events',
    features: [
      { name: 'Student Informed Event',  group: 'Events', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'School Informed Events',  group: 'Events', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Event Quotas',            group: 'Events', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Event Reminders',         group: 'Events', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Communications',
    features: [
      { name: 'Broadcast',                 group: 'Communications', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Messages',                  group: 'Communications', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Communications Monitor',    group: 'Communications', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'SMS Alerts',               group: 'Communications', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Emergency',
    features: [
      { name: 'Emergency Roll',            group: 'Emergency', supervise: { Basic: false, Pro: false, Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Custom Emergency Alerts',   group: 'Emergency', supervise: { Basic: false, Pro: false, Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Student Emergency Response',group: 'Emergency', supervise: { Basic: false, Pro: false, Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Pastoral & Wellbeing',
    features: [
      { name: 'Activity Feed',                  group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Activity Posts',                 group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Catering Tallied',               group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Location Restrictions (Gating)', group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Request Fraud Detection',        group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pastoral Student Profile',       group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pastoral Notes',                 group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Watchlist Tags',                 group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pastoral Summary',               group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pastoral AI Summary',            group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: true,  nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Pastoral Points',                group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Mood Checks',                    group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Student Support',                group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Conversational Survey',          group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Personalised Messages',          group: 'Pastoral & Wellbeing', supervise: { Basic: false, Pro: false, Elite: false }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: true,  autoAttendance: false, dismissals: false, openApi: false } },
    ],
  },
  {
    group: 'Platform',
    features: [
      { name: 'Single Sign On',           group: 'Platform', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Magnus Health Integration',group: 'Platform', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Refactored My Schedule',   group: 'Platform', supervise: { Basic: false, Pro: true,  Elite: true  }, boarding: { Core: true,  Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Medication',               group: 'Platform', supervise: { Basic: false, Pro: false, Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: false } },
      { name: 'Open API Access',          group: 'Platform', supervise: { Basic: false, Pro: false, Elite: true  }, boarding: { Core: false, Pro: true  }, addons: { boardingAddon: false, nurture: false, autoAttendance: false, dismissals: false, openApi: true  } },
    ],
  },
];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', GBP: '£', AUD: 'A$', NZD: 'NZ$', EUR: '€', CAD: 'C$',
};

function fmt(currency: Currency, amount: number) {
  return `${CURRENCY_SYMBOLS[currency]}${amount.toLocaleString()}`;
}

function Check() {
  return <span className="text-green-600 text-base">✓</span>;
}
function Dash() {
  return <span className="text-gray-300 text-base">—</span>;
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<Currency>('USD');

  const SUPERVISE_COLS: SuperviseTier[] = ['Basic', 'Pro', 'Elite'];
  const BOARDING_COLS: BoardingTier[] = ['Core', 'Pro'];
  const ADDON_COLS: (keyof FeatureRow['addons'])[] = ['boardingAddon', 'nurture', 'autoAttendance', 'dismissals', 'openApi'];
  const ADDON_LABELS: Record<string, string> = {
    boardingAddon: 'Boarding Add-on',
    nurture: 'Nurture Add-on',
    autoAttendance: 'Auto Attendance Add-on',
    dismissals: 'Dismissals Add-on',
    openApi: 'Open API Add-on',
  };

  return (
    <div className="px-8 py-6 space-y-8">

      {/* Page header + currency switcher */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pricing Model</h1>
          <p className="text-sm text-gray-500 mt-0.5">New tier structure, feature flags, and add-on pricing</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Currency</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {CURRENCIES.map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  currency === c
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tier price cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Supervise */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
            <h2 className="text-sm font-semibold text-blue-900">Supervise Platform</h2>
            <p className="text-xs text-blue-700 mt-0.5">Per student / per year</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {SUPERVISE_COLS.map(tier => (
              <div key={tier} className="px-4 py-5 text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{tier}</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(currency, SUPERVISE_TIER_PRICES[tier][currency])}</div>
                <div className="text-xs text-gray-400 mt-0.5">/ student / yr</div>
              </div>
            ))}
          </div>
        </div>

        {/* Boarding */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-purple-50">
            <h2 className="text-sm font-semibold text-purple-900">Boarding Platform</h2>
            <p className="text-xs text-purple-700 mt-0.5">Per boarder / per year</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {BOARDING_COLS.map(tier => (
              <div key={tier} className="px-4 py-5 text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{tier}</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(currency, BOARDING_TIER_PRICES[tier][currency])}</div>
                <div className="text-xs text-gray-400 mt-0.5">/ boarder / yr</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add-on cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add-ons</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { key: 'Boarding',            label: 'Boarding Students', unit: 'per student / yr', note: 'Supervise customers with boarding students' },
            { key: 'Nurture',             label: 'Nurture',           unit: 'per student / yr', note: 'Pastoral & wellbeing features' },
            { key: 'AutomatedAttendance', label: 'Auto Attendance',   unit: 'per student / yr', note: 'Automated roll-marking & attendance' },
            { key: 'Dismissals',          label: 'Dismissals',        unit: 'per student / yr', note: 'Dismissal tracking & management' },
            { key: 'OpenAPI',             label: 'Open API',          unit: 'flat fee / yr',    note: 'API access for integrations' },
          ].map(({ key, label, unit, note }) => {
            const price = ADDON_PRICES[key as keyof typeof ADDON_PRICES][currency];
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</div>
                <div className="text-xl font-bold text-gray-900">{fmt(currency, price)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{unit}</div>
                <div className="text-xs text-gray-500 mt-2 leading-snug">{note}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature flag matrix */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Feature Matrix</h2>
        <div className="rounded-xl border border-gray-200 overflow-auto bg-white" style={{ maxHeight: '65vh' }}>
          <table className="w-full text-xs">
            <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-52 sticky left-0 bg-white" style={{ zIndex: 30 }}>Feature</th>
                {/* Supervise header */}
                <th colSpan={3} className="text-center px-2 py-2 font-semibold text-blue-700 border-l border-gray-100 bg-blue-50">
                  Supervise
                </th>
                {/* Boarding header */}
                <th colSpan={2} className="text-center px-2 py-2 font-semibold text-purple-700 border-l border-gray-100 bg-purple-50">
                  Boarding
                </th>
                {/* Add-ons header */}
                <th colSpan={5} className="text-center px-2 py-2 font-semibold text-gray-700 border-l border-gray-100 bg-gray-50">
                  Add-ons
                </th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="sticky left-0 bg-gray-50" style={{ zIndex: 30 }} />
                {/* Supervise tiers */}
                {SUPERVISE_COLS.map(t => (
                  <th key={t} className="text-center px-3 py-2 font-medium text-gray-600 border-l border-gray-100 first:border-l-0">
                    {t}
                  </th>
                ))}
                {/* Boarding tiers */}
                {BOARDING_COLS.map(t => (
                  <th key={t} className="text-center px-3 py-2 font-medium text-gray-600 border-l border-gray-100">
                    {t}
                  </th>
                ))}
                {/* Add-on columns */}
                {ADDON_COLS.map(k => (
                  <th key={k} className="text-center px-3 py-2 font-medium text-gray-600 border-l border-gray-100 max-w-20 leading-tight">
                    {ADDON_LABELS[k].replace(' Add-on', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_GROUPS.map(({ group, features }) => (
                <>
                  <tr key={group} className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={11} className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">
                      {group}
                    </td>
                  </tr>
                  {features.map((f, i) => (
                    <tr key={f.name} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-2 text-gray-700 sticky left-0 bg-inherit z-10">{f.name}</td>
                      {SUPERVISE_COLS.map(t => (
                        <td key={t} className="text-center px-3 py-2 border-l border-gray-100">
                          {f.supervise[t] ? <Check /> : <Dash />}
                        </td>
                      ))}
                      {BOARDING_COLS.map(t => (
                        <td key={t} className="text-center px-3 py-2 border-l border-gray-100">
                          {f.boarding[t] ? <Check /> : <Dash />}
                        </td>
                      ))}
                      {ADDON_COLS.map(k => (
                        <td key={k} className="text-center px-3 py-2 border-l border-gray-100">
                          {f.addons[k] ? <Check /> : <Dash />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
