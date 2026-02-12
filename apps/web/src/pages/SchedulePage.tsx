import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { VisitWithContextResponse } from '@/lib/api-client';

// --- Date helpers ---

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayHeader(d: Date): string {
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${dayName} ${month}/${day}`;
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

// --- Calendar constants ---
const START_HOUR = 6;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const PX_PER_HOUR = 60;

function getTimeOffsetMinutes(date: Date): number {
  return (date.getHours() - START_HOUR) * 60 + date.getMinutes();
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h} ${suffix}`;
}

// --- Visit block component ---

interface VisitBlockProps {
  visit: VisitWithContextResponse;
  onClick: (visit: VisitWithContextResponse) => void;
}

function VisitBlock({ visit, onClick }: VisitBlockProps) {
  const start = new Date(visit.scheduledStart!);
  const end = visit.scheduledEnd ? new Date(visit.scheduledEnd) : new Date(start.getTime() + visit.estimatedDurationMinutes * 60000);
  const topMin = getTimeOffsetMinutes(start);
  const durationMin = (end.getTime() - start.getTime()) / 60000;
  const top = (topMin / 60) * PX_PER_HOUR;
  const height = Math.max((durationMin / 60) * PX_PER_HOUR, 24);

  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <button
      className="absolute inset-x-1 overflow-hidden rounded bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 text-left text-xs hover:bg-indigo-200 transition-colors cursor-pointer"
      style={{ top: `${top}px`, height: `${height}px` }}
      onClick={() => onClick(visit)}
      data-testid="visit-block"
    >
      <p className="font-medium text-indigo-900 truncate">{visit.jobTitle}</p>
      <p className="text-indigo-700 truncate">{visit.clientName}</p>
      <p className="text-indigo-600 truncate">{startTime} – {endTime}</p>
    </button>
  );
}

// --- Main component ---

export function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse week param or default to current week's Monday
  const weekStart = useMemo(() => {
    const param = searchParams.get('week');
    if (param) {
      const d = new Date(param + 'T00:00:00');
      if (!isNaN(d.getTime())) return getMonday(d);
    }
    return getMonday(new Date());
  }, [searchParams]);

  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Mobile day selector
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date();
    const monday = getMonday(today);
    if (weekStart.getTime() === monday.getTime()) {
      const day = today.getDay();
      return day === 0 ? 6 : day - 1;
    }
    return 0;
  });
  const selectedDay = weekDays[selectedDayIndex];

  // Fetch visits for the week
  const visitsQuery = useQuery({
    queryKey: ['visits', formatDateParam(weekStart)],
    queryFn: () =>
      apiClient.listVisits({
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
      }),
  });

  const visits = visitsQuery.data?.data ?? [];

  // Group visits by day (0 = Mon, 6 = Sun)
  const visitsByDay = useMemo(() => {
    const map = new Map<number, VisitWithContextResponse[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const v of visits) {
      if (!v.scheduledStart) continue;
      const d = new Date(v.scheduledStart);
      const dayOfWeek = d.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      map.get(dayIndex)?.push(v);
    }
    return map;
  }, [visits]);

  // Navigation
  function navigateWeek(offset: number) {
    const newWeek = addDays(weekStart, offset * 7);
    setSearchParams({ week: formatDateParam(newWeek) });
  }

  function goToToday() {
    const monday = getMonday(new Date());
    setSearchParams({ week: formatDateParam(monday) });
    const today = new Date();
    const day = today.getDay();
    setSelectedDayIndex(day === 0 ? 6 : day - 1);
  }

  // Visit click — will be handled by parent in Phase 7
  const [selectedVisit, setSelectedVisit] = useState<VisitWithContextResponse | null>(null);

  // Expose selectedVisit setter for Phase 7 modal wiring
  const handleVisitClick = (visit: VisitWithContextResponse) => {
    setSelectedVisit(visit);
  };

  // Week range display
  const rangeLabel = `${formatShortDate(weekStart)} – ${formatShortDate(addDays(weekStart, 6))}${weekStart.getFullYear() !== new Date().getFullYear() ? `, ${weekStart.getFullYear()}` : ''}`;

  const gridHeight = HOURS.length * PX_PER_HOUR;

  return (
    <div className="space-y-4" data-testid="schedule-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)} data-testid="prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="today-btn">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek(1)} data-testid="next-week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium text-muted-foreground" data-testid="week-range">
            {rangeLabel}
          </span>
        </div>
      </div>

      {/* Unscheduled panel placeholder — filled in Phase 7 */}
      <div id="unscheduled-panel-slot" />

      {/* Desktop Week View */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-border" data-testid="week-view">
        {/* Day headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div className="border-r border-border" /> {/* Time gutter header */}
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`px-2 py-2 text-center text-xs font-medium border-r border-border last:border-r-0 ${isToday(day) ? 'bg-primary/5 text-primary font-semibold' : 'text-muted-foreground'}`}
            >
              {formatDayHeader(day)}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          {/* Time gutter */}
          <div className="border-r border-border relative" style={{ height: `${gridHeight}px` }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] text-muted-foreground -translate-y-1/2"
                style={{ top: `${(hour - START_HOUR) * PX_PER_HOUR}px` }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className={`relative border-r border-border last:border-r-0 ${isToday(day) ? 'bg-primary/5' : ''}`}
              style={{ height: `${gridHeight}px` }}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-border/50"
                  style={{ top: `${(hour - START_HOUR) * PX_PER_HOUR}px` }}
                />
              ))}
              {/* Visit blocks */}
              {(visitsByDay.get(dayIndex) ?? []).map((visit) => (
                <VisitBlock key={visit.id} visit={visit} onClick={handleVisitClick} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Day View */}
      <div className="lg:hidden" data-testid="day-view">
        {/* Day selector */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDayIndex((i) => Math.max(0, i - 1))}
            disabled={selectedDayIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={`text-sm font-medium ${isToday(selectedDay) ? 'text-primary font-semibold' : ''}`}>
            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDayIndex((i) => Math.min(6, i + 1))}
            disabled={selectedDayIndex === 6}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Single day grid */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="grid" style={{ gridTemplateColumns: '50px 1fr' }}>
            {/* Time gutter */}
            <div className="border-r border-border relative" style={{ height: `${gridHeight}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-1 text-[10px] text-muted-foreground -translate-y-1/2"
                  style={{ top: `${(hour - START_HOUR) * PX_PER_HOUR}px` }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Day column */}
            <div className="relative" style={{ height: `${gridHeight}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-border/50"
                  style={{ top: `${(hour - START_HOUR) * PX_PER_HOUR}px` }}
                />
              ))}
              {(visitsByDay.get(selectedDayIndex) ?? []).map((visit) => (
                <VisitBlock key={visit.id} visit={visit} onClick={handleVisitClick} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected visit state exposed for Phase 7 modal */}
      {selectedVisit && (
        <div className="sr-only" data-testid="selected-visit-id">{selectedVisit.id}</div>
      )}
    </div>
  );
}

// Re-export for Phase 7 to extend
export type { VisitWithContextResponse };
