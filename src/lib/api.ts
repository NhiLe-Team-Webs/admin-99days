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

