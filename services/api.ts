import { createClient } from '@supabase/supabase-js';
import { 
  User, 
  UserRole, 
  Event, 
  OrganizerCompany, 
  Staff, 
  ParticipantCompany, 
  ReportButtonConfig,
  ReportSubmission,
  StaffActivity,
  Department
} from '../types';

// --- Supabase Client Initialization ---
const supabaseUrl = 'https://ngukhhydpltectxrmvot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndWtoaHlkcGx0ZWN0eHJtdm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzcyNjAsImV4cCI6MjA3MjcxMzI2MH0.a_29iTryK6r8MKV-kvww8KBnqchPz8E3vXKGebJ-vQc';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'imagens';

export const uploadImage = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Falha ao fazer upload da imagem.');
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!data || !data.publicUrl) {
      throw new Error('Não foi possível obter a URL pública da imagem.');
  }

  return data.publicUrl;
};


// --- Utils for case conversion between JS (camelCase) and Supabase (snake_case) ---
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const snakeCaseKeys = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(snakeCaseKeys);
  return Object.keys(obj).reduce((acc, key) => {
    acc[toSnakeCase(key)] = obj[key];
    return acc;
  }, {} as any);
};

const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const camelCaseKeys = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(camelCaseKeys);
  return Object.keys(obj).reduce((acc, key) => {
    acc[toCamelCase(key)] = obj[key];
    return acc;
  }, {} as any);
};

// --- Auth ---
// NOTE: This implements a custom auth flow matching the mock database's logic.
// For production, it's highly recommended to use Supabase Auth (`supabase.auth.signInWithPassword`, etc.)
// and hash passwords securely.
export const apiLogin = async (email: string, pass: string): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('password', pass) // WARNING: Storing and comparing plaintext passwords is insecure.
    .single();

  if (error || !data) {
    throw new Error('Credenciais inválidas.');
  }

  const user = camelCaseKeys(data) as User;

  if (user.role === UserRole.ORGANIZER && user.eventId) {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('is_active')
      .eq('id', user.eventId)
      .single();
    
    if (eventError || (event && !event.is_active)) {
      throw new Error('O evento associado a esta conta está inativo.');
    }
  }

  // Supabase doesn't return the password, but our mock logic didn't either.
  return user;
};

export const apiLogout = () => { /* No-op, handled by AuthContext */ };

// --- Checkin ---
export const validateCheckin = async (boothCode: string, personalCode: string) => {
  const { data: company, error: companyError } = await supabase
    .from('participant_companies')
    .select('*, event:events(*)')
    .eq('booth_code', boothCode.toUpperCase())
    .single();

  if (companyError || !company) throw new Error('Código do Estande inválido.');
  
  const participantCompany = camelCaseKeys(company) as ParticipantCompany;

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('personal_code', personalCode.toUpperCase())
    .single();

  if (staffError || !staff) throw new Error('Código Pessoal inválido.');
  
  const event = camelCaseKeys(company.event) as Event;
  if (!event) throw new Error('Evento associado não encontrado.');
  if (!event.isActive) throw new Error('Este evento está inativo no momento.');

  if (event.organizerCompanyId !== staff.organizer_company_id) {
    throw new Error('Equipe e Empresa não pertencem ao mesmo evento.');
  }

  return { staff: camelCaseKeys(staff) as Staff, event, company: participantCompany };
};


// --- Reports ---
export const getReportButtonsForBooth = async (boothCode: string): Promise<ReportButtonConfig[]> => {
  const { data: company } = await supabase
    .from('participant_companies')
    .select('button_ids')
    .eq('booth_code', boothCode.toUpperCase())
    .single();

  if (!company || !company.button_ids || company.button_ids.length === 0) return [];

  const { data, error } = await supabase
    .from('report_button_configs')
    .select('*')
    .in('id', company.button_ids);

  if (error) throw new Error('Falha ao buscar botões.');
  return camelCaseKeys(data) as ReportButtonConfig[];
};

export const submitReport = async (reportData: Omit<ReportSubmission, 'id' | 'timestamp'>) => {
  const { error: reportError } = await supabase
    .from('reports')
    .insert(snakeCaseKeys({ ...reportData, timestamp: new Date().toISOString() }));

  if (reportError) throw new Error('Falha ao enviar informe.');

  const { data: staff } = await supabase.from('staff').select('id').eq('name', reportData.staffName).single();

  if (staff) {
    const activity = {
      staffId: staff.id,
      description: `Registrou '${reportData.reportLabel}' para ${reportData.boothCode}`,
      timestamp: new Date().toISOString()
    };
    await supabase.from('staff_activities').insert(snakeCaseKeys(activity));
  }
};

