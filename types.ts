export enum UserRole {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isMaster: boolean;
  eventId?: string;
  photoUrl?: string;
}

export interface OrganizerCompany {
  id: string;
  name: string;
  responsibleName: string;
  responsibleContact: string;
  responsiblePhone?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  details: string;
  logoUrl: string;
  organizerCompanyId: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  name: string;
  eventId: string;
}

export interface Staff {
  id: string;
  name: string;
  personalCode: string;
  organizerCompanyId: string;
  phone?: string;
  photoUrl?: string;
  departmentId?: string;
  role?: string;
}

export interface ParticipantCompany {
  id: string;
  name: string;
  boothCode: string;
  eventId: string;
  responsible: string;
  contact: string;
  responsiblePhone?: string;
  buttonIds: string[];
  logoUrl?: string;
}

export enum ReportType {
  OPEN_TEXT = 'open_text',
  MULTIPLE_CHOICE = 'multiple_choice',
  YES_NO = 'yes_no',
  CHECKLIST = 'checklist',
  NOTIFY_CALL = 'notify_call',
}

export interface ReportOption {
  id: string;
  label: string;
}

export interface FollowUpConfig {
  triggerValue: 'Sim' | 'Não';
  question: string;
  type: ReportType.OPEN_TEXT | ReportType.MULTIPLE_CHOICE;
  options?: ReportOption[];
}

export interface ReportButtonConfig {
  id: string;
  label: string;
  question: string;
  type: ReportType;
  options?: ReportOption[];
  followUp?: FollowUpConfig;
  departmentId?: string;
  staffId?: string;
  allowedStaffIds?: string[];
}

export interface ReportSubmission {
  id: string;
  eventId: string;
  boothCode: string;
  staffName: string;
  reportLabel: string;
  response: string;
  timestamp: string;
}

export interface StaffActivity {
    id: string;
    staffId: string;
    description: string;
    timestamp: string;
}