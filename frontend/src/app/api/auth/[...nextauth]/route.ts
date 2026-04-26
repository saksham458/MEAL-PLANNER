import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID || "",
      clientSecret: process.env.APPLE_SECRET || "",
    }),
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        otp: { label: "OTP Code", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) return null;

        try {
          // Verify with FastAPI backend
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone_number: credentials.phone,
              otp: credentials.otp,
            }),
          });

          const data = await res.json();
          if (res.ok && data.access_token) {
            return {
              id: data.user_id.toString(),
              email: data.email,
              name: data.first_name,
              phone: credentials.phone,
              accessToken: data.access_token
            };
          }
        } catch (error) {
          console.error("NextAuth Auth Error:", error);
        }
        return null;
      }
    }),
  ],
  pages: {
    signIn: "/auth", // Use our custom glassmorphism login page
  },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      // Pass OAuth tokens + profile through for potential FastAPI backend sync
      if (account) {
        token.accessToken = account.access_token || (user as any)?.accessToken;
        token.provider = account.provider;
      }
      if (user) {
        token.id = user.id;
        token.phone = (user as any).phone;
      }
      if (profile) {
        token.name = profile.name;
        token.email = profile.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose provider info on the client-side session object
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          phone: token.phone,
        },
        accessToken: token.accessToken,
        provider: token.provider,
      };
    },
    async redirect({ url, baseUrl }) {
      // After sign-in, always redirect to the dashboard
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
