'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

export const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Show splash for 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.1,
            filter: 'blur(10px)',
            transition: { duration: 0.8, ease: "easeInOut" } 
          }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b0f1a]"
        >
          {/* Decorative background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#c9a84c]/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative flex flex-col items-center">
            {/* Logo Animation */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                filter: ['drop-shadow(0 0 0px #c9a84c00)', 'drop-shadow(0 0 15px #c9a84c44)', 'drop-shadow(0 0 5px #c9a84c22)'],
              }}
              transition={{ 
                duration: 1.2, 
                ease: "easeOut",
                filter: { duration: 2, repeat: Infinity, repeatType: "reverse" }
              }}
              className="relative w-32 h-32 mb-6"
            >
              <Image
                src="/logo.png"
                alt="LedgerGhor Logo"
                fill
                className="object-contain"
                priority
              />
            </motion.div>

            {/* Text Animation */}
            <div className="flex flex-col items-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="text-4xl font-black tracking-tighter text-white"
                style={{ 
                  fontFamily: 'var(--font-inter)',
                  letterSpacing: '-0.05em'
                }}
              >
                LEDGER<span className="text-[#c9a84c]">GHOR</span>
              </motion.h1>
              
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                className="h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent mt-2"
              />
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="text-white/60 text-xs tracking-[0.3em] uppercase mt-4 font-medium"
              >
                Smart Business Management
              </motion.p>
            </div>
          </div>

          {/* Loading Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-12 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-bounce" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
