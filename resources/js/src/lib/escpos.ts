/**
 * Sends raw ESC/POS bytes from the Laravel receipt endpoint to a thermal
 * printer exposed as a Web Serial device. Chrome/Edge only; falls back to the
 * browser print dialog when Web Serial is unavailable.
 */
type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  writable: { getWriter: () => { write: (data: Uint8Array) => Promise<void>; releaseLock: () => void } };
  close: () => Promise<void>;
};

type SerialLike = {
  requestPort: () => Promise<SerialPortLike>;
};

function serial(): SerialLike | null {
  const value = (navigator as Navigator & { serial?: SerialLike }).serial;
  return value ?? null;
}

export function serialSupported(): boolean {
  return Boolean(serial());
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Opens a port, writes the receipt, then closes it. Drawer kick is included in the ESC/POS bytes when enabled in store settings. */
export async function printEscpos(base64: string, baudRate = 9600): Promise<void> {
  const api = serial();
  if (!api) throw new Error('Browser ini tidak mendukung Web Serial. Gunakan Chrome atau Edge.');
  const port = await api.requestPort();
  try {
    await port.open({ baudRate });
    const writer = port.writable.getWriter();
    try {
      await writer.write(base64ToBytes(base64));
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}
