import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#12101e]/60 backdrop-blur-sm flex flex-col items-center justify-center dashboard-transition">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="absolute w-24 h-24 rounded-full border-t-2 border-l-2 border-indigo-500 animate-spin"
             style={{ animationDuration: '1.5s' }} />
        
        {/* Inner purple ring */}
        <div className="absolute w-16 h-16 rounded-full border-b-2 border-r-2 border-purple-500 animate-spin"
             style={{ animationDuration: '1s' }} />
        
        {/* Center Logo Icon */}
        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      </div>
      
      {/* Loading text */}
      <div className="mt-8 flex flex-col items-center">
        <h3 className="text-white font-semibold tracking-wider text-sm uppercase">
          Loading Data
        </h3>
        <p className="text-white/40 text-xs mt-1">Please wait a moment...</p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-transition {
          animation: fade-in 0.3s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  );
}
