// This file is kept for compatibility but the real auth configuration
// is handled dynamically in src/lib/auth-factory.ts
// which reads credentials from config.json set via the setup UI.
export { getServerSession as auth } from "@/lib/auth-factory";
