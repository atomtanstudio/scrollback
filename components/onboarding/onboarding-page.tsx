"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OnboardingLayout } from "./onboarding-layout";
import { WelcomeStep } from "./steps/welcome-step";
import { DatabaseStep, type DatabaseChoice } from "./steps/database-step";
import { ConfigureStep } from "./steps/configure-step";
import { GeminiStep } from "./steps/gemini-step";
import { XApiStep } from "./steps/xapi-step";
import { ExtensionStep } from "./steps/extension-step";

const STORAGE_KEY = "feedsilo-onboarding-step";
const DB_STORAGE_KEY = "feedsilo-onboarding-db";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const slideTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [dbChoice, setDbChoice] = useState<DatabaseChoice | null>(null);
  const [mounted, setMounted] = useState(false);

  // Hydrate from sessionStorage
  useEffect(() => {
    const savedStep = sessionStorage.getItem(STORAGE_KEY);
    const savedDb = sessionStorage.getItem(DB_STORAGE_KEY);
    if (savedStep) setStep(parseInt(savedStep, 10));
    if (savedDb) setDbChoice(savedDb as DatabaseChoice);
    setMounted(true);
  }, []);

  // Persist step to sessionStorage
  useEffect(() => {
    if (mounted) {
      sessionStorage.setItem(STORAGE_KEY, String(step));
      if (dbChoice) sessionStorage.setItem(DB_STORAGE_KEY, dbChoice);
    }
  }, [step, dbChoice, mounted]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 6));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleDbSelect = useCallback(
    (choice: DatabaseChoice) => {
      setDbChoice(choice);
    },
    []
  );

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <OnboardingLayout
      currentStep={step}
      totalSteps={6}
      onBack={step > 1 ? goBack : undefined}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
        >
          {step === 1 && <WelcomeStep onContinue={goNext} />}
          {step === 2 && (
            <DatabaseStep
              selected={dbChoice}
              onSelect={handleDbSelect}
              onContinue={goNext}
            />
          )}
          {step === 3 && dbChoice && (
            <ConfigureStep dbType={dbChoice} onContinue={goNext} />
          )}
          {step === 4 && <GeminiStep onContinue={goNext} />}
          {step === 5 && <XApiStep onContinue={goNext} />}
          {step === 6 && <ExtensionStep />}
        </motion.div>
      </AnimatePresence>
    </OnboardingLayout>
  );
}
