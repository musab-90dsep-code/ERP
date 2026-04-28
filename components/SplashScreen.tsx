'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

export const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Check if splash has already been shown in this session
    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    
    if (!hasShownSplash) {
      setShouldRender(true);
      setIsVisible(true);
      
      const timer = setTimeout(() => {
        setIsVisible(false);
        sessionStorage.setItem('hasShownSplash', 'true');
      }, 4000); // 4 seconds for a more cinematic feel

      return () => clearTimeout(timer);
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key="splash-screen-container"
            initial={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              scale: 1.05,
              filter: 'blur(30px)',
              transition: { duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] } 
            }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b0f1a]"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Ambient Glows */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.03, 0.07, 0.03],
                  x: [-20, 20, -20],
                  y: [-20, 20, -20],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#c9a84c] rounded-full blur-[180px]" 
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.02, 0.05, 0.02],
                  x: [20, -20, 20],
                  y: [20, -20, 20],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-500/30 rounded-full blur-[180px]" 
              />

              {/* Scanline / Grain Effect */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent h-[2px] w-full animate-scanline" />
            </div>

            <div className="relative flex flex-col items-center">
              {/* Logo Container */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ 
                  duration: 1.8, 
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative w-32 h-32 mb-10"
              >
                {/* Outer Ring */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-15px] border border-[#c9a84c]/10 rounded-full"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-8px] border-t-2 border-l-2 border-[#c9a84c]/20 rounded-full"
                />

                {/* Logo Shadow/Glow */}
                <div className="absolute inset-0 bg-[#c9a84c]/30 rounded-3xl blur-3xl animate-pulse" />
                
                <div className="relative w-full h-full bg-[#121826] rounded-3xl p-6 border border-[#c9a84c]/20 shadow-2xl flex items-center justify-center">
                  <Image
                    src="/icon.PNG"
                    alt="LedgerGhor Logo"
                    width={80}
                    height={80}
                    className="object-contain"
                    priority
                  />
                </div>
              </motion.div>

              {/* Text Content */}
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 1 }}
                  className="relative"
                >
                  <h1 className="text-5xl font-black tracking-[-0.06em] text-white flex">
                    LEDGER
                    <span className="text-[#c9a84c] relative">
                      GHOR
                      <motion.span 
                        animate={{ left: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                        className="absolute top-0 h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none"
                      />
                    </span>
                  </h1>
                </motion.div>
                
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '100%', opacity: 1 }}
                  transition={{ delay: 1.2, duration: 2, ease: [0.16, 1, 0.3, 1] }}
                  className="h-[1px] bg-gradient-to-r from-transparent via-[#c9a84c]/50 to-transparent mt-4 mb-6"
                />
                
                <motion.p
                  initial={{ opacity: 0, letterSpacing: '0.1em' }}
                  animate={{ opacity: 0.5, letterSpacing: '0.4em' }}
                  transition={{ delay: 1.8, duration: 1.5 }}
                  className="text-white text-[10px] uppercase font-bold"
                >
                  Next Gen Business Management
                </motion.p>
              </div>
            </div>

            {/* Progress / Loading Indicator */}
            <div className="absolute bottom-16 w-48 h-[2px] bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-full h-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        .animate-scanline {
          animation: scanline 8s linear infinite;
        }
      `}</style>
    </>
  );
};
