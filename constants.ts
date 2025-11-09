import { Grievance, GrievanceStatus, User, UserRole } from './types';

export const DEPARTMENTS = [
  'Public Works Department',
  'Water Supply and Sanitation',
  'Electricity Board',
  'Municipal Corporation',
  'Transport Department',
  'Healthcare Services',
  'Education Department',
  'Law and Order',
];

export const MOCK_USER_CITIZEN: User = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  role: UserRole.CITIZEN,
  phone: '1234567890',
};

export const MOCK_USER_ADMIN: User = {
  name: 'Admin John Smith',
  email: 'john.smith@gov-pwd.com',
  role: UserRole.ADMIN,
  department: 'Public Works Department',
  password: 'admin123',
};

export const INITIAL_GRIEVANCES: Grievance[] = [
  {
    id: 'GRV001',
    complainantName: 'Alex Ray',
    complainantEmail: 'alex.ray@example.com',
    dateFiled: '2024-07-15',
    organization: 'Public Works Department',
    description: 'A large pothole on Main Street (near 12th Ave) has been present for over 3 weeks and is causing traffic issues and potential damage to vehicles. It needs immediate repair.',
    status: GrievanceStatus.FILED,
    documents: [{name: 'pothole_photo.jpg', content: 'base64-encoded-image-data'}],
    history: [
      { status: GrievanceStatus.FILED, date: '2024-07-15', notes: 'Grievance submitted by citizen.' }
    ],
  },
  {
    id: 'GRV002',
    complainantName: 'Maria Garcia',
    complainantEmail: 'maria.g@example.com',
    dateFiled: '2024-07-10',
    organization: 'Water Supply and Sanitation',
    description: 'Inconsistent water supply in the Greenfield area for the past week. The water pressure is extremely low, especially during morning hours.',
    status: GrievanceStatus.UNDER_REVIEW,
    documents: [],
    history: [
      { status: GrievanceStatus.FILED, date: '2024-07-10', notes: 'Grievance submitted.' },
      { status: GrievanceStatus.UNDER_REVIEW, date: '2024-07-11', notes: 'Assigned to engineer for investigation.' },
    ],
  },
    {
    id: 'GRV003',
    complainantName: 'Sam Wilson',
    complainantEmail: 'sam.w@example.com',
    dateFiled: '2024-06-20',
    organization: 'Electricity Board',
    description: 'Streetlight on corner of Oak and Pine has been out for a month. It is a safety concern for residents at night.',
    status: GrievanceStatus.APPROVED,
    documents: [],
    aiSolution: "Dispatch a maintenance crew to replace the faulty bulb and inspect the wiring of streetlight #ST-45B at the corner of Oak and Pine. Estimated time for resolution: 2 business days.",
    history: [
        { status: GrievanceStatus.FILED, date: '2024-06-20', notes: 'Grievance submitted.' },
        { status: GrievanceStatus.UNDER_REVIEW, date: '2024-06-21', notes: 'Issue confirmed.' },
        { status: GrievanceStatus.APPROVED, date: '2024-06-25', notes: 'Repair work approved and scheduled.' },
    ],
  },
  {
    id: 'GRV004',
    complainantName: 'Chen Wei',
    complainantEmail: 'chen.wei@example.com',
    dateFiled: '2024-07-18',
    organization: 'Public Works Department',
    description: 'Garbage has not been collected from our residential area (Bluebell Society) for the last 5 days, leading to unsanitary conditions.',
    status: GrievanceStatus.FILED,
    documents: [],
    history: [
      { status: GrievanceStatus.FILED, date: '2024-07-18', notes: 'Grievance submitted by citizen.' }
    ],
  },
];