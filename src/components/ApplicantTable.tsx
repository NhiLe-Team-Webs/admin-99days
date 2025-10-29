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
      <div className="rounded-xl bg-card p-5 shadow-lg sm:p-6">
        <h2 className="mb-4 text-xl font-bold">Duyệt đơn đăng ký mới</h2>
        <div className="py-8 text-center text-muted-foreground">Đang tải danh sách...</div>
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="rounded-xl bg-card p-5 shadow-lg sm:p-6">
        <h2 className="mb-4 text-xl font-bold">Duyệt đơn đăng ký mới</h2>
        <div className="py-8 text-center text-muted-foreground">Chưa có đơn đăng ký mới.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-5 shadow-lg sm:p-6">
      <h2 className="mb-4 text-xl font-bold">Duyệt đơn đăng ký mới</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Họ và tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Liên lạc
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Mục tiêu & thông tin
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {applicants.map((applicant) => (
              <tr key={applicant.id}>
                <td className="px-4 py-4 align-top sm:px-6">
                  <div className="font-semibold text-foreground">{applicant.ho_ten}</div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div>
                      Năm sinh: {applicant.nam_sinh ?? "—"} • Giới tính: {applicant.gioi_tinh ?? "—"}
                    </div>
                    <div>Đã tham gia trước: {applicant.da_tham_gia_truoc ?? "—"}</div>
                    <div>Địa chỉ: {applicant.dia_chi ?? "—"}</div>
                    <div>
                      Thức dậy: {applicant.thoi_gian_thuc_day ?? "—"} • Tần suất tập{" "}
                      {applicant.tan_suat_tap_the_duc ?? "—"}
                    </div>
                    <div>
                      Mức độ vận động{" "}
                      {applicant.muc_do_van_dong !== null && applicant.muc_do_van_dong !== undefined
                        ? `${applicant.muc_do_van_dong}/5`
                        : "—"}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top sm:px-6">
                  <div className="text-sm text-foreground">{applicant.email}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="rounded border border-primary/50 px-2 py-1 font-medium text-primary">
                      {applicant.telegram ?? "—"}
                    </span>
                  </div>
                  {applicant.link_bai_chia_se && (
                    <div className="mt-3 text-xs">
                      <a
                        href={applicant.link_bai_chia_se}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Xem bài chia sẻ
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 align-top text-sm text-muted-foreground sm:px-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Mục tiêu 99 ngày</p>
                      <p className="text-sm text-foreground">{applicant.muc_tieu ?? "—"}</p>
                    </div>
                    <div className="grid gap-1 text-xs">
                      <span>
                        Kỷ luật:{' '}
                        {applicant.ky_luat_rating !== null && applicant.ky_luat_rating !== undefined
                          ? `${applicant.ky_luat_rating}/5`
                          : "—"}
                      </span>
                      <span>Động lực: {applicant.ly_do ?? "—"}</span>
                      <span>Sức khỏe: {applicant.tinh_trang_suc_khoe ?? "—"}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center sm:px-6">
                  <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onApprove(applicant.id)}
                      className="font-semibold text-success hover:bg-success-light hover:text-success-foreground"
                    >
                      Duyệt
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReject(applicant.id, applicant.ho_ten)}
                      className="font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                    >
                      Từ chối
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

