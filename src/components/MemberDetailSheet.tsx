import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";

import {
  type GratitudeEntry,
  type Member,
  type ProgressUpdate,
  getMemberGratitudeEntries,
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
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface MemberDetailSheetProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProgressTrend = "up" | "down" | "flat";

interface ProgressStatDisplay {
  label: string;
  value: string;
  diffLabel?: string;
  trend?: ProgressTrend;
}

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
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const memberId = member?.id;

  useEffect(() => {
    if (!member || !open) {
      setGratitudeEntries([]);
      setProgressUpdates([]);
      setSelectedDate(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    console.log("Fetching data for member:", member.id, member.email);
    
    Promise.all([
      getMemberGratitudeEntries(member.id),
      getMemberProgressUpdates(member.id),
    ])
      .then(([gratitude, progress]) => {
        if (!active) return;
        console.log("✅ Loaded gratitude entries:", gratitude.length, gratitude);
        console.log("✅ Loaded progress updates:", progress.length, progress);
        
        if (gratitude.length === 0) {
          console.warn("⚠️ No gratitude entries found for member:", member.email);
        }
        if (progress.length === 0) {
          console.warn("⚠️ No progress updates found for member:", member.email);
        }
        
        setGratitudeEntries(gratitude);
        setProgressUpdates(progress);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error("Failed to load member activity", err);
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải lịch sử hoạt động. Vui lòng thử lại.",
        );
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
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

  const gratitudeByDate = useMemo(() => {
    const map = new Map<string, GratitudeEntry>();
    for (const entry of gratitudeEntries) {
      const key = normalizeDateKey(entry.entry_date);
      if (!key) continue;
      map.set(key, entry);
    }
    console.log("gratitudeByDate map:", map.size, Array.from(map.keys()));
    return map;
  }, [gratitudeEntries]);

  useEffect(() => {
    if (!open || !member) {
      setSelectedDate(null);
      return;
    }

    // Only auto-select on first open, not on every change
    if (selectedDate !== null) return;

    const gratitudeDates = Array.from(gratitudeByDate.keys()).sort();

    if (gratitudeDates.length > 0) {
      const lastKey = gratitudeDates[gratitudeDates.length - 1];
      const parsed = toDateOnly(lastKey) ?? toDateTime(lastKey) ?? null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        console.log("Auto-selecting last gratitude date:", parsed);
        setSelectedDate(parsed);
        setCurrentMonth(parsed);
        return;
      }
    }

    // If no gratitude entries, don't auto-select anything
    console.log("No gratitude entries, not auto-selecting date");
  }, [gratitudeByDate, open, member]);

  const selectedDayKey = selectedDate ? dayKey(selectedDate) : null;
  const selectedGratitude = selectedDayKey ? gratitudeByDate.get(selectedDayKey) : undefined;
  const selectedDisplayDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : null;

  const calendarFromDate = startDate ?? new Date(new Date().getFullYear(), 0, 1);
  const calendarToDate =
    dropDate ??
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    );

  // Get all dates with gratitude entries for modifiers
  const gratitudeDates = useMemo(() => {
    const dates: Date[] = [];
    gratitudeByDate.forEach((_, dateKey) => {
      const parsed = toDateOnly(dateKey) ?? toDateTime(dateKey);
      if (parsed && !Number.isNaN(parsed.getTime())) {
        dates.push(parsed);
      }
    });
    console.log("gratitudeDates for calendar:", dates.length, dates);
    return dates;
  }, [gratitudeByDate]);

  useEffect(() => {
    console.log("Calendar modifiers updated:", {
      gratitudeDatesCount: gratitudeDates.length,
      gratitudeDates: gratitudeDates,
      startDate,
      dropDate,
      calendarFromDate,
      calendarToDate,
    });
  }, [gratitudeDates, startDate, dropDate, calendarFromDate, calendarToDate]);

  const sortedProgressUpdates = useMemo(() => {
    return [...progressUpdates].sort((a, b) => {
      const aKey = normalizeDateKey(a.recorded_for ?? a.recorded_at) ?? "";
      const bKey = normalizeDateKey(b.recorded_for ?? b.recorded_at) ?? "";
      return aKey.localeCompare(bKey);
    });
  }, [progressUpdates]);

  const initialProgress = sortedProgressUpdates[0] ?? null;
  const latestProgress = sortedProgressUpdates[sortedProgressUpdates.length - 1] ?? null;

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

      if (!trackTrend || initial == null || base === latestProgress) {
        stats.push({ label, value: valueLabel });
        return;
      }

      const diffValue = Number((current - initial).toFixed(1));
      if (diffValue === 0) {
        stats.push({ label, value: valueLabel, diffLabel: "Không đổi", trend: "flat" });
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
    if (latestProgress.waist != null) {
      pushMetric("Vòng eo", latestProgress.waist, base.waist, "cm");
    }
    if (latestProgress.bust != null) {
      pushMetric("Vòng ngực", latestProgress.bust, base.bust, "cm");
    }
    if (latestProgress.hips != null) {
      pushMetric("Vòng mông", latestProgress.hips, base.hips, "cm");
    }

    return stats;
  }, [initialProgress, latestProgress]);



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
                    <CardTitle>Lịch nhật ký biết ơn</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-64 w-full" />
                      </div>
                    ) : gratitudeEntries.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          Thành viên này chưa có nhật ký biết ơn nào.
                        </p>
                      </div>
                    ) : (
                    <div className="flex flex-col gap-6 lg:flex-row">
                      <div className="flex-shrink-0">
                        <Calendar
                          mode="single"
                          month={currentMonth}
                          onMonthChange={(month) => {
                            console.log("Month changed to:", month);
                            setCurrentMonth(month);
                          }}
                          selected={selectedDate ?? undefined}
                          onSelect={(date) => {
                            console.log("Date selected:", date);
                            if (date) {
                              setSelectedDate(date);
                              setCurrentMonth(date);
                            } else {
                              setSelectedDate(null);
                            }
                          }}
                          fromDate={calendarFromDate}
                          toDate={calendarToDate}
                          modifiers={{
                            dropDay: dropDate ? [dropDate] : [],
                            startDay: startDate ? [startDate] : [],
                            hasGratitude: gratitudeDates,
                          }}
                          modifiersClassNames={{
                            dropDay: "ring-2 ring-destructive text-destructive font-semibold",
                            startDay: "ring-2 ring-primary",
                            hasGratitude: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold",
                          }}
                        />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                              Có nhật ký biết ơn
                            </span>
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
                              Hoàn thành đến ngày thứ:{" "}
                              <span className="font-medium text-foreground">
                                {dropDayNumber}
                              </span>
                            </p>
                          )}
                        </div>
                        <Separator />
                        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                          <p className="text-sm font-semibold text-foreground">
                            Nhật ký biết ơn ngày {selectedDisplayDate ?? "Chọn trên lịch"}
                          </p>
                          {selectedDate ? (
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-xs uppercase text-muted-foreground mb-2">Nội dung biết ơn</p>
                                {selectedGratitude ? (
                                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-200 dark:border-emerald-800">
                                    <p className="whitespace-pre-wrap text-emerald-800 dark:text-emerald-200 text-sm leading-relaxed">
                                      {selectedGratitude.gratitude}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground italic">Không có nhật ký biết ơn cho ngày này.</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              Chọn một ngày trên lịch để xem chi tiết nhật ký biết ơn.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                  </CardContent>
                </Card>

                {error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Biểu đồ tiến độ</CardTitle>
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
                      <p className="text-sm text-muted-foreground">Chưa có cập nhật tiến độ.</p>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                                      ? 'text-rose-600 dark:text-rose-400'
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
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
                                <XAxis 
                                  dataKey="date" 
                                  tick={{ fontSize: 11 }}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis 
                                  tick={{ fontSize: 11 }}
                                  tickLine={false}
                                  axisLine={false}
                                  width={40}
                                />
                                <Tooltip 
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--background))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '6px',
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="weight"
                                  name="Cân nặng (kg)"
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                  connectNulls
                                />
                                {hasWaistData && (
                                  <Line
                                    type="monotone"
                                    dataKey="waist"
                                    name="Vòng eo (cm)"
                                    stroke="#f97316"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    connectNulls
                                  />
                                )}
                                {hasBustData && (
                                  <Line
                                    type="monotone"
                                    dataKey="bust"
                                    name="Vòng ngực (cm)"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    connectNulls
                                  />
                                )}
                                {hasHipsData && (
                                  <Line
                                    type="monotone"
                                    dataKey="hips"
                                    name="Vòng mông (cm)"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    connectNulls
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
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

