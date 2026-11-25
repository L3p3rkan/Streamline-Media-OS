import type { PairedDevice } from '@/lib/devices';

export type PairingPayload = {
  baseUrl: string;
  code: string;
  computerName: string;
};

export type RemoteAction = 'click' | 'home' | 'playPause' | 'volumeUp' | 'volumeDown' | 'unpair';

export type RemoteStatus = {
  computerName: string;
  inputReady: boolean;
};

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  return (
    parts[0] === 10 ||
    parts[0] === 192 && parts[1] === 168 ||
    parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
  );
}

export function parsePairingQr(data: string): PairingPayload {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error('This is not a Streamline pairing code.');
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('This is not a Streamline pairing code.');
  }

  const record = value as Record<string, unknown>;
  if (
    record.type !== 'streamline-pair' ||
    typeof record.url !== 'string' ||
    typeof record.code !== 'string' ||
    typeof record.name !== 'string' ||
    record.code.length < 8 ||
    record.code.length > 64
  ) {
    throw new Error('This QR code is missing Streamline pairing details.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(record.url);
  } catch {
    throw new Error('The QR code contains an invalid computer address.');
  }
  if (
    parsedUrl.protocol !== 'http:' ||
    parsedUrl.port !== '8766' ||
    !isPrivateIPv4(parsedUrl.hostname) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('Pairing is limited to Streamline PCs on a private Wi-Fi network.');
  }

  return {
    baseUrl: parsedUrl.origin,
    code: record.code,
    computerName: record.name.slice(0, 48),
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') return payload.error;
  } catch {
    // Use a clear status message if the kiosk did not return JSON.
  }
  return `The Streamline PC returned an error (${response.status}).`;
}

export async function pairWithComputer(
  pairing: PairingPayload,
): Promise<PairedDevice> {
  let response: Response;
  try {
    response = await fetch(`${pairing.baseUrl}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pairing.code, clientName: 'iPhone' }),
    });
  } catch {
    throw new Error('Could not reach this PC. Check that both devices are on the same Wi-Fi.');
  }
  if (!response.ok) throw new Error(await readError(response));

  const result = (await response.json()) as {
    deviceId?: unknown;
    token?: unknown;
    computerName?: unknown;
  };
  if (
    typeof result.deviceId !== 'string' ||
    typeof result.token !== 'string' ||
    typeof result.computerName !== 'string'
  ) {
    throw new Error('The Streamline PC returned an incomplete pairing response.');
  }
  return {
    id: result.deviceId,
    name: result.computerName || pairing.computerName,
    baseUrl: pairing.baseUrl,
    token: result.token,
  };
}

export async function getRemoteStatus(device: PairedDevice): Promise<RemoteStatus> {
  const response = await fetch(`${device.baseUrl}/api/status`, {
    headers: { Authorization: `Bearer ${device.token}` },
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = (await response.json()) as {
    computerName?: unknown;
    inputReady?: unknown;
  };
  return {
    computerName: typeof result.computerName === 'string' ? result.computerName : device.name,
    inputReady: result.inputReady === true,
  };
}

export async function sendRemoteAction(
  device: PairedDevice,
  action: Exclude<RemoteAction, 'unpair'>,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${device.baseUrl}/api/control`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${device.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
  } catch {
    throw new Error('The PC is not reachable. Reconnect to the same Wi-Fi and try again.');
  }
  if (!response.ok) throw new Error(await readError(response));
}

export async function unpairComputer(device: PairedDevice): Promise<void> {
  const response = await fetch(`${device.baseUrl}/api/unpair`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${device.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export function remoteSocketUrl(device: PairedDevice): string {
  const url = new URL(device.baseUrl);
  url.protocol = 'ws:';
  url.pathname = '/api/remote-input';
  url.search = `token=${encodeURIComponent(device.token)}`;
  return url.toString();
}
