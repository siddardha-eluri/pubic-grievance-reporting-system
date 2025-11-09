export enum GrievanceStatus {
  FILED = 'Complaint Filed',
  UNDER_REVIEW = 'Under Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

export interface Grievance {
  id: string;
  complainantName: string;
  complainantEmail: string;
  dateFiled: string;
  organization: string;
  description: string;
  status: GrievanceStatus;
  documents: { name: string; content: string }[];
  aiSolution?: string;
  history: { status: GrievanceStatus, date: string, notes: string, rejectionReason?: string }[];
  location?: { latitude: number; longitude: number; };
}

export enum UserRole {
  CITIZEN = 'Citizen',
  ADMIN = 'Admin'
}

export interface User {
  name: string;
  email: string;
  role: UserRole;
  department?: string; // For admins
  phone?: string; // For citizens
  password?: string; // For admins
  misuseStrikes?: number;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}