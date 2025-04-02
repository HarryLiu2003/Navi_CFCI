import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Utility function to hash passwords
function hashPassword(password: string): string {
  try {
    // Use SHA-512 with 100,000 iterations and a random salt
    const algorithm = 'sha512';
    const iterations = 100000;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      64,
      algorithm
    ).toString('hex');

    // Store in the format: algorithm:iterations:salt:hash
    return `${algorithm}:${iterations}:${salt}:${hash}`;
  } catch (error) {
    console.error("Password hashing error:", error);
    throw new Error("Failed to hash password");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = hashPassword(password);

    // Create new user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json(
      { 
        message: "User created successfully", 
        user: userWithoutPassword 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
} 