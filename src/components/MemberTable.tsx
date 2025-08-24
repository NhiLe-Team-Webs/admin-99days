import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export interface Member {
  id: string;
  ho_ten: string;
  email: string;
  telegram: string;
  so_dien_thoai: string;
  approved_at: string;
}

interface MemberTableProps {
  members: Member[];
  onRemove: (id: string, name: string) => void;
}

export const MemberTable = ({ members, onRemove }: MemberTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMembers = members.filter(
    (member) =>
      member.ho_ten.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.telegram.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.so_dien_thoai && member.so_dien_thoai.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-card p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Danh sách Thành viên</h2>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Họ Tên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Telegram
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Số điện thoại
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Ngày tham gia
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  Không có thành viên nào.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{member.ho_ten}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">{member.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">{member.telegram}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">{member.so_dien_thoai}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      {new Date(member.approved_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(member.id, member.ho_ten)}
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 font-semibold"
                    >
                      Loại bỏ
                    </Button>
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