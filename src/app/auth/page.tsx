"use client";

import React from "react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import AuthForm from "@/app/AuthForm";

export default function AuthPage() {
  return (
    <AuroraBackground>
      <div className="relative flex flex-col gap-6 items-center justify-center px-4">
        <h1 className="text-5xl md:text-7xl font-extrabold dark:text-white text-center">
          Email Banner Builder
        </h1>
        <p className="mt-2 text-xl md:text-2xl font-light dark:text-neutral-200 text-center">
          Sign in to continue
        </p>
        <div className="mt-6 w-full max-w-md">
          <AuthForm />
        </div>
      </div>
    </AuroraBackground>
  );
}
