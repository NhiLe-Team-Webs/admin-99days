import { useEffect, useMemo, useState, type ReactNode } from "react";
import { differenceInCalendarDays, format } from "date-fns";

import {
  type GratitudeEntry,
  type HomeworkSubmission,
  type Member,
  type ProgressUpdate,
  getMemberGratitudeEntries,
  getMemberHomeworkSubmissions,
  getMemberProgressUpdates,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ActivityType = "gratitude" | "homework" | "progress";

interface MemberDetailSheetProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DailyActivityBucket {
  gratitude?: GratitudeEntry;
  homework?: HomeworkSubmission;
  progress?: ProgressUpdate;
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  gratitude: "bg-emerald-500",
  homework: "bg-indigo-500",
  progress: "bg-amber-500",
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  gratitude: "Biết ơn",
  homework: "Bài tập",
  progress: "Tiến độ",
};

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const parsed = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDisplayDate = (dateString: string) => {
  const parsed = toDateOnly(dateString) ?? toDateTime(dateString);
  return parsed ? format(parsed, "dd/MM/yyyy") : dateString;
};

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

const statusLabel = (status: Member["status"]) => {
  switch (status) {
    case "active":
      return "Đang tham gia";
    case "paused":
      return "Tạm dừng";
    case "dropped":
      return "Đã rời";
    default:
      return status;
  }
};

const normalizeDateKey = (value?: string | null) => {
  const parsed = toDateOnly(value) ?? toDateTime(value);
  return parsed ? format(parsed, "yyyy-MM-dd") : null;
};

export const MemberDetailSheet = ({ member, open, onOpenChange }: MemberDetailSheetProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const memberId = member?.id;

  useEffect(() => {
    if (!member || !open) {
      setGratitudeEntries([]);
      setHomeworkSubmissions([]);
      setProgressUpdates([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getMemberGratitudeEntries(member.id),
      getMemberHomeworkSubmissions(member.id),
      getMemberProgressUpdates(member.id),
    ])
      .then(([gratitude, homework, progress]) => {
        if (cancelled) return;
        setGratitudeEntries(gratitude);
        setHomeworkSubmissions(homework);
        setProgressUpdates(progress);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Failed to load member activity", err);
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải lịch sử hoạt động. Vui lòng thử lại.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [memberId, open, member]);

  useEffect(() => {
    if (!member) return;
    const initialMonth =
      toDateOnly(member.start_date) ??
      toDateTime(member.approved_at ?? member.created_at) ??
      new Date();
    setCurrentMonth(initialMonth);
  }, [memberId, member]);

  const startDate = useMemo(
    () => (member ? toDateOnly(member.start_date) ?? toDateTime(member.approved_at ?? member.created_at) : null),
    [member],
  );

  const dropDate = useMemo(() => {
    if (!member || member.status !== "dropped") return null;
    return toDateTime(member.updated_at ?? member.approved_at ?? member.created_at);
  }, [member]);

  const dropDayNumber = useMemo(() => {
    if (!startDate || !dropDate) return null;
    const diff = differenceInCalendarDays(
      new Date(dropDate.getFullYear(), dropDate.getMonth(), dropDate.getDate()),
      new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
    );
    return diff >= 0 ? diff + 1 : null;
  }, [startDate, dropDate]);

  const activityByDate = useMemo(() => {
    const map = new Map<string, DailyActivityBucket>();

    for (const entry of gratitudeEntries) {
      const key = normalizeDateKey(entry.entry_date);
      if (!key) continue;
      const bucket = map.get(key) ?? {};
      bucket.gratitude = entry;
      map.set(key, bucket);
    }

    for (const submission of homeworkSubmissions) {
      const key = normalizeDateKey(submission.submission_date);
      if (!key) continue;
      const bucket = map.get(key) ?? {};
      bucket.homework = submission;
      map.set(key, bucket);
    }

    for (const update of progressUpdates) {
      const key = normalizeDateKey(update.recorded_for ?? update.recorded_at);
      if (!key) continue;
      const bucket = map.get(key) ?? {};
      bucket.progress = update;
      map.set(key, bucket);
    }

    return map;
  }, [gratitudeEntries, homeworkSubmissions, progressUpdates]);

  const dayIndicators = useMemo(() => {
    const indicators = new Map<string, ActivityType[]>();
    activityByDate.forEach((bucket, date) => {
      const types: ActivityType[] = [];
      if (bucket.gratitude) types.push("gratitude");
      if (bucket.homework) types.push("homework");
      if (bucket.progress) types.push("progress");
      indicators.set(date, types);
    });
    return indicators;
  }, [activityByDate]);

  const calendarFromDate = startDate ?? new Date(new Date().getFullYear(), 0, 1);
  const calendarToDate =
    dropDate ??
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    );

  const renderDayContent = (props: { date: Date }) => {
    const indicatorsForDay = dayIndicators.get(dayKey(props.date)) ?? [];
    return (
      <div className="flex h-9 w-9 flex-col items-center justify-center">
        <span className="text-sm font-medium">{props.date.getDate()}</span>
        <div className="mt-1 flex gap-1">
          {indicatorsForDay.map((type) => (
            <span
              key={type}
              className={cn("h-1.5 w-1.5 rounded-full", ACTIVITY_COLORS[type])}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderHistoryItem = <T extends { created_at: string }>(
    items: T[],
    renderContent: (item: T) => ReactNode,
  ) => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
    }

    return (
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.created_at} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {renderContent(item)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open && !!member} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0"
      >
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-6 p-6">
            <SheetHeader>
              <SheetTitle>Chi tiết thành viên</SheetTitle>
              <SheetDescription>
                {member
                  ? `${member.ho_ten ?? member.email} · ${statusLabel(member.status)}`
                  : "Chọn một thành viên để xem thông tin chi tiết."}
              </SheetDescription>
            </SheetHeader>

            {member && (
              <>
                <Card>
                  <CardContent className="grid gap-4 py-6 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Họ tên</p>
                      <p className="text-base font-semibold text-foreground">
                        {member.ho_ten ?? "Chưa cập nhật"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Email</p>
                      <p className="text-base font-medium text-foreground">{member.email}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Telegram</p>
                      <p className="text-base text-foreground">{member.telegram ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.status === "dropped" ? "destructive" : "default"}>
                        {statusLabel(member.status)}
                      </Badge>
                      {dropDayNumber && (
                        <span className="text-sm text-muted-foreground">
                          Rời ở ngày thứ {dropDayNumber}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Ngày bắt đầu</p>
                      <p className="text-sm text-foreground">
                        {member.start_date
                          ? formatDisplayDate(member.start_date)
                          : member.approved_at
                            ? formatDisplayDate(member.approved_at)
                            : formatDisplayDate(member.created_at)}
                      </p>
                    </div>
                    {dropDate && (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Ngày rời</p>
                        <p className="text-sm text-foreground">
                          {format(dropDate, "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                    {member.drop_reason && (
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase text-muted-foreground">Lý do</p>
                        <p className="text-sm text-foreground">{member.drop_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Lịch hoạt động</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-6 lg:flex-row">
                      <Calendar
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        fromDate={calendarFromDate}
                        toDate={calendarToDate}
                        components={{ DayContent: renderDayContent }}
                        modifiers={{
                          dropDay: dropDate ? [dropDate] : [],
                                                     startDay: startDate ? [startDate] : [],
                                                   }}
                                                   onDayClick={(date) => {
                                                    setSelectedDate(date);
                                                   }}
                                                   modifiersClassNames={{
                                                     dropDay: "ring-2 ring-destructive text-destructive font-semibold",
                                                     startDay: "ring-2 ring-primary",
                        }}
                      />
                      <div className="flex-1 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Ghi chú màu sắc</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((type) => (
                              <span key={type} className="flex items-center gap-2">
                                <span
                                  className={cn("h-2.5 w-2.5 rounded-full", ACTIVITY_COLORS[type])}
                                />
                                {ACTIVITY_LABELS[type]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            Ngày bắt đầu:{" "}
                            <span className="font-medium text-foreground">
                              {startDate ? format(startDate, "dd/MM/yyyy") : "Không rõ"}
                            </span>
                          </p>
                          {dropDate ? (
                            <p>
                              Ngày rời:{" "}
                              <span className="font-medium text-foreground">
                                {format(dropDate, "dd/MM/yyyy")}
                              </span>
                            </p>
                          ) : (
                            <p>
                              Ngày hiện tại:{" "}
                              <span className="font-medium text-foreground">
                                {format(new Date(), "dd/MM/yyyy")}
                              </span>
                            </p>
                          )}
                          {dropDayNumber && (
                            <p>
                              Hoàn thành đến ngày:{" "}
                              <span className="font-medium text-foreground">
                                {dropDayNumber}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lịch sử biết ơn</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderHistoryItem(gratitudeEntries, (entry) => (
                        <>
                          <p className="font-medium text-foreground">
                            {formatDisplayDate(entry.entry_date)}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                            {entry.gratitude}
                          </p>
                        </>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Lịch sử bài tập</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderHistoryItem(homeworkSubmissions, (submission) => (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">
                              {formatDisplayDate(submission.submission_date)}
                            </span>
                            <span className="text-muted-foreground">{submission.lesson}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                            {submission.submission}
                          </p>
                          {submission.mentor_notes && (
                            <p className="mt-2 rounded-md bg-secondary/50 p-2 text-xs text-secondary-foreground">
                              Ghi chú mentor: {submission.mentor_notes}
                            </p>
                          )}
                        </>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Lịch sử tiến độ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderHistoryItem(progressUpdates, (update) => (
                      <>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="font-medium text-foreground">
                            {formatDisplayDate(update.recorded_for ?? update.recorded_at)}
                          </span>
                          <span className="text-muted-foreground">
                            Cân nặng:{" "}
                            <span className="font-medium text-foreground">{update.weight} kg</span>
                          </span>
                          <span className="text-muted-foreground">
                            Chiều cao:{" "}
                            <span className="font-medium text-foreground">{update.height} cm</span>
                          </span>
                          {update.waist && (
                            <span className="text-muted-foreground">
                              Vòng eo:{" "}
                              <span className="font-medium text-foreground">{update.waist} cm</span>
                            </span>
                          )}
                          {update.bust && (
                            <span className="text-muted-foreground">
                              Vòng ngực:{" "}
                              <span className="font-medium text-foreground">{update.bust} cm</span>
                            </span>
                          )}
                          {update.hips && (
                            <span className="text-muted-foreground">
                              Vòng mông:{" "}
                              <span className="font-medium text-foreground">{update.hips} cm</span>
                            </span>
                          )}
                        </div>
                        {update.note && (
                          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                            {update.note}
                          </p>
                        )}
                        {update.photo_url && (
                          <a
                            href={update.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                          >
                            Xem ảnh đính kèm
                          </a>
                        )}
                      </>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
