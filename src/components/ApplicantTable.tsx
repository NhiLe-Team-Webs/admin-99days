import type { Applicant } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface ApplicantTableProps {
  applicants: Applicant[];
  isLoading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, name: string) => void;
}

export const ApplicantTable = ({ applicants, isLoading, onApprove, onReject }: ApplicantTableProps) => {
  if (isLoading) {
    return (
      <div className="bg-card p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Duyệt đơn đăng ký mới</h2>
        <div className="text-center py-8 text-muted-foreground">Đang tải danh sách...</div>
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="bg-card p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Duyệt đơn đăng ký mới</h2>
        <div className="text-center py-8 text-muted-foreground">Không có đơn đăng ký mới.</div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Duyệt đơn đăng ký mới</h2>
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
                  <div className="text-sm text-muted-foreground">{applicant.telegram ?? '—'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs">
                  <div className="truncate">{applicant.ly_do ?? '—'}</div>
                </td>
                <td className="px-6 py-4 text-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onApprove(applicant.id)}
                    className="text-success hover:text-success-foreground hover:bg-success-light font-semibold"
                  >
                    Duyệt
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReject(applicant.id, applicant.ho_ten)}
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
