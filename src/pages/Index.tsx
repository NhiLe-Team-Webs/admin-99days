import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveApplicant,
  assignZoomLinkForDate,
  checkAndDropInactiveMembers,
  dropMember,
  getAdminSettings,
  getApplicants,
  getDailyZoomLinkForDate,
  getMembers,
  listZoomLinks,
  markDailyZoomLinkSent,
  restoreMember,
  syncZoomLinks,
  updateAdminSettings,
  updateApplicantStatus,
} from "@/lib/api";
import type {
  Applicant,
  DailyZoomLinkWithDetails,
  Member,
  ZoomLink,
} from "@/lib/api";
import type { ProgressUpdate } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TabNavigation } from "@/components/TabNavigation";
import { StatsCard } from "@/components/StatsCard";
import { ApplicantTable } from "@/components/ApplicantTable";
import { MemberTable } from "@/components/MemberTable";
import { MemberDetailSheet } from "@/components/MemberDetailSheet";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { supabase } from "@/lib/supabase";
import { canSendTelegram, sendTelegramMessage } from "@/lib/telegram";
import { StatusFilter } from "@/components/StatusFilter";
import { useAuth } from "@/contexts/auth-context";

interface StatusFilterProps {
  value: "all" | "active" | "dropped";
  onChange: (value: "all" | "active" | "dropped") => void;
}

const tabs = [
  { id: "dashboard", label: "Bảng điều khiển" },
  { id: "applicants", label: "Đơn đăng ký mới" },
  { id: "members", label: "Tất cả thành viên" },
  { id: "settings", label: "Cài đặt" },
];

const sortApplicantsByNewest = (items: Applicant[]) =>
  [...items].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
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
const TELEGRAM_BOT_TOKEN = (import.meta.env.VITE_TELEGRAM_BOT_TOKEN ?? "").trim();
const TELEGRAM_CHAT_ID = (import.meta.env.VITE_TELEGRAM_GROUP_ID ?? "").trim();
const TELEGRAM_DEFAULT_SEND_TIME =
  (import.meta.env.VITE_TELEGRAM_SEND_TIME ?? DEFAULT_SEND_TIME).trim() || DEFAULT_SEND_TIME;
const TELEGRAM_AUTOSEND_ENABLED = false;

