// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { AdminSession, AdminUser, UserRole } from '@/types'
import { checkAndHandleSystemOwnerExpiry, getSystemOwner } from '@/lib/systemOwnerExpiry'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  const client = await clientPromise
  const db = client.db('nexpanel')

  const token = request.cookies.get('admin-token')?.value
  if (!token) return null

  const nowISO = new Date().toISOString()
  const session = await db.collection<AdminSession>('admin_sessions').findOne({
    token,
    expiresAt: { $gt: nowISO },
  })

  return session
}

// ✅ GET – list users
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.role === 'reseller') {
      return NextResponse.json(
        { success: false, message: 'Not authorized' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    let filter: any = {}

    // Check if current user is system-created owner
    const currentUser = await usersCol.findOne({ username: session.username })
    const isSystemCreatedOwner = session.role === 'owner' && (!currentUser?.createdBy || currentUser.createdBy === 'system')
    const isOwnerCreatedByOwner = session.role === 'owner' && currentUser?.createdBy && currentUser.createdBy !== 'system' && currentUser.createdBy !== session.username

    // Super owner ko koi nahi dekh sakta - always hide super owner from everyone
    // Super owner can see ALL users (no restrictions) - but no one else can see super owner
    if (session.role === 'super owner') {
      // No filter - super owner sees everything
    } else if (session.role === 'admin') {
      // Admin can only see users they created + their own account (super owner ko hide)
      filter = {
        $and: [
          { role: { $ne: 'super owner' } }, // Hide super owner
          {
            $or: [
              { username: session.username }, // Their own account
              { createdBy: session.username } // Users they created
            ]
          }
        ]
      }
    } else if (session.role === 'owner') {
      if (isSystemCreatedOwner) {
        // System-created owner can see all except super owner
        filter = { role: { $ne: 'super owner' } }
      } else if (isOwnerCreatedByOwner) {
        // Owner created by owner can only see users they created + their own account (super owner ko hide)
        filter = {
          $and: [
            { role: { $ne: 'super owner' } }, // Hide super owner
            {
              $or: [
                { username: session.username }, // Their own account
                { createdBy: session.username } // Users they created
              ]
            }
          ]
        }
      } else {
        // Default: owner can see all except super owner
        filter = { role: { $ne: 'super owner' } }
      }
    } else {
      // Reseller and others - hide super owner
      filter = { role: { $ne: 'super owner' } }
    }

    const users = await usersCol
      .find(filter, {
        projection: {
          passwordHash: 0, // never send password hash
        },
      })
      .sort({ role: 1, username: 1 })
      .toArray()

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ✅ POST – actions: setActive / updateUser / deleteUser
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.role === 'reseller') {
      return NextResponse.json(
        { success: false, message: 'Not authorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, username } = body

    if (!action || !username) {
      return NextResponse.json(
        { success: false, message: 'Invalid request.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    const target = await usersCol.findOne({ username })
    if (!target) {
      return NextResponse.json(
        { success: false, message: 'User not found.' },
        { status: 404 }
      )
    }

    // ---- COMMON PERMISSION CHECKS ----
    // Super owner ko koi edit/delete nahi kar sakta (except super owner khud)
    // Ye check sabse pehle hona chahiye
    if (target.role === 'super owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { success: false, message: 'You cannot modify super owner accounts.' },
        { status: 403 }
      )
    }

    // Check if current user is system-created owner
    const currentUser = await usersCol.findOne({ username: session.username })
    const isSystemCreatedOwner = session.role === 'owner' && (!currentUser?.createdBy || currentUser.createdBy === 'system')
    const isOwnerCreatedByOwner = session.role === 'owner' && currentUser?.createdBy && currentUser.createdBy !== 'system' && currentUser.createdBy !== session.username

    // Super owner can manage all users (except their own account, but can edit their own balance)
    // System-created owner can manage all users (except their own account and super owner)
    // Owner and Admin cannot edit their own account
    // Note: Super owner can edit their own balance (checked later in updateUser case for balance)
    if (session.role === 'super owner' && target.username === session.username) {
      // For updateUser action, check if only balance is being updated
      if (action === 'updateUser') {
        const { newBalance, newRole, newEmail, accountExpiryDate } = body as {
          newRole?: UserRole
          newEmail?: string
          newBalance?: number
          accountExpiryDate?: string | null
        }

        // If updating fields other than balance, prevent it
        if (newRole !== undefined || newEmail !== undefined || accountExpiryDate !== undefined) {
          return NextResponse.json(
            { success: false, message: 'You cannot edit other fields of your own account. You can only edit your balance.' },
            { status: 403 }
          )
        }
        // If only balance is being updated, allow it (will be processed in updateUser case)
      } else {
        // For non-updateUser actions, prevent super owner from editing their own account
        return NextResponse.json(
          { success: false, message: 'You cannot edit your own account.' },
          { status: 403 }
        )
      }
    }

    // System-created owner can manage all users (except their own account and super owner)
    if (isSystemCreatedOwner) {
      if (target.username === session.username) {
        return NextResponse.json(
          { success: false, message: 'You cannot edit your own account.' },
          { status: 403 }
        )
      }
      // System-created owner can edit all other users (owners, admins, resellers) - no further restrictions needed
      // (Super owner check already done at the top)
    } else if (session.role !== 'super owner') {
      // Owner cannot edit their own account
      if (session.role === 'owner' && target.username === session.username) {
        return NextResponse.json(
          { success: false, message: 'You cannot edit your own account.' },
          { status: 403 }
        )
      }

      // Admin cannot edit their own account
      if (session.role === 'admin' && target.username === session.username) {
        return NextResponse.json(
          { success: false, message: 'You cannot edit your own account.' },
          { status: 403 }
        )
      }

      // Owner created by owner can only edit users they created
      if (isOwnerCreatedByOwner) {
        if (target.createdBy !== session.username && action !== 'deleteUser') {
          return NextResponse.json(
            { success: false, message: 'You can only edit users you created.' },
            { status: 403 }
          )
        }
      }

      // Owner cannot edit super owner accounts (already checked at top)

      // Admin can only edit/activate users they created (but not their own account - already checked above)
      if (session.role === 'admin') {
        if (action === 'updateUser' || action === 'setActive') {
          // Admin can only edit users they created
          if (target.createdBy !== session.username) {
            return NextResponse.json(
              { success: false, message: 'You can only manage users you created.' },
              { status: 403 }
            )
          }
        } else {
          // For other actions, admin can only manage users they created
          if (target.createdBy !== session.username) {
            return NextResponse.json(
              { success: false, message: 'You cannot manage this user.' },
              { status: 403 }
            )
          }
        }
      }

      // Owner account ko koi touch nahi karega (edit/delete/disable) except:
      // - Super owner can edit all owners (already handled above)
      // - System-created owner can edit all owners (already handled above - no restrictions)
      // - Owner created by owner can only edit owners they created
      // - Admin cannot edit owners
      // System-created owner ko koi restriction nahi - wo sab owners ko edit kar sakta hai
      if (target.role === 'owner' && !isSystemCreatedOwner) {
        if (session.role === 'admin') {
          return NextResponse.json(
            { success: false, message: 'You cannot modify the owner account.' },
            { status: 403 }
          )
        }
        // Owner created by owner can only edit owners they created
        if (isOwnerCreatedByOwner && target.createdBy !== session.username && action !== 'deleteUser') {
          return NextResponse.json(
            { success: false, message: 'You can only edit owners you created.' },
            { status: 403 }
          )
        }
      }
    }

    // Khud ko delete karne se rok do (safety)
    if (action === 'deleteUser' && target.username === session.username) {
      return NextResponse.json(
        { success: false, message: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    // ---- ACTIONS ----
    switch (action) {
      case 'setActive': {
        const newStatus = Boolean(body.isActive)
        await usersCol.updateOne(
          { _id: target._id },
          { $set: { isActive: newStatus } }
        )

        return NextResponse.json({
          success: true,
          message: `User ${newStatus ? 'activated' : 'deactivated'} successfully.`,
        })
      }

      case 'updateUser': {
        const { newRole, newEmail, newBalance, accountExpiryDate } = body as {
          newRole?: UserRole
          newEmail?: string
          newBalance?: number
          accountExpiryDate?: string | null
        }

        const updateFields: any = {}

        // Role update - only super owner and system-created owner can change roles
        if (newRole !== undefined) {
          // Admin cannot change roles at all
          if (session.role === 'admin') {
            return NextResponse.json(
              { success: false, message: 'Admins cannot change user roles.' },
              { status: 403 }
            )
          }

          // Only super owner and system-created owner can change roles
          // Owner created by owner cannot change roles
          if (isOwnerCreatedByOwner) {
            return NextResponse.json(
              { success: false, message: 'You cannot change user roles.' },
              { status: 403 }
            )
          }

          if (session.role !== 'owner' && session.role !== 'super owner') {
            return NextResponse.json(
              { success: false, message: 'Only super owner and system-created owner can change user roles.' },
              { status: 403 }
            )
          }

          // Only super owner can set role to super owner
          if (newRole === 'super owner' && session.role !== 'super owner') {
            return NextResponse.json(
              { success: false, message: 'Only super owner can set role to super owner.' },
              { status: 403 }
            )
          }

          // Only super owner and system-created owner can set role to owner
          if (newRole === 'owner' && session.role !== 'super owner' && !isSystemCreatedOwner) {
            return NextResponse.json(
              { success: false, message: 'Only super owner and system-created owner can set role to owner.' },
              { status: 403 }
            )
          }

          // Super owner role cannot be changed by anyone (including super owner themselves)
          if (target.role === 'super owner' && newRole !== 'super owner') {
            return NextResponse.json(
              { success: false, message: 'Super owner role cannot be changed.' },
              { status: 403 }
            )
          }

          // Owner role can only be changed by super owner or system-created owner
          if (target.role === 'owner' && newRole !== 'owner' && session.role !== 'super owner' && !isSystemCreatedOwner) {
            return NextResponse.json(
              { success: false, message: 'Owner role can only be changed by super owner or system-created owner.' },
              { status: 403 }
            )
          }

          // System-created owner cannot assign super owner role (but can assign owner role)
          if (isSystemCreatedOwner && newRole === 'super owner') {
            return NextResponse.json(
              { success: false, message: 'System-created owner cannot assign super owner role.' },
              { status: 403 }
            )
          }

          updateFields.role = newRole
        }

        // Balance update - super owner and system-created owner can edit all, owner created by owner can only edit their created users, admin can only edit their created users
        if (newBalance !== undefined) {
          if (session.role === 'admin') {
            // Admin can only edit balance for users they created
            if (target.createdBy !== session.username) {
              return NextResponse.json(
                { success: false, message: 'You can only add balance to users you created.' },
                { status: 403 }
              )
            }
          } else if (isOwnerCreatedByOwner) {
            // Owner created by owner can only edit balance for users they created
            if (target.createdBy !== session.username) {
              return NextResponse.json(
                { success: false, message: 'You can only add balance to users you created.' },
                { status: 403 }
              )
            }
          } else if (session.role !== 'super owner' && session.role !== 'owner') {
            return NextResponse.json(
              { success: false, message: 'Only super owner and owner can edit user balance.' },
              { status: 403 }
            )
          }
          updateFields.balance = typeof newBalance === 'number' && !Number.isNaN(newBalance)
            ? Math.max(0, newBalance)
            : 0
        }

        // Account expiry date update - super owner and system-created owner can edit all, owner created by owner can only edit their created users, admin cannot edit
        if (accountExpiryDate !== undefined) {
          if (session.role === 'admin') {
            // Admin cannot edit expiry date
            return NextResponse.json(
              { success: false, message: 'Admins cannot edit account expiry date.' },
              { status: 403 }
            )
          } else if (isOwnerCreatedByOwner) {
            // Owner created by owner can only edit expiry date for users they created
            if (target.createdBy !== session.username) {
              return NextResponse.json(
                { success: false, message: 'You can only edit expiry date for users you created.' },
                { status: 403 }
              )
            }
          } else if (session.role !== 'super owner' && session.role !== 'owner') {
            return NextResponse.json(
              { success: false, message: 'Only super owner and owner can edit account expiry date.' },
              { status: 403 }
            )
          }
          // If null or empty string, remove expiry date
          if (accountExpiryDate === null || accountExpiryDate === '') {
            updateFields.accountExpiryDate = undefined
          } else {
            updateFields.accountExpiryDate = accountExpiryDate
          }
        }

        // Email update - super owner and system-created owner can edit all, owner created by owner can only edit their created users, admin cannot edit
        if (newEmail !== undefined) {
          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (newEmail && !emailRegex.test(newEmail)) {
            return NextResponse.json(
              { success: false, message: 'Please enter a valid email address.' },
              { status: 400 }
            )
          }

          if (session.role === 'admin') {
            // Admin cannot edit email
            return NextResponse.json(
              { success: false, message: 'Admins cannot edit user email.' },
              { status: 403 }
            )
          } else if (isOwnerCreatedByOwner) {
            // Owner created by owner can only edit email for users they created
            if (target.createdBy !== session.username) {
              return NextResponse.json(
                { success: false, message: 'You can only edit email for users you created.' },
                { status: 403 }
              )
            }
          } else if (session.role !== 'super owner' && session.role !== 'owner') {
            return NextResponse.json(
              { success: false, message: 'Only super owner and owner can edit user email.' },
              { status: 403 }
            )
          }
          updateFields.email = newEmail || undefined
        }

        // At least one field must be provided
        if (Object.keys(updateFields).length === 0) {
          return NextResponse.json(
            { success: false, message: 'No fields to update.' },
            { status: 400 }
          )
        }

        // Admin can only update balance - check if they're trying to update other fields
        if (session.role === 'admin') {
          const allowedFields = ['balance']
          const requestedFields = Object.keys(updateFields)
          const disallowedFields = requestedFields.filter(field => allowedFields.indexOf(field) === -1)

          if (disallowedFields.length > 0) {
            return NextResponse.json(
              { success: false, message: 'Admins can only add balance to users they created. Cannot edit other fields.' },
              { status: 403 }
            )
          }
        }

        await usersCol.updateOne(
          { _id: target._id },
          { $set: updateFields }
        )

        // Check if system owner's expiry date was updated - handle user disable/restore
        const systemOwner = await getSystemOwner()
        const isSystemOwnerUpdate = systemOwner && target.username === systemOwner.username

        if (isSystemOwnerUpdate && updateFields.accountExpiryDate !== undefined) {
          // System owner's expiry date was updated - check and handle user disable/restore
          await checkAndHandleSystemOwnerExpiry()
        }

        return NextResponse.json({
          success: true,
          message: 'User updated successfully.',
        })
      }

      case 'deleteUser': {
        // Permission checks for deleteUser
        // Super owner can delete owner and all other roles (except themselves and other super owners)
        if (session.role === 'super owner') {
          // Super owner can delete anyone except themselves (already checked above)
          // But cannot delete other super owners
          if (target.role === 'super owner' && target.username !== session.username) {
            return NextResponse.json(
              { success: false, message: 'You cannot delete other super owner accounts.' },
              { status: 403 }
            )
          }
          // Super owner can delete owner - allowed
        }
        // Owner can delete users based on their creation status
        else if (session.role === 'owner') {
          if (isSystemCreatedOwner) {
            // System-created owner can delete all users (except themselves and super owner)
            if (target.role === 'super owner') {
              return NextResponse.json(
                { success: false, message: 'You cannot delete super owner accounts.' },
                { status: 403 }
              )
            }
            // System-created owner can delete owners, admins, and resellers
          } else if (isOwnerCreatedByOwner) {
            // Owner created by owner can only delete users they created
            if (target.createdBy !== session.username) {
              return NextResponse.json(
                { success: false, message: 'You can only delete users you created.' },
                { status: 403 }
              )
            }
          }
        }
        // Admin can only delete resellers they created
        else if (session.role === 'admin') {
          if (target.role !== 'reseller' || target.createdBy !== session.username) {
            return NextResponse.json(
              { success: false, message: 'You can only delete resellers you created.' },
              { status: 403 }
            )
          }
        }

        // Delete related data first
        const keysCol = db.collection('keys')
        const devicesCol = db.collection('devices')

        // Get user's keys
        const userKeys = await keysCol.find({ createdBy: target.username }).toArray()
        const keyIds = userKeys.map((key: any) => key._id)

        // Delete all devices associated with user's keys
        if (keyIds.length > 0) {
          await devicesCol.deleteMany({ keyId: { $in: keyIds } })
        }

        // Delete all keys created by user
        if (userKeys.length > 0) {
          await keysCol.deleteMany({ createdBy: target.username })
        }

        // Delete user sessions
        const sessionsCol = db.collection('admin_sessions')
        await sessionsCol.deleteMany({ username: target.username })

        // Delete the user
        await usersCol.deleteOne({ _id: target._id })

        // Log activity
        try {
          const activitiesCol = db.collection('activities')
          await activitiesCol.insertOne({
            action: 'user_deleted',
            details: `User deleted via web panel: ${target.username} (role: ${target.role}) by ${session.username} (role: ${session.role})`,
            userId: session.username,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        } catch (error) {
          console.error('Failed to log activity:', error)
        }

        return NextResponse.json({
          success: true,
          message: 'User deleted successfully.',
        })
      }

      default:
        return NextResponse.json(
          { success: false, message: 'Unsupported action.' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Users POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
