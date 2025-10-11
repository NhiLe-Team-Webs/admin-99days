import { useState, useEffect, useCallback, useMemo } from "react";
import { Users, FileText, Link2, Send, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listZoomLinks,
  syncZoomLinks,
  getDailyZoomLinkForDate,
  assignZoomLinkForDate,
  markDailyZoomLinkSent,
  getAdminSettings,
  updateAdminSettings,
} from "@/lib/api";
import type {
  Applicant,
  Member,
  ZoomLink,
  DailyZoomLinkWithDetails,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { canSendTelegram, sendTelegramMessage } from "@/lib/telegram";

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

const DEFAULT_SEND_TIME = "07:00";

const getTodayDate = () => new Date().toISOString().split("T")[0];

const formatVietnamDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

  const [zoomLinks, setZoomLinks] = useState<ZoomLink[]>([]);
  const [zoomLinksText, setZoomLinksText] = useState("");
  const [dailyZoomLink, setDailyZoomLink] =
    useState<DailyZoomLinkWithDetails | null>(null);
  const [zoomLinksSaving, setZoomLinksSaving] = useState(false);

  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramSendTime, setTelegramSendTime] = useState(DEFAULT_SEND_TIME);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);

  const ensureTodayZoomLink = useCallback(
    async (availableLinks: ZoomLink[]) => {
      if (availableLinks.length === 0) {
        setDailyZoomLink(null);
        return;
      }

      const today = getTodayDate();

      try {
        let daily = await getDailyZoomLinkForDate(today);
        if (!daily || !daily.zoom_link) {
          const randomIndex = Math.floor(Math.random() * availableLinks.length);
          const randomLink = availableLinks[randomIndex];
          daily = await assignZoomLinkForDate(randomLink.id, today);
        }
        setDailyZoomLink(daily);
      } catch (error) {
        console.error("Failed to resolve daily zoom link:", error);
        toast({
          title: "Lỗi",
          description: "Không thể lấy link Zoom cho hôm nay.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [applicantsData, membersData, zoomLinkData, settingsData] =
        await Promise.all([
          getApplicants("pending"),
          getMembers(),
          listZoomLinks(),
          getAdminSettings([
            "telegram_bot_token",
            "telegram_chat_id",
            "telegram_send_time",
          ]),
        ]);

      setApplicants(sortApplicantsByNewest(applicantsData));
      setMembers(sortMembersByRecentApproval(membersData));
      setZoomLinks(zoomLinkData);

      const formattedText = zoomLinkData.map((link) => link.url).join("\n");
      setZoomLinksText(formattedText);

      const settingsMap = new Map(settingsData.map((item) => [item.key, item.value]));
      setTelegramBotToken(settingsMap.get("telegram_bot_token") ?? "");
      setTelegramChatId(settingsMap.get("telegram_chat_id") ?? "");
      const sendTime = settingsMap.get("telegram_send_time") ?? DEFAULT_SEND_TIME;
      setTelegramSendTime(sendTime || DEFAULT_SEND_TIME);

      await ensureTodayZoomLink(zoomLinkData);
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
  }, [ensureTodayZoomLink, toast]);

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
    if (!dailyZoomLink || !dailyZoomLink.zoom_link) {
      return;
    }

    if (dailyZoomLink.telegram_sent_at) {
      return;
    }

    if (!canSendTelegram(telegramBotToken, telegramChatId)) {
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(telegramSendTime)) {
      return;
    }

    const [hourStr, minuteStr] = telegramSendTime.split(":");
    const hours = Number(hourStr);
    const minutes = Number(minuteStr);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return;
    }

    const scheduledAt = new Date(`${dailyZoomLink.scheduled_for}T00:00:00`);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const delay = scheduledAt.getTime() - now.getTime();

    if (delay <= 0) {
      void handleSendToTelegram();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleSendToTelegram();
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [
    dailyZoomLink,
    telegramSendTime,
    telegramBotToken,
    telegramChatId,
    handleSendToTelegram,
  ]);

  useEffect(() => {
    setZoomLinksText(zoomLinks.map((link) => link.url).join("\n"));
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

  const handleUpdateZoomLinks = async () => {
    const links = zoomLinksText
      .split("\n")
      .map((link) => link.trim())
      .filter((link) => link.length > 0);

    try {
      setZoomLinksSaving(true);
      const updatedLinks = await syncZoomLinks(links);
      setZoomLinks(updatedLinks);
      setZoomLinksText(updatedLinks.map((item) => item.url).join("\n"));
      await ensureTodayZoomLink(updatedLinks);
      toast({
        title: "Cập nhật thành công",
        description: `Đã lưu thành công ${updatedLinks.length} link Zoom!`,
      });
    } catch (error) {
      console.error("Failed to update zoom links:", error);
      toast({
        title: "Lỗi",
        description: "Không thể lưu danh sách link Zoom.",
        variant: "destructive",
      });
    } finally {
      setZoomLinksSaving(false);
    }
  };

  const todayZoomLink = useMemo(
    () => dailyZoomLink?.zoom_link?.url ?? "Chưa có link nào được thiết lập.",
    [dailyZoomLink]
  );

  const scheduledDateLabel = useMemo(
    () => formatVietnamDate(dailyZoomLink?.scheduled_for ?? getTodayDate()),
    [dailyZoomLink]
  );

  const telegramStatusLabel = useMemo(() => {
    if (!dailyZoomLink?.zoom_link) {
      return "Chưa có link Zoom để gửi.";
    }

    if (!canSendTelegram(telegramBotToken, telegramChatId)) {
      return "Chưa cấu hình Bot Token hoặc Chat ID.";
    }

    if (dailyZoomLink.telegram_sent_at) {
      return `Đã gửi Telegram lúc ${formatTime(dailyZoomLink.telegram_sent_at)}.`;
    }

    return "Chưa gửi lên Telegram.";
  }, [dailyZoomLink, telegramBotToken, telegramChatId]);

  const telegramStatusClass = useMemo(() => {
    if (!dailyZoomLink?.zoom_link) {
      return "text-muted-foreground";
    }

    if (dailyZoomLink.telegram_sent_at) {
      return "text-success";
    }

    if (!canSendTelegram(telegramBotToken, telegramChatId)) {
      return "text-warning";
    }

    return "text-info";
  }, [dailyZoomLink, telegramBotToken, telegramChatId]);

  const handleJoinZoomNow = () => {
    if (!dailyZoomLink?.zoom_link?.url) {
      return;
    }

    window.open(dailyZoomLink.zoom_link.url, "_blank", "noopener,noreferrer");
  };

  const handleSaveTelegramSettings = async () => {
    if (!/^\d{2}:\d{2}$/.test(telegramSendTime)) {
      toast({
        title: "Giờ gửi không hợp lệ",
        description: "Vui lòng nhập giờ theo định dạng HH:MM.",
        variant: "destructive",
      });
      return;
    }

    try {
      setTelegramSaving(true);
      await updateAdminSettings({
        telegram_bot_token: telegramBotToken,
        telegram_chat_id: telegramChatId,
        telegram_send_time: telegramSendTime,
      });
      toast({
        title: "Đã lưu cài đặt",
        description: "Thông tin gửi Telegram đã được cập nhật.",
      });
    } catch (error) {
      console.error("Failed to save telegram settings:", error);
      toast({
        title: "Lỗi",
        description: "Không thể lưu cài đặt Telegram.",
        variant: "destructive",
      });
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleSendToTelegram = useCallback(async () => {
    if (!dailyZoomLink || !dailyZoomLink.zoom_link) {
      toast({
        title: "Chưa có link Zoom",
        description: "Hãy thiết lập danh sách link Zoom trước khi gửi.",
        variant: "destructive",
      });
      return;
    }

    if (telegramSending) {
      return;
    }

    if (!canSendTelegram(telegramBotToken, telegramChatId)) {
      toast({
        title: "Thiếu thông tin Telegram",
        description: "Vui lòng nhập đầy đủ Bot Token và Chat ID để gửi tin nhắn.",
        variant: "destructive",
      });
      return;
    }

    const message = `Link Zoom cho ngày ${formatVietnamDate(
      dailyZoomLink.scheduled_for
    )}:\n${dailyZoomLink.zoom_link.url}`;

    try {
      setTelegramSending(true);
      await sendTelegramMessage({
        token: telegramBotToken.trim(),
        chatId: telegramChatId.trim(),
        text: message,
      });
      const updated = await markDailyZoomLinkSent(dailyZoomLink.id);
      setDailyZoomLink(updated);
      toast({
        title: "Đã gửi lên Telegram",
        description: "Link Zoom ngày hôm nay đã được gửi thành công.",
      });
    } catch (error) {
      console.error("Failed to send telegram message:", error);
      toast({
        title: "Lỗi",
        description: "Không thể gửi tin nhắn Telegram.",
        variant: "destructive",
      });
    } finally {
      setTelegramSending(false);
    }
  }, [
    dailyZoomLink,
    telegramBotToken,
    telegramChatId,
    telegramSending,
    toast,
  ]);

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
      <div className="bg-card p-6 rounded-xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Link Zoom cho ngày hôm nay</h2>
            <p className="text-sm text-muted-foreground">Ngày {scheduledDateLabel}</p>
          </div>
          <Button
            onClick={handleJoinZoomNow}
            disabled={!dailyZoomLink?.zoom_link}
            className="md:w-auto"
          >
            Tham gia ngay
          </Button>
        </div>
        <p className="text-lg text-primary font-semibold bg-muted p-4 rounded-md break-words">
          {todayZoomLink}
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>Giờ gửi tự động: {telegramSendTime || "Chưa thiết lập"}</span>
          </div>
          <div className={`text-sm font-medium ${telegramStatusClass}`}>
            {telegramStatusLabel}
          </div>
          <div className="md:col-span-2 lg:col-span-1 flex md:justify-end">
            <Button
              variant="outline"
              onClick={handleSendToTelegram}
              disabled={!dailyZoomLink?.zoom_link || telegramSending}
              className="w-full md:w-auto"
            >
              <Send className="w-4 h-4 mr-2" />
              {telegramSending ? "Đang gửi..." : "Gửi lên Telegram"}
            </Button>
          </div>
        </div>
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
              disabled={zoomLinksSaving}
              className="w-full font-semibold"
            >
              {zoomLinksSaving ? "Đang lưu..." : "Lưu Danh Sách Link"}
            </Button>
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold">Cài đặt gửi Telegram</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telegram-bot-token">Telegram Bot Token</Label>
                  <Input
                    id="telegram-bot-token"
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456:ABCDEF..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegram-chat-id">Telegram Chat ID</Label>
                  <Input
                    id="telegram-chat-id"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="-1001234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegram-send-time">Giờ gửi tự động (HH:MM)</Label>
                  <Input
                    id="telegram-send-time"
                    type="time"
                    value={telegramSendTime}
                    onChange={(e) => setTelegramSendTime(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveTelegramSettings}
                disabled={telegramSaving}
                variant="secondary"
                className="w-full md:w-auto"
              >
                {telegramSaving ? "Đang lưu cài đặt..." : "Lưu Cài Đặt Telegram"}
              </Button>
            </div>
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
