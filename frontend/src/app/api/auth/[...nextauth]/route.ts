import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
// Use jose for JWT operations as it's NextAuth v4's internal library
// We rely on NextAuth's default handling which uses jose
// import * as jose from 'jose'; 
// import { JWT } from "next-auth/jwt"; // No longer needed directly here

// Utility function to verify passwords
function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
  try {
    // The stored hash should be in the format: algorithm:iterations:salt:hash
    const [algorithm, iterationsStr, salt, storedHash] = hashedPassword.split(':');
    const iterations = parseInt(iterationsStr, 10);
    
    // Generate hash of the provided password using same parameters
    const hash = crypto.pbkdf2Sync(
      plainPassword,
      salt,
      iterations,
      64,
      algorithm
    ).toString('hex');
    
    // Compare the generated hash with the stored hash
    return hash === storedHash;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

// Log secret availability ONCE during module load
const jwtSecret = process.env.NEXTAUTH_SECRET;
if (!jwtSecret) {
  console.error("[NextAuth] CRITICAL: NEXTAUTH_SECRET environment variable is not set!");
} else {
  console.log("[NextAuth] NEXTAUTH_SECRET is set."); // Confirm it's loaded
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Keep detailed logs here as login issues can be tricky
        console.log("[NextAuth Authorize] Attempting authorization for:", credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.error("[NextAuth Authorize] Missing email or password");
          return null;
        }

        try {
          console.log(`[NextAuth Authorize] Looking up user: ${credentials.email}`);
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user) {
            console.warn(`[NextAuth Authorize] User not found: ${credentials.email}`);
            return null;
          }
          if (!user.password) {
              console.warn(`[NextAuth Authorize] User found but has no password stored: ${credentials.email}`);
              return null; // Should not happen with required password field
          }
          console.log(`[NextAuth Authorize] User found: ${user.id}`);

          console.log("[NextAuth Authorize] Verifying password...");
          const passwordMatch = verifyPassword(credentials.password, user.password);
          console.log(`[NextAuth Authorize] Password match result: ${passwordMatch}`);

          if (!passwordMatch) {
            console.warn(`[NextAuth Authorize] Password mismatch for user: ${credentials.email}`);
            return null;
          }

          console.log(`[NextAuth Authorize] Authorization successful for user: ${user.id}`);
          // Return the necessary user object fields for session/token creation
          return {
            id: user.id,
            email: user.email,
            name: user.name
          };
        } catch (error) {
          console.error("[NextAuth Authorize] Error during authorization:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    // Ensure these callbacks correctly populate the token and session
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET, // Top-level secret is essential for default JWT signing
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 