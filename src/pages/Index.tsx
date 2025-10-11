import { useState, useEffect, useCallback } from "react";
import { Users, FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TabNavigation } from "@/components/TabNavigation";
import { StatsCard } from "@/components/StatsCard";
import { ApplicantTable } from "@/components/ApplicantTable";
import { MemberTable } from "@/components/MemberTable";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  getApplicants,
  getMembers,
  approveApplicant,
  updateApplicantStatus,
  removeMember,
} from "@/lib/api";
import type { Applicant, Member } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const tabs = [
  { id: "dashboard", label: "Bảng điều khiển" },
  { id: "applicants", label: "Đơn Đăng Ký Mới" },
  { id: "members", label: "Tất Cả Thành Viên" },
  { id: "settings", label: "Cài đặt" },
];

const sortApplicantsByNewest = (items: Applicant[]) =>
  [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

const resolveMemberTimestamp = (member: Member) =>
  member.approved_at ?? member.start_date ?? member.created_at;

const sortMembersByRecentApproval = (items: Member[]) =>
  [...items].sort(
    (a, b) =>
      new Date(resolveMemberTimestamp(b)).getTime() -
      new Date(resolveMemberTimestamp(a)).getTime()
  );

const Index = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const [zoomLinks, setZoomLinks] = useState<string[]>([
    "https://zoom.us/j/1111111111?pwd=DAY1",
    "https://zoom.us/j/2222222222?pwd=DAY2",
    "https://zoom.us/j/3333333333?pwd=DAY3",
  ]);

  const [zoomLinksText, setZoomLinksText] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [applicantsData, membersData] = await Promise.all([
        getApplicants("pending"),
        getMembers(),
      ]);
      setApplicants(sortApplicantsByNewest(applicantsData));
      setMembers(sortMembersByRecentApproval(membersData));
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu từ server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "applicants" }, (payload) => {
        const newApplicant = payload.new as Applicant | null;
        if (!newApplicant || newApplicant.status !== "pending") {
          return;
        }
        setApplicants((prev) =>
          sortApplicantsByNewest([
            newApplicant,
            ...prev.filter((applicant) => applicant.id !== newApplicant.id),
          ])
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applicants" }, (payload) => {
        const updatedApplicant = payload.new as Applicant | null;
        if (!updatedApplicant) {
          return;
        }
        setApplicants((prev) => {
          const others = prev.filter((applicant) => applicant.id !== updatedApplicant.id);
          if (updatedApplicant.status === "pending") {
            return sortApplicantsByNewest([updatedApplicant, ...others]);
          }
          return others;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "applicants" }, (payload) => {
        const removedApplicant = payload.old as Applicant | null;
        if (!removedApplicant) {
          return;
        }
        setApplicants((prev) =>
          prev.filter((applicant) => applicant.id !== removedApplicant.id)
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "members" }, (payload) => {
        const newMember = payload.new as Member | null;
        if (!newMember || newMember.status !== "active") {
          return;
        }
        setMembers((prev) =>
          sortMembersByRecentApproval([
            newMember,
            ...prev.filter((member) => member.id !== newMember.id),
          ])
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members" }, (payload) => {
        const updatedMember = payload.new as Member | null;
        if (!updatedMember) {
          return;
        }
        setMembers((prev) => {
          const others = prev.filter((member) => member.id !== updatedMember.id);
          if (updatedMember.status === "active") {
            return sortMembersByRecentApproval([updatedMember, ...others]);
          }
          return others;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setZoomLinksText(zoomLinks.join("\n"));
  }, [zoomLinks]);

  const showConfirmModal = (
    title: string,
    description: string,
    onConfirm: () => void
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      onConfirm,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, title: "", description: "", onConfirm: () => {} });
  };

  const handleApprove = async (id: string) => {
    try {
      await approveApplicant(id);
      setApplicants((prev) => prev.filter((applicant) => applicant.id !== id));
      toast({
        title: "Đã duyệt thành công",
        description: `Một thành viên mới đã được thêm.`,
      });
      await fetchData(); // Refetch all data
    } catch (error) {
      console.error("Failed to approve applicant:", error);
      toast({
        title: "Lỗi",
        description: "Duyệt đơn thất bại.",
        variant: "destructive",
      });
    }
  };

  const handleReject = (id: string, name: string) => {
    showConfirmModal(
      "Xác nhận từ chối",
      `Bạn có chắc muốn từ chối đơn của <strong>${name}</strong>?`,
      async () => {
        try {
          await updateApplicantStatus(id, "rejected");
          toast({
            title: "Đã từ chối đơn đăng ký",
            description: `Đơn đăng ký của ${name} đã bị từ chối.`, 
            variant: "destructive",
          });
          await fetchData(); // Refetch all data
        } catch (error) {
          console.error("Failed to reject applicant:", error);
          toast({
            title: "Lỗi",
            description: "Từ chối đơn thất bại.",
            variant: "destructive",
          });
        } finally {
          closeConfirmModal();
        }
      }
    );
  };

  const handleRemoveMember = (id: string, name: string) => {
    showConfirmModal(
      "Xác nhận loại bỏ",
      `Bạn có chắc muốn loại bỏ thành viên <strong>${name}</strong>?`,
      async () => {
        try {
          await removeMember(id);
          toast({
            title: "Đã loại bỏ thành viên",
            description: `${name} đã được loại bỏ khỏi danh sách thành viên.`, 
            variant: "destructive",
          });
          await fetchData(); // Refetch all data
        } catch (error) {
          console.error("Failed to remove member:", error);
          toast({
            title: "Lỗi",
            description: "Loại bỏ thành viên thất bại.",
            variant: "destructive",
          });
        } finally {
          closeConfirmModal();
        }
      }
    );
  };

  const handleUpdateZoomLinks = () => {
    const links = zoomLinksText
      .split("\n")
      .map((link) => link.trim())
      .filter((link) => link.length > 0);
    setZoomLinks(links);
    toast({
      title: "Cập nhật thành công",
      description: `Đã lưu thành công ${links.length} link Zoom!`, 
    });
  };

  const todayZoomLink = zoomLinks.length > 0 ? zoomLinks[0] : "Chưa có link nào được thiết lập.";

  const dashboardContent = loading ? (
    <div className="text-center py-8 text-muted-foreground">Đang tải dữ liệu...</div>
  ) : (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Tổng thành viên"
          value={members.length}
          icon={Users}
          iconBgColor="bg-primary-light"
          iconColor="text-primary"
        />
        <StatsCard
          title="Đơn đăng ký mới"
          value={applicants.length}
          icon={FileText}
          iconBgColor="bg-info-light"
          iconColor="text-info"
        />
        <StatsCard
          title="Link Zoom còn lại"
          value={zoomLinks.length}
          icon={Link2}
          iconBgColor="bg-success-light"
          iconColor="text-success"
        />
      </div>
      <div className="bg-card p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">Link Zoom cho ngày hôm nay</h2>
        <p className="text-lg text-primary font-semibold bg-muted p-4 rounded-md">
          {todayZoomLink}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">
            <span className="text-primary">Admin Panel</span> - 99 Days Challenge
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "dashboard" && dashboardContent}

        {activeTab === "applicants" && (
          <ApplicantTable
            applicants={applicants}
            isLoading={loading}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {activeTab === "members" &&
          (loading ? (
            <div className="bg-card p-6 rounded-xl shadow-lg text-center text-muted-foreground">
              Dang tai danh sach thanh vien...
            </div>
          ) : (
            <MemberTable members={members} onRemove={handleRemoveMember} />
          ))}

        {activeTab === "settings" && (
          <div className="bg-card p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Quản lý Danh sách Link Zoom</h2>
            <Textarea
              rows={15}
              value={zoomLinksText}
              onChange={(e) => setZoomLinksText(e.target.value)}
              placeholder="Dán danh sách link, mỗi link một dòng..."
              className="w-full mb-4"
            />
            <Button
              onClick={handleUpdateZoomLinks}
              className="w-full bg-primary text-primary-foreground hover:bg-primary-hover font-semibold"
            >
              Lưu Danh Sách Link
            </Button>
          </div>
        )}
      </main>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
      />
    </div>
  );
};

export default Index;