const getTodayDate = () => new Date().toISOString().split("T")[0];
const formatVietnamDate = (dateString: string) => new Date(`${dateString}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });


const Index = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
 const [memberProgress, setMemberProgress] = useState<Record<string, ProgressUpdate[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "dropped">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => { },
  });

  const [zoomLinks, setZoomLinks] = useState<ZoomLink[]>([]);
  const [zoomLinksText, setZoomLinksText] = useState("");
  const [dailyZoomLink, setDailyZoomLink] =
    useState<DailyZoomLinkWithDetails | null>(null);
  const [zoomLinksSaving, setZoomLinksSaving] = useState(false);

  const [telegramSendTime, setTelegramSendTime] = useState(TELEGRAM_DEFAULT_SEND_TIME);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);
  const [programStartDate, setProgramStartDate] = useState("");
  const [programStartDateDraft, setProgramStartDateDraft] = useState("");
  const [programStartDateSaving, setProgramStartDateSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const hasTelegramConfig =
    TELEGRAM_AUTOSEND_ENABLED && canSendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);

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
          title: "Không tạo được link Zoom hôm nay",
          description: "Vui lòng kiểm tra danh sách link trong Cài đặt.",
          variant: "destructive",
        });
      }
    },
    [assignZoomLinkForDate, getDailyZoomLinkForDate, toast]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [applicantsData, membersData, zoomLinkData, settingsData] = await Promise.all([
        getApplicants("pending"),
        getMembers(statusFilter === "all" ? undefined : statusFilter),
        listZoomLinks(),
        getAdminSettings(["telegram_send_time", "program_start_date"]),
      ]);

      const memberEmails = new Set(
        membersData.map((member) => member.email.toLowerCase())
      );

      const filteredApplicants = applicantsData.filter((applicant) => {
        if (applicant.status && applicant.status !== "pending") {
          return false;
        }
        const email = applicant.email?.toLowerCase();
        return email ? !memberEmails.has(email) : true;
      });

      setApplicants(sortApplicantsByNewest(filteredApplicants));
      setMembers(sortMembersByRecentApproval(membersData));
      setZoomLinks(zoomLinkData);
      setZoomLinksText(zoomLinkData.map((link) => link.url).join("\n"));

      const settingsMap = new Map(settingsData.map((item) => [item.key, item.value]));
      const sendTime = settingsMap.get("telegram_send_time") ?? TELEGRAM_DEFAULT_SEND_TIME;
      setTelegramSendTime(sendTime || TELEGRAM_DEFAULT_SEND_TIME);

      const startDate = settingsMap.get("program_start_date") ?? "";
      setProgramStartDate(startDate);
      setProgramStartDateDraft(startDate);

      await ensureTodayZoomLink(zoomLinkData);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      toast({
        title: "Không tải được dữ liệu",
        description: "Vui lòng kiểm tra cấu hình Supabase.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [approveApplicant, assignZoomLinkForDate, checkAndDropInactiveMembers, dropMember, getAdminSettings, getApplicants, getDailyZoomLinkForDate, getMembers, listZoomLinks, markDailyZoomLinkSent, restoreMember, sortApplicantsByNewest, sortMembersByRecentApproval, syncZoomLinks, toast, updateAdminSettings, updateApplicantStatus, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedApplicantIds((prev) => {
      const next = prev.filter((id) => applicants.some((applicant) => applicant.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [applicants]);

  useEffect(() => {
    if (!memberDetailOpen || !selectedMemberId) {
      return;
    }

    const exists = members.some((member) => member.id === selectedMemberId);
    if (!exists) {
      setMemberDetailOpen(false);
      setSelectedMemberId(null);
    }
  }, [members, memberDetailOpen, selectedMemberId]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "applicants" }, (payload) => {
        const newApplicant = payload.new as Applicant | null;
        if (!newApplicant || newApplicant.status !== "pending") return;
        setApplicants((prev) =>
          sortApplicantsByNewest([
            newApplicant,
            ...prev.filter((applicant) => applicant.id !== newApplicant.id),
          ])
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applicants" }, (payload) => {
        const updatedApplicant = payload.new as Applicant | null;
        if (!updatedApplicant) return;
        setApplicants((prev) => {
          const remaining = prev.filter((applicant) => applicant.id !== updatedApplicant.id);
          if (updatedApplicant.status === "pending") {
            return sortApplicantsByNewest([updatedApplicant, ...remaining]);
          }
          return remaining;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "applicants" }, (payload) => {
        const removedApplicant = payload.old as Applicant | null;
        if (!removedApplicant) return;
        setApplicants((prev) =>
          prev.filter((applicant) => applicant.id !== removedApplicant.id)
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "members" }, (payload) => {
        const newMember = payload.new as Member | null;
        if (!newMember || newMember.status !== "active") return;
        setMembers((prev) =>
          sortMembersByRecentApproval([
            newMember,
            ...prev.filter((member) => member.id !== newMember.id),
          ])
        );
        setApplicants((prev) =>
          prev.filter((applicant) =>
            applicant.email?.toLowerCase() !== newMember.email.toLowerCase()
          )
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members" }, (payload) => {
        const updatedMember = payload.new as Member | null;
        if (!updatedMember) return;
        setMembers((prev) => {
          const remaining = prev.filter((member) => member.id !== updatedMember.id);
          if (updatedMember.status === "active") {
            return sortMembersByRecentApproval([updatedMember, ...remaining]);
          }
          return remaining;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sortMembersByRecentApproval]);

  useEffect(() => {
    setZoomLinksText(zoomLinks.map((link) => link.url).join("\n"));
  }, [zoomLinks]);

  const showConfirmModal = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>
  ) => {
    setConfirmModal({ isOpen: true, title, description, onConfirm });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, title: "", description: "", onConfirm: () => { } });
  };

  const toggleApplicantSelection = (id: string, checked: boolean) => {
    setSelectedApplicantIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((selectedId) => selectedId !== id);
    });
  };

  const toggleSelectAllApplicants = (checked: boolean) => {
    if (checked) {
      setSelectedApplicantIds(applicants.map((applicant) => applicant.id));
    } else {
      setSelectedApplicantIds([]);
    }
  };

  const bulkApproveApplicants = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkApproving(true);
    try {
      const results = await Promise.allSettled(ids.map((applicantId) => approveApplicant(applicantId)));
      const succeededIds = ids.filter((_, index) => results[index].status === "fulfilled");
      const failedCount = results.length - succeededIds.length;

      if (succeededIds.length > 0) {
        setApplicants((prev) => prev.filter((applicant) => !succeededIds.includes(applicant.id)));
        setSelectedApplicantIds((prev) =>
          prev.filter((selectedId) => !succeededIds.includes(selectedId))
        );
        toast({
          title: "Da duyet ho so",
          description: `Hoan thanh duyet ${succeededIds.length} ho so.`,
        });
      }

      if (failedCount > 0) {
        toast({
          title: "Mot so ho so khong duoc duyet",
          description: "Vui long thu lai cac ho so loi.",
          variant: "destructive",
        });
      }

      await fetchData();
    } catch (error) {
      console.error("Failed to bulk approve applicants:", error);
      toast({
        title: "Loi",
        description: "Khong the duyet cac ho so da chon.",
        variant: "destructive",
      });
    } finally {
      setBulkApproving(false);
    }
  };

  const handleBulkApproveSelected = async () => {
    await bulkApproveApplicants(selectedApplicantIds);
  };

  const handleApproveAllApplicants = async () => {
    await bulkApproveApplicants(applicants.map((applicant) => applicant.id));
  };

  const handleApprove = async (id: string) => {
    try {
      await approveApplicant(id);
      setApplicants((prev) => prev.filter((applicant) => applicant.id !== id));
      setSelectedApplicantIds((prev) => prev.filter((selectedId) => selectedId !== id));
      toast({
        title: "Đã duyệt",
        description: "Hồ sơ đã được chuyển vào danh sách thành viên.",
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to approve applicant:", error);
      toast({
        title: "Lỗi",
        description: "Không thể duyệt đơn đăng ký.",
        variant: "destructive",
      });
    }
  };
  const handleReject = async (id: string, name: string) => {
    showConfirmModal(
      "Xác nhận từ chối",
      `Bạn có chắc chắn muốn từ chối đơn của <strong>${name}</strong>?`,
      async () => {
        try {
          await updateApplicantStatus(id, "rejected");
          setSelectedApplicantIds((prev) => prev.filter((selectedId) => selectedId !== id));
          toast({
            title: "Đã từ chối",
            description: "Đơn đăng ký đã được cập nhật.",
            variant: "destructive",
          });
          await fetchData();
        } catch (error) {
          console.error("Failed to reject applicant:", error);
          toast({
            title: "Lỗi",
            description: "Không thể cập nhật trạng thái đơn đăng ký.",
            variant: "destructive",
          });
        } finally {
          closeConfirmModal();
        }
      }
    );
  };

  const handleRemoveMember = (id: string, reason: string) => {
    showConfirmModal(
      "Xác nhận loại bỏ",
      "Bạn chắc chắn muốn loại bỏ thành viên này khỏi chương trình?",
      async () => {
        try {
          await dropMember(id, reason);
          toast({
            title: "Đã loại bỏ thành viên",
            description: "Thành viên đã được gỡ khỏi danh sách.",
            variant: "destructive",
          });
          await fetchData();
        } catch (error) {
          console.error("Failed to drop member:", error);
          toast({
            title: "Lỗi",
            description: "Không thể cập nhật danh sách thành viên.",
            variant: "destructive",
          });
        } finally {
          closeConfirmModal();
        }
      }
    );
  };

  const handleRestoreMember = (id: string) => {
    showConfirmModal(
      "Khôi phục thành viên",
      "Bạn có muốn khôi phục thành viên này về trạng thái đang tham gia?",
      async () => {
        try {
          await restoreMember(id);
          toast({
            title: "Đã khôi phục thành viên",
            description: "Thành viên đã được đưa trở lại danh sách hoạt động.",
          });
          await fetchData();
        } catch (error) {
          console.error("Failed to restore member:", error);
          toast({
            title: "Lỗi",
            description: "Không thể khôi phục thành viên.",
            variant: "destructive",
          });
        } finally {
          closeConfirmModal();
        }
      }
    );
  };

  const handleUpdateZoomLinks = async () => {
    try {
      setZoomLinksSaving(true);
      const updatedLinks = await syncZoomLinks(zoomLinksText.split("\n"));
      setZoomLinks(updatedLinks);
      toast({
        title: "Đã lưu danh sách Zoom",
        description: `Đã cập nhật danh sách link.`,
      });
      await ensureTodayZoomLink(updatedLinks);
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
      await updateAdminSettings({ telegram_send_time: telegramSendTime });
      toast({
        title: "Đã cập nhật giờ gửi",
        description: "Bot sẽ gửi link đúng giờ mới thiết lập.",
      });
    } catch (error) {
      console.error("Failed to save telegram time:", error);
      toast({
        title: "Lỗi",
        description: "Không thể lưu giờ gửi tự động.",
        variant: "destructive",
      });
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleOpenZoomLink = useCallback(() => {
    const url = dailyZoomLink?.zoom_link?.url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [dailyZoomLink]);

  const handleCopyZoomLink = useCallback(async () => {
    const url = dailyZoomLink?.zoom_link?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Đã sao chép link Zoom",
        description: "Bạn có thể gửi link cho thành viên ngay bây giờ.",
      });
    } catch (error) {
      console.error("Failed to copy zoom link:", error);
      toast({
        title: "Không thể sao chép",
        description: "Trình duyệt không hỗ trợ sao chép tự động.",
        variant: "destructive",
      });
    }
  }, [dailyZoomLink, toast]);

  const handleSendToTelegram = useCallback(async () => {
    if (!TELEGRAM_AUTOSEND_ENABLED) {
      return;
    }

    if (!dailyZoomLink || !dailyZoomLink.zoom_link) {
      toast({
        title: "Chưa có link Zoom",
        description: "Hãy thêm ít nhất một link trong phần Cài đặt.",
        variant: "destructive",
      });
      return;
    }

    if (telegramSending || !hasTelegramConfig) {
      return;
    }

    const message = "Link Zoom cho ngày:\n";

    try {
      setTelegramSending(true);
      await sendTelegramMessage({
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID,
        text: message,
      });
      const updated = await markDailyZoomLinkSent(dailyZoomLink.id);
      setDailyZoomLink(updated);
      toast({
        title: "Đã gửi lên Telegram",
        description: "Link Zoom ngày hôm nay đã được gửi tự động.",
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
  }, [dailyZoomLink, hasTelegramConfig, telegramSending, toast]);

  useEffect(() => {
    if (!TELEGRAM_AUTOSEND_ENABLED) {
      return;
    }

    if (!dailyZoomLink || !dailyZoomLink.zoom_link) {
      return;
    }

    if (dailyZoomLink.telegram_sent_at) {
      return;
    }

    if (!hasTelegramConfig) {
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
  }, [dailyZoomLink, telegramSendTime, hasTelegramConfig, handleSendToTelegram]);

  const scheduledDateLabel = useMemo(() => {
    if (dailyZoomLink?.scheduled_for) {
      return formatVietnamDate(dailyZoomLink.scheduled_for);
    }
    return formatVietnamDate(getTodayDate());
  }, [dailyZoomLink]);
  const todaysZoomUrl = dailyZoomLink?.zoom_link?.url ?? "";
  const hasZoomLinkForToday = Boolean(todaysZoomUrl);
  const isProgramStartDateChanged = programStartDateDraft !== programStartDate;
  const formattedProgramStartDate = useMemo(() => {
    if (!programStartDate) {
      return "";
    }
    return formatVietnamDate(programStartDate);
  }, [programStartDate]);

  const handleSaveProgramStartDate = () => {
    if (!programStartDateDraft) {
      toast({
        title: "Ngày bắt đầu không hợp lệ",
        description: "Vui lòng chọn ngày trước khi lưu.",
        variant: "destructive",
      });
      return;
    }

    const formattedDate = formatVietnamDate(programStartDateDraft);

    showConfirmModal(
      "Xác nhận cập nhật ngày bắt đầu",
      `Bạn có chắc chắn muốn thiết lập ngày bắt đầu là <strong>${formattedDate}</strong>?`,
      async () => {
        const newStartDate = programStartDateDraft;

        try {
          setProgramStartDateSaving(true);
          await updateAdminSettings({ program_start_date: newStartDate });
          setProgramStartDate(newStartDate);
          toast({
            title: "Đã cập nhật ngày bắt đầu",
            description: "Thông tin ngày bắt đầu chương trình đã được lưu lại.",
          });
        } catch (error) {
          console.error("Failed to save program start date:", error);
          toast({
            title: "Lỗi",
            description: "Không thể lưu ngày bắt đầu. Vui lòng thử lại.",
            variant: "destructive",
          });
        } finally {
          setProgramStartDateSaving(false);
          closeConfirmModal();
        }
      }
    );
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      toast({
        title: "Đăng xuất thất bại",
        description: "Vui lòng thử lại sau ít phút.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const dashboardContent = loading ? (
    <div className="text-center py-8 text-muted-foreground">Đang tải dữ liệu...</div>
  ) : (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 sm:gap-6">
        <StatsCard
          title="Tổng thành viên"
          value={members.length}
          icon={Users}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
        <StatsCard
          title="Đơn chờ duyệt"
          value={applicants.length}
          icon={FileText}
          iconBgColor="bg-sky-100"
          iconColor="text-sky-600"
        />
        <StatsCard
          title="Link Zoom đang lưu"
          value={zoomLinks.length}
          icon={Link2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
        />
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Link Zoom ngẫu nhiên hôm nay</h3>
            <p className="text-sm text-muted-foreground">Dành cho ngày {scheduledDateLabel}.</p>
            {hasZoomLinkForToday ? (
              <div className="break-all rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
                {todaysZoomUrl}
              </div>
            ) : (
              <p className="text-sm text-amber-600">
                Chưa có link Zoom khả dụng. Hãy cập nhật trong tab Cài đặt.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:w-auto sm:flex-row">
            <Button onClick={handleOpenZoomLink} disabled={!hasZoomLinkForToday}>
              Mở Zoom
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyZoomLink}
              disabled={!hasZoomLinkForToday}
            >
              Sao chép link Zoom
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              Bảng điều khiển quản trị
            </h1>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:text-sm">
                {user?.email ?? "Admin"}
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? "Đang đăng xuất..." : "Đăng xuất"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "dashboard" && dashboardContent}

        {activeTab === "applicants" && (
          <ApplicantTable
            applicants={applicants}
            isLoading={loading}
            onApprove={handleApprove}
            onReject={handleReject}
            selectedApplicantIds={selectedApplicantIds}
            onToggleSelect={toggleApplicantSelection}
            onToggleSelectAll={toggleSelectAllApplicants}
            onBulkApproveSelected={handleBulkApproveSelected}
            onApproveAll={handleApproveAllApplicants}
            bulkApproving={bulkApproving}
          />
        )}

        {activeTab === "members" && (
          loading ? (
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 text-center text-muted-foreground">
              Đang tải danh sách thành viên...
            </div>
          ) : (
            <>
              <StatusFilter
                value={statusFilter}
                onChange={(value: "all" | "active" | "dropped") => setStatusFilter(value)}
              />
              <MemberTable
                members={members}
                onDrop={handleRemoveMember}
                onRestore={handleRestoreMember}
                onSelect={(member) => {
                  setSelectedMemberId(member.id);
                  setMemberDetailOpen(true);
                }}
              />
            </>
          )
        )}

        {activeTab === "settings" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-5 shadow-sm space-y-3 sm:p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Zoom & Telegram tạm ẩn</h3>
              <p className="text-sm text-muted-foreground">
                Việc cấu hình danh sách link Zoom và giờ gửi Telegram đã được vô hiệu hóa theo yêu cầu.
                Các link hiện có vẫn được giữ nguyên, nhưng hệ thống sẽ không gửi tự động lên Telegram.
              </p>
              <p className="text-sm text-muted-foreground">
                Liên hệ đội kỹ thuật nếu cần mở lại tính năng này trong tương lai.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 sm:p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Ngày bắt đầu chương trình</h3>
              <p className="text-sm text-muted-foreground">
                Chọn ngày chính thức bắt đầu để đồng bộ với các hệ thống khác.
              </p>
              <div className="space-y-2">
                <Label htmlFor="program-start-date">Ngày bắt đầu chương trình</Label>
                <Input
                  id="program-start-date"
                  type="date"
                  value={programStartDateDraft}
                  onChange={(e) => setProgramStartDateDraft(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSaveProgramStartDate}
                disabled={!isProgramStartDateChanged || programStartDateSaving || !programStartDateDraft}
                className="w-full sm:w-auto"
              >
                {programStartDateSaving
                  ? "Đang lưu ngày bắt đầu..."
                  : programStartDate
                    ? "Cập nhật ngày bắt đầu"
                    : "Lưu ngày bắt đầu"}
              </Button>
              {formattedProgramStartDate && (
                <p className="text-sm text-muted-foreground">
                  Ngày đang áp dụng: <span className="font-medium text-slate-900">{formattedProgramStartDate}</span>
                </p>
              )}
            </div>

            {/*
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Danh sách link Zoom</h3>
              <p className="text-sm text-muted-foreground">
                Nhập tối đa 7 link (mỗi dòng một link). Hệ thống sẽ chọn ngẫu nhiên mỗi sáng.
              </p>
              <Textarea
                rows={12}
                value={zoomLinksText}
                onChange={(e) => setZoomLinksText(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="font-mono"
              />
              <Button onClick={handleUpdateZoomLinks} disabled={zoomLinksSaving}>
                {zoomLinksSaving ? "Đang lưu..." : "Lưu danh sách"}
              </Button>
            </div>
            */}

            {/*
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">Giờ gửi Telegram</h3>
              <div className="space-y-2">
                <Label htmlFor="telegram-send-time">Giờ gửi tự động (HH:MM)</Label>
                <Input
                  id="telegram-send-time"
                  type="time"
                  value={telegramSendTime}
                  onChange={(e) => setTelegramSendTime(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSaveTelegramSettings}
                disabled={telegramSaving}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-300"
              >
                {telegramSaving ? "Đang lưu giờ gửi..." : "Thêm giờ gửi"}
              </Button>
            </div>
            */}
          </div>
        )}

      </main>

      <MemberDetailSheet
        member={selectedMember}
        open={memberDetailOpen && !!selectedMember}
        onOpenChange={(open) => {
          setMemberDetailOpen(open);
          if (!open) {
            setSelectedMemberId(null);
          }
        }}
      />

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
