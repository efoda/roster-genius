import { Student } from '@/types/roster';
import { Card, CardContent } from '@/components/ui/card';
import { Users, BookOpen, Calendar, TrendingUp } from 'lucide-react';

interface StatsCardsProps {
  students: Student[];
}

const StatsCards = ({ students }: StatsCardsProps) => {
  const uniqueCourses = new Set(students.map(s => s.courseName)).size;
  const uniqueDates = new Set(students.map(s => s.date)).size;
  const avgStudentsPerCourse = uniqueCourses > 0 
    ? Math.round(students.length / uniqueCourses) 
    : 0;

  const stats = [
    {
      title: 'Total Students',
      value: students.length,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600',
    },
    {
      title: 'Courses',
      value: uniqueCourses,
      icon: BookOpen,
      color: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      title: 'Session Dates',
      value: uniqueDates,
      icon: Calendar,
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      title: 'Avg per Course',
      value: avgStudentsPerCourse,
      icon: TrendingUp,
      color: 'bg-purple-500/10 text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
