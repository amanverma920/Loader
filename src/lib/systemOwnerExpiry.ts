// src/lib/systemOwnerExpiry.ts
// Utility functions to handle system owner expiry and user auto-disable/restore

import clientPromise from '@/lib/mongodb'
import type { AdminUser } from '@/types'

/**
 * Get the system owner (the owner created by 'system')
 */
export async function getSystemOwner(): Promise<AdminUser | null> {
  const client = await clientPromise
  const db = client.db('nexpanel')
  const usersCol = db.collection<AdminUser>('users')

  // System owner is the owner created by 'system'
  const systemOwner = await usersCol.findOne({
    role: 'owner',
    createdBy: 'system',
  })

  return systemOwner
}

/**
 * Check if system owner's account is expired
 */
export async function isSystemOwnerExpired(): Promise<boolean> {
  const systemOwner = await getSystemOwner()
  if (!systemOwner || !systemOwner.accountExpiryDate) {
    return false // No expiry date means not expired
  }

  const now = new Date()
  const expiryDate = new Date(systemOwner.accountExpiryDate)
  return now >= expiryDate
}

/**
 * Disable all users except superowner when system owner expires
 * Saves previous state in previousIsActive field
 */
export async function disableUsersOnSystemOwnerExpiry(): Promise<void> {
  const client = await clientPromise
  const db = client.db('nexpanel')
  const usersCol = db.collection<AdminUser>('users')

  // Get all users except superowner
  const users = await usersCol
    .find({
      role: { $ne: 'super owner' },
    })
    .toArray()

  // Update each user: save current isActive state and disable
  for (const user of users) {
    const previousIsActive = user.isActive !== false // true if not explicitly false
    
    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          isActive: false,
          previousIsActive: previousIsActive, // Save previous state
        },
      }
    )
  }

  console.log(`✅ Disabled ${users.length} users due to system owner expiry`)
}

/**
 * Restore all users to their previous state when system owner renews
 */
export async function restoreUsersOnSystemOwnerRenewal(): Promise<void> {
  const client = await clientPromise
  const db = client.db('nexpanel')
  const usersCol = db.collection<AdminUser>('users')

  // Get all users that have previousIsActive field set (were disabled due to system owner expiry)
  const users = await usersCol
    .find({
      role: { $ne: 'super owner' },
      previousIsActive: { $exists: true },
    })
    .toArray()

  // Restore each user to their previous state
  for (const user of users) {
    const previousIsActive = user.previousIsActive !== false // true if not explicitly false
    
    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          isActive: previousIsActive,
        },
        $unset: {
          previousIsActive: '', // Remove the previousIsActive field after restoration
        },
      }
    )
  }

  console.log(`✅ Restored ${users.length} users after system owner renewal`)
}

/**
 * Check system owner expiry and handle user disable/restore automatically
 * This should be called periodically or on relevant events
 */
export async function checkAndHandleSystemOwnerExpiry(): Promise<void> {
  const systemOwner = await getSystemOwner()
  if (!systemOwner) {
    return // No system owner found
  }

  const now = new Date()
  const isExpired = systemOwner.accountExpiryDate
    ? now >= new Date(systemOwner.accountExpiryDate)
    : false

  // Check if users were previously disabled due to expiry
  const client = await clientPromise
  const db = client.db('nexpanel')
  const usersCol = db.collection<AdminUser>('users')
  
  const hasUsersWithPreviousState = await usersCol.countDocuments({
    role: { $ne: 'super owner' },
    previousIsActive: { $exists: true },
  }) > 0

  if (isExpired && !hasUsersWithPreviousState) {
    // System owner expired and users haven't been disabled yet
    await disableUsersOnSystemOwnerExpiry()
  } else if (!isExpired && hasUsersWithPreviousState) {
    // System owner renewed and users need to be restored
    await restoreUsersOnSystemOwnerRenewal()
  }
}
