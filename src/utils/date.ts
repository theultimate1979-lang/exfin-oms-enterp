export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(dateTimeStr: string | undefined): string {
  if (!dateTimeStr) return '-';
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return dateTimeStr;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function calculateWorkingHours(checkInIso: string, checkOutIso: string): number {
  const start = new Date(checkInIso);
  const end = new Date(checkOutIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

export function isLateEntry(checkInIso: string, workStartHour = 9, workStartMinute = 15): boolean {
  const checkInDate = new Date(checkInIso);
  if (isNaN(checkInDate.getTime())) return false;
  
  const checkInHour = checkInDate.getHours();
  const checkInMinute = checkInDate.getMinutes();
  
  if (checkInHour > workStartHour) {
    return true;
  } else if (checkInHour === workStartHour) {
    return checkInMinute > workStartMinute;
  }
  
  return false;
}

export function calculateLeaveDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  // Set times to midnight to avoid daylight saving issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return 0;
  
  // Calculate day count inclusive
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
