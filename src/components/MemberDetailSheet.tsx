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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

const PROGRESS_CHART_CONFIG = {
  weight: { label: "Cân nặng", color: "#2563eb" },
  waist: { label: "Vòng eo", color: "#0ea5e9" },
  hips: { label: "Vòng mong", color: "#f97316" },
  bust: { label: "Vòng ngực", color: "#ec4899" },
} as const;

type ProgressTrend = "up" | "down" | "flat";

interface ProgressStatDisplay {
  label: string;
  value: string;
  diffLabel?: string;
  trend?: ProgressTrend;
}

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
    case "reborn_pending":
      return "Chờ xác nhận ReBorn";
    case "reborn_active":
      return "Đang tham gia ReBorn";
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const memberId = member?.id;

  useEffect(() => {
    if (!member || !open) {
      setGratitudeEntries([]);
      setHomeworkSubmissions([]);
      setProgressUpdates([]);
      setSelectedDate(null);
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

  useEffect(() => {
    if (!open) return;

    const activityDates = Array.from(activityByDate.keys()).sort();
    const currentKey = selectedDate ? dayKey(selectedDate) : null;

    if (currentKey && activityByDate.has(currentKey)) {
      return;
    }

    if (activityDates.length > 0) {
      const lastKey = activityDates[activityDates.length - 1];
      const parsed = toDateOnly(lastKey) ?? toDateTime(lastKey) ?? null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentMonth(parsed);
        return;
      }
    }

    if (startDate) {
      setSelectedDate(startDate);
      setCurrentMonth(startDate);
    } else {
      setSelectedDate(null);
    }
  }, [activityByDate, open, selectedDate, startDate]);

  const selectedDayKey = selectedDate ? dayKey(selectedDate) : null;
  const selectedActivities = selectedDayKey ? activityByDate.get(selectedDayKey) : undefined;
  const selectedDisplayDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : null;

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
  const sortedProgressUpdates = useMemo(() => {
    return [...progressUpdates].sort((a, b) => {
      const aKey =
        normalizeDateKey(a.recorded_for ?? a.recorded_at ?? a.created_at) ?? "";
      const bKey =
        normalizeDateKey(b.recorded_for ?? b.recorded_at ?? b.created_at) ?? "";
      return aKey.localeCompare(bKey);
    });
  }, [progressUpdates]);
  const initialProgress = sortedProgressUpdates[0] ?? null;
  const latestProgress =
    sortedProgressUpdates[sortedProgressUpdates.length - 1] ?? null;
  const chartData = useMemo(
    () =>
      sortedProgressUpdates.map((update) => ({
        date: formatDisplayDate(update.recorded_for ?? update.recorded_at),
        weight: update.weight,
        waist: update.waist ?? undefined,
        bust: update.bust ?? undefined,
        hips: update.hips ?? undefined,
      })),
    [sortedProgressUpdates],
  );
  const hasWaistData = useMemo(
    () => chartData.some((item) => typeof item.waist === "number"),
    [chartData],
  );
  const hasBustData = useMemo(
    () => chartData.some((item) => typeof item.bust === "number"),
    [chartData],
  );
  const hasHipsData = useMemo(
    () => chartData.some((item) => typeof item.hips === "number"),
    [chartData],
  );
  const progressStats = useMemo<ProgressStatDisplay[]>(() => {
    if (!latestProgress) return [];

    const base = initialProgress ?? latestProgress;
    const formatNumber = (value: number) =>
      Number.isInteger(value) ? value.toString() : value.toFixed(1);
    const stats: ProgressStatDisplay[] = [];
    const pushMetric = (
      label: string,
      current: number | null | undefined,
      initial: number | null | undefined,
      unit: string,
      trackTrend = true,
    ) => {
      if (current == null) return;
      const valueLabel = `${formatNumber(current)} ${unit}`;

      if (!trackTrend || initial == null) {
        stats.push({ label, value: valueLabel });
        return;
      }

      const diffValue = Number((current - initial).toFixed(1));
      if (diffValue === 0) {
        stats.push({ label, value: valueLabel, diffLabel: "Khong doi", trend: "flat" });
        return;
      }

      stats.push({
        label,
        value: valueLabel,
        diffLabel: `${diffValue > 0 ? "+" : ""}${formatNumber(diffValue)} ${unit}`,
        trend: diffValue < 0 ? "down" : "up",
      });
    };

    pushMetric("Cân nặng", latestProgress.weight, base.weight, "kg");
    pushMetric("Chiều cao", latestProgress.height, base.height, "cm", false);
    pushMetric("Vòng eo", latestProgress.waist, base.waist, "cm");
    pushMetric("Vòng ngực", latestProgress.bust, base.bust, "cm");
    pushMetric("Vòng mông", latestProgress.hips, base.hips, "cm");

    return stats;
  }, [initialProgress, latestProgress]);

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
                      <p className="text-xs uppercase text-muted-foreground">Số báo danh</p>
                      <p className="text-base font-semibold text-foreground">
                        {member.so_bao_danh ?? "Chưa cấp"}
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
                        mode="single"
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        selected={selectedDate ?? undefined}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDate(date);
                            setCurrentMonth(date);
                          } else {
                            setSelectedDate(null);
                          }
                        }}
                        fromDate={calendarFromDate}
                        toDate={calendarToDate}
                        components={{ DayContent: renderDayContent }}
                        modifiers={{
                          dropDay: dropDate ? [dropDate] : [],
                          startDay: startDate ? [startDate] : [],
                        }}
                        modifiersClassNames={{
                          dropDay: "ring-2 ring-destructive text-destructive font-semibold",
                          startDay: "ring-2 ring-primary",
                        }}
                      />
                      <div className="flex-1 space-y-4">
                        <div>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((type) => (
                              <span key={type} className="flex items-center gap-2">
                                <span className={cn("h-2.5 w-2.5 rounded-full", ACTIVITY_COLORS[type])} />
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
                              {startDate ? format(startDate, "dd/MM/yyyy") : "Khong ro"}
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
                              Hoàn thành đến ngày thứ:{" "}
                              <span className="font-medium text-foreground">
                                {dropDayNumber}
                              </span>
                            </p>
                          )}
                        </div>
                        <Separator />
                        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                          <p className="text-sm font-semibold text-foreground">
                            Hoạt động ngày {selectedDisplayDate ?? "Chon tren lich"}
                          </p>
                          {selectedDate ? (
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Biết ơn</p>
                                {selectedActivities?.gratitude ? (
                                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                                    {selectedActivities.gratitude.gratitude}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-muted-foreground">Không có.</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              Chon mot ngay tren lich de xem chi tiet hoat dong.
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

                <Card>
                  <CardHeader>
                    <CardTitle>Lịch sử tiến độ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, index) => (
                          <div key={index} className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        ))}
                      </div>
                    ) : sortedProgressUpdates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Chua co cap nhat tien do.</p>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {progressStats.map((stat) => (
                            <div key={stat.label} className="rounded-lg border border-border bg-muted/40 p-3">
                              <p className="text-xs uppercase text-muted-foreground">{stat.label}</p>
                              <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                              {stat.diffLabel && (
                                <p
                                  className={cn(
                                    'text-xs font-medium',
                                    stat.trend === 'down'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : stat.trend === 'up'
                                      ? 'text-destructive'
                                      : 'text-muted-foreground',
                                  )}
                                >
                                  {stat.diffLabel}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-border bg-muted/40 p-4">
                          <ChartContainer config={PROGRESS_CHART_CONFIG} className="h-72">
                            <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                              <CartesianGrid strokeDasharray="4 4" className="stroke-border/60" />
                              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
                              <ChartTooltip content={<ChartTooltipContent labelKey="date" />} cursor={false} />
                              <ChartLegend content={<ChartLegendContent />} />
                              <Line
                                type="monotone"
                                dataKey="weight"
                                name={PROGRESS_CHART_CONFIG.weight.label}
                                stroke="var(--color-weight)"
                                strokeWidth={2}
                                dot
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                              {hasWaistData && (
                                <Line
                                  type="monotone"
                                  dataKey="waist"
                                  name={PROGRESS_CHART_CONFIG.waist.label}
                                  stroke="var(--color-waist)"
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls
                                />
                              )}
                              {hasBustData && (
                                <Line
                                  type="monotone"
                                  dataKey="bust"
                                  name={PROGRESS_CHART_CONFIG.bust.label}
                                  stroke="var(--color-bust)"
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls
                                />
                              )}
                              {hasHipsData && (
                                <Line
                                  type="monotone"
                                  dataKey="hips"
                                  name={PROGRESS_CHART_CONFIG.hips.label}
                                  stroke="var(--color-hips)"
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls
                                />
                              )}
                            </LineChart>
                          </ChartContainer>
                        </div>
                      </div>
                    )}
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
