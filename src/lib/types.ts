export type DeviceStatus = {
  temperature: number | null;
  humidity: number | null;
  relay: boolean;
  valid: boolean;
  online: boolean;
  mode: "live" | "preview";
  updatedAt: string;
  message?: string;
};
