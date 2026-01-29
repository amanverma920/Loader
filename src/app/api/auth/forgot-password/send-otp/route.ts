import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { AdminUser } from '@/types'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

// Email sending function using nodemailer
async function sendEmail(to: string, subject: string, html: string) {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP not configured')
      return process.env.NODE_ENV === 'development'
    }

    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    // Port 465 uses SSL (secure: true), Port 587 uses STARTTLS (secure: false)
    const smtpSecure = smtpPort === 465 || process.env.SMTP_SECURE === 'true'

    // Create transporter with proper TLS configuration
    const transporterConfig: any = {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpSecure, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }

    // Add TLS options only for STARTTLS (port 587)
    if (!smtpSecure && smtpPort === 587) {
      transporterConfig.requireTLS = true
      transporterConfig.tls = {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    }

    const transporter = nodemailer.createTransport(transporterConfig)

    // Verify connection
    await transporter.verify()

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    })

    return true
  } catch (error: any) {
    console.error('Error sending email:', error.message || error)
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail } = await request.json()

    if (!usernameOrEmail) {
      return NextResponse.json(
        { success: false, message: 'Username or email is required.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')
    const otpCol = db.collection('password_reset_otps')

    // Find user by username or email
    const user = await usersCol.findOne({
      $or: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ]
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found with this username or email.' },
        { status: 404 }
      )
    }

    if (!user.email) {
      return NextResponse.json(
        { success: false, message: 'No email found for this account. Please contact administrator.' },
        { status: 400 }
      )
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete old OTPs for this user
    await otpCol.deleteMany({
      username: user.username,
      expiresAt: { $lt: new Date() }
    })

    // Save new OTP
    await otpCol.insertOne({
      username: user.username,
      otp: crypto.createHash('sha256').update(otp).digest('hex'), // Store hashed OTP
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    })

    // Send OTP email
    const logoUrl = process.env.EMAIL_LOGO_URL || 'https://i.postimg.cc/Kz0BWPmd/logo.png'
    const emailSubject = `ENGINE HOST SERVICES - Password Reset OTP`
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa; padding: 20px;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <img src="${logoUrl}" alt="ENGINE HOST SERVICES" style="max-width: 200px; height: auto; margin-bottom: 10px;" />
                            <h1 style="color: #ffffff; margin: 10px 0 0 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">ENGINE HOST SERVICES</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Password Reset Request</h2>
                            
                            <p style="color: #4b5563; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                Hello <strong style="color: #1f2937;">${user.username}</strong>,
                            </p>
                            
                            <p style="color: #4b5563; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                                You have requested to reset your password. Use the following OTP to proceed with the password reset process.
                            </p>
                            
                            <!-- OTP Box -->
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px; margin: 30px 0;">
                                <p style="color: #ffffff; margin: 0 0 10px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                                <div style="background: #ffffff; padding: 20px; border-radius: 8px; display: inline-block; margin: 10px 0;">
                                    <h1 style="color: #667eea; font-size: 42px; font-weight: 700; letter-spacing: 12px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h1>
                                </div>
                                <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; opacity: 0.9;">This OTP will expire in 10 minutes</p>
                            </div>
                            
                            <!-- Instructions -->
                            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 30px 0;">
                                <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">⚠️ Important:</p>
                                <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                                    <li>Do not share this OTP with anyone</li>
                                    <li>This OTP is valid for 10 minutes only</li>
                                    <li>If you didn't request this, please ignore this email</li>
                                </ul>
                            </div>
                            
                            <p style="color: #6b7280; margin: 30px 0 0 0; font-size: 14px; line-height: 1.6;">
                                If you have any questions or concerns, please contact our support team.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 13px;">
                                <strong style="color: #1f2937;">ENGINE HOST SERVICES</strong>
                            </p>
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                This is an automated message, please do not reply to this email.
                            </p>
                            <p style="color: #9ca3af; margin: 10px 0 0 0; font-size: 11px;">
                                © ${new Date().getFullYear()} ENGINE HOST SERVICES. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `

    try {
      await sendEmail(user.email, emailSubject, emailHtml)
      
      return NextResponse.json({
        success: true,
        message: 'OTP has been sent to your email address.',
      })
    } catch (emailError: any) {
      console.error('Email sending failed:', emailError.message || emailError)
      return NextResponse.json({
        success: false,
        message: 'Failed to send email. Please try again later.',
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}


