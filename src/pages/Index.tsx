import { useState, useEffect } from "react";
import { Users, FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TabNavigation } from "@/components/TabNavigation";
import { StatsCard } from "@/components/StatsCard";
import { ApplicantTable, type Applicant } from "@/components/ApplicantTable";
import { MemberTable, type Member } from "@/components/MemberTable";
import { ConfirmationModal } from "@/components/ConfirmationModal";

const tabs = [
  { id: "dashboard", label: "Bảng điều khiển" },
  { id: "applicants", label: "Đơn Đăng Ký Mới" },
  { id: "members", label: "Tất Cả Thành Viên" },
  { id: "settings", label: "Cài đặt" },
];

const Index = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
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

  // Sample data
  const [applicants, setApplicants] = useState<Applicant[]>([
    {
      id: 101,
      name: "Trịnh Văn Quyết",
      email: "quyet.trinh@email.com",
      telegram: "@quyettrinh",
      reason: "Muốn cải thiện sức khỏe và kỷ luật bản thân.",
    },
    {
      id: 102,
      name: "Đỗ Thị Hà",
      email: "ha.do@email.com",
      telegram: "@hado",
      reason: "Bạn bè giới thiệu, muốn tham gia cùng cộng đồng.",
    },
  ]);

  const [members, setMembers] = useState<Member[]>([
    {
      id: 1,
      name: "Nguyễn Văn An",
      email: "an.nguyen@email.com",
      telegram: "@annguyen",
      joinDate: "2025-08-20",
    },
    {
      id: 2,
      name: "Trần Thị Bình",
      email: "binh.tran@email.com",
      telegram: "@binhtran",
      joinDate: "2025-08-20",
    },
    {
      id: 3,
      name: "Lê Văn Cường",
      email: "cuong.le@email.com",
      telegram: "@cuongle",
      joinDate: "2025-08-21",
    },
  ]);

  const [zoomLinks, setZoomLinks] = useState<string[]>([
    "https://zoom.us/j/1111111111?pwd=DAY1",
    "https://zoom.us/j/2222222222?pwd=DAY2",
    "https://zoom.us/j/3333333333?pwd=DAY3",
  ]);

  const [zoomLinksText, setZoomLinksText] = useState("");

  useEffect(() => {
    setZoomLinksText(zoomLinks.join("\n"));
  }, [zoomLinks]);

  const showConfirmModal = (title: string, description: string, onConfirm: () => void) => {
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

  const handleApprove = (id: number) => {
    const applicant = applicants.find((app) => app.id === id);
    if (applicant) {
      const newMember: Member = {
        id: applicant.id,
        name: applicant.name,
        email: applicant.email,
        telegram: applicant.telegram,
        phone: applicant.phone,
        joinDate: new Date().toISOString().split("T")[0],
      };
      setMembers((prev) => [...prev, newMember]);
      setApplicants((prev) => prev.filter((app) => app.id !== id));
      toast({
        title: "Đã duyệt thành công",
        description: `${applicant.name} đã được thêm vào danh sách thành viên.`,
      });
    }
  };

  const handleReject = (id: number, name: string) => {
    showConfirmModal(
      "Xác nhận từ chối",
      `Bạn có chắc muốn từ chối đơn của <strong>${name}</strong>?`,
      () => {
        setApplicants((prev) => prev.filter((app) => app.id !== id));
        toast({
          title: "Đã từ chối đơn đăng ký",
          description: `Đơn đăng ký của ${name} đã bị từ chối.`,
          variant: "destructive",
        });
        closeConfirmModal();
      }
    );
  };

  const handleRemoveMember = (id: number, name: string) => {
    showConfirmModal(
      "Xác nhận loại bỏ",
      `Bạn có chắc muốn loại bỏ thành viên <strong>${name}</strong>?`,
      () => {
        setMembers((prev) => prev.filter((member) => member.id !== id));
        toast({
          title: "Đã loại bỏ thành viên",
          description: `${name} đã được loại bỏ khỏi danh sách thành viên.`,
          variant: "destructive",
        });
        closeConfirmModal();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">
            <span className="text-primary">Admin Panel</span> - 99 Days Challenge
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
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
        )}

        {/* Applicants Tab */}
        {activeTab === "applicants" && (
          <ApplicantTable
            applicants={applicants}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <MemberTable members={members} onRemove={handleRemoveMember} />
        )}

        {/* Settings Tab */}
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
