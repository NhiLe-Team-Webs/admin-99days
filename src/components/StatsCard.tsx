import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

export const StatsCard = ({ title, value, icon: Icon, iconBgColor, iconColor }: StatsCardProps) => {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card p-5 shadow-lg sm:p-6">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">{title}</p>
        <p className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
      </div>
      <div className={`rounded-full p-3 ${iconBgColor}`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
    </div>
  );
};
