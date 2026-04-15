'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If app is already installed or user is in standalone mode, don't show
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the native install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);

    // Hide the custom UI if they accepted
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
          className="fixed top-4 left-0 right-0 z-[100] mx-auto w-[92%] max-w-sm sm:max-w-md"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1e1b4b]/80 p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl border border-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <Download className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-bold tracking-wide text-white">Install ERP App</h3>
                <p className="text-[11px] text-indigo-200/70">Fast, offline & fullscreen</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-bold text-white shadow-lg hover:opacity-90 active:scale-95 transition-all"
              >
                Install
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
