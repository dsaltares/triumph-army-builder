import { z } from 'zod';

export type InstallPlatform = 'ios' | 'android';

export type InstallDevice = {
  userAgent: string;
  maxTouchPoints: number;
};

const isIpadOnDesktopSafari = ({ userAgent, maxTouchPoints }: InstallDevice) =>
  userAgent.includes('Macintosh') && maxTouchPoints > 1;

export const installPlatform = (
  device: InstallDevice,
): InstallPlatform | null => {
  if (/iPhone|iPad|iPod/.test(device.userAgent)) {
    return 'ios';
  }
  if (isIpadOnDesktopSafari(device)) {
    return 'ios';
  }
  return device.userAgent.includes('Android') ? 'android' : null;
};

const installRecordSchema = z.object({
  visits: z.number().int().min(0),
  savedAList: z.boolean(),
  dismissed: z.boolean(),
});

export type InstallRecord = z.infer<typeof installRecordSchema>;

const firstVisit: InstallRecord = {
  visits: 0,
  savedAList: false,
  dismissed: false,
};

const visitsBeforeAsking = 2;

export const pageSettleDelayMs = 800;

export const shouldPromptInstall = ({
  visits,
  savedAList,
  dismissed,
}: InstallRecord) => !dismissed && (visits >= visitsBeforeAsking || savedAList);

const asJson = (stored: string | null) => {
  if (stored === null) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const decodeInstallRecord = (stored: string | null): InstallRecord => {
  const parsed = installRecordSchema.safeParse(asJson(stored));
  return parsed.success ? parsed.data : firstVisit;
};

export const installRecordKey = 'triumph.install_prompt';

const visitCountedKey = 'triumph.install_prompt_visit';

export const listSavedEvent = 'triumph:list-saved';

export const installRecord = () =>
  decodeInstallRecord(localStorage.getItem(installRecordKey));

const remember = (record: InstallRecord) => {
  localStorage.setItem(installRecordKey, JSON.stringify(record));
  return record;
};

export const countInstallVisit = () => {
  const record = installRecord();
  if (sessionStorage.getItem(visitCountedKey) !== null) {
    return record;
  }
  sessionStorage.setItem(visitCountedKey, 'counted');
  return remember({ ...record, visits: record.visits + 1 });
};

export const recordListSaved = () => {
  const record = installRecord();
  if (record.savedAList) {
    return;
  }
  remember({ ...record, savedAList: true });
  window.dispatchEvent(new Event(listSavedEvent));
};

export const dismissInstallPrompt = () =>
  remember({ ...installRecord(), dismissed: true });
