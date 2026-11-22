import type { Department, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    department: Department;
    sessionVersion: number;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      department: Department;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    department: Department;
    /** Missing on tokens issued before it existed; read as 0. */
    sessionVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    department: Department;
    /** Missing on tokens issued before it existed; read as 0. */
    sessionVersion?: number;
  }
}
