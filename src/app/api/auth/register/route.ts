import { NextResponse, NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { sendWelcomeMail } from '@/lib/account-mails';

export async function POST(req: NextRequest) {
    try {
        // AppSec: Rate Limiting to prevent Bot/DDoS account creation spam
        const ip = getClientIP(req);
        const rl = await rateLimit(ip, 'AUTH');
        if (!rl.success) {
            return NextResponse.json(
                { message: 'Zu viele Anfragen. Bitte warte einen Moment.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        const { email, password, name } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json(
                { message: 'Bitte fülle alle Pflichtfelder aus.' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { message: 'Diese E-Mail wird bereits verwendet.' },
                { status: 400 }
            );
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create unique username placeholder
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

        // Create the user
        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                username,
                passwordHash: hashedPassword,
            },
        });

        // fire-and-forget: a missing mail server must never block a registration
        void sendWelcomeMail(newUser.email, newUser.name);

        return NextResponse.json(
            { message: 'User created', user: { id: newUser.id, email: newUser.email } },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration Error:', error);
        return NextResponse.json(
            { message: 'Ein Fehler ist aufgetreten. Bitte versuche es später.' },
            { status: 500 }
        );
    }
}