export const submitSalesCheckin = async (payload: any, staffId: string) => {
    // 1. Send webhook
    const webhookUrl = 'https://webhook.triad3.io/webhook/chek-in-vendas-cie';
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.error('Webhook response was not ok:', response.statusText);
        throw new Error('Falha no envio do check-in de vendas.');
    }
    
    // 2. Log staff activity
    try {
        const activity: Omit<StaffActivity, 'id'| 'timestamp'> = {
            staffId: staffId,
            description: `Realizou Check-in de Vendas para ${payload.companyName} (${payload.boothCode})`,
        };
        const { error } = await supabase.from('staff_activities').insert(snakeCaseKeys({ ...activity, timestamp: new Date().toISOString() }));
        if (error) {
            // Log error but don't throw, as the primary action (webhook) succeeded.
            console.error('Failed to log sales check-in activity:', error);
        }
    } catch (error) {
        console.error('Exception while logging sales check-in activity:', error);
    }
};

export const getReportsByEvent = async (eventId: string): Promise<ReportSubmission[]> => {
  const { data, error } = await supabase.from('reports').select('*').eq('event_id', eventId);
  if (error) return [];
  return camelCaseKeys(data) as ReportSubmission[];
};

// --- Generic CRUD functions replaced with specific Supabase calls ---

const createApi = <T extends { id: string }>(tableName: string) => ({
    getAll: async (): Promise<T[]> => {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw new Error(error.message);
        return camelCaseKeys(data) as T[];
    },
    add: async (item: Omit<T, 'id'>): Promise<T> => {
        const { data, error } = await supabase.from(tableName).insert(snakeCaseKeys(item)).select().single();
        if (error) throw new Error(error.message);
        return camelCaseKeys(data) as T;
    },
    update: async (updatedItem: T): Promise<T> => {
        const { data, error } = await supabase.from(tableName).update(snakeCaseKeys(updatedItem)).eq('id', updatedItem.id).select().single();
        if (error) throw new Error(error.message);
        return camelCaseKeys(data) as T;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw new Error(error.message);
    },
});


// --- Admins ---
const adminApi = createApi<User>('users');
export const getAdmins = async () => (await adminApi.getAll()).filter(u => u.role === UserRole.ADMIN && u.isMaster);
export const addAdmin = async (data: Omit<User, 'id' | 'role'>) => adminApi.add({ ...data, role: UserRole.ADMIN });
export const updateAdmin = adminApi.update;
export const deleteAdmin = adminApi.delete;

// --- Organizer Companies ---
const organizerApi = createApi<OrganizerCompany>('organizer_companies');
export const getOrganizerCompanies = organizerApi.getAll;
export const getOrganizerCompanyById = async (id: string): Promise<OrganizerCompany | null> => {
    const { data, error } = await supabase.from('organizer_companies').select('*').eq('id', id).single();
    if (error) return null;
    return camelCaseKeys(data);
}
export const getOrganizerUserForEvent = async (eventId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('event_id', eventId)
    .eq('role', UserRole.ORGANIZER)
    .single();
    if (error) return null;
    const { password, ...user } = camelCaseKeys(data);
    return user;
}

export const updateUserPhoto = async (userId: string, photoUrl: string): Promise<User> => {
    const { data, error } = await supabase
        .from('users')
        .update({ photo_url: photoUrl })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user photo:', error);
        throw new Error('Falha ao atualizar a foto do perfil.');
    }

    return camelCaseKeys(data) as User;
};


// --- Events ---
const eventApi = createApi<Event>('events');
export const getEvents = eventApi.getAll;
export const updateEvent = eventApi.update;

// These complex operations should ideally be server-side transactions (e.g., Supabase Edge Functions)
// to ensure data integrity. This client-side implementation mimics the mock logic.
export const addEventAndOrganizer = async (data: {
  event: Omit<Event, 'id' | 'organizerCompanyId' | 'isActive'>,
  organizer: Omit<OrganizerCompany, 'id'>,
  user: { email: string, password?: string }
}) => {
  const newOrganizer = await organizerApi.add(data.organizer);
  const newEventData = { ...data.event, organizerCompanyId: newOrganizer.id, isActive: true };
  const newEvent = await eventApi.add(newEventData);
  const newUserData = {
    name: data.organizer.responsibleName,
    email: data.user.email,
    password: data.user.password || 'password',
    role: UserRole.ORGANIZER,
    isMaster: false,
    eventId: newEvent.id,
    photoUrl: `https://i.pravatar.cc/150?u=${data.user.email}`
  };
  await adminApi.add(newUserData);
  await departmentApi.add({ name: 'Geral', eventId: newEvent.id });
  return newEvent;
};

