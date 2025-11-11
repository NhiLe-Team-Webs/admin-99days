import { useMemo, useState } from "react";

import type { Member } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<Member["status"], string> = {
  active: "Đang hoạt động",
  paused: "Tạm dừng",
  dropped: "Đã loại bỏ",
};

interface MemberTableProps {
  members: Member[];
  onDrop: (id: string, reason: string) => void;
  onRestore: (id: string) => void;
  onSelect: (member: Member) => void;
}

export const MemberTable = ({ members, onDrop, onRestore, onSelect }: MemberTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dropReason, setDropReason] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const normalizedMembers = members ?? [];

  const filteredMembers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return normalizedMembers;
    return normalizedMembers.filter((member) => {
      const fullName = (member.ho_ten ?? "").toLowerCase();
      const email = member.email.toLowerCase();
      const telegram = (member.telegram ?? "").toLowerCase();
      const phone = (member.so_dien_thoai ?? "").toLowerCase();
      return (
        fullName.includes(keyword) ||
        email.includes(keyword) ||
        telegram.includes(keyword) ||
        phone.includes(keyword)
      );
    });
  }, [normalizedMembers, searchTerm]);

  const formatApprovedDate = (member: Member) => {
    const dateSource = member.approved_at ?? member.start_date ?? member.created_at;
    return dateSource ? new Date(dateSource).toLocaleDateString("vi-VN") : "--";
  };

  const handleDrop = () => {
    if (!selectedMemberId) return;
    const reason = dropReason.trim();
    if (!reason) return;
    onDrop(selectedMemberId, reason);
    setDropReason("");
    setSelectedMemberId(null);
  };

  return (
    <div className="rounded-xl bg-card p-5 shadow-lg sm:p-6">
      <h2 className="mb-4 text-xl font-bold">Danh sách thành viên</h2>
      <Input
        type="text"
        placeholder="Tìm kiếm thành viên..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 w-full"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-4">
                Số báo danh
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Họ tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Telegram
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Số điện thoại
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Ngày tham gia
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground sm:px-6">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  Không có thành viên phù hợp.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member, index) => (
                <tr key={member.id}>
                  <td className="px-2 py-4 text-sm font-semibold text-muted-foreground sm:px-4">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="font-medium text-foreground">{member.ho_ten ?? "--"}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm text-foreground">{member.email}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm text-muted-foreground">{member.telegram ?? "--"}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm text-muted-foreground">{member.so_dien_thoai ?? "--"}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm text-muted-foreground">{formatApprovedDate(member)}</div>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm text-muted-foreground">
                      {STATUS_LABELS[member.status] ?? member.status}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center sm:px-6">
                    <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => onSelect(member)}
                      >
                        Xem chi tiết
                      </Button>
                      {member.status === "dropped" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="font-semibold text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                          onClick={() => onRestore(member.id)}
                        >
                          Khôi phục
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                              onClick={() => setSelectedMemberId(member.id)}
                            >
                              Xóa
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Bạn có chắc muốn loại bỏ thành viên này khỏi chương trình?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Vui lòng nhập lý do để ghi nhận khi loại thành viên.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                              type="text"
                              placeholder="Lý do loại thành viên..."
                              value={dropReason}
                              onChange={(e) => setDropReason(e.target.value)}
                              className="mb-4 w-full"
                            />
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDrop} disabled={!dropReason.trim()}>
                                Xác nhận
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
