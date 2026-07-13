// Source: Pricing Migration.xlsx — Feature Claim Assignment sheet
// Maps each product/tier to the set of feature claims it includes.
// A claim is "covered" if any of the customer's active products includes it.

export type Product =
  | 'Supervise Basic'
  | 'Supervise Pro'
  | 'Supervise Elite'
  | 'Add-on: Boarding Students'
  | 'Boarding Core'
  | 'Boarding Pro'
  | 'Add-on: Nurture'
  | 'Add-on: Auto Attendance'
  | 'Add-on: Dismissals'
  | 'Add-on: Open API';

// Claims that are being sunset — surface for visibility but never treat as gaps
export const SUNSETTING_CLAIMS = new Set(['form_builder', 'workflow', 'contact_tracing']);

// Raw data: each entry is [featureCode, ...products that include it (1 = included)]
// Columns order matches the sheet: Basic, Pro, Elite, Boarding Add-on, Boarding Core, Boarding Pro, Nurture Add-on, Auto Attendance Add-on, Dismissals Add-on, Open API Add-on
type ClaimRow = {
  code: string;
  name: string;
  basic: boolean;
  pro: boolean;
  elite: boolean;
  boardingAddon: boolean;
  boardingCore: boolean;
  boardingPro: boolean;
  nurtureAddon: boolean;
  autoAttendanceAddon: boolean;
  dismissalsAddon: boolean;
  openApiAddon: boolean;
};

