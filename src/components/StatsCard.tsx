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
    <div className="bg-card p-6 rounded-xl shadow-lg flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </div>
      <div className={`p-3 rounded-full ${iconBgColor}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );
};