import type { AuthError, PostgrestError } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from './supabase';

async function checkIfMemberIsInactive(memberId: string, date: string): Promise<boolean> {
  const { data: gratitudeData, error: gratitudeError } = await supabase
    .from("gratitude_entries")
    .select("id")
    .eq("member_id", memberId)
    .eq("entry_date", date)
    .maybeSingle();

  if (gratitudeError) {
    console.error("Failed to fetch gratitude entry:", gratitudeError);
    return true; // Assume inactive if there's an error
  }

  const { data: homeworkData, error: homeworkError } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("member_id", memberId)
    .eq("submission_date", date)
    .maybeSingle();

  if (homeworkError) {
    console.error("Failed to fetch homework submission:", homeworkError);
    return true; // Assume inactive if there's an error
  }

  return !gratitudeData && !homeworkData;
}

export interface Applicant {
  id: string;
  ho_ten: string;
  email: string;
  so_dien_thoai: string | null;
  telegram: string | null;
  nam_sinh: number | null;
  gioi_tinh: string | null;
  dia_chi: string | null;
  da_tham_gia_truoc: string | null;
  link_bai_chia_se: string | null;
  muc_tieu: string | null;
  ky_luat_rating: number | null;
  ly_do: string | null;
  thoi_gian_thuc_day: string | null;
  tan_suat_tap_the_duc: string | null;
  muc_do_van_dong: number | null;
  tinh_trang_suc_khoe: string | null;
  dong_y: boolean;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Member {
  id: string;
  ho_ten: string | null;
  email: string;
  so_dien_thoai: string | null;
  telegram: string | null;
  nam_sinh: number | null;
  status: 'active' | 'paused' | 'dropped';
  drop_reason: string | null;
  applicant_id: string | null;
  approved_at?: string | null;
  start_date?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ZoomLink {
  id: string;
  url: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyZoomLink {
  id: string;
  zoom_link_id: string;
  scheduled_for: string;
  telegram_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyZoomLinkWithDetails extends DailyZoomLink {
  zoom_link: ZoomLink | null;
}

export interface AdminSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface GratitudeEntry {
  id: string;
  member_id: string;
  entry_date: string;
  gratitude: string;
  created_at: string;
  updated_at: string;
}

export interface HomeworkSubmission {
  id: string;
  member_id: string;
  submission_date: string;
  lesson: string;
  submission: string;
  mentor_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressUpdate {
  id: string;
  member_id: string;
  recorded_at: string;
  recorded_for: string;
  weight: number;
  height: number;
  waist: number | null;
  bust: number | null;
  hips: number | null;
  note: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

const nowIso = () => new Date().toISOString();

const columnMissing = (error: PostgrestError | null, column: string) =>
  !!error &&
  error.code === 'PGRST204' &&
  (error.message?.toLowerCase().includes(column.toLowerCase()) ?? false);

const tableMissing = (error: PostgrestError | null, table: string) =>
  !!error &&
  error.code === 'PGRST205' &&
  (error.message?.toLowerCase().includes(table.toLowerCase()) ?? false);

const generateUuid = () => {
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;

  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return pattern.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const memberAppBaseUrl = (import.meta.env.VITE_MEMBER_APP_URL ?? '').replace(/\/$/, '');
const passwordResetRedirect = memberAppBaseUrl ? `${memberAppBaseUrl}/reset-password` : undefined;

const isAlreadyRegisteredError = (error: AuthError | null) =>
  !!error && error.status === 400 && error.message?.toLowerCase().includes('already registered');

const provisionAuthAccount = async (applicant: Applicant) => {
  if (!supabaseAdmin) {
    console.warn('Supabase service role key missing: skip auth user provisioning.');
    return;
  }

  try {
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(applicant.email, {
      data: applicant.ho_ten ? { ho_ten: applicant.ho_ten } : undefined
    });

    if (!inviteError) {
      return; // Invitation email already sent by Supabase
    }

    if (isAlreadyRegisteredError(inviteError)) {
      if (passwordResetRedirect) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(applicant.email, {
          redirectTo: passwordResetRedirect
        });
        if (resetError) {
          console.warn('Failed to send password reset email for existing member:', resetError);
        }
      }
      return;
    }

    console.warn('Failed to invite applicant via Supabase Auth:', inviteError);
  } catch (error) {
    console.error('Unexpected error while provisioning Supabase auth account:', error);
  }
};

// Lấy danh sách ứng viên theo trạng thái
export const getApplicants = async (status: 'pending' | 'approved' | 'rejected') => {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Applicant[];
};

// Cập nhật trạng thái ứng viên
export const updateApplicantStatus = async (id: string, status: 'approved' | 'rejected') => {
  const approvedAt = status === 'approved' ? nowIso() : null;

  const { data, error } = await supabase
    .from('applicants')
    .update({ status, approved_at: approvedAt })
    .eq('id', id)
    .select();

  if (error) {
    if (columnMissing(error, 'approved_at')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('applicants')
        .update({ status })
        .eq('id', id)
        .select();

      if (fallbackError) throw fallbackError;
      return fallbackData as Applicant[];
    }
    throw error;
  }
  return data as Applicant[];
};

// Duyệt ứng viên và đưa vào bảng members
export const approveApplicant = async (applicantId: string) => {
  const { data: applicant, error: fetchError } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .single<Applicant>();

  if (fetchError) throw fetchError;
  if (!applicant) throw new Error('Applicant not found');

  const approvedAt = nowIso();

  const { data: existingMember, error: existingMemberError } = await supabase
    .from('members')
    .select('id')
    .eq('email', applicant.email)
    .maybeSingle<{ id: string }>();

  if (existingMemberError) throw existingMemberError;

  const basePayload = {
    id: existingMember?.id ?? generateUuid(),
    email: applicant.email,
    ho_ten: applicant.ho_ten,
    so_dien_thoai: applicant.so_dien_thoai,
    telegram: applicant.telegram,
    nam_sinh: applicant.nam_sinh,
    status: 'active' as const,
    applicant_id: applicant.id,
    drop_reason: null
  };

  const attemptUpsert = (payload: Record<string, unknown>) =>
    supabase
      .from('members')
      .upsert([payload], { onConflict: 'email' })
      .select()
      .single<Member>();

  let memberData: Member | null = null;
  let upsertError: PostgrestError | null = null;

  {
    const { data, error } = await attemptUpsert({ ...basePayload, approved_at: approvedAt });
    memberData = data;
    upsertError = error;
  }

  if (upsertError) {
    if (columnMissing(upsertError, 'approved_at')) {
      const { approved_at: _ignored, ...fallbackPayload } = {
        ...basePayload,
        approved_at: approvedAt
      };
      const { data: fallbackData, error: fallbackError } = await attemptUpsert(fallbackPayload);
      if (fallbackError) throw fallbackError;
      memberData = fallbackData;
    } else {
      throw upsertError;
    }
  }

  const member = memberData;
  if (!member) throw new Error('Failed to upsert member');

  const { error: updateError } = await supabase
    .from('applicants')
    .update({ status: 'approved', approved_at: approvedAt })
    .eq('id', applicantId);

  if (updateError) {
    if (columnMissing(updateError, 'approved_at')) {
      const { error: fallbackUpdateError } = await supabase
        .from('applicants')
        .update({ status: 'approved' })
        .eq('id', applicantId);

      if (fallbackUpdateError) throw fallbackUpdateError;
    } else {
      throw updateError;
    }
  }

  await provisionAuthAccount(applicant);

  const { error: deleteError } = await supabase
    .from('applicants')
    .delete()
    .eq('id', applicantId);

  if (deleteError) {
    console.warn('Failed to delete applicant after approval:', deleteError);
  }

  return member;
};

// Lấy danh sách thành viên đang hoạt động
export const getMembers = async (status?: 'active' | 'paused' | 'dropped') => {
  let query = supabase
    .from('members')
    .select('*');

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Member[];
};

const mapDailyZoomLink = (entry: DailyZoomLink & { zoom_link?: ZoomLink | null }): DailyZoomLinkWithDetails => ({
  id: entry.id,
  zoom_link_id: entry.zoom_link_id,
  scheduled_for: entry.scheduled_for,
  telegram_sent_at: entry.telegram_sent_at,
  created_at: entry.created_at,
  updated_at: entry.updated_at,
  zoom_link: entry.zoom_link ?? null
});

export const listZoomLinks = async () => {
  const { data, error } = await supabase
    .from('zoom_links')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    if (tableMissing(error, 'zoom_links')) {
      throw new Error("Supabase chưa có bảng 'zoom_links'. Vui lòng chạy script supabase.sql để tạo bảng.");
    }
    throw error;
  }
  return data as ZoomLink[];
};

export const syncZoomLinks = async (links: string[]) => {
  const uniqueLinks = Array.from(new Set(links.map((link) => link.trim()).filter((link) => link.length > 0)));
  const currentLinks = await listZoomLinks();
  const currentByUrl = new Map(currentLinks.map((link) => [link.url, link] as const));

  const linksToDelete = currentLinks.filter((link) => !uniqueLinks.includes(link.url));
  if (linksToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('zoom_links')
      .delete()
      .in('id', linksToDelete.map((link) => link.id));

    if (deleteError) throw deleteError;
  }

  const linksToInsert = uniqueLinks
    .filter((link) => !currentByUrl.has(link))
    .map((url) => ({ url, is_active: true }));

  if (linksToInsert.length > 0) {
    const { error: insertError } = await supabase.from('zoom_links').insert(linksToInsert);
    if (insertError) throw insertError;
  }

  return listZoomLinks();
};

export const getDailyZoomLinkForDate = async (date: string) => {
  const { data, error } = await supabase
    .from('daily_zoom_links')
    .select('*, zoom_link:zoom_links(*)')
    .eq('scheduled_for', date)
    .maybeSingle<DailyZoomLink & { zoom_link?: ZoomLink | null }>();

  if (error) {
    if (tableMissing(error, 'daily_zoom_links')) {
      throw new Error("Supabase chưa có bảng 'daily_zoom_links'. Vui lòng chạy script supabase.sql để tạo bảng.");
    }
    throw error;
  }
  return data ? mapDailyZoomLink(data) : null;
};

export const assignZoomLinkForDate = async (zoomLinkId: string, date: string) => {
  const { data, error } = await supabase
    .from('daily_zoom_links')
    .upsert(
      { zoom_link_id: zoomLinkId, scheduled_for: date, telegram_sent_at: null },
      { onConflict: 'scheduled_for' }
    )
    .select('*, zoom_link:zoom_links(*)')
    .single<DailyZoomLink & { zoom_link?: ZoomLink | null }>();

  if (error) {
    if (tableMissing(error, 'daily_zoom_links')) {
      throw new Error("Supabase chưa có bảng 'daily_zoom_links'. Vui lòng chạy script supabase.sql để tạo bảng.");
    }
    throw error;
  }
  return mapDailyZoomLink(data);
};

export const markDailyZoomLinkSent = async (dailyZoomLinkId: string) => {
  const { data, error } = await supabase
    .from('daily_zoom_links')
    .update({ telegram_sent_at: nowIso() })
    .eq('id', dailyZoomLinkId)
    .select('*, zoom_link:zoom_links(*)')
    .single<DailyZoomLink & { zoom_link?: ZoomLink | null }>();

  if (error) {
    if (tableMissing(error, 'daily_zoom_links')) {
      throw new Error("Supabase chưa có bảng 'daily_zoom_links'. Vui lòng chạy script supabase.sql để tạo bảng.");
    }
    throw error;
  }
  return mapDailyZoomLink(data);
};

export const getAdminSettings = async (keys?: string[]) => {
  let query = supabase.from('admin_settings').select('*');
  if (keys && keys.length > 0) {
    query = query.in('key', keys);
  }

  const { data, error } = await query;
  if (error) {
    if (tableMissing(error, 'admin_settings')) {
      console.warn("Supabase chưa có bảng 'admin_settings'. Trả về giá trị mặc định.");
      return [];
    }
    throw error;
  }
  return data as AdminSetting[];
};

export const updateAdminSettings = async (settings: Record<string, string>) => {
  const entries = Object.entries(settings)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ({ key, value }));

  if (entries.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('admin_settings').upsert(entries).select('*');
  if (error) throw error;
  return data as AdminSetting[];
};

// Đánh dấu thành viên bị loại
export const dropMember = async (id: string, dropReason: string) => {
  const { error } = await supabase
    .from('members')
    .update({
      status: 'dropped',
      drop_reason: dropReason ?? 'Removed by admin',
      updated_at: nowIso()
    })
    .eq('id', id);

  if (error) throw error;
};

export const restoreMember = async (id: string) => {
  const { error } = await supabase
    .from('members')
    .update({
      status: 'active',
      drop_reason: null,
      updated_at: nowIso(),
    })
    .eq('id', id);

  if (error) throw error;
};

export const getMemberGratitudeEntries = async (memberId: string) => {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('id, member_id, entry_date, gratitude, created_at, updated_at')
    .eq('member_id', memberId)
    .order('entry_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GratitudeEntry[];
};

export const getMemberHomeworkSubmissions = async (memberId: string) => {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select('id, member_id, submission_date, lesson, submission, mentor_notes, created_at, updated_at')
    .eq('member_id', memberId)
    .order('submission_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as HomeworkSubmission[];
};

export const getMemberProgressUpdates = async (memberId: string) => {
  const { data, error } = await supabase
    .from('progress_updates')
    .select('id, member_id, recorded_at, recorded_for, weight, height, waist, bust, hips, note, photo_url, created_at, updated_at')
    .eq('member_id', memberId)
    .order('recorded_for', { ascending: false })
    .order('recorded_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProgressUpdate[];
};

export const checkAndDropInactiveMembers = async () => {
  const today = new Date().toISOString().split("T")[0];
  const members = await getMembers();

  for (const member of members) {
    const isInactive = await checkIfMemberIsInactive(member.id, today);
    if (isInactive) {
      try {
        await dropMember(member.id, "No gratitude entry or homework submission for one day");
        console.log(`Member ${member.ho_ten} (${member.email}) marked as inactive.`);
      } catch (error) {
        console.error(`Failed to drop member ${member.ho_ten} (${member.email}):`, error);
      }
    }
  }
};
