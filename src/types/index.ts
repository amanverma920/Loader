// src/types/index.ts
export type UserRole = 'super owner' | 'owner' | 'admin' | 'reseller'

export interface Key {
  _id: string
  key: string
  maxDevices: number
  currentDevices: number
  expiryDate: string
  createdAt: string
  isActive: boolean
  price?: number  // key banate time use hone wala price
  duration?: number  // duration in days or hours
  durationType?: 'hours' | 'days'  // duration type
  createdBy?: string  // username who created this key
  createdByUsername?: string  // username who created this key (for display)
  createdByRole?: string  // role of user who created this key (owner, admin, reseller, etc.)
  activatedAt?: string  // when key was first used/activated
}

export interface AdminUser {
  _id?: string
  username: string
  passwordHash: string
  role: UserRole
  createdAt: string
  createdBy?: string
  isActive: boolean
  referralCodeUsed?: string
  balance?: number
  accountExpiryDate?: string  // Account expiry date from referral code
  email?: string  // User email for password reset
  previousIsActive?: boolean  // Previous isActive state before system owner expiry (for restoration)
  serverStatus?: boolean  // User server on/off status (default: true/on)
}

export interface BlockedIP {
  _id?: string
  ip: string
  blockedAt: string
  reason: string
  attemptCount: number
  isPermanent: boolean
  expiresAt?: string
  remainingMinutes?: number | null
  isExpired?: boolean
}

export interface AdminSession {
  _id?: string
  token: string
  username: string
  role: UserRole
  createdAt: string
  expiresAt: string
}

export interface LoginAttempt {
  _id?: string
  ip: string
  username: string
  success: boolean
  timestamp: string
  userAgent?: string
}

export interface ReferralCode {
  _id?: string
  code: string
  role: UserRole
  createdBy: string
  createdAt: string
  isActive: boolean
  usedBy?: string
  usedAt?: string
  initialBalance?: number
  expiryDate?: string  // Expiry date in days from creation
  expiryDays?: number  // Number of days until expiry
}
