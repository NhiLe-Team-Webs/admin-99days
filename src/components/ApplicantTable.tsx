import { Button } from "@/components/ui/button";

export interface Applicant {
  id: number;
  name: string;
  email: string;
  telegram: string;
  reason: string;
}

interface ApplicantTableProps {
  applicants: Applicant[];
  onApprove: (id: number) => void;
  onReject: (id: number, name: string) => void;
}

export const ApplicantTable = ({ applicants, onApprove, onReject }: ApplicantTableProps) => {
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
                Họ Tên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Email / Telegram
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
                  <div className="font-medium text-foreground">{applicant.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-foreground">{applicant.email}</div>
                  <div className="text-sm text-muted-foreground">{applicant.telegram}</div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs">
                  <div className="truncate">{applicant.reason}</div>
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
                    onClick={() => onReject(applicant.id, applicant.name)}
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