'use client';

import * as React from "react";
import { addDays, addMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, isSameDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";

interface Props {
  onRangeChange: (range: { from: Date; to: Date } | undefined) => void;
}

export default function DateRangePicker({ onRangeChange }: Props) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });

  const handleSelect = React.useCallback(
    (newDate: DateRange | undefined) => {
      setDate(newDate);
      if (newDate?.from && newDate?.to) {
        onRangeChange({
          from: newDate.from,
          to: newDate.to,
        });
      } else {
        onRangeChange(undefined);
      }
    },
    [onRangeChange]
  );

  const getShortcutRange = React.useCallback((shortcut: 'today' | 'week' | 'month') => {
    const now = new Date();
    switch (shortcut) {
      case 'today':
        return {
          from: startOfDay(now),
          to: endOfDay(now)
        };
      case 'week':
        return {
          from: startOfWeek(addDays(now, -7)),
          to: endOfWeek(now)
        };
      case 'month':
        return {
          from: startOfMonth(addMonths(now, -1)),
          to: endOfMonth(now)
        };
    }
  }, []);

  const isRangeMatchingShortcut = React.useCallback((shortcut: 'today' | 'week' | 'month') => {
    if (!date?.from || !date?.to) return false;
    const shortcutRange = getShortcutRange(shortcut);
    return isSameDay(date.from, shortcutRange.from) && isSameDay(date.to, shortcutRange.to);
  }, [date, getShortcutRange]);

  const handleShortcutClick = React.useCallback(
    (shortcut: 'today' | 'week' | 'month') => {
      const newRange = getShortcutRange(shortcut);
      handleSelect(newRange);
    },
    [handleSelect, getShortcutRange]
  );

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[300px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <div className="flex gap-2">
          <Button
            variant={isRangeMatchingShortcut('today') ? "default" : "outline"}
            size="sm"
            onClick={() => handleShortcutClick('today')}
          >
            Today
          </Button>
          <Button
            variant={isRangeMatchingShortcut('week') ? "default" : "outline"}
            size="sm"
            onClick={() => handleShortcutClick('week')}
          >
            Last Week
          </Button>
          <Button
            variant={isRangeMatchingShortcut('month') ? "default" : "outline"}
            size="sm"
            onClick={() => handleShortcutClick('month')}
          >
            Last Month
          </Button>
        </div>
      </div>
    </Card>
  );
} 