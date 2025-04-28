"use client";

import { motion } from "framer-motion";
import React from "react";
import { AuroraBackground } from "@/components/ui/aurora-background";

export function AuroraBackgroundDemo() {
  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative flex flex-col gap-4 items-center justify-center px-4"
      >
        <h1 className="text-5xl md:text-7xl font-extrabold dark:text-white text-center">Email Banner Builder</h1>
        <p className="mt-2 text-xl md:text-3xl font-light dark:text-neutral-200 text-center">
          Generate custom, AI-powered banners right in your inbox.
        </p>
        <button
          onClick={() => window.location.assign('/auth')}
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-fit px-6 py-3 text-lg font-semibold shadow-md transition-colors duration-200 ease-in-out"
        >
          Get Started
        </button>
      </motion.div>
    </AuroraBackground>
  );
}
