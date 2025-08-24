import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { getApplicants, updateApplicantStatus } from '@/lib/api';

export interface Applicant {
  id: string;
  ho_ten: string;
  email: string;
  telegram: string;
  ly_do: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface ApplicantTableProps {
  onApprove: (id: string) => void;
  onReject: (id: string, name: string) => void;
}

export const ApplicantTable = ({ onApprove, onReject }: ApplicantTableProps) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        const data = await getApplicants('pending');
        setApplicants(data);
      } catch (error) {
        console.error('Failed to fetch applicants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicants();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateApplicantStatus(id, 'approved');
      setApplicants(prev => prev.filter(app => app.id !== id));
      onApprove(id);
    } catch (error) {
      console.error('Failed to approve applicant:', error);
    }
  };

  const handleReject = async (id: string, name: string) => {
    try {
      await updateApplicantStatus(id, 'rejected');
      setApplicants(prev => prev.filter(app => app.id !== id));
      onReject(id, name);
    } catch (error) {
      console.error('Failed to reject applicant:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Duyệt Đơn Đăng Ký Mới</h2>
        <div className="text-center py-8 text-muted-foreground">
          Đang tải danh sách...
        </div>
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="bg-card p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Duyệt Đơn Đăng Ký Mới</h2>
        <div className="text-center py-8 text-muted-foreground">
          Không có đơn đăng ký mới.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Duyệt Đơn Đăng Ký Mới</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Họ và tên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Telegram
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Lý do tham gia
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {applicants.map((applicant) => (
              <tr key={applicant.id}>
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{applicant.ho_ten}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-foreground">{applicant.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-muted-foreground">{applicant.telegram}</div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs">
                  <div className="truncate">{applicant.ly_do}</div>
                </td>
                <td className="px-6 py-4 text-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApprove(applicant.id)}
                    className="text-success hover:text-success-foreground hover:bg-success-light font-semibold"
                  >
                    Duyệt
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReject(applicant.id, applicant.ho_ten)}
                    className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 font-semibold"
                  >
                    Từ chối
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
