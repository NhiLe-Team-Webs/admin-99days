import { supabase } from './supabase';

export interface Applicant {
  id: string;
  ho_ten: string;
  email: string;
  so_dien_thoai: string;
  telegram: string;
  nam_sinh: string;
  ly_do: string;
  dong_y: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

// Lấy danh sách theo trạng thái
export const getApplicants = async (status: 'pending' | 'approved' | 'rejected') => {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// Cập nhật trạng thái
export const updateApplicantStatus = async (id: string, status: 'approved' | 'rejected') => {
  const { data, error } = await supabase
    .from('applicants')
    .update({ status })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data;
};

// Chuyển applicant thành member
export const approveApplicant = async (applicantId: string) => {
  // 1. Lấy thông tin applicant
  const { data: applicant, error: fetchError } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .single();

  if (fetchError) throw fetchError;
  if (!applicant) throw new Error('Applicant not found');

  // 2. Thêm vào bảng members
  const { data: member, error: insertError } = await supabase
    .from('members')
    .insert([
      {
        ho_ten: applicant.ho_ten,
        email: applicant.email,
        so_dien_thoai: applicant.so_dien_thoai,
        telegram: applicant.telegram,
        approved_at: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (insertError) throw insertError;

  // 3. Xóa khỏi bảng applicants
  const { error: deleteError } = await supabase
    .from('applicants')
    .delete()
    .eq('id', applicantId);

  if (deleteError) throw deleteError;

  return member;
};

// Lấy danh sách members
export const getMembers = async () => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('approved_at', { ascending: false });

  if (error) throw error;
  return data;
};

// Xóa member
export const removeMember = async (id: string) => {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) throw error;
};