export const updateEventAndOrganizer = async (data: {
  event: Event,
  organizer: OrganizerCompany,
  user: { email: string, password?: string }
}) => {
  await eventApi.update(data.event);
  await organizerApi.update(data.organizer);
  
  const existingUser = await getOrganizerUserForEvent(data.event.id);
  if (existingUser) {
      const updatedUser: any = {
        id: existingUser.id,
        name: data.organizer.responsibleName,
        email: data.user.email,
      };
      // Only include password if it's being changed
      if (data.user.password) {
        updatedUser.password = data.user.password;
      }
      await supabase.from('users').update(snakeCaseKeys(updatedUser)).eq('id', existingUser.id);
  }
};

export const deleteEvent = async (eventId: string) => {
    const { data: eventToDelete } = await supabase.from('events').select('organizer_company_id').eq('id', eventId).single();
    if (!eventToDelete) return;
    const organizerId = eventToDelete.organizer_company_id;

    // Simple cascade delete - more robust logic should be in the database (e.g., RLS, functions)
    await supabase.from('reports').delete().eq('event_id', eventId);
    await supabase.from('participant_companies').delete().eq('event_id', eventId);
    await supabase.from('staff').delete().eq('organizer_company_id', organizerId);
    await supabase.from('users').delete().eq('event_id', eventId);
    await supabase.from('departments').delete().eq('event_id', eventId);
    await supabase.from('organizer_companies').delete().eq('id', organizerId);
    await supabase.from('events').delete().eq('id', eventId);
};

// --- Departments ---
const departmentApi = createApi<Department>('departments');
export const getDepartmentsByEvent = async (eventId: string): Promise<Department[]> => {
    const { data, error } = await supabase.from('departments').select('*').eq('event_id', eventId);
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Department[];
};
export const addDepartment = departmentApi.add;
export const updateDepartment = departmentApi.update;
export const deleteDepartment = departmentApi.delete;

// --- Staff ---
const staffApi = createApi<Staff>('staff');
export const getStaffByOrganizer = async (organizerId: string): Promise<Staff[]> => {
    const { data, error } = await supabase.from('staff').select('*').eq('organizer_company_id', organizerId);
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Staff[];
};
export const getStaffByEvent = async (eventId: string): Promise<Staff[]> => {
    const { data: event } = await supabase.from('events').select('organizer_company_id').eq('id', eventId).single();
    if (!event) return [];
    return getStaffByOrganizer(event.organizer_company_id);
}
export const addStaff = staffApi.add;
export const updateStaff = staffApi.update;
export const deleteStaff = staffApi.delete;
export const getStaffActivity = async (staffId: string): Promise<StaffActivity[]> => {
  const { data, error } = await supabase
    .from('staff_activities')
    .select('*')
    .eq('staff_id', staffId)
    .order('timestamp', { ascending: false });
  if (error) return [];
  return camelCaseKeys(data) as StaffActivity[];
};

// --- Participant Companies ---
const companyApi = createApi<ParticipantCompany>('participant_companies');
export const getParticipantCompaniesByEvent = async (eventId: string): Promise<ParticipantCompany[]> => {
    const { data, error } = await supabase.from('participant_companies').select('*').eq('event_id', eventId);
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as ParticipantCompany[];
};
export const addParticipantCompany = async (companyData: Omit<ParticipantCompany, 'id'>): Promise<ParticipantCompany> => {
  const newCompany = await companyApi.add(companyData);

  if (newCompany) {
    try {
      const webhookUrl = 'https://webhook.triad3.io/webhook/c12c6861-f16a-466d-a450-8b2aae9110f9';
      
      let eventName = 'Evento não encontrado';
      if (newCompany.eventId) {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('name')
          .eq('id', newCompany.eventId)
          .single();
        
        if (eventError) {
            console.error('Error fetching event name for webhook:', eventError.message);
        } else if (eventData) {
            eventName = eventData.name;
        }
      }

      const payload = {
        ...newCompany,
        eventName: eventName,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Webhook response was not ok:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send data to webhook:', error);
    }
  }
  
  return newCompany;
};
export const updateParticipantCompany = companyApi.update;
export const deleteParticipantCompany = companyApi.delete;

// --- Button Configs ---
const buttonApi = createApi<ReportButtonConfig>('report_button_configs');
export const getButtonConfigs = buttonApi.getAll;
export const addButtonConfig = buttonApi.add;
export const updateButtonConfig = buttonApi.update;
export const deleteButtonConfig = buttonApi.delete;