import { getSupabaseClient } from '../../supabase/supabaseClient'
import { generateUlid } from '../../domain/ulid'

export interface UserDevice {
  id: string
  userId: string
  deviceId: string
  deviceName: string
  userAgent?: string
  createdAt: string
  lastActiveAt: string
  isCurrent?: boolean
}

export const MAX_DEVICES_PER_USER = 3
const LOCAL_DEVICE_ID_KEY = 'splitpay_device_id'

/**
 * Returns or generates a persistent device ID for this client.
 */
export function getOrCreateDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return generateUlid()
  }
  let id = localStorage.getItem(LOCAL_DEVICE_ID_KEY)
  if (!id) {
    id = generateUlid()
    localStorage.setItem(LOCAL_DEVICE_ID_KEY, id)
  }
  return id
}

/**
 * Derives a human-readable device name from the current browser environment.
 * Examples: "Android Phone", "Windows PC (Chrome)", "MacBook (Safari)"
 */
export function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web Client'

  const ua = navigator.userAgent || ''
  let os = 'Device'
  if (/Android/i.test(ua)) os = 'Android Device'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS Device'
  else if (/Windows/i.test(ua)) os = 'Windows PC'
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Browser'
  if (/Chrome/i.test(ua) && !/Edge|OPR/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Edge/i.test(ua)) browser = 'Edge'

  return `${os} (${browser})`
}

export class DeviceService {
  /**
   * Fetches all registered active devices for a given user account.
   */
  async getRegisteredDevices(userId: string): Promise<UserDevice[]> {
    if (!userId) return []
    const currentDeviceId = getOrCreateDeviceId()

    try {
      const supabase = getSupabaseClient()
      if (!supabase) return []

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .order('last_active_at', { ascending: false })

      if (error || !Array.isArray(data)) {
        return []
      }

      return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        deviceId: d.device_id,
        deviceName: d.device_name || 'Web Browser',
        userAgent: d.user_agent,
        createdAt: d.created_at,
        lastActiveAt: d.last_active_at,
        isCurrent: d.device_id === currentDeviceId,
      }))
    } catch {
      return []
    }
  }

  /**
   * Enforces 3-device limit when logging in or connecting from a device.
   */
  async registerOrVerifyDevice(
    userId: string,
    deviceId = getOrCreateDeviceId(),
    deviceName = getDeviceName()
  ): Promise<{
    allowed: boolean
    count: number
    devices: UserDevice[]
    requiresVerification: boolean
    error?: string
  }> {
    if (!userId) {
      return { allowed: true, count: 1, devices: [], requiresVerification: false }
    }

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        // Offline-first graceful fallback
        return { allowed: true, count: 1, devices: [], requiresVerification: false }
      }

      const devices = await this.getRegisteredDevices(userId)
      const existing = devices.find((d) => d.deviceId === deviceId)

      // If already registered, update activity timestamp
      if (existing) {
        await supabase
          .from('user_devices')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('device_id', deviceId)

        return {
          allowed: true,
          count: devices.length,
          devices,
          requiresVerification: false,
        }
      }

      // Check quota limit (max 3 devices)
      if (devices.length >= MAX_DEVICES_PER_USER) {
        return {
          allowed: false,
          count: devices.length,
          devices,
          requiresVerification: true,
          error: `Account device limit reached (${devices.length}/${MAX_DEVICES_PER_USER}). Please verify with Google Authenticator or disconnect an existing device.`,
        }
      }

      // Add new device within quota
      const { error: insertErr } = await supabase.from('user_devices').insert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        last_active_at: new Date().toISOString(),
      })

      if (insertErr) {
        console.warn('Device registration notice:', insertErr.message)
      }

      const updatedDevices = await this.getRegisteredDevices(userId)
      return {
        allowed: true,
        count: updatedDevices.length,
        devices: updatedDevices,
        requiresVerification: false,
      }
    } catch (err: unknown) {
      console.warn('Device verification fallback:', err)
      return { allowed: true, count: 1, devices: [], requiresVerification: false }
    }
  }

  /**
   * Revokes an existing device to free up a slot.
   */
  async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return false

      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Authorizes a 4th device after successful Google Authenticator 2FA verification.
   * Displaces the oldest inactive device if still at maximum capacity.
   */
  async authorizeAdditionalDevice(
    userId: string,
    deviceId = getOrCreateDeviceId(),
    deviceName = getDeviceName()
  ): Promise<boolean> {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return false

      const devices = await this.getRegisteredDevices(userId)

      // If at or over capacity, remove the oldest device
      if (devices.length >= MAX_DEVICES_PER_USER) {
        const sorted = [...devices].sort(
          (a, b) => new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
        )
        const oldest = sorted[0]
        if (oldest) {
          await this.revokeDevice(userId, oldest.deviceId)
        }
      }

      // Insert new device
      const { error } = await supabase.from('user_devices').upsert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        last_active_at: new Date().toISOString(),
      })

      return !error
    } catch {
      return false
    }
  }
}

export const defaultDeviceService = new DeviceService()
