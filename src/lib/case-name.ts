export type CaseNameVehicle = {
  model?: string | null;
  year?: number | null;
  vin?: string | null;
};

export function formatCaseName(vehicle?: CaseNameVehicle | null): string {
  if (!vehicle) return "Untitled case";
  const model = vehicle.model?.trim() || "Unknown";
  const year = vehicle.year?.toString() || "—";
  const vinLast6 = vehicle.vin && vehicle.vin.length >= 6 ? vehicle.vin.slice(-6) : vehicle.vin || "—";
  return `${model}, ${year} (${vinLast6})`;
}