const CLAIM_ROWS: ClaimRow[] = [
  { code: 'student_app',                   name: 'Student App',                      basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'parent_app',                    name: 'Parent App',                       basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'smart_groups',                  name: 'Smart Groups',                     basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'custom_branding',               name: 'Custom Branding',                  basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'student_profiles',              name: 'Student Profiles',                 basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'attendance_dashboard',          name: 'Attendance Dashboard',             basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'homeboard',                     name: 'Homeboard',                        basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'sis_integration',               name: 'SIS Integration',                  basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'reports_dashboards',            name: 'Reports and Dashboards',           basic: true,  pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'attendance_overview',           name: 'Attendance Overview',              basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'contact_information_table',     name: 'Contact Information Table',        basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'location_overview',             name: 'Location Overview',                basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'location_manager',             name: 'Location Manager',                  basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'check_ins',                     name: 'Student Check Ins',                basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'daily_roll',                    name: 'Daily Roll Checks',                basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'live_roll',                     name: 'Live Rolls',                       basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'basic_pass',                    name: 'Basic Passes',                     basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'advance_pass',                  name: 'Advanced Passes',                  basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pass_request',                  name: 'Pass Requests',                    basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pass_verification',             name: 'Student Pass Verification',        basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'in_transit_tracking',           name: 'In-Transit Tracking',              basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'nfc_tiles',                     name: 'NFC Tiles',                        basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'checkpoint_kiosk',              name: 'Checkpoint Kiosk App',             basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'nfc_scanner',                   name: 'NFC/RFID scanner integration',     basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'student_event',                 name: 'Student Informed Event',           basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'school_event',                  name: 'School Informed Events',           basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'event_quota',                   name: 'Event Quotas',                     basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'event_reminder',                name: 'Event Reminders',                  basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'sso',                           name: 'Single Sign On',                   basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'scheduled_rolls',               name: 'Scheduled Rolls',                  basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'refactored_my_schedule',        name: 'Refactored My Schedule',           basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'health_integration',            name: 'Magnus Health Integration',        basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'sms_alerts',                    name: 'SMS Alerts',                       basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'schedule_view',                 name: 'Schedule View',                    basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'emergency_roll',                name: 'Emergency Roll',                   basic: false, pro: false, elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'emergency_custom_alert',        name: 'Custom Emergency Alerts',          basic: false, pro: false, elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'emergency_student_response',    name: 'Student Emergency Response',       basic: false, pro: false, elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'broadcast',                     name: 'Broadcast',                        basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'messages',                      name: 'Messages',                         basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'communications_monitor',        name: 'Communications Monitor',           basic: false, pro: true,  elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'open_api',                      name: 'Open API Access',                  basic: false, pro: false, elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: true  },
  { code: 'medication',                    name: 'Medication',                      basic: false, pro: false, elite: true,  boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'activity_feed',                 name: 'Activity Feed',                    basic: false, pro: true,  elite: true,  boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'activity_post',                 name: 'Activity Posts',                   basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'meal_board',                    name: 'Catering Tallied',                 basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'location_restrictions',         name: 'Location Restrictions (Gating)',   basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'request_fraud_detection',       name: 'Request fraud detection',          basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pastoral_student_profile',      name: 'Pastoral Student Profile',         basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pastoral_notes',                name: 'Pastoral Notes',                   basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'watchlist_tags',                name: 'Watchlist Tags',                   basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pastoral_summary',              name: 'Pastoral summary',                 basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pastoral_ai_generated_summary', name: 'Pastoral AI Generated Summary',    basic: false, pro: false, elite: false, boardingAddon: true,  boardingCore: true,  boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'pastoral_points',               name: 'Pastoral points',                  basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'mood_checks',                   name: 'Mood Checks',                      basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'student_support',               name: 'Student support',                  basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'conversational_survey',         name: 'Conversational Survey',            basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'personalised_responses',        name: 'Personalised Messages',            basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: true,  nurtureAddon: true,  autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'automated_attendance',          name: 'Automated Attendance',             basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: true,  dismissalsAddon: false, openApiAddon: false },
  { code: 'automated_roll',                name: 'Automated Rolls',                  basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: true,  dismissalsAddon: false, openApiAddon: false },
  { code: 'dismissals',                    name: 'Dismissals',                       basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: true,  openApiAddon: false },
  // Sunsetting claims — included for completeness but excluded from gap analysis
  { code: 'form_builder',                  name: 'Form Builder (sunsetting)',        basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'workflow',                      name: 'Workflow Builder (sunsetting)',     basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
  { code: 'contact_tracing',               name: 'Contact Tracing (sunsetting)',     basic: false, pro: false, elite: false, boardingAddon: false, boardingCore: false, boardingPro: false, nurtureAddon: false, autoAttendanceAddon: false, dismissalsAddon: false, openApiAddon: false },
];

export interface ActiveProducts {
  superviseTier?: 'Basic' | 'Pro' | 'Elite';
  boardingTier?: 'Core' | 'Pro';
  hasNurtureAddon: boolean;
  hasBoardingAddon: boolean;
  hasAutoAttendanceAddon: boolean;
  hasDismissalsAddon: boolean;
  hasOpenApiAddon: boolean;
}

export function getNewAllowedClaims(products: ActiveProducts): Set<string> {
  const allowed = new Set<string>();
  for (const row of CLAIM_ROWS) {
    if (SUNSETTING_CLAIMS.has(row.code)) continue;
    if (products.superviseTier === 'Basic' && row.basic) allowed.add(row.code);
    if (products.superviseTier === 'Pro' && (row.basic || row.pro)) allowed.add(row.code);
    if (products.superviseTier === 'Elite' && (row.basic || row.pro || row.elite)) allowed.add(row.code);
    if (products.boardingTier === 'Core' && row.boardingCore) allowed.add(row.code);
    if (products.boardingTier === 'Pro' && (row.boardingCore || row.boardingPro)) allowed.add(row.code);
    if (products.hasBoardingAddon && row.boardingAddon) allowed.add(row.code);
    if (products.hasNurtureAddon && row.nurtureAddon) allowed.add(row.code);
    if (products.hasAutoAttendanceAddon && row.autoAttendanceAddon) allowed.add(row.code);
    if (products.hasDismissalsAddon && row.dismissalsAddon) allowed.add(row.code);
    if (products.hasOpenApiAddon && row.openApiAddon) allowed.add(row.code);
  }
  return allowed;
}

export function getClaimName(code: string): string {
  return CLAIM_ROWS.find(r => r.code === code)?.name ?? code;
}
