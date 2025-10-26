import type { Member } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { useState } from 'react';

interface MemberTableProps {
  members: Member[];
  onDrop: (id: string, reason: string) => void;
  onSelect: (member: Member) => void;
}

export const MemberTable = ({ members, onDrop, onSelect }: MemberTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dropReason, setDropReason] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const normalizedMembers = members ?? [];

  const filteredMembers = normalizedMembers.filter((member) => {
    const keyword = searchTerm.toLowerCase();
    return (
      (member.ho_ten ?? '').toLowerCase().includes(keyword) ||
      member.email.toLowerCase().includes(keyword) ||
      (member.telegram ?? '').toLowerCase().includes(keyword) ||
      (member.so_dien_thoai ?? '').toLowerCase().includes(keyword)
    );
  });

  const formatApprovedDate = (member: Member) => {
    const dateSource = member.approved_at ?? member.start_date ?? member.created_at;
    return dateSource ? new Date(dateSource).toLocaleDateString('vi-VN') : '—';
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Danh sách thành viên</h2>
      <Input
        type="text"
        placeholder="Tìm kiếm thành viên..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full mb-4"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Họ tên</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Telegram</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Số điện thoại</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ngày tham gia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Trạng thái</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Hành động</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  Không có thành viên nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{member.ho_ten ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">{member.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">{member.telegram ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">{member.so_dien_thoai ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">{formatApprovedDate(member)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      {member.status === 'dropped' ? 'Bị loại bỏ' : 'Đang hoạt động'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => onSelect(member)}
                      >
                        Xem chi tiết
                      </Button>
                      {member.status !== 'dropped' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 font-semibold"
                              onClick={() => setSelectedMemberId(member.id)}
                            >
                              Xóa
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>B???n cA3 ch??_c ch??_n mu??`n lo???i b??? thA?nh viA?n nA?y?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Nh??-p lA? do lo???i b??? thA?nh viA?n nA?y.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                              type="text"
                              placeholder="LA? do lo???i b???"
                              value={dropReason}
                              onChange={(e) => setDropReason(e.target.value)}
                              className="w-full mb-4"
                            />
                            <AlertDialogFooter>
                              <AlertDialogCancel>H??y</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  if (selectedMemberId) {
                                    onDrop(selectedMemberId, dropReason);
                                    setDropReason('');
                                    setSelectedMemberId(null);
                                  }
                                }}
                                disabled={!dropReason}
                              >
                                XA?c nh??-n
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
