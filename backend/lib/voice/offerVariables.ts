export function buildOfferDynamicVariables(input: {
  restaurantName: string;
  employeeName: string;
  role: string;
  startsAt: string;
  endsAt: string;
  hourlyRate: number;
  responseDeadline: Date;
  timeZone: string;
  managerApprovalRequired: boolean;
}) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const durationHours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0 || durationHours <= 0) {
    throw new Error("Invalid shift compensation or duration");
  }

  const clock = (value: Date) => new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit", minute: "2-digit", timeZone: input.timeZone,
  }).format(value);
  const currency = (value: number) => new Intl.NumberFormat("fr-BE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);

  return {
    restaurant_name: input.restaurantName,
    employee_first_name: input.employeeName.trim().split(/\s+/)[0] ?? input.employeeName,
    role: input.role,
    shift_date: new Intl.DateTimeFormat("fr-BE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: input.timeZone,
    }).format(startsAt),
    shift_start: clock(startsAt),
    shift_end: clock(endsAt),
    hourly_rate: currency(input.hourlyRate),
    total_amount: currency(input.hourlyRate * durationHours),
    response_deadline: new Intl.DateTimeFormat("fr-BE", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: input.timeZone,
    }).format(input.responseDeadline),
    manager_approval_required: String(input.managerApprovalRequired),
  };
}
