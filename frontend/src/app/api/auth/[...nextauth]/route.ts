import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";

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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user || !user.password) {
            return null;
          }

          const passwordMatch = verifyPassword(credentials.password, user.password);

          if (!passwordMatch) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 